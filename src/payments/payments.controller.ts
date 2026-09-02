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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees/:committeeId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  record(
    @Param('committeeId') committeeId: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.paymentsService.create(committeeId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryPaymentDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.paymentsService.findAll(committeeId, query, user.id);
  }

  @Get(':id')
  findOne(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.paymentsService.findOne(committeeId, id, user.id);
  }

  @Post(':id/verify')
  @UseGuards(AdminGuard)
  verify(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.paymentsService.verify(committeeId, id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(AdminGuard)
  reject(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.paymentsService.reject(committeeId, id, user.id);
  }
}
