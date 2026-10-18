import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { Parent, ParentDetail, PaginatedResponse } from '../../lib/types';

interface AdminParentsProps {
  onNavigate?: (route: string, params?: any) => void;
  selectedParentId?: number;
}

export const AdminParents: React.FC<AdminParentsProps> = ({ onNavigate, selectedParentId }) => {
  const [data, setData] = useState<PaginatedResponse<Parent>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Search/Filter states
  const [parentIdFilter, setParentIdFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [selectedParentDetail, setSelectedParentDetail] = useState<ParentDetail | null>(null);

  // Form states
  const [formParentId, setFormParentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchParents = async () => {
    try {
      setLoading(true);
      const res = await api.listParents({
        page,
        page_size: pageSize,
        parent_id: parentIdFilter || undefined,
        name: nameFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Failed to load parents: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [page, pageSize]);

  useEffect(() => {
    if (selectedParentId) {
      openDetail(selectedParentId);
    }
  }, [selectedParentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchParents();
  };

  const handleClearFilters = () => {
    setParentIdFilter('');
    setNameFilter('');
    setPage(1);
    setTimeout(() => {
      api.listParents({ page: 1, page_size: pageSize }).then(setData);
    }, 0);
  };

  const openCreateModal = () => {
    setEditingParent(null);
    setFormParentId('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openEditModal = (p: Parent) => {
    setEditingParent(p);
    setFormParentId(p.parent_id);
    setFormName(p.name);
    setFormEmail(p.email || '');
    setFormPhone(p.phone || '');
    setFormPassword('');
    setCreateModalOpen(true);
  };

  const openDetail = async (id: number) => {
    try {
      const detail = await api.getParent(id);
      setSelectedParentDetail(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setMessage({ text: `Failed to load parent details: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingParent) {
        await api.updateParent(editingParent.id, {
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword || undefined,
        });
        setMessage({ text: `Parent ${formName} updated successfully.`, type: 'success' });
      } else {
        await api.createParent({
          parent_id: formParentId,
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          password: formPassword,
        });
        setMessage({ text: `Parent ${formName} (${formParentId}) created successfully.`, type: 'success' });
      }
      setCreateModalOpen(false);
      fetchParents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (p: Parent) => {
    if (!window.confirm(`Are you sure you want to deactivate ${p.name} (${p.parent_id})?`)) {
      return;
    }
    try {
      await api.deleteParent(p.id);
      setMessage({ text: `Parent ${p.name} deactivated.`, type: 'success' });
      fetchParents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const columns: Column<Parent>[] = [
    {
      key: 'parent_id',
      header: 'Parent ID',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--admin-primary)', fontFamily: 'monospace' }}>
          {row.parent_id}
        </span>
      ),
    },
    { key: 'name', header: 'Parent Name' },
    { key: 'email', header: 'Email Address', render: (row) => row.email || '—' },
    { key: 'phone', header: 'Phone Number', render: (row) => row.phone || '—' },
    {
      key: 'linked_students',
      header: 'Linked Students',
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
          {row.linked_students_summary && row.linked_students_summary.length > 0
            ? row.linked_students_summary.join(', ')
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
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Parent Management
          </h1>
          <p style={{ color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Register parent accounts, manage contact information, and audit linked student access.
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
          + Add New Parent
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
      <SurfacePanel title="Filter & Search Parents">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Parent ID
            </label>
            <input
              type="text"
              placeholder="e.g. PAR-CMRIT001"
              value={parentIdFilter}
              onChange={(e) => setParentIdFilter(e.target.value)}
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
              Parent Name
            </label>
            <input
              type="text"
              placeholder="e.g. John"
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

      {/* Parents Data Table */}
      <SurfacePanel title={`Parents Directory (${data.total} total)`}>
        <DataTable columns={columns} data={data.items} emptyMessage="No parents found matching the filter criteria." />

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
              {editingParent ? `Edit Parent: ${editingParent.parent_id}` : 'Create New Parent Account'}
            </h2>
            <form onSubmit={handleSaveParent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  Parent ID (Unique Login ID) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingParent}
                  placeholder="e.g. PAR-CMRIT001"
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: editingParent ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
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
                  placeholder="e.g. John Watson"
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
                  placeholder="parent@example.com"
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
                  placeholder="+1-555-0300"
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
                  {editingParent ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingParent}
                  placeholder={editingParent ? '••••••••' : 'Enter strong parent password'}
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
                  {submitting ? 'Saving...' : (editingParent ? 'Save Changes' : 'Create Parent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parent Detail Modal */}
      {detailModalOpen && selectedParentDetail && (
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
              maxWidth: '650px',
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
                  {selectedParentDetail.name} ({selectedParentDetail.parent_id})
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  Email: {selectedParentDetail.email || 'N/A'} | Phone: {selectedParentDetail.phone || 'N/A'}
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
                Linked Children / Students
              </h3>
              {selectedParentDetail.linked_students.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                  No students are linked to this parent account.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedParentDetail.linked_students.map((st) => (
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
                        <span style={{ fontWeight: 600, color: '#60A5FA', marginRight: '8px' }}>
                          [{st.relationship}]
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{st.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginLeft: '8px' }}>
                          ({st.student_id}) {st.class ? `• ${st.class}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
