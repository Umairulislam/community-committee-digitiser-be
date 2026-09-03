import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const adminId = 'admin-1';
  const memberId = 'mem-1';
  const committeeId = 'comm-1';
  const cycleId = 'cycle-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
  };

  const mockAuditLog = {
    id: 'audit-1',
    actorId: adminId,
    action: 'COMMITTEE_CREATED',
    entityType: 'Committee',
    entityId: committeeId,
    committeeId,
    cycleId: null,
    metadata: null,
    createdAt: new Date(),
  };

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    committee: { findUnique: jest.fn() },
    committeeMember: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.resetAllMocks();
  });

  describe('log', () => {
    it('should create an audit record using default prisma client', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        actorId: adminId,
        action: 'COMMITTEE_CREATED',
        entityType: 'Committee',
        entityId: committeeId,
        committeeId,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminId,
          action: 'COMMITTEE_CREATED',
          entityType: 'Committee',
          entityId: committeeId,
          committeeId,
        }),
      });
    });

    it('should create an audit record with metadata', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        ...mockAuditLog,
        metadata: { previousStatus: 'DRAFT', newStatus: 'ACTIVE' },
      });

      await service.log({
        actorId: adminId,
        action: 'COMMITTEE_STATUS_CHANGED',
        entityType: 'Committee',
        entityId: committeeId,
        committeeId,
        metadata: { previousStatus: 'DRAFT', newStatus: 'ACTIVE' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { previousStatus: 'DRAFT', newStatus: 'ACTIVE' },
        }),
      });
    });

    it('should create an audit record using a transaction client when provided', async () => {
      const mockTxClient = {
        auditLog: { create: jest.fn().mockResolvedValue(mockAuditLog) },
      };

      await service.log(
        {
          actorId: adminId,
          action: 'LOTTERY_EXECUTED',
          entityType: 'LotteryResult',
          entityId: 'lot-1',
          committeeId,
          cycleId,
        },
        mockTxClient as any,
      );

      expect(mockTxClient.auditLog.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should set committeeId and cycleId to null when not provided', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        actorId: adminId,
        action: 'COMMITTEE_CREATED',
        entityType: 'Committee',
        entityId: committeeId,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          committeeId: null,
          cycleId: null,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs for a committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
    });

    it('should filter by action', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { action: 'PAYMENT_VERIFIED' },
        adminId,
      );

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'PAYMENT_VERIFIED' }),
        }),
      );
    });

    it('should filter by entityType', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { entityType: 'Payment' },
        adminId,
      );

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'Payment' }),
        }),
      );
    });

    it('should filter by cycleId', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { cycleId },
        adminId,
      );

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cycleId }),
        }),
      );
    });

    it('should allow members to view audit logs', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: memberId,
        status: 'ACTIVE',
      });
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.findAll(committeeId, {}, memberId);

      expect(result.data).toHaveLength(0);
    });

    it('should reject access for removed members', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: memberId,
        status: 'REMOVED',
      });

      await expect(
        service.findAll(committeeId, {}, memberId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject access for non-members', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(committeeId, {}, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll('missing', {}, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return results ordered by createdAt descending', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll(committeeId, {}, adminId);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('getTimeline', () => {
    it('should return all audit events in chronological order', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.getTimeline(committeeId, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { committeeId },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('should reject access for non-members', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: 'other-admin',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getTimeline(committeeId, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
