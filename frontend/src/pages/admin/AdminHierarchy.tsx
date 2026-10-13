import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { api } from '../../lib/api';
import { Textbook, TextbookHierarchy, Chapter, Topic } from '../../lib/types';

export const AdminHierarchy: React.FC = () => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null);
  const [hierarchy, setHierarchy] = useState<TextbookHierarchy | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        const list = await api.listTextbooks();
        setTextbooks(list);
        if (list.length > 0) {
          setSelectedTextbookId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadTextbooks();
  }, []);

  useEffect(() => {
    if (selectedTextbookId) {
      const loadHierarchy = async () => {
        try {
          const data = await api.getTextbookHierarchy(selectedTextbookId);
          setHierarchy(data);
          const initialExpand: Record<number, boolean> = {};
          data.chapters.forEach((c) => (initialExpand[c.id] = true));
          setExpandedChapters(initialExpand);
          if (data.chapters.length > 0 && data.chapters[0].topics.length > 0) {
            setSelectedTopic(data.chapters[0].topics[0]);
          }
        } catch (err) {
          console.error(err);
        }
      };
      loadHierarchy();
    }
  }, [selectedTextbookId]);

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Extracted Hierarchy</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
          Inspect hierarchical decomposition: Chapters → Topics → ~5.5-Minute Subtopics.
        </p>
      </div>

      <SurfacePanel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Select Ingested Textbook:</label>
          <select
            value={selectedTextbookId || ''}
            onChange={(e) => setSelectedTextbookId(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              color: '#F8FAFC',
              fontSize: '14px',
              minWidth: '280px',
            }}
          >
            {textbooks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                #{tb.id} - {tb.title}
              </option>
            ))}
          </select>
        </div>
      </SurfacePanel>

      {hierarchy && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left: Tree View */}
          <SurfacePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>
                Structure Tree ({hierarchy.chapters.length} Chapters)
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hierarchy.chapters.map((chapter) => (
                <div key={chapter.id} style={{ border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#F8FAFC',
                    }}
                  >
                    <span>{chapter.title}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      {expandedChapters[chapter.id] ? '▲' : '▼'}
                    </span>
                  </div>

                  {expandedChapters[chapter.id] && (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {chapter.topics.map((topic) => {
                        const isSelected = selectedTopic?.id === topic.id;
                        return (
                          <div
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                              border: isSelected ? '1px solid #6366F1' : '1px solid transparent',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ color: isSelected ? '#F8FAFC' : '#CBD5E1', fontSize: '13px' }}>
                              • {topic.title}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#334155',
                                color: '#94A3B8',
                              }}
                            >
                              {topic.subtopics.length} units (~5.5 min)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SurfacePanel>

          {/* Right: Subtopics & Unit Detail Pane */}
          <SurfacePanel>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>
              Topic & Subtopic Segmentation
            </h2>

            {selectedTopic ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>SELECTED TOPIC</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#F8FAFC', marginTop: '4px' }}>
                    {selectedTopic.title}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
                    Segmented 5-6 Min Video Units:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedTopic.subtopics.map((sub, idx) => (
                      <div
                        key={sub.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          backgroundColor: '#0F172A',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC' }}>
                            {idx + 1}. {sub.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                            Segment Order: #{sub.order}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#818CF8',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                          }}
                        >
                          Target: {sub.duration_minutes || 5.5} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '13px' }}>Select a topic on the left to inspect segmentation.</div>
            )}
          </SurfacePanel>
        </div>
      )}
    </div>
  );
};
