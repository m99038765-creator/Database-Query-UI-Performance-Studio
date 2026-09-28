import React, { useMemo } from 'react';
import { TransactionRecord, OptimizationFlags } from '../types';
import {
  X,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Clock,
  Zap
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface LatencyDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TransactionRecord[];
  flags: OptimizationFlags;
}

export const LatencyDistributionModal: React.FC<LatencyDistributionModalProps> = ({
  isOpen,
  onClose,
  records,
  flags
}) => {
  if (!isOpen) return null;

  // Compute latencies for all records
  const recordLatencies = useMemo(() => {
    return records.map((r) => {
      const itemCnt = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      const unoptMult = !flags.batchEagerLoading ? 45.0 : 8.0;
      const indexPenalty = !flags.btreeIndexing ? 55.0 : 0.0;
      const latencyMs = flags.batchEagerLoading
        ? itemCnt * 4.0 + 10.0
        : 20.0 + itemCnt * unoptMult + indexPenalty;
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        latencyMs,
        itemCount: itemCnt
      };
    });
  }, [records, flags]);

  // Statistics
  const stats = useMemo(() => {
    if (recordLatencies.length === 0) return { avg: 0, p95: 0, max: 0, outliers: 0 };
    const sorted = [...recordLatencies].sort((a, b) => a.latencyMs - b.latencyMs);
    const sum = sorted.reduce((acc, curr) => acc + curr.latencyMs, 0);
    const avg = sum / sorted.length;
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Idx]?.latencyMs || sorted[sorted.length - 1].latencyMs;
    const max = sorted[sorted.length - 1].latencyMs;
    const outliers = sorted.filter((r) => r.latencyMs > 150).length;
    return { avg, p95, max, outliers };
  }, [recordLatencies]);

  // Histogram Buckets
  const histogramData = useMemo(() => {
    const buckets = [
      { range: '< 25ms', min: 0, max: 25, count: 0, color: '#059669' },
      { range: '25-50ms', min: 25, max: 50, count: 0, color: '#10b981' },
      { range: '50-100ms', min: 50, max: 100, count: 0, color: '#d97706' },
      { range: '100-150ms', min: 100, max: 150, count: 0, color: '#f59e0b' },
      { range: '150-200ms', min: 150, max: 200, count: 0, color: '#e11d48' },
      { range: '> 200ms', min: 200, max: Infinity, count: 0, color: '#be123c' }
    ];

    for (const r of recordLatencies) {
      const b = buckets.find((bucket) => r.latencyMs >= bucket.min && r.latencyMs < bucket.max);
      if (b) {
        b.count += 1;
      } else if (r.latencyMs >= 200) {
        buckets[buckets.length - 1].count += 1;
      }
    }

    return buckets;
  }, [recordLatencies]);

  const isSystemicOutlier = stats.outliers > records.length * 0.2;

  return (
    <div
      id="latency-distribution-modal-backdrop"
      className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="latency-distribution-modal"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="latency-dist-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-300">
              <BarChart2 className="w-4 h-4" />
            </span>
            <div>
              <h2 id="latency-dist-title" className="text-base font-bold text-zinc-900">
                Database Fetch Latency Distribution Histogram
              </h2>
              <p className="text-xs text-zinc-500">
                Visualizing latency spread across {records.length.toLocaleString()} loaded records to detect systemic vs. isolated outliers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="text-xs text-zinc-500 font-medium">Average Latency</div>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                {stats.avg.toFixed(1)} <span className="text-xs font-normal text-zinc-500">ms</span>
              </div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="text-xs text-zinc-500 font-medium">P95 Latency</div>
              <div className="text-xl font-bold font-mono text-indigo-700 mt-1">
                {stats.p95.toFixed(1)} <span className="text-xs font-normal text-zinc-500">ms</span>
              </div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="text-xs text-zinc-500 font-medium">Peak Latency</div>
              <div className="text-xl font-bold font-mono text-rose-700 mt-1">
                {stats.max.toFixed(1)} <span className="text-xs font-normal text-zinc-500">ms</span>
              </div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shadow-2xs">
              <div className="text-xs text-zinc-500 font-medium">High-Impact Outliers</div>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                {stats.outliers} <span className="text-xs font-normal text-zinc-500">(&gt;150ms)</span>
              </div>
            </div>
          </div>

          {/* Diagnosis Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
              isSystemicOutlier
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <span className="p-1 rounded-full bg-white shadow-xs shrink-0 mt-0.5">
              {isSystemicOutlier ? (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </span>
            <div>
              <div className="font-bold text-sm mb-0.5">
                {isSystemicOutlier ? 'Systemic Bottleneck Detected' : 'Healthy Latency Distribution'}
              </div>
              <p className="opacity-90">
                {isSystemicOutlier
                  ? `Over 20% of records exceed 150ms latency (${stats.outliers} outliers). This indicates a systemic N+1 subquery cascade or missing index rather than isolated anomalies. Enable Batch Eager Loading or B-Tree Indexing to normalize performance.`
                  : `Latency distribution is tightly clustered with minimal outliers (${stats.outliers} records > 150ms). Database performance is stable and optimized.`}
              </p>
            </div>
          </div>

          {/* Recharts Histogram */}
          <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-200">
            <div className="text-xs font-bold text-zinc-700 mb-3 flex items-center justify-between">
              <span>Record Frequency by Latency Bucket (ms)</span>
              <span className="font-mono text-[11px] text-zinc-500">Total Samples: {records.length}</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#71717a" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#71717a" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-900 text-white p-2.5 rounded-lg shadow-xl text-xs font-mono">
                            <div className="font-bold text-amber-300">Bucket: {label}</div>
                            <div>Records: <strong className="text-white">{data.count}</strong></div>
                            <div>Percentage: <strong className="text-emerald-300">{((data.count / records.length) * 100).toFixed(1)}%</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Recharts Distribution Histogram &amp; Outlier Analyzer.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
