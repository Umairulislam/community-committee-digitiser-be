import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommitteesController } from './committees.controller';
import { CommitteesService } from './committees.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [CommitteesController],
  providers: [CommitteesService],
  exports: [CommitteesService],
})
export class CommitteesModule {}
