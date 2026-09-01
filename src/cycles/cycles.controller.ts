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
import { CyclesService } from './cycles.service';
import { GenerateCyclesDto } from './dto/generate-cycles.dto';
import { UpdateCycleStatusDto } from './dto/update-cycle-status.dto';
import { QueryCycleDto } from './dto/query-cycle.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees/:committeeId/cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Post('generate')
  @UseGuards(AdminGuard)
  generate(
    @Param('committeeId') committeeId: string,
    @Body() dto: GenerateCyclesDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.cyclesService.generate(committeeId, user.id, dto.startDate);
  }

  @Get()
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryCycleDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.cyclesService.findAll(committeeId, query, user.id);
  }

  @Get(':id')
  findOne(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.cyclesService.findOne(committeeId, id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCycleStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.cyclesService.updateStatus(
      committeeId,
      id,
      dto.status,
      user.id,
    );
  }

  @Post('start-next')
  @UseGuards(AdminGuard)
  startNext(
    @Param('committeeId') committeeId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.cyclesService.startNext(committeeId, user.id);
  }
}
