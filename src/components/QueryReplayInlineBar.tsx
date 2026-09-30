import React, { useState } from 'react';
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
  AlertOctagon,
  CheckCircle2,
  Database,
  Layers,
  Cpu,
  Monitor,
  Search,
  ChevronDown,
  ChevronUp,
  Sliders,
  Repeat,
  Save,
  Trash2,
  Plus,
  ExternalLink
} from 'lucide-react';
import { QueryReplayStep, QueryReplaySequence } from '../types';

export interface QueryReplayInlineBarProps {
  sequences: QueryReplaySequence[];
  activeSequence: QueryReplaySequence | null;
  onSelectSequence: (seq: QueryReplaySequence) => void;
  currentSteps: QueryReplayStep[];
  activeStep: QueryReplayStep | null;
  currentPlaybackIndex: number;
  onSeekStep: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onResetStep: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  recordedCount: number;
  onSaveRecording: (title: string) => void;
  onClearRecording: () => void;
  currentSearchTerm: string;
  onAddCurrentSearchToRecording?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenFullDrawer: () => void;
}

export const QueryReplayInlineBar: React.FC<QueryReplayInlineBarProps> = ({
  sequences,
  activeSequence,
  onSelectSequence,
  currentSteps,
  activeStep,
  currentPlaybackIndex,
  onSeekStep,
  isPlaying,
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onResetStep,
  playbackSpeed,
  onChangeSpeed,
  isLooping,
  onToggleLoop,
  isRecording,
  onToggleRecord,
  recordedCount,
  onSaveRecording,
  onClearRecording,
  currentSearchTerm,
  onAddCurrentSearchToRecording,
  isCollapsed,
  onToggleCollapse,
  onOpenFullDrawer
}) => {
  const [saveTitleInput, setSaveTitleInput] = useState('');
  const [isPromptingSave, setIsPromptingSave] = useState(false);

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = saveTitleInput.trim() || `Recorded Replay ${new Date().toLocaleTimeString()}`;
    onSaveRecording(title);
    setSaveTitleInput('');
    setIsPromptingSave(false);
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

  const getRenderModeBadge = (mode: 'virtualized' | 'synchronous_blocking' | 'deferred_concurrent') => {
    switch (mode) {
      case 'virtualized':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Layers className="w-3 h-3 text-indigo-600" /> Windowed Virtualized DOM O(1)
          </span>
        );
      case 'deferred_concurrent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" /> Concurrent Non-Blocking
          </span>
        );
      case 'synchronous_blocking':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Monitor className="w-3 h-3 text-rose-600" /> Synchronous Main-Thread Dump
          </span>
        );
    }
  };

  const maxLatency = Math.max(...currentSteps.map((s) => s.executionLatencyMs), 50);

  return (
    <div
      id="query-replay-inline-bar"
      data-testid="query-replay-inline-bar"
      className="border-b border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white shadow-xs transition-all"
    >
      {/* Top Bar Header & Transport Controls */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/60">
        {/* Left: Replay Status & Sequence Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-indigo-600/80 text-amber-300 shadow-inner">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Query Replay &amp; Degradation Analyzer</span>
              <span className="text-[10px] font-normal text-indigo-300 border border-indigo-800/80 rounded px-1.5 py-0.2 bg-indigo-900/40">
                Step-by-Step
              </span>
            </span>
          </div>

          {/* Sequence Dropdown */}
          <div className="flex items-center gap-1.5 ml-1">
            <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              id="replay-sequence-selector"
              data-testid="replay-sequence-selector"
              value={activeSequence?.id || ''}
              onChange={(e) => {
                const found = sequences.find((s) => s.id === e.target.value);
                if (found) onSelectSequence(found);
              }}
              className="bg-indigo-900/60 hover:bg-indigo-900 text-indigo-100 text-xs font-medium rounded-lg border border-indigo-700/60 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer max-w-[220px] truncate"
              title="Select a query replay sequence or benchmark"
            >
              {sequences.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                  {s.title} ({s.steps.length} steps)
                </option>
              ))}
            </select>
          </div>

          {/* Live Recording Indicator & Toggle */}
          {!isRecording ? (
            <button
              type="button"
              id="btn-replay-record-toggle"
              data-testid="btn-replay-record-toggle"
              onClick={onToggleRecord}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-semibold cursor-pointer shadow-2xs transition-all hover:scale-[1.02]"
              title="Record live searches typed into the table"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Record Searches</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-rose-950/80 border border-rose-600/80 px-2 py-0.5 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono font-bold text-rose-300">
                REC ({recordedCount} queries)
              </span>
              {currentSearchTerm && onAddCurrentSearchToRecording && (
                <button
                  type="button"
                  id="btn-replay-add-current-search"
                  data-testid="btn-replay-add-current-search"
                  onClick={onAddCurrentSearchToRecording}
                  className="ml-1 text-[11px] bg-rose-800 hover:bg-rose-700 text-white px-1.5 py-0.5 rounded cursor-pointer"
                  title={`Capture current search "${currentSearchTerm}"`}
                >
                  <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                  Add &quot;{currentSearchTerm}&quot;
                </button>
              )}
              <button
                type="button"
                id="btn-replay-stop-record"
                data-testid="btn-replay-stop-record"
                onClick={onToggleRecord}
                className="ml-1 text-[11px] bg-white text-rose-900 hover:bg-rose-100 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                title="Stop recording search queries"
              >
                Stop
              </button>
              {recordedCount > 0 && (
                <button
                  type="button"
                  id="btn-replay-save-sequence"
                  data-testid="btn-replay-save-sequence"
                  onClick={() => setIsPromptingSave(true)}
                  className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded cursor-pointer font-semibold"
                  title="Save recorded sequence for playback"
                >
                  Save Sequence
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Step Transport & Viewport Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Playback Transport Buttons */}
          <div className="flex items-center bg-indigo-900/50 rounded-lg p-0.5 border border-indigo-800/80 shadow-inner">
            <button
              type="button"
              id="btn-replay-reset-step"
              data-testid="btn-replay-reset-step"
              onClick={onResetStep}
              disabled={currentSteps.length === 0}
              className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-800/60 rounded disabled:opacity-40 cursor-pointer transition-colors"
              title="Reset to Step 1"
              aria-label="Reset to Step 1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="btn-replay-prev-step"
              data-testid="btn-replay-prev-step"
              onClick={onPrevStep}
              disabled={currentPlaybackIndex <= 0 || currentSteps.length === 0}
              className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-800/60 rounded disabled:opacity-40 cursor-pointer transition-colors"
              title="Previous Step"
              aria-label="Previous Step"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="btn-replay-play-pause"
              data-testid="btn-replay-play-pause"
              onClick={onTogglePlay}
              disabled={currentSteps.length === 0}
              className="px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-xs transition-all mx-0.5"
              title={isPlaying ? 'Pause Replay Playback' : 'Start Automatic Playback'}
              aria-label={isPlaying ? 'Pause Playback' : 'Play Sequence'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current text-amber-300" />
                  <span>Play</span>
                </>
              )}
            </button>
            <button
              type="button"
              id="btn-replay-next-step"
              data-testid="btn-replay-next-step"
              onClick={onNextStep}
              disabled={currentSteps.length === 0}
              className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-800/60 rounded disabled:opacity-40 cursor-pointer transition-colors"
              title="Next Step"
              aria-label="Next Step"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Loop Toggle */}
          <button
            type="button"
            id="btn-replay-loop-toggle"
            data-testid="btn-replay-loop-toggle"
            onClick={onToggleLoop}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              isLooping
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 ring-1 ring-amber-400/20'
                : 'bg-indigo-900/40 text-indigo-400 border-indigo-800/60 hover:text-white'
            }`}
            title={`Loop Playback: ${isLooping ? 'Enabled' : 'Disabled'}`}
            aria-label="Toggle loop playback"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Playback Speed Selector */}
          <select
            id="replay-speed-selector"
            data-testid="replay-speed-selector"
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
            className="bg-indigo-900/60 hover:bg-indigo-900 text-indigo-100 text-xs font-mono font-medium rounded-lg border border-indigo-700/60 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            title="Playback speed"
          >
            <option value="0.5" className="bg-zinc-900">0.5x</option>
            <option value="1.0" className="bg-zinc-900">1.0x</option>
            <option value="2.0" className="bg-zinc-900">2.0x</option>
            <option value="4.0" className="bg-zinc-900">4.0x</option>
          </select>

          {/* Open In-Depth Drawer Button */}
          <button
            type="button"
            id="btn-replay-open-drawer"
            data-testid="btn-replay-open-drawer"
            onClick={onOpenFullDrawer}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-700/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer border border-indigo-600/80 transition-all hover:scale-[1.02]"
            title="Open comprehensive Query Replay Drawer with sequence editor and full telemetry"
          >
            <ExternalLink className="w-3 h-3 text-indigo-300" />
            <span className="hidden sm:inline">Replay Drawer</span>
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            id="btn-replay-toggle-collapse"
            data-testid="btn-replay-toggle-collapse"
            onClick={onToggleCollapse}
            className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-800/60 rounded-lg border border-indigo-800/60 cursor-pointer transition-colors"
            title={isCollapsed ? 'Expand Replay Metrics & Degradation Panel' : 'Collapse Panel'}
            aria-label={isCollapsed ? 'Expand replay bar' : 'Collapse replay bar'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Save Sequence Modal Prompt */}
      {isPromptingSave && (
        <div className="px-4 py-2.5 bg-indigo-900/90 border-b border-indigo-700/60 flex items-center justify-between gap-3 text-xs animate-fadeIn">
          <form onSubmit={handleSaveSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
            <span className="font-semibold text-amber-300 shrink-0">Name Sequence:</span>
            <input
              type="text"
              id="input-save-replay-sequence-name"
              data-testid="input-save-replay-sequence-name"
              value={saveTitleInput}
              onChange={(e) => setSaveTitleInput(e.target.value)}
              placeholder={`Recorded Sequence (${recordedCount} searches)`}
              className="flex-1 bg-zinc-900 border border-indigo-600 rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              autoFocus
            />
            <button
              type="submit"
              id="btn-confirm-save-sequence"
              data-testid="btn-confirm-save-sequence"
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsPromptingSave(false)}
              className="px-2 py-1 text-zinc-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </form>
          <span className="text-[11px] text-zinc-300 hidden md:inline">
            Saves this sequence for repeatable regression testing.
          </span>
        </div>
      )}

      {/* Step Scrubber / Timeline Strip */}
      <div
        id="replay-step-scrubber"
        data-testid="replay-step-scrubber"
        className="px-4 py-2 bg-slate-950/70 border-b border-indigo-950 flex items-center gap-2 overflow-x-auto text-xs"
      >
        <span className="text-[11px] font-semibold text-indigo-400 shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3 text-indigo-400" />
          <span>Timeline Steps:</span>
        </span>

        {currentSteps.length === 0 ? (
          <span className="text-zinc-400 text-xs italic">
            No steps recorded. Type searches above or click &quot;Record Searches&quot; to begin.
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {currentSteps.map((step, idx) => {
              const isActive = idx === currentPlaybackIndex;
              const isPast = idx < currentPlaybackIndex;

              const dotColor =
                step.degradationSeverity === 'critical'
                  ? 'bg-rose-500 ring-rose-400/50'
                  : step.degradationSeverity === 'moderate'
                  ? 'bg-amber-400 ring-amber-400/50'
                  : 'bg-emerald-400 ring-emerald-400/50';

              return (
                <button
                  key={step.id || `step-${idx}`}
                  type="button"
                  id={`replay-step-pill-${idx}`}
                  data-testid={`replay-step-pill-${idx}`}
                  onClick={() => onSeekStep(idx)}
                  className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border whitespace-nowrap shadow-3xs ${
                    isActive
                      ? 'bg-indigo-600/90 text-white font-bold border-amber-400 ring-2 ring-amber-400/50 scale-[1.04]'
                      : isPast
                      ? 'bg-indigo-950/80 text-indigo-200 border-indigo-800/60 hover:bg-indigo-900/60 hover:text-white'
                      : 'bg-slate-900/60 text-zinc-400 border-zinc-800/80 hover:bg-indigo-950/60 hover:text-zinc-200'
                  }`}
                  title={`Step ${step.stepNumber}: "${step.query}" (${step.executionLatencyMs}ms latency) - Click to step`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor} ring-1 inline-block shrink-0`} />
                  <span className="font-mono text-[10px] text-indigo-300">#{step.stepNumber}</span>
                  <span className="font-mono font-medium max-w-[130px] truncate">&quot;{step.query}&quot;</span>
                  <span
                    className={`font-mono text-[10px] px-1 rounded ${
                      step.executionLatencyMs > 150
                        ? 'bg-rose-950 text-rose-300 font-bold'
                        : step.executionLatencyMs > 50
                        ? 'bg-amber-950 text-amber-300 font-semibold'
                        : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {step.executionLatencyMs}ms
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Analytical Grid: Metrics, Rendering State, and Degradation Analysis */}
      {!isCollapsed && activeStep && (
        <div
          id="replay-step-analytics-grid"
          data-testid="replay-step-analytics-grid"
          className="p-4 bg-slate-900/95 grid grid-cols-1 lg:grid-cols-3 gap-3.5 text-xs animate-fadeIn"
        >
          {/* Column 1: Performance Metrics & Latency Progression */}
          <div
            id="panel-replay-latency-metrics"
            data-testid="panel-replay-latency-metrics"
            className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-900/80 flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-indigo-950 pb-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Step {activeStep.stepNumber} Execution Telemetry</span>
                </span>
                {getSeverityBadge(activeStep.degradationSeverity)}
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase tracking-wider font-semibold">
                    Execution Latency
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span
                      id="metric-execution-latency"
                      data-testid="metric-execution-latency"
                      className={`text-2xl font-black font-mono tracking-tight ${
                        activeStep.executionLatencyMs > 150
                          ? 'text-rose-400'
                          : activeStep.executionLatencyMs > 50
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeStep.executionLatencyMs} ms
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      baseline: {activeStep.baselineLatencyMs}ms
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block uppercase tracking-wider font-semibold">
                    Latency Degradation
                  </span>
                  <span
                    id="metric-latency-delta"
                    data-testid="metric-latency-delta"
                    className={`text-sm font-black font-mono ${
                      activeStep.latencyDeltaPercent > 1000
                        ? 'text-rose-400'
                        : activeStep.latencyDeltaPercent > 100
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeStep.latencyDeltaPercent > 0 ? `+${activeStep.latencyDeltaPercent}%` : '0%'}
                  </span>
                  <span className="block text-[10px] text-zinc-400">
                    {(activeStep.executionLatencyMs / activeStep.baselineLatencyMs).toFixed(1)}x baseline
                  </span>
                </div>
              </div>
            </div>

            {/* Workload stats */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-950/80 font-mono text-[11px]">
              <div className="bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/40">
                <span className="text-[10px] text-zinc-400 block font-sans">Rows Matched / Scanned</span>
                <span id="metric-rows-scanned" className="font-bold text-white">
                  {activeStep.rowsMatched.toLocaleString()} / {activeStep.totalRowsScanned.toLocaleString()}
                </span>
                <span className="text-[10px] text-indigo-300 block">
                  {((activeStep.rowsMatched / Math.max(1, activeStep.totalRowsScanned)) * 100).toFixed(1)}% selectivity
                </span>
              </div>

              <div className="bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/40">
                <span className="text-[10px] text-zinc-400 block font-sans">System Contention</span>
                <div className="flex items-center justify-between text-white font-bold">
                  <span>RAM: {activeStep.memoryUsageMb} MB</span>
                  <span className="text-indigo-300">CPU: {activeStep.cpuContentionPercent}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className={`h-full ${
                      activeStep.cpuContentionPercent > 70
                        ? 'bg-rose-500'
                        : activeStep.cpuContentionPercent > 35
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, activeStep.cpuContentionPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: UI Rendering States & Responsiveness */}
          <div
            id="panel-replay-rendering-states"
            data-testid="panel-replay-rendering-states"
            className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-900/80 flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-indigo-950 pb-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                  <span>UI Rendering State &amp; Main Thread</span>
                </span>
                {getResponsivenessBadge(activeStep.uiResponsiveness)}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    DOM Rendering Mode
                  </span>
                  <div id="metric-render-mode">{getRenderModeBadge(activeStep.renderMode)}</div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Layout &amp; Paint Time</span>
                    <span
                      id="metric-dom-render-time"
                      className={`text-lg font-bold font-mono ${
                        activeStep.domRenderTimeMs > 25
                          ? 'text-rose-400'
                          : activeStep.domRenderTimeMs > 10
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeStep.domRenderTimeMs} ms
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">Frame Rate (FPS)</span>
                    <span
                      id="metric-fps"
                      className={`text-lg font-bold font-mono ${
                        activeStep.fps < 30
                          ? 'text-rose-400'
                          : activeStep.fps < 50
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeStep.fps} FPS
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Virtualization and Pipeline Flags */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-indigo-950/80 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStep.virtualizationActive ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span className="text-zinc-300">
                  Virtualization: <strong>{activeStep.virtualizationActive ? 'Active' : 'Bypassed'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStep.deferredRenderingActive ? 'bg-purple-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-zinc-300">
                  Deferred: <strong>{activeStep.deferredRenderingActive ? 'Concurrent' : 'Synchronous'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Degradation Diagnosis & Progression Curve */}
          <div
            id="panel-replay-degradation-diagnosis"
            data-testid="panel-replay-degradation-diagnosis"
            className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-900/80 flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-indigo-950 pb-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Degradation Root-Cause Analysis</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  Step {activeStep.stepNumber} of {currentSteps.length}
                </span>
              </div>

              {/* Degradation Cause Box */}
              <div
                id="metric-degradation-cause"
                data-testid="metric-degradation-cause"
                className={`mt-2.5 p-2.5 rounded-lg border text-xs leading-relaxed ${
                  activeStep.degradationSeverity === 'critical'
                    ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
                    : activeStep.degradationSeverity === 'moderate'
                    ? 'bg-amber-950/50 border-amber-800/80 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                }`}
              >
                {activeStep.degradationCause ||
                  'No degradation detected for this query step. Performance is within acceptable SLA limits.'}
              </div>
            </div>

            {/* Visual Degradation Progression Curve across steps */}
            <div className="pt-2 border-t border-indigo-950/80">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold mb-1">
                <span>Degradation Progression Curve:</span>
                <span>Max: {maxLatency.toFixed(0)}ms</span>
              </div>

              <div
                id="degradation-progression-meter"
                data-testid="degradation-progression-meter"
                className="flex items-end gap-1.5 h-9 bg-zinc-950/60 p-1 rounded-md border border-indigo-950"
              >
                {currentSteps.map((s, idx) => {
                  const barHeightPercent = Math.max(12, Math.round((s.executionLatencyMs / maxLatency) * 100));
                  const isCur = idx === currentPlaybackIndex;

                  const barBg =
                    s.degradationSeverity === 'critical'
                      ? 'bg-rose-500'
                      : s.degradationSeverity === 'moderate'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400';

                  return (
                    <div
                      key={`meter-${s.id || idx}`}
                      onClick={() => onSeekStep(idx)}
                      className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer group`}
                      title={`Step ${s.stepNumber} ("${s.query}"): ${s.executionLatencyMs}ms`}
                    >
                      <div
                        className={`w-full rounded-xs transition-all ${barBg} ${
                          isCur ? 'ring-2 ring-white scale-y-105' : 'opacity-70 group-hover:opacity-100'
                        }`}
                        style={{ height: `${barHeightPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
