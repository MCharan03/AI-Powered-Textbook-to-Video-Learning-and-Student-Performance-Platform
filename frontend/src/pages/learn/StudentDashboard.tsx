import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { api } from '../../lib/api';
import { ProgressSummary, Textbook } from '../../lib/types';

interface StudentDashboardProps {
  onNavigate: (route: string) => void;
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Student Learning Dashboard</h1>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
          Explore approved textbook chapters, watch ~5–6 minute pre-rendered lessons, and master key concepts.
        </p>
      </div>

      {/* Continue Learning Banner */}
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
            MODULAR LESSON
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>
            Resume Learning: Chemical Reactions & Equations
          </h2>
          <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
            Pre-rendered 5.5 min video lesson covering Types of Chemical Reactions and Balancing Equations.
          </p>
        </div>
        <button
          onClick={() => onNavigate('student-video')}
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
          <SurfacePanel style={{ cursor: 'pointer' }}>
            <div onClick={() => onNavigate('student-video')}>
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
                PRE-RENDERED VIDEO
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '10px' }}>
                Unit 1: Introduction to Chemical Reactions
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                Duration: 5 min 30 sec • 100% pre-rendered video asset delivery.
              </p>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Ready to Watch</span>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>Open Player →</span>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel style={{ cursor: 'pointer' }}>
            <div onClick={() => onNavigate('student-quiz')}>
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
                TOPIC ASSESSMENT
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '10px' }}>
                Topic 1: Mastery Quiz
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                Objective-aligned multiple choice questions with immediate feedback.
              </p>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>5 Questions</span>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600 }}>Start Quiz →</span>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel style={{ cursor: 'pointer' }}>
            <div onClick={() => onNavigate('student-adaptive')}>
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
                Questions synthesized post-publication dynamically targeting identified weak concepts.
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
