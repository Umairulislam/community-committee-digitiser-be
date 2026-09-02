import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Contribution, ContributionStatus, Committee, Cycle } from '@prisma/client';
import { QueryContributionDto } from './dto/query-contribution.dto';

type ContributionWithMember = Contribution & {
  member: {
    id: string;
    role: string;
    status: string;
    user: { id: string; name: string; email: string; phone: string | null };
  };
};

const MEMBER_INCLUDE = {
  member: {
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
};

function toNumber(value: unknown): number {
  if (value != null && typeof (value as Record<string, unknown>).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<{ generated: number; contributions: Contribution[] }> {
    const committee = await this.requireOwnedCommittee(committeeId, userId);

    const cycle = await this.requireCycle(committeeId, cycleId);

    if (cycle.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cycle must be ACTIVE to generate contributions',
      );
    }

    const existingCount = await this.prisma.contribution.count({
      where: { cycleId },
    });

    if (existingCount > 0) {
      throw new ConflictException(
        `Contributions already generated for this cycle (${existingCount} records exist)`,
      );
    }

    const activeMembers = await this.prisma.committeeMember.findMany({
      where: { committeeId, status: 'ACTIVE' },
    });

    if (activeMembers.length === 0) {
      throw new BadRequestException(
        'Committee must have at least one active member to generate contributions',
      );
    }

    const amount = committee.contributionAmount;
    const dueDate = this.calculateDueDate(cycle, committee.dueDay);

    const contributionsData = activeMembers.map((member) => ({
      cycleId,
      memberId: member.id,
      amount,
      dueDate,
      status: ContributionStatus.PENDING,
    }));

    const created = await this.prisma.$transaction(
      contributionsData.map((data) =>
        this.prisma.contribution.create({ data }),
      ),
    );

    return { generated: created.length, contributions: created };
  }

  async findAll(
    committeeId: string,
    cycleId: string,
    query: QueryContributionDto,
    userId: string,
  ): Promise<{
    data: ContributionWithMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { cycleId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        include: MEMBER_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.contribution.count({ where }),
    ]);

    return {
      data: data as ContributionWithMember[],
      total,
      page,
      limit,
    };
  }

  async findOne(
    committeeId: string,
    cycleId: string,
    id: string,
    userId: string,
  ): Promise<ContributionWithMember> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const contribution = await this.prisma.contribution.findFirst({
      where: { id, cycleId },
      include: MEMBER_INCLUDE,
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    return contribution as ContributionWithMember;
  }

  async getSummary(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<{
    totalExpected: number;
    totalCollected: number;
    totalPending: number;
    totalOverdue: number;
    memberCount: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);
    await this.requireCycle(committeeId, cycleId);

    const contributions = await this.prisma.contribution.findMany({
      where: { cycleId },
      select: { amount: true, status: true },
    });

    const memberCount = contributions.length;

    let totalExpected = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const c of contributions) {
      const amount = toNumber(c.amount);
      totalExpected += amount;

      if (c.status === ContributionStatus.PAID) {
        totalCollected += amount;
      } else if (c.status === ContributionStatus.PENDING) {
        totalPending += amount;
      } else if (c.status === ContributionStatus.OVERDUE) {
        totalOverdue += amount;
      }
    }

    return { totalExpected, totalCollected, totalPending, totalOverdue, memberCount };
  }

  async markOverdue(
    committeeId: string,
    cycleId: string,
    userId: string,
  ): Promise<{ marked: number }> {
    await this.requireOwnedCommittee(committeeId, userId);

    const cycle = await this.requireCycle(committeeId, cycleId);

    if (cycle.status === 'COMPLETED' || cycle.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot modify contributions for a completed or cancelled cycle',
      );
    }

    const now = new Date();

    const result = await this.prisma.contribution.updateMany({
      where: {
        cycleId,
        status: ContributionStatus.PENDING,
        dueDate: { lt: now },
      },
      data: { status: ContributionStatus.OVERDUE },
    });

    return { marked: result.count };
  }

  private calculateDueDate(cycle: Cycle, dueDay: number): Date {
    const baseDate = cycle.startDate ?? new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(dueDay, lastDayOfMonth);
    return new Date(year, month, day, 23, 59, 59);
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
