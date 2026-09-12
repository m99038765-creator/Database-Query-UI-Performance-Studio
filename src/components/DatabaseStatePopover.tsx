import React, { useState } from 'react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';
import {
  Database,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  Layers,
  Server,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
  X,
  Sliders,
  Columns
} from 'lucide-react';

interface DatabaseStatePopoverProps {
  point: LatencyTrendPoint;
  index: number;
  totalPoints: number;
  position: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
  currentFlags: OptimizationFlags;
  onApplyFlags: (flags: OptimizationFlags) => void;
  onCompareSnapshot: (index: number) => void;
  onClose: () => void;
}

export const DatabaseStatePopover: React.FC<DatabaseStatePopoverProps> = ({
  point,
  index,
  totalPoints,
  position,
  containerWidth,
  containerHeight,
  currentFlags,
  onApplyFlags,
  onCompareSnapshot,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  // Compute popover placement to prevent clipping outside the D3 container
  const popoverWidth = Math.min(420, containerWidth > 480 ? 420 : containerWidth - 24);
  
  // Horizontal positioning: align near point.x, clamp to container
  let left = position.x - popoverWidth / 2;
  if (left < 12) left = 12;
  if (left + popoverWidth > containerWidth - 12) {
    left = containerWidth - popoverWidth - 12;
  }

  // Vertical positioning: prefer placing above the point if room, else below
  const popoverEstimatedHeight = 440;
  const showAbove = position.y > popoverEstimatedHeight - 60;
  const top = showAbove
    ? Math.max(10, position.y - popoverEstimatedHeight - 16)
    : Math.min(containerHeight - popoverEstimatedHeight - 10, position.y + 20);

  // SLA and Performance classification
  const isFast = point.executionTimeMs < 15;
  const isAcceptable = point.executionTimeMs >= 15 && point.executionTimeMs <= 60;
  const isDegraded = point.executionTimeMs > 60;

  // Technical Specs derivations
  const accessMethod = point.cacheHit
    ? 'LRU In-Memory Hash Lookup'
    : point.flags.btreeIndexing
    ? 'B-Tree Index Scan (idx_orders_status_category)'
    : 'Full Sequential Table Scan (Heap Scan)';

  const scanSelectivity = ((point.rowsScanned / 50000) * 100).toFixed(1);
  const rowsPruned = Math.max(0, 50000 - point.rowsScanned);

  const connectionPoolUsage = point.activeQueriesCount > 40
    ? { text: '25 / 25 Conns [EXHAUSTED]', color: 'text-rose-600 bg-rose-50 border-rose-200' }
    : { text: `${Math.min(point.activeQueriesCount, 25)} / 25 Conns [HEALTHY]`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };

  const queryPattern = point.flags.batchEagerLoading
    ? 'Eager 2-Stage Batch Join'
    : `N+1 Query Loop (${point.activeQueriesCount} roundtrips)`;

  const fullDate = new Date(point.timestamp);
  const formattedFullTimestamp = `${fullDate.toLocaleDateString()} ${point.timeFormatted}.${String(fullDate.getMilliseconds()).padStart(3, '0')}`;

  const copyTechnicalSpecs = () => {
    const specs = {
      snapshotIndex: index + 1,
      timestamp: formattedFullTimestamp,
      triggerEvent: point.triggerEvent,
      latencyMs: point.executionTimeMs,
      slaStatus: isFast ? 'MET (<15ms)' : isAcceptable ? 'ACCEPTABLE (15-60ms)' : 'BREACHED (>60ms)',
      databaseSpecs: {
        accessMethod,
        rowsScanned: point.rowsScanned,
        heapTotalRows: 50000,
        scanEfficiencyPercent: `${scanSelectivity}%`,
        rowsPruned,
        queryPattern,
        activeQueriesCount: point.activeQueriesCount,
        connectionPool: connectionPoolUsage.text,
        cacheStatus: point.cacheHit ? 'HIT' : 'MISS',
        simulatedError: point.simulatedError || 'None'
      },
      optimizationFlags: point.flags
    };

    navigator.clipboard.writeText(JSON.stringify(specs, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if flags differ from current active flags
  const flagsDiffer = Object.keys(point.flags).some(
    (k) => point.flags[k as keyof OptimizationFlags] !== currentFlags[k as keyof OptimizationFlags]
  );

  return (
    <div
      id="d3-database-state-popover"
      className="absolute z-40 bg-white rounded-xl shadow-2xl border border-zinc-300 text-zinc-900 transition-all duration-150 animate-in fade-in zoom-in-95"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        maxHeight: '480px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with Event & Timestamp */}
      <div className="p-3.5 border-b border-zinc-200 bg-zinc-50 rounded-t-xl flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className={`p-1.5 rounded-lg mt-0.5 ${
            isFast ? 'bg-emerald-100 text-emerald-700' : isDegraded ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-zinc-900">
                Snapshot #{index + 1} of {totalPoints}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700 font-semibold">
                {point.triggerEvent}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono mt-0.5">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{formattedFullTimestamp}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyTechnicalSpecs}
            title="Copy technical specifications JSON to clipboard"
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/70 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            id="btn-close-database-popover"
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 transition-colors cursor-pointer"
            title="Close popover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Latency & SLA Hero Summary */}
      <div className="px-4 py-3 bg-zinc-900 text-white flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
            Recorded Execution Latency
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`font-mono text-xl font-bold ${
              isFast ? 'text-emerald-400' : isDegraded ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {point.executionTimeMs.toFixed(2)} ms
            </span>
            {point.deltaMs !== undefined && (
              <span
                className={`font-mono text-xs flex items-center gap-0.5 ${
                  point.deltaMs < 0 ? 'text-emerald-400' : point.deltaMs > 0 ? 'text-rose-400' : 'text-zinc-400'
                }`}
              >
                {point.deltaMs < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                ) : point.deltaMs > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : null}
                {point.deltaMs < 0
                  ? `-${Math.abs(point.deltaMs).toFixed(1)}ms`
                  : point.deltaMs > 0
                  ? `+${point.deltaMs.toFixed(1)}ms`
                  : '0ms'}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isFast
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : isDegraded
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {isFast ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>&lt; 15ms SLA MET</span>
              </>
            ) : isDegraded ? (
              <>
                <XCircle className="w-3 h-3" />
                <span>&gt; 60ms SLA BREACH</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>15-60ms ACCEPTABLE</span>
              </>
            )}
          </span>
          <div className="text-[10px] font-mono text-zinc-400 mt-1">
            {point.cacheHit ? '0ms DB wait (Cache Hit)' : `${(1000 / Math.max(0.1, point.executionTimeMs)).toFixed(0)} req/sec capacity`}
          </div>
        </div>
      </div>

      {/* Scrollable Technical Specifications Matrix */}
      <div className="p-3.5 space-y-3 overflow-y-auto max-h-[250px] text-xs">
        {/* Error notification if point suffered simulated error */}
        {point.simulatedError && (
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-mono leading-tight">{point.simulatedError}</span>
          </div>
        )}

        {/* Section 1: Storage & Access Path */}
        <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-200/80">
          <div className="text-[11px] font-bold text-zinc-800 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              Storage &amp; Access Path
            </span>
            <span className="font-mono text-[10px] text-zinc-500">Table: transactions (50k rows)</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Access Method:</span>
              <span className="font-mono font-bold text-zinc-800 text-right truncate max-w-[220px]">
                {accessMethod}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Rows Traversed:</span>
              <span className="font-mono font-semibold text-zinc-900">
                {point.rowsScanned.toLocaleString()} rows ({scanSelectivity}%)
              </span>
            </div>

            {/* Visual Scan Progress Bar */}
            <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${point.rowsScanned > 1000 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, Math.max(2, (point.rowsScanned / 50000) * 100))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Bypassed non-matching:</span>
              <span className="font-mono text-emerald-700 font-medium">
                {rowsPruned.toLocaleString()} rows
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Concurrency & Query Engine */}
        <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-200/80">
          <div className="text-[11px] font-bold text-zinc-800 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-purple-600" />
              Query Pipeline &amp; Connections
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${connectionPoolUsage.color}`}>
              {connectionPoolUsage.text}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Execution Pattern:</span>
              <span className="font-mono font-medium text-zinc-800 text-right">
                {queryPattern}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Active Query Roundtrips:</span>
              <span className="font-mono font-bold text-zinc-900">
                {point.activeQueriesCount} roundtrip{point.activeQueriesCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500">LRU Cache State:</span>
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                point.cacheHit ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {point.cacheHit ? 'CACHE HIT (0.15ms)' : 'CACHE MISS'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Optimization Flags Active at this Snapshot */}
        <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-200/80">
          <div className="text-[11px] font-bold text-zinc-800 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-zinc-700" />
              Database Optimization Flags
            </span>
            <span className="font-mono text-[10px] text-zinc-500">
              {Object.values(point.flags).filter(Boolean).length}/5 Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between ${
              point.flags.btreeIndexing ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium' : 'bg-white border-zinc-200 text-zinc-400 line-through'
            }`}>
              <span>B-Tree Indexing</span>
              <span className="font-bold">{point.flags.btreeIndexing ? 'ON' : 'OFF'}</span>
            </div>

            <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between ${
              point.flags.batchEagerLoading ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium' : 'bg-white border-zinc-200 text-zinc-400 line-through'
            }`}>
              <span>Batch Eager Join</span>
              <span className="font-bold">{point.flags.batchEagerLoading ? 'ON' : 'OFF'}</span>
            </div>

            <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between ${
              point.flags.queryCaching ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium' : 'bg-white border-zinc-200 text-zinc-400 line-through'
            }`}>
              <span>LRU Query Caching</span>
              <span className="font-bold">{point.flags.queryCaching ? 'ON' : 'OFF'}</span>
            </div>

            <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between ${
              point.flags.virtualizedDOM ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium' : 'bg-white border-zinc-200 text-zinc-400 line-through'
            }`}>
              <span>Virtualized DOM</span>
              <span className="font-bold">{point.flags.virtualizedDOM ? 'ON' : 'OFF'}</span>
            </div>

            <div className={`p-1.5 rounded border text-[10px] col-span-2 flex items-center justify-between ${
              point.flags.deferredRendering ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium' : 'bg-white border-zinc-200 text-zinc-400 line-through'
            }`}>
              <span>Concurrent Deferred Rendering</span>
              <span className="font-bold">{point.flags.deferredRendering ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-50 rounded-b-xl flex items-center justify-between gap-2">
        <button
          id="btn-popover-compare"
          type="button"
          onClick={() => onCompareSnapshot(index)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold border border-zinc-300 shadow-2xs transition-colors cursor-pointer"
          title="Open side-by-side comparison modal with this snapshot"
        >
          <Columns className="w-3.5 h-3.5 text-blue-600" />
          <span>Compare in Matrix</span>
        </button>

        {flagsDiffer && (
          <button
            id="btn-popover-apply-flags"
            type="button"
            onClick={() => onApplyFlags(point.flags)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Update live database engine toggles to match this snapshot's state"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Apply This Flag State</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded text-zinc-600 hover:text-zinc-900 text-xs font-medium hover:bg-zinc-200/50 transition-colors cursor-pointer ml-auto"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
