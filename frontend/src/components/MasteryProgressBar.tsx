import React from 'react';

interface MasteryProgressBarProps {
  percentage: number;
  label?: string;
  target?: number;
  height?: number;
}

export const MasteryProgressBar: React.FC<MasteryProgressBarProps> = ({
  percentage,
  label,
  target = 80,
  height = 8,
}) => {
  const isDark = document.body.className.includes('theme-admin');
  const clamped = Math.min(100, Math.max(0, percentage));
  const isMastered = clamped >= target;

  const barColor = isMastered ? '#10B981' : clamped >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(label || percentage !== undefined) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          {label && <span style={{ color: isDark ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)' }}>{label}</span>}
          <span style={{ fontWeight: 600, color: barColor }}>
            {clamped.toFixed(1)}% {isMastered && '✓ Mastered'}
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: isDark ? '#334155' : '#E2E8F0',
          borderRadius: `${height}px`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: `${height}px`,
            transition: 'width 300ms ease',
          }}
        />
        {/* Target indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${target}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
            opacity: 0.4,
          }}
          title={`Target Mastery: ${target}%`}
        />
      </div>
    </div>
  );
};
