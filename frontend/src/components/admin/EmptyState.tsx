import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Friendly empty state for tables and panels.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  description,
  action,
  icon,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '999px',
        backgroundColor: 'var(--admin-surface-raised)',
        color: 'var(--admin-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '12px',
      }}
    >
      {icon || <Inbox size={20} />}
    </div>
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>{title}</div>
    {description && (
      <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '4px', maxWidth: '380px' }}>
        {description}
      </p>
    )}
    {action && <div style={{ marginTop: '14px' }}>{action}</div>}
  </div>
);
