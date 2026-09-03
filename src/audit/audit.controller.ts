import {
  Controller,
  Get,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@Controller('committees/:committeeId/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryAuditDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.auditService.findAll(committeeId, query, user.id);
  }

  @Get('timeline')
  getTimeline(
    @Param('committeeId') committeeId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.auditService.getTimeline(committeeId, user.id);
  }
}
