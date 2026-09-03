import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';
  const memberId = 'user-1';
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';
  const contributionId = 'contrib-1';
  const memberRecordId = 'mem-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
    contributionAmount: { toNumber: () => 10000 },
  };

  const mockCycle = {
    id: cycleId,
    committeeId,
    cycleNumber: 1,
    status: 'ACTIVE',
    totalCollected: { toNumber: () => 0 },
  };

  const mockContribution = {
    id: contributionId,
    cycleId,
    memberId: memberRecordId,
    amount: { toNumber: () => 10000 },
    status: 'PENDING',
    paidAt: null,
    paymentId: null,
    cycle: { committeeId },
  };

  const mockPaidContribution = {
    ...mockContribution,
    status: 'PAID',
  };

  const mockPayment = {
    id: 'pay-1',
    contributionId,
    memberId: memberRecordId,
    amount: { toNumber: () => 10000 },
    transactionReference: 'TXN-001',
    status: 'PENDING',
    paidAt: new Date(),
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contribution: {
      id: contributionId,
      cycleId,
      memberId: memberRecordId,
      amount: { toNumber: () => 10000 },
      status: 'PENDING',
      member: {
        id: memberRecordId,
        role: 'MEMBER',
        status: 'ACTIVE',
        user: { id: memberId, name: 'User 1', email: 'user1@test.com', phone: null },
      },
    },
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    committeeMember: { findUnique: jest.fn(), findMany: jest.fn() },
    contribution: { findFirst: jest.fn(), update: jest.fn() },
    cycle: { findMany: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should create a payment for a valid PENDING contribution', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue(mockContribution);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      const result = await service.create(committeeId, {
        contributionId,
        amount: 10000,
        transactionReference: 'TXN-001',
      }, memberId);

      expect(result.id).toBe('pay-1');
      expect(result.status).toBe('PENDING');
    });

    it('should reject if contribution is already PAID', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue(mockPaidContribution);

      await expect(
        service.create(committeeId, {
          contributionId,
          amount: 10000,
          transactionReference: 'TXN-002',
        }, memberId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if payment amount does not match contribution amount', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue(mockContribution);

      await expect(
        service.create(committeeId, {
          contributionId,
          amount: 5000,
          transactionReference: 'TXN-003',
        }, memberId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if contribution not found', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue(null);

      await expect(
        service.create(committeeId, {
          contributionId: 'nonexistent',
          amount: 10000,
          transactionReference: 'TXN-004',
        }, memberId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if contribution belongs to a different committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue({
        ...mockContribution,
        cycle: { committeeId: 'other-comm' },
      });

      await expect(
        service.create(committeeId, {
          contributionId,
          amount: 10000,
          transactionReference: 'TXN-005',
        }, memberId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create(committeeId, {
          contributionId,
          amount: 10000,
          transactionReference: 'TXN-006',
        }, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow OVERDUE contributions to receive payments', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ id: memberRecordId, status: 'ACTIVE' });
      mockPrisma.contribution.findFirst.mockResolvedValue({
        ...mockContribution,
        status: 'OVERDUE',
      });
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      const result = await service.create(committeeId, {
        contributionId,
        amount: 10000,
        transactionReference: 'TXN-007',
      }, memberId);

      expect(result.id).toBe('pay-1');
    });
  });

  describe('findAll', () => {
    it('should return paginated payments for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([{ id: cycleId }]);
      mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([{ id: cycleId }]);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll(committeeId, { status: 'VERIFIED' as any }, adminId);

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'VERIFIED' }),
        }),
      );
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(committeeId, {}, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return a payment with contribution info', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { committeeId } },
      });

      const result = await service.findOne(committeeId, 'pay-1', adminId);

      expect(result.id).toBe('pay-1');
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if payment belongs to different committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue({
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { committeeId: 'other-comm' } },
      });

      await expect(
        service.findOne(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verify', () => {
    it('should atomically verify payment, update contribution, and cycle total', async () => {
      const paymentWithCycle = {
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { ...mockCycle, committeeId } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(paymentWithCycle);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockPayment, status: 'VERIFIED', verifiedAt: new Date() },
        { ...mockContribution, status: 'PAID' },
        { ...mockCycle, totalCollected: 10000 },
      ]);

      const result = await service.verify(committeeId, 'pay-1', adminId);

      expect(result.status).toBe('VERIFIED');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject if payment is not PENDING', async () => {
      const verifiedPayment = {
        ...mockPayment,
        status: 'VERIFIED',
        contribution: { ...mockPayment.contribution, cycle: { ...mockCycle, committeeId } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(verifiedPayment);

      await expect(
        service.verify(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.verify(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if payment belongs to different committee', async () => {
      const paymentOtherComm = {
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { committeeId: 'other-comm' } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(paymentOtherComm);

      await expect(
        service.verify(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.verify(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('should reject a PENDING payment', async () => {
      const paymentWithCycle = {
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { ...mockCycle, committeeId } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(paymentWithCycle);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'REJECTED',
        verifiedAt: new Date(),
      });

      const result = await service.reject(committeeId, 'pay-1', adminId);

      expect(result.status).toBe('REJECTED');
      expect(result.verifiedAt).toBeTruthy();
    });

    it('should reject if payment is already VERIFIED', async () => {
      const verifiedPayment = {
        ...mockPayment,
        status: 'VERIFIED',
        contribution: { ...mockPayment.contribution, cycle: { ...mockCycle, committeeId } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(verifiedPayment);

      await expect(
        service.reject(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.reject(committeeId, 'pay-1', adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent payment', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.reject(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not change contribution status when rejecting', async () => {
      const paymentWithCycle = {
        ...mockPayment,
        contribution: { ...mockPayment.contribution, cycle: { ...mockCycle, committeeId } },
      };
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.payment.findFirst.mockResolvedValue(paymentWithCycle);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: 'REJECTED',
      });

      await service.reject(committeeId, 'pay-1', adminId);

      expect(mockPrisma.contribution.update).not.toHaveBeenCalled();
    });
  });
});
