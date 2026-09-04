import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AiContextService', () => {
  let service: AiContextService;

  const userId = 'user-1';
  const committeeId = 'comm-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    status: 'ACTIVE',
    contributionAmount: { toNumber: () => 10000 },
    memberLimit: 10,
    totalCycles: 5,
    dueDay: 5,
    createdBy: 'other-admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date(),
  };

  const mockMembership = {
    id: 'mem-1',
    committeeId,
    userId,
    role: 'MEMBER',
    status: 'ACTIVE',
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn(), findMany: jest.fn() },
    committeeMember: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    cycle: { findMany: jest.fn() },
    contribution: { findMany: jest.fn() },
    payout: { findMany: jest.fn() },
    lotteryResult: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiContextService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AiContextService>(AiContextService);
    jest.resetAllMocks();
  });

  describe('buildContext with explicit committeeId', () => {
    it('should throw NotFoundException for a non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.buildContext(userId, committeeId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the user has no membership', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.buildContext(userId, committeeId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when the membership is REMOVED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        ...mockMembership,
        status: 'REMOVED',
      });

      await expect(
        service.buildContext(userId, committeeId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should build the full committee context for an active member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.contribution.findMany.mockResolvedValue([
        {
          memberId: 'mem-1',
          amount: { toNumber: () => 10000 },
          status: 'PAID',
          dueDate: new Date('2026-09-05'),
          paidAt: new Date('2026-09-03'),
          cycle: { committeeId, cycleNumber: 1 },
        },
        {
          memberId: 'mem-1',
          amount: { toNumber: () => 10000 },
          status: 'PENDING',
          dueDate: new Date('2026-10-05'),
          paidAt: null,
          cycle: { committeeId, cycleNumber: 2 },
        },
      ]);
      mockPrisma.payout.findMany.mockResolvedValue([
        {
          amount: { toNumber: () => 50000 },
          status: 'COMPLETED',
          paidAt: new Date('2026-09-10'),
          cycle: { committeeId, cycleNumber: 1 },
        },
      ]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([
        {
          executedAt: new Date('2026-09-08'),
          cycle: { committeeId, cycleNumber: 1 },
        },
      ]);
      mockPrisma.cycle.findMany.mockResolvedValue([
        { cycleNumber: 1, status: 'COMPLETED' },
        { cycleNumber: 2, status: 'ACTIVE' },
        { cycleNumber: 3, status: 'UPCOMING' },
      ]);
      mockPrisma.committeeMember.count.mockResolvedValue(8);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue({
        cycle: { cycleNumber: 1 },
        winner: { user: { name: 'Winner Name' } },
        executedAt: new Date('2026-09-08'),
      });

      const result = await service.buildContext(userId, committeeId);

      expect(result.committees).toHaveLength(1);
      expect(result.truncated).toBe(false);

      const context = result.committees[0];
      expect(context.name).toBe('Test Committee');
      expect(context.contributionAmount).toBe(10000);
      expect(context.activeMemberCount).toBe(8);
      expect(context.completedCycles).toBe(1);
      expect(context.currentCycleNumber).toBe(2);
      expect(context.yourRole).toBe('MEMBER');
      expect(context.yourMemberStatus).toBe('ACTIVE');
      expect(context.yourContributions).toHaveLength(2);
      expect(context.yourContributions[0].amount).toBe(10000);
      expect(context.yourContributions[0].status).toBe('PAID');
      expect(context.yourLotteryWins).toHaveLength(1);
      expect(context.yourPayouts).toHaveLength(1);
      expect(context.yourPayouts[0].amount).toBe(50000);
      expect(context.lastLotteryResult).toEqual({
        cycleNumber: 1,
        winnerName: 'Winner Name',
        executedAt: '2026-09-08T00:00:00.000Z',
      });
    });

    it('should include the committee for the creator even without membership', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: userId,
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(0);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue(null);

      const result = await service.buildContext(userId, committeeId);

      expect(result.committees).toHaveLength(1);
      expect(result.committees[0].yourRole).toBeNull();
      expect(result.committees[0].yourMemberStatus).toBeNull();
      expect(result.committees[0].yourContributions).toHaveLength(0);
    });
  });

  describe('buildContext without committeeId (auto-discovery)', () => {
    it('should return an empty context when the user has no committees', async () => {
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);
      mockPrisma.committee.findMany.mockResolvedValue([]);

      const result = await service.buildContext(userId);

      expect(result.committees).toHaveLength(0);
      expect(result.truncated).toBe(false);
    });

    it('should merge memberships and created committees', async () => {
      mockPrisma.committeeMember.findMany.mockResolvedValue([
        {
          ...mockMembership,
          committeeId: 'comm-1',
          committee: { ...mockCommittee, id: 'comm-1', createdAt: new Date('2026-02-01') },
        },
      ]);
      mockPrisma.committee.findMany.mockResolvedValue([
        { ...mockCommittee, id: 'comm-2', createdAt: new Date('2026-03-01') },
      ]);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(0);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue(null);

      const result = await service.buildContext(userId);

      expect(result.committees).toHaveLength(2);
      // Most recent committee first
      expect(result.committees[0].name).toBe('Test Committee');
      expect(result.truncated).toBe(false);
    });

    it('should exclude REMOVED memberships from discovery', async () => {
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);
      mockPrisma.committee.findMany.mockResolvedValue([]);

      const result = await service.buildContext(userId);

      // The where clause excludes REMOVED — verified via the query itself
      expect(
        mockPrisma.committeeMember.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: { not: 'REMOVED' },
          }),
        }),
      );
      expect(result.committees).toHaveLength(0);
    });

    it('should cap committees at 5 most recent and set truncated flag', async () => {
      const memberships = [1, 2, 3].map((i) => ({
        ...mockMembership,
        committeeId: `comm-${i}`,
        committee: {
          ...mockCommittee,
          id: `comm-${i}`,
          createdAt: new Date(`2026-0${i}-01`),
        },
      }));
      mockPrisma.committeeMember.findMany.mockResolvedValue(memberships);
      mockPrisma.committee.findMany.mockResolvedValue(
        [4, 5, 6].map((i) => ({
          ...mockCommittee,
          id: `comm-${i}`,
          createdAt: new Date(`2026-0${i}-01`),
        })),
      );
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(0);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue(null);

      const result = await service.buildContext(userId);

      expect(result.committees).toHaveLength(5);
      expect(result.truncated).toBe(true);
    });
  });

  describe('data minimisation', () => {
    it('should not include winner email or phone in the last lottery result', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(1);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue({
        cycle: { cycleNumber: 1 },
        winner: { user: { name: 'Winner Name' } },
        executedAt: new Date('2026-09-08'),
      });

      const result = await service.buildContext(userId, committeeId);

      const serialized = JSON.stringify(result.committees[0]);
      expect(serialized).toContain('Winner Name');
      expect(serialized).not.toContain('@');
    });

    it('should query only the requested committee when committeeId is given', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.lotteryResult.findMany.mockResolvedValue([]);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(1);
      mockPrisma.lotteryResult.findFirst.mockResolvedValue(null);

      await service.buildContext(userId, committeeId);

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            member: { userId, committeeId: { in: [committeeId] } },
          }),
        }),
      );
    });
  });
});
