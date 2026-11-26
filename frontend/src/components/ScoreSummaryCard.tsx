import React from 'react';
import { QuizSubmissionResult } from '../lib/types';
import { CheckCircle2, AlertCircle, RotateCcw, ArrowRight, ShieldCheck } from 'lucide-react';

interface ScoreSummaryCardProps {
  result: QuizSubmissionResult;
  onStartAdaptive?: () => void;
  onRetry?: () => void;
}

/**
 * High-clarity quiz outcome summary card.
 * Unslop refactored: Subtractive design, Lucide verification icons, tabular numbers, actionable next steps.
 */
export const ScoreSummaryCard: React.FC<ScoreSummaryCardProps> = ({
  result,
  onStartAdaptive,
  onRetry,
}) => {
  const isPassed = result.passed;

  return (
    <div
      className="lrn-card"
      style={{
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '20px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      {/* Result Status Indicator */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: isPassed ? 'var(--learn-success-soft)' : 'var(--learn-error-soft)',
          color: isPassed ? 'var(--learn-success)' : 'var(--learn-error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${isPassed ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
        }}
      >
        {isPassed ? <CheckCircle2 size={30} strokeWidth={2.2} /> : <AlertCircle size={30} strokeWidth={2.2} />}
      </div>

      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--learn-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Assessment Outcome
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--learn-text)', marginTop: '4px' }}>
          {isPassed ? 'Mastery Benchmark Achieved' : 'Remediation Recommended'}
        </h2>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: isPassed ? 'var(--learn-success)' : 'var(--learn-error)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {result.score_percentage}%
          </span>
          <span style={{ fontSize: '13px', color: 'var(--learn-text-secondary)' }}>
            (Threshold: {result.mastery_threshold}%)
          </span>
        </div>
      </div>

      {result.weak_concepts && result.weak_concepts.length > 0 && (
        <div
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--learn-surface-raised)',
            border: '1px solid var(--learn-border)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--learn-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '8px',
            }}
          >
            Identified Knowledge Gaps
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {result.weak_concepts.map((concept, idx) => (
              <span
                key={idx}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--learn-error-soft)',
                  color: 'var(--learn-error)',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                }}
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            className="lrn-btn lrn-btn-secondary"
            style={{ padding: '9px 18px' }}
          >
            <RotateCcw size={14} />
            <span>Retake Quiz</span>
          </button>
        )}
        {onStartAdaptive && (
          <button
            onClick={onStartAdaptive}
            className="lrn-btn lrn-btn-primary"
            style={{ padding: '9px 18px' }}
          >
            <span>Start Adaptive Remediation</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
