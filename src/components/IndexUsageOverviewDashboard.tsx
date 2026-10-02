import React, { useState } from 'react';
import { BarChart2, ArrowUpRight, ShieldAlert, Sparkles, Database, CheckCircle2, AlertTriangle, TrendingUp, Filter } from 'lucide-react';

interface IndexUsageOverviewDashboardProps {
  tables: any[];
  lockedIndexes: string[];
  createdCompositeIndexes: string[];
  createdCustomIndexes: string[];
}

export const IndexUsageOverviewDashboard: React.FC<IndexUsageOverviewDashboardProps> = ({
  tables,
  lockedIndexes,
  createdCompositeIndexes,
  createdCustomIndexes
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'amplified' | 'efficient'>('all');
  const [showUsageHeatmap, setShowUsageHeatmap] = useState<boolean>(true);
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);

  // Aggregate index usage metrics across all tables
  const indexUsageData: Array<{
    name: string;
    targetTable: string;
    reads: number;
    writes: number;
    ratio: number;
    status: 'optimal' | 'write-amplification' | 'under-utilized';
    isAi: boolean;
    isLocked: boolean;
  }> = [];

  tables.forEach((tbl) => {
    tbl.indexes.forEach((idx: any, idxIndex: number) => {
      const isAi = createdCompositeIndexes.includes(idx.name) || createdCustomIndexes.includes(idx.name) || idx.name.includes('idx_');
      const isLocked = lockedIndexes.includes(idx.name);
      
      // Simulate realistic read/write stats based on index characteristics
      const seedVal = (idx.name.charCodeAt(0) + idxIndex * 37) % 100;
      const reads = isAi ? 45000 + (seedVal * 1200) : 12000 + (seedVal * 400);
      const writes = isAi ? 1500 + (seedVal * 45) : 3000 + (seedVal * 150); // manual or secondary indexes often have higher write overhead
      const ratio = Number((reads / Math.max(1, writes)).toFixed(1));
      
      let status: 'optimal' | 'write-amplification' | 'under-utilized' = 'optimal';
      if (ratio < 3) {
        status = 'write-amplification';
      } else if (reads < 5000) {
        status = 'under-utilized';
      }

      indexUsageData.push({
        name: idx.name,
        targetTable: tbl.name,
        reads,
        writes,
        ratio,
        status,
        isAi,
        isLocked
      });
    });
  });

  const filteredIndexes = indexUsageData.filter((item) => {
    if (filterMode === 'amplified') return item.status === 'write-amplification';
    if (filterMode === 'efficient') return item.status === 'optimal';
    return true;
  });

  const maxReads = Math.max(...indexUsageData.map((i) => i.reads), 100000);
  const maxWrites = Math.max(...indexUsageData.map((i) => i.writes), 10000);

  const amplifiedCount = indexUsageData.filter((i) => i.status === 'write-amplification').length;
  const optimalCount = indexUsageData.filter((i) => i.status === 'optimal').length;

  return (
    <div
      id="index-usage-overview-dashboard"
      data-testid="index-usage-overview-dashboard"
      className="space-y-4 animate-fadeIn"
    >
      {/* Header Banner */}
      <div className="p-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-indigo-950">
          <BarChart2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <span className="font-bold">Index Usage &amp; Write Amplification Overview</span>
            <p className="text-[11px] text-indigo-800 mt-0.5">
              Comparing Reads vs. Writes per index to detect over-indexed tables and unnecessary write overhead.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-dashboard-usage-heatmap"
            data-testid="btn-dashboard-usage-heatmap"
            onClick={() => setShowUsageHeatmap(!showUsageHeatmap)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
              showUsageHeatmap
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white hover:bg-zinc-50 border-indigo-300 text-indigo-900'
            }`}
            title="Toggle Usage Heatmap: Highlights Read Heavy (Green) vs Write Heavy (Red) indexes"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Usage Heatmap: {showUsageHeatmap ? 'ON' : 'OFF'}</span>
          </button>
          <span className="font-mono text-[10px] font-bold bg-indigo-200 text-indigo-950 px-2 py-1 rounded-lg border border-indigo-300 shrink-0">
            {indexUsageData.length} Indexes
          </span>
        </div>
      </div>

      {/* Usage Heatmap Legend Banner */}
      {showUsageHeatmap && (
        <div
          id="dashboard-usage-heatmap-legend"
          data-testid="dashboard-usage-heatmap-legend"
          className="p-2.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-rose-50/90 border border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <strong className="text-zinc-900 font-semibold">Usage Heatmap Active:</strong>
            <span className="text-zinc-600 text-[11px]">Indexes colored by read-to-write ratio</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Read Heavy (Green)</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              <span>Write Heavy (Red)</span>
            </span>
          </div>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>Optimal Read/Write Ratio</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-mono font-bold text-emerald-700 mt-1">{optimalCount}</div>
          <p className="text-[10px] text-zinc-400 mt-0.5">High read query acceleration</p>
        </div>
        <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>Write Amplification Risk</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-mono font-bold text-amber-700 mt-1">{amplifiedCount}</div>
          <p className="text-[10px] text-zinc-400 mt-0.5">High write cost / low read ROI</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 text-xs">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            filterMode === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          All ({indexUsageData.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('amplified')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            filterMode === 'amplified' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Write Heavy ({amplifiedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('efficient')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            filterMode === 'efficient' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Optimal ({optimalCount})
        </button>
      </div>

      {/* Reads vs Writes Bar Chart & Index List */}
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filteredIndexes.map((item, idx) => {
          const readPct = Math.min(100, Math.round((item.reads / maxReads) * 100));
          const writePct = Math.min(100, Math.round((item.writes / maxWrites) * 100));
          const isHovered = hoveredIndex === item.name;
          const isReadHeavy = item.ratio >= 3;

          return (
            <div
              key={item.name + idx}
              onMouseEnter={() => setHoveredIndex(item.name)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`p-3 rounded-xl border transition-all ${
                isHovered
                  ? 'border-indigo-400 bg-indigo-50/50 shadow-md ring-2 ring-indigo-300'
                  : showUsageHeatmap
                  ? isReadHeavy
                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200/80 shadow-2xs'
                    : 'border-rose-300 bg-rose-50/60 ring-1 ring-rose-200/80 shadow-2xs'
                  : 'border-zinc-200 bg-white shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-mono font-bold text-zinc-900 truncate max-w-[180px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200 shrink-0">
                    {item.targetTable}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-2xs flex items-center gap-1 ${
                    showUsageHeatmap
                      ? isReadHeavy
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-extrabold'
                        : 'bg-rose-100 text-rose-950 border-rose-400 font-extrabold'
                      : item.status === 'write-amplification'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isReadHeavy ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    <span>
                      {showUsageHeatmap
                        ? isReadHeavy
                          ? `Read Heavy (${item.ratio}x)`
                          : `Write Heavy (${item.ratio}x)`
                        : item.status === 'write-amplification'
                        ? 'Write Heavy (Ratio < 3)'
                        : `Ratio: ${item.ratio}x`}
                    </span>
                  </span>
                </div>
              </div>

              {/* Bar Comparison: Reads (Green/Emerald) vs Writes (Red/Rose) */}
              <div className="space-y-1.5 font-mono text-[10px]">
                {/* Reads Bar */}
                <div className="flex items-center gap-2">
                  <span className="w-12 text-zinc-500 text-right">Reads:</span>
                  <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${showUsageHeatmap ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${readPct}%` }}
                    />
                  </div>
                  <span className={`w-14 font-bold text-right ${showUsageHeatmap ? 'text-emerald-900' : 'text-indigo-900'}`}>
                    {item.reads.toLocaleString()}
                  </span>
                </div>

                {/* Writes Bar */}
                <div className="flex items-center gap-2">
                  <span className="w-12 text-zinc-500 text-right">Writes:</span>
                  <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${showUsageHeatmap ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${writePct}%` }}
                    />
                  </div>
                  <span className={`w-14 font-bold text-right ${showUsageHeatmap ? 'text-rose-900' : 'text-amber-900'}`}>
                    {item.writes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
