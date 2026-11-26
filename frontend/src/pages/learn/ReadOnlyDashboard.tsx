import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { useAuth } from '../../lib/authContext';
import { api } from '../../lib/api';
import { ObserverDashboardSummary, ObserverStudentAnalytics } from '../../lib/types';

interface ReadOnlyDashboardProps {
  onNavigate?: (route: string) => void;
}

/**
 * Teacher & Academic Observer Dashboard.
 * Unslop refactored: Theme-adaptive tokens, SVG vector iconography,
 * high-density cohort metrics, and accessible data tables for Light & Dark mode.
 */
export const ReadOnlyDashboard: React.FC<ReadOnlyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ObserverDashboardSummary | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = user?.role === 'teacher'
        ? await api.getTeacherClassPerformance()
        : await api.getObserverDashboard();
      setDashboard(result);
      setSelectedStudentId(current => result.students.some(student => student.student_id === current)
        ? current
        : result.students[0]?.student_id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the academic overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const selectedStudent = useMemo(
    () => dashboard?.students.find(student => student.student_id === selectedStudentId) ?? dashboard?.students[0] ?? null,
    [dashboard, selectedStudentId],
  );
  const isTeacher = user?.role === 'teacher';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {isTeacher ? <GraduationCap size={15} /> : <ShieldCheck size={15} />}
            <span>{isTeacher ? 'Teacher Portal · Class Analytics' : 'Academic Observer Portal'}</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '6px 0 2px', letterSpacing: '-0.015em' }}>
            {isTeacher ? 'My Students & Class Performance' : 'Academic Progress Overview'}
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            {isTeacher
              ? 'Comprehensive cohort metrics, student performance table, topic mastery, and learning analytics for your assigned students.'
              : 'Progress and mastery for students connected to your account.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isTeacher && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('teacher-assignments')}
              className="lrn-btn lrn-btn-primary"
            >
              <ClipboardList size={14} />
              <span>Manage Assignments</span>
              <ArrowRight size={13} />
            </button>
          )}
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--primary-soft)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid var(--border)',
              letterSpacing: '0.04em',
            }}
          >
            {isTeacher ? 'TEACHER ACCESS' : 'OBSERVER ACCESS'}
          </span>
        </div>
      </div>

      {loading && (
        <SurfacePanel>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>Loading your academic overview…</p>
        </SurfacePanel>
      )}

      {!loading && error && (
        <SurfacePanel>
          <div role="alert" style={{ color: 'var(--error)', marginBottom: 12, fontSize: '13px' }}>{error}</div>
          <button type="button" onClick={() => void loadDashboard()} className="lrn-btn lrn-btn-secondary">Try again</button>
        </SurfacePanel>
      )}

      {!loading && !error && dashboard && dashboard.students.length === 0 && (
        <SurfacePanel>
          <h2 style={{ color: 'var(--text)', fontSize: '16px', margin: '0 0 8px' }}>No students linked yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0, fontSize: '13px' }}>
            Your account does not currently have linked students. Contact your school administrator to link student profiles.
          </p>
        </SurfacePanel>
      )}

      {!loading && !error && dashboard && dashboard.students.length > 0 && (
        <>
          {/* Key KPI Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <MetricCard
              label="LINKED STUDENTS"
              value={dashboard.students_count}
              detail={dashboard.role === 'parent' ? 'Children on your account' : 'Assigned learners'}
              color="var(--primary)"
              icon={Users}
            />
            <MetricCard
              label="AVERAGE MASTERY"
              value={`${dashboard.average_mastery_percentage}%`}
              detail="Across linked students"
              color="#6366F1"
              icon={TrendingUp}
            />
            <MetricCard
              label="AVERAGE QUIZ SCORE"
              value={`${dashboard.average_quiz_score}%`}
              detail="Based on submitted quizzes"
              color="#0891B2"
              icon={CheckCircle2}
            />
            <MetricCard
              label="VIDEO COMPLETION"
              value={`${dashboard.video_completion_percentage}%`}
              detail="Published lessons completed"
              color="var(--success)"
              icon={BookOpen}
            />
            <MetricCard
              label="NEEDS ATTENTION"
              value={dashboard.students_needing_attention}
              detail="Below mastery target threshold"
              color={dashboard.students_needing_attention ? 'var(--error)' : 'var(--success)'}
              icon={AlertTriangle}
            />
          </div>

          {/* Assessment Trend Chart */}
          <SurfacePanel title="Assessment Trend" subtitle="Monthly average performance score across all student quiz submissions">
            <ScoreTrend points={dashboard.score_trend} />
          </SurfacePanel>

          {/* Student Overview Table */}
          <SurfacePanel
            title="Student Cohort Overview"
            actions={<span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{dashboard.students_count} active student{dashboard.students_count === 1 ? '' : 's'}</span>}
          >
            <div className="adm-table-wrapper" style={{ border: 'none' }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    {['Student', 'Mastery', 'Topics', 'Quiz Average', 'Focus Areas'].map(label => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.students.map(student => {
                    const isSelected = selectedStudent?.student_id === student.student_id;
                    return (
                      <tr
                        key={student.student_id}
                        style={{
                          backgroundColor: isSelected ? 'var(--surface-raised)' : 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedStudentId(student.student_id)}
                      >
                        <td>
                          <div style={{ display: 'grid', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{student.student_name}</span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              {student.student_code}{student.class_name ? ` · ${student.class_name}${student.section ? `-${student.section}` : ''}` : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: student.mastery_percentage < 80 ? 'var(--warning)' : 'var(--success)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {student.mastery_percentage}%
                          </span>
                        </td>
                        <td>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{student.topics_completed} / {student.total_topics}</span>
                        </td>
                        <td>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{student.average_quiz_score}%</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '4px' }}>({student.quizzes_taken})</span>
                        </td>
                        <td>
                          {student.weak_concepts.length ? (
                            <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '12px' }}>
                              {student.weak_concepts.length} identified
                            </span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 500 }}>None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfacePanel>

          {selectedStudent && <StudentDetail student={selectedStudent} />}
        </>
      )}
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  detail: string;
  color: string;
  icon: React.ComponentType<{ size?: number | string }>;
}> = ({ label, value, detail, color, icon: Icon }) => (
  <div className="lrn-card" style={{ padding: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color, opacity: 0.85 }}>
        <Icon size={16} />
      </div>
    </div>
    <div style={{ color, fontSize: 26, fontWeight: 700, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 4 }}>
      {detail}
    </div>
  </div>
);

const ScoreTrend: React.FC<{ points: ObserverDashboardSummary['score_trend'] }> = ({ points }) => {
  if (!points.length) {
    return <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No quiz assessments recorded for the recent six-month period.</p>;
  }
  const maxScore = Math.max(100, ...points.map(point => point.average_score));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, minmax(46px, 1fr))`, alignItems: 'end', gap: 12, minHeight: 140, paddingTop: 16 }}>
      {points.map(point => {
        const height = Math.max(10, (point.average_score / maxScore) * 100);
        const month = new Date(`${point.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        return (
          <div key={point.month} title={`${month}: ${point.average_score}% across ${point.assessments_count} assessment(s)`} style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {point.average_score}%
            </span>
            <div
              role="img"
              aria-label={`${month} average score ${point.average_score}%`}
              style={{
                width: 'min(100%, 48px)',
                height,
                backgroundColor: 'var(--primary)',
                borderRadius: '4px 4px 1px 1px',
                transition: 'height 250ms ease',
              }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {month}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const StudentDetail: React.FC<{ student: ObserverStudentAnalytics }> = ({ student }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
    <SurfacePanel title={`${student.student_name} · Topic Mastery`}>
      {student.topic_mastery.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {student.topic_mastery.map(topic => (
            <div key={topic.topic}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{topic.topic}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{topic.score}%</span>
              </div>
              <MasteryProgressBar percentage={topic.score} />
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No topic assessments recorded yet.</p>
      )}
    </SurfacePanel>

    <SurfacePanel title="Focus Areas & Remediation">
      {student.weak_concepts.length ? (
        <ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6, color: 'var(--error)', fontSize: '13px' }}>
          {student.weak_concepts.map(concept => <li key={concept}>{concept}</li>)}
        </ul>
      ) : (
        <p style={{ color: 'var(--success)', fontSize: '13px', margin: 0, fontWeight: 500 }}>
          ✓ No focus areas identified — student is meeting mastery thresholds.
        </p>
      )}
      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 16 }}>
        Completed {student.videos_completed} of {student.total_videos} published video lessons.
      </div>
    </SurfacePanel>
  </div>
);
