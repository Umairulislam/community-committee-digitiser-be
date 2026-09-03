import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const adminId = 'admin-1';
  const committeeId = 'comm-1';
  const memberId = 'user-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    description: 'A test committee',
    contributionAmount: { toNumber: () => 10000 },
    memberLimit: 10,
    totalCycles: 5,
    dueDay: 5,
    startDate: new Date('2026-09-01'),
    status: 'ACTIVE',
    createdBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { name: 'Admin', email: 'admin@test.com' },
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    committeeMember: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    cycle: { findMany: jest.fn(), count: jest.fn() },
    contribution: { findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.resetAllMocks();
  });

  describe('getCommitteeSummary', () => {
    it('should return committee summary for the admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      mockPrisma.cycle.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const result = await service.getCommitteeSummary(committeeId, adminId);

      expect(result.name).toBe('Test Committee');
      expect(result.memberCount).toBe(5);
      expect(result.activeMemberCount).toBe(4);
      expect(result.cycleCount).toBe(3);
      expect(result.completedCycleCount).toBe(1);
      expect(result.contributionAmount).toBe(10000);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.getCommitteeSummary('nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getCommitteeSummary(committeeId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow committee member access', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: memberId,
        status: 'ACTIVE',
      });
      mockPrisma.committeeMember.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      mockPrisma.cycle.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const result = await service.getCommitteeSummary(committeeId, memberId);

      expect(result.name).toBe('Test Committee');
    });
  });

  describe('getContributionSummary', () => {
    it('should return contribution summary per cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([
        {
          id: 'cycle-1',
          cycleNumber: 1,
          status: 'ACTIVE',
          totalExpected: { toNumber: () => 50000 },
          totalCollected: { toNumber: () => 30000 },
          contributions: [
            { status: 'PAID', amount: { toNumber: () => 10000 } },
            { status: 'PAID', amount: { toNumber: () => 10000 } },
            { status: 'PAID', amount: { toNumber: () => 10000 } },
            { status: 'PENDING', amount: { toNumber: () => 10000 } },
            { status: 'OVERDUE', amount: { toNumber: () => 10000 } },
          ],
        },
      ]);

      const result = await service.getContributionSummary(
        committeeId,
        {},
        adminId,
      );

      expect(result.data).toHaveLength(1);
      const cycle = result.data[0];
      expect(cycle.cycleNumber).toBe(1);
      expect(cycle.paidCount).toBe(3);
      expect(cycle.pendingCount).toBe(1);
      expect(cycle.overdueCount).toBe(1);
      expect(cycle.totalPaid).toBe(30000);
    });

    it('should filter by cycleId', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([]);

      await service.getContributionSummary(
        committeeId,
        { cycleId: 'cycle-1' },
        adminId,
      );

      expect(mockPrisma.cycle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'cycle-1' }),
        }),
      );
    });
  });

  describe('getOutstandingPayments', () => {
    it('should return outstanding contributions with pagination', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      const mockContribution = {
        id: 'contrib-1',
        memberId: 'mem-1',
        amount: { toNumber: () => 10000 },
        status: 'OVERDUE',
        dueDate: new Date(Date.now() - 86400000 * 5),
        member: {
          id: 'mem-1',
          status: 'ACTIVE',
          user: { name: 'User 1', email: 'user1@test.com' },
        },
        cycle: { cycleNumber: 1, status: 'ACTIVE' },
      };
      mockPrisma.contribution.findMany.mockResolvedValue([mockContribution]);
      mockPrisma.contribution.count.mockResolvedValue(1);

      const result = await service.getOutstandingPayments(
        committeeId,
        {},
        adminId,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].memberName).toBe('User 1');
      expect(result.data[0].status).toBe('OVERDUE');
      expect(result.data[0].daysOverdue).toBeGreaterThan(0);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.contribution.findMany.mockResolvedValue([]);
      mockPrisma.contribution.count.mockResolvedValue(0);

      await service.getOutstandingPayments(
        committeeId,
        { status: 'PENDING' },
        adminId,
      );

      expect(mockPrisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING'] },
          }),
        }),
      );
    });
  });

  describe('getCycleCompletionSummary', () => {
    it('should return cycle completion data with collection rate', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([
        {
          id: 'cycle-1',
          cycleNumber: 1,
          status: 'COMPLETED',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-30'),
          totalExpected: { toNumber: () => 50000 },
          totalCollected: { toNumber: () => 50000 },
          contributions: [
            { status: 'PAID' },
            { status: 'PAID' },
            { status: 'PAID' },
            { status: 'PAID' },
            { status: 'PAID' },
          ],
        },
      ]);

      const result = await service.getCycleCompletionSummary(
        committeeId,
        {},
        adminId,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].collectionRatePercent).toBe(100);
      expect(result.data[0].totalCollected).toBe(50000);
    });
  });

  describe('getLotteryPayoutSummary', () => {
    it('should return lottery and payout data per cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([
        {
          id: 'cycle-1',
          cycleNumber: 1,
          status: 'COMPLETED',
          totalCollected: { toNumber: () => 50000 },
          lotteryResult: {
            id: 'lot-1',
            winnerMemberId: 'mem-1',
            eligibleMemberCount: 5,
            executedAt: new Date(),
            winner: { user: { name: 'Winner', email: 'winner@test.com' } },
          },
          payout: {
            id: 'pay-1',
            amount: { toNumber: () => 50000 },
            status: 'COMPLETED',
            paidAt: new Date(),
            reference: 'REF-001',
          },
        },
      ]);

      const result = await service.getLotteryPayoutSummary(
        committeeId,
        {},
        adminId,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].lotteryExecuted).toBe(true);
      expect(result.data[0].winnerName).toBe('Winner');
      expect(result.data[0].payoutStatus).toBe('COMPLETED');
      expect(result.data[0].payoutAmount).toBe(50000);
    });

    it('should handle cycles without lottery or payout', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([
        {
          id: 'cycle-1',
          cycleNumber: 1,
          status: 'ACTIVE',
          totalCollected: { toNumber: () => 0 },
          lotteryResult: null,
          payout: null,
        },
      ]);

      const result = await service.getLotteryPayoutSummary(
        committeeId,
        {},
        adminId,
      );

      expect(result.data[0].lotteryExecuted).toBe(false);
      expect(result.data[0].payoutCreated).toBe(false);
    });
  });

  describe('getMemberParticipationSummary', () => {
    it('should return member participation data', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          status: 'ACTIVE',
          role: 'MEMBER',
          joinedAt: new Date(),
          user: { name: 'User 1', email: 'user1@test.com' },
          contributions: [
            {
              status: 'PAID',
              amount: { toNumber: () => 10000 },
              cycle: { cycleNumber: 1 },
              payments: [{ status: 'VERIFIED', amount: { toNumber: () => 10000 } }],
            },
            {
              status: 'PENDING',
              amount: { toNumber: () => 10000 },
              cycle: { cycleNumber: 2 },
              payments: [],
            },
          ],
          lotteryWins: [{ id: 'lot-1', cycleId: 'cycle-1' }],
          payouts: [
            { id: 'pay-1', amount: { toNumber: () => 50000 }, status: 'COMPLETED' },
          ],
        },
      ]);

      const result = await service.getMemberParticipationSummary(
        committeeId,
        {},
        adminId,
      );

      expect(result.data).toHaveLength(1);
      const member = result.data[0];
      expect(member.memberName).toBe('User 1');
      expect(member.totalCycles).toBe(2);
      expect(member.paidCycles).toBe(1);
      expect(member.pendingCycles).toBe(1);
      expect(member.lotteryWins).toBe(1);
      expect(member.totalPayoutReceived).toBe(50000);
      expect(member.totalAmountPaid).toBe(10000);
    });

    it('should filter contributions by cycleId', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);

      await service.getMemberParticipationSummary(
        committeeId,
        { cycleId: 'cycle-1' },
        adminId,
      );

      expect(mockPrisma.committeeMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contributions: expect.objectContaining({
              where: { cycleId: 'cycle-1' },
            }),
          }),
        }),
      );
    });
  });
});
