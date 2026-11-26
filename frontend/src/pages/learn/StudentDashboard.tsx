import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ClipboardList,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Clock,
  Check,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { api } from '../../lib/api';
import { ProgressSummary } from '../../lib/types';

interface StudentDashboardProps {
  onNavigate: (route: string, params?: any) => void;
}

/**
 * Student Learning Dashboard.
 * Unslop refactored: Subtractive design, eliminated gradient glare and emoji noise,
 * crisp typography, tabular metrics, and editorial lesson cards.
 */
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--learn-text)', letterSpacing: '-0.01em' }}>
            Learning Dashboard
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--learn-text-secondary)', marginTop: '4px' }}>
            Curated textbook units, pre-rendered concept lessons, and targeted mastery assessments.
          </p>

          {summary?.assigned_subjects && summary.assigned_subjects.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              {summary.assigned_subjects.map((subj) => (
                <span
                  key={subj}
                  className="lrn-pill"
                >
                  <BookOpen size={12} color="var(--learn-primary)" />
                  {subj}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onNavigate('student-assignments')}
          className="lrn-btn lrn-btn-primary"
        >
          <ClipboardList size={14} />
          <span>My Assignments</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Resume Learning Unit */}
      {summary?.resume_learning ? (
        <div
          style={{
            backgroundColor: 'var(--surface-inverse, #0F172A)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px 28px',
            color: 'var(--text-on-inverse, #FFFFFF)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'rgba(99, 102, 241, 0.25)',
                  color: '#A5B4FC',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Continue Lesson • {summary.resume_learning.subject_name || 'Assigned'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                {summary.resume_learning.duration_minutes_formatted || '5.5 min'}
              </span>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: '10px', color: 'var(--text)' }}>
              {summary.resume_learning.video_title}
            </h2>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {summary.resume_learning.chapter_title && `${summary.resume_learning.chapter_title} • `}
              {summary.resume_learning.topic_title}
              {summary.resume_learning.progress_percentage > 0
                ? ` — ${Math.round(summary.resume_learning.progress_percentage)}% completed`
                : ' — Ready to begin'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('student-video', { videoId: summary.resume_learning?.video_id })}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              color: 'var(--text, #0F172A)',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform var(--duration-fast) var(--ease)',
            }}
          >
            <Play size={14} fill="currentColor" />
            <span>Watch Lesson Unit</span>
          </button>
        </div>
      ) : (
        <div
          className="lrn-card"
          style={{
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--learn-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Curriculum Status
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--learn-text)', marginTop: '4px' }}>
              No Active Video Lessons Available
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--learn-text-secondary)', marginTop: '2px' }}>
              Approved lessons for your assigned syllabus will appear here once rendered and published by your instructor.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry Metrics */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div className="lrn-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Overall Concept Mastery
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--learn-primary)', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {summary.overall_mastery_percentage}%
            </div>
            <div style={{ marginTop: '10px' }}>
              <MasteryProgressBar percentage={summary.overall_mastery_percentage} />
            </div>
          </div>

          <div className="lrn-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Topics Completed
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--learn-text)', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {summary.topics_completed} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--learn-text-secondary)' }}>/ {summary.total_topics}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--learn-text-secondary)', marginTop: '6px' }}>
              Curriculum progression
            </div>
          </div>

          <div className="lrn-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Video Units Watched
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--learn-success)', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {summary.recent_activity.video_units_watched}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--learn-text-secondary)', marginTop: '6px' }}>
              Modular 5–6 min units
            </div>
          </div>

          <div className="lrn-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--learn-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Remediation Needed
            </div>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: summary.weak_concepts.length > 0 ? 'var(--learn-error)' : 'var(--learn-success)',
                marginTop: '6px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {summary.weak_concepts.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--learn-text-secondary)', marginTop: '6px' }}>
              {summary.weak_concepts.length > 0 ? 'Concepts targeted for review' : 'All concepts on track'}
            </div>
          </div>
        </div>
      )}

      {/* Modules and Assessments Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--learn-text)' }}>
            Curriculum Units & Assessments
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Video Modules */}
          {summary?.modules && summary.modules.length > 0 ? (
            summary.modules.map((m) => (
              <div
                key={`video-${m.id}`}
                className="lrn-card"
                onClick={() => onNavigate(m.action_route || 'student-video', { videoId: m.item_id })}
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      backgroundColor: 'var(--learn-primary-soft)',
                      color: 'var(--learn-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Video • {m.subject_name}
                  </span>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--learn-text)', marginTop: '10px', lineHeight: 1.3 }}>
                    {m.title}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--learn-text-secondary)', marginTop: '4px' }}>
                    {m.chapter_title && `${m.chapter_title} • `}{m.topic_title}
                  </p>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--learn-border)', paddingTop: '12px' }}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: m.status === 'Completed' ? 'var(--learn-success)' : (m.status === 'In Progress' ? 'var(--learn-primary)' : 'var(--learn-text-secondary)'),
                      fontWeight: 600,
                    }}
                  >
                    {m.status}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--learn-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>{m.action_label}</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="lrn-card" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--learn-text-secondary)' }}>
              <p style={{ fontSize: '13.5px', fontWeight: 600 }}>No published lessons yet</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>
                Lessons will appear as soon as your teachers publish curriculum videos.
              </p>
            </div>
          )}

          {/* Quizzes */}
          {summary?.quizzes && summary.quizzes.length > 0 && (
            summary.quizzes.map((q) => (
              <div
                key={`quiz-${q.id}`}
                className="lrn-card"
                onClick={() => onNavigate(q.action_route || 'student-quiz', { quizId: q.item_id, topicId: q.topic_id })}
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      backgroundColor: 'var(--learn-success-soft)',
                      color: 'var(--learn-success)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Quiz • {q.subject_name}
                  </span>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--learn-text)', marginTop: '10px', lineHeight: 1.3 }}>
                    {q.title}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--learn-text-secondary)', marginTop: '4px' }}>
                    {q.chapter_title && `${q.chapter_title} • `}{q.topic_title}
                  </p>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--learn-border)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--learn-text-secondary)', fontWeight: 500 }}>
                    {q.status}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--learn-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>{q.action_label}</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Adaptive Practice Card */}
          <div
            className="lrn-card"
            onClick={() => onNavigate('student-adaptive', { topicId: summary?.resume_learning?.topic_id || summary?.quizzes?.[0]?.topic_id })}
            style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  backgroundColor: 'var(--learn-warning-soft)',
                  color: 'var(--learn-warning)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Adaptive Remediation
              </span>
              <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--learn-text)', marginTop: '10px', lineHeight: 1.3 }}>
                Targeted Practice Engine
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--learn-text-secondary)', marginTop: '4px' }}>
                {summary?.weak_concepts && summary.weak_concepts.length > 0
                  ? `${summary.weak_concepts.length} weak concept(s) targeted for dynamic reinforcement.`
                  : 'Diagnostic quiz questions that adapt automatically to your performance gaps.'}
              </p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--learn-border)', paddingTop: '12px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--learn-warning)', fontWeight: 600 }}>
                Diagnostic Mode
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--learn-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>Practice Now</span>
                <ArrowRight size={13} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
