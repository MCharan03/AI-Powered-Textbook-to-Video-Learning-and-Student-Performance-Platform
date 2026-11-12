import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Inline error state with optional retry action.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
      padding: '14px 16px',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--admin-error-soft)',
      border: '1px solid #FECACA',
      color: 'var(--admin-error)',
      fontSize: '13px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflowWrap: 'anywhere' }}>{message}</span>
    </div>
    {onRetry && (
      <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);
