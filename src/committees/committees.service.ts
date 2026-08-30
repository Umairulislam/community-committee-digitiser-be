import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Committee, CommitteeStatus } from '@prisma/client';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { UpdateCommitteeDto } from './dto/update-committee.dto';
import { QueryCommitteeDto } from './dto/query-committee.dto';

interface AuthUser {
  id: string;
  role: string;
}

type CommitteeWithCreator = Committee & {
  creator: { id: string; name: string; email: string };
};

const VALID_TRANSITIONS: Record<CommitteeStatus, CommitteeStatus[]> = {
  DRAFT: [CommitteeStatus.ACTIVE, CommitteeStatus.PAUSED, CommitteeStatus.CANCELLED],
  ACTIVE: [CommitteeStatus.PAUSED, CommitteeStatus.COMPLETED, CommitteeStatus.CANCELLED],
  PAUSED: [CommitteeStatus.ACTIVE, CommitteeStatus.CANCELLED, CommitteeStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class CommitteesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCommitteeDto, userId: string): Promise<CommitteeWithCreator> {
    const committee = await this.prisma.committee.create({
      data: {
        name: dto.name,
        description: dto.description,
        contributionAmount: dto.contributionAmount,
        memberLimit: dto.memberLimit,
        totalCycles: dto.totalCycles,
        startDate: new Date(dto.startDate),
        dueDay: dto.dueDay,
        createdBy: userId,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return committee as CommitteeWithCreator;
  }

  async findAll(
    userId: string,
    query: QueryCommitteeDto,
  ): Promise<{ data: CommitteeWithCreator[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { createdBy: userId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.committee.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.committee.count({ where }),
    ]);

    return { data: data as CommitteeWithCreator[], total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<CommitteeWithCreator> {
    const committee = await this.prisma.committee.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    if (committee.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have access to this committee',
      );
    }

    return committee as CommitteeWithCreator;
  }

  async update(
    id: string,
    dto: UpdateCommitteeDto,
    userId: string,
  ): Promise<CommitteeWithCreator> {
    const committee = await this.requireOwnedCommittee(id, userId);

    if (committee.status !== CommitteeStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT committees can be updated',
      );
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.contributionAmount !== undefined)
      data.contributionAmount = dto.contributionAmount;
    if (dto.memberLimit !== undefined) data.memberLimit = dto.memberLimit;
    if (dto.totalCycles !== undefined) data.totalCycles = dto.totalCycles;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.dueDay !== undefined) data.dueDay = dto.dueDay;

    const updated = await this.prisma.committee.update({
      where: { id },
      data,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return updated as CommitteeWithCreator;
  }

  async updateStatus(
    id: string,
    newStatus: CommitteeStatus,
    userId: string,
  ): Promise<CommitteeWithCreator> {
    const committee = await this.requireOwnedCommittee(id, userId);
    const currentStatus = committee.status;

    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    if (currentStatus === newStatus) {
      throw new BadRequestException(
        `Committee is already in ${newStatus} status`,
      );
    }

    const updated = await this.prisma.committee.update({
      where: { id },
      data: { status: newStatus },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return updated as CommitteeWithCreator;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const committee = await this.requireOwnedCommittee(id, userId);

    if (committee.status !== CommitteeStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT committees can be deleted. Use status update to CANCELLED for non-draft committees.',
      );
    }

    await this.prisma.committee.delete({ where: { id } });
    return { message: 'Committee deleted' };
  }

  private async requireOwnedCommittee(
    id: string,
    userId: string,
  ): Promise<Committee> {
    const committee = await this.prisma.committee.findUnique({
      where: { id },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    if (committee.createdBy !== userId) {
      throw new ForbiddenException(
        'You do not have access to this committee',
      );
    }

    return committee;
  }
}
