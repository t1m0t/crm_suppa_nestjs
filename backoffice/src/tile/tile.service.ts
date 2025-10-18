import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { PostgresCacheService } from './postgres-cache.service';

const gzip = promisify(zlib.gzip);

@Injectable()
export class TileService {
    private readonly logger = new Logger(TileService.name);

    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
        private cacheService: PostgresCacheService,
    ) { }

    // Convert tile coordinates to bounding box
    private tile2bbox(z: number, x: number, y: number): string {
        const n = Math.pow(2, z);
        const lon_min = (x / n) * 360.0 - 180.0;
        const lat_min = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180.0 / Math.PI);
        const lon_max = ((x + 1) / n) * 360.0 - 180.0;
        const lat_max = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180.0 / Math.PI);

        return `ST_MakeEnvelope(${lon_min}, ${lat_min}, ${lon_max}, ${lat_max}, 4326)`;
    }

    // Get vector tile (MVT format)
    async getVectorTile(z: number, x: number, y: number): Promise<Buffer> {
        const bbox = this.tile2bbox(z, x, y);

        // Query for different layers
        const queries = {
            points: `
        SELECT 
          ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
          name,
          amenity,
          shop,
          tourism
        FROM planet_osm_point
        WHERE way && ${bbox}
          AND (name IS NOT NULL OR amenity IS NOT NULL OR shop IS NOT NULL)
      `,
            lines: `
        SELECT 
          ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
          name,
          highway,
          railway,
          waterway
        FROM planet_osm_line
        WHERE way && ${bbox}
          AND (highway IS NOT NULL OR railway IS NOT NULL OR waterway IS NOT NULL)
      `,
            polygons: `
        SELECT 
          ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
          name,
          building,
          landuse,
          natural,
          amenity
        FROM planet_osm_polygon
        WHERE way && ${bbox}
          AND (building IS NOT NULL OR landuse IS NOT NULL OR natural IS NOT NULL)
      `,
        };

        try {
            // Execute queries and combine into MVT
            const mvtQuery = `
        SELECT ST_AsMVT(tile, 'points', 4096, 'geom') AS points FROM (
          ${queries.points}
        ) AS tile
        UNION ALL
        SELECT ST_AsMVT(tile, 'lines', 4096, 'geom') AS lines FROM (
          ${queries.lines}
        ) AS tile
        UNION ALL
        SELECT ST_AsMVT(tile, 'polygons', 4096, 'geom') AS polygons FROM (
          ${queries.polygons}
        ) AS tile
      `;

            const result = await this.dataSource.query(mvtQuery);

            // Combine all MVT buffers
            const buffers = result.map(row => row.points || row.lines || row.polygons).filter(Boolean);
            return Buffer.concat(buffers);
        } catch (error) {
            console.error('Error generating tile:', error);
            throw error;
        }
    }

    // Get raster tile (GeoJSON - for simple rendering)
    async getGeoJsonTile(z: number, x: number, y: number): Promise<any> {
        const bbox = this.tile2bbox(z, x, y);

        const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(ST_AsGeoJSON(t.*)::json)
      ) as geojson
      FROM (
        SELECT 
          way AS geom,
          name,
          highway,
          building,
          amenity
        FROM planet_osm_line
        WHERE way && ${bbox}
          AND highway IS NOT NULL
        LIMIT 1000
      ) AS t
    `;

        const result = await this.dataSource.query(query);
        return result[0]?.geojson || { type: 'FeatureCollection', features: [] };
    }

    async getOptimizedTile(z: number, x: number, y: number): Promise<Buffer> {
        const cacheKey = `tile:${z}:${x}:${y}`;

        try {
            // Try cache first
            const cached = await this.cacheService.get<Buffer>(cacheKey);
            if (cached) {
                return cached;
            }

            // Generate tile
            this.logger.debug(`Generating tile: ${z}/${x}/${y}`);
            const tile = await this.generateTile(z, x, y);

            // Cache with different TTL based on zoom level
            const ttl = this.getTTL(z);
            await this.cacheService.set(cacheKey, tile, { ttl });

            return tile;
        } catch (error) {
            this.logger.error(`Error getting tile ${z}/${x}/${y}:`, error);
            throw error;
        }
    }

    // Different TTL based on zoom level
    private getTTL(z: number): number {
        if (z <= 8) return 86400000; // 24 hours for low zoom
        if (z <= 12) return 43200000; // 12 hours for medium zoom
        return 3600000; // 1 hour for high zoom
    }

    // Optimized query with zoom-level filtering
    async generateTile(z: number, x: number, y: number): Promise<Buffer> {
        const bbox = this.tile2bbox(z, x, y);

        // Adjust detail level based on zoom
        let simplification = 0;
        if (z < 10) simplification = 100;
        else if (z < 14) simplification = 10;
        else simplification = 1;

        const query = `
      WITH 
      bounds AS (
        SELECT ${bbox} AS geom
      ),
      mvtgeom AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Transform(
              ST_Simplify(way, ${simplification}), 
              4326
            ),
            bounds.geom
          ) AS geom,
          name,
          highway,
          building,
          CASE 
            WHEN highway IN ('motorway', 'trunk', 'primary') THEN 1
            WHEN highway IN ('secondary', 'tertiary') THEN 2
            ELSE 3
          END AS priority
        FROM planet_osm_line, bounds
        WHERE way && ST_Transform(bounds.geom, 3857)
          AND highway IS NOT NULL
          AND (
            (${z} >= 14) OR
            (${z} >= 12 AND highway IN ('motorway', 'trunk', 'primary', 'secondary')) OR
            (${z} < 12 AND highway IN ('motorway', 'trunk'))
          )
      )
      SELECT ST_AsMVT(mvtgeom.*, 'roads', 4096, 'geom') AS tile
      FROM mvtgeom
      WHERE geom IS NOT NULL;
    `;

        const result = await this.dataSource.query(query);
        return result[0]?.tile || Buffer.from([]);
    }

    // Clear cache for specific tile
    async clearTileCache(z: number, x: number, y: number): Promise<void> {
        const cacheKey = `tile:${z}:${x}:${y}`;
        await this.cacheService.del(cacheKey);
    }

    // Clear all tiles at specific zoom level
    async clearZoomCache(z: number): Promise<number> {
        return await this.cacheService.delPattern(`tile:${z}:*`);
    }

    // Clear all cached tiles
    async clearAllCache(): Promise<void> {
        await this.cacheService.reset();
    }

    // Get cache statistics
    async getCacheStats() {
        return await this.cacheService.getStats();
    }

    // Get most popular tiles
    async getPopularTiles(limit: number = 10) {
        return await this.cacheService.getTopTiles(limit);
    }
}