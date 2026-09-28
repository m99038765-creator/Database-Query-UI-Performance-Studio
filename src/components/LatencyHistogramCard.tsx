import React, { useMemo } from 'react';
import { TransactionRecord, OptimizationFlags } from '../types';
import { executeQuery } from '../db/databaseEngine';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface LatencyHistogramCardProps {
  records?: TransactionRecord[];
  flags?: OptimizationFlags;
}

export const LatencyHistogramCard: React.FC<LatencyHistogramCardProps> = ({
  records: propRecords,
  flags: propFlags
}) => {
  const queryResult = useMemo(() => {
    if (propRecords && propFlags) return null;
    return executeQuery({
      searchTerm: '',
      category: 'all',
      status: 'all',
      page: 1,
      pageSize: 5000
    }, propFlags || {
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true
    });
  }, [propRecords, propFlags]);

  const records = propRecords || queryResult?.records || [];
  const flags = propFlags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true
  };

  // Compute fetch latencies for all records
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

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900">
              Fetch Latency Distribution Histogram
            </h2>
            <span className="text-[11px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
              Recharts Frequency Analysis
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Frequency of fetch latency buckets across {records.length.toLocaleString()} loaded records
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
            <span className="text-zinc-500">Avg:</span> <strong className="text-zinc-900">{stats.avg.toFixed(1)}ms</strong>
          </div>
          <div className="bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
            <span className="text-zinc-500">P95:</span> <strong className="text-indigo-700">{stats.p95.toFixed(1)}ms</strong>
          </div>
        </div>
      </div>

      <div className="h-64 w-full bg-zinc-50/60 p-3 rounded-xl border border-zinc-200/80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#71717a" />
            <YAxis tick={{ fontSize: 11 }} stroke="#71717a" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const pct = records.length > 0 ? ((data.count / records.length) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-zinc-900 text-white p-2.5 rounded-lg shadow-xl text-xs font-mono">
                      <div className="font-bold text-amber-300">Latency Bucket: {label}</div>
                      <div>Record Count: <strong className="text-white">{data.count.toLocaleString()}</strong></div>
                      <div>Distribution Share: <strong className="text-emerald-300">{pct}%</strong></div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {histogramData.map((entry, index) => (
                <Cell key={`cell-hist-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-zinc-100 text-xs">
        <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
          <div className="text-zinc-500 text-[11px]">Fast (&lt;50ms)</div>
          <div className="font-bold font-mono text-emerald-700 mt-0.5">
            {histogramData[0].count + histogramData[1].count} records
          </div>
        </div>
        <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
          <div className="text-zinc-500 text-[11px]">Moderate (50-150ms)</div>
          <div className="font-bold font-mono text-amber-700 mt-0.5">
            {histogramData[2].count + histogramData[3].count} records
          </div>
        </div>
        <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
          <div className="text-zinc-500 text-[11px]">Outliers (&gt;150ms)</div>
          <div className="font-bold font-mono text-rose-700 mt-0.5">
            {histogramData[4].count + histogramData[5].count} records
          </div>
        </div>
      </div>
    </div>
  );
};
