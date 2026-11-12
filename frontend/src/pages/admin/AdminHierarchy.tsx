import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookText, ListTree } from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { PageHeader } from '../../components/admin/PageHeader';
import { LoadingState } from '../../components/admin/LoadingState';
import { ErrorState } from '../../components/admin/ErrorState';
import { EmptyState } from '../../components/admin/EmptyState';
import { api } from '../../lib/api';
import { Textbook, TextbookHierarchy, Chapter, Topic } from '../../lib/types';

export const AdminHierarchy: React.FC = () => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null);
  const [hierarchy, setHierarchy] = useState<TextbookHierarchy | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        setLoadingTextbooks(true);
        const list = await api.listTextbooks();
        setTextbooks(list);
        if (list.length > 0) {
          setSelectedTextbookId(list[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load textbooks. Please try again.');
      } finally {
        setLoadingTextbooks(false);
      }
    };
    loadTextbooks();
  }, []);

  useEffect(() => {
    if (selectedTextbookId) {
      const loadHierarchy = async () => {
        try {
          setLoadingHierarchy(true);
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
          setError('Failed to load hierarchy. Please try again.');
        } finally {
          setLoadingHierarchy(false);
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
      <PageHeader
        title="Extracted Hierarchy"
        description="Inspect hierarchical decomposition: Chapters → Topics → ~5.5-Minute Subtopics."
      />

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      <SurfacePanel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <label className="adm-label" htmlFor="hierarchy-textbook-select" style={{ marginBottom: 0 }}>
            Select Ingested Textbook:
          </label>
          <select
            id="hierarchy-textbook-select"
            className="adm-select"
            value={selectedTextbookId || ''}
            onChange={(e) => setSelectedTextbookId(Number(e.target.value))}
            style={{ maxWidth: '320px' }}
          >
            {textbooks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                #{tb.id} - {tb.title}
              </option>
            ))}
          </select>
        </div>
      </SurfacePanel>

      {loadingTextbooks || loadingHierarchy ? (
        <SurfacePanel>
          <LoadingState label="Loading hierarchy…" rows={6} />
        </SurfacePanel>
      ) : textbooks.length === 0 ? (
        <SurfacePanel>
          <EmptyState
            title="No textbooks yet"
            description="Ingest a textbook first to inspect its extracted curriculum hierarchy."
            icon={<BookText size={20} />}
          />
        </SurfacePanel>
      ) : hierarchy && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
          {/* Left: Tree View */}
          <SurfacePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)' }}>
                Structure Tree ({hierarchy.chapters.length} Chapters)
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hierarchy.chapters.map((chapter) => (
                <div key={chapter.id} style={{ border: '1px solid var(--admin-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--admin-surface-raised)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: 'var(--admin-text)',
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{chapter.title}</span>
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--admin-text-secondary)', flexShrink: 0 }}>
                      {expandedChapters[chapter.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isSelected ? 'var(--admin-primary-soft)' : 'transparent',
                              border: isSelected ? '1px solid var(--admin-primary)' : '1px solid transparent',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: 0,
                                color: isSelected ? 'var(--admin-primary)' : 'var(--admin-text)',
                                fontSize: '13px',
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ overflowWrap: 'anywhere' }}>{topic.title}</span>
                            </span>
                            <span
                              className="adm-badge"
                              style={{
                                backgroundColor: 'var(--admin-surface-raised)',
                                color: 'var(--admin-text-secondary)',
                                flexShrink: 0,
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
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '16px' }}>
              Topic & Subtopic Segmentation
            </h2>

            {selectedTopic ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--admin-surface-raised)', border: '1px solid var(--admin-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-text-secondary)' }}>
                    Selected Topic
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '4px' }}>
                    {selectedTopic.title}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '8px' }}>
                    Segmented 5-6 Min Video Units:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedTopic.subtopics.map((sub, idx) => (
                      <div
                        key={sub.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--admin-border)',
                          backgroundColor: 'var(--admin-bg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', overflowWrap: 'anywhere' }}>
                            {idx + 1}. {sub.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                            Segment Order: #{sub.order}
                          </div>
                        </div>
                        <span
                          className="adm-badge"
                          style={{
                            backgroundColor: 'var(--admin-primary-soft)',
                            color: 'var(--admin-primary)',
                            flexShrink: 0,
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
              <EmptyState
                title="No topic selected"
                description="Select a topic on the left to inspect segmentation."
                icon={<ListTree size={20} />}
              />
            )}
          </SurfacePanel>
        </div>
      )}
    </div>
  );
};
