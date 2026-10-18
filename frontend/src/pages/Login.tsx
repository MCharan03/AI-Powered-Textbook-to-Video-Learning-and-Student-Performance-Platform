import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';

type LearningRole = 'student' | 'parent' | 'teacher';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<LearningRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRoleConfig = () => {
    switch (selectedRole) {
      case 'student':
        return {
          label: 'Student ID',
          placeholder: 'Enter your Student ID / USN',
          example: 'e.g. CMRIT26ECE001',
          description: 'Authenticate with your official institutional Student ID / USN',
        };
      case 'parent':
        return {
          label: 'Parent ID',
          placeholder: 'Enter your Parent ID',
          example: 'e.g. PAR-CMRIT001',
          description: 'Authenticate with your assigned Parent Guardian ID',
        };
      case 'teacher':
        return {
          label: 'Teacher ID or Email',
          placeholder: 'Enter Teacher ID or Email',
          example: 'e.g. TCH001 or teacher@example.com',
          description: 'Authenticate using your Faculty ID or registered institutional email',
        };
    }
  };

  const roleConfig = getRoleConfig();

  const handleRoleChange = (role: LearningRole) => {
    setSelectedRole(role);
    setIdentifier('');
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await login(identifier.trim(), password, selectedRole);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090D16',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
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
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60A5FA',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '14px',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
            learn.veyoralabs.net
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px 0', color: '#FFFFFF' }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
            Learning Platform
          </p>
        </div>

        {/* Auth Card */}
        <div
          style={{
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '1px solid #1F2937',
            padding: '30px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Role Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              backgroundColor: '#0B0F19',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #1F2937',
              marginBottom: '24px',
            }}
          >
            {(['student', 'parent', 'teacher'] as LearningRole[]).map((role) => {
              const active = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleChange(role)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: active ? '#2563EB' : 'transparent',
                    color: active ? '#FFFFFF' : '#94A3B8',
                    boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                    textTransform: 'capitalize',
                  }}
                >
                  {role}
                </button>
              );
            })}
          </div>

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
            {/* Dynamic Role-Specific Identifier Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>
                  {roleConfig.label}
                </label>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  {roleConfig.example}
                </span>
              </div>
              <input
                id="learning-identifier-input"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={roleConfig.placeholder}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#090D16',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748B' }}>
                {roleConfig.description}
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#E2E8F0', marginBottom: '6px' }}>
                Password
              </label>
              <input
                id="learning-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#090D16',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              id="learning-signin-button"
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#2563EB',
                backgroundImage: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

