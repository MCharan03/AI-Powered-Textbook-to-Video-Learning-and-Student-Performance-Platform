import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { Student, StudentDetail, PaginatedResponse, SubjectItem, Parent } from '../../lib/types';

interface AdminStudentsProps {
  onNavigate?: (route: string, params?: any) => void;
  selectedStudentId?: number;
}

export const AdminStudents: React.FC<AdminStudentsProps> = ({ onNavigate, selectedStudentId }) => {
  const [data, setData] = useState<PaginatedResponse<Student>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Search/Filter states
  const [studentIdFilter, setStudentIdFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentDetail | null>(null);

  // Form states
  const [formStudentId, setFormStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formClass, setFormClass] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formRoll, setFormRoll] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Linking states in detail modal
  const [linkParentId, setLinkParentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('Father');
  const [allParents, setAllParents] = useState<Parent[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [assignSubjectId, setAssignSubjectId] = useState<number | ''>('');

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.listStudents({
        page,
        page_size: pageSize,
        student_id: studentIdFilter || undefined,
        name: nameFilter || undefined,
        class: classFilter || undefined,
        section: sectionFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Failed to load students: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    try {
      const pRes = await api.listParents({ page: 1, page_size: 100 });
      setAllParents(pRes.items || []);
      const sRes = await api.listSubjects({ page: 1, page_size: 100 });
      setAllSubjects('items' in sRes ? sRes.items : (sRes as any));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, pageSize]);

  useEffect(() => {
    loadAuxData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      openDetail(selectedStudentId);
    }
  }, [selectedStudentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleClearFilters = () => {
    setStudentIdFilter('');
    setNameFilter('');
    setClassFilter('');
    setSectionFilter('');
    setPage(1);
    setTimeout(() => {
      api.listStudents({ page: 1, page_size: pageSize }).then(setData);
    }, 0);
  };

  const openCreateModal = () => {
    setEditingStudent(null);
    setFormStudentId('');
    setFormName('');
    setFormDob('');
    setFormClass('');
    setFormSection('');
    setFormRoll('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setFormStudentId(s.student_id);
    setFormName(s.name);
    setFormDob(s.dob || '');
    setFormClass(s.class || '');
    setFormSection(s.section || '');
    setFormRoll(s.roll_number || '');
    setFormEmail(s.email || '');
    setFormPhone(s.phone || '');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openDetail = async (id: number) => {
    try {
      const detail = await api.getStudent(id);
      setSelectedStudentDetail(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setMessage({ text: `Failed to load student details: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, {
          name: formName,
          dob: formDob || undefined,
          class: formClass || undefined,
          section: formSection || undefined,
          roll_number: formRoll || undefined,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword || undefined,
        });
        setMessage({ text: `Student ${formName} updated successfully.`, type: 'success' });
      } else {
        await api.createStudent({
          student_id: formStudentId,
          name: formName,
          dob: formDob || undefined,
          class: formClass || undefined,
          section: formSection || undefined,
          roll_number: formRoll || undefined,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword,
        });
        setMessage({ text: `Student ${formName} (${formStudentId}) created successfully.`, type: 'success' });
      }
      setCreateModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (s: Student) => {
    if (!window.confirm(`Are you sure you want to deactivate ${s.name} (${s.student_id})? Historical academic records will be preserved.`)) {
      return;
    }
    try {
      await api.deleteStudent(s.id);
      setMessage({ text: `Student ${s.name} deactivated.`, type: 'success' });
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentDetail || !linkParentId) return;
    try {
      await api.linkStudentParent(selectedStudentDetail.id, {
        parent_id: linkParentId,
        relationship: linkRelationship,
      });
      setMessage({ text: 'Parent linked successfully.', type: 'success' });
      const updated = await api.getStudent(selectedStudentDetail.id);
      setSelectedStudentDetail(updated);
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleUnlinkParent = async (parentId: string | number) => {
    if (!selectedStudentDetail) return;
    try {
      await api.unlinkStudentParent(selectedStudentDetail.id, parentId);
      setMessage({ text: 'Parent unlinked successfully.', type: 'success' });
      const updated = await api.getStudent(selectedStudentDetail.id);
      setSelectedStudentDetail(updated);
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleAssignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentDetail || !assignSubjectId) return;
    try {
      await api.assignStudentSubject(selectedStudentDetail.id, Number(assignSubjectId));
      setMessage({ text: 'Subject assigned successfully.', type: 'success' });
      const updated = await api.getStudent(selectedStudentDetail.id);
      setSelectedStudentDetail(updated);
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleUnassignSubject = async (subjId: number) => {
    if (!selectedStudentDetail) return;
    try {
      await api.unassignStudentSubject(selectedStudentDetail.id, subjId);
      setMessage({ text: 'Subject unassigned successfully.', type: 'success' });
      const updated = await api.getStudent(selectedStudentDetail.id);
      setSelectedStudentDetail(updated);
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const columns: Column<Student>[] = [
    {
      key: 'student_id',
      header: 'Student ID',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)', fontFamily: 'monospace' }}>
          {row.student_id}
        </span>
      ),
    },
    { key: 'name', header: 'Student Name' },
    { key: 'class', header: 'Class', render: (row) => row.class || '—' },
    { key: 'section', header: 'Section', render: (row) => row.section || '—' },
    { key: 'roll_number', header: 'Roll #', render: (row) => row.roll_number || '—' },
    {
      key: 'assigned_subjects',
      header: 'Assigned Subjects',
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
          {row.assigned_subjects && row.assigned_subjects.length > 0
            ? row.assigned_subjects.slice(0, 2).join(', ') + (row.assigned_subjects.length > 2 ? '...' : '')
            : 'None'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: row.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: row.is_active ? '#34D399' : '#F87171',
          }}
        >
          {row.is_active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '180px',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => openDetail(row.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid var(--admin-border)',
              backgroundColor: 'transparent',
              color: 'var(--admin-text)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            View
          </button>
          <button
            onClick={() => openEditModal(row)}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid var(--admin-border)',
              backgroundColor: 'transparent',
              color: '#60A5FA',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          {row.is_active && (
            <button
              onClick={() => handleDeactivate(row)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'transparent',
                color: '#EF4444',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Student Management
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Manage student records, credentials, class enrollments, and parent associations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--admin-primary)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          + Add New Student
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: message.type === 'success' ? '#34D399' : '#F87171',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter / Search Panel */}
      <SurfacePanel title="Filter & Search Students">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Student ID
            </label>
            <input
              type="text"
              placeholder="e.g. CMRIT26ECE001"
              value={studentIdFilter}
              onChange={(e) => setStudentIdFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--admin-text)',
                fontSize: '13px',
              }}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Student Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alice"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--admin-text)',
                fontSize: '13px',
              }}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Class
            </label>
            <input
              type="text"
              placeholder="e.g. 10th"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--admin-text)',
                fontSize: '13px',
              }}
            />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Section
            </label>
            <input
              type="text"
              placeholder="e.g. A"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--admin-text)',
                fontSize: '13px',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'transparent',
                color: 'var(--admin-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </SurfacePanel>

      {/* Students Data Table */}
      <SurfacePanel title={`Students Directory (${data.total} total)`}>
        <DataTable columns={columns} data={data.items} emptyMessage="No students match the selected filters." />

        {/* Pagination Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--admin-text-secondary)',
          }}
        >
          <div>
            Showing {data.items.length} of {data.total} records (Page {data.page} of {data.total_pages})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: page <= 1 ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                color: page <= 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--admin-text)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{page}</span>
            <button
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: page >= data.total_pages ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                color: page >= data.total_pages ? 'rgba(255, 255, 255, 0.2)' : 'var(--admin-text)',
                cursor: page >= data.total_pages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--admin-border)',
                backgroundColor: 'var(--admin-surface)',
                color: 'var(--admin-text)',
                fontSize: '12px',
              }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>
      </SurfacePanel>

      {/* Create / Edit Student Modal */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              padding: '24px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)', marginBottom: '16px' }}>
              {editingStudent ? `Edit Student: ${editingStudent.student_id}` : 'Create New Student Account'}
            </h2>
            <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Student ID (Unique Login ID) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingStudent}
                    placeholder="e.g. CMRIT26ECE001"
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: editingStudent ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alice Smith"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Class
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10th Grade"
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Roll Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24"
                    value={formRoll}
                    onChange={(e) => setFormRoll(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1-555-0100"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--admin-border)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--admin-text)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  {editingStudent ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingStudent}
                  placeholder={editingStudent ? '••••••••' : 'Enter strong student password'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--admin-text-secondary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Saving...' : (editingStudent ? 'Save Changes' : 'Create Student')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {detailModalOpen && selectedStudentDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              padding: '24px',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  {selectedStudentDetail.name} ({selectedStudentDetail.student_id})
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  Class: {selectedStudentDetail.class || 'N/A'} | Section: {selectedStudentDetail.section || 'N/A'} | Roll #: {selectedStudentDetail.roll_number || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Parents Linkage Section */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--admin-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px' }}>
                Linked Parents & Guardians
              </h3>
              {selectedStudentDetail.parents.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No parents linked yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {selectedStudentDetail.parents.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: '#818CF8', marginRight: '8px' }}>
                          [{p.relationship}]
                        </span>
                        <span style={{ color: 'var(--admin-text)', fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginLeft: '8px' }}>
                          ({p.parent_id})
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnlinkParent(p.parent_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Link Parent Form */}
              <form onSubmit={handleLinkParent} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <select
                  required
                  value={linkParentId}
                  onChange={(e) => setLinkParentId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface)',
                    color: 'var(--admin-text)',
                    fontSize: '12px',
                  }}
                >
                  <option value="">Select Parent to Link...</option>
                  {allParents.map((p) => (
                    <option key={p.id} value={p.parent_id}>
                      {p.name} ({p.parent_id})
                    </option>
                  ))}
                </select>
                <select
                  value={linkRelationship}
                  onChange={(e) => setLinkRelationship(e.target.value)}
                  style={{
                    width: '120px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface)',
                    color: 'var(--admin-text)',
                    fontSize: '12px',
                  }}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                </select>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Link
                </button>
              </form>
            </div>

            {/* Assigned Subjects Section */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--admin-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px' }}>
                Enrolled Subjects
              </h3>
              {selectedStudentDetail.subjects.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No subjects assigned yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {selectedStudentDetail.subjects.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        border: '1px solid rgba(37, 99, 235, 0.3)',
                        color: '#60A5FA',
                        fontSize: '12px',
                      }}
                    >
                      <span>{sub.name}</span>
                      <button
                        onClick={() => handleUnassignSubject(sub.subject_id)}
                        style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign Subject Form */}
              <form onSubmit={handleAssignSubject} style={{ display: 'flex', gap: '8px' }}>
                <select
                  required
                  value={assignSubjectId}
                  onChange={(e) => setAssignSubjectId(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface)',
                    color: 'var(--admin-text)',
                    fontSize: '12px',
                  }}
                >
                  <option value="">Select Subject to Assign...</option>
                  {allSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.class || 'All Classes'})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Assign
                </button>
              </form>
            </div>

            {/* Assigned Teachers Section */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--admin-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
                Assigned Teachers
              </h3>
              {selectedStudentDetail.teachers.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No teachers assigned to this student.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedStudentDetail.teachers.map((t) => (
                    <span
                      key={t.id}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        fontSize: '12px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      {t.name} ({t.teacher_id})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {selectedStudentDetail.recent_activity && selectedStudentDetail.recent_activity.length > 0 && (
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--admin-border)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
                  Recent Activity
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedStudentDetail.recent_activity.map((act, idx) => (
                    <div key={idx} style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <strong style={{ color: act.type === 'video' ? '#60A5FA' : '#34D399' }}>
                          [{act.type.toUpperCase()}]
                        </strong>{' '}
                        {act.title}
                      </span>
                      <span>{act.completed ? 'Completed' : (act.score !== undefined ? `${act.percentage}%` : 'In Progress')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
