import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import {
  deleteArtistDocument,
  getArtistDocument,
  listArtistDocuments,
  regenerateArtistBio,
  updateArtistBio,
  uploadArtistDocument,
} from '../api';
import { validateArtistPdf } from '../pdf-validation';
import { ArtistDocumentDetail, ArtistDocumentListItem } from '../types';

const TERMINAL = new Set(['done', 'failed']);
const COPY = {
  title: 'Ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129 do AI t\u1ea1o',
  introduction: 'T\u1ea3i l\u00ean press kit d\u1ea1ng PDF, theo d\u00f5i qu\u00e1 tr\u00ecnh t\u1ea1o v\u00e0 duy\u1ec7t ti\u1ec3u s\u1eed tr\u01b0\u1edbc khi hi\u1ec3n th\u1ecb c\u00f4ng khai.',
  readonly: 'Concert n\u00e0y ch\u1ec9 c\u00f3 th\u1ec3 xem. C\u00e1c ti\u1ec3u s\u1eed hi\u1ec7n c\u00f3 v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef l\u1ea1i.',
  fallbackError: 'Kh\u00f4ng th\u1ec3 x\u1eed l\u00fd ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129.',
  emptyBiography: 'Ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129 kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.',
  saved: '\u0110\u00e3 l\u01b0u ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129.',
  pressKit: 'Press kit PDF (t\u1ed1i \u0111a 10 MB)',
  selected: '\u0110\u00e3 ch\u1ecdn',
  processing: '\u0110ang x\u1eed l\u00fd...',
  upload: 'T\u1ea3i l\u00ean',
  removeFile: 'G\u1ee1 b\u1ecf file',
  deleteDocument: 'X\u00f3a',
  deleteConfirm: 'B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a l\u1ea7n t\u1ea1o ti\u1ec3u s\u1eed n\u00e0y?',
  deleted: '\u0110\u00e3 x\u00f3a t\u00e0i li\u1ec7u kh\u1ecfi l\u1ecbch s\u1eed.',
  history: 'L\u1ecbch s\u1eed',
  noDocuments: 'Ch\u01b0a c\u00f3 t\u00e0i li\u1ec7u n\u00e0o.',
  selectDocument: 'Ch\u1ecdn ho\u1eb7c t\u1ea3i l\u00ean m\u1ed9t press kit.',
  status: 'Tr\u1ea1ng th\u00e1i',
  polling: 'H\u1ec7 th\u1ed1ng \u0111ang x\u1eed l\u00fd. Tr\u1ea1ng th\u00e1i \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt sau m\u1ed7i 4 gi\u00e2y.',
  biography: 'Ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129 do AI t\u1ea1o',
  saving: '\u0110ang l\u01b0u...',
  save: 'L\u01b0u ti\u1ec3u s\u1eed',
  regenerate: 'T\u1ea1o l\u1ea1i ti\u1ec3u s\u1eed',
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: '\u0110\u00e3 t\u1ea3i l\u00ean',
  extracting: '\u0110ang tr\u00edch xu\u1ea5t',
  extracted: '\u0110\u00e3 tr\u00edch xu\u1ea5t',
  generating: '\u0110ang t\u1ea1o ti\u1ec3u s\u1eed',
  done: 'Ho\u00e0n t\u1ea5t',
  failed: 'Th\u1ea5t b\u1ea1i',
};

type ArtistBioPanelProps = {
  concertId: string;
  initialDocumentId?: string | null;
  isReadonly?: boolean;
  onBiographySaved?: (value: string) => void;
};

export function ArtistBioPanel({
  concertId,
  initialDocumentId = null,
  isReadonly = false,
  onBiographySaved,
}: ArtistBioPanelProps) {
  const [documents, setDocuments] = useState<ArtistDocumentListItem[]>([]);
  const [active, setActive] = useState<ArtistDocumentDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [biographyDraft, setBiographyDraft] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectDetail = useCallback((detail: ArtistDocumentDetail) => {
    setActive(detail);
    const biography = detail.generated_bio ?? '';
    setBiographyDraft(biography);
    setDocuments((items) => {
      const exists = items.some((item) => item.document_id === detail.document_id);
      if (!exists) return [{ ...detail }, ...items];
      return items.map((item) =>
        item.document_id === detail.document_id
          ? { ...item, status: detail.status }
          : item,
      );
    });
  }, []);

  function showError(reason: unknown) {
    const apiError = reason as Partial<ApiError>;
    setSuccess('');
    setError(apiError.message || COPY.fallbackError);
  }

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    listArtistDocuments(concertId)
      .then((items) => {
        if (!current) return;
        const list = Array.isArray(items) ? items : [];
        setDocuments(list);
        const documentId = initialDocumentId ?? list[0]?.document_id;
        if (documentId) {
          getArtistDocument(concertId, documentId, controller.signal)
            .then((detail) => current && selectDetail(detail))
            .catch((reason) => !isAbort(reason) && showError(reason));
        }
      })
      .catch(showError);

    return () => {
      current = false;
      controller.abort();
    };
  }, [concertId, initialDocumentId, selectDetail]);

  const activeDocumentId = active?.document_id;
  const activeStatus = active?.status;

  useEffect(() => {
    if (!activeDocumentId || !activeStatus || TERMINAL.has(activeStatus)) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      getArtistDocument(concertId, activeDocumentId, controller.signal)
        .then(selectDetail)
        .catch((reason) => !isAbort(reason) && showError(reason));
    }, 4000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [concertId, activeDocumentId, activeStatus, selectDetail]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    const validation = validateArtistPdf(selected);
    if (!validation.valid) {
      setFile(null);
      setError(validation.error);
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const removeSelectedFile = () => {
    setFile(null);
    setError('');
    setSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const upload = async () => {
    if (!file || isReadonly) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await uploadArtistDocument(concertId, file);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]);
      selectDetail(detail);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!active || isReadonly) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await regenerateArtistBio(concertId, active.document_id);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]);
      selectDetail(detail);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const saveBiography = async () => {
    if (!active || isReadonly) return;
    const value = biographyDraft.trim();
    if (!value) {
      setError(COPY.emptyBiography);
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await updateArtistBio(concertId, active.document_id, value);
      selectDetail({
        ...active,
        status: 'done',
        generated_bio: result.generated_bio,
        failure_reason: undefined,
      });
      onBiographySaved?.(result.generated_bio);
      setSuccess(COPY.saved);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const removeDocument = async (document: ArtistDocumentListItem) => {
    if (isReadonly || busy || !window.confirm(`${COPY.deleteConfirm}\n${document.file_name}`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await deleteArtistDocument(concertId, document.document_id);
      const remaining = documents.filter((item) => item.document_id !== document.document_id);
      setDocuments(remaining);

      if (active?.document_id === document.document_id) {
        setActive(null);
        setBiographyDraft('');
        const next = remaining[0];
        if (next) {
          const detail = await getArtistDocument(concertId, next.document_id);
          selectDetail(detail);
        }
      }
      setSuccess(COPY.deleted);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className='artist-bio-panel' aria-labelledby={`artist-bio-${concertId}`}>
      <header>
        <h2 id={`artist-bio-${concertId}`}>{COPY.title}</h2>
        <p>{COPY.introduction}</p>
      </header>

      {isReadonly && (
        <p className='organizer-editor-note'>{COPY.readonly}</p>
      )}
      {error && <Alert tone='error'>{error}</Alert>}
      {success && <Alert tone='success'>{success}</Alert>}

      <div className='artist-bio-upload'>
        <label htmlFor={`press-kit-${concertId}`}>{COPY.pressKit}</label>
        <input
          ref={fileInputRef}
          id={`press-kit-${concertId}`}
          type='file'
          accept='.pdf,application/pdf'
          onChange={selectFile}
          disabled={isReadonly || busy}
        />
        {file && <p className='organizer-field-help'>{COPY.selected}: {file.name}</p>}
        <div className='artist-actions'>
          <Button
            type='button'
            onClick={() => void upload()}
            disabled={isReadonly || !file || busy}
          >
            {busy ? COPY.processing : COPY.upload}
          </Button>
          {file && (
            <Button
              type='button'
              className='button-secondary'
              onClick={removeSelectedFile}
              disabled={isReadonly || busy}
            >
              {COPY.removeFile}
            </Button>
          )}
        </div>
      </div>

      <div className='artist-bio-layout'>
        <aside>
          <h3>{COPY.history}</h3>
          {documents.length === 0 ? (
            <p>{COPY.noDocuments}</p>
          ) : (
            documents.map((document) => (
              <div
                key={document.document_id}
                className={
                  active?.document_id === document.document_id
                    ? 'artist-document active'
                    : 'artist-document'
                }
              >
                <button
                  type='button'
                  className='artist-document-select'
                  disabled={busy}
                  onClick={() =>
                    getArtistDocument(concertId, document.document_id)
                      .then(selectDetail)
                      .catch(showError)
                  }
                >
                  <strong>{document.file_name}</strong>
                  <span>{STATUS_LABELS[document.status] ?? document.status}</span>
                </button>
                {!isReadonly && (
                  <button
                    type='button'
                    className='artist-document-delete'
                    aria-label={`${COPY.deleteDocument} ${document.file_name}`}
                    disabled={busy}
                    onClick={() => void removeDocument(document)}
                  >
                    {COPY.deleteDocument}
                  </button>
                )}
              </div>
            ))
          )}
        </aside>

        <article>
          {!active ? (
            <p>{COPY.selectDocument}</p>
          ) : (
            <>
              {!TERMINAL.has(active.status) && (
                <div className={`artist-status status-${active.status}`}>
                  <strong>{COPY.status}:</strong> {STATUS_LABELS[active.status] ?? active.status}
                </div>
              )}
              {!TERMINAL.has(active.status) && (
                <p role='status'>{COPY.polling}</p>
              )}
              {active.failure_reason && <Alert tone='error'>{active.failure_reason}</Alert>}
              {active.generated_bio && (
                <div className='artist-biography'>
                  <label htmlFor={`artist-biography-${concertId}`}>{COPY.biography}</label>
                  <textarea
                    id={`artist-biography-${concertId}`}
                    value={biographyDraft}
                    rows={8}
                    maxLength={10000}
                    onChange={(event) => setBiographyDraft(event.target.value)}
                    disabled={isReadonly || busy}
                  />
                  <div className='artist-actions'>
                    <Button
                      type='button'
                      onClick={() => void saveBiography()}
                      disabled={
                        isReadonly ||
                        busy ||
                        !biographyDraft.trim()
                      }
                    >
                      {busy ? COPY.saving : COPY.save}
                    </Button>
                    <Button
                      type='button'
                      onClick={() => void regenerate()}
                      disabled={isReadonly || busy}
                    >
                      {COPY.regenerate}
                    </Button>
                  </div>
                </div>
              )}
              {active.status === 'failed' && (
                <Button
                  type='button'
                  onClick={() => void regenerate()}
                  disabled={isReadonly || busy}
                >
                  {COPY.regenerate}
                </Button>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function isAbort(reason: unknown): boolean {
  return (reason as { name?: string })?.name === 'AbortError';
}
