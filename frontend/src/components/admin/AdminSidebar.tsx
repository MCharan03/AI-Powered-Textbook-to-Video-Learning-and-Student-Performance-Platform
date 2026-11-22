import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Presentation,
  UserCog,
  LibraryBig,
  BookOpen,
  ListTree,
  List,
  BookText,
  Clapperboard,
  Globe2,
  FileQuestion,
  Activity,
  Network,
  ShieldCheck,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  School,
} from 'lucide-react';

interface NavEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}

interface NavGroup {
  label: string;
  items: NavEntry[];
}

/**
 * Grouped admin navigation. Route IDs match the existing App router —
 * do not rename or duplicate.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'User Management',
    items: [
      { id: 'admin-students', label: 'Students', icon: GraduationCap },
      { id: 'admin-parents', label: 'Parents', icon: Users },
      { id: 'admin-teachers', label: 'Teachers', icon: Presentation },
      { id: 'admin-users', label: 'Users', icon: UserCog },
    ],
  },
  {
    label: 'Academic Management',
    items: [
      { id: 'admin-subjects', label: 'Subjects', icon: LibraryBig },
      { id: 'admin-chapters', label: 'Chapters', icon: BookOpen },
      { id: 'admin-topics', label: 'Topics', icon: ListTree },
      { id: 'admin-subtopics', label: 'Subtopics', icon: List },
    ],
  },
  {
    label: 'Content Management',
    items: [
      { id: 'admin-textbooks', label: 'Textbook Library', icon: BookText },
      { id: 'admin-video-studio', label: 'Video Studio', icon: Clapperboard },
      { id: 'admin-published-content', label: 'Published Content', icon: Globe2 },
      { id: 'admin-quizzes', label: 'Quiz Management', icon: FileQuestion },
    ],
  },
  {
    label: 'AI Processing',
    items: [
      { id: 'admin-pipeline', label: 'Processing Monitor', icon: Activity },
      { id: 'admin-hierarchy', label: 'Content Hierarchy', icon: Network },
      { id: 'admin-review', label: 'Content Review', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'admin-settings', label: 'Settings', icon: Settings }],
  },
];

interface AdminSidebarProps {
  currentRoute: string;
  onRouteChange: (route: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentRoute,
  onRouteChange,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleClick = (id: string) => {
    onRouteChange(id);
    onCloseMobile();
  };

  const renderItem = (item: NavEntry) => {
    const isActive = currentRoute === item.id;
    const Icon = item.icon;
    const button = (
      <button
        type="button"
        key={item.id}
        onClick={() => handleClick(item.id)}
        className={`adm-nav-item${isActive ? ' active' : ''}`}
        style={collapsed ? { justifyContent: 'center', padding: '7px 0' } : undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={16} strokeWidth={2} />
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      </button>
    );
    if (!collapsed) return button;
    return (
      <div className="adm-tooltip-host" key={item.id}>
        {button}
        <span className="adm-tooltip" role="tooltip">
          {item.label}
        </span>
      </div>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div className="adm-mobile-overlay" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside className={`adm-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--admin-border)',
            minHeight: '60px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--admin-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <School size={17} />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)', lineHeight: '18px' }}>
                Veyora Admin
              </div>
              <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>Education Console</div>
            </div>
          )}
        </div>

        {/* Scrollable nav */}
        <nav className="adm-sidebar-nav" aria-label="Admin navigation">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {collapsed ? (
                <div style={{ height: '12px' }} />
              ) : (
                <div className="adm-nav-section-label">{group.label}</div>
              )}
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        {/* Footer: approval gate note + collapse toggle */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--admin-border)' }}>
          {!collapsed && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--admin-text-secondary)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--admin-surface-raised)',
                marginBottom: '8px',
                lineHeight: '16px',
              }}
            >
              Stage 1–5 approval gate is enforced before content reaches students.
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="adm-nav-item"
            style={{ justifyContent: 'center', padding: '7px 0' }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
