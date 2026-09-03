import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cycle, CycleStatus, Committee, NotificationType } from '@prisma/client';
import { QueryCycleDto } from './dto/query-cycle.dto';

const VALID_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  UPCOMING: [CycleStatus.ACTIVE, CycleStatus.CANCELLED],
  ACTIVE: [CycleStatus.COMPLETED, CycleStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generate(
    committeeId: string,
    userId: string,
    startDateOverride?: string,
  ): Promise<{ generated: number; cycles: Cycle[] }> {
    const committee = await this.requireOwnedCommittee(committeeId, userId);

    if (committee.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Committee must be ACTIVE to generate cycles',
      );
    }

    const existingCount = await this.prisma.cycle.count({
      where: { committeeId },
    });

    const remaining = committee.totalCycles - existingCount;

    if (remaining <= 0) {
      throw new ConflictException(
        'All cycles have already been generated for this committee',
      );
    }

    const activeMembers = await this.prisma.committeeMember.findMany({
      where: { committeeId, status: 'ACTIVE' },
    });

    if (activeMembers.length === 0) {
      throw new BadRequestException(
        'Committee must have at least one active member to generate cycles',
      );
    }

    const totalExpected =
      Number(committee.contributionAmount) * activeMembers.length;

    const baseDate = startDateOverride
      ? new Date(startDateOverride)
      : committee.startDate;

    const cyclesData: {
      committeeId: string;
      cycleNumber: number;
      startDate: Date | null;
      status: CycleStatus;
      totalExpected: number;
    }[] = [];

    for (let i = 0; i < remaining; i++) {
      const cycleNumber = existingCount + i + 1;
      const isFirstCycle = cycleNumber === 1;

      cyclesData.push({
        committeeId,
        cycleNumber,
        startDate: isFirstCycle ? baseDate : null,
        status: isFirstCycle ? CycleStatus.ACTIVE : CycleStatus.UPCOMING,
        totalExpected,
      });
    }

    const created = await this.prisma.$transaction(
      cyclesData.map((data) =>
        this.prisma.cycle.create({ data }),
      ),
    );

    return { generated: created.length, cycles: created };
  }

  async findAll(
    committeeId: string,
    query: QueryCycleDto,
    userId: string,
  ): Promise<{ data: Cycle[]; total: number; page: number; limit: number }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { committeeId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.cycle.findMany({
        where,
        orderBy: { cycleNumber: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.cycle.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(
    committeeId: string,
    id: string,
    userId: string,
  ): Promise<Cycle> {
    await this.requireCommitteeAccess(committeeId, userId);

    const cycle = await this.prisma.cycle.findFirst({
      where: { id, committeeId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    return cycle;
  }

  async updateStatus(
    committeeId: string,
    id: string,
    newStatus: CycleStatus,
    userId: string,
  ): Promise<Cycle> {
    await this.requireOwnedCommittee(committeeId, userId);

    const cycle = await this.prisma.cycle.findFirst({
      where: { id, committeeId },
    });

    if (!cycle) {
      throw new NotFoundException('Cycle not found');
    }

    const currentStatus = cycle.status;
    const allowed = VALID_TRANSITIONS[currentStatus];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition cycle from ${currentStatus} to ${newStatus}`,
      );
    }

    if (currentStatus === newStatus) {
      throw new BadRequestException(
        `Cycle is already in ${newStatus} status`,
      );
    }

    if (newStatus === CycleStatus.ACTIVE) {
      const activeCycle = await this.prisma.cycle.findFirst({
        where: { committeeId, status: CycleStatus.ACTIVE },
      });

      if (activeCycle && activeCycle.id !== id) {
        throw new BadRequestException(
          'Another cycle is already active. Complete it before activating a new one.',
        );
      }
    }

    const data: Record<string, unknown> = { status: newStatus };

    if (newStatus === CycleStatus.ACTIVE && !cycle.startDate) {
      data.startDate = new Date();
    }

    if (newStatus === CycleStatus.COMPLETED && !cycle.endDate) {
      data.endDate = new Date();
    }

    return this.prisma.cycle.update({
      where: { id },
      data,
    }).then(async (updated) => {
      // Notify all active members about cycle status changes
      if (newStatus === CycleStatus.ACTIVE || newStatus === CycleStatus.COMPLETED) {
        const members = await this.prisma.committeeMember.findMany({
          where: { committeeId, status: 'ACTIVE' },
          select: { userId: true },
        });
        const memberUserIds = members.map((m) => m.userId);
        if (memberUserIds.length > 0) {
          await this.notificationsService.createMany(memberUserIds, {
            type: newStatus === CycleStatus.ACTIVE ? NotificationType.CYCLE_STARTED : NotificationType.CYCLE_COMPLETED,
            title: newStatus === CycleStatus.ACTIVE ? 'Cycle Started' : 'Cycle Completed',
            message: newStatus === CycleStatus.ACTIVE
              ? `Cycle ${cycle.cycleNumber} has started. Please make your contribution.`
              : `Cycle ${cycle.cycleNumber} has been completed.`,
            committeeId,
          });
        }
      }
      return updated;
    });
  }

  async startNext(
    committeeId: string,
    userId: string,
  ): Promise<{ completed: Cycle | null; activated: Cycle | null; committeeCompleted: boolean }> {
    const committee = await this.requireOwnedCommittee(committeeId, userId);

    if (committee.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Committee must be ACTIVE to start the next cycle',
      );
    }

    const activeCycle = await this.prisma.cycle.findFirst({
      where: { committeeId, status: CycleStatus.ACTIVE },
    });

    if (!activeCycle) {
      throw new BadRequestException(
        'No active cycle found. Generate cycles first.',
      );
    }

    const nextCycle = await this.prisma.cycle.findFirst({
      where: {
        committeeId,
        status: CycleStatus.UPCOMING,
        cycleNumber: activeCycle.cycleNumber + 1,
      },
    });

    const now = new Date();

    if (!nextCycle) {
      const completed = await this.prisma.cycle.update({
        where: { id: activeCycle.id },
        data: { status: CycleStatus.COMPLETED, endDate: now },
      });

      await this.prisma.committee.update({
        where: { id: committeeId },
        data: { status: 'COMPLETED' },
      });

      // Notify members that the last cycle and committee are completed
      const members = await this.prisma.committeeMember.findMany({
        where: { committeeId, status: 'ACTIVE' },
        select: { userId: true },
      });
      const memberUserIds = members.map((m) => m.userId);
      if (memberUserIds.length > 0) {
        await this.notificationsService.createMany(memberUserIds, {
          type: NotificationType.CYCLE_COMPLETED,
          title: 'Cycle Completed',
          message: `The final cycle (${activeCycle.cycleNumber}) has been completed. The committee is now marked as completed.`,
          committeeId,
        });
      }

      return { completed, activated: null, committeeCompleted: true };
    }

    const [completed, activated] = await this.prisma.$transaction([
      this.prisma.cycle.update({
        where: { id: activeCycle.id },
        data: { status: CycleStatus.COMPLETED, endDate: now },
      }),
      this.prisma.cycle.update({
        where: { id: nextCycle.id },
        data: { status: CycleStatus.ACTIVE, startDate: now },
      }),
    ]);

    // Notify members about cycle completion and next cycle starting
    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const memberUserIds = members.map((m) => m.userId);
    if (memberUserIds.length > 0) {
      await this.notificationsService.createMany(memberUserIds, {
        type: NotificationType.CYCLE_COMPLETED,
        title: 'Cycle Completed',
        message: `Cycle ${activeCycle.cycleNumber} has been completed.`,
        committeeId,
      });
      await this.notificationsService.createMany(memberUserIds, {
        type: NotificationType.CYCLE_STARTED,
        title: 'New Cycle Started',
        message: `Cycle ${nextCycle.cycleNumber} has started. Please make your contribution.`,
        committeeId,
      });
    }

    return { completed, activated, committeeCompleted: false };
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
}
