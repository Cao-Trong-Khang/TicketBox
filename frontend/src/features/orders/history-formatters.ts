import { OrderHistoryItem, OrderHistoryStatus, OrderHistoryTicketLine } from './history-types';

const STATUS_LABELS: Record<OrderHistoryStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
};

export function formatOrderHistoryAmount(totalAmountVnd: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(totalAmountVnd);
}

export function formatOrderHistoryDate(isoString: string): string {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return 'Đang cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export function getOrderHistoryStatusLabel(status: OrderHistoryStatus): string {
  return STATUS_LABELS[status];
}

export function formatOrderHistoryTicketSummary(tickets: OrderHistoryTicketLine[]): string {
  const totalTickets = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

  if (totalTickets === 0) {
    return '0 vé';
  }

  const details = tickets
    .map((ticket) => `${ticket.quantity} vé ${ticket.ticketTypeName}`)
    .join(' · ');

  return `${totalTickets} vé${details ? ` · ${details}` : ''}`;
}

export function formatOrderHistoryVenue(order: OrderHistoryItem): string {
  return order.venueAddress ? `${order.venueName}, ${order.venueAddress}` : order.venueName;
}