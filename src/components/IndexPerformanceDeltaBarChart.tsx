import React, { useState } from 'react';
import {
  TrendingDown,
  Activity,
  Zap,
  Clock,
  Sparkles,
  BarChart2,
  ArrowRight,
  Database,
  Target
} from 'lucide-react';
import { DEFAULT_INDEX_PROFILES } from './IndexEfficiencyTrendChart';

interface IndexPerformanceDeltaBarChartProps {
  selectedIndexId?: string;
  onSelectIndexId?: (id: string) => void;
}

export const IndexPerformanceDeltaBarChart: React.FC<IndexPerformanceDeltaBarChartProps> = ({
  selectedIndexId = 'idx_transactions_email_status',
  onSelectIndexId
}) => {
  const profileKeys = Object.keys(DEFAULT_INDEX_PROFILES);
  const activeKey = DEFAULT_INDEX_PROFILES[selectedIndexId] ? selectedIndexId : profileKeys[0];
  const profile = DEFAULT_INDEX_PROFILES[activeKey] || DEFAULT_INDEX_PROFILES['idx_transactions_email_status'];

  const [activeWindow, setActiveWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const trendData = activeWindow === '30d' ? profile.trend30d : activeWindow === '7d' ? profile.trend7d : profile.trend24h;
  const latestPoint = trendData[trendData.length - 1] || {
    latencyBeforeMs: profile.baseLatencyMs,
    latencyAfterMs: profile.optimizedLatencyMs,
    speedupMultiplier: profile.baseLatencyMs / profile.optimizedLatencyMs,
    usageFrequencyPerHour: 10000
  };

  const beforeMs = latestPoint.latencyBeforeMs;
  const afterMs = latestPoint.latencyAfterMs;
  const maxMs = Math.max(beforeMs, 1000); // scale max
  const beforePct = Math.min(100, (beforeMs / maxMs) * 100);
  const afterPct = Math.max(3, Math.min(100, (afterMs / maxMs) * 100));
  const speedup = latestPoint.speedupMultiplier.toFixed(1);

  return (
    <div
      id="performance-delta-bar-chart-panel"
      data-testid="performance-delta-bar-chart-panel"
      className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-3"
    >
      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
            <BarChart2 className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Performance Delta: With vs. Without Index
            </h4>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Query execution time comparative analysis powered by historical telemetry.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['24h', '7d', '30d'] as const).map((win) => (
            <button
              key={win}
              type="button"
              onClick={() => setActiveWindow(win)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                activeWindow === win
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              {win}
            </button>
          ))}
        </div>
      </div>

      {/* Index Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {profileKeys.map((key) => {
          const p = DEFAULT_INDEX_PROFILES[key];
          const isSelected = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectIndexId?.(key)}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer truncate ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300 text-indigo-950 font-bold shadow-2xs'
                  : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700 font-medium'
              }`}
              title={p.name}
            >
              <div className="text-[10px] font-mono truncate">{p.name}</div>
              <div className="text-[9px] text-zinc-500 truncate">{p.targetTable}</div>
            </button>
          );
        })}
      </div>

      {/* Selected Index Summary & SQL Key Query */}
      <div className="p-2.5 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-[11px] space-y-1.5 border border-zinc-800">
        <div className="flex items-center justify-between text-[10px] text-zinc-400">
          <span className="font-sans font-bold text-indigo-300">{profile.name} ({profile.type})</span>
          <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
            ⚡ {speedup}x Faster
          </span>
        </div>
        <code className="text-emerald-300 block text-[10px] truncate">{profile.keyQuery}</code>
      </div>

      {/* Bar Chart Comparison */}
      <div className="space-y-2.5 pt-1">
        {/* Without Index Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-zinc-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>Without Index (Sequential Scan)</span>
            </span>
            <span className="font-mono font-bold text-rose-700">{beforeMs.toFixed(1)} ms</span>
          </div>
          <div className="w-full bg-zinc-100 h-4 rounded-lg overflow-hidden p-0.5 border border-zinc-200">
            <div
              className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2 text-[10px] font-mono font-bold text-white shadow-xs"
              style={{ width: `${beforePct}%` }}
            >
              {beforeMs.toFixed(1)}ms
            </div>
          </div>
        </div>

        {/* With Index Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-zinc-700 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>With Index (B-Tree Seek Scan)</span>
            </span>
            <span className="font-mono font-bold text-emerald-700">{afterMs.toFixed(1)} ms</span>
          </div>
          <div className="w-full bg-zinc-100 h-4 rounded-lg overflow-hidden p-0.5 border border-zinc-200">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2 text-[10px] font-mono font-bold text-white shadow-xs"
              style={{ width: `${Math.max(15, afterPct)}%` }}
            >
              {afterMs.toFixed(1)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Delta Metrics Footer */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-center">
        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-950">
          <span className="text-zinc-500 block font-sans">Latency Saved</span>
          <strong className="text-emerald-700 font-extrabold text-xs">
            -{(beforeMs - afterMs).toFixed(1)} ms
          </strong>
        </div>
        <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-200 text-indigo-950">
          <span className="text-zinc-500 block font-sans">Speedup Ratio</span>
          <strong className="text-indigo-700 font-extrabold text-xs">
            {speedup}x
          </strong>
        </div>
        <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-purple-950">
          <span className="text-zinc-500 block font-sans">Hourly Invocations</span>
          <strong className="text-purple-700 font-extrabold text-xs">
            {latestPoint.usageFrequencyPerHour.toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  );
};
