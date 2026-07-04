import { apiFetch } from '../../lib/api-client';
import {
  BannerUploadResponse,
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

export function uploadConcertBanner(file: File): Promise<BannerUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<BannerUploadResponse>('/organizer/concerts/banners', {
    method: 'POST',
    body: formData,
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const apiError = error as { status: number; message: string };

      if (apiError.status === 400) {
        throw {
          ...apiError,
          message: apiError.message || 'Ảnh banner chưa hợp lệ.',
        };
      }

      if (apiError.status === 413) {
        throw {
          ...apiError,
          message: 'File banner phải nhỏ hơn hoặc bằng 5 MB.',
        };
      }

      if (apiError.status === 503) {
        throw {
          ...apiError,
          message: 'Không thể tải banner lên lúc này. Vui lòng thử lại.',
        };
      }
    }

    throw error;
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

export function cancelOrganizerConcert(
  id: string,
): Promise<OrganizerConcertDetail> {
  return apiFetch<OrganizerConcertDetail>(`/organizer/concerts/${id}/cancel`, {
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
