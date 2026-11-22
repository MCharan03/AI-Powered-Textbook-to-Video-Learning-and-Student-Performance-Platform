import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Captions,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  FileText,
  Loader2,
  MessageSquareWarning,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Video as VideoIcon,
} from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { ScriptItem, VideoRenderDetails } from '../../../lib/types';
import { api, mediaUrl } from '../../../lib/api';
import {
  Banner,
  EmptyHint,
  LifecycleBadge,
  SectionHeader,
  formatDuration,
  inputStyle,
  labelStyle,
  subTextStyle,
} from './StudioUi';

interface ReviewPanelProps {
  videos: VideoRenderDetails[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  onGoToScripts: () => void;
}

interface Cue {
  start: string;
  end: string;
  text: string;
}

const srtToVtt = (srt: string): string => {
  const body = srt.replace(/\r+/g, '').replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2');
  return body.trimStart().startsWith('WEBVTT') ? body : `WEBVTT\n\n${body}`;
};

const parseCues = (srt?: string | null): Cue[] => {
  if (!srt) return [];
  const blocks = srt.replace(/\r+/g, '').trim().split(/\n{2,}/);
  const cues: Cue[] = [];
  blocks.forEach((block) => {
    const lines = block.split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) return;
    const [start, end] = lines[timeIdx].split('-->').map((s) => s.trim().split(' ')[0]);
    cues.push({ start, end, text: lines.slice(timeIdx + 1).join(' ').trim() });
  });
  return cues;
};

/**
 * Step 6 — Mandatory rendered video review.
 * Plays the actual generated MP4 with captions, shows metadata, the render
 * status/errors and the approved script for comparison. Approval is explicit;
 * nothing is published from this screen.
 */
export const ReviewPanel: React.FC<ReviewPanelProps> = ({ videos, loading, onRefresh, onNext, onBack, onGoToScripts }) => {
  const reviewable = useMemo(
    () =>
      videos
        .filter((v) => ['RENDERED', 'FAILED', 'RENDERING', 'AUDIO_GENERATING', 'AUDIO_READY'].includes((v.render_status || '').toUpperCase()))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [videos]
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [script, setScript] = useState<ScriptItem | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [tab, setTab] = useState<'script' | 'captions' | 'details'>('script');
  const [captionsUrl, setCaptionsUrl] = useState<string>('');
  const captionsUrlRef = useRef<string>('');

  const selected = useMemo(
    () => reviewable.find((v) => (v.video_id || v.id) === selectedId) || null,
    [reviewable, selectedId]
  );

  useEffect(() => {
    if (!selected && reviewable.length > 0) {
      setSelectedId(reviewable[0].video_id || reviewable[0].id);
    }
  }, [reviewable, selected]);

  // Revoke generated caption blob URLs when they are replaced or unmounted.
  useEffect(() => {
    return () => {
      if (captionsUrlRef.current) URL.revokeObjectURL(captionsUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setCaptionsUrl('');
      return;
    }
    const srt = selected.captions_srt;
    if (captionsUrlRef.current) {
      URL.revokeObjectURL(captionsUrlRef.current);
      captionsUrlRef.current = '';
    }
    if (srt) {
      const blob = new Blob([srtToVtt(srt)], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      captionsUrlRef.current = url;
      setCaptionsUrl(url);
    } else {
      setCaptionsUrl('');
    }
  }, [selected?.video_id, selected?.captions_srt]);

  const loadScript = async (videoId: number) => {
    try {
      setLoadingScript(true);
      setScript(await api.getVideoPlanScript(videoId));
    } catch {
      setScript(null);
    } finally {
      setLoadingScript(false);
    }
  };

  useEffect(() => {
    if (!selected) {
      setScript(null);
      return;
    }
    setShowRegenForm(false);
    setFeedback('');
    setTab('script');
    setError(null);
    setSuccess(null);
    loadScript(selected.video_id || selected.id);
  }, [selected?.video_id]);

  const cues = useMemo(() => parseCues(selected?.captions_srt), [selected?.captions_srt]);

  const approve = async () => {
    if (!selected) return;
    setBusy('approve');
    setError(null);
    setSuccess(null);
    try {
      await api.approveVideo(selected.video_id || selected.id);
      await onRefresh();
      setSuccess('Video approved. Publish it explicitly in Step 7 when you are ready for students to see it.');
    } catch (err: any) {
      setError(err?.message || 'Approval failed.');
    } finally {
      setBusy(null);
    }
  };

  const requestRegeneration = async () => {
    if (!selected) return;
    if (!feedback.trim()) {
      setError('Explain what must change before requesting regeneration.');
      return;
    }
    setBusy('regen');
    setError(null);
    setSuccess(null);
    try {
      await api.requestVideoRegeneration(selected.video_id || selected.id, feedback.trim());
      await onRefresh();
      setShowRegenForm(false);
      setSuccess(
        'Regeneration requested. The script is unlocked for revision in Step 4, then re-approved and re-rendered. The current MP4 is kept for comparison.'
      );
    } catch (err: any) {
      setError(err?.message || 'Could not request regeneration.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading rendered videos…
        </div>
      </SurfacePanel>
    );
  }

  const status = (selected?.status || '').toUpperCase();
  const renderStatus = (selected?.render_status || '').toUpperCase();
  const scriptStatus = (selected?.script_status || '').toUpperCase();
  const canApprove =
    !!selected && renderStatus === 'RENDERED' && scriptStatus === 'SCRIPT_APPROVED' && status !== 'APPROVED' && status !== 'PUBLISHED';
  const isRendered = renderStatus === 'RENDERED';

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 6 · Watch and review every video"
        description="Play the actual rendered MP4 before it can go anywhere near students. Compare the narration with the approved script, check captions and render details, then approve — or request specific changes."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              <ChevronLeft size={13} /> Rendering
            </button>
            <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={onNext}>
              Continue to publish
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

      {reviewable.length === 0 ? (
        <EmptyHint
          title="No rendered videos to review"
          description="Render at least one video in Step 5. Rendered videos appear here for mandatory human review before publishing."
          action={
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Back to rendering
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
          {/* Video queue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Rendered videos ({reviewable.length})
            </div>
            {reviewable.map((v) => {
              const id = v.video_id || v.id;
              const active = id === selectedId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                    backgroundColor: active ? 'var(--admin-primary-soft)' : 'var(--admin-surface-raised)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                    <VideoIcon size={12} style={{ color: active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)', flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: active ? 'var(--admin-primary)' : 'var(--admin-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <LifecycleBadge video={v} />
                    <span style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)' }}>
                      {formatDuration(v.actual_duration_seconds || v.approved_duration_seconds)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected review */}
          {selected && (
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--admin-text)' }}>{selected.title}</h3>
                    <LifecycleBadge video={selected} />
                  </div>
                  <div style={subTextStyle}>
                    {selected.textbook_title ? `${selected.textbook_title} · ` : ''}
                    {selected.subject_name || 'No subject'} · {selected.chapter_title || 'No chapter'} ·{' '}
                    {selected.topic_title || 'No topic'} · {formatDuration(selected.actual_duration_seconds || selected.approved_duration_seconds)} ·
                    pages {selected.source_page_start ?? '—'}–{selected.source_page_end ?? '—'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  border: '1px solid var(--admin-border)',
                  aspectRatio: '16 / 9',
                  position: 'relative',
                }}
              >
                {isRendered && selected.video_url ? (
                  <video
                    key={selected.video_id || selected.id}
                    controls
                    preload="metadata"
                    poster={mediaUrl(selected.thumbnail_url)}
                    src={mediaUrl(selected.video_url)}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  >
                    {captionsUrl && <track kind="subtitles" src={captionsUrl} srcLang="en" label="English" default />}
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: '#CBD5E1',
                      fontSize: '12.5px',
                      textAlign: 'center',
                      padding: '20px',
                    }}
                  >
                    {renderStatus === 'FAILED' ? <AlertTriangle size={22} /> : <PlayCircle size={22} />}
                    {renderStatus === 'FAILED'
                      ? 'Rendering failed — no MP4 is available. Retry the render in Step 5.'
                      : 'The MP4 is not ready yet. Finish rendering in Step 5.'}
                  </div>
                )}
              </div>

              {isRendered && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href={mediaUrl(selected.video_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn adm-btn-ghost adm-btn-sm"
                  >
                    Open MP4 in a new tab
                  </a>
                  {selected.thumbnail_url && (
                    <a href={mediaUrl(selected.thumbnail_url)} target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost adm-btn-sm">
                      Open thumbnail
                    </a>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                    Use the player controls for play, pause, seek, volume and fullscreen.
                  </span>
                </div>
              )}

              {selected.regeneration_feedback && scriptStatus !== 'SCRIPT_APPROVED' && (
                <div style={{ marginTop: '10px' }}>
                  <Banner tone="warning">
                    <strong>Changes requested:</strong> {selected.regeneration_feedback}
                    <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                      Revise and re-approve the script in Step 4, then render again before approving this video.
                    </div>
                  </Banner>
                </div>
              )}

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-raised)',
                }}
              >
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  onClick={approve}
                  disabled={!canApprove || busy !== null}
                  title={
                    !canApprove
                      ? !isRendered
                        ? 'Render the video first'
                        : scriptStatus !== 'SCRIPT_APPROVED'
                        ? 'The script must be approved and the video re-rendered'
                        : 'Already approved or published'
                      : ''
                  }
                >
                  {busy === 'approve' ? <Loader2 size={14} /> : <CheckCircle2 size={14} />}
                  {busy === 'approve' ? 'Approving…' : status === 'APPROVED' || status === 'PUBLISHED' ? 'Video approved' : 'Approve video'}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost"
                  onClick={() => setShowRegenForm((s) => !s)}
                  disabled={busy !== null || status === 'PUBLISHED'}
                  title={status === 'PUBLISHED' ? 'Published videos cannot be sent back for regeneration' : ''}
                >
                  <MessageSquareWarning size={14} /> Request regeneration
                </button>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px', maxWidth: '360px' }}>
                  <ShieldCheck size={13} /> Approval does not publish. Students only see videos published in Step 7.
                </span>
              </div>

              {showRegenForm && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--admin-warning)',
                    backgroundColor: 'var(--admin-warning-soft)',
                  }}
                >
                  <label style={labelStyle}>What must change? (required)</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '76px', resize: 'vertical', lineHeight: 1.5 }}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="e.g. Narration is too fast in the worked example; the entropy formula is read incorrectly; add a recap at the end."
                    maxLength={2000}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary adm-btn-sm"
                      onClick={requestRegeneration}
                      disabled={busy !== null || !feedback.trim()}
                    >
                      {busy === 'regen' ? <Loader2 size={12} /> : <RefreshCw size={12} />} Send request
                    </button>
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setShowRegenForm(false)}>
                      Cancel
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--admin-warning)' }}>
                      The current MP4 is preserved; the script returns to review for re-scripting.
                    </span>
                  </div>
                  {scriptStatus === 'NEEDS_REVIEW' && (
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginTop: '8px' }} onClick={onGoToScripts}>
                      <FileText size={12} /> Go to Step 4 to regenerate the script
                    </button>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '14px', borderBottom: '1px solid var(--admin-border)' }}>
                {[
                  { key: 'script' as const, label: 'Script vs narration', icon: <FileText size={12} /> },
                  { key: 'captions' as const, label: `Captions (${cues.length})`, icon: <Captions size={12} /> },
                  { key: 'details' as const, label: 'Render details', icon: <Clapperboard size={12} /> },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${tab === t.key ? 'var(--admin-primary)' : 'transparent'}`,
                      color: tab === t.key ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div style={{ paddingTop: '12px' }}>
                {tab === 'script' && (
                  <div>
                    {loadingScript ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
                        <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading script…
                      </div>
                    ) : !script ? (
                      <Banner tone="warning">The script for this video could not be loaded.</Banner>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ ...subTextStyle, marginTop: 0 }}>
                          Version {script.version_number} · {script.word_count} words ·{' '}
                          {script.script_status === 'SCRIPT_APPROVED' ? 'approved for this render' : script.script_status.replace(/_/g, ' ').toLowerCase()} ·
                          quality {Math.round(script.quality_score)}/100
                        </div>
                        {(script.sections || []).map((section, i) => (
                          <div
                            key={`${section.section_id}-${i}`}
                            style={{
                              border: '1px solid var(--admin-border)',
                              borderRadius: '8px',
                              padding: '10px',
                              backgroundColor: 'var(--admin-surface-raised)',
                            }}
                          >
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--admin-primary-soft)',
                                  color: 'var(--admin-primary)',
                                }}
                              >
                                {section.type.replace(/_/g, ' ')}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)' }}>{section.title}</span>
                              <span style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)' }}>
                                pages {(section.source_pages || []).join(', ') || '—'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: 'var(--admin-text)', whiteSpace: 'pre-wrap' }}>
                              {section.narration}
                            </p>
                          </div>
                        ))}
                        {(!script.sections || script.sections.length === 0) && script.narration_text && (
                          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{script.narration_text}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'captions' && (
                  <div>
                    {cues.length === 0 ? (
                      <Banner tone="warning">
                        No caption file was produced for this video. Captions are generated during rendering; re-render to regenerate them.
                      </Banner>
                    ) : (
                      <>
                        <div style={{ ...subTextStyle, marginTop: 0, marginBottom: '8px' }}>
                          The player has a selectable English subtitle track. Cue preview:
                        </div>
                        <div
                          style={{
                            maxHeight: '340px',
                            overflowY: 'auto',
                            border: '1px solid var(--admin-border)',
                            borderRadius: '8px',
                          }}
                        >
                          {cues.map((cue, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                gap: '10px',
                                padding: '6px 10px',
                                borderBottom: '1px solid var(--admin-border)',
                                backgroundColor: i % 2 ? 'var(--admin-surface-raised)' : 'transparent',
                                fontSize: '12px',
                              }}
                            >
                              <span style={{ color: 'var(--admin-primary)', fontFamily: 'monospace', fontSize: '10.5px', minWidth: '120px' }}>
                                {cue.start} → {cue.end}
                              </span>
                              <span style={{ color: 'var(--admin-text)' }}>{cue.text}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'details' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {[
                      ['Render status', selected.render_status],
                      ['Video status', selected.status],
                      ['Script status', selected.script_status || '—'],
                      ['Duration', formatDuration(selected.actual_duration_seconds || selected.approved_duration_seconds)],
                      ['TTS engine', selected.tts_engine || '—'],
                      ['Voice', selected.voice || '—'],
                      ['Render engine', selected.render_engine || '—'],
                      ['Version', String(selected.version_number ?? 1)],
                      ['Rendered at', selected.rendered_at ? new Date(selected.rendered_at).toLocaleString() : '—'],
                      ['MP4 key', selected.video_storage_key || '—'],
                    ].map(([label, value]) => (
                      <div key={label as string} style={{ fontSize: '12px' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {label}
                        </div>
                        <div style={{ color: 'var(--admin-text)', marginTop: '2px', wordBreak: 'break-all' }}>{value as string}</div>
                      </div>
                    ))}
                    {selected.render_error && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Banner tone="error">
                          <strong>Render error:</strong> {selected.render_error}
                        </Banner>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: '18px',
          paddingTop: '14px',
          borderTop: '1px solid var(--admin-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
          {reviewable.filter((v) => ['APPROVED', 'PUBLISHED'].includes((v.status || '').toUpperCase())).length} approved ·{' '}
          {reviewable.filter((v) => (v.status || '').toUpperCase() === 'REVIEW' && (v.render_status || '').toUpperCase() === 'RENDERED').length}{' '}
          awaiting review
        </span>
        <button type="button" className="adm-btn adm-btn-primary" onClick={onNext}>
          Continue to publish
        </button>
      </div>
    </SurfacePanel>
  );
};
