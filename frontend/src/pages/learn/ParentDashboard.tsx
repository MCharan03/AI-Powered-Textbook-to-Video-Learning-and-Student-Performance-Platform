import React, { useEffect, useState } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { api } from '../../lib/api';
import { ParentChildInfo, ParentChildProgressResponse } from '../../lib/types';

const mutedText: React.CSSProperties = { color: '#64748B', fontSize: 13 };

export const ParentDashboard: React.FC = () => {
  const [children, setChildren] = useState<ParentChildInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [progress, setProgress] = useState<ParentChildProgressResponse | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch linked children for authenticated parent
  const fetchChildren = async () => {
    setLoadingChildren(true);
    setError(null);
    try {
      const data = await api.getParentChildren();
      setChildren(data);
      if (data.length > 0) {
        setSelectedChildId(data[0].id);
      } else {
        setSelectedChildId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve linked children.');
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    void fetchChildren();
  }, []);

  // 2. Fetch progress when selectedChildId changes
  useEffect(() => {
    if (!selectedChildId) {
      setProgress(null);
      return;
    }

    const fetchProgress = async () => {
      setLoadingProgress(true);
      setError(null);
      try {
        const data = await api.getParentChildProgress(selectedChildId);
        setProgress(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve student progress.');
      } finally {
        setLoadingProgress(false);
      }
    };

    void fetchProgress();
  }, [selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563EB', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <span>👨‍👩‍👧</span> Parent Portal · Student Monitoring
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 750, color: '#0F172A', margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
            My Child's Learning
          </h1>
          <p style={{ ...mutedText, margin: 0, fontSize: 14 }}>
            Real-time curriculum progress, video engagement, quiz results, and topic mastery for your child.
          </p>
        </div>

        {/* Child Selector Dropdown (if multiple children) */}
        {children.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', padding: '6px 14px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <label htmlFor="child-select" style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Select Child:</label>
            <select
              id="child-select"
              aria-label="Select Child"
              value={selectedChildId ?? ''}
              onChange={(e) => setSelectedChildId(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {children.map(child => (
                <option key={child.id} value={child.id}>
                  {child.name} ({child.student_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loadingChildren && (
        <SurfacePanel>
          <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
            Loading your linked children...
          </div>
        </SurfacePanel>
      )}

      {!loadingChildren && error && (
        <SurfacePanel>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div role="alert" style={{ color: '#DC2626', fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
            <button
              type="button"
              onClick={() => void fetchChildren()}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                backgroundColor: '#2563EB',
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </SurfacePanel>
      )}

      {/* Empty State: No Children Linked */}
      {!loadingChildren && !error && children.length === 0 && (
        <SurfacePanel>
          <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
            <h2 data-testid="no-children-linked" style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              No children linked
            </h2>
            <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              There are currently no student accounts linked to this parent profile.
              Please reach out to your school administrator to register and link your child's student record.
            </p>
          </div>
        </SurfacePanel>
      )}

      {/* Active Child View */}
      {!loadingChildren && !error && selectedChild && (
        <>
          {/* Child Metadata Profile Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              borderRadius: 14,
              padding: '20px 24px',
              color: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: '#3B82F6',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {selectedChild.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>
                  {selectedChild.name}
                </h2>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 13, color: '#94A3B8' }}>
                  <span>Student ID: <strong style={{ color: '#E2E8F0' }}>{selectedChild.student_id}</strong></span>
                  <span>•</span>
                  <span>Class: <strong style={{ color: '#E2E8F0' }}>{selectedChild.class_name || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Section: <strong style={{ color: '#E2E8F0' }}>{selectedChild.section || 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255, 255, 255, 0.08)', padding: '6px 14px', borderRadius: 999 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>Active Enrollment</span>
            </div>
          </div>

          {loadingProgress && (
            <SurfacePanel>
              <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                Loading {selectedChild.name}'s progress...
              </div>
            </SurfacePanel>
          )}

          {!loadingProgress && progress && (
            <>
              {/* 5 KPI Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <KpiCard
                  label="OVERALL PROGRESS"
                  value={`${progress.overall_progress}%`}
                  detail="Curriculum completion"
                  color="#2563EB"
                  icon="📈"
                />
                <KpiCard
                  label="VIDEOS COMPLETED"
                  value={`${progress.videos_completed} / ${progress.total_videos}`}
                  detail={`${progress.total_videos > 0 ? Math.round((progress.videos_completed / progress.total_videos) * 100) : 0}% watched`}
                  color="#059669"
                  icon="🎬"
                />
                <KpiCard
                  label="AVERAGE QUIZ SCORE"
                  value={`${progress.average_quiz_score}%`}
                  detail="Across all assessments"
                  color="#7C3AED"
                  icon="🎯"
                />
                <KpiCard
                  label="TOPIC MASTERY"
                  value={`${progress.topic_mastery_percentage}%`}
                  detail="Average concept proficiency"
                  color="#D97706"
                  icon="🧠"
                />
                <KpiCard
                  label="ASSIGNMENTS COMPLETED"
                  value={`${progress.assignments_completed} / ${progress.total_assignments}`}
                  detail={`${progress.total_assignments > 0 ? Math.round((progress.assignments_completed / progress.total_assignments) * 100) : 0}% submitted`}
                  color="#0891B2"
                  icon="📑"
                />
              </div>

              {/* Needs More Practice / Weak Topics Alert Banner */}
              {progress.weak_topics.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#991B1B' }}>
                      Needs More Practice
                    </h3>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#B91C1C' }}>
                      Based on recent quiz attempts and performance, your child should review these focus topics:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {progress.weak_topics.map((topic, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #FCA5A5',
                            color: '#991B1B',
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 6,
                          }}
                        >
                          • {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Two Column Layout: Subject Progress + Topic Mastery */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
                {/* Subject Progress */}
                <SurfacePanel title="Subject Progress">
                  {progress.subjects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {progress.subjects.map((subj) => (
                        <div key={subj.subject_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{subj.subject_name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{subj.progress_percentage}%</span>
                          </div>
                          <MasteryProgressBar percentage={subj.progress_percentage} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...mutedText, margin: 0 }}>No subjects assigned to student.</p>
                  )}
                </SurfacePanel>

                {/* Topic Mastery */}
                <SurfacePanel title="Topic Mastery">
                  {progress.topic_mastery.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {progress.topic_mastery.map((tm) => (
                        <div
                          key={tm.topic_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            backgroundColor: '#F8FAFC',
                            borderRadius: 8,
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 650, color: '#0F172A' }}>{tm.topic_title}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{tm.subject_name} · Score: {tm.score}%</div>
                          </div>
                          <MasteryBadge level={tm.mastery_level} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...mutedText, margin: 0 }}>No topic mastery assessments recorded yet.</p>
                  )}
                </SurfacePanel>
              </div>

              {/* Video Lessons Activity */}
              <SurfacePanel
                title="Video Lessons Progress"
                actions={<span style={mutedText}>{progress.videos_completed} of {progress.total_videos} completed</span>}
              >
                {progress.videos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {progress.videos.map((vid) => {
                      const isCompleted = vid.status === 'COMPLETED';
                      const isInProgress = vid.status === 'IN_PROGRESS';
                      return (
                        <div
                          key={vid.video_id}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            border: `1px solid ${isCompleted ? '#A7F3D0' : (isInProgress ? '#BAE6FD' : '#E2E8F0')}`,
                            backgroundColor: isCompleted ? '#F0FDF4' : (isInProgress ? '#F0F9FF' : '#FFFFFF'),
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 650, color: '#0F172A' }}>
                              {isCompleted ? '✓ ' : (isInProgress ? '▶ ' : '○ ')}
                              {vid.title}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                textTransform: 'uppercase',
                                backgroundColor: isCompleted ? '#DCFCE7' : (isInProgress ? '#E0F2FE' : '#F1F5F9'),
                                color: isCompleted ? '#166534' : (isInProgress ? '#0369A1' : '#64748B'),
                              }}
                            >
                              {vid.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {vid.subject_name} · {vid.topic_title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ ...mutedText, margin: 0 }}>No video lessons available.</p>
                )}
              </SurfacePanel>

              {/* Quiz Performance (Safe: scores only, no questions/keys) */}
              <SurfacePanel title="Quiz Performance" actions={<span style={mutedText}>Secure summary</span>}>
                {progress.quizzes.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                      <thead>
                        <tr style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '8px 12px' }}>Topic Quiz</th>
                          <th style={{ padding: '8px 12px' }}>Subject</th>
                          <th style={{ padding: '8px 12px' }}>Latest Score</th>
                          <th style={{ padding: '8px 12px' }}>Best Score</th>
                          <th style={{ padding: '8px 12px' }}>Average</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Mastery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.quizzes.map((q) => (
                          <tr key={q.quiz_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                              {q.topic_title}
                            </td>
                            <td style={{ padding: '12px', fontSize: 12, color: '#64748B' }}>
                              {q.subject_name}
                            </td>
                            <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: q.latest_score >= 80 ? '#059669' : '#D97706' }}>
                              {q.latest_score}%
                            </td>
                            <td style={{ padding: '12px', fontSize: 13, color: '#334155' }}>
                              {q.best_score}%
                            </td>
                            <td style={{ padding: '12px', fontSize: 13, color: '#64748B' }}>
                              {q.average_score}%
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                  backgroundColor: q.passed ? '#DCFCE7' : '#FEF3C7',
                                  color: q.passed ? '#15803D' : '#B45309',
                                }}
                              >
                                {q.passed ? 'PASSED' : 'IN PROGRESS'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <MasteryBadge level={q.mastery_level} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ ...mutedText, margin: 0 }}>No quiz attempts recorded yet.</p>
                )}
              </SurfacePanel>

              {/* Two Column Layout: Assignments + Recent Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
                {/* Assignments */}
                <SurfacePanel
                  title="Assignments"
                  actions={<span style={mutedText}>{progress.assignments.filter(a => a.status === 'GRADED' || a.status === 'SUBMITTED' || a.status === 'LATE').length} of {progress.assignments.length} completed</span>}
                >
                  {/* Summary Counters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                    <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Pending</div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: '#475569', marginTop: 2 }}>
                        {progress.assignments.filter(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length}
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Submitted</div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: '#0284C7', marginTop: 2 }}>
                        {progress.assignments.filter(a => a.status === 'SUBMITTED').length}
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Overdue</div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: '#DC2626', marginTop: 2 }}>
                        {progress.assignments.filter(a => {
                          if (a.status === 'LATE') return true;
                          if ((a.status === 'PENDING' || a.status === 'IN_PROGRESS') && a.due_date) {
                            return new Date(a.due_date) < new Date();
                          }
                          return false;
                        }).length}
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Graded</div>
                      <div style={{ fontSize: 16, fontWeight: 750, color: '#10B981', marginTop: 2 }}>
                        {progress.assignments.filter(a => a.status === 'GRADED').length}
                      </div>
                    </div>
                  </div>

                  {progress.assignments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {progress.assignments.map((assign) => {
                        const isGraded = assign.status === 'GRADED';
                        const isLate = assign.status === 'LATE';
                        const isSubmitted = assign.status === 'SUBMITTED';
                        const badgeBg = isGraded ? '#DCFCE7' : isLate ? '#FEE2E2' : isSubmitted ? '#E0F2FE' : '#F1F5F9';
                        const badgeColor = isGraded ? '#15803D' : isLate ? '#DC2626' : isSubmitted ? '#0369A1' : '#475569';

                        return (
                          <div
                            key={assign.assignment_id}
                            style={{
                              padding: '14px 16px',
                              borderRadius: 8,
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{assign.title}</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                  {assign.subject_name}
                                  {assign.chapter_title ? ` · ${assign.chapter_title}` : ''}
                                  {assign.topic_title ? ` · ${assign.topic_title}` : ''}
                                  {assign.teacher_name ? ` · Teacher: ${assign.teacher_name}` : ''}
                                </div>
                                {assign.due_date && (
                                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                    📅 Due: {new Date(assign.due_date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    backgroundColor: badgeBg,
                                    color: badgeColor,
                                  }}
                                >
                                  {assign.status}
                                </span>
                                {assign.score !== null && assign.score !== undefined && (
                                  <div style={{ fontSize: 13, fontWeight: 750, color: '#166534', marginTop: 4 }}>
                                    Score: {assign.score} {assign.total_points ? `/ ${assign.total_points}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Teacher Feedback Note */}
                            {assign.feedback && (
                              <div style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 12, color: '#15803D' }}>
                                <strong>Teacher Feedback:</strong> "{assign.feedback}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ ...mutedText, margin: 0 }}>No assignments assigned yet.</p>
                  )}
                </SurfacePanel>

                {/* Recent Learning Activity Timeline */}
                <SurfacePanel title="Recent Learning Activity">
                  {progress.recent_activity.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {progress.recent_activity.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            paddingBottom: 10,
                            borderBottom: '1px solid #F1F5F9',
                          }}
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>
                            {item.type === 'video' ? '🎬' : (item.type === 'quiz' ? '🎯' : '📑')}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                              {item.description}
                            </div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                              {new Date(item.timestamp).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          {item.status && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                              }}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ ...mutedText, margin: 0 }}>No recent activity recorded.</p>
                  )}
                </SurfacePanel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: string;
}> = ({ label, value, detail, color, icon }) => (
  <SurfacePanel style={{ padding: '18px 20px', borderTop: `4px solid ${color}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
        {label}
      </div>
      <span style={{ fontSize: 18 }}>{icon}</span>
    </div>
    <div style={{ color, fontSize: 28, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>
      {value}
    </div>
    <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
      {detail}
    </div>
  </SurfacePanel>
);

const MasteryBadge: React.FC<{ level: string }> = ({ level }) => {
  const norm = level.toUpperCase();
  let bg = '#F1F5F9';
  let color = '#475569';
  let text = norm.replace('_', ' ');

  if (norm === 'MASTERED' || norm === 'PROFICIENT') {
    bg = '#DCFCE7';
    color = '#15803D';
    text = 'MASTERED';
  } else if (norm === 'IN_PROGRESS' || norm === 'PRACTICING' || norm === 'INTERMEDIATE') {
    bg = '#E0F2FE';
    color = '#0369A1';
    text = 'IN PROGRESS';
  } else if (norm === 'NEEDS_PRACTICE' || norm === 'BEGINNER') {
    bg = '#FEE2E2';
    color = '#B91C1C';
    text = 'NEEDS PRACTICE';
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 999,
        backgroundColor: bg,
        color,
        letterSpacing: '.03em',
      }}
    >
      {text}
    </span>
  );
};
