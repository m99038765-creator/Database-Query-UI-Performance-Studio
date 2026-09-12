import React, { useEffect } from 'react';
import { ExportHistoryPoint } from '../utils/csvExporter';
import { getCpuPerformanceIndicator } from '../utils/systemCpuMonitor';
import {
  Clock,
  Cpu,
  Zap,
  Pin,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  FileCode2,
  HardDrive,
  ShieldCheck
} from 'lucide-react';

interface SparklineHistoricalPointTooltipProps {
  point: ExportHistoryPoint;
  stats: {
    avgLatency: number;
    avgCpu: number;
    totalRuns: number;
  };
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  xPercent: number; // 0 to 100 relative to sparkline SVG
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const SparklineHistoricalPointTooltip: React.FC<SparklineHistoricalPointTooltipProps> = ({
  point,
  stats,
  isPinned,
  onTogglePin,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  xPercent,
  onMouseEnter,
  onMouseLeave
}) => {
  // Listen for Escape key to dismiss pinned state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (isPinned && e.key === 'ArrowLeft' && hasPrev && onPrev) {
        onPrev();
      } else if (isPinned && e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinned, hasPrev, hasNext, onPrev, onNext, onClose]);

  // CPU Indicator calculation with dynamic green-to-red spectrum & glow
  const cpuIndicator = getCpuPerformanceIndicator(point.cpuUsagePercent);

  // Delta calculations against 10-run averages
  const latencyDelta = point.durationMs - stats.avgLatency;
  const cpuDelta = point.cpuUsagePercent - stats.avgCpu;
  const bytesPerRow = Math.round(point.fileSizeBytes / Math.max(1, point.recordCount));
  const microSecondsPerRow = ((point.durationMs / Math.max(1, point.recordCount)) * 1000).toFixed(2);

  // Horizontal anchoring alignment to prevent container clipping
  let tooltipStyle: React.CSSProperties = {};
  let arrowLeftPercent = '50%';

  if (xPercent < 22) {
    tooltipStyle = { left: '0%', transform: 'none' };
    arrowLeftPercent = `${Math.max(10, Math.min(90, xPercent))}%`;
  } else if (xPercent > 78) {
    tooltipStyle = { right: '0%', transform: 'none' };
    arrowLeftPercent = `${Math.max(10, Math.min(90, xPercent))}%`;
  } else {
    tooltipStyle = { left: `${xPercent}%`, transform: 'translateX(-50%)' };
    arrowLeftPercent = '50%';
  }

  return (
    <div
      id={`sparkline-tooltip-run-${point.runIndex}`}
      role="tooltip"
      aria-label={`Diagnostic details for export run #${point.runIndex}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute bottom-[calc(100%+8px)] z-40 w-76 sm:w-84 max-w-[calc(100vw-2rem)] bg-zinc-950/95 backdrop-blur-md text-zinc-100 rounded-xl p-3 shadow-2xl border border-zinc-700/80 transition-all duration-150 animate-in fade-in zoom-in-95 pointer-events-auto select-text"
      style={tooltipStyle}
    >
      {/* Tooltip Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-bold text-white bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 shrink-0">
            Run #{point.runIndex}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono shrink-0">
            {point.timeFormatted}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
              point.format === 'json'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
            }`}
          >
            {point.format === 'json' ? (
              <FileCode2 className="w-2.5 h-2.5 text-amber-400" />
            ) : (
              <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-400" />
            )}
            {point.format}
          </span>
        </div>

        {/* Action Controls: Steppers, Pin, and Dismiss */}
        <div className="flex items-center gap-1 shrink-0">
          {hasPrev && onPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              title="Previous Historical Run (←)"
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {hasNext && onNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              title="Next Historical Run (→)"
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={isPinned ? 'Unpin diagnostic inspection' : 'Pin diagnostic inspection to keep open'}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${
              isPinned
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
            }`}
          >
            <Pin className={`w-3 h-3 ${isPinned ? 'fill-emerald-400 text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close Tooltip (Esc)"
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Auto-Save Historical Data Tape Badge (if incremental snapshot) */}
      {point.isAutoSave && (
        <div className="mt-2 px-2 py-1 rounded-md bg-indigo-950/70 border border-indigo-700/60 flex items-center justify-between text-[10px] text-indigo-300">
          <div className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="font-mono font-bold text-white">{point.tapeId || 'Auto-Save'}</span>
            <span className="truncate text-indigo-200" title={point.triggerEvent}>
              {point.triggerEvent ? `• ${point.triggerEvent}` : '• Audit Incremental Slice'}
            </span>
          </div>
          <span className="font-mono text-[9px] bg-indigo-900/90 text-indigo-200 px-1 rounded uppercase font-bold shrink-0">
            Tape
          </span>
        </div>
      )}

      {/* Granular Diagnostic Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 my-2.5">
        {/* Metric A: Specific CPU Usage & Dynamic Spectrum Indicator */}
        <div
          className="rounded-lg p-2 border flex flex-col justify-between"
          style={{
            backgroundColor: 'rgba(24, 24, 27, 0.75)',
            borderColor: cpuIndicator.hexColor
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-zinc-400" />
              Observed CPU
            </span>
            {/* Glowing Beacon */}
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: cpuIndicator.hexColor }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{
                  backgroundColor: cpuIndicator.hexColor,
                  boxShadow: `0 0 6px ${cpuIndicator.glowColor}`
                }}
              />
            </span>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1">
              <span
                className="font-mono text-xl font-extrabold tracking-tight"
                style={{ color: cpuIndicator.hexColor }}
              >
                {point.cpuUsagePercent}%
              </span>
              <span className="text-[10px] font-medium text-zinc-400">load</span>
            </div>
            <span
              className="text-[10px] font-semibold block leading-tight truncate"
              style={{ color: cpuIndicator.hexColor }}
              title={cpuIndicator.label}
            >
              {cpuIndicator.label}
            </span>
          </div>

          {/* CPU Delta vs History Avg */}
          <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-mono">
            <span className="text-zinc-500">vs Avg ({stats.avgCpu.toFixed(0)}%):</span>
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                cpuDelta > 5
                  ? 'text-rose-400'
                  : cpuDelta < -5
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
              }`}
            >
              {cpuDelta > 0 ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5" />
              )}
              {cpuDelta >= 0 ? `+${cpuDelta.toFixed(1)}%` : `${cpuDelta.toFixed(1)}%`}
            </span>
          </div>
        </div>

        {/* Metric B: Specific Latency Value & Throughput */}
        <div className="rounded-lg p-2 border border-emerald-900/50 bg-zinc-900/75 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              Export Latency
            </span>
            <span className="text-[9px] font-mono text-emerald-400/90 font-semibold">
              Wall-Clock
            </span>
          </div>

          <div className="my-1">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-xl font-extrabold text-emerald-400 tracking-tight">
                {point.durationMs}
              </span>
              <span className="text-[10px] font-medium text-zinc-400">ms</span>
            </div>
            <span className="text-[10px] font-medium text-zinc-300 block leading-tight truncate">
              {point.throughputRowsPerSec.toLocaleString()} rows/sec
            </span>
          </div>

          {/* Latency Delta vs History Avg */}
          <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-mono">
            <span className="text-zinc-500">vs Avg ({stats.avgLatency.toFixed(1)}ms):</span>
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                latencyDelta > 1.5
                  ? 'text-amber-400'
                  : latencyDelta < -1.5
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
              }`}
            >
              {latencyDelta > 0 ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5" />
              )}
              {latencyDelta >= 0 ? `+${latencyDelta.toFixed(1)}ms` : `${latencyDelta.toFixed(1)}ms`}
            </span>
          </div>
        </div>
      </div>

      {/* Workload Diagnostic Details Strip */}
      <div className="bg-zinc-900/80 rounded-lg p-2 border border-zinc-800/90 text-[10px] flex flex-col gap-1">
        <div className="flex items-center justify-between text-zinc-400 font-mono">
          <span>Payload Volume:</span>
          <span className="text-zinc-200 font-semibold">
            {point.recordCount.toLocaleString()} rows • {point.itemCount.toLocaleString()} items
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-400 font-mono">
          <span>File Size &amp; Density:</span>
          <span className="text-zinc-200 font-semibold">
            {(point.fileSizeBytes / 1024).toFixed(1)} KB ({bytesPerRow} B/row)
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-400 font-mono">
          <span>Serialization Pace:</span>
          <span className="text-emerald-400 font-semibold">
            {microSecondsPerRow} µs per record
          </span>
        </div>
        <div className="mt-0.5 pt-1 border-t border-zinc-800 text-[9px] text-zinc-400 leading-tight">
          {point.format === 'csv' ? (
            <span className="text-emerald-300/90">
              ⚡ Compact stream: ~{point.compressionRatio}x smaller than JSON with zero object key redundancy.
            </span>
          ) : (
            <span className="text-amber-300/90">
              ⚠️ Tree payload: ~{point.compressionRatio}x footprint vs CSV due to repeated JSON keys.
            </span>
          )}
        </div>
      </div>

      {/* Bottom Hint Strip */}
      <div className="mt-1.5 text-[9px] text-zinc-500 flex items-center justify-between font-sans">
        <span>
          {isPinned ? '📌 Pinned for inspection' : 'Hover over or click points to pin'}
        </span>
        <span className="font-mono text-zinc-600">Esc to close</span>
      </div>

      {/* Downward Caret Arrow */}
      <div
        className="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-zinc-950 pointer-events-none"
        style={{
          left: arrowLeftPercent,
          transform: 'translateX(-50%)'
        }}
      />
      {/* Downward Caret Border Accent */}
      <div
        className="absolute -bottom-2.5 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-zinc-700/80 -z-10 pointer-events-none"
        style={{
          left: arrowLeftPercent,
          transform: 'translateX(-50%)'
        }}
      />
    </div>
  );
};
