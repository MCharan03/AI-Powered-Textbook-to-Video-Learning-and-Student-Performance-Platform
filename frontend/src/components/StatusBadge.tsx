import React from 'react';

interface StatusBadgeProps {
  status: string;
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'primary';

const toneMap: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: 'var(--admin-surface-raised)', text: 'var(--admin-text-secondary)' },
  success: { bg: 'var(--admin-success-soft)', text: 'var(--admin-success)' },
  warning: { bg: 'var(--admin-warning-soft)', text: 'var(--admin-warning)' },
  error: { bg: 'var(--admin-error-soft)', text: 'var(--admin-error)' },
  primary: { bg: 'var(--admin-primary-soft)', text: 'var(--admin-primary)' },
};

const statusTones: Record<string, BadgeTone> = {
  approved: 'success',
  completed: 'success',
  published: 'success',
  passed: 'success',
  active: 'success',
  available: 'success',
  archived: 'neutral',
  inactive: 'neutral',
  draft: 'neutral',
  none: 'neutral',
  pending_review: 'warning',
  pending: 'warning',
  pending_approval: 'warning',
  running: 'warning',
  processing: 'warning',
  in_progress: 'warning',
  awaiting_approval: 'warning',
  needs_review: 'warning',
  uploaded: 'primary',
  generated: 'primary',
  approved_plan: 'primary',
  failed: 'error',
  error: 'error',
  rejected: 'error',
};

/**
 * Consistent status badge using the shared light-theme palette.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const tone = statusTones[normalized] || 'neutral';
  const colors = toneMap[tone];
  const label = (status || 'Unknown').replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className="adm-badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
};
