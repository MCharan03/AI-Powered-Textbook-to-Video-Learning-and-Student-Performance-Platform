import React, { useRef, useState, useEffect } from 'react';
import { VideoUnit } from '../lib/types';
import { api } from '../lib/api';

interface VideoPlayerWrapperProps {
  video: VideoUnit;
  onProceedToQuiz?: () => void;
}

export const VideoPlayerWrapper: React.FC<VideoPlayerWrapperProps> = ({ video, onProceedToQuiz }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressSyncStatus, setProgressSyncStatus] = useState<string>('');

  useEffect(() => {
    setIsCompleted(false);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [video.id]);

  const handleTimeUpdate = async () => {
    if (!videoRef.current) return;
    const time = Math.floor(videoRef.current.currentTime);
    setCurrentTime(time);

    // Sync progress every 30 seconds
    if (time > 0 && time % 30 === 0) {
      try {
        const pct = Math.min(100, Math.round((time / (video.duration_seconds || 330)) * 100));
        await api.updateVideoProgress(video.id, pct, false);
        setProgressSyncStatus('Progress synced');
        setTimeout(() => setProgressSyncStatus(''), 2000);
      } catch {
        // fail silently
      }
    }
  };

  const handleEnded = async () => {
    setIsCompleted(true);
    setIsPlaying(false);
    try {
      await api.updateVideoProgress(video.id, 100, true);
      setProgressSyncStatus('Completed! Progress recorded.');
    } catch {
      // fail silently
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const resolveVideoSrc = (rawUrl?: string): string => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  };

  const videoSrc = resolveVideoSrc(video.video_url);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          position: 'relative',
          backgroundColor: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          aspectRatio: '16 / 9',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Duration badge */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#F8FAFC',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          Target: ~{video.target_duration_minutes || 5.5} min
        </div>
      </div>

      {/* Video Details & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{video.title}</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Duration: {formatTime(video.duration_seconds || 330)}
            </span>
            {progressSyncStatus && (
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
                {progressSyncStatus}
              </span>
            )}
          </div>
        </div>

        {onProceedToQuiz && (
          <button
            onClick={onProceedToQuiz}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
              transition: 'background-color 150ms ease',
            }}
          >
            {isCompleted ? 'Take Topic Quiz →' : 'Proceed to Quiz →'}
          </button>
        )}
      </div>
    </div>
  );
};
