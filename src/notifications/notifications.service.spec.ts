import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const userId = 'user-1';
  const otherUserId = 'user-2';
  const committeeId = 'comm-1';

  const mockNotification = {
    id: 'notif-1',
    userId,
    type: 'GENERAL',
    title: 'Test Notification',
    message: 'Test message',
    read: false,
    committeeId: null,
    token: null,
    createdAt: new Date(),
  };

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should create a notification for a user', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create({
        userId,
        type: 'GENERAL' as any,
        title: 'Test Notification',
        message: 'Test message',
      });

      expect(result).toEqual(mockNotification);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: 'GENERAL',
          title: 'Test Notification',
          message: 'Test message',
          committeeId: null,
          token: null,
        },
      });
    });

    it('should create a notification with committeeId', async () => {
      mockPrisma.notification.create.mockResolvedValue({
        ...mockNotification,
        committeeId,
      });

      const result = await service.create({
        userId,
        type: 'LOTTERY_COMPLETED' as any,
        title: 'Lottery Completed',
        message: 'Winner announced',
        committeeId,
      });

      expect(result.committeeId).toBe(committeeId);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ committeeId, token: null }),
      });
    });

    it('should create a notification with a token for invitation types', async () => {
      const invitationToken = 'abc123token';
      mockPrisma.notification.create.mockResolvedValue({
        ...mockNotification,
        type: 'COMMITTEE_INVITATION',
        committeeId,
        token: invitationToken,
      });

      const result = await service.create({
        userId,
        type: 'COMMITTEE_INVITATION' as any,
        title: 'Committee Invitation',
        message: 'You have been invited',
        committeeId,
        token: invitationToken,
      });

      expect(result.token).toBe(invitationToken);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ token: invitationToken }),
      });
    });

    it('should default token to null when not provided', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      await service.create({
        userId,
        type: 'GENERAL' as any,
        title: 'Test',
        message: 'Test',
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ token: null }),
      });
    });
  });

  describe('createMany', () => {
    it('should create notifications for multiple users', async () => {
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await service.createMany(
        ['user-1', 'user-2', 'user-3'],
        {
          type: 'CYCLE_STARTED' as any,
          title: 'Cycle Started',
          message: 'A new cycle has begun',
          committeeId,
        },
      );

      expect(result.count).toBe(3);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', type: 'CYCLE_STARTED' }),
          expect.objectContaining({ userId: 'user-2', type: 'CYCLE_STARTED' }),
          expect.objectContaining({ userId: 'user-3', type: 'CYCLE_STARTED' }),
        ]),
      });
    });

    it('should return count 0 for empty userIds', async () => {
      const result = await service.createMany([], {
        type: 'GENERAL' as any,
        title: 'Test',
        message: 'Test',
      });

      expect(result.count).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications with unread count', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const result = await service.findAll(userId, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by type', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0).mockResolvedValue(0);

      await service.findAll(userId, { type: 'PAYMENT_VERIFIED' });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'PAYMENT_VERIFIED' }),
        }),
      );
    });

    it('should filter by read status', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0).mockResolvedValue(0);

      await service.findAll(userId, { read: false });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ read: false }),
        }),
      );
    });

    it('should apply pagination', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0).mockResolvedValue(0);

      const result = await service.findAll(userId, { page: 2, limit: 5 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read for the owner', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.notification.update.mockResolvedValue({
        ...mockNotification,
        read: true,
      });

      const result = await service.markAsRead('notif-1', userId);

      expect(result.read).toBe(true);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('missing', userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when marking another user notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(
        service.markAsRead('notif-1', otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for the user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(userId);

      expect(result.count).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        data: { read: true },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(userId);

      expect(result.count).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread notification count', async () => {
      mockPrisma.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount(userId);

      expect(result.count).toBe(7);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId, read: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(userId);

      expect(result.count).toBe(0);
    });
  });
});
