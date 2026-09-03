import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const userId = 'user-1';
  const mockReq = { user: { id: userId } };

  const mockNotificationsService = {
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.resetAllMocks();
  });

  describe('findAll', () => {
    it('should return notifications for the authenticated user', async () => {
      const expectedResult = {
        data: [{ id: 'notif-1', title: 'Test' }],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 20,
      };
      mockNotificationsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll({}, mockReq as any);

      expect(result).toEqual(expectedResult);
      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(userId, {});
    });

    it('should pass query parameters to the service', async () => {
      mockNotificationsService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        unreadCount: 0,
        page: 1,
        limit: 20,
      });

      await controller.findAll({ type: 'PAYMENT_VERIFIED', read: false } as any, mockReq as any);

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(userId, {
        type: 'PAYMENT_VERIFIED',
        read: false,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for the authenticated user', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue({ count: 5 });

      const result = await controller.getUnreadCount(mockReq as any);

      expect(result).toEqual({ count: 5 });
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(userId);
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({
        id: 'notif-1',
        read: true,
      });

      const result = await controller.markAsRead('notif-1', mockReq as any);

      expect(result).toEqual({ id: 'notif-1', read: true });
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith('notif-1', userId);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for the authenticated user', async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({ count: 10 });

      const result = await controller.markAllAsRead(mockReq as any);

      expect(result).toEqual({ count: 10 });
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(userId);
    });
  });
});
