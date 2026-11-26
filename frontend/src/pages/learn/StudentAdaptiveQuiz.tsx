import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { QuizOptionCard } from '../../components/QuizOptionCard';
import { api } from '../../lib/api';
import { TopicQuiz, QuestionResultItem } from '../../lib/types';

interface StudentAdaptiveQuizProps {
  onNavigate: (route: string, params?: any) => void;
  topicId?: number;
}

/**
 * PHASE 3B: Adaptive remediation is now a REAL graded flow.
 * 1. A persisted adaptive quiz is created for the student's weak concepts
 *    (POST /learn/topics/{id}/adaptive-quiz).
 * 2. Answers are submitted through the standard grading contract
 *    (POST /learn/quizzes/{id}/submit) — the attempt is stored and feeds
 *    mastery metrics and future adaptive targeting.
 * 3. Errors surface as inline banners; completion requires a server result.
 */
export const StudentAdaptiveQuiz: React.FC<StudentAdaptiveQuizProps> = ({ onNavigate, topicId }) => {
  const [adaptiveQuiz, setAdaptiveQuiz] = useState<TopicQuiz | null>(null);
  const [weakConcepts, setWeakConcepts] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResultItem[]>([]);
  const [resultSummary, setResultSummary] = useState<{
    percentage: number; passed: boolean; weak_concepts: string[]; recommendation: string;
  } | null>(null);

  useEffect(() => {
    const startSession = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        let targetTopicId = topicId;
        if (!targetTopicId) {
          const summary = await api.getProgressSummary();
          targetTopicId = summary.resume_learning?.topic_id || summary.quizzes?.[0]?.topic_id;
        }
        if (!targetTopicId) {
          setLoadError('No topic is ready for adaptive remediation yet. Complete a topic quiz first.');
          return;
        }

        // Read-only targeted concepts (for display), then persist a real adaptive quiz
        try {
          const preview = await api.getAdaptiveQuiz(targetTopicId);
          setWeakConcepts(preview.weak_concepts_targeted || []);
        } catch {
          // Preview is best-effort; the persisted quiz itself is what matters
        }

        const quiz = await api.startAdaptiveQuiz(targetTopicId);
        if (!quiz.questions || quiz.questions.length === 0) {
          setLoadError('No adaptive questions could be generated for this topic yet. Try again after completing a topic quiz.');
          return;
        }
        setAdaptiveQuiz(quiz);
      } catch (err: any) {
        setLoadError(err?.message || 'Adaptive quiz session could not be started.');
      } finally {
        setLoading(false);
      }
    };
    startSession();
  }, [topicId]);

  const handleSelect = (qId: number, letter: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [String(qId)]: letter }));
  };

  const handleFinish = async () => {
    if (!adaptiveQuiz) return;
    setSubmitError(null);

    const unanswered = adaptiveQuiz.questions.filter((q) => !selectedAnswers[String(q.id)]);
    if (unanswered.length > 0) {
      setSubmitError(`${unanswered.length} question${unanswered.length > 1 ? 's' : ''} still unanswered. Please answer every question before completing remediation.`);
      return;
    }

    try {
      setSubmitting(true);
      const numericAnswers: Record<string, number> = {};
      for (const [qId, letter] of Object.entries(selectedAnswers)) {
        numericAnswers[qId] = letter.charCodeAt(0) - 65;
      }
      const res: any = await api.submitDetailedQuizAttempt(adaptiveQuiz.id, numericAnswers);
      setQuestionResults(res.question_results || []);
      setResultSummary({
        percentage: res.percentage !== undefined ? res.percentage : (res.score || 0),
        passed: !!res.passed,
        weak_concepts: res.weak_concepts || [],
        recommendation: res.recommendation || '',
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed. Your answers were not graded — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', color: 'var(--learn-warning, #D97706)' }}>💡</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: '12px' }}>
            No Active Remediation Session
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '480px', margin: '6px auto 0' }}>
            {loadError}
          </p>
          <button
            onClick={() => onNavigate('student-quiz')}
            style={{
              marginTop: '16px',
              padding: '8px 18px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              color: '#FFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Take Topic Quiz First
          </button>
        </div>
      </SurfacePanel>
    );
  }

  if (resultSummary && adaptiveQuiz) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
          Adaptive Remediation Results
        </h1>
        <SurfacePanel>
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '36px', color: resultSummary.passed ? 'var(--learn-success, #10B981)' : 'var(--learn-warning, #F59E0B)', marginBottom: '12px' }}>
              {resultSummary.passed ? '🎉' : '📝'}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              {resultSummary.percentage}% — {resultSummary.passed ? 'Concepts Reinforced' : 'Keep Practicing'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {resultSummary.recommendation || 'Your mastery metrics have been updated.'}
            </p>
            {resultSummary.weak_concepts.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Still targeting:</span>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                  {resultSummary.weak_concepts.map((c, idx) => (
                    <span key={idx} style={{
                      padding: '2px 8px', borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--learn-error, #DC2626)',
                      fontSize: '11px', fontWeight: 600,
                    }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              <button
                onClick={() => onNavigate('student-mastery')}
                style={{
                  padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--primary)',
                  color: '#FFF', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                }}
              >
                View Updated Mastery →
              </button>
              <button
                onClick={() => onNavigate('student-dashboard')}
                style={{
                  padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--surface-raised)',
                  color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </SurfacePanel>

        {questionResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B' }}>Question Breakdown & Explanations</h2>
            {questionResults.map((qr, qidx) => (
              <div
                key={qr.question_id || qidx}
                style={{
                  padding: '16px 20px', borderRadius: '12px',
                  backgroundColor: qr.is_correct ? 'var(--surface-raised)' : 'var(--surface-raised)',
                  border: `1px solid ${qr.is_correct ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                    Q{qidx + 1}. {qr.question_text}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                    backgroundColor: qr.is_correct ? 'var(--learn-success, #16A34A)' : 'var(--learn-error, #DC2626)', color: '#FFFFFF',
                  }}>
                    {qr.is_correct ? 'CORRECT' : 'INCORRECT'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Your Answer: <strong style={{ color: qr.is_correct ? 'var(--learn-success, #16A34A)' : 'var(--learn-error, #DC2626)' }}>{String(qr.selected_answer)}</strong> • Correct Answer: <strong style={{ color: 'var(--learn-success, #16A34A)' }}>{String(qr.correct_answer)}</strong>
                </div>
                {qr.explanation && (
                  <div style={{ fontSize: '12px', color: 'var(--text)', backgroundColor: 'var(--surface)', padding: '10px 12px', borderRadius: '8px', marginTop: '4px', border: '1px solid var(--border)' }}>
                    <strong>Explanation:</strong> {qr.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '24px' }}>Generating your targeted adaptive quiz...</div>
      </SurfacePanel>
    );
  }

  if (!adaptiveQuiz || adaptiveQuiz.questions.length === 0) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '24px' }}>Loading Stage 6 adaptive questions...</div>
      </SurfacePanel>
    );
  }

  const currentQ = adaptiveQuiz.questions[currentIdx];
  const isLast = currentIdx === adaptiveQuiz.questions.length - 1;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                color: '#D97706',
              }}
            >
              STAGE 6 ADAPTIVE REMEDIATION
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
              Targeted Concept Practice
            </h1>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Question {currentIdx + 1} of {adaptiveQuiz.questions.length}
          </span>
        </div>

        {/* Targeted Weak Concepts Tags */}
        {weakConcepts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Targeting:</span>
            {weakConcepts.map((c, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--learn-error, #DC2626)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {submitError && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          color: 'var(--learn-error, #B91C1C)', fontSize: '13px', fontWeight: 500,
        }}>
          ⚠ {submitError}
        </div>
      )}

      <SurfacePanel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text)', lineHeight: '24px' }}>
            {currentIdx + 1}. {currentQ.question_text}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentQ.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isSelected = selectedAnswers[String(currentQ.id)] === letter;
              return (
                <QuizOptionCard
                  key={optIdx}
                  label={letter}
                  optionText={opt}
                  isSelected={isSelected}
                  onSelect={() => handleSelect(currentQ.id, letter)}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIdx === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>

            {isLast ? (
              <button
                onClick={handleFinish}
                disabled={submitting}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--learn-success, #059669)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Grading...' : 'Complete Remediation ✓'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx((p) => p + 1)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </SurfacePanel>
    </div>
  );
};
