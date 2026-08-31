import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiresAfterDays?: number;
}
