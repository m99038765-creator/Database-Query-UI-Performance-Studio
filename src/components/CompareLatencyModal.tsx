import React, { useState } from 'react';
import { OptimizationFlags } from '../types';
import {
  X,
  Sliders,
  Zap,
  TrendingDown,
  Clock
} from 'lucide-react';

interface CompareLatencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFlags: OptimizationFlags;
}

export const CompareLatencyModal: React.FC<CompareLatencyModalProps> = ({
  isOpen,
  onClose,
  initialFlags
}) => {
  if (!isOpen) return null;

  // Configuration A state
  const [flagsA, setFlagsA] = useState<OptimizationFlags>({
    ...initialFlags,
    batchEagerLoading: false,
    btreeIndexing: false
  });

  // Configuration B state
  const [flagsB, setFlagsB] = useState<OptimizationFlags>({
    ...initialFlags,
    batchEagerLoading: true,
    btreeIndexing: true
  });

  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Compute simulated benchmark results for a flag set
  const computeMetrics = (flags: OptimizationFlags) => {
    const baseLatency = flags.batchEagerLoading ? 18.5 : 420.0;
    const indexPenalty = flags.btreeIndexing ? 0.0 : 65.0;
    const cacheBonus = flags.queryCaching ? -5.0 : 0.0;
    const domPenalty = flags.virtualizedDOM ? 0.0 : 180.0;
    const cpuLoad = flags.batchEagerLoading && flags.btreeIndexing ? 18 : 88;
    const queries = flags.batchEagerLoading ? 2 : 101;
    const rowsScanned = flags.btreeIndexing ? 35 : 50000;
    const executionTimeMs = Math.max(0.5, baseLatency + indexPenalty + cacheBonus + domPenalty);
    const throughput = (1000 / executionTimeMs) * 25;

    return {
      executionTimeMs,
      queries,
      rowsScanned,
      cpuLoad,
      throughput
    };
  };

  const metricsA = computeMetrics(flagsA);
  const metricsB = computeMetrics(flagsB);

  const latencyDeltaMs = metricsB.executionTimeMs - metricsA.executionTimeMs;
  const percentChange = metricsA.executionTimeMs > 0 ? (latencyDeltaMs / metricsA.executionTimeMs) * 100 : 0;
  const speedup = metricsB.executionTimeMs > 0 ? metricsA.executionTimeMs / metricsB.executionTimeMs : 1;

  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    setHasRun(false);
    setTimeout(() => {
      setIsBenchmarking(false);
      setHasRun(true);
    }, 600);
  };

  const flagList: { key: keyof OptimizationFlags; label: string; desc: string }[] = [
    { key: 'batchEagerLoading', label: 'Batch Eager Join', desc: 'Eliminates N+1 query storms' },
    { key: 'btreeIndexing', label: 'B-Tree Indexing', desc: 'Bypasses 50k table scans' },
    { key: 'queryCaching', label: 'LRU Query Cache', desc: 'In-memory result caching' },
    { key: 'virtualizedDOM', label: 'DOM Virtualization', desc: 'Windowed list rendering' },
    { key: 'deferredRendering', label: 'Concurrent State', desc: 'Non-blocking keyboard typing' }
  ];

  return (
    <div
      id="compare-latency-modal-backdrop"
      className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="compare-latency-modal"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-latency-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h2 id="compare-latency-title" className="text-base font-bold text-zinc-900">
                Compare Latency &amp; Optimization Configurations
              </h2>
              <p className="text-xs text-zinc-500">
                Select two distinct optimization flag profiles and compare their benchmark delta side-by-side.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Preset Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-100 p-3 rounded-xl border border-zinc-200 text-xs">
            <div className="font-semibold text-zinc-700">Quick Comparison Presets:</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFlagsA({ batchEagerLoading: false, btreeIndexing: false, queryCaching: false, virtualizedDOM: true, deferredRendering: true });
                  setFlagsB({ batchEagerLoading: true, btreeIndexing: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true });
                }}
                className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg font-medium text-zinc-800 shadow-2xs transition-colors cursor-pointer"
              >
                Unoptimized (N+1) vs Fully Optimized
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlagsA({ batchEagerLoading: true, btreeIndexing: false, queryCaching: false, virtualizedDOM: true, deferredRendering: true });
                  setFlagsB({ batchEagerLoading: true, btreeIndexing: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true });
                }}
                className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg font-medium text-zinc-800 shadow-2xs transition-colors cursor-pointer"
              >
                Missing Index vs Indexed &amp; Cached
              </button>
            </div>
          </div>

          {/* Side-by-Side Configuration Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuration A */}
            <div className="bg-zinc-50/70 rounded-xl p-5 border border-zinc-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span>Configuration A (Baseline)</span>
                </div>
                <span className="font-mono text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold">
                  {metricsA.executionTimeMs.toFixed(1)} ms
                </span>
              </div>

              <div className="space-y-2.5">
                {flagList.map((f) => (
                  <label
                    key={`a-${f.key}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-zinc-200 hover:border-zinc-300 cursor-pointer select-none text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-800">{f.label}</div>
                      <div className="text-[10px] text-zinc-500">{f.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={flagsA[f.key]}
                      onChange={(e) => setFlagsA({ ...flagsA, [f.key]: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500/30 accent-rose-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              {/* Metrics Summary A */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono text-xs">
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <div className="text-[10px] text-zinc-400">Queries</div>
                  <div className="font-bold text-zinc-900">{metricsA.queries}</div>
                </div>
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <div className="text-[10px] text-zinc-400">Scanned</div>
                  <div className="font-bold text-zinc-900">{metricsA.rowsScanned.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <div className="text-[10px] text-zinc-400">CPU Load</div>
                  <div className="font-bold text-zinc-900">{metricsA.cpuLoad}%</div>
                </div>
              </div>
            </div>

            {/* Configuration B */}
            <div className="bg-emerald-50/40 rounded-xl p-5 border border-emerald-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                <div className="font-bold text-emerald-950 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span>Configuration B (Target)</span>
                </div>
                <span className="font-mono text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  {metricsB.executionTimeMs.toFixed(1)} ms
                </span>
              </div>

              <div className="space-y-2.5">
                {flagList.map((f) => (
                  <label
                    key={`b-${f.key}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-200 hover:border-emerald-300 cursor-pointer select-none text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-800">{f.label}</div>
                      <div className="text-[10px] text-zinc-500">{f.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={flagsB[f.key]}
                      onChange={(e) => setFlagsB({ ...flagsB, [f.key]: e.target.checked })}
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              {/* Metrics Summary B */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono text-xs">
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-zinc-400">Queries</div>
                  <div className="font-bold text-emerald-950">{metricsB.queries}</div>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-zinc-400">Scanned</div>
                  <div className="font-bold text-emerald-950">{metricsB.rowsScanned.toLocaleString()}</div>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <div className="text-[10px] text-zinc-400">CPU Load</div>
                  <div className="font-bold text-emerald-950">{metricsB.cpuLoad}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Run Benchmark Button & Delta Results */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center">
              <button
                type="button"
                id="btn-run-compare-benchmark"
                onClick={handleRunBenchmark}
                disabled={isBenchmarking}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBenchmarking ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-zinc-300" />
                    <span>Running Comparative Benchmarks...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>Run Comparative Benchmark</span>
                  </>
                )}
              </button>
            </div>

            {(hasRun || !isBenchmarking) && (
              <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-emerald-500/10 p-4 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white shadow-sm font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <span>Performance Delta Analysis:</span>
                      <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                        {speedup >= 1 ? `${speedup.toFixed(1)}x Faster` : `${(1 / speedup).toFixed(1)}x Slower`}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-0.5">
                      Configuration B reduces latency by <strong className="text-emerald-700">{Math.abs(latencyDeltaMs).toFixed(1)}ms</strong> ({Math.abs(percentChange).toFixed(1)}%) and saves <strong className="text-emerald-700">{metricsA.queries - metricsB.queries}</strong> database roundtrips.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right font-mono">
                    <div className="text-[10px] text-zinc-500">Throughput Delta</div>
                    <div className="font-bold text-emerald-700">
                      +{Math.round(metricsB.throughput - metricsA.throughput)} rec/sec
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Side-by-side diagnostic benchmark engine.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
