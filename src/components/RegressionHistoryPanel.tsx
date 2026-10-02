import React, { useState, useMemo } from 'react';
import {
  History,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Zap,
  Sliders,
  CheckCircle2,
  XCircle,
  Filter,
  Play,
  RotateCcw,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Search,
  Sparkles
} from 'lucide-react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';

export interface RegressionHistoryPanelProps {
  trendHistory: LatencyTrendPoint[];
  currentFlags: OptimizationFlags;
  onToggleFlag?: (flag: keyof OptimizationFlags) => void;
  onRunOptimizationSequence?: () => void;
  isSimulatingSequence?: boolean;
}

export interface FlagTransitionEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  flagKey: keyof OptimizationFlags;
  flagName: string;
  flagDescription: string;
  previousState: boolean;
  newState: boolean;
  previousLatencyMs: number;
  currentLatencyMs: number;
  deltaMs: number;
  percentageChange: number;
  isRegression: boolean;
  isImprovement: boolean;
  severity: 'critical' | 'high' | 'moderate' | 'minor' | 'improvement' | 'neutral';
  rootCauseSummary: string;
  technicalDetails: string;
  rowsScanned: number;
  activeQueriesCount: number;
  cacheHit: boolean;
  simulatedError: string | null;
  triggerEvent: string;
}

export const FLAG_METADATA: Record<keyof OptimizationFlags, {
  name: string;
  shortName: string;
  description: string;
  regressionExplanation: string;
  improvementExplanation: string;
  riskCategory: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  typicalLatencyImpactMs: number;
}> = {
  batchEagerLoading: {
    name: 'Batch Eager Loading',
    shortName: 'Batch Eager Joins',
    description: 'Eliminates N+1 query storms by pre-fetching relations in a single batched SQL query',
    regressionExplanation: 'N+1 Query Storm: Synchronous roundtrip fired for each order item, exceeding connection pool limits and spiking latency to 400ms+',
    improvementExplanation: 'Single batched SQL INNER JOIN fetched all relations in a single roundtrip, restoring <2ms latency',
    riskCategory: 'CRITICAL',
    typicalLatencyImpactMs: 460
  },
  btreeIndexing: {
    name: 'B-Tree Indexing',
    shortName: 'B-Tree Index',
    description: 'Enables logarithmic index lookup on composite keys, avoiding 50,000-row sequential scans',
    regressionExplanation: 'Sequential Table Scan: Database engine traverses entire heap (50,000 tuples) without pointer indices',
    improvementExplanation: 'B-Tree pointer index traversal eliminates full table scan, targeting specific tuples in O(log N) time',
    riskCategory: 'HIGH',
    typicalLatencyImpactMs: 50
  },
  queryCaching: {
    name: 'LRU Query Caching',
    shortName: 'LRU Cache',
    description: 'In-memory LRU cache delivering sub-millisecond query retrieval for repeated key patterns',
    regressionExplanation: 'Cache Miss: LRU memory bypassed, requiring database query parse, analyze, and plan execution',
    improvementExplanation: 'In-memory LRU cache hit delivers instant sub-millisecond query result without database roundtrip',
    riskCategory: 'LOW',
    typicalLatencyImpactMs: 1.5
  },
  virtualizedDOM: {
    name: 'Virtualized DOM Windowing',
    shortName: 'DOM Virtualization',
    description: 'Renders only visible rows in the viewport, preventing DOM tree bloat and paint stutter',
    regressionExplanation: 'DOM Tree Bloat: Mounting 5,000+ unwindowed DOM nodes causes layout thrashing and main-thread blocking',
    improvementExplanation: 'Viewport windowing keeps DOM size fixed at 15 items, guaranteeing constant 60 FPS scrolling',
    riskCategory: 'MEDIUM',
    typicalLatencyImpactMs: 18
  },
  deferredRendering: {
    name: 'Deferred Concurrent Rendering',
    shortName: 'Concurrent Render',
    description: 'Leverages React 19 concurrent transitions to keep high-frequency inputs responsive',
    regressionExplanation: 'Synchronous Render Block: High-frequency state updates block UI thread during intense filtering',
    improvementExplanation: 'Non-blocking concurrent transitions schedule heavy re-renders in the background without UI freeze',
    riskCategory: 'LOW',
    typicalLatencyImpactMs: 3
  }
};

export const RegressionHistoryPanel: React.FC<RegressionHistoryPanelProps> = ({
  trendHistory,
  currentFlags,
  onToggleFlag,
  onRunOptimizationSequence,
  isSimulatingSequence = false
}) => {
  const [selectedFlagFilter, setSelectedFlagFilter] = useState<'all' | keyof OptimizationFlags>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'regressions' | 'improvements'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'cards' | 'matrix'>('timeline');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [revertToast, setRevertToast] = useState<string | null>(null);

  // Derive flag transition events from trendHistory
  const flagEvents: FlagTransitionEvent[] = useMemo(() => {
    if (!trendHistory || trendHistory.length === 0) return [];

    const events: FlagTransitionEvent[] = [];

    for (let i = 0; i < trendHistory.length; i++) {
      const point = trendHistory[i];
      const prevPoint = i > 0 ? trendHistory[i - 1] : null;

      // Case 1: Point explicitly specifies flagToggled
      if (point.flagToggled) {
        const flagKey = point.flagToggled;
        const meta = FLAG_METADATA[flagKey];
        const newState = point.flagToggledState !== undefined
          ? point.flagToggledState
          : (point.flags ? point.flags[flagKey] : true);
        const prevLatency = prevPoint ? prevPoint.executionTimeMs : (newState ? 50 : 1.2);
        const currentLatency = point.executionTimeMs;
        const delta = point.deltaMs !== undefined ? point.deltaMs : Number((currentLatency - prevLatency).toFixed(2));
        const pct = prevLatency > 0 ? Number(((delta / prevLatency) * 100).toFixed(1)) : 0;
        const isReg = delta > 0.05;
        const isImp = delta < -0.05;

        let severity: FlagTransitionEvent['severity'] = 'neutral';
        if (isReg) {
          if (delta >= 100 || point.simulatedError) severity = 'critical';
          else if (delta >= 30) severity = 'high';
          else if (delta >= 5) severity = 'moderate';
          else severity = 'minor';
        } else if (isImp) {
          severity = 'improvement';
        }

        events.push({
          id: point.id || `event-${i}`,
          timestamp: point.timestamp,
          timeFormatted: point.timeFormatted,
          flagKey,
          flagName: meta?.name || flagKey,
          flagDescription: meta?.description || '',
          previousState: !newState,
          newState,
          previousLatencyMs: prevLatency,
          currentLatencyMs: currentLatency,
          deltaMs: delta,
          percentageChange: pct,
          isRegression: isReg,
          isImprovement: isImp,
          severity,
          rootCauseSummary: newState ? (meta?.improvementExplanation || 'Optimization restored') : (meta?.regressionExplanation || 'Performance degraded'),
          technicalDetails: `Rows scanned: ${point.rowsScanned.toLocaleString()} • Active queries: ${point.activeQueriesCount} • Cache: ${point.cacheHit ? 'HIT' : 'MISS'}${point.simulatedError ? ` • Error: ${point.simulatedError}` : ''}`,
          rowsScanned: point.rowsScanned,
          activeQueriesCount: point.activeQueriesCount,
          cacheHit: point.cacheHit,
          simulatedError: point.simulatedError,
          triggerEvent: point.triggerEvent
        });
      } else if (prevPoint && point.flags && prevPoint.flags) {
        // Case 2: Inspect diff between prevPoint.flags and point.flags
        const keys = Object.keys(point.flags) as (keyof OptimizationFlags)[];
        for (const key of keys) {
          if (point.flags[key] !== prevPoint.flags[key]) {
            const flagKey = key;
            const meta = FLAG_METADATA[flagKey];
            const newState = point.flags[key];
            const prevLatency = prevPoint.executionTimeMs;
            const currentLatency = point.executionTimeMs;
            const delta = Number((currentLatency - prevLatency).toFixed(2));
            const pct = prevLatency > 0 ? Number(((delta / prevLatency) * 100).toFixed(1)) : 0;
            const isReg = delta > 0.05;
            const isImp = delta < -0.05;

            let severity: FlagTransitionEvent['severity'] = 'neutral';
            if (isReg) {
              if (delta >= 100 || point.simulatedError) severity = 'critical';
              else if (delta >= 30) severity = 'high';
              else if (delta >= 5) severity = 'moderate';
              else severity = 'minor';
            } else if (isImp) {
              severity = 'improvement';
            }

            events.push({
              id: `${point.id}-${key}`,
              timestamp: point.timestamp,
              timeFormatted: point.timeFormatted,
              flagKey,
              flagName: meta?.name || flagKey,
              flagDescription: meta?.description || '',
              previousState: !newState,
              newState,
              previousLatencyMs: prevLatency,
              currentLatencyMs: currentLatency,
              deltaMs: delta,
              percentageChange: pct,
              isRegression: isReg,
              isImprovement: isImp,
              severity,
              rootCauseSummary: newState ? (meta?.improvementExplanation || 'Optimization restored') : (meta?.regressionExplanation || 'Performance degraded'),
              technicalDetails: `Rows scanned: ${point.rowsScanned.toLocaleString()} • Active queries: ${point.activeQueriesCount} • Cache: ${point.cacheHit ? 'HIT' : 'MISS'}${point.simulatedError ? ` • Error: ${point.simulatedError}` : ''}`,
              rowsScanned: point.rowsScanned,
              activeQueriesCount: point.activeQueriesCount,
              cacheHit: point.cacheHit,
              simulatedError: point.simulatedError,
              triggerEvent: point.triggerEvent
            });
          }
        }
      }
    }

    return events;
  }, [trendHistory]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return flagEvents.filter((ev) => {
      // Flag filter
      if (selectedFlagFilter !== 'all' && ev.flagKey !== selectedFlagFilter) {
        return false;
      }
      // Outcome filter
      if (outcomeFilter === 'regressions' && !ev.isRegression) {
        return false;
      }
      if (outcomeFilter === 'improvements' && !ev.isImprovement) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ev.flagName.toLowerCase().includes(q) ||
          ev.flagKey.toLowerCase().includes(q) ||
          ev.rootCauseSummary.toLowerCase().includes(q) ||
          ev.triggerEvent.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [flagEvents, selectedFlagFilter, outcomeFilter, searchQuery]);

  // Aggregate statistics across historical flag transitions
  const stats = useMemo(() => {
    const totalTransitions = flagEvents.length;
    const regressions = flagEvents.filter((e) => e.isRegression);
    const improvements = flagEvents.filter((e) => e.isImprovement);
    const criticalRegressions = flagEvents.filter((e) => e.severity === 'critical');

    let maxRegressionDelta = 0;
    let worstFlag: keyof OptimizationFlags | null = null;
    let maxImprovementDelta = 0;

    regressions.forEach((r) => {
      if (r.deltaMs > maxRegressionDelta) {
        maxRegressionDelta = r.deltaMs;
        worstFlag = r.flagKey;
      }
    });

    improvements.forEach((imp) => {
      if (Math.abs(imp.deltaMs) > maxImprovementDelta) {
        maxImprovementDelta = Math.abs(imp.deltaMs);
      }
    });

    return {
      totalTransitions,
      regressionCount: regressions.length,
      improvementCount: improvements.length,
      criticalCount: criticalRegressions.length,
      maxRegressionDelta,
      worstFlag,
      maxImprovementDelta
    };
  }, [flagEvents]);

  // Handle restoring or toggling a flag directly from a timeline card
  const handleToggleFromTimeline = (flagKey: keyof OptimizationFlags, desiredState?: boolean) => {
    if (!onToggleFlag) return;
    const isCurrent = currentFlags[flagKey];
    if (desiredState !== undefined && isCurrent === desiredState) {
      setRevertToast(`Flag "${FLAG_METADATA[flagKey]?.name || flagKey}" is already ${desiredState ? 'ON' : 'OFF'}.`);
    } else {
      onToggleFlag(flagKey);
      const nextState = desiredState !== undefined ? desiredState : !isCurrent;
      setRevertToast(`Successfully toggled "${FLAG_METADATA[flagKey]?.name || flagKey}" to ${nextState ? 'ON' : 'OFF'}`);
    }
    setTimeout(() => setRevertToast(null), 3500);
  };

  return (
    <div
      id="panel-regression-history"
      data-testid="panel-regression-history"
      className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden transition-all space-y-0"
    >
      {/* Panel Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-zinc-900 via-zinc-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
            <History className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Regression History &amp; Flag Timeline</span>
                <span className="text-[10px] font-mono bg-indigo-900/80 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded-full font-semibold">
                  Historical Flag Correlation
                </span>
              </h3>
            </div>
            <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
              Visualizes performance regressions and optimizations triggered by isolated <strong>Optimization Flags</strong> changes, showing exact timelines of when features were enabled or disabled.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onRunOptimizationSequence && (
            <button
              type="button"
              id="btn-simulate-regression-cycle"
              data-testid="btn-simulate-regression-cycle"
              onClick={onRunOptimizationSequence}
              disabled={isSimulatingSequence}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              title="Execute an automated sequence toggling each flag to demonstrate isolated performance regressions and recoveries"
            >
              <Play className={`w-3.5 h-3.5 ${isSimulatingSequence ? 'animate-spin' : ''}`} />
              <span>{isSimulatingSequence ? 'Simulating Sequence...' : 'Simulate Flag Sequence'}</span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="inline-flex items-center bg-zinc-800/90 rounded-lg p-0.5 border border-zinc-700 text-[11px] font-medium">
            <button
              type="button"
              id="btn-view-mode-timeline"
              data-testid="btn-view-mode-timeline"
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Timeline Track
            </button>
            <button
              type="button"
              id="btn-view-mode-cards"
              data-testid="btn-view-mode-cards"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cards Flow
            </button>
            <button
              type="button"
              id="btn-view-mode-matrix"
              data-testid="btn-view-mode-matrix"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Flag Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {revertToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-inner">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{revertToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRevertToast(null)}
            className="text-white hover:text-emerald-200 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-zinc-200 bg-zinc-50 border-b border-zinc-200 text-xs">
        <div className="p-3 sm:p-3.5 space-y-0.5">
          <span className="text-[11px] text-zinc-500 font-medium block">Total Flag Toggles</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900">{stats.totalTransitions}</span>
            <span className="text-[10px] text-zinc-400 font-medium">recorded events</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 space-y-0.5">
          <span className="text-[11px] text-zinc-500 font-medium block">Regressions Incurred</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-rose-600">{stats.regressionCount}</span>
            <span className="text-[10px] text-rose-700 font-medium">
              ({stats.criticalCount} critical)
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 space-y-0.5">
          <span className="text-[11px] text-zinc-500 font-medium block">Optimizations Restored</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-600">{stats.improvementCount}</span>
            <span className="text-[10px] text-emerald-700 font-medium">recoveries</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 space-y-0.5">
          <span className="text-[11px] text-zinc-500 font-medium block">Worst Peak Regression</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-rose-600">
              +{stats.maxRegressionDelta.toFixed(1)}ms
            </span>
            {stats.worstFlag && (
              <span className="text-[9px] font-mono text-zinc-500 truncate" title={stats.worstFlag}>
                ({FLAG_METADATA[stats.worstFlag]?.shortName || stats.worstFlag})
              </span>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-3.5 space-y-0.5">
          <span className="text-[11px] text-zinc-500 font-medium block">Max Recovery Drop</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-600">
              -{stats.maxImprovementDelta.toFixed(1)}ms
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">savings</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Flag selector pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-zinc-700 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-zinc-400" />
            <span>Filter Flag:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedFlagFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              selectedFlagFilter === 'all'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            All Flags ({flagEvents.length})
          </button>
          {(Object.keys(FLAG_METADATA) as (keyof OptimizationFlags)[]).map((key) => {
            const count = flagEvents.filter((e) => e.flagKey === key).length;
            const isSelected = selectedFlagFilter === key;
            return (
              <button
                key={key}
                type="button"
                id={`btn-filter-flag-${key}`}
                data-testid={`btn-filter-flag-${key}`}
                onClick={() => setSelectedFlagFilter(key)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <span>{FLAG_METADATA[key].shortName}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Outcome filter & Search input */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 text-[11px]">
            <button
              type="button"
              onClick={() => setOutcomeFilter('all')}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                outcomeFilter === 'all' ? 'bg-white font-bold text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              id="filter-regressions-only"
              data-testid="filter-regressions-only"
              onClick={() => setOutcomeFilter('regressions')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer ${
                outcomeFilter === 'regressions'
                  ? 'bg-rose-100 font-bold text-rose-900 shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
              <span>Regressions ({stats.regressionCount})</span>
            </button>
            <button
              type="button"
              id="filter-improvements-only"
              data-testid="filter-improvements-only"
              onClick={() => setOutcomeFilter('improvements')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer ${
                outcomeFilter === 'improvements'
                  ? 'bg-emerald-100 font-bold text-emerald-900 shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-emerald-600" />
              <span>Optimizations ({stats.improvementCount})</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event root cause..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs border border-zinc-300 rounded-lg bg-zinc-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      <div className="p-4 sm:p-5">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-300 space-y-2">
            <History className="w-8 h-8 text-zinc-400 mx-auto" />
            <div className="text-sm font-bold text-zinc-700">No flag transitions match the active filter</div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {flagEvents.length === 0
                ? 'Toggle any optimization flag in the top control bar to begin recording live flag regression telemetry.'
                : 'Try adjusting your flag filter or search term to inspect more events.'}
            </p>
            {onRunOptimizationSequence && flagEvents.length === 0 && (
              <button
                type="button"
                onClick={onRunOptimizationSequence}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Automated Flag Sequence</span>
              </button>
            )}
          </div>
        ) : viewMode === 'timeline' ? (
          /* View Mode 1: Connected Timeline Track */
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-200">
            {filteredEvents.map((event, idx) => {
              const isExpanded = expandedEventId === event.id;
              const isCurrentState = currentFlags[event.flagKey] === event.newState;

              return (
                <div
                  key={event.id}
                  id={`timeline-event-${event.id}`}
                  data-testid={`timeline-event-${event.id}`}
                  className="relative group"
                >
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      event.isRegression
                        ? event.severity === 'critical'
                          ? 'bg-rose-600 border-rose-200 text-white shadow-sm ring-4 ring-rose-100'
                          : 'bg-rose-500 border-white text-white shadow-2xs'
                        : event.isImprovement
                        ? 'bg-emerald-600 border-emerald-200 text-white shadow-sm ring-4 ring-emerald-100'
                        : 'bg-zinc-400 border-white text-white'
                    }`}
                  >
                    {event.isRegression ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : event.isImprovement ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <History className="w-2.5 h-2.5" />
                    )}
                  </div>

                  {/* Event Card */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      event.severity === 'critical'
                        ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-400/20 shadow-2xs hover:shadow-sm'
                        : event.isRegression
                        ? 'bg-amber-50/30 border-amber-200 shadow-2xs hover:shadow-sm'
                        : 'bg-emerald-50/20 border-emerald-200 shadow-2xs hover:shadow-sm'
                    }`}
                  >
                    {/* Header Row: Flag Name, Action & Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{event.flagName}</span>
                        </span>

                        {/* State Toggle Badge (ON / OFF) */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                            event.newState
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {event.newState ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>TOGGLED ON</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-700" />
                              <span>TOGGLED OFF</span>
                            </>
                          )}
                        </span>

                        {/* Severity Pill */}
                        {event.severity === 'critical' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-2xs animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            CRITICAL REGRESSION
                          </span>
                        )}
                        {event.severity === 'high' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            HIGH REGRESSION
                          </span>
                        )}
                        {event.severity === 'moderate' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            MODERATE REGRESSION
                          </span>
                        )}
                        {event.isImprovement && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Zap className="w-3 h-3 text-emerald-600" />
                            OPTIMIZATION RECOVERY
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{event.timeFormatted}</span>
                        </span>
                        <span className="text-zinc-300">|</span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Event #{filteredEvents.length - idx}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Latency Comparison & Root Cause */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-3 items-center">
                      {/* Latency Transition Measurement */}
                      <div className="p-3 bg-white rounded-lg border border-zinc-200/80 shadow-2xs space-y-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-500">
                          Measured Latency Transition
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-zinc-600">
                            {event.previousLatencyMs.toFixed(2)} ms
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                          <span
                            className={`font-mono text-base font-bold ${
                              event.isRegression ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {event.currentLatencyMs.toFixed(2)} ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-100">
                          <span className="text-zinc-500">Delta Impact:</span>
                          <span
                            className={`font-mono font-bold flex items-center gap-0.5 ${
                              event.isRegression ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {event.deltaMs > 0 ? `+${event.deltaMs.toFixed(2)} ms` : `${event.deltaMs.toFixed(2)} ms`}
                            <span>({event.percentageChange > 0 ? `+${event.percentageChange}%` : `${event.percentageChange}%`})</span>
                          </span>
                        </div>
                      </div>

                      {/* Root Cause & Diagnostic Summary */}
                      <div className="md:col-span-2 space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Engine Behavior Analysis:</span>
                        </div>
                        <p className="text-xs text-zinc-700 leading-relaxed font-sans">
                          {event.rootCauseSummary}
                        </p>
                        <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2 flex-wrap">
                          <span>{event.technicalDetails}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Row: Revert / Restore Toggle */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-zinc-200/60 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            <span>Hide Advanced Telemetry</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            <span>Inspect Technical Details</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Restore / Toggle Button */}
                        <button
                          type="button"
                          id={`btn-toggle-flag-action-${event.id}`}
                          data-testid={`btn-toggle-flag-action-${event.id}`}
                          onClick={() => handleToggleFromTimeline(event.flagKey)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isCurrentState
                              ? event.newState
                                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                          }`}
                          title={`Toggle ${event.flagName} state in real time`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>
                            {isCurrentState
                              ? event.newState
                                ? `Toggle ${FLAG_METADATA[event.flagKey]?.shortName} OFF`
                                : `Restore ${FLAG_METADATA[event.flagKey]?.shortName} (Enable)`
                              : `Set to ${event.newState ? 'ON' : 'OFF'}`}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Advanced Telemetry Details */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-zinc-900 text-zinc-200 rounded-lg text-xs font-mono space-y-2 animate-fadeIn border border-zinc-800">
                        <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Database Engine Snapshot Context</span>
                          <span className="text-[10px] text-zinc-400">Event ID: {event.id}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-zinc-800 text-[11px]">
                          <div>
                            <span className="text-zinc-500 block">Rows Scanned:</span>
                            <span className="text-white font-bold">{event.rowsScanned.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Active Queries:</span>
                            <span className="text-white font-bold">{event.activeQueriesCount}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">LRU Cache Hit:</span>
                            <span className={event.cacheHit ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                              {event.cacheHit ? 'TRUE (HIT)' : 'FALSE (MISS)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Simulated Error:</span>
                            <span className={event.simulatedError ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                              {event.simulatedError || 'None (Normal Execution)'}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                          Trigger Event: {event.triggerEvent}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'cards' ? (
          /* View Mode 2: Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                id={`card-flow-${event.id}`}
                data-testid={`card-flow-${event.id}`}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  event.severity === 'critical'
                    ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-400/20 shadow-xs'
                    : event.isRegression
                    ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                    : 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-zinc-900 text-xs truncate" title={event.flagName}>
                      {event.flagName}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      {event.timeFormatted}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                        event.newState
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {event.newState ? 'TOGGLED ON' : 'TOGGLED OFF'}
                    </span>

                    <span
                      className={`font-mono text-xs font-bold ${
                        event.isRegression ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {event.deltaMs > 0 ? `+${event.deltaMs.toFixed(1)}ms` : `${event.deltaMs.toFixed(1)}ms`}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-700 line-clamp-2">
                    {event.rootCauseSummary}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">
                    {event.currentLatencyMs.toFixed(2)}ms (was {event.previousLatencyMs.toFixed(2)}ms)
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleFromTimeline(event.flagKey)}
                    className="px-2.5 py-1 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    Toggle Flag
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* View Mode 3: Flag Matrix & Volatility Summary */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {(Object.keys(FLAG_METADATA) as (keyof OptimizationFlags)[]).map((flagKey) => {
                const meta = FLAG_METADATA[flagKey];
                const isCurrentlyActive = currentFlags[flagKey];
                const toggles = flagEvents.filter((e) => e.flagKey === flagKey);
                const regressions = toggles.filter((e) => e.isRegression);
                const maxReg = regressions.length > 0 ? Math.max(...regressions.map((r) => r.deltaMs)) : 0;

                return (
                  <div
                    key={flagKey}
                    id={`matrix-flag-card-${flagKey}`}
                    data-testid={`matrix-flag-card-${flagKey}`}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                      !isCurrentlyActive
                        ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-400/20'
                        : 'bg-white border-zinc-200 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                            meta.riskCategory === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : meta.riskCategory === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {meta.riskCategory} RISK
                        </span>

                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCurrentlyActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                        {meta.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                        {meta.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-zinc-100 text-[11px] font-mono">
                      <div className="flex justify-between text-zinc-500">
                        <span>Current State:</span>
                        <span className={`font-bold ${isCurrentlyActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isCurrentlyActive ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Max Regression:</span>
                        <span className="font-bold text-rose-700">+{maxReg.toFixed(1)}ms</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span>Historical Toggles:</span>
                        <span className="font-bold text-zinc-800">{toggles.length}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleFromTimeline(flagKey)}
                        className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                          isCurrentlyActive
                            ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isCurrentlyActive ? 'Disable (Test Regression)' : 'Enable (Restore Performance)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
