import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { User } from '../../lib/types';

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
    { key: 'name', header: 'Full Name' },
    { key: 'email', header: 'Email Address' },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (row) => (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor:
              row.role === 'admin'
                ? 'rgba(99, 102, 241, 0.2)'
                : row.role === 'student'
                ? 'rgba(37, 99, 235, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
            color:
              row.role === 'admin'
                ? '#818CF8'
                : row.role === 'student'
                ? '#60A5FA'
                : '#34D399',
            textTransform: 'uppercase',
          }}
        >
          {row.role}
        </span>
      ),
    },
    { key: 'created_at', header: 'Account Created' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>User Governance</h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
            Manage platform accounts across Administrator, Student, Teacher, and Parent roles.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            backgroundColor: 'var(--admin-primary)',
            color: '#FFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add New User
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: message.type === 'success' ? '#10B981' : '#EF4444',
            fontSize: '13px',
          }}
        >
          {message.text}
        </div>
      )}

      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>Registered Accounts ({users.length})</h2>
          <button
            onClick={fetchUsers}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              color: '#94A3B8',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        <DataTable columns={columns} data={users} />
      </SurfacePanel>

      {/* Add User Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              border: '1px solid #334155',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>Add Platform User</h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                  Role Assignment
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: '13px',
                  }}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher (Read-Only)</option>
                  <option value="parent">Parent (Read-Only)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #334155',
                    color: '#CBD5E1',
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
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
