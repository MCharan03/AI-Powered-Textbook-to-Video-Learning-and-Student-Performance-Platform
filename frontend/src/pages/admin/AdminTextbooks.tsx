import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { Textbook, SubjectItem } from '../../lib/types';

interface AdminTextbooksProps {
  onNavigate: (route: string, params?: any) => void;
}

export const AdminTextbooks: React.FC<AdminTextbooksProps> = ({ onNavigate }) => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | undefined>(undefined);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [processingId, setProcessingId] = useState<number | null>(null);

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
    } catch (err: any) {
      console.error('Failed to load textbooks:', err);
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
      await api.processTextbook(id, false);
      await loadData();
    } catch (err: any) {
      alert(`Failed to start processing: ${err.message}`);
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

  const getStatusBadgeVariant = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'APPROVED' || s === 'PUBLISHED') return 'published';
    if (s === 'REVIEW') return 'pending';
    if (s === 'PROCESSING') return 'review';
    if (s === 'FAILED') return 'rejected';
    return 'neutral';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Textbooks & Curriculum Ingestion
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Upload textbook PDFs, map to academic subjects, run 7-stage AI extraction, and review hierarchical chapters.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--admin-primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          <span>➕</span>
          <span>Upload New Textbook</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <SurfacePanel>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Total Textbooks</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '6px' }}>
            {textbooks.length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>In Processing</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#38BDF8', marginTop: '6px' }}>
            {textbooks.filter((t) => t.status === 'PROCESSING' || t.status === 'QUEUED').length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Ready for Review</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#FBBF24', marginTop: '6px' }}>
            {textbooks.filter((t) => t.status === 'REVIEW').length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Approved Curricula</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {textbooks.filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED').length}
          </div>
        </SurfacePanel>
      </div>

      {/* Filter & Search Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search textbooks by title or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedSubjectFilter || ''}
              onChange={(e) => setSelectedSubjectFilter(e.target.value ? Number(e.target.value) : undefined)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                fontSize: '14px',
              }}
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
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                fontSize: '14px',
              }}
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
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            Loading textbooks...
          </div>
        ) : textbooks.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📖</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)' }}>No textbooks uploaded yet</h3>
            <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', marginTop: '4px', maxWidth: '440px', margin: '4px auto 16px auto' }}>
              Upload an academic textbook PDF to automatically extract chapters, topics, and micro-learning subtopics.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upload First Textbook
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Textbook</th>
                  <th style={{ padding: '12px 16px' }}>Subject</th>
                  <th style={{ padding: '12px 16px' }}>File Info</th>
                  <th style={{ padding: '12px 16px' }}>AI Pipeline Stage</th>
                  <th style={{ padding: '12px 16px' }}>Hierarchy Extracted</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {textbooks.map((tb) => {
                  const isProcessing = tb.status === 'PROCESSING' || processingId === tb.id;
                  const progressPct = tb.progress ?? (tb.stage ? Math.round((tb.stage / 7) * 100) : 0);

                  return (
                    <tr
                      key={tb.id}
                      style={{
                        borderBottom: '1px solid var(--admin-border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Title & Desc */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)', fontSize: '15px' }}>
                          {tb.title}
                        </div>
                        {tb.description && (
                          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {tb.description}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                          ID: #{tb.id} • {tb.created_at ? new Date(tb.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                      </td>

                      {/* Subject */}
                      <td style={{ padding: '16px' }}>
                        {tb.subject_name ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#818CF8',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            📚 {tb.subject_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-secondary)', fontSize: '13px' }}>Unassigned</span>
                        )}
                      </td>

                      {/* File Info */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--admin-text)' }}>
                          {tb.original_filename || tb.filename || 'textbook.pdf'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {formatFileSize(tb.file_size)}
                        </div>
                      </td>

                      {/* AI Pipeline Stage & Progress */}
                      <td style={{ padding: '16px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: isProcessing ? '#38BDF8' : 'var(--admin-text)' }}>
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
                                  ? 'var(--admin-danger)'
                                  : tb.status === 'APPROVED'
                                  ? '#10B981'
                                  : 'var(--admin-primary)',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        {tb.error_message && (
                          <div style={{ fontSize: '11px', color: 'var(--admin-danger)', marginTop: '4px' }}>
                            {tb.error_message}
                          </div>
                        )}
                      </td>

                      {/* Extracted Counts */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: 'var(--admin-text)' }}>
                          <span>📑 {tb.chapters_count ?? 0} Chapters</span>
                          <span>🏷️ {tb.topics_count ?? 0} Topics</span>
                          <span>🔹 {tb.subtopics_count ?? 0} Subtopics</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px' }}>
                        <StatusBadge
                          status={tb.status}
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                          {(tb.status === 'QUEUED' || tb.status === 'FAILED') && (
                            <button
                              onClick={() => handleStartProcess(tb.id)}
                              disabled={isProcessing}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--admin-primary)',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isProcessing ? 'Extracting...' : 'Start Extraction'}
                            </button>
                          )}

                          {tb.status === 'PROCESSING' && (
                            <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 600 }}>
                              Extracting...
                            </span>
                          )}

                          {(tb.status === 'REVIEW' || tb.status === 'APPROVED' || (tb.chapters_count ?? 0) > 0) && (
                            <button
                              onClick={() => onNavigate('admin-textbook-review', { textbookId: tb.id })}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--admin-primary)',
                                color: 'var(--admin-primary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Review Curriculum →
                            </button>
                          )}
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
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '540px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                Upload Textbook PDF
              </h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--admin-text-secondary)',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  fontSize: '13px',
                }}
              >
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* File Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                  PDF Document <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px dashed var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
                {uploadFile && (
                  <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>
                    Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                  Textbook Title <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. NCERT Class 10 Physics"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '14px',
                  }}
                  required
                />
              </div>

              {/* Subject Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                  Academic Subject
                </label>
                <select
                  value={uploadSubjectId}
                  onChange={(e) => setUploadSubjectId(e.target.value ? Number(e.target.value) : '')}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">-- Select Existing Subject --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.class ? `(Class ${s.class})` : ''}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                  Select the curriculum subject this textbook maps into.
                </p>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes about curriculum edition, syllabus year, or syllabus scope..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  {uploading ? 'Uploading & Creating Job...' : 'Upload & Start'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
