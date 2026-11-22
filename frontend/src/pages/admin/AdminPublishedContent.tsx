import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  PlayCircle,
  Clapperboard,
  BookOpen,
  Clock,
  LibraryBig,
  CheckCircle2,
  ArrowRight,
  Eye,
  FileText,
  Search,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/admin/PageHeader';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatCard } from '../../components/admin/StatCard';
import { SearchBar } from '../../components/admin/SearchBar';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { ErrorState } from '../../components/admin/ErrorState';
import { Modal } from '../../components/admin/Modal';
import { api, mediaUrl } from '../../lib/api';
import { VideoRenderDetails, SubjectItem } from '../../lib/types';

interface AdminPublishedContentProps {
  onNavigate: (route: string, params?: any) => void;
}

const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const AdminPublishedContent: React.FC<AdminPublishedContentProps> = ({ onNavigate }) => {
  const [videos, setVideos] = useState<VideoRenderDetails[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<number | ''>('');
  const [previewVideo, setPreviewVideo] = useState<VideoRenderDetails | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allVideos, subjectRes] = await Promise.all([
        api.listVideos({ status: 'PUBLISHED' }),
        api.listSubjects({ page: 1, page_size: 200 }).catch(() => ({ items: [] as SubjectItem[] })),
      ]);
      setVideos(allVideos.filter((v) => (v.status || '').toUpperCase() === 'PUBLISHED'));
      setSubjects(subjectRes.items || []);
    } catch (err: any) {
      console.error('Failed to load published content:', err);
      setError(err?.message || 'Failed to load published videos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered published videos
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchSearch =
        !search.trim() ||
        (v.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.topic_title || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.chapter_title || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.textbook_title || '').toLowerCase().includes(search.toLowerCase());

      const matchSubject = subjectFilter === '' || v.subject_id === Number(subjectFilter);

      return matchSearch && matchSubject;
    });
  }, [videos, search, subjectFilter]);

  // Statistics
  const totalDurationMinutes = useMemo(() => {
    const totalSecs = videos.reduce(
      (acc, v) => acc + (v.actual_duration_seconds || v.approved_duration_seconds || 0),
      0
    );
    return Math.round(totalSecs / 60);
  }, [videos]);

  const uniqueSubjectsCount = useMemo(() => {
    const s = new Set(videos.map((v) => v.subject_name).filter(Boolean));
    return s.size;
  }, [videos]);

  const uniqueChaptersCount = useMemo(() => {
    const c = new Set(videos.map((v) => v.chapter_title).filter(Boolean));
    return c.size;
  }, [videos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Published Content & Live Materials"
        description="Inspect and monitor all educational videos currently published and accessible to students. Content is produced and approved via Video Studio (One-Flow)."
        actions={
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={() => onNavigate('admin-video-studio')}
          >
            <Clapperboard size={15} />
            Open Video Studio
          </button>
        }
      />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Published Videos"
          value={videos.length}
          icon={Globe2}
          tone="success"
        />
        <StatCard
          label="Total Learning Duration"
          value={`${totalDurationMinutes} mins`}
          icon={Clock}
          tone="primary"
        />
        <StatCard
          label="Subjects Covered"
          value={uniqueSubjectsCount}
          icon={LibraryBig}
          tone="default"
        />
        <StatCard
          label="Chapters Covered"
          value={uniqueChaptersCount}
          icon={BookOpen}
          tone="default"
        />
      </div>

      {/* Filter and Search Bar */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search published content by video, topic, chapter, or textbook…"
            style={{ flex: '1 1 280px' }}
          />

          <div style={{ minWidth: '200px' }}>
            <select
              className="adm-select"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value ? Number(e.target.value) : '')}
              aria-label="Filter by subject"
            >
              <option value="">All Subjects ({subjects.length})</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.class ? `(Class ${s.class})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SurfacePanel>

      {/* Content Table or Empty State */}
      <SurfacePanel>
        {loading ? (
          <LoadingState label="Loading published learning content…" rows={5} variant="table" />
        ) : error ? (
          <div style={{ padding: '8px 0' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : filteredVideos.length === 0 ? (
          <EmptyState
            icon={<Globe2 size={24} />}
            title={videos.length === 0 ? 'No videos published yet' : 'No matching published videos'}
            description={
              videos.length === 0
                ? 'Videos must be rendered, reviewed, and explicitly published through Video Studio before students can access them.'
                : 'Try adjusting your search terms or subject filter to find published materials.'
            }
            action={
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => onNavigate('admin-video-studio')}
              >
                <Clapperboard size={15} />
                Produce Content in Video Studio
              </button>
            }
          />
        ) : (
          <div className="adm-table-wrapper">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Video Title & Topic</th>
                  <th>Subject</th>
                  <th>Chapter & Textbook</th>
                  <th>Duration</th>
                  <th>Student Access</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((v) => {
                  const durationSecs = v.actual_duration_seconds || v.approved_duration_seconds || 0;
                  return (
                    <tr key={v.video_id || v.id}>
                      {/* Video Title & Topic */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{v.title}</div>
                        {v.topic_title && (
                          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                            Topic: {v.topic_title}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                          Video ID: #{v.video_id || v.id}
                        </div>
                      </td>

                      {/* Subject */}
                      <td>
                        {v.subject_name ? (
                          <span
                            className="adm-badge"
                            style={{
                              backgroundColor: 'var(--admin-primary-soft)',
                              color: 'var(--admin-primary)',
                            }}
                          >
                            <LibraryBig size={11} />
                            {v.subject_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-secondary)', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Chapter & Textbook */}
                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--admin-text)', fontWeight: 500 }}>
                          {v.chapter_title || 'Chapter'}
                        </div>
                        {v.textbook_title && (
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                            {v.textbook_title}
                          </div>
                        )}
                      </td>

                      {/* Duration */}
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: 'var(--admin-text)' }}>
                          <Clock size={12} style={{ color: 'var(--admin-text-secondary)' }} />
                          {formatDuration(durationSecs)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {v.scenes?.length ? `${v.scenes.length} scenes` : 'H.264 720p'}
                        </div>
                      </td>

                      {/* Access Status */}
                      <td>
                        <span
                          className="adm-badge"
                          style={{
                            backgroundColor: 'var(--admin-success-soft, #ECFDF5)',
                            color: 'var(--admin-success, #059669)',
                            border: '1px solid #A7F3D0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={11} />
                          Published & Live
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '3px' }}>
                          Assigned students only
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                          {v.video_url && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              onClick={() => setPreviewVideo(v)}
                              title="Watch rendered video in player"
                            >
                              <PlayCircle size={13} />
                              Watch
                            </button>
                          )}
                          {v.textbook_id && (
                            <button
                              type="button"
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              onClick={() => onNavigate('admin-video-studio', { textbookId: v.textbook_id })}
                              title="Open source textbook in Video Studio"
                              style={{ color: 'var(--admin-primary)', borderColor: 'var(--admin-primary)' }}
                            >
                              <Clapperboard size={13} />
                              Studio
                              <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfacePanel>

      {/* Preview Modal */}
      {previewVideo && (
        <Modal
          open={!!previewVideo}
          onClose={() => setPreviewVideo(null)}
          title={`Preview: ${previewVideo.title}`}
          subtitle={`${previewVideo.chapter_title || 'Chapter'} • ${previewVideo.topic_title || 'Topic'}`}
          maxWidth={820}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                Published status: <strong style={{ color: 'var(--admin-success)' }}>Live for enrolled students</strong>
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {previewVideo.textbook_id && (
                  <button
                    type="button"
                    className="adm-btn adm-btn-secondary adm-btn-sm"
                    onClick={() => {
                      const tbId = previewVideo.textbook_id;
                      setPreviewVideo(null);
                      if (tbId) onNavigate('admin-video-studio', { textbookId: tbId });
                    }}
                  >
                    <Clapperboard size={13} />
                    Open in Video Studio
                  </button>
                )}
                <button
                  type="button"
                  className="adm-btn adm-btn-primary adm-btn-sm"
                  onClick={() => setPreviewVideo(null)}
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {previewVideo.video_url ? (
              <div
                style={{
                  backgroundColor: '#000',
                  borderRadius: 'var(--radius-md, 8px)',
                  overflow: 'hidden',
                  maxHeight: '440px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  src={mediaUrl(previewVideo.video_url)}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '440px', display: 'block' }}
                />
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                No video stream URL found.
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--admin-surface-raised)',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Duration: </span>
                <strong style={{ color: 'var(--admin-text)' }}>
                  {formatDuration(previewVideo.actual_duration_seconds || previewVideo.approved_duration_seconds)}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Subject: </span>
                <strong style={{ color: 'var(--admin-text)' }}>{previewVideo.subject_name || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Source Textbook: </span>
                <strong style={{ color: 'var(--admin-text)' }}>{previewVideo.textbook_title || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Scenes: </span>
                <strong style={{ color: 'var(--admin-text)' }}>{previewVideo.scenes?.length ?? 0} scenes</strong>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
