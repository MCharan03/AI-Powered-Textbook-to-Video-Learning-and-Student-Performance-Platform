import React, { useState, useEffect } from 'react';
import { Upload, Zap, ArrowRight, BookOpen, LibraryBig, ListTree, Tag, CircleDot, FileText } from 'lucide-react';
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

const PIPELINE_STEPS = [
  'Upload Textbook',
  'Extract Curriculum',
  'Review & Approve',
  'Video Plans',
  'Scripts',
  'Videos',
  'Publish',
];

/** Derive the pipeline step (0-based) from fields already present on Textbook. */
const derivePipelineStep = (tb: Textbook): number => {
  const status = (tb.status || '').toUpperCase();
  if (status === 'PUBLISHED') return PIPELINE_STEPS.length; // everything complete
  if (status === 'APPROVED') return 3; // curriculum approved → next: video plans
  if (status === 'REVIEW') return 2; // pending review & approval
  if (status === 'FAILED') return (tb.chapters_count ?? 0) > 0 ? 2 : 1;
  // QUEUED / PROCESSING / uploaded
  return 1;
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

      // Automatically offer or trigger processing
      if (created.id) {
        handleStartProcess(created.id);
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
        title="Textbooks & Curriculum Ingestion"
        description="Upload textbook PDFs, map to academic subjects, run 7-stage AI extraction, and review hierarchical chapters."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={() => onNavigate('admin-video-studio')}
            >
              <Zap size={15} />
              Video Studio (One-Flow)
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => setShowUploadModal(true)}>
              <Upload size={15} />
              Upload New Textbook
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
        <StatCard label="Total Textbooks" value={textbooks.length} icon={BookOpen} tone="default" />
        <StatCard
          label="In Processing"
          value={textbooks.filter((t) => t.status === 'PROCESSING' || t.status === 'QUEUED').length}
          icon={FileText}
          tone="primary"
        />
        <StatCard
          label="Ready for Review"
          value={textbooks.filter((t) => t.status === 'REVIEW').length}
          icon={ListTree}
          tone="warning"
        />
        <StatCard
          label="Approved Curricula"
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
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </SurfacePanel>

      {/* Textbook Ingestion Table */}
      <SurfacePanel>
        {loading ? (
          <LoadingState label="Loading textbooks…" rows={5} variant="table" />
        ) : listError ? (
          <div style={{ padding: '4px 0' }}>
            <ErrorState message={listError} onRetry={loadData} />
          </div>
        ) : textbooks.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={20} />}
            title="No textbooks uploaded yet"
            description="Upload an academic textbook PDF to automatically extract chapters, topics, and micro-learning subtopics."
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
                  <th>Textbook</th>
                  <th>Subject</th>
                  <th>File Info</th>
                  <th>AI Pipeline Stage</th>
                  <th>Pipeline Position</th>
                  <th>Hierarchy Extracted</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {textbooks.map((tb) => {
                  const isProcessing = tb.status === 'PROCESSING' || processingId === tb.id;
                  const progressPct = tb.progress ?? (tb.stage ? Math.round((tb.stage / 7) * 100) : 0);
                  const pipelineStep = derivePipelineStep(tb);
                  const stepLabel =
                    pipelineStep >= PIPELINE_STEPS.length
                      ? 'All stages complete'
                      : `Next: ${PIPELINE_STEPS[pipelineStep]} (step ${pipelineStep + 1} of ${PIPELINE_STEPS.length})`;

                  return (
                    <tr key={tb.id}>
                      {/* Title & Desc */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{tb.title}</div>
                        {tb.description && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--admin-text-secondary)',
                              marginTop: '2px',
                              maxWidth: '280px',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tb.description}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                          ID: #{tb.id} • {tb.created_at ? new Date(tb.created_at).toLocaleDateString() : 'Recent'}
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

                      {/* File Info */}
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--admin-text)' }}>
                          {tb.original_filename || tb.filename || 'textbook.pdf'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {formatFileSize(tb.file_size)}
                        </div>
                      </td>

                      {/* AI Pipeline Stage & Progress */}
                      <td style={{ minWidth: '180px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)' }}>
                            {tb.stage_name || (tb.status === 'APPROVED' ? 'Complete (7/7)' : `Stage ${tb.stage ?? 0}/7`)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>
                            {progressPct}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: 'var(--admin-border)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, progressPct)}%`,
                              height: '100%',
                              backgroundColor:
                                tb.status === 'FAILED'
                                  ? 'var(--admin-error)'
                                  : tb.status === 'APPROVED' || tb.status === 'PUBLISHED'
                                  ? 'var(--admin-success)'
                                  : 'var(--admin-primary)',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        {tb.error_message && (
                          <div style={{ fontSize: '11px', color: 'var(--admin-error)', marginTop: '4px' }}>
                            {tb.error_message}
                          </div>
                        )}
                      </td>

                      {/* Pipeline Position (WorkflowStepper) */}
                      <td>
                        <div title={stepLabel} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <WorkflowStepper steps={PIPELINE_STEPS} currentStep={pipelineStep} compact />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                          {stepLabel}
                        </div>
                      </td>

                      {/* Extracted Counts */}
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <ListTree size={12} style={{ color: 'var(--admin-text-secondary)' }} />
                            {tb.chapters_count ?? 0} Chapters
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Tag size={12} style={{ color: 'var(--admin-text-secondary)' }} />
                            {tb.topics_count ?? 0} Topics
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <CircleDot size={12} style={{ color: 'var(--admin-text-secondary)' }} />
                            {tb.subtopics_count ?? 0} Subtopics
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={tb.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          {(tb.status === 'QUEUED' || tb.status === 'FAILED') && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-primary adm-btn-sm"
                              onClick={() => handleStartProcess(tb.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Extracting…' : 'Start Extraction'}
                            </button>
                          )}

                          {tb.status === 'PROCESSING' && (
                            <span style={{ fontSize: '12px', color: 'var(--admin-primary)', fontWeight: 600 }}>
                              Extracting…
                            </span>
                          )}

                          {(tb.status === 'REVIEW' || tb.status === 'APPROVED' || (tb.chapters_count ?? 0) > 0) && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              onClick={() => onNavigate('admin-textbook-review', { textbookId: tb.id })}
                            >
                              Review Curriculum
                              <ArrowRight size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            onClick={() => onNavigate('admin-video-studio', { textbookId: tb.id })}
                            style={{ color: 'var(--admin-primary)', borderColor: 'var(--admin-primary)' }}
                          >
                            <Zap size={13} />
                            Studio
                            <ArrowRight size={13} />
                          </button>
                        </div>
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
        title="Upload Textbook PDF"
        subtitle="Upload a PDF to map into an academic subject and start AI curriculum extraction."
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
              {uploading ? 'Uploading & Creating Job…' : 'Upload & Start'}
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
