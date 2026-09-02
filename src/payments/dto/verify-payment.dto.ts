import { IsIn, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsIn(['VERIFIED', 'REJECTED'], {
    message: 'Action must be VERIFIED or REJECTED',
  })
  action!: 'VERIFIED' | 'REJECTED';
}
