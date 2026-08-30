import { Test, TestingModule } from '@nestjs/testing';
import { CommitteesController } from './committees.controller';
import { CommitteesService } from './committees.service';

describe('CommitteesController', () => {
  let controller: CommitteesController;
  let service: CommitteesService;

  const adminUser = { id: 'admin-1', role: 'ADMIN' };

  const mockCommittee = {
    id: 'comm-1',
    name: 'Family Committee',
    description: null,
    contributionAmount: 10000,
    memberLimit: 10,
    totalCycles: 10,
    payoutMethod: 'LOTTERY',
    startDate: new Date('2026-09-01'),
    dueDay: 5,
    status: 'DRAFT',
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue(mockCommittee),
      findAll: jest.fn().mockResolvedValue({
        data: [mockCommittee],
        total: 1,
        page: 1,
        limit: 10,
      }),
      findOne: jest.fn().mockResolvedValue(mockCommittee),
      update: jest.fn().mockResolvedValue({
        ...mockCommittee,
        name: 'Updated',
      }),
      updateStatus: jest.fn().mockResolvedValue({
        ...mockCommittee,
        status: 'ACTIVE',
      }),
      remove: jest.fn().mockResolvedValue({ message: 'Committee deleted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommitteesController],
      providers: [
        { provide: CommitteesService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<CommitteesController>(CommitteesController);
    service = module.get<CommitteesService>(CommitteesService);
  });

  const mockReq = (user = adminUser) => ({ user } as any);

  describe('POST /committees', () => {
    it('should create a committee', async () => {
      const dto = {
        name: 'Family Committee',
        contributionAmount: 10000,
        memberLimit: 10,
        totalCycles: 10,
        startDate: '2026-09-01',
        dueDay: 5,
      };

      const result = await controller.create(dto, mockReq());

      expect(result.name).toBe('Family Committee');
      expect(service.create).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  describe('GET /committees', () => {
    it('should return paginated committees', async () => {
      const result = await controller.findAll({}, mockReq());

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /committees/:id', () => {
    it('should return a single committee', async () => {
      const result = await controller.findOne('comm-1', mockReq());

      expect(result.id).toBe('comm-1');
      expect(service.findOne).toHaveBeenCalledWith('comm-1', 'admin-1');
    });
  });

  describe('PATCH /committees/:id', () => {
    it('should update a committee', async () => {
      const result = await controller.update(
        'comm-1',
        { name: 'Updated' },
        mockReq(),
      );

      expect(result.name).toBe('Updated');
      expect(service.update).toHaveBeenCalledWith(
        'comm-1',
        { name: 'Updated' },
        'admin-1',
      );
    });
  });

  describe('PATCH /committees/:id/status', () => {
    it('should update committee status', async () => {
      const result = await controller.updateStatus(
        'comm-1',
        { status: 'ACTIVE' as any },
        mockReq(),
      );

      expect(result.status).toBe('ACTIVE');
      expect(service.updateStatus).toHaveBeenCalledWith(
        'comm-1',
        'ACTIVE',
        'admin-1',
      );
    });
  });

  describe('DELETE /committees/:id', () => {
    it('should delete a DRAFT committee', async () => {
      const result = await controller.remove('comm-1', mockReq());

      expect(result.message).toBe('Committee deleted');
      expect(service.remove).toHaveBeenCalledWith('comm-1', 'admin-1');
    });
  });
});
