import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Zap, ArrowRight, Layers, Clock, Cpu, BarChart3, TrendingUp, ShieldCheck, Database, HardDrive } from 'lucide-react';
import { BenchmarkStep, OptimizationFlags } from '../types';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAllOptimizations?: () => void;
  currentFlags?: OptimizationFlags;
  onApplyFlags?: (flags: OptimizationFlags) => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  onApplyAllOptimizations,
  currentFlags,
  onApplyFlags
}) => {
  const [activeTab, setActiveTab] = useState<'suite' | 'delta'>('suite');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [steps, setSteps] = useState<BenchmarkStep[]>([
    {
      name: 'Query 1: Complex Filter Scan',
      unoptimizedTime: 980.5,
      optimizedTime: 2.1,
      unoptimizedRowsScanned: 50000,
      optimizedRowsScanned: 32,
      fpsBefore: 45,
      fpsAfter: 60,
      improvementPercent: 99.7
    },
    {
      name: 'Query 2: N+1 Child Join Storm',
      unoptimizedTime: 1420.0,
      optimizedTime: 4.8,
      unoptimizedRowsScanned: 1250,
      optimizedRowsScanned: 75,
      fpsBefore: 28,
      fpsAfter: 60,
      improvementPercent: 99.6
    },
    {
      name: 'Query 3: Repeated Cache Read',
      unoptimizedTime: 84.0,
      optimizedTime: 0.15,
      unoptimizedRowsScanned: 50000,
      optimizedRowsScanned: 0,
      fpsBefore: 55,
      fpsAfter: 60,
      improvementPercent: 99.8
    },
    {
      name: 'UI Render: 2,500 Row Mount',
      unoptimizedTime: 385.0,
      optimizedTime: 4.2,
      unoptimizedRowsScanned: 0,
      optimizedRowsScanned: 0,
      fpsBefore: 12,
      fpsAfter: 60,
      improvementPercent: 98.9
    },
    {
      name: 'UI Interaction: Rapid Typing',
      unoptimizedTime: 140.0,
      optimizedTime: 1.1,
      unoptimizedRowsScanned: 0,
      optimizedRowsScanned: 0,
      fpsBefore: 16,
      fpsAfter: 60,
      improvementPercent: 99.2
    }
  ]);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const runBenchmarkSuite = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(true);
    setCurrentStepIndex(0);

    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx < steps.length) {
        setCurrentStepIndex(idx);
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsRunning(false);
        setCurrentStepIndex(steps.length);
      }
    }, 450);
  };

  useEffect(() => {
    if (isOpen) {
      runBenchmarkSuite();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
      setCurrentStepIndex(-1);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalUnoptimizedTime = steps.reduce((sum, s) => sum + s.unoptimizedTime, 0);
  const totalOptimizedTime = steps.reduce((sum, s) => sum + s.optimizedTime, 0);
  const overallSpeedup = (
    ((totalUnoptimizedTime - totalOptimizedTime) / totalUnoptimizedTime) *
    100
  ).toFixed(1);

  // Delta calculation against baseline
  const activeOptimizationsCount = currentFlags ? Object.values(currentFlags).filter(Boolean).length : 5;
  const currentLatency = activeOptimizationsCount === 5 ? totalOptimizedTime : activeOptimizationsCount === 0 ? totalUnoptimizedTime : 312.4;
  const latencyDeltaPercent = (((totalUnoptimizedTime - currentLatency) / totalUnoptimizedTime) * 100).toFixed(1);
  const baselineMemoryMb = 485;
  const currentMemoryMb = activeOptimizationsCount === 5 ? 128 : activeOptimizationsCount === 0 ? 485 : 240;
  const memoryReductionPercent = (((baselineMemoryMb - currentMemoryMb) / baselineMemoryMb) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-base">
                Performance Benchmark Suite
              </h3>
              <p className="text-xs text-zinc-500">
                Compare unoptimized legacy bottlenecks against live optimization configuration delta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 bg-zinc-50/50 border-b border-zinc-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('suite')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer border-t border-x ${
              activeTab === 'suite'
                ? 'bg-white text-emerald-800 border-zinc-200 border-b-white -mb-px'
                : 'bg-zinc-100 text-zinc-600 border-transparent hover:bg-zinc-200'
            }`}
          >
            Test Suite Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delta')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer border-t border-x flex items-center gap-1.5 ${
              activeTab === 'delta'
                ? 'bg-white text-indigo-800 border-zinc-200 border-b-white -mb-px'
                : 'bg-zinc-100 text-zinc-600 border-transparent hover:bg-zinc-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Performance Delta Analysis</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5">
          {activeTab === 'suite' ? (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[11px] font-medium text-rose-700">
                    Unoptimized Latency
                  </div>
                  <div className="text-xl font-bold text-rose-900 mt-0.5">
                    {(totalUnoptimizedTime / 1000).toFixed(2)}s
                  </div>
                  <div className="text-[10px] text-rose-600 mt-0.5">
                    Full scans &amp; DOM freezes
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-medium text-emerald-700">
                    Optimized Latency
                  </div>
                  <div className="text-xl font-bold text-emerald-900 mt-0.5">
                    {totalOptimizedTime.toFixed(1)}ms
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">
                    B-Tree + Virtual Window
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="text-[11px] font-medium text-purple-700">
                    Overall Speedup
                  </div>
                  <div className="text-xl font-bold text-purple-900 mt-0.5">
                    +{overallSpeedup}%
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">
                    Buttery smooth 60 FPS
                  </div>
                </div>
              </div>

              {/* Test Steps Progress */}
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden text-xs">
                {steps.map((step, idx) => {
                  const isDone = currentStepIndex > idx || (!isRunning && currentStepIndex >= steps.length);
                  const isCurrent = currentStepIndex === idx && isRunning;

                  return (
                    <div
                      key={idx}
                      className={`p-3 flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-amber-50/50'
                          : isDone
                          ? 'bg-white'
                          : 'bg-zinc-50/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-zinc-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">{step.name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {step.unoptimizedRowsScanned > 0
                              ? `Scanned: ${step.unoptimizedRowsScanned.toLocaleString()} rows → ${step.optimizedRowsScanned} rows`
                              : `Frame rate: ${step.fpsBefore} FPS → ${step.fpsAfter} FPS`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 font-mono text-right">
                        <div>
                          <span className="text-rose-600 line-through text-[11px]">
                            {step.unoptimizedTime.toFixed(1)}ms
                          </span>
                          <div className="font-bold text-emerald-700">
                            {step.optimizedTime.toFixed(1)}ms
                          </div>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                          +{step.improvementPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Performance Delta View */
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Configuration vs Baseline Delta Report</span>
                </div>
                <p className="text-indigo-800 text-[11px]">
                  Comparing current active optimizations ({activeOptimizationsCount}/5 enabled) against the unoptimized legacy baseline run.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Execution Latency Delta
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-mono font-bold text-zinc-900">
                        {currentLatency.toFixed(1)}ms
                      </div>
                      <div className="text-[11px] text-zinc-500 line-through mt-0.5">
                        Baseline: {(totalUnoptimizedTime / 1000).toFixed(2)}s
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-emerald-100 text-emerald-800 font-bold font-mono px-2.5 py-1 rounded-lg text-sm">
                        +{latencyDeltaPercent}%
                      </span>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                        Latency Improvement
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Memory Consumption Delta
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-mono font-bold text-zinc-900">
                        {currentMemoryMb} MB
                      </div>
                      <div className="text-[11px] text-zinc-500 line-through mt-0.5">
                        Baseline: {baselineMemoryMb} MB
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-blue-100 text-blue-800 font-bold font-mono px-2.5 py-1 rounded-lg text-sm">
                        {memoryReductionPercent}%
                      </span>
                      <div className="text-[10px] text-blue-700 font-semibold mt-1">
                        RAM Reduction
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Active Flags Contributing to Delta
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-200">
                    <span>Batch Eager Loading</span>
                    <span className={currentFlags?.batchEagerLoading ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      {currentFlags?.batchEagerLoading ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-200">
                    <span>B-Tree Indexing</span>
                    <span className={currentFlags?.btreeIndexing ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      {currentFlags?.btreeIndexing ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-200">
                    <span>LRU Query Cache</span>
                    <span className={currentFlags?.queryCaching ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      {currentFlags?.queryCaching ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-200">
                    <span>DOM Virtualization</span>
                    <span className={currentFlags?.virtualizedDOM ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      {currentFlags?.virtualizedDOM ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <button
            type="button"
            onClick={runBenchmarkSuite}
            disabled={isRunning}
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? 'Running...' : 'Re-run Tests'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 px-3.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              id="btn-apply-benchmark-optimizations"
              type="button"
              onClick={() => {
                if (onApplyAllOptimizations) onApplyAllOptimizations();
                if (onApplyFlags) {
                  onApplyFlags({
                    batchEagerLoading: true,
                    btreeIndexing: true,
                    queryCaching: true,
                    virtualizedDOM: true,
                    deferredRendering: true
                  });
                }
                onClose();
              }}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              Apply All Optimizations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
