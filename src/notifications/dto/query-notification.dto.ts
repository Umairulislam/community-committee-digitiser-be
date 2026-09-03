import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryNotificationDto {
  @IsOptional()
  @IsEnum([
    'COMMITTEE_INVITATION',
    'COMMITTEE_STATUS_CHANGED',
    'CYCLE_STARTED',
    'CYCLE_COMPLETED',
    'CONTRIBUTION_REMINDER',
    'CONTRIBUTION_OVERDUE',
    'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED',
    'LOTTERY_COMPLETED',
    'PAYOUT_COMPLETED',
    'GENERAL',
  ])
  type?: string;

  @IsOptional()
  @Type(() => Boolean)
  read?: boolean;

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
