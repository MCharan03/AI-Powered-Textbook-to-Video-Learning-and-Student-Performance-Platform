import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  ListTree,
  Tag,
  CircleDot,
  ShieldCheck,
  BookOpen,
  Lock,
} from 'lucide-react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { PageHeader } from '../../components/admin/PageHeader';
import { StatCard } from '../../components/admin/StatCard';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { LoadingState } from '../../components/admin/LoadingState';
import { ErrorState } from '../../components/admin/ErrorState';
import { EmptyState } from '../../components/admin/EmptyState';
import { Modal } from '../../components/admin/Modal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { WorkflowStepper } from '../../components/admin/WorkflowStepper';
import { api } from '../../lib/api';
import { Textbook, TextbookHierarchy, Chapter, Topic, Subtopic, RegenerationComparison } from '../../lib/types';

const PIPELINE_STEPS = [
  'Upload Textbook',
  'Extract Curriculum',
  'Review & Approve',
  'Video Plans',
  'Scripts',
  'Videos',
  'Publish',
];

/** Derive the pipeline step (0-based) from fields already present on Textbook. */
const derivePipelineStep = (tb: Textbook | null, hierarchyStatus?: string): number => {
  const status = ((tb?.status || hierarchyStatus || '') as string).toUpperCase();
  if (status === 'PUBLISHED') return PIPELINE_STEPS.length;
  if (status === 'APPROVED') return 3;
  return 2; // this page is the Review & Approve gate
};

interface AdminTextbookReviewProps {
  textbookId: number;
  onNavigate: (route: string, params?: any) => void;
}

export const AdminTextbookReview: React.FC<AdminTextbookReviewProps> = ({ textbookId, onNavigate }) => {
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [hierarchy, setHierarchy] = useState<TextbookHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Expanded nodes state
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});

  // Editing state
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [chapterFormData, setChapterFormData] = useState<Partial<Chapter>>({});

  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [topicFormData, setTopicFormData] = useState<Partial<Topic>>({});

  const [editingSubtopicId, setEditingSubtopicId] = useState<number | null>(null);
  const [subtopicFormData, setSubtopicFormData] = useState<Partial<Subtopic>>({});

  const [savingEdit, setSavingEdit] = useState(false);

  // Approval state
  const [approving, setApproving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  // Regeneration state
  const [regenerating, setRegenerating] = useState(false);
  const [comparisonModal, setComparisonModal] = useState<RegenerationComparison | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tb, hier] = await Promise.all([
        api.getTextbook(textbookId),
        api.getTextbookHierarchy(textbookId),
      ]);
      setTextbook(tb);
      setHierarchy(hier);

      // Expand all chapters by default
      const chExp: Record<number, boolean> = {};
      const topExp: Record<number, boolean> = {};
      hier.chapters.forEach((c) => {
        chExp[c.id] = true;
        c.topics?.forEach((t) => {
          topExp[t.id] = true;
        });
      });
      setExpandedChapters(chExp);
      setExpandedTopics(topExp);
    } catch (err: any) {
      setError(err.message || 'Failed to load textbook hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (textbookId) {
      loadData();
    }
  }, [textbookId]);

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTopic = (id: number) => {
    setExpandedTopics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Chapter editing
  const startEditChapter = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setChapterFormData({
      title: ch.title,
      description: ch.description || '',
      chapter_number: ch.chapter_number,
      source_start_page: ch.source_start_page,
      source_end_page: ch.source_end_page,
    });
  };

  const saveEditChapter = async (id: number) => {
    try {
      setSavingEdit(true);
      await api.patchChapter(id, chapterFormData);
      setEditingChapterId(null);
      setActionSuccess('Chapter updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to update chapter: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  // Topic editing
  const startEditTopic = (top: Topic) => {
    setEditingTopicId(top.id);
    setTopicFormData({
      title: top.title,
      description: top.description || '',
      sequence_number: top.sequence_number,
      source_start_page: top.source_start_page,
      source_end_page: top.source_end_page,
    });
  };

  const saveEditTopic = async (id: number) => {
    try {
      setSavingEdit(true);
      await api.patchTopic(id, topicFormData);
      setEditingTopicId(null);
      setActionSuccess('Topic updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to update topic: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  // Subtopic editing
  const startEditSubtopic = (sub: Subtopic) => {
    setEditingSubtopicId(sub.id);
    setSubtopicFormData({
      title: sub.title,
      description: sub.description || '',
      sequence_number: sub.sequence_number,
      source_start_page: sub.source_start_page,
      source_end_page: sub.source_end_page,
    });
  };

  const saveEditSubtopic = async (id: number) => {
    try {
      setSavingEdit(true);
      await api.patchSubtopic(id, subtopicFormData);
      setEditingSubtopicId(null);
      setActionSuccess('Subtopic updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to update subtopic: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  // Approve entire curriculum
  const handleApproveCurriculum = async () => {
    setConfirmApprove(false);
    try {
      setApproving(true);
      await api.approveTextbookCurriculum(textbookId);
      setActionSuccess('Curriculum successfully approved and canonicalized!');
      await loadData();
    } catch (err: any) {
      setActionError(`Failed to approve curriculum: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setApproving(false);
    }
  };

  // Safe regeneration
  const handleRegenerateDraft = async () => {
    try {
      setRegenerating(true);
      setActionError(null);
      const comp = await api.regenerateCurriculum(textbookId);
      setComparisonModal(comp);
    } catch (err: any) {
      setActionError(`Failed to trigger regeneration: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !textbook) {
    return (
      <SurfacePanel>
        <LoadingState label="Loading textbook curriculum review…" rows={6} variant="table" />
      </SurfacePanel>
    );
  }

  if (error || !textbook || !hierarchy) {
    return (
      <SurfacePanel>
        <ErrorState message={error || 'Textbook not found'} onRetry={loadData} />
        <div style={{ marginTop: '12px' }}>
          <button type="button" className="adm-btn adm-btn-secondary" onClick={() => onNavigate('admin-textbooks')}>
            <ArrowLeft size={14} />
            Back to Textbooks
          </button>
        </div>
      </SurfacePanel>
    );
  }

  const chapters = hierarchy.chapters || [];
  const totalTopics = chapters.reduce((acc, c) => acc + (c.topics?.length || 0), 0);
  const totalSubtopics = chapters.reduce(
    (acc, c) => acc + (c.topics?.reduce((tAcc, t) => tAcc + (t.subtopics?.length || 0), 0) || 0),
    0
  );

  const isApproved = textbook.status === 'APPROVED' || hierarchy.status === 'APPROVED';
  const pipelineStep = derivePipelineStep(textbook, hierarchy.status);
  const editInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--admin-surface)',
    border: '1px solid var(--admin-border)',
    color: 'var(--admin-text)',
    fontSize: '12px',
  };
  const editLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--admin-text-secondary)',
    display: 'block',
    marginBottom: '4px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <PageHeader
        title={textbook.title}
        description={`Subject: ${hierarchy.subject_name || textbook.subject_name || 'Unassigned'} • File: ${
          textbook.original_filename || textbook.filename || 'textbook.pdf'
        }`}
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => onNavigate('admin-textbooks')}>
              <ArrowLeft size={14} />
              Back to Catalog
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              onClick={handleRegenerateDraft}
              disabled={regenerating}
            >
              <RefreshCw size={14} />
              {regenerating ? 'Extracting Draft…' : 'Regenerate AI Draft'}
            </button>
            {!isApproved && (
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => setConfirmApprove(true)}
                disabled={approving}
              >
                <Check size={15} />
                {approving ? 'Approving…' : 'Approve Curriculum'}
              </button>
            )}
          </>
        }
      />

      {/* Status + Workflow */}
      <SurfacePanel>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StatusBadge status={isApproved ? 'approved' : 'pending_review'} />
            <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
              {isApproved
                ? 'Canonical curriculum — locked for editing, ready for downstream video generation.'
                : 'Curriculum is in review. Edit chapters, topics, and page ranges, then approve to canonicalize.'}
            </span>
          </div>
          <WorkflowStepper steps={PIPELINE_STEPS} currentStep={pipelineStep} />
        </div>
      </SurfacePanel>

      {/* Feedback */}
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

      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Chapters Extracted" value={chapters.length} icon={BookOpen} tone="default" />
        <StatCard label="Topics Detected" value={totalTopics} icon={ListTree} tone="primary" />
        <StatCard label="Micro-Learning Subtopics" value={totalSubtopics} icon={CircleDot} tone="primary" />
        <StatCard
          label="Curriculum Governance"
          value={isApproved ? 'Canonical / Approved' : 'In Review & Editable'}
          icon={isApproved ? Lock : ShieldCheck}
          tone={isApproved ? 'success' : 'warning'}
          hint={isApproved ? 'Content is locked and canonical' : 'Approval required before video generation'}
        />
      </div>

      {/* Hierarchical Tree of Chapters, Topics, Subtopics */}
      <SurfacePanel>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)' }}>
            Curriculum Structure & Page Range Mapping
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
            Review AI-detected headings, page spans, and hierarchy. Click Edit to adjust numbers or page ranges before
            approval.
          </p>
        </div>

        {chapters.length === 0 ? (
          <EmptyState
            icon={<ListTree size={20} />}
            title="No chapters extracted"
            description="No chapters extracted for this textbook. Run the AI extraction pipeline from the catalog."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {chapters.map((ch) => {
              const isChExpanded = !!expandedChapters[ch.id];
              const isEditingCh = editingChapterId === ch.id;

              return (
                <div
                  key={ch.id}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-bg)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Chapter Header */}
                  <div
                    style={{
                      padding: '14px 18px',
                      backgroundColor: 'var(--admin-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                    }}
                    onClick={() => toggleChapter(ch.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ color: 'var(--admin-text-secondary)', display: 'inline-flex' }}>
                        {isChExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                      <span
                        className="adm-badge"
                        style={{ backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }}
                      >
                        Ch {ch.chapter_number ?? '—'}
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                        {ch.title}
                      </h3>
                      {ch.source_start_page && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--admin-text-secondary)',
                            backgroundColor: 'var(--admin-surface-raised)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--admin-border)',
                          }}
                        >
                          Pages {ch.source_start_page}–{ch.source_end_page || ch.source_start_page}
                        </span>
                      )}
                      {ch.confidence_score && (
                        <span style={{ fontSize: '11px', color: 'var(--admin-primary)' }}>
                          {Math.round(ch.confidence_score * 100)}% match
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        onClick={() => startEditChapter(ch)}
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Chapter Inline Edit Form */}
                  {isEditingCh && (
                    <div
                      style={{
                        padding: '16px 20px',
                        backgroundColor: 'var(--admin-surface)',
                        borderTop: '1px solid var(--admin-border)',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '12px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={editLabelStyle}>Chapter #</label>
                          <input
                            type="number"
                            className="adm-input"
                            value={chapterFormData.chapter_number ?? ch.chapter_number}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, chapter_number: Number(e.target.value) }))}
                            style={editInputStyle}
                          />
                        </div>
                        <div>
                          <label style={editLabelStyle}>Title</label>
                          <input
                            type="text"
                            className="adm-input"
                            value={chapterFormData.title ?? ch.title}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, title: e.target.value }))}
                            style={editInputStyle}
                          />
                        </div>
                        <div>
                          <label style={editLabelStyle}>Start Page</label>
                          <input
                            type="number"
                            className="adm-input"
                            value={chapterFormData.source_start_page ?? ch.source_start_page ?? 1}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, source_start_page: Number(e.target.value) }))}
                            style={editInputStyle}
                          />
                        </div>
                        <div>
                          <label style={editLabelStyle}>End Page</label>
                          <input
                            type="number"
                            className="adm-input"
                            value={chapterFormData.source_end_page ?? ch.source_end_page ?? 1}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, source_end_page: Number(e.target.value) }))}
                            style={editInputStyle}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="adm-btn adm-btn-secondary adm-btn-sm"
                          onClick={() => setEditingChapterId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="adm-btn adm-btn-primary adm-btn-sm"
                          onClick={() => saveEditChapter(ch.id)}
                          disabled={savingEdit}
                        >
                          {savingEdit ? 'Saving…' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Topics List */}
                  {isChExpanded && (
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(!ch.topics || ch.topics.length === 0) ? (
                        <div style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', padding: '8px 0' }}>
                          No topics detected under this chapter.
                        </div>
                      ) : (
                        ch.topics.map((top) => {
                          const isTopExpanded = !!expandedTopics[top.id];
                          const isEditingTop = editingTopicId === top.id;

                          return (
                            <div
                              key={top.id}
                              style={{
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--admin-border)',
                                backgroundColor: 'var(--admin-surface)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Topic Header */}
                              <div
                                style={{
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  gap: '10px',
                                }}
                                onClick={() => toggleTopic(top.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
                                  <span style={{ color: 'var(--admin-text-secondary)', display: 'inline-flex' }}>
                                    {isTopExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </span>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: 'var(--admin-primary)',
                                    }}
                                  >
                                    <Tag size={12} />
                                    Topic {top.sequence_number ?? 1}
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>
                                    {top.title}
                                  </span>
                                  {top.source_start_page && (
                                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                      (p. {top.source_start_page}–{top.source_end_page || top.source_start_page})
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  className="adm-btn adm-btn-secondary adm-btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditTopic(top);
                                  }}
                                >
                                  <Pencil size={11} />
                                  Edit
                                </button>
                              </div>

                              {/* Topic Inline Edit Form */}
                              {isEditingTop && (
                                <div
                                  style={{
                                    padding: '12px 16px',
                                    borderTop: '1px solid var(--admin-border)',
                                    backgroundColor: 'var(--admin-bg)',
                                  }}
                                >
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                      <label style={editLabelStyle}>Seq #</label>
                                      <input
                                        type="number"
                                        className="adm-input"
                                        value={topicFormData.sequence_number ?? top.sequence_number}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, sequence_number: Number(e.target.value) }))}
                                        style={editInputStyle}
                                      />
                                    </div>
                                    <div>
                                      <label style={editLabelStyle}>Title</label>
                                      <input
                                        type="text"
                                        className="adm-input"
                                        value={topicFormData.title ?? top.title}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, title: e.target.value }))}
                                        style={editInputStyle}
                                      />
                                    </div>
                                    <div>
                                      <label style={editLabelStyle}>Start Page</label>
                                      <input
                                        type="number"
                                        className="adm-input"
                                        value={topicFormData.source_start_page ?? top.source_start_page ?? 1}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, source_start_page: Number(e.target.value) }))}
                                        style={editInputStyle}
                                      />
                                    </div>
                                    <div>
                                      <label style={editLabelStyle}>End Page</label>
                                      <input
                                        type="number"
                                        className="adm-input"
                                        value={topicFormData.source_end_page ?? top.source_end_page ?? 1}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, source_end_page: Number(e.target.value) }))}
                                        style={editInputStyle}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-secondary adm-btn-sm"
                                      onClick={() => setEditingTopicId(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-primary adm-btn-sm"
                                      onClick={() => saveEditTopic(top.id)}
                                      disabled={savingEdit}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Subtopics List */}
                              {isTopExpanded && top.subtopics && top.subtopics.length > 0 && (
                                <div
                                  style={{
                                    padding: '8px 14px 12px 28px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    backgroundColor: 'var(--admin-bg)',
                                  }}
                                >
                                  {top.subtopics.map((sub) => {
                                    const isEditingSub = editingSubtopicId === sub.id;

                                    if (isEditingSub) {
                                      return (
                                        <div
                                          key={sub.id}
                                          style={{
                                            padding: '10px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--admin-primary)',
                                            backgroundColor: 'var(--admin-surface)',
                                          }}
                                        >
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '8px' }}>
                                            <div>
                                              <label style={editLabelStyle}>Seq #</label>
                                              <input
                                                type="number"
                                                className="adm-input"
                                                value={subtopicFormData.sequence_number ?? sub.sequence_number}
                                                onChange={(e) =>
                                                  setSubtopicFormData((prev) => ({ ...prev, sequence_number: Number(e.target.value) }))
                                                }
                                                style={editInputStyle}
                                              />
                                            </div>
                                            <div>
                                              <label style={editLabelStyle}>Title</label>
                                              <input
                                                type="text"
                                                className="adm-input"
                                                value={subtopicFormData.title ?? sub.title}
                                                onChange={(e) => setSubtopicFormData((prev) => ({ ...prev, title: e.target.value }))}
                                                style={editInputStyle}
                                              />
                                            </div>
                                            <div>
                                              <label style={editLabelStyle}>Start Page</label>
                                              <input
                                                type="number"
                                                className="adm-input"
                                                value={subtopicFormData.source_start_page ?? sub.source_start_page ?? 1}
                                                onChange={(e) =>
                                                  setSubtopicFormData((prev) => ({ ...prev, source_start_page: Number(e.target.value) }))
                                                }
                                                style={editInputStyle}
                                              />
                                            </div>
                                            <div>
                                              <label style={editLabelStyle}>End Page</label>
                                              <input
                                                type="number"
                                                className="adm-input"
                                                value={subtopicFormData.source_end_page ?? sub.source_end_page ?? 1}
                                                onChange={(e) =>
                                                  setSubtopicFormData((prev) => ({ ...prev, source_end_page: Number(e.target.value) }))
                                                }
                                                style={editInputStyle}
                                              />
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                                            <button
                                              type="button"
                                              className="adm-btn adm-btn-secondary adm-btn-sm"
                                              onClick={() => setEditingSubtopicId(null)}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              className="adm-btn adm-btn-primary adm-btn-sm"
                                              onClick={() => saveEditSubtopic(sub.id)}
                                              disabled={savingEdit}
                                            >
                                              Save
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={sub.id}
                                        style={{
                                          padding: '8px 12px',
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--admin-border)',
                                          backgroundColor: 'var(--admin-surface)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '10px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontSize: '11px',
                                              color: 'var(--admin-text-secondary)',
                                              fontWeight: 600,
                                            }}
                                          >
                                            <CircleDot size={11} style={{ color: 'var(--admin-primary)' }} />
                                            {sub.sequence_number ?? 1}.
                                          </span>
                                          <span style={{ fontSize: '13px', color: 'var(--admin-text)' }}>{sub.title}</span>
                                          {sub.source_start_page && (
                                            <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                              (p. {sub.source_start_page}–{sub.source_end_page || sub.source_start_page})
                                            </span>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          className="adm-btn adm-btn-ghost adm-btn-sm"
                                          onClick={() => startEditSubtopic(sub)}
                                          aria-label={`Edit subtopic ${sub.title}`}
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      </div>
                                    );
                                  })}
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
            })}
          </div>
        )}
      </SurfacePanel>

      {/* Approve Curriculum Confirmation */}
      <ConfirmDialog
        open={confirmApprove}
        title="Approve Curriculum"
        message="Are you sure you want to approve this curriculum? All chapters and topics will be marked APPROVED and canonical."
        confirmLabel="Approve Curriculum"
        danger
        loading={approving}
        onConfirm={handleApproveCurriculum}
        onCancel={() => setConfirmApprove(false)}
      />

      {/* Regeneration Side-by-Side Comparison Modal */}
      <Modal
        open={!!comparisonModal}
        onClose={() => setComparisonModal(null)}
        title="Curriculum Re-Extraction Draft Comparison"
        subtitle="A safe, isolated AI extraction draft was generated into the extract staging table without modifying existing approved content."
        maxWidth={900}
        footer={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setComparisonModal(null)}>
            Close Comparison
          </button>
        }
      >
        {comparisonModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Notice Banner */}
            <div
              style={{
                padding: '12px 16px',
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
                <strong>Safety Guarantee:</strong> Canonical curriculum remains locked in the active database. Compare the
                existing approved chapters with newly detected draft chapters below.
              </span>
            </div>

            {/* Side-by-Side Comparison Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Canonical */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-bg)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}
                >
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                    Active Canonical Curriculum
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--admin-success)', fontWeight: 600 }}>
                    {comparisonModal.comparison.canonical_chapters_count} Chapters
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {comparisonModal.comparison.current_curriculum.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        fontSize: '12px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      <strong>Ch {c.chapter_number}:</strong> {c.title}
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                        {c.topics_count} topics • Pages {c.source_start_page}–{c.source_end_page}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Draft Extract */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--admin-primary)',
                  backgroundColor: 'var(--admin-primary-soft)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}
                >
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-primary)' }}>
                    Newly Extracted AI Draft
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--admin-primary)', fontWeight: 600 }}>
                    {comparisonModal.comparison.extracted_chapters_count} Chapters
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {comparisonModal.comparison.draft_curriculum.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--admin-surface)',
                        border: '1px solid var(--admin-border)',
                        fontSize: '12px',
                        color: 'var(--admin-text)',
                      }}
                    >
                      <strong>Ch {c.chapter_number}:</strong> {c.title}
                      <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                        {c.topics_count} topics • Pages {c.source_start_page}–{c.source_end_page}
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
