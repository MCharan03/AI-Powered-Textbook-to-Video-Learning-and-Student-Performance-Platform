import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { SurfacePanel } from '../../components/SurfacePanel';
import { FormInputSlider } from '../../components/FormInputSlider';
import { Save } from 'lucide-react';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg(null);
      const updated = await api.updateThresholdSettings(settings);
      setSettings(updated);
      setDirty(false);
      setToast('Mastery thresholds updated successfully.');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const bannerMessage = toast
    ? { text: toast, type: 'success' as const }
    : errorMsg
    ? { text: errorMsg, type: 'error' as const }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Mastery Thresholds & Adaptive Settings"
        description="Configure institutional passing bars, adaptive question synthesis volume, and modular video targets."
      />

      <MessageBanner
        message={bannerMessage}
        onDismiss={() => {
          setToast(null);
          setErrorMsg(null);
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <SurfacePanel title="Concept Mastery Benchmark">
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

        <SurfacePanel title="Adaptive Remediation Settings">
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

        <SurfacePanel style={{ gridColumn: '1 / -1' }} title="Modular Video Duration Target">
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

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--admin-border)',
            }}
          >
            <span className="adm-help-text" style={{ marginTop: 0 }}>
              {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </span>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              <Save size={15} />
              {saving ? 'Saving Changes...' : 'Save Threshold Settings'}
            </button>
          </div>
        </SurfacePanel>
      </div>
    </div>
  );
};
