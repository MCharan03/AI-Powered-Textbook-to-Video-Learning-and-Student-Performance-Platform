import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import {
  VideoPlan,
  SubjectItem,
  ChapterItem,
  TopicItem,
  VideoPlanRegeneration
} from '../../lib/types';

interface AdminVideoPlansProps {
  onNavigate: (route: string, params?: any) => void;
  initialTopicId?: number;
}

export const AdminVideoPlans: React.FC<AdminVideoPlansProps> = ({ onNavigate, initialTopicId }) => {
  const [videoPlans, setVideoPlans] = useState<VideoPlan[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);

  // Filter state
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedChapterId, setSelectedChapterId] = useState<number | ''>('');
  const [selectedTopicId, setSelectedTopicId] = useState<number | ''>(initialTopicId || '');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Edit Modal State
  const [editingVideo, setEditingVideo] = useState<VideoPlan | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<VideoPlan>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Safe Regeneration Preview Modal
  const [regenPreview, setRegenPreview] = useState<VideoPlanRegeneration | null>(null);
  const [applyingRegen, setApplyingRegen] = useState(false);

  // Load Subjects on mount
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await api.listSubjects();
        setSubjects(res.items || []);
      } catch (err: any) {
        console.error('Failed to load subjects:', err);
      }
    };
    loadSubjects();
  }, []);

  // When subject changes, load chapters
  useEffect(() => {
    if (!selectedSubjectId) {
      setChapters([]);
      setSelectedChapterId('');
      setTopics([]);
      setSelectedTopicId('');
      return;
    }
    const loadChapters = async () => {
      try {
        const res = await api.getSubject(Number(selectedSubjectId));
        setChapters(res.chapters || []);
      } catch (err: any) {
        console.error('Failed to load chapters:', err);
      }
    };
    loadChapters();
  }, [selectedSubjectId]);

  // When chapter changes, load topics
  useEffect(() => {
    if (!selectedChapterId) {
      setTopics([]);
      setSelectedTopicId('');
      return;
    }
    const ch = chapters.find((c) => c.id === Number(selectedChapterId)) as (ChapterItem & { topics?: TopicItem[] }) | undefined;
    if (ch && ch.topics) {
      setTopics(ch.topics);
    } else {
      const loadCh = async () => {
        try {
          const detail = await api.getChapter(Number(selectedChapterId));
          setTopics(detail.topics || []);
        } catch (err: any) {
          console.error('Failed to load chapter detail:', err);
        }
      };
      loadCh();
    }
  }, [selectedChapterId, chapters]);

  // Load video plans
  const loadPlans = async () => {
    try {
      setLoading(true);
      const plans = await api.listVideoPlans({
        subject_id: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        chapter_id: selectedChapterId ? Number(selectedChapterId) : undefined,
        topic_id: selectedTopicId ? Number(selectedTopicId) : undefined,
        status: selectedStatusFilter || undefined,
      });
      setVideoPlans(plans);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load video plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [selectedSubjectId, selectedChapterId, selectedTopicId, selectedStatusFilter]);

  // Trigger Plan Generation for Selected Topic
  const handleGenerateTopicPlan = async (topicId: number, force: boolean = false) => {
    try {
      setGenerating(true);
      setActionError(null);
      await api.generateVideoPlanForTopic(topicId, force);
      setActionSuccess(`Video plan generated successfully!`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadPlans();
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate video plan');
    } finally {
      setGenerating(false);
    }
  };

  // Trigger Plan Generation for Selected Chapter
  const handleGenerateChapterPlans = async (chapterId: number) => {
    try {
      setGenerating(true);
      setActionError(null);
      await api.generateVideoPlansForChapter(chapterId, false);
      setActionSuccess(`Video plans generated for all approved topics in chapter!`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadPlans();
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate video plans for chapter');
    } finally {
      setGenerating(false);
    }
  };

  // Safe Regeneration Preview
  const handlePreviewRegeneration = async (topicId: number) => {
    try {
      setGenerating(true);
      setActionError(null);
      const preview = await api.regenerateVideoPlanPreview(topicId);
      setRegenPreview(preview);
    } catch (err: any) {
      setActionError(err.message || 'Failed to preview plan regeneration');
    } finally {
      setGenerating(false);
    }
  };

  // Apply Regeneration
  const handleConfirmRegeneration = async () => {
    if (!regenPreview) return;
    try {
      setApplyingRegen(true);
      await api.generateVideoPlanForTopic(regenPreview.topic_id, true);
      setRegenPreview(null);
      setActionSuccess('Video plan re-segmented and updated successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      await loadPlans();
    } catch (err: any) {
      setActionError(err.message || 'Failed to apply regenerated video plan');
    } finally {
      setApplyingRegen(false);
    }
  };

  // Approve Single Video Plan
  const handleApproveVideo = async (id: number) => {
    try {
      setApprovingId(id);
      await api.approveVideoPlan(id);
      setActionSuccess('Video plan approved!');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadPlans();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  // Bulk Approve Topic Plans
  const handleBulkApproveTopic = async (topicId: number) => {
    if (!window.confirm('Approve all video plans for this topic?')) return;
    try {
      await api.approveTopicVideoPlans(topicId);
      setActionSuccess('All video plans for topic approved!');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadPlans();
    } catch (err: any) {
      alert(`Bulk approval failed: ${err.message}`);
    }
  };

  // Edit Video Modal
  const openEditModal = (v: VideoPlan) => {
    setEditingVideo(v);
    setEditFormData({
      title: v.title,
      description: v.description || '',
      sequence_number: v.sequence_number,
      estimated_duration_seconds: v.estimated_duration_seconds || v.duration_seconds,
      learning_objective: v.learning_objective || '',
      content_outline: v.content_outline || [],
      source_start_page: v.source_start_page,
      source_end_page: v.source_end_page,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    try {
      setSavingEdit(true);
      await api.patchVideoPlan(editingVideo.id, editFormData);
      setEditingVideo(null);
      setActionSuccess('Video plan updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadPlans();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '05:30';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSeconds = videoPlans.reduce((sum, v) => sum + (v.estimated_duration_seconds || v.duration_seconds || 330), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Intelligent Video Segmentation & Video Plans
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
            Dynamically partition approved curriculum into ~5–6 minute educational videos optimized for conceptual coherence.
          </p>
        </div>

        {selectedTopicId && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handlePreviewRegeneration(Number(selectedTopicId))}
              disabled={generating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                borderRadius: '8px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              <span>🔄</span>
              <span>Regenerate (Safe Diff)</span>
            </button>

            <button
              onClick={() => handleGenerateTopicPlan(Number(selectedTopicId), false)}
              disabled={generating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              <span>⚡</span>
              <span>{generating ? 'Segmenting...' : 'Segment Topic'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34D399', fontSize: '14px', fontWeight: 600 }}>
          ✅ {actionSuccess}
        </div>
      )}
      {actionError && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#F87171', fontSize: '14px', fontWeight: 600 }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Total Video Plans</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '4px' }}>
            {videoPlans.length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Under Review</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#FBBF24', marginTop: '4px' }}>
            {videoPlans.filter((v) => v.status === 'REVIEW' || v.status === 'pending_review').length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Approved Plans</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#34D399', marginTop: '4px' }}>
            {videoPlans.filter((v) => v.status === 'APPROVED' || v.status === 'PUBLISHED').length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Estimated Total Run Time</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#38BDF8', marginTop: '4px' }}>
            ~{totalMinutes} min
          </div>
        </SurfacePanel>
      </div>

      {/* Hierarchical Filter Toolbar */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          {/* Subject Filter */}
          <div style={{ minWidth: '180px', flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '13px' }}
            >
              <option value="">-- All Subjects --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.class ? `(Class ${s.class})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter Filter */}
          <div style={{ minWidth: '180px', flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Chapter
            </label>
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedSubjectId}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '13px', opacity: selectedSubjectId ? 1 : 0.6 }}
            >
              <option value="">-- All Chapters in Subject --</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch {c.chapter_number || (c as any).order_idx || 1}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Filter */}
          <div style={{ minWidth: '180px', flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Topic
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedChapterId}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '13px', opacity: selectedChapterId ? 1 : 0.6 }}
            >
              <option value="">-- All Topics in Chapter --</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  § {t.sequence_number || 1}: {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
              Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '13px' }}
            >
              <option value="">All Statuses</option>
              <option value="REVIEW">Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>
      </SurfacePanel>

      {/* Video Plans Listing */}
      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)' }}>
              Video Units & Semantic Outlines
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
              Target duration: 05:00–06:00 (300–360s). Review title, objectives, and outlines before approving for script synthesis.
            </p>
          </div>

          {selectedTopicId && videoPlans.length > 0 && (
            <button
              onClick={() => handleBulkApproveTopic(Number(selectedTopicId))}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#10B981',
                color: '#FFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✅ Approve All in Topic
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            Loading video plans...
          </div>
        ) : videoPlans.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎬</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)' }}>
              No Video Plans Generated
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', maxWidth: '440px', margin: '4px auto 16px auto' }}>
              Select an approved curriculum topic above and click "Segment Topic" to dynamically partition its educational content into ~5.5-minute videos.
            </p>
            {selectedChapterId && (
              <button
                onClick={() => handleGenerateChapterPlans(Number(selectedChapterId))}
                disabled={generating}
                style={{
                  backgroundColor: 'var(--admin-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {generating ? 'Segmenting Chapter...' : 'Segment Entire Chapter'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {videoPlans.map((v) => {
              const isApproved = v.status === 'APPROVED' || v.status === 'PUBLISHED';
              const durationSec = v.estimated_duration_seconds || v.duration_seconds || 330;

              return (
                <div
                  key={v.id}
                  style={{
                    borderRadius: '10px',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-bg)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'border 0.2s ease',
                  }}
                >
                  {/* Top Bar: Sequence, Title, Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818CF8',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 700,
                        }}
                      >
                        Video {v.sequence_number}
                      </span>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                        {v.title}
                      </h3>
                      <StatusBadge status={isApproved ? 'approved' : 'pending_review'} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(v)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--admin-border)',
                          color: 'var(--admin-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Edit Plan
                      </button>

                      {!isApproved && (
                        <button
                          onClick={() => handleApproveVideo(v.id)}
                          disabled={approvingId === v.id}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#10B981',
                            color: '#FFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: approvingId === v.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {approvingId === v.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Context Bar: Topic / Pages / Duration */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                    <span>
                      📚 {v.subject_name || 'Subject'} › {v.chapter_title || 'Chapter'} › <strong style={{ color: '#818CF8' }}>{v.topic_title || 'Topic'}</strong>
                    </span>
                    <span>•</span>
                    <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      ⏱️ Duration: {formatDuration(durationSec)} ({durationSec}s)
                    </span>
                    {v.source_start_page && (
                      <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--admin-text)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                        📖 Pages {v.source_start_page}–{v.source_end_page || v.source_start_page}
                      </span>
                    )}
                  </div>

                  {/* Learning Objective */}
                  {v.learning_objective && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--admin-surface)', borderLeft: '3px solid #818CF8', fontSize: '13px', color: 'var(--admin-text)' }}>
                      <strong style={{ color: '#818CF8' }}>Learning Objective:</strong> {v.learning_objective}
                    </div>
                  )}

                  {/* Content Outline */}
                  {v.content_outline && v.content_outline.length > 0 && (
                    <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: '6px', padding: '10px 14px', border: '1px solid var(--admin-border)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--admin-text-secondary)', marginBottom: '6px' }}>
                        Content Outline & Semantic Units:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--admin-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {v.content_outline.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SurfacePanel>

      {/* Edit Video Plan Modal */}
      {editingVideo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                Edit Video Plan #{editingVideo.sequence_number}
              </h2>
              <button onClick={() => setEditingVideo(null)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                  Video Title *
                </label>
                <input
                  type="text"
                  value={editFormData.title || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                    Seq # *
                  </label>
                  <input
                    type="number"
                    value={editFormData.sequence_number || 1}
                    onChange={(e) => setEditFormData({ ...editFormData, sequence_number: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                    Start Page
                  </label>
                  <input
                    type="number"
                    value={editFormData.source_start_page || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, source_start_page: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                    End Page
                  </label>
                  <input
                    type="number"
                    value={editFormData.source_end_page || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, source_end_page: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                  Target Duration (Seconds, ~300-360s)
                </label>
                <input
                  type="number"
                  value={editFormData.estimated_duration_seconds || 330}
                  onChange={(e) => setEditFormData({ ...editFormData, estimated_duration_seconds: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                  Learning Objective
                </label>
                <textarea
                  rows={2}
                  value={editFormData.learning_objective || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, learning_objective: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
                  Content Outline (One item per line)
                </label>
                <textarea
                  rows={4}
                  value={(editFormData.content_outline || []).join('\n')}
                  onChange={(e) => setEditFormData({ ...editFormData, content_outline: e.target.value.split('\n').filter(Boolean) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: 'var(--admin-primary)', color: '#FFF', border: 'none', fontWeight: 600 }}
                >
                  {savingEdit ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Regeneration Comparison Modal */}
      {regenPreview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--admin-text)' }}>
                  Video Plan Re-Segmentation Preview
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  Topic: <strong>{regenPreview.topic_title}</strong> • Review candidate segmentation diff before applying.
                </p>
              </div>
              <button onClick={() => setRegenPreview(null)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', fontSize: '13px' }}>
                🛡️ <strong>Safe Regeneration:</strong> Existing approved video plans were NOT modified. Confirming will overwrite the topic plan with the new segmentation.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Current Plans */}
                <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text)' }}>Current Active Plan</h4>
                    <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>{regenPreview.comparison.current_count} Videos</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {regenPreview.current_plans.map((p, idx) => (
                      <div key={idx} style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', fontSize: '12px', color: 'var(--admin-text)' }}>
                        <strong>Video {p.sequence_number}:</strong> {p.title}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          ⏱️ {formatDuration(p.estimated_duration_seconds)} • Status: {p.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Candidate Plans */}
                <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>New Candidate Plan</h4>
                    <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 600 }}>{regenPreview.comparison.new_count} Videos</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {regenPreview.new_plans.map((p, idx) => (
                      <div key={idx} style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--admin-surface)', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '12px', color: 'var(--admin-text)' }}>
                        <strong>Video {p.sequence_number}:</strong> {p.title}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          ⏱️ {formatDuration(p.estimated_duration_seconds)} • Outline: {p.content_outline?.length || 0} items
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRegenPreview(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRegeneration}
                disabled={applyingRegen}
                style={{ padding: '8px 18px', borderRadius: '6px', backgroundColor: 'var(--admin-primary)', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {applyingRegen ? 'Applying...' : 'Confirm & Apply Replacement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
