import React from 'react';

interface SurfacePanelProps {
  children: React.ReactNode;
  elevation?: 'level0' | 'level1' | 'level2';
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

/**
 * Standard content card. Theme-aware: the admin portal uses the shared
 * light SaaS geometry; the learning portal keeps its original card
 * look so it stays unaffected by admin redesign work.
 */
export const SurfacePanel: React.FC<SurfacePanelProps> = ({
  children,
  elevation = 'level1',
  style,
  className,
  title,
  actions,
}) => {
  const isDark = typeof document !== 'undefined' && document.body.className.includes('theme-admin');

  let boxShadow: string | undefined;
  if (!isDark) {
    // Learning portal: original shadow behavior
    if (elevation === 'level1') {
      boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)';
    } else if (elevation === 'level2') {
      boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
    } else {
      boxShadow = 'none';
    }
  } else {
    // Admin portal: subtle minimal shadows
    if (elevation === 'level0') {
      boxShadow = 'none';
    } else if (elevation === 'level2') {
      boxShadow = 'var(--shadow-lg)';
    } else {
      boxShadow = 'var(--shadow-sm)';
    }
  }

  const baseStyle: React.CSSProperties = isDark
    ? {
        backgroundColor: 'var(--admin-surface)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow,
        padding: '20px',
        ...style,
      }
    : {
        backgroundColor: 'var(--learn-surface)',
        border: '1px solid var(--learn-border)',
        borderRadius: '12px',
        boxShadow,
        padding: '24px',
        ...style,
      };

  return (
    <div style={baseStyle} className={className}>
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {title && (
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: isDark ? 'var(--admin-text)' : 'var(--learn-text)' }}>
              {title}
            </h3>
          )}
          {actions && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
