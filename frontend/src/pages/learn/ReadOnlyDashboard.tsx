import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { useAuth } from '../../lib/authContext';
import { api } from '../../lib/api';
import { ProgressSummary } from '../../lib/types';

export const ReadOnlyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<number>(2); // Default to student id 2
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const studentsList = [
    { id: 2, name: 'Alice Student', email: 'student@example.com' },
  ];

  useEffect(() => {
    const fetchStudentSummary = async () => {
      try {
        setLoading(true);
        const data = await api.getProgressSummary(selectedStudentId);
        setSummary(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentSummary();
  }, [selectedStudentId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Read-Only Watermark Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderRadius: '8px',
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E40AF' }}>
              Read-Only {user?.role === 'parent' ? 'Parent' : 'Teacher'} Observer Dashboard
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Access restricted strictly to aggregated progress metrics and mastery summaries.
            </div>
          </div>
        </div>

        <span
          style={{
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: '#DBEAFE',
            color: '#1D4ED8',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          Read-Only Mode
        </span>
      </div>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
          Student Academic Progress Overview
        </h1>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
          Monitor concept mastery, topic completion, and identified focus areas.
        </p>
      </div>

      {/* Student Selector Context Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            Select Student Context:
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0F172A',
              fontSize: '14px',
              minWidth: '260px',
            }}
          >
            {studentsList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.email})
              </option>
            ))}
          </select>
        </div>
      </SurfacePanel>

      {summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <SurfacePanel>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>OVERALL MASTERY</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563EB', marginTop: '6px' }}>
                {summary.overall_mastery_percentage}%
              </div>
              <div style={{ marginTop: '10px' }}>
                <MasteryProgressBar percentage={summary.overall_mastery_percentage} />
              </div>
            </SurfacePanel>

            <SurfacePanel>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>TOPICS COMPLETED</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '6px' }}>
                {summary.topics_completed} / {summary.total_topics}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                {Math.round((summary.topics_completed / (summary.total_topics || 1)) * 100)}% Syllabus Covered
              </div>
            </SurfacePanel>

            <SurfacePanel>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>MODULAR LESSONS WATCHED</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669', marginTop: '6px' }}>
                {summary.recent_activity.video_units_watched}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                ~5.5 min micro-learning units
              </div>
            </SurfacePanel>

            <SurfacePanel>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>QUIZ ASSESSMENTS TAKEN</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#4F46E5', marginTop: '6px' }}>
                {summary.recent_activity.quizzes_attempted}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                Standardized topic quizzes
              </div>
            </SurfacePanel>
          </div>

          {/* Weak Concepts Widget */}
          <SurfacePanel>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '14px' }}>
              Identified Focus Areas & Weak Concepts
            </h2>

            {summary.weak_concepts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px' }}>
                ✓ No weak concepts identified. Student has met or exceeded all evaluated proficiency standards.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.weak_concepts.map((concept, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#991B1B' }}>{concept}</div>
                      <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                        Automated Stage 6 adaptive practice recommended for student.
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                      }}
                    >
                      Attention Recommended
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfacePanel>
        </div>
      )}
    </div>
  );
};
