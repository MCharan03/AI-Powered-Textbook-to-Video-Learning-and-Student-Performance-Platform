import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
}

/**
 * Row-level kebab action menu. Renders in a fixed-position layer so it
 * is never clipped by scrollable table containers; closes on outside
 * click or Escape.
 */
export const ActionMenu: React.FC<ActionMenuProps> = ({ items, ariaLabel = 'Row actions' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 180;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const menuHeight = items.length * 32 + 16;
      const openUp = rect.bottom + menuHeight > window.innerHeight - 8 && rect.top > menuHeight;
      setPos({
        top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left,
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        hostRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={hostRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: open ? 'var(--admin-surface-raised)' : 'transparent',
          color: 'var(--admin-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <MoreVertical size={16} />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          className="adm-action-menu"
          role="menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: '176px',
            zIndex: 1300,
          }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              className={`adm-action-menu-item${item.danger ? ' danger' : ''}`}
              disabled={item.disabled}
              style={item.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
