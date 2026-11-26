import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Film,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  Users,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface SidebarNavProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}

/**
 * Learning-portal navigation (Student / Parent / Teacher).
 * Unslop refactored: Crisp SVG icons, tactile interactive states, restrained typography.
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({ currentRoute, onRouteChange }) => {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  const studentNavItems: NavItemDef[] = [
    { id: 'student-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'student-assignments', label: 'Assignments', icon: ClipboardList },
    { id: 'student-video', label: 'Video Lessons', icon: Film },
    { id: 'student-quiz', label: 'Topic Quizzes', icon: CheckCircle2 },
    { id: 'student-adaptive', label: 'Remediation', icon: RotateCcw },
    { id: 'student-mastery', label: 'Mastery & Progress', icon: TrendingUp },
  ];

  const parentNavItems: NavItemDef[] = [
    { id: 'parent-dashboard', label: "Student Progress", icon: Users },
  ];

  const teacherNavItems: NavItemDef[] = [
    { id: 'readonly-dashboard', label: 'Class Overview', icon: GraduationCap },
    { id: 'teacher-assignments', label: 'Assignments', icon: ClipboardList },
  ];

  const items = isParent ? parentNavItems : isTeacher ? teacherNavItems : studentNavItems;

  return (
    <aside
      style={{
        width: 'var(--learn-sidebar-width)',
        minWidth: 'var(--learn-sidebar-width)',
        backgroundColor: 'var(--learn-surface)',
        borderRight: '1px solid var(--learn-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--learn-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minHeight: 'var(--learn-header-height)',
        }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--learn-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={18} strokeWidth={2.2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--learn-text)', lineHeight: 1.2 }}>
            {isParent ? 'Parent Portal' : isTeacher ? 'Teacher Portal' : 'Veyora Learn'}
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', marginTop: '2px' }}>
            {isParent
              ? 'Academic Guardian View'
              : isTeacher
                ? 'Class Analytics'
                : 'Modular Learning Studio'}
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav
        style={{
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--learn-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '8px 10px 4px 10px',
          }}
        >
          Curriculum
        </div>

        {items.map((item) => {
          const isActive = currentRoute === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onRouteChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                backgroundColor: isActive ? 'var(--learn-primary-soft)' : 'transparent',
                color: isActive ? 'var(--learn-primary)' : 'var(--learn-text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease)',
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--learn-primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Context Pill */}
      <div
        style={{
          margin: '12px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--learn-surface-raised)',
          border: '1px solid var(--learn-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--learn-success)',
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', lineHeight: 1.4 }}>
          {user?.name || 'Active Session'}
        </div>
      </div>
    </aside>
  );
};
