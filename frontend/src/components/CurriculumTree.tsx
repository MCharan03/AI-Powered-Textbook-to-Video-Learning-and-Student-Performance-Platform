import React, { useState } from 'react';
import { SubjectDetail, ChapterItem, TopicItem, SubtopicItem } from '../lib/types';

interface CurriculumTreeProps {
  subject?: SubjectDetail | null;
  chapters?: ChapterItem[];
  currentChapterId?: number;
  currentTopicId?: number;
  currentSubtopicId?: number;
  onSelectChapter?: (chapterId: number) => void;
  onSelectTopic?: (topicId: number) => void;
  onSelectSubtopic?: (subtopicId: number) => void;
}

export const CurriculumTree: React.FC<CurriculumTreeProps> = ({
  subject,
  chapters = [],
  currentChapterId,
  currentTopicId,
  currentSubtopicId,
  onSelectChapter,
  onSelectTopic,
  onSelectSubtopic,
}) => {
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({
    ...(currentChapterId ? { [currentChapterId]: true } : {}),
  });
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({
    ...(currentTopicId ? { [currentTopicId]: true } : {}),
  });

  const toggleChapter = (chId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChapters((prev) => ({ ...prev, [chId]: !prev[chId] }));
  };

  const toggleTopic = (topId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTopics((prev) => ({ ...prev, [topId]: !prev[topId] }));
  };

  const activeChapters = subject?.chapters || chapters;

  return (
    <div
      style={{
        borderRadius: '10px',
        border: '1px solid var(--admin-border)',
        backgroundColor: 'var(--admin-surface)',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🌳</span>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>
            Curriculum Hierarchy Tree
          </h3>
        </div>
        {subject && (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--admin-primary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {subject.name}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeChapters.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '13px' }}>
            No chapters defined yet in this curriculum.
          </div>
        ) : (
          activeChapters.map((ch) => {
            const isChExpanded = !!expandedChapters[ch.id];
            const isChActive = currentChapterId === ch.id;

            return (
              <div
                key={ch.id}
                style={{
                  border: `1px solid ${isChActive ? 'var(--admin-primary)' : 'rgba(255, 255, 255, 0.05)'}`,
                  borderRadius: '8px',
                  backgroundColor: isChActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0, 0, 0, 0.15)',
                  overflow: 'hidden',
                }}
              >
                {/* Chapter Header */}
                <div
                  onClick={() => onSelectChapter && onSelectChapter(ch.id)}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: onSelectChapter ? 'pointer' : 'default',
                    borderBottom: isChExpanded ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={(e) => toggleChapter(ch.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--admin-text-secondary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '2px 4px',
                      }}
                    >
                      {isChExpanded ? '▼' : '▶'}
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                      CH {ch.chapter_number}:
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
                      {ch.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                    {ch.topics_count || (ch as any).topics?.length || 0} Topics
                  </span>
                </div>

                {/* Topics Container */}
                {isChExpanded && (
                  <div style={{ padding: '8px 12px 8px 32px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {!(ch as any).topics || (ch as any).topics.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', padding: '6px 0' }}>
                        No topics in this chapter.
                      </div>
                    ) : (
                      (ch as any).topics.map((t: TopicItem) => {
                        const isTopExpanded = !!expandedTopics[t.id];
                        const isTopActive = currentTopicId === t.id;

                        return (
                          <div
                            key={t.id}
                            style={{
                              border: `1px solid ${isTopActive ? 'var(--admin-primary)' : 'rgba(255, 255, 255, 0.04)'}`,
                              borderRadius: '6px',
                              backgroundColor: isTopActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              onClick={() => onSelectTopic && onSelectTopic(t.id)}
                              style={{
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: onSelectTopic ? 'pointer' : 'default',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => toggleTopic(t.id, e)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--admin-text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                  }}
                                >
                                  {isTopExpanded ? '▼' : '▶'}
                                </button>
                                <span style={{ fontSize: '12px', color: '#60A5FA', fontWeight: 600 }}>
                                  §{t.sequence_number}
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--admin-text)' }}>
                                  {t.title}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                {t.subtopics_count || (t as any).subtopics?.length || 0} Subtopics
                              </span>
                            </div>

                            {/* Subtopics Container */}
                            {isTopExpanded && (
                              <div style={{ padding: '6px 12px 8px 30px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                {!(t as any).subtopics || (t as any).subtopics.length === 0 ? (
                                  <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                    No subtopics.
                                  </div>
                                ) : (
                                  (t as any).subtopics.map((st: SubtopicItem) => {
                                    const isSubActive = currentSubtopicId === st.id;
                                    return (
                                      <div
                                        key={st.id}
                                        onClick={() => onSelectSubtopic && onSelectSubtopic(st.id)}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: '4px',
                                          backgroundColor: isSubActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                          color: isSubActive ? 'var(--admin-primary)' : 'var(--admin-text)',
                                          fontSize: '12px',
                                          cursor: onSelectSubtopic ? 'pointer' : 'default',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                        }}
                                      >
                                        <span style={{ color: 'var(--admin-text-secondary)' }}>•</span>
                                        <span>{st.title}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
