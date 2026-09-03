import { randomInt } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LotteryResult,
  Cycle,
  CycleStatus,
  ContributionStatus,
  Committee,
  CommitteeMember,
  Prisma,
} from '@prisma/client';

type LotteryResultWithDetails = LotteryResult & {
  cycle: Pick<Cycle, 'id' | 'cycleNumber' | 'status'>;
  winner: {
    id: string;
    role: string;
    status: string;
    user: { id: string; name: string; email: string; phone: string | null };
  };
};

const RESULT_INCLUDE = {
  cycle: { select: { id: true, cycleNumber: true, status: true } },
  winner: {
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
};

@Injectable()
export class LotteriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check whether a cycle is eligible for lottery without running it.
   * Returns the eligibility verdict and the reason when not eligible.
   */
  async getEligibility(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<{
    eligible: boolean;
    reason: string | null;
    eligibleMemberCount: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);
    const cycle = await this.requireCycle(committeeId, cycleId);

    const existing = await this.prisma.lotteryResult.findUnique({
      where: { cycleId },
    });
    if (existing) {
      return {
        eligible: false,
        reason: 'Lottery has already been executed for this cycle',
        eligibleMemberCount: 0,
      };
    }

    if (cycle.status !== CycleStatus.ACTIVE) {
      return {
        eligible: false,
        reason: `Cycle must be ACTIVE to run the lottery (current: ${cycle.status})`,
        eligibleMemberCount: 0,
      };
    }

    const { eligibleMembers, reason } = await this.resolveEligibleMembers(
      committeeId,
      cycleId,
    );

    if (eligibleMembers.length === 0) {
      return {
        eligible: false,
        reason: reason ?? 'No eligible members for this cycle',
        eligibleMemberCount: 0,
      };
    }

    return {
      eligible: true,
      reason: null,
      eligibleMemberCount: eligibleMembers.length,
    };
  }

  /**
   * Determine eligible members for the cycle:
   * - Contribution for this cycle must be PAID
   * - Member must be ACTIVE
   * - Members with a previous completed payout are excluded (payout module
   *   not yet available; previous winners are excluded via lottery history)
   */
  async getEligibleMembers(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<{
    data: {
      id: string;
      role: string;
      status: string;
      user: { id: string; name: string; email: string; phone: string | null };
    }[];
    total: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const { eligibleMembers } = await this.resolveEligibleMembers(
      committeeId,
      cycleId,
    );

    return { data: eligibleMembers, total: eligibleMembers.length };
  }

  /**
   * Run the lottery for a cycle. The backend exclusively determines the
   * winner; the caller only identifies the admin executing the draw.
   * Execution is atomic: the result is persisted in a transaction together
   * with a cycle status update, and a unique constraint on cycleId prevents
   * duplicate or concurrent executions.
   */
  async run(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<LotteryResultWithDetails> {
    await this.requireOwnedCommittee(committeeId, userId);
    const cycle = await this.requireCycle(committeeId, cycleId);

    const existing = await this.prisma.lotteryResult.findUnique({
      where: { cycleId },
    });
    if (existing) {
      throw new ConflictException(
        'Lottery has already been executed for this cycle. A cycle cannot have multiple lottery results.',
      );
    }

    if (cycle.status !== CycleStatus.ACTIVE) {
      throw new BadRequestException(
        `Cycle must be ACTIVE to run the lottery (current: ${cycle.status})`,
      );
    }

    const { eligibleMembers, reason } = await this.resolveEligibleMembers(
      committeeId,
      cycleId,
    );

    if (eligibleMembers.length === 0) {
      throw new BadRequestException(
        reason ?? 'No eligible members for this cycle',
      );
    }

    const winner = this.selectRandomWinner(eligibleMembers);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.lotteryResult.create({
            data: {
              cycleId,
              winnerMemberId: winner.id,
              eligibleMemberCount: eligibleMembers.length,
              executedBy: userId,
            },
          });

          // The draw concludes the cycle; endDate reflects the draw time.
          await tx.cycle.update({
            where: { id: cycleId },
            data: { status: CycleStatus.COMPLETED, endDate: new Date() },
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.prisma.lotteryResult.findUnique({
        where: { id: result.id },
        include: RESULT_INCLUDE,
      }) as Promise<LotteryResultWithDetails>;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Lottery has already been executed for this cycle',
        );
      }
      throw error;
    }
  }

  /**
   * Get the lottery result for a specific cycle.
   */
  async getResult(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<LotteryResultWithDetails> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const result = await this.prisma.lotteryResult.findUnique({
      where: { cycleId },
      include: RESULT_INCLUDE,
    });

    if (!result) {
      throw new NotFoundException(
        'No lottery result exists for this cycle',
      );
    }

    return result as LotteryResultWithDetails;
  }

  /**
   * List the lottery history for a committee (one result per cycle).
   */
  async getHistory(
    committeeId: string,
    userId: string,
  ): Promise<{ data: LotteryResultWithDetails[]; total: number }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const data = (await this.prisma.lotteryResult.findMany({
      where: { cycle: { committeeId } },
      include: RESULT_INCLUDE,
      orderBy: { executedAt: 'desc' },
    })) as LotteryResultWithDetails[];

    return { data, total: data.length };
  }

  private async resolveEligibleMembers(
    committeeId: string,
    cycleId: string,
  ): Promise<{
    eligibleMembers: {
      id: string;
      role: string;
      status: string;
      user: { id: string; name: string; email: string; phone: string | null };
    }[];
    reason: string | null;
  }> {
    // Members with a PAID contribution for this cycle.
    const paidContributions = await this.prisma.contribution.findMany({
      where: {
        cycleId,
        status: ContributionStatus.PAID,
        member: { status: 'ACTIVE' },
      },
      include: {
        member: {
          select: {
            id: true,
            role: true,
            status: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (paidContributions.length === 0) {
      return {
        eligibleMembers: [],
        reason:
          'No paid contributions found for this cycle. All contributions must be paid before the lottery can run.',
      };
    }

    // Exclude previous lottery winners whose payout was received or is
    // still in flight. A winner whose payout FAILED never received the
    // pool, so that member remains eligible for future lotteries.
    const previousResults = await this.prisma.lotteryResult.findMany({
      where: { cycle: { committeeId } },
      select: {
        winnerMemberId: true,
        cycle: { select: { payout: { select: { status: true } } } },
      },
    });

    const previousWinnerIds = previousResults
      .filter((r) => r.cycle?.payout?.status !== 'FAILED')
      .map((r) => r.winnerMemberId);

    const eligibleMembers = paidContributions
      .map((c) => c.member)
      .filter((m) => !previousWinnerIds.includes(m.id));

    if (eligibleMembers.length === 0) {
      return {
        eligibleMembers: [],
        reason:
          'All paid members have already received a payout in previous cycles',
      };
    }

    return { eligibleMembers, reason: null };
  }

  private selectRandomWinner<
    T extends {
      id: string;
      role: string;
      status: string;
      user: { id: string; name: string; email: string; phone: string | null };
    },
  >(members: T[]): T {
    // Cryptographically strong unbiased selection (Fisher-Yates).
    for (let i = members.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [members[i], members[j]] = [members[j], members[i]];
    }
    return members[0];
  }

  private async requireOwnedCommittee(
    committeeId: string,
    userId: string,
  ): Promise<Committee> {
    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    if (committee.createdBy !== userId) {
      throw new ForbiddenException(
        'Only the committee admin can perform this action',
      );
    }

    return committee;
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

  private async requireCycle(
    committeeId: string,
    cycleId: string,
  ): Promise<Cycle> {
    const cycle = await this.prisma.cycle.findFirst({
      where: { id: cycleId, committeeId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    return cycle;
  }
}
