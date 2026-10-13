import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { MasteryProgressBar } from '../../components/MasteryProgressBar';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { ProgressSummary } from '../../lib/types';

interface StudentMasteryProps {
  onNavigate: (route: string) => void;
}

export const StudentMastery: React.FC<StudentMasteryProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await api.getProgressSummary();
        setSummary(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSummary();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Progress & Concept Mastery</h1>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
          Personal learning analytics tracking video completion, quiz performance, and concept mastery over time.
        </p>
      </div>

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Overall Mastery Gauge */}
            <SurfacePanel>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>
                Overall Institutional Mastery
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <MasteryProgressBar
                  percentage={summary.overall_mastery_percentage}
                  target={80}
                  height={12}
                />
                <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '20px' }}>
                  Current mastery: <strong>{summary.overall_mastery_percentage}%</strong> across evaluated curriculum objectives. 80% required for proficiency certification.
                </div>
              </div>
            </SurfacePanel>

            {/* Curriculum Progress */}
            <SurfacePanel>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>
                Curriculum Progression
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>Topics Completed:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {summary.topics_completed} of {summary.total_topics} Topics
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>Modular Videos Watched:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {summary.recent_activity.video_units_watched} Units
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>Topic Quizzes Completed:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {summary.recent_activity.quizzes_attempted} Attempts
                  </span>
                </div>
              </div>
            </SurfacePanel>
          </div>

          {/* Weak Concepts Tracker */}
          <SurfacePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
                Weak Concepts & Remediation Tracker
              </h2>
              {summary.weak_concepts.length > 0 && (
                <button
                  onClick={() => onNavigate('student-adaptive')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#2563EB',
                    color: '#FFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Start Adaptive Session →
                </button>
              )}
            </div>

            {summary.weak_concepts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px' }}>
                ✓ No weak concepts identified. Excellent mastery progress across all attempted topics!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {summary.weak_concepts.map((concept, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#991B1B' }}>{concept}</div>
                      <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                        Missed in recent topic quiz assessment. Remedial practice recommended.
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('student-adaptive')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#DC2626',
                        color: '#FFF',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Remediate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SurfacePanel>
        </>
      )}
    </div>
  );
};
