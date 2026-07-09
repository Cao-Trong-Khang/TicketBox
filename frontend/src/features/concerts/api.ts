import { apiFetch } from '../../lib/api-client';
import { Concert, ConcertDetail, GetConcertsResponse, TicketType } from './types';

export function getConcerts(): Promise<GetConcertsResponse> {
  return apiFetch<Concert[]>('/concerts');
}

export function getConcertDetail(id: string): Promise<ConcertDetail> {
  return apiFetch<ConcertDetail>(`/concerts/${id}`);
}

export function getConcertTicketTypes(id: string): Promise<TicketType[]> {
  return apiFetch<TicketType[]>(`/concerts/${id}/ticket-types`);
}

export function formatConcertDate(isoString?: string | null): string {
  if (!isoString) return 'Đang cập nhật';

  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    return 'Đang cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export function formatPrice(priceVnd: number | null): string {
  if (priceVnd === null) {
    return 'Đang cập nhật';
  }

  return `Từ ${priceVnd.toLocaleString('vi-VN')} ₫`;
}

export function formatVnd(priceVnd: number): string {
  return `${priceVnd.toLocaleString('vi-VN')} ₫`;
}
