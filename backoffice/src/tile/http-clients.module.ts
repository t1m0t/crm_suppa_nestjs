import { Module } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios, { AxiosInstance } from 'axios';

export const TILE_SERVER = Symbol('TILE_SERVER');

@Module({
  providers: [
    {
      provide: TILE_SERVER,
      useFactory: () => {
        const instance: AxiosInstance = axios.create({
          baseURL: process.env.TILE_SERVER_BASE_URL ?? 'http://localhost:7800',
          timeout: 8000,
          headers: {
            Accept: 'application/vnd.mapbox-vector-tile',
            // 'Content-Encoding': 'gzip',
          },
        });
        return new HttpService(instance);
      },
    },
  ],
  exports: [TILE_SERVER],
})
export class HttpClientsModule {}
