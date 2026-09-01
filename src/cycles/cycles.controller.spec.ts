import { Test, TestingModule } from '@nestjs/testing';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';

describe('CyclesController', () => {
  let controller: CyclesController;
  let service: CyclesService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';

  const mockCycle = {
    id: 'cycle-1',
    committeeId,
    cycleNumber: 1,
    startDate: new Date('2026-09-01'),
    endDate: null,
    status: 'ACTIVE',
    totalExpected: 30000,
    totalCollected: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCycle2 = {
    id: 'cycle-2',
    committeeId,
    cycleNumber: 2,
    startDate: null,
    endDate: null,
    status: 'UPCOMING',
    totalExpected: 30000,
    totalCollected: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      generate: jest.fn().mockResolvedValue({
        generated: 5,
        cycles: [mockCycle, mockCycle2],
      }),
      findAll: jest.fn().mockResolvedValue({
        data: [mockCycle, mockCycle2],
        total: 2,
        page: 1,
        limit: 10,
      }),
      findOne: jest.fn().mockResolvedValue(mockCycle),
      updateStatus: jest.fn().mockResolvedValue({
        ...mockCycle,
        status: 'COMPLETED',
      }),
      startNext: jest.fn().mockResolvedValue({
        completed: { ...mockCycle, status: 'COMPLETED' },
        activated: { ...mockCycle2, status: 'ACTIVE' },
        committeeCompleted: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CyclesController],
      providers: [
        { provide: CyclesService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<CyclesController>(CyclesController);
    service = module.get<CyclesService>(CyclesService);
  });

  const mockReq = (user = adminUser) => ({ user } as any);

  describe('POST /committees/:committeeId/cycles/generate', () => {
    it('should generate cycles for a committee', async () => {
      const dto = {};
      const result = await controller.generate(committeeId, dto, mockReq());

      expect(result.generated).toBe(5);
      expect(service.generate).toHaveBeenCalledWith(
        committeeId,
        'admin-1',
        undefined,
      );
    });

    it('should pass optional startDate', async () => {
      const dto = { startDate: '2026-10-01' };
      const result = await controller.generate(committeeId, dto, mockReq());

      expect(result.generated).toBe(5);
      expect(service.generate).toHaveBeenCalledWith(
        committeeId,
        'admin-1',
        '2026-10-01',
      );
    });
  });

  describe('GET /committees/:committeeId/cycles', () => {
    it('should return paginated cycles', async () => {
      const result = await controller.findAll(committeeId, {}, mockReq());

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(service.findAll).toHaveBeenCalledWith(
        committeeId,
        {},
        'admin-1',
      );
    });

    it('should pass query filters', async () => {
      const query = { status: 'ACTIVE' as any, page: 1, limit: 5 };
      await controller.findAll(committeeId, query, mockReq());

      expect(service.findAll).toHaveBeenCalledWith(
        committeeId,
        query,
        'admin-1',
      );
    });
  });

  describe('GET /committees/:committeeId/cycles/:id', () => {
    it('should return a single cycle', async () => {
      const result = await controller.findOne(committeeId, 'cycle-1', mockReq());

      expect(result.id).toBe('cycle-1');
      expect(service.findOne).toHaveBeenCalledWith(
        committeeId,
        'cycle-1',
        'admin-1',
      );
    });
  });

  describe('PATCH /committees/:committeeId/cycles/:id/status', () => {
    it('should update cycle status', async () => {
      const dto = { status: 'COMPLETED' as any };
      const result = await controller.updateStatus(
        committeeId,
        'cycle-1',
        dto,
        mockReq(),
      );

      expect(result.status).toBe('COMPLETED');
      expect(service.updateStatus).toHaveBeenCalledWith(
        committeeId,
        'cycle-1',
        'COMPLETED',
        'admin-1',
      );
    });
  });

  describe('POST /committees/:committeeId/cycles/start-next', () => {
    it('should start the next cycle', async () => {
      const result = await controller.startNext(committeeId, mockReq());

      expect(result.completed).toBeTruthy();
      expect(result.activated).toBeTruthy();
      expect(result.committeeCompleted).toBe(false);
      expect(service.startNext).toHaveBeenCalledWith(
        committeeId,
        'admin-1',
      );
    });
  });
});
