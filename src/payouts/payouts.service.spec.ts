import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PayoutsService', () => {
  let service: PayoutsService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';
  const memberId = 'mem-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
  };

  const mockCycle = {
    id: cycleId,
    committeeId,
    cycleNumber: 1,
    status: 'COMPLETED',
    totalCollected: { toNumber: () => 30000 },
  };

  const mockLotteryResult = {
    id: 'lot-1',
    cycleId,
    winnerMemberId: memberId,
    eligibleMemberCount: 3,
    executedAt: new Date(),
    executedBy: adminId,
    createdAt: new Date(),
  };

  const mockPayout = {
    id: 'payout-1',
    cycleId,
    memberId,
    amount: { toNumber: () => 30000 },
    status: 'PENDING',
    paidAt: null,
    reference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cycle: { id: cycleId, cycleNumber: 1, status: 'COMPLETED' },
    member: {
      id: memberId,
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    committeeMember: { findUnique: jest.fn() },
    cycle: { findFirst: jest.fn() },
    lotteryResult: { findUnique: jest.fn() },
    payout: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should create a payout for a valid lottery winner with backend-determined amount', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockLotteryResult);
      mockPrisma.payout.create.mockResolvedValue(mockPayout);

      const result = await service.create(committeeId, cycleId, adminId);

      expect(result.id).toBe('payout-1');
      expect(mockPrisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cycleId,
            memberId,
            amount: 30000,
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should throw ConflictException when payout already exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(mockPayout);

      await expect(
        service.create(committeeId, cycleId, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when no lottery result exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);

      await expect(
        service.create(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cycle has no collected funds', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        totalCollected: { toNumber: () => 0 },
      });
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockLotteryResult);

      await expect(
        service.create(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when caller is not the committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.create(committeeId, cycleId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should translate unique constraint violation to ConflictException', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(null);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockLotteryResult);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`cycleId`)',
        { code: 'P2002', clientVersion: '6.19.3' },
      );
      mockPrisma.payout.create.mockRejectedValue(prismaError);

      await expect(
        service.create(committeeId, cycleId, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for missing cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.create(committeeId, 'missing', adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCycle', () => {
    it('should return the payout for a cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(mockPayout);

      const result = await service.findByCycle(committeeId, cycleId, adminId);

      expect(result.id).toBe('payout-1');
      expect(result.member.id).toBe(memberId);
    });

    it('should throw NotFoundException when no payout exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.payout.findUnique.mockResolvedValue(null);

      await expect(
        service.findByCycle(committeeId, cycleId, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findByCycle(committeeId, cycleId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return paginated committee payouts', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findMany.mockResolvedValue([mockPayout]);
      mockPrisma.payout.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.payout.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { status: 'COMPLETED' as const },
        adminId,
      );

      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should transition PENDING to PROCESSING', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        cycle: { committeeId },
      });
      mockPrisma.payout.update.mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });

      const result = await service.updateStatus(
        committeeId,
        'payout-1',
        { status: 'PROCESSING' },
        adminId,
      );

      expect(result.status).toBe('PROCESSING');
    });

    it('should transition PROCESSING to COMPLETED and set paidAt', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
        cycle: { committeeId },
      });
      mockPrisma.payout.update.mockResolvedValue({
        ...mockPayout,
        status: 'COMPLETED',
        paidAt: new Date(),
        reference: 'REF-001',
      });

      const result = await service.updateStatus(
        committeeId,
        'payout-1',
        { status: 'COMPLETED', reference: 'REF-001' },
        adminId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            paidAt: expect.any(Date),
            reference: 'REF-001',
          }),
        }),
      );
    });

    it('should transition PROCESSING to FAILED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
        cycle: { committeeId },
      });
      mockPrisma.payout.update.mockResolvedValue({
        ...mockPayout,
        status: 'FAILED',
      });

      const result = await service.updateStatus(
        committeeId,
        'payout-1',
        { status: 'FAILED' },
        adminId,
      );

      expect(result.status).toBe('FAILED');
    });

    it('should allow retry from FAILED to PROCESSING', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        status: 'FAILED',
        cycle: { committeeId },
      });
      mockPrisma.payout.update.mockResolvedValue({
        ...mockPayout,
        status: 'PROCESSING',
      });

      const result = await service.updateStatus(
        committeeId,
        'payout-1',
        { status: 'PROCESSING' },
        adminId,
      );

      expect(result.status).toBe('PROCESSING');
    });

    it('should reject any transition from COMPLETED (historical record)', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        status: 'COMPLETED',
        cycle: { committeeId },
      });

      await expect(
        service.updateStatus(
          committeeId,
          'payout-1',
          { status: 'PROCESSING' },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject skipping PENDING directly to COMPLETED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        status: 'PENDING',
        cycle: { committeeId },
      });

      await expect(
        service.updateStatus(
          committeeId,
          'payout-1',
          { status: 'COMPLETED' },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if payout belongs to a different committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue({
        ...mockPayout,
        cycle: { committeeId: 'other-comm' },
      });

      await expect(
        service.updateStatus(
          committeeId,
          'payout-1',
          { status: 'PROCESSING' },
          adminId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent payout', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payout.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          committeeId,
          'missing',
          { status: 'PROCESSING' },
          adminId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyPayouts', () => {
    it('should return payouts where the user is the winning member', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([mockPayout]);

      const result = await service.getMyPayouts('user-1');

      expect(result.total).toBe(1);
      expect(mockPrisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { member: { userId: 'user-1' } },
        }),
      );
    });

    it('should return empty when user has no payouts', async () => {
      mockPrisma.payout.findMany.mockResolvedValue([]);

      const result = await service.getMyPayouts('user-1');

      expect(result.total).toBe(0);
    });
  });
});
