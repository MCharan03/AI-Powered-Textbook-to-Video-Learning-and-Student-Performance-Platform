import React from 'react';
import { VideoUnit } from '../lib/types';

interface LessonPlaylistProps {
  items: VideoUnit[];
  activeVideoId: number;
  onSelectVideo: (video: VideoUnit) => void;
}

export const LessonPlaylist: React.FC<LessonPlaylistProps> = ({
  items,
  activeVideoId,
  onSelectVideo,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Lesson Playlist</h3>
        <span style={{ fontSize: '12px', color: '#64748B' }}>{items.length} Units</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
        {items.map((item, idx) => {
          const isActive = item.id === activeVideoId;
          const mins = Math.floor((item.duration_seconds || 330) / 60);

          return (
            <div
              key={item.id}
              onClick={() => onSelectVideo(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.08)' : '#F8FAFC',
                border: `1px solid ${isActive ? 'rgba(37, 99, 235, 0.3)' : '#E2E8F0'}`,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#2563EB' : '#E2E8F0',
                  color: isActive ? '#FFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#2563EB' : '#0F172A',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  ~{mins} min • Pre-rendered
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
