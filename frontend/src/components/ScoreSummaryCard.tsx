import React from 'react';
import { QuizSubmissionResult } from '../lib/types';

interface ScoreSummaryCardProps {
  result: QuizSubmissionResult;
  onStartAdaptive?: () => void;
  onRetry?: () => void;
}

export const ScoreSummaryCard: React.FC<ScoreSummaryCardProps> = ({
  result,
  onStartAdaptive,
  onRetry,
}) => {
  const isPassed = result.passed;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isPassed ? '#10B981' : '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 700,
          border: `2px solid ${isPassed ? '#10B981' : '#EF4444'}`,
        }}
      >
        {isPassed ? '✓' : '!'}
      </div>

      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
          {isPassed ? 'Mastery Achieved!' : 'Needs Remediation'}
        </h2>
        <p style={{ fontSize: '15px', color: '#64748B', marginTop: '6px' }}>
          Score: <strong style={{ color: isPassed ? '#10B981' : '#EF4444' }}>{result.score_percentage}%</strong> (Passing threshold: {result.mastery_threshold}%)
        </p>
      </div>

      {result.weak_concepts && result.weak_concepts.length > 0 && (
        <div style={{ width: '100%', maxWidth: '480px', marginTop: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            Targeted Concepts for Review:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {result.weak_concepts.map((concept, idx) => (
              <span
                key={idx}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#DC2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        {onRetry && (
          <button
            onClick={onRetry}
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
            Review Questions
          </button>
        )}
        {result.weak_concepts && result.weak_concepts.length > 0 && onStartAdaptive && (
          <button
            onClick={onStartAdaptive}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            Start Adaptive Remediation →
          </button>
        )}
      </div>
    </div>
  );
};
