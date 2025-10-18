import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TileModule } from './tile/tile.module';
import databaseConfig from './db/db.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
    }),
    TypeOrmModule.forRoot(databaseConfig()),
    TileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
