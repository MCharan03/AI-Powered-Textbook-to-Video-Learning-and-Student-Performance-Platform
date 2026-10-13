import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { FormInputSlider } from '../../components/FormInputSlider';
import { api } from '../../lib/api';
import { ThresholdSettings } from '../../lib/types';

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<ThresholdSettings>({
    mastery_threshold_percentage: 80,
    adaptive_question_count: 3,
    target_video_duration_minutes: 5.5,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getThresholdSettings();
        setSettings(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateThresholdSettings(settings);
      setSettings(updated);
      setDirty(false);
      setToast('Mastery thresholds updated successfully.');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>
          Mastery Thresholds & Adaptive Settings
        </h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
          Configure institutional passing bars, adaptive question synthesis volume, and modular video targets.
        </p>
      </div>

      {toast && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10B981',
            color: '#10B981',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✓ {toast}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <SurfacePanel>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '20px' }}>
            Concept Mastery Benchmark
          </h2>
          <FormInputSlider
            label="Mastery Passing Threshold"
            value={settings.mastery_threshold_percentage}
            min={50}
            max={100}
            step={5}
            unit="%"
            description="Minimum score percentage required on topic quiz to establish concept mastery."
            onChange={(val) => {
              setSettings((prev) => ({ ...prev, mastery_threshold_percentage: val }));
              setDirty(true);
            }}
          />
        </SurfacePanel>

        <SurfacePanel>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '20px' }}>
            Adaptive Remediation Settings
          </h2>
          <FormInputSlider
            label="Stage 6 Adaptive Question Count"
            value={settings.adaptive_question_count}
            min={1}
            max={10}
            step={1}
            unit="Questions"
            description="Number of targeted remedial questions synthesized per identified weak concept."
            onChange={(val) => {
              setSettings((prev) => ({ ...prev, adaptive_question_count: val }));
              setDirty(true);
            }}
          />
        </SurfacePanel>

        <SurfacePanel style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '20px' }}>
            Modular Video Duration Target
          </h2>
          <FormInputSlider
            label="Target Video Unit Duration"
            value={settings.target_video_duration_minutes}
            min={3}
            max={10}
            step={0.5}
            unit="Minutes"
            description="Optimal chunk duration for pre-rendered video synthesis (Specification baseline: ~5-6 minutes)."
            onChange={(val) => {
              setSettings((prev) => ({ ...prev, target_video_duration_minutes: val }));
              setDirty(true);
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: dirty ? 'var(--admin-primary)' : '#334155',
                color: dirty ? '#FFF' : '#94A3B8',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                boxShadow: dirty ? '0 2px 4px rgba(99, 102, 241, 0.3)' : 'none',
              }}
            >
              {saving ? 'Saving Changes...' : 'Save Threshold Settings'}
            </button>
          </div>
        </SurfacePanel>
      </div>
    </div>
  );
};
