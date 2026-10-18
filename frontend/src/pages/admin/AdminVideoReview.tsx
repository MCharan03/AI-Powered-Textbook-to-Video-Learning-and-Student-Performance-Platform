import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { VideoRenderDetails, VideoGenerationStatus, SceneItem } from '../../lib/types';

export const AdminVideoReview: React.FC = () => {
  const [videos, setVideos] = useState<VideoRenderDetails[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRenderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<VideoGenerationStatus | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [selectedScene, setSelectedScene] = useState<SceneItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.listVideos();
      setVideos(data);
      if (data.length > 0 && !selectedVideo) {
        setSelectedVideo(data[0]);
      } else if (selectedVideo) {
        const updated = data.find((v) => v.id === selectedVideo.id);
        if (updated) setSelectedVideo(updated);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  };

  const pollGeneration = (videoId: number) => {
    setGenerating(true);
    const interval = setInterval(async () => {
      try {
        const st = await api.getVideoGenerationStatus(videoId);
        setJobStatus(st);
        if (st.job_status === 'COMPLETED' || st.render_status === 'RENDERED') {
          clearInterval(interval);
          setGenerating(false);
          setSuccessMsg('Video rendered successfully! Ready for Admin Review.');
          await loadVideos();
          const refreshed = await api.getVideoPreview(videoId);
          setSelectedVideo(refreshed);
        } else if (st.job_status === 'FAILED' || st.render_status === 'FAILED') {
          clearInterval(interval);
          setGenerating(false);
          setErrorMsg(st.error_message || 'Video rendering failed.');
          await loadVideos();
        }
      } catch (e) {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 1500);
  };

  const handleStartGeneration = async () => {
    if (!selectedVideo) return;
    if (selectedVideo.script_status !== 'SCRIPT_APPROVED') {
      setErrorMsg('Video cannot be generated because the script is not approved. Only SCRIPT_APPROVED video scripts may enter the video rendering pipeline. Please approve the script in Script Review first.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.generateVideo(selectedVideo.video_id, false);
      pollGeneration(selectedVideo.video_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start video generation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    if (!selectedVideo) return;
    try {
      setActionLoading(true);
      setShowRegenModal(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.regenerateVideo(selectedVideo.video_id, true);
      pollGeneration(selectedVideo.video_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to regenerate video.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedVideo) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await api.approveVideo(selectedVideo.video_id);
      setSelectedVideo(res);
      setSuccessMsg('Video successfully APPROVED! You can now publish it for students.');
      await loadVideos();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve video.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVideo) return;
    if (selectedVideo.render_status !== 'RENDERED') {
      setErrorMsg('Cannot publish: video has not been rendered.');
      return;
    }
    if (selectedVideo.script_status !== 'SCRIPT_APPROVED') {
      setErrorMsg('Cannot publish: video script is not approved.');
      return;
    }
    if (!selectedVideo.actual_duration_seconds || selectedVideo.actual_duration_seconds <= 0) {
      setErrorMsg('Cannot publish: generated MP4 duration is 0 seconds.');
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await api.publishVideo(selectedVideo.video_id);
      setSelectedVideo(res);
      setSuccessMsg('Video successfully PUBLISHED! It is now accessible to enrolled students.');
      await loadVideos();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish video.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.topic_title && v.topic_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.chapter_title && v.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PUBLISHED') return v.status === 'PUBLISHED';
    if (filterStatus === 'APPROVED') return v.status === 'APPROVED';
    if (filterStatus === 'REVIEW') return v.status === 'REVIEW' && v.render_status === 'RENDERED';
    if (filterStatus === 'PENDING_RENDER') return v.render_status !== 'RENDERED';
    return true;
  });

  const formatSec = (sec?: number) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isPlaceholder = Boolean(
    !selectedVideo?.video_storage_key && !selectedVideo?.video_url
      ? true
      : (selectedVideo?.video_storage_key && (selectedVideo.video_storage_key.includes('seed_') || selectedVideo.video_storage_key.includes('sample.mp4') || selectedVideo.video_storage_key.includes('placeholder'))) ||
        (selectedVideo?.video_url && (selectedVideo.video_url.includes('seed_') || selectedVideo.video_url.includes('sample.mp4') || selectedVideo.video_url.includes('placeholder')))
  );

  const isRenderedValid = Boolean(
    selectedVideo?.render_status === 'RENDERED' &&
    !isPlaceholder &&
    (selectedVideo?.actual_duration_seconds || 0) > 0 &&
    (selectedVideo?.scenes?.length || 0) > 0
  );

  const canPublish = Boolean(
    isRenderedValid &&
    selectedVideo?.script_status === 'SCRIPT_APPROVED'
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* LEFT SIDEBAR: Video List */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🎬</span> Video Review
            </h1>
            <button
              onClick={loadVideos}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition"
              title="Refresh videos"
            >
              🔄
            </button>
          </div>
          <input
            type="text"
            placeholder="Search videos, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-2"
          />
          <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
            {['ALL', 'REVIEW', 'APPROVED', 'PUBLISHED', 'PENDING_RENDER'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition ${
                  filterStatus === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading videos...</div>
          ) : filteredVideos.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No videos match filters.</div>
          ) : (
            filteredVideos.map((v) => {
              const isSelected = selectedVideo?.id === v.id;
              const isRendered = v.render_status === 'RENDERED';
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVideo(v)}
                  className={`p-3 rounded-lg cursor-pointer transition border text-xs ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-semibold text-slate-200 line-clamp-1">{v.title}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                        v.status === 'PUBLISHED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : v.status === 'APPROVED'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : isRendered
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                    {v.subject_name || 'Subject'} • {v.topic_title || 'Topic'}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>⏱ {formatSec(v.actual_duration_seconds || v.approved_duration_seconds)}</span>
                    <span className={isRendered ? 'text-emerald-400' : 'text-slate-500'}>
                      {isRendered ? '🎥 Rendered' : '⚙️ Not Rendered'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN PANEL */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedVideo ? (
          <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
            {/* Alerts */}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs flex items-center justify-between">
                <span>⚠️ {errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">✕</button>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-xs flex items-center justify-between">
                <span>✓ {successMsg}</span>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
              </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {selectedVideo.subject_name || 'Subject'} • {selectedVideo.chapter_title || 'Chapter'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Topic: {selectedVideo.topic_title}
                  </span>
                  {selectedVideo.subtopic_title && (
                    <span className="text-xs text-slate-500">
                      ({selectedVideo.subtopic_title})
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white">{selectedVideo.title}</h2>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedVideo.render_status !== 'RENDERED' && (
                  <button
                    onClick={handleStartGeneration}
                    disabled={actionLoading || generating || selectedVideo.script_status !== 'SCRIPT_APPROVED'}
                    className={`px-4 py-2 ${
                      selectedVideo.script_status === 'SCRIPT_APPROVED'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                    } disabled:opacity-50 rounded-lg text-xs font-semibold shadow-lg transition flex items-center gap-1.5`}
                    title={selectedVideo.script_status !== 'SCRIPT_APPROVED' ? 'Approve script in Script Review to enable video generation' : ''}
                  >
                    <span>{selectedVideo.script_status === 'SCRIPT_APPROVED' ? '⚡' : '🔒'}</span>{' '}
                    {generating ? 'Rendering...' : selectedVideo.script_status === 'SCRIPT_APPROVED' ? 'Generate Video' : 'Script Approval Required'}
                  </button>
                )}

                {selectedVideo.render_status === 'RENDERED' && (
                  <>
                    <button
                      onClick={() => setShowRegenModal(true)}
                      disabled={actionLoading || generating}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <span>🔄</span> Regenerate
                    </button>

                    {selectedVideo.status !== 'APPROVED' && selectedVideo.status !== 'PUBLISHED' && canPublish && (
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
                      >
                        <span>✓</span> Approve Video
                      </button>
                    )}

                    {selectedVideo.status !== 'PUBLISHED' && canPublish && (
                      <button
                        onClick={handlePublish}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
                      >
                        <span>🚀</span> Publish for Students
                      </button>
                    )}

                    {selectedVideo.status === 'PUBLISHED' && isRenderedValid && (
                      <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5">
                        <span>✓</span> LIVE & PUBLISHED
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* PROCESSING PROGRESS BAR */}
            {generating && jobStatus && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 shadow-xl">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-indigo-400">
                    Stage: {jobStatus.current_stage.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-slate-400">{Math.round(jobStatus.progress)}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* MAIN VIDEO PLAYER & METADATA SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* VIDEO PLAYER (Left 2 cols) */}
              <div className="lg:col-span-2 space-y-3">
                <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative flex items-center justify-center">
                  {selectedVideo.video_url ? (
                    <video
                      controls
                      poster={selectedVideo.thumbnail_url}
                      src={selectedVideo.video_url}
                      className="w-full h-full object-contain"
                    >
                      {selectedVideo.captions_storage_key && (
                        <track
                          kind="subtitles"
                          src={`/assets/${selectedVideo.captions_storage_key}`}
                          label="English"
                          default
                        />
                      )}
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-center p-8 space-y-3">
                      <div className="text-4xl">🎬</div>
                      <div className="text-sm font-semibold text-slate-400">No Rendered Video Yet</div>
                      <div className="text-xs text-slate-600 max-w-sm">
                        This approved video plan is waiting for scene composition and narration rendering.
                      </div>
                      <button
                        onClick={handleStartGeneration}
                        disabled={actionLoading || generating}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                      >
                        Start Video Generation
                      </button>
                    </div>
                  )}
                </div>

                {/* Subtitle / Captions Snippet */}
                {selectedVideo.captions_srt && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>💬 Captions / Subtitles (SRT)</span>
                      <span className="text-slate-500">Auto-Generated</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {selectedVideo.captions_srt}
                    </pre>
                  </div>
                )}
              </div>

              {/* METADATA CARDS (Right 1 col) */}
              <div className="space-y-4">
                {/* Status Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Generation Status
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Video Plan:</span>
                      <span className="font-semibold text-emerald-400">
                        {(selectedVideo as any).video_plan_status || (selectedVideo.status === 'REVIEW' && selectedVideo.render_status === 'NOT_STARTED' ? 'PENDING' : 'APPROVED')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Script Status:</span>
                      <span className={`font-semibold ${selectedVideo.script_status === 'SCRIPT_APPROVED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedVideo.script_status || 'NOT_GENERATED'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Render Status:</span>
                      <span className={`font-semibold ${selectedVideo.render_status === 'RENDERED' ? 'text-emerald-400' : selectedVideo.render_status === 'FAILED' ? 'text-red-400' : 'text-amber-400'}`}>
                        {selectedVideo.render_status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Learning Status:</span>
                      <span className={`font-semibold ${
                        selectedVideo.status === 'PUBLISHED' && isRenderedValid
                          ? 'text-emerald-400'
                          : canPublish
                          ? 'text-indigo-400'
                          : 'text-blue-400'
                      }`}>
                        {selectedVideo.status === 'PUBLISHED' && isRenderedValid
                          ? 'PUBLISHED'
                          : canPublish
                          ? 'READY FOR PUBLISH'
                          : selectedVideo.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Version:</span>
                      <span className="font-mono text-slate-300">v{selectedVideo.version_number}</span>
                    </div>
                  </div>
                </div>

                {/* Duration & Engines */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Audio & Engine Details
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scene Count:</span>
                      <span className="font-mono font-semibold text-indigo-300">
                        {selectedVideo.scenes?.length || 0} scenes
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Duration:</span>
                      <span className="font-mono text-slate-300">{formatSec(selectedVideo.approved_duration_seconds)} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Actual Duration:</span>
                      <span className={`font-mono font-semibold ${(selectedVideo.actual_duration_seconds || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {formatSec(selectedVideo.actual_duration_seconds)} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">TTS Engine:</span>
                      <span className="text-indigo-300">{selectedVideo.tts_engine || 'deterministic'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Renderer:</span>
                      <span className="text-indigo-300">{selectedVideo.render_engine ? `${selectedVideo.render_engine} 720p HD` : 'FFmpeg 720p HD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Storage / File Status:</span>
                      <span className={`font-semibold ${isPlaceholder ? 'text-amber-400' : selectedVideo.video_storage_key ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {isPlaceholder ? '⚠️ Placeholder (Needs Render)' : selectedVideo.video_storage_key ? '✓ Valid Rendered MP4' : 'No Output File'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Source Traceability:</span>
                      <span className="text-slate-300">
                        {selectedVideo.source_page_start != null ? `Pages ${selectedVideo.source_page_start}–${selectedVideo.source_page_end || selectedVideo.source_page_start}` : 'Curriculum Spec'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Narration Quality & Audio Metrics (Build 8.4.1 & 8.4.2) */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Narration & Neural Audio</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      selectedVideo.voice_quality === 'NEURAL' || (selectedVideo.tts_engine && (selectedVideo.tts_engine.includes('neural') || selectedVideo.tts_engine.includes('elevenlabs')))
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {selectedVideo.voice_quality || (selectedVideo.tts_engine && (selectedVideo.tts_engine.includes('neural') || selectedVideo.tts_engine.includes('elevenlabs')) ? 'NEURAL' : 'FALLBACK')}
                    </span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">TTS Provider:</span>
                      <span className="font-semibold text-indigo-300">
                        {selectedVideo.tts_provider || (selectedVideo.tts_engine?.includes('elevenlabs') ? 'ElevenLabs' : selectedVideo.tts_engine?.includes('neural') ? 'Neural TTS' : 'Local Fallback')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Voice:</span>
                      <span className="font-mono text-slate-200">
                        {selectedVideo.voice || 'en-US-AndrewNeural'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Voice Quality:</span>
                      <span className={`font-semibold ${
                        selectedVideo.voice_quality === 'NEURAL' || (selectedVideo.tts_engine && (selectedVideo.tts_engine.includes('neural') || selectedVideo.tts_engine.includes('elevenlabs')))
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {selectedVideo.voice_quality || (selectedVideo.tts_engine && (selectedVideo.tts_engine.includes('neural') || selectedVideo.tts_engine.includes('elevenlabs')) ? 'NEURAL' : 'FALLBACK')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Speaking Rate:</span>
                      <span className="font-mono text-slate-300">
                        {selectedVideo.speaking_rate || '140 WPM'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audio Quality:</span>
                      <span className="font-semibold text-emerald-400">
                        {selectedVideo.audio_quality || 'PASS'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scenes with Narration:</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {selectedVideo.scenes?.filter(s => s.narration_text && s.narration_text.trim().length > 0).length || 0} / {selectedVideo.scenes?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audio Duration:</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {formatSec(selectedVideo.actual_duration_seconds)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Narration Coverage:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {selectedVideo.scenes && selectedVideo.scenes.length > 0
                          ? `${Math.round((selectedVideo.scenes.filter(s => s.narration_text && s.narration_text.trim().length > 0).length / selectedVideo.scenes.length) * 100)}%`
                          : '100%'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thumbnail Card */}
                {selectedVideo.thumbnail_url && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Video Thumbnail
                    </h3>
                    <img
                      src={selectedVideo.thumbnail_url}
                      alt="Thumbnail"
                      className="w-full aspect-video object-cover rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SCENES BREAKDOWN */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Educational Scenes Breakdown</h3>
                  <p className="text-xs text-slate-400">
                    Individual timed scene components composed with visual cue slides and narration.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                  {selectedVideo.scenes?.length || 0} Scenes Total
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedVideo.scenes && selectedVideo.scenes.length > 0 ? (
                  selectedVideo.scenes.map((scene) => (
                    <div
                      key={scene.scene_number}
                      onClick={() => setSelectedScene(scene)}
                      className="bg-slate-900/50 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-4 cursor-pointer transition space-y-2.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            SCENE {String(scene.scene_number).padStart(2, '0')} • {scene.section_type}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            ⏱ {scene.estimated_duration_seconds}s
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{scene.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-3 mt-1 leading-relaxed">
                          {scene.narration_text}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-slate-300">
                          {scene.visual_type}
                        </span>
                        <span>
                          {formatSec(scene.start_time_seconds)} → {formatSec(scene.end_time_seconds)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 p-8 text-center text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                    No scenes generated yet. Generate the video to compile scene definitions.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Select a video from the sidebar to inspect and review.
          </div>
        )}
      </div>

      {/* REGENERATION CONFIRMATION MODAL */}
      {showRegenModal && selectedVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚠️</span> Confirm Video Regeneration
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Regenerating video for <strong className="text-white">"{selectedVideo.title}"</strong> will synthesize new narration audio and compose a new MP4 video.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1 text-slate-400">
              <div>• Current Version: <span className="text-slate-200 font-mono">v{selectedVideo.version_number}</span></div>
              <div>• Previous version will be archived as <span className="text-amber-400 font-mono">SUPERSEDED</span>.</div>
              <div>• Status will reset to <span className="text-indigo-400 font-mono">REVIEW</span> until approved again.</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRegenModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-indigo-600/30"
              >
                Confirm Regeneration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCENE DETAIL MODAL */}
      {selectedScene && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                  SCENE {String(selectedScene.scene_number).padStart(2, '0')}
                </span>
                <h3 className="text-base font-bold text-white">{selectedScene.title}</h3>
              </div>
              <button onClick={() => setSelectedScene(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Narration Script
                </span>
                <p className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-200 leading-relaxed">
                  {selectedScene.narration_text}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Visual Type</span>
                  <span className="font-semibold text-indigo-300">{selectedScene.visual_type}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Estimated Duration</span>
                  <span className="font-semibold text-emerald-300">{selectedScene.estimated_duration_seconds}s</span>
                </div>
              </div>

              {selectedScene.formula && (
                <div>
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                    Mathematical Formula
                  </span>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-amber-500/30 font-mono text-amber-300">
                    {selectedScene.formula}
                  </div>
                </div>
              )}

              {selectedScene.on_screen_text && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    On-Screen Text
                  </span>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-line">
                    {selectedScene.on_screen_text}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedScene(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
