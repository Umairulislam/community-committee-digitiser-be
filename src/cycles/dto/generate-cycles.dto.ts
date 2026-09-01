import { IsDateString, IsOptional } from 'class-validator';

export class GenerateCyclesDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
