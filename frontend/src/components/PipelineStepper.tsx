import React from 'react';
import { Check } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PipelineStageStatus } from '../lib/types';

interface PipelineStepperProps {
  stages: PipelineStageStatus[];
}

/**
 * Light-themed pipeline stage cards: numbered step, stage name,
 * shared StatusBadge for the stage status, and stage details.
 */
export const PipelineStepper: React.FC<PipelineStepperProps> = ({ stages }) => {
  const stageLabels = [
    { num: 1, name: 'PDF Ingestion & OCR' },
    { num: 2, name: 'Hierarchical Extraction' },
    { num: 3, name: 'Content Segmentation (~5-6 min)' },
    { num: 4, name: 'Script & Video Synthesis' },
    { num: 5, name: 'Topic Quiz Generation' },
    { num: 6, name: 'Adaptive Quiz Regeneration' },
  ];

  const getStageStatus = (num: number) => {
    const s = stages.find((st) => st.stage === num);
    return s?.status || 'pending';
  };

  const getStageDetails = (num: number) => {
    const s = stages.find((st) => st.stage === num);
    return s?.details || '';
  };

  const getStageCompletedAt = (num: number) => {
    const s = stages.find((st) => st.stage === num);
    return s?.completed_at || '';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
      {stageLabels.map(({ num, name }) => {
        const status = getStageStatus(num);
        const details = getStageDetails(num);
        const completedAt = getStageCompletedAt(num);
        const done = status === 'completed';

        return (
          <div
            key={num}
            style={{
              border: `1px solid ${status === 'failed' ? '#FECACA' : 'var(--admin-border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              backgroundColor: 'var(--admin-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: done
                    ? 'var(--admin-success-soft)'
                    : status === 'failed'
                    ? 'var(--admin-error-soft)'
                    : 'var(--admin-primary-soft)',
                  color: done
                    ? 'var(--admin-success)'
                    : status === 'failed'
                    ? 'var(--admin-error)'
                    : 'var(--admin-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : num}
              </span>
              <StatusBadge status={status} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', lineHeight: '18px' }}>
              {name}
            </div>
            {details && (
              <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: 'auto' }}>
                {details}
              </div>
            )}
            {done && completedAt && (
              <div style={{ fontSize: '10px', color: 'var(--admin-text-secondary)' }}>
                Completed {new Date(completedAt).toLocaleString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
