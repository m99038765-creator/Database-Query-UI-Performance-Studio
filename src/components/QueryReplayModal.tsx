import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Download,
  X,
  Layers,
  Clock,
  Database,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';

export interface QueryReplayResult {
  replayedLatencyMs: number;
  varianceMs: number;
  variancePercent: number;
  reproductionAccuracyPercent: number;
  reproductionStatus: 'EXACT_MATCH' | 'HIGH_CORRELATION' | 'ACCEPTABLE' | 'DEVIATED';
  bottleneckCause: string;
  bottleneckRecommendation: string;
  reproducedFlags: OptimizationFlags;
  replayedAt: string;
  rowsScanned: number;
}

interface QueryReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  point: LatencyTrendPoint | null;
  currentFlags: OptimizationFlags;
  onApplyFlags?: (flags: OptimizationFlags) => void;
  onAppendTrendPoint?: (point: LatencyTrendPoint) => void;
}

export const QueryReplayModal: React.FC<QueryReplayModalProps> = ({
  isOpen,
  onClose,
  point,
  currentFlags,
  onApplyFlags,
  onAppendTrendPoint
}) => {
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayStage, setReplayStage] = useState<string>('');
  const [replayProgress, setReplayProgress] = useState(0);
  const [replayResult, setReplayResult] = useState<QueryReplayResult | null>(null);
  const [initialFlagsAtOpen, setInitialFlagsAtOpen] = useState<OptimizationFlags | null>(null);
  const [hasAppendedToHistory, setHasAppendedToHistory] = useState(false);

  // Store pre-replay flags when modal opens
  useEffect(() => {
    if (isOpen && point) {
      setInitialFlagsAtOpen(currentFlags);
      setReplayResult(null);
      setIsReplaying(false);
      setReplayProgress(0);
      setHasAppendedToHistory(false);
    }
  }, [isOpen, point]);

  if (!isOpen || !point) return null;

  const flagsDiffer = Object.keys(point.flags || {}).some(
    (k) => point.flags[k as keyof OptimizationFlags] !== currentFlags[k as keyof OptimizationFlags]
  );

  // Execution simulation
  const handleExecuteReplay = () => {
    setIsReplaying(true);
    setReplayProgress(15);
    setReplayStage('Synchronizing database optimizer flags and cache states...');

    // Actually apply the historical flags to the system if callback provided
    if (onApplyFlags) {
      onApplyFlags(point.flags);
    }

    setTimeout(() => {
      setReplayProgress(55);
      setReplayStage(
        !point.flags.btreeIndexing
          ? 'Scanning 50,000 heap rows sequentially (Full Table Scan simulation)...'
          : !point.flags.batchEagerLoading
          ? 'Executing 100+ synchronous child relation lookups (N+1 Query Storm simulation)...'
          : 'Querying indexed B-Tree pages and evaluating plan cost...'
      );

      setTimeout(() => {
        setReplayProgress(90);
        setReplayStage('Capturing latency telemetry and isolating bottleneck root causes...');

        setTimeout(() => {
          // Calculate realistic replayed latency matching the historical conditions
          const baseLatency = point.executionTimeMs;
          // Add subtle realistic runtime jitter between -2.5% and +2.5%
          const jitterPercent = (Math.random() * 5 - 2.5) / 100;
          const replayedMs = Math.max(0.4, Number((baseLatency * (1 + jitterPercent)).toFixed(2)));
          const varianceMs = Number((replayedMs - baseLatency).toFixed(2));
          const variancePercent = Number(((varianceMs / Math.max(baseLatency, 0.1)) * 100).toFixed(1));
          const accuracy = Math.max(0, Number((100 - Math.abs(variancePercent)).toFixed(1)));

          let status: QueryReplayResult['reproductionStatus'] = 'HIGH_CORRELATION';
          if (Math.abs(variancePercent) <= 3) status = 'EXACT_MATCH';
          else if (Math.abs(variancePercent) <= 10) status = 'HIGH_CORRELATION';
          else if (Math.abs(variancePercent) <= 25) status = 'ACCEPTABLE';
          else status = 'DEVIATED';

          // Determine bottleneck root cause
          let bottleneckCause = 'Nominal optimized execution. Indexes and cache paths operated within low-latency bounds.';
          let bottleneckRecommendation = 'Configuration is optimal. Maintain current B-Tree indexing and query batching.';

          if (!point.flags.batchEagerLoading && !point.flags.btreeIndexing) {
            bottleneckCause = 'Compound Bottleneck: Missing B-Tree index forced a 50,000-row full table scan, compounded by an N+1 query cascade fetching line-items serially.';
            bottleneckRecommendation = 'Enable Batch Eager Loading to vectorize child joins and provision composite index on (status, category).';
          } else if (!point.flags.batchEagerLoading) {
            bottleneckCause = 'N+1 Query Cascade: The query executed 1 parent scan + 100 individual child relation queries sequentially, multiplying network roundtrip latency.';
            bottleneckRecommendation = 'Enable Batch Eager Loading to collapse relation fetches into a single vectorized query.';
          } else if (!point.flags.btreeIndexing) {
            bottleneckCause = 'Full Table Sequential Scan: Missing B-Tree indexes forced the query engine to evaluate all 50,000 heap tuples sequentially.';
            bottleneckRecommendation = 'Enable B-Tree Indexing to replace sequential heap scans with logarithmic index seeks.';
          } else if (!point.flags.queryCaching) {
            bottleneckCause = 'Cold Cache / Cache Miss: Bypassed shared_buffers memory cache, incurring disk block seek overhead.';
            bottleneckRecommendation = 'Enable LRU Query Caching to serve frequent point queries in sub-millisecond time.';
          } else if (!point.flags.virtualizedDOM) {
            bottleneckCause = 'DOM Window Thrashing: The active window rendered unvirtualized DOM nodes simultaneously, causing paint frame drops.';
            bottleneckRecommendation = 'Enable Virtualized DOM windowing to constrain rendered nodes to the viewport.';
          }

          const result: QueryReplayResult = {
            replayedLatencyMs: replayedMs,
            varianceMs,
            variancePercent,
            reproductionAccuracyPercent: accuracy,
            reproductionStatus: status,
            bottleneckCause,
            bottleneckRecommendation,
            reproducedFlags: { ...point.flags },
            replayedAt: new Date().toLocaleTimeString(),
            rowsScanned: point.rowsScanned
          };

          setReplayResult(result);
          setIsReplaying(false);
          setReplayProgress(100);
          setReplayStage('Query replay completed successfully.');
        }, 300);
      }, 400);
    }, 400);
  };

  // Revert flags back to pre-replay state
  const handleRevertFlags = () => {
    if (initialFlagsAtOpen && onApplyFlags) {
      onApplyFlags(initialFlagsAtOpen);
    }
  };

  // Append replay point to trend history
  const handleAppendReplayToHistory = () => {
    if (!replayResult || !onAppendTrendPoint) return;
    const now = Date.now();
    const d = new Date(now);
    const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

    const newPoint: LatencyTrendPoint = {
      id: `replay-${now}`,
      timestamp: now,
      timeFormatted,
      executionTimeMs: replayResult.replayedLatencyMs,
      rowsScanned: replayResult.rowsScanned,
      activeQueriesCount: point.activeQueriesCount,
      cacheHit: point.flags.queryCaching,
      flags: { ...point.flags },
      triggerEvent: `[Replay] ${point.triggerEvent}`,
      deltaMs: replayResult.varianceMs,
      simulatedError: null
    };

    onAppendTrendPoint(newPoint);
    setHasAppendedToHistory(true);
  };

  // Export Replay Diagnostic JSON
  const handleExportReplayJson = () => {
    const payload = {
      exportType: 'query_replay_diagnostic_report',
      exportedAt: new Date().toISOString(),
      historicalSnapshot: {
        eventId: point.id,
        triggerEvent: point.triggerEvent,
        historicalTimestamp: point.timestamp,
        historicalTimeFormatted: point.timeFormatted,
        measuredLatencyMs: point.executionTimeMs,
        rowsScanned: point.rowsScanned,
        activeQueriesCount: point.activeQueriesCount,
        cacheHit: point.cacheHit,
        historicalFlags: point.flags
      },
      replayExecution: replayResult
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-replay-bottleneck-${point.id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="query-replay-modal"
      data-testid="query-replay-modal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn font-sans"
    >
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col text-zinc-900 animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-blue-900 via-indigo-950 to-zinc-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-xl shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Query Replay &amp; Bottleneck Reproducer
                </h3>
                <span className="bg-blue-900/60 text-blue-200 text-[10px] font-mono px-2 py-0.5 rounded-full border border-blue-700/60 font-semibold">
                  Point #{point.id}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Re-executes the exact query state and index/cache configuration to reproduce performance variations.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-query-replay-modal"
            data-testid="btn-close-query-replay-modal"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
            aria-label="Close Query Replay modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Target Historical Event Summary */}
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="font-bold text-zinc-900 text-sm">
                  Historical Event: {point.triggerEvent}
                </span>
              </div>
              <span className="font-mono text-zinc-500 text-[11px]">
                Captured at: {point.timeFormatted}
              </span>
            </div>

            {/* Metrics Triplet */}
            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <div className="text-[10px] uppercase text-zinc-500 font-sans font-semibold">
                  Historical Latency
                </div>
                <div
                  className={`text-base font-extrabold mt-0.5 ${
                    point.executionTimeMs > 60
                      ? 'text-rose-600'
                      : point.executionTimeMs > 15
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {point.executionTimeMs.toFixed(2)} ms
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <div className="text-[10px] uppercase text-zinc-500 font-sans font-semibold">
                  Rows Scanned
                </div>
                <div className="text-base font-extrabold text-zinc-800 mt-0.5">
                  {point.rowsScanned.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <div className="text-[10px] uppercase text-zinc-500 font-sans font-semibold">
                  Cache Result
                </div>
                <div
                  className={`text-base font-extrabold mt-0.5 ${
                    point.cacheHit ? 'text-emerald-600' : 'text-zinc-600'
                  }`}
                >
                  {point.cacheHit ? 'CACHE HIT' : 'CACHE MISS'}
                </div>
              </div>
            </div>
          </div>

          {/* Historical Flag State vs Current Live Flags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Historical Optimization Flags (Query State to Reproduce)</span>
              </h4>
              {flagsDiffer && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                  Flags will be synchronized during replay
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
              {[
                { key: 'btreeIndexing', label: 'B-Tree Indexing' },
                { key: 'batchEagerLoading', label: 'Batch Eager Loading' },
                { key: 'queryCaching', label: 'LRU Query Caching' },
                { key: 'virtualizedDOM', label: 'DOM Virtualization' },
                { key: 'deferredRendering', label: 'Deferred Rendering' }
              ].map(({ key, label }) => {
                const histVal = point.flags[key as keyof OptimizationFlags];
                const liveVal = currentFlags[key as keyof OptimizationFlags];
                const isDifferent = histVal !== liveVal;

                return (
                  <div
                    key={key}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1 transition-all ${
                      histVal
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/70 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="font-sans font-semibold text-[11px] text-zinc-700">{label}</div>
                    <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[11px]">
                      <span className={`font-bold ${histVal ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {histVal ? 'ENABLED' : 'DISABLED'}
                      </span>
                      {isDifferent && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-sans">
                          Live: {liveVal ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Replay Execution Progress Indicator */}
          {isReplaying && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>{replayStage}</span>
                </span>
                <span className="font-mono font-bold text-indigo-700">{replayProgress}%</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${replayProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Replayed Execution Results & Bottleneck Isolation */}
          {replayResult && (
            <div
              id="query-replay-result-container"
              data-testid="query-replay-result-container"
              className="bg-gradient-to-br from-zinc-50 via-white to-blue-50/30 rounded-xl border border-blue-200 p-4 space-y-4 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900">
                      Query Execution Replay Finished
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Bottleneck successfully reproduced at {replayResult.replayedAt}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-extrabold border shadow-2xs ${
                    replayResult.reproductionStatus === 'EXACT_MATCH'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : replayResult.reproductionStatus === 'HIGH_CORRELATION'
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  {replayResult.reproductionAccuracyPercent}% Match ({replayResult.reproductionStatus.replace('_', ' ')})
                </span>
              </div>

              {/* Side-by-Side Comparison: Historical vs Replayed */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center">
                <div className="p-3 bg-white rounded-xl border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-sans uppercase font-semibold">
                    Original Historical
                  </div>
                  <div className="text-lg font-extrabold text-zinc-900 mt-1">
                    {point.executionTimeMs.toFixed(2)} ms
                  </div>
                  <div className="text-[10px] text-zinc-400 font-sans mt-0.5">
                    Target baseline
                  </div>
                </div>

                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200">
                  <div className="text-[10px] text-blue-700 font-sans uppercase font-semibold">
                    Re-Executed Latency
                  </div>
                  <div className="text-lg font-extrabold text-blue-950 mt-1">
                    {replayResult.replayedLatencyMs.toFixed(2)} ms
                  </div>
                  <div className="text-[10px] text-blue-600 font-sans mt-0.5">
                    Measured under reproduced flags
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-zinc-200">
                  <div className="text-[10px] text-zinc-500 font-sans uppercase font-semibold">
                    Execution Variance
                  </div>
                  <div
                    className={`text-lg font-extrabold mt-1 ${
                      Math.abs(replayResult.varianceMs) < 2
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {replayResult.varianceMs > 0 ? `+${replayResult.varianceMs}` : replayResult.varianceMs} ms
                  </div>
                  <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                    {replayResult.variancePercent > 0 ? `+${replayResult.variancePercent}` : replayResult.variancePercent}% delta
                  </div>
                </div>
              </div>

              {/* Isolated Bottleneck Root Cause */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Isolated Bottleneck Root Cause</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-900 font-medium">
                  {replayResult.bottleneckCause}
                </p>
                <div className="pt-2 border-t border-rose-200/80 text-[11px] text-rose-800">
                  <strong>Remedy:</strong> {replayResult.bottleneckRecommendation}
                </div>
              </div>

              {/* Secondary Result Actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-replay-append-trend"
                    data-testid="btn-replay-append-trend"
                    onClick={handleAppendReplayToHistory}
                    disabled={hasAppendedToHistory}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 disabled:text-zinc-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{hasAppendedToHistory ? 'Added to Trend Log' : 'Add Replay to Trend History'}</span>
                  </button>

                  <button
                    type="button"
                    id="btn-replay-export-json"
                    data-testid="btn-replay-export-json"
                    onClick={handleExportReplayJson}
                    className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-zinc-200"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Export Diagnostic JSON</span>
                  </button>
                </div>

                {initialFlagsAtOpen && flagsDiffer && (
                  <button
                    type="button"
                    id="btn-replay-revert-flags"
                    data-testid="btn-replay-revert-flags"
                    onClick={handleRevertFlags}
                    className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Revert to Pre-Replay Flags
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-zinc-500 text-[11px]">
            {isReplaying ? (
              <span className="text-indigo-600 font-semibold animate-pulse">
                Simulating historical execution...
              </span>
            ) : replayResult ? (
              <span className="text-emerald-700 font-semibold">
                ✓ Query state re-executed and matched against historical baseline.
              </span>
            ) : (
              <span>Ready to reproduce historical state for &ldquo;{point.triggerEvent}&rdquo;.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              id="btn-execute-query-replay"
              data-testid="btn-execute-query-replay"
              onClick={handleExecuteReplay}
              disabled={isReplaying}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white text-white" />
              <span>{replayResult ? 'Re-Run Replay' : 'Execute Query Replay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
