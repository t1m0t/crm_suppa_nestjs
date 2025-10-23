import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TileController } from './tile.controller';
import { TileService } from './tile.service';
import { PostgresCacheService } from './postgres-cache.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // For cron jobs
  ],
  controllers: [TileController],
  providers: [
    TileService,
    PostgresCacheService,
  ],
  exports: [
    TileService,
    PostgresCacheService,
  ],
})
export class TileModule { }