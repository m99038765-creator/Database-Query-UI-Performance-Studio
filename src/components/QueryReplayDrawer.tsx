import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Sparkles,
  Zap,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  TrendingDown,
  Layers,
  Cpu,
  Monitor,
  Search,
  Trash2,
  Download,
  UploadCloud,
  X,
  PlayCircle,
  Plus,
  Sliders,
  Check,
  ArrowRight,
  Info,
  Database
} from 'lucide-react';
import {
  QueryReplayStep,
  QueryReplaySequence,
  OptimizationFlags,
  TransactionRecord
} from '../types';

export const REPLAY_SEQUENCES_STORAGE_KEY = 'perf_query_replay_sequences_v1';

export const PRESET_REPLAY_SEQUENCES: QueryReplaySequence[] = [
  {
    id: 'seq-degradation-benchmark',
    title: 'Workload Degradation Benchmark (Prefix ➔ Broad Scan)',
    description: 'Traces progressive performance collapse from indexed single-record lookup to high-contention unindexed wildcard heap scan.',
    createdAt: Date.now() - 1000 * 60 * 30,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        query: 'ORD-8492',
        timestamp: Date.now() - 24000,
        timeOffsetMs: 0,
        executionLatencyMs: 1.4,
        baselineLatencyMs: 1.2,
        latencyDeltaPercent: 0,
        rowsMatched: 1,
        totalRowsScanned: 1,
        memoryUsageMb: 1.2,
        cpuContentionPercent: 4,
        indexUsed: true,
        indexName: 'idx_transactions_order_num',
        domRenderTimeMs: 0.8,
        fps: 60,
        virtualizationActive: true,
        deferredRenderingActive: true,
        renderMode: 'virtualized',
        uiResponsiveness: 'fluid',
        degradationSeverity: 'none',
        degradationCause: 'Optimal B-Tree primary key seek. Zero page contention and O(1) single-row windowed paint.'
      },
      {
        id: 'step-2',
        stepNumber: 2,
        query: 'Platinum',
        timestamp: Date.now() - 18000,
        timeOffsetMs: 2500,
        executionLatencyMs: 14.8,
        baselineLatencyMs: 2.0,
        latencyDeltaPercent: 640,
        rowsMatched: 4200,
        totalRowsScanned: 5000,
        memoryUsageMb: 4.8,
        cpuContentionPercent: 18,
        indexUsed: true,
        indexName: 'idx_customers_tier',
        domRenderTimeMs: 2.4,
        fps: 58,
        virtualizationActive: true,
        deferredRenderingActive: true,
        renderMode: 'virtualized',
        uiResponsiveness: 'fluid',
        degradationSeverity: 'none',
        degradationCause: 'Indexed secondary lookup on tier. Scanned 4.2k items; Virtualized DOM keeps main thread layout cost <3ms.'
      },
      {
        id: 'step-3',
        stepNumber: 3,
        query: 'Enterprise License',
        timestamp: Date.now() - 12000,
        timeOffsetMs: 5000,
        executionLatencyMs: 58.6,
        baselineLatencyMs: 4.0,
        latencyDeltaPercent: 1365,
        rowsMatched: 11200,
        totalRowsScanned: 24000,
        memoryUsageMb: 14.2,
        cpuContentionPercent: 44,
        indexUsed: false,
        domRenderTimeMs: 9.8,
        fps: 46,
        virtualizationActive: true,
        deferredRenderingActive: true,
        renderMode: 'virtualized',
        uiResponsiveness: 'sluggish',
        degradationSeverity: 'moderate',
        degradationCause: 'Category string scan without covering index. Heap traversal inspects 24k records; frame rate dips to 46 FPS.'
      },
      {
        id: 'step-4',
        stepNumber: 4,
        query: 'failed',
        timestamp: Date.now() - 6000,
        timeOffsetMs: 7500,
        executionLatencyMs: 154.0,
        baselineLatencyMs: 5.0,
        latencyDeltaPercent: 2980,
        rowsMatched: 14800,
        totalRowsScanned: 48000,
        memoryUsageMb: 32.5,
        cpuContentionPercent: 68,
        indexUsed: false,
        domRenderTimeMs: 28.5,
        fps: 26,
        virtualizationActive: true,
        deferredRenderingActive: false,
        renderMode: 'synchronous_blocking',
        uiResponsiveness: 'sluggish',
        degradationSeverity: 'moderate',
        degradationCause: 'Wide status scan with complex join resolution. High GC pressure and synchronous string parsing stall worker pool.'
      },
      {
        id: 'step-5',
        stepNumber: 5,
        query: 'corp.com',
        timestamp: Date.now(),
        timeOffsetMs: 10000,
        executionLatencyMs: 382.5,
        baselineLatencyMs: 6.0,
        latencyDeltaPercent: 6275,
        rowsMatched: 29400,
        totalRowsScanned: 50000,
        memoryUsageMb: 78.4,
        cpuContentionPercent: 89,
        indexUsed: false,
        domRenderTimeMs: 84.0,
        fps: 12,
        virtualizationActive: false,
        deferredRenderingActive: false,
        renderMode: 'synchronous_blocking',
        uiResponsiveness: 'frozen',
        degradationSeverity: 'critical',
        degradationCause: 'Severe unindexed substring regex across entire 50,000 table. Main thread blocked for 84ms, UI drops to 12 FPS.'
      }
    ]
  },
  {
    id: 'seq-cache-thrashing',
    title: 'Cache Thrashing & High-Contention Scans',
    description: 'Demonstrates memory pressure escalation as concurrent multi-term searches exhaust shared buffer pages.',
    createdAt: Date.now() - 1000 * 60 * 120,
    steps: [
      {
        id: 'thrash-1',
        stepNumber: 1,
        query: 'completed',
        timestamp: Date.now() - 15000,
        timeOffsetMs: 0,
        executionLatencyMs: 3.2,
        baselineLatencyMs: 2.0,
        latencyDeltaPercent: 60,
        rowsMatched: 18500,
        totalRowsScanned: 18500,
        memoryUsageMb: 2.4,
        cpuContentionPercent: 8,
        indexUsed: true,
        indexName: 'idx_orders_status',
        domRenderTimeMs: 1.2,
        fps: 60,
        virtualizationActive: true,
        deferredRenderingActive: true,
        renderMode: 'virtualized',
        uiResponsiveness: 'fluid',
        degradationSeverity: 'none',
        degradationCause: 'Hot index scan in buffer cache. Zero disk reads; instantaneous layout paint.'
      },
      {
        id: 'thrash-2',
        stepNumber: 2,
        query: 'Security Audit',
        timestamp: Date.now() - 10000,
        timeOffsetMs: 3000,
        executionLatencyMs: 42.0,
        baselineLatencyMs: 3.5,
        latencyDeltaPercent: 1100,
        rowsMatched: 8900,
        totalRowsScanned: 32000,
        memoryUsageMb: 12.8,
        cpuContentionPercent: 32,
        indexUsed: false,
        domRenderTimeMs: 6.4,
        fps: 52,
        virtualizationActive: true,
        deferredRenderingActive: true,
        renderMode: 'virtualized',
        uiResponsiveness: 'fluid',
        degradationSeverity: 'none',
        degradationCause: 'Category scan with partial cache miss. Evicts 420 buffer pages to load secondary heap table blocks.'
      },
      {
        id: 'thrash-3',
        stepNumber: 3,
        query: 'amount > 500',
        timestamp: Date.now() - 5000,
        timeOffsetMs: 6000,
        executionLatencyMs: 188.0,
        baselineLatencyMs: 4.0,
        latencyDeltaPercent: 4600,
        rowsMatched: 16400,
        totalRowsScanned: 50000,
        memoryUsageMb: 48.0,
        cpuContentionPercent: 74,
        indexUsed: false,
        domRenderTimeMs: 34.0,
        fps: 22,
        virtualizationActive: true,
        deferredRenderingActive: false,
        renderMode: 'synchronous_blocking',
        uiResponsiveness: 'sluggish',
        degradationSeverity: 'moderate',
        degradationCause: 'Unindexed numerical comparison requires full table scan plus memory sort buffer allocation.'
      },
      {
        id: 'thrash-4',
        stepNumber: 4,
        query: 'customer@',
        timestamp: Date.now(),
        timeOffsetMs: 9000,
        executionLatencyMs: 410.0,
        baselineLatencyMs: 5.0,
        latencyDeltaPercent: 8100,
        rowsMatched: 36000,
        totalRowsScanned: 50000,
        memoryUsageMb: 92.0,
        cpuContentionPercent: 94,
        indexUsed: false,
        domRenderTimeMs: 98.0,
        fps: 10,
        virtualizationActive: false,
        deferredRenderingActive: false,
        renderMode: 'synchronous_blocking',
        uiResponsiveness: 'frozen',
        degradationSeverity: 'critical',
        degradationCause: 'Extreme thread pool starvation. 94% CPU saturation locks main UI rendering pipeline; 98ms frame stall.'
      }
    ]
  }
];

export const getStoredReplaySequences = (): QueryReplaySequence[] => {
  if (typeof window === 'undefined') return PRESET_REPLAY_SEQUENCES;
  try {
    const raw = localStorage.getItem(REPLAY_SEQUENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse replay sequences from localStorage', err);
  }
  return PRESET_REPLAY_SEQUENCES;
};

export interface QueryReplayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSearch: string;
  onApplyQuery: (query: string) => void;
  flags?: OptimizationFlags;
  records?: TransactionRecord[];
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordedSteps: QueryReplayStep[];
  onClearRecording: () => void;
  onAddRecordedStep?: (query: string) => void;
  activeSequence: QueryReplaySequence | null;
  onSelectSequence: (seq: QueryReplaySequence) => void;
  currentPlaybackStepIndex: number;
  onSeekStepIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
}

export const QueryReplayDrawer: React.FC<QueryReplayDrawerProps> = ({
  isOpen,
  onClose,
  currentSearch,
  onApplyQuery,
  flags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true
  },
  records = [],
  isRecording,
  onStartRecording,
  onStopRecording,
  recordedSteps,
  onClearRecording,
  onAddRecordedStep,
  activeSequence,
  onSelectSequence,
  currentPlaybackStepIndex,
  onSeekStepIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangePlaybackSpeed
}) => {
  const [sequences, setSequences] = useState<QueryReplaySequence[]>(getStoredReplaySequences);
  const [manualQueryInput, setManualQueryInput] = useState<string>('');
  const [saveSequenceTitle, setSaveSequenceTitle] = useState<string>('');
  const [isSavingSequence, setIsSavingSequence] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync sequences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(REPLAY_SEQUENCES_STORAGE_KEY, JSON.stringify(sequences));
    } catch (e) {
      console.warn('Failed to save replay sequences to localStorage', e);
    }
  }, [sequences]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const currentSteps = useMemo(() => {
    if (isRecording && recordedSteps.length > 0) {
      return recordedSteps;
    }
    return activeSequence?.steps || [];
  }, [isRecording, recordedSteps, activeSequence]);

  const activeStep = useMemo(() => {
    if (currentSteps.length === 0) return null;
    const idx = Math.min(Math.max(0, currentPlaybackStepIndex), currentSteps.length - 1);
    return currentSteps[idx] || null;
  }, [currentSteps, currentPlaybackStepIndex]);

  const maxStepLatency = useMemo(() => {
    if (currentSteps.length === 0) return 400;
    return Math.max(...currentSteps.map((s) => s.executionLatencyMs), 50);
  }, [currentSteps]);

  const handleStepJump = (idx: number) => {
    onSeekStepIndex(idx);
    if (currentSteps[idx]) {
      onApplyQuery(currentSteps[idx].query);
      setToastMessage(`Switched to Step ${idx + 1}: "${currentSteps[idx].query}"`);
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const handleManualAddStep = () => {
    const q = manualQueryInput.trim();
    if (!q) return;
    if (onAddRecordedStep) {
      onAddRecordedStep(q);
      setManualQueryInput('');
      setToastMessage(`Added step "${q}" to sequence`);
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const handleSaveRecordedSequence = () => {
    if (recordedSteps.length === 0) return;
    const title = saveSequenceTitle.trim() || `Recorded Replay ${new Date().toLocaleTimeString()}`;
    const newSeq: QueryReplaySequence = {
      id: `seq-custom-${Date.now()}`,
      title,
      description: `Custom sequence of ${recordedSteps.length} recorded queries with captured latency and rendering telemetry.`,
      createdAt: Date.now(),
      steps: [...recordedSteps]
    };
    setSequences((prev) => [newSeq, ...prev]);
    onSelectSequence(newSeq);
    setIsSavingSequence(false);
    setSaveSequenceTitle('');
    onStopRecording();
    setToastMessage(`Saved sequence: "${title}" (${recordedSteps.length} steps)`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteSequence = (seqId: string) => {
    setSequences((prev) => prev.filter((s) => s.id !== seqId));
    if (activeSequence?.id === seqId) {
      onSelectSequence(PRESET_REPLAY_SEQUENCES[0]);
    }
  };

  const getSeverityBadge = (severity: 'none' | 'moderate' | 'critical') => {
    switch (severity) {
      case 'none':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Optimal (&lt;50ms)
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Degraded (50–150ms)
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            Severe (&gt;150ms)
          </span>
        );
    }
  };

  const getResponsivenessBadge = (resp: 'fluid' | 'sluggish' | 'frozen') => {
    switch (resp) {
      case 'fluid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Zap className="w-3 h-3 text-emerald-600" /> Fluid 60 FPS
          </span>
        );
      case 'sluggish':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Sluggish (20–45 FPS)
          </span>
        );
      case 'frozen':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> Main Thread Stalled
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="query-replay-drawer-container"
      data-testid="query-replay-drawer-container"
      className="fixed inset-0 z-50 overflow-hidden animate-fadeIn"
      aria-labelledby="query-replay-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl bg-white border-l border-zinc-200 shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:px-6 bg-gradient-to-r from-zinc-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between border-b border-indigo-900/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/80 text-white shadow-inner">
                <PlayCircle className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="query-replay-drawer-title" className="font-bold text-sm sm:text-base">
                    Query Replay &amp; Degradation Analyzer
                  </h3>
                  {isRecording && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      REC LIVE ({recordedSteps.length})
                    </span>
                  )}
                  {isPlaying && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500 text-white">
                      <Play className="w-2.5 h-2.5 fill-current" />
                      PLAYING ({playbackSpeed}x)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Record search queries and playback execution performance and UI rendering states step-by-step.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-query-replay-drawer"
              data-testid="btn-close-query-replay-drawer"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close query replay drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between shadow-xs animate-fadeIn shrink-0">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-emerald-200 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Drawer Body Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-zinc-900 bg-zinc-50/50">
            {/* Top Sequence Selector & Recording Controls */}
            <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Active Query Sequence:</span>
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Start / Stop Recording Toggle */}
                  {!isRecording ? (
                    <button
                      type="button"
                      id="btn-start-recording-replay"
                      data-testid="btn-start-recording-replay"
                      onClick={onStartRecording}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white inline-block animate-pulse" />
                      <span>Record Searches</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        id="btn-stop-recording-replay"
                        data-testid="btn-stop-recording-replay"
                        onClick={onStopRecording}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                        <span>Stop Recording ({recordedSteps.length})</span>
                      </button>

                      {recordedSteps.length > 0 && (
                        <button
                          type="button"
                          id="btn-save-recorded-sequence"
                          data-testid="btn-save-recorded-sequence"
                          onClick={() => setIsSavingSequence(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Sequence</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Clear Recording */}
                  {isRecording && recordedSteps.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearRecording}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Clear recorded steps"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Save Sequence Form (if saving) */}
              {isSavingSequence && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2 animate-fadeIn">
                  <div className="text-xs font-bold text-indigo-950">Name this Recorded Sequence:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={saveSequenceTitle}
                      onChange={(e) => setSaveSequenceTitle(e.target.value)}
                      placeholder="e.g. Substring Regex Stress Test"
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRecordedSequence}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSavingSequence(false)}
                      className="px-2.5 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs rounded-lg hover:bg-zinc-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preset / Saved Sequence Selector Tabs */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-zinc-500 flex items-center justify-between">
                  <span>Available Sequences:</span>
                  <span className="text-[10px] text-zinc-400">{sequences.length} total profiles</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sequences.map((seq) => {
                    const isSelected = activeSequence?.id === seq.id && !isRecording;
                    return (
                      <div
                        key={seq.id}
                        id={`btn-select-seq-${seq.id}`}
                        data-testid={`btn-select-seq-${seq.id}`}
                        onClick={() => {
                          onSelectSequence(seq);
                          onSeekStepIndex(0);
                          if (seq.steps[0]) {
                            onApplyQuery(seq.steps[0].query);
                          }
                          setToastMessage(`Loaded: ${seq.title}`);
                          setTimeout(() => setToastMessage(null), 2000);
                        }}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-2xs'
                            : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-zinc-800'}`}>
                            {seq.title}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-white border border-zinc-200 text-zinc-600 shrink-0">
                            {seq.steps.length} steps
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                          {seq.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* While recording: manual step addition bar */}
              {isRecording && (
                <div className="pt-2 border-t border-zinc-100 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={manualQueryInput}
                      onChange={(e) => setManualQueryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualAddStep();
                      }}
                      placeholder="Add query step to sequence (e.g. category: Cloud)..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualAddStep}
                    disabled={!manualQueryInput.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>
              )}
            </div>

            {/* Playback Controls & Scrubber Card */}
            {currentSteps.length > 0 && (
              <div
                id="query-replay-playback-controller"
                data-testid="query-replay-playback-controller"
                className="p-3.5 bg-white rounded-xl border border-indigo-200/90 shadow-2xs space-y-3"
              >
                {/* Control Transport Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Reset to Start */}
                    <button
                      type="button"
                      id="btn-replay-reset"
                      data-testid="btn-replay-reset"
                      onClick={() => handleStepJump(0)}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-colors"
                      title="Reset to step 1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Step Previous */}
                    <button
                      type="button"
                      id="btn-replay-step-prev"
                      data-testid="btn-replay-step-prev"
                      onClick={() => handleStepJump(Math.max(0, currentPlaybackStepIndex - 1))}
                      disabled={currentPlaybackStepIndex <= 0}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer transition-colors"
                      title="Previous step (⬅)"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    {/* Play / Pause Toggle */}
                    <button
                      type="button"
                      id="btn-replay-toggle-play"
                      data-testid="btn-replay-toggle-play"
                      onClick={onTogglePlay}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs text-white transition-all shadow-xs cursor-pointer ${
                        isPlaying
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                      title={isPlaying ? 'Pause playback' : 'Play sequence automatically'}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Playback</span>
                        </>
                      )}
                    </button>

                    {/* Step Next */}
                    <button
                      type="button"
                      id="btn-replay-step-next"
                      data-testid="btn-replay-step-next"
                      onClick={() => handleStepJump(Math.min(currentSteps.length - 1, currentPlaybackStepIndex + 1))}
                      disabled={currentPlaybackStepIndex >= currentSteps.length - 1}
                      className="p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer transition-colors"
                      title="Next step (➔)"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>

                    {/* Step Counter Indicator */}
                    <span className="font-mono text-xs font-bold text-zinc-700 ml-1">
                      Step {currentPlaybackStepIndex + 1} / {currentSteps.length}
                    </span>
                  </div>

                  {/* Playback Speed Selector */}
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-zinc-400 font-medium">Speed:</span>
                    {[0.5, 1.0, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        id={`btn-replay-speed-${spd}x`}
                        data-testid={`btn-replay-speed-${spd}x`}
                        onClick={() => onChangePlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-all ${
                          playbackSpeed === spd
                            ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrubber Step Buttons */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Sequence Scrubber:</span>
                    <span>Click any step to inspect &amp; apply</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5">
                    {currentSteps.map((step, idx) => {
                      const isCur = idx === currentPlaybackStepIndex;
                      const isPassed = idx < currentPlaybackStepIndex;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          id={`btn-scrub-step-${idx}`}
                          data-testid={`btn-scrub-step-${idx}`}
                          onClick={() => handleStepJump(idx)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                            isCur
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                              : step.degradationSeverity === 'critical'
                              ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-300 text-rose-950'
                              : step.degradationSeverity === 'moderate'
                              ? 'bg-amber-50 hover:bg-amber-100/80 border-amber-300 text-amber-950'
                              : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className={`text-[9px] font-mono font-bold ${isCur ? 'text-indigo-200' : 'text-zinc-500'}`}>
                              {step.executionLatencyMs.toFixed(1)}ms
                            </span>
                          </div>
                          <div className="font-mono text-[11px] truncate font-semibold mt-0.5">
                            "{step.query}"
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Active Step Detailed Telemetry & Degradation Breakdown */}
            {activeStep ? (
              <div
                id="query-replay-step-telemetry-card"
                data-testid="query-replay-step-telemetry-card"
                className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3.5"
              >
                {/* Active Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                      Step #{activeStep.stepNumber}
                    </span>
                    <span className="font-mono font-bold text-sm text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-lg border border-zinc-200">
                      "{activeStep.query}"
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getSeverityBadge(activeStep.degradationSeverity)}
                    {getResponsivenessBadge(activeStep.uiResponsiveness)}
                    <button
                      type="button"
                      id="btn-re-apply-step-query"
                      data-testid="btn-re-apply-step-query"
                      onClick={() => {
                        onApplyQuery(activeStep.query);
                        setToastMessage(`Re-applied query "${activeStep.query}" to table`);
                        setTimeout(() => setToastMessage(null), 2000);
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-semibold cursor-pointer transition-colors"
                      title="Execute query in VirtualizedTable immediately"
                    >
                      Re-apply to Table
                    </button>
                  </div>
                </div>

                {/* Performance Metrics vs UI Rendering States Split Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Left Column: Database Execution Performance */}
                  <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-200/60 pb-1.5">
                      <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Execution Performance</span>
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">Database Engine</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Query Latency</span>
                        <span className={`text-sm font-extrabold ${
                          activeStep.executionLatencyMs > 150 ? 'text-rose-600' : activeStep.executionLatencyMs > 50 ? 'text-amber-600' : 'text-emerald-700'
                        }`}>
                          {activeStep.executionLatencyMs.toFixed(1)} ms
                        </span>
                        {activeStep.latencyDeltaPercent > 0 && (
                          <span className="text-[9px] text-rose-600 font-bold block">
                            +{activeStep.latencyDeltaPercent}% vs base
                          </span>
                        )}
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Selectivity</span>
                        <span className="text-sm font-extrabold text-zinc-900">
                          {activeStep.rowsMatched.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          of {activeStep.totalRowsScanned.toLocaleString()} scanned
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Index Scan Mode</span>
                        <span className="text-xs font-bold text-zinc-900 block truncate">
                          {activeStep.indexUsed ? activeStep.indexName || 'B-Tree Seek' : 'Sequential Scan'}
                        </span>
                        <span className={`text-[9px] font-semibold ${activeStep.indexUsed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {activeStep.indexUsed ? 'Indexed O(log n)' : 'Full Heap Scan O(n)'}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Memory Footprint</span>
                        <span className="text-sm font-extrabold text-zinc-900">
                          {activeStep.memoryUsageMb.toFixed(1)} MB
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          CPU: {activeStep.cpuContentionPercent}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: UI Rendering Pipeline States */}
                  <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-200/60 pb-1.5">
                      <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-purple-600" />
                        <span>UI Rendering State</span>
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">DOM Pipeline</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">DOM Render Time</span>
                        <span className={`text-sm font-extrabold ${
                          activeStep.domRenderTimeMs > 40 ? 'text-rose-600' : activeStep.domRenderTimeMs > 15 ? 'text-amber-600' : 'text-emerald-700'
                        }`}>
                          {activeStep.domRenderTimeMs.toFixed(1)} ms
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          Main thread paint
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Frame Rate</span>
                        <span className={`text-sm font-extrabold ${
                          activeStep.fps < 20 ? 'text-rose-600' : activeStep.fps < 45 ? 'text-amber-600' : 'text-emerald-700'
                        }`}>
                          {activeStep.fps} FPS
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          Smoothness rating
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">DOM Virtualization</span>
                        <span className="text-xs font-bold text-zinc-900 block">
                          {activeStep.virtualizationActive ? '12 Nodes Window' : 'Full DOM (50k)'}
                        </span>
                        <span className={`text-[9px] font-semibold ${activeStep.virtualizationActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {activeStep.virtualizationActive ? 'Windowing Active' : 'DOM Flooding'}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-lg border border-zinc-200/80">
                        <span className="text-zinc-400 block text-[9px] uppercase">Deferred Render</span>
                        <span className="text-xs font-bold text-zinc-900 block">
                          {activeStep.deferredRenderingActive ? 'Concurrent Non-blocking' : 'Sync Blocking'}
                        </span>
                        <span className={`text-[9px] font-semibold ${activeStep.deferredRenderingActive ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {activeStep.deferredRenderingActive ? 'Concurrent React' : 'Main Thread Stall'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Degradation Root-Cause Analysis Box */}
                {activeStep.degradationCause && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                    activeStep.degradationSeverity === 'critical'
                      ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                      : activeStep.degradationSeverity === 'moderate'
                      ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      <TrendingDown className={`w-3.5 h-3.5 ${
                        activeStep.degradationSeverity === 'critical'
                          ? 'text-rose-600'
                          : activeStep.degradationSeverity === 'moderate'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`} />
                      <span>Degradation Diagnosis &amp; Root Cause:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {activeStep.degradationCause}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-400 bg-white rounded-xl border border-zinc-200 p-6">
                <PlayCircle className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                <div className="text-xs font-semibold text-zinc-600">No replay steps loaded</div>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                  Click 'Record Searches' to record your interactions, or select a preset sequence above to begin analyzing degradation step-by-step.
                </p>
              </div>
            )}

            {/* Sequence Degradation Trajectory Visualizer */}
            {currentSteps.length > 1 && (
              <div className="p-3.5 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Degradation Trajectory (Latency vs Render Delay)</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Max: {maxStepLatency.toFixed(1)}ms
                  </span>
                </div>

                {/* SVG Visualizer */}
                <div className="relative w-full aspect-[400/90] bg-zinc-50 rounded-lg p-2 border border-zinc-200/80">
                  <svg viewBox="0 0 400 90" className="w-full h-full">
                    {/* Baseline dashed line */}
                    <line x1="20" y1="75" x2="380" y2="75" stroke="#cbd5e1" strokeDasharray="3,3" strokeWidth="1" />
                    <text x="22" y="72" className="text-[8px] fill-zinc-400 font-mono">Baseline (~2ms)</text>

                    {/* Step Bars & Line */}
                    {currentSteps.map((step, idx) => {
                      const barWidth = 24;
                      const x = 30 + (idx / (currentSteps.length - 1 || 1)) * 320;
                      const barHeight = Math.max(4, (step.executionLatencyMs / maxStepLatency) * 65);
                      const y = 80 - barHeight;
                      const isCur = idx === currentPlaybackStepIndex;

                      return (
                        <g key={step.id} className="cursor-pointer" onClick={() => handleStepJump(idx)}>
                          <rect
                            x={x - barWidth / 2}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="3"
                            fill={
                              isCur
                                ? '#4f46e5'
                                : step.degradationSeverity === 'critical'
                                ? '#f43f5e'
                                : step.degradationSeverity === 'moderate'
                                ? '#f59e0b'
                                : '#10b981'
                            }
                            opacity={isCur ? 1 : 0.75}
                          />
                          <text
                            x={x}
                            y={88}
                            textAnchor="middle"
                            className={`text-[8px] font-mono ${isCur ? 'fill-indigo-950 font-bold' : 'fill-zinc-500'}`}
                          >
                            #{idx + 1}
                          </text>
                          <text
                            x={x}
                            y={y - 3}
                            textAnchor="middle"
                            className={`text-[8px] font-mono font-bold ${
                              isCur ? 'fill-indigo-950' : 'fill-zinc-600'
                            }`}
                          >
                            {step.executionLatencyMs.toFixed(0)}m
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Controls */}
          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-zinc-500">
              Query Replay Telemetry • Press <kbd className="px-1 py-0.5 bg-zinc-200 rounded font-mono text-[10px]">Esc</kbd> to close
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
            >
              Close Analyzer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
