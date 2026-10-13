import React, { useState, useEffect } from 'react';
import { VideoPlayerWrapper } from '../../components/VideoPlayerWrapper';
import { LessonPlaylist } from '../../components/LessonPlaylist';
import { SurfacePanel } from '../../components/SurfacePanel';
import { api } from '../../lib/api';
import { VideoUnit } from '../../lib/types';

interface StudentVideoPlayerProps {
  onNavigate: (route: string) => void;
}

export const StudentVideoPlayer: React.FC<StudentVideoPlayerProps> = ({ onNavigate }) => {
  const [currentVideo, setCurrentVideo] = useState<VideoUnit | null>(null);
  const [playlist, setPlaylist] = useState<VideoUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialVideo = async () => {
      try {
        setLoading(true);
        // Load published video unit (id: 1)
        const video = await api.getVideoUnit(1);
        setCurrentVideo(video);
        setPlaylist([
          video,
          {
            id: 2,
            topic_id: 1,
            title: 'Types of Chemical Reactions: Combination & Decomposition',
            duration_seconds: 345,
            target_duration_minutes: 5.75,
            video_url: '/static/videos/sample.mp4',
            review_status: 'published',
          },
          {
            id: 3,
            topic_id: 1,
            title: 'Displacement, Double Displacement & Redox Reactions',
            duration_seconds: 320,
            target_duration_minutes: 5.3,
            video_url: '/static/videos/sample.mp4',
            review_status: 'published',
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Video not available. Has it been approved and published by an administrator?');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialVideo();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Pre-Rendered Video Lesson</h1>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
          Strictly pre-rendered video playback with automated milestone progress synchronization.
        </p>
      </div>

      {error ? (
        <SurfacePanel>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '32px', color: '#EF4444' }}>🔒</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '12px' }}>
              Content Locked or Pending Review
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px', maxWidth: '480px', margin: '6px auto 0' }}>
              {error}
            </p>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '12px' }}>
              Note: Unapproved videos in 'pending_review' cannot be accessed by students until an Administrator approves them in the Review Queue.
            </p>
          </div>
        </SurfacePanel>
      ) : currentVideo ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: '24px' }}>
          {/* Left Column: Player & Metadata */}
          <div>
            <VideoPlayerWrapper
              video={currentVideo}
              onProceedToQuiz={() => onNavigate('student-quiz')}
            />

            {/* Video Lesson Key Objectives */}
            <div style={{ marginTop: '20px' }}>
              <SurfacePanel>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
                  Lesson Learning Objectives
                </h3>
                <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: '22px' }}>
                  <li>Understand physical vs. chemical change representations.</li>
                  <li>Identify reactants and products in symbolic equations.</li>
                  <li>Apply the Law of Conservation of Mass to balancing chemical equations.</li>
                  <li>Differentiate between exothermic and endothermic chemical processes.</li>
                </ul>
              </SurfacePanel>
            </div>
          </div>

          {/* Right Column: Playlist */}
          <div>
            <LessonPlaylist
              items={playlist}
              activeVideoId={currentVideo.id}
              onSelectVideo={(v) => setCurrentVideo(v)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
