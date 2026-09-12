import React from 'react';
import { Database, Zap, AlertTriangle, CheckCircle2, Play, RefreshCw, TrendingDown, Table, UploadCloud } from 'lucide-react';
import { OptimizationFlags } from '../types';

interface HeaderProps {
  flags: OptimizationFlags;
  onToggleAll: (enable: boolean) => void;
  onRunBenchmark: () => void;
  isBenchmarking: boolean;
  hasErrors: boolean;
  activeErrorCount: number;
  activeView: 'grid' | 'trends';
  onSelectView: (view: 'grid' | 'trends') => void;
  trendCount: number;
  totalRecords?: number;
  isIndexSynchronized?: boolean;
  onOpenBulkImport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  flags,
  onToggleAll,
  onRunBenchmark,
  isBenchmarking,
  hasErrors,
  activeErrorCount,
  activeView,
  onSelectView,
  trendCount,
  totalRecords = 50000,
  isIndexSynchronized = true,
  onOpenBulkImport
}) => {
  const allOptimized = Object.values(flags).every(Boolean);

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-sm">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                Database Query &amp; UI Performance Studio
              </h1>
              {hasErrors ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {activeErrorCount} Query &amp; UI Issues Active
                </span>
              ) : allOptimized ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Optimizations Active • 60 FPS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Partially Optimized
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Simulating 50,000 transaction records with live B-Tree indexing, N+1 query elimination, and DOM virtualization
            </p>
          </div>
        </div>

        {/* Global Action & View Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary View Switcher */}
          <div className="inline-flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-medium">
            <button
              id="header-nav-grid"
              type="button"
              onClick={() => onSelectView('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeView === 'grid'
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-zinc-500" />
              <span>Table &amp; Plan</span>
            </button>
            <button
              id="header-nav-trends"
              type="button"
              onClick={() => onSelectView('trends')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeView === 'trends'
                  ? 'bg-white text-emerald-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Performance Trends</span>
              <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-1.5 py-0.2 rounded-full">
                D3
              </span>
            </button>
          </div>

          {onOpenBulkImport && (
            <button
              id="header-btn-bulk-import"
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 shadow-2xs transition-colors cursor-pointer"
              title="Open Bulk Data Ingestion Simulation Tool"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Bulk Ingest</span>
              <span className="font-mono text-[10px] bg-blue-200/80 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                {totalRecords > 50000 ? `${(totalRecords / 1000).toFixed(1)}k` : '50k'}
              </span>
            </button>
          )}

          <button
            id="btn-run-benchmark"
            type="button"
            onClick={onRunBenchmark}
            disabled={isBenchmarking}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isBenchmarking ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-500" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
            )}
            <span>{isBenchmarking ? 'Running...' : 'Benchmark'}</span>
          </button>

          {allOptimized ? (
            <button
              id="btn-toggle-unoptimized"
              type="button"
              onClick={() => onToggleAll(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
              <span>Simulate Bottlenecks</span>
            </button>
          ) : (
            <button
              id="btn-toggle-optimized"
              type="button"
              onClick={() => onToggleAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Fix &amp; Optimize</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
