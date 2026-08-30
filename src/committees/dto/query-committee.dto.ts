import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CommitteeStatus } from '@prisma/client';

export class QueryCommitteeDto {
  @IsOptional()
  @IsEnum(CommitteeStatus)
  status?: CommitteeStatus;

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
