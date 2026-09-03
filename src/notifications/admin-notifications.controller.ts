import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, SendCommitteeNotificationDto } from './dto/create-notification.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin controller for sending notifications to committee members.
 * The global JwtAuthGuard ensures authentication; the controller
 * validates committee ownership internally.
 */
@Controller('committees/:committeeId/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async sendToCommittee(
    @Param('committeeId') committeeId: string,
    @Body() dto: SendCommitteeNotificationDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };

    // Verify admin owns this committee
    const committee = await this.prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (!committee) {
      throw new NotFoundException('Committee not found');
    }

    if (committee.createdBy !== user.id) {
      throw new ForbiddenException(
        'Only the committee admin can send notifications',
      );
    }

    // Get all active members of the committee
    const members = await this.prisma.committeeMember.findMany({
      where: { committeeId, status: { in: ['ACTIVE', 'INVITED'] } },
      select: { userId: true },
    });

    const userIds = members.map((m) => m.userId);

    // Include the admin themselves if they're also a member
    if (!userIds.includes(user.id)) {
      userIds.push(user.id);
    }

    const result = await this.notificationsService.createMany(userIds, {
      type: (dto.type as any) ?? 'GENERAL',
      title: dto.title,
      message: dto.message,
      committeeId,
    });

    return { sent: result.count };
  }
}
