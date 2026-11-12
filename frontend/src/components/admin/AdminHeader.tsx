import React, { useEffect, useRef, useState } from 'react';
import { Menu, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '../../lib/authContext';

interface AdminHeaderProps {
  breadcrumbs: string[];
  onOpenMobileSidebar: () => void;
}

/**
 * Sticky top header: page breadcrumb, profile menu with sign-out,
 * and a mobile hamburger that opens the sidebar drawer.
 */
export const AdminHeader: React.FC<AdminHeaderProps> = ({ breadcrumbs, onOpenMobileSidebar }) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initials = (user?.name || 'A')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="adm-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          type="button"
          className="adm-menu-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
        >
          <Menu size={19} />
        </button>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: 'var(--admin-border)', fontSize: '14px' }}>/</span>}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                  color: idx === breadcrumbs.length - 1 ? 'var(--admin-text)' : 'var(--admin-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          className="adm-badge"
          style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
          title="Signed in with administrator privileges"
        >
          <ShieldCheck size={12} />
          Admin
        </span>

        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 8px 5px 5px',
                borderRadius: '999px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface)',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--admin-primary)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initials}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--admin-text)',
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--admin-text-secondary)' }} />
            </button>

            {menuOpen && (
              <div
                className="adm-action-menu"
                role="menu"
                style={{ right: 0, top: 'calc(100% + 6px)', minWidth: '220px', padding: '8px' }}
              >
                <div style={{ padding: '6px 10px 8px 10px', borderBottom: '1px solid var(--admin-border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px', overflowWrap: 'anywhere' }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Administrator
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="adm-action-menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  style={{ marginTop: '6px' }}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
