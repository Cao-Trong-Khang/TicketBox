import { apiFetch } from '../../lib/api-client';
import { ArtistDocumentDetail, ArtistDocumentListItem } from './types';

const base = (concertId: string) => `/admin/concerts/${concertId}/documents`;

export function previewArtistBio(file: File, previousBio?: string | null): Promise<{ generated_bio: string }> {
  const body = new FormData();
  body.append('file', file);
  if (previousBio?.trim()) body.append('previous_bio', previousBio.trim());
  return apiFetch('/admin/artist-bio/preview', { method: 'POST', body });
}

export function uploadArtistDocument(concertId: string, file: File, generatedBio?: string): Promise<{ document_id: string; status: 'uploaded' | 'done' }> {
  const body = new FormData();
  body.append('file', file);
  if (generatedBio !== undefined) body.append('generated_bio', generatedBio);
  return apiFetch(base(concertId), { method: 'POST', body });
}

export function listArtistDocuments(concertId: string): Promise<ArtistDocumentListItem[]> {
  return apiFetch(base(concertId));
}

export function getArtistDocument(concertId: string, documentId: string, signal?: AbortSignal): Promise<ArtistDocumentDetail> {
  return apiFetch(`${base(concertId)}/${documentId}`, { signal });
}

export function deleteArtistDocument(concertId: string, documentId: string): Promise<void> {
  return apiFetch(`${base(concertId)}/${documentId}`, { method: 'DELETE' });
}

export function updateArtistBio(concertId: string, documentId: string, generatedBio: string): Promise<{ generated_bio: string }> {
  return apiFetch(`${base(concertId)}/${documentId}/bio`, { method: 'PUT', body: JSON.stringify({ generated_bio: generatedBio }) });
}

export function regenerateArtistBio(concertId: string, documentId: string): Promise<{ document_id: string; status: 'uploaded' | 'done' }> {
  return apiFetch(`${base(concertId)}/${documentId}/regenerate`, { method: 'POST' });
}
