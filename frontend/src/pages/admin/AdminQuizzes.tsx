import React, { useState, useEffect } from 'react';
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

export const AdminQuizzes: React.FC = () => {
  const [quizzes, setQuizzes] = useState<AdminQuizItem[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<AdminQuizItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    if (!confirm('Are you sure you want to archive this quiz? Students will no longer see it.')) return;
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
    if (!confirm('Regenerate all questions in this quiz? Manual edits will be replaced.')) return;
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
    if (!confirm('Are you sure you want to delete this question?')) return;
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

  const filteredQuizzes = quizzes.filter((q) => {
    const matchStatus = filterStatus === 'ALL' || q.status === filterStatus;
    const matchSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.topic_title && q.topic_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.chapter_title && q.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              🎯
            </span>
            Quiz Management & Review
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Build 07 — Grounded Assessment Generation, Bloom's Taxonomy Validation & Student Mastery Engine
          </p>
        </div>
        <button
          onClick={() => setShowGenModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium text-sm rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all"
        >
          <span>✨</span> Generate New Quiz
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold ml-4">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Main Grid: Quiz List & Review Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Quiz List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
            <input
              type="text"
              placeholder="Search quiz, topic, chapter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterStatus === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60 max-h-[700px] overflow-y-auto">
            {loading && quizzes.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Loading quizzes...</div>
            ) : filteredQuizzes.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No quizzes match filter.</div>
            ) : (
              filteredQuizzes.map((q) => {
                const isSelected = selectedQuiz?.id === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => handleSelectQuiz(q)}
                    className={`w-full text-left p-4 transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {q.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          q.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : q.status === 'REVIEW'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : q.status === 'ARCHIVED'
                            ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span>{q.topic_title || 'Topic Quiz'}</span>
                      <span>•</span>
                      <span>{q.question_count} Questions</span>
                      {q.is_adaptive && (
                        <span className="text-violet-600 dark:text-violet-400 font-semibold text-[10px] bg-violet-50 dark:bg-violet-950 px-1.5 py-0.2 rounded">
                          Adaptive #{q.attempt_number}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Quiz Review & Questions */}
        <div className="lg:col-span-8 space-y-6">
          {selectedQuiz ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
              {/* Quiz Summary Card */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedQuiz.title}
                    </h2>
                    {selectedQuiz.is_adaptive && (
                      <span className="px-2.5 py-0.5 bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-semibold rounded-full">
                        Adaptive Attempt #{selectedQuiz.attempt_number}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {selectedQuiz.subject_name && (
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        Subject: {selectedQuiz.subject_name}
                      </span>
                    )}
                    {selectedQuiz.chapter_title && (
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        Chapter: {selectedQuiz.chapter_title}
                      </span>
                    )}
                    {selectedQuiz.topic_title && (
                      <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                        Topic: {selectedQuiz.topic_title}
                      </span>
                    )}
                    <span>Passing Score: <strong>{selectedQuiz.passing_score}%</strong></span>
                    <span>Engine: <code>{selectedQuiz.generation_engine || 'deterministic'}</code></span>
                  </div>
                </div>

                {/* Status Badges & Lifecycle Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedQuiz.status === 'DRAFT' && (
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium transition"
                    >
                      Approve for Review
                    </button>
                  )}
                  {selectedQuiz.status === 'REVIEW' && (
                    <>
                      <button
                        onClick={handlePublish}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition"
                      >
                        Publish to Students
                      </button>
                      <button
                        onClick={handleRegenerateQuiz}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium transition"
                      >
                        Regenerate All
                      </button>
                    </>
                  )}
                  {selectedQuiz.status === 'PUBLISHED' && (
                    <button
                      onClick={handleArchive}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl text-xs font-medium transition"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>

              {/* Questions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Questions ({selectedQuiz.questions?.length || 0})</span>
                  </h3>
                  <span className="text-xs text-gray-500">
                    Bloom's Taxonomy Grounded • Distractor Quality Checked
                  </span>
                </div>

                {(!selectedQuiz.questions || selectedQuiz.questions.length === 0) ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    No questions generated yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedQuiz.questions.map((q, idx) => {
                      const options = q.options || [];
                      const correctKey = String(q.correct_answer || '');

                      return (
                        <div
                          key={q.id}
                          className="p-5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-700 space-y-3"
                        >
                          {/* Question Header */}
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
                                  {q.question_text || q.stem}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  {/* Difficulty Badge */}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      q.difficulty === 'EASY'
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                        : q.difficulty === 'HARD'
                                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                    }`}
                                  >
                                    {q.difficulty}
                                  </span>

                                  {/* Bloom's Level */}
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                                    Bloom: {q.bloom_level || 'UNDERSTAND'}
                                  </span>

                                  {q.source_reference && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                      Ref: {q.source_reference}
                                    </span>
                                  )}

                                  {q.weak_concept && (
                                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                                      Concept: {q.weak_concept}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions per question */}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                onClick={() => openEditModal(q)}
                                disabled={actionLoading}
                                title="Edit Question"
                                className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-xs font-medium"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleRegenerateQuestion(q.id)}
                                disabled={actionLoading}
                                title="Regenerate this question"
                                className="p-1.5 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-xs font-medium"
                              >
                                🔄 Regen
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                disabled={actionLoading}
                                title="Delete question"
                                className="p-1.5 text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-xs font-medium"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
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
                                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                                    isCorrect
                                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-medium'
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="flex-1">{optText}</span>
                                  {isCorrect && <span className="text-emerald-600 text-xs font-bold">✓ Correct</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation Box */}
                          {q.explanation && (
                            <div className="ml-9 p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
                              <span className="font-semibold">💡 Explanation: </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              Select a quiz to review its questions and lifecycle status.
            </div>
          )}
        </div>
      </div>

      {/* Generate Quiz Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>✨</span> Generate Grounded Quiz
            </h3>
            <p className="text-xs text-gray-500">
              Extracts approved video plans, educational scripts, and curriculum textbook content to synthesize Bloom-aligned MCQ questions.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chapter *
                </label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => handleChapterChange(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedSubjectId}
                  className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-50"
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Topic *
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => handleTopicChange(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedChapterId}
                  className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-50"
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
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subtopic (Optional)
                </label>
                <select
                  value={selectedSubtopicId}
                  onChange={(e) => setSelectedSubtopicId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedTopicId || subtopics.length === 0}
                  className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-50"
                >
                  <option value="">-- Entire Topic --</option>
                  {subtopics.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question Count
                  </label>
                  <select
                    value={genQuestionCount}
                    onChange={(e) => setGenQuestionCount(Number(e.target.value))}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions (Default)</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={genPassingScore}
                    onChange={(e) => setGenPassingScore(Number(e.target.value))}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Engine Abstraction
                </label>
                <select
                  value={genEngine}
                  onChange={(e) => setGenEngine(e.target.value)}
                  className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="deterministic">Deterministic (Offline Grounded / Fast)</option>
                  <option value="llm">Pluggable LLM (OpenAI / Gemini)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateQuiz}
                disabled={actionLoading || !selectedTopicId}
                className="px-5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition shadow-sm"
              >
                {actionLoading ? 'Generating Questions...' : 'Start Generation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {showEditQModal && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-gray-100 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Question</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Question Text *
                </label>
                <textarea
                  rows={2}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full text-sm p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Options & Correct Answer *
                </label>
                {qOptions.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={qCorrect === String(i) || qCorrect === letter}
                        onChange={() => setQCorrect(String(i))}
                        className="text-indigo-600"
                      />
                      <span className="w-5 font-bold text-xs text-gray-500">{letter}.</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...qOptions];
                          updated[i] = e.target.value;
                          setQOptions(updated);
                        }}
                        className="flex-1 text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bloom Level
                  </label>
                  <select
                    value={qBloom}
                    onChange={(e) => setQBloom(e.target.value)}
                    className="w-full text-sm p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                  >
                    <option value="REMEMBER">REMEMBER</option>
                    <option value="UNDERSTAND">UNDERSTAND</option>
                    <option value="APPLY">APPLY</option>
                    <option value="ANALYZE">ANALYZE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Explanation *
                </label>
                <textarea
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="w-full text-sm p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowEditQModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminQuizzes;
