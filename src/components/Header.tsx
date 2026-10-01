import React, { useState } from 'react';
import { Database, Zap, AlertTriangle, CheckCircle2, Play, RefreshCw, TrendingDown, Table, UploadCloud, Sliders, Sparkles, ArrowRight, Download, RotateCcw, X, CheckSquare, Square, Camera } from 'lucide-react';
import { OptimizationFlags, DataTapeEntry } from '../types';

interface HeaderProps {
  flags?: OptimizationFlags;
  onToggleAll?: (enable: boolean) => void;
  onRunBenchmark?: () => void;
  isBenchmarking?: boolean;
  hasErrors?: boolean;
  activeErrorCount?: number;
  activeView?: 'grid' | 'trends' | 'comparison' | 'schema';
  onSelectView?: (view: 'grid' | 'trends' | 'comparison' | 'schema') => void;
  trendCount?: number;
  totalRecords?: number;
  isIndexSynchronized?: boolean;
  onOpenBulkImport?: () => void;
  onOpenBenchmark?: () => void;
  onOpenTrends?: () => void;
  onOpenHistoryTape?: () => void;
  onExportCsv?: () => void;
  onOpenPdfPreview?: () => void;
  onOpenWizard?: () => void;
  dataTapeEntries?: DataTapeEntry[];
  onSelectTapeEntry?: (entry: DataTapeEntry) => void;
  onExportDiagnosticPackage?: () => void;
  onQuickSnapshot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  flags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  },
  onToggleAll,
  onRunBenchmark,
  isBenchmarking = false,
  hasErrors = false,
  activeErrorCount = 0,
  activeView = 'grid',
  onSelectView,
  trendCount = 0,
  totalRecords = 50000,
  isIndexSynchronized = true,
  onOpenBulkImport,
  onOpenBenchmark,
  onOpenTrends,
  onOpenHistoryTape,
  onExportCsv,
  onOpenPdfPreview,
  onOpenWizard,
  dataTapeEntries = [],
  onSelectTapeEntry,
  onExportDiagnosticPackage,
  onQuickSnapshot
}) => {
  const currentFlags = flags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  };
  const allOptimized = Object.values(currentFlags || {}).every(Boolean);

  const [showBulkRevertModal, setShowBulkRevertModal] = useState<boolean>(false);
  const [recentOperations, setRecentOperations] = useState<Array<{ id: string; name: string; type: string; timestamp: string; impact: string }>>([
    { id: 'op-1', name: 'Composite Index: idx_transactions_email_status', type: 'Index Creation', timestamp: '2 mins ago', impact: 'High Gain (240x)' },
    { id: 'op-2', name: 'Composite Index: idx_transactions_category_amount', type: 'Index Creation', timestamp: '5 mins ago', impact: 'High Gain (210x)' },
    { id: 'op-3', name: 'Optimization Flag: btreeIndexing (Enabled)', type: 'Flag Toggle', timestamp: '12 mins ago', impact: 'System Optimization' },
    { id: 'op-4', name: 'Composite Index: idx_line_items_tx_price', type: 'Index Creation', timestamp: '18 mins ago', impact: 'High Gain (253x)' },
    { id: 'op-5', name: 'Optimization Flag: batchEagerLoading (Enabled)', type: 'Flag Toggle', timestamp: '25 mins ago', impact: 'N+1 Elimination' }
  ]);
  const [selectedOperationIds, setSelectedOperationIds] = useState<string[]>(['op-1', 'op-2']);
  const [revertSuccessNotice, setRevertSuccessNotice] = useState<string | null>(null);

  const handleToggleSelectOperation = (id: string) => {
    setSelectedOperationIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllOperations = () => {
    setSelectedOperationIds(recentOperations.map((o) => o.id));
  };

  const handleDeselectAllOperations = () => {
    setSelectedOperationIds([]);
  };

  const handleExecuteBulkRevert = () => {
    if (selectedOperationIds.length === 0) return;
    setRecentOperations((prev) => prev.filter((o) => !selectedOperationIds.includes(o.id)));
    const count = selectedOperationIds.length;
    setSelectedOperationIds([]);
    setShowBulkRevertModal(false);
    setRevertSuccessNotice(`Successfully batch-reverted ${count} optimization operations.`);
    setTimeout(() => setRevertSuccessNotice(null), 4000);
  };

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      {revertSuccessNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 animate-fadeIn shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{revertSuccessNotice}</span>
        </div>
      )}

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
              onClick={() => onSelectView?.('grid')}
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
              onClick={() => onSelectView?.('trends')}
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
            <button
              id="header-nav-comparison"
              type="button"
              onClick={() => onSelectView?.('comparison')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeView === 'comparison'
                  ? 'bg-white text-blue-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Latency Comparison</span>
            </button>
            <button
              id="header-nav-schema"
              type="button"
              onClick={() => onSelectView?.('schema')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                activeView === 'schema'
                  ? 'bg-white text-indigo-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Schema Explorer</span>
            </button>
          </div>

          <button
            id="btn-header-bulk-revert"
            data-testid="btn-header-bulk-revert"
            type="button"
            onClick={() => setShowBulkRevertModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-xs transition-colors cursor-pointer"
            title="Open Bulk Revert operations list to batch-undo multiple recent schema changes in one click"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Bulk Revert</span>
            <span className="font-mono text-[10px] bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded font-bold">
              {recentOperations.length} Ops
            </span>
          </button>

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

          {onOpenWizard && (
            <button
              id="header-btn-optimization-wizard"
              type="button"
              onClick={onOpenWizard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
              title="Open interactive optimization wizard checklist"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Optimization Wizard</span>
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

          {onExportDiagnosticPackage && (
            <button
              id="btn-export-diagnostic-package"
              data-testid="btn-export-diagnostic-package"
              type="button"
              onClick={onExportDiagnosticPackage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-xs transition-colors cursor-pointer"
              title="Export snapshot of current system state (logs, performance trends, error counts) into a downloadable JSON package"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export Diagnostic Package</span>
            </button>
          )}

          {onQuickSnapshot && (
            <button
              id="btn-quick-snapshot"
              data-testid="btn-quick-snapshot"
              type="button"
              onClick={onQuickSnapshot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 shadow-xs transition-colors cursor-pointer"
              title="Quick Snapshot: Immediately persist current system configuration and performance metrics to a new Historical Data Tape entry"
            >
              <Camera className="w-3.5 h-3.5 text-purple-600" />
              <span>Quick Snapshot</span>
            </button>
          )}

          {allOptimized ? (
            <button
              id="btn-toggle-unoptimized"
              type="button"
              onClick={() => onToggleAll?.(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
              <span>Simulate Bottlenecks</span>
            </button>
          ) : (
            <button
              id="btn-toggle-optimized"
              type="button"
              onClick={() => onToggleAll?.(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Fix &amp; Optimize</span>
            </button>
          )}
        </div>
      </div>

      {/* Persistent Alert Ticker for Latency Threshold Violations & Tape Entries */}
      {dataTapeEntries && dataTapeEntries.length > 0 && (
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/80 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-300 flex items-center justify-between gap-3 overflow-x-auto shadow-inner">
          <div className="flex items-center gap-2 shrink-0 font-bold text-amber-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Alert Ticker ({dataTapeEntries.length} Slices):</span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-0.5">
            {dataTapeEntries.slice(0, 5).map((entry) => (
              <div
                key={entry.tapeId}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 hover:border-amber-500/50 transition-all shrink-0 group"
              >
                <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                  {entry.tapeId}
                </span>
                <span className="text-zinc-200 truncate max-w-[220px]" title={entry.triggerEvent}>
                  {entry.triggerEvent}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  ({entry.timeFormatted})
                </span>
                {onSelectTapeEntry && onOpenHistoryTape && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTapeEntry(entry);
                      onOpenHistoryTape();
                    }}
                    className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-xs"
                    title={`Jump to Historical Data Tape entry ${entry.tapeId}`}
                  >
                    <span>Jump</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {onOpenHistoryTape && (
              <button
                type="button"
                onClick={onOpenHistoryTape}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                View Full Tape ({dataTapeEntries.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Revert Modal */}
      {showBulkRevertModal && (
        <div
          id="modal-bulk-revert"
          data-testid="modal-bulk-revert"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBulkRevertModal(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-8 animate-scaleIn">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/30 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Bulk Revert — Recent Optimization Operations</h3>
                  <p className="text-xs text-amber-100">Select multiple recent schema changes or index creations to batch-undo in one click</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkRevertModal(false)}
                className="text-amber-200 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-zinc-700">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 text-xs">Recent Operations Log ({recentOperations.length}):</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllOperations}
                    className="text-indigo-600 hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllOperations}
                    className="text-zinc-500 hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {recentOperations.length === 0 ? (
                <div className="p-6 bg-zinc-50 rounded-xl border border-zinc-200 text-center text-zinc-500 font-medium">
                  ✨ No recent optimization operations available to revert. All operations are currently in baseline state.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recentOperations.map((op) => {
                    const isSelected = selectedOperationIds.includes(op.id);
                    return (
                      <div
                        key={op.id}
                        onClick={() => handleToggleSelectOperation(op.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOperation(op.id)}
                            className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                          />
                          <div>
                            <div className="font-mono font-bold text-xs">{op.name}</div>
                            <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                              <span>Type: {op.type}</span>
                              <span>•</span>
                              <span>{op.timestamp}</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                          {op.impact}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">
                Selected for Revert: {selectedOperationIds.length} operations
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkRevertModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-semibold cursor-pointer text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-execute-bulk-revert"
                  data-testid="btn-execute-bulk-revert"
                  onClick={handleExecuteBulkRevert}
                  disabled={selectedOperationIds.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batch Undo Selected ({selectedOperationIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
