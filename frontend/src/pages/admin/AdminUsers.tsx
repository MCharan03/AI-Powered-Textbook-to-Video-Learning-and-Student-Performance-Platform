import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { Modal } from '../../components/admin/Modal';
import { FormField } from '../../components/admin/FormField';
import { api } from '../../lib/api';
import { User } from '../../lib/types';

const roleBadgeTone: Record<string, { bg: string; color: string }> = {
  admin: { bg: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' },
  student: { bg: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' },
  teacher: { bg: 'var(--admin-success-soft)', color: 'var(--admin-success)' },
  parent: { bg: 'var(--admin-success-soft)', color: 'var(--admin-success)' },
};

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.createUser({ name, email, password, role });
      setMessage({ text: `User ${name} created successfully.`, type: 'success' });
      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      await fetchUsers();
    } catch (err: any) {
      setMessage({ text: `Failed to create user: ${err.message}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<User>[] = [
    { key: 'id', header: 'ID', width: '60px' },
    {
      key: 'name',
      header: 'Full Name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{row.name}</span>,
    },
    { key: 'email', header: 'Email Address', render: (row) => row.email || '—' },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (row) => {
        const tone = roleBadgeTone[row.role] || { bg: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' };
        return (
          <span className="adm-badge" style={{ backgroundColor: tone.bg, color: tone.color }}>
            {row.role}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Account Created',
      render: (row) => <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>{row.created_at}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="User Governance"
        description="Manage platform accounts across Administrator, Student, Teacher, and Parent roles."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            Add User
          </button>
        }
      />

      <MessageBanner message={message} onDismiss={() => setMessage(null)} />

      <SurfacePanel
        title={`Registered Accounts (${users.length})`}
        actions={
          <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={fetchUsers}>
            <RefreshCw size={13} />
            Refresh
          </button>
        }
      >
        <DataTable columns={columns} data={users} emptyMessage="No user accounts found." />
      </SurfacePanel>

      {/* Add User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Platform User"
        maxWidth={480}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="admin-user-form" className="adm-btn adm-btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </>
        }
      >
        <form
          id="admin-user-form"
          onSubmit={handleCreateUser}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <FormField
            label="Full Name"
            name="user-name"
            required
            placeholder="e.g. John Doe"
            value={name}
            onChange={setName}
          />

          <FormField
            label="Email Address"
            name="user-email"
            type="email"
            required
            placeholder="e.g. john@example.com"
            value={email}
            onChange={setEmail}
          />

          <FormField
            label="Password"
            name="user-password"
            type="password"
            required
            placeholder="Enter secure password"
            value={password}
            onChange={setPassword}
          />

          <FormField
            label="Role Assignment"
            name="user-role"
            type="select"
            value={role}
            onChange={setRole}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher (Read-Only)' },
              { value: 'parent', label: 'Parent (Read-Only)' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />
        </form>
      </Modal>
    </div>
  );
};
