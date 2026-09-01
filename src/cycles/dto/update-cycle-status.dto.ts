import { IsEnum } from 'class-validator';
import { CycleStatus } from '@prisma/client';

export class UpdateCycleStatusDto {
  @IsEnum(CycleStatus, {
    message: `Status must be one of: ${Object.values(CycleStatus).join(', ')}`,
  })
  status!: CycleStatus;
}
