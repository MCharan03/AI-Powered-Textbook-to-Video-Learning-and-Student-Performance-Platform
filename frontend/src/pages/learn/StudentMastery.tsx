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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.015em' }}>
          Progress & Concept Mastery
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Personal learning analytics tracking video completion, quiz performance, and concept mastery over time.
        </p>
      </div>

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Overall Mastery Gauge */}
            <SurfacePanel>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>
                Overall Institutional Mastery
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <MasteryProgressBar
                  percentage={summary.overall_mastery_percentage}
                  target={80}
                  height={10}
                />
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '18px' }}>
                  Current mastery: <strong style={{ color: 'var(--text)' }}>{summary.overall_mastery_percentage}%</strong> across evaluated curriculum objectives. 80% required for proficiency certification.
                </div>
              </div>
            </SurfacePanel>

            {/* Curriculum Progress */}
            <SurfacePanel>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>
                Curriculum Progression
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Topics Completed:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {summary.topics_completed} of {summary.total_topics} Topics
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Modular Videos Watched:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {summary.recent_activity.video_units_watched} Units
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Topic Quizzes Completed:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {summary.recent_activity.quizzes_attempted} Attempts
                  </span>
                </div>
              </div>
            </SurfacePanel>
          </div>

          {/* Weak Concepts Tracker */}
          <SurfacePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                Weak Concepts & Remediation Tracker
              </h2>
              {summary.weak_concepts.length > 0 && (
                <button
                  onClick={() => onNavigate('student-adaptive')}
                  className="lrn-btn lrn-btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Start Adaptive Session →
                </button>
              )}
            </div>

            {summary.weak_concepts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--success)', backgroundColor: 'var(--success-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                ✓ No weak concepts identified. Excellent mastery progress across all attempted topics!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {summary.weak_concepts.map((concept, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--error-soft)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--error)' }}>{concept}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Missed in recent topic quiz assessment. Remedial practice recommended.
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('student-adaptive')}
                      className="adm-btn adm-btn-danger"
                      style={{ padding: '5px 12px', fontSize: '11.5px' }}
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
