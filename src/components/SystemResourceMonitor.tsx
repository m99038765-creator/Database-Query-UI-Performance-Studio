import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Zap, Database, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { OptimizationFlags } from '../types';

interface SystemResourceMonitorProps {
  flags: OptimizationFlags;
  recordCount: number;
  cacheHit?: boolean;
}

export const SystemResourceMonitor: React.FC<SystemResourceMonitorProps> = ({
  flags,
  recordCount,
  cacheHit = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [cpuUsage, setCpuUsage] = useState<number>(14);
  const [memoryMb, setMemoryMb] = useState<number>(128);
  const [activeThreads, setActiveThreads] = useState<number>(2);

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

      const baseMem = 120 + (recordCount / 1000) * 12;
      const memJitter = Math.floor(Math.random() * 10) - 5;
      const nextMem = Math.min(512, Math.max(95, Math.round(baseMem + memJitter)));
      setMemoryMb(nextMem);
      setMemoryHistory((h) => [...h.slice(-19), nextMem]);

      const threads = !flags.batchEagerLoading ? 101 : cacheHit ? 1 : 4;
      setActiveThreads(threads);
    }, 3000);

    return () => clearInterval(interval);
  }, [flags, recordCount, cacheHit]);

  const memPercent = Math.round((memoryMb / 512) * 100);

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
        <div className="p-3 space-y-3 w-72">
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

          {/* Active Query Threads & Cache Status */}
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
        </div>
      )}
    </div>
  );
};
