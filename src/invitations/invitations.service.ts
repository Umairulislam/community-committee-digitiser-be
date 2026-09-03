import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Invitation, InvitationStatus } from '@prisma/client';
import { InviteMemberDto } from './dto/invite-member.dto';
import { QueryInvitationDto } from './dto/query-invitation.dto';
import * as crypto from 'crypto';

interface AuthUser {
  id: string;
  role: string;
}

type InvitationWithRelations = Invitation & {
  committee: { id: string; name: string };
  inviter: { id: string; name: string; email: string };
};

const INVITE_INCLUDE = {
  committee: { select: { id: true, name: true } },
  inviter: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    committeeId: string,
    dto: InviteMemberDto,
    adminId: string,
  ): Promise<InvitationWithRelations> {
    await this.requireCommitteeAdmin(committeeId, adminId);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const existingMember = await this.prisma.committeeMember.findUnique({
        where: { userId_committeeId: { userId: user.id, committeeId } },
      });
      if (existingMember && existingMember.status !== 'REMOVED') {
        throw new ConflictException(
          'This user is already a member of this committee',
        );
      }
    }

    const existingPending = await this.prisma.invitation.findFirst({
      where: {
        committeeId,
        email: dto.email,
        status: InvitationStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });
    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    const activeCount = await this.prisma.committeeMember.count({
      where: { committeeId, status: { in: ['ACTIVE', 'INVITED'] } },
    });
    if (activeCount >= committee.memberLimit) {
      throw new BadRequestException(
        'Committee has reached its member limit',
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresAfterDays ?? 7));

    const invitation = await this.prisma.invitation.create({
      data: { committeeId, invitedBy: adminId, email: dto.email, token, expiresAt },
      include: INVITE_INCLUDE,
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'MEMBER_INVITED',
      entityType: 'Invitation',
      entityId: invitation.id,
      committeeId,
      metadata: { email: dto.email },
    });

    return invitation as InvitationWithRelations;
  }

  async findAll(
    committeeId: string,
    query: QueryInvitationDto,
    userId: string,
  ): Promise<{ data: InvitationWithRelations[]; total: number; page: number; limit: number }> {
    await this.requireCommitteeAdmin(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { committeeId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        include: INVITE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    return { data: data as InvitationWithRelations[], total, page, limit };
  }

  async findOne(
    id: string,
    committeeId: string,
    userId: string,
  ): Promise<InvitationWithRelations> {
    await this.requireCommitteeAdmin(committeeId, userId);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, committeeId },
      include: INVITE_INCLUDE,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation as InvitationWithRelations;
  }

  async accept(
    token: string,
    userId: string,
  ): Promise<InvitationWithRelations> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: INVITE_INCLUDE,
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `This invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('This invitation has expired');
    }

    const existingMember = await this.prisma.committeeMember.findUnique({
      where: {
        userId_committeeId: { userId, committeeId: invitation.committeeId },
      },
    });

    if (existingMember && existingMember.status !== 'REMOVED') {
      throw new ConflictException(
        'You are already a member of this committee',
      );
    }

    const [updatedInvitation] = await this.prisma.$transaction([
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        include: INVITE_INCLUDE,
      }),
      existingMember
        ? this.prisma.committeeMember.update({
            where: { id: existingMember.id },
            data: { status: 'ACTIVE', joinedAt: new Date(), removedAt: null },
          })
        : this.prisma.committeeMember.create({
            data: {
              committeeId: invitation.committeeId,
              userId,
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'MEMBER_JOINED',
          entityType: 'Invitation',
          entityId: invitation.id,
          committeeId: invitation.committeeId,
        },
      }),
    ]);

    return updatedInvitation as InvitationWithRelations;
  }

  async cancel(
    id: string,
    committeeId: string,
    userId: string,
  ): Promise<InvitationWithRelations> {
    await this.requireCommitteeAdmin(committeeId, userId);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, committeeId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel an invitation that is ${invitation.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.CANCELLED },
      include: INVITE_INCLUDE,
    });

    return updated as InvitationWithRelations;
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
        'Only the committee admin can manage invitations',
      );
    }
  }
}
