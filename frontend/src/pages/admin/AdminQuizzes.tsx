import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { SearchBar } from '../../components/admin/SearchBar';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { EmptyState } from '../../components/admin/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { SurfacePanel } from '../../components/SurfacePanel';
import { Sparkles, Pencil, RefreshCw, Trash2, Lightbulb, FileQuestion, Check, Archive, Send } from 'lucide-react';
import { api } from '../../lib/api';
import {
  AdminQuizItem,
  AdminQuestionItem,
  SubjectItem,
  ChapterItem,
  TopicItem,
  SubtopicItem,
  QuizGenerateRequest
} from '../../lib/types';

const FILTER_STATUSES = ['ALL', 'DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

type PendingConfirm =
  | { type: 'archive' }
  | { type: 'regenerateQuiz' }
  | { type: 'deleteQuestion'; questionId: number }
  | null;

export const AdminQuizzes: React.FC = () => {
  const [quizzes, setQuizzes] = useState<AdminQuizItem[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<AdminQuizItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  // Generation Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | ''>('');
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | ''>('');
  const [subtopics, setSubtopics] = useState<SubtopicItem[]>([]);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<number | ''>('');
  const [genQuestionCount, setGenQuestionCount] = useState<number>(10);
  const [genPassingScore, setGenPassingScore] = useState<number>(80);
  const [genEngine, setGenEngine] = useState<string>('deterministic');

  // Edit Question Modal State
  const [showEditQModal, setShowEditQModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestionItem | null>(null);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState('0');
  const [qExplanation, setQExplanation] = useState('');
  const [qDifficulty, setQDifficulty] = useState('MEDIUM');
  const [qBloom, setQBloom] = useState('UNDERSTAND');

  useEffect(() => {
    loadQuizzes();
    loadSubjects();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.listAdminQuizzes();
      setQuizzes(data);
      if (data.length > 0 && !selectedQuiz) {
        // Load details for first quiz
        const fullQuiz = await api.getAdminQuiz(data[0].id);
        setSelectedQuiz(fullQuiz);
      } else if (selectedQuiz) {
        const fullQuiz = await api.getAdminQuiz(selectedQuiz.id);
        setSelectedQuiz(fullQuiz);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await api.getSubjects();
      setSubjects(data.items || (data as any) || []);
    } catch (err: any) {
      console.error('Failed to load subjects', err);
    }
  };

  const handleSelectQuiz = async (quiz: AdminQuizItem) => {
    try {
      setActionLoading(true);
      const full = await api.getAdminQuiz(quiz.id);
      setSelectedQuiz(full);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load quiz details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubjectChange = async (subjId: number | '') => {
    setSelectedSubjectId(subjId);
    setSelectedChapterId('');
    setSelectedTopicId('');
    setSelectedSubtopicId('');
    setChapters([]);
    setTopics([]);
    setSubtopics([]);
    if (subjId) {
      try {
        const chs = await api.getSubjectChapters(Number(subjId));
        setChapters(chs);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleChapterChange = async (chapId: number | '') => {
    setSelectedChapterId(chapId);
    setSelectedTopicId('');
    setSelectedSubtopicId('');
    setTopics([]);
    setSubtopics([]);
    if (chapId) {
      try {
        const tops = await api.getChapterTopics(Number(chapId));
        setTopics(tops);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleTopicChange = async (topId: number | '') => {
    setSelectedTopicId(topId);
    setSelectedSubtopicId('');
    setSubtopics([]);
    if (topId) {
      try {
        const subs = await api.getTopicSubtopics(Number(topId));
        setSubtopics(subs);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedTopicId) {
      setErrorMsg('Please select a topic to generate a quiz.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const req: QuizGenerateRequest = {
        question_count: genQuestionCount,
        passing_score: genPassingScore,
        engine: genEngine,
        subtopic_id: selectedSubtopicId ? Number(selectedSubtopicId) : undefined
      };
      const created = await api.generateQuiz(Number(selectedTopicId), req);
      setSuccessMsg(`Quiz "${created.title}" generated successfully with ${created.question_count} questions.`);
      setShowGenModal(false);
      await loadQuizzes();
      const full = await api.getAdminQuiz(created.id);
      setSelectedQuiz(full);
    } catch (err: any) {
      setErrorMsg(err.message || 'Quiz generation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedQuiz) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const updated = await api.approveQuiz(selectedQuiz.id);
      setSelectedQuiz(updated);
      setSuccessMsg('Quiz approved! Status is now REVIEW.');
      await loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedQuiz) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const updated = await api.publishQuiz(selectedQuiz.id);
      setSelectedQuiz(updated);
      setSuccessMsg('Quiz published! It is now accessible to enrolled students.');
      await loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Publishing failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedQuiz) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const updated = await api.archiveQuiz(selectedQuiz.id);
      setSelectedQuiz(updated);
      setSuccessMsg('Quiz archived.');
      await loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Archiving failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateQuiz = async () => {
    if (!selectedQuiz) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const updated = await api.regenerateQuiz(selectedQuiz.id);
      setSelectedQuiz(updated);
      setSuccessMsg('Quiz regenerated with fresh Bloom-aligned questions.');
      await loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Regeneration failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateQuestion = async (qId: number) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const freshQ = await api.regenerateAdminQuestion(qId);
      if (selectedQuiz && selectedQuiz.questions) {
        const nextQuestions = selectedQuiz.questions.map((q) => (q.id === qId ? freshQ : q));
        setSelectedQuiz({ ...selectedQuiz, questions: nextQuestions });
      }
      setSuccessMsg('Question regenerated successfully with new unique distractors.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Question regeneration failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await api.deleteAdminQuestion(qId);
      if (selectedQuiz && selectedQuiz.questions) {
        const nextQuestions = selectedQuiz.questions.filter((q) => q.id !== qId);
        setSelectedQuiz({
          ...selectedQuiz,
          question_count: nextQuestions.length,
          questions: nextQuestions
        });
      }
      setSuccessMsg('Question deleted.');
      await loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Deletion failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (q: AdminQuestionItem) => {
    setEditingQuestion(q);
    setQText(q.question_text || q.stem || '');
    const rawOpts = q.options || [];
    const formattedOpts = rawOpts.map((opt: any) =>
      typeof opt === 'object' && opt !== null ? opt.text || '' : String(opt)
    );
    while (formattedOpts.length < 4) formattedOpts.push('');
    setQOptions(formattedOpts);
    setQCorrect(String(q.correct_answer || '0'));
    setQExplanation(q.explanation || '');
    setQDifficulty(q.difficulty || 'MEDIUM');
    setQBloom(q.bloom_level || 'UNDERSTAND');
    setShowEditQModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion || !selectedQuiz) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);

      const payload = {
        question_text: qText,
        options: qOptions,
        correct_answer: qCorrect,
        explanation: qExplanation,
        difficulty: qDifficulty,
        bloom_level: qBloom
      };

      const updatedQ = await api.patchAdminQuestion(editingQuestion.id, payload);
      if (selectedQuiz.questions) {
        const nextQuestions = selectedQuiz.questions.map((q) =>
          q.id === updatedQ.id ? updatedQ : q
        );
        setSelectedQuiz({ ...selectedQuiz, questions: nextQuestions });
      }
      setShowEditQModal(false);
      setSuccessMsg('Question saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update question.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPending = () => {
    const action = pendingConfirm;
    setPendingConfirm(null);
    if (!action) return;
    if (action.type === 'archive') handleArchive();
    else if (action.type === 'regenerateQuiz') handleRegenerateQuiz();
    else if (action.type === 'deleteQuestion') handleDeleteQuestion(action.questionId);
  };

  const filteredQuizzes = quizzes.filter((q) => {
    const matchStatus = filterStatus === 'ALL' || q.status === filterStatus;
    const matchSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.topic_title && q.topic_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.chapter_title && q.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const bannerMessage = successMsg
    ? { text: successMsg, type: 'success' as const }
    : errorMsg
    ? { text: errorMsg, type: 'error' as const }
    : null;

  const difficultyBadgeStyle = (difficulty?: string): React.CSSProperties => {
    if (difficulty === 'EASY') return { backgroundColor: 'var(--admin-success-soft)', color: 'var(--admin-success)' };
    if (difficulty === 'HARD') return { backgroundColor: 'var(--admin-error-soft)', color: 'var(--admin-error)' };
    return { backgroundColor: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Quiz Management & Review"
        description="Grounded assessment generation, Bloom's taxonomy validation & student mastery engine."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setShowGenModal(true)}>
            <Sparkles size={15} />
            Generate New Quiz
          </button>
        }
      />

      <MessageBanner message={bannerMessage} onDismiss={() => { setSuccessMsg(null); setErrorMsg(null); }} />

      {/* Main Grid: Quiz List & Review Panel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left: Quiz List */}
        <div style={{ flex: '1 1 300px', minWidth: '280px', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <SurfacePanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search quiz, topic, chapter..."
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {FILTER_STATUSES.map((st) => {
                  const active = filterStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                        backgroundColor: active ? 'var(--admin-primary-soft)' : 'transparent',
                        color: active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel style={{ padding: '6px' }}>
            <div style={{ maxHeight: '620px', overflowY: 'auto' }}>
              {loading && quizzes.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                  Loading quizzes...
                </div>
              ) : filteredQuizzes.length === 0 ? (
                <EmptyState
                  icon={<FileQuestion size={20} />}
                  title="No quizzes match filter"
                  description="Adjust the search or status filter to see more quizzes."
                />
              ) : (
                filteredQuizzes.map((q) => {
                  const isSelected = selectedQuiz?.id === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelectQuiz(q)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderLeft: `3px solid ${isSelected ? 'var(--admin-primary)' : 'transparent'}`,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--admin-primary-soft)' : 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--admin-surface-raised)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.title}
                        </span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{q.topic_title || 'Topic Quiz'}</span>
                        <span>•</span>
                        <span>{q.question_count} Questions</span>
                        {q.is_adaptive && (
                          <span
                            className="adm-badge"
                            style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                          >
                            Adaptive #{q.attempt_number}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </SurfacePanel>
        </div>

        {/* Right: Selected Quiz Review & Questions */}
        <div style={{ flex: '2 1 520px', minWidth: '320px', width: '100%' }}>
          {selectedQuiz ? (
            <SurfacePanel>
              {/* Quiz Summary Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  paddingBottom: '18px',
                  borderBottom: '1px solid var(--admin-border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>
                      {selectedQuiz.title}
                    </h2>
                    <StatusBadge status={selectedQuiz.status} />
                    {selectedQuiz.is_adaptive && (
                      <span
                        className="adm-badge"
                        style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                      >
                        Adaptive Attempt #{selectedQuiz.attempt_number}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '8px' }}>
                    {selectedQuiz.subject_name && (
                      <span className="adm-badge" style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' }}>
                        Subject: {selectedQuiz.subject_name}
                      </span>
                    )}
                    {selectedQuiz.chapter_title && (
                      <span className="adm-badge" style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' }}>
                        Chapter: {selectedQuiz.chapter_title}
                      </span>
                    )}
                    {selectedQuiz.topic_title && (
                      <span className="adm-badge" style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}>
                        Topic: {selectedQuiz.topic_title}
                      </span>
                    )}
                    <span>Passing Score: <strong style={{ color: 'var(--admin-text)' }}>{selectedQuiz.passing_score}%</strong></span>
                    <span>Engine: <code style={{ fontSize: '11px', color: 'var(--admin-text)' }}>{selectedQuiz.generation_engine || 'deterministic'}</code></span>
                  </div>
                </div>

                {/* Lifecycle Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedQuiz.status === 'DRAFT' && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary adm-btn-sm"
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      <Check size={14} />
                      Approve for Review
                    </button>
                  )}
                  {selectedQuiz.status === 'REVIEW' && (
                    <>
                      <button
                        type="button"
                        className="adm-btn adm-btn-primary adm-btn-sm"
                        onClick={handlePublish}
                        disabled={actionLoading}
                      >
                        <Send size={14} />
                        Publish to Students
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={() => setPendingConfirm({ type: 'regenerateQuiz' })}
                        disabled={actionLoading}
                      >
                        <RefreshCw size={14} />
                        Regenerate All
                      </button>
                    </>
                  )}
                  {selectedQuiz.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      className="adm-btn adm-btn-secondary adm-btn-sm"
                      onClick={() => setPendingConfirm({ type: 'archive' })}
                      disabled={actionLoading}
                    >
                      <Archive size={14} />
                      Archive
                    </button>
                  )}
                </div>
              </div>

              {/* Questions Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                    Questions ({selectedQuiz.questions?.length || 0})
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                    Bloom's Taxonomy Grounded • Distractor Quality Checked
                  </span>
                </div>

                {(!selectedQuiz.questions || selectedQuiz.questions.length === 0) ? (
                  <EmptyState
                    icon={<FileQuestion size={20} />}
                    title="No questions generated yet"
                    description="Generate the quiz to synthesize Bloom-aligned grounded questions."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {selectedQuiz.questions.map((q, idx) => {
                      const options = q.options || [];
                      const correctKey = String(q.correct_answer || '');

                      return (
                        <div
                          key={q.id}
                          style={{
                            padding: '16px',
                            backgroundColor: 'var(--admin-bg)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Question Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                              <span
                                style={{
                                  flexShrink: 0,
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--admin-primary-soft)',
                                  color: 'var(--admin-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  marginTop: '2px',
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontWeight: 500, color: 'var(--admin-text)', fontSize: '13px', lineHeight: '20px', margin: 0 }}>
                                  {q.question_text || q.stem}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                  <span className="adm-badge" style={difficultyBadgeStyle(q.difficulty)}>
                                    {q.difficulty}
                                  </span>
                                  <span
                                    className="adm-badge"
                                    style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                                  >
                                    Bloom: {q.bloom_level || 'UNDERSTAND'}
                                  </span>
                                  {q.source_reference && (
                                    <span style={{ fontSize: '10px', color: 'var(--admin-text-secondary)' }}>
                                      Ref: {q.source_reference}
                                    </span>
                                  )}
                                  {q.weak_concept && (
                                    <span style={{ fontSize: '10px', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>
                                      Concept: {q.weak_concept}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions per question */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => openEditModal(q)}
                                disabled={actionLoading}
                                title="Edit Question"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegenerateQuestion(q.id)}
                                disabled={actionLoading}
                                title="Regenerate this question"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                              >
                                <RefreshCw size={13} />
                                Regen
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingConfirm({ type: 'deleteQuestion', questionId: q.id })}
                                disabled={actionLoading}
                                title="Delete question"
                                aria-label="Delete question"
                                className="adm-btn adm-btn-ghost adm-btn-sm"
                                style={{ color: 'var(--admin-error)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Options Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', paddingLeft: '34px' }}>
                            {options.map((opt: any, optIdx: number) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const optText = typeof opt === 'object' && opt !== null ? opt.text : String(opt);
                              const isCorrect =
                                correctKey === letter ||
                                correctKey === String(optIdx) ||
                                (typeof opt === 'object' && opt.id && opt.id === correctKey) ||
                                optText.trim().toLowerCase() === correctKey.trim().toLowerCase();

                              return (
                                <div
                                  key={optIdx}
                                  style={{
                                    padding: '10px',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    border: isCorrect ? '1px solid #BBF7D0' : '1px solid var(--admin-border)',
                                    backgroundColor: isCorrect ? 'var(--admin-success-soft)' : 'var(--admin-surface)',
                                    color: 'var(--admin-text)',
                                    fontWeight: isCorrect ? 600 : 400,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: '10px',
                                      backgroundColor: isCorrect ? 'var(--admin-success)' : 'var(--admin-surface-raised)',
                                      color: isCorrect ? '#FFFFFF' : 'var(--admin-text-secondary)',
                                    }}
                                  >
                                    {letter}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0 }}>{optText}</span>
                                  {isCorrect && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--admin-success)', fontSize: '11px', fontWeight: 700 }}>
                                      <Check size={12} strokeWidth={3} />
                                      Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation Box */}
                          {q.explanation && (
                            <div
                              style={{
                                marginLeft: '34px',
                                padding: '10px 12px',
                                backgroundColor: 'var(--admin-primary-soft)',
                                border: '1px solid var(--admin-border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '12px',
                                color: 'var(--admin-text)',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start',
                              }}
                            >
                              <Lightbulb size={14} style={{ color: 'var(--admin-primary)', flexShrink: 0, marginTop: '2px' }} />
                              <span>
                                <strong>Explanation: </strong>
                                {q.explanation}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SurfacePanel>
          ) : (
            <SurfacePanel>
              <EmptyState
                icon={<FileQuestion size={20} />}
                title="Select a quiz"
                description="Select a quiz to review its questions and lifecycle status."
              />
            </SurfacePanel>
          )}
        </div>
      </div>

      {/* Generate Quiz Modal */}
      <Modal
        open={showGenModal}
        onClose={() => setShowGenModal(false)}
        title="Generate Grounded Quiz"
        subtitle="Extracts approved video plans, educational scripts, and curriculum textbook content to synthesize Bloom-aligned MCQ questions."
        maxWidth={560}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowGenModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleGenerateQuiz}
              disabled={actionLoading || !selectedTopicId}
            >
              {actionLoading ? 'Generating Questions...' : 'Start Generation'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="adm-label" htmlFor="gen-subject">Subject *</label>
            <select
              id="gen-subject"
              className="adm-select"
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="adm-label" htmlFor="gen-chapter">Chapter *</label>
            <select
              id="gen-chapter"
              className="adm-select"
              value={selectedChapterId}
              onChange={(e) => handleChapterChange(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedSubjectId}
            >
              <option value="">-- Select Chapter --</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="adm-label" htmlFor="gen-topic">Topic *</label>
            <select
              id="gen-topic"
              className="adm-select"
              value={selectedTopicId}
              onChange={(e) => handleTopicChange(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedChapterId}
            >
              <option value="">-- Select Topic --</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="adm-label" htmlFor="gen-subtopic">Subtopic (Optional)</label>
            <select
              id="gen-subtopic"
              className="adm-select"
              value={selectedSubtopicId}
              onChange={(e) => setSelectedSubtopicId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedTopicId || subtopics.length === 0}
            >
              <option value="">-- Entire Topic --</option>
              {subtopics.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div>
              <label className="adm-label" htmlFor="gen-count">Question Count</label>
              <select
                id="gen-count"
                className="adm-select"
                value={genQuestionCount}
                onChange={(e) => setGenQuestionCount(Number(e.target.value))}
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions (Default)</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>
            <div>
              <label className="adm-label" htmlFor="gen-passing">Passing Score (%)</label>
              <input
                id="gen-passing"
                className="adm-input"
                type="number"
                min={50}
                max={100}
                value={genPassingScore}
                onChange={(e) => setGenPassingScore(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="adm-label" htmlFor="gen-engine">Engine Abstraction</label>
            <select
              id="gen-engine"
              className="adm-select"
              value={genEngine}
              onChange={(e) => setGenEngine(e.target.value)}
            >
              <option value="deterministic">Deterministic (Offline Grounded / Fast)</option>
              <option value="llm">Pluggable LLM (OpenAI / Gemini)</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit Question Modal */}
      <Modal
        open={showEditQModal && !!editingQuestion}
        onClose={() => setShowEditQModal(false)}
        title="Edit Question"
        maxWidth={640}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowEditQModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleSaveQuestion}
              disabled={actionLoading}
            >
              Save Changes
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="adm-label" htmlFor="q-text">Question Text *</label>
            <textarea
              id="q-text"
              className="adm-textarea"
              rows={2}
              value={qText}
              onChange={(e) => setQText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="adm-label">Options & Correct Answer *</label>
            {qOptions.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={qCorrect === String(i) || qCorrect === letter}
                    onChange={() => setQCorrect(String(i))}
                    aria-label={`Mark option ${letter} as correct`}
                    style={{ accentColor: 'var(--admin-primary)' }}
                  />
                  <span style={{ width: '20px', fontWeight: 700, fontSize: '12px', color: 'var(--admin-text-secondary)', flexShrink: 0 }}>
                    {letter}.
                  </span>
                  <input
                    className="adm-input"
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...qOptions];
                      updated[i] = e.target.value;
                      setQOptions(updated);
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div>
              <label className="adm-label" htmlFor="q-difficulty">Difficulty</label>
              <select
                id="q-difficulty"
                className="adm-select"
                value={qDifficulty}
                onChange={(e) => setQDifficulty(e.target.value)}
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
            <div>
              <label className="adm-label" htmlFor="q-bloom">Bloom Level</label>
              <select
                id="q-bloom"
                className="adm-select"
                value={qBloom}
                onChange={(e) => setQBloom(e.target.value)}
              >
                <option value="REMEMBER">REMEMBER</option>
                <option value="UNDERSTAND">UNDERSTAND</option>
                <option value="APPLY">APPLY</option>
                <option value="ANALYZE">ANALYZE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="adm-label" htmlFor="q-explanation">Explanation *</label>
            <textarea
              id="q-explanation"
              className="adm-textarea"
              rows={2}
              value={qExplanation}
              onChange={(e) => setQExplanation(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Confirmation dialogs for destructive lifecycle actions */}
      <ConfirmDialog
        open={pendingConfirm?.type === 'archive'}
        title="Archive Quiz"
        message="Are you sure you want to archive this quiz? Students will no longer see it."
        confirmLabel="Archive Quiz"
        danger
        onConfirm={handleConfirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingConfirm?.type === 'regenerateQuiz'}
        title="Regenerate Quiz"
        message="Regenerate all questions in this quiz? Manual edits will be replaced."
        confirmLabel="Regenerate All"
        danger
        onConfirm={handleConfirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingConfirm?.type === 'deleteQuestion'}
        title="Delete Question"
        message="Are you sure you want to delete this question?"
        confirmLabel="Delete Question"
        danger
        onConfirm={handleConfirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
};
export default AdminQuizzes;
