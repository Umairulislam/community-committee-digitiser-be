import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @nestjs/bullmq to avoid ESM parsing issues in Jest
const mockQueue = { add: jest.fn() };

jest.mock('@nestjs/bullmq', () => ({
  Processor: () => (target: any) => target,
  WorkerHost: class {
    async process() {
      return {};
    }
  },
  InjectQueue: () => (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    // This is handled by the provider token below
  },
  getQueueToken: (name: string) => `BullQueue_${name}`,
}));

import { NotificationScheduler } from './notification.scheduler';

describe('NotificationScheduler', () => {
  let scheduler: NotificationScheduler;

  const mockContribution = {
    id: 'contrib-1',
    cycleId: 'cycle-1',
    memberId: 'mem-1',
    status: 'PENDING',
    dueDate: new Date(),
    cycle: { committeeId: 'comm-1', cycleNumber: 1 },
    member: { userId: 'user-1' },
  };

  const mockPrisma = {
    contribution: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Manually construct the scheduler with injected mocks
    scheduler = new NotificationScheduler(mockPrisma as any, mockQueue as any);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleContributionReminders', () => {
    it('should queue reminder notifications for upcoming contributions', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        mockContribution,
        { ...mockContribution, id: 'contrib-2', member: { userId: 'user-2' } },
      ]);
      mockQueue.add.mockResolvedValue({});

      await scheduler.handleContributionReminders();

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'CONTRIBUTION_REMINDER',
          title: 'Contribution Reminder',
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('reminder-'),
          removeOnComplete: true,
          removeOnFail: true,
        }),
      );
    });

    it('should consolidate multiple contributions per user', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([
        mockContribution,
        { ...mockContribution, id: 'contrib-2' }, // same user
      ]);
      mockQueue.add.mockResolvedValue({});

      await scheduler.handleContributionReminders();

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          message: expect.stringContaining('2 pending contribution'),
        }),
        expect.any(Object),
      );
    });

    it('should not queue anything when no upcoming contributions', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      await scheduler.handleContributionReminders();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('handleOverdueNotifications', () => {
    it('should mark overdue contributions and queue notifications', async () => {
      const overdueContribution = {
        ...mockContribution,
        dueDate: new Date(Date.now() - 86400000),
      };
      mockPrisma.contribution.findMany.mockResolvedValue([overdueContribution]);
      mockPrisma.contribution.updateMany.mockResolvedValue({ count: 1 });
      mockQueue.add.mockResolvedValue({});

      await scheduler.handleOverdueNotifications();

      expect(mockPrisma.contribution.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [overdueContribution.id] } },
        data: { status: 'OVERDUE' },
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          type: 'CONTRIBUTION_OVERDUE',
          title: 'Overdue Contribution',
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('overdue-'),
        }),
      );
    });

    it('should not update or queue when no overdue contributions', async () => {
      mockPrisma.contribution.findMany.mockResolvedValue([]);

      await scheduler.handleOverdueNotifications();

      expect(mockPrisma.contribution.updateMany).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});
