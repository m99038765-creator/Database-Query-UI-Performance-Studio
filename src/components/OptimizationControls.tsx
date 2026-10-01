import React, { useState, useEffect } from 'react';
import { OptimizationFlags, LowUsageThresholdsConfig, DEFAULT_LOW_USAGE_THRESHOLDS } from '../types';
import {
  Check,
  X,
  Layers,
  Cpu,
  Database,
  Eye,
  Gauge,
  Bookmark,
  Plus,
  Trash2,
  Sparkles,
  Sliders,
  Clock,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Zap,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  Calendar,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface OptimizationControlsProps {
  flags?: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onResetAll?: () => void;
  onApplyFlags?: (flags: OptimizationFlags) => void;
  lowUsageThresholds?: LowUsageThresholdsConfig;
  onLowUsageThresholdsChange?: (config: LowUsageThresholdsConfig) => void;
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
  onApplyFlags,
  lowUsageThresholds,
  onLowUsageThresholdsChange
}) => {
  const safeFlags = flags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  };

  // Low Usage Thresholds Configuration State
  const [lowUsageConfig, setLowUsageConfig] = useState<LowUsageThresholdsConfig>(() => {
    if (lowUsageThresholds) return lowUsageThresholds;
    try {
      const saved = localStorage.getItem('enterprise_low_usage_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_LOW_USAGE_THRESHOLDS;
    } catch {
      return DEFAULT_LOW_USAGE_THRESHOLDS;
    }
  });

  useEffect(() => {
    if (lowUsageThresholds) {
      setLowUsageConfig(lowUsageThresholds);
    }
  }, [lowUsageThresholds]);

  const updateLowUsageConfig = (newConfig: LowUsageThresholdsConfig) => {
    setLowUsageConfig(newConfig);
    try {
      localStorage.setItem('enterprise_low_usage_thresholds', JSON.stringify(newConfig));
    } catch (e) {
      console.error(e);
    }
    if (onLowUsageThresholdsChange) {
      onLowUsageThresholdsChange(newConfig);
    }
    window.dispatchEvent(new CustomEvent('low-usage-thresholds-updated', { detail: newConfig }));
  };

  const handleDaysInactiveChange = (val: number) => {
    updateLowUsageConfig({ ...lowUsageConfig, daysInactive: val });
  };

  const handleMinHitsChange = (val: number) => {
    updateLowUsageConfig({ ...lowUsageConfig, minQueryHits: val });
  };

  const handleMinRatioChange = (val: number) => {
    updateLowUsageConfig({ ...lowUsageConfig, minReadWriteRatio: val });
  };

  const handleToggleLowUsageEnabled = (enabled: boolean) => {
    updateLowUsageConfig({ ...lowUsageConfig, enabled });
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

  // Index Recommendation Engine State
  const [engineAutoScan, setEngineAutoScan] = useState<boolean>(true);
  const [engineScanIteration, setEngineScanIteration] = useState<number>(1);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<string>('Just now');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [appliedEngineRecIds, setAppliedEngineRecIds] = useState<string[]>([]);
  const [engineAlertNotice, setEngineAlertNotice] = useState<string | null>(null);

  // Periodic recommendation engine evaluation
  useEffect(() => {
    if (!engineAutoScan) return;

    const interval = setInterval(() => {
      setEngineScanIteration((prev) => prev + 1);
      setLastScanTimestamp(new Date().toLocaleTimeString());
    }, 12000); // Periodically evaluates every 12 seconds

    return () => clearInterval(interval);
  }, [engineAutoScan]);

  const handleManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setEngineScanIteration((prev) => prev + 1);
      setLastScanTimestamp(new Date().toLocaleTimeString());
      setIsScanning(false);
    }, 500);
  };

  const engineRecommendations = [
    {
      id: 'rec-engine-1',
      name: 'idx_transactions_status_cat_created',
      tableName: 'transactions',
      columns: ['status', 'category', 'created_at DESC'],
      includeColumns: ['amount', 'customer_name'],
      priority: safeFlags.btreeIndexing ? 'OPTIMIZED' : 'CRITICAL',
      targetFlag: 'btreeIndexing' as keyof OptimizationFlags,
      bottleneck: safeFlags.btreeIndexing
        ? 'Covering index active: Point lookups operating at sub-millisecond seek latency'
        : 'Full sequential scan bottleneck: Scanning 50,000 heap rows without index guidance (Cost: 48.50)',
      detectedPlan: 'EXPLAIN Seq Scan on transactions (status = completed, category = Cloud Infrastructure)',
      projectedDrop: '45.0ms ➔ 1.2ms (-97.3%)',
      costReduction: '48.50 ➔ 2.15 (-95.6%)',
      isAutoApplied: appliedEngineRecIds.includes('rec-engine-1') || safeFlags.btreeIndexing,
      explanation: 'Constructs composite B-Tree leaf pages on high-cardinality equality predicates (status, category) followed by pre-sorted created_at order.'
    },
    {
      id: 'rec-engine-2',
      name: 'idx_order_items_fk_composite',
      tableName: 'order_items',
      columns: ['order_id', 'sku'],
      includeColumns: ['unit_price', 'quantity', 'name'],
      priority: safeFlags.batchEagerLoading ? 'OPTIMIZED' : 'CRITICAL',
      targetFlag: 'batchEagerLoading' as keyof OptimizationFlags,
      bottleneck: safeFlags.batchEagerLoading
        ? 'Batch eager join active: Single roundtrip resolving child items'
        : 'N+1 Subquery Cascade: Synchronous nested queries exhausting connection pool (Cost: 25.40)',
      detectedPlan: 'Subquery Scan on order_items (SELECT * FROM order_items WHERE order_id = ?)',
      projectedDrop: '18.2ms ➔ 0.35ms (-98.1%)',
      costReduction: '25.40 ➔ 0.85 (-96.7%)',
      isAutoApplied: appliedEngineRecIds.includes('rec-engine-2') || safeFlags.batchEagerLoading,
      explanation: 'Composite foreign key index enables PostgreSQL to execute a single batched WHERE order_id IN (...) seek with zero heap read amplification.'
    },
    {
      id: 'rec-engine-3',
      name: 'idx_transactions_customer_covering',
      tableName: 'transactions',
      columns: ['customer_name', 'status'],
      includeColumns: ['amount', 'created_at'],
      priority: 'HIGH',
      bottleneck: 'High frequency ILIKE customer filter incurring random heap page fetch I/O',
      detectedPlan: 'Filter node on customer_name (Heap Fetches: 4,820)',
      projectedDrop: '6.4ms ➔ 0.8ms (-87.5%)',
      costReduction: '18.40 ➔ 3.20 (-82.6%)',
      isAutoApplied: appliedEngineRecIds.includes('rec-engine-3'),
      explanation: 'Covering index stores customer name and status with projection payload, satisfying customer lookups directly from RAM buffer cache without table access.'
    }
  ];

  const handleAutoApplyRecommendation = (rec: typeof engineRecommendations[0]) => {
    // If there is an associated flag that is currently off, enable it!
    if (rec.targetFlag && !safeFlags[rec.targetFlag]) {
      if (onApplyFlags) {
        onApplyFlags({ ...safeFlags, [rec.targetFlag]: true });
      } else {
        onToggleFlag(rec.targetFlag);
      }
    }

    setAppliedEngineRecIds((prev) => Array.from(new Set([...prev, rec.id])));
    setEngineAlertNotice(`✓ Auto-Applied: Successfully created index '${rec.name}' on table '${rec.tableName}'! Projected latency reduced to ${rec.projectedDrop.split('➔')[1] || '1.2ms'}.`);
    setTimeout(() => setEngineAlertNotice(null), 5000);
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

      {/* Index Recommendation Engine Panel */}
      <div
        id="panel-index-recommendation-engine"
        data-testid="panel-index-recommendation-engine"
        className="p-4 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 rounded-xl border-2 border-indigo-200 shadow-sm space-y-3.5 animate-fadeIn"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-200 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Index Recommendation Engine
                </h3>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 border border-indigo-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Autonomous Analyzer</span>
                </span>
              </div>
              <p className="text-[11px] text-indigo-900 mt-0.5">
                Periodically analyzes historical query execution plans and active system bottlenecks to recommend optimal composite indexes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-[10px] text-zinc-500 bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-100 font-semibold">
              Cycle #{engineScanIteration} • {lastScanTimestamp}
            </span>

            <label className="flex items-center gap-1.5 font-semibold text-[11px] text-indigo-950 cursor-pointer bg-white/90 hover:bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
              <input
                type="checkbox"
                id="checkbox-engine-auto-scan"
                data-testid="checkbox-engine-auto-scan"
                checked={engineAutoScan}
                onChange={(e) => setEngineAutoScan(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Periodic Auto-Scan (12s)</span>
            </label>

            <button
              type="button"
              id="btn-engine-scan-now"
              data-testid="btn-engine-scan-now"
              disabled={isScanning}
              onClick={handleManualScan}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-2xs flex items-center gap-1 disabled:opacity-50"
              title="Trigger immediate analysis of historical query plans and system bottlenecks"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Plans Now'}</span>
            </button>
          </div>
        </div>

        {/* Success Alert Toast */}
        {engineAlertNotice && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-950 flex items-center justify-between animate-fadeIn shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{engineAlertNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setEngineAlertNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Recommendations Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {engineRecommendations.map((rec) => {
            const isCritical = rec.priority === 'CRITICAL';
            const isOptimized = rec.priority === 'OPTIMIZED';

            return (
              <div
                key={rec.id}
                id={`card-${rec.id}`}
                data-testid={`card-${rec.id}`}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  rec.isAutoApplied || isOptimized
                    ? 'bg-white/95 border-emerald-300 shadow-2xs'
                    : isCritical
                    ? 'bg-white/95 border-rose-300 ring-2 ring-rose-400/20 shadow-sm'
                    : 'bg-white/95 border-indigo-200 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        rec.isAutoApplied || isOptimized
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isCritical
                          ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {rec.isAutoApplied ? '✓ Applied & Active' : `${rec.priority} Bottleneck`}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      {rec.projectedDrop.split(' ')[2] || 'High Gain'}
                    </span>
                  </div>

                  {/* Index Name & Table */}
                  <div>
                    <h4 className="font-mono font-bold text-xs text-indigo-950 truncate" title={rec.name}>
                      {rec.name}
                    </h4>
                    <span className="text-[11px] text-zinc-500 font-medium">
                      Target Table: <strong className="text-zinc-800">{rec.tableName}</strong>
                    </span>
                  </div>

                  {/* Columns Tags */}
                  <div className="flex flex-wrap gap-1">
                    {rec.columns.map((col, idx) => (
                      <span key={idx} className="font-mono text-[10px] bg-indigo-50 text-indigo-900 px-1.5 py-0.2 rounded border border-indigo-200 font-semibold">
                        {col}
                      </span>
                    ))}
                    {rec.includeColumns && (
                      <span className="font-mono text-[9px] bg-emerald-50 text-emerald-800 px-1 py-0.2 rounded border border-emerald-200">
                        +{rec.includeColumns.length} payload
                      </span>
                    )}
                  </div>

                  {/* Bottleneck Evidence */}
                  <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 text-[11px] space-y-1">
                    <div className="text-zinc-700 leading-snug">
                      <strong className="text-zinc-900 block text-[10px] uppercase font-bold text-indigo-900">Detected System Bottleneck:</strong>
                      {rec.bottleneck}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 pt-0.5 border-t border-zinc-200/60 truncate" title={rec.detectedPlan}>
                      Plan: {rec.detectedPlan}
                    </div>
                  </div>

                  {/* Metric Projection */}
                  <div className="flex justify-between items-center text-[10px] font-mono px-1">
                    <span className="text-zinc-500">Latency Drop:</span>
                    <span className="font-bold text-emerald-700">{rec.projectedDrop}</span>
                  </div>
                </div>

                {/* Card Action Button: Auto-Apply */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">
                    Cost: {rec.costReduction}
                  </span>

                  <button
                    type="button"
                    id={`btn-auto-apply-${rec.id}`}
                    data-testid={`btn-auto-apply-${rec.id}`}
                    onClick={() => handleAutoApplyRecommendation(rec)}
                    disabled={rec.isAutoApplied}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      rec.isAutoApplied
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                        : isCritical
                        ? 'bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white border border-rose-700 shadow-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700'
                    }`}
                    title={rec.isAutoApplied ? 'Index recommendation has already been applied' : 'Auto-Apply: Automatically configure index and activate system optimization'}
                  >
                    {rec.isAutoApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Auto-Applied</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Auto-Apply</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Low Usage & Index Inactivity Thresholds Configuration Panel */}
      <div
        id="panel-low-usage-thresholds"
        data-testid="panel-low-usage-thresholds"
        className="p-4 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 rounded-xl border-2 border-amber-200 shadow-sm space-y-3.5 animate-fadeIn"
      >
        <div className="flex items-center justify-between border-b border-amber-200 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Low Usage &amp; Index Inactivity Thresholds
                </h3>
                <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  lowUsageConfig.enabled
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${lowUsageConfig.enabled ? 'bg-amber-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                  <span>{lowUsageConfig.enabled ? 'Active Audit Policy' : 'Auditing Suspended'}</span>
                </span>
              </div>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Define the criteria used to detect unutilized indexes. Indexes inactive for more than the configured threshold (e.g. &gt;7 days) receive prominent warning badges in the Schema Explorer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
              Threshold: &gt;{lowUsageConfig.daysInactive} Days Inactive
            </span>
            <label className="flex items-center gap-1.5 font-semibold text-[11px] text-amber-950 cursor-pointer bg-white/90 hover:bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
              <input
                type="checkbox"
                id="checkbox-low-usage-enabled"
                data-testid="checkbox-low-usage-enabled"
                checked={lowUsageConfig.enabled}
                onChange={(e) => handleToggleLowUsageEnabled(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Enable Inactivity Badging</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* 1. Inactivity Days Threshold Slider & Quick Presets */}
          <div className="space-y-2 bg-white/95 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span className="flex items-center gap-1.5 text-zinc-900">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Inactivity Period (Days)</span>
              </span>
              <span className="font-mono text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                &gt;{lowUsageConfig.daysInactive} Days
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Indexes with zero query scans exceeding this threshold are flagged in the Schema Explorer.
            </p>
            <input
              type="range"
              id="slider-low-usage-days"
              data-testid="slider-low-usage-days"
              min="1"
              max="60"
              step="1"
              value={lowUsageConfig.daysInactive}
              onChange={(e) => handleDaysInactiveChange(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>1 Day</span>
              <span>7d (Standard)</span>
              <span>14d</span>
              <span>60 Days</span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-zinc-100">
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  id={`btn-preset-days-${d}`}
                  data-testid={`btn-preset-days-${d}`}
                  onClick={() => handleDaysInactiveChange(d)}
                  className={`py-1 text-center font-mono font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                    lowUsageConfig.daysInactive === d
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs font-bold'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                  title={`Set inactivity threshold to ${d} days`}
                >
                  {d}d{d === 7 ? ' (Std)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Minimum Query Scan Hits in Audit Window */}
          <div className="space-y-2 bg-white/95 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span className="flex items-center gap-1.5 text-zinc-900">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>Min Query Scan Hits</span>
              </span>
              <span className="font-mono text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                &lt;{lowUsageConfig.minQueryHits} Hits
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Minimum query execution hits required over the 100-query audit rolling window.
            </p>
            <input
              type="range"
              id="slider-low-usage-hits"
              data-testid="slider-low-usage-hits"
              min="0"
              max="100"
              step="5"
              value={lowUsageConfig.minQueryHits}
              onChange={(e) => handleMinHitsChange(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>0 (Strict)</span>
              <span>10 Hits</span>
              <span>50 Hits</span>
              <span>100 Hits</span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-zinc-100">
              {[0, 10, 25, 50].map((h) => (
                <button
                  key={h}
                  type="button"
                  id={`btn-preset-hits-${h}`}
                  data-testid={`btn-preset-hits-${h}`}
                  onClick={() => handleMinHitsChange(h)}
                  className={`py-1 text-center font-mono font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                    lowUsageConfig.minQueryHits === h
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs font-bold'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                  title={`Set minimum query hits threshold to ${h}`}
                >
                  {h === 0 ? 'Zero Hits' : `${h} Hits`}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Read-to-Write Ratio Threshold */}
          <div className="space-y-2 bg-white/95 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span className="flex items-center gap-1.5 text-zinc-900">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Read/Write Ratio Floor</span>
              </span>
              <span className="font-mono text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                &lt;{lowUsageConfig.minReadWriteRatio.toFixed(1)}x Ratio
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Flag indexes whose write lock penalties exceed read benefits (write amplification).
            </p>
            <input
              type="range"
              id="slider-low-usage-ratio"
              data-testid="slider-low-usage-ratio"
              min="0.5"
              max="10.0"
              step="0.5"
              value={lowUsageConfig.minReadWriteRatio}
              onChange={(e) => handleMinRatioChange(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.5x</span>
              <span>3.0x (Std)</span>
              <span>5.0x</span>
              <span>10.0x</span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-zinc-100">
              {[1.0, 2.0, 3.0, 5.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  id={`btn-preset-ratio-${r}`}
                  data-testid={`btn-preset-ratio-${r}`}
                  onClick={() => handleMinRatioChange(r)}
                  className={`py-1 text-center font-mono font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                    lowUsageConfig.minReadWriteRatio === r
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs font-bold'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                  title={`Set read/write ratio threshold to ${r.toFixed(1)}x`}
                >
                  {r.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
