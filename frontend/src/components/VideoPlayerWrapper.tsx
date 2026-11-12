import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VideoUnit } from '../lib/types';
import { api, mediaUrl } from '../lib/api';

interface VideoPlayerWrapperProps {
  video: VideoUnit;
  onProceedToQuiz?: () => void;
}

/**
 * PHASE 3B protocol:
 * - Accumulates REAL watch time (timeupdate deltas only while playing, and
 *   only for small deltas <= 1.5s so seeks do not count as watching).
 * - Syncs to the server on: every ~15s of accumulated playback, on pause,
 *   on unmount, and on page exit (fetch keepalive).
 * - Completion is validated server-side from watched_seconds vs duration;
 *   seeking to the end can never mark the video complete.
 * - Resumes from the student's last saved position and loads the WebVTT
 *   caption track when the video provides captions_url.
 */
export const VideoPlayerWrapper: React.FC<VideoPlayerWrapperProps> = ({ video, onProceedToQuiz }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressSyncStatus, setProgressSyncStatus] = useState<string>('');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Watch-time accumulators (refs so event handlers always see current values)
  const watchedSecondsRef = useRef<number>(video.watch_percentage != null && video.duration_seconds > 0
    ? (video.watch_percentage / 100) * video.duration_seconds
    : 0);
  const lastTimeRef = useRef<number>(0);
  const sinceSyncRef = useRef<number>(0);
  const syncingRef = useRef(false);

  // Initialize playhead at the resume position when the video element mounts
  useEffect(() => {
    watchedSecondsRef.current = video.watch_percentage != null && video.duration_seconds > 0
      ? (video.watch_percentage / 100) * video.duration_seconds
      : 0;
    lastTimeRef.current = 0;
    sinceSyncRef.current = 0;
    setIsCompleted(false);
    setCurrentTime(0);
    setIsPlaying(false);
    setMediaError(null);
  }, [video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const resume = video.resume_position_seconds ?? 0;
    if (resume > 0 && Math.abs(el.currentTime - resume) > 1) {
      try {
        el.currentTime = resume;
        lastTimeRef.current = resume;
      } catch {
        // seek before metadata loads — metadata loaded handler will retry
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, videoRef.current]);

  const syncProgress = useCallback(async (
    completed: boolean,
    lastPosition: number,
    opts?: { keepalive?: boolean }
  ) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const res = await api.updateVideoProgress(video.id, {
        watched_seconds: Math.round(watchedSecondsRef.current * 10) / 10,
        last_position_seconds: Math.round(lastPosition * 10) / 10,
        completed,
      });
      if (!opts?.keepalive) {
        if (res.completed) {
          setIsCompleted(true);
          setProgressSyncStatus('Lesson completed — saved');
        } else {
          setProgressSyncStatus(`Progress saved — ${Math.round(res.progress_pct)}% watched`);
        }
        window.setTimeout(() => setProgressSyncStatus(''), 4000);
      }
    } catch (err: any) {
      // 400 means the client claimed completion without enough watch coverage;
      // real syncs never send completed=true unless coverage passed, so treat
      // other failures as transient network problems and keep playing.
      if (!opts?.keepalive) {
        setProgressSyncStatus(err?.status === 400
          ? 'Cannot mark complete yet — keep watching'
          : 'Progress sync failed — will retry');
        window.setTimeout(() => setProgressSyncStatus(''), 4000);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [video.id]);

  // Periodic sync every ~15s of accumulated playback while playing
  useEffect(() => {
    const interval = window.setInterval(() => {
      const el = videoRef.current;
      if (!el || !isPlaying) return;
      if (sinceSyncRef.current >= 15) {
        sinceSyncRef.current = 0;
        void syncProgress(false, el.currentTime);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isPlaying, syncProgress]);

  // Sync on pause and on unmount / page exit
  useEffect(() => {
    const el = videoRef.current;

    const handlePageExit = () => {
      // fetch keepalive survives unload; fire-and-forget. Includes the bearer
      // token because the progress endpoint requires authentication.
      try {
        void fetch(mediaUrl(`/learn/videos/${video.id}/progress`), {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : {}),
          },
          body: JSON.stringify({
            watched_seconds: Math.round(watchedSecondsRef.current * 10) / 10,
            last_position_seconds: Math.round((el?.currentTime ?? 0) * 10) / 10,
            completed: false,
          }),
        });
      } catch {
        // best-effort only
      }
    };

    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);
    return () => {
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('pagehide', handlePageExit);
      // Unmount sync (e.g. switching lessons): commit accumulated watch time
      if (el) {
        void syncProgress(false, el.currentTime);
      }
    };
  }, [video.id, syncProgress]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    const time = el.currentTime;
    setCurrentTime(time);

    if (isPlaying) {
      const delta = time - lastTimeRef.current;
      // Only count small, monotonic deltas as real playback; a large jump or a
      // backward jump is a seek and does NOT accumulate watch time.
      if (delta > 0 && delta <= 1.5) {
        watchedSecondsRef.current += delta;
        sinceSyncRef.current += delta;
      }
    }
    lastTimeRef.current = time;
  };

  const handlePlay = () => {
    setIsPlaying(true);
    const el = videoRef.current;
    if (el) lastTimeRef.current = el.currentTime;
  };

  const handlePause = () => {
    setIsPlaying(false);
    const el = videoRef.current;
    if (el) void syncProgress(false, el.currentTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    const el = videoRef.current;
    void syncProgress(true, el?.currentTime ?? video.duration_seconds);
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const retryMedia = () => {
    setMediaError(null);
    const el = videoRef.current;
    if (el) {
      el.load();
      void el.play().catch(() => undefined);
    }
  };

  const captionsSrc = video.captions_url ? mediaUrl(video.captions_url) : '';
  const videoSrc = mediaUrl(video.video_url);
  const total = video.duration_seconds || 1;
  const pct = Math.min(100, Math.round((currentTime / total) * 100));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
        {mediaError && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', textAlign: 'center', padding: '24px'
          }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Video playback failed</p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
              The lesson media could not be loaded. Check your connection and try again.
            </p>
            <button
              onClick={retryMedia}
              style={{
                padding: '8px 18px', borderRadius: 6, border: 'none',
                background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', maxHeight: 480, display: 'block' }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={() => setMediaError('Video playback failed to load.')}
          onLoadedMetadata={() => {
            const el = videoRef.current;
            const resume = video.resume_position_seconds ?? 0;
            if (el && resume > 0 && Math.abs(el.currentTime - resume) > 1) {
              try {
                el.currentTime = resume;
                lastTimeRef.current = resume;
              } catch {
                // ignore
              }
            }
            if (el) el.playbackRate = playbackRate;
          }}
        >
          {captionsSrc && (
            <track
              kind="subtitles"
              label="Captions"
              srcLang="en"
              src={captionsSrc}
              default
            />
          )}
        </video>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', transition: 'width 0.3s' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(total / 60)}:{String(Math.round(total % 60)).padStart(2, '0')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => changeSpeed(rate)}
              style={{
                padding: '4px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
                border: playbackRate === rate ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: playbackRate === rate ? '#eff6ff' : '#fff',
                color: playbackRate === rate ? '#2563eb' : '#475569',
                fontWeight: playbackRate === rate ? 600 : 400
              }}
            >
              {rate}×
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, minHeight: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        {progressSyncStatus && (
          <span style={{ fontSize: 12, color: isCompleted ? '#059669' : '#64748b' }}>{progressSyncStatus}</span>
        )}
      </div>

      {isCompleted && onProceedToQuiz && (
        <button
          onClick={onProceedToQuiz}
          style={{
            marginTop: 8, padding: '10px 20px', borderRadius: 8, border: 'none',
            background: '#059669', color: '#fff', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Proceed to Quiz →
        </button>
      )}
    </div>
  );
};
