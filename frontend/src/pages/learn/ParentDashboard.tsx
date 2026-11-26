import React, { useEffect, useState } from 'react';
import {
  Users,
  GraduationCap,
  TrendingUp,
  Film,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { api } from '../../lib/api';
import { ParentChildInfo, ParentChildProgressResponse } from '../../lib/types';

/**
 * Parent Guardian Dashboard.
 * Unslop refactored: Replaced emojis with Lucide SVG vectors, theme-adaptive CSS variables
 * for full Light & Dark mode support, clean child profile card, and tabular numerals.
 */
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
      {/* Header Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <Users size={14} />
            <span>Parent Portal · Student Monitoring</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '6px 0 2px', letterSpacing: '-0.015em' }}>
            My Child's Learning
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Real-time curriculum progress, video engagement, quiz results, and topic mastery for your child.
          </p>
        </div>

        {/* Child Selector Dropdown (if multiple children) */}
        {children.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label htmlFor="child-select" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Child:
            </label>
            <select
              id="child-select"
              aria-label="Select Child"
              value={selectedChildId ?? ''}
              onChange={(e) => setSelectedChildId(Number(e.target.value))}
              className="adm-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12.5px' }}
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
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Loading your linked children...
          </div>
        </SurfacePanel>
      )}

      {!loadingChildren && error && (
        <SurfacePanel>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div role="alert" style={{ color: 'var(--error)', fontWeight: 600, marginBottom: 12, fontSize: '13px' }}>
              {error}
            </div>
            <button
              type="button"
              onClick={() => void fetchChildren()}
              className="lrn-btn lrn-btn-primary"
            >
              Retry
            </button>
          </div>
        </SurfacePanel>
      )}

      {/* Empty State: No Children Linked */}
      {!loadingChildren && !error && children.length === 0 && (
        <SurfacePanel>
          <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              <Users size={36} strokeWidth={1.5} />
            </div>
            <h2 data-testid="no-children-linked" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              No children linked
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              There are currently no student accounts linked to this parent profile.
              Please reach out to your school administrator to register and connect your child's student record.
            </p>
          </div>
        </SurfacePanel>
      )}

      {/* Active Child View */}
      {!loadingChildren && !error && selectedChild && (
        <>
          {/* Child Profile Banner */}
          <div
            className="lrn-card"
            style={{
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {selectedChild.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  {selectedChild.name}
                </h2>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Student ID: <strong style={{ color: 'var(--text)' }}>{selectedChild.student_id}</strong></span>
                  <span>•</span>
                  <span>Class: <strong style={{ color: 'var(--text)' }}>{selectedChild.class_name || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Section: <strong style={{ color: 'var(--text)' }}>{selectedChild.section || 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--success-soft)', color: 'var(--success)', border: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success)' }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Active Enrollment</span>
            </div>
          </div>

          {loadingProgress && (
            <SurfacePanel>
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Loading {selectedChild.name}'s progress...
              </div>
            </SurfacePanel>
          )}

          {!loadingProgress && progress && (
            <>
              {/* 5 KPI Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                <KpiCard
                  label="OVERALL PROGRESS"
                  value={`${progress.overall_progress}%`}
                  detail="Curriculum completion"
                  color="var(--primary)"
                  icon={TrendingUp}
                />
                <KpiCard
                  label="VIDEOS COMPLETED"
                  value={`${progress.videos_completed} / ${progress.total_videos}`}
                  detail={`${progress.total_videos > 0 ? Math.round((progress.videos_completed / progress.total_videos) * 100) : 0}% watched`}
                  color="var(--success)"
                  icon={Film}
                />
                <KpiCard
                  label="AVERAGE QUIZ SCORE"
                  value={`${progress.average_quiz_score}%`}
                  detail="Across all assessments"
                  color="#6366F1"
                  icon={CheckCircle2}
                />
                <KpiCard
                  label="TOPIC MASTERY"
                  value={`${progress.topic_mastery_percentage}%`}
                  detail="Average concept proficiency"
                  color="var(--warning)"
                  icon={BookOpen}
                />
                <KpiCard
                  label="ASSIGNMENTS COMPLETED"
                  value={`${progress.assignments_completed} / ${progress.total_assignments}`}
                  detail={`${progress.total_assignments > 0 ? Math.round((progress.assignments_completed / progress.total_assignments) * 100) : 0}% submitted`}
                  color="#0891B2"
                  icon={ClipboardList}
                />
              </div>

              {/* Needs More Practice Banner */}
              {progress.weak_topics.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--error-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <AlertTriangle size={20} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--error)' }}>
                      Targeted Review Recommended
                    </h3>
                    <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      Based on recent quiz attempts, your child should review these focus topics:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {progress.weak_topics.map((topic, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--error)',
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-xs)',
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
                {/* Subject Progress */}
                <SurfacePanel title="Subject Progress">
                  {progress.subjects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {progress.subjects.map((subj) => (
                        <div key={subj.subject_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{subj.subject_name}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {subj.progress_percentage}%
                            </span>
                          </div>
                          <MasteryProgressBar percentage={subj.progress_percentage} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No subjects assigned to student.</p>
                  )}
                </SurfacePanel>

                {/* Topic Mastery */}
                <SurfacePanel title="Topic Mastery">
                  {progress.topic_mastery.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {progress.topic_mastery.map((tm) => (
                        <div
                          key={tm.topic_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '9px 12px',
                            backgroundColor: 'var(--surface-raised)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tm.topic_title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {tm.subject_name} · Score: <strong style={{ color: 'var(--text)' }}>{tm.score}%</strong>
                            </div>
                          </div>
                          <MasteryBadge level={tm.mastery_level} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No topic mastery assessments recorded yet.</p>
                  )}
                </SurfacePanel>
              </div>

              {/* Video Lessons Activity */}
              <SurfacePanel
                title="Video Lessons Progress"
                actions={<span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{progress.videos_completed} of {progress.total_videos} completed</span>}
              >
                {progress.videos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {progress.videos.map((vid) => {
                      const isCompleted = vid.status === 'COMPLETED';
                      const isInProgress = vid.status === 'IN_PROGRESS';
                      return (
                        <div
                          key={vid.video_id}
                          className="lrn-card"
                          style={{
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isCompleted && <Check size={14} color="var(--success)" />}
                              {isInProgress && <Film size={14} color="var(--primary)" />}
                              {!isCompleted && !isInProgress && <Clock size={14} color="var(--text-muted)" />}
                              {vid.title}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-xs)',
                                textTransform: 'uppercase',
                                backgroundColor: isCompleted ? 'var(--success-soft)' : (isInProgress ? 'var(--primary-soft)' : 'var(--surface-raised)'),
                                color: isCompleted ? 'var(--success)' : (isInProgress ? 'var(--primary)' : 'var(--text-secondary)'),
                                border: '1px solid var(--border)',
                              }}
                            >
                              {vid.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {vid.subject_name} · {vid.topic_title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No video lessons available.</p>
                )}
              </SurfacePanel>

              {/* Quiz Performance */}
              <SurfacePanel title="Quiz Performance" actions={<span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Secure assessment summary</span>}>
                {progress.quizzes.length > 0 ? (
                  <div className="adm-table-wrapper" style={{ border: 'none' }}>
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Topic Quiz</th>
                          <th>Subject</th>
                          <th>Latest Score</th>
                          <th>Best Score</th>
                          <th>Average</th>
                          <th>Status</th>
                          <th>Mastery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.quizzes.map((q) => (
                          <tr key={q.quiz_id}>
                            <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {q.topic_title}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              {q.subject_name}
                            </td>
                            <td style={{ fontWeight: 700, color: q.latest_score >= 80 ? 'var(--success)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                              {q.latest_score}%
                            </td>
                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {q.best_score}%
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {q.average_score}%
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: 'var(--radius-xs)',
                                  backgroundColor: q.passed ? 'var(--success-soft)' : 'var(--warning-soft)',
                                  color: q.passed ? 'var(--success)' : 'var(--warning)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {q.passed ? 'PASSED' : 'IN PROGRESS'}
                              </span>
                            </td>
                            <td>
                              <MasteryBadge level={q.mastery_level} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No quiz attempts recorded yet.</p>
                )}
              </SurfacePanel>

              {/* Assignments Section */}
              <SurfacePanel
                title="Assignments Progress"
                actions={<span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{progress.assignments.filter(a => a.status === 'GRADED' || a.status === 'SUBMITTED' || a.status === 'LATE').length} of {progress.assignments.length} completed</span>}
              >
                {progress.assignments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {progress.assignments.map((assign) => (
                      <div
                        key={assign.assignment_id}
                        className="lrn-card"
                        style={{
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{assign.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {assign.subject_name}
                              {assign.chapter_title ? ` · ${assign.chapter_title}` : ''}
                              {assign.teacher_name ? ` · Teacher: ${assign.teacher_name}` : ''}
                            </div>
                            {assign.due_date && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={11} />
                                <span>Due: {new Date(assign.due_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-xs)',
                                backgroundColor: assign.status === 'GRADED' ? 'var(--success-soft)' : (assign.status === 'LATE' ? 'var(--error-soft)' : 'var(--primary-soft)'),
                                color: assign.status === 'GRADED' ? 'var(--success)' : (assign.status === 'LATE' ? 'var(--error)' : 'var(--primary)'),
                                border: '1px solid var(--border)',
                              }}
                            >
                              {assign.status}
                            </span>
                            {assign.score !== null && assign.score !== undefined && (
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--success)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                                Score: {assign.score} {assign.total_points ? `/ ${assign.total_points}` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {assign.feedback && (
                          <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--success-soft)', border: '1px solid var(--border)', fontSize: 11.5, color: 'var(--success)' }}>
                            <strong>Instructor Feedback:</strong> "{assign.feedback}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>No assignments recorded.</p>
                )}
              </SurfacePanel>
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

const MasteryBadge: React.FC<{ level: string }> = ({ level }) => {
  const norm = level.toUpperCase();
  let bg = 'var(--surface-raised)';
  let color = 'var(--text-secondary)';
  let text = norm.replace('_', ' ');

  if (norm === 'MASTERED' || norm === 'PROFICIENT') {
    bg = 'var(--success-soft)';
    color = 'var(--success)';
    text = 'MASTERED';
  } else if (norm === 'IN_PROGRESS' || norm === 'PRACTICING' || norm === 'INTERMEDIATE') {
    bg = 'var(--primary-soft)';
    color = 'var(--primary)';
    text = 'IN PROGRESS';
  } else if (norm === 'NEEDS_PRACTICE' || norm === 'BEGINNER') {
    bg = 'var(--error-soft)';
    color = 'var(--error)';
    text = 'NEEDS PRACTICE';
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 'var(--radius-xs)',
        backgroundColor: bg,
        color,
        border: '1px solid var(--border)',
        letterSpacing: '.02em',
      }}
    >
      {text}
    </span>
  );
};
