import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pencil, ArrowRight, ListTree, Plus } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { FormField } from '../../components/admin/FormField';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { api } from '../../lib/api';
import { SubtopicItem, TopicDetail, ChapterDetail, SubjectDetail, SubjectItem, ChapterItem, TopicItem } from '../../lib/types';

interface AdminSubtopicDetailProps {
  subtopicId?: number;
  onNavigate?: (route: string, params?: any) => void;
}

export const AdminSubtopicDetail: React.FC<AdminSubtopicDetailProps> = ({ subtopicId, onNavigate }) => {
  const [activeSubtopicId, setActiveSubtopicId] = useState<number | undefined>(subtopicId);
  const [subtopic, setSubtopic] = useState<SubtopicItem | null>(null);
  const [parentTopic, setParentTopic] = useState<TopicDetail | null>(null);
  const [parentChapter, setParentChapter] = useState<ChapterDetail | null>(null);
  const [parentSubject, setParentSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Selector states when no active subtopic
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectChapters, setSubjectChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterTopics, setChapterTopics] = useState<TopicItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [topicSubtopics, setTopicSubtopics] = useState<SubtopicItem[]>([]);

  // Add Subtopic Modal
  const [addSubModalOpen, setAddSubModalOpen] = useState(false);
  const [newSubSeq, setNewSubSeq] = useState(1);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDescription, setNewSubDescription] = useState('');

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [seqNumber, setSeqNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (subtopicId) {
      setActiveSubtopicId(subtopicId);
    }
  }, [subtopicId]);

  // Load subject list if no active subtopic
  useEffect(() => {
    if (!activeSubtopicId) {
      api.getSubjects(1, 100).then((res) => {
        setSubjectsList(res.items);
        if (res.items.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(res.items[0].id);
        }
      }).catch(console.error);
    }
  }, [activeSubtopicId]);

  // Load chapters when selectedSubjectId changes
  useEffect(() => {
    if (selectedSubjectId) {
      api.getSubjectChapters(selectedSubjectId).then((res) => {
        setSubjectChapters(res);
        if (res.length > 0) {
          setSelectedChapterId(res[0].id);
        } else {
          setSelectedChapterId(null);
          setChapterTopics([]);
          setSelectedTopicId(null);
          setTopicSubtopics([]);
        }
      }).catch(console.error);
    }
  }, [selectedSubjectId]);

  // Load topics when selectedChapterId changes
  useEffect(() => {
    if (selectedChapterId) {
      api.getChapterTopics(selectedChapterId).then((res) => {
        setChapterTopics(res);
        if (res.length > 0) {
          setSelectedTopicId(res[0].id);
        } else {
          setSelectedTopicId(null);
          setTopicSubtopics([]);
        }
      }).catch(console.error);
    } else {
      setChapterTopics([]);
      setSelectedTopicId(null);
      setTopicSubtopics([]);
    }
  }, [selectedChapterId]);

  // Load subtopics when selectedTopicId changes
  useEffect(() => {
    if (selectedTopicId) {
      api.getTopicSubtopics(selectedTopicId).then((res) => {
        setTopicSubtopics(res);
        setNewSubSeq(res.length + 1);
      }).catch(console.error);
    } else {
      setTopicSubtopics([]);
    }
  }, [selectedTopicId]);

  const fetchSubtopic = async () => {
    if (!activeSubtopicId) return;
    try {
      setLoading(true);
      const st = await api.getSubtopic(activeSubtopicId);
      setSubtopic(st);
      setSeqNumber(st.sequence_number);
      setTitle(st.title);
      setDescription(st.description || '');

      if (st.topic_id) {
        const top = await api.getTopic(st.topic_id);
        setParentTopic(top);
        if (top.chapter_id) {
          const ch = await api.getChapter(top.chapter_id);
          setParentChapter(ch);
          if (ch.subject_id) {
            const subj = await api.getSubject(ch.subject_id);
            setParentSubject(subj);
          }
        }
      }
    } catch (err: any) {
      setMessage({ text: `Failed to load subtopic: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubtopicId) {
      fetchSubtopic();
    }
  }, [activeSubtopicId]);

  const handleCreateSubtopicForTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) return;
    try {
      setSubmitting(true);
      const created = await api.createSubtopic(selectedTopicId, {
        sequence_number: newSubSeq,
        title: newSubTitle,
        description: newSubDescription || undefined,
      });
      setMessage({ text: `Subtopic '${created.title}' created successfully!`, type: 'success' });
      setAddSubModalOpen(false);
      setNewSubTitle('');
      setNewSubDescription('');
      const subs = await api.getTopicSubtopics(selectedTopicId);
      setTopicSubtopics(subs);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtopic) return;
    try {
      setSubmitting(true);
      await api.updateSubtopic(subtopic.id, {
        sequence_number: seqNumber,
        title,
        description: description || undefined,
      });
      setMessage({ text: `Subtopic '${title}' updated successfully.`, type: 'success' });
      setEditModalOpen(false);
      fetchSubtopic();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
    fontSize: '13px',
    color: 'var(--admin-text-secondary)',
    marginBottom: '8px',
  };

  const crumbButton = (label: string, onClick: () => void) => (
    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onClick}>
      <ChevronLeft size={13} />
      {label}
    </button>
  );

  const crumbSeparator = <ChevronRight size={13} style={{ color: 'var(--admin-text-secondary)', flexShrink: 0 }} />;

  if (loading && !subtopic && activeSubtopicId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader title="Subtopic Details" description="Loading subtopic…" />
        <SurfacePanel>
          <LoadingState label="Loading subtopic…" rows={5} />
        </SurfacePanel>
      </div>
    );
  }

  if (!activeSubtopicId || !subtopic) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader
          title="Curriculum Subtopics Management"
          description="Select a subject, chapter, and topic to view and manage granular subtopic concepts."
          actions={
            <button
              className="adm-btn adm-btn-primary"
              onClick={() => setAddSubModalOpen(true)}
              disabled={!selectedTopicId}
            >
              <Plus size={15} />
              Add Subtopic
            </button>
          }
        />

        <MessageBanner message={message} onDismiss={() => setMessage(null)} />

        {/* Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="adm-label" htmlFor="subtopic-subject-select" style={{ marginBottom: 0 }}>
                Subject:
              </label>
              <select
                id="subtopic-subject-select"
                className="adm-select"
                value={selectedSubjectId || ''}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                style={{ maxWidth: '220px' }}
              >
                {subjectsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.class})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="adm-label" htmlFor="subtopic-chapter-select" style={{ marginBottom: 0 }}>
                Chapter:
              </label>
              <select
                id="subtopic-chapter-select"
                className="adm-select"
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                style={{ maxWidth: '240px' }}
              >
                {subjectChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch {ch.chapter_number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="adm-label" htmlFor="subtopic-topic-select" style={{ marginBottom: 0 }}>
                Topic:
              </label>
              <select
                id="subtopic-topic-select"
                className="adm-select"
                value={selectedTopicId || ''}
                onChange={(e) => setSelectedTopicId(Number(e.target.value))}
                style={{ maxWidth: '240px' }}
              >
                {chapterTopics.map((top) => (
                  <option key={top.id} value={top.id}>
                    #{top.sequence_number}: {top.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedTopicId && (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                {topicSubtopics.length} subtopic(s) found
              </span>
            )}
          </div>
        </SurfacePanel>

        {/* Subtopics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {topicSubtopics.map((sub) => (
            <SurfacePanel key={sub.id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                    >
                      Subtopic #{sub.sequence_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {sub.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>
                    {sub.description || 'No subtopic description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="adm-btn adm-btn-primary adm-btn-sm"
                    onClick={() => setActiveSubtopicId(sub.id)}
                  >
                    View Details
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {topicSubtopics.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                title="No subtopics yet"
                description="No subtopics created for this topic yet. Use the Add Subtopic button to create the first one."
                icon={<ListTree size={20} />}
              />
            </div>
          )}
        </div>

        {/* Add Subtopic Modal */}
        <Modal
          open={addSubModalOpen}
          onClose={() => setAddSubModalOpen(false)}
          title="Create New Subtopic"
          subtitle="Subtopics are the granular units used for AI video and quiz generation."
          maxWidth={460}
          footer={
            <>
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddSubModalOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" form="create-subtopic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Subtopic'}
              </button>
            </>
          }
        >
          <form id="create-subtopic-form" onSubmit={handleCreateSubtopicForTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField
              label="Sequence Number"
              name="new-subtopic-sequence"
              type="number"
              required
              min={1}
              value={newSubSeq}
              onChange={(v) => setNewSubSeq(Number(v))}
            />
            <FormField
              label="Subtopic Title"
              name="new-subtopic-title"
              type="text"
              required
              placeholder="e.g. Scalar Quantity"
              value={newSubTitle}
              onChange={setNewSubTitle}
            />
            <FormField
              label="Description"
              name="new-subtopic-description"
              type="textarea"
              placeholder="Brief description..."
              value={newSubDescription}
              onChange={setNewSubDescription}
            />
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Breadcrumb & Header */}
      <div>
        <div style={breadcrumbStyle}>
          {crumbButton('All Subtopics', () => { setActiveSubtopicId(undefined); setSubtopic(null); })}
          {crumbSeparator}
          {crumbButton('Subjects', () => onNavigate && onNavigate('admin-subjects'))}
          {parentSubject && (
            <>
              {crumbSeparator}
              {crumbButton(parentSubject.name, () => onNavigate && onNavigate('admin-subjects', { subjectId: parentSubject.id }))}
            </>
          )}
          {parentChapter && (
            <>
              {crumbSeparator}
              {crumbButton(`Chapter ${parentChapter.chapter_number}`, () => onNavigate && onNavigate('admin-chapters', { chapterId: parentChapter.id }))}
            </>
          )}
          {parentTopic && (
            <>
              {crumbSeparator}
              {crumbButton(`Topic ${parentTopic.sequence_number}`, () => onNavigate && onNavigate('admin-topics', { topicId: parentTopic.id }))}
            </>
          )}
          {crumbSeparator}
          <span style={{ color: 'var(--admin-text)', fontWeight: 600 }}>Subtopic {subtopic.sequence_number}</span>
        </div>

        <PageHeader
          title={`Subtopic ${subtopic.sequence_number}: ${subtopic.title}`}
          description={subtopic.description || 'No detailed subtopic description configured.'}
          actions={
            <button className="adm-btn adm-btn-primary" onClick={() => setEditModalOpen(true)}>
              <Pencil size={14} />
              Edit Subtopic
            </button>
          }
        />
      </div>

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Grid: Subtopic Details + Visual Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
        <SurfacePanel title="Subtopic Architecture & Specifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--admin-surface-raised)', border: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Subtopic Sequence:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>#{subtopic.sequence_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Parent Topic:</span>{' '}
                  <strong style={{ color: 'var(--admin-primary)' }}>{parentTopic?.title || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Parent Chapter:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>CH {parentChapter?.chapter_number ?? '—'} ({parentChapter?.title || '—'})</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Subject:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>{parentSubject?.name || '—'}</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--admin-primary-soft)', border: '1px solid var(--admin-border)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-primary)', marginBottom: '6px' }}>
                AI Generation Readiness
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', lineHeight: 1.5 }}>
                This subtopic node provides the granular focal point for Stage 4 narration script generation and ~5.5-minute micro-lesson synthesis when the AI processing pipeline is triggered for associated curriculum textbooks.
              </p>
            </div>
          </div>
        </SurfacePanel>

        <div>
          <CurriculumTree
            subject={parentSubject}
            chapters={parentSubject?.chapters || (parentChapter ? [parentChapter] : [])}
            currentChapterId={parentChapter?.id}
            currentTopicId={parentTopic?.id}
            currentSubtopicId={subtopic.id}
          />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Subtopic #${subtopic.sequence_number}`}
        subtitle="Update subtopic sequencing, title, and description."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="edit-subtopic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-subtopic-form" onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Sequence Number"
            name="edit-subtopic-sequence"
            type="number"
            required
            min={1}
            value={seqNumber}
            onChange={(v) => setSeqNumber(Number(v))}
          />
          <FormField
            label="Subtopic Title"
            name="edit-subtopic-title"
            type="text"
            required
            value={title}
            onChange={setTitle}
          />
          <FormField
            label="Description"
            name="edit-subtopic-description"
            type="textarea"
            value={description}
            onChange={setDescription}
          />
        </form>
      </Modal>
    </div>
  );
};
