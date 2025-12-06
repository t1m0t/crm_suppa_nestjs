import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TileModule } from './tile/tile.module';

@Module({
  imports: [    
    TileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
