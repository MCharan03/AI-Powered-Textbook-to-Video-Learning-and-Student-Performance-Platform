import React, { useRef, useState } from 'react';
import { BookOpen, FileText, Loader2, UploadCloud } from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { SubjectItem } from '../../../lib/types';
import { api } from '../../../lib/api';
import { Banner, Field, SectionHeader, inputStyle, subTextStyle } from './StudioUi';

interface UploadPanelProps {
  subjects: SubjectItem[];
  onUploaded: (textbookId: number) => void;
}

type UploadMode = 'TEXTBOOK' | 'CHAPTER';

/**
 * Step 1 — Upload.
 * Supports a complete textbook PDF (chapters extracted, then selected in Step 2)
 * and an individual chapter PDF (processed as exactly one chapter).
 */
export const UploadPanel: React.FC<UploadPanelProps> = ({ subjects, onUploaded }) => {
  const [mode, setMode] = useState<UploadMode>('TEXTBOOK');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [uploading, setUploading] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setChapterNumber('1');
    setError(null);
    setStageMessage('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    setFile(f);
    if (!title.trim()) {
      setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose a PDF file to upload.');
      return;
    }
    if (!title.trim()) {
      setError(mode === 'CHAPTER' ? 'Enter the chapter title.' : 'Enter the textbook title.');
      return;
    }
    if (mode === 'CHAPTER' && (!chapterNumber || Number(chapterNumber) <= 0)) {
      setError('Enter a valid chapter number.');
      return;
    }

    try {
      setUploading(true);
      setStageMessage('Uploading PDF…');
      const uploaded = await api.uploadTextbook(
        file,
        title.trim(),
        subjectId === '' ? undefined : Number(subjectId),
        description.trim() || undefined,
        {
          sourceType: mode,
          chapterNumber: mode === 'CHAPTER' ? Number(chapterNumber) : undefined,
        }
      );
      setStageMessage('Starting curriculum extraction…');
      await api.processTextbook(uploaded.id, false);
      reset();
      setUploading(false);
      onUploaded(uploaded.id);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setStageMessage('');
    }
  };

  const modeButton = (value: UploadMode, label: string, hint: string, icon: React.ReactNode) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMode(value)}
        style={{
          flex: '1 1 220px',
          textAlign: 'left',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg, 10px)',
          border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
          backgroundColor: active ? 'var(--admin-primary-soft)' : 'var(--admin-surface)',
          cursor: 'pointer',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)', marginTop: '1px' }}>{icon}</span>
        <span>
          <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: active ? 'var(--admin-primary)' : 'var(--admin-text)' }}>
            {label}
          </span>
          <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--admin-text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
            {hint}
          </span>
        </span>
      </button>
    );
  };

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 1 · Upload source material"
        description="Upload a complete textbook or a single chapter PDF. Files are validated and extracted by the existing Phase 2 pipeline — nothing is published automatically."
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {modeButton(
          'TEXTBOOK',
          'Complete Textbook',
          'Extract the chapter list, then choose the chapters to turn into videos.',
          <BookOpen size={18} />
        )}
        {modeButton(
          'CHAPTER',
          'Individual Chapter',
          'Process the whole PDF as exactly one chapter with its own topics.',
          <FileText size={18} />
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '14px' }}>
          <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] || null);
          }}
          style={{
            border: '2px dashed var(--admin-border)',
            borderRadius: 'var(--radius-lg, 10px)',
            padding: '28px 18px',
            textAlign: 'center',
            backgroundColor: 'var(--admin-surface-raised)',
            cursor: 'pointer',
            marginBottom: '16px',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          <UploadCloud size={22} style={{ color: 'var(--admin-primary)', marginBottom: '6px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--admin-text)' }}>
            {file ? file.name : 'Drop a PDF here or click to browse'}
          </div>
          <div style={subTextStyle}>
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · ready to upload`
              : 'PDF only · up to 50 MB per file'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
          <Field label={mode === 'CHAPTER' ? 'Chapter title' : 'Textbook title'}>
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'CHAPTER' ? 'e.g. Chapter 4: Thermodynamics' : 'e.g. Physics Grade 10'}
            />
          </Field>
          <Field label="Subject">
            <select
              style={inputStyle}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Select a subject (optional)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.class ? ` · Class ${s.class}` : ''}
                </option>
              ))}
            </select>
          </Field>
          {mode === 'CHAPTER' && (
            <Field label="Chapter number">
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
              />
            </Field>
          )}
          <Field label="Description / notes">
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context for reviewers"
            />
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={uploading}>
            {uploading ? <Loader2 size={14} /> : <UploadCloud size={14} />}
            {uploading ? 'Processing…' : mode === 'CHAPTER' ? 'Upload & Extract Chapter' : 'Upload & Extract Textbook'}
          </button>
          {uploading && <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>{stageMessage}</span>}
        </div>
      </form>
    </SurfacePanel>
  );
};
