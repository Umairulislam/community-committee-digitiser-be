import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for a user.
   */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    committeeId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        committeeId: params.committeeId ?? null,
      },
    });
  }

  /**
   * Create notifications for multiple users (e.g., all committee members).
   */
  async createMany(
    userIds: string[],
    params: {
      type: NotificationType;
      title: string;
      message: string;
      committeeId?: string;
    },
  ): Promise<{ count: number }> {
    if (userIds.length === 0) return { count: 0 };

    const data = userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      committeeId: params.committeeId ?? null,
    }));

    const result = await this.prisma.notification.createMany({ data });
    return { count: result.count };
  }

  /**
   * Get notifications for the authenticated user.
   */
  async findAll(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{
    data: unknown[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.type) {
      where.type = query.type as NotificationType;
    }
    if (query.read !== undefined) {
      where.read = query.read;
    }

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You can only mark your own notifications as read',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read for the authenticated user.
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { count: result.count };
  }

  /**
   * Get unread count for the authenticated user.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    return { count };
  }
}
