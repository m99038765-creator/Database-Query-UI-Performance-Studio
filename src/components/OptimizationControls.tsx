import React, { useState, useEffect } from 'react';
import { OptimizationFlags } from '../types';
import { Check, X, Layers, Cpu, Database, Eye, Gauge, Bookmark, Plus, Trash2, Sparkles, Sliders } from 'lucide-react';

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
    </div>
  );
};
