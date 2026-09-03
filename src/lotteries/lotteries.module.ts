import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LotteriesController } from './lotteries.controller';
import { LotteryHistoryController } from './lottery-history.controller';
import { LotteriesService } from './lotteries.service';

@Module({
  imports: [AuditModule],
  controllers: [LotteriesController, LotteryHistoryController],
  providers: [LotteriesService],
  exports: [LotteriesService],
})
export class LotteriesModule {}
