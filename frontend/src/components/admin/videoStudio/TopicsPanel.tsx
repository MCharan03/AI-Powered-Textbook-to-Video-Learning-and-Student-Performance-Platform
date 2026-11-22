import React, { useState } from 'react';
import { CheckCircle2, FileEdit, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { StatusBadge } from '../../StatusBadge';
import { TextbookHierarchy, Chapter, Topic, Subtopic } from '../../../lib/types';
import { api } from '../../../lib/api';
import { Banner, SectionHeader, inputStyle, labelStyle, subTextStyle } from './StudioUi';

interface TopicsPanelProps {
  hierarchy: TextbookHierarchy | null;
  loading: boolean;
  selectedChapterIds: number[];
  onToggleChapter: (chapterId: number) => void;
  onSelectAll: () => void;
  onRefresh: () => Promise<void>;
  onApproved: () => void;
}

type EditTarget =
  | { kind: 'chapter'; id: number; title: string; description: string; start: string; end: string }
  | { kind: 'topic'; id: number; title: string; description: string; start: string; end: string }
  | { kind: 'subtopic'; id: number; title: string; description: string; start: string; end: string };

const pageValue = (v?: number) => (v === undefined || v === null ? '' : String(v));

/**
 * Step 2 — Extract Topics.
 * Shows the real extracted chapter/topic/subtopic hierarchy and allows full
 * structural editing (rename, add, edit, remove) with source page references.
 */
export const TopicsPanel: React.FC<TopicsPanelProps> = ({
  hierarchy,
  loading,
  selectedChapterIds,
  onToggleChapter,
  onSelectAll,
  onRefresh,
  onApproved,
}) => {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addTopicFor, setAddTopicFor] = useState<number | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [addSubtopicFor, setAddSubtopicFor] = useState<number | null>(null);
  const [newSubtopicTitle, setNewSubtopicTitle] = useState('');
  const [approving, setApproving] = useState(false);

  const chapters = hierarchy?.chapters || [];
  const selectedCount = selectedChapterIds.length;

  const run = async (key: string, fn: () => Promise<any>) => {
    try {
      setBusy(key);
      setError(null);
      await fn();
      setEditing(null);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Update failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    const start = editing.start === '' ? undefined : Number(editing.start);
    const end = editing.end === '' ? undefined : Number(editing.end);
    if (start !== undefined && end !== undefined && end < start) {
      setError('Source end page cannot precede start page.');
      return;
    }
    const payload = {
      title: editing.title.trim(),
      description: editing.description.trim() || undefined,
      source_start_page: start,
      source_end_page: end,
    };
    if (!payload.title) {
      setError('Title cannot be empty.');
      return;
    }
    run(`edit-${editing.kind}-${editing.id}`, async () => {
      if (editing.kind === 'chapter') await api.patchChapter(editing.id, payload as any);
      if (editing.kind === 'topic') await api.patchTopic(editing.id, payload as any);
      if (editing.kind === 'subtopic') await api.patchSubtopic(editing.id, payload as any);
    });
  };

  const startEdit = (kind: EditTarget['kind'], item: Chapter | Topic | Subtopic) =>
    setEditing({
      kind,
      id: item.id,
      title: item.title,
      description: (item as any).description || '',
      start: pageValue(item.source_start_page),
      end: pageValue(item.source_end_page),
    } as EditTarget);

  const handleApprove = async () => {
    if (!hierarchy) return;
    if (selectedCount === 0) {
      setError('Select at least one chapter to continue.');
      return;
    }
    try {
      setApproving(true);
      setError(null);
      await api.approveTextbookCurriculum(hierarchy.textbook_id);
      await onRefresh();
      onApproved();
    } catch (err: any) {
      setError(err?.message || 'Curriculum approval failed.');
    } finally {
      setApproving(false);
    }
  };

  const editForm = (target: EditTarget) => (
    <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={target.title} onChange={(e) => setEditing({ ...target, title: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Source start page</label>
          <input type="number" min={1} style={inputStyle} value={target.start} onChange={(e) => setEditing({ ...target, start: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Source end page</label>
          <input type="number" min={1} style={inputStyle} value={target.end} onChange={(e) => setEditing({ ...target, end: e.target.value })} />
        </div>
      </div>
      <div style={{ marginTop: '8px' }}>
        <label style={labelStyle}>Key concepts / description</label>
        <textarea
          style={{ ...inputStyle, minHeight: '56px', resize: 'vertical' }}
          value={target.description}
          onChange={(e) => setEditing({ ...target, description: e.target.value })}
          placeholder="Key concepts, formulas and scope extracted from this section"
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={saveEdit} disabled={busy !== null}>
          {busy ? <Loader2 size={12} /> : null} Save
        </button>
        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setEditing(null)}>
          Cancel
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading extracted curriculum…
        </div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 2 · Extract topics"
        description="The real hierarchy extracted from the source PDF. Rename, add, edit or remove topics and subtopics, then approve the curriculum to unlock video planning. Source page ranges are preserved."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onSelectAll}>
              {selectedCount === chapters.length && chapters.length > 0 ? 'Clear selection' : 'Select all chapters'}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleApprove}
              disabled={approving || selectedCount === 0}
            >
              {approving ? <Loader2 size={14} /> : <CheckCircle2 size={14} />}
              {approving ? 'Approving…' : 'Approve curriculum & continue'}
            </button>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: '14px' }}>
          <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>
        </div>
      )}

      {chapters.length === 0 ? (
        <Banner tone="warning">
          No curriculum hierarchy is available yet. Start extraction from Step 1 or resume the job from the dashboard.
        </Banner>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
            {selectedCount} of {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} selected for video production.
            Learning objectives and formulas are derived from these source pages in Step 3.
          </div>

          {chapters.map((chapter) => {
            const selected = selectedChapterIds.includes(chapter.id);
            const isEditingChapter = editing?.kind === 'chapter' && editing.id === chapter.id;
            return (
              <div
                key={chapter.id}
                style={{
                  border: `1px solid ${selected ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                  borderRadius: 'var(--radius-lg, 10px)',
                  backgroundColor: 'var(--admin-surface-raised)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', backgroundColor: selected ? 'var(--admin-primary-soft)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleChapter(chapter.id)}
                    aria-label={`Select chapter ${chapter.title}`}
                    style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                        Chapter {chapter.chapter_number}: {chapter.title}
                      </span>
                      {chapter.status && <StatusBadge status={chapter.status} />}
                    </div>
                    <div style={subTextStyle}>
                      Source pages {chapter.source_start_page ?? '—'}–{chapter.source_end_page ?? '—'}
                      {chapter.description ? ` · ${chapter.description}` : ''}
                    </div>
                    {isEditingChapter && editForm(editing)}
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-ghost adm-btn-sm"
                    onClick={() => startEdit('chapter', chapter)}
                    title="Edit chapter"
                  >
                    <FileEdit size={13} />
                  </button>
                </div>

                <div style={{ padding: '6px 16px 16px 42px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(chapter.topics || []).map((topic) => (
                    <div key={topic.id} style={{ borderLeft: '2px solid var(--admin-primary)', paddingLeft: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
                            Topic {topic.sequence_number}: {topic.title}
                          </div>
                          <div style={subTextStyle}>
                            Pages {topic.source_start_page ?? '—'}–{topic.source_end_page ?? '—'}
                            {topic.description ? ` · ${topic.description}` : ''}
                          </div>
                          {editing?.kind === 'topic' && editing.id === topic.id && editForm(editing)}
                        </div>
                        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => startEdit('topic', topic)} title="Edit topic">
                          <FileEdit size={12} />
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost adm-btn-sm"
                          title="Remove topic"
                          disabled={busy !== null}
                          onClick={() => {
                            if (window.confirm(`Remove topic “${topic.title}”? Its subtopics will also be removed.`)) {
                              run(`del-topic-${topic.id}`, () => api.deleteTopic(topic.id));
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {(topic.subtopics || []).map((sub) => (
                          <span
                            key={sub.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              padding: '3px 6px 3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--admin-surface)',
                              border: '1px solid var(--admin-border)',
                              color: 'var(--admin-text-secondary)',
                            }}
                          >
                            {sub.title}
                            <button
                              type="button"
                              onClick={() => startEdit('subtopic', sub)}
                              title="Edit subtopic"
                              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            >
                              <FileEdit size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remove subtopic “${sub.title}”?`)) {
                                  run(`del-sub-${sub.id}`, () => api.deleteSubtopic(sub.id));
                                }
                              }}
                              title="Remove subtopic"
                              style={{ background: 'transparent', border: 'none', color: 'var(--admin-error)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </span>
                        ))}
                        {addSubtopicFor === topic.id ? (
                          <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              autoFocus
                              style={{ ...inputStyle, width: '180px', padding: '3px 6px', fontSize: '11px' }}
                              value={newSubtopicTitle}
                              onChange={(e) => setNewSubtopicTitle(e.target.value)}
                              placeholder="Subtopic title"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSubtopicTitle.trim()) {
                                  run(`add-sub-${topic.id}`, async () => {
                                    await api.createSubtopic(topic.id, {
                                      title: newSubtopicTitle.trim(),
                                      sequence_number: (topic.subtopics?.length || 0) + 1,
                                    });
                                    setNewSubtopicTitle('');
                                    setAddSubtopicFor(null);
                                  });
                                }
                                if (e.key === 'Escape') setAddSubtopicFor(null);
                              }}
                            />
                            <button
                              type="button"
                              className="adm-btn adm-btn-primary adm-btn-sm"
                              disabled={!newSubtopicTitle.trim() || busy !== null}
                              onClick={() =>
                                run(`add-sub-${topic.id}`, async () => {
                                  await api.createSubtopic(topic.id, {
                                    title: newSubtopicTitle.trim(),
                                    sequence_number: (topic.subtopics?.length || 0) + 1,
                                  });
                                  setNewSubtopicTitle('');
                                  setAddSubtopicFor(null);
                                })
                              }
                            >
                              Add
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setAddSubtopicFor(topic.id); setNewSubtopicTitle(''); }}
                            style={{ background: 'transparent', border: '1px dashed var(--admin-border)', borderRadius: '6px', fontSize: '11px', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Plus size={10} /> Subtopic
                          </button>
                        )}
                      </div>
                      {editing?.kind === 'subtopic' && (topic.subtopics || []).some((s) => s.id === editing.id) && editForm(editing)}
                    </div>
                  ))}

                  {addTopicFor === chapter.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                      <input
                        autoFocus
                        style={{ ...inputStyle, maxWidth: '320px' }}
                        value={newTopicTitle}
                        onChange={(e) => setNewTopicTitle(e.target.value)}
                        placeholder="New topic title"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTopicTitle.trim()) {
                            run(`add-topic-${chapter.id}`, async () => {
                              await api.createTopic(chapter.id, {
                                title: newTopicTitle.trim(),
                                sequence_number: (chapter.topics?.length || 0) + 1,
                              });
                              setNewTopicTitle('');
                              setAddTopicFor(null);
                            });
                          }
                          if (e.key === 'Escape') setAddTopicFor(null);
                        }}
                      />
                      <button
                        type="button"
                        className="adm-btn adm-btn-primary adm-btn-sm"
                        disabled={!newTopicTitle.trim() || busy !== null}
                        onClick={() =>
                          run(`add-topic-${chapter.id}`, async () => {
                            await api.createTopic(chapter.id, {
                              title: newTopicTitle.trim(),
                              sequence_number: (chapter.topics?.length || 0) + 1,
                            });
                            setNewTopicTitle('');
                            setAddTopicFor(null);
                          })
                        }
                      >
                        Add topic
                      </button>
                      <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setAddTopicFor(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => { setAddTopicFor(chapter.id); setNewTopicTitle(''); }}
                    >
                      <Plus size={12} /> Add topic
                    </button>
                  )}

                  {busy && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                      <RefreshCw size={11} /> Saving changes…
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SurfacePanel>
  );
};
