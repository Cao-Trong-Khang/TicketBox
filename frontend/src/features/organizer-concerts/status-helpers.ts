import { OrganizerConcertListItem, OrganizerConcertRevenueConcert } from './types';

type OrganizerConcertStatusLike = Pick<
  OrganizerConcertListItem | OrganizerConcertRevenueConcert,
  'status' | 'lifecycleStatus'
>;

export function canEditConcert(concert: OrganizerConcertListItem): boolean {
  return concert.status !== 'CANCELLED' && concert.lifecycleStatus === 'UPCOMING';
}

export function canCancelConcert(concert: OrganizerConcertListItem): boolean {
  return concert.status !== 'CANCELLED' && concert.lifecycleStatus === 'UPCOMING';
}

export function getOrganizerStatusLabel(concert: OrganizerConcertStatusLike): string {
  if (concert.status === 'CANCELLED') {
    return 'Đã hủy';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'Đang diễn ra';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'Đã kết thúc';
  }

  return 'Sắp diễn ra';
}

export function getOrganizerStatusVariant(concert: OrganizerConcertStatusLike): string {
  if (concert.status === 'CANCELLED') {
    return 'cancelled';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'ongoing';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'ended';
  }

  return 'upcoming';
}
