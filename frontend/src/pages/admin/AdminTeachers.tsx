import React, { useState, useEffect } from 'react';
import { Plus, Eye, Pencil, UserX } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { ActionMenu } from '../../components/admin/ActionMenu';
import { Pagination } from '../../components/admin/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import { FormField } from '../../components/admin/FormField';
import { LoadingState } from '../../components/admin/LoadingState';
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
  const [deactivateTarget, setDeactivateTarget] = useState<Teacher | null>(null);

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

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const t = deactivateTarget;
    try {
      await api.deleteTeacher(t.id);
      setMessage({ text: `Teacher ${t.name} deactivated.`, type: 'success' });
      fetchTeachers();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setDeactivateTarget(null);
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
    {
      key: 'name',
      header: 'Faculty Name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{row.name}</span>,
    },
    { key: 'email', header: 'Email Address', render: (row) => row.email || '—' },
    { key: 'phone', header: 'Phone Number', render: (row) => row.phone || '—' },
    {
      key: 'assigned_students_count',
      header: 'Assigned Students',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>{row.assigned_students_count} Students</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => <StatusBadge status={row.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '56px',
      align: 'right',
      render: (row) => (
        <ActionMenu
          ariaLabel={`Actions for teacher ${row.name}`}
          items={[
            { label: 'View', icon: <Eye size={14} />, onClick: () => openDetail(row.id) },
            { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEditModal(row) },
            ...(row.is_active
              ? [
                  {
                    label: 'Deactivate',
                    icon: <UserX size={14} />,
                    danger: true,
                    onClick: () => setDeactivateTarget(row),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Teachers"
        description="Manage instructors, credentials, assigned classrooms, and student rosters."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openCreateModal}>
            <Plus size={15} />
            Add Teacher
          </button>
        }
      />

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Filter / Search Panel */}
      <SurfacePanel title="Filter & Search Teachers">
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}
        >
          <FormField
            label="Teacher ID"
            name="filter-teacher-id"
            value={teacherIdFilter}
            onChange={setTeacherIdFilter}
            placeholder="e.g. TCH001"
            style={{ flex: '1 1 200px' }}
          />
          <FormField
            label="Teacher Name"
            name="filter-teacher-name"
            value={nameFilter}
            onChange={setNameFilter}
            placeholder="e.g. Carol"
            style={{ flex: '1 1 200px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="adm-btn adm-btn-primary">
              Filter
            </button>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={handleClearFilters}>
              Reset
            </button>
          </div>
        </form>
      </SurfacePanel>

      {/* Teachers Data Table */}
      <SurfacePanel title={`Teachers Directory (${data.total} total)`}>
        {loading ? (
          <LoadingState variant="table" rows={5} label="Loading teachers…" />
        ) : (
          <DataTable
            columns={columns}
            data={data.items}
            emptyMessage="No teachers found matching the filter criteria."
          />
        )}

        <Pagination
          page={page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfacePanel>

      {/* Create / Edit Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingTeacher ? `Edit Teacher: ${editingTeacher.teacher_id}` : 'Create New Teacher Account'}
        maxWidth={520}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="admin-teacher-form"
              className="adm-btn adm-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingTeacher ? 'Save Changes' : 'Create Teacher'}
            </button>
          </>
        }
      >
        <form
          id="admin-teacher-form"
          onSubmit={handleSaveTeacher}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <FormField
            label="Teacher ID (Unique Login ID)"
            name="teacher-id"
            required
            disabled={!!editingTeacher}
            placeholder="e.g. TCH001"
            value={formTeacherId}
            onChange={setFormTeacherId}
          />

          <FormField
            label="Faculty Name"
            name="teacher-name"
            required
            placeholder="e.g. Prof. Carol Danvers"
            value={formName}
            onChange={setFormName}
          />

          <FormField
            label="Email Address"
            name="teacher-email"
            type="email"
            placeholder="teacher@institution.edu"
            value={formEmail}
            onChange={setFormEmail}
          />

          <FormField
            label="Phone Number"
            name="teacher-phone"
            type="tel"
            placeholder="+1-555-0400"
            value={formPhone}
            onChange={setFormPhone}
          />

          <FormField
            label={editingTeacher ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password'}
            name="teacher-password"
            type="password"
            required={!editingTeacher}
            placeholder={editingTeacher ? '••••••••' : 'Enter strong teacher password'}
            value={formPassword}
            onChange={setFormPassword}
          />
        </form>
      </Modal>

      {/* Teacher Detail Modal */}
      <Modal
        open={detailModalOpen && !!selectedTeacherDetail}
        onClose={() => setDetailModalOpen(false)}
        title={
          selectedTeacherDetail ? `${selectedTeacherDetail.name} (${selectedTeacherDetail.teacher_id})` : 'Teacher Details'
        }
        subtitle={
          selectedTeacherDetail
            ? `Email: ${selectedTeacherDetail.email || '—'} | Phone: ${selectedTeacherDetail.phone || '—'}`
            : undefined
        }
        maxWidth={720}
      >
        {selectedTeacherDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="adm-card" style={{ padding: '16px' }}>
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
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface-raised)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{st.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginLeft: '8px' }}>
                          ({st.student_id}) {st.class ? `• ${st.class}` : ''} {st.section ? `Sec ${st.section}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost adm-btn-sm"
                        style={{ color: 'var(--admin-error)' }}
                        onClick={() => handleUnassignStudent(st.student_id)}
                      >
                        Unassign
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Assign Student Form */}
              <form
                onSubmit={handleAssignStudent}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}
              >
                <FormField
                  label="Student"
                  name="assign-student"
                  type="select"
                  required
                  value={assignStudentId}
                  onChange={setAssignStudentId}
                  options={[
                    { value: '', label: 'Select Student to Assign...' },
                    ...allStudents.map((s) => ({
                      value: s.student_id,
                      label: `${s.name} (${s.student_id}) ${s.class ? `• ${s.class}` : ''}`,
                    })),
                  ]}
                  style={{ flex: '1 1 220px' }}
                />
                <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm">
                  <Plus size={14} />
                  Assign Student
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate Teacher"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.name} (${deactivateTarget.teacher_id})?`
            : ''
        }
        confirmLabel="Deactivate"
        danger
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
};
