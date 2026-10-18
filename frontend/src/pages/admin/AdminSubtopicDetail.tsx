import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
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

  if (loading && !subtopic && activeSubtopicId) {
    return <div style={{ padding: '24px', color: 'var(--admin-text)' }}>Loading subtopic...</div>;
  }

  if (!activeSubtopicId || !subtopic) {
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
              Curriculum Subtopics Management
            </h1>
            <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
              Select a subject, chapter, and topic to view and manage granular subtopic concepts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setAddSubModalOpen(true)}
              disabled={!selectedTopicId}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedTopicId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>+</span>
              <span>Add Subtopic</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>Subject:</span>
              <select
                value={selectedSubjectId || ''}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--admin-text)',
                  fontSize: '13px',
                }}
              >
                {subjectsList.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                    {s.name} ({s.class})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>Chapter:</span>
              <select
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--admin-text)',
                  fontSize: '13px',
                }}
              >
                {subjectChapters.map((ch) => (
                  <option key={ch.id} value={ch.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                    Ch {ch.chapter_number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>Topic:</span>
              <select
                value={selectedTopicId || ''}
                onChange={(e) => setSelectedTopicId(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--admin-text)',
                  fontSize: '13px',
                }}
              >
                {chapterTopics.map((top) => (
                  <option key={top.id} value={top.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
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
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        color: '#A78BFA',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      Subtopic #{sub.sequence_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {sub.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '1.4' }}>
                    {sub.description || 'No subtopic description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setActiveSubtopicId(sub.id)}
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
                    View Details →
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {topicSubtopics.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              No subtopics created for this topic yet. Click "+ Add Subtopic" to create the first one.
            </div>
          )}
        </div>

        {/* Add Subtopic Modal */}
        {addSubModalOpen && (
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
                Create New Subtopic
              </h3>
              <form onSubmit={handleCreateSubtopicForTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Sequence Number *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newSubSeq}
                    onChange={(e) => setNewSubSeq(Number(e.target.value))}
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
                    Subtopic Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    placeholder="e.g. Scalar Quantity"
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
                    value={newSubDescription}
                    onChange={(e) => setNewSubDescription(e.target.value)}
                    placeholder="Brief description..."
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
                    onClick={() => setAddSubModalOpen(false)}
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
                    {submitting ? 'Creating...' : 'Create Subtopic'}
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
              onClick={() => { setActiveSubtopicId(undefined); setSubtopic(null); }}
              style={{ cursor: 'pointer', color: '#60A5FA' }}
            >
              All Subtopics
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
            {parentChapter && (
              <>
                <span
                  onClick={() => onNavigate && onNavigate('admin-chapters', { chapterId: parentChapter.id })}
                  style={{ cursor: 'pointer', color: '#60A5FA' }}
                >
                  Chapter {parentChapter.chapter_number}
                </span>
                <span>/</span>
              </>
            )}
            {parentTopic && (
              <>
                <span
                  onClick={() => onNavigate && onNavigate('admin-topics', { topicId: parentTopic.id })}
                  style={{ cursor: 'pointer', color: '#60A5FA' }}
                >
                  Topic {parentTopic.sequence_number}
                </span>
                <span>/</span>
              </>
            )}
            <span style={{ color: 'var(--admin-text)' }}>Subtopic {subtopic.sequence_number}</span>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Subtopic {subtopic.sequence_number}: {subtopic.title}
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            {subtopic.description || 'No detailed subtopic description configured.'}
          </p>
        </div>

        <button
          onClick={() => setEditModalOpen(true)}
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
          Edit Subtopic
        </button>
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

      {/* Grid: Subtopic Details + Visual Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        <SurfacePanel title="Subtopic Architecture & Specifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Subtopic Sequence:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>#{subtopic.sequence_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Parent Topic:</span>{' '}
                  <strong style={{ color: '#60A5FA' }}>{parentTopic?.title || 'None'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Parent Chapter:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>CH {parentChapter?.chapter_number} ({parentChapter?.title})</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>Subject:</span>{' '}
                  <strong style={{ color: 'var(--admin-text)' }}>{parentSubject?.name || 'None'}</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-primary)', marginBottom: '6px' }}>
                AI Generation Readiness
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', lineHeight: '1.5' }}>
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
      {editModalOpen && (
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
              Edit Subtopic #{subtopic.sequence_number}
            </h2>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Sequence Number *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={seqNumber}
                  onChange={(e) => setSeqNumber(Number(e.target.value))}
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
                  Subtopic Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  onClick={() => setEditModalOpen(false)}
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
