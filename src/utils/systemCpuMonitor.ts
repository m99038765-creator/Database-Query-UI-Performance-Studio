import { useState, useEffect } from 'react';

export interface SystemCpuMetrics {
  cpuUsagePercent: number;
  status: 'nominal' | 'elevated' | 'high';
  estimatedThreadLagMs: number;
  activeCores: number;
  timestamp: number;
}

export interface CpuIndicatorDetails {
  percent: number;
  status: 'nominal' | 'moderate' | 'elevated' | 'high';
  label: string;
  hue: number;
  hexColor: string; // Dynamic HSL color
  glowColor: string; // Vibrant glowing shadow color
  softGlowColor: string; // Background aura color
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  description: string;
}

/**
 * Maps observed CPU percentage to a dynamic continuous green-to-red spectrum,
 * glow styles, and diagnostic status levels.
 * 
 * <= 35%: Green (Optimal / Nominal Headroom)
 * 36% - 55%: Lime/Yellow (Controlled Strain)
 * 56% - 75%: Amber/Orange (Elevated Contention)
 * > 75%: Red/Crimson (Heavy Contention)
 */
export function getCpuPerformanceIndicator(cpuPercent: number): CpuIndicatorDetails {
  const clamped = Math.max(5, Math.min(100, Math.round(cpuPercent)));

  let hue: number;
  let status: 'nominal' | 'moderate' | 'elevated' | 'high';
  let label: string;
  let badgeBg: string;
  let badgeBorder: string;
  let textColor: string;
  let description: string;

  if (clamped <= 35) {
    // 148 down to 105 (emerald to vibrant lime-green)
    hue = Math.round(148 - (clamped / 35) * 43);
    status = 'nominal';
    label = 'Optimal Headroom';
    badgeBg = 'bg-emerald-50/90';
    badgeBorder = 'border-emerald-300';
    textColor = 'text-emerald-950';
    description = 'Main thread latency is nominal with zero noticeable GC or UI lock.';
  } else if (clamped <= 55) {
    // 105 down to 55 (lime-green to yellow)
    hue = Math.round(105 - ((clamped - 35) / 20) * 50);
    status = 'moderate';
    label = 'Controlled Strain';
    badgeBg = 'bg-lime-50/90';
    badgeBorder = 'border-lime-300';
    textColor = 'text-lime-950';
    description = 'Standard CPU thread allocation with ample headroom for 60fps renders.';
  } else if (clamped <= 75) {
    // 55 down to 24 (yellow to amber-orange)
    hue = Math.round(55 - ((clamped - 55) / 20) * 31);
    status = 'elevated';
    label = 'Elevated Contention';
    badgeBg = 'bg-amber-50/90';
    badgeBorder = 'border-amber-300';
    textColor = 'text-amber-950';
    description = 'Elevated thread contention during synchronous buffer and string allocations.';
  } else {
    // 24 down to 0 (orange-red to deep crimson)
    hue = Math.round(Math.max(0, 24 - ((clamped - 75) / 25) * 24));
    status = 'high';
    label = 'Heavy Contention';
    badgeBg = 'bg-rose-50/90';
    badgeBorder = 'border-rose-300';
    textColor = 'text-rose-950';
    description = 'High main-thread contention observed during heavy data serialization.';
  }

  const hexColor = `hsl(${hue}, 86%, 42%)`;
  const glowColor = `hsla(${hue}, 92%, 48%, 0.65)`;
  const softGlowColor = `hsla(${hue}, 92%, 48%, 0.16)`;

  return {
    percent: clamped,
    status,
    label,
    hue,
    hexColor,
    glowColor,
    softGlowColor,
    badgeBg,
    badgeBorder,
    textColor,
    description
  };
}

// Global state tracker for synchronous sampling during exports
let currentGlobalCpu = 22;
let lastSampleTimestamp = Date.now();

/**
 * Calculates real-time system global CPU usage based on main thread frame delta,
 * execution delays, and background workload simulation.
 */
export function sampleCurrentCpuUsage(additionalWorkloadStrainMs = 0): SystemCpuMetrics {
  const activeCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency 
    ? navigator.hardwareConcurrency 
    : 8;

  // Base idle/background CPU utilization (typically 14-25%)
  let baseLoad = currentGlobalCpu;

  // Add thread strain if an intensive synchronous task (like JSON stringify or CSV generation) just ran
  if (additionalWorkloadStrainMs > 0) {
    const strain = Math.min(65, Math.round(additionalWorkloadStrainMs * 1.8));
    baseLoad = Math.min(96, Math.max(28, baseLoad + strain));
  }

  const status = baseLoad > 70 ? 'high' : baseLoad > 40 ? 'elevated' : 'nominal';

  return {
    cpuUsagePercent: Math.round(baseLoad),
    status,
    estimatedThreadLagMs: Math.max(0.2, Number(((baseLoad / 100) * 16.6).toFixed(1))),
    activeCores,
    timestamp: Date.now()
  };
}

/**
 * Hook to monitor system CPU utilization continuously using requestAnimationFrame loop.
 */
export function useSystemCpuMonitor(): SystemCpuMetrics {
  const [metrics, setMetrics] = useState<SystemCpuMetrics>(() => sampleCurrentCpuUsage());

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let sampleCounter = 0;

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      sampleCounter++;
      // Sample every ~30 frames (approx every 500ms)
      if (sampleCounter >= 30) {
        sampleCounter = 0;

        // Frame budget at 60fps is ~16.67ms. Any delay represents thread busy time.
        const frameLag = Math.max(0, delta - 16.67);
        const threadLoad = Math.min(100, Math.max(12, Math.round(18 + (frameLag / 16.67) * 60)));
        
        currentGlobalCpu = Math.round(currentGlobalCpu * 0.7 + threadLoad * 0.3);
        lastSampleTimestamp = Date.now();

        setMetrics({
          cpuUsagePercent: currentGlobalCpu,
          status: currentGlobalCpu > 70 ? 'high' : currentGlobalCpu > 40 ? 'elevated' : 'nominal',
          estimatedThreadLagMs: Number(frameLag.toFixed(1)),
          activeCores: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 8,
          timestamp: lastSampleTimestamp
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return metrics;
}
