import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';

// Mock @nestjs/bullmq to avoid ESM parsing issues in Jest
jest.mock('@nestjs/bullmq', () => ({
  Processor: () => (target: any) => target,
  WorkerHost: class {
    async process() {
      return {};
    }
  },
  InjectQueue: () => () => undefined,
  getQueueToken: (name: string) => `BullQueue_${name}`,
}));

import { NotificationProcessor } from './notification.processor';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  const mockNotificationsService = {
    create: jest.fn(),
    createMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process "send" job', () => {
    it('should create notifications for multiple users', async () => {
      mockNotificationsService.createMany.mockResolvedValue({ count: 2 });

      const job = {
        name: 'send',
        data: {
          userIds: ['user-1', 'user-2'],
          type: 'LOTTERY_COMPLETED',
          title: 'Lottery Completed',
          message: 'Winner announced',
          committeeId: 'comm-1',
        },
      } as any;

      const result = await processor.process(job);

      expect(result).toEqual({ sent: 2 });
      expect(mockNotificationsService.createMany).toHaveBeenCalledWith(
        ['user-1', 'user-2'],
        expect.objectContaining({
          type: 'LOTTERY_COMPLETED',
          title: 'Lottery Completed',
        }),
      );
    });
  });

  describe('process "send-single" job', () => {
    it('should create a notification for a single user', async () => {
      mockNotificationsService.create.mockResolvedValue({ id: 'notif-1' });

      const job = {
        name: 'send-single',
        data: {
          userId: 'user-1',
          type: 'PAYMENT_VERIFIED',
          title: 'Payment Verified',
          message: 'Your payment was verified',
          committeeId: 'comm-1',
        },
      } as any;

      const result = await processor.process(job);

      expect(result).toEqual({ sent: 1 });
      expect(mockNotificationsService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'PAYMENT_VERIFIED',
        title: 'Payment Verified',
        message: 'Your payment was verified',
        committeeId: 'comm-1',
      });
    });
  });

  describe('process unknown job', () => {
    it('should return sent 0 for unknown job names', async () => {
      const job = { name: 'unknown', data: {} } as any;

      const result = await processor.process(job);

      expect(result).toEqual({ sent: 0 });
    });
  });
});
