import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { UserRole } from '../lib/types';
import { SurfacePanel } from '../components/SurfacePanel';

export const Login: React.FC = () => {
  const { login, quickSwitch } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleQuickLogin = async (role: UserRole) => {
    try {
      setLoading(true);
      setError(null);
      await quickSwitch(role);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>
            Textbook-to-Video Platform
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '6px' }}>
            AI-Powered Modular Learning & Performance Management
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            border: '1px solid #334155',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #EF4444',
                color: '#EF4444',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#6366F1',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Sign In */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', marginBottom: '12px' }}>
              Quick Demo Access by Persona:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleRoleQuickLogin('admin')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid #6366F1',
                  color: '#818CF8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                👑 Administrator
              </button>
              <button
                type="button"
                onClick={() => handleRoleQuickLogin('student')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  border: '1px solid #3B82F6',
                  color: '#60A5FA',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🎓 Student
              </button>
              <button
                type="button"
                onClick={() => handleRoleQuickLogin('teacher')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  color: '#34D399',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📚 Teacher (Observer)
              </button>
              <button
                type="button"
                onClick={() => handleRoleQuickLogin('parent')}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid #F59E0B',
                  color: '#FBBF24',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                👨‍👩‍👦 Parent (Observer)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
