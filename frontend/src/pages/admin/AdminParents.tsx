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
  const [deactivateTarget, setDeactivateTarget] = useState<Parent | null>(null);

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

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const p = deactivateTarget;
    try {
      await api.deleteParent(p.id);
      setMessage({ text: `Parent ${p.name} deactivated.`, type: 'success' });
      fetchParents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setDeactivateTarget(null);
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
    {
      key: 'name',
      header: 'Parent Name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{row.name}</span>,
    },
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
      render: (row) => <StatusBadge status={row.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '56px',
      align: 'right',
      render: (row) => (
        <ActionMenu
          ariaLabel={`Actions for parent ${row.name}`}
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
        title="Parents"
        description="Register parent accounts, manage contact information, and audit linked student access."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openCreateModal}>
            <Plus size={15} />
            Add Parent
          </button>
        }
      />

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      {/* Filter / Search Panel */}
      <SurfacePanel title="Filter & Search Parents">
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}
        >
          <FormField
            label="Parent ID"
            name="filter-parent-id"
            value={parentIdFilter}
            onChange={setParentIdFilter}
            placeholder="e.g. PAR-CMRIT001"
            style={{ flex: '1 1 200px' }}
          />
          <FormField
            label="Parent Name"
            name="filter-parent-name"
            value={nameFilter}
            onChange={setNameFilter}
            placeholder="e.g. John"
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

      {/* Parents Data Table */}
      <SurfacePanel title={`Parents Directory (${data.total} total)`}>
        {loading ? (
          <LoadingState variant="table" rows={5} label="Loading parents…" />
        ) : (
          <DataTable
            columns={columns}
            data={data.items}
            emptyMessage="No parents found matching the filter criteria."
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
        title={editingParent ? `Edit Parent: ${editingParent.parent_id}` : 'Create New Parent Account'}
        maxWidth={520}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="admin-parent-form"
              className="adm-btn adm-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingParent ? 'Save Changes' : 'Create Parent'}
            </button>
          </>
        }
      >
        <form
          id="admin-parent-form"
          onSubmit={handleSaveParent}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <FormField
            label="Parent ID (Unique Login ID)"
            name="parent-id"
            required
            disabled={!!editingParent}
            placeholder="e.g. PAR-CMRIT001"
            value={formParentId}
            onChange={setFormParentId}
          />

          <FormField
            label="Full Name"
            name="parent-name"
            required
            placeholder="e.g. John Watson"
            value={formName}
            onChange={setFormName}
          />

          <FormField
            label="Email Address"
            name="parent-email"
            type="email"
            placeholder="parent@example.com"
            value={formEmail}
            onChange={setFormEmail}
          />

          <FormField
            label="Phone Number"
            name="parent-phone"
            type="tel"
            placeholder="+1-555-0300"
            value={formPhone}
            onChange={setFormPhone}
          />

          <FormField
            label={editingParent ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password'}
            name="parent-password"
            type="password"
            required={!editingParent}
            placeholder={editingParent ? '••••••••' : 'Enter strong parent password'}
            value={formPassword}
            onChange={setFormPassword}
          />
        </form>
      </Modal>

      {/* Parent Detail Modal */}
      <Modal
        open={detailModalOpen && !!selectedParentDetail}
        onClose={() => setDetailModalOpen(false)}
        title={
          selectedParentDetail ? `${selectedParentDetail.name} (${selectedParentDetail.parent_id})` : 'Parent Details'
        }
        subtitle={
          selectedParentDetail
            ? `Email: ${selectedParentDetail.email || '—'} | Phone: ${selectedParentDetail.phone || '—'}`
            : undefined
        }
        maxWidth={680}
      >
        {selectedParentDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="adm-card" style={{ padding: '16px' }}>
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
                        gap: '8px',
                        padding: '10px 14px',
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
                          {st.relationship}
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
        )}
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate Parent"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.name} (${deactivateTarget.parent_id})?`
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
