import React, { useState, useEffect, useRef } from 'react';
import {
  BulkImportMode,
  BulkImportOptions,
  BulkImportProgress,
  BulkImportResult,
  DatabaseStats
} from '../types';
import {
  performBulkDataImport,
  rebuildDatabaseIndexes,
  resetDatabaseToBaseline,
  getDatabaseStats,
  getLastBulkImportResult
} from '../db/databaseEngine';
import {
  UploadCloud,
  Database,
  Zap,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Play,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Cpu,
  FileText,
  HelpCircle,
  FolderGit2
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: BulkImportResult) => void;
  onResetComplete: () => void;
  onViewInGrid?: () => void;
}

const BATCH_SIZES = [
  { value: 2500, label: '+2,500 rows', badge: 'Micro-Batch', description: 'Simulates an API event stream ingestion burst' },
  { value: 5000, label: '+5,000 rows', badge: 'Standard ETL', description: 'Typical periodic bulk insert or message queue flush' },
  { value: 15000, label: '+15,000 rows', badge: 'Heavy Surge', description: 'High-concurrency data warehouse append' },
  { value: 25000, label: '+25,000 rows', badge: 'Stress Test', description: 'Massive bulk ingestion expanding database heap by 50%' }
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  onResetComplete,
  onViewInGrid
}) => {
  const [selectedCount, setSelectedCount] = useState<number>(5000);
  const [selectedMode, setSelectedMode] = useState<BulkImportMode>('realtime_indexed');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<BulkImportProgress | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(() => getLastBulkImportResult());
  const [dbStats, setDbStats] = useState<DatabaseStats>(() => getDatabaseStats());
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ durationMs: number; indexedRecords: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDbStats(getDatabaseStats());
      setImportResult(getLastBulkImportResult());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartImport = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setProgress(null);
    setReindexResult(null);

    try {
      const options: BulkImportOptions = {
        recordCount: selectedCount,
        mode: selectedMode,
        chunkSize: selectedCount >= 15000 ? 1000 : 500
      };

      const res = await performBulkDataImport(options, (prog) => {
        setProgress(prog);
      });

      setImportResult(res);
      setDbStats(getDatabaseStats());
      onImportComplete(res);
    } catch (err) {
      console.error('Bulk import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReindex = async () => {
    if (isReindexing) return;
    setIsReindexing(true);
    try {
      const res = await rebuildDatabaseIndexes();
      setReindexResult(res);
      setDbStats(getDatabaseStats());
      // Refresh last import result view
      if (importResult) {
        setImportResult({
          ...importResult,
          indexesUpdated: ['idx_orders_status_category', 'idx_customer_id'],
          readQueryLatencyAfterMs: 1.85
        });
      }
    } finally {
      setIsReindexing(false);
    }
  };

  const handleResetBaseline = () => {
    resetDatabaseToBaseline();
    setDbStats(getDatabaseStats());
    setImportResult(null);
    setProgress(null);
    setReindexResult(null);
    onResetComplete();
  };

  const isExpanded = dbStats.totalRecords > 50000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div
        id="bulk-import-modal-card"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-zinc-200 bg-zinc-50/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                  Bulk Data Ingestion &amp; Index Maintenance Simulator
                </h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Real-time Database Engine
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Simulate large-scale data ingestion events to evaluate write amplification, B-Tree leaf page splits, and real-time query latency response.
              </p>
            </div>
          </div>

          <button
            id="btn-close-bulk-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Database State Bar */}
        <div className="bg-zinc-100/70 border-b border-zinc-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-zinc-600 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-zinc-500" />
              <span>Current Database Heap:</span>
              <strong className="text-zinc-900 font-mono font-bold text-xs">
                {dbStats.totalRecords.toLocaleString()} rows
              </strong>
              {isExpanded && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.2 rounded">
                  +{(dbStats.totalRecords - 50000).toLocaleString()} ingested
                </span>
              )}
            </span>

            <span className="text-zinc-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Secondary Indexes:</span>
              {dbStats.isIndexSynchronized ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Synchronized (2 B-Trees)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-100/80 px-1.5 py-0.2 rounded">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  OUT-OF-SYNC (Seq Scan active)
                </span>
              )}
            </span>
          </div>

          {isExpanded && (
            <button
              id="btn-reset-baseline-top"
              type="button"
              onClick={handleResetBaseline}
              disabled={isImporting || isReindexing}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-rose-700 hover:bg-white px-2 py-1 rounded border border-transparent hover:border-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
              title="Reset database back to the initial 50,000 records"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to 50k Baseline</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Ingestion Configuration Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider block mb-2">
                1. Select Ingestion Volume
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BATCH_SIZES.map((b) => {
                  const isSelected = selectedCount === b.value;
                  return (
                    <button
                      key={b.value}
                      id={`btn-select-batch-${b.value}`}
                      type="button"
                      disabled={isImporting}
                      onClick={() => setSelectedCount(b.value)}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-xs'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-zinc-900">{b.label}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {b.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">
                        {b.description}
                      </p>
                      <div className="text-[11px] text-zinc-700 font-mono mt-2 font-medium">
                        Heap target: {(dbStats.totalRecords + b.value).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider block mb-2">
                2. Ingestion Architecture &amp; Index Maintenance Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Mode 1: Real-time Indexed */}
                <button
                  id="btn-mode-realtime-indexed"
                  type="button"
                  disabled={isImporting}
                  onClick={() => setSelectedMode('realtime_indexed')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMode === 'realtime_indexed'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      Online B-Tree Maintenance
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Balanced
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mb-2">
                    Maintains secondary B-Trees synchronously on each inserted batch. Models leaf node insertions, page splits, and write amplification.
                  </p>
                  <div className="text-[11px] font-semibold text-emerald-800 bg-white/80 p-1.5 rounded border border-emerald-200/60">
                    Read Query Latency: <strong className="text-emerald-700">~1.8ms</strong> immediately
                  </div>
                </button>

                {/* Mode 2: Raw Bulk Unindexed */}
                <button
                  id="btn-mode-raw-unindexed"
                  type="button"
                  disabled={isImporting}
                  onClick={() => setSelectedMode('raw_bulk_unindexed')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMode === 'raw_bulk_unindexed'
                      ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-600" />
                      Raw Bulk Load (Deferred Rebuild)
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                      Ultra-Fast Write
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mb-2">
                    Appends directly to the database heap, bypassing index maintenance (e.g. <code className="text-[10px] bg-zinc-100 px-1">pg_bulkload</code> or COPY). Write speed is 4x faster.
                  </p>
                  <div className="text-[11px] font-semibold text-amber-800 bg-white/80 p-1.5 rounded border border-amber-200/60">
                    Tradeoff: Indexes out-of-sync; queries fallback to Seq Scan until <strong className="text-amber-900">REINDEX</strong>
                  </div>
                </button>

                {/* Mode 3: Single-Row Unbatched */}
                <button
                  id="btn-mode-single-unbatched"
                  type="button"
                  disabled={isImporting}
                  onClick={() => setSelectedMode('single_row_unbatched')}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMode === 'single_row_unbatched'
                      ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-600/20 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Single-Row Unbatched
                    </span>
                    <span className="text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                      Anti-Pattern
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mb-2">
                    Simulates individual autocommit transactions with connection pool roundtrips and write-lock overhead per row.
                  </p>
                  <div className="text-[11px] font-semibold text-rose-800 bg-white/80 p-1.5 rounded border border-rose-200/60">
                    Tradeoff: High connection latency and lock wait time
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Trigger Ingestion Action Banner */}
          {!isImporting && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
              <div>
                <div className="text-xs font-bold text-zinc-900">
                  Ready to Ingest {selectedCount.toLocaleString()} Records
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Target Heap: {dbStats.totalRecords.toLocaleString()} &rarr;{' '}
                  <strong className="text-zinc-800">{(dbStats.totalRecords + selectedCount).toLocaleString()} rows</strong>{' '}
                  • Mode: <span className="font-semibold text-zinc-800">{selectedMode.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <button
                id="btn-execute-bulk-import"
                type="button"
                onClick={handleStartImport}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Bulk Ingestion Event</span>
              </button>
            </div>
          )}

          {/* Live Progress Display */}
          {isImporting && progress && (
            <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/60 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-950 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Streaming Tuples to Database Engine...
                </span>
                <span className="font-mono font-bold text-blue-700 text-xs">
                  {progress.percent}% ({progress.currentCount.toLocaleString()} / {progress.totalTarget.toLocaleString()})
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-blue-200/70 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-75"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* Real-time Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 text-xs">
                  <div className="text-zinc-500 text-[10px] font-medium">Ingestion Rate</div>
                  <div className="text-sm font-bold font-mono text-zinc-900 mt-0.5">
                    {progress.currentThroughputRowsPerSec.toLocaleString()} <span className="text-[10px] text-zinc-400 font-sans">rows/s</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-blue-100 text-xs">
                  <div className="text-zinc-500 text-[10px] font-medium">Elapsed Time</div>
                  <div className="text-sm font-bold font-mono text-zinc-900 mt-0.5">
                    {progress.elapsedMs} <span className="text-[10px] text-zinc-400 font-sans">ms</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-blue-100 text-xs">
                  <div className="text-zinc-500 text-[10px] font-medium">B-Tree Page Splits</div>
                  <div className="text-sm font-bold font-mono text-zinc-900 mt-0.5">
                    {progress.pageSplitsCount} <span className="text-[10px] text-zinc-400 font-sans">splits</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-blue-100 text-xs">
                  <div className="text-zinc-500 text-[10px] font-medium">LRU Query Cache</div>
                  <div className="text-xs font-bold text-amber-700 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Invalidated
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import Results & Analysis */}
          {importResult && !isImporting && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Ingestion Event Telemetry &amp; Impact Analysis
                </h3>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {new Date(importResult.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Status Alert Banner */}
              {importResult.mode === 'raw_bulk_unindexed' ? (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">
                        Secondary B-Tree Indexes Are Out-of-Sync
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        +{importResult.recordsAdded.toLocaleString()} rows were appended directly to heap storage without index updates. Queries will fall back to full table scans until an offline or concurrent reindex is run.
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-trigger-reindex"
                    type="button"
                    onClick={handleReindex}
                    disabled={isReindexing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
                  >
                    {isReindexing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-white" />
                    )}
                    <span>{isReindexing ? 'Rebuilding...' : 'Rebuild B-Trees (REINDEX)'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold">
                      Indexes Fully Maintained During Ingestion
                    </div>
                    <div className="text-[11px] opacity-90 mt-0.5">
                      Both <code className="font-mono bg-emerald-100 text-emerald-900 px-1 rounded">idx_orders_status_category</code> and <code className="font-mono bg-emerald-100 text-emerald-900 px-1 rounded">idx_customer_id</code> were updated in real-time. Read query latency remains instant (~1.8ms) across the entire expanded dataset of {importResult.totalDatabaseRecords.toLocaleString()} rows.
                    </div>
                  </div>
                </div>
              )}

              {/* Reindex Confirmation Banner */}
              {reindexResult && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-950 flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>
                      <strong>REINDEX Complete:</strong> Successfully packed and balanced all {reindexResult.indexedRecords.toLocaleString()} tuples in {reindexResult.durationMs}ms.
                    </span>
                  </div>
                  <span className="text-blue-700 font-semibold text-[11px]">
                    Indexes Resynchronized
                  </span>
                </div>
              )}

              {/* Comparison Grid: Ingestion Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs">
                  <div className="text-zinc-500 text-[11px] font-medium">Throughput</div>
                  <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                    {importResult.rowsPerSecond.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">tuples / second</div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs">
                  <div className="text-zinc-500 text-[11px] font-medium">Total Write Duration</div>
                  <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                    {importResult.totalDurationMs} <span className="text-xs font-sans text-zinc-500">ms</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    for +{importResult.recordsAdded.toLocaleString()} rows
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs">
                  <div className="text-zinc-500 text-[11px] font-medium">B-Tree Page Splits</div>
                  <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                    {importResult.bTreePageSplits}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {importResult.mode === 'raw_bulk_unindexed' ? '0 (Indexes bypassed)' : 'Node splits & rebalances'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs">
                  <div className="text-zinc-500 text-[11px] font-medium">Write Amplification</div>
                  <div className="text-xl font-bold font-mono text-zinc-900 mt-1">
                    {importResult.mode === 'raw_bulk_unindexed'
                      ? '1.1x'
                      : importResult.mode === 'single_row_unbatched'
                      ? '3.4x'
                      : '2.8x'}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Heap vs Index writes</div>
                </div>
              </div>

              {/* Time Breakdown Bar */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800">Engine Time Allocation</span>
                  <span className="text-[11px] text-zinc-500">
                    Total: {importResult.totalDurationMs}ms
                  </span>
                </div>

                <div className="h-3 w-full bg-zinc-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full"
                    style={{
                      width: `${(importResult.heapWriteTimeMs / Math.max(0.1, importResult.totalDurationMs)) * 100}%`
                    }}
                    title={`Heap Write: ${importResult.heapWriteTimeMs}ms`}
                  />
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${(importResult.indexMaintenanceTimeMs / Math.max(0.1, importResult.totalDurationMs)) * 100}%`
                    }}
                    title={`Index Maintenance: ${importResult.indexMaintenanceTimeMs}ms`}
                  />
                  <div
                    className="bg-purple-500 h-full"
                    style={{
                      width: `${(importResult.walWriteTimeMs / Math.max(0.1, importResult.totalDurationMs)) * 100}%`
                    }}
                    title={`WAL Logging: ${importResult.walWriteTimeMs}ms`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    <span>Heap Storage Write: <strong>{importResult.heapWriteTimeMs}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>B-Tree Index Maintenance: <strong>{importResult.indexMaintenanceTimeMs}ms</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                    <span>WAL Disk Flush: <strong>{importResult.walWriteTimeMs}ms</strong></span>
                  </div>
                </div>
              </div>

              {/* Before vs After Query Latency Impact */}
              <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Read Query Latency Impact (Probe on 100-Row Paged Filter)
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    50,000 &rarr; {importResult.totalDatabaseRecords.toLocaleString()} rows
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-[11px] text-zinc-500">Baseline Read Latency (Before)</div>
                    <div className="text-lg font-bold font-mono text-zinc-900 mt-1">
                      {importResult.readQueryLatencyBeforeMs.toFixed(2)} ms
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">B-Tree Index Scan (50,000 rows)</div>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-[11px] text-zinc-500">Post-Ingestion Read Latency (After)</div>
                    <div
                      className={`text-lg font-bold font-mono mt-1 ${
                        importResult.mode === 'raw_bulk_unindexed' && !reindexResult
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {reindexResult ? '1.85 ms' : `${importResult.readQueryLatencyAfterMs.toFixed(2)} ms`}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {importResult.mode === 'raw_bulk_unindexed' && !reindexResult ? (
                        <span className="text-amber-700 font-semibold">
                          Degraded to Seq Scan across {importResult.totalDatabaseRecords.toLocaleString()} rows
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          Retains instant sub-2ms B-Tree seek across {importResult.totalDatabaseRecords.toLocaleString()} rows
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational Engineering Tradeoff Card */}
          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 text-xs text-zinc-700 space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Production Database Engineering Takeaways</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-600 leading-relaxed">
              <li>
                <strong>Write Amplification:</strong> In a production database, every active secondary index turns 1 heap write into <em>(1 + N)</em> writes, plus page split rebalancing.
              </li>
              <li>
                <strong>Online Maintenance vs. Offline Rebuild:</strong> For high-frequency OLTP workloads, keep indexes online. For massive ETL migrations (1M+ rows), dropping indexes before load and executing <code className="bg-zinc-200 text-zinc-800 px-1 rounded">CREATE INDEX CONCURRENTLY</code> afterwards can speed up ingestion by up to 5x.
              </li>
              <li>
                <strong>Cache Eviction:</strong> High-volume bulk writes automatically invalidate query caches and execution plans to guarantee data consistency.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isExpanded && (
              <button
                id="btn-reset-baseline-bottom"
                type="button"
                onClick={handleResetBaseline}
                disabled={isImporting || isReindexing}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to 50k Baseline</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {importResult && onViewInGrid && (
              <button
                id="btn-inspect-in-grid"
                type="button"
                onClick={() => {
                  onClose();
                  onViewInGrid();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
              >
                <span>Query Ingested Data in Table</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              id="btn-close-modal-done"
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
