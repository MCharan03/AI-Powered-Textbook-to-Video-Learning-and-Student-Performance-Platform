import React from 'react';

interface SurfacePanelProps {
  children: React.ReactNode;
  elevation?: 'level0' | 'level1' | 'level2';
  style?: React.CSSProperties;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export const SurfacePanel: React.FC<SurfacePanelProps> = ({
  children,
  elevation = 'level1',
  style,
  className,
  title,
  actions,
}) => {
  const isDark = document.body.className.includes('theme-admin');

  let boxShadow = 'none';
  if (elevation === 'level1') {
    boxShadow = isDark
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)'
      : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)';
  } else if (elevation === 'level2') {
    boxShadow = isDark
      ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
  }

  const baseStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'var(--admin-surface)' : 'var(--learn-surface)',
    border: `1px solid ${isDark ? 'var(--admin-border)' : 'var(--learn-border)'}`,
    borderRadius: '12px',
    boxShadow,
    padding: '24px',
    ...style,
  };

  return (
    <div style={baseStyle} className={className}>
      {(title || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          {title && (
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: isDark ? 'var(--admin-text)' : 'var(--learn-text)' }}>
              {title}
            </h3>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
