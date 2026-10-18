import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { CurriculumTree } from '../../components/CurriculumTree';
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

  const handleDeleteSubject = async (s: SubjectItem) => {
    if (!window.confirm(`Are you sure you want to delete subject '${s.name}' and all its chapters/topics?`)) {
      return;
    }
    try {
      await api.deleteSubject(s.id);
      setMessage({ text: `Subject ${s.name} deleted.`, type: 'success' });
      if (selectedSubjectDetail?.id === s.id) {
        setSelectedSubjectDetail(null);
      }
      fetchSubjects();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
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
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>
          {row.chapters_count} Chapters
        </span>
      ),
    },
    {
      key: 'students_count',
      header: 'Enrolled Students',
      render: (row) => (
        <span style={{ color: '#60A5FA' }}>
          {row.students_count} Students
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
            Curriculum
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
          <button
            onClick={() => handleDeleteSubject(row)}
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
            Delete
          </button>
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
            Subject & Curriculum Management
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Configure subjects, structure chapters, topics, and build the curriculum tree for AI textbook pipelines.
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
          + Add New Subject
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
      <SurfacePanel title="Filter Subjects">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Subject Name
            </label>
            <input
              type="text"
              placeholder="e.g. Mathematics"
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
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Class / Grade
            </label>
            <input
              type="text"
              placeholder="e.g. 11th Grade"
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

      {/* Main Grid: Subjects List + Selected Subject Curriculum Hierarchy */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedSubjectDetail ? '1fr 1fr' : '1fr', gap: '24px' }}>
        {/* Subjects Data Table */}
        <SurfacePanel title={`Subjects Catalog (${data.total} total)`}>
          <DataTable columns={columns} data={data.items} emptyMessage="No subjects found matching the filter." />

          {/* Pagination */}
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
              Showing {data.items.length} of {data.total} (Page {data.page} of {data.total_pages})
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
                Prev
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
            </div>
          </div>
        </SurfacePanel>

        {/* Selected Subject Curriculum Detail & Tree */}
        {selectedSubjectDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SurfacePanel
              title={`Subject: ${selectedSubjectDetail.name}`}
              actions={
                <button
                  onClick={() => setAddChapterModalOpen(true)}
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
                  + Add Chapter
                </button>
              }
            >
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginBottom: '8px' }}>
                  {selectedSubjectDetail.description || 'No description provided.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  <span>Class: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.class || 'All'}</strong></span>
                  <span>Chapters: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.chapters.length}</strong></span>
                  <span>Students: <strong style={{ color: 'var(--admin-text)' }}>{selectedSubjectDetail.students_count}</strong></span>
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
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--admin-primary)', marginRight: '8px' }}>
                          CH {ch.chapter_number}:
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{ch.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                          {ch.topics_count} Topics
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('admin-chapters', { chapterId: ch.id })}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--admin-border)',
                              backgroundColor: 'transparent',
                              color: '#60A5FA',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Manage Topics →
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
              {editingSubject ? `Edit Subject: ${editingSubject.name}` : 'Create New Subject'}
            </h2>
            <form onSubmit={handleSaveSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures & Algorithms"
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
                  Class / Grade Level
                </label>
                <input
                  type="text"
                  placeholder="e.g. 11th Grade / B.Tech Year 2"
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
                  Curriculum Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Overview of subject learning objectives and prerequisites..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    resize: 'vertical',
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
                  {submitting ? 'Saving...' : (editingSubject ? 'Save Changes' : 'Create Subject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Chapter Modal */}
      {addChapterModalOpen && selectedSubjectDetail && (
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
              Add Chapter to {selectedSubjectDetail.name}
            </h2>
            <form onSubmit={handleAddChapter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Chapter Number *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(Number(e.target.value))}
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
                  Chapter Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Newton's Laws of Motion"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
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
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Key concepts covered in this chapter..."
                  value={chapterDescription}
                  onChange={(e) => setChapterDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setAddChapterModalOpen(false)}
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
                  {submitting ? 'Adding...' : 'Add Chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
