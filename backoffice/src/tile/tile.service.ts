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

    try {
      // Generate each layer separately
      const pointsQuery = `
        WITH mvt_data AS (
          SELECT 
            ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
            name,
            amenity,
            shop,
            tourism
          FROM planet_osm_point
          WHERE way && ${bbox}
            AND (name IS NOT NULL OR amenity IS NOT NULL OR shop IS NOT NULL)
            AND ST_AsMVTGeom(way, ${bbox}::box2d) IS NOT NULL
        )
        SELECT ST_AsMVT(mvt_data, 'points', 4096, 'geom') AS tile
        FROM mvt_data;
      `;

      const linesQuery = `
        WITH mvt_data AS (
          SELECT 
            ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
            name,
            highway,
            railway,
            waterway
          FROM planet_osm_line
          WHERE way && ${bbox}
            AND (highway IS NOT NULL OR railway IS NOT NULL OR waterway IS NOT NULL)
            AND ST_AsMVTGeom(way, ${bbox}::box2d) IS NOT NULL
        )
        SELECT ST_AsMVT(mvt_data, 'lines', 4096, 'geom') AS tile
        FROM mvt_data;
      `;

      const polygonsQuery = `
        WITH mvt_data AS (
          SELECT 
            ST_AsMVTGeom(way, ${bbox}::box2d) AS geom,
            name,
            building,
            landuse,
            'natural',
            amenity
          FROM planet_osm_polygon
          WHERE way && ${bbox}
            AND (building IS NOT NULL OR landuse IS NOT NULL OR 'natural' IS NOT NULL)
            AND ST_AsMVTGeom(way, ${bbox}::box2d) IS NOT NULL
        )
        SELECT ST_AsMVT(mvt_data, 'polygons', 4096, 'geom') AS tile
        FROM mvt_data;
      `;

      // Execute queries in parallel
      const [pointsResult, linesResult, polygonsResult] = await Promise.all([
        this.dataSource.query(pointsQuery),
        this.dataSource.query(linesQuery),
        this.dataSource.query(polygonsQuery)
      ]);

      // Combine MVT tiles properly
      const tiles = [
        pointsResult[0]?.tile,
        linesResult[0]?.tile,
        polygonsResult[0]?.tile
      ].filter(tile => tile && tile.length > 0);

      if (tiles.length === 0) {
        // Return empty MVT tile
        return Buffer.from([]);
      }

      // If multiple tiles, concatenate them
      return Buffer.concat(tiles);

    } catch (error) {
      this.logger.error('Error generating MVT tile:', error);
      // Return empty tile instead of throwing
      return Buffer.from([]);
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
      const tile = await this.generateTile(z, x, y);
      // const tile = await this.getVectorTile(z, x, y);
      if (tile.length) {
        this.logger.debug(`Generated tile: ${z}/${x}/${y} (size: ${tile.length} bytes)`);
      }
      // Cache with different TTL based on zoom level
      const ttl = this.getTTL(z);
      process.env.CACHE_TILE_ENABLED === 'true' && await this.cacheService.set(cacheKey, tile, { ttl });

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

    const CRS_EPSG = 4326;

    const query = `
      WITH 
      bounds AS (
        SELECT ${bbox} AS geom
      ),
      cities AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Transform(way, ${CRS_EPSG}),
            bounds.geom
          ) AS geom,
          name,
          place,
          admin_level,
          population::integer as population,
          CASE 
            WHEN place = 'city' THEN 1
            WHEN place = 'town' THEN 2
            WHEN place = 'village' THEN 3
            WHEN place = 'hamlet' THEN 4
            ELSE 5
          END AS priority
        FROM planet_osm_polygon, bounds
        WHERE way && ST_Transform(bounds.geom, ${CRS_EPSG})
          AND place IN ('city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood')
          AND name IS NOT NULL
          AND (
            (${z} >= 12) OR
            (${z} >= 8 AND place IN ('city', 'town')) OR
            (${z} < 8 AND place = 'city')
          )
      ),
      city_points AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Transform(way, ${CRS_EPSG}),
            bounds.geom
          ) AS geom,
          name,
          place,
          population::integer as population,
          CASE 
            WHEN place = 'city' THEN 1
            WHEN place = 'town' THEN 2
            WHEN place = 'village' THEN 3
            ELSE 4
          END AS priority
        FROM planet_osm_point, bounds
        WHERE way && ST_Transform(bounds.geom, ${CRS_EPSG})
          AND place IN ('city', 'town', 'village', 'hamlet')
          AND name IS NOT NULL
          AND (
            (${z} >= 10) OR
            (${z} >= 6 AND place IN ('city', 'town')) OR
            (${z} < 6 AND place = 'city')
          )
      )
      SELECT ST_AsMVT(cities.*, 'cities', 4096, 'geom') ||
             ST_AsMVT(city_points.*, 'city_points', 4096, 'geom') AS tile
      FROM (SELECT * FROM cities WHERE geom IS NOT NULL) cities,
           (SELECT * FROM city_points WHERE geom IS NOT NULL) city_points;
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