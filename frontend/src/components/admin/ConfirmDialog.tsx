import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog used before destructive or irreversible actions.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    onClose={loading ? () => undefined : onCancel}
    title={title}
    maxWidth={420}
    footer={
      <>
        <button type="button" className="adm-btn adm-btn-secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`adm-btn ${danger ? 'adm-btn-danger' : 'adm-btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Working…' : confirmLabel}
        </button>
      </>
    }
  >
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {danger && (
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            backgroundColor: 'var(--admin-error-soft)',
            color: 'var(--admin-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={18} />
        </div>
      )}
      <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '20px', paddingTop: danger ? '7px' : 0 }}>
        {message}
      </p>
    </div>
  </Modal>
);
