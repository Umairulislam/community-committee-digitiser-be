import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MembersService', () => {
  let service: MembersService;

  const adminId = 'admin-1';
  const userId = 'user-1';
  const committeeId = 'comm-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    createdBy: adminId,
  };

  const mockMember = {
    id: 'mem-1',
    committeeId,
    userId,
    role: 'MEMBER',
    status: 'ACTIVE',
    joinedAt: new Date(),
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: userId, name: 'User', email: 'user@test.com', phone: null },
  };

  const mockPrisma = {
    committee: { findUnique: jest.fn() },
    committeeMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return members for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findMany.mockResolvedValue([mockMember]);
      mockPrisma.committeeMember.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return members for active committee member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: adminId,
      });
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });
      mockPrisma.committeeMember.findMany.mockResolvedValue([mockMember]);
      mockPrisma.committeeMember.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, userId);

      expect(result.data).toHaveLength(1);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(committeeId, {}, 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject access for removed member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'REMOVED',
      });

      await expect(
        service.findAll(committeeId, {}, 'removed-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);
      mockPrisma.committeeMember.count.mockResolvedValue(0);

      await service.findAll(
        committeeId,
        { status: 'ACTIVE' as any },
        adminId,
      );

      expect(mockPrisma.committeeMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a member for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findFirst.mockResolvedValue(mockMember);

      const result = await service.findOne('mem-1', committeeId, adminId);

      expect(result.id).toBe('mem-1');
    });

    it('should throw NotFoundException for non-existent member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', committeeId, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an active member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.committeeMember.update.mockResolvedValue({
        ...mockMember,
        status: 'REMOVED',
      });

      const result = await service.remove('mem-1', committeeId, adminId);

      expect(result.message).toBe('Member removed');
      expect(mockPrisma.committeeMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REMOVED' }),
        }),
      );
    });

    it('should reject if member is already removed', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findFirst.mockResolvedValue({
        ...mockMember,
        status: 'REMOVED',
      });

      await expect(
        service.remove('mem-1', committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);

      await expect(
        service.remove('mem-1', committeeId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', committeeId, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyCommittees', () => {
    it('should return committees for the user', async () => {
      mockPrisma.committeeMember.findMany.mockResolvedValue([
        {
          ...mockMember,
          committee: {
            id: committeeId,
            name: 'Test Committee',
            description: null,
            contributionAmount: 10000,
            memberLimit: 10,
            totalCycles: 10,
            payoutMethod: 'LOTTERY',
            startDate: new Date(),
            dueDay: 5,
            status: 'ACTIVE',
            createdAt: new Date(),
          },
        },
      ]);

      const result = await service.getMyCommittees(userId);

      expect(result).toHaveLength(1);
      expect(result[0].committee.name).toBe('Test Committee');
      expect(result[0].status).toBe('ACTIVE');
    });

    it('should return empty array if user has no memberships', async () => {
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);

      const result = await service.getMyCommittees(userId);

      expect(result).toHaveLength(0);
    });
  });
});
