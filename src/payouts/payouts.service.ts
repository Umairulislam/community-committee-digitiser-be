import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Payout, PayoutStatus, Cycle, Committee, Prisma, NotificationType } from '@prisma/client';
import { UpdatePayoutStatusDto } from './dto/update-payout-status.dto';
import { QueryPayoutDto } from './dto/query-payout.dto';

type PayoutWithDetails = Payout & {
  cycle: Pick<Cycle, 'id' | 'cycleNumber' | 'status'>;
  member: {
    id: string;
    role: string;
    status: string;
    user: { id: string; name: string; email: string; phone: string | null };
  };
};

const PAYOUT_INCLUDE = {
  cycle: { select: { id: true, cycleNumber: true, status: true } },
  member: {
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
};

// Payout status state machine: PENDING → PROCESSING → COMPLETED | FAILED.
// FAILED payouts may be retried (FAILED → PROCESSING). COMPLETED is final.
const VALID_PAYOUT_TRANSITIONS: Record<string, PayoutStatus[]> = {
  PENDING: [PayoutStatus.PROCESSING],
  PROCESSING: [PayoutStatus.COMPLETED, PayoutStatus.FAILED],
  COMPLETED: [],
  FAILED: [PayoutStatus.PROCESSING],
};

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
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create the payout for a cycle after a valid lottery winner exists.
   * The payout amount is exclusively determined by backend business rules:
   * the total collected pool of the completed cycle. The winner is taken
   * from the persisted lottery result — never from the client.
   */
  async create(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<PayoutWithDetails> {
    await this.requireOwnedCommittee(committeeId, userId);
    const cycle = await this.requireCycle(committeeId, cycleId);

    const existing = await this.prisma.payout.findUnique({
      where: { cycleId },
    });
    if (existing) {
      throw new ConflictException(
        'A payout already exists for this cycle. Only one payout per cycle is allowed.',
      );
    }

    const lotteryResult = await this.prisma.lotteryResult.findUnique({
      where: { cycleId },
    });
    if (!lotteryResult) {
      throw new BadRequestException(
        'No lottery result exists for this cycle. A payout can only be created for a valid lottery winner.',
      );
    }

    // Amount: the pool actually collected for the cycle (backend rule).
    const amount = toNumber(cycle.totalCollected);
    if (amount <= 0) {
      throw new BadRequestException(
        'Cycle has no collected funds to pay out',
      );
    }

    try {
      const created = (await this.prisma.payout.create({
        data: {
          cycleId,
          memberId: lotteryResult.winnerMemberId,
          amount,
          status: PayoutStatus.PENDING,
        },
        include: PAYOUT_INCLUDE,
      })) as PayoutWithDetails;

      await this.auditService.log({
        actorId: userId,
        action: 'PAYOUT_CREATED',
        entityType: 'Payout',
        entityId: created.id,
        committeeId,
        cycleId,
        metadata: { amount, memberId: lotteryResult.winnerMemberId },
      });

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A payout already exists for this cycle',
        );
      }
      throw error;
    }
  }

  /**
   * Get the payout for a specific cycle.
   */
  async findByCycle(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<PayoutWithDetails> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const payout = await this.prisma.payout.findUnique({
      where: { cycleId },
      include: PAYOUT_INCLUDE,
    });

    if (!payout) {
      throw new NotFoundException('No payout exists for this cycle');
    }

    return payout as PayoutWithDetails;
  }

  /**
   * List payouts for a committee (paginated, optional status filter).
   */
  async findAll(
    committeeId: string,
    query: QueryPayoutDto,
    userId: string,
  ): Promise<{
    data: PayoutWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { cycle: { committeeId } };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        include: PAYOUT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return {
      data: data as PayoutWithDetails[],
      total,
      page,
      limit,
    };
  }

  /**
   * Update the status of a payout through valid transitions.
   * COMPLETED payouts are immutable historical records.
   */
  async updateStatus(
    committeeId: string,
    id: string,
    dto: UpdatePayoutStatusDto,
    userId: string,
  ): Promise<PayoutWithDetails> {
    await this.requireOwnedCommittee(committeeId, userId);

    const payout = await this.prisma.payout.findFirst({
      where: { id },
      include: { cycle: { select: { committeeId: true } } },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.cycle.committeeId !== committeeId) {
      throw new ForbiddenException(
        'Payout does not belong to this committee',
      );
    }

    const allowed = VALID_PAYOUT_TRANSITIONS[payout.status] ?? [];
    if (!allowed.includes(dto.status as PayoutStatus)) {
      throw new BadRequestException(
        `Cannot transition payout from ${payout.status} to ${dto.status}`,
      );
    }

    const data: Record<string, unknown> = { status: dto.status };

    if (dto.status === PayoutStatus.COMPLETED) {
      data.paidAt = new Date();
      if (dto.reference) {
        data.reference = dto.reference;
      }
    } else if (dto.reference) {
      data.reference = dto.reference;
    }

    const updated = await this.prisma.payout.update({
      where: { id: payout.id },
      data,
      include: PAYOUT_INCLUDE,
    });

    await this.auditService.log({
      actorId: userId,
      action: 'PAYOUT_STATUS_CHANGED',
      entityType: 'Payout',
      entityId: payout.id,
      committeeId,
      cycleId: payout.cycleId,
      metadata: { previousStatus: payout.status, newStatus: dto.status },
    });

    // Send notification to the winner when payout is completed
    if (dto.status === PayoutStatus.COMPLETED) {
      const payoutWithMember = await this.prisma.payout.findUnique({
        where: { id: payout.id },
        include: { member: { select: { userId: true } } },
      });
      if (payoutWithMember) {
        await this.notificationsService.create({
          userId: payoutWithMember.member.userId,
          type: NotificationType.PAYOUT_COMPLETED,
          title: 'Payout Completed',
          message: `Your payout for cycle has been completed. Amount: ${toNumber(payoutWithMember.amount)}`,
          committeeId,
        });
      }
    }

    return updated as PayoutWithDetails;
  }

  /**
   * View the authenticated member's own payouts across their committees.
   */
  async getMyPayouts(
    userId: string,
  ): Promise<{ data: PayoutWithDetails[]; total: number }> {
    const data = (await this.prisma.payout.findMany({
      where: { member: { userId } },
      include: {
        ...PAYOUT_INCLUDE,
        cycle: {
          select: {
            id: true,
            cycleNumber: true,
            status: true,
            committeeId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })) as PayoutWithDetails[];

    return { data, total: data.length };
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
