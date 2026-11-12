import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatTone = 'default' | 'primary' | 'success' | 'warning' | 'error';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
  loading?: boolean;
  onClick?: () => void;
}

const toneStyles: Record<StatTone, { iconBg: string; iconColor: string }> = {
  default: { iconBg: 'var(--admin-surface-raised)', iconColor: 'var(--admin-text-secondary)' },
  primary: { iconBg: 'var(--admin-primary-soft)', iconColor: 'var(--admin-primary)' },
  success: { iconBg: 'var(--admin-success-soft)', iconColor: 'var(--admin-success)' },
  warning: { iconBg: 'var(--admin-warning-soft)', iconColor: 'var(--admin-warning)' },
  error: { iconBg: 'var(--admin-error-soft)', iconColor: 'var(--admin-error)' },
};

/**
 * Compact summary metric card. Shows an explicit unavailable state
 * when the value is missing — never fabricates data.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  loading = false,
  onClick,
}) => {
  const t = toneStyles[tone];
  return (
    <div
      className="adm-card"
      onClick={onClick}
      style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow var(--duration-fast) ease',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--admin-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--admin-text)',
            marginTop: '6px',
            lineHeight: '32px',
          }}
        >
          {loading ? <span style={{ color: 'var(--admin-text-secondary)' }}>…</span> : value}
        </div>
        {hint && (
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>{hint}</div>
        )}
      </div>
      {Icon && (
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: t.iconBg,
            color: t.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
      )}
    </div>
  );
};
