import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { getArtistDocument, listArtistDocuments, regenerateArtistBio, uploadArtistDocument } from '../api';
import { validateArtistPdf } from '../pdf-validation';
import { ArtistDocumentDetail, ArtistDocumentListItem } from '../types';

const TERMINAL = new Set(['done', 'failed']);

type ArtistBioPanelProps = {
  concertId: string;
  initialAutoApplyDocumentId?: string | null;
  isReadonly?: boolean;
  onBiographyReady?: (biography: string) => void;
  onEditDescription?: () => void;
};

export function ArtistBioPanel({ concertId, initialAutoApplyDocumentId = null, isReadonly = false, onBiographyReady, onEditDescription }: ArtistBioPanelProps) {
  const [documents, setDocuments] = useState<ArtistDocumentListItem[]>([]);
  const [active, setActive] = useState<ArtistDocumentDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const autoApplyDocumentIds = useRef(new Set(initialAutoApplyDocumentId ? [initialAutoApplyDocumentId] : []));
  const onBiographyReadyRef = useRef(onBiographyReady);
  onBiographyReadyRef.current = onBiographyReady;

  const selectDetail = useCallback((detail: ArtistDocumentDetail) => {
    setActive(detail);
    setDocuments((items) => items.map((item) => item.document_id === detail.document_id ? { ...item, status: detail.status } : item));
    if (detail.generated_bio && autoApplyDocumentIds.current.delete(detail.document_id)) {
      onBiographyReadyRef.current?.(detail.generated_bio);
    }
  }, []);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    listArtistDocuments(concertId).then((items) => {
      if (!current) return;
      const list = Array.isArray(items) ? items : [];
      setDocuments(list);
      if (list[0]) {
        getArtistDocument(concertId, list[0].document_id, controller.signal)
          .then((detail) => current && selectDetail(detail))
          .catch((reason) => !isAbort(reason) && showError(reason));
      }
    }).catch(showError);
    return () => { current = false; controller.abort(); };
  }, [concertId, selectDetail]);

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
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [concertId, activeDocumentId, activeStatus, selectDetail]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return setFile(null);
    const validation = validateArtistPdf(selected);
    if (!validation.valid) {
      setFile(null);
      setError(validation.error);
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file || isReadonly) return;
    setBusy(true); setError('');
    try {
      const result = await uploadArtistDocument(concertId, file);
      autoApplyDocumentIds.current.add(result.document_id);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]);
      selectDetail(detail); setFile(null);
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  };

  const regenerate = async () => {
    if (!active || isReadonly) return;
    setBusy(true); setError('');
    try {
      const result = await regenerateArtistBio(concertId, active.document_id);
      autoApplyDocumentIds.current.add(result.document_id);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]); selectDetail(detail);
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  };

  function showError(reason: unknown) {
    const apiError = reason as Partial<ApiError>;
    setError(apiError.message || 'Không thể xử lý tiểu sử nghệ sĩ.');
  }

  return (
    <section className={'artist-bio-panel'} aria-labelledby={`artist-bio-${concertId}`}>
      <header><h2 id={`artist-bio-${concertId}`}>AI Artist Biography</h2><p>Tải press kit PDF lên và theo dõi quá trình tạo tiểu sử. Khi hoàn tất, nội dung sẽ tự động được lưu vào ô Mô tả và đồng bộ với trang chi tiết concert.</p></header>
      {isReadonly && <p className={'organizer-editor-note'}>Concert ở chế độ chỉ đọc. Bạn vẫn có thể xem các tiểu sử đã tạo.</p>}
      {error && <Alert tone={'error'}>{error}</Alert>}
      <div className={'artist-bio-upload'}>
        <label htmlFor={`press-kit-${concertId}`}>Press kit PDF (tối đa 10 MB)</label>
        <input id={`press-kit-${concertId}`} type={'file'} accept={'.pdf,application/pdf'} onChange={selectFile} disabled={isReadonly || busy} />
        {file && <p className={'organizer-field-help'}>Đã chọn: {file.name}</p>}
        <Button type={'button'} onClick={() => void upload()} disabled={isReadonly || !file || busy}>{busy ? 'Đang xử lý…' : 'Tải lên'}</Button>
      </div>
      <div className={'artist-bio-layout'}>
        <aside><h3>Lịch sử</h3>{documents.length === 0 ? <p>Chưa có tài liệu.</p> : documents.map((document) => <button type={'button'} key={document.document_id} className={active?.document_id === document.document_id ? 'artist-document active' : 'artist-document'} onClick={() => getArtistDocument(concertId, document.document_id).then(selectDetail).catch(showError)}><strong>{document.file_name}</strong><span>{document.status}</span></button>)}</aside>
        <article>
          {!active ? <p>Chọn hoặc tải lên một press kit.</p> : <>
            {!TERMINAL.has(active.status) && <div className={`artist-status status-${active.status}`}><strong>Trạng thái:</strong> {active.status}</div>}
            {!TERMINAL.has(active.status) && <p role={'status'}>Hệ thống đang xử lý. Trạng thái tự cập nhật mỗi 4 giây.</p>}
            {active.failure_reason && <Alert tone={'error'}>{active.failure_reason}</Alert>}
            {active.generated_bio && <div className={'artist-actions'}><Button type={'button'} onClick={onEditDescription} disabled={isReadonly || busy || !onEditDescription}>Chỉnh sửa thủ công</Button><Button type={'button'} onClick={regenerate} disabled={isReadonly || busy}>Tạo lại</Button></div>}
            {active.status === 'failed' && <Button type={'button'} onClick={regenerate} disabled={isReadonly || busy}>Tạo lại</Button>}
          </>}
        </article>
      </div>
    </section>
  );
}

function isAbort(reason: unknown): boolean {
  return (reason as { name?: string })?.name === 'AbortError';
}
