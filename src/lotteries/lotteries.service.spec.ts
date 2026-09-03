import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LotteriesService } from './lotteries.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LotteriesService', () => {
  let service: LotteriesService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
  };

  const mockActiveCycle = {
    id: cycleId,
    committeeId,
    cycleNumber: 1,
    status: 'ACTIVE',
  };

  const mockCompletedCycle = {
    id: cycleId,
    committeeId,
    cycleNumber: 1,
    status: 'COMPLETED',
  };

  const members = [
    {
      id: 'mem-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'User 1', email: 'u1@test.com', phone: null },
    },
    {
      id: 'mem-2',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-2', name: 'User 2', email: 'u2@test.com', phone: null },
    },
    {
      id: 'mem-3',
      role: 'MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-3', name: 'User 3', email: 'u3@test.com', phone: null },
    },
  ];

  const paidContributions = members.map((m) => ({
    id: `contrib-${m.id}`,
    cycleId,
    memberId: m.id,
    status: 'PAID',
    member: m,
  }));

  const mockResult = {
    id: 'lot-1',
    cycleId,
    winnerMemberId: 'mem-1',
    eligibleMemberCount: 3,
    executedAt: new Date(),
    executedBy: adminId,
    createdAt: new Date(),
    cycle: { id: cycleId, cycleNumber: 1, status: 'COMPLETED' },
    winner: members[0],
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    committeeMember: { findUnique: jest.fn() },
    cycle: { findFirst: jest.fn(), update: jest.fn() },
    contribution: { findMany: jest.fn() },
    lotteryResult: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotteriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LotteriesService>(LotteriesService);
    jest.resetAllMocks();
  });

  describe('getEligibility', () => {
    it('should return eligible with member count for a valid active cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);

      const result = await service.getEligibility(committeeId, cycleId, adminId);

      expect(result.eligible).toBe(true);
      expect(result.eligibleMemberCount).toBe(3);
      expect(result.reason).toBeNull();
    });

    it('should return not eligible when lottery already executed', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockResult);

      const result = await service.getEligibility(committeeId, cycleId, adminId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('already been executed');
    });

    it('should return not eligible when cycle is not ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCompletedCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);

      const result = await service.getEligibility(committeeId, cycleId, adminId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('ACTIVE');
    });

    it('should return not eligible when no paid contributions', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getEligibility(committeeId, cycleId, adminId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('paid contributions');
    });

    it('should return not eligible when all paid members are previous winners', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue(
        members.map((m) => ({ winnerMemberId: m.id })),
      );

      const result = await service.getEligibility(committeeId, cycleId, adminId);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('already received');
    });

    it('should throw NotFoundException for missing cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.getEligibility(committeeId, 'missing', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getEligibility(committeeId, cycleId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEligibleMembers', () => {
    it('should return eligible members excluding previous winners', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([
        { winnerMemberId: 'mem-2' },
      ]);

      const result = await service.getEligibleMembers(
        committeeId,
        cycleId,
        adminId,
      );

      expect(result.total).toBe(2);
      expect(result.data.map((m) => m.id).sort()).toEqual(['mem-1', 'mem-3']);
    });

    it('should keep a previous winner eligible when their payout FAILED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      // mem-2 won before but the payout FAILED; mem-1 won with a completed payout.
      mockPrisma.lotteryResult.findMany.mockResolvedValue([
        {
          winnerMemberId: 'mem-1',
          cycle: { payout: { status: 'COMPLETED' } },
        },
        {
          winnerMemberId: 'mem-2',
          cycle: { payout: { status: 'FAILED' } },
        },
      ]);

      const result = await service.getEligibleMembers(
        committeeId,
        cycleId,
        adminId,
      );

      expect(result.total).toBe(2);
      expect(result.data.map((m) => m.id).sort()).toEqual(['mem-2', 'mem-3']);
    });

    it('should treat a winner without a payout record as excluded', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([
        {
          winnerMemberId: 'mem-1',
          cycle: { payout: null },
        },
      ]);

      const result = await service.getEligibleMembers(
        committeeId,
        cycleId,
        adminId,
      );

      expect(result.total).toBe(2);
      expect(result.data.map((m) => m.id).sort()).toEqual(['mem-2', 'mem-3']);
    });

    it('should return empty list when no paid contributions', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      const result = await service.getEligibleMembers(
        committeeId,
        cycleId,
        adminId,
      );

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('run', () => {
    const setupHappyPath = () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
        if (typeof fnOrOps === 'function') {
          return fnOrOps(mockPrisma);
        }
        return mockPrisma;
      });
      mockPrisma.lotteryResult.create.mockResolvedValue(mockResult);
      mockPrisma.cycle.update.mockResolvedValue(mockCompletedCycle);
    };

    it('should run the lottery and persist exactly one winner', async () => {
      setupHappyPath();
      // Call 1: existence check (null). Call 2: final fetch (result).
      mockPrisma.lotteryResult.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockResult);

      const result = await service.run(committeeId, cycleId, adminId);

      expect(result.winnerMemberId).toBeDefined();
      expect(result.eligibleMemberCount).toBe(3);
      expect(mockPrisma.lotteryResult.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.lotteryResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cycleId,
            eligibleMemberCount: 3,
            executedBy: adminId,
          }),
        }),
      );
    });

    it('should complete the cycle within the transaction', async () => {
      setupHappyPath();
      mockPrisma.lotteryResult.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockResult);

      await service.run(committeeId, cycleId, adminId);

      expect(mockPrisma.cycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: cycleId },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('should use a serializable transaction isolation level', async () => {
      setupHappyPath();
      mockPrisma.lotteryResult.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockResult);

      await service.run(committeeId, cycleId, adminId);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: 'Serializable',
        }),
      );
    });

    it('should select a winner only from eligible members', async () => {
      setupHappyPath();
      // Only mem-1 and mem-3 paid; mem-2 has no paid contribution.
      mockPrisma.contribution.findMany.mockResolvedValue([
        paidContributions[0],
        paidContributions[2],
      ]);
      mockPrisma.lotteryResult.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockResult);

      await service.run(committeeId, cycleId, adminId);

      const createdData = mockPrisma.lotteryResult.create.mock.calls[0][0].data;
      expect(['mem-1', 'mem-3']).toContain(createdData.winnerMemberId);
      expect(createdData.winnerMemberId).not.toBe('mem-2');
    });

    it('should exclude previous winners from the draw', async () => {
      setupHappyPath();
      mockPrisma.lotteryResult.findMany.mockResolvedValue([
        { winnerMemberId: 'mem-1' },
        { winnerMemberId: 'mem-3' },
      ]);
      mockPrisma.lotteryResult.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockResult);

      await service.run(committeeId, cycleId, adminId);

      const createdData = mockPrisma.lotteryResult.create.mock.calls[0][0].data;
      expect(createdData.winnerMemberId).toBe('mem-2');
      expect(createdData.eligibleMemberCount).toBe(1);
    });

    it('should throw ConflictException when lottery already executed', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockResult);

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when cycle is not ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCompletedCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no paid contributions', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when all paid members already won', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue(
        members.map((m) => ({ winnerMemberId: m.id })),
      );

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when caller is not the committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should translate unique constraint violation to ConflictException', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue(paidContributions);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`cycleId`)',
        { code: 'P2002', clientVersion: '6.19.3' },
      );
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await expect(
        service.run(committeeId, cycleId, adminId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getResult', () => {
    it('should return the lottery result for a cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(mockResult);

      const result = await service.getResult(committeeId, cycleId, adminId);

      expect(result.id).toBe('lot-1');
      expect(result.winner.id).toBe('mem-1');
    });

    it('should throw NotFoundException when no result exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockActiveCycle);
      mockPrisma.lotteryResult.findUnique.mockResolvedValue(null);

      await expect(
        service.getResult(committeeId, cycleId, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('should return all lottery results for a committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([mockResult]);

      const result = await service.getHistory(committeeId, adminId);

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('lot-1');
    });

    it('should return empty history when no lotteries ran', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);

      const result = await service.getHistory(committeeId, adminId);

      expect(result.total).toBe(0);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getHistory(committeeId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
