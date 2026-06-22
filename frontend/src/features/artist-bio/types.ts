export type ArtistDocumentStatus = 'uploaded' | 'extracting' | 'extracted' | 'generating' | 'done' | 'failed';

export type ArtistDocumentListItem = {
  document_id: string;
  file_name: string;
  status: ArtistDocumentStatus;
  uploaded_at: string;
};

export type ArtistDocumentDetail = ArtistDocumentListItem & {
  extracted_text?: string;
  generated_bio?: string;
  failure_reason?: string;
  generated_at?: string;
};
