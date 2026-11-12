import React from 'react';
import { useAuth } from '../lib/authContext';

interface SidebarNavProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
}

/**
 * Learning-portal navigation (Student / Parent / Teacher).
 * The admin portal renders its own dedicated AdminSidebar component.
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({ currentRoute, onRouteChange }) => {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  const studentNavItems = [
    { id: 'student-dashboard', label: 'Learning Dashboard', icon: '🏠' },
    { id: 'student-assignments', label: 'Assignments', icon: '📝' },
    { id: 'student-video', label: 'Pre-Rendered Lessons', icon: '🎬' },
    { id: 'student-quiz', label: 'Topic Quizzes', icon: '🎯' },
    { id: 'student-adaptive', label: 'Adaptive Remediation', icon: '🔄' },
    { id: 'student-mastery', label: 'Progress & Mastery', icon: '📈' },
  ];

  const parentNavItems = [
    { id: 'parent-dashboard', label: "My Child's Learning", icon: '👨‍👩‍👧' },
  ];

  const teacherNavItems = [
    { id: 'readonly-dashboard', label: 'My Students & Class', icon: '👨‍🏫' },
    { id: 'teacher-assignments', label: 'Assignments', icon: '📝' },
  ];

  const items = isParent ? parentNavItems : isTeacher ? teacherNavItems : studentNavItems;

  return (
    <aside
      style={{
        width: '256px',
        minWidth: '256px',
        backgroundColor: 'var(--learn-surface)',
        borderRight: '1px solid var(--learn-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--learn-border)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--learn-text)' }}>
          {isParent ? 'Parent Portal' : isTeacher ? 'Teacher Portal' : 'Student Learning'}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--learn-text-secondary)', marginTop: '4px' }}>
          {isParent
            ? "My Child's Learning"
            : isTeacher
              ? 'My Students & Class Performance'
              : 'Modular Concept Videos'}
        </p>
      </div>

      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
        {items.map((item) => {
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onRouteChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                color: isActive ? 'var(--learn-primary)' : 'var(--learn-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
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
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          border: '1px solid var(--learn-border)',
          fontSize: '11px',
          color: 'var(--learn-text-secondary)',
        }}
      >
        {isParent && 'Dedicated parent monitoring: strictly linked child progress only.'}
        {isTeacher && 'Class analytics restricted to assigned students.'}
        {!isParent && !isTeacher && 'Pre-rendered ~5-6 min videos & adaptive quizzes.'}
      </div>
    </aside>
  );
};
