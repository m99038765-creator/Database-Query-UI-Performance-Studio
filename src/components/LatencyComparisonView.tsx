import React, { useState } from 'react';
import { Sliders, ArrowRight, TrendingDown, TrendingUp, Minus, Clock, Database, Zap, Layers, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';

interface LatencyComparisonViewProps {
  trendHistory: LatencyTrendPoint[];
  onClose?: () => void;
}

export const LatencyComparisonView: React.FC<LatencyComparisonViewProps> = ({
  trendHistory = [],
  onClose
}) => {
  const [indexA, setIndexA] = useState<number>(0);
  const [indexB, setIndexB] = useState<number>(Math.max(0, trendHistory.length - 1));

  if (!trendHistory || trendHistory.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500">
        No performance trend history points available for comparison. Run queries or toggle optimizations to generate telemetry data.
      </div>
    );
  }

  const pointA = trendHistory[indexA] || trendHistory[0];
  const pointB = trendHistory[indexB] || trendHistory[trendHistory.length - 1];

  const latencyDiff = pointB.executionTimeMs - pointA.executionTimeMs;
  const latencyPercent =
    pointA.executionTimeMs > 0
      ? ((pointB.executionTimeMs - pointA.executionTimeMs) / pointA.executionTimeMs) * 100
      : 0;

  const rowsScannedDiff = pointB.rowsScanned - pointA.rowsScanned;
  const queriesDiff = pointB.activeQueriesCount - pointA.activeQueriesCount;

  const speedupFactor =
    pointB.executionTimeMs > 0
      ? pointA.executionTimeMs / pointB.executionTimeMs
      : pointA.executionTimeMs > 0
      ? 999
      : 1;

  const flagCatalog: {
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
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-blue-50/80 via-white to-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl border border-blue-200">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Latency Comparison View</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Side-by-Side Diff
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Compare two selected time windows side-by-side and analyze fetch latency variance and architectural impact.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close View
          </button>
        )}
      </div>

      {/* Window Selectors Bar */}
      <div className="p-4 bg-zinc-50 border-b border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-zinc-300 shadow-2xs">
          <span className="font-bold text-zinc-700 whitespace-nowrap">Window A (Baseline):</span>
          <select
            value={indexA}
            onChange={(e) => setIndexA(Number(e.target.value))}
            className="flex-1 bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-xs text-zinc-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {trendHistory.map((pt, idx) => (
              <option key={`a-${idx}`} value={idx}>
                [{idx + 1}] {pt.label || `Time t+${idx * 5}s`} ({pt.executionTimeMs.toFixed(1)}ms - {pt.rowsScanned.toLocaleString()} rows)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-zinc-300 shadow-2xs">
          <span className="font-bold text-zinc-700 whitespace-nowrap">Window B (Comparison):</span>
          <select
            value={indexB}
            onChange={(e) => setIndexB(Number(e.target.value))}
            className="flex-1 bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1 text-xs text-zinc-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {trendHistory.map((pt, idx) => (
              <option key={`b-${idx}`} value={idx}>
                [{idx + 1}] {pt.label || `Time t+${idx * 5}s`} ({pt.executionTimeMs.toFixed(1)}ms - {pt.rowsScanned.toLocaleString()} rows)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Variance Summary Banner */}
      <div className={`p-4 mx-6 mt-6 rounded-xl border flex items-center justify-between gap-4 ${
        latencyDiff < 0
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : latencyDiff > 0
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : 'bg-zinc-50 border-zinc-300 text-zinc-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${latencyDiff < 0 ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
            {latencyDiff < 0 ? <TrendingDown className="w-5 h-5" /> : latencyDiff > 0 ? <TrendingUp className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold">
              {latencyDiff < 0
                ? `Performance Improved by ${Math.abs(latencyDiff).toFixed(1)}ms (${Math.abs(latencyPercent).toFixed(1)}% faster)`
                : latencyDiff > 0
                ? `Latency Regressed by +${latencyDiff.toFixed(1)}ms (+${latencyPercent.toFixed(1)}% slower)`
                : 'Execution Latency is Identical between Time Windows'}
            </div>
            <div className="text-xs opacity-80 mt-0.5">
              {latencyDiff < 0 && speedupFactor > 1 ? `Speedup Factor: ${speedupFactor.toFixed(2)}x optimization gain.` : 'Review flag differences below to isolate root cause.'}
            </div>
          </div>
        </div>
        <div className="text-right font-mono text-sm font-bold">
          {latencyDiff < 0 ? `-${Math.abs(latencyDiff).toFixed(1)} ms` : `+${latencyDiff.toFixed(1)} ms`}
        </div>
      </div>

      {/* Side-by-Side Comparison Data Table */}
      <div className="p-6">
        <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <span>Side-by-Side Telemetry &amp; Latency Variance Table</span>
        </h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-700 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-200">
                <th className="py-3 px-4 font-semibold">Telemetry Metric</th>
                <th className="py-3 px-4 font-semibold bg-blue-50/50 text-blue-900">Window A: {pointA.label || `Snapshot #${indexA + 1}`}</th>
                <th className="py-3 px-4 font-semibold bg-emerald-50/50 text-emerald-900">Window B: {pointB.label || `Snapshot #${indexB + 1}`}</th>
                <th className="py-3 px-4 font-semibold text-right">Variance / Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-mono text-zinc-700">
              {/* Average Fetch Latency */}
              <tr className="hover:bg-zinc-50">
                <td className="py-3 px-4 font-sans font-semibold text-zinc-900 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Average Fetch Latency</span>
                </td>
                <td className="py-3 px-4 bg-blue-50/30 font-bold text-blue-900">
                  {pointA.executionTimeMs.toFixed(1)} ms
                </td>
                <td className="py-3 px-4 bg-emerald-50/30 font-bold text-emerald-900">
                  {pointB.executionTimeMs.toFixed(1)} ms
                </td>
                <td className={`py-3 px-4 text-right font-bold ${latencyDiff < 0 ? 'text-emerald-600' : latencyDiff > 0 ? 'text-rose-600' : 'text-zinc-600'}`}>
                  {latencyDiff < 0 ? `-${Math.abs(latencyDiff).toFixed(1)} ms (${latencyPercent.toFixed(1)}%)` : `+${latencyDiff.toFixed(1)} ms (+${latencyPercent.toFixed(1)}%)`}
                </td>
              </tr>

              {/* Rows Scanned */}
              <tr className="hover:bg-zinc-50">
                <td className="py-3 px-4 font-sans font-semibold text-zinc-900 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rows Scanned</span>
                </td>
                <td className="py-3 px-4 bg-blue-50/30">
                  {pointA.rowsScanned.toLocaleString()} rows
                </td>
                <td className="py-3 px-4 bg-emerald-50/30">
                  {pointB.rowsScanned.toLocaleString()} rows
                </td>
                <td className={`py-3 px-4 text-right font-bold ${rowsScannedDiff < 0 ? 'text-emerald-600' : rowsScannedDiff > 0 ? 'text-rose-600' : 'text-zinc-600'}`}>
                  {rowsScannedDiff === 0 ? '0' : `${rowsScannedDiff > 0 ? '+' : ''}${rowsScannedDiff.toLocaleString()} rows`}
                </td>
              </tr>

              {/* Active Queries Count */}
              <tr className="hover:bg-zinc-50">
                <td className="py-3 px-4 font-sans font-semibold text-zinc-900 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Active Query Connections</span>
                </td>
                <td className="py-3 px-4 bg-blue-50/30">
                  {pointA.activeQueriesCount} pooled
                </td>
                <td className="py-3 px-4 bg-emerald-50/30">
                  {pointB.activeQueriesCount} pooled
                </td>
                <td className="py-3 px-4 text-right font-bold text-zinc-600">
                  {queriesDiff === 0 ? '0' : `${queriesDiff > 0 ? '+' : ''}${queriesDiff}`}
                </td>
              </tr>

              {/* Cache Hit */}
              <tr className="hover:bg-zinc-50">
                <td className="py-3 px-4 font-sans font-semibold text-zinc-900 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Query Cache Status</span>
                </td>
                <td className="py-3 px-4 bg-blue-50/30">
                  {pointA.cacheHit ? <span className="text-emerald-700 font-bold">CACHE HIT</span> : <span className="text-zinc-500">Cache Miss</span>}
                </td>
                <td className="py-3 px-4 bg-emerald-50/30">
                  {pointB.cacheHit ? <span className="text-emerald-700 font-bold">CACHE HIT</span> : <span className="text-zinc-500">Cache Miss</span>}
                </td>
                <td className="py-3 px-4 text-right font-bold text-zinc-600">
                  {pointA.cacheHit === pointB.cacheHit ? 'No Change' : pointB.cacheHit ? 'Cache Enabled' : 'Cache Disabled'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Architectural Flags Comparison */}
        <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3 flex items-center gap-2">
          <span>Architectural Optimization Flags Comparison</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {flagCatalog.map((flag) => {
            const valA = pointA.flags[flag.key];
            const valB = pointB.flags[flag.key];
            const isChanged = valA !== valB;
            return (
              <div
                key={flag.key}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isChanged
                    ? 'bg-amber-50/80 border-amber-300'
                    : valB
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-900 mb-1">
                    <span>{flag.name}</span>
                    {valB ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-2">
                    {flag.description}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 text-[10px] flex items-center justify-between font-mono">
                  <span className="text-blue-700 font-semibold">A: {valA ? 'ON' : 'OFF'}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-400" />
                  <span className="text-emerald-700 font-semibold">B: {valB ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
