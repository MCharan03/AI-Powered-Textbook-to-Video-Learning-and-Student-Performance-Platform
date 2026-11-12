import React from 'react';

export type FormFieldType = 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' | 'select' | 'textarea';

interface FormFieldProps {
  label: string;
  name?: string;
  type?: FormFieldType;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  helpText?: string;
  options?: { value: string | number; label: string }[];
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
}

/**
 * Standard labelled form field with inline validation error display.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  disabled,
  error,
  helpText,
  options,
  autoComplete,
  min,
  max,
  step,
  style,
}) => {
  const fieldId = name ? `field-${name}` : undefined;
  const inputClass = `adm-input${error ? ' adm-input-error' : ''}`;
  return (
    <div style={{ minWidth: 0, ...style }}>
      <label className="adm-label" htmlFor={fieldId}>
        {label}
        {required && <span style={{ color: 'var(--admin-error)' }}> *</span>}
      </label>

      {type === 'select' ? (
        <select
          id={fieldId}
          className={`adm-select${error ? ' adm-input-error' : ''}`}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        >
          {options?.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={fieldId}
          className={`adm-textarea${error ? ' adm-input-error' : ''}`}
          value={value}
          required={required}
          disabled={disabled}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      ) : (
        <input
          id={fieldId}
          className={inputClass}
          type={type}
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {error ? (
        <div className="adm-field-error">{error}</div>
      ) : helpText ? (
        <div className="adm-help-text">{helpText}</div>
      ) : null}
    </div>
  );
};
