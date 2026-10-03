import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueryExecutionResult, OptimizationFlags } from '../types';
import { Clock, Database, Layers, Monitor, CheckCircle, AlertTriangle, Zap, Sparkles } from 'lucide-react';

interface AnimatedCounterOptions {
  duration?: number;
  decimals?: number;
}

const useAnimatedCounter = (
  targetValue: number,
  options: AnimatedCounterOptions = {}
) => {
  const { duration = 450, decimals = 0 } = options;
  const [displayNumber, setDisplayNumber] = useState<number>(targetValue);
  const [direction, setDirection] = useState<'up' | 'down' | 'idle'>('idle');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [updateKey, setUpdateKey] = useState<number>(0);
  const startValRef = useRef<number>(targetValue);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number>(targetValue);

  useEffect(() => {
    // If target value changed
    if (Math.abs(prevTargetRef.current - targetValue) > (decimals > 0 ? 0.05 : 0.5)) {
      const isUp = targetValue > prevTargetRef.current;
      setDirection(isUp ? 'up' : 'down');
      setIsAnimating(true);
      setUpdateKey((k) => k + 1);
      startValRef.current = displayNumber;
      startTimeRef.current = null;
      prevTargetRef.current = targetValue;

      const step = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
        // easeOutCubic: 1 - Math.pow(1 - progress, 3)
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startValRef.current + (targetValue - startValRef.current) * ease;
        setDisplayNumber(current);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setDisplayNumber(targetValue);
          setIsAnimating(false);
          const timeout = setTimeout(() => setDirection('idle'), 600);
          return () => clearTimeout(timeout);
        }
      };

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(step);
    } else {
      setDisplayNumber(targetValue);
      prevTargetRef.current = targetValue;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetValue, duration, decimals]);

  const formatted = decimals > 0
    ? displayNumber.toFixed(decimals)
    : Math.round(displayNumber).toLocaleString();

  return { formatted, raw: displayNumber, direction, isAnimating, updateKey };
};

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
  performanceBudgetMs?: number;
  onPerformanceBudgetChange?: (val: number) => void;
  onToggleFlag?: (flag: keyof OptimizationFlags) => void;
  onApplyFlags?: (flags: OptimizationFlags) => void;
  onAutoOptimize?: () => void;
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
  onResetMetrics,
  performanceBudgetMs,
  onPerformanceBudgetChange,
  onToggleFlag,
  onApplyFlags,
  onAutoOptimize
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

  const currentLatency = queryResult?.executionTimeMs ?? 0;
  const isQueryFast = currentLatency < 15;
  const isFpsGood = effectiveFps >= 50;
  const isDomHealthy = effectiveDomCount < 100;
  const isPoolHealthy = !queryResult?.simulatedError;
  const isThresholdExceeded = currentLatency > alertThresholdMs;

  const [internalBudget, setInternalBudget] = useState<number>(200);
  const effectiveBudget = performanceBudgetMs ?? internalBudget;
  const setEffectiveBudget = onPerformanceBudgetChange ?? setInternalBudget;

  const isBudgetExceeded = currentLatency > effectiveBudget;

  const suggestedOptimizationFlag = useMemo(() => {
    if (!safeFlags.btreeIndexing) return { key: 'btreeIndexing' as keyof OptimizationFlags, label: 'B-Tree Indexing' };
    if (!safeFlags.queryCaching) return { key: 'queryCaching' as keyof OptimizationFlags, label: 'Query Caching' };
    if (!safeFlags.batchEagerLoading) return { key: 'batchEagerLoading' as keyof OptimizationFlags, label: 'Batch Eager Loading' };
    if (!safeFlags.virtualizedDOM) return { key: 'virtualizedDOM' as keyof OptimizationFlags, label: 'Virtualized DOM' };
    return null;
  }, [safeFlags]);

  // Animated counters with smooth cubic easing and CSS transitions
  const animatedLatency = useAnimatedCounter(currentLatency, { duration: 450, decimals: 1 });
  const animatedRowsScanned = useAnimatedCounter(queryResult?.rowsScanned ?? 0, { duration: 500, decimals: 0 });
  const animatedTotalRecords = useAnimatedCounter(effectiveTotalRecords, { duration: 500, decimals: 0 });
  const animatedFps = useAnimatedCounter(effectiveFps, { duration: 350, decimals: 0 });
  const animatedDomCount = useAnimatedCounter(effectiveDomCount, { duration: 450, decimals: 0 });
  const animatedDbConnections = useAnimatedCounter(queryResult?.activeQueriesCount ?? 1, { duration: 300, decimals: 0 });

  return (
    <div className="space-y-3">
      {/* Performance Budget Exceeded Warning Banner */}
      {isBudgetExceeded && (
        <div
          id="performance-budget-warning-banner"
          data-testid="performance-budget-warning-banner"
          className="p-3.5 bg-gradient-to-r from-rose-950 via-amber-950 to-zinc-950 text-white rounded-xl border-2 border-rose-500 shadow-lg flex items-center justify-between gap-3 animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-rose-600 text-white rounded-lg shadow-inner animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                  ⚠️ Performance Budget Exceeded ({currentLatency.toFixed(1)}ms &gt; {effectiveBudget}ms global budget limit)
                </h4>
                <span className="font-mono text-[10px] bg-rose-500 text-white px-2 py-0.2 rounded-full font-bold uppercase">
                  Budget Violation
                </span>
              </div>
              <p className="text-[11px] text-rose-200 mt-0.5">
                {suggestedOptimizationFlag ? (
                  <>
                    Recommended Optimization: Enable <strong className="text-amber-300 font-bold">{suggestedOptimizationFlag.label}</strong> to reduce latency below the performance budget.
                  </>
                ) : (
                  'Average query execution time has exceeded the configured global performance budget threshold.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {suggestedOptimizationFlag && onToggleFlag && (
              <button
                type="button"
                id="btn-apply-budget-recommendation"
                data-testid="btn-apply-budget-recommendation"
                onClick={() => onToggleFlag(suggestedOptimizationFlag.key)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer flex items-center gap-1"
              >
                <Zap className="w-3 h-3 text-amber-200" />
                <span>Enable {suggestedOptimizationFlag.label}</span>
              </button>
            )}
            {onAutoOptimize && (
              <button
                type="button"
                id="btn-metrics-auto-optimize"
                data-testid="btn-metrics-auto-optimize"
                onClick={onAutoOptimize}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow transition-colors cursor-pointer"
              >
                Auto-Optimize All
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI-powered 'Quick Fix' badge for persistent N+1 query pattern */}
      {(!safeFlags.batchEagerLoading || !safeFlags.btreeIndexing) && (
        <div
          id="ai-quick-fix-badge"
          data-testid="ai-quick-fix-badge"
          className="p-3.5 bg-gradient-to-r from-purple-950 via-indigo-950 to-zinc-950 text-white rounded-xl border-2 border-purple-400 shadow-lg flex items-center justify-between gap-3 animate-fadeIn"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-600 text-white rounded-lg shadow-inner animate-bounce">
              <Sparkles className="w-4 h-4 text-amber-200" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                  ⚡ AI Quick Fix: Persistent N+1 Query Cascade &amp; Scan Bottleneck Detected
                </h4>
                <span className="font-mono text-[10px] bg-purple-500 text-white px-2 py-0.2 rounded-full font-bold uppercase animate-pulse">
                  AI Recommendation
                </span>
              </div>
              <p className="text-[11px] text-purple-200 mt-0.5">
                Unbatched child queries and unindexed heap scans are degrading throughput. Toggle <strong className="text-white font-bold">Batch Eager Loading</strong> &amp; <strong className="text-white font-bold">B-Tree Indexing</strong> simultaneously to resolve.
              </p>
            </div>
          </div>
          {onApplyFlags && (
            <button
              type="button"
              id="btn-ai-quick-fix-apply"
              data-testid="btn-ai-quick-fix-apply"
              onClick={() => {
                onApplyFlags({
                  ...safeFlags,
                  batchEagerLoading: true,
                  btreeIndexing: true
                });
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer shrink-0 flex items-center gap-1.5 transition-all transform hover:scale-105"
              title="Simultaneously enable Batch Eager Loading and B-Tree Indexing"
            >
              <Zap className="w-3.5 h-3.5 text-amber-200" />
              <span>Apply Quick Fix (Batch + Index)</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Query Execution Latency */}
      <div className={`bg-white rounded-xl border p-4 shadow-xs relative overflow-hidden transition-all duration-300 ${isThresholdExceeded ? 'border-rose-300 ring-2 ring-rose-400/20 bg-rose-50/30' : 'border-zinc-200'} ${animatedLatency.isAnimating ? 'ring-2 ring-indigo-400/30 shadow-sm' : ''}`}>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 transition-colors duration-300 ${animatedLatency.isAnimating ? 'text-indigo-500 animate-metric-pulse' : 'text-zinc-400'}`} />
            Query Latency
          </span>
          {queryResult?.cacheHit && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded transition-all duration-300">
              CACHE HIT
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            id="metric-query-latency-value"
            data-testid="metric-query-latency-value"
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums metric-value-transition transition-colors duration-300 flex items-baseline gap-0.5 ${
              animatedLatency.isAnimating
                ? animatedLatency.direction === 'down'
                  ? 'animate-metric-down'
                  : 'animate-metric-up'
                : ''
            } ${isQueryFast ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            <span
              key={`latency-${animatedLatency.updateKey}`}
              className={`inline-block transition-transform duration-300 ${
                animatedLatency.isAnimating
                  ? animatedLatency.direction === 'down'
                    ? 'animate-metric-slide-down'
                    : 'animate-metric-slide-up'
                  : ''
              }`}
            >
              {animatedLatency.formatted}
            </span>
            <span className="text-sm font-medium text-zinc-500 ml-0.5">ms</span>
            {animatedLatency.isAnimating && (
              <span
                className={`text-[11px] font-bold ml-1 transition-opacity duration-300 animate-metric-pulse ${
                  animatedLatency.direction === 'down' ? 'text-emerald-600' : 'text-rose-600'
                }`}
                title={animatedLatency.direction === 'down' ? 'Latency Decreasing (Faster)' : 'Latency Increasing (Slower)'}
              >
                {animatedLatency.direction === 'down' ? '↓' : '↑'}
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between transition-colors duration-300">
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
          className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 ease-out ${
            isThresholdExceeded ? 'bg-rose-600' : isQueryFast ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 2. Rows Scanned */}
      <div
        id="metric-card-rows-scanned"
        className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden transition-all duration-300 ${
          animatedRowsScanned.isAnimating ? 'ring-2 ring-blue-400/30 shadow-sm' : ''
        } ${
          onOpenBulkImport ? 'cursor-pointer hover:border-blue-300 group' : ''
        }`}
        onClick={onOpenBulkImport}
        title={onOpenBulkImport ? "Click to open Bulk Data Import Simulator" : undefined}
      >
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Database className={`w-3.5 h-3.5 transition-colors duration-300 ${animatedRowsScanned.isAnimating ? 'text-blue-600 animate-metric-pulse' : 'text-zinc-400 group-hover:text-blue-600'}`} />
            Rows Scanned
          </span>
          {effectiveTotalRecords > 50000 && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 transition-all duration-300">
              +{((effectiveTotalRecords - 50000) / 1000).toFixed(0)}k Ingested
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            id="metric-rows-scanned-value"
            data-testid="metric-rows-scanned-value"
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums metric-value-transition transition-colors duration-300 flex items-baseline gap-1 ${
              animatedRowsScanned.isAnimating
                ? animatedRowsScanned.direction === 'down'
                  ? 'animate-metric-down'
                  : 'animate-metric-up'
                : ''
            } ${
              (queryResult?.rowsScanned ?? 0) < 1000 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            <span
              key={`rows-${animatedRowsScanned.updateKey}`}
              className={`inline-block transition-transform duration-300 ${
                animatedRowsScanned.isAnimating
                  ? animatedRowsScanned.direction === 'down'
                    ? 'animate-metric-slide-down'
                    : 'animate-metric-slide-up'
                  : ''
              }`}
            >
              {animatedRowsScanned.formatted}
            </span>
            {animatedRowsScanned.isAnimating && (
              <span
                className={`text-[11px] font-bold transition-opacity duration-300 animate-metric-pulse ${
                  animatedRowsScanned.direction === 'down' ? 'text-emerald-600' : 'text-amber-600'
                }`}
                title={animatedRowsScanned.direction === 'down' ? 'Rows Scanned Decreased' : 'Rows Scanned Increased'}
              >
                {animatedRowsScanned.direction === 'down' ? '↓' : '↑'}
              </span>
            )}
          </span>
          <span
            key={`total-${animatedTotalRecords.updateKey}`}
            className={`text-xs text-zinc-400 font-mono tabular-nums transition-all duration-300 inline-block ${
              animatedTotalRecords.isAnimating ? 'animate-metric-pulse text-blue-600 font-semibold' : ''
            }`}
          >
            / {animatedTotalRecords.formatted} total
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between transition-colors duration-300">
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
          className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 ease-out ${
            (queryResult?.rowsScanned ?? 0) < 1000 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* 3. UI Frame Rate (FPS) */}
      <div className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden transition-all duration-300 ${animatedFps.isAnimating ? 'ring-2 ring-emerald-400/30 shadow-sm' : ''}`}>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Monitor className={`w-3.5 h-3.5 transition-colors duration-300 ${animatedFps.isAnimating ? 'text-emerald-600 animate-metric-pulse' : 'text-zinc-400'}`} />
            UI Frame Rate
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all duration-300 ${
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
            id="metric-fps-value"
            data-testid="metric-fps-value"
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums metric-value-transition transition-colors duration-300 flex items-baseline gap-0.5 ${
              animatedFps.isAnimating
                ? animatedFps.direction === 'up'
                  ? 'animate-metric-up'
                  : 'animate-metric-down'
                : ''
            } ${isFpsGood ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            <span
              key={`fps-${animatedFps.updateKey}`}
              className={`inline-block transition-transform duration-300 ${
                animatedFps.isAnimating
                  ? animatedFps.direction === 'up'
                    ? 'animate-metric-slide-up'
                    : 'animate-metric-slide-down'
                  : ''
              }`}
            >
              {animatedFps.formatted}
            </span>
            <span className="text-sm font-medium text-zinc-500 ml-0.5">FPS</span>
            {animatedFps.isAnimating && (
              <span
                className={`text-[11px] font-bold ml-1 transition-opacity duration-300 animate-metric-pulse ${
                  animatedFps.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'
                }`}
                title={animatedFps.direction === 'up' ? 'FPS Improving' : 'FPS Dropping'}
              >
                {animatedFps.direction === 'up' ? '↑' : '↓'}
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 transition-colors duration-300">
          {safeFlags.virtualizedDOM ? (
            <span className="text-emerald-700 font-medium">Virtual Windowing ON</span>
          ) : (
            <span className="text-rose-600 font-medium">DOM Overload (Stuttering)</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 ease-out ${
            isFpsGood ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 4. Active DOM Nodes in Viewport */}
      <div className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden transition-all duration-300 ${animatedDomCount.isAnimating ? 'ring-2 ring-indigo-400/30 shadow-sm' : ''}`}>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Layers className={`w-3.5 h-3.5 transition-colors duration-300 ${animatedDomCount.isAnimating ? 'text-indigo-600 animate-metric-pulse' : 'text-zinc-400'}`} />
            Active DOM Nodes
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            id="metric-dom-nodes-value"
            data-testid="metric-dom-nodes-value"
            className={`text-2xl font-bold tracking-tight font-mono tabular-nums metric-value-transition transition-colors duration-300 flex items-baseline gap-0.5 ${
              animatedDomCount.isAnimating
                ? animatedDomCount.direction === 'down'
                  ? 'animate-metric-down'
                  : 'animate-metric-up'
                : ''
            } ${isDomHealthy ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            <span
              key={`dom-${animatedDomCount.updateKey}`}
              className={`inline-block transition-transform duration-300 ${
                animatedDomCount.isAnimating
                  ? animatedDomCount.direction === 'down'
                    ? 'animate-metric-slide-down'
                    : 'animate-metric-slide-up'
                  : ''
              }`}
            >
              {animatedDomCount.formatted}
            </span>
            <span className="text-sm font-medium text-zinc-500 ml-0.5">elements</span>
            {animatedDomCount.isAnimating && (
              <span
                className={`text-[11px] font-bold ml-1 transition-opacity duration-300 animate-metric-pulse ${
                  animatedDomCount.direction === 'down' ? 'text-emerald-600' : 'text-rose-600'
                }`}
                title={animatedDomCount.direction === 'down' ? 'DOM Nodes Reduced (Optimized)' : 'DOM Nodes Increased'}
              >
                {animatedDomCount.direction === 'down' ? '↓' : '↑'}
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 transition-colors duration-300">
          {isDomHealthy ? (
            <span className="text-emerald-700 font-medium">Ultra-low memory footprint</span>
          ) : (
            <span className="text-rose-600 font-medium">Heavy layout recalculations</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 ease-out ${
            isDomHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 5. Database Connection Pool Status & Auto-Refresh Toggle */}
      <div className={`col-span-2 lg:col-span-1 bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${animatedDbConnections.isAnimating ? 'ring-2 ring-indigo-400/30 shadow-sm' : ''}`}>
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Zap className={`w-3.5 h-3.5 transition-colors duration-300 ${animatedDbConnections.isAnimating ? 'text-indigo-600 animate-metric-pulse' : 'text-zinc-400'}`} />
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
              id="metric-db-connections-value"
              data-testid="metric-db-connections-value"
              className={`text-2xl font-bold tracking-tight font-mono tabular-nums metric-value-transition transition-colors duration-300 flex items-baseline gap-0.5 ${
                animatedDbConnections.isAnimating
                  ? animatedDbConnections.direction === 'down'
                    ? 'animate-metric-down'
                    : 'animate-metric-up'
                  : ''
              } ${isPoolHealthy ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              <span
                key={`db-${animatedDbConnections.updateKey}`}
                className={`inline-block transition-transform duration-300 ${
                  animatedDbConnections.isAnimating
                    ? animatedDbConnections.direction === 'down'
                      ? 'animate-metric-slide-down'
                      : 'animate-metric-slide-up'
                    : ''
                }`}
              >
                {animatedDbConnections.formatted}
              </span>
              <span className="text-xs font-normal text-zinc-500 ml-1">
                / 25 pooled
              </span>
              {animatedDbConnections.isAnimating && (
                <span
                  className={`text-[11px] font-bold ml-1 transition-opacity duration-300 animate-metric-pulse ${
                    animatedDbConnections.direction === 'down' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                  title={animatedDbConnections.direction === 'down' ? 'Connections Released' : 'Connections Acquired'}
                >
                  {animatedDbConnections.direction === 'down' ? '↓' : '↑'}
                </span>
              )}
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

        <div className="pt-1.5 mt-1.5 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium">Perf Budget</span>
          <select
            id="select-performance-budget"
            data-testid="select-performance-budget"
            value={effectiveBudget}
            onChange={(e) => setEffectiveBudget(Number(e.target.value))}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-zinc-300 cursor-pointer focus:outline-hidden"
            title="Set global maximum allowable latency performance budget"
          >
            <option value={50}>50ms (Strict)</option>
            <option value={100}>100ms (Standard)</option>
            <option value={200}>200ms (Relaxed)</option>
            <option value={500}>500ms (Enterprise)</option>
          </select>
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 ease-out ${
            isPoolHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>
    </div>
    </div>
  );
};

