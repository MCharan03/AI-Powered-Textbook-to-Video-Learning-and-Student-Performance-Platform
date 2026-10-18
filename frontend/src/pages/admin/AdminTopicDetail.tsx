import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { CurriculumTree } from '../../components/CurriculumTree';
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

  const handleDeleteSubtopic = async (stId: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete subtopic '${title}'?`)) return;
    try {
      await api.deleteSubtopic(stId);
      setMessage({ text: `Subtopic '${title}' deleted.`, type: 'success' });
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

  if (loading && !topic && activeTopicId) {
    return <div style={{ padding: '24px', color: 'var(--admin-text)' }}>Loading topic details...</div>;
  }

  if (!activeTopicId || !topic) {
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
              Curriculum Topics Management
            </h1>
            <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
              Select a subject and chapter to organize learning topics and subtopic sequences.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setAddTopModalOpen(true)}
              disabled={!selectedChapterId}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedChapterId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>+</span>
              <span>Add Topic</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <SurfacePanel>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
                Subject:
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
                  minWidth: '200px',
                }}
              >
                {subjectsList.map((s) => (
                  <option key={s.id} value={s.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                    {s.name} ({s.class})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
                Chapter:
              </span>
              <select
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(Number(e.target.value))}
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
                {subjectChapters.map((ch) => (
                  <option key={ch.id} value={ch.id} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
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
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#34D399',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      Sequence #{top.sequence_number}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                    {top.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '1.4' }}>
                    {top.description || 'No topic description configured.'}
                  </p>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTopicId(top.id)}
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
                    View Subtopics & Videos →
                  </button>
                </div>
              </div>
            </SurfacePanel>
          ))}
          {chapterTopics.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              No topics created for this chapter yet. Click "+ Add Topic" to create the first topic.
            </div>
          )}
        </div>

        {/* Add Topic Modal */}
        {addTopModalOpen && (
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
                Create New Topic
              </h3>
              <form onSubmit={handleCreateTopicForChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Sequence Number *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTopSeq}
                    onChange={(e) => setNewTopSeq(Number(e.target.value))}
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
                    value={newTopTitle}
                    onChange={(e) => setNewTopTitle(e.target.value)}
                    placeholder="e.g. Distance and Displacement"
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
                    value={newTopDescription}
                    onChange={(e) => setNewTopDescription(e.target.value)}
                    placeholder="Brief description of learning objectives..."
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
                    onClick={() => setAddTopModalOpen(false)}
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
                    {submitting ? 'Creating...' : 'Create Topic'}
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
      {/* Top Breadcrumbs & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--admin-text-secondary)', marginBottom: '8px' }}>
            <span
              onClick={() => { setActiveTopicId(undefined); setTopic(null); }}
              style={{ cursor: 'pointer', color: '#60A5FA' }}
            >
              All Topics
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
            <span style={{ color: 'var(--admin-text)' }}>Topic {topic.sequence_number}</span>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Topic {topic.sequence_number}: {topic.title}
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            {topic.description || 'No topic objective configured.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setEditTopicModalOpen(true)}
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
            Edit Topic
          </button>
          <button
            onClick={() => setAddSubtopicModalOpen(true)}
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
            + Add Subtopic
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

      {/* Grid: Subtopics + Videos/Quizzes + Tree */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Subtopics List */}
          <SurfacePanel title={`Subtopics (${topic.subtopics.length} total)`}>
            {topic.subtopics.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
                No subtopics defined yet. Click "+ Add Subtopic" above to add granular concepts.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topic.subtopics.map((st: SubtopicItem) => (
                  <div
                    key={st.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#34D399', marginRight: '8px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('admin-subtopics', { subtopicId: st.id })}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            border: '1px solid var(--admin-border)',
                            backgroundColor: 'transparent',
                            color: '#60A5FA',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          View →
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSubtopic(st.id, st.title)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'transparent',
                          color: '#EF4444',
                          fontSize: '11px',
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

          {/* Videos & Quizzes Section */}
          <SurfacePanel title="Generated Content Units (Dynamic AI Linkages)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
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
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{v.title}</span>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          Status: {v.status} | Duration: {v.duration_seconds}s
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
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
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{q.title}</span>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          Attempt #{q.attempt_number} | Questions: {q.questions_count}
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
      {addSubtopicModalOpen && (
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
              Add Subtopic to Topic {topic.sequence_number}
            </h2>
            <form onSubmit={handleAddSubtopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  placeholder="e.g. Scalar vs Vector Definition"
                  value={subtopicTitle}
                  onChange={(e) => setSubtopicTitle(e.target.value)}
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
                  placeholder="Core mathematical or theoretical distinction..."
                  value={subtopicDescription}
                  onChange={(e) => setSubtopicDescription(e.target.value)}
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
                  onClick={() => setAddSubtopicModalOpen(false)}
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
                  {submitting ? 'Adding...' : 'Add Subtopic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editTopicModalOpen && (
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
              Edit Topic #{topic.sequence_number}
            </h2>
            <form onSubmit={handleUpdateTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Sequence Number *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={topSeq}
                  onChange={(e) => setTopSeq(Number(e.target.value))}
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
                  value={topTitle}
                  onChange={(e) => setTopTitle(e.target.value)}
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
                  value={topDescription}
                  onChange={(e) => setTopDescription(e.target.value)}
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
                  onClick={() => setEditTopicModalOpen(false)}
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
