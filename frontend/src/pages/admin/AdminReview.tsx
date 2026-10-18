import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { ReviewItem } from '../../lib/types';

export const AdminReview: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.listReviewItems('ALL');
      setItems(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load content review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleInspect = async (item: ReviewItem) => {
    try {
      setErrorMsg(null);
      const fullItem = await api.getReviewItem(item.id, item.type);
      setSelectedItem(fullItem);
      setInspectModalOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect review item.');
    }
  };

  const openApprovalModal = (item: ReviewItem) => {
    setSelectedItem(item);
    setApprovalNotes('');
    setApprovalModalOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await api.approveReviewItem(selectedItem.id, selectedItem.type, approvalNotes);
      setApprovalModalOpen(false);
      setInspectModalOpen(false);
      setToastMessage('Content item approved and published to Learning Portal.');
      setTimeout(() => setToastMessage(null), 4000);
      await fetchItems();
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<ReviewItem>[] = [
    { key: 'id', header: 'ID', width: '60px' },
    { key: 'title', header: 'Item Title' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: row.type === 'video' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            color: row.type === 'video' ? '#818CF8' : '#34D399',
            textTransform: 'uppercase',
          }}
        >
          {row.type}
        </span>
      ),
    },
    { key: 'topic_title', header: 'Associated Topic' },
    {
      key: 'status',
      header: 'Review Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleInspect(row)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              border: 'none',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Inspect
          </button>
          {row.status !== 'published' && (
            <button
              onClick={() => openApprovalModal(row)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--admin-primary)',
                color: '#FFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Approve Gate
            </button>
          )}
        </div>
      ),
    },
  ];


  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.topic_title && item.topic_title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PENDING_REVIEW') return item.status === 'pending_review' || (item as any).review_status === 'pending_review';
    if (filterStatus === 'APPROVED') return item.status === 'approved' || (item as any).review_status === 'approved';
    if (filterStatus === 'PUBLISHED') return item.status === 'published' || (item as any).review_status === 'published';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>Review Queue & Approval Gate</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
          Enforce the mandatory human-in-the-loop review and approval gate before content is published to students.
        </p>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10B981',
            color: '#10B981',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#EF4444',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
      )}

      <SurfacePanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>
              Generated Content Queue ({filteredItems.length} of {items.length} Items)
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['ALL', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--admin-border)',
                    backgroundColor: filterStatus === st ? 'var(--admin-primary, #6366f1)' : 'transparent',
                    color: filterStatus === st ? '#FFF' : 'var(--admin-text-secondary)',
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search content or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #334155',
                backgroundColor: '#0F172A',
                color: '#F8FAFC',
                fontSize: '12px',
                width: '200px'
              }}
            />
            <button
              onClick={fetchItems}
              disabled={loading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                color: '#94A3B8',
                fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Queue'}
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredItems}
          emptyMessage="Review queue is empty. All generated content has been processed."
        />
      </SurfacePanel>

      {/* Inspect Item Modal */}
      {inspectModalOpen && selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              overflowY: 'auto',
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              border: '1px solid #334155',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: selectedItem.type === 'video' ? '#818CF8' : '#34D399',
                  }}
                >
                  {selectedItem.type} Inspection
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', marginTop: '4px' }}>
                  {selectedItem.title}
                </h2>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                  Topic: {selectedItem.topic_title} • Status: <StatusBadge status={selectedItem.status || (selectedItem as any).review_status} />
                </div>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Video specific inspection */}
            {selectedItem.type === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0F172A', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>VIDEO METADATA</div>
                  <div style={{ fontSize: '13px', color: '#F8FAFC', marginTop: '4px' }}>
                    Duration: ~{selectedItem.details?.target_duration_minutes || (selectedItem as any).duration_seconds ? Math.round(((selectedItem as any).duration_seconds || 330) / 60 * 10) / 10 : 5.5} min ({selectedItem.details?.duration_seconds || (selectedItem as any).duration_seconds || 330}s)
                  </div>
                  {(selectedItem.details?.video_url || (selectedItem as any).video_url) && (
                    <div style={{ fontSize: '13px', color: '#F8FAFC', marginTop: '2px' }}>
                      Asset URL: <code style={{ color: '#818CF8' }}>{selectedItem.details?.video_url || (selectedItem as any).video_url}</code>
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                    Render Status: <span style={{ color: '#38BDF8', fontWeight: 600 }}>{selectedItem.details?.render_status || (selectedItem as any).render_status || 'NOT_STARTED'}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    Synthesized Video Script:
                  </div>
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: '#0F172A',
                      border: '1px solid #334155',
                      fontSize: '13px',
                      lineHeight: '22px',
                      color: '#E2E8F0',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '240px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedItem.details?.script_text || (selectedItem as any).script_text || 'No script text available.'}
                  </div>
                </div>
              </div>
            )}

            {/* Quiz specific inspection */}
            {selectedItem.type === 'quiz' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>
                  Generated Questions ({selectedItem.details?.questions?.length || (selectedItem as any).questions?.length || 0}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                  {(selectedItem.details?.questions || (selectedItem as any).questions || []).map((q: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>
                        {idx + 1}. {q.question_text || q.stem}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {q.options?.map((opt: string, optIdx: number) => {
                          const isCorrect = q.correct_option === String.fromCharCode(65 + optIdx) || String(q.correct_answer) === String(optIdx);
                          return (
                            <div
                              key={optIdx}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                color: isCorrect ? '#34D399' : '#CBD5E1',
                                border: isCorrect ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                                fontWeight: isCorrect ? 600 : 400,
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}) {typeof opt === 'object' && opt !== null ? (opt as any).text : opt} {isCorrect && '✓ [Correct Answer]'}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                          Rationale: {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #334155',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              {selectedItem.status !== 'published' && (
                <button
                  onClick={() => openApprovalModal(selectedItem)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Proceed to Approval
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Gate Modal */}
      {approvalModalOpen && selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              border: '1px solid #334155',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC' }}>
                Confirm Approval & Publish
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
                You are about to approve <strong>{selectedItem.title}</strong> ({selectedItem.type}) for topic "{selectedItem.topic_title}". This will publish the content to the Learning Portal.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
                Review Notes / Verification Remarks (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Quality and accuracy verified. Aligned with learning objectives."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setApprovalModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #334155',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#10B981',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Publishing...' : 'Confirm Approval & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
