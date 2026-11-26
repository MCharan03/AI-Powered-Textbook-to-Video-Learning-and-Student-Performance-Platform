import React from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { LogOut, ChevronRight, Sun, Moon } from 'lucide-react';

interface HeaderBarProps {
  breadcrumbs: string[];
}

/**
 * Learning Portal Header Bar.
 * Unslop refactored: Clean breadcrumbs, explicit domain pill, accessible user menu,
 * and seamless light/dark theme toggle button.
 */
export const HeaderBar: React.FC<HeaderBarProps> = ({ breadcrumbs }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === 'admin';
  const domain = isAdmin ? 'admin.veyoralabs.net' : 'learn.veyoralabs.net';

  return (
    <header
      style={{
        height: 'var(--header-height)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'background-color var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease)',
      }}
    >
      {/* Left: Domain Indicator & Clean Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: 'var(--primary-soft)',
            color: 'var(--primary)',
            border: '1px solid var(--border)',
            letterSpacing: '0.02em',
          }}
        >
          {domain}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={13} color="var(--text-muted)" />}
                <span
                  style={{
                    color: isLast ? 'var(--text)' : 'var(--text-secondary)',
                    fontWeight: isLast ? 600 : 400,
                  }}
                >
                  {crumb}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right: Theme Toggle, User Profile & Sign Out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="theme-toggle-btn"
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                {user.name}
              </div>
              <div
                style={{
                  fontSize: '10.5px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {user.role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="lrn-btn lrn-btn-secondary"
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
