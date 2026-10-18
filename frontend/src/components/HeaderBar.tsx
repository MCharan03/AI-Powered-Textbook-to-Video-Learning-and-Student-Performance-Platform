import React from 'react';
import { useAuth } from '../lib/authContext';
import { UserRole } from '../lib/types';

interface HeaderBarProps {
  breadcrumbs: string[];
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ breadcrumbs }) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const domain = isAdmin ? 'admin.veyoralabs.net' : 'learn.veyoralabs.net';

  return (
    <header
      style={{
        height: '64px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${isAdmin ? 'var(--admin-border)' : 'var(--learn-border)'}`,
        backgroundColor: isAdmin ? 'var(--admin-surface)' : 'var(--learn-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Domain & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: isAdmin ? 'rgba(99, 102, 241, 0.2)' : 'rgba(37, 99, 235, 0.1)',
            color: isAdmin ? 'var(--admin-primary)' : 'var(--learn-primary)',
            border: `1px solid ${isAdmin ? 'rgba(99, 102, 241, 0.4)' : 'rgba(37, 99, 235, 0.3)'}`,
          }}
        >
          {domain}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)' }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              <span style={{ color: idx === breadcrumbs.length - 1 ? (isAdmin ? 'var(--admin-text)' : 'var(--learn-text)') : undefined, fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400 }}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: User Profile & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isAdmin ? 'var(--admin-text)' : 'var(--learn-text)' }}>{user.name}</div>
              <div style={{ fontSize: '11px', color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {user.role}
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: `1px solid ${isAdmin ? 'var(--admin-border)' : 'var(--learn-border)'}`,
                color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

