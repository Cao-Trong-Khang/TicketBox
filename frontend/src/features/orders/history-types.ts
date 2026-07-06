export type OrderHistoryStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export type OrderHistoryTicketLine = {
  ticketTypeName: string;
  quantity: number;
};

export type OrderHistoryItem = {
  orderId: string;
  orderCode: string;
  status: OrderHistoryStatus;
  createdAt: string;
  performanceStartAt: string;
  concertTitle: string;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  totalAmountVnd: number;
  tickets: OrderHistoryTicketLine[];
};