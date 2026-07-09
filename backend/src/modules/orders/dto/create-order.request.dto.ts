import { IsUUID, IsArray, ValidateNested, IsPositive, IsInt, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemRequestDto {
  @IsUUID('4')
  ticketTypeId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderRequestDto {
  @IsUUID('4')
  concertId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemRequestDto)
  items!: CreateOrderItemRequestDto[];

  @IsUUID('4')
  idempotencyKey!: string;
}
