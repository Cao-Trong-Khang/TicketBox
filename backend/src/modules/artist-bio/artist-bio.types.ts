export const AI_BIO_REQUESTED_TOPIC = 'ai.bio.requested';
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_EXTRACTION_FAILURE = 'Could not extract text. Please upload a text-based PDF.';

export type AiBioRequestedEvent = {
  document_id: string;
  concert_id: string;
  storage_key: string;
  attempt: number;
  previous_bio?: string;
};

export type ArtistDocumentListItemDto = {
  document_id: string;
  file_name: string;
  status: string;
  uploaded_at: string;
};

export type ArtistDocumentDetailDto = ArtistDocumentListItemDto & {
  extracted_text?: string;
  generated_bio?: string;
  failure_reason?: string;
  generated_at?: string;
};
