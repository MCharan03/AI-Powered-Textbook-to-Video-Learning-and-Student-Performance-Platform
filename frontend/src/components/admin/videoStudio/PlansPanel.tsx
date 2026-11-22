import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { StatusBadge } from '../../StatusBadge';
import { TextbookHierarchy, Topic, VideoPlan } from '../../../lib/types';
import { api } from '../../../lib/api';
import {
  Banner,
  EmptyHint,
  Field,
  SectionHeader,
  formatDuration,
  inputStyle,
  labelStyle,
  subTextStyle,
} from './StudioUi';

interface PlansPanelProps {
  hierarchy: TextbookHierarchy | null;
  selectedChapterIds: number[];
  plans: VideoPlan[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

interface PlanDraft {
  title: string;
  description: string;
  learning_objective: string;
  content_outline: string;
  duration: string;
  start: string;
  end: string;
}

const emptyDraft = (topic?: Topic): PlanDraft => ({
  title: '',
  description: '',
  learning_objective: '',
  content_outline: '',
  duration: '330',
  start: topic?.source_start_page ? String(topic.source_start_page) : '',
  end: topic?.source_end_page ? String(topic.source_end_page) : '',
});

const planLabel = (plan: VideoPlan): string => {
  const status = (plan.status || '').toUpperCase();
  if (status === 'PUBLISHED') return 'Published';
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REVIEW') return 'Planned';
  return status ? status.replace(/_/g, ' ') : 'Draft';
};

/**
 * Step 3 — AI Video Planning.
 * Displays the real dynamically segmented video plans (no fixed count), and
 * allows the admin to add, edit, reorder, remove and explicitly approve them.
 */
export const PlansPanel: React.FC<PlansPanelProps> = ({
  hierarchy,
  selectedChapterIds,
  plans,
  loading,
  onRefresh,
  onNext,
  onBack,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft());
  const [addTopicId, setAddTopicId] = useState<number | null>(null);

  const selectedChapters = useMemo(
    () => (hierarchy?.chapters || []).filter((c) => selectedChapterIds.includes(c.id)),
    [hierarchy, selectedChapterIds]
  );

  const topics = useMemo(
    () => selectedChapters.flatMap((c) => (c.topics || []).map((t) => ({ topic: t, chapterTitle: c.title }))),
    [selectedChapters]
  );

  const byTopic = useMemo(() => {
    const map = new Map<number, VideoPlan[]>();
    plans.forEach((p) => {
      if (!p.topic_id) return;
      const list = map.get(p.topic_id) || [];
      list.push(p);
      map.set(p.topic_id, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0)));
    return map;
  }, [plans]);

  const pendingCount = plans.filter((p) => !['APPROVED', 'PUBLISHED'].includes((p.status || '').toUpperCase())).length;
  const approvedCount = plans.filter((p) => ['APPROVED', 'PUBLISHED'].includes((p.status || '').toUpperCase())).length;
  const totalSeconds = plans.reduce((sum, p) => sum + (p.estimated_duration_seconds || p.duration_seconds || 0), 0);
  const allApproved = plans.length > 0 && pendingCount === 0;

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

  const handleGenerate = () => {
    if (selectedChapterIds.length === 0) {
      setError('Select at least one chapter in Step 2 before generating plans.');
      return;
    }
    run(
      'generate',
      async () => {
        const messages: string[] = [];
        for (const chapterId of selectedChapterIds) {
          try {
            await api.generateVideoPlansForChapter(chapterId, false);
          } catch (err: any) {
            messages.push(err?.message || `Chapter ${chapterId} failed`);
          }
        }
        if (messages.length) setError(messages.join(' · '));
      },
      'Video plans generated. Topics that already had plans were left untouched.'
    );
  };

  const handleApproveAll = () =>
    run(
      'approve-all',
      async () => {
        for (const plan of plans) {
          if (!['APPROVED', 'PUBLISHED'].includes((plan.status || '').toUpperCase())) {
            await api.approveVideoPlan(plan.id);
          }
        }
      },
      'All video plans approved. Script generation is now unlocked.'
    );

  const handleApprove = (plan: VideoPlan) =>
    run(`approve-${plan.id}`, async () => {
      await api.approveVideoPlan(plan.id);
    });

  const handleDelete = (plan: VideoPlan) => {
    if (!window.confirm(`Remove the plan “${plan.title}”? This cannot be undone.`)) return;
    run(`delete-${plan.id}`, async () => {
      await api.deleteVideoPlan(plan.id);
    }, 'Plan removed.');
  };

  const move = (plan: VideoPlan, direction: -1 | 1) => {
    const siblings = (byTopic.get(plan.topic_id || 0) || []).slice();
    const idx = siblings.findIndex((p) => p.id === plan.id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    run(`move-${plan.id}`, async () => {
      const a = plan.sequence_number || idx + 1;
      const b = swapWith.sequence_number || idx + direction + 1;
      await api.patchVideoPlan(plan.id, { sequence_number: b } as any);
      await api.patchVideoPlan(swapWith.id, { sequence_number: a } as any);
    });
  };

  const startEdit = (plan: VideoPlan) => {
    setEditingId(plan.id);
    setDraft({
      title: plan.title,
      description: plan.description || '',
      learning_objective: plan.learning_objective || '',
      content_outline: (plan.content_outline || []).join('\n'),
      duration: String(plan.estimated_duration_seconds || plan.duration_seconds || 330),
      start: plan.source_start_page ? String(plan.source_start_page) : '',
      end: plan.source_end_page ? String(plan.source_end_page) : '',
    });
  };

  const parseDraft = (d: PlanDraft) => {
    const start = d.start === '' ? undefined : Number(d.start);
    const end = d.end === '' ? undefined : Number(d.end);
    const duration = Number(d.duration);
    if (!d.title.trim()) throw new Error('Video title is required.');
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duration must be a positive number of seconds.');
    if (start !== undefined && end !== undefined && end < start) {
      throw new Error('Source end page cannot precede the start page.');
    }
    return {
      title: d.title.trim(),
      description: d.description.trim() || undefined,
      learning_objective: d.learning_objective.trim() || undefined,
      content_outline: d.content_outline
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      duration_seconds: duration,
      estimated_duration_seconds: duration,
      source_start_page: start,
      source_end_page: end,
    };
  };

  const saveEdit = () => {
    if (editingId === null) return;
    let payload: ReturnType<typeof parseDraft>;
    try {
      payload = parseDraft(draft);
    } catch (err: any) {
      setError(err.message);
      return;
    }
    run(`save-${editingId}`, async () => {
      await api.patchVideoPlan(editingId, payload as any);
      setEditingId(null);
    }, 'Plan updated.');
  };

  const saveNew = (topic: Topic) => {
    let payload: ReturnType<typeof parseDraft>;
    try {
      payload = parseDraft(draft);
    } catch (err: any) {
      setError(err.message);
      return;
    }
    if (payload.content_outline.length === 0) {
      setError('Add at least one outline item so the script generator has a scope.');
      return;
    }
    run(`add-${topic.id}`, async () => {
      await api.createVideoPlan(topic.id, {
        title: payload.title,
        description: payload.description,
        duration_seconds: payload.duration_seconds,
        estimated_duration_seconds: payload.estimated_duration_seconds,
        source_start_page: payload.source_start_page,
        source_end_page: payload.source_end_page,
        learning_objective: payload.learning_objective,
        content_outline: payload.content_outline,
      });
      setAddTopicId(null);
    }, 'Plan added. Approve it when you are ready.');
  };

  const planForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div
      style={{
        marginTop: '10px',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--admin-border)',
        backgroundColor: 'var(--admin-surface)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <Field label="Video title">
          <input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Estimated duration (seconds)">
          <input
            type="number"
            min={30}
            style={inputStyle}
            value={draft.duration}
            onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
          />
        </Field>
        <Field label="Source start page">
          <input type="number" min={1} style={inputStyle} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        </Field>
        <Field label="Source end page">
          <input type="number" min={1} style={inputStyle} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
        </Field>
      </div>
      <Field label="Description / rationale" hint="Why this video exists and what it focuses on.">
        <input
          style={inputStyle}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </Field>
      <Field label="Learning objectives" hint="Shown to the admin and used to ground the script.">
        <input
          style={inputStyle}
          value={draft.learning_objective}
          onChange={(e) => setDraft({ ...draft, learning_objective: e.target.value })}
        />
      </Field>
      <Field label="Content outline" hint="One item per line. These become the script's teaching beats.">
        <textarea
          style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
          value={draft.content_outline}
          onChange={(e) => setDraft({ ...draft, content_outline: e.target.value })}
        />
      </Field>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={onSave} disabled={busyKey !== null}>
          {busyKey ? <Loader2 size={12} /> : null} {saveLabel}
        </button>
        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading video plans…
        </div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 3 · AI video planning"
        description="The segmentation service decides how many videos each topic needs from its complexity, subtopics and source material — never a fixed count. Review, adjust and approve the plans."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Back
            </button>
            <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={handleGenerate} disabled={busyKey !== null}>
              {busyKey === 'generate' ? <Loader2 size={13} /> : <Sparkles size={13} />}
              {busyKey === 'generate' ? 'Generating…' : 'Generate plans'}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={handleApproveAll}
              disabled={busyKey !== null || plans.length === 0 || pendingCount === 0}
            >
              {busyKey === 'approve-all' ? <Loader2 size={13} /> : <Wand2 size={13} />}
              {busyKey === 'approve-all' ? 'Approving…' : `Approve all plans${pendingCount ? ` (${pendingCount})` : ''}`}
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {[
          { label: 'Planned videos', value: String(plans.length) },
          { label: 'Approved', value: `${approvedCount}/${plans.length}` },
          { label: 'Pending approval', value: String(pendingCount) },
          { label: 'Estimated runtime', value: formatDuration(totalSeconds) },
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

      {selectedChapterIds.length === 0 ? (
        <Banner tone="warning">No chapters are selected. Go back to Step 2 and select the chapters you want videos for.</Banner>
      ) : plans.length === 0 ? (
        <EmptyHint
          title="No video plans yet"
          description="Generate plans for the selected chapters. The service groups related small topics and splits complex concepts into separate videos based on the source material."
          action={
            <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={handleGenerate} disabled={busyKey !== null}>
              <Sparkles size={13} /> Generate plans for selected chapters
            </button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {topics.map(({ topic, chapterTitle }) => {
            const topicPlans = byTopic.get(topic.id) || [];
            return (
              <div
                key={topic.id}
                style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--radius-lg, 10px)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--admin-surface-raised)',
                }}
              >
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--admin-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <ClipboardList size={14} style={{ color: 'var(--admin-primary)' }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-text)' }}>{topic.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>· {chapterTitle}</span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                      · Pages {topic.source_start_page ?? '—'}–{topic.source_end_page ?? '—'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                      · {topicPlans.length} video{topicPlans.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {topic.description && <div style={subTextStyle}>{topic.description}</div>}
                </div>

                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {topicPlans.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      No plans for this topic yet. Generate plans or add one manually.
                    </div>
                  )}

                  {topicPlans.map((plan, idx) => {
                    const approved = ['APPROVED', 'PUBLISHED'].includes((plan.status || '').toUpperCase());
                    const isEditing = editingId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        style={{
                          border: '1px solid var(--admin-border)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          backgroundColor: 'var(--admin-surface)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div
                            style={{
                              minWidth: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--admin-primary-soft)',
                              color: 'var(--admin-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {plan.sequence_number}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-text)' }}>{plan.title}</span>
                              <StatusBadge status={planLabel(plan)} />
                              <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                {formatDuration(plan.estimated_duration_seconds || plan.duration_seconds)} · pages{' '}
                                {plan.source_start_page ?? '—'}–{plan.source_end_page ?? '—'}
                              </span>
                            </div>
                            {plan.learning_objective && (
                              <div style={{ ...subTextStyle, marginTop: '5px' }}>
                                <strong>Objective:</strong> {plan.learning_objective}
                              </div>
                            )}
                            {(plan.content_outline || []).length > 0 && (
                              <ul style={{ margin: '5px 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--admin-text-secondary)', lineHeight: 1.55 }}>
                                {(plan.content_outline || []).map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            )}
                            {isEditing && planForm(saveEdit, () => setEditingId(null), 'Save plan')}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                                title="Move up"
                                disabled={idx === 0 || busyKey !== null || approved}
                                onClick={() => move(plan, -1)}
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                                title="Move down"
                                disabled={idx === topicPlans.length - 1 || busyKey !== null || approved}
                                onClick={() => move(plan, 1)}
                              >
                                <ChevronDown size={12} />
                              </button>
                              <button
                                type="button"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                                title={approved ? 'Approved plans must be unapproved before editing' : 'Edit plan'}
                                disabled={approved || busyKey !== null}
                                onClick={() => startEdit(plan)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                                title={approved ? 'Approved plans cannot be deleted' : 'Delete plan'}
                                disabled={approved || busyKey !== null}
                                onClick={() => handleDelete(plan)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {!approved && (
                              <button
                                type="button"
                                className="adm-btn adm-btn-primary adm-btn-sm"
                                disabled={busyKey !== null}
                                onClick={() => handleApprove(plan)}
                              >
                                {busyKey === `approve-${plan.id}` ? <Loader2 size={12} /> : null} Approve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {addTopicId === topic.id ? (
                    planForm(() => saveNew(topic), () => setAddTopicId(null), 'Add plan')
                  ) : (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => {
                        setAddTopicId(topic.id);
                        setEditingId(null);
                        setDraft(emptyDraft(topic));
                      }}
                    >
                      <Plus size={12} /> Add another video for this topic
                    </button>
                  )}
                </div>
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
            ? 'All plans are approved. Continue to generate teaching scripts.'
            : `${pendingCount} plan${pendingCount !== 1 ? 's' : ''} still need approval before scripts can be generated.`}
        </span>
        <button type="button" className="adm-btn adm-btn-primary" disabled={!allApproved} onClick={onNext}>
          Continue to scripts
        </button>
      </div>
    </SurfacePanel>
  );
};
