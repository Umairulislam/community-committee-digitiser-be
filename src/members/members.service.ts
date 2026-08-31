import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommitteeMember } from '@prisma/client';
import { QueryMemberDto } from './dto/query-member.dto';

type MemberWithUser = CommitteeMember & {
  user: { id: string; name: string; email: string; phone: string | null };
};

const MEMBER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    committeeId: string,
    query: QueryMemberDto,
    userId: string,
  ): Promise<{ data: MemberWithUser[]; total: number; page: number; limit: number }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { committeeId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.committeeMember.findMany({
        where,
        include: MEMBER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.committeeMember.count({ where }),
    ]);

    return { data: data as MemberWithUser[], total, page, limit };
  }

  async findOne(
    id: string,
    committeeId: string,
    userId: string,
  ): Promise<MemberWithUser> {
    await this.requireCommitteeAccess(committeeId, userId);

    const member = await this.prisma.committeeMember.findFirst({
      where: { id, committeeId },
      include: MEMBER_INCLUDE,
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member as MemberWithUser;
  }

  async remove(
    id: string,
    committeeId: string,
    adminId: string,
  ): Promise<{ message: string }> {
    await this.requireCommitteeAdmin(committeeId, adminId);

    const member = await this.prisma.committeeMember.findFirst({
      where: { id, committeeId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.status === 'REMOVED') {
      throw new BadRequestException('Member is already removed');
    }

    await this.prisma.committeeMember.update({
      where: { id },
      data: { status: 'REMOVED', removedAt: new Date() },
    });

    return { message: 'Member removed' };
  }

  async getMyCommittees(
    userId: string,
  ): Promise<{ committee: Record<string, unknown>; role: string; status: string; joinedAt: Date | null }[]> {
    const memberships = await this.prisma.committeeMember.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'INVITED'] },
      },
      include: {
        committee: {
          select: {
            id: true,
            name: true,
            description: true,
            contributionAmount: true,
            memberLimit: true,
            totalCycles: true,
            payoutMethod: true,
            startDate: true,
            dueDay: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      committee: m.committee as unknown as Record<string, unknown>,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
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

  private async requireCommitteeAdmin(
    committeeId: string,
    userId: string,
  ): Promise<void> {
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
  }
}
