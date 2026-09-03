import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('InvitationsService', () => {
  let service: InvitationsService;

  const adminId = 'admin-1';
  const committeeId = 'comm-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
    memberLimit: 10,
  };

  const mockInvitation = {
    id: 'inv-1',
    committeeId,
    invitedBy: adminId,
    email: 'invitee@test.com',
    token: 'abc123token',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    createdAt: new Date(),
    committee: { id: committeeId, name: 'Test Committee' },
    inviter: { id: adminId, name: 'Admin', email: 'admin@test.com' },
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    committeeMember: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a pending invitation', async () => {
      mockPrisma.committee.findUnique
        .mockResolvedValueOnce(mockCommittee)
        .mockResolvedValueOnce(mockCommittee);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invitation.findFirst.mockResolvedValue(null);
      mockPrisma.committeeMember.count.mockResolvedValue(0);
      mockPrisma.invitation.create.mockResolvedValue(mockInvitation);

      const result = await service.create(
        committeeId,
        { email: 'invitee@test.com' },
        adminId,
      );

      expect(result.email).toBe('invitee@test.com');
      expect(result.status).toBe('PENDING');
    });

    it('should reject if user is already an active member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'invitee@test.com',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });

      await expect(
        service.create(committeeId, { email: 'invitee@test.com' }, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if pending invitation already exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invitation.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'PENDING',
      });

      await expect(
        service.create(committeeId, { email: 'invitee@test.com' }, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if member limit reached', async () => {
      mockPrisma.committee.findUnique
        .mockResolvedValueOnce(mockCommittee)
        .mockResolvedValueOnce({ ...mockCommittee, memberLimit: 2 });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invitation.findFirst.mockResolvedValue(null);
      mockPrisma.committeeMember.count.mockResolvedValue(2);

      await expect(
        service.create(committeeId, { email: 'new@test.com' }, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);

      await expect(
        service.create(committeeId, { email: 'test@test.com' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow re-inviting a removed member', async () => {
      mockPrisma.committee.findUnique
        .mockResolvedValueOnce(mockCommittee)
        .mockResolvedValueOnce(mockCommittee);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'invitee@test.com',
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'REMOVED',
      });
      mockPrisma.invitation.findFirst.mockResolvedValue(null);
      mockPrisma.committeeMember.count.mockResolvedValue(1);
      mockPrisma.invitation.create.mockResolvedValue(mockInvitation);

      const result = await service.create(
        committeeId,
        { email: 'invitee@test.com' },
        adminId,
      );

      expect(result.email).toBe('invitee@test.com');
    });
  });

  describe('findAll', () => {
    it('should return paginated invitations for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.invitation.findMany.mockResolvedValue([mockInvitation]);
      mockPrisma.invitation.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.invitation.findMany.mockResolvedValue([]);
      mockPrisma.invitation.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { status: 'PENDING' as any },
        adminId,
      );

      expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });

  describe('accept', () => {
    it('should accept a valid invitation and create membership', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      const acceptedInvitation = {
        ...mockInvitation,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      };

      mockPrisma.$transaction.mockResolvedValue([
        acceptedInvitation,
        { id: 'mem-new', status: 'ACTIVE' },
      ]);

      const result = await service.accept('abc123token', 'user-2');

      expect(result.status).toBe('ACCEPTED');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject an already accepted invitation', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        status: 'ACCEPTED',
      });

      await expect(service.accept('abc123token', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an expired invitation', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.invitation.update.mockResolvedValue({});

      await expect(service.accept('abc123token', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if user is already a member', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });

      await expect(service.accept('abc123token', 'user-2')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject an invalid token', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(null);

      await expect(service.accept('bad-token', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reactivate a removed member', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-existing',
        status: 'REMOVED',
      });

      const acceptedInvitation = {
        ...mockInvitation,
        status: 'ACCEPTED',
      };

      mockPrisma.$transaction.mockResolvedValue([
        acceptedInvitation,
        { id: 'mem-existing', status: 'ACTIVE' },
      ]);

      const result = await service.accept('abc123token', 'user-2');

      expect(result.status).toBe('ACCEPTED');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel a pending invitation', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.invitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.invitation.update.mockResolvedValue({
        ...mockInvitation,
        status: 'CANCELLED',
      });

      const result = await service.cancel('inv-1', committeeId, adminId);

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancelling a non-pending invitation', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.invitation.findFirst.mockResolvedValue({
        ...mockInvitation,
        status: 'ACCEPTED',
      });

      await expect(
        service.cancel('inv-1', committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);

      await expect(
        service.cancel('inv-1', committeeId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
