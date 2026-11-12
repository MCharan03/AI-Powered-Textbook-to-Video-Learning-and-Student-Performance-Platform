import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, ArrowRight, Search, RotateCcw, LibraryBig } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { CurriculumTree } from '../../components/CurriculumTree';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { ActionMenu } from '../../components/admin/ActionMenu';
import { FormField } from '../../components/admin/FormField';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { Pagination } from '../../components/admin/Pagination';
import { api } from '../../lib/api';
import { SubjectItem, SubjectDetail, PaginatedResponse } from '../../lib/types';

interface AdminSubjectsProps {
  onNavigate?: (route: string, params?: any) => void;
  selectedSubjectId?: number;
}

export const AdminSubjects: React.FC<AdminSubjectsProps> = ({ onNavigate, selectedSubjectId }) => {
  const [data, setData] = useState<PaginatedResponse<SubjectItem>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Search/Filter states
  const [nameFilter, setNameFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modals & Details
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<SubjectDetail | null>(null);

  // Form states (Subject)
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClass, setFormClass] = useState('');

  // Add Chapter Modal
  const [addChapterModalOpen, setAddChapterModalOpen] = useState(false);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDescription, setChapterDescription] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await api.listSubjects({
        page,
        page_size: pageSize,
        name: nameFilter || undefined,
        class: classFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Failed to load subjects: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [page, pageSize]);

  useEffect(() => {
    if (selectedSubjectId) {
      openDetail(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSubjects();
  };

  const handleClearFilters = () => {
    setNameFilter('');
    setClassFilter('');
    setPage(1);
    setTimeout(() => {
      api.listSubjects({ page: 1, page_size: pageSize }).then((res) => {
        if ('items' in res) setData(res);
      });
    }, 0);
  };

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormName('');
    setFormDescription('');
    setFormClass('');
    setCreateModalOpen(true);
  };

  const openEditModal = (s: SubjectItem) => {
    setEditingSubject(s);
    setFormName(s.name);
    setFormDescription(s.description || '');
    setFormClass(s.class || '');
    setCreateModalOpen(true);
  };

  const openDetail = async (id: number) => {
    try {
      const detail = await api.getSubject(id);
      setSelectedSubjectDetail(detail);
      setChapterNumber(detail.chapters.length + 1);
    } catch (err: any) {
      setMessage({ text: `Failed to load subject details: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingSubject) {
        await api.updateSubject(editingSubject.id, {
          name: formName,
          description: formDescription || undefined,
          class: formClass || undefined,
        });
        setMessage({ text: `Subject ${formName} updated successfully.`, type: 'success' });
      } else {
        await api.createSubject({
          name: formName,
          description: formDescription || undefined,
          class: formClass || undefined,
        });
        setMessage({ text: `Subject ${formName} created successfully.`, type: 'success' });
      }
      setCreateModalOpen(false);
      fetchSubjects();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestDeleteSubject = (s: SubjectItem) => {
    setDeleteTarget(s);
  };

  const handleDeleteSubject = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await api.deleteSubject(deleteTarget.id);
      setMessage({ text: `Subject ${deleteTarget.name} deleted.`, type: 'success' });
      if (selectedSubjectDetail?.id === deleteTarget.id) {
        setSelectedSubjectDetail(null);
      }
      setDeleteTarget(null);
      fetchSubjects();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectDetail) return;
    try {
      setSubmitting(true);
      await api.createChapter(selectedSubjectDetail.id, {
        chapter_number: chapterNumber,
        title: chapterTitle,
        description: chapterDescription || undefined,
      });
      setMessage({ text: `Chapter '${chapterTitle}' added successfully.`, type: 'success' });
      setAddChapterModalOpen(false);
      setChapterTitle('');
      setChapterDescription('');
      const updated = await api.getSubject(selectedSubjectDetail.id);
      setSelectedSubjectDetail(updated);
      setChapterNumber(updated.chapters.length + 1);
      fetchSubjects();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<SubjectItem>[] = [
    {
      key: 'name',
      header: 'Subject Name',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
          {row.name}
        </span>
      ),
    },
    { key: 'class', header: 'Class / Grade', render: (row) => row.class || 'All Classes' },
    {
      key: 'chapters_count',
      header: 'Chapters',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>
          {row.chapters_count ?? '—'}
        </span>
      ),
    },
    {
      key: 'students_count',
      header: 'Enrolled Students',
      align: 'right',
      render: (row) => (
        <span style={{ color: 'var(--admin-text-secondary)' }}>
          {row.students_count ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '72px',
      render: (row) => (
        <ActionMenu
          ariaLabel={`Actions for ${row.name}`}
          items={[
            {
              label: 'Curriculum',
              icon: <Eye size={14} />,
              onClick: () => openDetail(row.id),
            },
            {
              label: 'Edit',
              icon: <Pencil size={14} />,
              onClick: () => openEditModal(row),
            },
            {
              label: 'Delete',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => requestDeleteSubject(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Subject & Curriculum Management"
        description="Configure subjects, structure chapters, topics, and build the curriculum tree for AI textbook pipelines."
        actions={
          <button className="adm-btn adm-btn-primary" onClick={openCreateModal}>
            <Plus size={15} />
            Add New Subject
          </button>
        }
      />

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Filter / Search Panel */}
      <SurfacePanel title="Filter Subjects">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <FormField
            label="Subject Name"
            name="subject-name-filter"
            type="text"
            value={nameFilter}
            onChange={setNameFilter}
            placeholder="e.g. Mathematics"
            style={{ flex: '1 1 220px' }}
          />
          <FormField
            label="Class / Grade"
            name="subject-class-filter"
            type="text"
            value={classFilter}
            onChange={setClassFilter}
            placeholder="e.g. 11th Grade"
            style={{ flex: '1 1 180px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="adm-btn adm-btn-primary">
              <Search size={14} />
              Filter
            </button>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={handleClearFilters}>
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </form>
      </SurfacePanel>

      {/* Main Grid: Subjects List + Selected Subject Curriculum Hierarchy */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedSubjectDetail ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '24px' }}>
        {/* Subjects Data Table */}
        <SurfacePanel title={`Subjects Catalog (${data.total} total)`}>
          {loading ? (
            <LoadingState rows={5} />
          ) : data.items.length === 0 ? (
            <EmptyState
              title="No subjects found"
              description="No subjects match the current filter. Try resetting the filters or add a new subject."
              icon={<LibraryBig size={20} />}
            />
          ) : (
            <DataTable columns={columns} data={data.items} emptyMessage="No subjects found matching the filter." />
          )}

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={data.total_pages}
            total={data.total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
          />
        </SurfacePanel>

        {/* Selected Subject Curriculum Detail & Tree */}
        {selectedSubjectDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SurfacePanel
              title={`Subject: ${selectedSubjectDetail.name}`}
              actions={
                <button
                  className="adm-btn adm-btn-primary adm-btn-sm"
                  onClick={() => setAddChapterModalOpen(true)}
                >
                  <Plus size={14} />
                  Add Chapter
                </button>
              }
            >
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginBottom: '8px' }}>
                  {selectedSubjectDetail.description || 'No description provided.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  <span>Class: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.class || 'All'}</strong></span>
                  <span>Chapters: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.chapters.length}</strong></span>
                  <span>Students: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.students_count ?? '—'}</strong></span>
                </div>
              </div>

              {/* Chapters List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>Chapters</h4>
                {selectedSubjectDetail.chapters.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>No chapters created yet.</p>
                ) : (
                  selectedSubjectDetail.chapters.map((ch) => (
                    <div
                      key={ch.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--admin-surface-raised)',
                        border: '1px solid var(--admin-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--admin-primary)', marginRight: '8px' }}>
                          CH {ch.chapter_number}:
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{ch.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                          {ch.topics_count ?? '—'} Topics
                        </span>
                        {onNavigate && (
                          <button
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            onClick={() => onNavigate('admin-chapters', { chapterId: ch.id })}
                          >
                            Manage Topics
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Visual Curriculum Tree */}
              <CurriculumTree
                subject={selectedSubjectDetail}
                onSelectChapter={(chId) => onNavigate && onNavigate('admin-chapters', { chapterId: chId })}
              />
            </SurfacePanel>
          </div>
        )}
      </div>

      {/* Create / Edit Subject Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingSubject ? `Edit Subject: ${editingSubject.name}` : 'Create New Subject'}
        subtitle={editingSubject ? 'Update subject details and curriculum overview.' : 'Add a new subject to the curriculum catalog.'}
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="subject-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editingSubject ? 'Save Changes' : 'Create Subject'}
            </button>
          </>
        }
      >
        <form id="subject-form" onSubmit={handleSaveSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Subject Name"
            name="subject-name"
            type="text"
            required
            placeholder="e.g. Data Structures & Algorithms"
            value={formName}
            onChange={setFormName}
          />
          <FormField
            label="Class / Grade Level"
            name="subject-class"
            type="text"
            placeholder="e.g. 11th Grade / B.Tech Year 2"
            value={formClass}
            onChange={setFormClass}
          />
          <FormField
            label="Curriculum Description"
            name="subject-description"
            type="textarea"
            placeholder="Overview of subject learning objectives and prerequisites..."
            value={formDescription}
            onChange={setFormDescription}
          />
        </form>
      </Modal>

      {/* Add Chapter Modal */}
      <Modal
        open={addChapterModalOpen && !!selectedSubjectDetail}
        onClose={() => setAddChapterModalOpen(false)}
        title={`Add Chapter to ${selectedSubjectDetail?.name || ''}`}
        subtitle="Chapters are the second level of the curriculum hierarchy."
        maxWidth={500}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setAddChapterModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="add-chapter-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Chapter'}
            </button>
          </>
        }
      >
        <form id="add-chapter-form" onSubmit={handleAddChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Chapter Number"
            name="chapter-number"
            type="number"
            required
            min={1}
            value={chapterNumber}
            onChange={(v) => setChapterNumber(Number(v))}
          />
          <FormField
            label="Chapter Title"
            name="chapter-title"
            type="text"
            required
            placeholder="e.g. Newton's Laws of Motion"
            value={chapterTitle}
            onChange={setChapterTitle}
          />
          <FormField
            label="Description"
            name="chapter-description"
            type="textarea"
            placeholder="Key concepts covered in this chapter..."
            value={chapterDescription}
            onChange={setChapterDescription}
          />
        </form>
      </Modal>

      {/* Delete Subject Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Subject"
        message={`Are you sure you want to delete subject '${deleteTarget?.name || ''}' and all its chapters/topics? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
        onConfirm={handleDeleteSubject}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
