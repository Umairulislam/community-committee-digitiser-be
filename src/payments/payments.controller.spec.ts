import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';

  const mockPayment = {
    id: 'pay-1',
    contributionId: 'contrib-1',
    memberId: 'mem-1',
    amount: 10000,
    transactionReference: 'TXN-001',
    status: 'PENDING',
    paidAt: new Date(),
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contribution: {
      id: 'contrib-1',
      cycleId: 'cycle-1',
      memberId: 'mem-1',
      amount: 10000,
      status: 'PENDING',
      member: {
        id: 'mem-1',
        role: 'MEMBER',
        status: 'ACTIVE',
        user: { id: 'user-1', name: 'User 1', email: 'user1@test.com', phone: null },
      },
    },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue(mockPayment),
      findAll: jest.fn().mockResolvedValue({
        data: [mockPayment],
        total: 1,
        page: 1,
        limit: 10,
      }),
      findOne: jest.fn().mockResolvedValue(mockPayment),
      verify: jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'VERIFIED',
        verifiedAt: new Date(),
      }),
      reject: jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'REJECTED',
        verifiedAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  const mockReq = (user = adminUser) => ({ user } as any);

  describe('POST /committees/:committeeId/payments', () => {
    it('should record a payment', async () => {
      const dto = {
        contributionId: 'contrib-1',
        amount: 10000,
        transactionReference: 'TXN-001',
      };

      const result = await controller.record(committeeId, dto, mockReq());

      expect(result.id).toBe('pay-1');
      expect(service.create).toHaveBeenCalledWith(committeeId, dto, 'admin-1');
    });
  });

  describe('GET /committees/:committeeId/payments', () => {
    it('should return paginated payments', async () => {
      const result = await controller.findAll(committeeId, {}, mockReq());

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass query filters', async () => {
      const query = { status: 'VERIFIED' as any, page: 1, limit: 5 };
      await controller.findAll(committeeId, query, mockReq());

      expect(service.findAll).toHaveBeenCalledWith(committeeId, query, 'admin-1');
    });
  });

  describe('GET /committees/:committeeId/payments/:id', () => {
    it('should return a single payment', async () => {
      const result = await controller.findOne(committeeId, 'pay-1', mockReq());

      expect(result.id).toBe('pay-1');
      expect(service.findOne).toHaveBeenCalledWith(committeeId, 'pay-1', 'admin-1');
    });
  });

  describe('POST /committees/:committeeId/payments/:id/verify', () => {
    it('should verify a payment', async () => {
      const result = await controller.verify(committeeId, 'pay-1', mockReq());

      expect(result.status).toBe('VERIFIED');
      expect(service.verify).toHaveBeenCalledWith(committeeId, 'pay-1', 'admin-1');
    });
  });

  describe('POST /committees/:committeeId/payments/:id/reject', () => {
    it('should reject a payment', async () => {
      const result = await controller.reject(committeeId, 'pay-1', mockReq());

      expect(result.status).toBe('REJECTED');
      expect(service.reject).toHaveBeenCalledWith(committeeId, 'pay-1', 'admin-1');
    });
  });
});
