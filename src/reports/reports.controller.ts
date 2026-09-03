import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';
import { toCsv } from './utils/csv.util';

@Controller('committees/:committeeId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getCommitteeSummary(
    @Param('committeeId') committeeId: string,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getCommitteeSummary(committeeId, user.id);
  }

  @Get('summary/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="committee-summary.csv"')
  async getCommitteeSummaryCsv(
    @Param('committeeId') committeeId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const data = await this.reportsService.getCommitteeSummary(
      committeeId,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="committee-summary.csv"',
    );
    res.send(toCsv([data]));
  }

  @Get('contributions')
  getContributionSummary(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getContributionSummary(
      committeeId,
      query,
      user.id,
    );
  }

  @Get('contributions/csv')
  async getContributionSummaryCsv(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const result = await this.reportsService.getContributionSummary(
      committeeId,
      query,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="contribution-summary.csv"',
    );
    res.send(toCsv(result.data as Record<string, unknown>[]));
  }

  @Get('outstanding')
  getOutstandingPayments(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getOutstandingPayments(
      committeeId,
      query,
      user.id,
    );
  }

  @Get('outstanding/csv')
  async getOutstandingPaymentsCsv(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const result = await this.reportsService.getOutstandingPayments(
      committeeId,
      query,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="outstanding-payments.csv"',
    );
    res.send(toCsv(result.data));
  }

  @Get('cycles')
  getCycleCompletionSummary(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getCycleCompletionSummary(
      committeeId,
      query,
      user.id,
    );
  }

  @Get('cycles/csv')
  async getCycleCompletionSummaryCsv(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const result = await this.reportsService.getCycleCompletionSummary(
      committeeId,
      query,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cycle-completion-summary.csv"',
    );
    res.send(toCsv(result.data as Record<string, unknown>[]));
  }

  @Get('lottery-payouts')
  getLotteryPayoutSummary(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getLotteryPayoutSummary(
      committeeId,
      query,
      user.id,
    );
  }

  @Get('lottery-payouts/csv')
  async getLotteryPayoutSummaryCsv(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const result = await this.reportsService.getLotteryPayoutSummary(
      committeeId,
      query,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="lottery-payout-summary.csv"',
    );
    res.send(toCsv(result.data as Record<string, unknown>[]));
  }

  @Get('members')
  getMemberParticipationSummary(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.reportsService.getMemberParticipationSummary(
      committeeId,
      query,
      user.id,
    );
  }

  @Get('members/csv')
  async getMemberParticipationSummaryCsv(
    @Param('committeeId') committeeId: string,
    @Query() query: QueryReportDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as { id: string };
    const result = await this.reportsService.getMemberParticipationSummary(
      committeeId,
      query,
      user.id,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="member-participation-summary.csv"',
    );
    res.send(toCsv(result.data as Record<string, unknown>[]));
  }
}
