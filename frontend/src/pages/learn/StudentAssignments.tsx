import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { api } from '../../lib/api';
import {
  StudentAssignmentListItem,
  StudentAssignmentDetail,
  StudentAssignmentSummary,
} from '../../lib/types';

interface StudentAssignmentsProps {
  onNavigate?: (route: string, params?: any) => void;
}

const mutedText: React.CSSProperties = { color: '#64748B', fontSize: 13 };
const primaryButton: React.CSSProperties = {
  backgroundColor: '#2563EB',
  color: '#FFFFFF',
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};
const secondaryButton: React.CSSProperties = {
  backgroundColor: '#F1F5F9',
  color: '#334155',
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  fontSize: '14px',
  outline: 'none',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'GRADED':
      return { bg: '#DCFCE7', text: '#15803D', label: 'Graded' };
    case 'SUBMITTED':
      return { bg: '#E0F2FE', text: '#0369A1', label: 'Submitted' };
    case 'LATE':
      return { bg: '#FEE2E2', text: '#DC2626', label: 'Late' };
    case 'IN_PROGRESS':
      return { bg: '#FEF3C7', text: '#B45309', label: 'In Progress' };
    case 'PENDING':
    default:
      return { bg: '#F1F5F9', text: '#475569', label: 'Pending' };
  }
};

export const StudentAssignments: React.FC<StudentAssignmentsProps> = ({ onNavigate }) => {
  const [assignments, setAssignments] = useState<StudentAssignmentListItem[]>([]);
  const [summary, setSummary] = useState<StudentAssignmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'GRADED'>('ALL');

  // Detail / Submit modal
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [list, sum] = await Promise.all([
        api.getStudentAssignments(),
        api.getStudentAssignmentsSummary(),
      ]);
      setAssignments(list);
      setSummary(sum);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssignment = async (assign: StudentAssignmentListItem) => {
    try {
      setModalLoading(true);
      setSubmitError(null);
      // Fetching detail transitions PENDING -> IN_PROGRESS on the backend
      const detail = await api.getStudentAssignmentDetail(assign.assignment_id);
      setSelectedAssignment(detail);
      setSubmissionText(detail.submission_text || '');
      setFileUrl(detail.file_url || '');
      // Refresh list in background to reflect IN_PROGRESS status
      void loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to open assignment');
    } finally {
      setModalLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      setSubmitError(null);
      const res = await api.uploadAssignmentFile(file);
      setFileUrl(res.url);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to upload attachment file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (!submissionText.trim() && !fileUrl) {
      setSubmitError('Please enter your written work or upload an attachment file.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const updated = await api.submitStudentAssignment(selectedAssignment.assignment_id, {
        submission_text: submissionText.trim() || undefined,
        file_url: fileUrl.trim() || undefined,
      });
      setSelectedAssignment(updated);
      await loadData();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssignments = assignments.filter(item => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'PENDING') return item.status === 'PENDING' || item.status === 'IN_PROGRESS';
    if (filterTab === 'SUBMITTED') return item.status === 'SUBMITTED' || item.status === 'LATE';
    if (filterTab === 'GRADED') return item.status === 'GRADED';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563EB', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
          <span>📝</span> Student Portal · Assignments
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 750, color: '#0F172A', margin: '6px 0 2px' }}>
          My Assignments
        </h1>
        <p style={{ ...mutedText, margin: 0 }}>
          View tasks assigned by your teachers, submit your work, and review teacher scores and feedback.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Pending</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#475569', marginTop: 4 }}>{summary.pending}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Not yet started</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>In Progress</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#F59E0B', marginTop: 4 }}>{summary.in_progress}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Currently active</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Submitted</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#0284C7', marginTop: 4 }}>{summary.submitted}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Awaiting review</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Overdue</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#DC2626', marginTop: 4 }}>{summary.overdue}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Past due date</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Graded</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#10B981', marginTop: 4 }}>{summary.graded}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Evaluation complete</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
        {(['ALL', 'PENDING', 'SUBMITTED', 'GRADED'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterTab(tab)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
              backgroundColor: filterTab === tab ? '#2563EB' : '#F1F5F9',
              color: filterTab === tab ? '#FFFFFF' : '#475569',
            }}
          >
            {tab === 'ALL' ? 'All Assignments' : tab === 'PENDING' ? 'Pending & In Progress' : tab === 'SUBMITTED' ? 'Submitted & Late' : 'Graded'}
          </button>
        ))}
      </div>

      {/* Assignment List */}
      <SurfacePanel title="Assigned Work" actions={<span style={mutedText}>{filteredAssignments.length} found</span>}>
        {loading && <p style={{ ...mutedText, margin: '16px 0' }}>Loading your assignments…</p>}
        {error && <div style={{ color: '#DC2626', padding: '12px 0' }}>{error}</div>}
        {!loading && !error && filteredAssignments.length === 0 && (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 650, fontSize: 16, color: '#1E293B' }}>No assignments in this view</div>
            <p style={{ ...mutedText, marginTop: 4 }}>
              You're all caught up! When a teacher assigns tasks to your class, they will appear here.
            </p>
          </div>
        )}

        {!loading && !error && filteredAssignments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredAssignments.map(assign => {
              const badge = getStatusBadge(assign.status);
              return (
                <div
                  key={assign.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                        {assign.subject_name} · {assign.chapter_title}
                      </span>
                      {assign.topic_title && (
                        <span style={{ fontSize: 11, color: '#64748B' }}>
                          · {assign.topic_title}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                      {assign.title}
                    </div>
                    <p style={{ ...mutedText, margin: '4px 0 6px', maxWidth: 600 }}>
                      {assign.description}
                    </p>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', flexWrap: 'wrap' }}>
                      <span>👨‍🏫 Teacher: <strong>{assign.teacher_name}</strong></span>
                      <span>📅 Due: <strong>{new Date(assign.due_date).toLocaleDateString()}</strong></span>
                      <span>🎯 Total: <strong>{assign.total_points} pts</strong></span>
                    </div>

                    {/* Graded banner if graded */}
                    {assign.status === 'GRADED' && (
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 750, color: '#166534' }}>
                          Score: {assign.score} / {assign.total_points}
                        </span>
                        {assign.feedback && (
                          <span style={{ fontSize: 12, color: '#15803D' }}>
                            Feedback: "{assign.feedback}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, backgroundColor: badge.bg, color: badge.text, fontSize: 11, fontWeight: 700 }}>
                      {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignment(assign)}
                      style={primaryButton}
                    >
                      {assign.status === 'GRADED' ? 'View Grade & Submission' : assign.has_submission ? 'View Submission' : 'Open Assignment'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfacePanel>

      {/* DETAIL & SUBMISSION MODAL */}
      {selectedAssignment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                  {selectedAssignment.subject_name} · {selectedAssignment.chapter_title} {selectedAssignment.topic_title ? `· ${selectedAssignment.topic_title}` : ''}
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 750, color: '#0F172A', margin: '4px 0 0' }}>
                  {selectedAssignment.title}
                </h2>
                <p style={{ ...mutedText, margin: '4px 0 0' }}>
                  Assigned by {selectedAssignment.teacher_name} · Due {new Date(selectedAssignment.due_date).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 650, color: '#334155' }}>Status:</span>
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  ...getStatusBadge(selectedAssignment.status),
                }}
              >
                {getStatusBadge(selectedAssignment.status).label}
              </span>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Max points: {selectedAssignment.total_points}
              </span>
            </div>

            {/* Instructions */}
            <div style={{ padding: '14px 16px', borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Instructions / Description
              </div>
              <div style={{ fontSize: 14, color: '#0F172A', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {selectedAssignment.description}
              </div>
              {selectedAssignment.attachment_url && (
                <div style={{ marginTop: 12 }}>
                  <a
                    href={selectedAssignment.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}
                  >
                    📎 Teacher Attachment / Resource
                  </a>
                </div>
              )}
            </div>

            {/* Graded evaluation panel if graded */}
            {selectedAssignment.status === 'GRADED' && (
              <div style={{ padding: '16px 20px', borderRadius: 10, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    Graded Evaluation
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#15803D' }}>
                    {selectedAssignment.score} / {selectedAssignment.total_points} pts
                  </span>
                </div>
                {selectedAssignment.feedback && (
                  <div style={{ marginTop: 8, fontSize: 14, color: '#14532D', fontStyle: 'italic' }}>
                    "{selectedAssignment.feedback}"
                  </div>
                )}
                {selectedAssignment.graded_at && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#166534' }}>
                    Graded on {new Date(selectedAssignment.graded_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Submission Area */}
            {selectedAssignment.has_submission ? (
              <div style={{ padding: '16px 20px', borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                    Your Submitted Work
                  </div>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    Submitted: {selectedAssignment.submitted_at ? new Date(selectedAssignment.submitted_at).toLocaleString() : 'Yes'}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#0F172A', whiteSpace: 'pre-wrap', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  {selectedAssignment.submission_text || <span style={{ color: '#94A3B8' }}>No text submitted.</span>}
                </div>
                {selectedAssignment.file_url && (
                  <div style={{ marginTop: 12 }}>
                    <a
                      href={selectedAssignment.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}
                    >
                      📎 Download Your Submitted Attachment
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  Submit Your Response
                </div>

                {submitError && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 13 }}>
                    {submitError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Written Submission / Code / Solution
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Type or paste your complete solution, explanations, or code here..."
                    value={submissionText}
                    onChange={e => setSubmissionText(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Optional Attachment (PDF, DOC/DOCX, Images, Code)
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    style={{ fontSize: 13 }}
                  />
                  {uploadingFile && <span style={{ fontSize: 12, color: '#2563EB', marginLeft: 8 }}>Uploading attachment…</span>}
                  {fileUrl && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
                      ✓ File attached: {fileUrl}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    style={secondaryButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingFile}
                    style={primaryButton}
                  >
                    {submitting ? 'Submitting…' : 'Submit Assignment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
