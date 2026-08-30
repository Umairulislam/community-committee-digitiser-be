import { IsEnum } from 'class-validator';
import { CommitteeStatus } from '@prisma/client';

export class UpdateCommitteeStatusDto {
  @IsEnum(CommitteeStatus, {
    message: `Status must be one of: ${Object.values(CommitteeStatus).join(', ')}`,
  })
  status!: CommitteeStatus;
}
