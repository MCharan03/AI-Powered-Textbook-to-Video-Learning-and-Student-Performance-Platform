import React from 'react';

interface MasteryProgressBarProps {
  percentage: number;
  label?: string;
  target?: number;
  height?: number;
}

/**
 * High-clarity mastery telemetry bar.
 * Unslop refactored: Crisp indicator lines, tabular numbers, restrained palette.
 */
export const MasteryProgressBar: React.FC<MasteryProgressBarProps> = ({
  percentage,
  label,
  target = 80,
  height = 6,
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));
  const isMastered = clamped >= target;

  const barColor = isMastered
    ? 'var(--learn-success, #059669)'
    : clamped >= 50
      ? 'var(--learn-warning, #D97706)'
      : 'var(--learn-error, #DC2626)';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(label || percentage !== undefined) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          {label && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {label}
            </span>
          )}
          <span style={{ fontWeight: 600, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
            {clamped.toFixed(1)}% {isMastered && '✓ Mastered'}
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--surface-raised)',
          borderRadius: '3px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: '3px',
            transition: 'width 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        {/* Target threshold pip */}
        <div
          style={{
            position: 'absolute',
            left: `${target}%`,
            top: 0,
            bottom: 0,
            width: '1.5px',
            backgroundColor: 'var(--text)',
            opacity: 0.35,
          }}
          title={`Target Mastery Threshold: ${target}%`}
        />
      </div>
    </div>
  );
};
