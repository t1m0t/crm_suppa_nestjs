import { Test, TestingModule } from '@nestjs/testing';
import { TileController } from './tile.controller';

describe('TileController', () => {
  let controller: TileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TileController],
    }).compile();

    controller = module.get<TileController>(TileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
