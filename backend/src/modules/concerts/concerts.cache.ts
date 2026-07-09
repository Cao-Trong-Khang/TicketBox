export const PUBLIC_CONCERTS_CACHE_KEY = "concerts:list:published";
export const PUBLIC_CONCERTS_CACHE_TTL_SECONDS = 60;
export const PUBLIC_CONCERT_DETAIL_CACHE_TTL_SECONDS = 300;
export const PUBLIC_TICKET_TYPES_CACHE_TTL_SECONDS = 5;

export function getPublicConcertDetailCacheKey(concertId: string): string {
  return `concerts:detail:${concertId}`;
}

export function getPublicTicketTypesCacheKey(concertId: string): string {
  return `concerts:${concertId}:ticket-types`;
}
