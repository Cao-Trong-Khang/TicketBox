import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { getArtistDocument, listArtistDocuments, regenerateArtistBio, updateArtistBio, uploadArtistDocument } from '../api';
import { ArtistDocumentDetail, ArtistDocumentListItem } from '../types';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const TERMINAL = new Set(['done', 'failed']);

export function ArtistBioAdminPage() {
  const { concertId } = useParams<{ concertId: string }>();
  const [documents, setDocuments] = useState<ArtistDocumentListItem[]>([]);
  const [active, setActive] = useState<ArtistDocumentDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!concertId) return;
    let current = true;
    listArtistDocuments(concertId).then((items) => {
      if (!current) return;
      setDocuments(items);
      if (items[0]) getArtistDocument(concertId, items[0].document_id).then((detail) => current && selectDetail(detail)).catch(showError);
    }).catch(showError);
    return () => { current = false; };
  }, [concertId]);

  const activeDocumentId = active?.document_id;
  const activeStatus = active?.status;

  useEffect(() => {
    if (!concertId || !activeDocumentId || !activeStatus || TERMINAL.has(activeStatus)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getArtistDocument(concertId, activeDocumentId, controller.signal).then(selectDetail).catch((reason) => {
        if ((reason as { name?: string }).name !== 'AbortError') showError(reason);
      });
    }, 4000);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [concertId, activeDocumentId, activeStatus]);

  const selectDetail = (detail: ArtistDocumentDetail) => {
    setActive(detail);
    setBio(detail.generated_bio ?? '');
    setDocuments((items) => items.map((item) => item.document_id === detail.document_id ? { ...item, status: detail.status } : item));
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return setFile(null);
    if (!selected.name.toLowerCase().endsWith('.pdf') || selected.type !== 'application/pdf') {
      setFile(null); setError('Chỉ chấp nhận tệp PDF.'); return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setFile(null); setError('Tệp PDF không được vượt quá 10 MB.'); return;
    }
    setFile(selected);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!concertId || !file) return;
    setBusy(true); setError('');
    try {
      const result = await uploadArtistDocument(concertId, file);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]);
      selectDetail(detail); setFile(null);
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  };

  const regenerate = async () => {
    if (!concertId || !active) return;
    setBusy(true); setError('');
    try {
      const result = await regenerateArtistBio(concertId, active.document_id);
      const detail = await getArtistDocument(concertId, result.document_id);
      setDocuments((items) => [{ ...detail }, ...items]); selectDetail(detail);
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!concertId || !active || !bio.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await updateArtistBio(concertId, active.document_id, bio);
      selectDetail({ ...active, status: 'done', generated_bio: result.generated_bio });
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  };

  function showError(reason: unknown) {
    const apiError = reason as Partial<ApiError>;
    setError(apiError.message || 'Không thể xử lý tiểu sử nghệ sĩ.');
  }

  if (!concertId) return <Alert tone="error">Concert không hợp lệ.</Alert>;

  return (
    <section className="artist-bio-admin" aria-labelledby="artist-bio-title">
      <header><p className="eyebrow">Organizer tools</p><h1 id="artist-bio-title">AI Artist Biography</h1><p>Tải press kit PDF lên và theo dõi quá trình tạo tiểu sử.</p></header>
      {error && <Alert tone="error">{error}</Alert>}
      <form className="artist-bio-upload" onSubmit={upload}>
        <label htmlFor="press-kit">Press kit PDF (tối đa 10 MB)</label>
        <input id="press-kit" type="file" accept=".pdf,application/pdf" onChange={selectFile} />
        <Button type="submit" disabled={!file || busy}>{busy ? 'Đang xử lý…' : 'Tải lên'}</Button>
      </form>
      <div className="artist-bio-layout">
        <aside><h2>Lịch sử</h2>{documents.length === 0 ? <p>Chưa có tài liệu.</p> : documents.map((document) => <button type="button" key={document.document_id} className={active?.document_id === document.document_id ? 'artist-document active' : 'artist-document'} onClick={() => getArtistDocument(concertId, document.document_id).then(selectDetail).catch(showError)}><strong>{document.file_name}</strong><span>{document.status}</span></button>)}</aside>
        <article>
          {!active ? <p>Chọn hoặc tải lên một press kit.</p> : <>
            <div className={`artist-status status-${active.status}`}><strong>Trạng thái:</strong> {active.status}</div>
            {!TERMINAL.has(active.status) && <p role="status">Hệ thống đang xử lý. Trạng thái tự cập nhật mỗi 4 giây.</p>}
            {active.failure_reason && <Alert tone="error">{active.failure_reason}</Alert>}
            {active.generated_bio && <><label htmlFor="generated-bio">Tiểu sử nghệ sĩ</label><textarea id="generated-bio" rows={12} value={bio} onChange={(event) => setBio(event.target.value)} /><div className="artist-actions"><Button type="button" onClick={save} disabled={busy || !bio.trim()}>Edit Manually</Button><Button type="button" onClick={regenerate} disabled={busy}>Regenerate</Button></div></>}
            {active.status === 'failed' && <Button type="button" onClick={regenerate} disabled={busy}>Regenerate</Button>}
          </>}
        </article>
      </div>
    </section>
  );
}
