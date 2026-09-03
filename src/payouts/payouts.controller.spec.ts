import { Test, TestingModule } from '@nestjs/testing';
import {
  PayoutsController,
  CommitteePayoutsController,
  MyPayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';

describe('PayoutsController', () => {
  let controller: PayoutsController;
  let service: PayoutsService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockPayout = {
    id: 'payout-1',
    cycleId,
    memberId: 'mem-1',
    amount: 30000,
    status: 'PENDING',
    paidAt: null,
    reference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cycle: { id: cycleId, cycleNumber: 1, status: 'COMPLETED' },
    member: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue(mockPayout),
      findByCycle: jest.fn().mockResolvedValue(mockPayout),
      updateStatus: jest.fn().mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      }),
      findAll: jest.fn().mockResolvedValue({
        data: [mockPayout],
        total: 1,
        page: 1,
        limit: 10,
      }),
      getMyPayouts: jest.fn().mockResolvedValue({
        data: [mockPayout],
        total: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        PayoutsController,
        CommitteePayoutsController,
        MyPayoutsController,
      ],
      providers: [{ provide: PayoutsService, useValue: mockService }],
    }).compile();

    controller = module.get<PayoutsController>(PayoutsController);
    service = module.get<PayoutsService>(PayoutsService);
  });

  const mockReq = () => ({ user: adminUser } as any);

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /committees/:committeeId/cycles/:cycleId/payout', () => {
    it('should create a payout for the cycle', async () => {
      const result = await controller.create(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.id).toBe('payout-1');
      expect(service.create).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('GET /committees/:committeeId/cycles/:cycleId/payout', () => {
    it('should return the payout for the cycle', async () => {
      const result = await controller.findByCycle(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.id).toBe('payout-1');
      expect(service.findByCycle).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('PATCH /committees/:committeeId/cycles/:cycleId/payout/:id/status', () => {
    it('should update the payout status', async () => {
      const dto = { status: 'PROCESSING' as const };
      const result = await controller.updateStatus(
        committeeId,
        'payout-1',
        dto,
        mockReq(),
      );

      expect(result.status).toBe('PROCESSING');
      expect(service.updateStatus).toHaveBeenCalledWith(
        committeeId,
        'payout-1',
        dto,
        'admin-1',
      );
    });
  });
});

describe('CommitteePayoutsController', () => {
  let controller: CommitteePayoutsController;
  let service: PayoutsService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';

  const mockPayout = {
    id: 'payout-1',
    cycleId: 'cycle-1',
    memberId: 'mem-1',
    amount: 30000,
    status: 'PENDING',
    paidAt: null,
    reference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cycle: { id: 'cycle-1', cycleNumber: 1, status: 'COMPLETED' },
    member: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockPayout],
        total: 1,
        page: 1,
        limit: 10,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommitteePayoutsController],
      providers: [{ provide: PayoutsService, useValue: mockService }],
    }).compile();

    controller = module.get<CommitteePayoutsController>(
      CommitteePayoutsController,
    );
    service = module.get<PayoutsService>(PayoutsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /committees/:committeeId/payouts', () => {
    it('should return paginated committee payouts', async () => {
      const result = await controller.findAll(committeeId, {}, {
        user: adminUser,
      } as any);

      expect(result.total).toBe(1);
      expect(service.findAll).toHaveBeenCalledWith(
        committeeId,
        {},
        'admin-1',
      );
    });
  });
});

describe('MyPayoutsController', () => {
  let controller: MyPayoutsController;
  let service: PayoutsService;

  const user = { id: 'user-1', role: 'USER' };

  const mockPayout = {
    id: 'payout-1',
    cycleId: 'cycle-1',
    memberId: 'mem-1',
    amount: 30000,
    status: 'COMPLETED',
    paidAt: new Date(),
    reference: 'REF-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    cycle: { id: 'cycle-1', cycleNumber: 1, status: 'COMPLETED' },
    member: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      getMyPayouts: jest.fn().mockResolvedValue({
        data: [mockPayout],
        total: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyPayoutsController],
      providers: [{ provide: PayoutsService, useValue: mockService }],
    }).compile();

    controller = module.get<MyPayoutsController>(MyPayoutsController);
    service = module.get<PayoutsService>(PayoutsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /my-payouts', () => {
    it('should return the authenticated user payout information', async () => {
      const result = await controller.getMyPayouts({
        user,
      } as any);

      expect(result.total).toBe(1);
      expect(result.data[0].status).toBe('COMPLETED');
      expect(service.getMyPayouts).toHaveBeenCalledWith('user-1');
    });
  });
});
