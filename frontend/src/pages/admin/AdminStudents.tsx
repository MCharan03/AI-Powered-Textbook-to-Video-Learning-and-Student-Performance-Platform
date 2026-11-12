import React, { useState, useEffect } from 'react';
import { Plus, Eye, Pencil, UserX, X } from 'lucide-react';
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
  const [deactivateTarget, setDeactivateTarget] = useState<Student | null>(null);

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

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const s = deactivateTarget;
    try {
      await api.deleteStudent(s.id);
      setMessage({ text: `Student ${s.name} deactivated.`, type: 'success' });
      fetchStudents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setDeactivateTarget(null);
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
    {
      key: 'name',
      header: 'Student Name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{row.name}</span>,
    },
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
      render: (row) => <StatusBadge status={row.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '56px',
      align: 'right',
      render: (row) => (
        <ActionMenu
          ariaLabel={`Actions for student ${row.name}`}
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
        title="Students"
        description="Manage student records, credentials, class enrollments, and parent associations."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openCreateModal}>
            <Plus size={15} />
            Add Student
          </button>
        }
      />

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Filter / Search Panel */}
      <SurfacePanel title="Filter & Search Students">
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}
        >
          <FormField
            label="Student ID"
            name="filter-student-id"
            value={studentIdFilter}
            onChange={setStudentIdFilter}
            placeholder="e.g. CMRIT26ECE001"
            style={{ flex: '1 1 180px' }}
          />
          <FormField
            label="Student Name"
            name="filter-name"
            value={nameFilter}
            onChange={setNameFilter}
            placeholder="e.g. Alice"
            style={{ flex: '1 1 180px' }}
          />
          <FormField
            label="Class"
            name="filter-class"
            value={classFilter}
            onChange={setClassFilter}
            placeholder="e.g. 10th"
            style={{ flex: '1 1 140px' }}
          />
          <FormField
            label="Section"
            name="filter-section"
            value={sectionFilter}
            onChange={setSectionFilter}
            placeholder="e.g. A"
            style={{ flex: '1 1 100px' }}
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

      {/* Students Data Table */}
      <SurfacePanel title={`Students Directory (${data.total} total)`}>
        {loading ? (
          <LoadingState variant="table" rows={5} label="Loading students…" />
        ) : (
          <DataTable columns={columns} data={data.items} emptyMessage="No students match the selected filters." />
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

      {/* Create / Edit Student Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingStudent ? `Edit Student: ${editingStudent.student_id}` : 'Create New Student Account'}
        maxWidth={640}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="admin-student-form"
              className="adm-btn adm-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingStudent ? 'Save Changes' : 'Create Student'}
            </button>
          </>
        }
      >
        <form
          id="admin-student-form"
          onSubmit={handleSaveStudent}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <FormField
              label="Student ID (Unique Login ID)"
              name="student-id"
              required
              disabled={!!editingStudent}
              placeholder="e.g. CMRIT26ECE001"
              value={formStudentId}
              onChange={setFormStudentId}
            />
            <FormField
              label="Full Name"
              name="student-name"
              required
              placeholder="e.g. Alice Smith"
              value={formName}
              onChange={setFormName}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <FormField
              label="Class"
              name="student-class"
              placeholder="e.g. 10th Grade"
              value={formClass}
              onChange={setFormClass}
            />
            <FormField
              label="Section"
              name="student-section"
              placeholder="e.g. A"
              value={formSection}
              onChange={setFormSection}
            />
            <FormField
              label="Roll Number"
              name="student-roll"
              placeholder="e.g. 24"
              value={formRoll}
              onChange={setFormRoll}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <FormField
              label="Date of Birth"
              name="student-dob"
              type="date"
              value={formDob}
              onChange={setFormDob}
            />
            <FormField
              label="Phone"
              name="student-phone"
              placeholder="+1-555-0100"
              value={formPhone}
              onChange={setFormPhone}
            />
          </div>

          <FormField
            label="Email Address"
            name="student-email"
            type="email"
            placeholder="student@example.com"
            value={formEmail}
            onChange={setFormEmail}
          />

          <FormField
            label={editingStudent ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password'}
            name="student-password"
            type="password"
            required={!editingStudent}
            placeholder={editingStudent ? '••••••••' : 'Enter strong student password'}
            value={formPassword}
            onChange={setFormPassword}
          />
        </form>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        open={detailModalOpen && !!selectedStudentDetail}
        onClose={() => setDetailModalOpen(false)}
        title={
          selectedStudentDetail
            ? `${selectedStudentDetail.name} (${selectedStudentDetail.student_id})`
            : 'Student Details'
        }
        subtitle={
          selectedStudentDetail
            ? `Class: ${selectedStudentDetail.class || '—'} | Section: ${selectedStudentDetail.section || '—'} | Roll #: ${selectedStudentDetail.roll_number || '—'}`
            : undefined
        }
        maxWidth={760}
      >
        {selectedStudentDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Parents Linkage Section */}
            <div className="adm-card" style={{ padding: '16px' }}>
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
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface-raised)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span
                          className="adm-badge"
                          style={{
                            backgroundColor: 'var(--admin-primary-soft)',
                            color: 'var(--admin-primary)',
                            marginRight: '8px',
                          }}
                        >
                          {p.relationship}
                        </span>
                        <span style={{ color: 'var(--admin-text)', fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginLeft: '8px' }}>
                          ({p.parent_id})
                        </span>
                      </div>
                      <button
                        type="button"
                        className="adm-btn adm-btn-ghost adm-btn-sm"
                        style={{ color: 'var(--admin-error)' }}
                        onClick={() => handleUnlinkParent(p.parent_id)}
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Link Parent Form */}
              <form
                onSubmit={handleLinkParent}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}
              >
                <FormField
                  label="Parent"
                  name="link-parent"
                  type="select"
                  required
                  value={linkParentId}
                  onChange={setLinkParentId}
                  options={[
                    { value: '', label: 'Select Parent to Link...' },
                    ...allParents.map((p) => ({ value: p.parent_id, label: `${p.name} (${p.parent_id})` })),
                  ]}
                  style={{ flex: '1 1 220px' }}
                />
                <FormField
                  label="Relationship"
                  name="link-relationship"
                  type="select"
                  value={linkRelationship}
                  onChange={setLinkRelationship}
                  options={[
                    { value: 'Father', label: 'Father' },
                    { value: 'Mother', label: 'Mother' },
                    { value: 'Guardian', label: 'Guardian' },
                  ]}
                  style={{ width: '150px' }}
                />
                <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm">
                  <Plus size={14} />
                  Link
                </button>
              </form>
            </div>

            {/* Assigned Subjects Section */}
            <div className="adm-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px' }}>
                Enrolled Subjects
              </h3>
              {selectedStudentDetail.subjects.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No subjects assigned yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {selectedStudentDetail.subjects.map((sub) => (
                    <span
                      key={sub.id}
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                    >
                      {sub.name}
                      <button
                        type="button"
                        aria-label={`Unassign ${sub.name}`}
                        onClick={() => handleUnassignSubject(sub.subject_id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'inherit',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Assign Subject Form */}
              <form
                onSubmit={handleAssignSubject}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}
              >
                <FormField
                  label="Subject"
                  name="assign-subject"
                  type="select"
                  required
                  value={assignSubjectId}
                  onChange={(v) => setAssignSubjectId(v === '' ? '' : Number(v))}
                  options={[
                    { value: '', label: 'Select Subject to Assign...' },
                    ...allSubjects.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.class || 'All Classes'})`,
                    })),
                  ]}
                  style={{ flex: '1 1 220px' }}
                />
                <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm">
                  <Plus size={14} />
                  Assign
                </button>
              </form>
            </div>

            {/* Assigned Teachers Section */}
            <div className="adm-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
                Assigned Teachers
              </h3>
              {selectedStudentDetail.teachers.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  No teachers assigned to this student.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedStudentDetail.teachers.map((t) => (
                    <span
                      key={t.id}
                      className="adm-badge"
                      style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text)' }}
                    >
                      {t.name} ({t.teacher_id})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {selectedStudentDetail.recent_activity && selectedStudentDetail.recent_activity.length > 0 && (
              <div className="adm-card" style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
                  Recent Activity
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedStudentDetail.recent_activity.map((act, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: 'var(--admin-text-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <span>
                        <strong style={{ color: act.type === 'video' ? 'var(--admin-primary)' : 'var(--admin-success)' }}>
                          [{act.type.toUpperCase()}]
                        </strong>{' '}
                        {act.title}
                      </span>
                      <span>
                        {act.completed ? 'Completed' : act.score !== undefined ? `${act.percentage}%` : 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate Student"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.name} (${deactivateTarget.student_id})? Historical academic records will be preserved.`
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
