import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { FastifyReply } from 'fastify';
import { firstValueFrom } from 'rxjs';

const PG_TILE_SERV_BASE = process.env.TILE_SERVER_BASE_URL;

@Controller('tiles')
export class TileController {
  constructor(private readonly http: HttpService) {}

  // 🔹 Proxy the PBF tiles: /tiles/:layer/:z/:x/:y.pbf
  @Get(':layer/:z/:x/:y.pbf')
  async getTile(
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: FastifyReply,
  ) {
    const url = `${PG_TILE_SERV_BASE}/${layer}/${z}/${x}/${y}.pbf`;

    try {
      const upstream = await firstValueFrom(
        this.http.get(url, {
          responseType: 'arraybuffer', // important: binary
          validateStatus: () => true, // pass-through status
        }),
      );

      // Pass status code
      res.status(upstream.status || HttpStatus.OK);

      // Pass through content-type & encoding if present
      const ct =
        upstream.headers['content-type'] ||
        'application/vnd.mapbox-vector-tile';
      res.header('Content-Type', ct);

      const ce = upstream.headers['content-encoding'];
      if (ce) {
        res.header('Content-Encoding', ce);
      }

      // Copy cache headers too if you want
      const cacheControl = upstream.headers['cache-control'];
      if (cacheControl) {
        res.header('Cache-Control', cacheControl);
      }

      return res.send(Buffer.from(upstream.data));
    } catch (e) {
      console.error('Tile proxy error:', e);
      return res.status(502).send('Bad gateway (tile server unreachable)');
    }
  }

  // 🔹 Proxy the layer JSON metadata (your custom JSON)
  // GET /tiles/:layer.json  ->  http://localhost:7800/:layer.json
  @Get(':layer.json')
  async getLayerMetadata(
    @Param('layer') layer: string,
    @Res() res: FastifyReply,
  ) {
    const url = `${PG_TILE_SERV_BASE}/${layer}.json`;

    try {
      const upstream = await firstValueFrom(
        this.http.get(url, {
          validateStatus: () => true,
        }),
      );

      res.status(upstream.status || HttpStatus.OK);
      res.header(
        'Content-Type',
        upstream.headers['content-type'] || 'application/json',
      );

      return res.send(upstream.data);
    } catch (e) {
      console.error('Metadata proxy error:', e);
      return res.status(502).send('Bad gateway (pg_tileserv unreachable)');
    }
  }
}
