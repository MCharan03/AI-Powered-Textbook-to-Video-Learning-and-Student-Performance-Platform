import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import {
  GraduationCap,
  Users,
  Presentation,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

type LearningRole = 'student' | 'parent' | 'teacher';

/**
 * Learning Portal Login (learn.example.com).
 * Unslop refactored: Clean light aesthetic, segmented role switcher with SVG icons,
 * quick-fill demo chips, password visibility toggle, zero radial gradient glare.
 */
export const Login: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [selectedRole, setSelectedRole] = useState<LearningRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleConfigs = {
    student: {
      label: 'Student ID / USN',
      placeholder: 'e.g. CMRIT26ECE001 or student1',
      description: 'Authenticate with your institutional student identity',
      icon: GraduationCap,
      demoId: 'CMRIT26ECE001',
      demoPass: 'StudentPass123!',
      demoName: 'Alex Student',
    },
    parent: {
      label: 'Parent Guardian ID',
      placeholder: 'e.g. parent1',
      description: 'Authenticate with your assigned parent portal credentials',
      icon: Users,
      demoId: 'parent1',
      demoPass: 'ParentPass123!',
      demoName: 'Parent Jordan',
    },
    teacher: {
      label: 'Teacher ID or Email',
      placeholder: 'e.g. TCH001 or teacher@example.com',
      description: 'Authenticate using your faculty ID or academic email',
      icon: Presentation,
      demoId: 'TCH001',
      demoPass: 'TeacherPass123!',
      demoName: 'Teacher Morgan',
    },
  };

  const currentConfig = roleConfigs[selectedRole];

  const handleRoleChange = (role: LearningRole) => {
    setSelectedRole(role);
    setIdentifier('');
    setPassword('');
    setError(null);
  };

  const applyDemoCredentials = () => {
    setIdentifier(currentConfig.demoId);
    setPassword(currentConfig.demoPass);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please fill in both identifier and password.');
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
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs, 4px)',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              color: '#2563EB',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: '12px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
            learn.veyoralabs.net
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.015em' }}>
            Student & Faculty Sign In
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Modular video learning and concept mastery assessments
          </p>
        </div>

        {/* Auth Card */}
        <div
          className="lrn-card"
          style={{
            padding: '28px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Role Segmented Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px',
              backgroundColor: 'var(--surface-raised)',
              padding: '4px',
              borderRadius: '6px',
              marginBottom: '20px',
            }}
          >
            {(['student', 'parent', 'teacher'] as LearningRole[]).map((role) => {
              const active = selectedRole === role;
              const RoleIcon = roleConfigs[role].icon;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleChange(role)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '5px',
                    fontSize: '12.5px',
                    fontWeight: active ? 600 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                    transition: 'all 120ms ease',
                    textTransform: 'capitalize',
                  }}
                >
                  <RoleIcon size={14} />
                  <span>{role}</span>
                </button>
              );
            })}
          </div>

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
              Demo: <strong style={{ color: 'var(--text)' }}>{currentConfig.demoName}</strong>
            </span>
            <button
              type="button"
              onClick={applyDemoCredentials}
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
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--learn-error, #DC2626)',
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
            {/* Identifier Field */}
            <div>
              <label
                htmlFor="learning-identifier-input"
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                {currentConfig.label}
              </label>
              <input
                id="learning-identifier-input"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={currentConfig.placeholder}
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
                  transition: 'border-color 100ms ease, box-shadow 100ms ease',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {currentConfig.description}
              </p>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  htmlFor="learning-password-input"
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="learning-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
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
                    color: '#64748B',
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
              id="learning-signin-button"
              type="submit"
              disabled={loading}
              className="lrn-btn lrn-btn-primary"
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Authenticating…' : 'Sign In to Portal'}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
          <span>Administrator access? </span>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('active_portal', 'admin');
              } catch {}
              window.location.search = '?portal=admin';
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563EB',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              fontSize: 'inherit',
            }}
          >
            Switch to Admin Console →
          </button>
        </div>
      </div>
    </div>
  );
};
