import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Query() query: QueryNotificationDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.notificationsService.findAll(user.id, query);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.notificationsService.markAllAsRead(user.id);
  }
}
