import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ArrowRight, BookOpen, ListTree } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FormField } from '../../components/admin/FormField';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { api } from '../../lib/api';
import { ChapterDetail, TopicItem, SubjectDetail, SubjectItem, ChapterItem } from '../../lib/types';

interface AdminChapterDetailProps {
  chapterId?: number;
  onNavigate?: (route: string, params?: any) => void;
}

export const AdminChapterDetail: React.FC<AdminChapterDetailProps> = ({ chapterId, onNavigate }) => {
  const [activeChapterId, setActiveChapterId] = useState<number | undefined>(chapterId);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [parentSubject, setParentSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Subject/Chapter selector states when no chapterId is active
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectChapters, setSubjectChapters] = useState<ChapterItem[]>([]);

  // Add Chapter Modal (when browsing by subject)
  const [addChapterModalOpen, setAddChapterModalOpen] = useState(false);
  const [newChNumber, setNewChNumber] = useState(1);
  const [newChTitle, setNewChTitle] = useState('');
  const [newChDescription, setNewChDescription] = useState('');

  // Add Topic Modal
  const [addTopicModalOpen, setAddTopicModalOpen] = useState(false);
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');

  // Edit Chapter Modal
  const [editChapterModalOpen, setEditChapterModalOpen] = useState(false);
  const [chNumber, setChNumber] = useState(1);
  const [chTitle, setChTitle] = useState('');
  const [chDescription, setChDescription] = useState('');

  // Delete topic confirmation
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<TopicItem | null>(null);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (chapterId) {
      setActiveChapterId(chapterId);
    }
  }, [chapterId]);

  // Load subject list if no active chapter
  useEffect(() => {
    if (!activeChapterId) {
      api.getSubjects(1, 100).then((res) => {
        setSubjectsList(res.items);
        if (res.items.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(res.items[0].id);
        }
      }).catch(console.error);
    }
  }, [activeChapterId]);

  // Load chapters when selectedSubjectId changes
  useEffect(() => {
    if (selectedSubjectId) {
      api.getSubjectChapters(selectedSubjectId).then((res) => {
        setSubjectChapters(res);
        setNewChNumber(res.length + 1);
      }).catch(console.error);
    }
  }, [selectedSubjectId]);

  const fetchChapter = async () => {
    if (!activeChapterId) return;
    try {
      setLoading(true);
      const ch = await api.getChapter(activeChapterId);
      setChapter(ch);
      setChNumber(ch.chapter_number);
      setChTitle(ch.title);
      setChDescription(ch.description || '');
      setSequenceNumber(ch.topics.length + 1);

      if (ch.subject_id) {
        const subj = await api.getSubject(ch.subject_id);
        setParentSubject(subj);
      }
    } catch (err: any) {
      setMessage({ text: `Failed to load chapter: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeChapterId) {
      fetchChapter();
    }
  }, [activeChapterId]);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapter) return;
    try {
      setSubmitting(true);
      await api.createTopic(chapter.id, {
        sequence_number: sequenceNumber,
        title: topicTitle,
        description: topicDescription || undefined,
      });
      setMessage({ text: `Topic '${topicTitle}' created successfully.`, type: 'success' });
      setAddTopicModalOpen(false);
      setTopicTitle('');
      setTopicDescription('');
      fetchChapter();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapter) return;
    try {
      setSubmitting(true);
      await api.updateChapter(chapter.id, {
        chapter_number: chNumber,
        title: chTitle,
        description: chDescription || undefined,
      });
      setMessage({ text: `Chapter '${chTitle}' updated successfully.`, type: 'success' });
      setEditChapterModalOpen(false);
      fetchChapter();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestDeleteTopic = (topic: TopicItem) => {
    setDeleteTopicTarget(topic);
  };

  const handleDeleteTopic = async () => {
    if (!deleteTopicTarget) return;
    const topicId = deleteTopicTarget.id;
    const title = deleteTopicTarget.title;
    try {
      await api.deleteTopic(topicId);
      setMessage({ text: `Topic '${title}' deleted.`, type: 'success' });
      setDeleteTopicTarget(null);
      fetchChapter();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCreateChapterForSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;
    try {
      setSubmitting(true);
      const created = await api.createChapter(selectedSubjectId, {
        chapter_number: newChNumber,
        title: newChTitle,
        description: newChDescription || undefined,
      });
      setMessage({ text: `Chapter '${created.title}' created successfully!`, type: 'success' });
      setAddChapterModalOpen(false);
      setNewChTitle('');
      setNewChDescription('');
      const chs = await api.getSubjectChapters(selectedSubjectId);
      setSubjectChapters(chs);
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

  if (loading && !chapter && activeChapterId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader title="Chapter Details" description="Loading chapter curriculum…" />
        <SurfacePanel>
          <LoadingState label="Loading chapter details…" rows={5} />
        </SurfacePanel>
      </div>
    );
  }

  if (!activeChapterId || !chapter) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader
          title="Chapter Curriculum Management"
          description="Select an academic subject to view, create, and organize chapters and syllabus topics."
          actions={
            <button
              className="adm-btn adm-btn-primary"
              onClick={() => setAddChapterModalOpen(true)}
              disabled={!selectedSubjectId}
            >
              <Plus size={15} />
              Add Chapter
            </button>
          }
        />

        <MessageBanner message={message} onDismiss={() => setMessage(null)} />

        {/* Subject Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <label className="adm-label" htmlFor="chapter-subject-select" style={{ marginBottom: 0 }}>
              Academic Subject:
            </label>
            <select
              id="chapter-subject-select"
              className="adm-select"
              value={selectedSubjectId || ''}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              style={{ maxWidth: '280px' }}
            >
              {subjectsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.class})
                </option>
              ))}
            </select>
            {selectedSubjectId && (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                {subjectChapters.length} chapter(s) found in this subject
              </span>
            )}
          </div>
        </SurfacePanel>

        {/* Chapters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {subjectChapters.map((ch) => (
            <SurfacePanel key={ch.id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                    >
                      Chapter {ch.chapter_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {ch.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>
                    {ch.description || 'No module description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="adm-btn adm-btn-primary adm-btn-sm"
                    onClick={() => setActiveChapterId(ch.id)}
                  >
                    View Topics & Details
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {subjectChapters.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                title="No chapters yet"
                description="No chapters created for this subject yet. Use the Add Chapter button to create the first chapter."
                icon={<BookOpen size={20} />}
              />
            </div>
          )}
        </div>

        {/* Add Chapter Modal */}
        <Modal
          open={addChapterModalOpen}
          onClose={() => setAddChapterModalOpen(false)}
          title="Create New Chapter"
          subtitle="Chapters group topics within a subject."
          maxWidth={460}
          footer={
            <>
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddChapterModalOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" form="create-chapter-form" className="adm-btn adm-btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Chapter'}
              </button>
            </>
          }
        >
          <form id="create-chapter-form" onSubmit={handleCreateChapterForSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField
              label="Chapter Number"
              name="new-chapter-number"
              type="number"
              required
              min={1}
              value={newChNumber}
              onChange={(v) => setNewChNumber(Number(v))}
            />
            <FormField
              label="Chapter Title"
              name="new-chapter-title"
              type="text"
              required
              placeholder="e.g. Kinematics & Motion"
              value={newChTitle}
              onChange={setNewChTitle}
            />
            <FormField
              label="Description"
              name="new-chapter-description"
              type="textarea"
              placeholder="Brief description of the chapter contents..."
              value={newChDescription}
              onChange={setNewChDescription}
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
          {crumbButton('All Chapters', () => { setActiveChapterId(undefined); setChapter(null); })}
          <ChevronRight size={13} style={{ color: 'var(--admin-text-secondary)', flexShrink: 0 }} />
          {crumbButton('Subjects', () => onNavigate && onNavigate('admin-subjects'))}
          {parentSubject && (
            <>
              <ChevronRight size={13} style={{ color: 'var(--admin-text-secondary)', flexShrink: 0 }} />
              {crumbButton(parentSubject.name, () => onNavigate && onNavigate('admin-subjects', { subjectId: parentSubject.id }))}
            </>
          )}
          <ChevronRight size={13} style={{ color: 'var(--admin-text-secondary)', flexShrink: 0 }} />
          <span style={{ color: 'var(--admin-text)', fontWeight: 600 }}>Chapter {chapter.chapter_number}</span>
        </div>

        <PageHeader
          title={`Chapter ${chapter.chapter_number}: ${chapter.title}`}
          description={chapter.description || 'No module description configured.'}
          actions={
            <>
              <button className="adm-btn adm-btn-secondary" onClick={() => setEditChapterModalOpen(true)}>
                <Pencil size={14} />
                Edit Chapter
              </button>
              <button className="adm-btn adm-btn-primary" onClick={() => setAddTopicModalOpen(true)}>
                <Plus size={15} />
                Add Topic
              </button>
            </>
          }
        />
      </div>

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Grid: Topics List + Visual Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '24px' }}>
        <SurfacePanel title={`Topics in Chapter ${chapter.chapter_number} (${chapter.topics.length} total)`}>
          {chapter.topics.length === 0 ? (
            <EmptyState
              title="No topics yet"
              description="No topics created in this chapter yet. Use the Add Topic button above to begin."
              icon={<ListTree size={20} />}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chapter.topics.map((t: TopicItem) => (
                <div
                  key={t.id}
                  style={{
                    padding: '12px 16px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                        Topic {t.sequence_number}:
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>
                        {t.title}
                      </span>
                    </div>
                    {t.description && (
                      <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                        {t.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '6px' }}>
                      <span>Subtopics: <strong style={{ color: 'var(--admin-text)' }}>{t.subtopics_count ?? '—'}</strong></span>
                      <span>Videos: <strong style={{ color: 'var(--admin-text)' }}>{t.videos_count ?? '—'}</strong></span>
                      <span>Quizzes: <strong style={{ color: 'var(--admin-text)' }}>{t.quizzes_count ?? '—'}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {onNavigate && (
                      <button
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={() => onNavigate('admin-topics', { topicId: t.id })}
                      >
                        Manage Subtopics
                        <ArrowRight size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      aria-label={`Delete topic ${t.title}`}
                      onClick={() => requestDeleteTopic(t)}
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

        {/* Visual Hierarchy */}
        <div>
          <CurriculumTree
            subject={parentSubject}
            chapters={parentSubject?.chapters || [chapter]}
            currentChapterId={chapter.id}
            onSelectTopic={(tId) => onNavigate && onNavigate('admin-topics', { topicId: tId })}
          />
        </div>
      </div>

      {/* Add Topic Modal */}
      <Modal
        open={addTopicModalOpen}
        onClose={() => setAddTopicModalOpen(false)}
        title={`Add Topic to Chapter ${chapter.chapter_number}`}
        subtitle="Topics group related subtopics and generated learning units."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddTopicModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="add-topic-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Topic'}
            </button>
          </>
        }
      >
        <form id="add-topic-form" onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Sequence Number"
            name="topic-sequence"
            type="number"
            required
            min={1}
            value={sequenceNumber}
            onChange={(v) => setSequenceNumber(Number(v))}
          />
          <FormField
            label="Topic Title"
            name="topic-title"
            type="text"
            required
            placeholder="e.g. Distance and Displacement"
            value={topicTitle}
            onChange={setTopicTitle}
          />
          <FormField
            label="Description"
            name="topic-description"
            type="textarea"
            placeholder="Summary of specific learning objectives and video topics..."
            value={topicDescription}
            onChange={setTopicDescription}
          />
        </form>
      </Modal>

      {/* Edit Chapter Modal */}
      <Modal
        open={editChapterModalOpen}
        onClose={() => setEditChapterModalOpen(false)}
        title={`Edit Chapter #${chapter.chapter_number}`}
        subtitle="Update chapter numbering, title, and description."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditChapterModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="edit-chapter-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-chapter-form" onSubmit={handleUpdateChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Chapter Number"
            name="edit-chapter-number"
            type="number"
            required
            min={1}
            value={chNumber}
            onChange={(v) => setChNumber(Number(v))}
          />
          <FormField
            label="Chapter Title"
            name="edit-chapter-title"
            type="text"
            required
            value={chTitle}
            onChange={setChTitle}
          />
          <FormField
            label="Description"
            name="edit-chapter-description"
            type="textarea"
            value={chDescription}
            onChange={setChDescription}
          />
        </form>
      </Modal>

      {/* Delete Topic Confirmation */}
      <ConfirmDialog
        open={!!deleteTopicTarget}
        title="Delete Topic"
        message={`Are you sure you want to delete topic '${deleteTopicTarget?.title || ''}'? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteTopic}
        onCancel={() => setDeleteTopicTarget(null)}
      />
    </div>
  );
};
