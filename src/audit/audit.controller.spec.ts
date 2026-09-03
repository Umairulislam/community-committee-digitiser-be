import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;

  const mockUser = { id: 'admin-1' };
  const mockReq = { user: mockUser } as any;
  const committeeId = 'comm-1';

  const mockAuditService = {
    findAll: jest.fn(),
    getTimeline: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    jest.resetAllMocks();
  });

  describe('GET /committees/:committeeId/audit-logs', () => {
    it('should return paginated audit logs', async () => {
      const expectedResult = { data: [], total: 0, page: 1, limit: 25 };
      mockAuditService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(committeeId, {}, mockReq);

      expect(result).toEqual(expectedResult);
      expect(mockAuditService.findAll).toHaveBeenCalledWith(
        committeeId,
        {},
        mockUser.id,
      );
    });

    it('should pass query filters to the service', async () => {
      mockAuditService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

      await controller.findAll(
        committeeId,
        { action: 'PAYMENT_VERIFIED', page: 2, limit: 10 },
        mockReq,
      );

      expect(mockAuditService.findAll).toHaveBeenCalledWith(
        committeeId,
        { action: 'PAYMENT_VERIFIED', page: 2, limit: 10 },
        mockUser.id,
      );
    });
  });

  describe('GET /committees/:committeeId/audit-logs/timeline', () => {
    it('should return the audit timeline', async () => {
      const expectedResult = { data: [{ id: 'audit-1' }], total: 1 };
      mockAuditService.getTimeline.mockResolvedValue(expectedResult);

      const result = await controller.getTimeline(committeeId, mockReq);

      expect(result).toEqual(expectedResult);
      expect(mockAuditService.getTimeline).toHaveBeenCalledWith(
        committeeId,
        mockUser.id,
      );
    });
  });
});
