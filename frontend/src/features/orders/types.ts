export type CreateOrderItemRequest = {
  ticketTypeId: string;
  quantity: number;
};

export type CreateOrderRequest = {
  concertId: string;
  idempotencyKey: string;
  items: CreateOrderItemRequest[];
};

export type CreateOrderResponse = {
  orderId: string;
  orderCode: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  totalAmountVnd: number;
  expiresAt: string;
};
