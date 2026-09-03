import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { LotteriesService } from './lotteries.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees/:committeeId/cycles/:cycleId/lottery')
export class LotteriesController {
  constructor(private readonly lotteriesService: LotteriesService) {}

  @Get('eligibility')
  getEligibility(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.lotteriesService.getEligibility(
      committeeId,
      cycleId,
      user.id,
    );
  }

  @Get('eligible-members')
  getEligibleMembers(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.lotteriesService.getEligibleMembers(
      committeeId,
      cycleId,
      user.id,
    );
  }

  @Post('run')
  @UseGuards(AdminGuard)
  run(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.lotteriesService.run(committeeId, cycleId, user.id);
  }

  @Get('result')
  getResult(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.lotteriesService.getResult(committeeId, cycleId, user.id);
  }
}
