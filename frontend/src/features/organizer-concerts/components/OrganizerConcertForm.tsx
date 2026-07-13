import { ChangeEvent, FormEvent, ReactNode, useCallback, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { FormField } from '../../../components/ui/FormField';
import { resolveAssetUrl } from '../../../lib/assets';
import {
  createBannerPreviewUrl,
  createEmptyConcertFormValues,
  createSeatingSvgPreviewMarkup,
  toConcertPayload,
  validateBannerFile,
  validateConcertForm,
  validateSeatingSvgFile,
} from '../form-helpers';
import { OrganizerConcertFormValues, OrganizerConcertPayload } from '../types';
import { validateArtistPdf } from '../../artist-bio/pdf-validation';

const ARTIST_BIO_HELP = 'PDF t\u1ed1i \u0111a 10 MB. Sinh b\u1ea3n xem tr\u01b0\u1edbc, ch\u1ec9 l\u01b0u PDF v\u00e0 ti\u1ec3u s\u1eed khi b\u1ea1n nh\u1ea5n T\u1ea1o concert.';
const UPLOAD_ARTIST_BIO_LABEL = 'T\u1ea3i l\u00ean';
const REMOVE_ARTIST_BIO_FILE_LABEL = 'G\u1ee1 b\u1ecf file';

type OrganizerConcertFormProps = {
  bannerInputLabel?: string;
  children?: ReactNode;
  artistBioPanel?: (applyArtistBiography: (value: string) => void) => ReactNode;
  initialValues?: OrganizerConcertFormValues;
  isSubmitting?: boolean;
  isReadonly?: boolean;
  showArtistBioUpload?: boolean;
  submitLabel: string;
  onGenerateArtistBio?: (file: File, previousBio: string | null) => Promise<string>;
  onSubmit: (
    payload: OrganizerConcertPayload,
    options: { selectedBannerFile: File | null; selectedArtistBioFile: File | null; generatedArtistBio: string | null },
  ) => Promise<void>;
};

export function OrganizerConcertForm({
  bannerInputLabel,
  children,
  artistBioPanel,
  initialValues,
  isSubmitting = false,
  isReadonly = false,
  showArtistBioUpload = false,
  submitLabel,
  onGenerateArtistBio,
  onSubmit,
}: OrganizerConcertFormProps) {
  const [values, setValues] = useState<OrganizerConcertFormValues>(
    initialValues ?? createEmptyConcertFormValues(),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof OrganizerConcertFormValues, string>>
  >({});
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [selectedArtistBioFile, setSelectedArtistBioFile] = useState<File | null>(null);
  const [artistBioError, setArtistBioError] = useState<string | null>(null);
  const [artistBioSuccess, setArtistBioSuccess] = useState<string | null>(null);
  const [generatedArtistBio, setGeneratedArtistBio] = useState<string | null>(null);
  const [approvedArtistBio, setApprovedArtistBio] = useState<string | null>(null);
  const [isGeneratingArtistBio, setIsGeneratingArtistBio] = useState(false);
  const artistBioFileInputRef = useRef<HTMLInputElement>(null);
  const [seatingSvgPreviewMarkup, setSeatingSvgPreviewMarkup] = useState<string | null>(() => {
    if (!initialValues?.seatingSvg) {
      return null;
    }

    return sanitizeSvgMarkup(initialValues.seatingSvg);
  });
  const [seatingSvgError, setSeatingSvgError] = useState<string | null>(null);
  const currentBannerUrl = resolveAssetUrl(values.bannerUrl);
  const displayedBannerUrl = bannerPreviewUrl ?? currentBannerUrl;
  const resolvedBannerInputLabel =
    bannerInputLabel ?? (currentBannerUrl ? 'Replace banner' : 'Chọn banner concert');
  const applyArtistBiography = useCallback((value: string) => {
    setValues((current) => ({ ...current, description: value }));
    setErrors((current) => ({ ...current, description: undefined }));
  }, []);

  const handleChange =
    (field: keyof OrganizerConcertFormValues) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const nextValues = {
        ...values,
        [field]: event.target.value,
      };
      setValues(nextValues);

      if (Object.keys(errors).length > 0) {
        setErrors(validateConcertForm(nextValues));
      }
    };
  const handleArtistBiographyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    handleChange('description')(event);
    if (approvedArtistBio !== null) {
      setApprovedArtistBio(event.target.value);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedArtistBioFile && !approvedArtistBio?.trim()) {
      setArtistBioError('Vui l\u00f2ng sinh v\u00e0 duy\u1ec7t ti\u1ec3u s\u1eed AI tr\u01b0\u1edbc khi t\u1ea1o concert.');
      return;
    }

    const validationErrors = validateConcertForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(toConcertPayload(values), {
      selectedBannerFile,
      selectedArtistBioFile,
      generatedArtistBio: approvedArtistBio,
    });
  };

  const handleArtistBioChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setArtistBioError(null);
    setArtistBioSuccess(null);
    setGeneratedArtistBio(null);
    setApprovedArtistBio(null);
    if (!file) {
      setSelectedArtistBioFile(null);
      return;
    }
    const validation = validateArtistPdf(file);
    if (!validation.valid) {
      setSelectedArtistBioFile(null);
      setArtistBioError(validation.error);
      event.target.value = '';
      return;
    }
    setSelectedArtistBioFile(file);
  };

  const removeSelectedArtistBioFile = () => {
    setSelectedArtistBioFile(null);
    setArtistBioError(null);
    setArtistBioSuccess(null);
    setGeneratedArtistBio(null);
    setApprovedArtistBio(null);
    if (artistBioFileInputRef.current) artistBioFileInputRef.current.value = '';
  };

  const handleGenerateArtistBio = async () => {
    if (!selectedArtistBioFile || !onGenerateArtistBio) return;
    setIsGeneratingArtistBio(true);
    setArtistBioError(null);
    setArtistBioSuccess(null);
    try {
      const biography = (await onGenerateArtistBio(selectedArtistBioFile, generatedArtistBio)).trim();
      if (!biography) throw new Error('AI kh\u00f4ng tr\u1ea3 v\u1ec1 n\u1ed9i dung ti\u1ec3u s\u1eed.');
      if (biography.length > 10000) throw new Error('Ti\u1ec3u s\u1eed AI kh\u00f4ng \u0111\u01b0\u1ee3c v\u01b0\u1ee3t qu\u00e1 10.000 k\u00fd t\u1ef1.');
      setGeneratedArtistBio(biography);
      setApprovedArtistBio(null);
    } catch (error) {
      setGeneratedArtistBio(null);
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'Kh\u00f4ng th\u1ec3 sinh ti\u1ec3u s\u1eed AI.';
      setArtistBioError(message);
    } finally {
      setIsGeneratingArtistBio(false);
    }
  };

  const handleSaveArtistBioDraft = () => {
    const biography = generatedArtistBio?.trim();
    if (!biography) {
      setArtistBioSuccess(null);
      setArtistBioError('Ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129 kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.');
      return;
    }
    setGeneratedArtistBio(biography);
    setApprovedArtistBio(biography);
    applyArtistBiography(biography);
    setArtistBioError(null);
    setArtistBioSuccess('\u0110\u00e3 l\u01b0u b\u1ea3n nh\u00e1p ti\u1ec3u s\u1eed. N\u1ed9i dung s\u1ebd \u0111\u01b0\u1ee3c ghi khi b\u1ea1n t\u1ea1o concert.');
  };

  const handleSeatingSvgChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSeatingSvgPreviewMarkup(null);
      setSeatingSvgError(null);
      setValues((current) => ({ ...current, seatingSvg: '' }));
      return;
    }

    const validation = validateSeatingSvgFile(file);

    if (!validation.valid) {
      setSeatingSvgPreviewMarkup(null);
      setSeatingSvgError(validation.error ?? 'SVG chưa hợp lệ.');
      setValues((current) => ({ ...current, seatingSvg: '' }));
      event.target.value = '';
      return;
    }

    try {
      const previewMarkup = await createSeatingSvgPreviewMarkup(file);
      const sanitizedMarkup = sanitizeSvgMarkup(previewMarkup);
      setSeatingSvgPreviewMarkup(sanitizedMarkup);
      setSeatingSvgError(null);
      setValues((current) => ({ ...current, seatingSvg: sanitizedMarkup }));
    } catch (error) {
      setSeatingSvgPreviewMarkup(null);
      setSeatingSvgError(
        error instanceof Error ? error.message : 'Không thể đọc file SVG.',
      );
      setValues((current) => ({ ...current, seatingSvg: '' }));
      event.target.value = '';
    }
  };

  const handleBannerChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedBannerFile(null);
      setBannerPreviewUrl(null);
      setBannerError(null);
      return;
    }

    const validation = validateBannerFile(file);

    if (!validation.valid) {
      setSelectedBannerFile(null);
      setBannerPreviewUrl(null);
      setBannerError(validation.error ?? 'Banner chưa hợp lệ.');
      event.target.value = '';
      return;
    }

    try {
      const previewUrl = await createBannerPreviewUrl(file);
      setSelectedBannerFile(file);
      setBannerPreviewUrl(previewUrl);
      setBannerError(null);
    } catch (error) {
      setSelectedBannerFile(null);
      setBannerPreviewUrl(null);
      setBannerError(
        error instanceof Error ? error.message : 'Không thể đọc file xem trước.',
      );
      event.target.value = '';
    }
  };

  const artistBioUpload = showArtistBioUpload ? (
    <section className='artist-bio-panel' aria-labelledby='artist-bio-create-title'>
      <header>
        <h2 id='artist-bio-create-title'>Tiểu sử nghệ sĩ do AI tạo</h2>
        <p>Tải lên press kit dạng PDF, xem và chỉnh sửa tiểu sử trước khi tạo concert.</p>
      </header>

      {artistBioError && <Alert tone='error'>{artistBioError}</Alert>}
      {artistBioSuccess && <Alert tone='success'>{artistBioSuccess}</Alert>}

      <div className='artist-bio-upload'>
        <label htmlFor='artistBioPressKit'>Press kit PDF (tối đa 10 MB)</label>
        <input
          ref={artistBioFileInputRef}
          id='artistBioPressKit'
          name='artistBioPressKit'
          type='file'
          accept='.pdf,application/pdf'
          onChange={handleArtistBioChange}
          disabled={isReadonly || isSubmitting || isGeneratingArtistBio}
        />
        {selectedArtistBioFile && <p className='organizer-field-help'>Đã chọn: {selectedArtistBioFile.name}</p>}
        <div className='artist-actions'>
          <Button
            type='button'
            onClick={() => void handleGenerateArtistBio()}
            disabled={isReadonly || isSubmitting || isGeneratingArtistBio || !selectedArtistBioFile || !onGenerateArtistBio}
          >
            {isGeneratingArtistBio ? 'Đang xử lý...' : UPLOAD_ARTIST_BIO_LABEL}
          </Button>
          {selectedArtistBioFile && (
            <Button
              type='button'
              className='button-secondary'
              onClick={removeSelectedArtistBioFile}
              disabled={isReadonly || isSubmitting || isGeneratingArtistBio}
            >
              {REMOVE_ARTIST_BIO_FILE_LABEL}
            </Button>
          )}
        </div>
        <p className='organizer-field-help'>{ARTIST_BIO_HELP}</p>
      </div>

      <div className='artist-bio-layout'>
        <aside>
          <h3>Lịch sử</h3>
          {selectedArtistBioFile ? (
            <button type='button' className='artist-document active' disabled>
              <strong>{selectedArtistBioFile.name}</strong>
              <span>{generatedArtistBio ? 'Hoàn tất' : 'Đã chọn'}</span>
            </button>
          ) : (
            <p>Chưa có tài liệu nào.</p>
          )}
        </aside>

        <article>
          {isGeneratingArtistBio ? (
            <>
              <div className='artist-status status-generating'><strong>Trạng thái:</strong> Đang tạo tiểu sử</div>
              <p role='status'>AI đang đọc press kit và sinh tiểu sử...</p>
            </>
          ) : generatedArtistBio === null ? (
            <p>Chọn hoặc tải lên một press kit.</p>
          ) : (
            <div className='artist-biography'>
              <label htmlFor='generatedArtistBio'>Tiểu sử nghệ sĩ do AI tạo</label>
              <textarea
                id='generatedArtistBio'
                name='generatedArtistBio'
                rows={8}
                maxLength={10000}
                value={generatedArtistBio}
                onChange={(event) => setGeneratedArtistBio(event.target.value)}
                disabled={isReadonly || isSubmitting}
              />
              <div className='artist-actions'>
                <Button
                  type='button'
                  onClick={handleSaveArtistBioDraft}
                  disabled={isReadonly || isSubmitting || !generatedArtistBio.trim()}
                >
                  Lưu tiểu sử
                </Button>
                <Button
                  type='button'
                  onClick={() => void handleGenerateArtistBio()}
                  disabled={isReadonly || isSubmitting || !selectedArtistBioFile || !onGenerateArtistBio}
                >
                  Tạo lại tiểu sử
                </Button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  ) : null;
  return (
    <form className="organizer-form" onSubmit={handleSubmit} noValidate>
      <div className="organizer-form-grid">
        <FieldBlock label="Tên concert" error={errors.title}>
          <FormField
            label="Tên concert"
            name="title"
            value={values.title}
            onChange={handleChange('title')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Nghệ sĩ" error={errors.artistName}>
          <FormField
            label="Nghệ sĩ"
            name="artistName"
            value={values.artistName}
            onChange={handleChange('artistName')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Địa điểm" error={errors.venueName}>
          <FormField
            label="Địa điểm"
            name="venueName"
            value={values.venueName}
            onChange={handleChange('venueName')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Địa chỉ" error={errors.venueAddress}>
          <FormField
            label="Địa chỉ"
            name="venueAddress"
            value={values.venueAddress}
            onChange={handleChange('venueAddress')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Bắt đầu mở bán vé" error={errors.startsAt}>
          <FormField
            label="Bắt đầu mở bán vé"
            name="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={handleChange('startsAt')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Kết thúc mở bán vé" error={errors.endsAt}>
          <FormField
            label="Kết thúc mở bán vé"
            name="endsAt"
            type="datetime-local"
            value={values.endsAt}
            onChange={handleChange('endsAt')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock
          label="Thời gian bắt đầu concert"
          error={errors.performanceStartAt}
        >
          <FormField
            label="Thời gian bắt đầu concert"
            name="performanceStartAt"
            type="datetime-local"
            value={values.performanceStartAt}
            onChange={handleChange('performanceStartAt')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>
      </div>

      <div className="organizer-form-stack">
        {artistBioUpload}
        {artistBioPanel?.(applyArtistBiography)}

        <FieldBlock label="Tiểu sử nghệ sĩ" error={errors.description}>
          <TextAreaField
            label="Tiểu sử nghệ sĩ"
            name="description"
            value={values.description}
            onChange={handleArtistBiographyChange}
            disabled={isReadonly || isSubmitting}
            rows={8}
          />
        </FieldBlock>

        <FieldBlock label={resolvedBannerInputLabel} error={bannerError ?? errors.bannerUrl}>
          <label className="form-field" htmlFor="concertBanner">
            <span>{resolvedBannerInputLabel}</span>
            <input
              id="concertBanner"
              name="concertBanner"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleBannerChange(event)}
              disabled={isReadonly || isSubmitting}
            />
          </label>
          <p className="organizer-field-help">
            JPEG, PNG hoặc WebP. Tối đa 5 MB.
          </p>
          {displayedBannerUrl && (
            <div className="organizer-banner-preview-wrapper">
              <img
                className="organizer-banner-preview"
                src={displayedBannerUrl}
                alt="Banner preview"
              />
            </div>
          )}
        </FieldBlock>

        <FieldBlock label="Seating SVG" error={errors.seatingSvg ?? seatingSvgError}>
          <label className="form-field" htmlFor="concertSeatingSvg">
            <span>Tải file SVG</span>
            <input
              id="concertSeatingSvg"
              name="concertSeatingSvg"
              type="file"
              accept="image/svg+xml"
              onChange={(event) => void handleSeatingSvgChange(event)}
              disabled={isReadonly || isSubmitting}
            />
          </label>
          <p className="organizer-field-help">
            Xuất SVG từ Figma, Illustrator hoặc Inkscape. Mỗi vùng nên có data-ticket-code, data-zone hoặc id tương ứng với mã vé.
          </p>
          {seatingSvgPreviewMarkup ? (
            <div className="concert-seatmap-preview" aria-label="Xem trước sơ đồ chỗ ngồi">
              <div className="concert-seatmap-preview-inner" dangerouslySetInnerHTML={{ __html: seatingSvgPreviewMarkup }} />
            </div>
          ) : (
            <p className="organizer-field-help">Chưa có sơ đồ chỗ ngồi.</p>
          )}
        </FieldBlock>
      </div>

      {children}

      <div className="organizer-form-actions">
        <Button type="submit" disabled={isReadonly || isSubmitting}>
          {isSubmitting ? 'Đang xử lý...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type FieldBlockProps = {
  children: ReactNode;
  error?: string | null;
  label: string;
};

function FieldBlock({ children, error, label }: FieldBlockProps) {
  return (
    <div className="organizer-field-block">
      {children}
      {error && (
        <p className="organizer-field-error" role="alert" aria-label={`${label} error`}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextAreaFieldProps = {
  disabled?: boolean;
  label: string;
  name: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  value: string;
};

function TextAreaField({
  disabled,
  label,
  name,
  onChange,
  rows = 4,
  value,
}: TextAreaFieldProps) {
  return (
    <label className="form-field" htmlFor={name}>
      <span>{label}</span>
      <textarea
        id={name}
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}

function sanitizeSvgMarkup(markup: string): string {
  return DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOWED_TAGS: ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'text', 'line', 'polyline', 'polygon'],
    ALLOWED_ATTR: ['id', 'class', 'data-zone', 'data-ticket-code', 'viewBox', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'x', 'y', 'width', 'height', 'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry'],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  });
}
