import { InputHTMLAttributes } from 'react';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FormField({ id, label, ...props }: FormFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="form-field" htmlFor={fieldId}>
      <span>{label}</span>
      <input id={fieldId} {...props} />
    </label>
  );
}
