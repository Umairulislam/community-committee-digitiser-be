import { Test, TestingModule } from '@nestjs/testing';
import { LotteriesController } from './lotteries.controller';
import { LotteryHistoryController } from './lottery-history.controller';
import { LotteriesService } from './lotteries.service';

describe('LotteriesController', () => {
  let controller: LotteriesController;
  let service: LotteriesService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockResult = {
    id: 'lot-1',
    cycleId,
    winnerMemberId: 'mem-1',
    eligibleMemberCount: 3,
    executedAt: new Date(),
    executedBy: 'admin-1',
    createdAt: new Date(),
    cycle: { id: cycleId, cycleNumber: 1, status: 'COMPLETED' },
    winner: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      getEligibility: jest.fn().mockResolvedValue({
        eligible: true,
        reason: null,
        eligibleMemberCount: 3,
      }),
      getEligibleMembers: jest.fn().mockResolvedValue({
        data: [mockResult.winner],
        total: 3,
      }),
      run: jest.fn().mockResolvedValue(mockResult),
      getResult: jest.fn().mockResolvedValue(mockResult),
      getHistory: jest.fn().mockResolvedValue({
        data: [mockResult],
        total: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LotteriesController, LotteryHistoryController],
      providers: [{ provide: LotteriesService, useValue: mockService }],
    }).compile();

    controller = module.get<LotteriesController>(LotteriesController);
    service = module.get<LotteriesService>(LotteriesService);
  });

  const mockReq = () => ({ user: adminUser } as any);

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /committees/:committeeId/cycles/:cycleId/lottery/eligibility', () => {
    it('should return eligibility verdict', async () => {
      const result = await controller.getEligibility(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.eligible).toBe(true);
      expect(result.eligibleMemberCount).toBe(3);
      expect(service.getEligibility).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('GET /committees/:committeeId/cycles/:cycleId/lottery/eligible-members', () => {
    it('should return eligible members', async () => {
      const result = await controller.getEligibleMembers(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.total).toBe(3);
      expect(service.getEligibleMembers).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('POST /committees/:committeeId/cycles/:cycleId/lottery/run', () => {
    it('should run the lottery and return the result', async () => {
      const result = await controller.run(committeeId, cycleId, mockReq());

      expect(result.id).toBe('lot-1');
      expect(result.winnerMemberId).toBe('mem-1');
      expect(service.run).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('GET /committees/:committeeId/cycles/:cycleId/lottery/result', () => {
    it('should return the lottery result for the cycle', async () => {
      const result = await controller.getResult(committeeId, cycleId, mockReq());

      expect(result.id).toBe('lot-1');
      expect(service.getResult).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });
});

describe('LotteryHistoryController', () => {
  let controller: LotteryHistoryController;
  let service: LotteriesService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';

  const mockResult = {
    id: 'lot-1',
    cycleId: 'cycle-1',
    winnerMemberId: 'mem-1',
    eligibleMemberCount: 3,
    executedAt: new Date(),
    executedBy: 'admin-1',
    createdAt: new Date(),
    cycle: { id: 'cycle-1', cycleNumber: 1, status: 'COMPLETED' },
    winner: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      getHistory: jest.fn().mockResolvedValue({
        data: [mockResult],
        total: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LotteryHistoryController],
      providers: [{ provide: LotteriesService, useValue: mockService }],
    }).compile();

    controller = module.get<LotteryHistoryController>(LotteryHistoryController);
    service = module.get<LotteriesService>(LotteriesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /committees/:committeeId/lotteries', () => {
    it('should return lottery history for the committee', async () => {
      const result = await controller.getHistory(committeeId, {
        user: adminUser,
      } as any);

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('lot-1');
      expect(service.getHistory).toHaveBeenCalledWith(committeeId, 'admin-1');
    });
  });
});
