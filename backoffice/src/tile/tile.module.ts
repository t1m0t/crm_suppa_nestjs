import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TileController } from './tile.controller';
import { TileService } from './tile.service';
import { PostgresCacheService } from './postgres-cache.service';
// import { HttpClientsModule } from 'src/tile/http-clients.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ScheduleModule.forRoot(), // For cron jobs
    HttpModule
  ],
  controllers: [TileController],
  providers: [TileService, PostgresCacheService],
  exports: [TileService, PostgresCacheService],
})
export class TileModule {}
