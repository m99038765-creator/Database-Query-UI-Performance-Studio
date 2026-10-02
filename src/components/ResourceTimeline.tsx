import React, { useState, useMemo } from 'react';
import { Cpu, HardDrive, Clock, TrendingUp, Sparkles, Layers, Activity } from 'lucide-react';

export interface ResourceTimelinePoint {
  index: number;
  secondsAgo: number;
  timestamp: number;
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
}

export interface ResourceTimelineProps {
  cpuHistory: number[];
  memoryHistory: number[];
  maxMemoryMb?: number;
  currentCpu?: number;
  currentMemoryMb?: number;
  height?: number;
  className?: string;
}

export const ResourceTimeline: React.FC<ResourceTimelineProps> = ({
  cpuHistory,
  memoryHistory,
  maxMemoryMb = 512,
  currentCpu,
  currentMemoryMb,
  height = 90,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'combined' | 'split'>('combined');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize points over the 60-second window
  // With 20 samples at 3s intervals = 0s to 57s/60s
  const timelinePoints: ResourceTimelinePoint[] = useMemo(() => {
    const count = Math.max(cpuHistory.length, memoryHistory.length, 2);
    const now = Date.now();
    const intervalSec = 60 / Math.max(1, count - 1);

    return Array.from({ length: count }).map((_, idx) => {
      const cpu = cpuHistory[idx] !== undefined ? cpuHistory[idx] : (currentCpu || 15);
      const memMb = memoryHistory[idx] !== undefined ? memoryHistory[idx] : (currentMemoryMb || 128);
      const memPct = Math.round((memMb / maxMemoryMb) * 100);
      const secondsAgo = Math.round((count - 1 - idx) * intervalSec);

      return {
        index: idx,
        secondsAgo,
        timestamp: now - secondsAgo * 1000,
        cpuPercent: cpu,
        memoryMb: memMb,
        memoryPercent: memPct
      };
    });
  }, [cpuHistory, memoryHistory, maxMemoryMb, currentCpu, currentMemoryMb]);

  const activePoint = hoveredIdx !== null && timelinePoints[hoveredIdx]
    ? timelinePoints[hoveredIdx]
    : timelinePoints[timelinePoints.length - 1];

  // Statistical aggregates over the 60s window
  const stats = useMemo(() => {
    const cpus = timelinePoints.map((p) => p.cpuPercent);
    const mems = timelinePoints.map((p) => p.memoryMb);
    const minCpu = Math.min(...cpus);
    const maxCpu = Math.max(...cpus);
    const avgCpu = Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length);

    const minMem = Math.min(...mems);
    const maxMem = Math.max(...mems);
    const avgMem = Math.round(mems.reduce((a, b) => a + b, 0) / mems.length);

    return { minCpu, maxCpu, avgCpu, minMem, maxMem, avgMem };
  }, [timelinePoints]);

  // Coordinate calculations for SVG sparklines
  const svgWidth = 280;
  const paddingX = 4;
  const usableWidth = svgWidth - paddingX * 2;

  const getCoordinates = (values: number[], minVal: number, maxVal: number, svgH: number) => {
    const range = Math.max(1, maxVal - minVal);
    const padY = 6;
    const usableH = svgH - padY * 2;

    return values.map((val, idx) => {
      const x = paddingX + (idx / (values.length - 1)) * usableWidth;
      const normalized = Math.max(0, Math.min(1, (val - minVal) / range));
      const y = svgH - padY - normalized * usableH;
      return { x, y, val };
    });
  };

  // Combined mode: both normalized to 0-100%
  const cpuCoords = useMemo(() => {
    return getCoordinates(timelinePoints.map((p) => p.cpuPercent), 0, 100, height);
  }, [timelinePoints, height]);

  const memCoords = useMemo(() => {
    return getCoordinates(timelinePoints.map((p) => p.memoryPercent), 0, 100, height);
  }, [timelinePoints, height]);

  // Split mode coordinates
  const splitH = Math.round(height * 0.6);
  const cpuCoordsSplit = useMemo(() => {
    return getCoordinates(timelinePoints.map((p) => p.cpuPercent), 0, 100, splitH);
  }, [timelinePoints, splitH]);

  const memCoordsSplit = useMemo(() => {
    return getCoordinates(timelinePoints.map((p) => p.memoryMb), 64, maxMemoryMb, splitH);
  }, [timelinePoints, splitH, maxMemoryMb]);

  const buildPathString = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    return coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
  };

  const buildAreaString = (coords: Array<{ x: number; y: number }>, baseH: number) => {
    if (coords.length === 0) return '';
    const line = buildPathString(coords);
    const lastX = coords[coords.length - 1].x.toFixed(1);
    const firstX = coords[0].x.toFixed(1);
    return `${line} L ${lastX} ${baseH} L ${firstX} ${baseH} Z`;
  };

  return (
    <div
      id="resource-timeline"
      data-testid="resource-timeline"
      className={`bg-zinc-950/80 rounded-xl border border-zinc-800 p-2.5 space-y-2 text-zinc-100 font-mono ${className}`}
    >
      {/* Timeline Header & View Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-bold text-zinc-200">Resource Timeline</span>
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded font-semibold">
            Last 60s
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            id="btn-timeline-mode-combined"
            data-testid="btn-timeline-mode-combined"
            onClick={() => setViewMode('combined')}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer transition-colors ${
              viewMode === 'combined'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
            title="Overlay both CPU % and Buffer RAM % on a single normalized sparkline"
          >
            Overlay
          </button>
          <button
            type="button"
            id="btn-timeline-mode-split"
            data-testid="btn-timeline-mode-split"
            onClick={() => setViewMode('split')}
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer transition-colors ${
              viewMode === 'split'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
            title="Display dedicated separate sparklines for CPU utilization and Buffer RAM"
          >
            Split
          </button>
        </div>
      </div>

      {/* Active Scrubber Tooltip Summary */}
      <div
        id="timeline-active-metric-hud"
        data-testid="timeline-active-metric-hud"
        className="flex items-center justify-between text-[10px] bg-zinc-900/90 px-2 py-1 rounded-lg border border-zinc-800/80"
      >
        <span className="text-zinc-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{activePoint ? (activePoint.secondsAgo === 0 ? 'Now (Real-Time)' : `-${activePoint.secondsAgo}s ago`) : 'Now'}</span>
        </span>
        <div className="flex items-center gap-2.5 font-bold">
          <span className="text-indigo-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-indigo-400 rounded-full inline-block"></span>
            <span>CPU: {activePoint?.cpuPercent ?? currentCpu}%</span>
          </span>
          <span className="text-cyan-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-400 rounded-full inline-block"></span>
            <span>RAM: {activePoint?.memoryMb ?? currentMemoryMb}MB ({activePoint?.memoryPercent ?? 25}%)</span>
          </span>
        </div>
      </div>

      {/* Sparkline Graph Area */}
      <div className="relative select-none">
        {viewMode === 'combined' ? (
          /* Combined Overlay Sparkline */
          <div className="relative bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/50 overflow-hidden">
            {/* Horizontal Guide Lines */}
            <div className="absolute inset-x-2 inset-y-1 pointer-events-none flex flex-col justify-between text-[8px] text-zinc-600">
              <div className="border-b border-zinc-800/40 w-full flex justify-between">
                <span>100%</span>
              </div>
              <div className="border-b border-zinc-800/30 w-full flex justify-between">
                <span>50%</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>0%</span>
              </div>
            </div>

            <svg
              width="100%"
              height={height}
              viewBox={`0 0 ${svgWidth} ${height}`}
              className="overflow-visible block cursor-crosshair"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Memory Area & Line */}
              <path
                d={buildAreaString(memCoords, height)}
                fill="url(#memGradient)"
              />
              <path
                d={buildPathString(memCoords)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* CPU Area & Line */}
              <path
                d={buildAreaString(cpuCoords, height)}
                fill="url(#cpuGradient)"
              />
              <path
                d={buildPathString(cpuCoords)}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hover Indicator Crosshair */}
              {hoveredIdx !== null && cpuCoords[hoveredIdx] && (
                <g>
                  <line
                    x1={cpuCoords[hoveredIdx].x}
                    y1="0"
                    x2={cpuCoords[hoveredIdx].x}
                    y2={height}
                    stroke="#a1a1aa"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.75"
                  />
                  {/* CPU Hover Dot */}
                  <circle
                    cx={cpuCoords[hoveredIdx].x}
                    cy={cpuCoords[hoveredIdx].y}
                    r="3.5"
                    fill="#818cf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {/* Memory Hover Dot */}
                  {memCoords[hoveredIdx] && (
                    <circle
                      cx={memCoords[hoveredIdx].x}
                      cy={memCoords[hoveredIdx].y}
                      r="3.5"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}

              {/* Interactive Slices for Mouse Hover */}
              {timelinePoints.map((pt, idx) => {
                const sliceW = usableWidth / timelinePoints.length;
                const x = paddingX + idx * sliceW;
                return (
                  <rect
                    key={idx}
                    x={x}
                    y="0"
                    width={sliceW}
                    height={height}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                  />
                );
              })}
            </svg>
          </div>
        ) : (
          /* Split Dual Sparklines */
          <div className="space-y-2">
            {/* CPU Sparkline Panel */}
            <div className="bg-zinc-900/50 rounded-lg p-1.5 border border-zinc-800/50">
              <div className="flex items-center justify-between text-[9px] text-zinc-400 mb-1">
                <span className="flex items-center gap-1 text-indigo-400 font-bold">
                  <Cpu className="w-3 h-3" />
                  <span>CPU Utilization</span>
                </span>
                <span>Max: {stats.maxCpu}%</span>
              </div>
              <svg
                width="100%"
                height={splitH}
                viewBox={`0 0 ${svgWidth} ${splitH}`}
                className="overflow-visible block cursor-crosshair"
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <path
                  d={buildAreaString(cpuCoordsSplit, splitH)}
                  fill="url(#cpuGradient)"
                />
                <path
                  d={buildPathString(cpuCoordsSplit)}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {hoveredIdx !== null && cpuCoordsSplit[hoveredIdx] && (
                  <circle
                    cx={cpuCoordsSplit[hoveredIdx].x}
                    cy={cpuCoordsSplit[hoveredIdx].y}
                    r="3"
                    fill="#818cf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {timelinePoints.map((_, idx) => {
                  const sliceW = usableWidth / timelinePoints.length;
                  return (
                    <rect
                      key={idx}
                      x={paddingX + idx * sliceW}
                      y="0"
                      width={sliceW}
                      height={splitH}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  );
                })}
              </svg>
            </div>

            {/* Buffer RAM Sparkline Panel */}
            <div className="bg-zinc-900/50 rounded-lg p-1.5 border border-zinc-800/50">
              <div className="flex items-center justify-between text-[9px] text-zinc-400 mb-1">
                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                  <HardDrive className="w-3 h-3" />
                  <span>Buffer Memory</span>
                </span>
                <span>Peak: {stats.maxMem}MB</span>
              </div>
              <svg
                width="100%"
                height={splitH}
                viewBox={`0 0 ${svgWidth} ${splitH}`}
                className="overflow-visible block cursor-crosshair"
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <path
                  d={buildAreaString(memCoordsSplit, splitH)}
                  fill="url(#memGradient)"
                />
                <path
                  d={buildPathString(memCoordsSplit)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {hoveredIdx !== null && memCoordsSplit[hoveredIdx] && (
                  <circle
                    cx={memCoordsSplit[hoveredIdx].x}
                    cy={memCoordsSplit[hoveredIdx].y}
                    r="3"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {timelinePoints.map((_, idx) => {
                  const sliceW = usableWidth / timelinePoints.length;
                  return (
                    <rect
                      key={idx}
                      x={paddingX + idx * sliceW}
                      y="0"
                      width={sliceW}
                      height={splitH}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Time Axis Markers (-60s to Now) */}
        <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-1 px-1 font-mono">
          <span>-60s</span>
          <span>-45s</span>
          <span>-30s</span>
          <span>-15s</span>
          <span className="text-zinc-300 font-semibold">Now</span>
        </div>
      </div>

      {/* 60s Aggregate Statistics Footer */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-zinc-800/70 text-[9px] text-zinc-400">
        <div className="flex items-center justify-between bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800/40">
          <span className="text-indigo-300 font-semibold">CPU Range:</span>
          <span className="font-mono text-zinc-200">{stats.minCpu}% - {stats.maxCpu}% (avg {stats.avgCpu}%)</span>
        </div>
        <div className="flex items-center justify-between bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-800/40">
          <span className="text-cyan-300 font-semibold">RAM Range:</span>
          <span className="font-mono text-zinc-200">{stats.minMem} - {stats.maxMem}MB</span>
        </div>
      </div>
    </div>
  );
};
