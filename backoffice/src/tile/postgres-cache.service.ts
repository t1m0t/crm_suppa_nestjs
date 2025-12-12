import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { sql } from "bun";

export interface CacheOptions {
	ttl?: number; // Time to live in milliseconds
}

@Injectable()
export class PostgresCacheService implements OnModuleInit {
	private readonly logger = new Logger(PostgresCacheService.name);
	private readonly defaultTTL = 3600000; // 1 hour in milliseconds

	constructor() {}

	async onModuleInit() {
		await this.ensureCacheTable();
		this.logger.log("PostgreSQL cache service initialized");
	}

	// Ensure cache table exists
	private async ensureCacheTable() {
		try {
			await sql`
        CREATE TABLE IF NOT EXISTS tile_cache (
          cache_key VARCHAR(255) PRIMARY KEY,
          tile_data BYTEA NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL,
          hit_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP DEFAULT NOW()
        )`;

			await sql`
        CREATE INDEX IF NOT EXISTS idx_tile_cache_expires ON tile_cache(expires_at);
      `;
			await sql`
        CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache(last_accessed);
      `;
			this.logger.log("Cache table verified");
		} catch (error) {
			this.logger.error("Error creating cache table:", error);
		}
	}

	// Get value from cache
	async get<T = Buffer>(key: string): Promise<T | null> {
		try {
			const result = await sql`
        UPDATE tile_cache 
        SET hit_count = hit_count + 1, last_accessed = NOW()
        WHERE cache_key = ${key} AND expires_at > NOW()
        RETURNING tile_data
        `;

			if (result && result.length > 0) {
				this.logger.debug(`Cache hit: ${key}`);
				return result[0].tile_data as T;
			}

			this.logger.debug(`Cache miss: ${key}`);
			return null;
		} catch (error) {
			this.logger.error(`Error getting cache key ${key}:`, error);
			return null;
		}
	}

	// Set value in cache
	async set<T = Buffer>(
		key: string,
		value: T,
		options?: CacheOptions,
	): Promise<void> {
		try {
			const ttl = options?.ttl || this.defaultTTL;
			const expiresAt = new Date(Date.now() + ttl);

			await sql`
        INSERT INTO tile_cache (cache_key, tile_data, expires_at)
        VALUES (${key}, ${value}, ${expiresAt})
        ON CONFLICT (cache_key) 
        DO UPDATE SET 
          tile_data = EXCLUDED.tile_data,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW(),
          hit_count = 0
        `;

			this.logger.debug(
				`Cache set: ${key} (expires: ${expiresAt.toISOString()})`,
			);
		} catch (error) {
			this.logger.error(`Error setting cache key ${key}:`, error);
			throw error;
		}
	}

	// Delete specific key from cache
	async del(key: string): Promise<void> {
		try {
			await sql`
        DELETE FROM tile_cache WHERE cache_key = ${key}
      `;
			this.logger.debug(`Cache deleted: ${key}`);
		} catch (error) {
			this.logger.error(`Error deleting cache key ${key}:`, error);
		}
	}

	// Delete keys by pattern (e.g., "tile:12:*")
	async delPattern(pattern: string): Promise<number> {
		try {
			// Convert pattern to PostgreSQL LIKE pattern
			const likePattern = pattern.replace(/\*/g, "%");

			const result = await sql`
        DELETE FROM tile_cache WHERE cache_key LIKE ${likePattern} RETURNING cache_key
      `;

			const count = result.length;
			this.logger.debug(
				`Deleted ${count} cache entries matching pattern: ${pattern}`,
			);
			return count;
		} catch (error) {
			this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
			return 0;
		}
	}

	// Clear all cache
	async reset(): Promise<void> {
		try {
			const result = await sql`
        DELETE FROM tile_cache RETURNING cache_key
      `;
			this.logger.log(`Cache cleared: ${result.length} entries deleted`);
		} catch (error) {
			this.logger.error("Error clearing cache:", error);
		}
	}

	// Clean up expired entries (called by cron job)
	async cleanupExpired(): Promise<number> {
		try {
			const result = await sql`
        DELETE FROM tile_cache WHERE expires_at < NOW() RETURNING cache_key
      `;

			const count = result.length;
			if (count > 0) {
				this.logger.log(`Cleaned up ${count} expired cache entries`);
			}
			return count;
		} catch (error) {
			this.logger.error("Error cleaning up expired cache:", error);
			return 0;
		}
	}

	// Get cache statistics
	async getStats() {
		try {
			const result = await sql`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
          SUM(hit_count) as total_hits,
          AVG(hit_count) as avg_hits_per_entry,
          pg_size_pretty(pg_total_relation_size('tile_cache')) as table_size,
          MIN(created_at) as oldest_entry,
          MAX(last_accessed) as last_access
        FROM tile_cache
      `;

			return result[0];
		} catch (error) {
			this.logger.error("Error getting cache stats:", error);
			return null;
		}
	}

	// Get most accessed tiles
	async getTopTiles(limit: number = 10) {
		try {
			const result = await sql`
        SELECT 
          cache_key,
          hit_count,
          created_at,
          last_accessed,
          expires_at > NOW() as is_active
        FROM tile_cache
        ORDER BY hit_count DESC
        LIMIT ${limit}
      `;

			return result;
		} catch (error) {
			this.logger.error("Error getting top tiles:", error);
			return [];
		}
	}

	// Cron job to clean up expired entries every hour
	@Cron(CronExpression.EVERY_HOUR)
	async scheduledCleanup() {
		this.logger.debug("Running scheduled cache cleanup...");
		await this.cleanupExpired();
	}

	// Optional: Clean up least accessed tiles when cache grows too large
	async limitCacheSize(maxEntries: number) {
		try {
			const countResult = await sql`
        SELECT COUNT(*) as count FROM tile_cache WHERE expires_at > NOW()
      `;

			const currentCount = parseInt(countResult[0].count);

			if (currentCount > maxEntries) {
				const toDelete = currentCount - maxEntries;

				await sql`
          DELETE FROM tile_cache
          WHERE cache_key IN (
            SELECT cache_key 
            FROM tile_cache 
            WHERE expires_at > NOW()
            ORDER BY hit_count ASC, last_accessed ASC
            LIMIT ${toDelete}
          )
        `;

				this.logger.log(
					`Pruned ${toDelete} least-used cache entries to maintain size limit`,
				);
			}
		} catch (error) {
			this.logger.error("Error limiting cache size:", error);
		}
	}
}
