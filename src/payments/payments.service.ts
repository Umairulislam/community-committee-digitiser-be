import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  Payment,
  PaymentStatus,
  ContributionStatus,
  Committee,
} from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';

type PaymentWithContribution = Payment & {
  contribution: {
    id: string;
    cycleId: string;
    memberId: string;
    amount: unknown;
    status: ContributionStatus;
    member: {
      id: string;
      role: string;
      status: string;
      user: { id: string; name: string; email: string; phone: string | null };
    };
  };
};

const CONTRIBUTION_INCLUDE = {
  contribution: {
    select: {
      id: true,
      cycleId: true,
      memberId: true,
      amount: true,
      status: true,
      member: {
        select: {
          id: true,
          role: true,
          status: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  },
};

const CONTRIBUTION_WITH_CYCLE_INCLUDE = {
  contribution: {
    select: {
      id: true,
      cycleId: true,
      memberId: true,
      amount: true,
      status: true,
      member: {
        select: {
          id: true,
          role: true,
          status: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      cycle: { select: { committeeId: true } },
    },
  },
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
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    committeeId: string,
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<PaymentWithContribution> {
    await this.requireCommitteeAccess(committeeId, userId);

    const contribution = await this.prisma.contribution.findFirst({
      where: { id: dto.contributionId },
      include: {
        cycle: { select: { committeeId: true } },
      },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.cycle.committeeId !== committeeId) {
      throw new ForbiddenException(
        'Contribution does not belong to this committee',
      );
    }

    if (contribution.status === ContributionStatus.PAID) {
      throw new BadRequestException(
        'Contribution is already paid',
      );
    }

    const expectedAmount = toNumber(contribution.amount);
    if (Math.abs(dto.amount - expectedAmount) > 0.01) {
      throw new BadRequestException(
        `Payment amount must match contribution amount of ${expectedAmount}`,
      );
    }

    const memberId = await this.resolveMemberId(committeeId, userId);

    const payment = await this.prisma.payment.create({
      data: {
        contributionId: dto.contributionId,
        memberId,
        amount: dto.amount,
        transactionReference: dto.transactionReference,
        status: PaymentStatus.PENDING,
      },
      include: CONTRIBUTION_INCLUDE,
    });

    return payment as PaymentWithContribution;
  }

  async findAll(
    committeeId: string,
    query: QueryPaymentDto,
    userId: string,
  ): Promise<{
    data: PaymentWithContribution[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.requireCommitteeAccess(committeeId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const cycleIds = (
      await this.prisma.cycle.findMany({
        where: { committeeId },
        select: { id: true },
      })
    ).map((c) => c.id);

    const where: Record<string, unknown> = {
      contribution: { cycleId: { in: cycleIds } },
    };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: CONTRIBUTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: data as PaymentWithContribution[],
      total,
      page,
      limit,
    };
  }

  async findOne(
    committeeId: string,
    id: string,
    userId: string,
  ): Promise<PaymentWithContribution> {
    await this.requireCommitteeAccess(committeeId, userId);

    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: CONTRIBUTION_WITH_CYCLE_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const cycle = (payment as any).contribution?.cycle;
    if (cycle && cycle.committeeId !== committeeId) {
      throw new ForbiddenException(
        'You do not have access to this payment',
      );
    }

    return payment as unknown as PaymentWithContribution;
  }

  async verify(
    committeeId: string,
    id: string,
    userId: string,
  ): Promise<PaymentWithContribution> {
    await this.requireOwnedCommittee(committeeId, userId);

    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: {
        contribution: { include: { cycle: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.contribution.cycle.committeeId !== committeeId) {
      throw new ForbiddenException(
        'Payment does not belong to this committee',
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment is already ${payment.status}. Only PENDING payments can be verified.`,
      );
    }

    const now = new Date();
    const paymentAmount = toNumber(payment.amount);

    const [verifiedPayment] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.VERIFIED, verifiedAt: now },
        include: CONTRIBUTION_INCLUDE,
      }),
      this.prisma.contribution.update({
        where: { id: payment.contributionId },
        data: {
          status: ContributionStatus.PAID,
          paidAt: now,
          paymentId: payment.id,
        },
      }),
      this.prisma.cycle.update({
        where: { id: payment.contribution.cycleId },
        data: {
          totalCollected: {
            increment: paymentAmount,
          },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'PAYMENT_VERIFIED',
          entityType: 'Payment',
          entityId: payment.id,
          committeeId,
          cycleId: payment.contribution.cycleId,
          metadata: { amount: paymentAmount, contributionId: payment.contributionId },
        },
      }),
    ]);

    return verifiedPayment as PaymentWithContribution;
  }

  async reject(
    committeeId: string,
    id: string,
    userId: string,
  ): Promise<PaymentWithContribution> {
    await this.requireOwnedCommittee(committeeId, userId);

    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: {
        contribution: { include: { cycle: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.contribution.cycle.committeeId !== committeeId) {
      throw new ForbiddenException(
        'Payment does not belong to this committee',
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment is already ${payment.status}. Only PENDING payments can be rejected.`,
      );
    }

    const rejectedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REJECTED, verifiedAt: new Date() },
      include: CONTRIBUTION_INCLUDE,
    });

    await this.auditService.log({
      actorId: userId,
      action: 'PAYMENT_REJECTED',
      entityType: 'Payment',
      entityId: payment.id,
      committeeId,
      cycleId: payment.contribution.cycleId,
      metadata: { amount: toNumber(payment.amount) },
    });

    return rejectedPayment as PaymentWithContribution;
  }

  private async resolveMemberId(
    committeeId: string,
    userId: string,
  ): Promise<string> {
    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (committee?.createdBy === userId) {
      const adminMember = await this.prisma.committeeMember.findUnique({
        where: { userId_committeeId: { userId, committeeId } },
      });
      if (adminMember) return adminMember.id;
      return committee.createdBy;
    }

    const membership = await this.prisma.committeeMember.findUnique({
      where: { userId_committeeId: { userId, committeeId } },
    });

    if (!membership) return userId;
    return membership.id;
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
