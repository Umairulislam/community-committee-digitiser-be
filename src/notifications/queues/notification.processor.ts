import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '@prisma/client';

export const NOTIFICATION_QUEUE = 'notifications';

export interface NotificationJobData {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  committeeId?: string;
}

export interface SingleNotificationJobData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  committeeId?: string;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData | SingleNotificationJobData>) {
    if (job.name === 'send') {
      const data = job.data as NotificationJobData;
      const result = await this.notificationsService.createMany(data.userIds, {
        type: data.type,
        title: data.title,
        message: data.message,
        committeeId: data.committeeId,
      });
      return { sent: result.count };
    }

    if (job.name === 'send-single') {
      const data = job.data as SingleNotificationJobData;
      await this.notificationsService.create({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        committeeId: data.committeeId,
      });
      return { sent: 1 };
    }

    return { sent: 0 };
  }
}
