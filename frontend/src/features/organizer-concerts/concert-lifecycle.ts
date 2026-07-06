import { OrganizerConcertDetail } from './types';

export function isOrganizerConcertReadonly(concert: OrganizerConcertDetail): boolean {
  return concert.status === 'CANCELLED' || concert.lifecycleStatus !== 'UPCOMING';
}

