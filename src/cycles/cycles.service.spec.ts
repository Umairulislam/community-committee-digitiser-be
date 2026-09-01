import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CyclesService', () => {
  let service: CyclesService;

  const adminId = 'admin-1';
  const otherAdminId = 'admin-2';
  const memberId = 'user-1';
  const committeeId = 'comm-1';

  const mockCommittee = {
    id: committeeId,
    name: 'Test Committee',
    description: null,
    contributionAmount: { toNumber: () => 10000 },
    memberLimit: 10,
    totalCycles: 5,
    payoutMethod: 'LOTTERY',
    startDate: new Date('2026-09-01'),
    dueDay: 5,
    status: 'ACTIVE',
    createdBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActiveMembers = [
    { id: 'mem-1', userId: 'user-1', status: 'ACTIVE' },
    { id: 'mem-2', userId: 'user-2', status: 'ACTIVE' },
    { id: 'mem-3', userId: 'user-3', status: 'ACTIVE' },
  ];

  const mockCycle = {
    id: 'cycle-1',
    committeeId,
    cycleNumber: 1,
    startDate: new Date('2026-09-01'),
    endDate: null,
    status: 'ACTIVE',
    totalExpected: { toNumber: () => 30000 },
    totalCollected: { toNumber: () => 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCycle2 = {
    id: 'cycle-2',
    committeeId,
    cycleNumber: 2,
    startDate: null,
    endDate: null,
    status: 'UPCOMING',
    totalExpected: { toNumber: () => 30000 },
    totalCollected: { toNumber: () => 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    committee: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    committeeMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    cycle: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CyclesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CyclesService>(CyclesService);
    jest.resetAllMocks();
  });

  describe('generate', () => {
    it('should generate cycles for an ACTIVE committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        contributionAmount: { toNumber: () => 10000 },
      });
      mockPrisma.cycle.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue(mockActiveMembers);
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) =>
        Promise.resolve(
          promises.map((_: unknown, i: number) => ({
            ...mockCycle,
            id: `cycle-${i + 1}`,
            cycleNumber: i + 1,
            status: i === 0 ? 'ACTIVE' : 'UPCOMING',
          })),
        ),
      );

      const result = await service.generate(committeeId, adminId);

      expect(result.generated).toBe(5);
      expect(result.cycles).toHaveLength(5);
      expect(result.cycles[0].status).toBe('ACTIVE');
      expect(result.cycles[1].status).toBe('UPCOMING');
    });

    it('should generate remaining cycles if some already exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        contributionAmount: { toNumber: () => 10000 },
      });
      mockPrisma.cycle.count.mockResolvedValue(3);
      mockPrisma.committeeMember.findMany.mockResolvedValue(mockActiveMembers);
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) =>
        Promise.resolve(
          promises.map((_: unknown, i: number) => ({
            ...mockCycle,
            id: `cycle-${i + 4}`,
            cycleNumber: i + 4,
            status: 'UPCOMING',
          })),
        ),
      );

      const result = await service.generate(committeeId, adminId);

      expect(result.generated).toBe(2);
    });

    it('should reject if all cycles already generated', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.count.mockResolvedValue(5);

      await expect(
        service.generate(committeeId, adminId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if committee is not ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'DRAFT',
      });

      await expect(
        service.generate(committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if committee is PAUSED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'PAUSED',
      });

      await expect(
        service.generate(committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if no active members', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        contributionAmount: { toNumber: () => 10000 },
      });
      mockPrisma.cycle.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue([]);

      await expect(
        service.generate(committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.generate(committeeId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.generate('nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate totalExpected as contributionAmount * activeMembers', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        contributionAmount: { toNumber: () => 10000 },
      });
      mockPrisma.cycle.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue(mockActiveMembers);

      const capturedData: unknown[] = [];
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) =>
        Promise.resolve(
          promises.map((_: unknown, i: number) => ({
            ...mockCycle,
            id: `cycle-${i + 1}`,
            cycleNumber: i + 1,
            status: i === 0 ? 'ACTIVE' : 'UPCOMING',
          })),
        ),
      );
      mockPrisma.cycle.create.mockImplementation((args: unknown) => {
        capturedData.push(args);
        return Promise.resolve(mockCycle);
      });

      await service.generate(committeeId, adminId);

      // 10000 * 3 active members = 30000
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should use custom startDate when provided', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        contributionAmount: { toNumber: () => 10000 },
      });
      mockPrisma.cycle.count.mockResolvedValue(0);
      mockPrisma.committeeMember.findMany.mockResolvedValue(mockActiveMembers);
      mockPrisma.$transaction.mockImplementation((promises: unknown[]) =>
        Promise.resolve(
          promises.map((_: unknown, i: number) => ({
            ...mockCycle,
            id: `cycle-${i + 1}`,
            cycleNumber: i + 1,
            status: i === 0 ? 'ACTIVE' : 'UPCOMING',
          })),
        ),
      );

      const result = await service.generate(
        committeeId,
        adminId,
        '2026-10-01',
      );

      expect(result.generated).toBe(5);
    });
  });

  describe('findAll', () => {
    it('should return paginated cycles for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([mockCycle, mockCycle2]);
      mockPrisma.cycle.count.mockResolvedValue(2);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should return cycles for committee member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });
      mockPrisma.cycle.findMany.mockResolvedValue([mockCycle]);
      mockPrisma.cycle.count.mockResolvedValue(1);

      const result = await service.findAll(committeeId, {}, memberId);

      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([mockCycle]);
      mockPrisma.cycle.count.mockResolvedValue(1);

      await service.findAll(
        committeeId,
        { status: 'ACTIVE' as any },
        adminId,
      );

      expect(mockPrisma.cycle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
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

    it('should reject access for removed member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'REMOVED',
      });

      await expect(
        service.findAll(committeeId, {}, memberId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should default to page 1 and limit 10', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([]);
      mockPrisma.cycle.count.mockResolvedValue(0);

      const result = await service.findAll(committeeId, {}, adminId);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll('nonexistent', {}, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should order cycles by cycleNumber ascending', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findMany.mockResolvedValue([mockCycle, mockCycle2]);
      mockPrisma.cycle.count.mockResolvedValue(2);

      await service.findAll(committeeId, {}, adminId);

      expect(mockPrisma.cycle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { cycleNumber: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a cycle for committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);

      const result = await service.findOne(committeeId, 'cycle-1', adminId);

      expect(result.id).toBe('cycle-1');
    });

    it('should return a cycle for committee member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: 'ACTIVE',
      });
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);

      const result = await service.findOne(committeeId, 'cycle-1', memberId);

      expect(result.id).toBe('cycle-1');
    });

    it('should throw NotFoundException for non-existent cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(committeeId, 'nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject access for non-member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(committeeId, 'cycle-1', 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('should transition ACTIVE to COMPLETED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);
      mockPrisma.cycle.update.mockResolvedValue({
        ...mockCycle,
        status: 'COMPLETED',
        endDate: expect.any(Date),
      });

      const result = await service.updateStatus(
        committeeId,
        'cycle-1',
        'COMPLETED' as any,
        adminId,
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('should transition UPCOMING to ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle2);
      mockPrisma.cycle.findFirst.mockResolvedValueOnce(mockCycle2);

      // Mock for the "check active cycle" query
      mockPrisma.cycle.findFirst
        .mockResolvedValueOnce(mockCycle2) // finding the cycle
        .mockResolvedValueOnce(null); // no other active cycle

      mockPrisma.cycle.update.mockResolvedValue({
        ...mockCycle2,
        status: 'ACTIVE',
        startDate: expect.any(Date),
      });

      const result = await service.updateStatus(
        committeeId,
        'cycle-2',
        'ACTIVE' as any,
        adminId,
      );

      expect(result.status).toBe('ACTIVE');
    });

    it('should transition UPCOMING to CANCELLED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle2);
      mockPrisma.cycle.update.mockResolvedValue({
        ...mockCycle2,
        status: 'CANCELLED',
      });

      const result = await service.updateStatus(
        committeeId,
        'cycle-2',
        'CANCELLED' as any,
        adminId,
      );

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject transition from COMPLETED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        status: 'COMPLETED',
      });

      await expect(
        service.updateStatus(
          committeeId,
          'cycle-1',
          'ACTIVE' as any,
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from CANCELLED', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle2,
        status: 'CANCELLED',
      });

      await expect(
        service.updateStatus(
          committeeId,
          'cycle-2',
          'ACTIVE' as any,
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject same-status transition', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(mockCycle);

      await expect(
        service.updateStatus(
          committeeId,
          'cycle-1',
          'ACTIVE' as any,
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject activating a cycle when another is already active', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst
        .mockResolvedValueOnce(mockCycle2) // finding the cycle to update
        .mockResolvedValueOnce(mockCycle); // another cycle is already active

      await expect(
        service.updateStatus(
          committeeId,
          'cycle-2',
          'ACTIVE' as any,
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.updateStatus(
          committeeId,
          'cycle-1',
          'COMPLETED' as any,
          adminId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          committeeId,
          'nonexistent',
          'COMPLETED' as any,
          adminId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set endDate when completing a cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue({
        ...mockCycle,
        endDate: null,
      });
      mockPrisma.cycle.update.mockResolvedValue({
        ...mockCycle,
        status: 'COMPLETED',
        endDate: new Date(),
      });

      await service.updateStatus(
        committeeId,
        'cycle-1',
        'COMPLETED' as any,
        adminId,
      );

      expect(mockPrisma.cycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            endDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('startNext', () => {
    it('should complete active cycle and activate next upcoming cycle', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst
        .mockResolvedValueOnce(mockCycle)  // active cycle
        .mockResolvedValueOnce(mockCycle2); // next upcoming cycle

      mockPrisma.$transaction.mockResolvedValue([
        { ...mockCycle, status: 'COMPLETED', endDate: new Date() },
        { ...mockCycle2, status: 'ACTIVE', startDate: new Date() },
      ]);

      const result = await service.startNext(committeeId, adminId);

      expect(result.completed).toBeTruthy();
      expect(result.activated).toBeTruthy();
      expect(result.committeeCompleted).toBe(false);
    });

    it('should complete committee when no more upcoming cycles', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst
        .mockResolvedValueOnce(mockCycle) // active cycle
        .mockResolvedValueOnce(null);     // no upcoming cycle

      mockPrisma.cycle.update.mockResolvedValue({
        ...mockCycle,
        status: 'COMPLETED',
        endDate: new Date(),
      });
      mockPrisma.committee.update.mockResolvedValue({
        ...mockCommittee,
        status: 'COMPLETED',
      });

      const result = await service.startNext(committeeId, adminId);

      expect(result.completed).toBeTruthy();
      expect(result.activated).toBeNull();
      expect(result.committeeCompleted).toBe(true);
      expect(mockPrisma.committee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('should reject if committee is not ACTIVE', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        status: 'PAUSED',
      });

      await expect(
        service.startNext(committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if no active cycle exists', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.startNext(committeeId, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not committee admin', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue({
        ...mockCommittee,
        createdBy: otherAdminId,
      });

      await expect(
        service.startNext(committeeId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);

      await expect(
        service.startNext('nonexistent', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use atomic transaction when transitioning cycles', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.cycle.findFirst
        .mockResolvedValueOnce(mockCycle)
        .mockResolvedValueOnce(mockCycle2);

      mockPrisma.$transaction.mockResolvedValue([
        { ...mockCycle, status: 'COMPLETED', endDate: new Date() },
        { ...mockCycle2, status: 'ACTIVE', startDate: new Date() },
      ]);

      await service.startNext(committeeId, adminId);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
