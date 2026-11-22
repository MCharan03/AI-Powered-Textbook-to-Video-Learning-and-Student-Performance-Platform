import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Globe2,
  Lock,
  Loader2,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { VideoRenderDetails } from '../../../lib/types';
import { api } from '../../../lib/api';
import {
  Banner,
  EmptyHint,
  LifecycleBadge,
  SectionHeader,
  formatDuration,
  subTextStyle,
} from './StudioUi';

interface PublishPanelProps {
  videos: VideoRenderDetails[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onBack: () => void;
  onGoToReview: () => void;
}

const canPublish = (v: VideoRenderDetails): boolean => {
  const key = (v.video_storage_key || '').toLowerCase();
  return (
    (v.status || '').toUpperCase() === 'APPROVED' &&
    (v.render_status || '').toUpperCase() === 'RENDERED' &&
    (v.script_status || '').toUpperCase() === 'SCRIPT_APPROVED' &&
    !!v.actual_duration_seconds &&
    v.actual_duration_seconds > 0 &&
    !!key &&
    !['seed_', 'sample.mp4', 'placeholder'].some((p) => key.includes(p))
  );
};

const blockingReason = (v: VideoRenderDetails): string | null => {
  const status = (v.status || '').toUpperCase();
  const render = (v.render_status || '').toUpperCase();
  if (status === 'PUBLISHED') return null;
  if (render !== 'RENDERED') return 'Not rendered yet';
  if ((v.script_status || '').toUpperCase() !== 'SCRIPT_APPROVED') return 'Script is not approved';
  if (status !== 'APPROVED') return 'Needs admin approval in Step 6';
  if (!v.actual_duration_seconds || v.actual_duration_seconds <= 0) return 'Rendered MP4 has no duration';
  const key = (v.video_storage_key || '').toLowerCase();
  if (!key || ['seed_', 'sample.mp4', 'placeholder'].some((p) => key.includes(p))) return 'Placeholder media cannot be published';
  return 'Not eligible for publishing';
};

/**
 * Step 7 — Publishing.
 * Only explicitly approved videos can be published. Rendered-but-unapproved
 * videos remain admin-only. Every publish is confirmed and re-validated by the
 * backend publish gate.
 */
export const PublishPanel: React.FC<PublishPanelProps> = ({ videos, loading, onRefresh, onBack, onGoToReview }) => {
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const groups = useMemo(() => {
    const approved: VideoRenderDetails[] = [];
    const awaitingReview: VideoRenderDetails[] = [];
    const published: VideoRenderDetails[] = [];
    const other: VideoRenderDetails[] = [];

    videos.forEach((v) => {
      const status = (v.status || '').toUpperCase();
      const render = (v.render_status || '').toUpperCase();
      if (status === 'PUBLISHED') published.push(v);
      else if (canPublish(v)) approved.push(v);
      else if (render === 'RENDERED') awaitingReview.push(v);
      else if (render === 'FAILED' || status === 'FAILED') other.push(v);
    });
    return { approved, awaitingReview, published, other };
  }, [videos]);

  const publishOne = async (v: VideoRenderDetails) => {
    const label = `“${v.title}”`;
    if (!window.confirm(`Publish ${label} to students?\n\nThis makes the approved video visible to students assigned to its subject.`)) return;
    setBusy(v.video_id || v.id);
    setError(null);
    setSuccess(null);
    try {
      await api.publishVideo(v.video_id || v.id);
      await onRefresh();
      setSuccess(`${label} is now published and visible to assigned students.`);
    } catch (err: any) {
      setError(err?.message || 'Publishing failed.');
    } finally {
      setBusy(null);
    }
  };

  const publishAllApproved = async () => {
    if (groups.approved.length === 0) return;
    const names = groups.approved.map((v) => `• ${v.title}`).join('\n');
    if (
      !window.confirm(
        `Publish ${groups.approved.length} approved video${groups.approved.length !== 1 ? 's' : ''} to students?\n\n${names}\n\nOnly approved videos are included. Rendered-but-unapproved videos stay private.`
      )
    ) {
      return;
    }
    setBusy('all');
    setError(null);
    setSuccess(null);
    const failures: string[] = [];
    for (const v of groups.approved) {
      try {
        await api.publishVideo(v.video_id || v.id);
      } catch (err: any) {
        failures.push(`${v.title}: ${err?.message || 'failed'}`);
      }
    }
    await onRefresh();
    setBusy(null);
    if (failures.length) setError(failures.join(' · '));
    else setSuccess(`Published ${groups.approved.length} approved video${groups.approved.length !== 1 ? 's' : ''}.`);
  };

  const renderRow = (v: VideoRenderDetails, kind: 'approved' | 'review' | 'published' | 'other') => {
    const id = v.video_id || v.id;
    const reason = kind === 'approved' ? null : blockingReason(v);
    return (
      <div
        key={id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          flexWrap: 'wrap',
          border: '1px solid var(--admin-border)',
          borderRadius: '8px',
          padding: '11px 13px',
          backgroundColor: 'var(--admin-surface-raised)',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text)' }}>{v.title}</span>
            <LifecycleBadge video={v} />
            {kind === 'published' && (
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--admin-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Users size={11} /> Student-visible
              </span>
            )}
            {kind !== 'published' && (
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--admin-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Lock size={11} /> Admin only
              </span>
            )}
          </div>
          <div style={subTextStyle}>
            {v.subject_name || 'No subject'} · {v.chapter_title || 'No chapter'} · {v.topic_title || 'No topic'} ·{' '}
            {formatDuration(v.actual_duration_seconds || v.approved_duration_seconds)}
            {v.rendered_at ? ` · rendered ${new Date(v.rendered_at).toLocaleDateString()}` : ''}
          </div>
          {kind === 'review' && (
            <div style={{ marginTop: '5px', fontSize: '11.5px', color: 'var(--admin-warning)' }}>
              Rendered and waiting for your review — not visible to students.
            </div>
          )}
          {kind === 'other' && reason && (
            <div style={{ marginTop: '5px', fontSize: '11.5px', color: 'var(--admin-error)' }}>
              {v.render_error || reason}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {kind === 'approved' && (
            <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" disabled={busy !== null} onClick={() => publishOne(v)}>
              {busy === id ? <Loader2 size={12} /> : <Globe2 size={12} />} Publish
            </button>
          )}
          {kind === 'review' && (
            <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={onGoToReview}>
              <Eye size={12} /> Review &amp; approve
            </button>
          )}
          {kind === 'other' && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>{reason || 'Not publishable'}</span>
          )}
          {kind === 'published' && (
            <span style={{ fontSize: '11.5px', color: 'var(--admin-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> Published
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading publishing status…
        </div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 7 · Publish approved videos"
        description="Only videos you explicitly approved in Step 6 can be published. Publishing is confirmed and validated again by the backend before students can see anything."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Review
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={publishAllApproved}
              disabled={busy !== null || groups.approved.length === 0}
            >
              {busy === 'all' ? <Loader2 size={13} /> : <Send size={13} />}
              {busy === 'all' ? 'Publishing…' : `Publish approved (${groups.approved.length})`}
            </button>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: '12px' }}>
          <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: '12px' }}>
          <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>
        </div>
      )}

      <div
        style={{
          marginBottom: '14px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--admin-primary-soft)',
          color: 'var(--admin-primary)',
          fontSize: '11.5px',
          display: 'flex',
          gap: '7px',
          alignItems: 'flex-start',
        }}
      >
        <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Rendered but unapproved videos are private to admins. Publishing is never automatic and never triggered by rendering.
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {[
          { label: 'Awaiting review', value: groups.awaitingReview.length },
          { label: 'Approved, not published', value: groups.approved.length },
          { label: 'Published', value: groups.published.length },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-raised)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '2px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {videos.length === 0 ? (
        <EmptyHint title="No videos in this textbook yet" description="Plan, script, render and review videos in the earlier steps." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section>
            <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-text)', margin: '0 0 8px' }}>
              Approved — ready to publish ({groups.approved.length})
            </h3>
            {groups.approved.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No approved videos are waiting to be published.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.approved.map((v) => renderRow(v, 'approved'))}
              </div>
            )}
          </section>

          <section>
            <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-text)', margin: '0 0 8px' }}>
              Rendered — needs review ({groups.awaitingReview.length})
            </h3>
            {groups.awaitingReview.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>Nothing is waiting for review.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.awaitingReview.map((v) => renderRow(v, 'review'))}
              </div>
            )}
          </section>

          {groups.other.length > 0 && (
            <section>
              <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-text)', margin: '0 0 8px' }}>
                Failed / not ready ({groups.other.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.other.map((v) => renderRow(v, 'other'))}
              </div>
            </section>
          )}

          <section>
            <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--admin-text)', margin: '0 0 8px' }}>
              Published ({groups.published.length})
            </h3>
            {groups.published.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No videos from this textbook are published yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.published.map((v) => renderRow(v, 'published'))}
              </div>
            )}
          </section>
        </div>
      )}

      <div
        style={{
          marginTop: '18px',
          paddingTop: '14px',
          borderTop: '1px solid var(--admin-border)',
          fontSize: '11.5px',
          color: 'var(--admin-text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: 'var(--admin-text)' }}>Status guide:</strong> Draft → Planned → Script Approved → Rendering → Rendered →
        Needs Review → Approved → Published. Failed videos can be retried in Step 5 without regenerating their approved scripts.
      </div>
    </SurfacePanel>
  );
};
