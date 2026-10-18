import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
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

  const getSectionColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'INTRO': return '#3b82f6';
      case 'OBJECTIVE': return '#8b5cf6';
      case 'CONCEPT': return '#10b981';
      case 'FORMULA': return '#ec4899';
      case 'DETAILED_EXPLANATION': return '#06b6d4';
      case 'EXAMPLE': return '#f59e0b';
      case 'SUMMARY': return '#6366f1';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px' }}>
      {/* Top Banner & Control Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--admin-text)' }}>
              Educational Script Review & Verification
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
              Ground narration scripts in approved video plans and extracted textbook pages.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
              Video Plan:
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => handleSelectVideo(e.target.value ? Number(e.target.value) : '')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface)',
                color: 'var(--admin-text)',
                fontSize: '13px',
                minWidth: '280px'
              }}
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
                onClick={() => handleGenerateScript(false)}
                disabled={generating}
                style={{
                  backgroundColor: 'var(--primary-color, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {generating ? '⏳ Generating Script...' : '✨ Generate AI Script'}
              </button>
            )}

            {activeScript && (
              <>
                <button
                  onClick={handlePreviewRegenerate}
                  disabled={generating}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  🔄 Regenerate Preview
                </button>
                <button
                  onClick={handleApproveScript}
                  disabled={activeScript.script_status === 'SCRIPT_APPROVED'}
                  style={{
                    backgroundColor: activeScript.script_status === 'SCRIPT_APPROVED' ? '#059669' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: activeScript.script_status === 'SCRIPT_APPROVED' ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {activeScript.script_status === 'SCRIPT_APPROVED' ? '✓ Script Approved' : '🛡️ Approve Script'}
                </button>
              </>
            )}
          </div>
        </div>

        {actionSuccess && (
          <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px', color: '#10b981', fontSize: '13px' }}>
            ✓ {actionSuccess}
          </div>
        )}

        {actionError && (
          <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '13px' }}>
            ⚠️ {actionError}
          </div>
        )}
      </SurfacePanel>

      {/* 10-Point Approved Video Plan Context Card */}
      {selectedPlan && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
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
                <div style={{ fontWeight: 600, color: '#10b981', marginTop: '2px' }}>{formatDuration(selectedPlan.estimated_duration_seconds || selectedPlan.duration_seconds)}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Source Textbook Pages</span>
                <div style={{ fontWeight: 600, color: '#3b82f6', marginTop: '2px' }}>
                  {selectedPlan.source_start_page != null ? `Pages ${selectedPlan.source_start_page} – ${selectedPlan.source_end_page || selectedPlan.source_start_page}` : 'Pages N/A'}
                </div>
              </div>
            </div>

            {selectedPlan.learning_objective && (
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--admin-bg)', borderRadius: '6px', border: '1px solid var(--admin-border)', fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Learning Objective: </span>
                <span style={{ color: 'var(--admin-text)' }}>{selectedPlan.learning_objective}</span>
              </div>
            )}

            {selectedPlan.content_outline && selectedPlan.content_outline.length > 0 && (
              <div style={{ fontSize: '12px' }}>
                <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Content Outline: </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {selectedPlan.content_outline.map((item, i) => (
                    <span key={i} style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '11px' }}>
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
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
                      Version {activeScript.version_number}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                  <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: activeScript.quality_score >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${activeScript.quality_score >= 80 ? '#10b981' : '#f59e0b'}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: activeScript.quality_score >= 80 ? '#10b981' : '#f59e0b' }}>
                      Quality Score
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: activeScript.quality_score >= 80 ? '#10b981' : '#f59e0b' }}>
                      {activeScript.quality_score}/100
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality Breakdown Metrics */}
              {activeScript.quality_breakdown && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--admin-border)' }}>
                  {Object.entries(activeScript.quality_breakdown).map(([k, v]) => (
                    <div key={k} style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
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
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '12px', color: '#f59e0b' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--admin-text)' }}>
              Script Narration & Visual Cue Storyboard ({activeScript.sections.length} Sections)
            </h3>

            {activeScript.sections.map((section, idx) => (
              <SurfacePanel key={section.section_id || idx}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          backgroundColor: getSectionColor(section.type),
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      >
                        {section.type}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--admin-text)' }}>
                        #{idx + 1}: {section.title}
                      </span>
                      {section.source_pages && section.source_pages.length > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', backgroundColor: 'var(--admin-border)', padding: '2px 6px', borderRadius: '4px' }}>
                          Pages {section.source_pages.join(', ')}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => openEditSection(section, idx)}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--admin-border)',
                        color: 'var(--admin-text)',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit Section
                    </button>
                  </div>

                  {/* Narration Box */}
                  <div style={{ padding: '12px', backgroundColor: 'var(--admin-bg)', borderRadius: '6px', border: '1px solid var(--admin-border)', fontSize: '14px', lineHeight: 1.6, color: 'var(--admin-text)' }}>
                    <strong>Spoken Narration:</strong>
                    <p style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap' }}>{section.narration}</p>
                  </div>

                  {/* Visual Cues & Renderer Instructions */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12px' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--admin-surface)', borderRadius: '6px', border: '1px solid var(--admin-border)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>Visual Type: </span>
                      <strong style={{ color: 'var(--admin-text)' }}>{section.visual_type || 'DIAGRAM'}</strong>
                      {section.visual_description && (
                        <p style={{ margin: '4px 0 0 0', color: 'var(--admin-text)' }}>{section.visual_description}</p>
                      )}
                    </div>

                    {section.on_screen_text && (
                      <div style={{ padding: '8px 12px', backgroundColor: 'var(--admin-surface)', borderRadius: '6px', border: '1px solid var(--admin-border)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text-secondary)' }}>On-Screen Text: </span>
                        <pre style={{ margin: '4px 0 0 0', color: 'var(--admin-text)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {section.on_screen_text}
                        </pre>
                      </div>
                    )}

                    {section.formula && (
                      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(236, 72, 153, 0.08)', borderRadius: '6px', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                        <span style={{ fontWeight: 600, color: '#ec4899' }}>Formula / Mathematical Expression: </span>
                        <div style={{ margin: '4px 0 0 0', color: '#ec4899', fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>
                          {section.formula}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SurfacePanel>
            ))}
          </div>
        </>
      ) : selectedVideoId ? (
        <SurfacePanel>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)' }}>
              No Educational Script Generated Yet
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', maxWidth: '480px', margin: '8px auto 20px auto' }}>
              Video plan #{selectedPlan?.sequence_number || selectedVideoId} is approved and ready for grounded AI script generation.
            </p>
            <button
              onClick={() => handleGenerateScript(false)}
              disabled={generating}
              style={{
                backgroundColor: 'var(--primary-color, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              {generating ? '⏳ Generating Grounded Script...' : '✨ Generate Educational Script Now'}
            </button>
          </div>
        </SurfacePanel>
      ) : (
        <SurfacePanel>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--admin-text-secondary)', fontSize: '14px' }}>
            Please select an approved video plan above to review or generate educational narration scripts.
          </div>
        </SurfacePanel>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: '8px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', border: '1px solid var(--admin-border)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
              Edit Section #{editSectionIndex + 1}: {editingSection.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--admin-text)' }}>Section Title</label>
                <input
                  type="text"
                  value={sectionFormData.title || ''}
                  onChange={(e) => setSectionFormData(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--admin-text)' }}>Spoken Narration</label>
                <textarea
                  rows={6}
                  value={sectionFormData.narration || ''}
                  onChange={(e) => setSectionFormData(prev => ({ ...prev, narration: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)', fontSize: '13px', lineHeight: 1.5 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--admin-text)' }}>Visual Description (Renderer Hint)</label>
                <input
                  type="text"
                  value={sectionFormData.visual_description || ''}
                  onChange={(e) => setSectionFormData(prev => ({ ...prev, visual_description: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--admin-text)' }}>On-Screen Text</label>
                <input
                  type="text"
                  value={sectionFormData.on_screen_text || ''}
                  onChange={(e) => setSectionFormData(prev => ({ ...prev, on_screen_text: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--admin-text)' }}>Formula / Equation (Optional)</label>
                <input
                  type="text"
                  value={sectionFormData.formula || ''}
                  onChange={(e) => setSectionFormData(prev => ({ ...prev, formula: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)', color: 'var(--admin-text)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setEditingSection(null)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'transparent', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSection}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary-color, #2563eb)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Regeneration Comparison Modal */}
      {regenModalOpen && regenPreview && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', border: '1px solid var(--admin-border)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
              Safe Script Regeneration Preview
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
              Compare current active script against the newly generated candidate before confirming replacement.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '14px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  Current Script (v{regenPreview.comparison.current_version || 1})
                </h4>
                <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Words: <strong>{regenPreview.comparison.current_word_count}</strong></div>
                  <div>Quality Score: <strong>{regenPreview.comparison.current_quality_score}/100</strong></div>
                  <div>Sections: <strong>{regenPreview.comparison.current_section_count}</strong></div>
                </div>
              </div>

              <div style={{ padding: '14px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>
                  New Candidate Script (v{regenPreview.comparison.new_version})
                </h4>
                <div style={{ fontSize: '13px', color: 'var(--admin-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Words: <strong>{regenPreview.comparison.new_word_count}</strong></div>
                  <div>Quality Score: <strong>{regenPreview.comparison.new_quality_score}/100</strong></div>
                  <div>Sections: <strong>{regenPreview.comparison.new_section_count}</strong></div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setRegenModalOpen(false)}
                disabled={confirmingRegen}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--admin-border)', backgroundColor: 'transparent', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel / Keep Current
              </button>
              <button
                onClick={handleConfirmRegenerate}
                disabled={confirmingRegen}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {confirmingRegen ? 'Replacing...' : '✓ Confirm & Replace Script'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
