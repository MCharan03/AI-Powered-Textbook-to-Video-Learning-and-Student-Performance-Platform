import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { SearchBar } from '../../components/admin/SearchBar';
import { Modal } from '../../components/admin/Modal';
import { EmptyState } from '../../components/admin/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { SurfacePanel } from '../../components/SurfacePanel';
import {
  Clapperboard,
  Film,
  RefreshCw,
  Zap,
  Lock,
  Check,
  Rocket,
  Clock,
  AlertTriangle,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { VideoRenderDetails, VideoGenerationStatus, SceneItem } from '../../lib/types';

const FILTER_STATUSES = ['ALL', 'REVIEW', 'APPROVED', 'PUBLISHED', 'PENDING_RENDER'];

const MONO_FONT = "'SF Mono', Menlo, Monaco, 'Courier New', monospace";

export const AdminVideoReview: React.FC = () => {
  const [videos, setVideos] = useState<VideoRenderDetails[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRenderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<VideoGenerationStatus | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [selectedScene, setSelectedScene] = useState<SceneItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.listVideos();
      setVideos(data);
      if (data.length > 0 && !selectedVideo) {
        setSelectedVideo(data[0]);
      } else if (selectedVideo) {
        const updated = data.find((v) => v.id === selectedVideo.id);
        if (updated) setSelectedVideo(updated);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  };

  const pollGeneration = (videoId: number) => {
    setGenerating(true);
    const interval = setInterval(async () => {
      try {
        const st = await api.getVideoGenerationStatus(videoId);
        setJobStatus(st);
        if (st.job_status === 'COMPLETED' || st.render_status === 'RENDERED') {
          clearInterval(interval);
          setGenerating(false);
          setSuccessMsg('Video rendered successfully! Ready for Admin Review.');
          await loadVideos();
          const refreshed = await api.getVideoPreview(videoId);
          setSelectedVideo(refreshed);
        } else if (st.job_status === 'FAILED' || st.render_status === 'FAILED') {
          clearInterval(interval);
          setGenerating(false);
          setErrorMsg(st.error_message || 'Video rendering failed.');
          await loadVideos();
        }
      } catch (e) {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 1500);
  };

  const handleStartGeneration = async () => {
    if (!selectedVideo) return;
    if (selectedVideo.script_status !== 'SCRIPT_APPROVED') {
      setErrorMsg('Video cannot be generated because the script is not approved. Only SCRIPT_APPROVED video scripts may enter the video rendering pipeline. Please approve the script in Script Review first.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.generateVideo(selectedVideo.video_id, false);
      pollGeneration(selectedVideo.video_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start video generation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    if (!selectedVideo) return;
    try {
      setActionLoading(true);
      setShowRegenModal(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.regenerateVideo(selectedVideo.video_id, true);
      pollGeneration(selectedVideo.video_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to regenerate video.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedVideo) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await api.approveVideo(selectedVideo.video_id);
      setSelectedVideo(res);
      setSuccessMsg('Video successfully APPROVED! You can now publish it for students.');
      await loadVideos();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve video.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVideo) return;
    if (selectedVideo.render_status !== 'RENDERED') {
      setErrorMsg('Cannot publish: video has not been rendered.');
      return;
    }
    if (selectedVideo.script_status !== 'SCRIPT_APPROVED') {
      setErrorMsg('Cannot publish: video script is not approved.');
      return;
    }
    if (!selectedVideo.actual_duration_seconds || selectedVideo.actual_duration_seconds <= 0) {
      setErrorMsg('Cannot publish: generated MP4 duration is 0 seconds.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await api.publishVideo(selectedVideo.video_id);
      setSelectedVideo(res);
      setSuccessMsg('Video successfully PUBLISHED! It is now accessible to enrolled students.');
      await loadVideos();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish video.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.topic_title && v.topic_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.chapter_title && v.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PUBLISHED') return v.status === 'PUBLISHED';
    if (filterStatus === 'APPROVED') return v.status === 'APPROVED';
    if (filterStatus === 'REVIEW') return v.status === 'REVIEW' && v.render_status === 'RENDERED';
    if (filterStatus === 'PENDING_RENDER') return v.render_status !== 'RENDERED';
    return true;
  });

  const formatSec = (sec?: number) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPlaceholder = Boolean(
    !selectedVideo?.video_storage_key && !selectedVideo?.video_url
      ? true
      : (selectedVideo?.video_storage_key && (selectedVideo.video_storage_key.includes('seed_') || selectedVideo.video_storage_key.includes('sample.mp4') || selectedVideo.video_storage_key.includes('placeholder'))) ||
        (selectedVideo?.video_url && (selectedVideo.video_url.includes('seed_') || selectedVideo.video_url.includes('sample.mp4') || selectedVideo.video_url.includes('placeholder')))
  );

  const isRenderedValid = Boolean(
    selectedVideo?.render_status === 'RENDERED' &&
    !isPlaceholder &&
    (selectedVideo?.actual_duration_seconds || 0) > 0 &&
    (selectedVideo?.scenes?.length || 0) > 0
  );

  const canPublish = Boolean(
    isRenderedValid &&
    selectedVideo?.script_status === 'SCRIPT_APPROVED'
  );

  const scriptBadgeStatus = selectedVideo?.script_status === 'SCRIPT_APPROVED' ? 'approved' : (selectedVideo?.script_status || 'NOT_GENERATED');
  const renderBadgeStatus = selectedVideo?.render_status === 'RENDERED' ? 'completed' : (selectedVideo?.render_status || 'NOT_STARTED');
  const isNeuralVoice = selectedVideo?.voice_quality === 'NEURAL' || (selectedVideo?.tts_engine && (selectedVideo.tts_engine.includes('neural') || selectedVideo.tts_engine.includes('elevenlabs')));

  const bannerMessage = successMsg
    ? { text: successMsg, type: 'success' as const }
    : errorMsg
    ? { text: errorMsg, type: 'error' as const }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Video Review"
        description="Inspect rendered videos, verify narration quality, and gate approval & publishing to students."
        actions={
          <button
            type="button"
            className="adm-btn adm-btn-secondary"
            onClick={loadVideos}
            title="Refresh videos"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      <MessageBanner
        message={bannerMessage}
        onDismiss={() => {
          setSuccessMsg(null);
          setErrorMsg(null);
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        {/* LEFT: Video List */}
        <div style={{ flex: '1 1 280px', minWidth: '270px', maxWidth: '340px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SurfacePanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search videos, topics..."
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {FILTER_STATUSES.map((st) => {
                  const active = filterStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                        backgroundColor: active ? 'var(--admin-primary-soft)' : 'transparent',
                        color: active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                      }}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel style={{ padding: '6px' }}>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {loading ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                  Loading videos...
                </div>
              ) : filteredVideos.length === 0 ? (
                <EmptyState
                  icon={<Clapperboard size={20} />}
                  title="No videos match filters"
                  description="Adjust the search or status filter to see more videos."
                />
              ) : (
                filteredVideos.map((v) => {
                  const isSelected = selectedVideo?.id === v.id;
                  const isRendered = v.render_status === 'RENDERED';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVideo(v)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: `1px solid ${isSelected ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--admin-primary-soft)' : 'var(--admin-surface)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.title}
                        </span>
                        <StatusBadge status={v.status} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                        {v.subject_name || 'Subject'} • {v.topic_title || 'Topic'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          {formatSec(v.actual_duration_seconds || v.approved_duration_seconds)}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            color: isRendered ? 'var(--admin-success)' : 'var(--admin-text-secondary)',
                          }}
                        >
                          <Film size={11} />
                          {isRendered ? 'Rendered' : 'Not Rendered'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </SurfacePanel>
        </div>

        {/* RIGHT: Detail Panel */}
        <div style={{ flex: '3 1 560px', minWidth: '320px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedVideo ? (
            <>
              {/* HEADER */}
              <SurfacePanel>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span
                        className="adm-badge"
                        style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                      >
                        {selectedVideo.subject_name || 'Subject'} • {selectedVideo.chapter_title || 'Chapter'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                        Topic: {selectedVideo.topic_title || '—'}
                      </span>
                      {selectedVideo.subtopic_title && (
                        <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                          ({selectedVideo.subtopic_title})
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>
                      {selectedVideo.title}
                    </h2>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedVideo.render_status !== 'RENDERED' && (
                      <button
                        type="button"
                        className="adm-btn adm-btn-primary"
                        onClick={handleStartGeneration}
                        disabled={actionLoading || generating || selectedVideo.script_status !== 'SCRIPT_APPROVED'}
                        title={selectedVideo.script_status !== 'SCRIPT_APPROVED' ? 'Approve script in Script Review to enable video generation' : ''}
                      >
                        {selectedVideo.script_status === 'SCRIPT_APPROVED' ? <Zap size={15} /> : <Lock size={15} />}
                        {generating ? 'Rendering...' : selectedVideo.script_status === 'SCRIPT_APPROVED' ? 'Generate Video' : 'Script Approval Required'}
                      </button>
                    )}

                    {selectedVideo.render_status === 'RENDERED' && (
                      <>
                        <button
                          type="button"
                          className="adm-btn adm-btn-secondary"
                          onClick={() => setShowRegenModal(true)}
                          disabled={actionLoading || generating}
                        >
                          <RefreshCw size={15} />
                          Regenerate
                        </button>

                        {selectedVideo.status !== 'APPROVED' && selectedVideo.status !== 'PUBLISHED' && canPublish && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-primary"
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            <Check size={15} />
                            Approve Video
                          </button>
                        )}

                        {selectedVideo.status !== 'PUBLISHED' && canPublish && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-primary"
                            onClick={handlePublish}
                            disabled={actionLoading}
                          >
                            <Rocket size={15} />
                            Publish for Students
                          </button>
                        )}

                        {selectedVideo.status === 'PUBLISHED' && isRenderedValid && (
                          <span
                            className="adm-badge"
                            style={{
                              backgroundColor: 'var(--admin-success-soft)',
                              color: 'var(--admin-success)',
                              padding: '6px 12px',
                              fontSize: '12px',
                            }}
                          >
                            <Check size={13} strokeWidth={3} />
                            LIVE & PUBLISHED
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </SurfacePanel>

              {/* PROCESSING PROGRESS BAR */}
              {generating && jobStatus && (
                <SurfacePanel>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>
                      Stage: {jobStatus.current_stage.replace('_', ' ')}
                    </span>
                    <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text-secondary)' }}>
                      {Math.round(jobStatus.progress)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'var(--admin-surface-raised)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                    <div
                      style={{
                        backgroundColor: 'var(--admin-primary)',
                        height: '100%',
                        borderRadius: '999px',
                        transition: 'width var(--duration-normal) var(--ease)',
                        width: `${jobStatus.progress}%`,
                      }}
                    />
                  </div>
                </SurfacePanel>
              )}

              {/* MAIN VIDEO PLAYER & METADATA */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                {/* VIDEO PLAYER */}
                <div style={{ flex: '2 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      aspectRatio: '16 / 9',
                      backgroundColor: '#000000',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      border: '1px solid var(--admin-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedVideo.video_url ? (
                      <video
                        controls
                        poster={selectedVideo.thumbnail_url}
                        src={selectedVideo.video_url}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      >
                        {selectedVideo.captions_storage_key && (
                          <track
                            kind="subtitles"
                            src={`/assets/${selectedVideo.captions_storage_key}`}
                            label="English"
                            default
                          />
                        )}
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <EmptyState
                        icon={<Clapperboard size={22} />}
                        title="No Rendered Video Yet"
                        description="This approved video plan is waiting for scene composition and narration rendering."
                        action={
                          <button
                            type="button"
                            className="adm-btn adm-btn-primary"
                            onClick={handleStartGeneration}
                            disabled={actionLoading || generating}
                          >
                            Start Video Generation
                          </button>
                        }
                      />
                    )}
                  </div>

                  {/* Captions Snippet */}
                  {selectedVideo.captions_srt && (
                    <SurfacePanel>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--admin-text-secondary)',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={13} />
                          Captions / Subtitles (SRT)
                        </span>
                        <span style={{ textTransform: 'none', fontWeight: 400 }}>Auto-Generated</span>
                      </div>
                      <pre
                        style={{
                          fontSize: '11px',
                          fontFamily: MONO_FONT,
                          color: 'var(--admin-text-secondary)',
                          backgroundColor: 'var(--admin-bg)',
                          border: '1px solid var(--admin-border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                          maxHeight: '96px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          margin: 0,
                          lineHeight: '16px',
                        }}
                      >
                        {selectedVideo.captions_srt}
                      </pre>
                    </SurfacePanel>
                  )}
                </div>

                {/* METADATA CARDS */}
                <div style={{ flex: '1 1 280px', minWidth: '270px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Status Card */}
                  <SurfacePanel title="Generation Status">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Video Plan:</span>
                        <StatusBadge status={(selectedVideo as any).video_plan_status || (selectedVideo.status === 'REVIEW' && selectedVideo.render_status === 'NOT_STARTED' ? 'PENDING' : 'APPROVED')} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Script Status:</span>
                        <StatusBadge status={scriptBadgeStatus} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Render Status:</span>
                        <StatusBadge status={renderBadgeStatus} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Learning Status:</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              selectedVideo.status === 'PUBLISHED' && isRenderedValid
                                ? 'var(--admin-success)'
                                : 'var(--admin-primary)',
                          }}
                        >
                          {selectedVideo.status === 'PUBLISHED' && isRenderedValid
                            ? 'PUBLISHED'
                            : canPublish
                            ? 'READY FOR PUBLISH'
                            : selectedVideo.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Version:</span>
                        <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text)', fontWeight: 600 }}>v{selectedVideo.version_number}</span>
                      </div>
                    </div>
                  </SurfacePanel>

                  {/* Duration & Engines */}
                  <SurfacePanel title="Audio & Engine Details">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Scene Count:</span>
                        <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: 'var(--admin-text)' }}>
                          {selectedVideo.scenes?.length || 0} scenes
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Target Duration:</span>
                        <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text)' }}>{formatSec(selectedVideo.approved_duration_seconds)} min</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Actual Duration:</span>
                        <span
                          style={{
                            fontFamily: MONO_FONT,
                            fontWeight: 600,
                            color: (selectedVideo.actual_duration_seconds || 0) > 0 ? 'var(--admin-success)' : 'var(--admin-text-secondary)',
                          }}
                        >
                          {formatSec(selectedVideo.actual_duration_seconds)} min
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>TTS Engine:</span>
                        <span style={{ color: 'var(--admin-text)' }}>{selectedVideo.tts_engine || 'deterministic'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Renderer:</span>
                        <span style={{ color: 'var(--admin-text)' }}>{selectedVideo.render_engine ? `${selectedVideo.render_engine} 720p HD` : 'FFmpeg 720p HD'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Storage / File Status:</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            color: isPlaceholder
                              ? 'var(--admin-warning)'
                              : selectedVideo.video_storage_key
                              ? 'var(--admin-success)'
                              : 'var(--admin-text-secondary)',
                          }}
                        >
                          {isPlaceholder ? (
                            <>
                              <AlertTriangle size={12} />
                              Placeholder (Needs Render)
                            </>
                          ) : selectedVideo.video_storage_key ? (
                            <>
                              <Check size={12} strokeWidth={3} />
                              Valid Rendered MP4
                            </>
                          ) : (
                            'No Output File'
                          )}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Source Traceability:</span>
                        <span style={{ color: 'var(--admin-text)' }}>
                          {selectedVideo.source_page_start != null ? `Pages ${selectedVideo.source_page_start}–${selectedVideo.source_page_end || selectedVideo.source_page_start}` : 'Curriculum Spec'}
                        </span>
                      </div>
                    </div>
                  </SurfacePanel>

                  {/* Narration Quality & Audio Metrics */}
                  <SurfacePanel
                    title="Narration & Neural Audio"
                    actions={
                      <span
                        className="adm-badge"
                        style={
                          isNeuralVoice
                            ? { backgroundColor: 'var(--admin-success-soft)', color: 'var(--admin-success)' }
                            : { backgroundColor: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' }
                        }
                      >
                        {selectedVideo.voice_quality || (isNeuralVoice ? 'NEURAL' : 'FALLBACK')}
                      </span>
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>TTS Provider:</span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
                          {selectedVideo.tts_provider || (selectedVideo.tts_engine?.includes('elevenlabs') ? 'ElevenLabs' : selectedVideo.tts_engine?.includes('neural') ? 'Neural TTS' : 'Local Fallback')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Voice:</span>
                        <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text)' }}>
                          {selectedVideo.voice || 'en-US-AndrewNeural'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Voice Quality:</span>
                        <span style={{ fontWeight: 600, color: isNeuralVoice ? 'var(--admin-success)' : 'var(--admin-warning)' }}>
                          {selectedVideo.voice_quality || (isNeuralVoice ? 'NEURAL' : 'FALLBACK')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Speaking Rate:</span>
                        <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text)' }}>
                          {selectedVideo.speaking_rate || '140 WPM'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Audio Quality:</span>
                        <span style={{ fontWeight: 600, color: 'var(--admin-success)' }}>
                          {selectedVideo.audio_quality || 'PASS'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Scenes with Narration:</span>
                        <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: 'var(--admin-success)' }}>
                          {selectedVideo.scenes?.filter(s => s.narration_text && s.narration_text.trim().length > 0).length || 0} / {selectedVideo.scenes?.length || 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Audio Duration:</span>
                        <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: 'var(--admin-success)' }}>
                          {formatSec(selectedVideo.actual_duration_seconds)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Narration Coverage:</span>
                        <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: 'var(--admin-success)' }}>
                          {selectedVideo.scenes && selectedVideo.scenes.length > 0
                            ? `${Math.round((selectedVideo.scenes.filter(s => s.narration_text && s.narration_text.trim().length > 0).length / selectedVideo.scenes.length) * 100)}%`
                            : '100%'}
                        </span>
                      </div>
                    </div>
                  </SurfacePanel>

                  {/* Thumbnail */}
                  {selectedVideo.thumbnail_url && (
                    <SurfacePanel title="Video Thumbnail">
                      <img
                        src={selectedVideo.thumbnail_url}
                        alt="Thumbnail"
                        style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--admin-border)' }}
                      />
                    </SurfacePanel>
                  )}
                </div>
              </div>

              {/* SCENES BREAKDOWN */}
              <div style={{ paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>
                      Educational Scenes Breakdown
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                      Individual timed scene components composed with visual cue slides and narration.
                    </p>
                  </div>
                  <span
                    className="adm-badge"
                    style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)' }}
                  >
                    {selectedVideo.scenes?.length || 0} Scenes Total
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                  {selectedVideo.scenes && selectedVideo.scenes.length > 0 ? (
                    selectedVideo.scenes.map((scene) => (
                      <div
                        key={scene.scene_number}
                        onClick={() => setSelectedScene(scene)}
                        style={{
                          backgroundColor: 'var(--admin-surface)',
                          border: '1px solid var(--admin-border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                            <span
                              className="adm-badge"
                              style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)', fontFamily: MONO_FONT }}
                            >
                              SCENE {String(scene.scene_number).padStart(2, '0')} • {scene.section_type}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: MONO_FONT, color: 'var(--admin-text-secondary)' }}>
                              <Clock size={11} />
                              {scene.estimated_duration_seconds}s
                            </span>
                          </div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {scene.title}
                          </h4>
                          <p
                            style={{
                              fontSize: '12px',
                              color: 'var(--admin-text-secondary)',
                              margin: '4px 0 0 0',
                              lineHeight: '18px',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {scene.narration_text}
                          </p>
                        </div>

                        <div style={{ paddingTop: '10px', borderTop: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                          <span
                            className="adm-badge"
                            style={{ backgroundColor: 'var(--admin-surface-raised)', color: 'var(--admin-text-secondary)', fontFamily: MONO_FONT }}
                          >
                            {scene.visual_type}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: MONO_FONT }}>
                            {formatSec(scene.start_time_seconds)}
                            <ArrowRight size={11} />
                            {formatSec(scene.end_time_seconds)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '32px 16px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--admin-text-secondary)',
                        backgroundColor: 'var(--admin-bg)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px dashed var(--admin-border)',
                      }}
                    >
                      No scenes generated yet. Generate the video to compile scene definitions.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <SurfacePanel>
              <EmptyState
                icon={<Clapperboard size={20} />}
                title="Select a video"
                description="Select a video from the list to inspect and review."
              />
            </SurfacePanel>
          )}
        </div>
      </div>

      {/* REGENERATION CONFIRMATION MODAL */}
      <Modal
        open={showRegenModal && !!selectedVideo}
        onClose={() => setShowRegenModal(false)}
        title="Confirm Video Regeneration"
        maxWidth={480}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowRegenModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleRegenerateConfirm}
              disabled={actionLoading}
            >
              Confirm Regeneration
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '20px', margin: 0 }}>
            Regenerating video for <strong style={{ color: 'var(--admin-text)' }}>"{selectedVideo?.title}"</strong> will synthesize new narration audio and compose a new MP4 video.
          </p>
          <div
            style={{
              backgroundColor: 'var(--admin-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: 'var(--admin-text-secondary)',
            }}
          >
            <div>
              • Current Version: <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-text)', fontWeight: 600 }}>v{selectedVideo?.version_number}</span>
            </div>
            <div>
              • Previous version will be archived as <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-warning)', fontWeight: 600 }}>SUPERSEDED</span>.
            </div>
            <div>
              • Status will reset to <span style={{ fontFamily: MONO_FONT, color: 'var(--admin-primary)', fontWeight: 600 }}>REVIEW</span> until approved again.
            </div>
          </div>
        </div>
      </Modal>

      {/* SCENE DETAIL MODAL */}
      <Modal
        open={!!selectedScene}
        onClose={() => setSelectedScene(null)}
        title={
          selectedScene ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="adm-badge"
                style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)', fontFamily: MONO_FONT }}
              >
                SCENE {String(selectedScene.scene_number).padStart(2, '0')}
              </span>
              {selectedScene.title}
            </span>
          ) : (
            'Scene'
          )
        }
        maxWidth={520}
        footer={
          <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setSelectedScene(null)}>
            Close
          </button>
        }
      >
        {selectedScene && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                Narration Script
              </span>
              <p
                style={{
                  backgroundColor: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--admin-text)',
                  lineHeight: '20px',
                  margin: 0,
                }}
              >
                {selectedScene.narration_text}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div style={{ backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                <span style={{ color: 'var(--admin-text-secondary)', display: 'block', fontSize: '10px', marginBottom: '2px' }}>Visual Type</span>
                <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{selectedScene.visual_type}</span>
              </div>
              <div style={{ backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
                <span style={{ color: 'var(--admin-text-secondary)', display: 'block', fontSize: '10px', marginBottom: '2px' }}>Estimated Duration</span>
                <span style={{ fontWeight: 600, color: 'var(--admin-success)' }}>{selectedScene.estimated_duration_seconds}s</span>
              </div>
            </div>

            {selectedScene.formula && (
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-warning)', marginBottom: '4px' }}>
                  Mathematical Formula
                </span>
                <div
                  style={{
                    backgroundColor: 'var(--admin-warning-soft)',
                    border: '1px solid #FDE68A',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    fontFamily: MONO_FONT,
                    color: 'var(--admin-warning)',
                  }}
                >
                  {selectedScene.formula}
                </div>
              </div>
            )}

            {selectedScene.on_screen_text && (
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                  On-Screen Text
                </span>
                <div
                  style={{
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    color: 'var(--admin-text)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {selectedScene.on_screen_text}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
