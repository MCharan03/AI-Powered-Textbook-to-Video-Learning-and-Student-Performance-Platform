import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { Textbook } from '../../lib/types';

interface AdminDashboardProps {
  onNavigate: (route: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.listTextbooks();
      setTextbooks(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      setMessage({ text: 'Please provide both textbook title and a valid PDF file.', type: 'error' });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);
      const uploaded = await api.uploadTextbook(file, title.trim());
      setMessage({ text: `Textbook "${uploaded.title}" uploaded successfully.`, type: 'success' });
      setTitle('');
      setFile(null);
      await fetchDashboardData();
    } catch (err: any) {
      setMessage({ text: `Upload failed: ${err.message}`, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleTrigger = async (id: number) => {
    try {
      await api.triggerPipeline(id);
      setMessage({ text: `Pipeline triggered for Textbook #${id}.`, type: 'success' });
      onNavigate('admin-pipeline');
    } catch (err: any) {
      setMessage({ text: `Trigger failed: ${err.message}`, type: 'error' });
    }
  };

  const columns: Column<Textbook>[] = [
    { key: 'id', header: 'ID', width: '60px' },
    { key: 'title', header: 'Textbook Title' },
    { key: 'filename', header: 'Filename' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'uploaded_at', header: 'Uploaded At' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleTrigger(row.id)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--admin-primary)',
            color: '#FFF',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Run 6-Stage Pipeline
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Admin Overview & Ingestion</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
          Upload textbook PDFs and govern automated 6-stage content synthesis.
        </p>
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

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>INGESTED TEXTBOOKS</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#F8FAFC', marginTop: '8px' }}>{textbooks.length}</div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>ACTIVE PROCESSING</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#F59E0B', marginTop: '8px' }}>
            {textbooks.filter((t) => t.status === 'processing').length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>APPROVAL GATE STATUS</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#10B981', marginTop: '14px' }}>
            Enforced (Mandatory)
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>TARGET DURATION</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#6366F1', marginTop: '8px' }}>~5-6 min</div>
        </SurfacePanel>
      </div>

      {/* Upload Dropzone Container */}
      <SurfacePanel>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>
          Textbook PDF Ingestion Dropzone
        </h2>
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
              Textbook Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. NCERT Class 10 Science - Chemical Reactions"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                color: '#F8FAFC',
                fontSize: '14px',
              }}
            />
          </div>

          <div
            style={{
              border: '2px dashed #475569',
              borderRadius: '10px',
              padding: '32px 20px',
              textAlign: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('pdf-file-input')?.click()}
          >
            <input
              id="pdf-file-input"
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC' }}>
              {file ? file.name : 'Click to select or drag and drop textbook PDF'}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              Supported: PDF format up to 50MB. Validated via PDF magic bytes.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? 'Uploading & Validating...' : 'Upload Textbook PDF'}
            </button>
          </div>
        </form>
      </SurfacePanel>

      {/* Recent Ingestion Activity */}
      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>Recent Ingested Textbooks</h2>
          <button
            onClick={fetchDashboardData}
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
        <DataTable columns={columns} data={textbooks} emptyMessage="No textbooks uploaded yet. Use the upload box above." />
      </SurfacePanel>
    </div>
  );
};
