import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

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

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  committeeId?: string;
}

/**
 * DTO for admin sending notifications to committee members.
 * Only title, message, and optional type are required.
 */
export class SendCommitteeNotificationDto {
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

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message!: string;
}
