import React from 'react';

interface QuizOptionCardProps {
  label: string;
  optionText: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
}

/**
 * High-focus quiz option selector card.
 * Unslop refactored: Crisp 1px border, high contrast, tactile hover/active state, no blurry glow.
 */
export const QuizOptionCard: React.FC<QuizOptionCardProps> = ({
  label,
  optionText,
  isSelected,
  isDisabled = false,
  onSelect,
}) => {
  return (
    <div
      onClick={() => !isDisabled && onSelect()}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: isSelected ? 'var(--learn-primary-soft)' : 'var(--learn-surface)',
        border: `1.5px solid ${isSelected ? 'var(--learn-primary)' : 'var(--learn-border)'}`,
        cursor: isDisabled ? 'default' : 'pointer',
        transition: 'all var(--duration-fast) var(--ease)',
        opacity: isDisabled ? 0.65 : 1,
        outline: 'none',
      }}
    >
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isSelected ? 'var(--learn-primary)' : 'var(--learn-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? 'var(--learn-primary)' : 'var(--learn-surface-raised)',
          color: isSelected ? '#FFFFFF' : 'var(--learn-text-secondary)',
          fontSize: '12px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '13.5px',
          color: 'var(--learn-text)',
          fontWeight: isSelected ? 500 : 400,
          flex: 1,
          lineHeight: 1.4,
        }}
      >
        {optionText}
      </div>
    </div>
  );
};
