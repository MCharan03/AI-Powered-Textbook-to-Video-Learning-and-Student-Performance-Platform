import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { QuizOptionCard } from '../../components/QuizOptionCard';
import { ScoreSummaryCard } from '../../components/ScoreSummaryCard';
import { api } from '../../lib/api';
import { TopicQuiz, QuizSubmissionResult } from '../../lib/types';

interface StudentQuizProps {
  onNavigate: (route: string) => void;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ onNavigate }) => {
  const [quiz, setQuiz] = useState<TopicQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        // Fetch published quiz for topic 1
        const data = await api.getTopicQuiz(1);
        setQuiz(data);
      } catch (err: any) {
        setError(err.message || 'No approved quiz found for this topic.');
      }
    };
    fetchQuiz();
  }, []);

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
      const res = await api.submitQuizAttempt(quiz.id, numericAnswers);
      setResult(res);
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
  };

  if (error) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', color: '#EF4444' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '12px' }}>
            Quiz Pending Administrator Approval
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>{error}</p>
        </div>
      </SurfacePanel>
    );
  }

  if (result) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
          Quiz Assessment Results
        </h1>
        <ScoreSummaryCard
          result={result}
          onRetry={handleRetry}
          onStartAdaptive={() => onNavigate('student-adaptive')}
        />
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
