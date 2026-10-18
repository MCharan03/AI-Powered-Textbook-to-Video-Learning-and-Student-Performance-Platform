import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { QuizOptionCard } from '../../components/QuizOptionCard';
import { api } from '../../lib/api';
import { AdaptiveQuiz } from '../../lib/types';

interface StudentAdaptiveQuizProps {
  onNavigate: (route: string, params?: any) => void;
  topicId?: number;
}

export const StudentAdaptiveQuiz: React.FC<StudentAdaptiveQuizProps> = ({ onNavigate, topicId }) => {
  const [adaptiveQuiz, setAdaptiveQuiz] = useState<AdaptiveQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdaptive = async () => {
      try {
        setLoading(true);
        let targetTopicId = topicId;
        if (!targetTopicId) {
          const summary = await api.getProgressSummary();
          targetTopicId = summary.resume_learning?.topic_id || summary.quizzes?.[0]?.topic_id;
        }
        const data = await api.getAdaptiveQuiz(targetTopicId);
        setAdaptiveQuiz(data);
      } catch (err: any) {
        setError(err.message || 'Adaptive quiz session could not be retrieved.');
      } finally {
        setLoading(false);
      }
    };
    fetchAdaptive();
  }, [topicId]);

  const handleSelect = (qId: number, letter: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [String(qId)]: letter }));
  };

  const handleFinish = () => {
    setCompleted(true);
  };

  if (error) {
    return (
      <SurfacePanel>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', color: '#D97706' }}>💡</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '12px' }}>
            No Active Remediation Session
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px', maxWidth: '480px', margin: '6px auto 0' }}>
            {error}
          </p>
          <button
            onClick={() => onNavigate('student-quiz')}
            style={{
              marginTop: '16px',
              padding: '8px 18px',
              borderRadius: '6px',
              backgroundColor: '#2563EB',
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

  if (completed) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <SurfacePanel>
          <div style={{ fontSize: '36px', color: '#10B981', marginBottom: '12px' }}>🎉</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
            Adaptive Remediation Complete!
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '8px' }}>
            You have reinforced your targeted weak concepts. Your mastery metrics have been updated.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => onNavigate('student-mastery')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#2563EB',
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              View Updated Mastery →
            </button>
            <button
              onClick={() => onNavigate('student-dashboard')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </SurfacePanel>
      </div>
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
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              Targeted Concept Practice
            </h1>
          </div>
          <span style={{ fontSize: '13px', color: '#64748B' }}>
            Question {currentIdx + 1} of {adaptiveQuiz.questions.length}
          </span>
        </div>

        {/* Targeted Weak Concepts Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Targeting:</span>
          {adaptiveQuiz.weak_concepts_targeted.map((c, idx) => (
            <span
              key={idx}
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#DC2626',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <SurfacePanel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#0F172A', lineHeight: '24px' }}>
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
                border: '1px solid #CBD5E1',
                color: '#64748B',
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIdx === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>

            {isLast ? (
              <button
                onClick={handleFinish}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Complete Remediation ✓
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx((p) => p + 1)}
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
