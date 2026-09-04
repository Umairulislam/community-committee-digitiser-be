import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Maximum committees included in the AI context when none is specified. */
const MAX_COMMITTEES = 5;

interface ContributionContext {
  cycleNumber: number;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
}

interface PayoutContext {
  cycleNumber: number;
  amount: number;
  status: string;
  paidAt: string | null;
}

export interface CommitteeContext {
  name: string;
  status: string;
  contributionAmount: number;
  memberLimit: number;
  totalCycles: number;
  dueDay: number;
  activeMemberCount: number;
  completedCycles: number;
  currentCycleNumber: number | null;
  yourRole: string | null;
  yourMemberStatus: string | null;
  yourContributions: ContributionContext[];
  yourLotteryWins: { cycleNumber: number; executedAt: string }[];
  yourPayouts: PayoutContext[];
  lastLotteryResult: {
    cycleNumber: number;
    winnerName: string;
    executedAt: string;
  } | null;
}

export interface AiContext {
  committees: CommitteeContext[];
  truncated: boolean;
}

function toNumber(value: unknown): number {
  if (
    value != null &&
    typeof (value as Record<string, unknown>).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Read-only retrieval of committee data the authenticated user is
 * authorised to see. This is the ONLY source of data sent to the AI
 * provider — the AI itself never accesses the database. No methods
 * on this service write, update, or delete anything.
 */
@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the committee context for a user. When committeeId is
   * provided, access is verified for that committee; otherwise all
   * committees the user created or belongs to (excluding REMOVED
   * memberships) are included, capped at MAX_COMMITTEES most recent.
   */
  async buildContext(userId: string, committeeId?: string): Promise<AiContext> {
    const { committees, memberships, truncated } =
      await this.resolveAccessibleCommittees(userId, committeeId);

    if (committees.length === 0) {
      return { committees: [], truncated: false };
    }

    const committeeIds = committees.map((c) => c.id);

    const [contributions, payouts, lotteryWins] = await Promise.all([
      this.prisma.contribution.findMany({
        where: {
          member: { userId, committeeId: { in: committeeIds } },
        },
        include: {
          cycle: { select: { committeeId: true, cycleNumber: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.payout.findMany({
        where: {
          member: { userId, committeeId: { in: committeeIds } },
        },
        include: {
          cycle: { select: { committeeId: true, cycleNumber: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.lotteryResult.findMany({
        where: {
          winner: { userId, committeeId: { in: committeeIds } },
        },
        include: {
          cycle: { select: { committeeId: true, cycleNumber: true } },
        },
        orderBy: { executedAt: 'asc' },
      }),
    ]);

    const contexts = await Promise.all(
      committees.map((committee) =>
        this.buildCommitteeContext(
          committee,
          memberships.get(committee.id) ?? null,
          contributions,
          payouts,
          lotteryWins,
        ),
      ),
    );

    return { committees: contexts, truncated };
  }

  private async buildCommitteeContext(
    committee: {
      id: string;
      name: string;
      status: string;
      contributionAmount: unknown;
      memberLimit: number;
      totalCycles: number;
      dueDay: number;
    },
    membership: { role: string; status: string } | null,
    contributions: {
      memberId: string;
      amount: unknown;
      status: string;
      dueDate: Date;
      paidAt: Date | null;
      cycle: { committeeId: string; cycleNumber: number };
    }[],
    payouts: {
      amount: unknown;
      status: string;
      paidAt: Date | null;
      cycle: { committeeId: string; cycleNumber: number };
    }[],
    lotteryWins: {
      executedAt: Date;
      cycle: { committeeId: string; cycleNumber: number };
    }[],
  ): Promise<CommitteeContext> {
    const [cycles, activeMemberCount, lastLottery] = await Promise.all([
      this.prisma.cycle.findMany({
        where: { committeeId: committee.id },
        select: { cycleNumber: true, status: true },
        orderBy: { cycleNumber: 'asc' },
      }),
      this.prisma.committeeMember.count({
        where: { committeeId: committee.id, status: 'ACTIVE' },
      }),
      this.prisma.lotteryResult.findFirst({
        where: { cycle: { committeeId: committee.id } },
        orderBy: { executedAt: 'desc' },
        include: {
          cycle: { select: { cycleNumber: true } },
          winner: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);

    const completedCycles = cycles.filter(
      (c) => c.status === 'COMPLETED',
    ).length;
    const activeCycle = cycles.find((c) => c.status === 'ACTIVE');

    return {
      name: committee.name,
      status: committee.status,
      contributionAmount: toNumber(committee.contributionAmount),
      memberLimit: committee.memberLimit,
      totalCycles: committee.totalCycles,
      dueDay: committee.dueDay,
      activeMemberCount,
      completedCycles,
      currentCycleNumber: activeCycle?.cycleNumber ?? null,
      yourRole: membership?.role ?? null,
      yourMemberStatus: membership?.status ?? null,
      yourContributions: contributions
        .filter((c) => c.cycle.committeeId === committee.id)
        .map((c) => ({
          cycleNumber: c.cycle.cycleNumber,
          amount: toNumber(c.amount),
          status: c.status,
          dueDate: c.dueDate.toISOString(),
          paidAt: c.paidAt?.toISOString() ?? null,
        })),
      yourLotteryWins: lotteryWins
        .filter((w) => w.cycle.committeeId === committee.id)
        .map((w) => ({
          cycleNumber: w.cycle.cycleNumber,
          executedAt: w.executedAt.toISOString(),
        })),
      yourPayouts: payouts
        .filter((p) => p.cycle.committeeId === committee.id)
        .map((p) => ({
          cycleNumber: p.cycle.cycleNumber,
          amount: toNumber(p.amount),
          status: p.status,
          paidAt: p.paidAt?.toISOString() ?? null,
        })),
      lastLotteryResult: lastLottery
        ? {
            cycleNumber: lastLottery.cycle.cycleNumber,
            winnerName: lastLottery.winner.user.name,
            executedAt: lastLottery.executedAt.toISOString(),
          }
        : null,
    };
  }

  private async resolveAccessibleCommittees(
    userId: string,
    committeeId?: string,
  ): Promise<{
    committees: {
      id: string;
      name: string;
      status: string;
      contributionAmount: unknown;
      memberLimit: number;
      totalCycles: number;
      dueDay: number;
      createdAt: Date;
    }[];
    memberships: Map<string, { role: string; status: string }>;
    truncated: boolean;
  }> {
    if (committeeId) {
      const committee = await this.prisma.committee.findUnique({
        where: { id: committeeId },
      });

      if (!committee) {
        throw new NotFoundException('Committee not found');
      }

      const membership =
        committee.createdBy === userId
          ? await this.prisma.committeeMember.findUnique({
              where: { userId_committeeId: { userId, committeeId } },
            })
          : await this.verifyMembershipOrThrow(committeeId, userId);

      const memberships = new Map<string, { role: string; status: string }>();
      if (membership) {
        memberships.set(committeeId, {
          role: membership.role,
          status: membership.status,
        });
      }

      return { committees: [committee], memberships, truncated: false };
    }

    const [memberships, createdCommittees] = await Promise.all([
      this.prisma.committeeMember.findMany({
        where: { userId, status: { not: 'REMOVED' } },
        include: { committee: true },
        orderBy: { committee: { createdAt: 'desc' } },
      }),
      this.prisma.committee.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        status: string;
        contributionAmount: unknown;
        memberLimit: number;
        totalCycles: number;
        dueDay: number;
        createdAt: Date;
      }
    >();

    const membershipByCommittee = new Map<
      string,
      { role: string; status: string }
    >();

    for (const membership of memberships) {
      byId.set(membership.committeeId, membership.committee);
      membershipByCommittee.set(membership.committeeId, {
        role: membership.role,
        status: membership.status,
      });
    }

    for (const committee of createdCommittees) {
      if (!byId.has(committee.id)) {
        byId.set(committee.id, committee);
      }
    }

    const sorted = [...byId.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const truncated = sorted.length > MAX_COMMITTEES;
    const committees = sorted.slice(0, MAX_COMMITTEES);

    return { committees, memberships: membershipByCommittee, truncated };
  }

  private async verifyMembershipOrThrow(
    committeeId: string,
    userId: string,
  ): Promise<{ role: string; status: string } | null> {
    const membership = await this.prisma.committeeMember.findUnique({
      where: { userId_committeeId: { userId, committeeId } },
    });

    if (!membership || membership.status === 'REMOVED') {
      throw new ForbiddenException(
        'You do not have access to this committee',
      );
    }

    return membership;
  }
}
