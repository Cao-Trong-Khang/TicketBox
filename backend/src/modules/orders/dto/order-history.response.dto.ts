import { OrderStatus } from "@prisma/client";

export class OrderHistoryTicketLineDto {
  ticketTypeName!: string;
  quantity!: number;
}

export class OrderHistoryItemDto {
  orderId!: string;
  orderCode!: string;
  status!: OrderStatus;
  createdAt!: string;
  performanceStartAt!: string;
  concertTitle!: string;
  venueName!: string;
  venueAddress!: string | null;
  bannerUrl!: string | null;
  totalAmountVnd!: number;
  tickets!: OrderHistoryTicketLineDto[];
}
