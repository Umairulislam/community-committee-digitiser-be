import { Module } from '@nestjs/common';
import { LotteriesController } from './lotteries.controller';
import { LotteryHistoryController } from './lottery-history.controller';
import { LotteriesService } from './lotteries.service';

@Module({
  controllers: [LotteriesController, LotteryHistoryController],
  providers: [LotteriesService],
  exports: [LotteriesService],
})
export class LotteriesModule {}
