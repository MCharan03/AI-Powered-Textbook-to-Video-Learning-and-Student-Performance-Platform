import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface MessageBannerProps {
  message: { text: string; type: 'success' | 'error' } | null;
  onDismiss?: () => void;
}

/**
 * Dismissible success/error feedback banner.
 */
export const MessageBanner: React.FC<MessageBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;
  const isError = message.type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isError ? 'var(--admin-error-soft)' : 'var(--admin-success-soft)',
        border: `1px solid ${isError ? '#FECACA' : '#BBF7D0'}`,
        color: isError ? 'var(--admin-error)' : 'var(--admin-success)',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        {isError ? <AlertCircle size={15} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={15} style={{ flexShrink: 0 }} />}
        <span style={{ overflowWrap: 'anywhere' }}>{message.text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
