import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { StatusBadge } from '../../StatusBadge';
import { ScriptItem, ScriptSection, VideoPlan, VideoRenderDetails } from '../../../lib/types';
import { api } from '../../../lib/api';
import {
  Banner,
  EmptyHint,
  SectionHeader,
  formatDuration,
  inputStyle,
  labelStyle,
  subTextStyle,
} from './StudioUi';

interface ScriptsPanelProps {
  plans: VideoPlan[];
  videos: VideoRenderDetails[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

const scriptLabel = (status?: string | null): string => {
  const s = (status || '').toUpperCase();
  if (s === 'SCRIPT_APPROVED') return 'Script Approved';
  if (s === 'SCRIPT_REVIEW') return 'Script Review';
  if (s === 'NEEDS_REVIEW') return 'Needs Review';
  if (s === 'GENERATING') return 'Generating';
  if (s === 'SCRIPT_GENERATION_QUEUED') return 'Queued';
  if (s === 'READY_FOR_VIDEO_GENERATION') return 'Ready to Render';
  return s ? s.replace(/_/g, ' ') : 'No Script';
};

/**
 * Step 4 — Script generation.
 * Generates one grounded teaching script per approved video plan, supports
 * preview, section-level editing, per-script regeneration and approval.
 */
export const ScriptsPanel: React.FC<ScriptsPanelProps> = ({ plans, videos, loading, onRefresh, onNext, onBack }) => {
  const [scripts, setScripts] = useState<Record<number, ScriptItem | null>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSections, setDraftSections] = useState<ScriptSection[]>([]);
  const [bulkProgress, setBulkProgress] = useState('');
  const [narrationStyle, setNarrationStyle] = useState<'teacher' | 'conversation'>('teacher');

  const videosById = useMemo(() => {
    const map = new Map<number, VideoRenderDetails>();
    videos.forEach((v) => map.set(v.video_id || v.id, v));
    return map;
  }, [videos]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.topic_title || '').localeCompare(b.topic_title || '') || (a.sequence_number || 0) - (b.sequence_number || 0)),
    [plans]
  );

  const approvedPlanCount = plans.filter((p) => ['APPROVED', 'PUBLISHED'].includes((p.status || '').toUpperCase())).length;
  const approvedScripts = plans.filter(
    (p) => (videosById.get(p.id)?.script_status || '').toUpperCase() === 'SCRIPT_APPROVED'
  ).length;
  const missingScripts = plans.filter((p) => {
    const s = (videosById.get(p.id)?.script_status || '').toUpperCase();
    return !s || s === 'NEEDS_REVIEW';
  }).length;

  const allApproved = plans.length > 0 && approvedScripts === plans.length;

  const applyScript = (id: number, script: ScriptItem) => {
    setScripts((prev) => ({ ...prev, [id]: script }));
    setDraftTitle(script.title || '');
    setDraftSections(script.sections || []);
  };

  const openScript = async (plan: VideoPlan) => {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(plan.id);
    setError(null);
    if (scripts[plan.id] !== undefined) {
      const existing = scripts[plan.id];
      if (existing) {
        setDraftTitle(existing.title || '');
        setDraftSections(existing.sections || []);
      }
      return;
    }
    try {
      setLoadingId(plan.id);
      const script = await api.getVideoPlanScript(plan.id);
      applyScript(plan.id, script);
    } catch (err: any) {
      // 404 = no script generated yet, which is a valid state.
      setScripts((prev) => ({ ...prev, [plan.id]: null }));
    } finally {
      setLoadingId(null);
    }
  };

  const run = async (key: string, fn: () => Promise<void>, successMessage?: string) => {
    try {
      setBusyKey(key);
      setError(null);
      setSuccess(null);
      await fn();
      await onRefresh();
      if (successMessage) setSuccess(successMessage);
    } catch (err: any) {
      setError(err?.message || 'This action failed. Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const generateOne = (plan: VideoPlan, force: boolean) => {
    if (force && !window.confirm(`Regenerate the script for “${plan.title}”? The current script will be replaced.`)) return;
    run(`generate-${plan.id}`, async () => {
      const script = await api.generateVideoScript(plan.id, force, undefined, narrationStyle);
      applyScript(plan.id, script);
      setExpandedId(plan.id);
    }, force ? 'Script regenerated. Review it before approving.' : 'Script generated. Review it before approving.');
  };

  const approveOne = (plan: VideoPlan) =>
    run(`approve-${plan.id}`, async () => {
      await api.approveScript(plan.id);
    }, 'Script approved. It is now eligible for rendering.');

  const saveEdits = (plan: VideoPlan) => {
    if (draftSections.some((s) => !s.narration || !s.narration.trim())) {
      setError('Every section needs narration before saving. Remove or rewrite empty sections.');
      return;
    }
    run(`save-${plan.id}`, async () => {
      const updated = await api.patchScript(plan.id, {
        title: draftTitle,
        sections: draftSections,
      } as any);
      applyScript(plan.id, updated);
    }, 'Script saved. The text is now the script used for narration and captions.');
  };

  const generateAllMissing = async () => {
    const targets = sortedPlans.filter((p) => {
      if (!['APPROVED', 'PUBLISHED'].includes((p.status || '').toUpperCase())) return false;
      const s = (videosById.get(p.id)?.script_status || '').toUpperCase();
      return s !== 'SCRIPT_APPROVED';
    });
    if (targets.length === 0) {
      setSuccess('Every approved plan already has an approved script.');
      return;
    }
    setBusyKey('generate-all');
    setError(null);
    setSuccess(null);
    const failures: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const plan = targets[i];
      setBulkProgress(`Generating script ${i + 1} of ${targets.length}: ${plan.title}`);
      try {
        const script = await api.generateVideoScript(plan.id, false, undefined, narrationStyle);
        applyScript(plan.id, script);
      } catch (err: any) {
        failures.push(`${plan.title}: ${err?.message || 'failed'}`);
      }
    }
    setBulkProgress('');
    await onRefresh();
    setBusyKey(null);
    if (failures.length) setError(failures.join(' · '));
    else setSuccess(`Generated ${targets.length} script${targets.length !== 1 ? 's' : ''}. Review and approve each one.`);
  };

  const approveAllReviewed = async () => {
    const targets = sortedPlans.filter((p) => {
      const s = (videosById.get(p.id)?.script_status || '').toUpperCase();
      return s === 'SCRIPT_REVIEW';
    });
    if (targets.length === 0) {
      setError('There are no scripts in review. Generate or edit scripts first.');
      return;
    }
    if (!window.confirm(`Approve ${targets.length} script${targets.length !== 1 ? 's' : ''} that are in review?`)) return;
    setBusyKey('approve-all');
    setError(null);
    const failures: string[] = [];
    for (const plan of targets) {
      try {
        await api.approveScript(plan.id);
      } catch (err: any) {
        failures.push(`${plan.title}: ${err?.message || 'failed'}`);
      }
    }
    await onRefresh();
    setBusyKey(null);
    if (failures.length) setError(failures.join(' · '));
    else setSuccess(`Approved ${targets.length} script${targets.length !== 1 ? 's' : ''}.`);
  };

  const updateSection = (index: number, patch: Partial<ScriptSection>) => {
    setDraftSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading scripts…
        </div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 4 · Teaching scripts"
        description="One grounded script per approved plan, generated from the chapter content and source pages. Preview, edit, regenerate and approve each script before rendering."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Style:</span>
              <select
                value={narrationStyle}
                onChange={(e) => setNarrationStyle(e.target.value as any)}
                style={{
                  ...inputStyle,
                  padding: '3px 8px',
                  fontSize: '11.5px',
                  height: '28px',
                  width: 'auto',
                  borderRadius: '6px',
                  backgroundColor: 'var(--admin-surface-raised)',
                }}
                title="Choose narration style for script generation"
              >
                <option value="teacher">Teacher Narration</option>
                <option value="conversation">Teacher–Student Conversation</option>
              </select>
            </div>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Back
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={generateAllMissing}
              disabled={busyKey !== null || plans.length === 0}
            >
              {busyKey === 'generate-all' ? <Loader2 size={13} /> : <Sparkles size={13} />}
              {busyKey === 'generate-all' ? 'Generating…' : 'Generate missing scripts'}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={approveAllReviewed}
              disabled={busyKey !== null}
            >
              {busyKey === 'approve-all' ? <Loader2 size={13} /> : <CheckCircle2 size={13} />}
              Approve reviewed scripts
            </button>
          </div>
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
      {bulkProgress && (
        <div style={{ marginBottom: '12px' }}>
          <Banner tone="info">{bulkProgress}</Banner>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {[
          { label: 'Approved plans', value: `${approvedPlanCount}/${plans.length}` },
          { label: 'Approved scripts', value: `${approvedScripts}/${plans.length}` },
          { label: 'Needs script / review', value: String(missingScripts) },
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

      {plans.length === 0 ? (
        <EmptyHint
          title="No approved plans"
          description="Approve the video plans in Step 3 first. Scripts are generated only for approved plans."
          action={
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Back to plans
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedPlans.map((plan) => {
            const video = videosById.get(plan.id);
            const status = (video?.script_status || '').toUpperCase();
            const planApproved = ['APPROVED', 'PUBLISHED'].includes((plan.status || '').toUpperCase());
            const cached = scripts[plan.id];
            const expanded = expandedId === plan.id;
            const feedback = video?.regeneration_feedback;

            return (
              <div
                key={plan.id}
                style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--admin-surface-raised)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px' }}>
                  <button
                    type="button"
                    onClick={() => openScript(plan)}
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--admin-text-secondary)', marginTop: '2px' }}
                    aria-label={expanded ? 'Collapse script' : 'Expand script'}
                  >
                    {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-text)' }}>{plan.title}</span>
                      <StatusBadge status={scriptLabel(video?.script_status)} />
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                        {plan.topic_title} · {formatDuration(plan.estimated_duration_seconds || plan.duration_seconds)} · pages{' '}
                        {plan.source_start_page ?? '—'}–{plan.source_end_page ?? '—'}
                      </span>
                    </div>
                    {!planApproved && (
                      <div style={{ fontSize: '11.5px', color: 'var(--admin-warning)', marginTop: '3px' }}>
                        This plan is not approved yet — approve it in Step 3 to generate a script.
                      </div>
                    )}
                    {feedback && status !== 'SCRIPT_APPROVED' && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--admin-warning-soft)',
                          color: 'var(--admin-warning)',
                          fontSize: '12px',
                          display: 'flex',
                          gap: '7px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <MessageSquareWarning size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>
                          <strong>Admin requested changes:</strong> {feedback}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(!status || status === 'NEEDS_REVIEW') && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-primary adm-btn-sm"
                        disabled={!planApproved || busyKey !== null}
                        onClick={() => generateOne(plan, status === 'NEEDS_REVIEW')}
                      >
                        {busyKey === `generate-${plan.id}` ? <Loader2 size={12} /> : <Sparkles size={12} />}
                        {status === 'NEEDS_REVIEW' ? 'Regenerate' : 'Generate script'}
                      </button>
                    )}
                    {status && status !== 'SCRIPT_APPROVED' && (
                      <>
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost adm-btn-sm"
                          disabled={busyKey !== null}
                          onClick={() => generateOne(plan, true)}
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-primary adm-btn-sm"
                          disabled={busyKey !== null || status === 'GENERATING' || status === 'SCRIPT_GENERATION_QUEUED'}
                          onClick={() => approveOne(plan)}
                        >
                          {busyKey === `approve-${plan.id}` ? <Loader2 size={12} /> : <CheckCircle2 size={12} />} Approve
                        </button>
                      </>
                    )}
                    {status === 'SCRIPT_APPROVED' && (
                      <span style={{ fontSize: '11.5px', color: 'var(--admin-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Approved
                      </span>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div style={{ borderTop: '1px solid var(--admin-border)', padding: '14px' }}>
                    {loadingId === plan.id ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
                        <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading script…
                      </div>
                    ) : !cached ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)' }}>
                        No script yet. Generate one from the approved plan.
                      </div>
                    ) : (
                      <div>
                        {cached.warnings && cached.warnings.length > 0 && (
                          <div
                            style={{
                              marginBottom: '10px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--admin-warning-soft)',
                              color: 'var(--admin-warning)',
                              fontSize: '11.5px',
                              display: 'flex',
                              gap: '6px',
                            }}
                          >
                            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span>{cached.warnings.join(' · ')}</span>
                          </div>
                        )}
                        <div style={{ ...subTextStyle, marginBottom: '10px' }}>
                          Engine: {cached.generation_engine} · {cached.word_count} words · quality {Math.round(cached.quality_score)}/100 ·
                          estimated {formatDuration(cached.estimated_duration_seconds)} · pages {cached.source_page_start ?? '—'}–
                          {cached.source_page_end ?? '—'}
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <label style={labelStyle}>Script title</label>
                          <input
                            style={inputStyle}
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            disabled={status === 'SCRIPT_APPROVED'}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {draftSections.map((section, index) => (
                            <div
                              key={`${section.section_id}-${index}`}
                              style={{
                                border: '1px solid var(--admin-border)',
                                borderRadius: '8px',
                                padding: '10px',
                                backgroundColor: 'var(--admin-surface)',
                              }}
                            >
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.4px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--admin-primary-soft)',
                                    color: 'var(--admin-primary)',
                                  }}
                                >
                                  {section.type.replace(/_/g, ' ')}
                                </span>
                                {section.speaker && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: section.speaker.toLowerCase() === 'student' ? 'var(--admin-primary-soft)' : 'var(--admin-surface-raised)',
                                      color: section.speaker.toLowerCase() === 'student' ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                                      border: '1px solid var(--admin-border)',
                                    }}
                                  >
                                    {section.speaker}
                                  </span>
                                )}
                                <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                  Source pages: {(section.source_pages || []).join(', ') || '—'}
                                  {section.visual_type ? ` · Visual: ${section.visual_type.replace(/_/g, ' ').toLowerCase()}` : ''}
                                </span>
                              </div>
                              <input
                                style={{ ...inputStyle, marginBottom: '6px', fontWeight: 600 }}
                                value={section.title}
                                onChange={(e) => updateSection(index, { title: e.target.value })}
                                disabled={status === 'SCRIPT_APPROVED'}
                              />
                              <textarea
                                style={{ ...inputStyle, minHeight: '84px', resize: 'vertical', lineHeight: 1.55 }}
                                value={section.narration}
                                onChange={(e) => updateSection(index, { narration: e.target.value })}
                                disabled={status === 'SCRIPT_APPROVED'}
                              />
                              {section.formula && (
                                <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--admin-text-secondary)' }}>
                                  Formula: <code>{section.formula}</code>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {status !== 'SCRIPT_APPROVED' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="adm-btn adm-btn-primary adm-btn-sm"
                              onClick={() => saveEdits(plan)}
                              disabled={busyKey !== null}
                            >
                              {busyKey === `save-${plan.id}` ? <Loader2 size={12} /> : <Save size={12} />} Save script edits
                            </button>
                            <button
                              type="button"
                              className="adm-btn adm-btn-ghost adm-btn-sm"
                              onClick={() => {
                                applyScript(plan.id, cached);
                                setSuccess('Unsaved edits discarded.');
                              }}
                              disabled={busyKey !== null}
                            >
                              Revert edits
                            </button>
                          </div>
                        )}
                        {status === 'SCRIPT_APPROVED' && (
                          <div style={{ marginTop: '10px', fontSize: '11.5px', color: 'var(--admin-text-secondary)' }}>
                            <FileText size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            This approved script is locked for rendering. Admin-requested changes from the review screen unlock it for
                            regeneration.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
          {allApproved
            ? 'Every plan has an approved script. Continue to render the videos.'
            : `${approvedScripts} of ${plans.length} scripts approved. All scripts must be approved before rendering.`}
        </span>
        <button type="button" className="adm-btn adm-btn-primary" disabled={!allApproved} onClick={onNext}>
          Continue to rendering
        </button>
      </div>
    </SurfacePanel>
  );
};
