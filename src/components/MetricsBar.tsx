import React from 'react';
import { QueryExecutionResult, OptimizationFlags } from '../types';
import { Clock, Database, Layers, Monitor, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

interface MetricsBarProps {
  queryResult: QueryExecutionResult;
  flags?: OptimizationFlags;
  currentFps?: number;
  fps?: number;
  renderedDomCount?: number;
  totalDatabaseRecords?: number;
  dbStats?: any;
  onOpenBulkImport?: () => void;
  autoRefreshEnabled?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
  alertThresholdMs?: number;
  onAlertThresholdChange?: (val: number) => void;
  heatmapModeEnabled?: boolean;
  onToggleHeatmapMode?: (enabled: boolean) => void;
  onResetMetrics?: () => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  queryResult,
  flags,
  currentFps,
  fps,
  renderedDomCount,
  totalDatabaseRecords = 50000,
  dbStats,
  onOpenBulkImport,
  autoRefreshEnabled = false,
  onToggleAutoRefresh,
  alertThresholdMs = 100,
  onAlertThresholdChange,
  heatmapModeEnabled = true,
  onToggleHeatmapMode,
  onResetMetrics
}) => {
  const safeFlags = flags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  };
  const effectiveFps = currentFps ?? fps ?? 60;
  const effectiveDomCount = renderedDomCount ?? (queryResult?.records ? (safeFlags.virtualizedDOM ? Math.min(queryResult.records.length, 18) : queryResult.records.length) : 18);
  const effectiveTotalRecords = dbStats?.totalRecords ?? totalDatabaseRecords ?? 50000;

  const isQueryFast = (queryResult?.executionTimeMs ?? 0) < 15;
  const isFpsGood = effectiveFps >= 50;
  const isDomHealthy = effectiveDomCount < 100;
  const isPoolHealthy = !queryResult?.simulatedError;
  const currentLatency = queryResult?.executionTimeMs ?? 0;
  const isThresholdExceeded = currentLatency > alertThresholdMs;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Query Execution Latency */}
      <div className={`bg-white rounded-xl border p-4 shadow-xs relative overflow-hidden transition-all ${isThresholdExceeded ? 'border-rose-300 ring-2 ring-rose-400/20 bg-rose-50/30' : 'border-zinc-200'}`}>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            Query Latency
          </span>
          {queryResult?.cacheHit && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
              CACHE HIT
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isQueryFast ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {currentLatency.toFixed(1)}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">ms</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
          {safeFlags.btreeIndexing ? (
            <span className="text-emerald-700 font-medium">B-Tree Index Active</span>
          ) : (
            <span className="text-rose-600 font-medium">Full Table Scan (Slow)</span>
          )}
          <span className="text-[10px] text-zinc-400">Limit: {alertThresholdMs}ms</span>
        </div>

        {isThresholdExceeded && (
          <div className="mt-2 p-1.5 bg-rose-100/80 border border-rose-300 rounded-lg text-[10px] text-rose-900 font-bold flex items-center gap-1.5 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>Threshold Alert: Latency exceeds {alertThresholdMs}ms!</span>
          </div>
        )}

        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isThresholdExceeded ? 'bg-rose-600' : isQueryFast ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 2. Rows Scanned */}
      <div
        id="metric-card-rows-scanned"
        className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden transition-all ${
          onOpenBulkImport ? 'cursor-pointer hover:border-blue-300 group' : ''
        }`}
        onClick={onOpenBulkImport}
        title={onOpenBulkImport ? "Click to open Bulk Data Import Simulator" : undefined}
      >
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600 transition-colors" />
            Rows Scanned
          </span>
          {effectiveTotalRecords > 50000 && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
              +{((effectiveTotalRecords - 50000) / 1000).toFixed(0)}k Ingested
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              (queryResult?.rowsScanned ?? 0) < 1000 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {(queryResult?.rowsScanned ?? 0).toLocaleString()}
          </span>
          <span className="text-xs text-zinc-400">/ {effectiveTotalRecords.toLocaleString()} total</span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
          {(queryResult?.rowsScanned ?? 0) < 1000 ? (
            <span className="text-emerald-700 font-medium">Exact B-Tree seek</span>
          ) : (
            <span className="text-amber-600 font-medium">Inspected 100% of records</span>
          )}
          {onOpenBulkImport && (
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Ingest &rarr;
            </span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            (queryResult?.rowsScanned ?? 0) < 1000 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* 3. UI Frame Rate (FPS) */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-zinc-400" />
            UI Frame Rate
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isFpsGood
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800 animate-pulse'
            }`}
          >
            {isFpsGood ? 'SMOOTH' : 'LAGGING'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isFpsGood ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {effectiveFps}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">FPS</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {safeFlags.virtualizedDOM ? (
            <span className="text-emerald-700 font-medium">Virtual Windowing ON</span>
          ) : (
            <span className="text-rose-600 font-medium">DOM Overload (Stuttering)</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isFpsGood ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 4. Active DOM Nodes in Viewport */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            Active DOM Nodes
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isDomHealthy ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {effectiveDomCount.toLocaleString()}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">elements</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {isDomHealthy ? (
            <span className="text-emerald-700 font-medium">Ultra-low memory footprint</span>
          ) : (
            <span className="text-rose-600 font-medium">Heavy layout recalculations</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isDomHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 5. Database Connection Pool Status & Auto-Refresh Toggle */}
      <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-zinc-400" />
              DB Connections
            </span>
            {autoRefreshEnabled && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                AUTO (3s)
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                isPoolHealthy ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {queryResult?.activeQueriesCount ?? 1}
              <span className="text-xs font-normal text-zinc-500 ml-1">
                / 25 pooled
              </span>
            </span>
          </div>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium">Auto-Refresh</span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              id="toggle-auto-refresh-diagnostics"
              data-testid="toggle-auto-refresh-diagnostics"
              checked={autoRefreshEnabled}
              onChange={(e) => onToggleAutoRefresh && onToggleAutoRefresh(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="pt-1.5 mt-1.5 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium">Heatmap Mode</span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              id="toggle-heatmap-mode-metrics"
              data-testid="toggle-heatmap-mode-metrics"
              checked={heatmapModeEnabled}
              onChange={(e) => onToggleHeatmapMode && onToggleHeatmapMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        <div className="pt-1.5 mt-1.5 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium">Reset Metrics</span>
          <button
            type="button"
            onClick={onResetMetrics}
            className="px-2 py-0.5 bg-zinc-100 hover:bg-rose-50 border border-zinc-300 hover:border-rose-300 text-zinc-700 hover:text-rose-700 rounded text-[10px] font-semibold transition-colors cursor-pointer"
            title="Clear all accumulated historical trend points and diagnostic cache data"
          >
            Reset Slate
          </button>
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isPoolHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>
    </div>
  );
};
