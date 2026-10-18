import React from 'react';
import { useAuth } from '../lib/authContext';

interface SidebarNavProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ currentRoute, onRouteChange }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  interface NavGroup {
    title?: string;
    items: { id: string; label: string; icon?: string }[];
  }

  const adminNavGroups: NavGroup[] = [
    {
      items: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: '📊' },
      ],
    },
    {
      title: 'Users',
      items: [
        { id: 'admin-students', label: 'Students', icon: '🎓' },
        { id: 'admin-parents', label: 'Parents', icon: '👨‍👩‍👧' },
        { id: 'admin-teachers', label: 'Teachers', icon: '👨‍🏫' },
      ],
    },
    {
      title: 'Academic',
      items: [
        { id: 'admin-subjects', label: 'Subjects', icon: '📚' },
        { id: 'admin-chapters', label: 'Chapters', icon: '📑' },
        { id: 'admin-topics', label: 'Topics', icon: '🏷️' },
        { id: 'admin-subtopics', label: 'Subtopics', icon: '🔹' },
      ],
    },
    {
      title: 'Pipeline & Content',
      items: [
        { id: 'admin-textbooks', label: 'Textbooks & Ingestion', icon: '📖' },
        { id: 'admin-video-plans', label: 'Video Plans', icon: '🎬' },
        { id: 'admin-script-review', label: 'Script Review', icon: '📝' },
        { id: 'admin-video-review', label: 'Video Review', icon: '🎥' },
        { id: 'admin-quizzes', label: 'Quizzes & Review', icon: '🎯' },
        { id: 'admin-pipeline', label: 'Processing Monitor', icon: '⚡' },
        { id: 'admin-hierarchy', label: 'Hierarchy Viewer', icon: '🌲' },
        { id: 'admin-review', label: 'Content Review', icon: '🛡️' },
        { id: 'admin-settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ];

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
          {isAdmin
            ? 'Admin Console'
            : (isParent
              ? 'Parent Portal'
              : (isTeacher ? 'Teacher Portal' : 'Student Learning'))}
        </h2>
        <p style={{ fontSize: '12px', color: isAdmin ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)', marginTop: '4px' }}>
          {isAdmin
            ? 'Governance & Academic Structure'
            : (isParent
              ? "My Child's Learning"
              : (isTeacher ? 'My Students & Class Performance' : 'Modular Concept Videos'))}
        </p>
      </div>

      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
        {isAdmin ? (
          adminNavGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.title && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--admin-text-secondary)',
                    padding: '6px 10px 4px 10px',
                  }}
                >
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onRouteChange(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: isActive ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          (isParent ? parentNavItems : (isTeacher ? teacherNavItems : studentNavItems)).map((item) => {
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
          })
        )}
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
        {isParent && 'Dedicated parent monitoring: strictly linked child progress only.'}
        {isTeacher && 'Class analytics restricted to assigned students.'}
        {!isAdmin && !isParent && !isTeacher && 'Pre-rendered ~5-6 min videos & adaptive quizzes.'}
      </div>
    </aside>
  );
};
