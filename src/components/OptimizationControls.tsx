import React from 'react';
import { OptimizationFlags } from '../types';
import { Check, X, Layers, Cpu, Database, Eye, Gauge } from 'lucide-react';

interface OptimizationControlsProps {
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
}

export const OptimizationControls: React.FC<OptimizationControlsProps> = ({
  flags,
  onToggleFlag
}) => {
  const controls = [
    {
      key: 'batchEagerLoading' as keyof OptimizationFlags,
      title: 'Batch Eager Loading',
      badge: 'Database Fix',
      icon: Database,
      active: flags.batchEagerLoading,
      problem: 'N+1 subqueries exhaust connection pool (25+ connections timeout)',
      solution: 'Single batched IN (?) query reduces roundtrips from 100+ to 2'
    },
    {
      key: 'btreeIndexing' as keyof OptimizationFlags,
      title: 'B-Tree Indexing',
      badge: 'Query Optimizer',
      icon: Layers,
      active: flags.btreeIndexing,
      problem: 'Full sequential scan examines all 50,000 rows (1,200ms+ latency)',
      solution: 'Composite idx_orders_status_cat index seeks <35 rows in 1.4ms'
    },
    {
      key: 'queryCaching' as keyof OptimizationFlags,
      title: 'LRU Query Cache',
      badge: 'Memory Cache',
      icon: Gauge,
      active: flags.queryCaching,
      problem: 'Redundant query execution recalculates identical result sets on every request',
      solution: 'In-memory LRU cache serves frequent reads with 0.15ms instant cache hits'
    },
    {
      key: 'virtualizedDOM' as keyof OptimizationFlags,
      title: 'DOM Virtualization',
      badge: 'UI Rendering Lag Fix',
      icon: Eye,
      active: flags.virtualizedDOM,
      problem: 'Rendering 2,000+ DOM cards drops frame rate to 12 FPS and freezes browser',
      solution: 'Windowing renders only ~14 visible viewport rows, sustaining 60 FPS'
    },
    {
      key: 'deferredRendering' as keyof OptimizationFlags,
      title: 'Deferred Transitions',
      badge: 'UI Concurrency',
      icon: Cpu,
      active: flags.deferredRendering,
      problem: 'Synchronous filter recalculations block main thread during rapid user typing',
      solution: 'React 19 useDeferredValue keeps input instant with zero keyboard stutter'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
            Active Architectural Optimizations
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Toggle individual database and UI techniques to benchmark their isolated impact on performance
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-800">
            {Object.values(flags).filter(Boolean).length} / 5
          </span>
          <span>Optimizations Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {controls.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              id={`toggle-${item.key}`}
              type="button"
              onClick={() => onToggleFlag(item.key)}
              className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer relative flex flex-col justify-between ${
                item.active
                  ? 'bg-emerald-50/50 border-emerald-300 hover:border-emerald-400'
                  : 'bg-zinc-50/80 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      item.active ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      item.active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {item.active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {item.active ? 'Optimized' : 'Unoptimized'}
                  </span>
                </div>

                <div className="font-semibold text-sm text-zinc-900 leading-snug">
                  {item.title}
                </div>
                <div className="text-[11px] font-medium text-zinc-500 mb-2">
                  {item.badge}
                </div>

                <p className="text-xs text-zinc-600 line-clamp-3">
                  {item.active ? item.solution : item.problem}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-200/70 text-[11px] font-medium text-right">
                <span className={item.active ? 'text-emerald-700' : 'text-zinc-500'}>
                  Click to {item.active ? 'disable' : 'enable'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
