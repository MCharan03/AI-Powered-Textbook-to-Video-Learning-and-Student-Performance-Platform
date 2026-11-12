import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { EmptyState } from '../../components/admin/EmptyState';
import { LoadingState } from '../../components/admin/LoadingState';
import { WorkflowStepper } from '../../components/admin/WorkflowStepper';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { Sparkles, RefreshCw, ShieldCheck, Check, Pencil, Loader2, ScrollText } from 'lucide-react';
import { api } from '../../lib/api';
import {
  ScriptItem,
  ScriptSection,
  ScriptRegenerationPreview,
  VideoPlan
} from '../../lib/types';

interface AdminScriptReviewProps {
  onNavigate: (route: string, params?: any) => void;
  initialVideoId?: number;
}

const PIPELINE_STEPS = ['Upload Textbook', 'Extract Curriculum', 'Review & Approve', 'Video Plans', 'Scripts', 'Videos', 'Publish'];

const SECTION_TONES: Record<string, { bg: string; color: string }> = {
  INTRO: { bg: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' },
  OBJECTIVE: { bg: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' },
  CONCEPT: { bg: 'var(--admin-success-soft)', color: 'var(--admin-success)' },
  FORMULA: { bg: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' },
  DETAILED_EXPLANATION: { bg: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' },
  EXAMPLE: { bg: 'var(--admin-success-soft)', color: 'var(--admin-success)' },
  SUMMARY: { bg: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' },
};

const getSectionTone = (type: string) =>
  SECTION_TONES[type.toUpperCase()] || { bg: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' };

export const AdminScriptReview: React.FC<AdminScriptReviewProps> = ({ onNavigate, initialVideoId }) => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [videoPlans, setVideoPlans] = useState<VideoPlan[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<number | ''>(initialVideoId || '');
  const [activeScript, setActiveScript] = useState<ScriptItem | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit Section Modal
  const [editingSection, setEditingSection] = useState<ScriptSection | null>(null);
  const [editSectionIndex, setEditSectionIndex] = useState<number>(-1);
  const [sectionFormData, setSectionFormData] = useState<Partial<ScriptSection>>({});

  // Regeneration Modal
  const [regenPreview, setRegenPreview] = useState<ScriptRegenerationPreview | null>(null);
  const [regenModalOpen, setRegenModalOpen] = useState<boolean>(false);
  const [confirmingRegen, setConfirmingRegen] = useState<boolean>(false);

  // Load scripts & approved video plans
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [scriptList, planList] = await Promise.all([
        api.listScripts(),
        api.listVideoPlans({ status: 'APPROVED' })
      ]);
      setScripts(scriptList);
      setVideoPlans(planList);

      // Select initial script or plan if available
      if (initialVideoId) {
        const found = scriptList.find(s => s.video_id === initialVideoId || s.id === initialVideoId);
        if (found) {
          setActiveScript(found);
          setSelectedVideoId(found.video_id);
        } else {
          // If video plan is approved but no script generated yet
          setSelectedVideoId(initialVideoId);
        }
      } else if (scriptList.length > 0) {
        setActiveScript(scriptList[0]);
        setSelectedVideoId(scriptList[0].video_id);
      } else if (planList.length > 0) {
        setSelectedVideoId(planList[0].id);
      }
    } catch (err: any) {
      setActionError(err.message || 'Unable to load approved video plans and educational scripts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [initialVideoId]);

  // When selected video changes
  const handleSelectVideo = async (videoId: number | '') => {
    setSelectedVideoId(videoId);
    setActionError(null);
    setActionSuccess(null);
    if (!videoId) {
      setActiveScript(null);
      return;
    }

    const existing = scripts.find(s => s.video_id === Number(videoId) || s.id === Number(videoId));
    if (existing) {
      setActiveScript(existing);
    } else {
      try {
        const detail = await api.getVideoPlanScript(Number(videoId));
        setActiveScript(detail);
      } catch {
        setActiveScript(null);
      }
    }
  };

  // Generate Script
  const handleGenerateScript = async (force: boolean = false) => {
    if (!selectedVideoId) return;
    try {
      setGenerating(true);
      setActionError(null);
      setActionSuccess(null);
      const script = await api.generateVideoScript(Number(selectedVideoId), force);
      setActiveScript(script);
      setActionSuccess(`Educational script generated successfully (${script.word_count} words)!`);
      // Refresh list
      const updated = await api.listScripts();
      setScripts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Script generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // Safe Regeneration Preview
  const handlePreviewRegenerate = async () => {
    if (!activeScript) return;
    try {
      setGenerating(true);
      setActionError(null);
      const preview = await api.regenerateScriptPreview(activeScript.video_id);
      setRegenPreview(preview);
      setRegenModalOpen(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate regeneration preview');
    } finally {
      setGenerating(false);
    }
  };

  // Confirm Regeneration
  const handleConfirmRegenerate = async () => {
    if (!activeScript) return;
    try {
      setConfirmingRegen(true);
      const newScript = await api.regenerateScriptConfirmed(activeScript.video_id);
      setActiveScript(newScript);
      setRegenModalOpen(false);
      setActionSuccess(`Script regenerated and updated to version ${newScript.version_number}!`);
      const updated = await api.listScripts();
      setScripts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to replace script with regenerated version');
    } finally {
      setConfirmingRegen(false);
    }
  };

  // Approve Script
  const handleApproveScript = async () => {
    if (!activeScript) return;
    try {
      setActionError(null);
      const approved = await api.approveScript(activeScript.video_id);
      setActiveScript(approved);
      setActionSuccess(`Script approved! Video is now READY_FOR_VIDEO_GENERATION.`);
      const updated = await api.listScripts();
      setScripts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve script');
    }
  };

  // Open Edit Section Modal
  const openEditSection = (section: ScriptSection, index: number) => {
    setEditingSection(section);
    setEditSectionIndex(index);
    setSectionFormData({ ...section });
  };

  // Save Section Edit
  const handleSaveSection = async () => {
    if (!activeScript || editSectionIndex < 0) return;
    const updatedSections = [...activeScript.sections];
    updatedSections[editSectionIndex] = {
      ...updatedSections[editSectionIndex],
      ...sectionFormData,
    } as ScriptSection;

    try {
      const patched = await api.patchScript(activeScript.video_id, {
        sections: updatedSections,
      });
      setActiveScript(patched);
      setEditingSection(null);
      setActionSuccess(`Section #${editSectionIndex + 1} updated and draft saved.`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save section update');
    }
  };

  const selectedPlan = videoPlans.find(p => p.id === Number(selectedVideoId));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const bannerMessage = actionSuccess
    ? { text: actionSuccess, type: 'success' as const }
    : actionError
    ? { text: actionError, type: 'error' as const }
    : null;

  const isScriptApproved = activeScript?.script_status === 'SCRIPT_APPROVED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '60px' }}>
      <PageHeader
        title="Educational Script Review & Verification"
        description="Ground narration scripts in approved video plans and extracted textbook pages."
      />

      <MessageBanner
        message={bannerMessage}
        onDismiss={() => {
          setActionSuccess(null);
          setActionError(null);
        }}
      />

      {/* Control Bar */}
      <SurfacePanel title="Select Video Plan">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <select
            className="adm-select"
            value={selectedVideoId}
            onChange={(e) => handleSelectVideo(e.target.value ? Number(e.target.value) : '')}
            style={{ flex: '1 1 280px', maxWidth: '420px' }}
            aria-label="Choose approved video plan"
          >
            <option value="">-- Choose Approved Video Plan --</option>
            {videoPlans.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.sequence_number}: {p.title} ({formatDuration(p.estimated_duration_seconds || p.duration_seconds)})
              </option>
            ))}
          </select>

          {!activeScript && selectedVideoId && (
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => handleGenerateScript(false)}
              disabled={generating}
            >
              {generating ? <Loader2 size={15} /> : <Sparkles size={15} />}
              {generating ? 'Generating Script...' : 'Generate AI Script'}
            </button>
          )}

          {activeScript && (
            <>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={handlePreviewRegenerate}
                disabled={generating}
              >
                <RefreshCw size={15} />
                Regenerate Preview
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={handleApproveScript}
                disabled={isScriptApproved}
              >
                {isScriptApproved ? <Check size={15} /> : <ShieldCheck size={15} />}
                {isScriptApproved ? 'Script Approved' : 'Approve Script'}
              </button>
            </>
          )}
        </div>
      </SurfacePanel>

      {loading ? (
        <SurfacePanel>
          <LoadingState variant="table" rows={5} label="Loading scripts and approved video plans…" />
        </SurfacePanel>
      ) : (
        <>
          {/* 10-Point Approved Video Plan Context Card */}
          {selectedPlan && (
            <SurfacePanel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--admin-border)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                    >
                      Approved Video Plan Context
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                      Plan #{selectedPlan.sequence_number || selectedPlan.id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Approval Status:</span>
                    <StatusBadge status={selectedPlan.status} />
                  </div>
                </div>

                <WorkflowStepper
                  steps={PIPELINE_STEPS}
                  currentStep={isScriptApproved ? 5 : 4}
                  compact
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Subject</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginTop: '2px' }}>{selectedPlan.subject_name || 'Subject'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Chapter</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginTop: '2px' }}>{selectedPlan.chapter_title || 'Chapter'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Topic</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginTop: '2px' }}>{selectedPlan.topic_title || 'Topic'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Subtopic</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginTop: '2px' }}>{selectedPlan.subtopic_title || 'None'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Video Title</span>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginTop: '2px' }}>{selectedPlan.title}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Target Duration</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-success)', marginTop: '2px' }}>{formatDuration(selectedPlan.estimated_duration_seconds || selectedPlan.duration_seconds)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Source Textbook Pages</span>
                    <div style={{ fontWeight: 600, color: 'var(--admin-primary)', marginTop: '2px' }}>
                      {selectedPlan.source_start_page != null ? `Pages ${selectedPlan.source_start_page} – ${selectedPlan.source_end_page || selectedPlan.source_start_page}` : 'Pages N/A'}
                    </div>
                  </div>
                </div>

                {selectedPlan.learning_objective && (
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--admin-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Learning Objective: </span>
                    <span style={{ color: 'var(--admin-text)' }}>{selectedPlan.learning_objective}</span>
                  </div>
                )}

                {selectedPlan.content_outline && selectedPlan.content_outline.length > 0 && (
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Content Outline: </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {selectedPlan.content_outline.map((item, i) => (
                        <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '11px' }}>
                          {i + 1}. {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SurfacePanel>
          )}

          {/* Script Details Card */}
          {activeScript ? (
            <>
              <SurfacePanel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span
                          className="adm-badge"
                          style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' }}
                        >
                          Version {activeScript.version_number}
                        </span>
                        <span
                          className="adm-badge"
                          style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                        >
                          Engine: {activeScript.generation_engine}
                        </span>
                        <StatusBadge status={activeScript.script_status} />
                      </div>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--admin-text)' }}>
                        {activeScript.title}
                      </h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                        Target Duration: {formatDuration(activeScript.estimated_duration_seconds)} | Target Words: ~{activeScript.target_words} | Actual Words: {activeScript.word_count}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: activeScript.quality_score >= 80 ? 'var(--admin-success-soft)' : 'var(--admin-warning-soft)',
                          border: `1px solid ${activeScript.quality_score >= 80 ? '#BBF7D0' : '#FDE68A'}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: activeScript.quality_score >= 80 ? 'var(--admin-success)' : 'var(--admin-warning)',
                          }}
                        >
                          Quality Score
                        </div>
                        <div
                          style={{
                            fontSize: '20px',
                            fontWeight: 800,
                            color: activeScript.quality_score >= 80 ? 'var(--admin-success)' : 'var(--admin-warning)',
                          }}
                        >
                          {activeScript.quality_score}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quality Breakdown Metrics */}
                  {activeScript.quality_breakdown && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--admin-border)' }}>
                      {Object.entries(activeScript.quality_breakdown).map(([k, v]) => (
                        <div key={k} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>
                            {k.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '2px' }}>
                            {v}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings if any */}
                  {activeScript.warnings && activeScript.warnings.length > 0 && (
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--admin-warning-soft)', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--admin-warning)' }}>
                      <strong>Validation Notices:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {activeScript.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </SurfacePanel>

              {/* Section by Section Display */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--admin-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ScrollText size={17} style={{ color: 'var(--admin-text-secondary)' }} />
                  Script Narration & Visual Cue Storyboard ({activeScript.sections.length} Sections)
                </h3>

                {activeScript.sections.map((section, idx) => {
                  const tone = getSectionTone(section.type);
                  return (
                    <SurfacePanel key={section.section_id || idx}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
                            <span
                              className="adm-badge"
                              style={{ backgroundColor: tone.bg, color: tone.color }}
                            >
                              {section.type}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                              #{idx + 1}: {section.title}
                            </span>
                            {section.source_pages && section.source_pages.length > 0 && (
                              <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', backgroundColor: 'var(--admin-surface-raised)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                                Pages {section.source_pages.join(', ')}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            onClick={() => openEditSection(section, idx)}
                          >
                            <Pencil size={13} />
                            Edit Section
                          </button>
                        </div>

                        {/* Narration Box */}
                        <div style={{ padding: '12px', backgroundColor: 'var(--admin-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)', fontSize: '14px', lineHeight: 1.6, color: 'var(--admin-text)' }}>
                          <strong>Spoken Narration:</strong>
                          <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap' }}>{section.narration}</p>
                        </div>

                        {/* Visual Cues & Renderer Instructions */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12px' }}>
                          <div style={{ padding: '10px 12px', backgroundColor: 'var(--admin-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Visual Type: </span>
                            <strong style={{ color: 'var(--admin-text)' }}>{section.visual_type || 'DIAGRAM'}</strong>
                            {section.visual_description && (
                              <p style={{ margin: '4px 0 0 0', color: 'var(--admin-text)' }}>{section.visual_description}</p>
                            )}
                          </div>

                          {section.on_screen_text && (
                            <div style={{ padding: '10px 12px', backgroundColor: 'var(--admin-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>On-Screen Text: </span>
                              <pre style={{ margin: '4px 0 0 0', color: 'var(--admin-text)', fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace", fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                {section.on_screen_text}
                              </pre>
                            </div>
                          )}

                          {section.formula && (
                            <div style={{ padding: '10px 12px', backgroundColor: 'var(--admin-primary-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)' }}>
                              <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Formula / Mathematical Expression: </span>
                              <div style={{ margin: '4px 0 0 0', color: 'var(--admin-primary)', fontWeight: 700, fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace", fontSize: '13px' }}>
                                {section.formula}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </SurfacePanel>
                  );
                })}
              </div>
            </>
          ) : selectedVideoId ? (
            <SurfacePanel>
              <EmptyState
                icon={<ScrollText size={20} />}
                title="No Educational Script Generated Yet"
                description={`Video plan #${selectedPlan?.sequence_number || selectedVideoId} is approved and ready for grounded AI script generation.`}
                action={
                  <button
                    type="button"
                    className="adm-btn adm-btn-primary"
                    onClick={() => handleGenerateScript(false)}
                    disabled={generating}
                  >
                    {generating ? <Loader2 size={15} /> : <Sparkles size={15} />}
                    {generating ? 'Generating Grounded Script...' : 'Generate Educational Script Now'}
                  </button>
                }
              />
            </SurfacePanel>
          ) : (
            <SurfacePanel>
              <EmptyState
                icon={<ScrollText size={20} />}
                title="Select a video plan"
                description="Please select an approved video plan above to review or generate educational narration scripts."
              />
            </SurfacePanel>
          )}
        </>
      )}

      {/* Edit Section Modal */}
      <Modal
        open={!!editingSection}
        onClose={() => setEditingSection(null)}
        title={editingSection ? `Edit Section #${editSectionIndex + 1}: ${editingSection.title}` : 'Edit Section'}
        maxWidth={640}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditingSection(null)}>
              Cancel
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSaveSection}>
              Save Changes
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="adm-label" htmlFor="section-title">Section Title</label>
            <input
              id="section-title"
              className="adm-input"
              type="text"
              value={sectionFormData.title || ''}
              onChange={(e) => setSectionFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="adm-label" htmlFor="section-narration">Spoken Narration</label>
            <textarea
              id="section-narration"
              className="adm-textarea"
              rows={6}
              value={sectionFormData.narration || ''}
              onChange={(e) => setSectionFormData(prev => ({ ...prev, narration: e.target.value }))}
            />
          </div>

          <div>
            <label className="adm-label" htmlFor="section-visual-description">Visual Description (Renderer Hint)</label>
            <input
              id="section-visual-description"
              className="adm-input"
              type="text"
              value={sectionFormData.visual_description || ''}
              onChange={(e) => setSectionFormData(prev => ({ ...prev, visual_description: e.target.value }))}
            />
          </div>

          <div>
            <label className="adm-label" htmlFor="section-on-screen-text">On-Screen Text</label>
            <input
              id="section-on-screen-text"
              className="adm-input"
              type="text"
              value={sectionFormData.on_screen_text || ''}
              onChange={(e) => setSectionFormData(prev => ({ ...prev, on_screen_text: e.target.value }))}
            />
          </div>

          <div>
            <label className="adm-label" htmlFor="section-formula">Formula / Equation (Optional)</label>
            <input
              id="section-formula"
              className="adm-input"
              type="text"
              value={sectionFormData.formula || ''}
              onChange={(e) => setSectionFormData(prev => ({ ...prev, formula: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Safe Regeneration Comparison Modal */}
      <Modal
        open={regenModalOpen && !!regenPreview}
        onClose={() => setRegenModalOpen(false)}
        title="Safe Script Regeneration Preview"
        subtitle="Compare current active script against the newly generated candidate before confirming replacement."
        maxWidth={800}
        footer={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={() => setRegenModalOpen(false)}
              disabled={confirmingRegen}
            >
              Cancel / Keep Current
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleConfirmRegenerate}
              disabled={confirmingRegen}
            >
              {confirmingRegen ? 'Replacing...' : 'Confirm & Replace Script'}
            </button>
          </>
        }
      >
        {regenPreview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                Current Script (v{regenPreview.comparison.current_version || 1})
              </h4>
              <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Words: <strong style={{ color: 'var(--admin-text)' }}>{regenPreview.comparison.current_word_count}</strong></div>
                <div>Quality Score: <strong style={{ color: 'var(--admin-text)' }}>{regenPreview.comparison.current_quality_score}/100</strong></div>
                <div>Sections: <strong style={{ color: 'var(--admin-text)' }}>{regenPreview.comparison.current_section_count}</strong></div>
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--admin-primary-soft)', border: '1px solid var(--admin-primary)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                New Candidate Script (v{regenPreview.comparison.new_version})
              </h4>
              <div style={{ fontSize: '13px', color: 'var(--admin-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Words: <strong>{regenPreview.comparison.new_word_count}</strong></div>
                <div>Quality Score: <strong>{regenPreview.comparison.new_quality_score}/100</strong></div>
                <div>Sections: <strong>{regenPreview.comparison.new_section_count}</strong></div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
