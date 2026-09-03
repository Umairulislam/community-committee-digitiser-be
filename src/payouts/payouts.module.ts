import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  PayoutsController,
  CommitteePayoutsController,
  MyPayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [PayoutsController, CommitteePayoutsController, MyPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
