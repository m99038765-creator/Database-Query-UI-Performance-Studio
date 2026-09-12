import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OptimizationFlags, OrderStatus, ProductCategory, LatencyTrendPoint, BulkImportResult } from './types';
import { executeQuery, initializeDatabase, getDatabaseStats } from './db/databaseEngine';
import { useFpsMonitor } from './utils/fpsTracker';
import { Header } from './components/Header';
import { OptimizationControls } from './components/OptimizationControls';
import { MetricsBar } from './components/MetricsBar';
import { VirtualizedTable } from './components/VirtualizedTable';
import { ExplainPlanViewer } from './components/ExplainPlanViewer';
import { BenchmarkModal } from './components/BenchmarkModal';
import { PerformanceTrendsView } from './components/PerformanceTrendsView';
import { BulkImportModal } from './components/BulkImportModal';
import { ExportLatencyCpuSparkline } from './components/ExportLatencyCpuSparkline';
import { CpuPerformanceGlowBadge } from './components/CpuPerformanceGlowBadge';
import { useSystemCpuMonitor, sampleCurrentCpuUsage } from './utils/systemCpuMonitor';
import {
  exportRecords,
  exportRecordsToCsv,
  exportRecordsToJson,
  triggerFileDownload,
  ExportFormat,
  ExportPerformanceResult,
  ExportHistoryPoint,
  generateInitialExportHistory
} from './utils/csvExporter';
import {
  DataTapeEntry,
  DatabaseUpdateEvent
} from './types';
import {
  subscribeDatabaseUpdate,
  executeBatchMutation
} from './db/databaseEngine';
import {
  createDataTapeEntry,
  getInitialDataTapeEntries
} from './utils/auditDataTape';
import { HistoricalDataTapeModal } from './components/HistoricalDataTapeModal';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Table,
  TrendingDown,
  Download,
  Clock,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileCode,
  Layers,
  Zap,
  ExternalLink,
  X
} from 'lucide-react';

export default function App() {
  // All optimizations enabled by default to resolve errors and rendering lag
  const [flags, setFlags] = useState<OptimizationFlags>({
    batchEagerLoading: true, // Fixed N+1 query cascade
    btreeIndexing: true,     // Fixed 50,000 row unindexed table scan
    queryCaching: true,      // Instant LRU cache hits
    virtualizedDOM: true,    // Fixed 5,000+ DOM element rendering lag (windowing)
    deferredRendering: true  // Fixed main thread synchronous keyboard stall
  });

  const [activeView, setActiveView] = useState<'grid' | 'trends'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [pageSize, setPageSize] = useState<number>(100);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isSimulatingSequence, setIsSimulatingSequence] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [totalDatabaseRecords, setTotalDatabaseRecords] = useState<number>(50000);
  const [isIndexSynchronized, setIsIndexSynchronized] = useState<boolean>(true);
  const [queryVersion, setQueryVersion] = useState<number>(0);

  // Data Serialization Efficiency state for Table & Explain Plan header export (CSV & JSON)
  const [headerExportStats, setHeaderExportStats] = useState<ExportPerformanceResult | null>(null);
  const [isHeaderExporting, setIsHeaderExporting] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('csv');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Export operations history (last 10) correlated with system CPU usage for the sparkline
  const [exportHistory, setExportHistory] = useState<ExportHistoryPoint[]>(() => generateInitialExportHistory());
  const systemCpu = useSystemCpuMonitor();

  // Queue Auto-Save & External Audit Data Tape State
  const [isQueueAutoSaveEnabled, setIsQueueAutoSaveEnabled] = useState<boolean>(false);
  const [dataTapeEntries, setDataTapeEntries] = useState<DataTapeEntry[]>(() => getInitialDataTapeEntries());
  const [isDataTapeModalOpen, setIsDataTapeModalOpen] = useState<boolean>(false);
  const [autoSaveToast, setAutoSaveToast] = useState<{
    tapeId: string;
    trigger: string;
    rows: number;
    checksum: string;
  } | null>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    if (isExportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExportDropdownOpen]);

  // Monitor real-time browser FPS
  const currentFps = useFpsMonitor();

  // Performance Trend History for D3 visualization
  const [trendHistory, setTrendHistory] = useState<LatencyTrendPoint[]>(() => {
    const now = Date.now();
    const formatTime = (msOffset: number) => {
      const d = new Date(now - msOffset);
      return d.toTimeString().split(' ')[0];
    };
    // Seed an illustrative starting baseline progression
    return [
      {
        id: 'seed-0',
        timestamp: now - 12000,
        timeFormatted: formatTime(12000),
        executionTimeMs: 472.5,
        rowsScanned: 50000,
        activeQueriesCount: 101,
        cacheHit: false,
        flags: {
          batchEagerLoading: false,
          btreeIndexing: false,
          queryCaching: false,
          virtualizedDOM: false,
          deferredRendering: false
        },
        triggerEvent: 'Baseline (All Flags OFF)',
        simulatedError: 'Database Connection Pool Timeout: max_connections (25) exceeded!'
      },
      {
        id: 'seed-1',
        timestamp: now - 8000,
        timeFormatted: formatTime(8000),
        executionTimeMs: 423.8,
        rowsScanned: 100,
        activeQueriesCount: 101,
        cacheHit: false,
        flags: {
          batchEagerLoading: false,
          btreeIndexing: true,
          queryCaching: false,
          virtualizedDOM: false,
          deferredRendering: false
        },
        triggerEvent: 'B-Tree Index ON',
        flagToggled: 'btreeIndexing',
        flagToggledState: true,
        deltaMs: -48.7,
        simulatedError: 'Database Connection Pool Timeout: max_connections (25) exceeded!'
      },
      {
        id: 'seed-2',
        timestamp: now - 6000,
        timeFormatted: formatTime(6000),
        executionTimeMs: 1.85,
        rowsScanned: 100,
        activeQueriesCount: 2,
        cacheHit: false,
        flags: {
          batchEagerLoading: true,
          btreeIndexing: true,
          queryCaching: false,
          virtualizedDOM: true,
          deferredRendering: true
        },
        triggerEvent: 'Batch Eager Join ON',
        flagToggled: 'batchEagerLoading',
        flagToggledState: true,
        deltaMs: -421.95,
        simulatedError: null
      },
      {
        id: 'seed-3',
        timestamp: now - 3000,
        timeFormatted: formatTime(3000),
        executionTimeMs: 92.4,
        rowsScanned: 65000,
        activeQueriesCount: 1,
        cacheHit: false,
        flags: {
          batchEagerLoading: true,
          btreeIndexing: false,
          queryCaching: false,
          virtualizedDOM: true,
          deferredRendering: true
        },
        triggerEvent: 'Bulk Ingest +15,000 (Unindexed Raw Bulk)',
        deltaMs: 90.55,
        simulatedError: null
      },
      {
        id: 'seed-4',
        timestamp: now,
        timeFormatted: formatTime(0),
        executionTimeMs: 0.15,
        rowsScanned: 0,
        activeQueriesCount: 1,
        cacheHit: true,
        flags: {
          batchEagerLoading: true,
          btreeIndexing: true,
          queryCaching: true,
          virtualizedDOM: true,
          deferredRendering: true
        },
        triggerEvent: 'All Optimizations Active (Cache Hit)',
        flagToggled: 'queryCaching',
        flagToggledState: true,
        deltaMs: -92.25,
        simulatedError: null
      }
    ];
  });

  // Pre-seed in-memory database on mount
  useEffect(() => {
    initializeDatabase();
    const stats = getDatabaseStats();
    setTotalDatabaseRecords(stats.totalRecords);
    setIsIndexSynchronized(stats.isIndexSynchronized);
  }, []);

  // Execute database query with current filters and flags
  const queryResult = useMemo(() => {
    return executeQuery(
      {
        searchTerm,
        status: statusFilter,
        category: categoryFilter,
        page: 1,
        pageSize
      },
      flags
    );
  }, [searchTerm, statusFilter, categoryFilter, pageSize, flags, queryVersion]);

  // Track changes to flags/query to record real-time points in trendHistory
  const prevFlagsRef = useRef<OptimizationFlags>(flags);
  const prevLatencyRef = useRef<number>(queryResult.executionTimeMs);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const prevFlags = prevFlagsRef.current;
    let changedFlag: keyof OptimizationFlags | undefined;
    for (const k of Object.keys(flags) as (keyof OptimizationFlags)[]) {
      if (flags[k] !== prevFlags[k]) {
        changedFlag = k;
        break;
      }
    }

    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    const deltaMs = queryResult.executionTimeMs - prevLatencyRef.current;

    let triggerEvent = 'Query Filter Changed';
    if (changedFlag) {
      const flagNames: Record<keyof OptimizationFlags, string> = {
        batchEagerLoading: 'Batch Eager Join',
        btreeIndexing: 'B-Tree Index',
        queryCaching: 'Query LRU Cache',
        virtualizedDOM: 'DOM Virtualization',
        deferredRendering: 'Deferred Rendering'
      };
      triggerEvent = `${flagNames[changedFlag]} ${flags[changedFlag] ? 'ON' : 'OFF'}`;
    } else if (Object.values(flags).every(Boolean) && !Object.values(prevFlags).every(Boolean)) {
      triggerEvent = 'All Optimizations Enabled';
    } else if (Object.values(flags).every((v) => !v) && !Object.values(prevFlags).every((v) => !v)) {
      triggerEvent = 'All Optimizations Disabled';
    }

    const newPoint: LatencyTrendPoint = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: queryResult.executionTimeMs,
      rowsScanned: queryResult.rowsScanned,
      activeQueriesCount: queryResult.activeQueriesCount,
      cacheHit: queryResult.cacheHit,
      flags: { ...flags },
      triggerEvent,
      flagToggled: changedFlag,
      flagToggledState: changedFlag ? flags[changedFlag] : undefined,
      deltaMs: Math.abs(deltaMs) > 0.05 ? deltaMs : undefined,
      simulatedError: queryResult.simulatedError
    };

    setTrendHistory((prev) => {
      // Keep up to 60 historical data points
      const updated = [...prev, newPoint];
      return updated.slice(-60);
    });

    prevFlagsRef.current = flags;
    prevLatencyRef.current = queryResult.executionTimeMs;
  }, [queryResult.executionTimeMs, flags]);

  // Derived DOM node count for telemetry metrics (avoids setState during child render)
  const domNodeCount = useMemo(() => {
    if (!flags.virtualizedDOM) {
      return queryResult.records.length * 6 + 10;
    }
    const visibleCount = Math.min(queryResult.records.length, 14);
    return visibleCount * 6 + 10;
  }, [flags.virtualizedDOM, queryResult.records.length]);

  const handleToggleFlag = (flag: keyof OptimizationFlags) => {
    setFlags((prev) => ({
      ...prev,
      [flag]: !prev[flag]
    }));
  };

  const handleToggleAll = (enable: boolean) => {
    setFlags({
      batchEagerLoading: enable,
      btreeIndexing: enable,
      queryCaching: enable,
      virtualizedDOM: enable,
      deferredRendering: enable
    });
  };

  const handleFixNPlusOne = () => {
    setFlags((prev) => ({ ...prev, batchEagerLoading: true }));
  };

  // Run a 5-step automated progression to demonstrate latency improvements on the D3 chart
  const handleRunOptimizationSequence = () => {
    if (isSimulatingSequence) return;
    setIsSimulatingSequence(true);

    // Step 0: Turn everything off to establish degraded baseline
    handleToggleAll(false);

    const steps = [
      () => setFlags((prev) => ({ ...prev, btreeIndexing: true })),
      () => setFlags((prev) => ({ ...prev, batchEagerLoading: true })),
      () => setFlags((prev) => ({ ...prev, queryCaching: true })),
      () =>
        setFlags((prev) => ({
          ...prev,
          virtualizedDOM: true,
          deferredRendering: true
        }))
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        steps[stepIdx]();
        stepIdx++;
      } else {
        clearInterval(interval);
        setIsSimulatingSequence(false);
      }
    }, 850);
  };

  const handleClearTrendHistory = () => {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    setTrendHistory([
      {
        id: `pt-${Date.now()}`,
        timestamp: Date.now(),
        timeFormatted,
        executionTimeMs: queryResult.executionTimeMs,
        rowsScanned: queryResult.rowsScanned,
        activeQueriesCount: queryResult.activeQueriesCount,
        cacheHit: queryResult.cacheHit,
        flags: { ...flags },
        triggerEvent: 'History Reset to Current State',
        simulatedError: queryResult.simulatedError
      }
    ]);
  };

  const handleBulkImportComplete = (result: BulkImportResult) => {
    setTotalDatabaseRecords(result.totalDatabaseRecords);
    setIsIndexSynchronized(result.indexesUpdated.length > 0);
    setQueryVersion((v) => v + 1);

    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    const modeLabel =
      result.mode === 'raw_bulk_unindexed'
        ? 'Unindexed Raw Bulk'
        : result.mode === 'single_row_unbatched'
        ? 'Single-Row Unbatched'
        : 'Online B-Tree Indexed';

    const newPoint: LatencyTrendPoint = {
      id: `pt-bulk-${Date.now()}`,
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: result.readQueryLatencyAfterMs,
      rowsScanned: result.indexesUpdated.length > 0 ? 2500 : result.totalDatabaseRecords,
      activeQueriesCount: 1,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: `Bulk Ingest +${result.recordsAdded.toLocaleString()} (${modeLabel})`,
      deltaMs: Number((result.readQueryLatencyAfterMs - result.readQueryLatencyBeforeMs).toFixed(2)),
      simulatedError: null
    };

    setTrendHistory((prev) => {
      const updated = [...prev, newPoint];
      return updated.slice(-60);
    });
  };

  const handleResetComplete = () => {
    setTotalDatabaseRecords(50000);
    setIsIndexSynchronized(true);
    setQueryVersion((v) => v + 1);

    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    const newPoint: LatencyTrendPoint = {
      id: `pt-reset-${Date.now()}`,
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: 1.82,
      rowsScanned: 2450,
      activeQueriesCount: 1,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: 'Database Reset to 50k Baseline',
      deltaMs: 0,
      simulatedError: null
    };

    setTrendHistory((prev) => {
      const updated = [...prev, newPoint];
      return updated.slice(-60);
    });
  };

  const handleAppendTrendPoint = (newPoint: LatencyTrendPoint) => {
    setTrendHistory((prev) => {
      const updated = [...prev, newPoint];
      return updated.slice(-60);
    });
  };

  const recordExportOperation = (
    stats: ExportPerformanceResult,
    format: ExportFormat,
    auditMeta?: { isAutoSave?: boolean; tapeId?: string; triggerEvent?: string }
  ) => {
    const cpuMetrics = sampleCurrentCpuUsage(stats.durationMs);
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];

    setExportHistory((prev) => {
      const lastIndex = prev.length > 0 ? prev[prev.length - 1].runIndex : 0;
      const newPoint: ExportHistoryPoint = {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        runIndex: lastIndex + 1,
        timestamp: Date.now(),
        timeFormatted,
        format,
        formatName: stats.formatName,
        recordCount: stats.recordCount,
        itemCount: stats.itemCount,
        durationMs: stats.durationMs,
        cpuUsagePercent: stats.cpuUsagePercent ?? cpuMetrics.cpuUsagePercent,
        fileSizeBytes: stats.fileSizeBytes,
        throughputRowsPerSec: stats.throughputRowsPerSec,
        compressionRatio: stats.compressionRatio,
        isAutoSave: auditMeta?.isAutoSave,
        tapeId: auditMeta?.tapeId,
        triggerEvent: auditMeta?.triggerEvent
      };
      return [...prev, newPoint].slice(-10); // keep the last 10 export operations
    });
  };

  // Synchronized refs to avoid stale closures in event subscriptions
  const isQueueAutoSaveEnabledRef = useRef(isQueueAutoSaveEnabled);
  useEffect(() => {
    isQueueAutoSaveEnabledRef.current = isQueueAutoSaveEnabled;
  }, [isQueueAutoSaveEnabled]);

  const queryResultRef = useRef(queryResult);
  useEffect(() => {
    queryResultRef.current = queryResult;
  }, [queryResult]);

  const selectedExportFormatRef = useRef(selectedExportFormat);
  useEffect(() => {
    selectedExportFormatRef.current = selectedExportFormat;
  }, [selectedExportFormat]);

  const dataTapeEntriesRef = useRef(dataTapeEntries);
  useEffect(() => {
    dataTapeEntriesRef.current = dataTapeEntries;
  }, [dataTapeEntries]);

  const filterParamsRef = useRef({ searchTerm, statusFilter, categoryFilter, pageSize });
  useEffect(() => {
    filterParamsRef.current = { searchTerm, statusFilter, categoryFilter, pageSize };
  }, [searchTerm, statusFilter, categoryFilter, pageSize]);

  // Subscribe to database mutation events for the Queue Auto-Save continuous audit tape
  useEffect(() => {
    const unsubscribe = subscribeDatabaseUpdate(async (event: DatabaseUpdateEvent) => {
      // Only proceed if Queue Auto-Save is active
      if (!isQueueAutoSaveEnabledRef.current) return;

      try {
        const recordsToExport = queryResultRef.current.records;
        const format = selectedExportFormatRef.current;
        const filters = filterParamsRef.current;
        const seq = dataTapeEntriesRef.current.length + 1;

        const newEntry = await createDataTapeEntry({
          records: recordsToExport,
          format,
          triggerEvent: event.description,
          databaseTotalRecords: event.totalRecords,
          filterSummary: {
            searchTerm: filters.searchTerm,
            status: filters.statusFilter,
            category: filters.categoryFilter,
            pageSize: filters.pageSize
          },
          sequenceNumber: seq
        });

        // Prepend new entry to the audit tape ledger
        setDataTapeEntries((prev) => [newEntry, ...prev]);

        // Construct performance stats for banner and history
        const stats: ExportPerformanceResult = {
          format,
          formatName: newEntry.formatName,
          recordCount: newEntry.recordCount,
          itemCount: newEntry.itemCount,
          fileSizeBytes: newEntry.fileSizeBytes,
          durationMs: newEntry.durationMs,
          cpuUsagePercent: newEntry.cpuUsagePercent,
          throughputRowsPerSec: newEntry.throughputRowsPerSec,
          compressionRatio: newEntry.recordCount > 0 ? Number(((newEntry.fileSizeBytes / (newEntry.recordCount * 180)) * 100).toFixed(1)) : 100,
          structureType: format === 'json' ? 'RFC 8259 JSON' : 'RFC 4180 CSV'
        };

        setHeaderExportStats(stats);
        recordExportOperation(stats, format, {
          isAutoSave: true,
          tapeId: newEntry.tapeId,
          triggerEvent: event.description
        });

        // Trigger toast notification
        setAutoSaveToast({
          tapeId: newEntry.tapeId,
          trigger: event.description,
          rows: newEntry.recordCount,
          checksum: newEntry.checksumSha256
        });

        // Auto dismiss toast after 5 seconds
        setTimeout(() => {
          setAutoSaveToast((curr) => (curr?.tapeId === newEntry.tapeId ? null : curr));
        }, 5000);
      } catch (err) {
        console.error('Error executing Queue Auto-Save incremental export:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleHeaderExport = (formatToExport?: ExportFormat) => {
    if (queryResult.records.length === 0 || isHeaderExporting) return;
    const format = formatToExport || selectedExportFormat;
    setSelectedExportFormat(format);
    setIsExportDropdownOpen(false);
    setIsHeaderExporting(true);
    setTimeout(() => {
      try {
        const { blob, filename, stats } = exportRecords(queryResult.records, format);
        triggerFileDownload(blob, filename);
        setHeaderExportStats(stats);
        recordExportOperation(stats, format);
      } catch (err) {
        console.error(`Failed to export ${format.toUpperCase()} from Table & Explain Plan header:`, err);
      } finally {
        setIsHeaderExporting(false);
      }
    }, 10);
  };

  // Trigger on-demand manual tape slice
  const handleTriggerManualTapeSlice = async () => {
    try {
      const format = selectedExportFormat;
      const seq = dataTapeEntries.length + 1;
      const newEntry = await createDataTapeEntry({
        records: queryResult.records,
        format,
        triggerEvent: 'Manual Audit Snapshot Cut',
        databaseTotalRecords: totalDatabaseRecords,
        filterSummary: {
          searchTerm,
          status: statusFilter,
          category: categoryFilter,
          pageSize
        },
        sequenceNumber: seq
      });

      setDataTapeEntries((prev) => [newEntry, ...prev]);

      const stats: ExportPerformanceResult = {
        format,
        formatName: newEntry.formatName,
        recordCount: newEntry.recordCount,
        itemCount: newEntry.itemCount,
        fileSizeBytes: newEntry.fileSizeBytes,
        durationMs: newEntry.durationMs,
        cpuUsagePercent: newEntry.cpuUsagePercent,
        throughputRowsPerSec: newEntry.throughputRowsPerSec,
        compressionRatio: newEntry.recordCount > 0 ? Number(((newEntry.fileSizeBytes / (newEntry.recordCount * 180)) * 100).toFixed(1)) : 100,
        structureType: format === 'json' ? 'RFC 8259 JSON' : 'RFC 4180 CSV'
      };

      setHeaderExportStats(stats);
      recordExportOperation(stats, format, {
        isAutoSave: true,
        tapeId: newEntry.tapeId,
        triggerEvent: 'Manual Audit Snapshot Cut'
      });

      setAutoSaveToast({
        tapeId: newEntry.tapeId,
        trigger: 'Manual Audit Snapshot Cut',
        rows: newEntry.recordCount,
        checksum: newEntry.checksumSha256
      });

      setTimeout(() => {
        setAutoSaveToast((curr) => (curr?.tapeId === newEntry.tapeId ? null : curr));
      }, 5000);
    } catch (err) {
      console.error('Failed to cut manual tape slice:', err);
    }
  };

  // Simulate database mutation (e.g. status transition, risk flag, live ingest)
  const handleMutateDatabase = (type: 'status_transition' | 'high_risk_flag' | 'insert_live') => {
    const result = executeBatchMutation(type, 50);
    setTotalDatabaseRecords(result.totalRecords);
    setQueryVersion((v) => v + 1);
  };

  const activeErrorsCount =
    (flags.batchEagerLoading ? 0 : 1) +
    (flags.btreeIndexing ? 0 : 1) +
    (flags.virtualizedDOM ? 0 : 1);

  const hasErrors = !flags.batchEagerLoading || !flags.btreeIndexing || !flags.virtualizedDOM;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation Header */}
      <Header
        flags={flags}
        onToggleAll={handleToggleAll}
        onRunBenchmark={() => setIsBenchmarkOpen(true)}
        isBenchmarking={isBenchmarkOpen}
        hasErrors={hasErrors}
        activeErrorCount={activeErrorsCount}
        activeView={activeView}
        onSelectView={setActiveView}
        trendCount={trendHistory.length}
        totalRecords={totalDatabaseRecords}
        isIndexSynchronized={isIndexSynchronized}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Status Callout Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            !hasErrors
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                !hasErrors ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {!hasErrors ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                {!hasErrors ? (
                  <>
                    <span>App Fully Optimized: Database Queries &amp; UI Lag Resolved</span>
                    <span className="text-[11px] font-semibold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                      Production Ready
                    </span>
                  </>
                ) : (
                  <>
                    <span>Performance Issues Active in Current Simulation</span>
                    <span className="text-[11px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                      Bottlenecks Detected
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs opacity-85 mt-0.5">
                {!hasErrors
                  ? `All ${totalDatabaseRecords.toLocaleString()} transaction records query in ~1.5ms using B-Tree indexing and batch eager joins. Virtual scrolling maintains a smooth 60 FPS.`
                  : 'Unbatched N+1 queries, unindexed table scans, and unwindowed DOM nodes are degrading database latency and frame rate.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hasErrors ? (
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 transition-colors cursor-pointer"
              >
                Inspect Unoptimized State
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                Apply All Optimizations
              </button>
            )}
          </div>
        </div>

        {/* 1. Live Telemetry Metrics */}
        <MetricsBar
          queryResult={queryResult}
          flags={flags}
          currentFps={currentFps}
          renderedDomCount={domNodeCount}
          totalDatabaseRecords={totalDatabaseRecords}
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
        />

        {/* View Mode Tabs Navigation & View Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-1.5 bg-zinc-200/70 p-1 rounded-xl">
            <button
              id="main-tab-grid"
              type="button"
              onClick={() => setActiveView('grid')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'grid'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Table className="w-4 h-4 text-zinc-600" />
              <span>Table &amp; Explain Plan</span>
            </button>
            <button
              id="main-tab-trends"
              type="button"
              onClick={() => setActiveView('trends')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'trends'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <span>Performance Trends</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold">
                D3
              </span>
            </button>
          </div>

          {/* Secondary Header Actions */}
          <div className="flex items-center gap-2.5">
            {activeView === 'grid' ? (
              <>
                <span className="text-xs text-zinc-500 hidden md:inline-block">
                  Virtual grid with RFC 4180 CSV / JSON export and query execution tree
                </span>

                {/* Historical Data Tape Auditor Access Button */}
                <button
                  id="btn-open-historical-data-tape"
                  type="button"
                  onClick={() => setIsDataTapeModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                    isQueueAutoSaveEnabled
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                  title="Inspect Historical Data Tape ledger for external compliance & auditing"
                >
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${isQueueAutoSaveEnabled ? 'text-emerald-600' : 'text-zinc-500'}`}
                  />
                  <span className="hidden sm:inline">Data Tape:</span>
                  <span className="font-mono text-[10px] font-bold">
                    {dataTapeEntries.length} {dataTapeEntries.length === 1 ? 'slice' : 'slices'}
                  </span>
                  {isQueueAutoSaveEnabled && (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                      title="Queue Auto-Save is actively recording"
                    />
                  )}
                </button>

                {/* Export Dropdown Split Button */}
                <div ref={exportDropdownRef} className="relative inline-flex ml-auto sm:ml-0 shadow-xs rounded-lg">
                  {/* Primary Export Action Button */}
                  <button
                    id="btn-header-export-csv"
                    type="button"
                    onClick={() => handleHeaderExport(selectedExportFormat)}
                    disabled={isHeaderExporting || queryResult.records.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-r-0 border-zinc-300 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Export query results as ${selectedExportFormat === 'json' ? 'JSON' : 'CSV'} to evaluate data serialization efficiency`}
                  >
                    {isHeaderExporting ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                        <span>Serializing...</span>
                      </>
                    ) : (
                      <>
                        {selectedExportFormat === 'json' ? (
                          <FileCode className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{selectedExportFormat === 'json' ? 'Export JSON' : 'Export CSV'}</span>
                        <span className="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.2 rounded font-bold border border-zinc-200">
                          {queryResult.records.length}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Dropdown Menu Trigger Toggle */}
                  <button
                    id="btn-header-export-dropdown-toggle"
                    type="button"
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    disabled={isHeaderExporting || queryResult.records.length === 0}
                    className="inline-flex items-center justify-center px-2 py-1.5 rounded-r-lg border border-zinc-300 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-700 text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed relative"
                    title="Select export format (Standard CSV or Structured JSON)"
                    aria-label="Select export format"
                    aria-expanded={isExportDropdownOpen}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-150 ${
                        isExportDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                    {isQueueAutoSaveEnabled && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isExportDropdownOpen && (
                    <div
                      id="export-format-dropdown-menu"
                      className="absolute right-0 top-full mt-1 w-80 bg-white border border-zinc-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-fade-in divide-y divide-zinc-100"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/70">
                        Choose Serialization Format
                      </div>

                      <div className="p-1 space-y-0.5">
                        {/* Option: Standard CSV */}
                        <button
                          id="btn-export-option-csv"
                          type="button"
                          onClick={() => handleHeaderExport('csv')}
                          className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            selectedExportFormat === 'csv'
                              ? 'bg-emerald-50 text-emerald-950 font-medium'
                              : 'hover:bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          <div
                            className={`mt-0.5 p-1 rounded shrink-0 ${
                              selectedExportFormat === 'csv'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900">Standard CSV</span>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                RFC 4180
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                              Flat tabular with UTF-8 BOM. High data density &amp; ~50% smaller than JSON.
                            </p>
                          </div>
                          {selectedExportFormat === 'csv' && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-1" />
                          )}
                        </button>

                        {/* Option: Structured JSON */}
                        <button
                          id="btn-export-option-json"
                          type="button"
                          onClick={() => handleHeaderExport('json')}
                          className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            selectedExportFormat === 'json'
                              ? 'bg-amber-50 text-amber-950 font-medium'
                              : 'hover:bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          <div
                            className={`mt-0.5 p-1 rounded shrink-0 ${
                              selectedExportFormat === 'json'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            <FileCode className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900">Structured JSON</span>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                RFC 8259
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                              Full object graph with nested line items &amp; native type fidelity.
                            </p>
                          </div>
                          {selectedExportFormat === 'json' && (
                            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-1" />
                          )}
                        </button>
                      </div>

                      {/* Section: Queue Auto-Save Continuous Audit Tape */}
                      <div className="bg-zinc-50/80 p-2.5 space-y-2 border-t border-zinc-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                              Continuous Audit Tape
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              isQueueAutoSaveEnabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-200 text-zinc-600'
                            }`}
                          >
                            {isQueueAutoSaveEnabled ? 'RECORDING' : 'IDLE'}
                          </span>
                        </div>

                        {/* The 'Queue Auto-Save' Toggle Switch Control */}
                        <div
                          id="queue-auto-save-control-container"
                          className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white border border-zinc-200 shadow-2xs"
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-zinc-900">
                                Queue Auto-Save
                              </span>
                              <span className="text-[9px] font-medium px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Tape
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                              Automatically triggers incremental export of current filtered results whenever significant database updates occur.
                            </p>
                          </div>

                          <button
                            id="toggle-queue-auto-save"
                            type="button"
                            role="switch"
                            aria-checked={isQueueAutoSaveEnabled}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsQueueAutoSaveEnabled(!isQueueAutoSaveEnabled);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 mt-0.5 ${
                              isQueueAutoSaveEnabled ? 'bg-emerald-600' : 'bg-zinc-300'
                            }`}
                            title={isQueueAutoSaveEnabled ? 'Disable Queue Auto-Save' : 'Enable Queue Auto-Save'}
                          >
                            <span className="sr-only">Toggle Queue Auto-Save</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isQueueAutoSaveEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Audit Tape Inspector Quick Link & Slice Counter */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 text-[10px]">
                          <span className="text-zinc-500 flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isQueueAutoSaveEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                              }`}
                            />
                            Tape: <strong>{dataTapeEntries.length} slices</strong>
                          </span>
                          <button
                            id="btn-inspect-audit-tape-from-dropdown"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsExportDropdownOpen(false);
                              setIsDataTapeModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                          >
                            <span>Inspect Tape Ledger</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      <div className="px-3 py-1.5 bg-zinc-50 text-[10px] text-zinc-500">
                        ⚡ Serialization latency &amp; compression ratios will display in the banner below
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs text-zinc-500 hidden sm:inline-block">
                Real-time D3 visualization of query latency across flag permutations
              </span>
            )}
          </div>
        </div>

        {/* Header Serialization Efficiency Telemetry Banner */}
        {headerExportStats && activeView === 'grid' && (
          <div
            id="header-csv-serialization-stats"
            className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-2.5 text-xs text-emerald-950 animate-fade-in shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-emerald-950 text-sm">
                    {headerExportStats.format === 'json' ? 'JSON' : 'CSV'} Data Serialization Efficiency
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {headerExportStats.formatName}
                  </span>
                  <span className="text-emerald-800 text-xs">
                    Serialized <strong>{headerExportStats.recordCount.toLocaleString()}</strong> rows (
                    {headerExportStats.itemCount.toLocaleString()} nested item entities) into{' '}
                    <strong>{(headerExportStats.fileSizeBytes / 1024).toFixed(1)} KB</strong>{' '}
                    <span className="font-mono text-[11px] text-emerald-700">
                      ({headerExportStats.bytesPerRow} B/row)
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {/* Dynamic Color-Coded Performance Indicator with Green-to-Red Glow */}
                <CpuPerformanceGlowBadge cpuPercent={headerExportStats.cpuUsagePercent} />

                <span className="font-mono text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded border border-emerald-200 hidden md:inline-block">
                  {headerExportStats.structureType}
                </span>
                <button
                  id="btn-dismiss-header-export-stats"
                  type="button"
                  onClick={() => setHeaderExportStats(null)}
                  className="text-emerald-700 hover:text-emerald-950 underline text-xs cursor-pointer ml-1"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Format-Specific Metadata & Compression Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {/* Metric 1: Compression Ratio vs Counterpart Format */}
              <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  {headerExportStats.format === 'csv' ? 'Compression vs JSON' : 'Schema Key Overhead'}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-base font-bold text-emerald-950">
                    {headerExportStats.compressionRatio}x
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700">
                    {headerExportStats.format === 'csv'
                      ? `(${headerExportStats.spaceSavingsPercent}% savings)`
                      : `(+${Math.abs(headerExportStats.spaceSavingsPercent)}% vs CSV)`}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700/90 mt-1 leading-tight">
                  {headerExportStats.format === 'csv'
                    ? `Eliminates repeated keys; JSON equivalent is ${(headerExportStats.comparisonPayloadSizeBytes / 1024).toFixed(1)} KB`
                    : `Repeated field keys per row; Tabular CSV equivalent is ${(headerExportStats.comparisonPayloadSizeBytes / 1024).toFixed(1)} KB`}
                </p>
              </div>

              {/* Metric 2: Estimated Wire Transfer GZIP Ratio */}
              <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Est. GZIP Wire Size
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-base font-bold text-emerald-950">
                    ~{(headerExportStats.estimatedGzipSizeBytes / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-emerald-700">
                    ({headerExportStats.estimatedGzipRatio}x reduction)
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700/90 mt-1 leading-tight">
                  {headerExportStats.format === 'csv'
                    ? 'GZIP compresses recurring category strings and tabular delimiters'
                    : 'Deflate algorithms collapse repeated JSON object keys effectively'}
                </p>
              </div>

              {/* Metric 3: Serialization Speed & Latency with Color-Coded CPU Indicator */}
              <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Serialization Latency
                  </span>
                  <CpuPerformanceGlowBadge cpuPercent={headerExportStats.cpuUsagePercent} variant="inline" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-base font-bold text-emerald-950">
                    {headerExportStats.durationMs}
                  </span>
                  <span className="text-xs font-normal text-emerald-700">ms CPU time</span>
                </div>
                <p className="text-[10px] text-emerald-700/90 mt-1 leading-tight">
                  Zero-allocation buffer generation before Blob dispatch
                </p>
              </div>

              {/* Metric 4: Throughput */}
              <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Throughput Rate
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-base font-bold text-emerald-950">
                    {headerExportStats.throughputRowsPerSec.toLocaleString()}
                  </span>
                  <span className="text-xs font-normal text-emerald-700">rows/sec</span>
                </div>
                <p className="text-[10px] text-emerald-700/90 mt-1 leading-tight">
                  {headerExportStats.encodingStandard} compliant
                </p>
              </div>
            </div>

            {/* Mini Sparkline Graph: Latency Trend of Last 10 Operations Correlated with Global CPU Load */}
            <ExportLatencyCpuSparkline
              history={exportHistory}
              currentCpuPercent={systemCpu.cpuUsagePercent}
              activeFormat={headerExportStats.format}
            />
          </div>
        )}

        {/* View Content Branch */}
        {activeView === 'trends' ? (
          /* D3 Performance Trends View */
          <PerformanceTrendsView
            trendHistory={trendHistory}
            currentFlags={flags}
            onToggleFlag={handleToggleFlag}
            onToggleAll={handleToggleAll}
            onClearHistory={handleClearTrendHistory}
            onRunOptimizationSequence={handleRunOptimizationSequence}
            isSimulatingSequence={isSimulatingSequence}
            onAppendTrendPoint={handleAppendTrendPoint}
          />
        ) : (
          /* Main Data Grid & Diagnostics View */
          <>
            {/* Interactive Architectural Controls */}
            <OptimizationControls flags={flags} onToggleFlag={handleToggleFlag} />

            {/* Transaction Explorer & Virtualized Data Grid */}
            <VirtualizedTable
              records={queryResult.records}
              totalCount={queryResult.totalCount}
              flags={flags}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onFixNPlusOne={handleFixNPlusOne}
              simulatedError={queryResult.simulatedError}
              warningNotice={queryResult.warningNotice}
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
              onExportComplete={(stats) => {
                setHeaderExportStats(stats);
                recordExportOperation(stats, 'csv');
              }}
            />

            {/* Query Diagnostics & Execution Plan Viewer */}
            <ExplainPlanViewer
              result={queryResult}
              flags={flags}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              searchTerm={searchTerm}
            />
          </>
        )}
      </main>

      {/* Benchmark Suite Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        onApplyAllOptimizations={() => handleToggleAll(true)}
      />

      {/* Bulk Data Ingestion Simulation Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={handleBulkImportComplete}
        onResetComplete={handleResetComplete}
        onViewInGrid={() => setActiveView('grid')}
      />

      {/* Historical Data Tape Auditor Modal */}
      <HistoricalDataTapeModal
        isOpen={isDataTapeModalOpen}
        onClose={() => setIsDataTapeModalOpen(false)}
        entries={dataTapeEntries}
        isQueueAutoSaveEnabled={isQueueAutoSaveEnabled}
        onToggleQueueAutoSave={(val) => setIsQueueAutoSaveEnabled(val)}
        onTriggerManualSlice={handleTriggerManualTapeSlice}
        onSimulateDatabaseMutation={handleMutateDatabase}
        onClearLedger={() => setDataTapeEntries([])}
        currentFilteredCount={queryResult.records.length}
      />

      {/* Floating Auto-Save Notification Toast */}
      {autoSaveToast && (
        <div
          id="queue-auto-save-toast"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-zinc-900 border border-emerald-500/50 text-white rounded-xl p-3.5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">
                  Queue Auto-Save Snapshot
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {autoSaveToast.tapeId}
                </span>
              </div>
              <p className="text-xs text-zinc-200 font-medium mt-0.5 truncate">
                {autoSaveToast.trigger}
              </p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-mono">
                  {autoSaveToast.rows} rows
                </span>
                <span className="truncate font-mono text-[9px] text-zinc-500" title={autoSaveToast.checksum}>
                  SHA: {autoSaveToast.checksum.slice(0, 10)}…
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoSaveToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Logged to external audit tape</span>
            <button
              type="button"
              onClick={() => {
                setAutoSaveToast(null);
                setIsDataTapeModalOpen(true);
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-2"
            >
              View Tape Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
