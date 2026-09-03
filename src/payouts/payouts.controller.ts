import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PayoutsService } from './payouts.service';
import { UpdatePayoutStatusDto } from './dto/update-payout-status.dto';
import { QueryPayoutDto } from './dto/query-payout.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees/:committeeId/cycles/:cycleId/payout')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.payoutsService.create(committeeId, cycleId, user.id);
  }

  @Get()
  findByCycle(
    @Param('committeeId') committeeId: string,
    @Param('cycleId') cycleId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.payoutsService.findByCycle(committeeId, cycleId, user.id);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePayoutStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.payoutsService.updateStatus(
      committeeId,
      id,
      dto,
      user.id,
    );
  }
}

@Controller('committees/:committeeId/payouts')
export class CommitteePayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryPayoutDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.payoutsService.findAll(committeeId, query, user.id);
  }
}

@Controller('my-payouts')
export class MyPayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  getMyPayouts(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.payoutsService.getMyPayouts(user.id);
  }
}
