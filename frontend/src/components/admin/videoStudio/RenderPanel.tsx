import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  Clock,
  Eye,
  EyeOff,
  Film,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Square,
  Timer,
  XCircle,
} from 'lucide-react';
import { SurfacePanel } from '../../SurfacePanel';
import { VideoGenerationStatus, VideoPlan, VideoRenderDetails } from '../../../lib/types';
import { api, mediaUrl } from '../../../lib/api';
import {
  Banner,
  EmptyHint,
  LifecycleBadge,
  SectionHeader,
  formatDuration,
  subTextStyle,
} from './StudioUi';

interface RenderPanelProps {
  plans: VideoPlan[];
  videos: VideoRenderDetails[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const CANONICAL_STAGES = [
  { stage: 1, key: 'PREPARING_SCRIPT', name: 'Preparing script and scenes' },
  { stage: 2, key: 'GENERATING_AUDIO', name: 'Generating narration audio' },
  { stage: 3, key: 'GENERATING_VISUALS', name: 'Generating scene visuals' },
  { stage: 4, key: 'RENDERING_SCENES', name: 'Rendering individual scenes' },
  { stage: 5, key: 'MERGING_SCENES', name: 'Merging scenes' },
  { stage: 6, key: 'ENCODING_MP4', name: 'Encoding final MP4' },
  { stage: 7, key: 'GENERATING_CAPTIONS', name: 'Generating captions' },
  { stage: 8, key: 'GENERATING_THUMBNAIL', name: 'Generating thumbnail' },
  { stage: 9, key: 'FINAL_VALIDATION', name: 'Final video validation' },
];

const formatSeconds = (sec?: number | null): string => {
  if (sec === undefined || sec === null || isNaN(sec)) return '--';
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const renderStatusLabel = (status?: string): string => {
  const s = (status || 'NOT_STARTED').toUpperCase();
  if (s === 'RENDERED') return 'Rendered';
  if (s === 'FAILED') return 'Failed';
  if (s === 'AUDIO_GENERATING') return 'Rendering…';
  if (s === 'NOT_STARTED') return 'Not rendered';
  return s.replace(/_/g, ' ');
};

/**
 * Step 5 — Real-Time Video Rendering.
 * Renders real MP4 files through the 9-stage video rendering pipeline using
 * approved scripts. Administrators can monitor real-time progress stage by stage,
 * cancel running jobs, retry failed jobs, and inspect generated videos.
 */
export const RenderPanel: React.FC<RenderPanelProps> = ({
  plans,
  videos,
  loading,
  onRefresh,
  onNext,
  onBack,
}) => {
  // Map of video_id -> real-time generation status
  const [liveStatuses, setLiveStatuses] = useState<Record<number, VideoGenerationStatus>>({});
  // Set of video IDs currently being processed / polled
  const [activeVideoIds, setActiveVideoIds] = useState<Set<number>>(new Set());
  // Video preview expanded state
  const [previewVideoId, setPreviewVideoId] = useState<number | null>(null);
  // User messages
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  // Polling ref
  const pollIntervalRef = useRef<number | null>(null);

  const videosById = useMemo(() => {
    const map = new Map<number, VideoRenderDetails>();
    videos.forEach((v) => map.set(v.video_id || v.id, v));
    return map;
  }, [videos]);

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          (a.topic_title || '').localeCompare(b.topic_title || '') ||
          (a.sequence_number || 0) - (b.sequence_number || 0)
      ),
    [plans]
  );

  const renderedCount = plans.filter(
    (p) => (videosById.get(p.id)?.render_status || '').toUpperCase() === 'RENDERED'
  ).length;

  const failedCount = plans.filter(
    (p) => (videosById.get(p.id)?.render_status || '').toUpperCase() === 'FAILED'
  ).length;

  const inProgressCount = activeVideoIds.size;

  const readyCount = plans.filter((p) => {
    const v = videosById.get(p.id);
    const scriptOk = (v?.script_status || '').toUpperCase() === 'SCRIPT_APPROVED';
    const render = (v?.render_status || '').toUpperCase();
    return scriptOk && render !== 'RENDERED' && !activeVideoIds.has(p.id);
  }).length;

  // Stop polling interval
  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Restore running jobs on mount to survive browser refresh
  useEffect(() => {
    let isMounted = true;

    const checkActiveJobs = async () => {
      try {
        const runningJobs = await api.listVideoRenderingJobs({ status: 'RUNNING', limit: 50 });
        if (!isMounted) return;

        const newActive = new Set<number>();
        const newStatuses: Record<number, VideoGenerationStatus> = {};

        runningJobs.forEach((job) => {
          newActive.add(job.video_id);
          newStatuses[job.video_id] = {
            video_id: job.video_id,
            video_title: job.video_title || '',
            job_id: job.job_id,
            job_status: job.status,
            current_stage: job.current_stage,
            stage_number: job.stage_number,
            stage_name: job.stage_name,
            progress: job.progress,
            render_status: 'AUDIO_GENERATING',
            video_status: 'REVIEW',
            total_scenes: job.total_scenes,
            completed_scenes: job.completed_scenes,
            current_scene: job.current_scene,
            elapsed_seconds: job.elapsed_seconds,
            estimated_remaining_seconds: job.estimated_remaining_seconds,
            updated_at: job.updated_at,
            is_cancelled: job.is_cancelled,
          };
        });

        // Also check any plan whose database render_status is AUDIO_GENERATING
        plans.forEach((plan) => {
          const v = videosById.get(plan.id);
          if ((v?.render_status || '').toUpperCase() === 'AUDIO_GENERATING') {
            newActive.add(plan.id);
          }
        });

        if (newActive.size > 0) {
          setActiveVideoIds(newActive);
          setLiveStatuses((prev) => ({ ...prev, ...newStatuses }));
        }
      } catch {
        // Best effort check on mount
      }
    };

    checkActiveJobs();

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [plans, videosById]);

  // Unified polling loop for all active video IDs
  useEffect(() => {
    if (activeVideoIds.size === 0) {
      stopPolling();
      return;
    }

    stopPolling();
    pollIntervalRef.current = window.setInterval(async () => {
      const ids = Array.from(activeVideoIds);
      let anyCompleted = false;

      for (const vid of ids) {
        try {
          const st = await api.getVideoGenerationStatus(vid);
          setLiveStatuses((prev) => ({ ...prev, [vid]: st }));

          const isDone =
            st.render_status === 'RENDERED' ||
            st.job_status === 'COMPLETED' ||
            st.job_status === 'FAILED' ||
            st.job_status === 'CANCELLED' ||
            st.is_cancelled;

          if (isDone) {
            setActiveVideoIds((prev) => {
              const next = new Set(prev);
              next.delete(vid);
              return next;
            });
            anyCompleted = true;

            if (st.render_status === 'RENDERED' || st.job_status === 'COMPLETED') {
              setSuccess(`“${st.video_title || `Video #${vid}`}” rendering completed successfully!`);
            } else if (st.is_cancelled) {
              setErrors((prev) => [...prev, `“${st.video_title || `Video #${vid}`}” rendering was cancelled.`]);
            } else if (st.error_message) {
              setErrors((prev) => [...prev, `“${st.video_title || `Video #${vid}`}” failed: ${st.error_message}`]);
            }
          }
        } catch {
          // Status polling is best effort
        }
      }

      if (anyCompleted) {
        await onRefresh();
      }
    }, 1500);

    return stopPolling;
  }, [activeVideoIds, onRefresh]);

  // Start rendering a video plan via background job
  const handleStartRender = async (plan: VideoPlan, force: boolean = false) => {
    setErrors([]);
    setSuccess(null);
    try {
      setActiveVideoIds((prev) => new Set(prev).add(plan.id));
      const job = await api.startVideoRenderingJob(plan.id, force);

      setLiveStatuses((prev) => ({
        ...prev,
        [plan.id]: {
          video_id: plan.id,
          video_title: plan.title,
          job_id: job.job_id,
          job_status: job.status,
          current_stage: job.current_stage,
          stage_number: job.stage_number,
          stage_name: job.stage_name,
          progress: job.progress || 2,
          render_status: 'AUDIO_GENERATING',
          video_status: 'REVIEW',
          total_scenes: job.total_scenes,
          completed_scenes: job.completed_scenes,
          current_scene: job.current_scene,
          elapsed_seconds: job.elapsed_seconds,
          estimated_remaining_seconds: job.estimated_remaining_seconds,
          is_cancelled: false,
        },
      }));
    } catch (err: any) {
      setActiveVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(plan.id);
        return next;
      });
      const msg = err?.message || 'Failed to start rendering';
      setErrors((prev) => [...prev, `${plan.title}: ${msg}`]);
    }
  };

  // Cancel an active rendering job
  const handleCancelRender = async (planId: number) => {
    const status = liveStatuses[planId];
    const jobId = status?.job_id ? String(status.job_id) : null;
    if (!jobId) {
      setActiveVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
      return;
    }

    try {
      await api.cancelVideoRenderingJob(jobId, 'Cancelled by administrator from Video Studio');
      setLiveStatuses((prev) => ({
        ...prev,
        [planId]: {
          ...prev[planId],
          job_status: 'CANCELLED',
          is_cancelled: true,
          render_status: 'FAILED',
        },
      }));
      setActiveVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
      await onRefresh();
    } catch (err: any) {
      setErrors((prev) => [...prev, `Failed to cancel render: ${err?.message || err}`]);
    }
  };

  // Render all ready videos in parallel / sequence
  const handleRenderAll = async () => {
    const readyPlans = sortedPlans.filter((p) => {
      const v = videosById.get(p.id);
      const scriptOk = (v?.script_status || '').toUpperCase() === 'SCRIPT_APPROVED';
      const render = (v?.render_status || '').toUpperCase();
      return scriptOk && render !== 'RENDERED' && !activeVideoIds.has(p.id);
    });

    if (readyPlans.length === 0) {
      setSuccess('No videos are ready to render. Approve the remaining scripts first.');
      return;
    }

    setErrors([]);
    setSuccess(null);

    for (const plan of readyPlans) {
      await handleStartRender(plan, false);
    }
  };

  if (loading) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
          <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading render status…
        </div>
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel>
      <SectionHeader
        title="Step 5 · Real-time video rendering"
        description="Renders MP4 videos with narration, synchronized visuals, captions, and transitions using approved scripts. Track genuine 9-stage progress, cancel long jobs, or retry failed renders."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onBack}>
              Back
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={handleRenderAll}
              disabled={readyCount === 0}
            >
              <Clapperboard size={13} />
              Render ready videos ({readyCount})
            </button>
          </div>
        }
      />

      {errors.length > 0 && (
        <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Banner tone="error" onDismiss={() => setErrors([])}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Rendering attention needed</div>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: '12px', marginTop: '2px' }}>
                {e}
              </div>
            ))}
            <div style={{ fontSize: '11.5px', marginTop: '6px' }}>
              Check script approval or audio configuration, then retry. Retrying re-renders safely from the existing approved script.
            </div>
          </Banner>
        </div>
      )}

      {success && (
        <div style={{ marginBottom: '12px' }}>
          <Banner tone="success" onDismiss={() => setSuccess(null)}>
            {success}
          </Banner>
        </div>
      )}

      {/* Overview Stat Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {[
          { label: 'Ready to render', value: String(readyCount), color: 'var(--admin-text)' },
          { label: 'In progress', value: String(inProgressCount), color: inProgressCount > 0 ? 'var(--admin-primary)' : 'var(--admin-text)' },
          { label: 'Rendered', value: `${renderedCount}/${plans.length}`, color: 'var(--admin-success)' },
          { label: 'Failed / Cancelled', value: String(failedCount), color: failedCount > 0 ? 'var(--admin-error)' : 'var(--admin-text-secondary)' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-raised)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: stat.color, marginTop: '2px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {plans.length === 0 ? (
        <EmptyHint title="Nothing to render" description="Approve video plans and their scripts first in Steps 3 and 4." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedPlans.map((plan) => {
            const video = videosById.get(plan.id);
            const scriptOk = (video?.script_status || '').toUpperCase() === 'SCRIPT_APPROVED';
            const renderStatus = (video?.render_status || 'NOT_STARTED').toUpperCase();
            const isActive = activeVideoIds.has(plan.id);
            const live = liveStatuses[plan.id];

            const rendered = renderStatus === 'RENDERED' || live?.render_status === 'RENDERED';
            const failed = renderStatus === 'FAILED' || live?.job_status === 'FAILED';
            const cancelled = live?.job_status === 'CANCELLED' || live?.is_cancelled;

            const currentStageNum = live?.stage_number || (rendered ? 9 : 0);
            const currentStageName = live?.stage_name || (rendered ? 'Video rendered & validated' : 'Not started');
            const progressPercent = Math.max(0, Math.min(100, live?.progress || (rendered ? 100 : 0)));

            const isPreviewOpen = previewVideoId === plan.id;
            const videoMediaUrl = video?.video_url ? mediaUrl(video.video_url) : null;

            return (
              <div
                key={plan.id}
                style={{
                  border: `1px solid ${isActive ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  backgroundColor: 'var(--admin-surface-raised)',
                  boxShadow: isActive ? '0 0 0 1px var(--admin-primary-soft)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    {/* Header line: Title, lifecycle badge, render badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                        {plan.title}
                      </span>
                      {video ? <LifecycleBadge video={video} /> : null}
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: rendered
                            ? 'var(--admin-success-soft)'
                            : failed || cancelled
                            ? 'var(--admin-error-soft)'
                            : isActive
                            ? 'var(--admin-primary-soft)'
                            : 'var(--admin-surface)',
                          color: rendered
                            ? 'var(--admin-success)'
                            : failed || cancelled
                            ? 'var(--admin-error)'
                            : isActive
                            ? 'var(--admin-primary)'
                            : 'var(--admin-text-secondary)',
                          border: '1px solid var(--admin-border)',
                        }}
                      >
                        {isActive
                          ? `Stage ${currentStageNum}/9: ${currentStageName}`
                          : cancelled
                          ? 'Cancelled'
                          : renderStatusLabel(renderStatus)}
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div style={subTextStyle}>
                      {plan.topic_title} · planned {formatDuration(plan.estimated_duration_seconds || plan.duration_seconds)}
                      {video?.actual_duration_seconds ? ` · actual ${formatDuration(video.actual_duration_seconds)}` : ''}
                    </div>

                    {/* Warning if script not approved */}
                    {!scriptOk && (
                      <div style={{ fontSize: '11.5px', color: 'var(--admin-warning)', marginTop: '4px' }}>
                        Script is not approved — approve it in Step 4 to enable rendering.
                      </div>
                    )}

                    {/* Failure / Cancel alert message */}
                    {(failed || cancelled) && (live?.error_message || video?.render_error) && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--admin-error-soft)',
                          color: 'var(--admin-error)',
                          fontSize: '11.5px',
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{live?.error_message || video?.render_error}</span>
                      </div>
                    )}

                    {/* Active Real-Time 9-Stage Progress Tracker */}
                    {isActive && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--admin-surface)',
                          border: '1px solid var(--admin-border)',
                        }}
                      >
                        {/* Stage title & metrics */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--admin-text)',
                            marginBottom: '6px',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--admin-primary)' }} />
                            <span>Stage {currentStageNum} of 9: {currentStageName}</span>
                          </span>
                          <span style={{ fontWeight: 700, color: 'var(--admin-primary)' }}>
                            {Math.round(progressPercent)}%
                          </span>
                        </div>

                        {/* Animated live progress bar */}
                        <div
                          style={{
                            height: '6px',
                            borderRadius: '999px',
                            backgroundColor: 'var(--admin-border)',
                            overflow: 'hidden',
                            marginBottom: '8px',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(4, Math.min(100, progressPercent))}%`,
                              backgroundColor: 'var(--admin-primary)',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>

                        {/* Scene count, elapsed, and remaining ETA metrics */}
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '14px',
                            fontSize: '11px',
                            color: 'var(--admin-text-secondary)',
                          }}
                        >
                          {live?.total_scenes ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Film size={11} />
                              Scene {live.current_scene || 1} of {live.total_scenes} ({live.completed_scenes || 0} completed)
                            </span>
                          ) : null}

                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Timer size={11} />
                            Elapsed: {formatSeconds(live?.elapsed_seconds)}
                          </span>

                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            ETA: {live?.estimated_remaining_seconds ? `~${formatSeconds(live.estimated_remaining_seconds)}` : 'Calculating…'}
                          </span>
                        </div>

                        {/* 9-stage visual pills pipeline */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '3px',
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px dashed var(--admin-border)',
                          }}
                        >
                          {CANONICAL_STAGES.map((s) => {
                            const isPast = s.stage < currentStageNum;
                            const isCurr = s.stage === currentStageNum;
                            return (
                              <div
                                key={s.stage}
                                title={`Stage ${s.stage}: ${s.name}`}
                                style={{
                                  flex: 1,
                                  height: '4px',
                                  borderRadius: '2px',
                                  backgroundColor: isPast
                                    ? 'var(--admin-success)'
                                    : isCurr
                                    ? 'var(--admin-primary)'
                                    : 'var(--admin-border)',
                                  transition: 'background-color 0.3s ease',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {isActive ? (
                      <button
                        type="button"
                        className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => handleCancelRender(plan.id)}
                        title="Cancel this rendering job safely"
                      >
                        <Square size={12} /> Cancel render
                      </button>
                    ) : rendered ? (
                      <>
                        {videoMediaUrl && (
                          <button
                            type="button"
                            className="adm-btn adm-btn-ghost adm-btn-sm"
                            onClick={() => setPreviewVideoId(isPreviewOpen ? null : plan.id)}
                            title="Preview rendered video inline"
                          >
                            {isPreviewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                            {isPreviewOpen ? 'Hide preview' : 'Quick preview'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="adm-btn adm-btn-primary adm-btn-sm"
                          onClick={onNext}
                        >
                          <Eye size={12} /> Step 6 · Review
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-ghost adm-btn-sm"
                          onClick={() => handleStartRender(plan, true)}
                          title="Re-render from the existing approved script"
                        >
                          <RefreshCw size={12} /> Re-render
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn adm-btn-primary adm-btn-sm"
                        disabled={!scriptOk}
                        onClick={() => handleStartRender(plan, failed || cancelled)}
                      >
                        {failed || cancelled ? <RefreshCw size={12} /> : <Film size={12} />}
                        {failed || cancelled ? 'Retry render' : 'Render video'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline MP4 Player when Preview is opened */}
                {isPreviewOpen && videoMediaUrl && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#000',
                      border: '1px solid var(--admin-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <video
                      src={videoMediaUrl}
                      controls
                      autoPlay
                      style={{
                        width: '100%',
                        maxHeight: '360px',
                        borderRadius: '4px',
                      }}
                    />
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#999' }}>
                      Rendered MP4 · Duration: {video?.actual_duration_seconds ? formatDuration(video.actual_duration_seconds) : '--'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security callout */}
      <div
        style={{
          marginTop: '16px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--admin-primary-soft)',
          color: 'var(--admin-primary)',
          fontSize: '11.5px',
          display: 'flex',
          gap: '7px',
          alignItems: 'flex-start',
        }}
      >
        <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Rendered videos stay strictly private to admins. They are never visible to students until you inspect and approve them in Step 6, and explicitly publish them in Step 7.
        </span>
      </div>

      {/* Footer navigation */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--admin-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--admin-text-secondary)',
            display: 'inline-flex',
            gap: '5px',
            alignItems: 'center',
          }}
        >
          <Clock size={12} /> {renderedCount} of {plans.length} videos rendered.
        </span>
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          disabled={renderedCount === 0}
          onClick={onNext}
        >
          Continue to Step 6 · Review & Publish
        </button>
      </div>
    </SurfacePanel>
  );
};
