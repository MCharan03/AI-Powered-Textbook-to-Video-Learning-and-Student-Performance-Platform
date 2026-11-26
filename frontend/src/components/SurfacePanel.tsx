import React from 'react';

interface SurfacePanelProps {
  children: React.ReactNode;
  elevation?: 'level0' | 'level1' | 'level2';
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/**
 * Universal SurfacePanel component.
 * Fully theme-adaptive: reads semantic CSS tokens (--surface, --border, --text, --shadow).
 */
export const SurfacePanel: React.FC<SurfacePanelProps> = ({
  children,
  elevation = 'level1',
  style,
  className = '',
  title,
  subtitle,
  actions,
}) => {
  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg, 8px)',
    boxShadow:
      elevation === 'level2'
        ? 'var(--shadow-lg)'
        : elevation === 'level1'
        ? 'var(--shadow-sm)'
        : 'none',
    padding: '20px',
    transition: 'background-color var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease)',
    ...style,
  };

  return (
    <div style={baseStyle} className={className}>
      {(title || actions || subtitle) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '14px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {title && (
            <div>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              {subtitle && (
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
