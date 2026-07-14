import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID() orderId!: string;
  @IsIn(['vnpay', 'momo']) provider!: 'vnpay' | 'momo';
  @IsString() @IsNotEmpty() @MaxLength(200) idempotencyKey!: string;
}
