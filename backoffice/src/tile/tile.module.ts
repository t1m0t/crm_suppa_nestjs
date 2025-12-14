import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TileController } from "./tile.controller";
import { HttpModule } from "@nestjs/axios";

@Module({
	imports: [
		ScheduleModule.forRoot(), // For cron jobs
		HttpModule,
	],
	controllers: [TileController],
})
export class TileModule {}
