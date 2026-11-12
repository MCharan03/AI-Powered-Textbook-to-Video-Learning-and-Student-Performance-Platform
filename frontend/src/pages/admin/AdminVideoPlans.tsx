import React, { useState, useEffect } from 'react';
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  Pencil,
  Clock,
  BookOpen,
  Film,
  Clapperboard,
  ShieldCheck,
  ChevronRight,
  LibraryBig,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/admin/PageHeader';
import { StatCard } from '../../components/admin/StatCard';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { LoadingState } from '../../components/admin/LoadingState';
import { EmptyState } from '../../components/admin/EmptyState';
import { ErrorState } from '../../components/admin/ErrorState';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { FormField } from '../../components/admin/FormField';
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

  // Bulk approve confirmation state
  const [confirmBulkTopicId, setConfirmBulkTopicId] = useState<number | null>(null);

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
      setActionError(null);
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
      setActionError(`Approval failed: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setApprovingId(null);
    }
  };

  // Bulk Approve Topic Plans
  const handleBulkApproveTopic = async (topicId: number) => {
    setConfirmBulkTopicId(null);
    try {
      await api.approveTopicVideoPlans(topicId);
      setActionSuccess('All video plans for topic approved!');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadPlans();
    } catch (err: any) {
      setActionError(`Bulk approval failed: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
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
      setActionError(`Update failed: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
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
      <PageHeader
        title="Intelligent Video Segmentation & Video Plans"
        description="Dynamically partition approved curriculum into ~5–6 minute educational videos optimized for conceptual coherence."
        actions={
          selectedTopicId ? (
            <>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => handlePreviewRegeneration(Number(selectedTopicId))}
                disabled={generating}
              >
                <RefreshCw size={14} />
                Regenerate (Safe Diff)
              </button>

              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => handleGenerateTopicPlan(Number(selectedTopicId), false)}
                disabled={generating}
              >
                <Zap size={14} />
                {generating ? 'Segmenting…' : 'Segment Topic'}
              </button>
            </>
          ) : undefined
        }
      />

      {/* Notifications */}
      <MessageBanner
        message={
          actionError
            ? { text: actionError, type: 'error' as const }
            : actionSuccess
            ? { text: actionSuccess, type: 'success' as const }
            : null
        }
        onDismiss={() => {
          setActionError(null);
          setActionSuccess(null);
        }}
      />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Total Video Plans" value={videoPlans.length} icon={Film} tone="default" />
        <StatCard
          label="Under Review"
          value={videoPlans.filter((v) => v.status === 'REVIEW' || v.status === 'pending_review').length}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Approved Plans"
          value={videoPlans.filter((v) => v.status === 'APPROVED' || v.status === 'PUBLISHED').length}
          icon={ShieldCheck}
          tone="success"
        />
        <StatCard label="Estimated Total Run Time" value={`~${totalMinutes} min`} icon={Clapperboard} tone="primary" />
      </div>

      {/* Hierarchical Filter Toolbar */}
      <SurfacePanel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          {/* Subject Filter */}
          <div style={{ minWidth: '180px', flex: 1 }}>
            <label className="adm-label" htmlFor="vp-subject-filter">
              Subject
            </label>
            <select
              id="vp-subject-filter"
              className="adm-select"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
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
            <label className="adm-label" htmlFor="vp-chapter-filter">
              Chapter
            </label>
            <select
              id="vp-chapter-filter"
              className="adm-select"
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedSubjectId}
              style={{ opacity: selectedSubjectId ? 1 : 0.6 }}
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
            <label className="adm-label" htmlFor="vp-topic-filter">
              Topic
            </label>
            <select
              id="vp-topic-filter"
              className="adm-select"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedChapterId}
              style={{ opacity: selectedChapterId ? 1 : 0.6 }}
            >
              <option value="">-- All Topics in Chapter --</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  Topic {t.sequence_number || 1}: {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <label className="adm-label" htmlFor="vp-status-filter">
              Status
            </label>
            <select
              id="vp-status-filter"
              className="adm-select"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
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
              type="button"
              onClick={() => setConfirmBulkTopicId(Number(selectedTopicId))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--admin-success)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={13} />
              Approve All in Topic
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState label="Loading video plans…" rows={4} variant="table" />
        ) : actionError && videoPlans.length === 0 ? (
          <ErrorState message={actionError} onRetry={loadPlans} />
        ) : videoPlans.length === 0 ? (
          <EmptyState
            icon={<Clapperboard size={20} />}
            title="No Video Plans Generated"
            description='Select an approved curriculum topic above and click "Segment Topic" to dynamically partition its educational content into ~5.5-minute videos.'
            action={
              selectedChapterId ? (
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  onClick={() => handleGenerateChapterPlans(Number(selectedChapterId))}
                  disabled={generating}
                >
                  <Zap size={14} />
                  {generating ? 'Segmenting Chapter…' : 'Segment Entire Chapter'}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {videoPlans.map((v) => {
              const isApproved = v.status === 'APPROVED' || v.status === 'PUBLISHED';
              const durationSec = v.estimated_duration_seconds || v.duration_seconds || 330;

              return (
                <div
                  key={v.id}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-raised)',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Top Bar: Sequence, Title, Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                      <span
                        className="adm-badge"
                        style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                      >
                        <Film size={11} />
                        Video {v.sequence_number}
                      </span>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                        {v.title}
                      </h3>
                      <StatusBadge status={isApproved ? 'approved' : 'pending_review'} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={() => openEditModal(v)}
                      >
                        <Pencil size={12} />
                        Edit Plan
                      </button>

                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => handleApproveVideo(v.id)}
                          disabled={approvingId === v.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 14px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--admin-success)',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: approvingId === v.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          {approvingId === v.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Context Bar: Topic / Pages / Duration */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      alignItems: 'center',
                      fontSize: '12px',
                      color: 'var(--admin-text-secondary)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <LibraryBig size={12} />
                      {v.subject_name || 'Subject'}
                      <ChevronRight size={11} />
                      {v.chapter_title || 'Chapter'}
                      <ChevronRight size={11} />
                      <strong style={{ color: 'var(--admin-primary)' }}>{v.topic_title || 'Topic'}</strong>
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'var(--admin-primary-soft)',
                        color: 'var(--admin-primary)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={11} />
                      Duration: {formatDuration(durationSec)} ({durationSec}s)
                    </span>
                    {v.source_start_page && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'var(--admin-surface)',
                          color: 'var(--admin-text)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--admin-border)',
                        }}
                      >
                        <BookOpen size={11} />
                        Pages {v.source_start_page}–{v.source_end_page || v.source_start_page}
                      </span>
                    )}
                  </div>

                  {/* Learning Objective */}
                  {v.learning_objective && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface)',
                        borderLeft: '3px solid var(--admin-primary)',
                        fontSize: '13px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      <strong style={{ color: 'var(--admin-primary)' }}>Learning Objective:</strong> {v.learning_objective}
                    </div>
                  )}

                  {/* Content Outline */}
                  {v.content_outline && v.content_outline.length > 0 && (
                    <div
                      style={{
                        backgroundColor: 'var(--admin-surface)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        border: '1px solid var(--admin-border)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--admin-text-secondary)',
                          marginBottom: '6px',
                        }}
                      >
                        Content Outline & Semantic Units:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '18px',
                          fontSize: '12px',
                          color: 'var(--admin-text)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
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

      {/* Bulk Approve Confirmation */}
      <ConfirmDialog
        open={confirmBulkTopicId !== null}
        title="Approve All Video Plans in Topic"
        message="Approve all video plans for this topic? Approved plans will proceed to script synthesis."
        confirmLabel="Approve All"
        danger
        onConfirm={() => confirmBulkTopicId !== null && handleBulkApproveTopic(confirmBulkTopicId)}
        onCancel={() => setConfirmBulkTopicId(null)}
      />

      {/* Edit Video Plan Modal */}
      <Modal
        open={!!editingVideo}
        onClose={() => {
          if (!savingEdit) setEditingVideo(null);
        }}
        title={editingVideo ? `Edit Video Plan #${editingVideo.sequence_number}` : 'Edit Video Plan'}
        subtitle="Adjust segmentation metadata before approving for script synthesis."
        maxWidth={600}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditingVideo(null)} disabled={savingEdit}>
              Cancel
            </button>
            <button type="submit" form="edit-video-plan-form" className="adm-btn adm-btn-primary" disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save Plan'}
            </button>
          </>
        }
      >
        <form id="edit-video-plan-form" onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField
            label="Video Title"
            name="vp-title"
            required
            value={editFormData.title || ''}
            onChange={(val) => setEditFormData({ ...editFormData, title: val })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <FormField
              label="Seq #"
              name="vp-seq"
              type="number"
              required
              value={editFormData.sequence_number || 1}
              onChange={(val) => setEditFormData({ ...editFormData, sequence_number: Number(val) })}
            />
            <FormField
              label="Start Page"
              name="vp-start-page"
              type="number"
              value={editFormData.source_start_page || ''}
              onChange={(val) => setEditFormData({ ...editFormData, source_start_page: val ? Number(val) : undefined })}
            />
            <FormField
              label="End Page"
              name="vp-end-page"
              type="number"
              value={editFormData.source_end_page || ''}
              onChange={(val) => setEditFormData({ ...editFormData, source_end_page: val ? Number(val) : undefined })}
            />
          </div>

          <FormField
            label="Target Duration (Seconds, ~300-360s)"
            name="vp-duration"
            type="number"
            value={editFormData.estimated_duration_seconds || 330}
            onChange={(val) => setEditFormData({ ...editFormData, estimated_duration_seconds: Number(val) })}
          />

          <FormField
            label="Learning Objective"
            name="vp-objective"
            type="textarea"
            value={editFormData.learning_objective || ''}
            onChange={(val) => setEditFormData({ ...editFormData, learning_objective: val })}
          />

          <FormField
            label="Content Outline (One item per line)"
            name="vp-outline"
            type="textarea"
            value={(editFormData.content_outline || []).join('\n')}
            onChange={(val) => setEditFormData({ ...editFormData, content_outline: val.split('\n').filter(Boolean) })}
          />
        </form>
      </Modal>

      {/* Safe Regeneration Comparison Modal */}
      <Modal
        open={!!regenPreview}
        onClose={() => {
          if (!applyingRegen) setRegenPreview(null);
        }}
        title="Video Plan Re-Segmentation Preview"
        subtitle={regenPreview ? `Topic: ${regenPreview.topic_title} • Review candidate segmentation diff before applying.` : undefined}
        maxWidth={850}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRegenPreview(null)} disabled={applyingRegen}>
              Cancel
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={handleConfirmRegeneration}
              disabled={applyingRegen}
            >
              {applyingRegen ? 'Applying…' : 'Confirm & Apply Replacement'}
            </button>
          </>
        }
      >
        {regenPreview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--admin-success-soft)',
                border: '1px solid #BBF7D0',
                color: 'var(--admin-success)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Safe Regeneration:</strong> Existing approved video plans were NOT modified. Confirming will overwrite
                the topic plan with the new segmentation.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Current Plans */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-raised)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>Current Active Plan</h4>
                  <span style={{ fontSize: '12px', color: 'var(--admin-success)', fontWeight: 600 }}>
                    {regenPreview.comparison.current_count} Videos
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {regenPreview.current_plans.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        fontSize: '12px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      <strong>Video {p.sequence_number}:</strong> {p.title}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                        <Clock size={10} />
                        {formatDuration(p.estimated_duration_seconds)} • Status: {p.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Candidate Plans */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--admin-primary)',
                  backgroundColor: 'var(--admin-primary-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-primary)', margin: 0 }}>New Candidate Plan</h4>
                  <span style={{ fontSize: '12px', color: 'var(--admin-primary)', fontWeight: 600 }}>
                    {regenPreview.comparison.new_count} Videos
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {regenPreview.new_plans.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        fontSize: '12px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      <strong>Video {p.sequence_number}:</strong> {p.title}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                        <Clock size={10} />
                        {formatDuration(p.estimated_duration_seconds)} • Outline: {p.content_outline?.length || 0} items
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
