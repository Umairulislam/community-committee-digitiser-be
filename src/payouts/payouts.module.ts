import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  PayoutsController,
  CommitteePayoutsController,
  MyPayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [AuditModule],
  controllers: [PayoutsController, CommitteePayoutsController, MyPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
