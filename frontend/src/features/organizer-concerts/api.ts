import { apiFetch } from '../../lib/api-client';
import {
  OrganizerConcertDetail,
  OrganizerConcertListItem,
  OrganizerConcertPayload,
} from './types';

export function getOrganizerConcerts(): Promise<OrganizerConcertListItem[]> {
  return apiFetch<OrganizerConcertListItem[]>('/organizer/concerts');
}

export function createOrganizerConcert(
  input: OrganizerConcertPayload,
): Promise<OrganizerConcertDetail> {
  return apiFetch<OrganizerConcertDetail>('/organizer/concerts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getOrganizerConcertDetail(
  id: string,
): Promise<OrganizerConcertDetail> {
  return apiFetch<OrganizerConcertDetail>(`/organizer/concerts/${id}`);
}

export function updateOrganizerConcert(
  id: string,
  input: OrganizerConcertPayload,
): Promise<OrganizerConcertDetail> {
  return apiFetch<OrganizerConcertDetail>(`/organizer/concerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishOrganizerConcert(
  id: string,
): Promise<OrganizerConcertDetail> {
  return apiFetch<OrganizerConcertDetail>(`/organizer/concerts/${id}/publish`, {
    method: 'POST',
  });
}
