import {
    Controller,
    Get,
    Param,
    Header,
    Res,
    Delete,
    HttpException,
    HttpStatus
} from '@nestjs/common';
import type { Response } from 'express';
import { TileGeneratorService } from './tile.service';
import { PostgresCacheService } from './postgres-cache.service';

@Controller('tiles')
export class TileController {
    constructor(
        private readonly tileService: TileGeneratorService,
        private readonly cacheService: PostgresCacheService,
    ) { }

    @Get(':z/:x/:y.mvt')
    @Header('Content-Type', 'application/x-protobuf')
    @Header('Content-Encoding', 'gzip')
    @Header('Access-Control-Allow-Origin', '*')
    @Header('Cache-Control', 'public, max-age=3600')
    async getTile(
        @Param('z') z: string,
        @Param('x') x: string,
        @Param('y') y: string,
        @Res() res: Response,
    ) {
        const zNum = parseInt(z);
        const xNum = parseInt(x);
        const yNum = parseInt(y);

        try {
            const tile = await this.tileService.generateTile(zNum, xNum, yNum);
            console.log(`Served tile ${z}/${x}/${y}, size: ${tile.length} bytes`);
            res.send(tile);
        } catch (error) {
            throw new HttpException('Error serving tile', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Cache management endpoints

    // @Delete('cache/:z/:x/:y')
    // async clearSpecificTile(
    //     @Param('z') z: string,
    //     @Param('x') x: string,
    //     @Param('y') y: string,
    // ) {
    //     await this.tileService.clearTileCache(parseInt(z), parseInt(x), parseInt(y));
    //     return { message: `Cache cleared for tile ${z}/${x}/${y}` };
    // }

    // @Delete('cache/zoom/:z')
    // async clearZoomLevel(@Param('z') z: string) {
    //     const count = await this.tileService.clearZoomCache(parseInt(z));
    //     return { message: `Cleared ${count} tiles at zoom level ${z}` };
    // }

    // @Delete('cache')
    // async clearAllCache() {
    //     await this.tileService.clearAllCache();
    //     return { message: 'All cache cleared' };
    // }

    // @Get('cache/stats')
    // async getCacheStats() {
    //     return await this.tileService.getCacheStats();
    // }

    // @Get('cache/popular')
    // async getPopularTiles() {
    //     return await this.tileService.getPopularTiles(20);
    // }

    // @Get('cache/cleanup')
    // async cleanupExpired() {
    //     const count = await this.cacheService.cleanupExpired();
    //     return { message: `Cleaned up ${count} expired cache entries` };
    // }

    // TileJSON endpoint
    @Get('tiles.json')
    @Header('Content-Type', 'application/json')
    getTileJson() {
        return {
            tilejson: '3.0.0',
            name: 'Cached OSM Tiles',
            description: 'Self-hosted OpenStreetMap vector tiles with PostgreSQL caching',
            version: '1.0.0',
            attribution: '© OpenStreetMap contributors',
            scheme: 'xyz',
            tiles: ['http://localhost:3000/tiles/{z}/{x}/{y}.mvt'],
            minzoom: 0,
            maxzoom: 18,
            bounds: [-180, -85.0511, 180, 85.0511],
            center: [0, 0, 2],
        };
    }
}