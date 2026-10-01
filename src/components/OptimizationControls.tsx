import React, { useState, useEffect } from 'react';
import { OptimizationFlags } from '../types';
import { Check, X, Layers, Cpu, Database, Eye, Gauge, Bookmark, Plus, Trash2, Sparkles, Sliders, Clock } from 'lucide-react';

interface OptimizationControlsProps {
  flags?: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onResetAll?: () => void;
  onApplyFlags?: (flags: OptimizationFlags) => void;
}

interface ScenarioPreset {
  name: string;
  flags: OptimizationFlags;
}

const PREDEFINED_PRESETS: ScenarioPreset[] = [
  {
    name: '🚀 Production Best (All On)',
    flags: {
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true,
    }
  },
  {
    name: '⚠️ Legacy Unoptimized (All Off)',
    flags: {
      batchEagerLoading: false,
      btreeIndexing: false,
      queryCaching: false,
      virtualizedDOM: false,
      deferredRendering: false,
    }
  },
  {
    name: '💾 Database Bottleneck (No Indexes)',
    flags: {
      batchEagerLoading: false,
      btreeIndexing: false,
      queryCaching: true,
      virtualizedDOM: true,
      deferredRendering: true,
    }
  },
  {
    name: '🎨 UI Stutter (No Virtualization)',
    flags: {
      batchEagerLoading: true,
      btreeIndexing: true,
      queryCaching: true,
      virtualizedDOM: false,
      deferredRendering: false,
    }
  }
];

export const OptimizationControls: React.FC<OptimizationControlsProps> = ({
  flags,
  onToggleFlag,
  onResetAll,
  onApplyFlags
}) => {
  const safeFlags = flags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  };

  const [customPresets, setCustomPresets] = useState<ScenarioPreset[]>(() => {
    try {
      const saved = localStorage.getItem('enterprise_custom_optimization_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [maxConcurrencyLimit, setMaxConcurrencyLimit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_query_concurrency_limit');
      return saved ? Number(saved) : 10;
    } catch {
      return 10;
    }
  });

  const [governorMemoryLimitMb, setGovernorMemoryLimitMb] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_governor_memory_limit_mb');
      return saved ? Number(saved) : 384;
    } catch {
      return 384;
    }
  });

  const [governorCpuLimitPct, setGovernorCpuLimitPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_governor_cpu_limit_pct');
      return saved ? Number(saved) : 80;
    } catch {
      return 80;
    }
  });

  const [diskTier, setDiskTier] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('enterprise_global_disk_tier');
      return saved || 'NVMe';
    } catch {
      return 'NVMe';
    }
  });

  const handleDiskTierChange = (tier: string) => {
    setDiskTier(tier);
    try {
      localStorage.setItem('enterprise_global_disk_tier', tier);
    } catch (e) {
      console.error(e);
    }
  };

  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('enterprise_maintenance_window_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [maintenanceStartHour, setMaintenanceStartHour] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_maintenance_start_hour');
      return saved !== null ? Number(saved) : 2; // 02:00 UTC
    } catch {
      return 2;
    }
  });

  const [maintenanceEndHour, setMaintenanceEndHour] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_maintenance_end_hour');
      return saved !== null ? Number(saved) : 6; // 06:00 UTC
    } catch {
      return 6;
    }
  });

  const handleToggleMaintenance = (enabled: boolean) => {
    setMaintenanceEnabled(enabled);
    try {
      localStorage.setItem('enterprise_maintenance_window_enabled', JSON.stringify(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMaintenanceStartChange = (hour: number) => {
    setMaintenanceStartHour(hour);
    try {
      localStorage.setItem('enterprise_maintenance_start_hour', String(hour));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMaintenanceEndChange = (hour: number) => {
    setMaintenanceEndHour(hour);
    try {
      localStorage.setItem('enterprise_maintenance_end_hour', String(hour));
    } catch (e) {
      console.error(e);
    }
  };

  const handleConcurrencyChange = (val: number) => {
    setMaxConcurrencyLimit(val);
    try {
      localStorage.setItem('enterprise_query_concurrency_limit', String(val));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGovernorMemoryChange = (val: number) => {
    setGovernorMemoryLimitMb(val);
    try {
      localStorage.setItem('enterprise_governor_memory_limit_mb', String(val));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGovernorCpuChange = (val: number) => {
    setGovernorCpuLimitPct(val);
    try {
      localStorage.setItem('enterprise_governor_cpu_limit_pct', String(val));
    } catch (e) {
      console.error(e);
    }
  };

  const [performanceBudgetMs, setPerformanceBudgetMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_table_performance_budget_ms');
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });

  const handlePerformanceBudgetChange = (val: number) => {
    setPerformanceBudgetMs(val);
    try {
      localStorage.setItem('enterprise_table_performance_budget_ms', String(val));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: ScenarioPreset = {
      name: newPresetName.trim(),
      flags: { ...safeFlags }
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem('enterprise_custom_optimization_presets', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleDeleteCustomPreset = (index: number) => {
    const updated = customPresets.filter((_, idx) => idx !== index);
    setCustomPresets(updated);
    try {
      localStorage.setItem('enterprise_custom_optimization_presets', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyPreset = (presetFlags: OptimizationFlags) => {
    if (onApplyFlags) {
      onApplyFlags(presetFlags);
    } else {
      // Fallback toggle mismatching flags
      Object.keys(presetFlags).forEach((key) => {
        const flagKey = key as keyof OptimizationFlags;
        if (safeFlags[flagKey] !== presetFlags[flagKey]) {
          onToggleFlag(flagKey);
        }
      });
    }
  };

  const controls = [
    {
      key: 'batchEagerLoading' as keyof OptimizationFlags,
      title: 'Batch Eager Loading',
      badge: 'Database Fix',
      icon: Database,
      active: safeFlags.batchEagerLoading,
      problem: 'N+1 subqueries exhaust connection pool (25+ connections timeout)',
      solution: 'Single batched IN (?) query reduces roundtrips from 100+ to 2'
    },
    {
      key: 'btreeIndexing' as keyof OptimizationFlags,
      title: 'B-Tree Indexing',
      badge: 'Query Optimizer',
      icon: Layers,
      active: safeFlags.btreeIndexing,
      problem: 'Full sequential scan examines all 50,000 rows (1,200ms+ latency)',
      solution: 'Composite idx_orders_status_cat index seeks <35 rows in 1.4ms'
    },
    {
      key: 'queryCaching' as keyof OptimizationFlags,
      title: 'LRU Query Cache',
      badge: 'Memory Cache',
      icon: Gauge,
      active: safeFlags.queryCaching,
      problem: 'Redundant query execution recalculates identical result sets on every request',
      solution: 'In-memory LRU cache serves frequent reads with 0.15ms instant cache hits'
    },
    {
      key: 'virtualizedDOM' as keyof OptimizationFlags,
      title: 'DOM Virtualization',
      badge: 'UI Rendering Lag Fix',
      icon: Eye,
      active: safeFlags.virtualizedDOM,
      problem: 'Rendering 2,000+ DOM cards drops frame rate to 12 FPS and freezes browser',
      solution: 'Windowing renders only ~14 visible viewport rows, sustaining 60 FPS'
    },
    {
      key: 'deferredRendering' as keyof OptimizationFlags,
      title: 'Deferred Transitions',
      badge: 'UI Concurrency',
      icon: Cpu,
      active: safeFlags.deferredRendering,
      problem: 'Synchronous filter recalculations block main thread during rapid user typing',
      solution: 'React 19 useDeferredValue keeps input instant with zero keyboard stutter'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs space-y-4">
      {/* Header & Presets Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <span>Active Architectural Optimizations</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {Object.values(safeFlags || {}).filter(Boolean).length} / 5 Active
            </span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Toggle individual database and UI techniques or load scenario presets to benchmark performance impact
          </p>
        </div>

        {/* Preset System Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
            <span className="font-semibold text-zinc-700 px-2 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Presets:</span>
            </span>
            {PREDEFINED_PRESETS.map((preset, idx) => (
              <button
                key={`preset-${idx}`}
                type="button"
                onClick={() => handleApplyPreset(preset.flags)}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-zinc-300 text-zinc-700 hover:text-blue-700 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title={`Apply preset: ${preset.name}`}
              >
                {preset.name.split(' ')[0]} {preset.name.split(' ')[1]}
              </button>
            ))}
          </div>

          {/* Save Custom Preset Button / Form */}
          {!isSavingPreset ? (
            <button
              type="button"
              onClick={() => setIsSavingPreset(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Save Config</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-blue-50 p-1 rounded-lg border border-blue-200">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset Name..."
                className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSavingPreset(false)}
                className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Saved Presets Bar (if any) */}
      {customPresets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-zinc-400 font-medium uppercase text-[10px]">Custom Saved:</span>
          {customPresets.map((cp, idx) => (
            <div key={`custom-${idx}`} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-1 rounded-lg font-medium">
              <button
                type="button"
                onClick={() => handleApplyPreset(cp.flags)}
                className="hover:underline cursor-pointer font-semibold"
              >
                {cp.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomPreset(idx)}
                className="text-indigo-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                title="Delete preset"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls Grid */}
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

      {/* Query Throttler Configuration Panel */}
      <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 rounded-xl border border-blue-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-blue-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Query Throttler &amp; Concurrency Limiter
              </h3>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Set maximum concurrent background queries to prevent database socket exhaustion during heavy batch operations.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold bg-blue-200 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-300">
            Limit: {maxConcurrencyLimit} Queries
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="w-full flex-1 space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-700">
              <span>1 Query (Strict)</span>
              <span>10 (Recommended)</span>
              <span>50 Queries (High Throughput)</span>
            </div>
            <input
              type="range"
              id="slider-query-concurrency"
              data-testid="slider-query-concurrency"
              min="1"
              max="50"
              step="1"
              value={maxConcurrencyLimit}
              onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleConcurrencyChange(5)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                maxConcurrencyLimit === 5 ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleConcurrencyChange(10)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                maxConcurrencyLimit === 10 ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              10
            </button>
            <button
              type="button"
              onClick={() => handleConcurrencyChange(25)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                maxConcurrencyLimit === 25 ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              25
            </button>
          </div>
        </div>
      </div>

      {/* Resource Usage Governor Configuration Panel */}
      <div className="p-4 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-50/80 rounded-xl border border-emerald-200 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
              <Cpu className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Resource Usage Governor &amp; Bounds Enforcement
              </h3>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Configure hard memory and CPU concurrency ceilings to govern resource utilization during intense query workloads.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
              RAM: {governorMemoryLimitMb} MB
            </span>
            <span className="font-mono text-xs font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
              CPU: {governorCpuLimitPct}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Memory Governor Limit */}
          <div className="space-y-1.5 bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span>Max Buffer RAM Ceiling</span>
              <span className="font-mono text-emerald-800">{governorMemoryLimitMb} MB / 512 MB</span>
            </div>
            <input
              type="range"
              id="slider-governor-memory"
              data-testid="slider-governor-memory"
              min="128"
              max="512"
              step="16"
              value={governorMemoryLimitMb}
              onChange={(e) => handleGovernorMemoryChange(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>128 MB</span>
              <span>256 MB</span>
              <span>384 MB</span>
              <span>512 MB</span>
            </div>
          </div>

          {/* CPU Concurrency Governor Limit */}
          <div className="space-y-1.5 bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span>Max CPU Concurrency Ceiling</span>
              <span className="font-mono text-emerald-800">{governorCpuLimitPct}% Utilization</span>
            </div>
            <input
              type="range"
              id="slider-governor-cpu"
              data-testid="slider-governor-cpu"
              min="20"
              max="100"
              step="5"
              value={governorCpuLimitPct}
              onChange={(e) => handleGovernorCpuChange(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>20%</span>
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Budget Configuration Panel */}
      <div className="p-4 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-purple-50/80 rounded-xl border border-purple-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-purple-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                Performance Budget &amp; Table Latency Ceiling
              </h3>
              <p className="text-[11px] text-purple-700 mt-0.5">
                Define a total latency budget per table. Records exceeding this threshold will display breach warning indicators in the VirtualizedTable.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold bg-purple-200 text-purple-900 px-2.5 py-1 rounded-lg border border-purple-300">
            Budget: {performanceBudgetMs}ms / Table
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="w-full flex-1 space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-700">
              <span>25ms (Strict SLA)</span>
              <span>100ms (Standard)</span>
              <span>300ms (Lenient)</span>
            </div>
            <input
              type="range"
              id="slider-performance-budget"
              data-testid="slider-performance-budget"
              min="10"
              max="300"
              step="10"
              value={performanceBudgetMs}
              onChange={(e) => handlePerformanceBudgetChange(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handlePerformanceBudgetChange(25)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                performanceBudgetMs === 25 ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              25ms
            </button>
            <button
              type="button"
              onClick={() => handlePerformanceBudgetChange(100)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                performanceBudgetMs === 100 ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              100ms
            </button>
            <button
              type="button"
              onClick={() => handlePerformanceBudgetChange(200)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer border ${
                performanceBudgetMs === 200 ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              200ms
            </button>
          </div>
        </div>
      </div>

      {/* Global IOPS Simulator & Disk Speed Tier */}
      <div className="p-4 bg-gradient-to-r from-cyan-50/80 via-teal-50/50 to-cyan-50/80 rounded-xl border border-cyan-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-cyan-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-600 text-white rounded-lg shadow-2xs">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                Global IOPS Simulator &amp; Disk Speed Tier
              </h3>
              <p className="text-[11px] text-cyan-800 mt-0.5">
                Simulate underlying storage I/O performance. Adjusting disk speed tiers dynamically scales index re-build times and query seek latency across the ExplainPlanViewer.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold bg-cyan-200 text-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-300">
            Tier: {diskTier} ({diskTier === 'NVMe' ? '500k IOPS' : diskTier === 'SSD' ? '10k IOPS' : '250 IOPS'})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* HDD Tier */}
          <button
            type="button"
            id="btn-disk-tier-hdd"
            data-testid="btn-disk-tier-hdd"
            onClick={() => handleDiskTierChange('HDD')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              diskTier === 'HDD'
                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300'
                : 'bg-white hover:bg-amber-50/50 text-zinc-800 border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span>💽 HDD (Magnetic)</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${diskTier === 'HDD' ? 'bg-amber-950 text-amber-200' : 'bg-zinc-100 text-zinc-700'}`}>
                250 IOPS
              </span>
            </div>
            <div className={`text-[10px] ${diskTier === 'HDD' ? 'text-amber-100' : 'text-zinc-500'}`}>
              Seek Latency: ~15.0ms • Rebuild: ~10x Slower
            </div>
          </button>

          {/* SSD Tier */}
          <button
            type="button"
            id="btn-disk-tier-ssd"
            data-testid="btn-disk-tier-ssd"
            onClick={() => handleDiskTierChange('SSD')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              diskTier === 'SSD'
                ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-300'
                : 'bg-white hover:bg-teal-50/50 text-zinc-800 border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span>💾 SSD (SATA/PCIe)</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${diskTier === 'SSD' ? 'bg-teal-950 text-teal-200' : 'bg-zinc-100 text-zinc-700'}`}>
                10k IOPS
              </span>
            </div>
            <div className={`text-[10px] ${diskTier === 'SSD' ? 'text-teal-100' : 'text-zinc-500'}`}>
              Seek Latency: ~0.8ms • Rebuild: ~2.5x Slower
            </div>
          </button>

          {/* NVMe Tier */}
          <button
            type="button"
            id="btn-disk-tier-nvme"
            data-testid="btn-disk-tier-nvme"
            onClick={() => handleDiskTierChange('NVMe')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              diskTier === 'NVMe'
                ? 'bg-cyan-600 text-white border-cyan-700 shadow-md ring-2 ring-cyan-300'
                : 'bg-white hover:bg-cyan-50/50 text-zinc-800 border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span>⚡ NVMe (PCIe 4.0)</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${diskTier === 'NVMe' ? 'bg-cyan-950 text-cyan-200' : 'bg-zinc-100 text-zinc-700'}`}>
                500k IOPS
              </span>
            </div>
            <div className={`text-[10px] ${diskTier === 'NVMe' ? 'text-cyan-100' : 'text-zinc-500'}`}>
              Seek Latency: ~0.05ms • Rebuild: 1.0x Baseline
            </div>
          </button>
        </div>
      </div>

      {/* Maintenance Schedule & Off-Peak Re-indexing Window */}
      <div className="p-4 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 rounded-xl border border-amber-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-600 text-white rounded-lg shadow-2xs">
              <Clock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Maintenance Schedule &amp; Off-Peak Re-indexing Window
              </h3>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Define restricted maintenance hours for low-priority background re-indexing and pruning tasks, protecting production resources during peak usage hours.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
              maintenanceEnabled ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              {maintenanceEnabled ? `Window: ${String(maintenanceStartHour).padStart(2, '0')}:00 - ${String(maintenanceEndHour).padStart(2, '0')}:00 UTC` : 'Window Disabled'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Toggle Enable */}
          <div className="space-y-1 bg-white/90 p-3 rounded-xl border border-amber-100 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span>Enforce Maintenance SLA</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="checkbox-maintenance-enabled"
                  data-testid="checkbox-maintenance-enabled"
                  checked={maintenanceEnabled}
                  onChange={(e) => handleToggleMaintenance(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
            <p className="text-[10px] text-zinc-500">
              Suspends low-priority index maintenance outside designated off-peak hours.
            </p>
          </div>

          {/* Start Hour */}
          <div className="space-y-1.5 bg-white/90 p-3 rounded-xl border border-amber-100 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span>Window Start (UTC)</span>
              <span className="font-mono text-amber-800">{String(maintenanceStartHour).padStart(2, '0')}:00 UTC</span>
            </div>
            <select
              id="select-maintenance-start"
              data-testid="select-maintenance-start"
              disabled={!maintenanceEnabled}
              value={maintenanceStartHour}
              onChange={(e) => handleMaintenanceStartChange(Number(e.target.value))}
              className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00 UTC ({h === 0 ? 'Midnight' : h === 12 ? 'Noon' : `${h}:00`})
                </option>
              ))}
            </select>
          </div>

          {/* End Hour */}
          <div className="space-y-1.5 bg-white/90 p-3 rounded-xl border border-amber-100 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span>Window End (UTC)</span>
              <span className="font-mono text-amber-800">{String(maintenanceEndHour).padStart(2, '0')}:00 UTC</span>
            </div>
            <select
              id="select-maintenance-end"
              data-testid="select-maintenance-end"
              disabled={!maintenanceEnabled}
              value={maintenanceEndHour}
              onChange={(e) => handleMaintenanceEndChange(Number(e.target.value))}
              className="w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00 UTC ({h === 0 ? 'Midnight' : h === 12 ? 'Noon' : `${h}:00`})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
