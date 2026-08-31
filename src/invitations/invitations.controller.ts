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
import { InvitationsService } from './invitations.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { QueryInvitationDto } from './dto/query-invitation.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('committees/:committeeId/invitations')
  @UseGuards(AdminGuard)
  create(
    @Param('committeeId') committeeId: string,
    @Body() dto: InviteMemberDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.invitationsService.create(committeeId, dto, user.id);
  }

  @Get('committees/:committeeId/invitations')
  @UseGuards(AdminGuard)
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryInvitationDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.invitationsService.findAll(committeeId, query, user.id);
  }

  @Get('committees/:committeeId/invitations/:id')
  @UseGuards(AdminGuard)
  findOne(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.invitationsService.findOne(id, committeeId, user.id);
  }

  @Post('invitations/accept')
  accept(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.invitationsService.accept(dto.token, user.id);
  }

  @Post('committees/:committeeId/invitations/:id/cancel')
  @UseGuards(AdminGuard)
  cancel(
    @Param('committeeId') committeeId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.invitationsService.cancel(id, committeeId, user.id);
  }
}
