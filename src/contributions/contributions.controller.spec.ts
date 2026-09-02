import { Test, TestingModule } from '@nestjs/testing';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

describe('ContributionsController', () => {
  let controller: ContributionsController;
  let service: ContributionsService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockContribution = {
    id: 'contrib-1',
    cycleId,
    memberId: 'mem-1',
    amount: 10000,
    dueDate: new Date('2026-09-05T23:59:59'),
    status: 'PENDING',
    paidAt: null,
    paymentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    member: {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'user1@test.com', phone: null },
    },
  };

  beforeEach(async () => {
    const mockService = {
      generate: jest.fn().mockResolvedValue({
        generated: 3,
        contributions: [mockContribution],
      }),
      findAll: jest.fn().mockResolvedValue({
        data: [mockContribution],
        total: 1,
        page: 1,
        limit: 10,
      }),
      findOne: jest.fn().mockResolvedValue(mockContribution),
      getSummary: jest.fn().mockResolvedValue({
        totalExpected: 30000,
        totalCollected: 10000,
        totalPending: 10000,
        totalOverdue: 10000,
        memberCount: 3,
      }),
      markOverdue: jest.fn().mockResolvedValue({ marked: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContributionsController],
      providers: [
        { provide: ContributionsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ContributionsController>(ContributionsController);
    service = module.get<ContributionsService>(ContributionsService);
  });

  const mockReq = (user = adminUser) => ({ user } as any);

  describe('POST /contributions/generate', () => {
    it('should generate contributions for a cycle', async () => {
      const result = await controller.generate(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.generated).toBe(3);
      expect(service.generate).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('GET /contributions/summary', () => {
    it('should return contribution summary', async () => {
      const result = await controller.getSummary(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.totalExpected).toBe(30000);
      expect(result.memberCount).toBe(3);
      expect(service.getSummary).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });

  describe('GET /contributions', () => {
    it('should return paginated contributions', async () => {
      const result = await controller.findAll(
        committeeId,
        cycleId,
        {},
        mockReq(),
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(service.findAll).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        {},
        'admin-1',
      );
    });

    it('should pass query filters', async () => {
      const query = { status: 'PENDING' as any, page: 1, limit: 5 };
      await controller.findAll(committeeId, cycleId, query, mockReq());

      expect(service.findAll).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        query,
        'admin-1',
      );
    });
  });

  describe('GET /contributions/:id', () => {
    it('should return a single contribution', async () => {
      const result = await controller.findOne(
        committeeId,
        cycleId,
        'contrib-1',
        mockReq(),
      );

      expect(result.id).toBe('contrib-1');
      expect(service.findOne).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'contrib-1',
        'admin-1',
      );
    });
  });

  describe('POST /contributions/mark-overdue', () => {
    it('should mark overdue contributions', async () => {
      const result = await controller.markOverdue(
        committeeId,
        cycleId,
        mockReq(),
      );

      expect(result.marked).toBe(2);
      expect(service.markOverdue).toHaveBeenCalledWith(
        committeeId,
        cycleId,
        'admin-1',
      );
    });
  });
});
