import React, { useState, useEffect } from 'react';
import { SurfacePanel } from '../../components/SurfacePanel';
import { PipelineStepper } from '../../components/PipelineStepper';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../lib/api';
import { Textbook, PipelineStatus } from '../../lib/types';

export const AdminPipeline: React.FC = () => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<number | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  useEffect(() => {
    const loadTextbooks = async () => {
      try {
        const list = await api.listTextbooks();
        setTextbooks(list);
        if (list.length > 0 && selectedTextbookId === null) {
          setSelectedTextbookId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadTextbooks();
  }, []);

  const fetchStatus = async (id: number) => {
    try {
      setLoading(true);
      const status = await api.getPipelineStatus(id);
      setPipelineStatus(status);
    } catch (err) {
      console.error(err);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>AI Processing Pipeline</h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
            6-stage end-to-end synthesis monitor: OCR, hierarchy, segmentation, video synthesis, quiz gen & adaptive regeneration.
          </p>
        </div>

        {selectedTextbookId && (
          <button
            onClick={() => fetchStatus(selectedTextbookId)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--admin-primary)',
              color: '#FFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}
      </div>

      {/* Textbook Selector */}
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
                #{tb.id} - {tb.title} ({tb.status})
              </option>
            ))}
          </select>
        </div>
      </SurfacePanel>

      {/* 6-Stage Stepper View */}
      {pipelineStatus && (
        <SurfacePanel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>
              Execution Stages (Textbook #{pipelineStatus.textbook_id})
            </h2>
            <StatusBadge status={pipelineStatus.pipeline_status} />
          </div>

          <PipelineStepper stages={pipelineStatus.stages} />

          {/* Terminal Log Excerpt */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Execution Event Log
            </h3>
            <div
              style={{
                backgroundColor: '#0A0F1D',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#10B981',
                maxHeight: '180px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div>[INFO] AI Pipeline orchestrator initialized.</div>
              {pipelineStatus.stages.map((st) => (
                <div key={st.stage}>
                  [{st.status.toUpperCase()}] Stage {st.stage}: {st.name} - {st.details || 'Processed successfully.'}
                </div>
              ))}
              {pipelineStatus.pipeline_status === 'completed' && (
                <div style={{ color: '#F59E0B' }}>
                  [GATE] Stages 1-5 generated assets held in 'pending_review' state awaiting Admin Review & Approval.
                </div>
              )}
            </div>
          </div>
        </SurfacePanel>
      )}
    </div>
  );
};
