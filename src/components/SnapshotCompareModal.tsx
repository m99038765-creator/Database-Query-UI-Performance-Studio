import React from 'react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  AlertTriangle,
  Zap,
  Clock,
  Database,
  Layers,
  Sliders,
  ChevronDown,
  FileText
} from 'lucide-react';

interface SnapshotCompareModalProps {
  trendHistory: LatencyTrendPoint[];
  indexA: number;
  indexB: number;
  onSelectIndexA: (idx: number) => void;
  onSelectIndexB: (idx: number) => void;
  onExportPdf?: () => void;
  onClose: () => void;
}

export const SnapshotCompareModal: React.FC<SnapshotCompareModalProps> = ({
  trendHistory,
  indexA,
  indexB,
  onSelectIndexA,
  onSelectIndexB,
  onExportPdf,
  onClose
}) => {
  const pointA = trendHistory[indexA] || trendHistory[0];
  const pointB = trendHistory[indexB] || trendHistory[trendHistory.length - 1];

  if (!pointA || !pointB) return null;

  // Metric differences (B relative to A)
  const latencyDiff = pointB.executionTimeMs - pointA.executionTimeMs;
  const latencyPercent =
    pointA.executionTimeMs > 0
      ? ((pointB.executionTimeMs - pointA.executionTimeMs) / pointA.executionTimeMs) * 100
      : 0;

  const rowsScannedDiff = pointB.rowsScanned - pointA.rowsScanned;
  const queriesDiff = pointB.activeQueriesCount - pointA.activeQueriesCount;

  // Multiplier speedup
  const speedupFactor =
    pointB.executionTimeMs > 0
      ? pointA.executionTimeMs / pointB.executionTimeMs
      : pointA.executionTimeMs > 0
      ? 999
      : 1;

  // Flag catalog metadata
  const flagMeta: {
    key: keyof OptimizationFlags;
    name: string;
    description: string;
    impact: string;
  }[] = [
    {
      key: 'btreeIndexing',
      name: 'B-Tree Indexing',
      description: 'Index on order_date & status',
      impact: 'Avoids 50,000 full table scan'
    },
    {
      key: 'batchEagerLoading',
      name: 'Batch Eager Join',
      description: 'Batch fetch line items with IN clause',
      impact: 'Reduces 101 queries to 2 queries'
    },
    {
      key: 'queryCaching',
      name: 'LRU Query Cache',
      description: 'In-memory result caching',
      impact: '0.15ms response on repeat queries'
    },
    {
      key: 'virtualizedDOM',
      name: 'DOM Virtualization',
      description: 'Windowed list rendering',
      impact: 'Keeps DOM node count under 20'
    },
    {
      key: 'deferredRendering',
      name: 'Concurrent State',
      description: 'Non-blocking keyboard input',
      impact: 'Maintains 60 FPS under typing'
    }
  ];

  return (
    <div
      id="snapshot-compare-modal-backdrop"
      className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="snapshot-compare-modal"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-compare-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Sliders className="w-4 h-4" />
              </span>
              <h2 id="snapshot-compare-title" className="text-base font-bold text-zinc-900">
                Side-by-Side Snapshot Compare
              </h2>
              <span className="text-[11px] font-mono bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                Diff Engine
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Select any two historical snapshots to compare execution latency, row scans, query count, and architectural flags.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onExportPdf && (
              <button
                id="btn-modal-export-pdf"
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 shadow-2xs transition-colors cursor-pointer"
                title="Generate and download formatted PDF benchmark report"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Export PDF Report</span>
              </button>
            )}

            <button
              id="btn-close-snapshot-compare"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* 1. Selector Strip & Overall Comparison Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Snapshot A Selector Card */}
            <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Baseline Snapshot (A)
                </span>
                <span className="text-[11px] font-mono text-zinc-500">#{indexA + 1} of {trendHistory.length}</span>
              </div>

              <div className="relative">
                <select
                  id="select-snapshot-a"
                  value={indexA}
                  onChange={(e) => onSelectIndexA(Number(e.target.value))}
                  className="w-full bg-white text-zinc-800 border border-amber-300 rounded-lg py-2 pl-3 pr-8 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer appearance-none"
                >
                  {trendHistory.map((pt, idx) => (
                    <option key={pt.id} value={idx}>
                      #{idx + 1} {pt.timeFormatted} — {pt.triggerEvent} ({pt.executionTimeMs.toFixed(2)}ms)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-amber-200/60 text-xs">
                <span className="text-zinc-600">Event Trigger:</span>
                <span className="font-semibold text-amber-950 truncate max-w-[200px]" title={pointA.triggerEvent}>
                  {pointA.triggerEvent}
                </span>
              </div>
            </div>

            {/* Snapshot B Selector Card */}
            <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Target Snapshot (B)
                </span>
                <span className="text-[11px] font-mono text-zinc-500">#{indexB + 1} of {trendHistory.length}</span>
              </div>

              <div className="relative">
                <select
                  id="select-snapshot-b"
                  value={indexB}
                  onChange={(e) => onSelectIndexB(Number(e.target.value))}
                  className="w-full bg-white text-zinc-800 border border-emerald-300 rounded-lg py-2 pl-3 pr-8 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer appearance-none"
                >
                  {trendHistory.map((pt, idx) => (
                    <option key={pt.id} value={idx}>
                      #{idx + 1} {pt.timeFormatted} — {pt.triggerEvent} ({pt.executionTimeMs.toFixed(2)}ms)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-emerald-200/60 text-xs">
                <span className="text-zinc-600">Event Trigger:</span>
                <span className="font-semibold text-emerald-950 truncate max-w-[200px]" title={pointB.triggerEvent}>
                  {pointB.triggerEvent}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Swap & Summary Delta Banner */}
          <div
            id="snapshot-compare-delta-banner"
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
              latencyDiff < 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : latencyDiff > 0
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-zinc-50 border-zinc-300 text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  latencyDiff < 0
                    ? 'bg-emerald-600 text-white'
                    : latencyDiff > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-zinc-600 text-white'
                }`}
              >
                {latencyDiff < 0 ? (
                  <TrendingDown className="w-5 h-5" />
                ) : latencyDiff > 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <Minus className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Performance Delta (Snapshot B vs Snapshot A)
                </div>
                <div className="text-lg font-bold font-mono">
                  {latencyDiff < 0 ? (
                    <span>
                      {Math.abs(latencyDiff).toFixed(2)} ms faster ({Math.abs(latencyPercent).toFixed(1)}% drop)
                    </span>
                  ) : latencyDiff > 0 ? (
                    <span>
                      +{latencyDiff.toFixed(2)} ms slower (+{latencyPercent.toFixed(1)}% increase)
                    </span>
                  ) : (
                    <span>Identical Latency (0.00 ms diff)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {speedupFactor > 1.05 && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    Throughput Boost
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-800">
                    {speedupFactor >= 100 ? `${Math.round(speedupFactor)}x` : `${speedupFactor.toFixed(1)}x`} Faster
                  </span>
                </div>
              )}

              <button
                id="btn-swap-compare-snapshots"
                type="button"
                onClick={() => {
                  const temp = indexA;
                  onSelectIndexA(indexB);
                  onSelectIndexB(temp);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Swap Snapshot A and Snapshot B"
              >
                <span>Swap A ⇄ B</span>
              </button>
            </div>
          </div>

          {/* 2. Side-by-Side Metric Difference Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-500" />
              <span>Core Metric Discrepancies</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Latency Metric */}
              <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs">
                <span className="text-xs text-zinc-500 font-medium">Query Latency</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-amber-700 font-bold block">A:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointA.executionTimeMs.toFixed(2)}ms
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 self-center" />
                  <div>
                    <span className="text-xs text-emerald-700 font-bold block">B:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointB.executionTimeMs.toFixed(2)}ms
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Difference:</span>
                  <span
                    className={`font-bold ${
                      latencyDiff < 0 ? 'text-emerald-600' : latencyDiff > 0 ? 'text-rose-600' : 'text-zinc-600'
                    }`}
                  >
                    {latencyDiff < 0 ? `-${Math.abs(latencyDiff).toFixed(2)}ms` : `+${latencyDiff.toFixed(2)}ms`}
                  </span>
                </div>
              </div>

              {/* Rows Scanned Metric */}
              <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs">
                <span className="text-xs text-zinc-500 font-medium">Rows Scanned</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-amber-700 font-bold block">A:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointA.rowsScanned.toLocaleString()}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 self-center" />
                  <div>
                    <span className="text-xs text-emerald-700 font-bold block">B:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointB.rowsScanned.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Difference:</span>
                  <span
                    className={`font-bold ${
                      rowsScannedDiff < 0
                        ? 'text-emerald-600'
                        : rowsScannedDiff > 0
                        ? 'text-rose-600'
                        : 'text-zinc-600'
                    }`}
                  >
                    {rowsScannedDiff < 0
                      ? `-${Math.abs(rowsScannedDiff).toLocaleString()}`
                      : `+${rowsScannedDiff.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Active Queries Count */}
              <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs">
                <span className="text-xs text-zinc-500 font-medium">Database Queries Fired</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-amber-700 font-bold block">A:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointA.activeQueriesCount}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 self-center" />
                  <div>
                    <span className="text-xs text-emerald-700 font-bold block">B:</span>
                    <span className="text-base font-mono font-bold text-zinc-800">
                      {pointB.activeQueriesCount}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Difference:</span>
                  <span
                    className={`font-bold ${
                      queriesDiff < 0 ? 'text-emerald-600' : queriesDiff > 0 ? 'text-rose-600' : 'text-zinc-600'
                    }`}
                  >
                    {queriesDiff < 0 ? `-${Math.abs(queriesDiff)} queries` : `+${queriesDiff} queries`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Cache & Simulated Error Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cache Hit Comparison */}
            <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
              <span className="text-xs font-bold text-zinc-700 block mb-2">Query Cache Status</span>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">Snapshot A:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      pointA.cacheHit ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {pointA.cacheHit ? 'CACHE HIT' : 'CACHE MISS'}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-900">Snapshot B:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      pointB.cacheHit ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {pointB.cacheHit ? 'CACHE HIT' : 'CACHE MISS'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error / Warning Comparison */}
            <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
              <span className="text-xs font-bold text-zinc-700 block mb-2">Database Error State</span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900 min-w-[75px]">Snapshot A:</span>
                  {pointA.simulatedError ? (
                    <span className="text-rose-700 font-mono text-[10px] truncate max-w-[280px]" title={pointA.simulatedError}>
                      ⚠️ {pointA.simulatedError}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Normal Execution (Zero Errors)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-900 min-w-[75px]">Snapshot B:</span>
                  {pointB.simulatedError ? (
                    <span className="text-rose-700 font-mono text-[10px] truncate max-w-[280px]" title={pointB.simulatedError}>
                      ⚠️ {pointB.simulatedError}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Normal Execution (Zero Errors)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Optimization Flag Configuration Comparison Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-zinc-500" />
                <span>Optimization Flags Diff Matrix</span>
              </h3>
              <span className="text-[11px] text-zinc-500">
                Highlights architectural toggles between points
              </span>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-bold text-[11px]">
                    <th className="py-2.5 px-4">Architecture Component</th>
                    <th className="py-2.5 px-4 text-center bg-amber-50/70 text-amber-900">
                      Snapshot A (#{indexA + 1})
                    </th>
                    <th className="py-2.5 px-4 text-center bg-emerald-50/70 text-emerald-900">
                      Snapshot B (#{indexB + 1})
                    </th>
                    <th className="py-2.5 px-4 text-right">Delta Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-normal">
                  {flagMeta.map((item) => {
                    const enabledInA = pointA.flags[item.key];
                    const enabledInB = pointB.flags[item.key];
                    const isChanged = enabledInA !== enabledInB;

                    return (
                      <tr
                        key={item.key}
                        className={`transition-colors ${
                          isChanged ? 'bg-blue-50/40 font-medium' : 'hover:bg-zinc-50/60'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-900 flex items-center gap-2">
                            <span>{item.name}</span>
                            {isChanged && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                                CHANGED
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500">{item.description}</div>
                        </td>

                        {/* Snapshot A status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              enabledInA
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-200 text-zinc-600'
                            }`}
                          >
                            {enabledInA ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> ON
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" /> OFF
                              </>
                            )}
                          </span>
                        </td>

                        {/* Snapshot B status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              enabledInB
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-200 text-zinc-600'
                            }`}
                          >
                            {enabledInB ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> ON
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" /> OFF
                              </>
                            )}
                          </span>
                        </td>

                        {/* Impact description */}
                        <td className="py-3 px-4 text-right text-[11px] text-zinc-600">
                          {isChanged ? (
                            <span
                              className={`font-semibold ${
                                enabledInB ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {enabledInB ? `+ Enabled: ${item.impact}` : `- Disabled: ${item.impact}`}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Unchanged</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Tip: You can change the points above at any time or select different points directly in the Performance Trends table.
          </div>
          <div className="flex items-center gap-2">
            {onExportPdf && (
              <button
                id="btn-footer-export-pdf"
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF Report</span>
              </button>
            )}
            <button
              id="btn-dismiss-snapshot-compare"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Done Comparing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
