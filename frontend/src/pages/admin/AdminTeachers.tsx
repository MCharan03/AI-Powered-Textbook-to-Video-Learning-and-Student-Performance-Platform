import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { Teacher, TeacherDetail, PaginatedResponse, Student } from '../../lib/types';

interface AdminTeachersProps {
  onNavigate?: (route: string, params?: any) => void;
  selectedTeacherId?: number;
}

export const AdminTeachers: React.FC<AdminTeachersProps> = ({ onNavigate, selectedTeacherId }) => {
  const [data, setData] = useState<PaginatedResponse<Teacher>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Search/Filter states
  const [teacherIdFilter, setTeacherIdFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacherDetail, setSelectedTeacherDetail] = useState<TeacherDetail | null>(null);

  // Form states
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Assign student states in detail
  const [assignStudentId, setAssignStudentId] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await api.listTeachers({
        page,
        page_size: pageSize,
        teacher_id: teacherIdFilter || undefined,
        name: nameFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Failed to load teachers: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAuxStudents = async () => {
    try {
      const sRes = await api.listStudents({ page: 1, page_size: 100 });
      setAllStudents(sRes.items || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [page, pageSize]);

  useEffect(() => {
    loadAuxStudents();
  }, []);

  useEffect(() => {
    if (selectedTeacherId) {
      openDetail(selectedTeacherId);
    }
  }, [selectedTeacherId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTeachers();
  };

  const handleClearFilters = () => {
    setTeacherIdFilter('');
    setNameFilter('');
    setPage(1);
    setTimeout(() => {
      api.listTeachers({ page: 1, page_size: pageSize }).then(setData);
    }, 0);
  };

  const openCreateModal = () => {
    setEditingTeacher(null);
    setFormTeacherId('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacher(t);
    setFormTeacherId(t.teacher_id);
    setFormName(t.name);
    setFormEmail(t.email || '');
    setFormPhone(t.phone || '');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openDetail = async (id: number) => {
    try {
      const detail = await api.getTeacher(id);
      setSelectedTeacherDetail(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setMessage({ text: `Failed to load teacher details: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingTeacher) {
        await api.updateTeacher(editingTeacher.id, {
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword || undefined,
        });
        setMessage({ text: `Teacher ${formName} updated successfully.`, type: 'success' });
      } else {
        await api.createTeacher({
          teacher_id: formTeacherId,
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword,
        });
        setMessage({ text: `Teacher ${formName} (${formTeacherId}) created successfully.`, type: 'success' });
      }
      setCreateModalOpen(false);
      fetchTeachers();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (t: Teacher) => {
    if (!window.confirm(`Are you sure you want to deactivate ${t.name} (${t.teacher_id})?`)) {
      return;
    }
    try {
      await api.deleteTeacher(t.id);
      setMessage({ text: `Teacher ${t.name} deactivated.`, type: 'success' });
      fetchTeachers();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherDetail || !assignStudentId) return;
    try {
      await api.assignTeacherStudent(selectedTeacherDetail.id, assignStudentId);
      setMessage({ text: 'Student assigned to teacher successfully.', type: 'success' });
      const updated = await api.getTeacher(selectedTeacherDetail.id);
      setSelectedTeacherDetail(updated);
      fetchTeachers();
      setAssignStudentId('');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleUnassignStudent = async (studentId: string | number) => {
    if (!selectedTeacherDetail) return;
    try {
      await api.unassignTeacherStudent(selectedTeacherDetail.id, studentId);
      setMessage({ text: 'Student unassigned from teacher.', type: 'success' });
      const updated = await api.getTeacher(selectedTeacherDetail.id);
      setSelectedTeacherDetail(updated);
      fetchTeachers();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const columns: Column<Teacher>[] = [
    {
      key: 'teacher_id',
      header: 'Teacher ID',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)', fontFamily: 'monospace' }}>
          {row.teacher_id}
        </span>
      ),
    },
    { key: 'name', header: 'Faculty Name' },
    { key: 'email', header: 'Email Address', render: (row) => row.email || '—' },
    { key: 'phone', header: 'Phone Number', render: (row) => row.phone || '—' },
    {
      key: 'assigned_students_count',
      header: 'Assigned Students',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#60A5FA' }}>
          {row.assigned_students_count} Students
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
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Teacher Management
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Manage instructors, credentials, assigned classrooms, and student rosters.
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
          + Add New Teacher
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
      <SurfacePanel title="Filter & Search Teachers">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Teacher ID
            </label>
            <input
              type="text"
              placeholder="e.g. TCH001"
              value={teacherIdFilter}
              onChange={(e) => setTeacherIdFilter(e.target.value)}
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
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Teacher Name
            </label>
            <input
              type="text"
              placeholder="e.g. Carol"
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

      {/* Teachers Data Table */}
      <SurfacePanel title={`Teachers Directory (${data.total} total)`}>
        <DataTable columns={columns} data={data.items} emptyMessage="No teachers found matching the filter criteria." />

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

      {/* Create / Edit Modal */}
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
              maxWidth: '500px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)', marginBottom: '16px' }}>
              {editingTeacher ? `Edit Teacher: ${editingTeacher.teacher_id}` : 'Create New Teacher Account'}
            </h2>
            <form onSubmit={handleSaveTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Teacher ID (Unique Login ID) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingTeacher}
                  placeholder="e.g. TCH001"
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: editingTeacher ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Faculty Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Carol Danvers"
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="teacher@institution.edu"
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
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+1-555-0400"
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

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  {editingTeacher ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingTeacher}
                  placeholder={editingTeacher ? '••••••••' : 'Enter strong teacher password'}
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
                  {submitting ? 'Saving...' : (editingTeacher ? 'Save Changes' : 'Create Teacher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Detail Modal */}
      {detailModalOpen && selectedTeacherDetail && (
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
              maxWidth: '700px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--admin-border)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  {selectedTeacherDetail.name} ({selectedTeacherDetail.teacher_id})
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  Email: {selectedTeacherDetail.email || 'N/A'} | Phone: {selectedTeacherDetail.phone || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--admin-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px' }}>
                Assigned Students Roster ({selectedTeacherDetail.assigned_students.length})
              </h3>
              {selectedTeacherDetail.assigned_students.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  No students currently assigned to this teacher.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {selectedTeacherDetail.assigned_students.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{st.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginLeft: '8px' }}>
                          ({st.student_id}) {st.class ? `• ${st.class}` : ''} {st.section ? `Sec ${st.section}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnassignStudent(st.student_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Unassign
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign Student Form */}
              <form onSubmit={handleAssignStudent} style={{ display: 'flex', gap: '8px' }}>
                <select
                  required
                  value={assignStudentId}
                  onChange={(e) => setAssignStudentId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                  }}
                >
                  <option value="">Select Student to Assign...</option>
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.student_id}>
                      {s.name} ({s.student_id}) {s.class ? `• ${s.class}` : ''}
                    </option>
                  ))}
                </select>
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
                  + Assign Student
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
