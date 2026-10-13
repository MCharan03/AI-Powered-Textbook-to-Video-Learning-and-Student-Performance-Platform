import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let bgColor = 'rgba(148, 163, 184, 0.15)';
  let textColor = '#94A3B8';
  let borderColor = 'rgba(148, 163, 184, 0.3)';

  switch (status.toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'published':
    case 'passed':
      bgColor = 'rgba(16, 185, 129, 0.15)';
      textColor = '#10B981';
      borderColor = 'rgba(16, 185, 129, 0.3)';
      break;
    case 'pending_review':
    case 'pending':
    case 'running':
      bgColor = 'rgba(245, 158, 11, 0.15)';
      textColor = '#F59E0B';
      borderColor = 'rgba(245, 158, 11, 0.3)';
      break;
    case 'failed':
    case 'error':
    case 'rejected':
      bgColor = 'rgba(239, 68, 68, 0.15)';
      textColor = '#EF4444';
      borderColor = 'rgba(239, 68, 68, 0.3)';
      break;
    case 'active':
    case 'in_progress':
      bgColor = 'rgba(99, 102, 241, 0.15)';
      textColor = '#6366F1';
      borderColor = 'rgba(99, 102, 241, 0.3)';
      break;
  }

  const label = status.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
};
