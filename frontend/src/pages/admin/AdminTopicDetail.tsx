import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ArrowRight, Clapperboard, FileQuestion, ListTree } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FormField } from '../../components/admin/FormField';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { api } from '../../lib/api';
import { TopicDetail, SubtopicItem, ChapterDetail, SubjectDetail, SubjectItem, ChapterItem, TopicItem } from '../../lib/types';

interface AdminTopicDetailProps {
  topicId?: number;
  onNavigate?: (route: string, params?: any) => void;
}

export const AdminTopicDetail: React.FC<AdminTopicDetailProps> = ({ topicId, onNavigate }) => {
  const [activeTopicId, setActiveTopicId] = useState<number | undefined>(topicId);
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [parentChapter, setParentChapter] = useState<ChapterDetail | null>(null);
  const [parentSubject, setParentSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Subject/Chapter/Topic selector states when no topicId is active
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectChapters, setSubjectChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterTopics, setChapterTopics] = useState<TopicItem[]>([]);

  // Add Topic Modal (when browsing)
  const [addTopModalOpen, setAddTopModalOpen] = useState(false);
  const [newTopSeq, setNewTopSeq] = useState(1);
  const [newTopTitle, setNewTopTitle] = useState('');
  const [newTopDescription, setNewTopDescription] = useState('');

  // Add Subtopic Modal
  const [addSubtopicModalOpen, setAddSubtopicModalOpen] = useState(false);
  const [seqNumber, setSeqNumber] = useState(1);
  const [subtopicTitle, setSubtopicTitle] = useState('');
  const [subtopicDescription, setSubtopicDescription] = useState('');

  // Edit Topic Modal
  const [editTopicModalOpen, setEditTopicModalOpen] = useState(false);
  const [topSeq, setTopSeq] = useState(1);
  const [topTitle, setTopTitle] = useState('');
  const [topDescription, setTopDescription] = useState('');

  // Delete subtopic confirmation
  const [deleteSubtopicTarget, setDeleteSubtopicTarget] = useState<SubtopicItem | null>(null);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (topicId) {
      setActiveTopicId(topicId);
    }
  }, [topicId]);

  // Load subject list if no active topic
  useEffect(() => {
    if (!activeTopicId) {
      api.getSubjects(1, 100).then((res) => {
        setSubjectsList(res.items);
        if (res.items.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(res.items[0].id);
        }
      }).catch(console.error);
    }
  }, [activeTopicId]);

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
        }
      }).catch(console.error);
    }
  }, [selectedSubjectId]);

  // Load topics when selectedChapterId changes
  useEffect(() => {
    if (selectedChapterId) {
      api.getChapterTopics(selectedChapterId).then((res) => {
        setChapterTopics(res);
        setNewTopSeq(res.length + 1);
      }).catch(console.error);
    } else {
      setChapterTopics([]);
    }
  }, [selectedChapterId]);

  const fetchTopic = async () => {
    if (!activeTopicId) return;
    try {
      setLoading(true);
      const t = await api.getTopic(activeTopicId);
      setTopic(t);
      setTopSeq(t.sequence_number);
      setTopTitle(t.title);
      setTopDescription(t.description || '');
      setSeqNumber(t.subtopics.length + 1);

      if (t.chapter_id) {
        const ch = await api.getChapter(t.chapter_id);
        setParentChapter(ch);
        if (ch.subject_id) {
          const subj = await api.getSubject(ch.subject_id);
          setParentSubject(subj);
        }
      }
    } catch (err: any) {
      setMessage({ text: `Failed to load topic: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTopicId) {
      fetchTopic();
    }
  }, [activeTopicId]);

  const handleAddSubtopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    try {
      setSubmitting(true);
      await api.createSubtopic(topic.id, {
        sequence_number: seqNumber,
        title: subtopicTitle,
        description: subtopicDescription || undefined,
      });
      setMessage({ text: `Subtopic '${subtopicTitle}' created successfully.`, type: 'success' });
      setAddSubtopicModalOpen(false);
      setSubtopicTitle('');
      setSubtopicDescription('');
      fetchTopic();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    try {
      setSubmitting(true);
      await api.updateTopic(topic.id, {
        sequence_number: topSeq,
        title: topTitle,
        description: topDescription || undefined,
      });
      setMessage({ text: `Topic '${topTitle}' updated successfully.`, type: 'success' });
      setEditTopicModalOpen(false);
      fetchTopic();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestDeleteSubtopic = (st: SubtopicItem) => {
    setDeleteSubtopicTarget(st);
  };

  const handleDeleteSubtopic = async () => {
    if (!deleteSubtopicTarget) return;
    const stId = deleteSubtopicTarget.id;
    const title = deleteSubtopicTarget.title;
    try {
      await api.deleteSubtopic(stId);
      setMessage({ text: `Subtopic '${title}' deleted.`, type: 'success' });
      setDeleteSubtopicTarget(null);
      fetchTopic();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCreateTopicForChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterId) return;
    try {
      setSubmitting(true);
      const created = await api.createTopic(selectedChapterId, {
        sequence_number: newTopSeq,
        title: newTopTitle,
        description: newTopDescription || undefined,
      });
      setMessage({ text: `Topic '${created.title}' created successfully!`, type: 'success' });
      setAddTopModalOpen(false);
      setNewTopTitle('');
      setNewTopDescription('');
      const tops = await api.getChapterTopics(selectedChapterId);
      setChapterTopics(tops);
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

  if (loading && !topic && activeTopicId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader title="Topic Details" description="Loading topic curriculum…" />
        <SurfacePanel>
          <LoadingState label="Loading topic details…" rows={5} />
        </SurfacePanel>
      </div>
    );
  }

  if (!activeTopicId || !topic) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader
          title="Curriculum Topics Management"
          description="Select a subject and chapter to organize learning topics and subtopic sequences."
          actions={
            <button
              className="adm-btn adm-btn-primary"
              onClick={() => setAddTopModalOpen(true)}
              disabled={!selectedChapterId}
            >
              <Plus size={15} />
              Add Topic
            </button>
          }
        />

        <MessageBanner message={message} onDismiss={() => setMessage(null)} />

        {/* Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="adm-label" htmlFor="topic-subject-select" style={{ marginBottom: 0 }}>
                Subject:
              </label>
              <select
                id="topic-subject-select"
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label className="adm-label" htmlFor="topic-chapter-select" style={{ marginBottom: 0 }}>
                Chapter:
              </label>
              <select
                id="topic-chapter-select"
                className="adm-select"
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                style={{ maxWidth: '260px' }}
              >
                {subjectChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch {ch.chapter_number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedChapterId && (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                {chapterTopics.length} topic(s) found
              </span>
            )}
          </div>
        </SurfacePanel>

        {/* Topics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {chapterTopics.map((top) => (
            <SurfacePanel key={top.id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-success-soft)', color: 'var(--admin-success)' }}
                    >
                      Sequence #{top.sequence_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {top.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>
                    {top.description || 'No topic description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="adm-btn adm-btn-primary adm-btn-sm"
                    onClick={() => setActiveTopicId(top.id)}
                  >
                    View Subtopics & Videos
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {chapterTopics.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                title="No topics yet"
                description="No topics created for this chapter yet. Use the Add Topic button to create the first topic."
                icon={<ListTree size={20} />}
              />
            </div>
          )}
        </div>

        {/* Add Topic Modal */}
        <Modal
          open={addTopModalOpen}
          onClose={() => setAddTopModalOpen(false)}
          title="Create New Topic"
          subtitle="Topics group subtopics and generated learning units."
          maxWidth={460}
          footer={
            <>
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddTopModalOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" form="create-topic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Topic'}
              </button>
            </>
          }
        >
          <form id="create-topic-form" onSubmit={handleCreateTopicForChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField
              label="Sequence Number"
              name="new-topic-sequence"
              type="number"
              required
              min={1}
              value={newTopSeq}
              onChange={(v) => setNewTopSeq(Number(v))}
            />
            <FormField
              label="Topic Title"
              name="new-topic-title"
              type="text"
              required
              placeholder="e.g. Distance and Displacement"
              value={newTopTitle}
              onChange={setNewTopTitle}
            />
            <FormField
              label="Description"
              name="new-topic-description"
              type="textarea"
              placeholder="Brief description of learning objectives..."
              value={newTopDescription}
              onChange={setNewTopDescription}
            />
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Breadcrumbs & Header */}
      <div>
        <div style={breadcrumbStyle}>
          {crumbButton('All Topics', () => { setActiveTopicId(undefined); setTopic(null); })}
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
          {crumbSeparator}
          <span style={{ color: 'var(--admin-text)', fontWeight: 600 }}>Topic {topic.sequence_number}</span>
        </div>

        <PageHeader
          title={`Topic ${topic.sequence_number}: ${topic.title}`}
          description={topic.description || 'No topic objective configured.'}
          actions={
            <>
              <button className="adm-btn adm-btn-secondary" onClick={() => setEditTopicModalOpen(true)}>
                <Pencil size={14} />
                Edit Topic
              </button>
              <button className="adm-btn adm-btn-primary" onClick={() => setAddSubtopicModalOpen(true)}>
                <Plus size={15} />
                Add Subtopic
              </button>
            </>
          }
        />
      </div>

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Grid: Subtopics + Videos/Quizzes + Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Subtopics List */}
          <SurfacePanel title={`Subtopics (${topic.subtopics.length} total)`}>
            {topic.subtopics.length === 0 ? (
              <EmptyState
                title="No subtopics yet"
                description="No subtopics defined yet. Use the Add Subtopic button above to add granular concepts."
                icon={<ListTree size={20} />}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topic.subtopics.map((st: SubtopicItem) => (
                  <div
                    key={st.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'var(--admin-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-success)', marginRight: '8px' }}>
                        #{st.sequence_number}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
                        {st.title}
                      </span>
                      {st.description && (
                        <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {st.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {onNavigate && (
                        <button
                          className="adm-btn adm-btn-secondary adm-btn-sm"
                          onClick={() => onNavigate('admin-subtopics', { subtopicId: st.id })}
                        >
                          View
                          <ArrowRight size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost adm-btn-sm"
                        aria-label={`Delete subtopic ${st.title}`}
                        onClick={() => requestDeleteSubtopic(st)}
                        style={{ color: 'var(--admin-error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfacePanel>

          {/* Videos & Quizzes Section */}
          <SurfacePanel title="Generated Content Units (Dynamic AI Linkages)">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clapperboard size={14} style={{ color: 'var(--admin-text-secondary)' }} />
                  Videos ({topic.videos.length})
                </h4>
                {topic.videos.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No video units attached.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {topic.videos.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--admin-bg)',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--admin-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{v.title}</span>
                          {v.status ? <StatusBadge status={v.status} /> : <span style={{ color: 'var(--admin-text-secondary)' }}>—</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          Duration: {v.duration_seconds ?? '—'}s
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileQuestion size={14} style={{ color: 'var(--admin-text-secondary)' }} />
                  Quizzes ({topic.quizzes.length})
                </h4>
                {topic.quizzes.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No quizzes attached.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {topic.quizzes.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--admin-bg)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)', overflowWrap: 'anywhere' }}>{q.title}</span>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          Attempt #{q.attempt_number ?? '—'} | Questions: {q.questions_count ?? '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SurfacePanel>
        </div>

        {/* Visual Hierarchy */}
        <div>
          <CurriculumTree
            subject={parentSubject}
            chapters={parentSubject?.chapters || (parentChapter ? [parentChapter] : [])}
            currentChapterId={parentChapter?.id}
            currentTopicId={topic.id}
            onSelectSubtopic={(stId) => onNavigate && onNavigate('admin-subtopics', { subtopicId: stId })}
          />
        </div>
      </div>

      {/* Add Subtopic Modal */}
      <Modal
        open={addSubtopicModalOpen}
        onClose={() => setAddSubtopicModalOpen(false)}
        title={`Add Subtopic to Topic ${topic.sequence_number}`}
        subtitle="Subtopics are the granular units used for AI video and quiz generation."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddSubtopicModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="add-subtopic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Subtopic'}
            </button>
          </>
        }
      >
        <form id="add-subtopic-form" onSubmit={handleAddSubtopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Sequence Number"
            name="subtopic-sequence"
            type="number"
            required
            min={1}
            value={seqNumber}
            onChange={(v) => setSeqNumber(Number(v))}
          />
          <FormField
            label="Subtopic Title"
            name="subtopic-title"
            type="text"
            required
            placeholder="e.g. Scalar vs Vector Definition"
            value={subtopicTitle}
            onChange={setSubtopicTitle}
          />
          <FormField
            label="Description"
            name="subtopic-description"
            type="textarea"
            placeholder="Core mathematical or theoretical distinction..."
            value={subtopicDescription}
            onChange={setSubtopicDescription}
          />
        </form>
      </Modal>

      {/* Edit Topic Modal */}
      <Modal
        open={editTopicModalOpen}
        onClose={() => setEditTopicModalOpen(false)}
        title={`Edit Topic #${topic.sequence_number}`}
        subtitle="Update topic sequencing, title, and description."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditTopicModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="edit-topic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-topic-form" onSubmit={handleUpdateTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Sequence Number"
            name="edit-topic-sequence"
            type="number"
            required
            min={1}
            value={topSeq}
            onChange={(v) => setTopSeq(Number(v))}
          />
          <FormField
            label="Topic Title"
            name="edit-topic-title"
            type="text"
            required
            value={topTitle}
            onChange={setTopTitle}
          />
          <FormField
            label="Description"
            name="edit-topic-description"
            type="textarea"
            value={topDescription}
            onChange={setTopDescription}
          />
        </form>
      </Modal>

      {/* Delete Subtopic Confirmation */}
      <ConfirmDialog
        open={!!deleteSubtopicTarget}
        title="Delete Subtopic"
        message={`Are you sure you want to delete subtopic '${deleteSubtopicTarget?.title || ''}'? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteSubtopic}
        onCancel={() => setDeleteSubtopicTarget(null)}
      />
    </div>
  );
};
