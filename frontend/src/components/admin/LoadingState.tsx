import React from 'react';

interface LoadingStateProps {
  label?: string;
  rows?: number;
  variant?: 'table' | 'inline';
}

/**
 * Skeleton loading state. Use `variant="table"` inside cards that
 * normally hold tables; `inline` for small in-place loading.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading…', rows = 4, variant = 'table' }) => {
  if (variant === 'inline') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '24px',
          color: 'var(--admin-text-secondary)',
          fontSize: '13px',
        }}
      >
        <span
          className="adm-spinner"
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid var(--admin-border)',
            borderTopColor: 'var(--admin-primary)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'adm-rotate 700ms linear infinite',
          }}
        />
        {label}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }} aria-label={label} role="status">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background:
                'linear-gradient(90deg, var(--admin-surface-raised) 25%, #E9EEF5 50%, var(--admin-surface-raised) 75%)',
              backgroundSize: '200% 100%',
              animation: 'adm-shimmer 1.4s ease infinite',
            }}
          />
        ))}
      </div>
      <style>
        {`
          @keyframes adm-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes adm-rotate {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
