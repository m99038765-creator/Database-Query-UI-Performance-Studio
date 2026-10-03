import React, { useState, useMemo } from 'react';
import { LatencyTrendPoint } from '../types';
import { Activity, Clock, Filter, Search, Zap, ArrowRight, CheckCircle2, AlertTriangle, Layers, RotateCcw } from 'lucide-react';

interface LatencyDrilldownComponentProps {
  trendHistory: LatencyTrendPoint[];
  onFilterVirtualizedTable: (searchQuery: string) => void;
  onNavigateToGrid: () => void;
}

export const LatencyDrilldownComponent: React.FC<LatencyDrilldownComponentProps> = ({
  trendHistory = [],
  onFilterVirtualizedTable,
  onNavigateToGrid
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    trendHistory.length > 0 ? trendHistory.length - 1 : null
  );
  const [drilldownSearchTerm, setDrilldownSearchTerm] = useState<string>('');

  const selectedPoint = useMemo(() => {
    if (selectedIndex !== null && trendHistory[selectedIndex]) {
      return trendHistory[selectedIndex];
    }
    return trendHistory[trendHistory.length - 1] || null;
  }, [selectedIndex, trendHistory]);

  const filteredHistory = useMemo(() => {
    if (!drilldownSearchTerm.trim()) return trendHistory;
    const q = drilldownSearchTerm.toLowerCase();
    return trendHistory.filter(
      (p) =>
        p.timeFormatted.toLowerCase().includes(q) ||
        p.triggerEvent.toLowerCase().includes(q) ||
        p.executionTimeMs.toString().includes(q) ||
        p.rowsScanned.toString().includes(q)
    );
  }, [trendHistory, drilldownSearchTerm]);

  return (
    <div
      id="latency-drilldown-panel"
      data-testid="latency-drilldown-panel"
      className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden mb-6"
    >
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/80 rounded-xl text-white shadow-inner">
            <Activity className="w-5 h-5 text-indigo-200 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-wide text-white flex items-center gap-2">
              <span>Latency Drilldown &amp; Query Interval Inspector</span>
              <span className="font-mono text-[10px] bg-indigo-500/40 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                {trendHistory.length} Recorded Intervals
              </span>
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              Select any point on the performance trend line to inspect executing queries and immediately filter the VirtualizedTable.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              id="input-drilldown-search"
              data-testid="input-drilldown-search"
              value={drilldownSearchTerm}
              onChange={(e) => setDrilldownSearchTerm(e.target.value)}
              placeholder="Search time or event..."
              className="pl-8 pr-3 py-1.5 bg-indigo-950/80 border border-indigo-800/80 rounded-xl text-xs text-white placeholder-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
        {/* Left: Trend Points List */}
        <div className="lg:col-span-5 p-4 max-h-[380px] overflow-y-auto space-y-2 bg-zinc-50/50">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-600 px-1 pb-1">
            <span>Performance Trend Points</span>
            <span>Latency / Status</span>
          </div>
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              No matching trend points found.
            </div>
          ) : (
            filteredHistory.map((point, idx) => {
              const originalIndex = trendHistory.findIndex((p) => p.id === point.id);
              const isSelected = selectedIndex === originalIndex;
              const isHighLatency = point.executionTimeMs > 100;
              return (
                <div
                  key={`drilldown-pt-${point.id}`}
                  onClick={() => setSelectedIndex(originalIndex)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300 shadow-xs'
                      : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      {point.timeFormatted}
                    </span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        isHighLatency
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {point.executionTimeMs.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="text-zinc-600 truncate text-[11px] font-medium">
                    {point.triggerEvent}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-400 font-mono">
                    <span>Rows: {point.rowsScanned.toLocaleString()}</span>
                    <span>Active Qs: {point.activeQueriesCount}</span>
                    <span className={point.cacheHit ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {point.cacheHit ? '⚡ Cache Hit' : '💾 Disk Scan'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Point Detail & Immediate Table Filter Action */}
        <div className="lg:col-span-7 p-5 flex flex-col justify-between bg-white">
          {selectedPoint ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                    Selected Interval Inspector
                  </span>
                  <h3 className="text-sm font-extrabold text-zinc-900 flex items-center gap-2 mt-0.5">
                    <span>{selectedPoint.timeFormatted}</span>
                    <span className="font-mono text-xs font-normal text-zinc-500">({selectedPoint.id})</span>
                  </h3>
                </div>
                <button
                  type="button"
                  id="btn-filter-table-from-drilldown"
                  data-testid="btn-filter-table-from-drilldown"
                  onClick={() => {
                    // Filter VirtualizedTable by trigger event or timestamp keyword
                    onFilterVirtualizedTable(selectedPoint.triggerEvent);
                    onNavigateToGrid();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md hover:shadow-indigo-500/25"
                  title="Filter VirtualizedTable to show queries executing during this interval"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter VirtualizedTable</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Latency</span>
                  <div className="text-base font-mono font-extrabold text-zinc-900 mt-0.5">
                    {selectedPoint.executionTimeMs.toFixed(1)}ms
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rows Scanned</span>
                  <div className="text-base font-mono font-extrabold text-zinc-900 mt-0.5">
                    {selectedPoint.rowsScanned.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Active Queries</span>
                  <div className="text-base font-mono font-extrabold text-zinc-900 mt-0.5">
                    {selectedPoint.activeQueriesCount}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cache Status</span>
                  <div className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-1">
                    {selectedPoint.cacheHit ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Hit
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Miss
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-700">Trigger Event &amp; Query Context:</span>
                <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-xl text-xs font-mono text-indigo-950">
                  {selectedPoint.triggerEvent}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-700">Active Optimization Flags During Interval:</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selectedPoint.flags || {}).map(([flagKey, enabled]) => (
                    <span
                      key={`flag-${flagKey}`}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${
                        enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-200 line-through'
                      }`}
                    >
                      {flagKey}: {enabled ? 'ON' : 'OFF'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-zinc-400 text-xs">
              Select a trend point from the left to inspect queries and filter the table.
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>💡 Clicking &quot;Filter VirtualizedTable&quot; immediately switches to the Grid View and applies the interval query filter.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
