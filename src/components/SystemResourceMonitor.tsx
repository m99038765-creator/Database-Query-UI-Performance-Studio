import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Zap, Database, ChevronUp, ChevronDown, TrendingUp, Clock, AlertTriangle, LineChart } from 'lucide-react';
import { OptimizationFlags } from '../types';
import { ResourceTimeline } from './ResourceTimeline';

interface SystemResourceMonitorProps {
  flags: OptimizationFlags;
  recordCount: number;
  cacheHit?: boolean;
  onAutoCaptureSnapshot?: (triggerEvent: string, details: { memoryMb: number; cpuUsage: number; slope: number }) => void;
}

export const SystemResourceMonitor: React.FC<SystemResourceMonitorProps> = ({
  flags,
  recordCount,
  cacheHit = false,
  onAutoCaptureSnapshot
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'timeline' | 'gauges' | 'all'>('timeline');
  const [cpuUsage, setCpuUsage] = useState<number>(14);
  const [memoryMb, setMemoryMb] = useState<number>(128);
  const [activeThreads, setActiveThreads] = useState<number>(2);
  const [simulateLeak, setSimulateLeak] = useState<boolean>(false);
  const [accumulatedSurge, setAccumulatedSurge] = useState<number>(0);
  const [hasAutoCaptured, setHasAutoCaptured] = useState<boolean>(false);
  const [killToast, setKillToast] = useState<string | null>(null);

  const handleKillLongRunningQueries = () => {
    setActiveThreads(1);
    setCpuUsage((prev) => Math.max(12, Math.round(prev * 0.3)));
    setKillToast('Successfully terminated all queries exceeding 500ms latency threshold!');
    setTimeout(() => {
      setKillToast(null);
    }, 3500);
  };

  // 60-second historical history buffers (sampled every 3 seconds -> 20 points)
  const [cpuHistory, setCpuHistory] = useState<number[]>([14, 15, 14, 16, 18, 14, 15, 15, 14, 16, 15, 14, 15, 14, 16, 15, 14, 15, 14, 14]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([120, 122, 125, 128, 126, 128, 129, 127, 128, 130, 129, 128, 129, 131, 130, 129, 128, 129, 130, 128]);

  // Simulate real-time fluctuations based on optimization flags and load
  useEffect(() => {
    const interval = setInterval(() => {
      const isUnoptimized = !flags.batchEagerLoading || !flags.btreeIndexing;
      const baseCpu = isUnoptimized ? 72 : 15;
      const cpuJitter = Math.floor(Math.random() * 16) - 8;
      const nextCpu = Math.min(99, Math.max(5, baseCpu + cpuJitter));
      setCpuUsage(nextCpu);
      setCpuHistory((h) => [...h.slice(-19), nextCpu]);

      setAccumulatedSurge((prevSurge) => {
        let newSurge = prevSurge;
        if (simulateLeak) {
          newSurge += 14; // Intentional memory surge to demonstrate linear regression prediction
        } else if (!flags.queryCaching && !flags.batchEagerLoading) {
          newSurge += 3; // Unoptimized query accumulation
        } else if (newSurge > 0) {
          newSurge = Math.max(0, newSurge - 6); // Memory relief when optimized
        }

        const baseMem = 120 + (recordCount / 1000) * 12 + newSurge;
        const memJitter = Math.floor(Math.random() * 8) - 4;
        const nextMem = Math.min(512, Math.max(95, Math.round(baseMem + memJitter)));
        setMemoryMb(nextMem);
        setMemoryHistory((h) => [...h.slice(-19), nextMem]);
        return newSurge;
      });

      const threads = !flags.batchEagerLoading ? 101 : cacheHit ? 1 : 4;
      setActiveThreads(threads);
    }, 3000);

    return () => clearInterval(interval);
  }, [flags, recordCount, cacheHit, simulateLeak]);

  const memPercent = Math.round((memoryMb / 512) * 100);

  // Linear regression to predict time until memory usage reaches 90% (460.8MB of 512MB capacity)
  const calculateLinearRegressionTimeToCritical = (
    history: number[],
    currentMem: number
  ) => {
    const CRITICAL_THRESHOLD_MB = 512 * 0.9; // 460.8 MB (90% capacity)

    if (currentMem >= CRITICAL_THRESHOLD_MB) {
      return {
        estimateText: 'Critical (≥90%)',
        slopeMbPerSec: 0,
        slopeMbPerMin: 0,
        status: 'critical' as const,
      };
    }

    if (!history || history.length < 3) {
      return {
        estimateText: 'Calibrating...',
        slopeMbPerSec: 0,
        slopeMbPerMin: 0,
        status: 'stable' as const,
      };
    }

    const n = history.length;
    const STEP_SECONDS = 3; // 3 seconds per interval

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i * STEP_SECONDS;
      const y = history[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    const denominator = sumXX - sumX * meanX;
    const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0; // MB/sec

    const slopeMbPerMin = slope * 60;

    // If slope is near zero or negative, consumption is not trending to critical threshold
    if (slope <= 0.02) {
      return {
        estimateText: 'Stable (Slope ≤ 0)',
        slopeMbPerSec: slope,
        slopeMbPerMin: Math.max(0, slopeMbPerMin),
        status: 'stable' as const,
      };
    }

    const mbRemaining = CRITICAL_THRESHOLD_MB - currentMem;
    const secondsRemaining = Math.max(1, Math.round(mbRemaining / slope));

    let estimateText = '';
    let status: 'critical' | 'warning' | 'stable' = 'stable';

    if (secondsRemaining <= 15) {
      estimateText = '<15s (Imminent)';
      status = 'critical';
    } else if (secondsRemaining < 60) {
      estimateText = `~${secondsRemaining}s`;
      status = 'warning';
    } else if (secondsRemaining < 3600) {
      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      estimateText = `~${mins}m ${secs}s`;
      status = mins < 5 ? 'warning' : 'stable';
    } else {
      const hours = (secondsRemaining / 3600).toFixed(1);
      estimateText = `~${hours} hrs`;
      status = 'stable';
    }

    return {
      estimateText,
      slopeMbPerSec: slope,
      slopeMbPerMin,
      status,
    };
  };

  const timeToCritical = calculateLinearRegressionTimeToCritical(memoryHistory, memoryMb);

  // Auto-capture performance snapshot when Time to Critical exceeds critical threshold
  useEffect(() => {
    if (timeToCritical.status === 'critical') {
      if (!hasAutoCaptured) {
        setHasAutoCaptured(true);
        if (onAutoCaptureSnapshot) {
          onAutoCaptureSnapshot(
            `Memory Critical Surge Reached (${memoryMb}MB / 90% Threshold)`,
            { memoryMb, cpuUsage, slope: timeToCritical.slopeMbPerMin }
          );
        }
      }
    } else if (timeToCritical.status === 'stable') {
      if (hasAutoCaptured) {
        setHasAutoCaptured(false);
      }
    }
  }, [timeToCritical.status, memoryMb, cpuUsage, timeToCritical.slopeMbPerMin, hasAutoCaptured, onAutoCaptureSnapshot]);

  const renderMiniSparkline = (points: number[], color = '#34d399', height = 22, width = 110) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points, min + 1);
    const range = max - min;
    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible inline-block">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
  };

  return (
    <div
      id="system-resource-monitor-widget"
      className="fixed bottom-4 right-4 z-40 bg-zinc-900/95 text-zinc-100 rounded-xl border border-zinc-700 shadow-2xl backdrop-blur-md overflow-hidden text-xs transition-all duration-300 font-mono"
    >
      {/* Header Bar */}
      <div
        className="px-3 py-2 bg-zinc-800/90 border-b border-zinc-700 flex items-center justify-between gap-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-zinc-200 tracking-wide flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>DB Engine Telemetry</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">
            {cpuUsage}% CPU • {memoryMb}MB
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              timeToCritical.status === 'critical'
                ? 'bg-rose-900/80 text-rose-300 border border-rose-700'
                : timeToCritical.status === 'warning'
                ? 'bg-amber-900/80 text-amber-300 border border-amber-700'
                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
            }`}
            title="Time until memory usage reaches 90% critical limit (Linear Regression Estimate)"
          >
            {timeToCritical.estimateText}
          </span>
          <button
            type="button"
            className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
            aria-label="Toggle Resource Monitor"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Metrics Body */}
      {isExpanded && (
        <div className="p-3 space-y-3 w-84 sm:w-92 max-h-[85vh] overflow-y-auto">
          {/* View Mode Tab Switcher */}
          <div className="flex items-center p-0.5 bg-zinc-800 rounded-lg border border-zinc-700 text-[10px] font-semibold">
            <button
              type="button"
              id="tab-resource-timeline"
              data-testid="tab-resource-timeline"
              onClick={() => setActiveView('timeline')}
              className={`flex-1 py-1 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LineChart className="w-3 h-3 text-indigo-300" />
              <span>Timeline (60s)</span>
            </button>
            <button
              type="button"
              id="tab-live-gauges"
              data-testid="tab-live-gauges"
              onClick={() => setActiveView('gauges')}
              className={`flex-1 py-1 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'gauges'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Meters</span>
            </button>
            <button
              type="button"
              id="tab-all-in-one"
              data-testid="tab-all-in-one"
              onClick={() => setActiveView('all')}
              className={`px-2.5 py-1 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeView === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Show both Resource Timeline chart and live meters simultaneously"
            >
              <span>Both</span>
            </button>
          </div>

          {/* 1. Historical Resource Timeline Sparkline Chart */}
          {(activeView === 'timeline' || activeView === 'all') && (
            <ResourceTimeline
              cpuHistory={cpuHistory}
              memoryHistory={memoryHistory}
              maxMemoryMb={512}
              currentCpu={cpuUsage}
              currentMemoryMb={memoryMb}
              height={activeView === 'all' ? 80 : 95}
            />
          )}

          {/* 2. Meters & Regression Analysis */}
          {(activeView === 'gauges' || activeView === 'all') && (
            <>
              {/* CPU Usage Meter & Sparkline */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>CPU Usage (60s Trend)</span>
                  </span>
                  <span className={`font-bold ${cpuUsage > 70 ? 'text-rose-400' : cpuUsage > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {cpuUsage}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-zinc-800/50 p-1.5 rounded-lg border border-zinc-700/60">
                  <div className="w-24">
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          cpuUsage > 70 ? 'bg-rose-500' : cpuUsage > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${cpuUsage}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-1">
                    {renderMiniSparkline(cpuHistory, cpuUsage > 70 ? '#f43f5e' : cpuUsage > 40 ? '#fbbf24' : '#34d399', 20, 110)}
                  </div>
                </div>
              </div>

              {/* Memory Heap Meter & Sparkline */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    <span>Buffer RAM (60s Trend)</span>
                  </span>
                  <span className="font-bold text-blue-400">
                    {memoryMb}MB ({memPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-zinc-800/50 p-1.5 rounded-lg border border-zinc-700/60">
                  <div className="w-24">
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                        style={{ width: `${memPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-1">
                    {renderMiniSparkline(memoryHistory, '#60a5fa', 20, 110)}
                  </div>
                </div>
              </div>

              {/* Linear Regression: Time to Critical (90% Threshold) */}
              <div className="bg-zinc-800/80 p-2.5 rounded-lg border border-zinc-700/80 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-zinc-200">
                    <TrendingUp
                      className={`w-3.5 h-3.5 ${
                        timeToCritical.status === 'warning'
                          ? 'text-amber-400'
                          : timeToCritical.status === 'critical'
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span className="font-semibold">Time to Critical (90% RAM)</span>
                  </span>
                  <span
                    id="time-to-critical-estimate"
                    className={`font-bold px-2 py-0.5 rounded text-[10px] tracking-wide ${
                      timeToCritical.status === 'critical'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-600 animate-pulse'
                        : timeToCritical.status === 'warning'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-600'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                    }`}
                  >
                    {timeToCritical.estimateText}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>Consumption Trend:</span>
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      timeToCritical.slopeMbPerMin > 0 ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {timeToCritical.slopeMbPerMin > 0
                      ? `+${timeToCritical.slopeMbPerMin.toFixed(1)} MB/min`
                      : '≤ 0.0 MB/min (Stable)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-1 border-t border-zinc-700/50">
                  <span>Target: 460.8 MB (90% of 512MB)</span>
                  <button
                    type="button"
                    onClick={() => setSimulateLeak(!simulateLeak)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer transition-colors ${
                      simulateLeak
                        ? 'bg-rose-900/60 text-rose-200 border border-rose-700 hover:bg-rose-800/80'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                    }`}
                    title="Toggle simulated memory consumption surge to observe real-time linear regression projection"
                  >
                    {simulateLeak ? 'Stop Surge' : 'Test Surge'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Always Visible: Active Query Threads & Cache Status */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800 text-[10px] text-zinc-400">
            <div className="bg-zinc-800/60 p-2 rounded-lg border border-zinc-700/60">
              <div className="flex items-center gap-1 text-zinc-300">
                <Database className="w-3 h-3 text-amber-400" />
                <span>Active Queries</span>
              </div>
              <div className="font-bold text-white text-xs mt-0.5">
                {activeThreads} threads
              </div>
            </div>

            <div className="bg-zinc-800/60 p-2 rounded-lg border border-zinc-700/60">
              <div className="flex items-center gap-1 text-zinc-300">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Cache State</span>
              </div>
              <div className="font-bold text-emerald-400 text-xs mt-0.5">
                {cacheHit ? 'LRU Hit (<0.2ms)' : 'Direct Disk Read'}
              </div>
            </div>
          </div>

          {/* Kill Long-Running Queries Action Button */}
          <div className="pt-1">
            <button
              type="button"
              id="btn-kill-long-running-queries"
              data-testid="btn-kill-long-running-queries"
              onClick={handleKillLongRunningQueries}
              className="w-full py-2 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white rounded-lg text-xs font-bold font-sans shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Terminate any active queries currently exceeding the 500ms latency threshold"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-200" />
              <span>Kill Long-Running Queries (&gt;500ms)</span>
            </button>
            {killToast && (
              <div className="mt-2 p-2 bg-emerald-950/90 text-emerald-200 border border-emerald-700 rounded-lg text-[10px] font-mono text-center animate-fadeIn">
                {killToast}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

