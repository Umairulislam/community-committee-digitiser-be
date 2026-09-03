import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { LotteriesService } from './lotteries.service';

@Controller('committees/:committeeId/lotteries')
export class LotteryHistoryController {
  constructor(private readonly lotteriesService: LotteriesService) {}

  @Get()
  getHistory(
    @Param('committeeId') committeeId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.lotteriesService.getHistory(committeeId, user.id);
  }
}
