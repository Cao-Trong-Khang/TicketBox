import { apiFetch } from '../../lib/api-client';
import { ArtistDocumentDetail, ArtistDocumentListItem } from './types';

const base = (concertId: string) => `/admin/concerts/${concertId}/documents`;

export function uploadArtistDocument(concertId: string, file: File): Promise<{ document_id: string; status: 'uploaded' }> {
  const body = new FormData();
  body.append('file', file);
  return apiFetch(base(concertId), { method: 'POST', body });
}

export function listArtistDocuments(concertId: string): Promise<ArtistDocumentListItem[]> {
  return apiFetch(base(concertId));
}

export function getArtistDocument(concertId: string, documentId: string, signal?: AbortSignal): Promise<ArtistDocumentDetail> {
  return apiFetch(`${base(concertId)}/${documentId}`, { signal });
}

export function updateArtistBio(concertId: string, documentId: string, generatedBio: string): Promise<{ generated_bio: string }> {
  return apiFetch(`${base(concertId)}/${documentId}/bio`, { method: 'PUT', body: JSON.stringify({ generated_bio: generatedBio }) });
}

export function regenerateArtistBio(concertId: string, documentId: string): Promise<{ document_id: string; status: 'uploaded' }> {
  return apiFetch(`${base(concertId)}/${documentId}/regenerate`, { method: 'POST' });
}
