import { apiFetch } from '../../lib/api-client';
import { OrganizerConcertListItem } from './types';

export function getOrganizerConcerts(): Promise<OrganizerConcertListItem[]> {
  return apiFetch<OrganizerConcertListItem[]>('/organizer/concerts');
}
