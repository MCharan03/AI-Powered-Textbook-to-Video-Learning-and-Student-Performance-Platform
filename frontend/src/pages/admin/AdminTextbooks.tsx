import React, { useState, useEffect } from 'react';
import {
  Upload,
  ArrowRight,
  BookOpen,
  LibraryBig,
  ListTree,
  Tag,
  CircleDot,
  FileText,
  Clapperboard,
  CheckCircle2,
  Globe2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/admin/PageHeader';
import { StatCard } from '../../components/admin/StatCard';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { ErrorState } from '../../components/admin/ErrorState';
import { Modal } from '../../components/admin/Modal';
import { FormField } from '../../components/admin/FormField';
import { SearchBar } from '../../components/admin/SearchBar';
import { WorkflowStepper } from '../../components/admin/WorkflowStepper';
import { api } from '../../lib/api';
import { Textbook, SubjectItem } from '../../lib/types';

/**
 * Six-stage canonical Video Studio workflow stages:
 * Upload → Curriculum → Plans → Scripts → Rendering → Review & Publish
 */
const VIDEO_STUDIO_STAGES = [
  'Upload',
  'Curriculum',
  'Plans',
  'Scripts',
  'Rendering',
  'Review & Publish',
];

interface StudioStageInfo {
  stepIndex: number;
  stageName: string;
  nextAction: string;
  progressPercent: number;
}

/** Derive the 6-stage Video Studio step from fields on Textbook. */
const deriveStudioWorkflowStage = (tb: Textbook): StudioStageInfo => {
  const status = (tb.status || '').toUpperCase();
  const chaptersCount = tb.chapters_count ?? 0;

  if (status === 'PUBLISHED') {
    return {
      stepIndex: 5,
      stageName: 'Review & Publish',
      nextAction: 'Published (Live for Students)',
      progressPercent: 100,
    };
  }
  if (status === 'APPROVED') {
    return {
      stepIndex: 2,
      stageName: 'Plans',
      nextAction: 'Curriculum Approved → Video Planning',
      progressPercent: 50,
    };
  }
  if (status === 'REVIEW') {
    return {
      stepIndex: 1,
      stageName: 'Curriculum',
      nextAction: 'Ready for Curriculum Review & Editing',
      progressPercent: 33,
    };
  }
  if (status === 'PROCESSING') {
    return {
      stepIndex: 1,
      stageName: 'Curriculum',
      nextAction: 'AI Curriculum Extraction In Progress…',
      progressPercent: tb.progress ? Math.round(tb.progress) : 25,
    };
  }
  if (status === 'QUEUED') {
    return {
      stepIndex: 0,
      stageName: 'Upload',
      nextAction: 'Queued for Extraction',
      progressPercent: 10,
    };
  }
  if (status === 'FAILED') {
    return {
      stepIndex: chaptersCount > 0 ? 1 : 0,
      stageName: chaptersCount > 0 ? 'Curriculum' : 'Upload',
      nextAction: 'Extraction Failed — Reopen in Studio',
      progressPercent: 0,
    };
  }
  if (chaptersCount > 0) {
    return {
      stepIndex: 1,
      stageName: 'Curriculum',
      nextAction: 'Curriculum Extracted',
      progressPercent: 33,
    };
  }
  return {
    stepIndex: 0,
    stageName: 'Upload',
    nextAction: 'Source Uploaded',
    progressPercent: 10,
  };
};

interface AdminTextbooksProps {
  onNavigate: (route: string, params?: any) => void;
}

export const AdminTextbooks: React.FC<AdminTextbooksProps> = ({ onNavigate }) => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | undefined>(undefined);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubjectId, setUploadSubjectId] = useState<number | ''>('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [tbList, subjRes] = await Promise.all([
        api.listTextbooks(search || undefined, selectedSubjectFilter, selectedStatusFilter || undefined),
        api.listSubjects(),
      ]);
      setTextbooks(tbList);
      setSubjects(subjRes.items || []);
      setListError(null);
    } catch (err: any) {
      console.error('Failed to load textbooks:', err);
      setListError(err.message || 'Failed to load textbooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedSubjectFilter, selectedStatusFilter]);

  // Polling when any textbook is processing or queued
  useEffect(() => {
    const hasActiveJobs = textbooks.some(
      (t) => t.status === 'PROCESSING' || t.status === 'QUEUED' || t.status === 'processing'
    );
    if (!hasActiveJobs) return;

    const timer = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(timer);
  }, [textbooks]);

  const handleStartProcess = async (id: number) => {
    try {
      setProcessingId(id);
      setActionError(null);
      await api.processTextbook(id, false);
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to start processing: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF documents are supported for textbook ingestion.');
      setUploadFile(null);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('PDF file size exceeds 100MB limit.');
      setUploadFile(null);
      return;
    }

    setUploadError(null);
    setUploadFile(file);
    if (!uploadTitle) {
      const suggested = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(suggested);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a PDF file.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Textbook title is required.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const created = await api.uploadTextbook(
        uploadFile,
        uploadTitle.trim(),
        uploadSubjectId ? Number(uploadSubjectId) : undefined,
        uploadDescription.trim() || undefined
      );

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadSubjectId('');
      setUploadDescription('');
      await loadData();

      // Automatically start processing and immediately open in Video Studio One-Flow!
      if (created.id) {
        handleStartProcess(created.id);
        onNavigate('admin-video-studio', { textbookId: created.id });
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Textbook Library & Monitoring"
        description="Comprehensive library and status monitoring for all uploaded textbooks and chapters. Open any source in Video Studio (One-Flow) to extract topics, plan lessons, write scripts, render MP4s, and publish."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => onNavigate('admin-video-studio')}
            >
              <Clapperboard size={15} />
              Open Video Studio (One-Flow)
            </button>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowUploadModal(true)}>
              <Upload size={15} />
              Upload Source PDF
            </button>
          </>
        }
      />

      <MessageBanner
        message={actionError ? { text: actionError, type: 'error' } : null}
        onDismiss={() => setActionError(null)}
      />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Textbooks & Chapters" value={textbooks.length} icon={BookOpen} tone="default" />
        <StatCard
          label="In Processing"
          value={textbooks.filter((t) => t.status === 'PROCESSING' || t.status === 'QUEUED').length}
          icon={FileText}
          tone="primary"
        />
        <StatCard
          label="Curriculum Ready / Review"
          value={textbooks.filter((t) => t.status === 'REVIEW').length}
          icon={ListTree}
          tone="warning"
        />
        <StatCard
          label="Curricula Approved"
          value={textbooks.filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED').length}
          icon={LibraryBig}
          tone="success"
        />
      </div>

      {/* Filter & Search Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search textbooks by title or filename..."
            style={{ flex: '1 1 240px' }}
          />

          <div style={{ minWidth: '180px' }}>
            <select
              className="adm-select"
              value={selectedSubjectFilter || ''}
              onChange={(e) => setSelectedSubjectFilter(e.target.value ? Number(e.target.value) : undefined)}
              aria-label="Filter by subject"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.class ? `(Class ${s.class})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              className="adm-select"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="PROCESSING">Processing</option>
              <option value="REVIEW">Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </SurfacePanel>

      {/* Textbook Ingestion & Library Table */}
      <SurfacePanel>
        {loading ? (
          <LoadingState label="Loading textbook library…" rows={5} variant="table" />
        ) : listError ? (
          <div style={{ padding: '4px 0' }}>
            <ErrorState message={listError} onRetry={loadData} />
          </div>
        ) : textbooks.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={20} />}
            title="No textbooks uploaded yet"
            description="Upload an academic textbook or individual chapter PDF to start the Video Studio workflow."
            action={
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => setShowUploadModal(true)}>
                <Upload size={15} />
                Upload First Textbook
              </button>
            }
          />
        ) : (
          <div className="adm-table-wrapper">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Textbook / Chapter</th>
                  <th>Source File</th>
                  <th>Subject</th>
                  <th>Chapter Count</th>
                  <th>Video Studio Stage</th>
                  <th>Processing Status</th>
                  <th>Publication Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {textbooks.map((tb) => {
                  const stageInfo = deriveStudioWorkflowStage(tb);
                  const isChapterPdf = tb.source_type === 'CHAPTER';

                  return (
                    <tr key={tb.id}>
                      {/* Title, Source Type & Creation Date */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{tb.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span
                            className="adm-badge"
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 6px',
                              backgroundColor: isChapterPdf ? '#FEF3C7' : '#F1F5F9',
                              color: isChapterPdf ? '#92400E' : '#475569',
                            }}
                          >
                            {isChapterPdf ? `Chapter PDF (Ch #${tb.chapter_number ?? '1'})` : 'Complete Textbook'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                            ID: #{tb.id}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '3px' }}>
                          Created: {tb.created_at ? new Date(tb.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                      </td>

                      {/* Source File */}
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--admin-text)' }}>
                          {tb.original_filename || tb.filename || 'source.pdf'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {formatFileSize(tb.file_size)}
                        </div>
                      </td>

                      {/* Subject */}
                      <td>
                        {tb.subject_name ? (
                          <span
                            className="adm-badge"
                            style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                          >
                            <LibraryBig size={11} />
                            {tb.subject_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>—</span>
                        )}
                      </td>

                      {/* Chapter & Content Counts */}
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '12px',
                            color: 'var(--admin-text)',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                            <ListTree size={12} style={{ color: 'var(--admin-primary)' }} />
                            {tb.chapters_count ?? 0} {tb.chapters_count === 1 ? 'Chapter' : 'Chapters'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                            {tb.topics_count ?? 0} topics • {tb.subtopics_count ?? 0} subtopics
                          </span>
                        </div>
                      </td>

                      {/* Video Studio Workflow (6 stages) */}
                      <td style={{ minWidth: '180px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <WorkflowStepper
                            steps={VIDEO_STUDIO_STAGES}
                            currentStep={stageInfo.stepIndex}
                            compact
                          />
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--admin-text)', marginTop: '4px' }}>
                          Stage {stageInfo.stepIndex + 1}/6: {stageInfo.stageName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '1px' }}>
                          {stageInfo.nextAction}
                        </div>
                      </td>

                      {/* Processing Status */}
                      <td>
                        <StatusBadge status={tb.status} />
                        {tb.error_message && (
                          <div style={{ fontSize: '11px', color: 'var(--admin-error)', marginTop: '4px', maxWidth: '160px' }}>
                            {tb.error_message}
                          </div>
                        )}
                      </td>

                      {/* Publication Status */}
                      <td>
                        {(tb.status || '').toUpperCase() === 'PUBLISHED' ? (
                          <span
                            className="adm-badge"
                            style={{
                              backgroundColor: 'var(--admin-success-soft, #ECFDF5)',
                              color: 'var(--admin-success, #059669)',
                              border: '1px solid #A7F3D0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={11} />
                            Published
                          </span>
                        ) : (tb.status || '').toUpperCase() === 'APPROVED' ? (
                          <span
                            className="adm-badge"
                            style={{
                              backgroundColor: 'var(--admin-primary-soft, #EFF6FF)',
                              color: 'var(--admin-primary, #2563EB)',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            Approved
                          </span>
                        ) : (
                          <span
                            className="adm-badge"
                            style={{
                              backgroundColor: '#F1F5F9',
                              color: '#64748B',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            Unpublished
                          </span>
                        )}
                      </td>

                      {/* Canonical Action: Open in Video Studio */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="adm-btn adm-btn-primary adm-btn-sm"
                          onClick={() => onNavigate('admin-video-studio', { textbookId: tb.id })}
                          title="Open textbook in Video Studio (One-Flow)"
                        >
                          <Clapperboard size={13} />
                          Open in Video Studio
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfacePanel>

      {/* Upload Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => {
          if (!uploading) {
            setShowUploadModal(false);
            setUploadError(null);
          }
        }}
        title="Upload Textbook or Chapter PDF"
        subtitle="Upload a PDF to map into an academic subject and automatically open in Video Studio (One-Flow)."
        maxWidth={560}
        footer={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={() => {
                setShowUploadModal(false);
                setUploadError(null);
              }}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="upload-textbook-form"
              className="adm-btn adm-btn-primary"
              disabled={uploading || !uploadFile}
            >
              {uploading ? 'Uploading & Opening in Studio…' : 'Upload & Open in Video Studio'}
            </button>
          </>
        }
      >
        <form id="upload-textbook-form" onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {uploadError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--admin-error-soft)',
                border: '1px solid #FECACA',
                color: 'var(--admin-error)',
                fontSize: '13px',
              }}
            >
              {uploadError}
            </div>
          )}

          {/* File Selector */}
          <div>
            <label className="adm-label" htmlFor="textbook-pdf-input">
              PDF Document <span style={{ color: 'var(--admin-error)' }}>*</span>
            </label>
            <input
              id="textbook-pdf-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--admin-surface)',
                border: '1px dashed var(--admin-border)',
                color: 'var(--admin-text)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            />
            {uploadFile && (
              <div style={{ fontSize: '12px', color: 'var(--admin-success)', marginTop: '4px' }}>
                Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
              </div>
            )}
          </div>

          {/* Title */}
          <FormField
            label="Textbook Title"
            name="textbook-title"
            type="text"
            required
            placeholder="e.g. NCERT Class 10 Physics"
            value={uploadTitle}
            onChange={setUploadTitle}
          />

          {/* Subject Selection */}
          <FormField
            label="Academic Subject"
            name="textbook-subject"
            type="select"
            value={uploadSubjectId}
            onChange={(v) => setUploadSubjectId(v ? Number(v) : '')}
            options={[
              { value: '', label: '-- Select Existing Subject --' },
              ...subjects.map((s) => ({
                value: s.id,
                label: `${s.name}${s.class ? ` (Class ${s.class})` : ''}`,
              })),
            ]}
            helpText="Select the curriculum subject this textbook maps into."
          />

          {/* Description */}
          <FormField
            label="Description (Optional)"
            name="textbook-description"
            type="textarea"
            placeholder="Notes about curriculum edition, syllabus year, or syllabus scope…"
            value={uploadDescription}
            onChange={setUploadDescription}
          />
        </form>
      </Modal>
    </div>
  );
};
