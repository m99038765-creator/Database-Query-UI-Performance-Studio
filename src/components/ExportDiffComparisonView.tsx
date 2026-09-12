import React, { useMemo } from 'react';
import { ExportHistoryPoint } from '../utils/csvExporter';
import { getCpuPerformanceIndicator } from '../utils/systemCpuMonitor';
import {
  GitCompare,
  ArrowLeftRight,
  Clock,
  Cpu,
  Zap,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  FileCode2,
  X,
  Scale,
  Sparkles
} from 'lucide-react';

interface ExportDiffComparisonViewProps {
  history: ExportHistoryPoint[];
  runAIndex: number;
  runBIndex: number;
  onSelectRunA: (index: number) => void;
  onSelectRunB: (index: number) => void;
  onSwapRuns: () => void;
  onClose: () => void;
  activeSlot: 'A' | 'B';
  onSetActiveSlot: (slot: 'A' | 'B') => void;
}

export const ExportDiffComparisonView: React.FC<ExportDiffComparisonViewProps> = ({
  history,
  runAIndex,
  runBIndex,
  onSelectRunA,
  onSelectRunB,
  onSwapRuns,
  onClose,
  activeSlot,
  onSetActiveSlot
}) => {
  const runA = history[runAIndex] || history[0];
  const runB = history[runBIndex] || history[Math.min(history.length - 1, 1)];

  // CPU Indicator calculations for both runs
  const cpuIndA = useMemo(() => getCpuPerformanceIndicator(runA ? runA.cpuUsagePercent : 0), [runA]);
  const cpuIndB = useMemo(() => getCpuPerformanceIndicator(runB ? runB.cpuUsagePercent : 0), [runB]);

  // Differential Metrics (B relative to A)
  const diff = useMemo(() => {
    if (!runA || !runB) return null;

    const latencyDelta = Number((runB.durationMs - runA.durationMs).toFixed(2));
    const latencyPct = runA.durationMs > 0
      ? Number((((runB.durationMs - runA.durationMs) / runA.durationMs) * 100).toFixed(1))
      : 0;
    const latencySpeedup = runB.durationMs > 0 && runA.durationMs > 0
      ? Number((runA.durationMs / runB.durationMs).toFixed(2))
      : 1;

    const throughputDelta = runB.throughputRowsPerSec - runA.throughputRowsPerSec;
    const throughputPct = runA.throughputRowsPerSec > 0
      ? Number((((runB.throughputRowsPerSec - runA.throughputRowsPerSec) / runA.throughputRowsPerSec) * 100).toFixed(1))
      : 0;

    const cpuDelta = runB.cpuUsagePercent - runA.cpuUsagePercent;
    const cpuPct = runA.cpuUsagePercent > 0
      ? Number((((runB.cpuUsagePercent - runA.cpuUsagePercent) / runA.cpuUsagePercent) * 100).toFixed(1))
      : 0;

    const sizeDelta = runB.fileSizeBytes - runA.fileSizeBytes;
    const sizePct = runA.fileSizeBytes > 0
      ? Number((((runB.fileSizeBytes - runA.fileSizeBytes) / runA.fileSizeBytes) * 100).toFixed(1))
      : 0;

    const usPerRowA = Number(((runA.durationMs / Math.max(1, runA.recordCount)) * 1000).toFixed(2));
    const usPerRowB = Number(((runB.durationMs / Math.max(1, runB.recordCount)) * 1000).toFixed(2));
    const usDelta = Number((usPerRowB - usPerRowA).toFixed(2));

    return {
      latencyDelta,
      latencyPct,
      latencySpeedup,
      throughputDelta,
      throughputPct,
      cpuDelta,
      cpuPct,
      sizeDelta,
      sizePct,
      usPerRowA,
      usPerRowB,
      usDelta
    };
  }, [runA, runB]);

  if (!runA || !runB || !diff) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-50 rounded-lg border border-zinc-200">
        Insufficient export history to perform diff comparison. Execute at least two exports to compare.
      </div>
    );
  }

  // Quick preset handlers
  const handlePresetLatestTwo = () => {
    if (history.length >= 2) {
      onSelectRunA(history.length - 2);
      onSelectRunB(history.length - 1);
    }
  };

  const handlePresetCsvVsJson = () => {
    const csvIdx = history.findIndex(p => p.format === 'csv');
    const jsonIdx = history.findIndex(p => p.format === 'json');
    if (csvIdx !== -1 && jsonIdx !== -1) {
      onSelectRunA(csvIdx);
      onSelectRunB(jsonIdx);
    }
  };

  const handlePresetFastestVsSlowest = () => {
    if (history.length < 2) return;
    let minIdx = 0;
    let maxIdx = 0;
    history.forEach((p, idx) => {
      if (p.durationMs < history[minIdx].durationMs) minIdx = idx;
      if (p.durationMs > history[maxIdx].durationMs) maxIdx = idx;
    });
    if (minIdx !== maxIdx) {
      onSelectRunA(minIdx);
      onSelectRunB(maxIdx);
    }
  };

  return (
    <div
      id="serialization-diff-comparison-panel"
      className="bg-zinc-900 text-zinc-100 rounded-xl p-3.5 border border-zinc-700/80 shadow-xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Diff Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <GitCompare className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white tracking-tight">
                Serialization Performance Diff
              </span>
              <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded border border-zinc-700">
                Run #{runA.runIndex} vs #{runB.runIndex}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Side-by-side comparative variance across serialization wall-time, throughput rate, and thread utilization
            </p>
          </div>
        </div>

        {/* Quick Presets & Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-zinc-400 hidden lg:inline">Presets:</span>
          <button
            type="button"
            onClick={handlePresetLatestTwo}
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            title="Compare the last two historical runs"
          >
            Latest 2
          </button>
          <button
            type="button"
            onClick={handlePresetCsvVsJson}
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            title="Compare CSV format vs JSON format"
          >
            CSV vs JSON
          </button>
          <button
            type="button"
            onClick={handlePresetFastestVsSlowest}
            className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            title="Compare fastest run vs slowest run"
          >
            Fast vs Slow
          </button>
          <button
            type="button"
            onClick={onSwapRuns}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 transition-colors"
            title="Swap Run A and Run B baseline"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Swap A ⇄ B</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors ml-1"
            title="Close Diff Panel"
            aria-label="Close Diff Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target Slot Assignment Banner & Instructions */}
      <div className="bg-zinc-950/70 rounded-lg p-2 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-400 font-medium">Selecting Point from Chart:</span>
          <div className="inline-flex rounded-md p-0.5 bg-zinc-900 border border-zinc-700">
            <button
              type="button"
              onClick={() => onSetActiveSlot('A')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                activeSlot === 'A'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Slot A: Run #{runA.runIndex}
            </button>
            <button
              type="button"
              onClick={() => onSetActiveSlot('B')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                activeSlot === 'B'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Slot B: Run #{runB.runIndex}
            </button>
          </div>
        </div>

        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Click any run on the sparkline to assign to <strong>Slot {activeSlot}</strong></span>
        </div>
      </div>

      {/* Side-by-Side Comparison 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-stretch">
        {/* LEFT COLUMN: Run A (Baseline) */}
        <div className="md:col-span-4 bg-zinc-950/80 rounded-xl p-3 border border-indigo-900/60 flex flex-col justify-between shadow-inner">
          <div>
            {/* Run A Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  A
                </span>
                <span className="font-bold text-white text-xs">
                  Run #{runA.runIndex} (Baseline)
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  runA.format === 'json'
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                }`}
              >
                {runA.format === 'json' ? <FileCode2 className="w-2.5 h-2.5" /> : <FileSpreadsheet className="w-2.5 h-2.5" />}
                {runA.format}
              </span>
            </div>

            {/* Run A Run Dropdown Selector */}
            <div className="mt-2 mb-2.5">
              <label htmlFor="diff-select-run-a" className="text-[10px] text-zinc-400 block mb-0.5">
                Select Run A:
              </label>
              <select
                id="diff-select-run-a"
                value={runAIndex}
                onChange={(e) => onSelectRunA(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-md px-2 py-1 font-mono focus:outline-hidden focus:border-indigo-500"
              >
                {history.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    #{p.runIndex} ({p.format.toUpperCase()}) — {p.durationMs}ms | {p.cpuUsagePercent}% CPU | {p.throughputRowsPerSec.toLocaleString()} r/s
                  </option>
                ))}
              </select>
            </div>

            {/* Run A: The 3 Key Core Comparison Metrics */}
            <div className="space-y-2">
              {/* Metric 1: Latency */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    Serialization Latency
                  </span>
                  <span className="font-mono">{diff.usPerRowA} µs/row</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-white">
                    {runA.durationMs}
                  </span>
                  <span className="text-xs text-zinc-400">ms</span>
                </div>
              </div>

              {/* Metric 2: Throughput */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Throughput Rate
                  </span>
                  <span className="font-mono">{runA.recordCount.toLocaleString()} rows</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-white">
                    {runA.throughputRowsPerSec.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400">rows/sec</span>
                </div>
              </div>

              {/* Metric 3: CPU Usage */}
              <div
                className="rounded-lg p-2 border"
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.9)',
                  borderColor: cpuIndA.hexColor
                }}
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Cpu className="w-3 h-3 text-zinc-400" />
                    Observed CPU Load
                  </span>
                  <span
                    className="font-semibold text-[10px] truncate max-w-[110px]"
                    style={{ color: cpuIndA.hexColor }}
                  >
                    {cpuIndA.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-mono text-xl font-extrabold"
                    style={{ color: cpuIndA.hexColor }}
                  >
                    {runA.cpuUsagePercent}%
                  </span>
                  <span className="text-xs text-zinc-400">thread utilization</span>
                </div>
              </div>
            </div>
          </div>

          {/* Run A Payload Footprint */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
            <span>Size: {(runA.fileSizeBytes / 1024).toFixed(1)} KB</span>
            <span>At {runA.timeFormatted}</span>
          </div>
        </div>

        {/* CENTER COLUMN: Differential / Variance Metrics (A vs B) */}
        <div className="md:col-span-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex flex-col justify-between">
          <div>
            {/* Center Header */}
            <div className="flex items-center justify-center gap-1.5 pb-2 border-b border-zinc-800 text-center">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-xs text-zinc-200 uppercase tracking-wider">
                Variance (B vs A)
              </span>
            </div>

            {/* Differential Breakdown Cards */}
            <div className="space-y-2 my-2.5">
              {/* Latency Variance */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800/80 text-center">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Latency Delta
                </span>
                <div className="flex items-center justify-center gap-1.5 my-0.5">
                  {diff.latencyDelta < 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-base font-extrabold">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {diff.latencyDelta}ms ({diff.latencyPct}%)
                    </span>
                  ) : diff.latencyDelta > 0 ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-mono text-base font-extrabold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{diff.latencyDelta}ms (+{diff.latencyPct}%)
                    </span>
                  ) : (
                    <span className="text-zinc-300 font-mono text-base font-extrabold">0.00ms (0%)</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 block leading-tight">
                  {diff.latencyDelta < 0 ? (
                    <strong className="text-emerald-300">{diff.latencySpeedup}x faster</strong>
                  ) : diff.latencyDelta > 0 ? (
                    <strong className="text-rose-300">{(runB.durationMs / Math.max(0.01, runA.durationMs)).toFixed(2)}x slower</strong>
                  ) : (
                    'Identical latency'
                  )}
                </span>
              </div>

              {/* Throughput Variance */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800/80 text-center">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Throughput Delta
                </span>
                <div className="flex items-center justify-center gap-1.5 my-0.5">
                  {diff.throughputDelta > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-base font-extrabold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{diff.throughputDelta.toLocaleString()} r/s
                    </span>
                  ) : diff.throughputDelta < 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-base font-extrabold">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {diff.throughputDelta.toLocaleString()} r/s
                    </span>
                  ) : (
                    <span className="text-zinc-300 font-mono text-base font-extrabold">0 r/s</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 block leading-tight">
                  {diff.throughputDelta > 0 ? (
                    <strong className="text-emerald-300">+{diff.throughputPct}% higher rate</strong>
                  ) : diff.throughputDelta < 0 ? (
                    <strong className="text-amber-300">{diff.throughputPct}% lower rate</strong>
                  ) : (
                    'Identical throughput'
                  )}
                </span>
              </div>

              {/* CPU Variance */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800/80 text-center">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  CPU Contention Delta
                </span>
                <div className="flex items-center justify-center gap-1.5 my-0.5">
                  {diff.cpuDelta < 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-base font-extrabold">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {diff.cpuDelta}% load
                    </span>
                  ) : diff.cpuDelta > 0 ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-mono text-base font-extrabold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{diff.cpuDelta}% load
                    </span>
                  ) : (
                    <span className="text-zinc-300 font-mono text-base font-extrabold">0% variance</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 block leading-tight">
                  {diff.cpuDelta < 0 ? (
                    <strong className="text-emerald-300">{Math.abs(diff.cpuDelta)}% lower thread strain</strong>
                  ) : diff.cpuDelta > 0 ? (
                    <strong className="text-rose-300">+{diff.cpuDelta}% heavier contention</strong>
                  ) : (
                    'Equivalent CPU load'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Efficiency Verdict Pill */}
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] leading-tight text-center">
            {diff.latencyDelta < 0 && diff.cpuDelta <= 0 ? (
              <span className="text-emerald-300 font-medium">
                ✅ Run B is substantially more efficient (faster with less or equal thread strain).
              </span>
            ) : diff.latencyDelta > 0 && diff.cpuDelta >= 0 ? (
              <span className="text-amber-300 font-medium">
                ⚠️ Run A was more performant than Run B (lower latency &amp; lower CPU load).
              </span>
            ) : diff.latencyDelta < 0 ? (
              <span className="text-emerald-300 font-medium">
                ⚡ Run B achieved lower latency at the expense of slight CPU spike.
              </span>
            ) : (
              <span className="text-zinc-400">
                Mixed trade-offs between serialization formats and thread scheduling.
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Run B (Comparison Target) */}
        <div className="md:col-span-4 bg-zinc-950/80 rounded-xl p-3 border border-emerald-900/60 flex flex-col justify-between shadow-inner">
          <div>
            {/* Run B Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                  B
                </span>
                <span className="font-bold text-white text-xs">
                  Run #{runB.runIndex} (Comparison)
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  runB.format === 'json'
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                }`}
              >
                {runB.format === 'json' ? <FileCode2 className="w-2.5 h-2.5" /> : <FileSpreadsheet className="w-2.5 h-2.5" />}
                {runB.format}
              </span>
            </div>

            {/* Run B Run Dropdown Selector */}
            <div className="mt-2 mb-2.5">
              <label htmlFor="diff-select-run-b" className="text-[10px] text-zinc-400 block mb-0.5">
                Select Run B:
              </label>
              <select
                id="diff-select-run-b"
                value={runBIndex}
                onChange={(e) => onSelectRunB(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-md px-2 py-1 font-mono focus:outline-hidden focus:border-emerald-500"
              >
                {history.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    #{p.runIndex} ({p.format.toUpperCase()}) — {p.durationMs}ms | {p.cpuUsagePercent}% CPU | {p.throughputRowsPerSec.toLocaleString()} r/s
                  </option>
                ))}
              </select>
            </div>

            {/* Run B: The 3 Key Core Comparison Metrics */}
            <div className="space-y-2">
              {/* Metric 1: Latency */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    Serialization Latency
                  </span>
                  <span className="font-mono">{diff.usPerRowB} µs/row</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-white">
                    {runB.durationMs}
                  </span>
                  <span className="text-xs text-zinc-400">ms</span>
                </div>
              </div>

              {/* Metric 2: Throughput */}
              <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Throughput Rate
                  </span>
                  <span className="font-mono">{runB.recordCount.toLocaleString()} rows</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-white">
                    {runB.throughputRowsPerSec.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-400">rows/sec</span>
                </div>
              </div>

              {/* Metric 3: CPU Usage */}
              <div
                className="rounded-lg p-2 border"
                style={{
                  backgroundColor: 'rgba(24, 24, 27, 0.9)',
                  borderColor: cpuIndB.hexColor
                }}
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                    <Cpu className="w-3 h-3 text-zinc-400" />
                    Observed CPU Load
                  </span>
                  <span
                    className="font-semibold text-[10px] truncate max-w-[110px]"
                    style={{ color: cpuIndB.hexColor }}
                  >
                    {cpuIndB.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-mono text-xl font-extrabold"
                    style={{ color: cpuIndB.hexColor }}
                  >
                    {runB.cpuUsagePercent}%
                  </span>
                  <span className="text-xs text-zinc-400">thread utilization</span>
                </div>
              </div>
            </div>
          </div>

          {/* Run B Payload Footprint */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
            <span>Size: {(runB.fileSizeBytes / 1024).toFixed(1)} KB</span>
            <span>At {runB.timeFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
