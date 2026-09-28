import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

interface LatencyLegendProps {
  showLatencyHeatmap?: boolean;
}

export const LatencyLegend: React.FC<LatencyLegendProps> = ({
  showLatencyHeatmap = true
}) => {
  if (!showLatencyHeatmap) return null;

  return (
    <div
      id="latency-legend-bar"
      className="bg-white rounded-xl border border-zinc-200 px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-3 animate-fadeIn"
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-zinc-100 rounded-lg text-zinc-700">
          <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
        </div>
        <div>
          <span className="font-bold text-zinc-900">Latency Heatmap Legend:</span>
          <span className="text-zinc-500 ml-1">Color-coded performance thresholds per database fetch operation</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Green threshold */}
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-emerald-900 font-mono text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold">&lt; 50ms</span>
          <span className="text-emerald-700 font-sans text-[10px]">(Optimal Index Seek)</span>
        </div>

        {/* Yellow threshold */}
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md text-amber-900 font-mono text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="font-semibold">50ms – 150ms</span>
          <span className="text-amber-700 font-sans text-[10px]">(Moderate Scan)</span>
        </div>

        {/* Red threshold */}
        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-rose-900 font-mono text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 animate-pulse" />
          <span className="font-semibold">&gt; 150ms / Outlier</span>
          <span className="text-rose-700 font-sans text-[10px]">(N+1 / Full Scan Bottleneck)</span>
        </div>
      </div>
    </div>
  );
};
