import React from 'react';

interface QuizOptionCardProps {
  label: string;
  optionText: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
}

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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px 20px',
        borderRadius: '10px',
        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : '#FFFFFF',
        border: `1.5px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
        cursor: isDisabled ? 'default' : 'pointer',
        boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: isDisabled ? 0.7 : 1,
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: `2px solid ${isSelected ? '#2563EB' : '#CBD5E1'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? '#2563EB' : 'transparent',
          color: '#FFF',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: isSelected ? 500 : 400, flex: 1 }}>
        {optionText}
      </div>
    </div>
  );
};
