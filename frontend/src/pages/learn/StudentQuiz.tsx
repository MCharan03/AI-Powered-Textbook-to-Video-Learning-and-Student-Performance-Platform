import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { QuizOptionCard } from '../../components/QuizOptionCard';
import { ScoreSummaryCard } from '../../components/ScoreSummaryCard';
import { api } from '../../lib/api';
import { TopicQuiz, QuizSubmissionResult, QuestionResultItem } from '../../lib/types';

interface StudentQuizProps {
  onNavigate: (route: string, params?: any) => void;
  quizId?: number;
  topicId?: number;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ onNavigate, quizId, topicId }) => {
  const [quiz, setQuiz] = useState<TopicQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [detailedBreakdown, setDetailedBreakdown] = useState<QuestionResultItem[]>([]);
  const [recommendation, setRecommendation] = useState<string>('');
  const [adaptiveRecommended, setAdaptiveRecommended] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setError(null);
        let data: TopicQuiz | null = null;
        if (quizId) {
          data = await api.getQuiz(quizId);
        } else if (topicId) {
          data = await api.getTopicQuiz(topicId);
        } else {
          // Resolve from student progress summary quizzes
          const summary = await api.getProgressSummary();
          const firstQuiz = summary.quizzes?.[0];
          if (firstQuiz) {
            data = await api.getQuiz(firstQuiz.item_id);
          } else {
            setError('No published quizzes are available for your assigned curriculum.');
            return;
          }
        }
        setQuiz(data);
      } catch (err: any) {
        setError(err.message || 'No approved quiz found for this topic.');
      }
    };
    fetchQuiz();
  }, [quizId, topicId]);

  const handleSelectOption = (questionId: number, optionLetter: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [String(questionId)]: optionLetter,
    }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    try {
      setSubmitting(true);
      const numericAnswers: Record<string, number> = {};
      for (const [qId, letter] of Object.entries(selectedAnswers)) {
        numericAnswers[qId] = letter.charCodeAt(0) - 65;
      }
      const res: any = await api.submitDetailedQuizAttempt(quiz.id, numericAnswers);
      const adaptedResult: QuizSubmissionResult = {
        attempt_id: res.attempt_id || res.id,
        score_percentage: res.percentage !== undefined ? res.percentage : (res.score || 0),
        passed: res.passed,
        mastery_threshold: res.passing_score || 80,
        weak_concepts: res.weak_concepts || [],
        message: res.recommendation || ''
      };
      setResult(adaptedResult);
      setDetailedBreakdown(res.question_results || []);
      setRecommendation(res.recommendation || '');
      setAdaptiveRecommended(res.adaptive_recommended || !res.passed);
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setCurrentIdx(0);
    setResult(null);
    setDetailedBreakdown([]);
  };

  if (error) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', color: '#EF4444' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '12px' }}>
            Quiz Content Unavailable
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>{error}</p>
          <button
            onClick={() => onNavigate('student-dashboard')}
            style={{
              marginTop: '16px',
              padding: '8px 18px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ← Back to Learning Dashboard
          </button>
        </div>
      </SurfacePanel>
    );
  }

  if (result) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
          Quiz Assessment Results
        </h1>
        <ScoreSummaryCard
          result={result}
          onRetry={handleRetry}
          onStartAdaptive={() => onNavigate('student-adaptive')}
        />

        {recommendation && (
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#3730A3', fontSize: '14px' }}>
            <strong>💡 Recommendation: </strong> {recommendation}
          </div>
        )}

        {/* Detailed Question Review Breakdown */}
        {detailedBreakdown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B' }}>Question Breakdown & Explanations</h2>
            {detailedBreakdown.map((qr, qidx) => (
              <div
                key={qr.question_id || qidx}
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: qr.is_correct ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${qr.is_correct ? '#BBF7D0' : '#FECACA'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>
                    Q{qidx + 1}. {qr.question_text}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: qr.is_correct ? '#16A34A' : '#DC2626',
                      color: '#FFFFFF',
                    }}
                  >
                    {qr.is_correct ? 'CORRECT' : 'INCORRECT'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Your Answer: <strong style={{ color: qr.is_correct ? '#16A34A' : '#DC2626' }}>{String(qr.selected_answer)}</strong> • Correct Answer: <strong style={{ color: '#16A34A' }}>{String(qr.correct_answer)}</strong>
                </div>
                {qr.explanation && (
                  <div style={{ fontSize: '12px', color: '#334155', backgroundColor: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: '8px', marginTop: '4px' }}>
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

  if (!quiz || quiz.questions.length === 0) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '24px' }}>Loading topic quiz...</div>
      </SurfacePanel>
    );
  }

  const currentQ = quiz.questions[currentIdx];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isLastQuestion = currentIdx === quiz.questions.length - 1;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textTransform: 'uppercase' }}>
            {quiz.title}
          </span>
          <span style={{ fontSize: '13px', color: '#64748B' }}>
            Question {currentIdx + 1} of {quiz.questions.length}
          </span>
        </div>
        <div
          style={{
            height: '4px',
            backgroundColor: '#E2E8F0',
            borderRadius: '2px',
            marginTop: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: '#2563EB',
              width: `${((currentIdx + 1) / quiz.questions.length) * 100}%`,
              transition: 'width 200ms ease',
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', lineHeight: '26px' }}>
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
                  onSelect={() => handleSelectOption(currentQ.id, letter)}
                />
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
              disabled={currentIdx === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #CBD5E1',
                color: '#64748B',
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIdx === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={answeredCount === 0 || submitting}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: answeredCount === 0 || submitting ? 'not-allowed' : 'pointer',
                  opacity: answeredCount === 0 || submitting ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                }}
              >
                {submitting ? 'Submitting & Grading...' : 'Submit Quiz Attempt'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx((p) => Math.min(quiz.questions.length - 1, p + 1))}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#2563EB',
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
