export const MAX_ARTIST_PDF_BYTES = 10 * 1024 * 1024;

export type ArtistPdfValidation = { valid: true } | { valid: false; error: string };

export function validateArtistPdf(file: File): ArtistPdfValidation {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    return { valid: false, error: 'Chỉ chấp nhận tệp PDF.' };
  }
  if (file.size > MAX_ARTIST_PDF_BYTES) {
    return { valid: false, error: 'Tệp PDF không được vượt quá 10 MB.' };
  }
  return { valid: true };
}
