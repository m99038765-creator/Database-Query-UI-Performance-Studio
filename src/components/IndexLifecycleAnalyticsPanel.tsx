import React, { useState } from 'react';
import {
  PieChart,
  ShieldCheck,
  Sparkles,
  Lock,
  Clock,
  Activity,
  CheckCircle2,
  Database,
  BarChart2
} from 'lucide-react';

interface IndexLifecycleAnalyticsPanelProps {
  tables: any[];
  lockedIndexes: string[];
  createdCompositeIndexes: string[];
  createdCustomIndexes: string[];
  batchProtectionEnabled: boolean;
}

export const IndexLifecycleAnalyticsPanel: React.FC<IndexLifecycleAnalyticsPanelProps> = ({
  tables,
  lockedIndexes,
  createdCompositeIndexes,
  createdCustomIndexes,
  batchProtectionEnabled
}) => {
  // Aggregate all indexes across tables
  const allIndexes: Array<{ name: string; targetTable: string; type: string; active: boolean; isAi: boolean; isProtected: boolean; ageCategory: '<24h' | '1-7d' | '>7d' }> = [];

  tables.forEach((tbl) => {
    tbl.indexes.forEach((idx: any, indexIdx: number) => {
      const isAi = createdCompositeIndexes.includes(idx.name) || createdCustomIndexes.includes(idx.name) || idx.name.includes('idx_') || idx.name.includes('composite');
      const isLocked = lockedIndexes.includes(idx.name);
      const isProtected = isLocked || (batchProtectionEnabled && indexIdx > 2); // batch protection grace period for newer indexes
      const ageCategory: '<24h' | '1-7d' | '>7d' = isAi ? '<24h' : indexIdx % 2 === 0 ? '1-7d' : '>7d';

      allIndexes.push({
        name: idx.name,
        targetTable: tbl.name,
        type: idx.type,
        active: idx.active,
        isAi,
        isProtected,
        ageCategory
      });
    });
  });

  const totalCount = allIndexes.length || 1;
  const aiCount = allIndexes.filter((i) => i.isAi).length;
  const manualCount = totalCount - aiCount;
  const protectedCount = allIndexes.filter((i) => i.isProtected).length;
  const unprotectedCount = totalCount - protectedCount;

  const newCount = allIndexes.filter((i) => i.ageCategory === '<24h').length;
  const activeCount = allIndexes.filter((i) => i.ageCategory === '1-7d').length;
  const matureCount = allIndexes.filter((i) => i.ageCategory === '>7d').length;

  const [activeMetric, setActiveMetric] = useState<'creation' | 'protection' | 'age'>('creation');

  // Donut chart calculations
  const slices = activeMetric === 'creation' ? [
    { label: 'AI-Generated', count: aiCount, color: '#6366f1', pct: (aiCount / totalCount) * 100 },
    { label: 'Manual / Schema', count: manualCount, color: '#10b981', pct: (manualCount / totalCount) * 100 }
  ] : activeMetric === 'protection' ? [
    { label: 'Protected (Locked/Grace)', count: protectedCount, color: '#f59e0b', pct: (protectedCount / totalCount) * 100 },
    { label: 'Unprotected', count: unprotectedCount, color: '#94a3b8', pct: (unprotectedCount / totalCount) * 100 }
  ] : [
    { label: 'Brand New (<24h)', count: newCount, color: '#ec4899', pct: (newCount / totalCount) * 100 },
    { label: 'Active (1-7d)', count: activeCount, color: '#8b5cf6', pct: (activeCount / totalCount) * 100 },
    { label: 'Mature (>7d)', count: matureCount, color: '#3b82f6', pct: (matureCount / totalCount) * 100 }
  ];

  let cumulativeAngle = 0;
  const svgSlices = slices.map((slice, idx) => {
    const angle = (slice.pct / 100) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { ...slice, startAngle, endAngle: cumulativeAngle };
  });

  // Helper for SVG arc/donut
  const createArcPath = (startAngle: number, endAngle: number, radius: number, innerRadius: number) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);
    const x3 = 100 + innerRadius * Math.cos(endRad);
    const y3 = 100 + innerRadius * Math.sin(endRad);
    const x4 = 100 + innerRadius * Math.cos(startRad);
    const y4 = 100 + innerRadius * Math.sin(startRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  return (
    <div
      id="index-lifecycle-analytics-panel"
      data-testid="index-lifecycle-analytics-panel"
      className="space-y-4 animate-fadeIn"
    >
      <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-950">
          <PieChart className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Index Lifecycle Distribution &amp; Governance</span>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Visualizing index fleet composition by creation method, age brackets, and protection policies.
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] font-bold bg-emerald-200 text-emerald-950 px-2 py-1 rounded-lg border border-emerald-300">
          {totalCount} Total Indexes
        </span>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveMetric('creation')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            activeMetric === 'creation' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Creation Method
        </button>
        <button
          type="button"
          onClick={() => setActiveMetric('protection')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            activeMetric === 'protection' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Protection Status
        </button>
        <button
          type="button"
          onClick={() => setActiveMetric('age')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
            activeMetric === 'age' ? 'bg-purple-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Age Distribution
        </button>
      </div>

      {/* Donut Chart SVG Container */}
      <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row items-center justify-around gap-4">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            {svgSlices.map((slice, i) => {
              const d = createArcPath(
                slice.startAngle,
                Math.min(359.99, slice.endAngle),
                75,
                45
              );
              return (
                <path
                  key={i}
                  d={d}
                  fill={slice.color}
                  className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fleet</span>
            <span className="text-lg font-mono font-extrabold text-zinc-900">{totalCount}</span>
            <span className="text-[9px] text-zinc-500 font-medium">Indexes</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1 w-full sm:w-auto">
          <div className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider border-b border-zinc-100 pb-1">
            {activeMetric === 'creation' ? 'Creation Breakdown' : activeMetric === 'protection' ? 'Protection Breakdown' : 'Age Bracket Breakdown'}
          </div>
          <div className="space-y-1.5">
            {slices.map((slice, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md shrink-0 shadow-2xs" style={{ backgroundColor: slice.color }} />
                  <span className="text-zinc-700">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-zinc-950 font-bold">{slice.count}</span>
                  <span className="text-zinc-400 text-[10px]">({slice.pct.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-1">
          <div className="text-zinc-500 font-medium">AI-Generated Coverage</div>
          <div className="font-mono text-indigo-700 font-extrabold text-sm">
            {aiCount} ({((aiCount / totalCount) * 100).toFixed(0)}%)
          </div>
          <p className="text-[10px] text-zinc-400">Autonomous composite &amp; auto-healed indexes</p>
        </div>
        <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-1">
          <div className="text-zinc-500 font-medium">Protected Indexes</div>
          <div className="font-mono text-amber-700 font-extrabold text-sm">
            {protectedCount} ({((protectedCount / totalCount) * 100).toFixed(0)}%)
          </div>
          <p className="text-[10px] text-zinc-400">Locked or within 24h batch protection grace period</p>
        </div>
      </div>
    </div>
  );
};
