import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePayoutStatusDto {
  @IsIn(['PROCESSING', 'COMPLETED', 'FAILED'], {
    message: 'Status must be PROCESSING, COMPLETED, or FAILED',
  })
  status!: 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}
