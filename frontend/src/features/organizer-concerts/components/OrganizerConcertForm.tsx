import { ChangeEvent, FormEvent, ReactNode, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { resolveAssetUrl } from '../../../lib/assets';
import {
  createBannerPreviewUrl,
  createEmptyConcertFormValues,
  toConcertPayload,
  validateBannerFile,
  validateConcertForm,
} from '../form-helpers';
import { OrganizerConcertFormValues, OrganizerConcertPayload } from '../types';

type OrganizerConcertFormProps = {
  bannerInputLabel?: string;
  children?: ReactNode;
  initialValues?: OrganizerConcertFormValues;
  isSubmitting?: boolean;
  isReadonly?: boolean;
  submitLabel: string;
  onSubmit: (
    payload: OrganizerConcertPayload,
    options: { selectedBannerFile: File | null },
  ) => Promise<void>;
};

export function OrganizerConcertForm({
  bannerInputLabel,
  children,
  initialValues,
  isSubmitting = false,
  isReadonly = false,
  submitLabel,
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
  const currentBannerUrl = resolveAssetUrl(values.bannerUrl);
  const displayedBannerUrl = bannerPreviewUrl ?? currentBannerUrl;
  const resolvedBannerInputLabel =
    bannerInputLabel ?? (currentBannerUrl ? 'Replace banner' : 'Chọn banner concert');

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateConcertForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(toConcertPayload(values), {
      selectedBannerFile,
    });
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
        <FieldBlock label="Mô tả" error={errors.description}>
          <TextAreaField
            label="Mô tả"
            name="description"
            value={values.description}
            onChange={handleChange('description')}
            disabled={isReadonly || isSubmitting}
            rows={5}
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
            <img
              className="organizer-banner-preview"
              src={displayedBannerUrl}
              alt="Banner preview"
            />
          )}
        </FieldBlock>

        <FieldBlock label="Seating SVG" error={errors.seatingSvg}>
          <TextAreaField
            label="Seating SVG"
            name="seatingSvg"
            value={values.seatingSvg}
            onChange={handleChange('seatingSvg')}
            disabled={isReadonly || isSubmitting}
            rows={6}
          />
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
  error?: string;
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
