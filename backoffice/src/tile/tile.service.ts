import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class TileGeneratorService {
  private readonly logger = new Logger(TileGeneratorService.name);
  private readonly tileDir = path.join(process.cwd(), 'tiles');

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    // Ensure tile directory exists
    fs.ensureDirSync(this.tileDir);
  }

  // Convert tile coordinates to bounding box (Web Mercator)
  private tile2bbox(z: number, x: number, y: number) {
    const worldMercMax = 20037508.34;
    const worldMercMin = -worldMercMax;
    const worldMercSize = worldMercMax - worldMercMin;
    const worldTileSize = Math.pow(2, z);
    const tileMercSize = worldMercSize / worldTileSize;

    const xmin = worldMercMin + tileMercSize * x;
    const xmax = worldMercMin + tileMercSize * (x + 1);
    const ymin = worldMercMax - tileMercSize * (y + 1);
    const ymax = worldMercMax - tileMercSize * y;

    return { xmin, ymin, xmax, ymax };
  }

  // Generate single vector tile
  async generateTile(z: number, x: number, y: number): Promise<Buffer> {
    const bbox = this.tile2bbox(z, x, y);
    
    // Adjust simplification based on zoom level
    const simplification = this.getSimplification(z);
    const envelope = `ST_MakeEnvelope(${bbox.xmin}, ${bbox.ymin}, ${bbox.xmax}, ${bbox.ymax}, 3857)`;

    try {
      // Generate MVT with multiple layers
      const query = `
      WITH 
      bounds AS (
        SELECT ${envelope}::geometry AS geom
      ),
      
      -- Administrative boundaries (villages, districts, etc.)
      boundaries AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Simplify(way, ${simplification}),
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          name,
          admin_level,
          boundary,
          CASE 
            WHEN admin_level = '4' THEN 'state'
            WHEN admin_level = '5' THEN 'region'
            WHEN admin_level = '6' THEN 'district'
            WHEN admin_level = '7' THEN 'municipality'
            WHEN admin_level = '8' THEN 'village'
            WHEN admin_level = '9' THEN 'subvillage'
            WHEN admin_level = '10' THEN 'neighborhood'
            ELSE 'other'
          END AS boundary_type
        FROM planet_osm_polygon
        CROSS JOIN bounds
        WHERE way && bounds.geom
          AND boundary = 'administrative'
          AND admin_level IS NOT NULL
          AND (
            (${z} >= 8 AND admin_level IN ('8', '9', '10')) OR
            (${z} >= 6 AND admin_level IN ('6', '7')) OR
            (${z} >= 4 AND admin_level IN ('4', '5'))
          )
      ),
      
      -- Village/district labels (points)
      labels AS (
        SELECT 
          ST_AsMVTGeom(
            way,
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          name,
          place,
          population,
          CASE 
            WHEN place = 'city' THEN 1
            WHEN place = 'town' THEN 2
            WHEN place = 'village' THEN 3
            WHEN place = 'hamlet' THEN 4
            WHEN place = 'suburb' THEN 5
            WHEN place = 'neighbourhood' THEN 6
            ELSE 7
          END AS priority
        FROM planet_osm_point
        CROSS JOIN bounds
        WHERE ${z} >= 8
          AND way && bounds.geom
          AND place IN ('city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'locality')
      ),
      
      -- Buildings layer (only at high zoom)
      buildings AS (
        SELECT 
          ST_AsMVTGeom(
            way,
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          name,
          building,
          "building:levels" AS levels
        FROM planet_osm_polygon
        CROSS JOIN bounds
        WHERE ${z} >= 14
          AND way && bounds.geom
          AND building IS NOT NULL
      ),
      
      -- POIs layer
      pois AS (
        SELECT 
          ST_AsMVTGeom(
            way,
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          name,
          amenity,
          shop,
          tourism,
          leisure
        FROM planet_osm_point
        CROSS JOIN bounds
        WHERE ${z} >= 12
          AND way && bounds.geom
          AND (amenity IS NOT NULL OR shop IS NOT NULL OR tourism IS NOT NULL)
      ),
      
      -- Water/natural layer
      water AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Simplify(way, ${simplification}),
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          name,
          waterway,
          natural
        FROM planet_osm_polygon
        CROSS JOIN bounds
        WHERE way && bounds.geom
          AND (waterway IS NOT NULL OR natural IN ('water', 'wetland'))
      ),
      
      -- Landuse layer
      landuse AS (
        SELECT 
          ST_AsMVTGeom(
            ST_Simplify(way, ${simplification * 2}),
            bounds.geom,
            4096,
            256,
            true
          ) AS geom,
          landuse,
          leisure,
          natural
        FROM planet_osm_polygon
        CROSS JOIN bounds
        WHERE ${z} >= 10
          AND way && bounds.geom
          AND (landuse IS NOT NULL OR leisure IS NOT NULL OR natural IS NOT NULL)
          AND natural NOT IN ('water', 'wetland')
      ),
      
      -- MVT layers
      mvt_boundaries AS (
        SELECT ST_AsMVT(boundaries.*, 'boundaries', 4096, 'geom') AS mvt
        FROM boundaries
        WHERE geom IS NOT NULL
      ),
      mvt_labels AS (
        SELECT ST_AsMVT(labels.*, 'labels', 4096, 'geom') AS mvt
        FROM labels
        WHERE geom IS NOT NULL
      ),
      mvt_buildings AS (
        SELECT ST_AsMVT(buildings.*, 'buildings', 4096, 'geom') AS mvt
        FROM buildings
        WHERE geom IS NOT NULL
      ),
      mvt_pois AS (
        SELECT ST_AsMVT(pois.*, 'pois', 4096, 'geom') AS mvt
        FROM pois
        WHERE geom IS NOT NULL
      ),
      mvt_water AS (
        SELECT ST_AsMVT(water.*, 'water', 4096, 'geom') AS mvt
        FROM water
        WHERE geom IS NOT NULL
      ),
      mvt_landuse AS (
        SELECT ST_AsMVT(landuse.*, 'landuse', 4096, 'geom') AS mvt
        FROM landuse
        WHERE geom IS NOT NULL
      )
      
      -- Combine all MVT layers
      SELECT 
        COALESCE((SELECT mvt FROM mvt_boundaries), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_labels), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_buildings), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_pois), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_water), ''::bytea) ||
        COALESCE((SELECT mvt FROM mvt_landuse), ''::bytea)
      AS tile;
    `;

    const result = await this.dataSource.query(query);
    const tile = result[0]?.tile;

    if (!tile || tile.length === 0) {
      // Return empty tile
      return Buffer.from([]);
    }

    // Compress with gzip
    return await gzip(tile);
  } catch (error) {
    this.logger.error(`Error generating tile ${z}/${x}/${y}:`, error);
    throw error;
  }
  }

  // Get simplification tolerance based on zoom level
  private getSimplification(z: number): number {
    if (z >= 14) return 1;
    if (z >= 12) return 5;
    if (z >= 10) return 10;
    if (z >= 8) return 50;
    return 100;
  }

  // Save tile to filesystem
  async saveTile(z: number, x: number, y: number, data: Buffer): Promise<void> {
    const tilePath = this.getTilePath(z, x, y);
    await fs.ensureDir(path.dirname(tilePath));
    await fs.writeFile(tilePath, data);
    this.logger.debug(`Saved tile: ${z}/${x}/${y}`);
  }

  // Get tile from filesystem
  async getTile(z: number, x: number, y: number): Promise<Buffer | null> {
    const tilePath = this.getTilePath(z, x, y);
    
    try {
      if (await fs.pathExists(tilePath)) {
        return await fs.readFile(tilePath);
      }
    } catch (error) {
      this.logger.error(`Error reading tile ${z}/${x}/${y}:`, error);
    }
    
    return null;
  }

  // Check if tile exists
  async tileExists(z: number, x: number, y: number): Promise<boolean> {
    const tilePath = this.getTilePath(z, x, y);
    return fs.pathExists(tilePath);
  }

  // Get tile file path
  private getTilePath(z: number, x: number, y: number): string {
    return path.join(this.tileDir, `${z}`, `${x}`, `${y}.mvt`);
  }

  // Calculate number of tiles for zoom level
  getTileCount(z: number): number {
    return Math.pow(4, z); // 4^z tiles per zoom level
  }

  // Get tile bounds for a geographic area
  getTileBounds(z: number, minLon: number, minLat: number, maxLon: number, maxLat: number) {
    const n = Math.pow(2, z);
    
    const xMin = Math.floor(((minLon + 180) / 360) * n);
    const xMax = Math.floor(((maxLon + 180) / 360) * n);
    
    const yMin = Math.floor((1 - Math.log(Math.tan((maxLat * Math.PI) / 180) + 1 / Math.cos((maxLat * Math.PI) / 180)) / Math.PI) / 2 * n);
    const yMax = Math.floor((1 - Math.log(Math.tan((minLat * Math.PI) / 180) + 1 / Math.cos((minLat * Math.PI) / 180)) / Math.PI) / 2 * n);
    
    return { xMin, xMax, yMin, yMax };
  }

  // Get storage statistics
  async getStorageStats() {
    let totalSize = 0;
    let tileCount = 0;

    const countTiles = async (dir: string) => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          await countTiles(fullPath);
        } else if (item.endsWith('.mvt')) {
          totalSize += stat.size;
          tileCount++;
        }
      }
    };

    if (await fs.pathExists(this.tileDir)) {
      await countTiles(this.tileDir);
    }

    return {
      tileCount,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
    };
  }
}