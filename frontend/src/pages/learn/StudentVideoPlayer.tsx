import React, { useState, useEffect } from 'react';
import { VideoPlayerWrapper } from '../../components/VideoPlayerWrapper';
import { LessonPlaylist } from '../../components/LessonPlaylist';
import { SurfacePanel } from '../../components/SurfacePanel';
import { api } from '../../lib/api';
import { VideoUnit } from '../../lib/types';

interface StudentVideoPlayerProps {
  onNavigate: (route: string, params?: any) => void;
  videoId?: number;
}

export const StudentVideoPlayer: React.FC<StudentVideoPlayerProps> = ({ onNavigate, videoId }) => {
  const [currentVideo, setCurrentVideo] = useState<VideoUnit | null>(null);
  const [playlist, setPlaylist] = useState<VideoUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        setLoading(true);
        setError(null);

        let targetId = videoId;
        if (!targetId) {
          // Resolve from student's active resume learning or first published module
          const summary = await api.getProgressSummary();
          targetId = summary.resume_learning?.video_id || summary.modules?.[0]?.item_id;
        }

        if (!targetId) {
          setError('No published video lessons are currently available for your assigned curriculum.');
          return;
        }

        // Fetch published video unit
        const video = await api.getVideoUnit(targetId);
        setCurrentVideo(video);

        // Fetch other published video units for the same topic
        try {
          const topicVideos = await api.getTopicVideos(video.topic_id);
          const mappedPlaylist: VideoUnit[] = topicVideos.map((tv) => ({
            id: tv.id,
            topic_id: tv.topic_id || video.topic_id,
            topic_title: tv.topic_title || video.topic_title,
            subject_id: tv.subject_id || video.subject_id,
            subject_name: tv.subject_name || video.subject_name,
            chapter_id: tv.chapter_id || video.chapter_id,
            chapter_title: tv.chapter_title || video.chapter_title,
            title: tv.title,
            duration_seconds: tv.duration_seconds || 330,
            target_duration_minutes: (tv.duration_seconds || 330) / 60,
            video_url: (tv as any).video_url || `/learn/videos/${tv.id}`,
            review_status: (tv.status || 'published').toLowerCase(),
            description: tv.description,
            learning_objective: tv.learning_objective,
            content_outline: tv.content_outline,
          }));

          if (mappedPlaylist.length > 0) {
            setPlaylist(mappedPlaylist);
          } else {
            setPlaylist([video]);
          }
        } catch {
          setPlaylist([video]);
        }
      } catch (err: any) {
        setError(err.message || 'Video not available. Has it been approved and published by an administrator?');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [videoId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Pre-Rendered Video Lesson</h1>
        <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
          Strictly pre-rendered video playback with automated milestone progress synchronization.
        </p>
      </div>

      {loading ? (
        <SurfacePanel>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748B' }}>
            Loading lesson video asset...
          </div>
        </SurfacePanel>
      ) : error ? (
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
              Note: Unapproved videos in 'pending_review' or unrendered videos cannot be accessed by students until approved and rendered.
            </p>
            <button
              onClick={() => onNavigate('student-dashboard')}
              style={{
                marginTop: '16px',
                padding: '8px 18px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ← Back to Learning Dashboard
            </button>
          </div>
        </SurfacePanel>
      ) : currentVideo ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: '24px' }}>
          {/* Left Column: Player & Metadata */}
          <div>
            <VideoPlayerWrapper
              video={currentVideo}
              onProceedToQuiz={() => onNavigate('student-quiz', { topicId: currentVideo.topic_id })}
            />

            {/* Video Lesson Key Objectives */}
            <div style={{ marginTop: '20px' }}>
              <SurfacePanel>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
                  Lesson Learning Objectives
                </h3>
                {currentVideo.content_outline && currentVideo.content_outline.length > 0 ? (
                  <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: '22px' }}>
                    {currentVideo.content_outline.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : currentVideo.learning_objective ? (
                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: '22px' }}>
                    {currentVideo.learning_objective}
                  </p>
                ) : (
                  <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#475569', lineHeight: '22px' }}>
                    <li>Understand core conceptual foundations of {currentVideo.title}.</li>
                    <li>Analyze algorithmic structures and structural invariants.</li>
                    <li>Apply textbook principles to worked problems and complexity analysis.</li>
                  </ul>
                )}
              </SurfacePanel>
            </div>
          </div>

          {/* Right Column: Playlist */}
          <div>
            <LessonPlaylist
              items={playlist}
              activeVideoId={currentVideo.id}
              onSelectVideo={async (v) => {
                try {
                  const fullVideo = await api.getVideoUnit(v.id);
                  setCurrentVideo(fullVideo);
                } catch {
                  setCurrentVideo(v);
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
