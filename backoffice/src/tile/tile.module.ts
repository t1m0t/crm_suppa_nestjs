import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TileController } from './tile.controller';
import { TileGeneratorService } from './tile.service';
import { PostgresCacheService } from './postgres-cache.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // For cron jobs
  ],
  controllers: [TileController],
  providers: [
    TileGeneratorService,
    PostgresCacheService,
  ],
  exports: [
    TileGeneratorService,
    PostgresCacheService,
  ],
})
export class TileModule { }