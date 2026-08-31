import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { MembersService } from './members.service';
import { QueryMemberDto } from './dto/query-member.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('committees/my-committees')
  getMyCommittees(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.membersService.getMyCommittees(user.id);
  }

  @Get('committees/:committeeId/members')
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryMemberDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.membersService.findAll(committeeId, query, user.id);
  }

  @Get('committees/:committeeId/members/:id')
  findOne(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.membersService.findOne(id, committeeId, user.id);
  }

  @Delete('committees/:committeeId/members/:id')
  @UseGuards(AdminGuard)
  remove(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.membersService.remove(id, committeeId, user.id);
  }
}
