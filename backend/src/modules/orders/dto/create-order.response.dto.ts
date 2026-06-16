import { OrderStatus } from '@prisma/client';

export class CreateOrderResponseDto {
  orderId!: string;
  orderCode!: string;
  status!: OrderStatus;
  totalAmountVnd!: number;
  expiresAt!: string;
}
