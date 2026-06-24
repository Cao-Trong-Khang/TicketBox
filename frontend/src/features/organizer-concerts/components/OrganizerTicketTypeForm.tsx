import { ChangeEvent, FormEvent, ReactNode, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import {
  createEmptyTicketTypeFormValues,
  toTicketTypePayload,
  validateTicketTypeForm,
} from '../ticket-type-helpers';
import {
  OrganizerTicketTypeFormValues,
  OrganizerTicketTypePayload,
} from '../types';

type OrganizerTicketTypeFormProps = {
  initialValues?: OrganizerTicketTypeFormValues;
  isReadonly?: boolean;
  isSubmitting?: boolean;
  submitLabel: string;
  title: string;
  description: string;
  onCancel?: () => void;
  onSubmit: (payload: OrganizerTicketTypePayload) => Promise<void>;
};

export function OrganizerTicketTypeForm({
  initialValues,
  isReadonly = false,
  isSubmitting = false,
  submitLabel,
  title,
  description,
  onCancel,
  onSubmit,
}: OrganizerTicketTypeFormProps) {
  const [values, setValues] = useState<OrganizerTicketTypeFormValues>(
    initialValues ?? createEmptyTicketTypeFormValues(),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof OrganizerTicketTypeFormValues, string>>
  >({});

  const handleChange =
    (field: keyof OrganizerTicketTypeFormValues) =>
    (
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const nextValues = {
        ...values,
        [field]: event.target.value,
      };
      setValues(nextValues);

      if (Object.keys(errors).length > 0) {
        setErrors(validateTicketTypeForm(nextValues));
      }
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateTicketTypeForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(toTicketTypePayload(values));
  };

  return (
    <form className="organizer-form" onSubmit={handleSubmit} noValidate>
      <div>
        <h2 className="organizer-section-title">{title}</h2>
        <p className="organizer-section-copy">{description}</p>
      </div>

      <div className="organizer-form-grid">
        <FieldBlock label="Mã loại vé" error={errors.code}>
          <FormField
            label="Mã loại vé"
            name="code"
            value={values.code}
            onChange={handleChange('code')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Tên loại vé" error={errors.name}>
          <FormField
            label="Tên loại vé"
            name="name"
            value={values.name}
            onChange={handleChange('name')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Giá vé (VND)" error={errors.priceVnd}>
          <FormField
            label="Giá vé (VND)"
            name="priceVnd"
            inputMode="numeric"
            value={values.priceVnd}
            onChange={handleChange('priceVnd')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Tổng số vé" error={errors.totalQuantity}>
          <FormField
            label="Tổng số vé"
            name="totalQuantity"
            inputMode="numeric"
            value={values.totalQuantity}
            onChange={handleChange('totalQuantity')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Giới hạn mỗi người" error={errors.perUserLimit}>
          <FormField
            label="Giới hạn mỗi người"
            name="perUserLimit"
            inputMode="numeric"
            value={values.perUserLimit}
            onChange={handleChange('perUserLimit')}
            disabled={isReadonly || isSubmitting}
            required
          />
        </FieldBlock>

        <FieldBlock label="Bắt đầu bán" error={errors.saleStartAt}>
          <FormField
            label="Bắt đầu bán"
            name="saleStartAt"
            type="datetime-local"
            value={values.saleStartAt}
            onChange={handleChange('saleStartAt')}
            disabled={isReadonly || isSubmitting}
          />
        </FieldBlock>

        <FieldBlock label="Kết thúc bán" error={errors.saleEndAt}>
          <FormField
            label="Kết thúc bán"
            name="saleEndAt"
            type="datetime-local"
            value={values.saleEndAt}
            onChange={handleChange('saleEndAt')}
            disabled={isReadonly || isSubmitting}
          />
        </FieldBlock>
      </div>

      <div className="organizer-form-actions">
        <Button type="submit" disabled={isReadonly || isSubmitting}>
          {isSubmitting ? 'Đang xử lý...' : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            className="button-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
        )}
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
