import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { StatusBadge } from '../../StatusBadge';
import { VideoRenderDetails } from '../../../lib/types';

export const MONO_FONT = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  color: 'var(--admin-text)',
  margin: 0,
};

export const subTextStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--admin-text-secondary)',
  margin: '3px 0 0',
  lineHeight: 1.5,
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  borderRadius: 'var(--radius-sm, 6px)',
  border: '1px solid var(--admin-border)',
  backgroundColor: 'var(--admin-surface)',
  color: 'var(--admin-text)',
  boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--admin-text-secondary)',
  marginBottom: '4px',
};

export const SectionHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: '12px',
      marginBottom: '16px',
    }}
  >
    <div>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {description && <p style={subTextStyle}>{description}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

export type BannerTone = 'success' | 'error' | 'info' | 'warning';

const bannerPalette: Record<BannerTone, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  success: {
    bg: 'var(--admin-success-soft)',
    border: 'var(--admin-success)',
    color: 'var(--admin-success)',
    icon: <CheckCircle2 size={15} />,
  },
  error: {
    bg: 'var(--admin-error-soft)',
    border: 'var(--admin-error)',
    color: 'var(--admin-error)',
    icon: <AlertTriangle size={15} />,
  },
  warning: {
    bg: 'var(--admin-warning-soft)',
    border: 'var(--admin-warning)',
    color: 'var(--admin-warning)',
    icon: <AlertTriangle size={15} />,
  },
  info: {
    bg: 'var(--admin-primary-soft)',
    border: 'var(--admin-primary)',
    color: 'var(--admin-primary)',
    icon: <Info size={15} />,
  },
};

export const Banner: React.FC<{
  tone?: BannerTone;
  children: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone = 'info', children, onDismiss }) => {
  const p = bannerPalette[tone];
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md, 8px)',
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        color: p.color,
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: 1.5,
      }}
    >
      <span style={{ marginTop: '1px', flexShrink: 0 }}>{p.icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export const EmptyHint: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div
    style={{
      textAlign: 'center',
      padding: '36px 20px',
      border: '1px dashed var(--admin-border)',
      borderRadius: 'var(--radius-lg, 10px)',
      backgroundColor: 'var(--admin-surface-raised)',
    }}
  >
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>{title}</div>
    <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)', marginTop: '4px', maxWidth: 520, margin: '4px auto 0', lineHeight: 1.6 }}>
      {description}
    </div>
    {action && <div style={{ marginTop: '14px' }}>{action}</div>}
  </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
    <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
    {label}
  </span>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '3px' }}>{hint}</div>}
  </div>
);

export const formatDuration = (seconds?: number | null): string => {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatBytes = (bytes?: number | null): string => {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 2)} MB`;
};

/** Human-friendly lifecycle label for a video. */
export const videoLifecycle = (v: Pick<VideoRenderDetails, 'status' | 'render_status' | 'script_status'>): string => {
  const status = (v.status || '').toUpperCase();
  const render = (v.render_status || '').toUpperCase();
  const script = (v.script_status || '').toUpperCase();

  if (status === 'PUBLISHED') return 'Published';
  if (status === 'FAILED' || render === 'FAILED') return 'Failed';
  // A rendered video whose script fell back into review (e.g. an admin asked
  // for regeneration) must never look Approved, even though the plan is still
  // approved so the script can be regenerated.
  if (render === 'RENDERED' && script !== 'SCRIPT_APPROVED') return 'Needs Review';
  if (render === 'RENDERING' || render === 'AUDIO_GENERATING' || render === 'AUDIO_READY') return 'Rendering';
  if (render === 'RENDERED') return 'Needs Review';
  if (status === 'APPROVED') return 'Approved';
  if (script === 'SCRIPT_APPROVED') return 'Script Approved';
  if (script === 'SCRIPT_REVIEW' || script === 'NEEDS_REVIEW' || script === 'SCRIPT_GENERATION_QUEUED' || script === 'GENERATING') {
    return 'Script Review';
  }
  if (status === 'REVIEW') return 'Planned';
  return status ? status.replace(/_/g, ' ') : 'Draft';
};

export const LifecycleBadge: React.FC<{ video: VideoRenderDetails }> = ({ video }) => (
  <StatusBadge status={videoLifecycle(video)} />
);
