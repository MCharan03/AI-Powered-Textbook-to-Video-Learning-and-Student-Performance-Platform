import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { PipelineStepper } from '../../components/PipelineStepper';
import { EmptyState } from '../../components/admin/EmptyState';
import { LoadingState } from '../../components/admin/LoadingState';
import { ErrorState } from '../../components/admin/ErrorState';
import { RefreshCw, ChevronDown, ChevronRight, BookText } from 'lucide-react';
import { api } from '../../lib/api';
import { Textbook, PipelineStatus } from '../../lib/types';

export const AdminPipeline: React.FC = () => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        const list = await api.listTextbooks();
        setTextbooks(list);
        if (list.length > 0 && selectedTextbookId === null) {
          setSelectedTextbookId(list[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setErrorText(err.message || 'Failed to load ingested textbooks.');
      }
    };
    loadTextbooks();
  }, []);

  const fetchStatus = async (id: number) => {
    try {
      setLoading(true);
      setErrorText(null);
      const status = await api.getPipelineStatus(id);
      setPipelineStatus(status);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to load pipeline status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTextbookId) {
      fetchStatus(selectedTextbookId);
    }
  }, [selectedTextbookId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="AI Processing Pipeline"
        description="6-stage end-to-end synthesis monitor: OCR, hierarchy, segmentation, video synthesis, quiz gen & adaptive regeneration."
        actions={
          selectedTextbookId ? (
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => fetchStatus(selectedTextbookId)}
              disabled={loading}
            >
              <RefreshCw size={15} />
              {loading ? 'Refreshing...' : 'Refresh Status'}
            </button>
          ) : undefined
        }
      />

      {/* Textbook Selector */}
      <SurfacePanel title="Select Ingested Textbook">
        <select
          className="adm-select"
          value={selectedTextbookId || ''}
          onChange={(e) => setSelectedTextbookId(Number(e.target.value))}
          style={{ maxWidth: '420px' }}
          aria-label="Select ingested textbook"
        >
          {textbooks.map((tb) => (
            <option key={tb.id} value={tb.id}>
              #{tb.id} - {tb.title} ({tb.status})
            </option>
          ))}
        </select>
      </SurfacePanel>

      {errorText && <ErrorState message={errorText} onRetry={() => selectedTextbookId && fetchStatus(selectedTextbookId)} />}

      {loading && !pipelineStatus && <LoadingState variant="table" rows={3} label="Loading pipeline status…" />}

      {/* Stage Summary View */}
      {pipelineStatus && (
        <SurfacePanel>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                Execution Stages (Textbook #{pipelineStatus.textbook_id})
              </h2>
              <StatusBadge status={pipelineStatus.pipeline_status} />
            </div>
            {pipelineStatus.error && (
              <span style={{ fontSize: '12px', color: 'var(--admin-error)', fontWeight: 600 }}>
                {pipelineStatus.error}
              </span>
            )}
          </div>

          {/* Concise stage summary (light cards with StatusBadge per stage) */}
          <PipelineStepper stages={pipelineStatus.stages} />

          {/* Detailed execution log — collapsible */}
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={() => setShowLog((s) => !s)}
              aria-expanded={showLog}
            >
              {showLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Execution Event Log
            </button>
            {showLog && (
              <div
                style={{
                  marginTop: '8px',
                  backgroundColor: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: 'var(--admin-text-secondary)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div>[INFO] AI Pipeline orchestrator initialized.</div>
                {pipelineStatus.stages.map((st) => (
                  <div key={st.stage} style={{ color: st.status === 'failed' ? 'var(--admin-error)' : undefined }}>
                    [{st.status.toUpperCase()}] Stage {st.stage}: {st.name} - {st.details || 'Processed successfully.'}
                  </div>
                ))}
                {pipelineStatus.pipeline_status === 'completed' && (
                  <div style={{ color: 'var(--admin-warning)', fontWeight: 600 }}>
                    [GATE] Stages 1-5 generated assets held in 'pending_review' state awaiting Admin Review & Approval.
                  </div>
                )}
              </div>
            )}
          </div>
        </SurfacePanel>
      )}

      {/* Empty state when nothing is ingested yet */}
      {!loading && !pipelineStatus && textbooks.length === 0 && !errorText && (
        <SurfacePanel>
          <EmptyState
            icon={<BookText size={20} />}
            title="No ingested textbooks yet"
            description="Upload a textbook to see its 6-stage AI processing pipeline status here."
          />
        </SurfacePanel>
      )}
    </div>
  );
};
