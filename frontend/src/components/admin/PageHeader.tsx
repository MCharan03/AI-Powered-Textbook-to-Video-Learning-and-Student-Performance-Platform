import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * Standard page header: clear page title, small descriptive subtitle,
 * and an optional right-aligned action area.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ minWidth: 0 }}>
      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--admin-text)',
          lineHeight: '28px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h1>
      {description && (
        <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '4px', maxWidth: '640px' }}>
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>
    )}
  </div>
);
