import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
    prismaService = app.get<PrismaService>(PrismaService);
  });

  describe('GET /', () => {
    it('should return health check with database connected', async () => {
      const result = await appController.healthCheck();
      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
        timestamp: expect.any(String),
      });
    });

    it('should return database disconnected when query fails', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValueOnce(new Error('DB error'));
      const result = await appController.healthCheck();
      expect(result).toEqual({
        status: 'ok',
        database: 'disconnected',
        timestamp: expect.any(String),
      });
    });
  });
});
