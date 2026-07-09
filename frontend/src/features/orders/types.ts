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
  status: 'PENDING';
  totalAmountVnd: number;
  expiresAt: string;
};
