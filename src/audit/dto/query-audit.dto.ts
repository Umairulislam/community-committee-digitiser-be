import { IsEnum, IsInt, IsOptional, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditDto {
  @IsOptional()
  @IsEnum([
    'COMMITTEE_CREATED',
    'COMMITTEE_UPDATED',
    'COMMITTEE_STATUS_CHANGED',
    'MEMBER_INVITED',
    'MEMBER_JOINED',
    'MEMBER_REMOVED',
    'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED',
    'CONTRIBUTION_STATUS_CHANGED',
    'LOTTERY_EXECUTED',
    'PAYOUT_CREATED',
    'PAYOUT_STATUS_CHANGED',
  ])
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
