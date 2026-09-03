import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATION_QUEUE,
  NotificationJobData,
} from '../queues/notification.processor';
import { NotificationType } from '@prisma/client';

/**
 * Scheduled jobs for automated notifications.
 * Runs daily at 9 AM to check for upcoming/overdue contributions.
 */
@Injectable()
export class NotificationScheduler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobData>,
  ) {}

  /**
   * Daily check: send reminders for contributions due within 3 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleContributionReminders(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    // Find pending contributions due within the next 3 days
    const upcomingContributions = await this.prisma.contribution.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        cycle: { select: { committeeId: true, cycleNumber: true } },
        member: { select: { userId: true } },
      },
    });

    // Group by user to send one consolidated reminder
    const userReminders = new Map<string, { count: number; committeeIds: Set<string> }>();

    for (const contrib of upcomingContributions) {
      const userId = contrib.member.userId;
      const existing = userReminders.get(userId) ?? { count: 0, committeeIds: new Set() };
      existing.count++;
      existing.committeeIds.add(contrib.cycle.committeeId);
      userReminders.set(userId, existing);
    }

    for (const [userId, data] of userReminders) {
      const committeeIds = Array.from(data.committeeIds);
      await this.notificationQueue.add(
        'send',
        {
          userIds: [userId],
          type: NotificationType.CONTRIBUTION_REMINDER,
          title: 'Contribution Reminder',
          message: `You have ${data.count} pending contribution(s) due within the next 3 days.`,
          committeeId: committeeIds[0],
        },
        {
          // Deduplicate: don't send multiple reminders for the same user on the same day
          jobId: `reminder-${userId}-${now.toISOString().split('T')[0]}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
  }

  /**
   * Daily check: send notifications for overdue contributions.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleOverdueNotifications(): Promise<void> {
    const now = new Date();

    // Find contributions that are past due but still PENDING
    const overdueContributions = await this.prisma.contribution.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: now },
        cycle: { status: { in: ['ACTIVE', 'UPCOMING'] } },
      },
      include: {
        cycle: { select: { committeeId: true, cycleNumber: true } },
        member: { select: { userId: true } },
      },
    });

    // Update status to OVERDUE
    if (overdueContributions.length > 0) {
      const ids = overdueContributions.map((c) => c.id);
      await this.prisma.contribution.updateMany({
        where: { id: { in: ids } },
        data: { status: 'OVERDUE' },
      });
    }

    // Group by user to send one consolidated notification
    const userOverdue = new Map<string, { count: number; committeeIds: Set<string> }>();

    for (const contrib of overdueContributions) {
      const userId = contrib.member.userId;
      const existing = userOverdue.get(userId) ?? { count: 0, committeeIds: new Set() };
      existing.count++;
      existing.committeeIds.add(contrib.cycle.committeeId);
      userOverdue.set(userId, existing);
    }

    for (const [userId, data] of userOverdue) {
      const committeeIds = Array.from(data.committeeIds);
      await this.notificationQueue.add(
        'send',
        {
          userIds: [userId],
          type: NotificationType.CONTRIBUTION_OVERDUE,
          title: 'Overdue Contribution',
          message: `You have ${data.count} overdue contribution(s). Please make your payment as soon as possible.`,
          committeeId: committeeIds[0],
        },
        {
          jobId: `overdue-${userId}-${now.toISOString().split('T')[0]}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
  }
}
