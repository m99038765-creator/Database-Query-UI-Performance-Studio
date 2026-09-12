import React, { useState } from 'react';
import { Cpu, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getCpuPerformanceIndicator } from '../utils/systemCpuMonitor';

interface CpuPerformanceGlowBadgeProps {
  cpuPercent: number;
  className?: string;
  variant?: 'banner' | 'card' | 'inline';
}

/**
 * Dynamic color-coded performance indicator with a vibrant green-to-red glow
 * that reflects the observed CPU thread contention during data serialization.
 */
export const CpuPerformanceGlowBadge: React.FC<CpuPerformanceGlowBadgeProps> = ({
  cpuPercent,
  className = '',
  variant = 'banner'
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const indicator = getCpuPerformanceIndicator(cpuPercent);

  const StatusIcon = indicator.status === 'high' 
    ? AlertTriangle 
    : indicator.status === 'nominal' 
      ? ShieldCheck 
      : Cpu;

  if (variant === 'inline') {
    return (
      <div 
        id="cpu-performance-indicator-inline"
        className={`inline-flex items-center gap-1.5 ${className}`}
        title={`Observed CPU: ${indicator.percent}% (${indicator.label})`}
      >
        <span className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-65"
            style={{ backgroundColor: indicator.hexColor }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2 transition-all duration-300"
            style={{
              backgroundColor: indicator.hexColor,
              boxShadow: `0 0 8px 1.5px ${indicator.glowColor}, 0 0 3px ${indicator.hexColor}`
            }}
          />
        </span>
        <span className="font-mono font-bold text-xs" style={{ color: indicator.hexColor }}>
          {indicator.percent}% CPU
        </span>
        <span className="text-[10px] text-zinc-600 font-medium">
          ({indicator.label})
        </span>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <div
        id="export-cpu-performance-indicator"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`group relative inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all duration-300 cursor-pointer select-none ${indicator.badgeBg} ${indicator.badgeBorder} ${className}`}
        style={{
          boxShadow: `0 0 12px 0px ${indicator.softGlowColor}`
        }}
        aria-label={`CPU Utilization: ${indicator.percent}% - ${indicator.label}`}
      >
        {/* Dynamic Pulsing Green-to-Red Glowing Beacon Orb */}
        <span 
          id="export-cpu-glow-beacon" 
          className="relative flex h-3 w-3 items-center justify-center shrink-0"
        >
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ backgroundColor: indicator.hexColor }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5 transition-all duration-300"
            style={{
              backgroundColor: indicator.hexColor,
              boxShadow: `0 0 10px 2px ${indicator.glowColor}, 0 0 4px ${indicator.hexColor}`
            }}
          />
        </span>

        {/* Indicator Title & Percentage */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <StatusIcon 
            className="w-3.5 h-3.5 transition-transform group-hover:scale-110" 
            style={{ color: indicator.hexColor }} 
          />
          <span className="text-zinc-700 font-medium text-[11px] hidden xs:inline">CPU Impact:</span>
          <span 
            className="font-mono font-bold text-xs transition-colors"
            style={{ color: indicator.hexColor }}
          >
            {indicator.percent}%
          </span>
        </div>

        {/* Dynamic Status Pill */}
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border transition-colors"
          style={{
            borderColor: indicator.glowColor,
            color: indicator.hexColor,
            backgroundColor: indicator.softGlowColor
          }}
        >
          {indicator.label}
        </span>

        {/* Info Affordance */}
        <Info className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
      </div>

      {/* Interactive Tooltip Popover on Hover */}
      {showTooltip && (
        <div
          id="export-cpu-performance-tooltip"
          className="absolute right-0 top-full mt-1.5 w-72 bg-zinc-900/95 backdrop-blur-xs text-white rounded-xl p-3 shadow-xl border border-zinc-700/80 z-40 text-xs pointer-events-none animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: indicator.hexColor,
                  boxShadow: `0 0 8px ${indicator.glowColor}`
                }}
              />
              <span className="font-bold text-zinc-100">Observed Serialization CPU</span>
            </div>
            <span
              className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: indicator.softGlowColor,
                color: indicator.hexColor
              }}
            >
              {indicator.percent}% Load
            </span>
          </div>

          <p className="text-zinc-300 text-[11px] leading-relaxed mb-2">
            {indicator.description}
          </p>

          <div className="bg-zinc-800/80 rounded-lg p-2 border border-zinc-700/50 space-y-1 text-[10px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Performance Band:</span>
              <strong className="text-zinc-200 capitalize">{indicator.status}</strong>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Dynamic Hue Spectrum:</span>
              <span className="font-mono font-semibold" style={{ color: indicator.hexColor }}>
                {indicator.hue}° (Green → Red)
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Execution State:</span>
              <span className="text-zinc-300">Synchronous Stringify</span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[9px] text-zinc-400">
            <span>Dynamic Spectrum Gauge</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="<=35% Optimal" />
              <span className="w-2 h-2 rounded-full bg-lime-500" title="36-55% Controlled" />
              <span className="w-2 h-2 rounded-full bg-amber-500" title="56-75% Elevated" />
              <span className="w-2 h-2 rounded-full bg-rose-500" title=">75% Contended" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
