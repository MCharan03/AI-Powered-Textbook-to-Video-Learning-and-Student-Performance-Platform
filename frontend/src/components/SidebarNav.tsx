import React from 'react';
import { useAuth } from '../lib/authContext';

interface SidebarNavProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ currentRoute, onRouteChange }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isReadOnly = user?.role === 'parent' || user?.role === 'teacher';

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Dashboard & Upload', path: '/admin' },
    { id: 'admin-pipeline', label: 'AI Pipeline Monitor', path: '/admin/pipeline' },
    { id: 'admin-hierarchy', label: 'Extracted Hierarchy', path: '/admin/hierarchy' },
    { id: 'admin-review', label: 'Review & Approval Gate', path: '/admin/review' },
    { id: 'admin-users', label: 'User Governance', path: '/admin/users' },
    { id: 'admin-settings', label: 'Mastery Settings', path: '/admin/settings' },
  ];

  const studentNavItems = [
    { id: 'student-dashboard', label: 'Learning Dashboard', path: '/learn' },
    { id: 'student-video', label: 'Pre-Rendered Lessons', path: '/learn/video' },
    { id: 'student-quiz', label: 'Topic Quizzes', path: '/learn/quiz' },
    { id: 'student-adaptive', label: 'Adaptive Remediation', path: '/learn/adaptive' },
    { id: 'student-mastery', label: 'Progress & Mastery', path: '/learn/mastery' },
  ];

  const readOnlyNavItems = [
    { id: 'readonly-dashboard', label: 'Student Progress Summary', path: '/learn/summary' },
  ];

  let items = studentNavItems;
  if (isAdmin) {
    items = adminNavItems;
  } else if (isReadOnly) {
    items = readOnlyNavItems;
  }

  return (
    <aside
      style={{
        width: '256px',
        minWidth: '256px',
        backgroundColor: isAdmin ? 'var(--admin-surface)' : 'var(--learn-surface)',
        borderRight: `1px solid ${isAdmin ? 'var(--admin-border)' : 'var(--learn-border)'}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '24px 20px', borderBottom: `1px solid ${isAdmin ? 'var(--admin-border)' : 'var(--learn-border)'}` }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: isAdmin ? 'var(--admin-text)' : 'var(--learn-text)' }}>
          {isAdmin ? 'Admin Console' : (isReadOnly ? 'Observer Portal' : 'Student Learning')}
        </h2>
        <p style={{ fontSize: '12px', color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)', marginTop: '4px' }}>
          {isAdmin ? 'Governance & Review' : (isReadOnly ? 'Read-Only Dashboard' : 'Modular Concept Videos')}
        </p>
      </div>

      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {items.map((item) => {
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onRouteChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive
                  ? (isAdmin ? 'rgba(99, 102, 241, 0.15)' : 'rgba(37, 99, 235, 0.1)')
                  : 'transparent',
                color: isActive
                  ? (isAdmin ? 'var(--admin-primary)' : 'var(--learn-primary)')
                  : (isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)'),
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Role Notice at Bottom */}
      <div
        style={{
          margin: '16px 12px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: isAdmin ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          border: `1px solid ${isAdmin ? 'var(--admin-border)' : 'var(--learn-border)'}`,
          fontSize: '11px',
          color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)',
        }}
      >
        {isAdmin && 'Enforcing Stage 1-5 Approval Gate before student publication.'}
        {!isAdmin && !isReadOnly && 'Pre-rendered ~5-6 min videos & adaptive quizzes.'}
        {isReadOnly && 'Read-only access strictly restricted to summary metrics.'}
      </div>
    </aside>
  );
};
