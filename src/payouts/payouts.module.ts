import { Module } from '@nestjs/common';
import {
  PayoutsController,
  CommitteePayoutsController,
  MyPayoutsController,
} from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  controllers: [PayoutsController, CommitteePayoutsController, MyPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
