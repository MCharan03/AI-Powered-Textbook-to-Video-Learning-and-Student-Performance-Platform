import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { Textbook, TextbookHierarchy, Chapter, Topic, Subtopic, RegenerationComparison } from '../../lib/types';

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
      alert(`Failed to update chapter: ${err.message}`);
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
      alert(`Failed to update topic: ${err.message}`);
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
      alert(`Failed to update subtopic: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Approve entire curriculum
  const handleApproveCurriculum = async () => {
    if (!window.confirm('Are you sure you want to approve this curriculum? All chapters and topics will be marked APPROVED and canonical.')) {
      return;
    }
    try {
      setApproving(true);
      await api.approveTextbookCurriculum(textbookId);
      setActionSuccess('Curriculum successfully approved and canonicalized!');
      await loadData();
    } catch (err: any) {
      alert(`Failed to approve curriculum: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // Safe regeneration
  const handleRegenerateDraft = async () => {
    try {
      setRegenerating(true);
      const comp = await api.regenerateCurriculum(textbookId);
      setComparisonModal(comp);
    } catch (err: any) {
      alert(`Failed to trigger regeneration: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
        Loading textbook curriculum review...
      </div>
    );
  }

  if (error || !textbook || !hierarchy) {
    return (
      <SurfacePanel>
        <div style={{ padding: '24px', color: 'var(--admin-danger)' }}>
          <h3>Error loading textbook</h3>
          <p>{error || 'Textbook not found'}</p>
          <button
            onClick={() => onNavigate('admin-textbooks')}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: 'var(--admin-primary)',
              color: '#FFF',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← Back to Textbooks
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => onNavigate('admin-textbooks')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Back to Catalog
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin-text)' }}>
                {textbook.title}
              </h1>
              <StatusBadge
                status={isApproved ? 'approved' : 'pending_review'}
              />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
              Subject: <strong style={{ color: '#818CF8' }}>{hierarchy.subject_name || textbook.subject_name || 'Unassigned'}</strong> • File: {textbook.original_filename || textbook.filename || 'textbook.pdf'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRegenerateDraft}
            disabled={regenerating}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: regenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🔄</span>
            <span>{regenerating ? 'Extracting Draft...' : 'Regenerate AI Draft'}</span>
          </button>

          {!isApproved && (
            <button
              onClick={handleApproveCurriculum}
              disabled={approving}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: approving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              <span>✅</span>
              <span>{approving ? 'Approving...' : 'Approve Curriculum'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34D399',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {actionSuccess}
        </div>
      )}

      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Chapters Extracted</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--admin-text)', marginTop: '4px' }}>
            {chapters.length}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Topics Detected</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#38BDF8', marginTop: '4px' }}>
            {totalTopics}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Micro-Learning Subtopics</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#A78BFA', marginTop: '4px' }}>
            {totalSubtopics}
          </div>
        </SurfacePanel>
        <SurfacePanel>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', fontWeight: 600 }}>Curriculum Governance</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: isApproved ? '#34D399' : '#FBBF24', marginTop: '6px' }}>
            {isApproved ? 'Canonical / Approved' : 'In Review & Editable'}
          </div>
        </SurfacePanel>
      </div>

      {/* Hierarchical Tree of Chapters, Topics, Subtopics */}
      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--admin-text)' }}>
              Curriculum Structure & Page Range Mapping
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
              Review AI-detected headings, page spans, and hierarchy. Click Edit to adjust numbers or page ranges before approval.
            </p>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
            No chapters extracted for this textbook. Run AI extraction pipeline from catalog.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {chapters.map((ch) => {
              const isChExpanded = !!expandedChapters[ch.id];
              const isEditingCh = editingChapterId === ch.id;

              return (
                <div
                  key={ch.id}
                  style={{
                    borderRadius: '10px',
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
                    }}
                    onClick={() => toggleChapter(ch.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
                        {isChExpanded ? '▼' : '▶'}
                      </span>
                      <span
                        style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818CF8',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        Ch {ch.chapter_number}
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                        {ch.title}
                      </h3>
                      {ch.source_start_page && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--admin-text-secondary)',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--admin-border)',
                          }}
                        >
                          Pages {ch.source_start_page}–{ch.source_end_page || ch.source_start_page}
                        </span>
                      )}
                      {ch.confidence_score && (
                        <span style={{ fontSize: '11px', color: '#38BDF8' }}>
                          {Math.round(ch.confidence_score * 100)}% match
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEditChapter(ch)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--admin-border)',
                          color: 'var(--admin-text)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  {/* Chapter Inline Edit Form */}
                  {isEditingCh && (
                    <div style={{ padding: '16px 20px', backgroundColor: 'var(--admin-surface)', borderTop: '1px solid var(--admin-border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '12px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Chapter #
                          </label>
                          <input
                            type="number"
                            value={chapterFormData.chapter_number ?? ch.chapter_number}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, chapter_number: Number(e.target.value) }))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Title
                          </label>
                          <input
                            type="text"
                            value={chapterFormData.title ?? ch.title}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, title: e.target.value }))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Start Page
                          </label>
                          <input
                            type="number"
                            value={chapterFormData.source_start_page ?? ch.source_start_page ?? 1}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, source_start_page: Number(e.target.value) }))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            End Page
                          </label>
                          <input
                            type="number"
                            value={chapterFormData.source_end_page ?? ch.source_end_page ?? 1}
                            onChange={(e) => setChapterFormData((prev) => ({ ...prev, source_end_page: Number(e.target.value) }))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                        <button
                          onClick={() => setEditingChapterId(null)}
                          style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEditChapter(ch.id)}
                          disabled={savingEdit}
                          style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: 'var(--admin-primary)', color: '#FFF', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {savingEdit ? 'Saving...' : 'Save Changes'}
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
                                borderRadius: '8px',
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
                                }}
                                onClick={() => toggleTopic(top.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>
                                    {isTopExpanded ? '▼' : '▶'}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#38BDF8' }}>
                                    § {top.sequence_number ?? 1}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditTopic(top);
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid var(--admin-border)',
                                    color: 'var(--admin-text)',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                              </div>

                              {/* Topic Inline Edit Form */}
                              {isEditingTop && (
                                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                      <label style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'block' }}>Seq #</label>
                                      <input
                                        type="number"
                                        value={topicFormData.sequence_number ?? top.sequence_number}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, sequence_number: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '12px' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'block' }}>Title</label>
                                      <input
                                        type="text"
                                        value={topicFormData.title ?? top.title}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, title: e.target.value }))}
                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '12px' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'block' }}>Start Page</label>
                                      <input
                                        type="number"
                                        value={topicFormData.source_start_page ?? top.source_start_page ?? 1}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, source_start_page: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '12px' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', display: 'block' }}>End Page</label>
                                      <input
                                        type="number"
                                        value={topicFormData.source_end_page ?? top.source_end_page ?? 1}
                                        onChange={(e) => setTopicFormData((prev) => ({ ...prev, source_end_page: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '12px' }}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button
                                      onClick={() => setEditingTopicId(null)}
                                      style={{ padding: '5px 10px', borderRadius: '4px', backgroundColor: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text)', fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => saveEditTopic(top.id)}
                                      disabled={savingEdit}
                                      style={{ padding: '5px 12px', borderRadius: '4px', backgroundColor: 'var(--admin-primary)', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Subtopics List */}
                              {isTopExpanded && top.subtopics && top.subtopics.length > 0 && (
                                <div style={{ padding: '8px 14px 12px 28px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--admin-bg)' }}>
                                  {top.subtopics.map((sub) => {
                                    const isEditingSub = editingSubtopicId === sub.id;

                                    return (
                                      <div
                                        key={sub.id}
                                        style={{
                                          padding: '8px 12px',
                                          borderRadius: '6px',
                                          border: '1px solid var(--admin-border)',
                                          backgroundColor: 'var(--admin-surface)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', color: '#A78BFA', fontWeight: 600 }}>
                                            • {sub.sequence_number ?? 1}.
                                          </span>
                                          <span style={{ fontSize: '13px', color: 'var(--admin-text)' }}>
                                            {sub.title}
                                          </span>
                                          {sub.source_start_page && (
                                            <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                                              (p. {sub.source_start_page}–{sub.source_end_page || sub.source_start_page})
                                            </span>
                                          )}
                                        </div>

                                        <button
                                          onClick={() => startEditSubtopic(sub)}
                                          style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: 'transparent',
                                            border: '1px solid var(--admin-border)',
                                            color: 'var(--admin-text-secondary)',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          ✏️
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

      {/* Regeneration Side-by-Side Comparison Modal */}
      {comparisonModal && (
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
              maxWidth: '900px',
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
                  Curriculum Re-Extraction Draft Comparison
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                  A safe, isolated AI extraction draft was generated into the extract staging table without modifying existing approved content.
                </p>
              </div>
              <button
                onClick={() => setComparisonModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Notice Banner */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38BDF8',
                  fontSize: '13px',
                }}
              >
                🛡️ <strong>Safety Guarantee:</strong> Canonical curriculum remains locked in the active database.
                Compare the existing approved chapters with newly detected draft chapters below.
              </div>

              {/* Side-by-Side Comparison Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Canonical */}
                <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                      Active Canonical Curriculum
                    </h3>
                    <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                      {comparisonModal.comparison.canonical_chapters_count} Chapters
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comparisonModal.comparison.current_curriculum.map((c: any, idx: number) => (
                      <div key={idx} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)', fontSize: '12px', color: 'var(--admin-text)' }}>
                        <strong>Ch {c.chapter_number}:</strong> {c.title}
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                          {c.topics_count} topics • Pages {c.source_start_page}–{c.source_end_page}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Draft Extract */}
                <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#38BDF8' }}>
                      Newly Extracted AI Draft
                    </h3>
                    <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 600 }}>
                      {comparisonModal.comparison.extracted_chapters_count} Chapters
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comparisonModal.comparison.draft_curriculum.map((c: any, idx: number) => (
                      <div key={idx} style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'var(--admin-surface)', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '12px', color: 'var(--admin-text)' }}>
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

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setComparisonModal(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--admin-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
