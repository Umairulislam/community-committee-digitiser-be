import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CommitteesService } from './committees.service';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { UpdateCommitteeDto } from './dto/update-committee.dto';
import { UpdateCommitteeStatusDto } from './dto/update-committee-status.dto';
import { QueryCommitteeDto } from './dto/query-committee.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('committees')
@UseGuards(AdminGuard)
export class CommitteesController {
  constructor(private readonly committeesService: CommitteesService) {}

  @Post()
  create(@Body() dto: CreateCommitteeDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.committeesService.create(dto, user.id);
  }

  @Get()
  findAll(@Query() query: QueryCommitteeDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.committeesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.committeesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommitteeDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.committeesService.update(id, dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCommitteeStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.committeesService.updateStatus(id, dto.status, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.committeesService.remove(id, user.id);
  }
}
