import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';

export const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        backgroundColor: '#090A10',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header branding */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#A5B4FC',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '14px',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
            admin.veyoralabs.net
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px 0', color: '#FFFFFF' }}>
            Admin Portal
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
            Curriculum Governance & Academic Operations
          </p>
        </div>

        {/* Auth Card */}
        <div
          style={{
            backgroundColor: '#11131E',
            borderRadius: '16px',
            border: '1px solid #1E2235',
            padding: '30px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#F87171',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Admin Email
              </label>
              <input
                id="admin-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0A0C14',
                  border: '1px solid #2B324D',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748B' }}>
                Use your registered institutional administrator email address
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Password
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0A0C14',
                  border: '1px solid #2B324D',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              id="admin-signin-button"
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#4F46E5',
                backgroundImage: 'linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

