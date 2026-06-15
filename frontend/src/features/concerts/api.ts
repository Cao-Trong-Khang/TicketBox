import { apiFetch } from '../../lib/api-client';
import { Concert, GetConcertsResponse } from './types';

export function getConcerts(): Promise<GetConcertsResponse> {
  return apiFetch<Concert[]>('/concerts');
}

export function formatConcertDate(isoString: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(isoString));
}

export function formatPrice(priceVnd: number | null): string {
  if (priceVnd === null) {
    return 'Đang cập nhật';
  }

  return `Từ ${priceVnd.toLocaleString('vi-VN')} ₫`;
}
