import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContributionStatus, Prisma } from '@prisma/client';
import { QueryReportDto } from './dto/query-report.dto';

function toNumber(value: unknown): number {
  if (
    value != null &&
    typeof (value as Record<string, unknown>).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Committee summary: basic info, member counts, cycle counts, overall status.
   */
  async getCommitteeSummary(
    committeeId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    await this.requireCommitteeAccess(committeeId, userId);

    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
      include: {
        creator: { select: { name: true, email: true } },
      },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    const [memberCount, activeMemberCount, cycleCount, completedCycleCount] =
      await Promise.all([
        this.prisma.committeeMember.count({ where: { committeeId } }),
        this.prisma.committeeMember.count({
          where: { committeeId, status: 'ACTIVE' },
        }),
        this.prisma.cycle.count({ where: { committeeId } }),
        this.prisma.cycle.count({
          where: { committeeId, status: 'COMPLETED' },
        }),
      ]);

    return {
      committeeId: committee.id,
      name: committee.name,
      description: committee.description,
      status: committee.status,
      contributionAmount: toNumber(committee.contributionAmount),
      memberLimit: committee.memberLimit,
      totalCycles: committee.totalCycles,
      dueDay: committee.dueDay,
      startDate: committee.startDate,
      createdBy: committee.creator.name,
      createdAt: committee.createdAt,
      memberCount,
      activeMemberCount,
      cycleCount,
      completedCycleCount,
    };
  }

  /**
   * Contribution/payment summary: expected vs collected, pending/overdue counts per cycle.
   */
  async getContributionSummary(
    committeeId: string,
    query: QueryReportDto,
    userId: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const cycleWhere: Record<string, unknown> = { committeeId };
    if (query.cycleId) {
      cycleWhere.id = query.cycleId;
    }

    const cycles = await this.prisma.cycle.findMany({
      where: cycleWhere,
      orderBy: { cycleNumber: 'asc' },
      select: {
        id: true,
        cycleNumber: true,
        status: true,
        totalExpected: true,
        totalCollected: true,
        contributions: {
          select: { status: true, amount: true },
        },
      },
    });

    const data = cycles.map((cycle) => {
      const contributions = cycle.contributions;
      const paidCount = contributions.filter((c) => c.status === 'PAID').length;
      const pendingCount = contributions.filter(
        (c) => c.status === 'PENDING',
      ).length;
      const overdueCount = contributions.filter(
        (c) => c.status === 'OVERDUE',
      ).length;

      const totalExpectedAmount = contributions.reduce(
        (sum, c) => sum + toNumber(c.amount),
        0,
      );
      const totalPaidAmount = contributions
        .filter((c) => c.status === 'PAID')
        .reduce((sum, c) => sum + toNumber(c.amount), 0);

      return {
        cycleId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        cycleStatus: cycle.status,
        totalExpected: totalExpectedAmount,
        totalCollected: toNumber(cycle.totalCollected),
        totalPaid: totalPaidAmount,
        contributionCount: contributions.length,
        paidCount,
        pendingCount,
        overdueCount,
      };
    });

    return { data };
  }

  /**
   * Outstanding payments: members with PENDING or OVERDUE contributions.
   */
  async getOutstandingPayments(
    committeeId: string,
    query: QueryReportDto,
    userId: string,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const cycleWhere: Record<string, unknown> = { committeeId };
    if (query.cycleId) {
      cycleWhere.id = query.cycleId;
    }

    const statusFilter: ContributionStatus[] = [
      ContributionStatus.PENDING,
      ContributionStatus.OVERDUE,
    ];

    let statusIn: ContributionStatus[] = statusFilter;
    if (
      query.status &&
      statusFilter.includes(query.status as ContributionStatus)
    ) {
      statusIn = [query.status as ContributionStatus];
    }

    const where: Prisma.ContributionWhereInput = {
      cycle: cycleWhere,
      status: { in: statusIn },
    };

    const [contributions, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              status: true,
              user: { select: { name: true, email: true } },
            },
          },
          cycle: { select: { cycleNumber: true, status: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.contribution.count({ where }),
    ]);

    const data = contributions.map((c) => ({
      contributionId: c.id,
      memberId: c.memberId,
      memberName: c.member.user.name,
      memberEmail: c.member.user.email,
      memberStatus: c.member.status,
      cycleNumber: c.cycle.cycleNumber,
      cycleStatus: c.cycle.status,
      amount: toNumber(c.amount),
      status: c.status,
      dueDate: c.dueDate,
      daysOverdue:
        c.status === 'OVERDUE'
          ? Math.floor(
              (Date.now() - new Date(c.dueDate).getTime()) / 86400000,
            )
          : 0,
    }));

    return { data, total, page, limit };
  }

  /**
   * Cycle completion summary: status, dates, collected amounts for all cycles.
   */
  async getCycleCompletionSummary(
    committeeId: string,
    query: QueryReportDto,
    userId: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const where: Record<string, unknown> = { committeeId };
    if (query.cycleId) {
      where.id = query.cycleId;
    }

    const cycles = await this.prisma.cycle.findMany({
      where,
      orderBy: { cycleNumber: 'asc' },
      select: {
        id: true,
        cycleNumber: true,
        status: true,
        startDate: true,
        endDate: true,
        totalExpected: true,
        totalCollected: true,
        contributions: {
          select: { status: true },
        },
      },
    });

    const data = cycles.map((cycle) => {
      const paidCount = cycle.contributions.filter(
        (c) => c.status === 'PAID',
      ).length;
      const totalCount = cycle.contributions.length;
      const collectionRate =
        totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

      return {
        cycleId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        status: cycle.status,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        totalExpected: toNumber(cycle.totalExpected),
        totalCollected: toNumber(cycle.totalCollected),
        totalContributions: totalCount,
        paidContributions: paidCount,
        collectionRatePercent: collectionRate,
      };
    });

    return { data };
  }

  /**
   * Lottery and payout summary: lottery results and payout status per cycle.
   */
  async getLotteryPayoutSummary(
    committeeId: string,
    query: QueryReportDto,
    userId: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const where: Record<string, unknown> = { committeeId };
    if (query.cycleId) {
      where.id = query.cycleId;
    }

    const cycles = await this.prisma.cycle.findMany({
      where,
      orderBy: { cycleNumber: 'asc' },
      select: {
        id: true,
        cycleNumber: true,
        status: true,
        totalCollected: true,
        lotteryResult: {
          select: {
            id: true,
            winnerMemberId: true,
            eligibleMemberCount: true,
            executedAt: true,
            winner: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        payout: {
          select: {
            id: true,
            amount: true,
            status: true,
            paidAt: true,
            reference: true,
          },
        },
      },
    });

    const data = cycles.map((cycle) => {
      const lottery = cycle.lotteryResult;
      const payout = cycle.payout;

      return {
        cycleId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        cycleStatus: cycle.status,
        totalCollected: toNumber(cycle.totalCollected),
        lotteryExecuted: !!lottery,
        lotteryExecutedAt: lottery?.executedAt ?? null,
        eligibleMemberCount: lottery?.eligibleMemberCount ?? 0,
        winnerName: lottery?.winner.user.name ?? null,
        winnerEmail: lottery?.winner.user.email ?? null,
        payoutCreated: !!payout,
        payoutAmount: payout ? toNumber(payout.amount) : 0,
        payoutStatus: payout?.status ?? null,
        payoutPaidAt: payout?.paidAt ?? null,
        payoutReference: payout?.reference ?? null,
      };
    });

    return { data };
  }

  /**
   * Member participation summary: each member's contribution/payment history.
   */
  async getMemberParticipationSummary(
    committeeId: string,
    query: QueryReportDto,
    userId: string,
  ): Promise<{ data: Record<string, unknown>[] }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId },
      include: {
        user: { select: { name: true, email: true } },
        contributions: {
          where: query.cycleId ? { cycleId: query.cycleId } : undefined,
          include: {
            cycle: { select: { cycleNumber: true } },
            payments: {
              select: { status: true, amount: true },
            },
          },
        },
        lotteryWins: {
          select: { id: true, cycleId: true },
        },
        payouts: {
          select: { id: true, amount: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = members.map((member) => {
      const contributions = member.contributions;
      const totalContributions = contributions.length;
      const paidContributions = contributions.filter(
        (c) => c.status === 'PAID',
      ).length;
      const pendingContributions = contributions.filter(
        (c) => c.status === 'PENDING',
      ).length;
      const overdueContributions = contributions.filter(
        (c) => c.status === 'OVERDUE',
      ).length;

      const totalAmountContributed = contributions
        .filter((c) => c.status === 'PAID')
        .reduce((sum, c) => sum + toNumber(c.amount), 0);

      const verifiedPayments = contributions
        .flatMap((c) => c.payments)
        .filter((p) => p.status === 'VERIFIED');
      const totalAmountPaid = verifiedPayments.reduce(
        (sum, p) => sum + toNumber(p.amount),
        0,
      );

      const lotteryWins = member.lotteryWins.length;
      const totalPayoutReceived = member.payouts
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + toNumber(p.amount), 0);

      return {
        memberId: member.id,
        memberName: member.user.name,
        memberEmail: member.user.email,
        memberStatus: member.status,
        memberRole: member.role,
        joinedAt: member.joinedAt,
        totalCycles: totalContributions,
        paidCycles: paidContributions,
        pendingCycles: pendingContributions,
        overdueCycles: overdueContributions,
        totalAmountContributed,
        totalAmountPaid,
        lotteryWins,
        totalPayoutReceived,
      };
    });

    return { data };
  }

  private async requireCommitteeAccess(
    committeeId: string,
    userId: string,
  ): Promise<void> {
    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    if (committee.createdBy === userId) {
      return;
    }

    const membership = await this.prisma.committeeMember.findUnique({
      where: { userId_committeeId: { userId, committeeId } },
    });

    if (!membership || membership.status === 'REMOVED') {
      throw new ForbiddenException(
        'You do not have access to this committee',
      );
    }
  }
}
