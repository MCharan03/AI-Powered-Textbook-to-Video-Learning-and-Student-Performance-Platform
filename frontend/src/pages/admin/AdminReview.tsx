import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { MessageBanner } from '../../components/admin/MessageBanner';
import { SearchBar } from '../../components/admin/SearchBar';
import { Modal } from '../../components/admin/Modal';
import { LoadingState } from '../../components/admin/LoadingState';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { DataTable, Column } from '../../components/DataTable';
import { Eye, RefreshCw, ShieldCheck, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { ReviewItem } from '../../lib/types';

const FILTER_OPTIONS = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED'] as const;

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
          className="adm-badge"
          style={
            row.type === 'video'
              ? { backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }
              : { backgroundColor: 'var(--admin-success-soft)', color: 'var(--admin-success)' }
          }
        >
          {row.type}
        </span>
      ),
    },
    { key: 'topic_title', header: 'Associated Topic', render: (row) => row.topic_title || '—' },
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
            type="button"
            className="adm-btn adm-btn-secondary adm-btn-sm"
            onClick={() => handleInspect(row)}
          >
            <Eye size={13} />
            Inspect
          </button>
          {row.status !== 'published' && (
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={() => openApprovalModal(row)}
            >
              <ShieldCheck size={13} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Review Queue & Approval Gate"
        description="Enforce the mandatory human-in-the-loop review and approval gate before content is published to students."
        actions={
          <button type="button" className="adm-btn adm-btn-secondary" onClick={fetchItems} disabled={loading}>
            <RefreshCw size={15} />
            {loading ? 'Refreshing...' : 'Refresh Queue'}
          </button>
        }
      />

      {toastMessage && (
        <MessageBanner
          message={{ text: toastMessage, type: 'success' }}
          onDismiss={() => setToastMessage(null)}
        />
      )}

      {errorMsg && (
        <MessageBanner message={{ text: errorMsg, type: 'error' }} onDismiss={() => setErrorMsg(null)} />
      )}

      <SurfacePanel>
        {/* Filter toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
              Generated Content Queue ({filteredItems.length} of {items.length} Items)
            </h2>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FILTER_OPTIONS.map((st) => {
                const active = filterStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                      backgroundColor: active ? 'var(--admin-primary-soft)' : 'transparent',
                      color: active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)',
                    }}
                  >
                    {st.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search content or topics..."
            style={{ flex: '0 1 240px', minWidth: '180px' }}
          />
        </div>

        {loading ? (
          <LoadingState variant="table" rows={5} label="Loading review queue…" />
        ) : (
          <DataTable
            columns={columns}
            data={filteredItems}
            emptyMessage="Review queue is empty. All generated content has been processed."
          />
        )}
      </SurfacePanel>

      {/* Inspect Item Modal */}
      {selectedItem && (
        <Modal
          open={inspectModalOpen}
          onClose={() => setInspectModalOpen(false)}
          title={selectedItem.title}
          subtitle={`${selectedItem.type} inspection • Topic: ${selectedItem.topic_title || '—'}`}
          maxWidth={700}
          footer={
            <>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setInspectModalOpen(false)}
              >
                Close
              </button>
              {selectedItem.status !== 'published' && (
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  onClick={() => openApprovalModal(selectedItem)}
                >
                  <ShieldCheck size={15} />
                  Proceed to Approval
                </button>
              )}
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                className="adm-badge"
                style={
                  selectedItem.type === 'video'
                    ? { backgroundColor: 'var(--admin-primary-soft)', color: 'var(--admin-primary)' }
                    : { backgroundColor: 'var(--admin-success-soft)', color: 'var(--admin-success)' }
                }
              >
                {selectedItem.type}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--admin-text-secondary)' }}>Status:</span>
              <StatusBadge status={selectedItem.status || (selectedItem as any).review_status} />
            </div>

            {/* Video specific inspection */}
            {selectedItem.type === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    fontSize: '13px',
                    color: 'var(--admin-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-text-secondary)' }}>
                    Video Metadata
                  </div>
                  <div>
                    Duration: ~{selectedItem.details?.target_duration_minutes || (selectedItem as any).duration_seconds ? Math.round(((selectedItem as any).duration_seconds || 330) / 60 * 10) / 10 : 5.5} min ({selectedItem.details?.duration_seconds || (selectedItem as any).duration_seconds || 330}s)
                  </div>
                  {(selectedItem.details?.video_url || (selectedItem as any).video_url) && (
                    <div style={{ overflowWrap: 'anywhere' }}>
                      Asset URL:{' '}
                      <code style={{ color: 'var(--admin-primary)', fontSize: '12px' }}>
                        {selectedItem.details?.video_url || (selectedItem as any).video_url}
                      </code>
                    </div>
                  )}
                  <div>
                    Render Status:{' '}
                    <span style={{ fontWeight: 600 }}>
                      {selectedItem.details?.render_status || (selectedItem as any).render_status || 'NOT_STARTED'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '6px' }}>
                    Synthesized Video Script:
                  </div>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      fontSize: '13px',
                      lineHeight: '22px',
                      color: 'var(--admin-text)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
                  Generated Questions ({selectedItem.details?.questions?.length || (selectedItem as any).questions?.length || 0}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                  {(selectedItem.details?.questions || (selectedItem as any).questions || []).map((q: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--admin-bg)',
                        border: '1px solid var(--admin-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
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
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isCorrect ? 'var(--admin-success-soft)' : 'transparent',
                                color: isCorrect ? 'var(--admin-success)' : 'var(--admin-text)',
                                border: isCorrect ? '1px solid #BBF7D0' : '1px solid var(--admin-border)',
                                fontWeight: isCorrect ? 600 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}) {typeof opt === 'object' && opt !== null ? (opt as any).text : opt}
                              {isCorrect && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Check size={12} strokeWidth={3} />
                                  [Correct Answer]
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                          Rationale: {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approval Gate Modal */}
      {selectedItem && (
        <Modal
          open={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          title="Confirm Approval & Publish"
          maxWidth={520}
          footer={
            <>
              <button
                type="button"
                className="adm-btn adm-btn-secondary"
                onClick={() => setApprovalModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={handleConfirmApproval}
                disabled={submitting}
              >
                {submitting ? 'Publishing...' : 'Confirm Approval & Publish'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)', lineHeight: '20px' }}>
              You are about to approve <strong style={{ color: 'var(--admin-text)' }}>{selectedItem.title}</strong> ({selectedItem.type}) for topic "{selectedItem.topic_title}". This will publish the content to the Learning Portal.
            </p>
            <div>
              <label className="adm-label" htmlFor="approval-notes">
                Review Notes / Verification Remarks (Optional)
              </label>
              <textarea
                id="approval-notes"
                className="adm-textarea"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Quality and accuracy verified. Aligned with learning objectives."
                rows={3}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
