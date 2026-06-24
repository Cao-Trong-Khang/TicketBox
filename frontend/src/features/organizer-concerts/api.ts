import { apiFetch } from '../../lib/api-client';
import {
  OrganizerConcertDetail,
  OrganizerConcertListItem,
  OrganizerConcertPayload,
  OrganizerTicketType,
  OrganizerTicketTypePayload,
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

export function getOrganizerTicketTypes(
  concertId: string,
): Promise<OrganizerTicketType[]> {
  return apiFetch<OrganizerTicketType[]>(`/organizer/concerts/${concertId}/ticket-types`);
}

export function createOrganizerTicketType(
  concertId: string,
  input: OrganizerTicketTypePayload,
): Promise<OrganizerTicketType> {
  return apiFetch<OrganizerTicketType>(`/organizer/concerts/${concertId}/ticket-types`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOrganizerTicketType(
  concertId: string,
  ticketTypeId: string,
  input: OrganizerTicketTypePayload,
): Promise<OrganizerTicketType> {
  return apiFetch<OrganizerTicketType>(
    `/organizer/concerts/${concertId}/ticket-types/${ticketTypeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function activateOrganizerTicketType(
  concertId: string,
  ticketTypeId: string,
): Promise<OrganizerTicketType> {
  return apiFetch<OrganizerTicketType>(
    `/organizer/concerts/${concertId}/ticket-types/${ticketTypeId}/activate`,
    {
      method: 'POST',
    },
  );
}

export function deactivateOrganizerTicketType(
  concertId: string,
  ticketTypeId: string,
): Promise<OrganizerTicketType> {
  return apiFetch<OrganizerTicketType>(
    `/organizer/concerts/${concertId}/ticket-types/${ticketTypeId}/deactivate`,
    {
      method: 'POST',
    },
  );
}
