import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ContributionsService } from './contributions.service';
import { QueryContributionDto } from './dto/query-contribution.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees/:committeeId/cycles/:cycleId/contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('generate')
  @UseGuards(AdminGuard)
  generate(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.contributionsService.generate(committeeId, cycleId, user.id);
  }

  @Get('summary')
  getSummary(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.contributionsService.getSummary(
      committeeId,
      cycleId,
      user.id,
    );
  }

  @Get()
  findAll(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Query() query: QueryContributionDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.contributionsService.findAll(
      committeeId,
      cycleId,
      query,
      user.id,
    );
  }

  @Get(':id')
  findOne(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.contributionsService.findOne(
      committeeId,
      cycleId,
      id,
      user.id,
    );
  }

  @Post('mark-overdue')
  @UseGuards(AdminGuard)
  markOverdue(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.contributionsService.markOverdue(
      committeeId,
      cycleId,
      user.id,
    );
  }
}
