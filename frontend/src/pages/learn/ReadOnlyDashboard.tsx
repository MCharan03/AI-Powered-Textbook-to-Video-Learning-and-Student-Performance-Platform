import React, { useEffect, useMemo, useState } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { useAuth } from '../../lib/authContext';
import { api } from '../../lib/api';
import { ObserverDashboardSummary, ObserverStudentAnalytics } from '../../lib/types';

const mutedText: React.CSSProperties = { color: '#64748B', fontSize: 13 };

interface ReadOnlyDashboardProps {
  onNavigate?: (route: string) => void;
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#1D4ED8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <span aria-hidden="true">{isTeacher ? '👨‍🏫' : '🛡️'}</span> {isTeacher ? 'Teacher Portal · Class Analytics' : 'Academic Observer Portal'}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 750, color: '#0F172A', margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
            {isTeacher ? 'My Students & Class Performance' : 'Academic Progress Overview'}
          </h1>
          <p style={{ ...mutedText, margin: 0, fontSize: 14 }}>
            {isTeacher
              ? 'Comprehensive cohort metrics, student performance table, topic mastery, and learning analytics for your assigned students.'
              : 'Progress and mastery for students connected to your account.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isTeacher && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('teacher-assignments')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#2563EB',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📝 Manage Assignments →
            </button>
          )}
          <span style={{ padding: '6px 12px', borderRadius: 999, background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 700 }}>
            {isTeacher ? 'TEACHER ACCESS' : 'READ ONLY'}
          </span>
        </div>
      </div>

      {loading && <SurfacePanel><p style={{ ...mutedText, margin: 0 }}>Loading your academic overview…</p></SurfacePanel>}
      {!loading && error && (
        <SurfacePanel>
          <div role="alert" style={{ color: '#B91C1C', marginBottom: 12 }}>{error}</div>
          <button type="button" onClick={() => void loadDashboard()} style={secondaryButton}>Try again</button>
        </SurfacePanel>
      )}
      {!loading && !error && dashboard && dashboard.students.length === 0 && (
        <SurfacePanel>
          <h2 style={sectionTitle}>No students linked yet</h2>
          <p style={{ ...mutedText, marginBottom: 0 }}>Your account does not currently have linked students. Ask your school administrator to connect the student profile.</p>
        </SurfacePanel>
      )}

      {!loading && !error && dashboard && dashboard.students.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <MetricCard label="LINKED STUDENTS" value={dashboard.students_count} detail={dashboard.role === 'parent' ? 'Children on your account' : 'Assigned to your account'} color="#2563EB" />
            <MetricCard label="AVERAGE MASTERY" value={`${dashboard.average_mastery_percentage}%`} detail="Across linked students" color="#4F46E5" />
            <MetricCard label="AVERAGE QUIZ SCORE" value={`${dashboard.average_quiz_score}%`} detail="Based on submitted quizzes" color="#0891B2" />
            <MetricCard label="VIDEO COMPLETION" value={`${dashboard.video_completion_percentage}%`} detail="Published lessons completed" color="#059669" />
            <MetricCard label="NEEDS ATTENTION" value={dashboard.students_needing_attention} detail="Below mastery target or has focus areas" color={dashboard.students_needing_attention ? '#DC2626' : '#059669'} />
          </div>

          <SurfacePanel title="Assessment trend" actions={<span style={mutedText}>Monthly average score</span>}>
            <ScoreTrend points={dashboard.score_trend} />
          </SurfacePanel>

          <SurfacePanel title="Student overview" actions={<span style={mutedText}>{dashboard.students_count} student{dashboard.students_count === 1 ? '' : 's'}</span>}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 670, textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase' }}>
                    {['Student', 'Mastery', 'Topics', 'Quiz average', 'Focus areas'].map(label => <th key={label} style={tableHead}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.students.map(student => (
                    <tr key={student.student_id} style={{ borderTop: '1px solid #E2E8F0', background: selectedStudent?.student_id === student.student_id ? '#F8FAFC' : 'white' }}>
                      <td style={tableCell}>
                        <button type="button" onClick={() => setSelectedStudentId(student.student_id)} style={studentButton}>
                          <span style={{ fontWeight: 650, color: '#0F172A' }}>{student.student_name}</span>
                          <span style={mutedText}>{student.student_code}{student.class_name ? ` · ${student.class_name}${student.section ? `-${student.section}` : ''}` : ''}</span>
                        </button>
                      </td>
                      <td style={tableCell}><span style={{ color: student.mastery_percentage < 80 ? '#B45309' : '#047857', fontWeight: 700 }}>{student.mastery_percentage}%</span></td>
                      <td style={tableCell}>{student.topics_completed} / {student.total_topics}</td>
                      <td style={tableCell}>{student.average_quiz_score}% <span style={mutedText}>({student.quizzes_taken})</span></td>
                      <td style={tableCell}>{student.weak_concepts.length ? <span style={{ color: '#B91C1C' }}>{student.weak_concepts.length} identified</span> : <span style={{ color: '#047857' }}>None</span>}</td>
                    </tr>
                  ))}
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

const MetricCard: React.FC<{ label: string; value: string | number; detail: string; color: string }> = ({ label, value, detail, color }) => (
  <SurfacePanel style={{ padding: 18 }}>
    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '.03em' }}>{label}</div>
    <div style={{ color, fontSize: 27, fontWeight: 750, marginTop: 7 }}>{value}</div>
    <div style={{ ...mutedText, fontSize: 11, marginTop: 5 }}>{detail}</div>
  </SurfacePanel>
);

const ScoreTrend: React.FC<{ points: ObserverDashboardSummary['score_trend'] }> = ({ points }) => {
  if (!points.length) return <p style={{ ...mutedText, margin: 0 }}>No quiz assessments are available for the recent six-month period.</p>;
  const maxScore = Math.max(100, ...points.map(point => point.average_score));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, minmax(46px, 1fr))`, alignItems: 'end', gap: 12, minHeight: 150 }}>
      {points.map(point => {
        const height = Math.max(8, (point.average_score / maxScore) * 112);
        const month = new Date(`${point.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        return (
          <div key={point.month} title={`${month}: ${point.average_score}% across ${point.assessments_count} assessment${point.assessments_count === 1 ? '' : 's'}`} style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 650 }}>{point.average_score}%</span>
            <div role="img" aria-label={`${month} average quiz score ${point.average_score}%`} style={{ width: 'min(100%, 64px)', height, background: 'linear-gradient(180deg, #60A5FA, #2563EB)', borderRadius: '7px 7px 2px 2px' }} />
            <span style={{ fontSize: 10, color: '#64748B', whiteSpace: 'nowrap' }}>{month}</span>
          </div>
        );
      })}
    </div>
  );
};

const StudentDetail: React.FC<{ student: ObserverStudentAnalytics }> = ({ student }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
    <SurfacePanel title={`${student.student_name} · topic mastery`}>
      {student.topic_mastery.length ? (
        <div style={{ display: 'grid', gap: 13 }}>
          {student.topic_mastery.map(topic => (
            <div key={topic.topic}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: '#334155' }}>{topic.topic}</span>
                <span style={{ fontSize: 12, color: '#64748B' }}>{topic.score}%</span>
              </div>
              <MasteryProgressBar percentage={topic.score} />
            </div>
          ))}
        </div>
      ) : <p style={{ ...mutedText, margin: 0 }}>No topic assessments recorded yet.</p>}
    </SurfacePanel>
    <SurfacePanel title="Focus areas">
      {student.weak_concepts.length ? (
        <ul style={{ paddingLeft: 20, margin: 0, display: 'grid', gap: 8, color: '#991B1B', fontSize: 13 }}>
          {student.weak_concepts.map(concept => <li key={concept}>{concept}</li>)}
        </ul>
      ) : <p style={{ color: '#047857', fontSize: 13, margin: 0 }}>No focus areas have been identified from quiz attempts.</p>}
      <div style={{ ...mutedText, marginTop: 16 }}>Completed {student.videos_completed} of {student.total_videos} published video lessons.</div>
    </SurfacePanel>
  </div>
);

const sectionTitle: React.CSSProperties = { color: '#0F172A', fontSize: 16, margin: '0 0 8px' };
const tableHead: React.CSSProperties = { padding: '0 12px 12px', fontWeight: 700 };
const tableCell: React.CSSProperties = { padding: '13px 12px', fontSize: 13, color: '#334155', verticalAlign: 'middle' };
const studentButton: React.CSSProperties = { display: 'grid', gap: 4, textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { border: '1px solid #CBD5E1', borderRadius: 7, padding: '8px 12px', color: '#334155', background: '#F8FAFC', cursor: 'pointer' };
