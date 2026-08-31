import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InvitationStatus } from '@prisma/client';

export class QueryInvitationDto {
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

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
