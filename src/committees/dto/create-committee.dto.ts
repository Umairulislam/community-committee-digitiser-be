import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCommitteeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  contributionAmount!: number;

  @IsInt()
  @Min(2)
  memberLimit!: number;

  @IsInt()
  @Min(1)
  totalCycles!: number;

  @IsDateString()
  startDate!: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;
}
