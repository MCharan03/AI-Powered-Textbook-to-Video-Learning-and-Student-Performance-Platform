import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { api } from '../../lib/api';
import { ProgressSummary } from '../../lib/types';

interface StudentDashboardProps {
  onNavigate: (route: string, params?: any) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await api.getProgressSummary();
        setSummary(data);
      } catch (err) {
        console.error('Failed to load student progress dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Student Learning Dashboard</h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
            Explore approved textbook chapters, watch ~5–6 minute pre-rendered lessons, and master key concepts.
          </p>

          {summary?.assigned_subjects && summary.assigned_subjects.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {summary.assigned_subjects.map((subj) => (
                <span
                  key={subj}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#E2E8F0',
                    color: '#1E293B',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  📚 {subj}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate('student-assignments')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            backgroundColor: '#2563EB',
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
          📝 My Assignments →
        </button>
      </div>

      {/* Continue Learning Banner */}
      {summary?.resume_learning ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
            borderRadius: '16px',
            padding: '28px',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.25)',
          }}
        >
          <div style={{ maxWidth: '600px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              MODULAR LESSON • {summary.resume_learning.subject_name || 'ASSIGNED CURRICULUM'}
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>
              Resume Learning: {summary.resume_learning.video_title}
            </h2>
            <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
              {summary.resume_learning.chapter_title && `${summary.resume_learning.chapter_title} • `}
              {summary.resume_learning.topic_title} — {summary.resume_learning.duration_minutes_formatted || '5.5 min video lesson'}
              {summary.resume_learning.progress_percentage > 0
                ? ` • ${Math.round(summary.resume_learning.progress_percentage)}% watched`
                : ' • Ready to start'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('student-video', { videoId: summary.resume_learning?.video_id })}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#1E40AF',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            Watch Video Unit →
          </button>
        </div>
      ) : (
        <div
          style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>CURRICULUM STATUS</span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#334155', marginTop: '4px' }}>
              No Active Video Lessons Available
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
              All approved video lessons for your assigned curriculum will appear here once rendered and published by an administrator.
            </p>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <SurfacePanel>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>OVERALL MASTERY</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563EB', marginTop: '6px' }}>
              {summary.overall_mastery_percentage}%
            </div>
            <div style={{ marginTop: '12px' }}>
              <MasteryProgressBar percentage={summary.overall_mastery_percentage} />
            </div>
          </SurfacePanel>

          <SurfacePanel>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>TOPICS COMPLETED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '6px' }}>
              {summary.topics_completed} / {summary.total_topics}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>
              Approved textbook curriculum
            </div>
          </SurfacePanel>

          <SurfacePanel>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>VIDEOS WATCHED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669', marginTop: '6px' }}>
              {summary.recent_activity.video_units_watched}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>
              ~5-6 min modular units
            </div>
          </SurfacePanel>

          <SurfacePanel>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>WEAK CONCEPTS</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: summary.weak_concepts.length > 0 ? '#DC2626' : '#059669', marginTop: '6px' }}>
              {summary.weak_concepts.length}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px' }}>
              {summary.weak_concepts.length > 0 ? 'Targeted for remediation' : 'No weak concepts'}
            </div>
          </SurfacePanel>
        </div>
      )}

      {/* Quick Action Navigation Grid */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Learning Modules & Quizzes
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Dynamic Video Modules */}
          {summary?.modules && summary.modules.length > 0 ? (
            summary.modules.map((m) => (
              <SurfacePanel key={`video-${m.id}`} style={{ cursor: 'pointer' }}>
                <div onClick={() => onNavigate(m.action_route || 'student-video', { videoId: m.item_id })}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563EB',
                    }}
                  >
                    PRE-RENDERED VIDEO • {m.subject_name}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '10px' }}>
                    {m.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                    {m.chapter_title && `${m.chapter_title} • `}{m.topic_title} • Duration: {Math.floor((m.duration_seconds || 330) / 60)} min {(m.duration_seconds || 330) % 60} sec
                  </p>
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: m.status === 'Completed' ? '#059669' : (m.status === 'In Progress' ? '#2563EB' : '#64748B'), fontWeight: 600 }}>
                      {m.status}
                    </span>
                    <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>{m.action_label}</span>
                  </div>
                </div>
              </SurfacePanel>
            ))
          ) : (
            <SurfacePanel>
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748B' }}>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>No published video units yet</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Videos will appear once rendered and published for your assigned subjects.
                </p>
              </div>
            </SurfacePanel>
          )}

          {/* Dynamic Topic Quizzes */}
          {summary?.quizzes && summary.quizzes.length > 0 && (
            summary.quizzes.map((q) => (
              <SurfacePanel key={`quiz-${q.id}`} style={{ cursor: 'pointer' }}>
                <div onClick={() => onNavigate(q.action_route || 'student-quiz', { quizId: q.item_id, topicId: q.topic_id })}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                    }}
                  >
                    TOPIC ASSESSMENT • {q.subject_name}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '10px' }}>
                    {q.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                    {q.chapter_title && `${q.chapter_title} • `}{q.topic_title} • Objective-aligned questions with immediate feedback.
                  </p>
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{q.status}</span>
                    <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>{q.action_label}</span>
                  </div>
                </div>
              </SurfacePanel>
            ))
          )}

          {/* Adaptive Practice Card */}
          <SurfacePanel style={{ cursor: 'pointer' }}>
            <div onClick={() => onNavigate('student-adaptive', { topicId: summary?.resume_learning?.topic_id || summary?.quizzes?.[0]?.topic_id })}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  color: '#D97706',
                }}
              >
                STAGE 6 ADAPTIVE
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '10px' }}>
                Adaptive Remediation Practice
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                {summary?.weak_concepts && summary.weak_concepts.length > 0
                  ? `${summary.weak_concepts.length} weak concept(s) targeted for dynamic remediation.`
                  : 'Personalized practice questions dynamically targeting identified weak concepts.'}
              </p>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 600 }}>Remediation Session</span>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>Practice Now →</span>
              </div>
            </div>
          </SurfacePanel>
        </div>
      </div>
    </div>
  );
};
