import React from 'react';
import { PipelineStageStatus } from '../lib/types';

interface PipelineStepperProps {
  stages: PipelineStageStatus[];
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {stageLabels.map(({ num, name }) => {
          const status = getStageStatus(num);
          const details = getStageDetails(num);

          let circleBg = '#334155';
          let circleColor = '#94A3B8';
          let borderCol = '#334155';
          let statusText = 'Pending';

          if (status === 'completed') {
            circleBg = 'rgba(16, 185, 129, 0.2)';
            circleColor = '#10B981';
            borderCol = '#10B981';
            statusText = 'Completed';
          } else if (status === 'running') {
            circleBg = 'rgba(245, 158, 11, 0.2)';
            circleColor = '#F59E0B';
            borderCol = '#F59E0B';
            statusText = 'Processing...';
          } else if (status === 'failed') {
            circleBg = 'rgba(239, 68, 68, 0.2)';
            circleColor = '#EF4444';
            borderCol = '#EF4444';
            statusText = 'Failed';
          }

          return (
            <div
              key={num}
              style={{
                border: `1px solid ${borderCol}`,
                borderRadius: '10px',
                padding: '14px',
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: circleBg,
                    color: circleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    border: `1px solid ${circleColor}`,
                  }}
                >
                  {status === 'completed' ? '✓' : num}
                </span>
                <span style={{ fontSize: '11px', color: circleColor, fontWeight: 600 }}>
                  {statusText}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>{name}</div>
              {details && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: 'auto' }}>
                  {details}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
