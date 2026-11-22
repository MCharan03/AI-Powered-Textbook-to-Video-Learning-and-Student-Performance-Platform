import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Presentation,
  Users,
  BookText,
  ClipboardCheck,
  Clapperboard,
  UserPlus,
  Presentation as TeacherIcon,
  Upload,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { PageHeader } from '../../components/admin/PageHeader';
import { StatCard } from '../../components/admin/StatCard';
import { WorkflowStepper } from '../../components/admin/WorkflowStepper';
import { LoadingState } from '../../components/admin/LoadingState';
import { ErrorState } from '../../components/admin/ErrorState';
import { EmptyState } from '../../components/admin/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { Textbook, ReviewItem } from '../../lib/types';

interface AdminDashboardProps {
  onNavigate: (route: string) => void;
}

interface Counts {
  students: number | null;
  teachers: number | null;
  parents: number | null;
}

const VIDEO_STUDIO_STAGES = [
  'Upload',
  'Curriculum',
  'Plans',
  'Scripts',
  'Rendering',
  'Review & Publish',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [counts, setCounts] = useState<Counts>({ students: null, teachers: null, parents: null });
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksError, setTextbooksError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<ReviewItem[]>([]);
  const [videosGenerated, setVideosGenerated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setTextbooksError(null);

    // Each metric is fetched independently so one failing endpoint
    // never blanks the whole dashboard or fabricates a value.
    const safe = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    const [studentsRes, teachersRes, parentsRes, textbookList, reviewItems, videosList] = await Promise.all([
      safe(() => api.listStudents({ page: 1, page_size: 1 })),
      safe(() => api.listTeachers({ page: 1, page_size: 1 })),
      safe(() => api.listParents({ page: 1, page_size: 1 })),
      safe(() => api.listTextbooks()),
      safe(() => api.listReviewItems('pending_review')),
      safe(() => api.listVideos()),
    ]);

    setCounts({
      students: studentsRes ? studentsRes.total : null,
      teachers: teachersRes ? teachersRes.total : null,
      parents: parentsRes ? parentsRes.total : null,
    });
    setTextbooks(textbookList || []);
    if (!textbookList) setTextbooksError('Textbook data could not be loaded.');
    setPendingItems((reviewItems || []).slice(0, 5));
    setPendingApprovals(reviewItems ? reviewItems.length : null);
    setVideosGenerated(videosList ? videosList.length : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const recentTextbooks = [...textbooks]
    .sort((a, b) => {
      const aTime = a.uploaded_at || a.created_at || '';
      const bTime = b.uploaded_at || b.created_at || '';
      return bTime.localeCompare(aTime);
    })
    .slice(0, 5);

  const processingCount = textbooks.filter((t) => t.status === 'processing').length;
  const completedCount = textbooks.filter((t) => t.status === 'completed' || t.status === 'approved').length;
  const failedCount = textbooks.filter((t) => t.status === 'failed' || t.status === 'error').length;
  const awaitingApprovalCount = textbooks.filter((t) => t.status === 'pending_review' || t.status === 'pending_approval' || t.status === 'pending').length;

  const quickActions = [
    { label: 'Add Student', icon: UserPlus, route: 'admin-students' },
    { label: 'Add Teacher', icon: TeacherIcon, route: 'admin-teachers' },
    { label: 'Upload Textbook', icon: Upload, route: 'admin-textbooks' },
    { label: 'Review Curriculum', icon: ShieldCheck, route: 'admin-review' },
    { label: 'Open Video Studio', icon: Clapperboard, route: 'admin-video-studio' },
  ];

  const renderMetric = (value: number | null) => (value === null ? '—' : value.toLocaleString());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)', letterSpacing: '-0.01em' }}>
          Welcome back, Admin
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', marginTop: '4px', maxWidth: '640px' }}>
          Here is the current status of your platform — registered users, uploaded textbooks, and content
          moving through the AI generation pipeline.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        <StatCard
          label="Total Students"
          value={renderMetric(counts.students)}
          hint={counts.students === null ? 'Data unavailable' : 'Registered learners'}
          icon={GraduationCap}
          tone="primary"
          loading={loading}
          onClick={() => onNavigate('admin-students')}
        />
        <StatCard
          label="Total Teachers"
          value={renderMetric(counts.teachers)}
          hint={counts.teachers === null ? 'Data unavailable' : 'Active teaching staff'}
          icon={Presentation}
          tone="default"
          loading={loading}
          onClick={() => onNavigate('admin-teachers')}
        />
        <StatCard
          label="Total Parents"
          value={renderMetric(counts.parents)}
          hint={counts.parents === null ? 'Data unavailable' : 'Linked guardians'}
          icon={Users}
          tone="default"
          loading={loading}
          onClick={() => onNavigate('admin-parents')}
        />
        <StatCard
          label="Total Textbooks"
          value={textbooksError ? '—' : renderMetric(textbooks.length)}
          hint={textbooksError ? 'Data unavailable' : 'Uploaded source PDFs'}
          icon={BookText}
          tone="default"
          loading={loading}
          onClick={() => onNavigate('admin-textbooks')}
        />
        <StatCard
          label="Pending Approvals"
          value={renderMetric(pendingApprovals)}
          hint={pendingApprovals === null ? 'Data unavailable' : 'Videos & quizzes awaiting review'}
          icon={ClipboardCheck}
          tone={pendingApprovals && pendingApprovals > 0 ? 'warning' : 'success'}
          loading={loading}
          onClick={() => onNavigate('admin-review')}
        />
        <StatCard
          label="Videos Generated"
          value={renderMetric(videosGenerated)}
          hint={videosGenerated === null ? 'Data unavailable' : 'Renders across all topics'}
          icon={Clapperboard}
          tone="primary"
          loading={loading}
          onClick={() => onNavigate('admin-published-content')}
        />
      </div>

      {/* Quick actions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>Quick actions</h2>
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={13} />
            Refresh data
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigate(action.route)}
                className="adm-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 16px',
                  border: '1px solid var(--admin-border)',
                  background: 'var(--admin-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--admin-text)',
                }}
              >
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--admin-primary-soft)',
                    color: 'var(--admin-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </span>
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent textbooks + pending approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* Recently uploaded textbooks */}
        <div className="adm-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>Recently uploaded textbooks</h2>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={() => onNavigate('admin-textbooks')}
            >
              View all
              <ArrowRight size={13} />
            </button>
          </div>
          {textbooksError ? (
            <ErrorState message={textbooksError} onRetry={fetchDashboardData} />
          ) : loading ? (
            <LoadingState rows={3} />
          ) : recentTextbooks.length === 0 ? (
            <EmptyState
              title="No textbooks uploaded yet"
              description="Upload a PDF textbook to start the extraction and video generation pipeline."
              action={
                <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => onNavigate('admin-textbooks')}>
                  <Upload size={13} />
                  Upload Textbook
                </button>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentTextbooks.map((tb) => (
                <div
                  key={tb.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--admin-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface-raised)',
                        color: 'var(--admin-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BookOpen size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--admin-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tb.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                        {(tb.uploaded_at || tb.created_at || '').slice(0, 10) || 'Date unavailable'}
                        {tb.subject_name ? ` · ${tb.subject_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={tb.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending curriculum approvals */}
        <div className="adm-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>Pending approvals</h2>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={() => onNavigate('admin-review')}
            >
              Review queue
              <ArrowRight size={13} />
            </button>
          </div>
          {pendingApprovals === null ? (
            <ErrorState message="Approval queue could not be loaded." onRetry={fetchDashboardData} />
          ) : pendingItems.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="Generated videos and quizzes will appear here when they need your review."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--admin-border)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--admin-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      {item.type === 'video' ? 'Video' : 'Quiz'} · {item.topic_title || 'Topic unavailable'}
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Processing overview */}
      <div className="adm-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--admin-primary)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>Processing overview</h2>
          </div>
          <button
            type="button"
            className="adm-btn adm-btn-secondary adm-btn-sm"
            onClick={() => onNavigate('admin-pipeline')}
          >
            Open Processing Monitor
            <ArrowRight size={13} />
          </button>
        </div>

        <WorkflowStepper steps={VIDEO_STUDIO_STAGES} currentStep={0} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {[
            { label: 'Awaiting approval', count: awaitingApprovalCount, tone: 'var(--admin-warning)' },
            { label: 'Processing', count: processingCount, tone: 'var(--admin-primary)' },
            { label: 'Completed', count: completedCount, tone: 'var(--admin-success)' },
            { label: 'Failed', count: failedCount, tone: 'var(--admin-error)' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>{stat.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stat.tone, marginTop: '2px' }}>
                {textbooksError ? '—' : stat.count}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '12px' }}>
          Counts reflect the current status of uploaded textbooks across the pipeline. Detailed stage-by-stage
          logs live in the Processing Monitor.
        </p>
      </div>
    </div>
  );
};
