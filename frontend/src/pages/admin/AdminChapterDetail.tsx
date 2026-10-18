import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
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

  const handleDeleteTopic = async (topicId: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete topic '${title}'?`)) return;
    try {
      await api.deleteTopic(topicId);
      setMessage({ text: `Topic '${title}' deleted.`, type: 'success' });
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

  if (loading && !chapter && activeChapterId) {
    return <div style={{ padding: '24px', color: 'var(--admin-text)' }}>Loading chapter details...</div>;
  }

  if (!activeChapterId || !chapter) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: message.type === 'success' ? '#34D399' : '#F87171',
              border: `1px solid ${message.type === 'success' ? '#059669' : '#DC2626'}`,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
              Chapter Curriculum Management
            </h1>
            <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
              Select an academic subject to view, create, and organize chapters and syllabus topics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setAddChapterModalOpen(true)}
              disabled={!selectedSubjectId}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedSubjectId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>+</span>
              <span>Add Chapter</span>
            </button>
          </div>
        </div>

        {/* Subject Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
              Academic Subject:
            </span>
            <select
              value={selectedSubjectId || ''}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--admin-text)',
                fontSize: '13px',
                minWidth: '240px',
              }}
            >
              {subjectsList.map((s) => (
                <option key={s.id} value={s.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
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
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--admin-primary)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      Chapter {ch.chapter_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {ch.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '1.4' }}>
                    {ch.description || 'No module description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setActiveChapterId(ch.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--admin-primary)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View Topics & Details →
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {subjectChapters.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              No chapters created for this subject yet. Click "+ Add Chapter" to create the first chapter.
            </div>
          )}
        </div>

        {/* Add Chapter Modal */}
        {addChapterModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--admin-surface)',
                border: '1px solid var(--admin-border)',
                borderRadius: '12px',
                padding: '24px',
                width: '460px',
                maxWidth: '90vw',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '16px' }}>
                Create New Chapter
              </h3>
              <form onSubmit={handleCreateChapterForSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Chapter Number *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newChNumber}
                    onChange={(e) => setNewChNumber(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Chapter Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newChTitle}
                    onChange={(e) => setNewChTitle(e.target.value)}
                    placeholder="e.g. Kinematics & Motion"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newChDescription}
                    onChange={(e) => setNewChDescription(e.target.value)}
                    placeholder="Brief description of the chapter contents..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setAddChapterModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'transparent',
                      color: 'var(--admin-text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--admin-primary)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Creating...' : 'Create Chapter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Breadcrumb & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--admin-text-secondary)', marginBottom: '8px' }}>
            <span
              onClick={() => { setActiveChapterId(undefined); setChapter(null); }}
              style={{ cursor: 'pointer', color: '#60A5FA' }}
            >
              All Chapters
            </span>
            <span>/</span>
            <span
              onClick={() => onNavigate && onNavigate('admin-subjects')}
              style={{ cursor: 'pointer', color: '#60A5FA' }}
            >
              Subjects
            </span>
            <span>/</span>
            {parentSubject && (
              <>
                <span
                  onClick={() => onNavigate && onNavigate('admin-subjects', { subjectId: parentSubject.id })}
                  style={{ cursor: 'pointer', color: '#60A5FA' }}
                >
                  {parentSubject.name}
                </span>
                <span>/</span>
              </>
            )}
            <span style={{ color: 'var(--admin-text)' }}>Chapter {chapter.chapter_number}</span>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Chapter {chapter.chapter_number}: {chapter.title}
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            {chapter.description || 'No module description configured.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setEditChapterModalOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--admin-border)',
              backgroundColor: 'transparent',
              color: 'var(--admin-text)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Edit Chapter
          </button>
          <button
            onClick={() => setAddTopicModalOpen(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--admin-primary)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            + Add Topic
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: message.type === 'success' ? '#34D399' : '#F87171',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: Topics List + Visual Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        <SurfacePanel title={`Topics in Chapter ${chapter.chapter_number} (${chapter.topics.length} total)`}>
          {chapter.topics.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
              No topics created in this chapter yet. Click "+ Add Topic" above to begin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chapter.topics.map((t: TopicItem) => (
                <div
                  key={t.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#60A5FA' }}>
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
                    <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '6px' }}>
                      <span>Subtopics: <strong style={{ color: 'var(--admin-text)' }}>{t.subtopics_count}</strong></span>
                      <span>Videos: <strong style={{ color: 'var(--admin-text)' }}>{t.videos_count}</strong></span>
                      <span>Quizzes: <strong style={{ color: 'var(--admin-text)' }}>{t.quizzes_count}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('admin-topics', { topicId: t.id })}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--admin-border)',
                          backgroundColor: 'transparent',
                          color: '#60A5FA',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Manage Subtopics →
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTopic(t.id, t.title)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'transparent',
                        color: '#EF4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
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
      {addTopicModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)', marginBottom: '16px' }}>
              Add Topic to Chapter {chapter.chapter_number}
            </h2>
            <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Sequence Number *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={sequenceNumber}
                  onChange={(e) => setSequenceNumber(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distance and Displacement"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of specific learning objectives and video topics..."
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setAddTopicModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--admin-text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Adding...' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chapter Modal */}
      {editChapterModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)', marginBottom: '16px' }}>
              Edit Chapter #{chapter.chapter_number}
            </h2>
            <form onSubmit={handleUpdateChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Chapter Number *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={chNumber}
                  onChange={(e) => setChNumber(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Chapter Title *
                </label>
                <input
                  type="text"
                  required
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={chDescription}
                  onChange={(e) => setChDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setEditChapterModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--admin-text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
