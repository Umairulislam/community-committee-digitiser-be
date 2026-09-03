import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CommitteesService } from './committees.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('CommitteesService', () => {
  let service: CommitteesService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';

  const mockCommittee = {
    id: 'comm-1',
    name: 'Family Committee',
    description: 'Test committee',
    contributionAmount: 10000,
    memberLimit: 10,
    totalCycles: 10,
    payoutMethod: 'LOTTERY',
    startDate: new Date('2026-09-01'),
    dueDay: 5,
    status: 'DRAFT',
    createdBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommitteeWithCreator = {
    ...mockCommittee,
    creator: { id: adminId, name: 'Admin', email: 'admin@test.com' },
  };

  const mockPrisma = {
    committee: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitteesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CommitteesService>(CommitteesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a committee in DRAFT status', async () => {
      mockPrisma.committee.create.mockResolvedValue(mockCommitteeWithCreator);

      const result = await service.create(
        {
          name: 'Family Committee',
          contributionAmount: 10000,
          memberLimit: 10,
          totalCycles: 10,
          startDate: '2026-09-01',
          dueDay: 5,
        },
        adminId,
      );

      expect(result.name).toBe('Family Committee');
      expect(mockPrisma.committee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: adminId,
            name: 'Family Committee',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated committees for the admin', async () => {
      mockPrisma.committee.findMany.mockResolvedValue([
        mockCommitteeWithCreator,
      ]);
      mockPrisma.committee.count.mockResolvedValue(1);

      const result = await service.findAll(adminId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockPrisma.committee.findMany.mockResolvedValue([]);
      mockPrisma.committee.count.mockResolvedValue(0);

      await service.findAll(adminId, {
        status: 'ACTIVE' as any,
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.committee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should default to page 1 and limit 10', async () => {
      mockPrisma.committee.findMany.mockResolvedValue([]);
      mockPrisma.committee.count.mockResolvedValue(0);

      const result = await service.findAll(adminId, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return a committee owned by the user', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(
        mockCommitteeWithCreator,
      );

      const result = await service.findOne('comm-1', adminId);

      expect(result.id).toBe('comm-1');
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for committee owned by another admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(service.findOne('comm-1', adminId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update a DRAFT committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committee.update.mockResolvedValue({
        ...mockCommitteeWithCreator,
        name: 'Updated Name',
      });

      const result = await service.update(
        'comm-1',
        { name: 'Updated Name' },
        adminId,
      );

      expect(result.name).toBe('Updated Name');
    });

    it('should reject update on non-DRAFT committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'ACTIVE',
      });

      await expect(
        service.update('comm-1', { name: 'New' }, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on committee owned by another admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.update('comm-1', { name: 'New' }, adminId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('should transition DRAFT to ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockCommitteeWithCreator, status: 'ACTIVE' },
      ]);

      const result = await service.updateStatus(
        'comm-1',
        'ACTIVE' as any,
        adminId,
      );

      expect(result.status).toBe('ACTIVE');
    });

    it('should transition ACTIVE to PAUSED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'ACTIVE',
      });
      mockPrisma.$transaction.mockResolvedValue([
        { ...mockCommitteeWithCreator, status: 'PAUSED' },
      ]);

      const result = await service.updateStatus(
        'comm-1',
        'PAUSED' as any,
        adminId,
      );

      expect(result.status).toBe('PAUSED');
    });

    it('should reject transition from COMPLETED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'COMPLETED',
      });

      await expect(
        service.updateStatus('comm-1', 'ACTIVE' as any, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from CANCELLED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'CANCELLED',
      });

      await expect(
        service.updateStatus('comm-1', 'ACTIVE' as any, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject same-status transition', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);

      await expect(
        service.updateStatus('comm-1', 'DRAFT' as any, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid transition DRAFT to COMPLETED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);

      await expect(
        service.updateStatus('comm-1', 'COMPLETED' as any, adminId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a DRAFT committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committee.delete.mockResolvedValue(mockCommittee);

      const result = await service.remove('comm-1', adminId);

      expect(result.message).toBe('Committee deleted');
      expect(mockPrisma.committee.delete).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
      });
    });

    it('should reject deletion of non-DRAFT committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'ACTIVE',
      });

      await expect(service.remove('comm-1', adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject deletion of committee owned by another admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(service.remove('comm-1', adminId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
