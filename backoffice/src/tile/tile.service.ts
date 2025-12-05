import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { PostgresCacheService } from './postgres-cache.service';
import { HttpService } from '@nestjs/axios';
import { TILE_SERVER } from 'src/tile/http-clients.module';
import { firstValueFrom } from 'rxjs';

const gzip = promisify(zlib.gzip);

@Injectable()
export class TileService {
  private readonly logger = new Logger(TileService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private cacheService: PostgresCacheService,
    @Inject(TILE_SERVER) private readonly tileServer: HttpService,
  ) {}

  // Convert tile coordinates to bounding box
  private tile2bbox(z: number, x: number, y: number): string {
    const n = Math.pow(2, z);
    const lon_min = (x / n) * 360.0 - 180.0;
    const lat_min =
      Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) *
      (180.0 / Math.PI);
    const lon_max = ((x + 1) / n) * 360.0 - 180.0;
    const lat_max =
      Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180.0 / Math.PI);

    return `ST_MakeEnvelope(${lon_min}, ${lat_min}, ${lon_max}, ${lat_max}, 4326)`;
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

  async getTile(z: number, x: number, y: number): Promise<Buffer> {
    try {
      const cacheKey = `tile:${z}:${x}:${y}`;
      if (process.env.CACHE_TILE_ENABLED === 'true') {
        // Try cache first
        const cached = await this.cacheService.get<Buffer>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Generate tile
      const response = await firstValueFrom(
        this.tileServer.get<Buffer>(`/${z}/${x}/${y}`),
      );
      const gzipedTile: Buffer = response.data;
      // const tile = await this.getVectorTile(z, x, y);
      if (gzipedTile.length) {
        this.logger.debug(
          `Generated tile: ${z}/${x}/${y} (size: ${gzipedTile.length} bytes)`,
        );
      }
      // Cache with different TTL based on zoom level
      const ttl = this.getTTL(z);
      process.env.CACHE_TILE_ENABLED === 'true' &&
        (await this.cacheService.set(cacheKey, gzipedTile, { ttl }));

      return gzipedTile;
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
