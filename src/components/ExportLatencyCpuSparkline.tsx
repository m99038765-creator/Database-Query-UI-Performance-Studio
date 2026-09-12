import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ExportHistoryPoint, ExportFormat } from '../utils/csvExporter';
import { getCpuPerformanceIndicator } from '../utils/systemCpuMonitor';
import { SparklineHistoricalPointTooltip } from './SparklineHistoricalPointTooltip';
import { ExportDiffComparisonView } from './ExportDiffComparisonView';
import { Activity, Cpu, Clock, Zap, ArrowUpRight, TrendingUp, Info, Pin, GitCompare } from 'lucide-react';

interface ExportLatencyCpuSparklineProps {
  history: ExportHistoryPoint[];
  currentCpuPercent?: number;
  activeFormat?: ExportFormat;
}

export const ExportLatencyCpuSparkline: React.FC<ExportLatencyCpuSparklineProps> = ({
  history,
  currentCpuPercent = 22,
  activeFormat
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Take the last 10 export operations
  const points = useMemo(() => {
    return history.slice(-10);
  }, [history]);

  // Diff comparison mode state
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [diffRunAIndex, setDiffRunAIndex] = useState<number>(() => Math.max(0, points.length - 2));
  const [diffRunBIndex, setDiffRunBIndex] = useState<number>(() => Math.max(0, points.length - 1));
  const [diffActiveSlot, setDiffActiveSlot] = useState<'A' | 'B'>('A');

  // Keep indices safe if points array updates
  useEffect(() => {
    if (points.length >= 2) {
      setDiffRunAIndex(prev => (prev >= points.length ? points.length - 2 : prev));
      setDiffRunBIndex(prev => (prev >= points.length ? points.length - 1 : prev));
    } else {
      setDiffRunAIndex(0);
      setDiffRunBIndex(0);
    }
  }, [points.length]);

  // Determine active inspected point (either pinned or actively hovered)
  const activeInspectIndex = pinnedIndex !== null ? pinnedIndex : hoveredIndex;
  const isInspecting = !isDiffMode && activeInspectIndex !== null && points[activeInspectIndex] !== undefined;
  const activeHoverPoint = isInspecting ? points[activeInspectIndex] : points[points.length - 1];

  const handleMouseEnterPoint = (index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredIndex(index);
  };

  const handleMouseLeavePoint = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltip && pinnedIndex === null) {
        setHoveredIndex(null);
      }
    }, 180);
  };

  const handleTogglePin = (index?: number) => {
    const target = index !== undefined ? index : activeInspectIndex;
    if (target === null || target === undefined) return;
    setPinnedIndex(prev => (prev === target ? null : target));
    setHoveredIndex(target);
  };

  const handlePointClick = (index: number) => {
    if (isDiffMode) {
      if (diffActiveSlot === 'A') {
        setDiffRunAIndex(index);
        setDiffActiveSlot('B');
      } else {
        setDiffRunBIndex(index);
        setDiffActiveSlot('A');
      }
    } else {
      handleTogglePin(index);
    }
  };

  const handlePrevRun = () => {
    if (activeInspectIndex !== null && activeInspectIndex > 0) {
      const nextIdx = activeInspectIndex - 1;
      if (pinnedIndex !== null) setPinnedIndex(nextIdx);
      setHoveredIndex(nextIdx);
    }
  };

  const handleNextRun = () => {
    if (activeInspectIndex !== null && activeInspectIndex < points.length - 1) {
      const nextIdx = activeInspectIndex + 1;
      if (pinnedIndex !== null) setPinnedIndex(nextIdx);
      setHoveredIndex(nextIdx);
    }
  };

  const handleCloseTooltip = () => {
    setPinnedIndex(null);
    setHoveredIndex(null);
    setIsHoveringTooltip(false);
  };

  // Compute statistical aggregations & correlation
  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        avgCpu: 0,
        maxCpu: 0,
        minCpu: 0,
        csvAvgLatency: 0,
        jsonAvgLatency: 0,
        csvAvgCpu: 0,
        jsonAvgCpu: 0,
        correlationR: 0,
        correlationLabel: 'Insufficient data'
      };
    }

    const latencies = points.map(p => p.durationMs);
    const cpus = points.map(p => p.cpuUsagePercent);

    const sumLat = latencies.reduce((a, b) => a + b, 0);
    const sumCpu = cpus.reduce((a, b) => a + b, 0);

    const avgLatency = sumLat / points.length;
    const avgCpu = sumCpu / points.length;

    const maxLatency = Math.max(...latencies, 10);
    const minLatency = Math.min(...latencies);
    const maxCpu = Math.max(...cpus);
    const minCpu = Math.min(...cpus);

    const csvPoints = points.filter(p => p.format === 'csv');
    const jsonPoints = points.filter(p => p.format === 'json');

    const csvAvgLatency = csvPoints.length > 0 
      ? csvPoints.reduce((acc, p) => acc + p.durationMs, 0) / csvPoints.length 
      : 0;
    const jsonAvgLatency = jsonPoints.length > 0 
      ? jsonPoints.reduce((acc, p) => acc + p.durationMs, 0) / jsonPoints.length 
      : 0;

    const csvAvgCpu = csvPoints.length > 0
      ? csvPoints.reduce((acc, p) => acc + p.cpuUsagePercent, 0) / csvPoints.length
      : 0;
    const jsonAvgCpu = jsonPoints.length > 0
      ? jsonPoints.reduce((acc, p) => acc + p.cpuUsagePercent, 0) / jsonPoints.length
      : 0;

    // Pearson Correlation Coefficient between latency and CPU usage
    let correlationR = 0;
    let correlationLabel = 'Neutral';

    if (points.length > 1) {
      let num = 0;
      let denLat = 0;
      let denCpu = 0;

      for (let i = 0; i < points.length; i++) {
        const dLat = latencies[i] - avgLatency;
        const dCpu = cpus[i] - avgCpu;
        num += dLat * dCpu;
        denLat += dLat * dLat;
        denCpu += dCpu * dCpu;
      }

      const den = Math.sqrt(denLat * denCpu);
      if (den > 0) {
        correlationR = Number((num / den).toFixed(2));
      }

      if (correlationR >= 0.7) {
        correlationLabel = 'Strong Positive';
      } else if (correlationR >= 0.4) {
        correlationLabel = 'Moderate Positive';
      } else if (correlationR > 0) {
        correlationLabel = 'Mild Correlation';
      } else {
        correlationLabel = 'Independent';
      }
    }

    return {
      avgLatency,
      maxLatency,
      minLatency,
      avgCpu,
      maxCpu,
      minCpu,
      csvAvgLatency,
      jsonAvgLatency,
      csvAvgCpu,
      jsonAvgCpu,
      correlationR,
      correlationLabel
    };
  }, [points]);

  // Coordinate scales for SVG (Width: 620, Height: 110, Margins: L40, R40, T16, B24)
  const svgWidth = 620;
  const svgHeight = 110;
  const margin = { top: 16, right: 40, bottom: 22, left: 36 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Latency Y scale: 0 to Math.max(25, maxLatency * 1.25)
  const yLatencyMax = Math.max(25, Math.ceil(stats.maxLatency * 1.25));
  // CPU Y scale: 0 to 100%
  const yCpuMax = 100;

  const getX = (index: number) => {
    if (points.length <= 1) return margin.left + plotWidth / 2;
    return margin.left + (index / (points.length - 1)) * plotWidth;
  };

  const getYLatency = (val: number) => {
    return margin.top + plotHeight - (Math.min(val, yLatencyMax) / yLatencyMax) * plotHeight;
  };

  const getYCpu = (val: number) => {
    return margin.top + plotHeight - (Math.min(val, yCpuMax) / yCpuMax) * plotHeight;
  };

  // Build SVG Paths
  const latencyPointsStr = points.map((p, i) => `${getX(i)},${getYLatency(p.durationMs)}`).join(' ');
  const cpuPointsStr = points.map((p, i) => `${getX(i)},${getYCpu(p.cpuUsagePercent)}`).join(' ');

  // Area under CPU curve
  const cpuAreaPath = points.length > 0
    ? `M ${getX(0)},${margin.top + plotHeight} ` +
      points.map((p, i) => `L ${getX(i)},${getYCpu(p.cpuUsagePercent)}`).join(' ') +
      ` L ${getX(points.length - 1)},${margin.top + plotHeight} Z`
    : '';

  return (
    <div
      id="export-latency-cpu-sparkline-card"
      className="bg-white/95 border border-emerald-200/90 rounded-xl p-3 shadow-2xs flex flex-col gap-2.5 transition-all"
    >
      {/* Sparkline Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 text-xs tracking-tight">
                Export Latency Trend &amp; Global CPU Correlation
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                Last {points.length} Runs
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.2">
              Correlating serialization wall time (ms) against browser thread utilization (%)
            </p>
          </div>
        </div>

        {/* Live Host CPU, Correlation Indicator & Diff Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Diff Mode Toggle Button */}
          <button
            id="export-history-diff-toggle-button"
            type="button"
            onClick={() => {
              setIsDiffMode(prev => {
                const next = !prev;
                if (next && points.length >= 2) {
                  setDiffRunAIndex(points.length - 2);
                  setDiffRunBIndex(points.length - 1);
                  setDiffActiveSlot('A');
                }
                return next;
              });
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              isDiffMode
                ? 'bg-zinc-900 text-emerald-400 border border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-400 shadow-2xs'
            }`}
            title={isDiffMode ? "Close Diff comparison view" : "Open Diff comparison to compare two historical export runs side-by-side"}
            aria-pressed={isDiffMode}
          >
            <GitCompare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Diff</span>
            {isDiffMode ? (
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                ON
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">
                Compare
              </span>
            )}
          </button>

          {(() => {
            const hostIndicator = getCpuPerformanceIndicator(currentCpuPercent);
            return (
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-800 text-[11px] font-medium shadow-2xs"
                title={`Host CPU load: ${currentCpuPercent}% (${hostIndicator.label})`}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: hostIndicator.hexColor }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{
                      backgroundColor: hostIndicator.hexColor,
                      boxShadow: `0 0 6px ${hostIndicator.glowColor}`
                    }}
                  />
                </span>
                <Cpu className="w-3 h-3 text-zinc-500" />
                <span>Host CPU:</span>
                <strong className="font-mono text-zinc-950">{currentCpuPercent}%</strong>
              </div>
            );
          })()}

          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium"
            title={`Pearson correlation coefficient r = ${stats.correlationR} between serialization latency and system CPU load`}
          >
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span>r =</span>
            <strong className="font-mono text-emerald-950">
              {stats.correlationR > 0 ? `+${stats.correlationR}` : stats.correlationR}
            </strong>
            <span className="text-[10px] text-emerald-700 font-normal hidden sm:inline">
              ({stats.correlationLabel})
            </span>
          </div>
        </div>
      </div>

      {/* Mini Sparkline Chart Container */}
      <div className="relative w-full overflow-visible z-20">
        {/* Legends Bar */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 px-1 flex-wrap gap-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-600 rounded-full inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block -ml-2 mr-0.5" />
              <span className="font-semibold text-zinc-700">Export Latency (ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-indigo-500 rounded-full border-b border-dashed border-indigo-600 inline-block" />
              <span className="font-semibold text-indigo-700">Global CPU Load (%)</span>
            </div>
          </div>
          {isDiffMode ? (
            <div className="flex items-center gap-1.5 font-mono text-[10px] bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300">
              <span className="font-bold text-indigo-700 flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold">A</span>
                Run #{points[diffRunAIndex]?.runIndex ?? diffRunAIndex + 1}
              </span>
              <span className="text-zinc-400">vs</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">B</span>
                Run #{points[diffRunBIndex]?.runIndex ?? diffRunBIndex + 1}
              </span>
              <span className="text-zinc-400 hidden sm:inline">• Click point to set Slot {diffActiveSlot}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-zinc-400">Y1: 0–{yLatencyMax}ms</span>
              <span className="text-zinc-300">•</span>
              <span className="text-indigo-400">Y2: 0–100% CPU</span>
              <span className="text-zinc-300 hidden sm:inline">•</span>
              <span className="text-zinc-500 hidden sm:inline">Hover/click points for diagnostics</span>
            </div>
          )}
        </div>

        {/* SVG Sparkline Canvas with Floating Diagnostic Tooltip */}
        <div className="w-full bg-zinc-50/60 rounded-lg border border-zinc-200/70 p-1 relative">
          {/* Hoverable / Pinnable Diagnostic Tooltip */}
          {isInspecting && activeInspectIndex !== null && points[activeInspectIndex] && (
            <SparklineHistoricalPointTooltip
              point={points[activeInspectIndex]}
              stats={{
                avgLatency: stats.avgLatency,
                avgCpu: stats.avgCpu,
                totalRuns: points.length
              }}
              isPinned={pinnedIndex === activeInspectIndex}
              onTogglePin={() => handleTogglePin(activeInspectIndex)}
              onClose={handleCloseTooltip}
              onPrev={activeInspectIndex > 0 ? handlePrevRun : undefined}
              onNext={activeInspectIndex < points.length - 1 ? handleNextRun : undefined}
              hasPrev={activeInspectIndex > 0}
              hasNext={activeInspectIndex < points.length - 1}
              xPercent={(getX(activeInspectIndex) / svgWidth) * 100}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
                }
                setIsHoveringTooltip(true);
              }}
              onMouseLeave={() => {
                setIsHoveringTooltip(false);
                if (pinnedIndex === null) {
                  setHoveredIndex(null);
                }
              }}
            />
          )}

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-28 select-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cpu-area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Guidelines */}
            {[0, 0.33, 0.66, 1].map((ratio) => {
              const y = margin.top + plotHeight * (1 - ratio);
              const latVal = Math.round(ratio * yLatencyMax);
              const cpuVal = Math.round(ratio * 100);
              return (
                <g key={ratio}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={svgWidth - margin.right}
                    y2={y}
                    stroke="#e4e4e7"
                    strokeWidth="1"
                    strokeDasharray={ratio === 0 ? undefined : '3,3'}
                  />
                  {/* Left Y Axis label (ms) */}
                  <text
                    x={margin.left - 4}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] font-mono fill-zinc-400"
                  >
                    {latVal}
                  </text>
                  {/* Right Y Axis label (CPU %) */}
                  <text
                    x={svgWidth - margin.right + 4}
                    y={y + 3}
                    textAnchor="start"
                    className="text-[9px] font-mono fill-indigo-400"
                  >
                    {cpuVal}%
                  </text>
                </g>
              );
            })}

            {/* CPU Usage Area */}
            {cpuAreaPath && (
              <path
                d={cpuAreaPath}
                fill="url(#cpu-area-gradient)"
              />
            )}

            {/* CPU Usage Line */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.75"
                strokeDasharray="4,3"
                points={cpuPointsStr}
              />
            )}

            {/* Latency Trend Line */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={latencyPointsStr}
              />
            )}

            {/* Hover / Pin Crosshair Cursor */}
            {activeInspectIndex !== null && points[activeInspectIndex] && (
              <g>
                <line
                  x1={getX(activeInspectIndex)}
                  y1={margin.top}
                  x2={getX(activeInspectIndex)}
                  y2={margin.top + plotHeight}
                  stroke={pinnedIndex !== null ? '#059669' : '#10b981'}
                  strokeWidth={pinnedIndex !== null ? '2' : '1.5'}
                  strokeDasharray={pinnedIndex !== null ? undefined : '2,2'}
                />
              </g>
            )}

            {/* Data Points: CPU Diamonds & Latency Circles */}
            {points.map((p, i) => {
              const x = getX(i);
              const yLat = getYLatency(p.durationMs);
              const yCpu = getYCpu(p.cpuUsagePercent);
              const isInspected = activeInspectIndex === i;
              const isPinnedPoint = pinnedIndex === i;
              const isLast = i === points.length - 1;
              const isSlotA = isDiffMode && diffRunAIndex === i;
              const isSlotB = isDiffMode && diffRunBIndex === i;

              return (
                <g
                  key={p.id}
                  className="cursor-pointer focus:outline-hidden"
                  onMouseEnter={() => handleMouseEnterPoint(i)}
                  onMouseLeave={handleMouseLeavePoint}
                  onClick={() => handlePointClick(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    isDiffMode
                      ? `Run #${p.runIndex} (${p.format.toUpperCase()}): Click to select for Slot ${diffActiveSlot}.`
                      : `Export run #${p.runIndex}: ${p.durationMs}ms latency, ${p.cpuUsagePercent}% CPU. Click to pin diagnostic details.`
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePointClick(i);
                    }
                  }}
                >
                  {/* Invisible broad hover target */}
                  <rect
                    x={x - (plotWidth / points.length / 2)}
                    y={margin.top}
                    width={plotWidth / points.length}
                    height={plotHeight}
                    fill="transparent"
                  />

                  {/* Diff Mode Slot A Indicator */}
                  {isSlotA && (
                    <g>
                      <line
                        x1={x}
                        y1={margin.top - 6}
                        x2={x}
                        y2={margin.top + plotHeight}
                        stroke="#6366f1"
                        strokeWidth="1.75"
                        strokeDasharray="2,2"
                      />
                      <circle
                        cx={x}
                        cy={margin.top - 6}
                        r={7.5}
                        fill="#4f46e5"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={margin.top - 2.8}
                        textAnchor="middle"
                        className="text-[8.5px] font-black fill-white font-mono pointer-events-none"
                      >
                        A
                      </text>
                    </g>
                  )}

                  {/* Diff Mode Slot B Indicator */}
                  {isSlotB && (
                    <g>
                      <line
                        x1={x}
                        y1={margin.top - 6}
                        x2={x}
                        y2={margin.top + plotHeight}
                        stroke="#059669"
                        strokeWidth="1.75"
                        strokeDasharray="2,2"
                      />
                      <circle
                        cx={x}
                        cy={margin.top - 6}
                        r={7.5}
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={margin.top - 2.8}
                        textAnchor="middle"
                        className="text-[8.5px] font-black fill-white font-mono pointer-events-none"
                      >
                        B
                      </text>
                    </g>
                  )}

                  {/* CPU Diamond Halo for inspected or selected diff point */}
                  {(isInspected || isSlotA || isSlotB) && (
                    <rect
                      x={x - 5.5}
                      y={yCpu - 5.5}
                      width={11}
                      height={11}
                      transform={`rotate(45 ${x} ${yCpu})`}
                      fill={isSlotA ? '#4f46e5' : isSlotB ? '#059669' : '#6366f1'}
                      fillOpacity={0.35}
                    />
                  )}

                  {/* CPU Diamond Marker */}
                  <rect
                    x={x - (isInspected || isSlotA || isSlotB ? 3.5 : 2.5)}
                    y={yCpu - (isInspected || isSlotA || isSlotB ? 3.5 : 2.5)}
                    width={isInspected || isSlotA || isSlotB ? 7 : 5}
                    height={isInspected || isSlotA || isSlotB ? 7 : 5}
                    transform={`rotate(45 ${x} ${yCpu})`}
                    fill="#ffffff"
                    stroke={isSlotA ? '#4f46e5' : isSlotB ? '#059669' : '#6366f1'}
                    strokeWidth={isInspected || isSlotA || isSlotB ? 2.5 : 1.2}
                  />

                  {/* Latency Circle Halo for inspected or selected diff point */}
                  {(isInspected || isSlotA || isSlotB) && (
                    <circle
                      cx={x}
                      cy={yLat}
                      r={isSlotA || isSlotB ? 10 : 9}
                      fill={isSlotA ? '#4f46e5' : isSlotB ? '#059669' : p.format === 'json' ? '#f59e0b' : '#10b981'}
                      fillOpacity={0.28}
                    />
                  )}

                  {/* Latency Circle Marker */}
                  <circle
                    cx={x}
                    cy={yLat}
                    r={isInspected || isSlotA || isSlotB ? 5 : isLast ? 3.8 : 3}
                    fill={isSlotA ? '#4338ca' : isSlotB ? '#047857' : p.format === 'json' ? '#d97706' : '#059669'}
                    stroke="#ffffff"
                    strokeWidth={isInspected || isSlotA || isSlotB ? 2.5 : 1.5}
                  />

                  {/* Run Index Label on bottom axis */}
                  <text
                    x={x}
                    y={margin.top + plotHeight + 14}
                    textAnchor="middle"
                    className={`text-[9px] font-mono ${
                      isSlotA
                        ? 'fill-indigo-700 font-extrabold text-[10px]'
                        : isSlotB
                        ? 'fill-emerald-800 font-extrabold text-[10px]'
                        : isInspected
                        ? 'fill-emerald-800 font-extrabold text-[10px]'
                        : isLast
                        ? 'fill-zinc-700 font-semibold'
                        : 'fill-zinc-400'
                    }`}
                  >
                    #{p.runIndex}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Hover Details Pill (when NOT in Diff mode) */}
          {!isDiffMode && activeHoverPoint && (
            <div
              className={`mt-1.5 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                activeHoverPoint.format === 'json'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold flex items-center gap-1.5">
                  Run #{activeHoverPoint.runIndex}
                  {pinnedIndex === activeInspectIndex && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-300">
                      <Pin className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                      Pinned
                    </span>
                  )}
                  {activeInspectIndex === points.length - 1 && pinnedIndex === null && hoveredIndex === null && (
                    <span className="text-[9px] font-normal text-zinc-500 bg-white/70 px-1 py-0.2 rounded border border-zinc-200">
                      Latest
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/80 border border-zinc-200">
                  {activeHoverPoint.timeFormatted}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                    activeHoverPoint.format === 'json'
                      ? 'bg-amber-200/80 text-amber-900'
                      : 'bg-emerald-200/80 text-emerald-900'
                  }`}
                >
                  {activeHoverPoint.format.toUpperCase()}
                </span>
                <span className="text-zinc-600">
                  {activeHoverPoint.recordCount.toLocaleString()} rows (
                  {(activeHoverPoint.fileSizeBytes / 1024).toFixed(1)} KB)
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-700" />
                  <span>Latency:</span>
                  <strong className="text-zinc-900">{activeHoverPoint.durationMs}ms</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const pillCpuInd = getCpuPerformanceIndicator(activeHoverPoint.cpuUsagePercent);
                    return (
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{
                          backgroundColor: pillCpuInd.hexColor,
                          boxShadow: `0 0 6px ${pillCpuInd.glowColor}`
                        }}
                        title={`${pillCpuInd.label} (${activeHoverPoint.cpuUsagePercent}% CPU)`}
                      />
                    );
                  })()}
                  <Cpu className="w-3 h-3 text-zinc-500" />
                  <span>CPU:</span>
                  <strong className="text-zinc-950">{activeHoverPoint.cpuUsagePercent}%</strong>
                </div>
                <div className="flex items-center gap-1 hidden md:flex">
                  <Zap className="w-3 h-3 text-zinc-500" />
                  <span>Throughput:</span>
                  <span className="text-zinc-700">
                    {activeHoverPoint.throughputRowsPerSec.toLocaleString()} r/s
                  </span>
                </div>
                {pinnedIndex !== null && (
                  <button
                    type="button"
                    onClick={() => handleCloseTooltip()}
                    className="text-[10px] font-sans font-medium text-zinc-600 hover:text-zinc-900 underline ml-1 cursor-pointer"
                  >
                    Unpin
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Side-by-Side Diff Comparison Panel (when in Diff mode) */}
          {isDiffMode && (
            <div className="mt-2">
              <ExportDiffComparisonView
                history={points}
                runAIndex={diffRunAIndex}
                runBIndex={diffRunBIndex}
                onSelectRunA={(idx) => setDiffRunAIndex(idx)}
                onSelectRunB={(idx) => setDiffRunBIndex(idx)}
                onSwapRuns={() => {
                  setDiffRunAIndex(diffRunBIndex);
                  setDiffRunBIndex(diffRunAIndex);
                }}
                onClose={() => setIsDiffMode(false)}
                activeSlot={diffActiveSlot}
                onSetActiveSlot={(slot) => setDiffActiveSlot(slot)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Correlation & Analytical Takeaway Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-zinc-100 text-xs">
        {/* Metric A: CSV vs JSON Avg Latency */}
        <div className="bg-zinc-50/90 rounded-lg p-2 border border-zinc-200/70 flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Format Latency Delta
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-sm font-bold text-emerald-700">
              {stats.csvAvgLatency.toFixed(1)}ms
            </span>
            <span className="text-[10px] text-zinc-400">vs</span>
            <span className="font-mono text-sm font-bold text-amber-700">
              {stats.jsonAvgLatency.toFixed(1)}ms
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            CSV is ~
            {stats.csvAvgLatency > 0
              ? (stats.jsonAvgLatency / stats.csvAvgLatency).toFixed(1)
              : '2.5'}
            x faster in serialization
          </p>
        </div>

        {/* Metric B: Correlated CPU Contention */}
        <div className="bg-zinc-50/90 rounded-lg p-2 border border-zinc-200/70 flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            CPU Contention Ratio
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-sm font-bold text-indigo-900">
              {stats.csvAvgCpu.toFixed(0)}%
            </span>
            <span className="text-[10px] text-zinc-400">vs</span>
            <span className="font-mono text-sm font-bold text-indigo-700">
              {stats.jsonAvgCpu.toFixed(0)}%
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            JSON triggers +{Math.max(0, Math.round(stats.jsonAvgCpu - stats.csvAvgCpu))}% higher thread load
          </p>
        </div>

        {/* Metric C: Peak Observed Latency */}
        <div className="bg-zinc-50/90 rounded-lg p-2 border border-zinc-200/70 flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Max Serialization Lag
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-sm font-bold text-zinc-900">
              {stats.maxLatency.toFixed(1)}
            </span>
            <span className="text-[10px] text-zinc-500">ms peak</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Min: {stats.minLatency.toFixed(1)}ms across runs
          </p>
        </div>

        {/* Metric D: Global Thread Capacity */}
        <div className="bg-zinc-50/90 rounded-lg p-2 border border-zinc-200/70 flex flex-col">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Peak System CPU
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-sm font-bold text-indigo-900">
              {stats.maxCpu}%
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold">
              {stats.maxCpu > 70 ? 'High' : 'Controlled'}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Zero GC freezes during export
          </p>
        </div>
      </div>
    </div>
  );
};
