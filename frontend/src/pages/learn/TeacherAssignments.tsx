import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { api } from '../../lib/api';
import {
  TeacherAssignmentItem,
  TeacherAssignmentDetail,
  TeacherAssignedStudent,
  AssignmentSubmissionItem,
  TeacherAssignmentSummary,
  SubjectItem,
  ChapterItem,
  TopicItem,
} from '../../lib/types';

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
const dangerButton: React.CSSProperties = {
  backgroundColor: '#FEE2E2',
  color: '#DC2626',
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #FCA5A5',
  fontWeight: 600,
  fontSize: '12px',
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
    case 'NOT_SUBMITTED':
    default:
      return { bg: '#F1F5F9', text: '#475569', label: status === 'NOT_SUBMITTED' ? 'Not Submitted' : 'Pending' };
  }
};

export const TeacherAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<TeacherAssignmentItem[]>([]);
  const [summary, setSummary] = useState<TeacherAssignmentSummary | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<TeacherAssignedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Curriculum dropdown states
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<TeacherAssignmentDetail | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmissionItem | null>(null);
  const [gradeScore, setGradeScore] = useState<string>('');
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSubjectId, setFormSubjectId] = useState<number | ''>('');
  const [formChapterId, setFormChapterId] = useState<number | ''>('');
  const [formTopicId, setFormTopicId] = useState<number | ''>('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTotalPoints, setFormTotalPoints] = useState<number>(100);
  const [formAttachmentUrl, setFormAttachmentUrl] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [assigns, sum, students, subjRes] = await Promise.all([
        api.getTeacherAssignments(),
        api.getTeacherAssignmentsSummary(),
        api.getTeacherAssignedStudents(),
        api.getSubjects(1, 100),
      ]);
      setAssignments(assigns);
      setSummary(sum);
      setAssignedStudents(students);
      setSubjects(subjRes.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When subject changes, load chapters
  const handleSubjectChange = async (subjId: number) => {
    setFormSubjectId(subjId);
    setFormChapterId('');
    setFormTopicId('');
    setChapters([]);
    setTopics([]);
    if (subjId) {
      try {
        const chaps = await api.getSubjectChapters(subjId);
        setChapters(chaps);
      } catch (e) {
        console.error('Failed to load chapters:', e);
      }
    }
  };

  // When chapter changes, load topics
  const handleChapterChange = async (chapId: number) => {
    setFormChapterId(chapId);
    setFormTopicId('');
    setTopics([]);
    if (chapId) {
      try {
        const tops = await api.getChapterTopics(chapId);
        setTopics(tops);
      } catch (e) {
        console.error('Failed to load topics:', e);
      }
    }
  };

  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDesc('');
    setFormSubjectId('');
    setFormChapterId('');
    setFormTopicId('');
    setChapters([]);
    setTopics([]);
    setFormDueDate('');
    setFormTotalPoints(100);
    setFormAttachmentUrl('');
    // Select all assigned students by default
    setSelectedStudentIds(assignedStudents.map(s => s.id));
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === assignedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(assignedStudents.map(s => s.id));
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Assignment title is required');
      return;
    }
    if (!formSubjectId) {
      setFormError('Please select a subject');
      return;
    }
    if (!formChapterId) {
      setFormError('Please select a chapter');
      return;
    }
    if (!formDesc.trim()) {
      setFormError('Description / Instructions are required');
      return;
    }
    if (!formDueDate) {
      setFormError('Please select a due date');
      return;
    }
    if (selectedStudentIds.length === 0) {
      setFormError('Please select at least one student to assign');
      return;
    }

    try {
      setActionLoading(true);
      setFormError(null);
      await api.createTeacherAssignment({
        title: formTitle.trim(),
        description: formDesc.trim(),
        subject_id: Number(formSubjectId),
        chapter_id: Number(formChapterId),
        topic_id: formTopicId ? Number(formTopicId) : null,
        due_date: new Date(formDueDate).toISOString(),
        total_points: Number(formTotalPoints) || 100,
        attachment_url: formAttachmentUrl.trim() || null,
        student_ids: selectedStudentIds,
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create assignment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${title}"?`)) {
      return;
    }
    try {
      await api.deleteTeacherAssignment(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assignment');
    }
  };

  const handleViewSubmissions = async (assign: TeacherAssignmentItem) => {
    try {
      setActionLoading(true);
      const detail = await api.getTeacherAssignment(assign.id);
      setActiveAssignment(detail);
      setShowSubmissionsModal(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to load assignment submissions');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenGradeModal = (sub: AssignmentSubmissionItem) => {
    setGradingSubmission(sub);
    setGradeScore(sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
    setGradeFeedback(sub.feedback || '');
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment || !gradingSubmission) return;

    const numScore = parseFloat(gradeScore);
    if (isNaN(numScore) || numScore < 0 || numScore > activeAssignment.total_points) {
      alert(`Score must be a number between 0 and ${activeAssignment.total_points}`);
      return;
    }

    try {
      setActionLoading(true);
      await api.gradeAssignmentSubmission(activeAssignment.id, {
        student_id: gradingSubmission.student_id,
        score: numScore,
        feedback: gradeFeedback.trim() || undefined,
      });

      // Refresh assignment detail
      const refreshed = await api.getTeacherAssignment(activeAssignment.id);
      setActiveAssignment(refreshed);
      setGradingSubmission(null);
      // Also refresh background assignment list
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to save grade');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563EB', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            <span>📝</span> Teacher Portal · Assignments
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 750, color: '#0F172A', margin: '6px 0 2px' }}>
            Assignment Management
          </h1>
          <p style={{ ...mutedText, margin: 0 }}>
            Create, track, and grade textbook-grounded assignments for your assigned students.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={primaryButton}
        >
          <span>➕</span> Create Assignment
        </button>
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Assignments</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#1E293B', marginTop: 4 }}>{summary.total_assignments}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Created by you</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Pending Submissions</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#F59E0B', marginTop: 4 }}>{summary.pending_submissions}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Awaiting student work</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Submitted</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#0284C7', marginTop: 4 }}>{summary.submitted}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Total student turn-ins</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>To Be Graded</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#8B5CF6', marginTop: 4 }}>{summary.to_be_graded}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Needs teacher evaluation</div>
          </div>
          <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Graded</div>
            <div style={{ fontSize: 28, fontWeight: 750, color: '#10B981', marginTop: 4 }}>{summary.graded}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Evaluated with feedback</div>
          </div>
        </div>
      )}

      {/* Main List */}
      <SurfacePanel title="My Assignments" actions={<span style={mutedText}>{assignments.length} assignments</span>}>
        {loading && <p style={{ ...mutedText, margin: '16px 0' }}>Loading assignments…</p>}
        {error && <div style={{ color: '#DC2626', padding: '12px 0' }}>{error}</div>}
        {!loading && !error && assignments.length === 0 && (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
            <div style={{ fontWeight: 650, fontSize: 16, color: '#1E293B' }}>No assignments created yet</div>
            <p style={{ ...mutedText, marginTop: 4, maxWidth: 420, margin: '4px auto 16px' }}>
              Create your first assignment and assign it to your students from the curriculum structure.
            </p>
            <button type="button" onClick={handleOpenCreateModal} style={primaryButton}>
              Create Assignment
            </button>
          </div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 780 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Assignment</th>
                  <th style={{ padding: '10px 12px' }}>Curriculum</th>
                  <th style={{ padding: '10px 12px' }}>Due Date</th>
                  <th style={{ padding: '10px 12px' }}>Max Score</th>
                  <th style={{ padding: '10px 12px' }}>Assigned</th>
                  <th style={{ padding: '10px 12px' }}>Submissions</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(assign => (
                  <tr key={assign.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 650, color: '#0F172A' }}>{assign.title}</div>
                      <div style={{ ...mutedText, fontSize: 12, marginTop: 2, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {assign.description}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{assign.subject_name}</div>
                      <div style={{ ...mutedText, fontSize: 11 }}>
                        {assign.chapter_title} {assign.topic_title ? `· ${assign.topic_title}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#334155' }}>
                      {new Date(assign.due_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#0F172A' }}>
                      {assign.total_points} pts
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 999, backgroundColor: '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 600 }}>
                        {assign.assigned_students_count} students
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: 11, fontWeight: 700 }}>
                          {assign.submissions_count} submitted
                        </span>
                        <span style={{ padding: '3px 8px', borderRadius: 999, backgroundColor: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 700 }}>
                          {assign.graded_count} graded
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleViewSubmissions(assign)}
                          style={{ ...secondaryButton, padding: '6px 12px', fontSize: 12 }}
                        >
                          Submissions
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(assign.id, assign.title)}
                          style={dangerButton}
                          title="Delete assignment"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfacePanel>

      {/* CREATE ASSIGNMENT MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 750, color: '#0F172A', margin: 0 }}>Create New Assignment</h2>
                <p style={{ ...mutedText, margin: '4px 0 0' }}>Assign curriculum tasks to your assigned students</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                  Assignment Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Array Implementation Practice"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Subject -> Chapter -> Topic hierarchy */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Subject *
                  </label>
                  <select
                    value={formSubjectId}
                    onChange={e => handleSubjectChange(Number(e.target.value))}
                    style={inputStyle}
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Chapter *
                  </label>
                  <select
                    value={formChapterId}
                    onChange={e => handleChapterChange(Number(e.target.value))}
                    style={inputStyle}
                    disabled={!formSubjectId || chapters.length === 0}
                    required
                  >
                    <option value="">{chapters.length === 0 ? 'No chapters found' : 'Select Chapter'}</option>
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Topic (Optional)
                  </label>
                  <select
                    value={formTopicId}
                    onChange={e => setFormTopicId(e.target.value ? Number(e.target.value) : '')}
                    style={inputStyle}
                    disabled={!formChapterId}
                  >
                    <option value="">Select Topic (Optional)</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                  Description / Instructions *
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the instructions, questions, or requirements for this assignment..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
                    Total Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formTotalPoints}
                    onChange={e => setFormTotalPoints(Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Student Selection (Strictly assigned teacher_students) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 650, color: '#334155' }}>
                    Assign To Students ({selectedStudentIds.length} of {assignedStudents.length} selected) *
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllStudents}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {selectedStudentIds.length === assignedStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {assignedStudents.length === 0 ? (
                  <p style={{ ...mutedText, margin: 0, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                    No students currently assigned to your teacher account. Contact your administrator to connect students.
                  </p>
                ) : (
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: '#F8FAFC' }}>
                    {assignedStudents.map(student => (
                      <label
                        key={student.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', backgroundColor: selectedStudentIds.includes(student.id) ? '#EFF6FF' : 'transparent' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => handleToggleStudent(student.id)}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{student.name}</span>
                        <span style={{ fontSize: 11, color: '#64748B' }}>({student.student_id}{student.class_name ? ` · Class ${student.class_name}` : ''})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || assignedStudents.length === 0}
                  style={primaryButton}
                >
                  {actionLoading ? 'Publishing…' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMISSIONS & GRADING MODAL */}
      {showSubmissionsModal && activeAssignment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                  {activeAssignment.subject_name} · {activeAssignment.chapter_title}
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 750, color: '#0F172A', margin: '4px 0 0' }}>
                  {activeAssignment.title}
                </h2>
                <p style={{ ...mutedText, margin: '4px 0 0' }}>
                  Due: {new Date(activeAssignment.due_date).toLocaleString()} · Total Points: {activeAssignment.total_points}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowSubmissionsModal(false); setGradingSubmission(null); }}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {/* Instruction Callout */}
            <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 20, fontSize: 13, color: '#334155' }}>
              <strong>Instructions:</strong> {activeAssignment.description}
            </div>

            {/* Submissions List */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Student</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Submitted At</th>
                    <th style={{ padding: '8px 12px' }}>Score</th>
                    <th style={{ padding: '8px 12px' }}>Feedback</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssignment.submissions.map(sub => {
                    const badge = getStatusBadge(sub.status);
                    return (
                      <tr key={sub.student_id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 650, color: '#0F172A' }}>{sub.student_name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{sub.student_code}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 999, backgroundColor: badge.bg, color: badge.text, fontSize: 11, fontWeight: 700 }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#64748B' }}>
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 650, color: '#0F172A' }}>
                          {sub.score !== null && sub.score !== undefined ? `${sub.score} / ${sub.max_score}` : '—'}
                        </td>
                        <td style={{ padding: '12px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.feedback || '—'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenGradeModal(sub)}
                            style={{ ...primaryButton, padding: '5px 12px', fontSize: 12 }}
                          >
                            {sub.status === 'GRADED' ? 'Edit Grade' : 'Grade'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* GRADING INLINE / SUB-MODAL */}
            {gradingSubmission && (
              <div style={{ marginTop: 24, padding: 20, borderRadius: 12, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#166534', margin: '0 0 12px' }}>
                  Grade Submission: {gradingSubmission.student_name} ({gradingSubmission.student_code})
                </h3>

                {/* Student Submission Content */}
                <div style={{ marginBottom: 16, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                    Student Submission Text
                  </div>
                  <div style={{ fontSize: 14, color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                    {gradingSubmission.submission_text || <span style={{ color: '#94A3B8' }}>No text submission provided.</span>}
                  </div>
                  {gradingSubmission.file_url && (
                    <div style={{ marginTop: 10 }}>
                      <a
                        href={gradingSubmission.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563EB', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }}
                      >
                        📎 View Submitted Attachment
                      </a>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#166534', marginBottom: 4 }}>
                        Score (max {activeAssignment.total_points}) *
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={activeAssignment.total_points}
                        value={gradeScore}
                        onChange={e => setGradeScore(e.target.value)}
                        placeholder={`0 - ${activeAssignment.total_points}`}
                        style={inputStyle}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#166534', marginBottom: 4 }}>
                        Teacher Feedback
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Good understanding of arrays. Review zero-based indexing."
                        value={gradeFeedback}
                        onChange={e => setGradeFeedback(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setGradingSubmission(null)}
                      style={secondaryButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      style={{ ...primaryButton, backgroundColor: '#16A34A' }}
                    >
                      {actionLoading ? 'Saving…' : 'Submit Grade & Feedback'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
