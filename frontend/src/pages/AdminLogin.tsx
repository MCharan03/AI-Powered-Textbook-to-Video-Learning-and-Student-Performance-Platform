import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  ShieldAlert,
  Sun,
  Moon,
} from 'lucide-react';

/**
 * Administrator Console Login (admin.example.com).
 * Unslop refactored: Dark premium cockpit theme, security shield identity,
 * quick-fill demo credentials, password visibility toggle, accessible error handling.
 */
export const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDemoAdmin = () => {
    setEmail('admin@example.com');
    setPassword('AdminPass123!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide your admin email and password.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password, 'admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: 'var(--text)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        className="theme-toggle-btn"
        aria-label="Toggle visual theme"
        style={{ position: 'absolute', top: 20, right: 24 }}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              marginBottom: '14px',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
            }}
          >
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>

          <div
            style={{
              display: 'inline-block',
              padding: '3px 9px',
              borderRadius: 'var(--radius-xs, 4px)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#A5B4FC',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: '10px',
            }}
          >
            admin.veyoralabs.net
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.015em' }}>
            Institutional Administration
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Governance console for curriculum pipelines and publishing
          </p>
        </div>

        {/* Auth Card */}
        <div
          className="adm-card"
          style={{
            padding: '28px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        >
          {/* Quick Demo Fill Helper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: 'var(--surface-raised)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              marginBottom: '18px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Demo: <strong style={{ color: 'var(--text)' }}>System Admin</strong>
            </span>
            <button
              type="button"
              onClick={applyDemoAdmin}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '11.5px',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Fill Credentials
            </button>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--admin-error, #F87171)',
                fontSize: '12.5px',
                marginBottom: '18px',
                lineHeight: 1.4,
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email-input"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Administrator Email or Username
              </label>
              <input
                id="admin-email-input"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'border-color 100ms ease',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Use your registered institutional credentials
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="admin-password-input"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              id="admin-signin-button"
              type="submit"
              disabled={loading}
              className="adm-btn adm-btn-primary"
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Authenticating…' : 'Sign In to Executive Console'}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#94A3B8' }}>
          <span>Student, Parent, or Teacher? </span>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('active_portal', 'learn');
              } catch {}
              window.location.search = '';
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A5B4FC',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: 'inherit',
            }}
          >
            Switch to Learning Portal →
          </button>
        </div>
      </div>
    </div>
  );
};
