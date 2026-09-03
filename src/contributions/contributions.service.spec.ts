import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('ContributionsService', () => {
  let service: ContributionsService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';
  const memberId = 'user-1';
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    description: null,
    contributionAmount: { toNumber: () => 10000 },
    memberLimit: 10,
    totalCycles: 5,
    payoutMethod: 'LOTTERY',
    startDate: new Date('2026-09-01'),
    dueDay: 5,
    status: 'ACTIVE',
    createdBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCycle = {
    id: cycleId,
    committeeId,
    cycleNumber: 1,
    startDate: new Date('2026-09-01'),
    endDate: null,
    status: 'ACTIVE',
    totalExpected: { toNumber: () => 30000 },
    totalCollected: { toNumber: () => 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompletedCycle = {
    ...mockCycle,
    id: 'cycle-completed',
    status: 'COMPLETED',
  };

  const mockActiveMembers = [
    { id: 'mem-1', userId: 'user-1', committeeId, status: 'ACTIVE' },
    { id: 'mem-2', userId: 'user-2', committeeId, status: 'ACTIVE' },
    { id: 'mem-3', userId: 'user-3', committeeId, status: 'ACTIVE' },
  ];

  const mockContribution = {
    id: 'contrib-1',
    cycleId,
    memberId: 'mem-1',
    amount: { toNumber: () => 10000 },
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

  const mockPrisma = {
    committee: {
      findUnique: jest.fn(),
    },
    committeeMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    cycle: {
      findFirst: jest.fn(),
    },
    contribution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ContributionsService>(ContributionsService);
    jest.resetAllMocks();
  });

  describe('generate', () => {
    it('should generate contributions for active members in an ACTIVE cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue(mockActiveMembers);
      mockPrisma.contribution.create.mockResolvedValue(mockContribution);
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) =>
        Promise.resolve(
          promises.map((_: unknown, i: number) => ({
            ...mockContribution,
            id: `contrib-${i + 1}`,
            memberId: mockActiveMembers[i].id,
          })),
        ),
      );

      const result = await service.generate(committeeId, cycleId, adminId);

      expect(result.generated).toBe(3);
      expect(result.contributions).toHaveLength(3);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should use committee contributionAmount for each contribution', async () => {
      const committeeWithAmount = {
        ...mockCommittee,
        contributionAmount: { toNumber: () => 5000 },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(committeeWithAmount);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue([mockActiveMembers[0]]);
      mockPrisma.contribution.create.mockResolvedValue({ ...mockContribution, amount: { toNumber: () => 5000 } });
      mockPrisma.$transaction.mockResolvedValue([{ ...mockContribution, amount: { toNumber: () => 5000 } }]);

      await service.generate(committeeId, cycleId, adminId);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.anything(),
        ]),
      );
    });

    it('should reject if cycle is not ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        status: 'UPCOMING',
      });

      await expect(
        service.generate(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if contributions already exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.count.mockResolvedValue(3);

      await expect(
        service.generate(committeeId, cycleId, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if no active members exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);

      await expect(
        service.generate(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.generate(committeeId, cycleId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.generate('nonexistent', cycleId, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.generate(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate dueDate from cycle startDate and committee dueDay', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        dueDay: 5,
      });
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        startDate: new Date('2026-09-01'),
      });
      mockPrisma.contribution.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue([mockActiveMembers[0]]);

      const createdData: unknown[] = [];
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) => {
        return Promise.resolve(
          promises.map((_: unknown) => ({ ...mockContribution })),
        );
      });
      mockPrisma.contribution.create.mockImplementation((args: unknown) => {
        createdData.push(args);
        return Promise.resolve(mockContribution);
      });

      await service.generate(committeeId, cycleId, adminId);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated contributions with member info for admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([mockContribution]);
      mockPrisma.contribution.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, cycleId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should return contributions for committee member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([mockContribution]);
      mockPrisma.contribution.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, cycleId, {}, memberId);

      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        cycleId,
        { status: 'PENDING' as any },
        adminId,
      );

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(committeeId, cycleId, {}, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should default to page 1 and limit 10', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      const result = await service.findAll(committeeId, cycleId, {}, adminId);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should throw NotFoundException for non-existent cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(committeeId, 'nonexistent', {}, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return a contribution with member info', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findFirst.mockResolvedValue(mockContribution);

      const result = await service.findOne(
        committeeId,
        cycleId,
        'contrib-1',
        adminId,
      );

      expect(result.id).toBe('contrib-1');
      expect(result.member).toBeDefined();
    });

    it('should throw NotFoundException for non-existent contribution', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(committeeId, cycleId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(committeeId, cycleId, 'contrib-1', 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should calculate correct totals for mixed statuses', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([
        { amount: { toNumber: () => 10000 }, status: 'PENDING' },
        { amount: { toNumber: () => 10000 }, status: 'PAID' },
        { amount: { toNumber: () => 10000 }, status: 'OVERDUE' },
      ]);

      const result = await service.getSummary(committeeId, cycleId, adminId);

      expect(result.totalExpected).toBe(30000);
      expect(result.totalCollected).toBe(10000);
      expect(result.totalPending).toBe(10000);
      expect(result.totalOverdue).toBe(10000);
      expect(result.memberCount).toBe(3);
    });

    it('should return zeros when no contributions exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getSummary(committeeId, cycleId, adminId);

      expect(result.totalExpected).toBe(0);
      expect(result.totalCollected).toBe(0);
      expect(result.totalPending).toBe(0);
      expect(result.totalOverdue).toBe(0);
      expect(result.memberCount).toBe(0);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getSummary(committeeId, cycleId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markOverdue', () => {
    it('should mark PENDING contributions past dueDate as OVERDUE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markOverdue(committeeId, cycleId, adminId);

      expect(result.marked).toBe(2);
      expect(mockPrisma.contribution.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cycleId,
            status: 'PENDING',
          }),
          data: { status: 'OVERDUE' },
        }),
      );
    });

    it('should reject for COMPLETED cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCompletedCycle);

      await expect(
        service.markOverdue(committeeId, 'cycle-completed', adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject for CANCELLED cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        status: 'CANCELLED',
      });

      await expect(
        service.markOverdue(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.markOverdue(committeeId, cycleId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.markOverdue(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return marked: 0 when no overdue contributions', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.contribution.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markOverdue(committeeId, cycleId, adminId);

      expect(result.marked).toBe(0);
    });

    it('should allow marking overdue on UPCOMING cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        status: 'UPCOMING',
      });
      mockPrisma.contribution.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markOverdue(committeeId, cycleId, adminId);

      expect(result.marked).toBe(1);
    });
  });
});
