import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Clapperboard,
  ClipboardList,
  Eye,
  FileText,
  Globe2,
  Layers,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/admin/PageHeader';
import { SurfacePanel } from '../../components/SurfacePanel';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyHint, Banner, formatDuration, subTextStyle } from '../../components/admin/videoStudio/StudioUi';
import { UploadPanel } from '../../components/admin/videoStudio/UploadPanel';
import { TopicsPanel } from '../../components/admin/videoStudio/TopicsPanel';
import { PlansPanel } from '../../components/admin/videoStudio/PlansPanel';
import { ScriptsPanel } from '../../components/admin/videoStudio/ScriptsPanel';
import { RenderPanel } from '../../components/admin/videoStudio/RenderPanel';
import { ReviewPanel } from '../../components/admin/videoStudio/ReviewPanel';
import { PublishPanel } from '../../components/admin/videoStudio/PublishPanel';
import { api } from '../../lib/api';
import {
  PipelineStatus,
  SubjectItem,
  Textbook,
  TextbookHierarchy,
  VideoPlan,
  VideoRenderDetails,
} from '../../lib/types';

interface AdminVideoStudioProps {
  onNavigate: (route: string, params?: any) => void;
  initialTextbookId?: number;
}

const STEPS = [
  { number: 1, label: 'Upload', hint: 'Textbook or chapter PDF', icon: UploadCloud },
  { number: 2, label: 'Curriculum', hint: 'Extract & approve curriculum', icon: Layers },
  { number: 3, label: 'Plans', hint: 'Dynamic video planning', icon: ClipboardList },
  { number: 4, label: 'Scripts', hint: 'Teach, edit, approve', icon: FileText },
  { number: 5, label: 'Render', hint: 'Real MP4 production', icon: Clapperboard },
  { number: 6, label: 'Review', hint: 'Watch before publishing', icon: Eye },
  { number: 7, label: 'Publish', hint: 'Explicit release to students', icon: Globe2 },
];

const statusUpper = (status?: string | null) => (status || '').toUpperCase();

/**
 * Video Studio — the guided admin video production workflow.
 *
 * All work goes through the validated Phase 2 pipeline: upload → curriculum
 * extraction → dynamic planning → script generation → real MP4 rendering →
 * mandatory review → explicit publishing. Nothing is published automatically.
 */
export const AdminVideoStudio: React.FC<AdminVideoStudioProps> = ({ initialTextbookId }) => {
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [hierarchy, setHierarchy] = useState<TextbookHierarchy | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [plans, setPlans] = useState<VideoPlan[]>([]);
  const [videos, setVideos] = useState<VideoRenderDetails[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const autoSelectedRef = useRef<string | null>(null);

  const loadTextbooks = useCallback(async () => {
    try {
      const list = await api.listTextbooks();
      setTextbooks(list);
      return list;
    } catch (err: any) {
      setError(err?.message || 'Could not load textbooks.');
      return [];
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await api.listSubjects({ page: 1, page_size: 200 });
      setSubjects(res.items);
    } catch {
      // Subject assignment is optional for the workflow.
    }
  }, []);

  const applyData = useCallback(
    (tb: Textbook | null, hier: TextbookHierarchy | null, st: PipelineStatus | null, p: VideoPlan[], v: VideoRenderDetails[]) => {
      setTextbook(tb);
      setHierarchy(hier);
      setPipeline(st);
      setPlans(p);
      setVideos(v);
      if (tb && hier) {
        const ids = (hier.chapters || []).map((c) => c.id);
        setSelectedChapterIds((prev) => {
          if (prev.length === 0) return ids;
          // Newly extracted chapters are auto-selected only when the admin had
          // previously selected everything (the default).
          const allPreviouslySelected = prev.length > 0 && prev.every((id) => ids.includes(id));
          return allPreviouslySelected ? ids : prev.filter((id) => ids.includes(id));
        });
      }
    },
    []
  );

  const fetchStudioData = useCallback(async (id: number) => {
    const [tb, hier, st, p, v] = await Promise.all([
      api.getTextbook(id).catch(() => null),
      api.getTextbookHierarchy(id).catch(() => null),
      api.getPipelineStatus(id).catch(() => null),
      api.listVideoPlans({ textbook_id: id }).catch(() => [] as VideoPlan[]),
      api.listVideos({ textbook_id: id }).catch(() => [] as VideoRenderDetails[]),
    ]);
    return { tb: tb as Textbook | null, hier: hier as TextbookHierarchy | null, st: st as PipelineStatus | null, p, v };
  }, []);

  const refreshStudio = useCallback(async () => {
    if (!selectedId) return;
    try {
      const data = await fetchStudioData(selectedId);
      applyData(data.tb, data.hier, data.st, data.p, data.v);
    } catch (err: any) {
      setError(err?.message || 'Could not refresh the studio data.');
    }
  }, [selectedId, fetchStudioData, applyData]);

  const suggestStep = useCallback(
    (
      hier: TextbookHierarchy | null,
      p: VideoPlan[],
      v: VideoRenderDetails[],
      chapterIds: number[]
    ): number => {
      if (!hier || (hier.chapters || []).length === 0) return 2;
      const chapterApproved = ['APPROVED', 'PUBLISHED'].includes(statusUpper(hier.status));
      if (!chapterApproved) return 2;

      const scopedPlans = p.filter((plan) => !plan.chapter_id || chapterIds.includes(plan.chapter_id));
      if (scopedPlans.length === 0) return 3;
      if (scopedPlans.some((plan) => !['APPROVED', 'PUBLISHED'].includes(statusUpper(plan.status)))) return 3;

      const byId = new Map<number, VideoRenderDetails>();
      v.forEach((video) => byId.set(video.video_id || video.id, video));
      if (scopedPlans.some((plan) => statusUpper(byId.get(plan.id)?.script_status) !== 'SCRIPT_APPROVED')) return 4;
      if (scopedPlans.some((plan) => statusUpper(byId.get(plan.id)?.render_status) !== 'RENDERED')) return 5;
      if (scopedPlans.some((plan) => !['APPROVED', 'PUBLISHED'].includes(statusUpper(byId.get(plan.id)?.status)))) return 6;
      if (scopedPlans.some((plan) => statusUpper(byId.get(plan.id)?.status) !== 'PUBLISHED')) return 7;
      return 7;
    },
    []
  );

  const selectTextbook = useCallback(
    async (id: number, opts?: { advance?: boolean }) => {
      setSelectedId(id);
      setDataLoading(true);
      setError(null);
      setNotice(null);
      try {
        const data = await fetchStudioData(id);
        applyData(data.tb, data.hier, data.st, data.p, data.v);
        const ids = (data.hier?.chapters || []).map((c) => c.id);
        setSelectedChapterIds(ids);
        if (opts?.advance !== false) {
          setStep(suggestStep(data.hier, data.p, data.v, ids));
        }
      } catch (err: any) {
        setError(err?.message || 'Could not open this textbook.');
      } finally {
        setDataLoading(false);
      }
    },
    [fetchStudioData, applyData, suggestStep]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      await Promise.all([loadSubjects(), loadTextbooks()]);
      if (!cancelled) setBootLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSubjects, loadTextbooks]);

  useEffect(() => {
    const urlId = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('textbookId')) || undefined : undefined;
    const targetId = initialTextbookId || urlId;
    if (targetId && autoSelectedRef.current !== String(targetId)) {
      autoSelectedRef.current = String(targetId);
      selectTextbook(targetId);
    }
  }, [initialTextbookId, selectTextbook]);

  const isPipelineActive =
    !!selectedId &&
    (['UPLOADED', 'QUEUED', 'PROCESSING'].includes(statusUpper(textbook?.status)) ||
      (!!pipeline && (pipeline.progress ?? 0) < 100 && !['COMPLETED', 'APPROVED', 'PUBLISHED', 'FAILED'].includes(statusUpper(pipeline.status))));

  useEffect(() => {
    if (!selectedId || !isPipelineActive) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const st = await api.getPipelineStatus(selectedId);
        if (cancelled) return;
        setPipeline(st);
        const finished =
          (st.progress ?? 0) >= 100 ||
          ['COMPLETED', 'APPROVED', 'PUBLISHED', 'FAILED'].includes(statusUpper(st.status));
        if (finished) {
          window.clearInterval(timer);
          const data = await fetchStudioData(selectedId);
          if (cancelled) return;
          applyData(data.tb, data.hier, data.st, data.p, data.v);
          if ((data.hier?.chapters || []).length > 0) {
            setSelectedChapterIds((prev) => (prev.length === 0 ? (data.hier?.chapters || []).map((c) => c.id) : prev));
            setNotice('Curriculum extraction finished. Review and edit the topics in Step 2.');
          } else if (statusUpper(st.status) === 'FAILED') {
            setError(st.error_message || 'Curriculum extraction failed. Check the processing dashboard for details.');
          }
          await loadTextbooks();
        }
      } catch {
        // Ignore transient polling errors.
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedId, isPipelineActive, fetchStudioData, applyData, loadTextbooks]);

  const scopedPlans = useMemo(
    () => plans.filter((plan) => !plan.chapter_id || selectedChapterIds.includes(plan.chapter_id)),
    [plans, selectedChapterIds]
  );

  const scopedVideos = useMemo(() => {
    const ids = new Set(scopedPlans.map((plan) => plan.id));
    return videos.filter((video) => ids.has(video.video_id || video.id));
  }, [videos, scopedPlans]);

  const videosById = useMemo(() => {
    const map = new Map<number, VideoRenderDetails>();
    scopedVideos.forEach((video) => map.set(video.video_id || video.id, video));
    return map;
  }, [scopedVideos]);

  const stepDone = useMemo(() => {
    const chapters = hierarchy?.chapters || [];
    const curriculumApproved =
      chapters.length > 0 && ['APPROVED', 'PUBLISHED'].includes(statusUpper(hierarchy?.status));
    const plansApproved =
      scopedPlans.length > 0 && scopedPlans.every((p) => ['APPROVED', 'PUBLISHED'].includes(statusUpper(p.status)));
    const scriptsApproved =
      scopedPlans.length > 0 &&
      scopedPlans.every((p) => statusUpper(videosById.get(p.id)?.script_status) === 'SCRIPT_APPROVED');
    const allRendered =
      scopedPlans.length > 0 &&
      scopedPlans.every((p) => statusUpper(videosById.get(p.id)?.render_status) === 'RENDERED');
    const allApproved =
      scopedPlans.length > 0 &&
      scopedPlans.every((p) => ['APPROVED', 'PUBLISHED'].includes(statusUpper(videosById.get(p.id)?.status)));
    const allPublished =
      scopedPlans.length > 0 && scopedPlans.every((p) => statusUpper(videosById.get(p.id)?.status) === 'PUBLISHED');

    return {
      1: !!selectedId,
      2: curriculumApproved,
      3: plansApproved,
      4: scriptsApproved,
      5: allRendered,
      6: allApproved,
      7: allPublished,
    } as Record<number, boolean>;
  }, [hierarchy, scopedPlans, videosById, selectedId]);

  const nextStep = useMemo(() => {
    if (!selectedId) return 1;
    for (const s of STEPS) {
      if (!stepDone[s.number]) return s.number;
    }
    return 7;
  }, [selectedId, stepDone]);

  const selectedTextbook = useMemo(() => textbooks.find((t) => t.id === selectedId) || textbook, [textbooks, selectedId, textbook]);

  const handleUploaded = async (id: number) => {
    setNotice('PDF uploaded. Curriculum extraction is running — progress is shown in the dashboard.');
    await loadTextbooks();
    await selectTextbook(id, { advance: false });
    setStep(2);
  };

  const toggleChapter = (chapterId: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const selectAllChapters = () => {
    const chapters = hierarchy?.chapters || [];
    setSelectedChapterIds((prev) => (prev.length === chapters.length ? [] : chapters.map((c) => c.id)));
  };

  const renderStep = () => {
    if (step === 1) {
      return <UploadPanel subjects={subjects} onUploaded={handleUploaded} />;
    }

    if (!selectedId) {
      return (
        <SurfacePanel>
          <EmptyHint
            title="No source material selected"
            description="Upload a textbook or chapter PDF in Step 1, or select an existing textbook from the processing dashboard."
            action={
              <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setStep(1)}>
                Go to upload
              </button>
            }
          />
        </SurfacePanel>
      );
    }

    if (step === 2) {
      return (
        <TopicsPanel
          hierarchy={hierarchy}
          loading={dataLoading}
          selectedChapterIds={selectedChapterIds}
          onToggleChapter={toggleChapter}
          onSelectAll={selectAllChapters}
          onRefresh={refreshStudio}
          onApproved={() => setStep(3)}
        />
      );
    }

    if (step === 3) {
      return (
        <PlansPanel
          hierarchy={hierarchy}
          selectedChapterIds={selectedChapterIds}
          plans={scopedPlans}
          loading={dataLoading}
          onRefresh={refreshStudio}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      );
    }

    if (step === 4) {
      return (
        <ScriptsPanel
          plans={scopedPlans}
          videos={scopedVideos}
          loading={dataLoading}
          onRefresh={refreshStudio}
          onNext={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      );
    }

    if (step === 5) {
      return (
        <RenderPanel
          plans={scopedPlans}
          videos={scopedVideos}
          loading={dataLoading}
          onRefresh={refreshStudio}
          onNext={() => setStep(6)}
          onBack={() => setStep(4)}
        />
      );
    }

    if (step === 6) {
      return (
        <ReviewPanel
          videos={scopedVideos}
          loading={dataLoading}
          onRefresh={refreshStudio}
          onNext={() => setStep(7)}
          onBack={() => setStep(5)}
          onGoToScripts={() => setStep(4)}
        />
      );
    }

    return (
      <PublishPanel
        videos={scopedVideos}
        loading={dataLoading}
        onRefresh={refreshStudio}
        onBack={() => setStep(6)}
        onGoToReview={() => setStep(6)}
      />
    );
  };

  const activeStepMeta = STEPS[step - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="Video Studio"
        description="Turn a textbook or chapter into reviewed, student-ready videos. Every stage is explicit: nothing is published without your approval."
        actions={
          <>
            <select
              value={selectedId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) selectTextbook(id);
                else {
                  setSelectedId(null);
                  setTextbook(null);
                  setHierarchy(null);
                  setPipeline(null);
                  setPlans([]);
                  setVideos([]);
                  setSelectedChapterIds([]);
                }
              }}
              className="adm-input"
              style={{ minWidth: '220px', maxWidth: '320px' }}
              aria-label="Select source textbook"
            >
              <option value="">Select a textbook / chapter…</option>
              {textbooks.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.title}
                  {tb.source_type === 'CHAPTER' ? ' (chapter)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={async () => {
                await loadTextbooks();
                await refreshStudio();
              }}
              disabled={bootLoading}
            >
              {bootLoading ? <Loader2 size={13} /> : <RefreshCw size={13} />} Refresh
            </button>
          </>
        }
      />

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      {/* Guided stepper */}
      <SurfacePanel style={{ padding: '12px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {STEPS.map((s, idx) => {
            const active = s.number === step;
            const done = stepDone[s.number];
            const Icon = s.icon;
            return (
              <React.Fragment key={s.number}>
                {idx > 0 && (
                  <div
                    style={{
                      width: '14px',
                      minWidth: '14px',
                      alignSelf: 'center',
                      height: '1px',
                      backgroundColor: done || stepDone[STEPS[idx - 1].number] ? 'var(--admin-success)' : 'var(--admin-border)',
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setStep(s.number)}
                  title={`${s.label} — ${s.hint}`}
                  style={{
                    flex: '1 0 108px',
                    minWidth: '108px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${active ? 'var(--admin-primary)' : 'transparent'}`,
                    backgroundColor: active ? 'var(--admin-primary-soft)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: done ? 'var(--admin-success-soft)' : active ? 'var(--admin-primary)' : 'var(--admin-surface-raised)',
                      color: done ? 'var(--admin-success)' : active ? '#fff' : 'var(--admin-text-secondary)',
                      border: done || active ? 'none' : '1px solid var(--admin-border)',
                    }}
                  >
                    {done ? <Check size={13} /> : <Icon size={13} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: active ? 'var(--admin-primary)' : 'var(--admin-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.number}. {s.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        color: 'var(--admin-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '130px',
                      }}
                    >
                      {s.hint}
                    </span>
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {selectedId && nextStep !== step && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--admin-border)',
            }}
          >
            <span style={{ fontSize: '11.5px', color: 'var(--admin-text-secondary)' }}>
              Next action: <strong style={{ color: 'var(--admin-text)' }}>{STEPS[nextStep - 1].label}</strong> — {STEPS[nextStep - 1].hint}
            </span>
            <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setStep(nextStep)}>
              Go to Step {nextStep}
            </button>
          </div>
        )}
      </SurfacePanel>

      {/* Processing dashboard */}
      <SurfacePanel style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <BookOpen size={15} style={{ color: 'var(--admin-primary)' }} />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--admin-text)' }}>Processing dashboard</span>
              <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                {textbooks.length} source{textbooks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={subTextStyle}>Textbook and chapter jobs with their current extraction stage.</div>
          </div>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setDashboardOpen((o) => !o)}>
            {dashboardOpen ? 'Hide' : 'Show'}
          </button>
        </div>

        {dashboardOpen && (
          <div style={{ marginTop: '12px' }}>
            {bootLoading ? (
              <div style={{ fontSize: '12.5px', color: 'var(--admin-text-secondary)', padding: '8px 0' }}>
                <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading sources…
              </div>
            ) : textbooks.length === 0 ? (
              <EmptyHint
                title="No textbooks or chapters yet"
                description="Upload a complete textbook or an individual chapter PDF in Step 1 to start the pipeline."
                action={
                  <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setStep(1)}>
                    <UploadCloud size={12} /> Upload a PDF
                  </button>
                }
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                  gap: '10px',
                  maxHeight: '330px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {textbooks.map((tb) => {
                  const active = tb.id === selectedId;
                  const progress = Math.max(0, Math.min(100, tb.progress ?? (['APPROVED', 'PUBLISHED', 'COMPLETED'].includes(statusUpper(tb.status)) ? 100 : 0)));
                  const failed = statusUpper(tb.status) === 'FAILED';
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => selectTextbook(tb.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${active ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                        backgroundColor: active ? 'var(--admin-primary-soft)' : 'var(--admin-surface-raised)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: active ? 'var(--admin-primary)' : 'var(--admin-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '190px',
                          }}
                        >
                          {tb.title}
                        </span>
                        <StatusBadge status={tb.source_type === 'CHAPTER' ? 'Chapter PDF' : 'Textbook'} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <StatusBadge status={tb.status || 'uploaded'} />
                        <span style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)' }}>
                          {tb.chapters_count ?? 0} chapters · {tb.topics_count ?? 0} topics · {tb.subtopics_count ?? 0} subtopics
                        </span>
                      </div>
                      {tb.stage_name && (
                        <div style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)', marginTop: '3px' }}>
                          Stage: {tb.stage_name.replace(/_/g, ' ').toLowerCase()}
                        </div>
                      )}
                      <div style={{ marginTop: '6px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--admin-border)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${failed ? 100 : progress}%`,
                            backgroundColor: failed ? 'var(--admin-error)' : progress >= 100 ? 'var(--admin-success)' : 'var(--admin-primary)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      {tb.error_message && failed && (
                        <div style={{ fontSize: '10.5px', color: 'var(--admin-error)', marginTop: '4px' }}>{tb.error_message}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedId && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--admin-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-text)' }}>
                    {selectedTextbook?.title || 'Selected source'}
                  </span>
                  <StatusBadge status={selectedTextbook?.status || 'uploaded'} />
                  {selectedTextbook?.source_type === 'CHAPTER' && (
                    <span style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)' }}>
                      Individual chapter PDF · chapter {selectedTextbook.chapter_number ?? '—'}
                    </span>
                  )}
                  <span style={{ fontSize: '10.5px', color: 'var(--admin-text-secondary)' }}>
                    {pipeline?.current_stage ? `Stage: ${pipeline.current_stage.replace(/_/g, ' ').toLowerCase()}` : ''}
                    {typeof pipeline?.progress === 'number' ? ` · ${Math.round(pipeline.progress)}%` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {(pipeline?.stages_log || []).map((s) => (
                    <span
                      key={`${s.stage}-${s.name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10.5px',
                        padding: '3px 7px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--admin-success-soft)',
                        color: 'var(--admin-success)',
                        fontWeight: 600,
                      }}
                    >
                      <Check size={10} /> {s.stage}. {s.name.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  ))}
                  {(pipeline?.stages_log || []).length === 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
                      No pipeline stages recorded yet.
                    </span>
                  )}
                </div>

                {isPipelineActive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11.5px', color: 'var(--admin-primary)' }}>
                    <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Extraction in progress — this panel updates automatically.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SurfacePanel>

      {/* Active step */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', paddingLeft: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--admin-text-secondary)' }}>
            Step {step} of 7
          </span>
          <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)' }}>· {activeStepMeta.hint}</span>
          {selectedId && scopedPlans.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-secondary)', marginLeft: 'auto' }}>
              {scopedPlans.length} video{scopedPlans.length !== 1 ? 's' : ''} in scope ·{' '}
              {formatDuration(scopedPlans.reduce((sum, p) => sum + (p.estimated_duration_seconds || p.duration_seconds || 0), 0))} planned
            </span>
          )}
        </div>
        {renderStep()}
      </div>

      {selectedId && selectedChapterIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--admin-text-secondary)' }}>
          <span>Production scope:</span>
          {(hierarchy?.chapters || [])
            .filter((c) => selectedChapterIds.includes(c.id))
            .map((c) => (
              <span
                key={c.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--admin-surface-raised)',
                  border: '1px solid var(--admin-border)',
                }}
              >
                Ch {c.chapter_number}: {c.title}
                <button
                  type="button"
                  onClick={() => toggleChapter(c.id)}
                  aria-label={`Remove ${c.title} from scope`}
                  style={{ background: 'transparent', border: 'none', padding: 0, display: 'inline-flex', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setStep(2)}>
            Change chapters
          </button>
        </div>
      )}
    </div>
  );
};
