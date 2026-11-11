import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { Textbook, SubjectItem, TextbookHierarchy, PipelineStatus } from '../../lib/types';

interface AdminVideoStudioProps {
  onNavigate: (route: string, params?: any) => void;
  initialTextbookId?: number;
}

interface QueuedUploadItem {
  id: string;
  file: File;
  title: string;
  subjectId?: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  textbookId?: number;
  progressMessage?: string;
  stage?: number;
}

export const AdminVideoStudio: React.FC<AdminVideoStudioProps> = ({ onNavigate, initialTextbookId }) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [fastTrack, setFastTrack] = useState<boolean>(true);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  
  // Multi-upload queue state
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadItem[]>([]);
  const [activeTextbookId, setActiveTextbookId] = useState<number | null>(initialTextbookId || null);
  const [activeTextbook, setActiveTextbook] = useState<Textbook | null>(null);
  
  // Pipeline & Hierarchy state
  const [hierarchy, setHierarchy] = useState<TextbookHierarchy | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);
  const [publishedVideoList, setPublishedVideoList] = useState<any[]>([]);

  // Load subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.listSubjects();
        const list = res.items || [];
        setSubjects(list);
        if (list.length > 0 && selectedSubjectId === '') {
          setSelectedSubjectId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    };
    fetchSubjects();
  }, []);

  // Load active textbook if specified
  useEffect(() => {
    if (activeTextbookId) {
      loadActiveTextbookData(activeTextbookId);
    }
  }, [activeTextbookId]);

  const loadActiveTextbookData = async (id: number) => {
    try {
      setLoading(true);
      const [tb, hier, status] = await Promise.all([
        api.getTextbook(id).catch(() => null),
        api.getTextbookHierarchy(id).catch(() => null),
        api.getPipelineStatus(id).catch(() => null),
      ]);
      if (tb) setActiveTextbook(tb);
      if (hier) setHierarchy(hier);
      if (status) setPipelineStatus(status);

      // Check if textbook is already completed/approved
      if (tb?.status === 'APPROVED' || tb?.status === 'PUBLISHED' || status?.pipeline_status === 'completed') {
        setActiveStep(5);
      }
    } catch (err) {
      console.error('Error loading textbook details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll pipeline progress if active textbook is currently processing
  useEffect(() => {
    if (!activeTextbookId) return;
    if (pipelineStatus?.pipeline_status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getPipelineStatus(activeTextbookId);
        setPipelineStatus(status);

        if (status.pipeline_status === 'completed') {
          clearInterval(interval);
          const hier = await api.getTextbookHierarchy(activeTextbookId);
          setHierarchy(hier);
          if (fastTrack) {
            setActiveStep(5); // Auto-advance straight to consolidated review!
          }
        }
      } catch (e) {
        console.error('Error polling pipeline status:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTextbookId, pipelineStatus?.pipeline_status, fastTrack]);

  // Handle multi-file selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: QueuedUploadItem[] = Array.from(files)
      .filter((file) => file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        subjectId: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        status: 'pending',
      }));

    setQueuedFiles((prev) => [...prev, ...newItems]);
  };

  // Remove queued file
  const removeQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Start batch upload & automatically run pipeline for each file
  const handleUploadAndRunAll = async () => {
    if (queuedFiles.length === 0) return;

    setLoading(true);
    for (let i = 0; i < queuedFiles.length; i++) {
      const item = queuedFiles[i];
      if (item.status === 'completed') continue;

      try {
        // Update item state to uploading
        setQueuedFiles((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', progressMessage: 'Uploading PDF to server...' } : it))
        );

        // Upload PDF
        const uploaded = await api.uploadTextbook(
          item.file,
          item.title,
          item.subjectId || (selectedSubjectId ? Number(selectedSubjectId) : undefined)
        );

        // Update item with textbookId and trigger pipeline automatically
        setQueuedFiles((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, textbookId: uploaded.id, status: 'processing', progressMessage: 'AI Pipeline triggered (Stages 1–5)...' }
              : it
          )
        );

        // Auto-trigger pipeline
        await api.triggerPipeline(uploaded.id);

        // Set as active textbook for real-time tracking
        setActiveTextbookId(uploaded.id);
        setActiveTextbook(uploaded);

        // Update item state
        setQueuedFiles((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: 'processing', progressMessage: 'Synthesizing real topics & videos...' }
              : it
          )
        );
      } catch (err: any) {
        setQueuedFiles((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'error', progressMessage: err.message || 'Upload failed' } : it
          )
        );
      }
    }
    setLoading(false);
  };

  // Step 5: Final One-Click Consolidated Publish
  const handleFinalPublish = async () => {
    if (!activeTextbookId) return;
    try {
      setPublishing(true);
      await api.approveTextbookCurriculum(activeTextbookId);
      setPublishSuccess(true);
      await loadActiveTextbookData(activeTextbookId);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const steps = [
    { number: 1, title: 'Upload & Queue', subtitle: 'Batch PDF Ingestion' },
    { number: 2, title: 'Curriculum Review', subtitle: 'Chapters & Real Topics' },
    { number: 3, title: 'Video Plans', subtitle: '5-Min Topic Segments' },
    { number: 4, title: 'Scripts & Narration', subtitle: 'Narration & Audio' },
    { number: 5, title: 'Review & Publish', subtitle: 'Consolidated Approval' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Header & Fast Track Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
              ⚡ Video Creation Studio
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#818CF8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              One-Flow Pipeline
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Upload textbooks, extract actual topics directly from your PDF content, and synthesize video lessons one after another.
          </p>
        </div>

        {/* Fast-Track Auto-Advance Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            backgroundColor: fastTrack ? 'rgba(16, 185, 129, 0.1)' : 'var(--admin-surface)',
            border: `1px solid ${fastTrack ? '#10B981' : 'var(--admin-border)'}`,
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setFastTrack(!fastTrack)}
        >
          <input
            type="checkbox"
            checked={fastTrack}
            onChange={(e) => setFastTrack(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: fastTrack ? '#10B981' : 'var(--admin-text)' }}>
              ⚡ Auto-Advance (Fast-Track)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
              {fastTrack ? 'Auto-runs all 5 stages straight to Final Review' : 'Manual step-by-step confirmation'}
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          {steps.map((st) => {
            const isCompleted = activeStep > st.number;
            const isCurrent = activeStep === st.number;
            return (
              <div
                key={st.number}
                onClick={() => {
                  if (activeTextbookId || st.number === 1) setActiveStep(st.number);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: activeTextbookId || st.number === 1 ? 'pointer' : 'not-allowed',
                  opacity: activeTextbookId || st.number === 1 ? 1 : 0.5,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#10B981' : isCurrent ? '#3B82F6' : '#1E293B',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: isCurrent ? '2px solid #60A5FA' : '1px solid #334155',
                  }}
                >
                  {isCompleted ? '✓' : st.number}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isCurrent ? '#60A5FA' : 'var(--admin-text)' }}>
                    {st.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>{st.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </SurfacePanel>

      {/* STEP 1: Upload & Queue */}
      {activeStep === 1 && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)' }}>
                  1. Select & Upload Textbook PDF(s)
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Select one or multiple files. The 6-stage extraction and video pipeline will execute automatically for each.
                </p>
              </div>

              {/* Subject Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Subject:</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.class ? `(Class ${s.class})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              style={{
                border: '2px dashed var(--admin-border)',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.01)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('studio-file-input')?.click()}
            >
              <input
                id="studio-file-input"
                type="file"
                multiple
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFilesSelected}
              />
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📚</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>
                Click to browse or drag & drop textbook PDFs here
              </div>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                Supports single or multiple textbooks simultaneously (Up to 100MB per file)
              </div>
            </div>

            {/* Queued Items List */}
            {queuedFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>
                  Selected Files for Ingestion ({queuedFiles.length}):
                </h3>
                {queuedFiles.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px' }}>📄</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB • {item.progressMessage || 'Ready to process'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.status === 'processing' && (
                        <span style={{ fontSize: '12px', color: '#60A5FA', fontWeight: 600 }}>
                          ⚙️ Synthesizing Curriculum...
                        </span>
                      )}
                      {item.status === 'completed' && (
                        <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                          ✓ Completed
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <button
                          onClick={() => removeQueuedFile(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleUploadAndRunAll}
                  disabled={loading}
                  style={{
                    marginTop: '10px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#3B82F6',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>{loading ? 'Processing Queue...' : '🚀 Upload & Run 6-Stage Pipeline for All'}</span>
                </button>
              </div>
            )}

            {/* Currently Processing Textbook Monitor */}
            {activeTextbookId && pipelineStatus && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#60A5FA', fontSize: '14px' }}>
                      Active Extraction: #{activeTextbookId} {activeTextbook?.title || 'Textbook'}
                    </div>
                    <StatusBadge status={pipelineStatus.pipeline_status} />
                  </div>
                  <button
                    onClick={() => setActiveStep(2)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#3B82F6',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View Real Curriculum Hierarchy →
                  </button>
                </div>

                {/* Stages progress bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {[
                    { num: 1, name: 'PDF Ingestion & OCR' },
                    { num: 2, name: 'Topic Extraction' },
                    { num: 3, name: '5-Min Segmentation' },
                    { num: 4, name: 'Script & Video' },
                    { num: 5, name: 'Quiz Generation' },
                  ].map((s) => {
                    const stLog = pipelineStatus.stages.find((x) => x.stage === s.num);
                    const isDone = stLog?.status === 'completed';
                    return (
                      <div
                        key={s.num}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          backgroundColor: isDone ? 'rgba(16, 185, 129, 0.2)' : 'var(--admin-bg)',
                          border: `1px solid ${isDone ? '#10B981' : 'var(--admin-border)'}`,
                          fontSize: '11px',
                          textAlign: 'center',
                          color: isDone ? '#34D399' : 'var(--admin-text-secondary)',
                          fontWeight: isDone ? 700 : 500,
                        }}
                      >
                        {isDone ? '✓ ' : `${s.num}. `}
                        {s.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SurfacePanel>
      )}

      {/* STEP 2: Curriculum Review (Real PDF Extracted Hierarchy) */}
      {activeStep === 2 && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  2. Extracted Textbook Curriculum
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Chapters, topics, and subtopics parsed directly from your uploaded document.
                </p>
              </div>
              <button
                onClick={() => setActiveStep(3)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Confirm Curriculum & View Video Plans →
              </button>
            </div>

            {hierarchy?.chapters && hierarchy.chapters.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {hierarchy.chapters.map((ch) => (
                  <div
                    key={ch.id}
                    style={{
                      border: '1px solid var(--admin-border)',
                      borderRadius: '10px',
                      padding: '16px',
                      backgroundColor: 'var(--admin-bg)',
                    }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#818CF8', marginBottom: '8px' }}>
                      📑 Chapter {ch.chapter_number}: {ch.title}
                    </div>
                    {ch.description && (
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '12px' }}>
                        {ch.description}
                      </div>
                    )}

                    {/* Topics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '16px' }}>
                      {ch.topics?.map((top) => (
                        <div
                          key={top.id}
                          style={{
                            borderLeft: '2px solid #3B82F6',
                            paddingLeft: '12px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>
                            🏷️ Topic {top.sequence_number}: {top.title}
                          </div>
                          {top.description && (
                            <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                              {top.description}
                            </div>
                          )}

                          {/* Subtopics */}
                          {top.subtopics && top.subtopics.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                              {top.subtopics.map((sub) => (
                                <span
                                  key={sub.id}
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: '#93C5FD',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                  }}
                                >
                                  🔹 {sub.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                {loading ? 'Loading extracted hierarchy...' : 'No hierarchy found. Please run the pipeline first.'}
              </div>
            )}
          </div>
        </SurfacePanel>
      )}

      {/* STEP 3: Video Plans */}
      {activeStep === 3 && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  3. Topic-Aligned Video Plans (~5.5 Min Units)
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Micro-learning video segmentations derived dynamically from your curriculum complexity.
                </p>
              </div>
              <button
                onClick={() => setActiveStep(4)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Confirm Video Plans & View Narration Scripts →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {hierarchy?.chapters?.flatMap((c) => c.topics || []).map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase' }}>
                    Topic Video Unit #{idx + 1}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginTop: '4px' }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '6px' }}>
                    ⏱ Target Duration: ~5.5 mins • {t.subtopics?.length || 2} Concept Modules
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SurfacePanel>
      )}

      {/* STEP 4: Scripts & Voice */}
      {activeStep === 4 && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  4. Generated Educational Narration Scripts
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Narration text grounded in real definitions from your uploaded PDF text.
                </p>
              </div>
              <button
                onClick={() => setActiveStep(5)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#3B82F6',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Proceed to Consolidated Review & Publish →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hierarchy?.chapters?.flatMap((c) => c.topics || []).slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#818CF8' }}>
                    🎙️ Narration Script: {t.title}
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      color: 'var(--admin-text)',
                      lineHeight: 1.6,
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      padding: '12px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    Welcome to this video lesson on {t.title}. {t.description || 'Core study of the algorithmic concept.'} Key
                    subtopics analyzed include: {t.subtopics?.map((s) => s.title).join(', ')}.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SurfacePanel>
      )}

      {/* STEP 5: Final Consolidated Review & 1-Click Publish */}
      {activeStep === 5 && (
        <SurfacePanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {publishSuccess && (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  color: '#34D399',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>🎉 Successfully Published to Students!</div>
                  <div style={{ fontSize: '13px', marginTop: '2px', color: '#A7F3D0' }}>
                    All chapters, video lessons, and topic quizzes are now active and visible on the student learning portal.
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('student-dashboard')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10B981',
                    color: '#FFF',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View as Student →
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  5. Consolidated Review & Publication Gate
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Textbook #{activeTextbookId}: {activeTextbook?.title} • Review curriculum, video lessons, and quizzes in one screen.
                </p>
              </div>

              <button
                onClick={handleFinalPublish}
                disabled={publishing || publishSuccess}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  backgroundColor: publishSuccess ? '#059669' : '#10B981',
                  color: '#FFF',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: publishing || publishSuccess ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                {publishing ? 'Publishing Everything...' : publishSuccess ? '✓ Published to Students' : '🚀 Approve & Publish Everything'}
              </button>
            </div>

            {/* 3-Column Consolidated Review Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '20px' }}>
              {/* Column 1: Curriculum Tree */}
              <div
                style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: 'var(--admin-bg)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#818CF8', marginBottom: '12px' }}>
                  📑 Verified Curriculum
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {hierarchy?.chapters?.map((ch) => (
                    <div key={ch.id} style={{ fontSize: '13px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{ch.title}</div>
                      {ch.topics?.map((t) => (
                        <div key={t.id} style={{ paddingLeft: '12px', color: 'var(--admin-text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                          • {t.title}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Video Player Preview */}
              <div
                style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: 'var(--admin-bg)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#60A5FA', marginBottom: '12px' }}>
                  🎬 Pre-Rendered Video Preview
                </div>
                <div
                  style={{
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    aspectRatio: '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <video
                    controls
                    style={{ width: '100%', height: '100%' }}
                    src={`http://127.0.0.1:8000/static/videos/pre_rendered_${activeTextbookId || 1}_1_1.mp4`}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '10px' }}>
                  Pre-rendered lesson with synchronized narration, visual slides, and true-type typography.
                </div>
              </div>

              {/* Column 3: Quiz Assessment Preview */}
              <div
                style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: 'var(--admin-bg)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#F59E0B', marginBottom: '12px' }}>
                  🎯 Aligned Topic Quizzes
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {hierarchy?.chapters?.flatMap((c) => c.topics || []).slice(0, 3).map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)' }}>
                        Quiz {idx + 1}: {t.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                        3 Multi-tier Assessment Questions • Pass Threshold: 80%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SurfacePanel>
      )}
    </div>
  );
};
