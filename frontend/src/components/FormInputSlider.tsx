import React from 'react';

interface FormInputSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  onChange: (val: number) => void;
}

export const FormInputSlider: React.FC<FormInputSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  description,
  onChange,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </label>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'var(--surface-raised)',
            color: 'var(--primary)',
          }}
        >
          {value} {unit}
        </span>
      </div>
      {description && (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {description}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--primary)',
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
};
