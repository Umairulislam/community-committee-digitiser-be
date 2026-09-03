import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
import { QueryAuditDto } from './dto/query-audit.dto';

/**
 * Subset of PrismaClient that exposes the auditLog delegate.
 * Both PrismaService and interactive-transaction clients satisfy this.
 */
type AuditLogDelegate = {
  create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown>;
  findMany: (args?: Prisma.AuditLogFindManyArgs) => Promise<unknown[]>;
  count: (args?: Prisma.AuditLogCountArgs) => Promise<number>;
};

type PrismaLike = {
  auditLog: AuditLogDelegate;
};

interface LogParams {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  committeeId?: string;
  cycleId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit record. Accepts either the default PrismaService or a
   * Prisma interactive-transaction client so that audit events can be
   * persisted atomically with the business operation they describe.
   */
  async log(params: LogParams, client?: PrismaLike): Promise<unknown> {
    const delegate = client?.auditLog ?? this.prisma.auditLog;
    return delegate.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        committeeId: params.committeeId ?? null,
        cycleId: params.cycleId ?? null,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  /**
   * List audit logs for a committee with optional filtering and pagination.
   * Records are returned in reverse-chronological order (newest first).
   */
  async findAll(
    committeeId: string,
    query: QueryAuditDto,
    userId: string,
  ): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { committeeId };
    if (query.action) {
      where.action = query.action as AuditAction;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.cycleId) {
      where.cycleId = query.cycleId;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Return the full audit timeline for a committee — every event in
   * chronological order. Useful for rendering a visual timeline.
   */
  async getTimeline(
    committeeId: string,
    userId: string,
  ): Promise<{ data: unknown[]; total: number }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const data = await this.prisma.auditLog.findMany({
      where: { committeeId },
      orderBy: { createdAt: 'asc' },
    });

    return { data, total: data.length };
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
