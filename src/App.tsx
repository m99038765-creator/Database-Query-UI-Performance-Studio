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
import { DiagnosticPdfPreviewModal } from './components/DiagnosticPdfPreviewModal';
import { ExportLatencyCpuSparkline } from './components/ExportLatencyCpuSparkline';
import { CpuPerformanceGlowBadge } from './components/CpuPerformanceGlowBadge';
import { useSystemCpuMonitor, sampleCurrentCpuUsage } from './utils/systemCpuMonitor';
import {
  exportRecords,
  exportRecordsToCsv,
  exportRecordsToJson,
  buildCsvString,
  triggerFileDownload,
  ExportFormat,
  ExportPerformanceResult,
  ExportHistoryPoint,
  generateInitialExportHistory
} from './utils/csvExporter';
import { exportDiagnosticCorrelationReportJson } from './utils/diagnosticCorrelationReportGenerator';
import { exportDiagnosticCorrelationPdf } from './utils/diagnosticCorrelationPdfGenerator';
import {
  DataTapeEntry,
  DatabaseUpdateEvent,
  SerializationLogEntry
} from './types';
import {
  subscribeDatabaseUpdate,
  subscribeCacheInvalidation,
  getLastCacheRefreshTimestamp,
  executeBatchMutation,
  deleteRecordsByIds,
  isDatabaseMutating,
  getActiveInFlightMutation,
  getActivePendingMutationsCount,
  getAllActiveInFlightMutations,
  subscribeMutationState,
  beginDatabaseMutation,
  InFlightMutationState,
  getDatabaseMutationHistory
} from './db/databaseEngine';
import {
  createDataTapeEntry,
  getInitialDataTapeEntries
} from './utils/auditDataTape';
import { HistoricalDataTapeModal } from './components/HistoricalDataTapeModal';
import { ExportSavingsSummaryChart } from './components/ExportSavingsSummaryChart';
import { SerializationErrorLogPanel } from './components/SerializationErrorLogPanel';
import {
  detectSerializationAnomaly,
  createSimulatedLog,
  getInitialSerializationLogs
} from './utils/serializationLogger';
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
  X,
  Keyboard,
  RefreshCw,
  Pause,
  Lock,
  Copy,
  ClipboardCheck,
  Activity,
  Bell,
  AlertCircle,
  Trash2,
  FileText,
  SlidersHorizontal,
  Eye,
  Bookmark,
  Save,
  FolderOpen,
  Users
} from 'lucide-react';
import {
  PREDEFINED_PDF_TEMPLATES,
  PdfReportTemplate,
  getSavedCustomTemplate,
  saveCustomTemplate,
  matchTemplateId
} from './utils/pdfReportTemplates';

interface InvalidationTriggerEntry {
  id: string;
  reason: string;
  label: string;
  timestamp: number;
  isBulk: boolean;
  details?: string;
}

function formatTriggerLabel(reason?: string): string {
  if (!reason) return 'General Database Mutation';
  switch (reason) {
    case 'bulk_ingestion':
      return 'Bulk Ingestion (Sync)';
    case 'status_transition':
      return 'Batch Status Transition';
    case 'high_risk_flag':
      return 'Batch Risk Flag Update';
    case 'live_ingest_mutation':
      return 'Live Ingest Append';
    case 'bulk_add_transactions':
      return 'Bulk Add Ingestion';
    case 'delete_records':
      return 'Batch Delete Purge';
    case 'batch_mutation':
      return 'Concurrent Batch Mutation';
    case 'record_added':
      return 'Single Record Insert';
    case 'record_updated':
      return 'Single Record Update';
    default:
      return reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function isBulkTrigger(reason?: string): boolean {
  if (!reason) return true;
  return (
    reason.includes('bulk') ||
    reason.includes('batch') ||
    reason.includes('ingest') ||
    reason.includes('delete') ||
    reason === 'database_mutation'
  );
}

function getTriggerDetails(reason?: string): string {
  if (!reason) return 'Query cache evicted for data consistency';
  switch (reason) {
    case 'bulk_ingestion':
      return '5,000+ records written with page splits';
    case 'status_transition':
      return '50 orders transitioned in bulk';
    case 'high_risk_flag':
      return 'Batch security risk recomputation';
    case 'live_ingest_mutation':
      return '50 real-time telemetry records appended';
    case 'bulk_add_transactions':
      return 'Multi-row transaction batch ingestion';
    case 'delete_records':
      return 'Purged from storage & B-Tree indexes';
    default:
      return 'All query cache entries invalidated';
  }
}

function formatTriggerTimeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

interface BTreeResourceImpact {
  level: 'minor' | 'moderate' | 'bulk';
  label: string;
  badgeLabel: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  tooltipText: string;
  estimatedPageSplits: string;
}

function getBTreeResourceImpact(mutation: InFlightMutationState): BTreeResourceImpact {
  const rows = mutation.targetRows ?? (mutation.type === 'bulk_ingestion' ? 5000 : 1);
  const typeLower = (mutation.type || '').toLowerCase();
  const descLower = (mutation.description || '').toLowerCase();

  const isBulk =
    typeLower.includes('bulk') ||
    descLower.includes('bulk') ||
    descLower.includes('5,000') ||
    rows >= 100;

  if (isBulk) {
    const splits = Math.max(8, Math.floor(rows / 128));
    return {
      level: 'bulk',
      label: 'Bulk B-Tree Impact',
      badgeLabel: 'Bulk Impact',
      iconColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-500/40',
      tooltipText: `Bulk Impact (Red): Heavy B-Tree page splits (~${splits} splits), tree rebalancing & WAL flush`,
      estimatedPageSplits: `~${splits} splits`
    };
  }

  const isModerate =
    rows >= 15 ||
    typeLower.includes('batch') ||
    descLower.includes('batch') ||
    descLower.includes('status');

  if (isModerate) {
    return {
      level: 'moderate',
      label: 'Moderate B-Tree Impact',
      badgeLabel: 'Mod Impact',
      iconColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/40',
      tooltipText: 'Moderate Impact (Amber): Localized leaf-node splits & key re-indexing (~1-3 page splits)',
      estimatedPageSplits: '~2 splits'
    };
  }

  return {
    level: 'minor',
    label: 'Minor B-Tree Impact',
    badgeLabel: 'Minor Impact',
    iconColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
    tooltipText: 'Minor Impact (Green): In-place leaf pointer update, 0 page splits',
    estimatedPageSplits: '0 splits'
  };
}

function formatInvalidationLogsForClipboard(
  triggers: InvalidationTriggerEntry[],
  isMutating: boolean,
  pendingCount: number,
  recurrentBulk: number
): string {
  const now = new Date();
  const divider = '='.repeat(64);
  const subDivider = '-'.repeat(64);

  const lines: string[] = [
    divider,
    'CACHE INVALIDATION & CHURN AUDIT LOGS',
    `Timestamp: ${now.toISOString()} (${now.toLocaleTimeString()})`,
    `Database State: ${
      isMutating
        ? `PAUSED (${pendingCount} active pending mutation${pendingCount === 1 ? '' : 's'})`
        : 'READY (Cache Invalidated / Fresh Read)'
    }`,
    `Bulk Operations Churn: ${recurrentBulk}/3 triggers in recent inspection window`,
    divider,
    '',
    'LAST 3 INVALIDATION TRIGGERS:',
    subDivider
  ];

  if (triggers.length === 0) {
    lines.push('No recent invalidation triggers recorded.');
  } else {
    triggers.forEach((trigger, idx) => {
      const timeStr = new Date(trigger.timestamp).toISOString();
      const timeAgo = formatTriggerTimeAgo(trigger.timestamp);
      lines.push(`[#${idx + 1}] ${trigger.label}`);
      lines.push(`  Time    : ${timeStr} (${timeAgo})`);
      lines.push(`  Reason  : ${trigger.reason}`);
      lines.push(`  Bulk Op : ${trigger.isBulk ? 'YES' : 'NO'}`);
      if (trigger.details) {
        lines.push(`  Details : ${trigger.details}`);
      }
      if (idx < triggers.length - 1) {
        lines.push('');
      }
    });
  }

  lines.push(subDivider);
  if (recurrentBulk >= 2) {
    lines.push('DIAGNOSTIC NOTE: High cache churn detected. Consecutive bulk writes invalidate cached export snapshots.');
  }
  if (isMutating) {
    lines.push(`CONSISTENCY NOTE: ${pendingCount} active in-flight mutation(s) held consistency lock; serialization deferred.`);
  }
  lines.push(divider);

  return lines.join('\n');
}

const INITIAL_INVALIDATION_TRIGGERS: InvalidationTriggerEntry[] = [
  {
    id: 'inv-init-1',
    reason: 'bulk_ingestion',
    label: 'Bulk Ingestion (Sync)',
    timestamp: Date.now() - 38000,
    isBulk: true,
    details: '5,000+ records written with page splits'
  },
  {
    id: 'inv-init-2',
    reason: 'status_transition',
    label: 'Batch Status Transition',
    timestamp: Date.now() - 110000,
    isBulk: true,
    details: '50 orders transitioned in bulk'
  },
  {
    id: 'inv-init-3',
    reason: 'live_ingest_mutation',
    label: 'Live Ingest Append',
    timestamp: Date.now() - 215000,
    isBulk: true,
    details: '50 real-time telemetry records appended'
  }
];

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

  // CSV Column Headers Inclusion / Exclusion state (dynamically updates serialization logic)
  const [includeCsvHeaders, setIncludeCsvHeaders] = useState<boolean>(true);
  const includeCsvHeadersRef = useRef(includeCsvHeaders);
  useEffect(() => {
    includeCsvHeadersRef.current = includeCsvHeaders;
  }, [includeCsvHeaders]);

  // Export operations history (last 10) correlated with system CPU usage for the sparkline
  const [exportHistory, setExportHistory] = useState<ExportHistoryPoint[]>(() => generateInitialExportHistory());
  const systemCpu = useSystemCpuMonitor();

  // Power-user keyboard shortcut state & OS detection
  const [isShortcutFlashing, setIsShortcutFlashing] = useState<boolean>(false);
  const [shortcutToast, setShortcutToast] = useState<{
    key: string;
    format: ExportFormat;
    rows: number;
    isEmpty?: boolean;
  } | null>(null);

  const isMac = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Mac|iPod|iPhone|iPad/.test(window.navigator?.platform || window.navigator?.userAgent || '');
  }, []);
  const shortcutKeyLabel = isMac ? '⌘E' : 'Ctrl+E';
  const altShortcutKeyLabel = isMac ? '⇧⌘E' : 'Ctrl+Shift+E';

  // Visual feedback pulse effect on #btn-header-export-csv when LRU cache is invalidated by a database mutation
  const [isCacheInvalidatedPulsing, setIsCacheInvalidatedPulsing] = useState<boolean>(false);
  const [cacheInvalidationReason, setCacheInvalidationReason] = useState<string>('database mutation');
  const [lastCacheRefreshedAt, setLastCacheRefreshedAt] = useState<number>(() => getLastCacheRefreshTimestamp());
  const [isExportHovered, setIsExportHovered] = useState<boolean>(false);
  const [invalidationHistory, setInvalidationHistory] = useState<InvalidationTriggerEntry[]>(INITIAL_INVALIDATION_TRIGGERS);

  // In-flight database mutation state & deferred serialization consistency lock
  const [isDatabaseMutatingState, setIsDatabaseMutatingState] = useState<boolean>(() => isDatabaseMutating());
  const [activeInFlightMutation, setActiveInFlightMutation] = useState<InFlightMutationState | null>(() =>
    getActiveInFlightMutation()
  );
  const [pendingMutationsCount, setPendingMutationsCount] = useState<number>(() =>
    getActivePendingMutationsCount()
  );
  const [activeMutationsList, setActiveMutationsList] = useState<InFlightMutationState[]>(() =>
    getAllActiveInFlightMutations()
  );
  const [mutationHistory, setMutationHistory] = useState(() => getDatabaseMutationHistory());
  const [mutationClock, setMutationClock] = useState<number>(() => Date.now());
  const [exportPausedToast, setExportPausedToast] = useState<string | null>(null);

  // Live countdown ticker while database is mutating
  useEffect(() => {
    if (!isDatabaseMutatingState) return;
    const interval = setInterval(() => {
      setMutationClock(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [isDatabaseMutatingState]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const unsubscribeCache = subscribeCacheInvalidation((reason, lastRefreshed) => {
      setIsCacheInvalidatedPulsing(true);
      if (reason) setCacheInvalidationReason(reason);
      if (lastRefreshed) {
        setLastCacheRefreshedAt(lastRefreshed);
      } else {
        setLastCacheRefreshedAt(getLastCacheRefreshTimestamp());
      }

      const newEntry: InvalidationTriggerEntry = {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reason: reason || 'database_mutation',
        label: formatTriggerLabel(reason),
        timestamp: Date.now(),
        isBulk: isBulkTrigger(reason),
        details: getTriggerDetails(reason)
      };
      setInvalidationHistory((prev) => [newEntry, ...prev].slice(0, 10));

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIsCacheInvalidatedPulsing(false);
      }, 3500);
    });

    const unsubscribeMutation = subscribeMutationState((isMutating, mutation, count, allPending) => {
      setIsDatabaseMutatingState(isMutating);
      setActiveInFlightMutation(mutation);
      setPendingMutationsCount(count);
      setActiveMutationsList(allPending);
      setMutationHistory(getDatabaseMutationHistory());
    });

    return () => {
      unsubscribeCache();
      unsubscribeMutation();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Compute estimated wait time based on active pending mutations
  const estimatedWaitTimeText = useMemo(() => {
    if (!isDatabaseMutatingState || pendingMutationsCount === 0 || activeMutationsList.length === 0) {
      return 'Resuming shortly...';
    }
    const now = mutationClock;
    let maxRemainingMs = 0;
    activeMutationsList.forEach((m) => {
      const elapsed = Math.max(0, now - m.startedAt);
      const estDuration = m.estimatedDurationMs || 2500;
      const remaining = Math.max(250, estDuration - elapsed);
      if (remaining > maxRemainingMs) {
        maxRemainingMs = remaining;
      }
    });

    // Buffer 500ms per additional pending mutation for WAL flush & index re-sync
    const queueBuffer = Math.max(0, pendingMutationsCount - 1) * 500;
    const totalRemainingSeconds = Math.max(0.4, (maxRemainingMs + queueBuffer) / 1000);

    if (totalRemainingSeconds < 1) {
      return `~${totalRemainingSeconds.toFixed(1)}s (<1s remaining)`;
    }
    return `~${totalRemainingSeconds.toFixed(1)}s remaining`;
  }, [isDatabaseMutatingState, pendingMutationsCount, activeMutationsList, mutationClock]);

  // Compute total estimated completion percentage across all active pending database mutations
  const mutationProgressPercent = useMemo(() => {
    if (!isDatabaseMutatingState || pendingMutationsCount === 0) {
      return 100;
    }
    const mutations =
      activeMutationsList.length > 0
        ? activeMutationsList
        : activeInFlightMutation
        ? [activeInFlightMutation]
        : [];
    if (mutations.length === 0) return 100;

    const now = mutationClock;
    let totalDuration = 0;
    let totalElapsed = 0;

    mutations.forEach((m) => {
      const estDuration = m.estimatedDurationMs || 2500;
      const elapsed = Math.max(0, now - m.startedAt);
      totalDuration += estDuration;
      totalElapsed += Math.min(estDuration * 0.95, elapsed);
    });

    if (totalDuration === 0) return 10;
    const pct = Math.min(96, Math.max(6, Math.round((totalElapsed / totalDuration) * 100)));
    return pct;
  }, [isDatabaseMutatingState, pendingMutationsCount, activeMutationsList, activeInFlightMutation, mutationClock]);

  // Live Monitoring state: forces tooltip to auto-update every 1s instead of relying on standard hover state
  const [isLiveMonitoring, setIsLiveMonitoring] = useState<boolean>(false);
  const [liveMonitoringClock, setLiveMonitoringClock] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isLiveMonitoring) return;

    const updateLiveContent = () => {
      const now = Date.now();
      setLiveMonitoringClock(now);
      setMutationClock(now);
      const active = getAllActiveInFlightMutations();
      setActiveMutationsList(active);
      setPendingMutationsCount(active.length);
      setIsDatabaseMutatingState(active.length > 0 || isDatabaseMutating());
    };

    updateLiveContent();
    const interval = setInterval(updateLiveContent, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isLiveMonitoring]);

  // Custom Mutation Threshold (default: 5s) and notification tracking
  const [mutationThreshold, setMutationThreshold] = useState<number>(5);
  const [isThresholdInputFocused, setIsThresholdInputFocused] = useState<boolean>(false);
  const [thresholdAlert, setThresholdAlert] = useState<{
    id: string;
    mutationId: string;
    mutationDescription: string;
    thresholdSeconds: number;
    elapsedSeconds: number;
    timestamp: number;
  } | null>(null);
  const alertedMutationIdsRef = useRef<Set<string>>(new Set());

  // Active Threshold Alerts history (last 5 threshold violations)
  const [thresholdViolationsHistory, setThresholdViolationsHistory] = useState<
    Array<{
      id: string;
      mutationId: string;
      mutationDescription: string;
      thresholdSeconds: number;
      elapsedSeconds: number;
      timestamp: number;
    }>
  >([
    {
      id: 'viol-sample-1',
      mutationId: 'mut-sample-1',
      mutationDescription: 'Bulk Ingest Catalog Sync (120 rows)',
      thresholdSeconds: 5,
      elapsedSeconds: 5.8,
      timestamp: Date.now() - 36000
    },
    {
      id: 'viol-sample-2',
      mutationId: 'mut-sample-2',
      mutationDescription: 'Category Price Multiplier Batch Recalculation',
      thresholdSeconds: 5,
      elapsedSeconds: 6.4,
      timestamp: Date.now() - 95000
    }
  ]);
  const [copiedAlertItemId, setCopiedAlertItemId] = useState<string | null>(null);

  const handleCopyAlertItem = (item: {
    id: string;
    mutationDescription: string;
    thresholdSeconds: number;
    elapsedSeconds: number;
    timestamp: number;
  }) => {
    const formatted = `[Active Threshold Alert]
Mutation: ${item.mutationDescription}
Duration: ${item.elapsedSeconds}s (Threshold: ${item.thresholdSeconds}s)
Timestamp: ${new Date(item.timestamp).toLocaleTimeString()}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(formatted).catch(() => {});
    }
    setCopiedAlertItemId(item.id);
    setTimeout(() => {
      setCopiedAlertItemId((curr) => (curr === item.id ? null : curr));
    }, 2000);
  };

  const [isAlertHistoryCleared, setIsAlertHistoryCleared] = useState(false);

  // Clears the active threshold alert history array and resets alert tracking state
  const handleClearAlertHistory = () => {
    // Delete the history array
    setThresholdViolationsHistory([]);
    // Reset active alert tracking state
    setThresholdAlert(null);
    alertedMutationIdsRef.current.clear();
    setCopiedAlertItemId(null);
    setIsAlertHistoryCleared(true);
    setTimeout(() => {
      setIsAlertHistoryCleared(false);
    }, 2000);
  };

  const [isExportingThresholdLogs, setIsExportingThresholdLogs] = useState<boolean>(false);
  const [isExportThresholdLogsSuccess, setIsExportThresholdLogsSuccess] = useState<boolean>(false);

  // Exports the entire threshold alert history as a CSV file for long-term auditing
  const handleExportThresholdAlertLogsCsv = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    setIsExportingThresholdLogs(true);
    try {
      const escapeCsvValue = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const headers = [
        'Alert ID',
        'Mutation ID',
        'Mutation Description',
        'Threshold Seconds',
        'Elapsed Seconds',
        'Variance Over Threshold (Sec)',
        'Timestamp (ISO)',
        'Timestamp (Epoch Ms)',
        'Date Formatted',
        'Time Formatted',
        'Severity Tier',
        'Audit Status'
      ];

      const rows = thresholdViolationsHistory.map((item) => {
        const iso = new Date(item.timestamp).toISOString();
        const dateStr = new Date(item.timestamp).toLocaleDateString();
        const timeStr = new Date(item.timestamp).toLocaleTimeString();
        const varianceSec = Math.max(0, Number((item.elapsedSeconds - item.thresholdSeconds).toFixed(2)));
        const severity =
          item.elapsedSeconds >= item.thresholdSeconds * 2
            ? 'CRITICAL'
            : item.elapsedSeconds >= item.thresholdSeconds * 1.5
            ? 'HIGH'
            : 'WARNING';

        return [
          escapeCsvValue(item.id),
          escapeCsvValue(item.mutationId),
          escapeCsvValue(item.mutationDescription),
          escapeCsvValue(item.thresholdSeconds),
          escapeCsvValue(item.elapsedSeconds),
          escapeCsvValue(varianceSec),
          escapeCsvValue(iso),
          escapeCsvValue(item.timestamp),
          escapeCsvValue(dateStr),
          escapeCsvValue(timeStr),
          escapeCsvValue(severity),
          escapeCsvValue('AUDITED')
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestampStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.download = `threshold-alert-history-audit-${timestampStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExportThresholdLogsSuccess(true);
      setTimeout(() => setIsExportThresholdLogsSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export threshold alerts audit logs as CSV:', err);
    } finally {
      setIsExportingThresholdLogs(false);
    }
  };

  const [isGeneratingDiagnosticReport, setIsGeneratingDiagnosticReport] = useState(false);
  const [isDiagnosticReportSuccess, setIsDiagnosticReportSuccess] = useState(false);

  const [isGeneratingDiagnosticPdf, setIsGeneratingDiagnosticPdf] = useState(false);
  const [isDiagnosticPdfSuccess, setIsDiagnosticPdfSuccess] = useState(false);
  const [diagnosticPdfError, setDiagnosticPdfError] = useState<string | null>(null);
  const [showPdfExportSettings, setShowPdfExportSettings] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfExportSections, setPdfExportSections] = useState({
    includeSparklines: true,
    includeMutationHistory: true,
    includeRecommendations: true,
    includeExecutiveSummary: true,
    breakBeforeSparklines: false,
    breakBeforeMutationHistory: true,
    breakBeforeRecommendations: true,
    breakBeforeExecutiveSummary: false
  });

  // Saved custom PDF template in localStorage
  const [savedCustomPdfTemplate, setSavedCustomPdfTemplate] = useState<PdfReportTemplate | null>(() => getSavedCustomTemplate());
  const [isCustomTemplateSavedFeedback, setIsCustomTemplateSavedFeedback] = useState<boolean>(false);

  // Computes which predefined or saved template matches current pdfExportSections
  const currentMatchedTemplateId = useMemo(() => {
    return matchTemplateId(pdfExportSections, savedCustomPdfTemplate);
  }, [pdfExportSections, savedCustomPdfTemplate]);

  // Handles selecting a template from the Template Selector dropdown
  const handleSelectPdfTemplate = (templateId: string) => {
    if (templateId === 'saved-custom') {
      if (savedCustomPdfTemplate) {
        setPdfExportSections({ ...savedCustomPdfTemplate.sections });
      }
      return;
    }
    const found = PREDEFINED_PDF_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      setPdfExportSections({ ...found.sections });
    }
  };

  // Handles saving current configuration as user's custom template
  const handleSaveCurrentAsCustomTemplate = () => {
    const saved = saveCustomTemplate(pdfExportSections, 'Saved Custom Preset');
    setSavedCustomPdfTemplate(saved);
    setIsCustomTemplateSavedFeedback(true);
    setTimeout(() => setIsCustomTemplateSavedFeedback(false), 2500);
  };

  // Handles loading user's custom saved template
  const handleLoadCustomTemplate = () => {
    if (savedCustomPdfTemplate) {
      setPdfExportSections({ ...savedCustomPdfTemplate.sections });
    }
  };

  // Computes active template metadata for display (audience, description, name)
  const activeTemplateMeta = useMemo(() => {
    if (currentMatchedTemplateId === 'saved-custom' && savedCustomPdfTemplate) {
      return {
        name: savedCustomPdfTemplate.name,
        audience: savedCustomPdfTemplate.audience,
        tagline: savedCustomPdfTemplate.tagline,
        description: savedCustomPdfTemplate.description,
        isCustom: true
      };
    }
    const predefined = PREDEFINED_PDF_TEMPLATES.find((t) => t.id === currentMatchedTemplateId);
    if (predefined) {
      return {
        name: predefined.name,
        audience: predefined.audience,
        tagline: predefined.tagline,
        description: predefined.description,
        isCustom: false
      };
    }
    return {
      name: 'Custom Configuration',
      audience: 'Custom Stakeholders',
      tagline: 'Customized Section Rules',
      description: 'Modified combination of sections and page break rules customized from default presets.',
      isCustom: true
    };
  }, [currentMatchedTemplateId, savedCustomPdfTemplate]);

  // Generate Diagnostic Correlation Report as a non-technical Visual PDF with sparklines
  const handleGenerateDiagnosticCorrelationPdf = async () => {
    setIsGeneratingDiagnosticPdf(true);
    setDiagnosticPdfError(null);
    try {
      await exportDiagnosticCorrelationPdf({
        thresholdViolations: thresholdViolationsHistory,
        mutationHistory,
        trendHistory,
        mutationThreshold,
        currentFlags: flags,
        options: {
          sections: pdfExportSections
        }
      });
      setIsDiagnosticPdfSuccess(true);
      setDiagnosticPdfError(null);
      setTimeout(() => {
        setIsDiagnosticPdfSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error('Failed to generate diagnostic correlation PDF report:', err);
      const errorMessage =
        err?.message ||
        'Failed to generate visual PDF report. Please verify diagnostic history and try again.';
      setDiagnosticPdfError(errorMessage);
    } finally {
      setIsGeneratingDiagnosticPdf(false);
    }
  };

  // Generate Diagnostic Correlation Report as JSON summarizing mutation clusters & latency spikes
  const handleGenerateDiagnosticCorrelationReport = () => {
    setIsGeneratingDiagnosticReport(true);
    try {
      exportDiagnosticCorrelationReportJson({
        thresholdViolations: thresholdViolationsHistory,
        mutationHistory,
        trendHistory,
        mutationThreshold,
        currentFlags: flags
      });
      setIsDiagnosticReportSuccess(true);
      setTimeout(() => {
        setIsDiagnosticReportSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to generate diagnostic correlation report:', err);
    } finally {
      setIsGeneratingDiagnosticReport(false);
    }
  };

  // Check if any active database mutation exceeds the user-defined threshold duration
  useEffect(() => {
    if (!isDatabaseMutatingState || activeMutationsList.length === 0) {
      return;
    }
    const currentThreshold = mutationThreshold > 0 ? mutationThreshold : 5;
    const thresholdMs = currentThreshold * 1000;
    const now = Date.now();

    activeMutationsList.forEach((m) => {
      const elapsedMs = now - m.startedAt;
      if (elapsedMs >= thresholdMs) {
        const alertKey = `${m.id}-${currentThreshold}`;
        if (!alertedMutationIdsRef.current.has(alertKey)) {
          alertedMutationIdsRef.current.add(alertKey);
          const elapsedSec = Math.round((elapsedMs / 1000) * 10) / 10;
          const newAlertItem = {
            id: `alert-${m.id}-${Date.now()}`,
            mutationId: m.id,
            mutationDescription: m.description,
            thresholdSeconds: currentThreshold,
            elapsedSeconds: elapsedSec,
            timestamp: Date.now()
          };
          setThresholdAlert(newAlertItem);
          setThresholdViolationsHistory((prev) => [newAlertItem, ...prev]);

          // Automatically mark correlating latency data points as 'High-Duration Mutation' in the Performance Trends view
          setTrendHistory((prevTrend) => {
            if (prevTrend.length === 0) return prevTrend;
            const updated = prevTrend.map((pt, idx) => {
              // Correlate the latest point or any points within the mutation duration window
              const withinWindow = Math.abs(pt.timestamp - newAlertItem.timestamp) <= (newAlertItem.elapsedSeconds + 10) * 1000;
              const isLatest = idx === prevTrend.length - 1;
              if (withinWindow || isLatest) {
                return {
                  ...pt,
                  isHighDurationMutation: true,
                  correlatedThresholdViolation: {
                    id: newAlertItem.id,
                    mutationId: newAlertItem.mutationId,
                    mutationDescription: newAlertItem.mutationDescription,
                    thresholdSeconds: newAlertItem.thresholdSeconds,
                    elapsedSeconds: newAlertItem.elapsedSeconds,
                    timestamp: newAlertItem.timestamp
                  }
                };
              }
              return pt;
            });
            return updated;
          });

          // Also trigger system browser notification if enabled
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification('Mutation Threshold Exceeded', {
                body: `${m.description} has exceeded your ${currentThreshold}s threshold (${elapsedSec}s elapsed).`,
                icon: '/favicon.ico'
              });
            } catch {
              // Notification API error handled gracefully
            }
          }
        }
      }
    });
  }, [mutationClock, isDatabaseMutatingState, activeMutationsList, mutationThreshold]);

  // Reset alert tracking history when all active mutations have completed
  useEffect(() => {
    if (activeMutationsList.length === 0) {
      alertedMutationIdsRef.current.clear();
    }
  }, [activeMutationsList]);

  const isExportPulsing =
    isCacheInvalidatedPulsing || isDatabaseMutatingState || isLiveMonitoring || Boolean(thresholdAlert);

  const last3Triggers = useMemo(() => {
    return invalidationHistory.slice(0, 3);
  }, [invalidationHistory]);

  const recurrentBulkCount = useMemo(() => {
    return last3Triggers.filter((t) => t.isBulk).length;
  }, [last3Triggers]);

  const formattedCacheRefreshTime = useMemo(() => {
    if (!lastCacheRefreshedAt) return 'Just now';
    const date = new Date(lastCacheRefreshedAt);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: true
    });
  }, [lastCacheRefreshedAt]);

  const formattedCacheRefreshDate = useMemo(() => {
    if (!lastCacheRefreshedAt) return '';
    return new Date(lastCacheRefreshedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [lastCacheRefreshedAt]);

  const cacheRefreshSecondsAgo = useMemo(() => {
    if (!lastCacheRefreshedAt) return '0.0s';
    const diff = Math.max(0, (Date.now() - lastCacheRefreshedAt) / 1000);
    return `${diff.toFixed(1)}s`;
  }, [lastCacheRefreshedAt, isExportHovered, liveMonitoringClock]);

  // Copy Logs state and export tooltip interaction helpers
  const [isCopiedLogs, setIsCopiedLogs] = useState<boolean>(false);
  const exportHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleExportMouseEnter = () => {
    if (exportHoverTimeoutRef.current) {
      clearTimeout(exportHoverTimeoutRef.current);
      exportHoverTimeoutRef.current = null;
    }
    setIsExportHovered(true);
  };

  const handleExportMouseLeave = () => {
    if (isLiveMonitoring) return;
    if (exportHoverTimeoutRef.current) {
      clearTimeout(exportHoverTimeoutRef.current);
    }
    exportHoverTimeoutRef.current = setTimeout(() => {
      if (!isLiveMonitoring) {
        setIsExportHovered(false);
      }
    }, 250);
  };

  const handleCopyInvalidationLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const formatted = formatInvalidationLogsForClipboard(
      last3Triggers,
      isDatabaseMutatingState,
      pendingMutationsCount,
      recurrentBulkCount
    );
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatted);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = formatted;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopiedLogs(true);
      setTimeout(() => setIsCopiedLogs(false), 2000);
    } catch (err) {
      console.error('Failed to copy invalidation triggers to clipboard:', err);
    }
  };

  const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);

  const handleCopyLogSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const summary = [
      `*Database Mutation & Cache Performance Summary*`,
      `• Pending Mutation Queue Count: ${pendingMutationsCount} active ${pendingMutationsCount === 1 ? 'mutation' : 'mutations'}`,
      `• Estimated Wait Time: ${estimatedWaitTimeText}`,
      `• Total Est. Completion: ${mutationProgressPercent}%`,
      `• Serialization Status: ${isDatabaseMutatingState ? 'PAUSED (Serialization Deferred)' : 'READY (Fresh Read Active)'}`,
      `• Lock Scope: Heap Rows & B-Tree Indexes (Snapshot Isolation)`,
      `• Timestamp: ${new Date().toISOString()}`
    ].join('\n');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = summary;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopiedSummary(true);
      setTimeout(() => setIsCopiedSummary(false), 2000);
    } catch (err) {
      console.error('Failed to copy log summary to clipboard:', err);
    }
  };

  const [isCopiedJson, setIsCopiedJson] = useState<boolean>(false);

  const handleCopyInvalidationJson = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const minifiedPayload = JSON.stringify({
      triggers: last3Triggers.map((t, idx) => ({
        index: idx + 1,
        id: t.id,
        label: t.label,
        reason: t.reason,
        bulk: t.isBulk,
        timestamp: t.timestamp,
        iso: new Date(t.timestamp).toISOString(),
        details: t.details || null
      })),
      recurrentBulkCount,
      databaseState: {
        isMutating: isDatabaseMutatingState,
        status: isDatabaseMutatingState ? 'PAUSED' : 'READY',
        pendingMutationsCount
      },
      lastCacheRefreshedAt,
      exportedAt: Date.now()
    });

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(minifiedPayload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = minifiedPayload;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 2000);
    } catch (err) {
      console.error('Failed to copy minified invalidation triggers JSON to clipboard:', err);
    }
  };

  const [isDownloadedJson, setIsDownloadedJson] = useState<boolean>(false);

  const handleDownloadInvalidationLogsJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const payload = {
      exportType: 'cache_invalidation_triggers_audit',
      exportedAt: new Date().toISOString(),
      databaseState: {
        isMutating: isDatabaseMutatingState,
        status: isDatabaseMutatingState ? 'PAUSED' : 'READY',
        pendingMutationsCount: pendingMutationsCount,
        activeMutations: activeMutationsList.map((m) => ({
          id: m.id,
          type: m.type,
          description: m.description,
          startedAt: new Date(m.startedAt).toISOString(),
          targetRows: m.targetRows,
          estimatedDurationMs: m.estimatedDurationMs
        }))
      },
      metrics: {
        recurrentBulkCount,
        recurrentBulkThreshold: 2,
        isHighChurn: recurrentBulkCount >= 2,
        totalRecentTriggers: last3Triggers.length
      },
      last3Triggers: last3Triggers.map((t, idx) => ({
        index: idx + 1,
        id: t.id,
        label: t.label,
        reason: t.reason,
        isBulk: t.isBulk,
        timestamp: t.timestamp,
        isoTimestamp: new Date(t.timestamp).toISOString(),
        timeAgo: formatTriggerTimeAgo(t.timestamp),
        details: t.details || null
      })),
      diagnostics: {
        cacheStatus: isDatabaseMutatingState
          ? 'Consistency lock active: Serialization deferred to prevent partial snapshot tearing.'
          : 'Cache invalidated: Next export queries fresh table snapshot.',
        churnRecommendation:
          recurrentBulkCount >= 2
            ? 'High churn rate detected: Consecutive bulk operations frequently evict cached query records.'
            : 'Normal mutation cadence: Cache invalidation overhead is nominal.'
      }
    };

    try {
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cache-invalidation-triggers-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsDownloadedJson(true);
      setTimeout(() => setIsDownloadedJson(false), 2000);
    } catch (err) {
      console.error('Failed to download invalidation triggers JSON:', err);
    }
  };

  const [isExportedAllCsv, setIsExportedAllCsv] = useState<boolean>(false);

  const handleExportAllInvalidationLogsCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const escapeCsvValue = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const headers = [
        'id',
        'timestamp',
        'iso_timestamp',
        'local_timestamp',
        'reason',
        'label',
        'isBulk',
        'bulk_operation',
        'audit_event_type',
        'invalidation_scope',
        'details'
      ];

      const rows = invalidationHistory.map((item) => {
        const iso = new Date(item.timestamp).toISOString();
        const local = new Date(item.timestamp).toLocaleString();
        return [
          escapeCsvValue(item.id),
          escapeCsvValue(item.timestamp),
          escapeCsvValue(iso),
          escapeCsvValue(local),
          escapeCsvValue(item.reason),
          escapeCsvValue(item.label),
          escapeCsvValue(item.isBulk ? 'true' : 'false'),
          escapeCsvValue(item.isBulk ? 'YES' : 'NO'),
          escapeCsvValue('CACHE_INVALIDATION_TRIGGER'),
          escapeCsvValue(item.isBulk ? 'GLOBAL_PARTITION_FLUSH' : 'TARGETED_ENTRY_EVICTION'),
          escapeCsvValue(item.details || '')
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cache-invalidation-audit-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExportedAllCsv(true);
      setTimeout(() => setIsExportedAllCsv(false), 2500);
    } catch (err) {
      console.error('Failed to export all invalidation triggers CSV:', err);
    }
  };

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

  // Serialization Error & Throughput Anomaly Log state
  const [serializationLogs, setSerializationLogs] = useState<SerializationLogEntry[]>(() =>
    getInitialSerializationLogs()
  );

  const handleClearSerializationLogs = () => {
    setSerializationLogs([]);
  };

  const handleDismissLog = (id: string) => {
    setSerializationLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSimulateFault = (
    mode: 'failure' | 'throughput_anomaly' | 'cpu_spike' | 'latency_anomaly'
  ) => {
    const simulated = createSimulatedLog(
      mode,
      selectedExportFormat,
      queryResult.records.length
    );
    setSerializationLogs((prev) => [simulated, ...prev].slice(0, 50));
  };

  const handleLogLatencyAnomaly = (log: SerializationLogEntry) => {
    setSerializationLogs((prev) => {
      if (prev.some((entry) => entry.id === log.id)) return prev;
      return [log, ...prev].slice(0, 50);
    });
  };


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
        timestamp: now - 36000,
        timeFormatted: formatTime(36000),
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
        triggerEvent: 'Bulk Ingest Catalog Sync (120 rows)',
        deltaMs: 90.55,
        simulatedError: null,
        isHighDurationMutation: true,
        correlatedThresholdViolation: {
          id: 'viol-sample-1',
          mutationId: 'mut-sample-1',
          mutationDescription: 'Bulk Ingest Catalog Sync (120 rows)',
          thresholdSeconds: 5,
          elapsedSeconds: 5.8,
          timestamp: now - 36000
        }
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

  // Dynamically compute estimated file sizes & performance comparison for CSV vs JSON export based on currently filtered records
  const exportSizeEstimates = useMemo(() => {
    const rowCount = queryResult.records.length;
    if (rowCount === 0) {
      return {
        rowCount: 0,
        csvBytes: 0,
        jsonBytes: 0,
        csvGzipBytes: 0,
        jsonGzipBytes: 0,
        csvBytesFormatted: '0 B',
        jsonBytesFormatted: '0 B',
        csvGzipFormatted: '0 B',
        jsonGzipFormatted: '0 B',
        savingsPercent: 0,
        overheadPercent: 0,
        overheadRatio: 1,
        bytesPerRowCsv: 0,
        bytesPerRowJson: 0,
        csvEstDurationText: '< 1 ms',
        jsonEstDurationText: '< 1 ms'
      };
    }

    // Sample actual filtered records to accurately calculate average row byte density with real SKUs and field values
    const sampleSize = Math.min(25, rowCount);
    const sample = queryResult.records.slice(0, sampleSize);

    // CSV size calculation (using real CSV serialization)
    const { csvString: sampleCsv } = buildCsvString(sample, { includeHeaders: false });
    const csvRowBytesAvg = new Blob([sampleCsv]).size / sampleSize;
    const headerBytes = includeCsvHeaders ? 212 : 0;
    const estimatedCsvBytes = Math.round(headerBytes + csvRowBytesAvg * rowCount);

    // JSON size calculation (formatted with 2 spaces matching exportRecordsToJson default)
    const sampleJson = JSON.stringify(sample, null, 2);
    const jsonRowBytesAvg = new Blob([sampleJson]).size / sampleSize;
    const estimatedJsonBytes = Math.round(jsonRowBytesAvg * rowCount);

    // GZIP compression estimates (CSV ~65% compression, JSON ~78% compression due to repetitive schema keys)
    const estimatedCsvGzip = Math.round(estimatedCsvBytes * 0.35);
    const estimatedJsonGzip = Math.round(estimatedJsonBytes * 0.22);

    const overheadRatio = Number((estimatedJsonBytes / Math.max(1, estimatedCsvBytes)).toFixed(1));
    const overheadPercent = Math.max(0, Math.round(((estimatedJsonBytes - estimatedCsvBytes) / Math.max(1, estimatedCsvBytes)) * 100));
    const savingsPercent = Math.max(0, Math.round(((estimatedJsonBytes - estimatedCsvBytes) / Math.max(1, estimatedJsonBytes)) * 100));

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const csvEstMs = Math.max(0.1, Number(((rowCount / 35000) * 1000).toFixed(1)));
    const jsonEstMs = Math.max(0.2, Number(((rowCount / 18000) * 1000).toFixed(1)));

    return {
      rowCount,
      csvBytes: estimatedCsvBytes,
      jsonBytes: estimatedJsonBytes,
      csvGzipBytes: estimatedCsvGzip,
      jsonGzipBytes: estimatedJsonGzip,
      csvBytesFormatted: formatBytes(estimatedCsvBytes),
      jsonBytesFormatted: formatBytes(estimatedJsonBytes),
      csvGzipFormatted: formatBytes(estimatedCsvGzip),
      jsonGzipFormatted: formatBytes(estimatedJsonGzip),
      savingsPercent,
      overheadPercent,
      overheadRatio,
      bytesPerRowCsv: Math.round(csvRowBytesAvg),
      bytesPerRowJson: Math.round(jsonRowBytesAvg),
      csvEstDurationText: csvEstMs < 1 ? '< 1 ms' : `~${csvEstMs} ms`,
      jsonEstDurationText: jsonEstMs < 1 ? '< 1 ms' : `~${jsonEstMs} ms`
    };
  }, [queryResult.records, includeCsvHeaders]);

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
    let pointToAppend = { ...newPoint };
    if (!pointToAppend.isHighDurationMutation && thresholdViolationsHistory.length > 0) {
      const match = thresholdViolationsHistory.find((v) => {
        const timeDiff = Math.abs(pointToAppend.timestamp - v.timestamp);
        return timeDiff <= (v.elapsedSeconds + 15) * 1000;
      });
      if (match) {
        pointToAppend.isHighDurationMutation = true;
        pointToAppend.correlatedThresholdViolation = {
          id: match.id,
          mutationId: match.mutationId,
          mutationDescription: match.mutationDescription,
          thresholdSeconds: match.thresholdSeconds,
          elapsedSeconds: match.elapsedSeconds,
          timestamp: match.timestamp
        };
      }
    }

    setTrendHistory((prev) => {
      const updated = [...prev, pointToAppend];
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

    // Detect throughput degradation, latency spikes, or CPU contention anomalies
    const triggerSource = auditMeta?.isAutoSave
      ? `Queue Auto-Save [${auditMeta.tapeId || 'Tape'}]`
      : 'Table & Plan Export';
    const anomaly = detectSerializationAnomaly(stats, format, triggerSource);
    if (anomaly) {
      setSerializationLogs((prev) => [anomaly, ...prev].slice(0, 50));
    }
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

        const { entry: newEntry, stats } = await createDataTapeEntry({
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
          sequenceNumber: seq,
          includeHeaders: includeCsvHeadersRef.current
        });

        // Prepend new entry to the audit tape ledger
        setDataTapeEntries((prev) => [newEntry, ...prev]);

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

  const handleHeaderExport = (formatToExport?: ExportFormat, isFromShortcut?: boolean) => {
    // If a database mutation is currently mid-process, defer serialization to ensure data consistency
    if (isDatabaseMutatingState) {
      setExportPausedToast(
        `Export Paused: ${pendingMutationsCount} database mutation${pendingMutationsCount === 1 ? ' is' : 's are'} mid-process. Serialization is deferred to ensure data consistency.`
      );
      setTimeout(() => setExportPausedToast(null), 4500);
      return;
    }

    const format = formatToExport || selectedExportFormatRef.current;
    const recordsToExport = queryResultRef.current.records;
    if (recordsToExport.length === 0) {
      if (isFromShortcut) {
        setShortcutToast({
          key: shortcutKeyLabel,
          format,
          rows: 0,
          isEmpty: true
        });
        setTimeout(() => setShortcutToast(null), 3500);
      }
      return;
    }
    if (isHeaderExporting) return;

    setSelectedExportFormat(format);
    setIsExportDropdownOpen(false);
    setIsHeaderExporting(true);
    if (isCacheInvalidatedPulsing) {
      setIsCacheInvalidatedPulsing(false);
    }

    if (isFromShortcut) {
      setIsShortcutFlashing(true);
      setTimeout(() => setIsShortcutFlashing(false), 800);
      setShortcutToast({
        key: shortcutKeyLabel,
        format,
        rows: recordsToExport.length,
        isEmpty: false
      });
      setTimeout(() => setShortcutToast(null), 3500);
    }

    setTimeout(() => {
      try {
        const { blob, filename, stats } = exportRecords(
          recordsToExport,
          format,
          'filtered_transactions',
          { includeHeaders: includeCsvHeadersRef.current }
        );
        triggerFileDownload(blob, filename);
        setHeaderExportStats(stats);
        recordExportOperation(stats, format);
      } catch (err: unknown) {
        console.error(`Failed to export ${format.toUpperCase()} from Table & Explain Plan header:`, err);
        const errorLog: SerializationLogEntry = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          timeFormatted: new Date().toTimeString().split(' ')[0],
          severity: 'error',
          type: 'SERIALIZATION_EXCEPTION',
          format,
          recordCount: recordsToExport.length,
          message: `Fatal serialization abort: ${err instanceof Error ? err.message : 'Unknown serialization failure'}`,
          details: {
            cause: err instanceof Error ? err.stack || err.message : String(err),
            stackTrace: err instanceof Error ? err.stack : undefined,
            triggerSource: isFromShortcut ? 'Keyboard Shortcut Export' : 'Manual Header Export'
          }
        };
        setSerializationLogs((prev) => [errorLog, ...prev].slice(0, 50));
      } finally {
        setIsHeaderExporting(false);
      }
    }, 10);
  };

  // Power-user keyboard shortcut: Ctrl+E (or ⌘E on Mac) to trigger Export CSV/JSON directly from Table view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Check for Ctrl+E (Windows/Linux) or Cmd+E (Mac)
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier || e.altKey) return;
      if (e.key.toLowerCase() !== 'e') return;

      // Prevent default browser action (e.g. focusing search/URL bar in Chrome/Edge or find-selection)
      e.preventDefault();

      // Do not trigger export if a modal is currently open
      if (isBulkImportOpen || isDataTapeModalOpen || isBenchmarkOpen) {
        return;
      }

      // If currently in Trends view, automatically switch to Table view
      if (activeView !== 'grid') {
        setActiveView('grid');
      }

      // If Shift is pressed (Ctrl+Shift+E), export in the alternate format; otherwise export selected format
      const targetFormat: ExportFormat = e.shiftKey
        ? selectedExportFormat === 'csv'
          ? 'json'
          : 'csv'
        : selectedExportFormat;

      handleHeaderExport(targetFormat, true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeView,
    selectedExportFormat,
    queryResult.records,
    isHeaderExporting,
    isBulkImportOpen,
    isDataTapeModalOpen,
    isBenchmarkOpen,
    shortcutKeyLabel
  ]);

  // Trigger on-demand manual tape slice
  const handleTriggerManualTapeSlice = async () => {
    try {
      const format = selectedExportFormat;
      const seq = dataTapeEntries.length + 1;
      const { entry: newEntry, stats } = await createDataTapeEntry({
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
  const handleMutateDatabase = async (type: 'status_transition' | 'high_risk_flag' | 'insert_live') => {
    const desc =
      type === 'status_transition'
        ? 'Batch Status Transition (50 orders)'
        : type === 'high_risk_flag'
        ? 'High-Risk Audit Flag Update (50 orders)'
        : 'Live Ingest Append (+50 orders)';
    const releaseMutation = beginDatabaseMutation(type, desc, 50);
    try {
      // Simulate realistic mid-process commit window (2.2s) so the paused state and consistency lock are visible in UI & tooltip
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const result = executeBatchMutation(type, 50);
      setTotalDatabaseRecords(result.totalRecords);
      setQueryVersion((v) => v + 1);
    } finally {
      releaseMutation();
    }
  };

  // Explicit simulation of concurrent mutation lock to test Export Paused state in real-time
  const handleSimulateMidProcessMutation = async () => {
    setIsExportDropdownOpen(false);
    setIsExportHovered(true);
    const releaseMutation = beginDatabaseMutation(
      'status_transition',
      'Batch Status Transition (50 orders in-flight)',
      50
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const result = executeBatchMutation('status_transition', 50);
      setTotalDatabaseRecords(result.totalRecords);
      setQueryVersion((v) => v + 1);
    } finally {
      releaseMutation();
    }
  };

  // Batch deletion of transactions by selected IDs
  const handleDeleteRecords = (idsToDelete: string[]) => {
    const result = deleteRecordsByIds(idsToDelete);
    setTotalDatabaseRecords(result.totalRecords);
    setQueryVersion((v) => v + 1);

    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    const newPoint: LatencyTrendPoint = {
      id: `pt-del-${Date.now()}`,
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: queryResult.executionTimeMs,
      rowsScanned: queryResult.rowsScanned,
      activeQueriesCount: queryResult.activeQueriesCount,
      cacheHit: false,
      flags: { ...flags },
      triggerEvent: `Batch Delete (${result.deletedCount.toLocaleString()} rows removed)`,
      simulatedError: queryResult.simulatedError
    };
    setTrendHistory((prev) => [...prev, newPoint].slice(-60));
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
                    onMouseEnter={handleExportMouseEnter}
                    onMouseLeave={handleExportMouseLeave}
                    onFocus={handleExportMouseEnter}
                    onBlur={handleExportMouseLeave}
                    aria-describedby={
                      isExportPulsing || isExportHovered || isLiveMonitoring
                        ? 'tooltip-cache-invalidation-fresh-read'
                        : undefined
                    }
                    disabled={isHeaderExporting || queryResult.records.length === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-r-0 border-zinc-300 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-98 ${
                      isShortcutFlashing
                        ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-950 shadow-md scale-102'
                        : isExportPulsing
                        ? 'ring-2 ring-amber-500 bg-amber-50/90 text-amber-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                        : ''
                    }`}
                    title={
                      isDatabaseMutatingState
                        ? `Export Paused (${pendingMutationsCount} active pending database mutation${pendingMutationsCount === 1 ? '' : 's'}): Serialization is deferred to ensure data consistency`
                        : isCacheInvalidatedPulsing
                        ? 'Cache invalidated: Next export will perform a fresh database read'
                        : `Export query results as ${
                            selectedExportFormat === 'json'
                              ? 'JSON'
                              : includeCsvHeaders
                              ? 'CSV (with headers)'
                              : 'CSV (headerless)'
                          } (Shortcut: ${shortcutKeyLabel}, ${altShortcutKeyLabel} for alternate)`
                    }
                  >
                    {isHeaderExporting ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                        <span>Serializing...</span>
                      </>
                    ) : (
                      <>
                        {selectedExportFormat === 'json' ? (
                          <FileCode className={`w-3.5 h-3.5 ${isExportPulsing ? 'text-amber-700 animate-pulse' : 'text-amber-600'}`} />
                        ) : (
                          <FileSpreadsheet className={`w-3.5 h-3.5 ${isExportPulsing ? 'text-amber-700 animate-pulse' : 'text-emerald-600'}`} />
                        )}
                        <span>
                          {selectedExportFormat === 'json'
                            ? 'Export JSON'
                            : includeCsvHeaders
                            ? 'Export CSV'
                            : 'Export CSV (No Headers)'}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold border transition-colors ${
                          isExportPulsing
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                          {queryResult.records.length}
                        </span>

                        {isDatabaseMutatingState ? (
                          <span
                            id="badge-export-paused"
                            data-testid="badge-export-paused"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-300 text-amber-950 border border-amber-500/90 shadow-2xs animate-pulse ml-0.5"
                            title={`Database mutation is mid-process (${pendingMutationsCount} active pending): Serialization deferred to ensure data consistency`}
                          >
                            <Pause className="w-2.5 h-2.5 fill-amber-900 text-amber-900" />
                            <span>Export Paused ({pendingMutationsCount})</span>
                          </span>
                        ) : isCacheInvalidatedPulsing ? (
                          <span
                            id="badge-export-cache-invalidation"
                            data-testid="badge-export-cache-invalidation"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200/90 text-amber-900 border border-amber-400/80 shadow-2xs animate-pulse ml-0.5"
                            title="Cache entry invalidated: Next export will perform a fresh database read"
                          >
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-700" />
                            <span>Fresh Read</span>
                          </span>
                        ) : (
                          <kbd
                            className="hidden sm:inline-flex items-center text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-300 font-semibold group-hover:border-zinc-400 ml-0.5"
                            title={`Press ${shortcutKeyLabel} to export`}
                          >
                            {shortcutKeyLabel}
                          </kbd>
                        )}
                      </>
                    )}
                  </button>

                  {/* Custom Tooltip: includes Performance Comparison Table, 'Export Paused' state during mid-process mutations, Last 3 Invalidation Triggers & Export All Logs Audit CSV */}
                  <div
                    id="tooltip-cache-invalidation-fresh-read"
                    data-testid="tooltip-cache-invalidation-fresh-read"
                    data-tooltip="tooltip-header-export-csv"
                    role="tooltip"
                    onMouseEnter={handleExportMouseEnter}
                    onMouseLeave={handleExportMouseLeave}
                    className={`absolute bottom-full mb-2.5 left-0 z-50 w-80 sm:w-[420px] max-h-[85vh] overflow-y-auto p-3 rounded-lg bg-zinc-900/95 backdrop-blur-xs text-zinc-100 text-xs shadow-2xl border ${
                      thresholdAlert
                        ? 'border-rose-500/90 shadow-rose-500/20 ring-1 ring-rose-500/40'
                        : isDatabaseMutatingState
                        ? 'border-amber-400/90 shadow-amber-500/20 ring-1 ring-amber-400/30'
                        : 'border-zinc-700 shadow-zinc-950/50'
                    } transition-all duration-150 ${
                      isExportHovered || isLiveMonitoring || isThresholdInputFocused || isExportPulsing
                        ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                        : 'opacity-0 translate-y-1 invisible pointer-events-none'
                    }`}
                  >
                      {/* Live Monitoring Toggle Bar */}
                      <div
                        id="control-live-monitoring"
                        data-testid="control-live-monitoring"
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 mb-2 rounded bg-zinc-950/80 border border-zinc-700/80 text-[11px]"
                      >
                        <label
                          htmlFor="checkbox-live-monitoring"
                          className="flex items-center gap-2 cursor-pointer select-none text-zinc-300 hover:text-white"
                        >
                          <input
                            id="checkbox-live-monitoring"
                            data-testid="checkbox-live-monitoring"
                            aria-label="Live Monitoring"
                            type="checkbox"
                            checked={isLiveMonitoring}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsLiveMonitoring(checked);
                              if (checked) {
                                setIsExportHovered(true);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-400 focus:ring-offset-zinc-900 cursor-pointer accent-amber-500"
                          />
                          <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
                            <Activity className={`w-3 h-3 ${isLiveMonitoring ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
                            <span>Live Monitoring</span>
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {isLiveMonitoring ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              Auto-updating (1s)
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-mono">1s interval</span>
                          )}
                        </div>
                      </div>

                      {/* Custom Mutation Threshold Setting */}
                      <div
                        id="control-mutation-threshold"
                        data-testid="control-mutation-threshold"
                        className="px-2.5 py-2 mb-2.5 rounded bg-zinc-950/80 border border-zinc-700/80 text-[11px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="input-mutation-threshold"
                            className="flex items-center gap-1.5 font-semibold text-zinc-200 cursor-pointer"
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>Mutation Threshold</span>
                          </label>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Alert if &gt; {mutationThreshold || 5}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              id="input-mutation-threshold"
                              data-testid="input-mutation-threshold"
                              aria-label="Mutation Threshold"
                              type="number"
                              min="0.5"
                              max="120"
                              step="0.5"
                              value={mutationThreshold || ''}
                              onFocus={() => setIsThresholdInputFocused(true)}
                              onBlur={() => setIsThresholdInputFocused(false)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  setMutationThreshold(val);
                                } else if (e.target.value === '') {
                                  setMutationThreshold(0);
                                }
                              }}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 focus:outline-none pr-8"
                              placeholder="5"
                            />
                            <span className="absolute right-2 top-1 text-[10px] text-zinc-400 font-mono pointer-events-none">
                              sec
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[2, 5, 10].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setMutationThreshold(preset)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer border ${
                                  mutationThreshold === preset
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700'
                                }`}
                                title={`Set threshold to ${preset}s`}
                              >
                                {preset}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px]">
                          <span className="text-zinc-400 truncate">
                            {thresholdAlert ? (
                              <span className="text-rose-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                Alert: {thresholdAlert.elapsedSeconds}s ({thresholdAlert.thresholdSeconds}s limit)
                              </span>
                            ) : (
                              <span>Notify if mutation exceeds duration</span>
                            )}
                          </span>
                          <button
                            id="btn-simulate-long-mutation"
                            data-testid="btn-simulate-long-mutation"
                            type="button"
                            disabled={isDatabaseMutatingState}
                            onClick={() => {
                              const targetDuration = Math.max(3000, ((mutationThreshold || 5) + 1) * 1000);
                              const release = beginDatabaseMutation(
                                'bulk_ingestion',
                                `Simulated Bulk Ingest (${(targetDuration / 1000).toFixed(0)}s)`,
                                100,
                                targetDuration
                              );
                              setTimeout(() => {
                                release();
                              }, targetDuration);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-1"
                            title="Simulate a long mutation to test notifications"
                          >
                            Simulate Long Op
                          </button>
                        </div>
                      </div>

                      {/* Threshold Exceeded Notification Alert Banner inside Tooltip */}
                      {thresholdAlert && (
                        <div
                          id="alert-mutation-threshold-exceeded"
                          data-testid="alert-mutation-threshold-exceeded"
                          role="alert"
                          aria-live="assertive"
                          className="flex items-start gap-2 p-2 mb-2.5 rounded bg-rose-950/80 border border-rose-500/80 text-[11px] text-rose-200 animate-in fade-in"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-rose-300 text-xs flex items-center gap-1">
                                <Bell className="w-3 h-3 text-rose-400" />
                                Mutation Threshold Exceeded!
                              </span>
                              <button
                                id="btn-dismiss-threshold-alert"
                                data-testid="btn-dismiss-threshold-alert"
                                onClick={() => setThresholdAlert(null)}
                                className="text-rose-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                                aria-label="Dismiss alert"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[10.5px] text-zinc-200 font-medium mt-0.5 truncate">
                              {thresholdAlert.mutationDescription}
                            </p>
                            <div className="flex items-center justify-between text-[9.5px] text-rose-300 mt-1">
                              <span>Exceeded threshold of {thresholdAlert.thresholdSeconds}s</span>
                              <span className="font-mono font-bold">{thresholdAlert.elapsedSeconds}s elapsed</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Format Performance & File Size Comparison Table based on filtered row count */}
                      <div
                        id="section-export-format-comparison"
                        data-testid="section-export-format-comparison"
                        className="p-2.5 mb-2.5 rounded bg-zinc-950/85 border border-zinc-700/80 text-[11px] space-y-2 shadow-inner"
                      >
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
                            <Table className="w-3.5 h-3.5 text-amber-400" />
                            <span>Format Performance &amp; Size Comparison</span>
                          </div>
                          <span
                            id="export-comparison-filtered-rows"
                            data-testid="export-comparison-filtered-rows"
                            className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold"
                            title={`Calculated dynamically for ${exportSizeEstimates.rowCount} filtered database records`}
                          >
                            {exportSizeEstimates.rowCount} filtered {exportSizeEstimates.rowCount === 1 ? 'row' : 'rows'}
                          </span>
                        </div>

                        <p className="text-[10px] text-zinc-400 leading-snug">
                          Estimated payload sizes and network compression based on currently filtered records to inform format selection:
                        </p>

                        {/* Comparison Table */}
                        <div className="overflow-x-auto -mx-0.5 px-0.5">
                          <table
                            id="table-export-performance-comparison"
                            data-testid="table-export-performance-comparison"
                            className="w-full text-left text-[10px] border-collapse"
                          >
                            <thead>
                              <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                                <th className="py-1 px-1.5 font-semibold">Format</th>
                                <th className="py-1 px-1.5 font-semibold text-right">Est. Size</th>
                                <th className="py-1 px-1.5 font-semibold text-right">Overhead / Savings</th>
                                <th className="py-1 px-1.5 font-semibold text-right">GZIP Est.</th>
                                <th className="py-1 px-1.5 font-semibold">Best Audience / Use Case</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono">
                              {/* CSV Row */}
                              <tr
                                id="row-export-comparison-csv"
                                data-testid="row-export-comparison-csv"
                                className={`transition-colors ${
                                  selectedExportFormat === 'csv'
                                    ? 'bg-emerald-950/40 text-zinc-100 font-medium'
                                    : 'hover:bg-zinc-900/60 text-zinc-300'
                                }`}
                              >
                                <td className="py-1.5 px-1.5 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="font-semibold text-zinc-200">CSV</span>
                                    <span className="text-[9px] text-zinc-500">RFC 4180</span>
                                    {selectedExportFormat === 'csv' && (
                                      <span
                                        id="badge-active-format-csv"
                                        data-testid="badge-active-format-csv"
                                        className="text-[8px] font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider"
                                      >
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  id="export-est-size-csv"
                                  data-testid="export-est-size-csv"
                                  className="py-1.5 px-1.5 text-right font-bold text-emerald-300 whitespace-nowrap"
                                >
                                  {exportSizeEstimates.csvBytesFormatted}
                                </td>
                                <td className="py-1.5 px-1.5 text-right text-emerald-400 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-0.5">
                                    <span>-{exportSizeEstimates.savingsPercent}%</span>
                                    <span className="text-[9px] text-zinc-400 font-sans">(compact)</span>
                                  </span>
                                </td>
                                <td className="py-1.5 px-1.5 text-right text-zinc-400 whitespace-nowrap">
                                  ~{exportSizeEstimates.csvGzipFormatted}
                                </td>
                                <td className="py-1.5 px-1.5 font-sans text-zinc-300 text-[9.5px]">
                                  Spreadsheets (Excel, Sheets), fast tabular analysis
                                </td>
                              </tr>

                              {/* JSON Row */}
                              <tr
                                id="row-export-comparison-json"
                                data-testid="row-export-comparison-json"
                                className={`transition-colors ${
                                  selectedExportFormat === 'json'
                                    ? 'bg-amber-950/40 text-zinc-100 font-medium'
                                    : 'hover:bg-zinc-900/60 text-zinc-300'
                                }`}
                              >
                                <td className="py-1.5 px-1.5 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="font-semibold text-zinc-200">JSON</span>
                                    <span className="text-[9px] text-zinc-500">RFC 8259</span>
                                    {selectedExportFormat === 'json' && (
                                      <span
                                        id="badge-active-format-json"
                                        data-testid="badge-active-format-json"
                                        className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider"
                                      >
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  id="export-est-size-json"
                                  data-testid="export-est-size-json"
                                  className="py-1.5 px-1.5 text-right font-bold text-amber-300 whitespace-nowrap"
                                >
                                  {exportSizeEstimates.jsonBytesFormatted}
                                </td>
                                <td className="py-1.5 px-1.5 text-right text-amber-400 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-0.5">
                                    <span>+{exportSizeEstimates.overheadPercent}%</span>
                                    <span className="text-[9px] text-zinc-400 font-sans">({exportSizeEstimates.overheadRatio}x)</span>
                                  </span>
                                </td>
                                <td className="py-1.5 px-1.5 text-right text-zinc-400 whitespace-nowrap">
                                  ~{exportSizeEstimates.jsonGzipFormatted}
                                </td>
                                <td className="py-1.5 px-1.5 font-sans text-zinc-300 text-[9.5px]">
                                  APIs, nested line items, object tree schemas
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Quick Format Switcher & Insight Footer */}
                        <div className="pt-1.5 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1 text-[9.5px] text-zinc-400">
                            <span className="font-semibold text-zinc-300">Quick Format:</span>
                            <button
                              id="btn-select-format-csv-tooltip"
                              data-testid="btn-select-format-csv-tooltip"
                              type="button"
                              onClick={() => setSelectedExportFormat('csv')}
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors cursor-pointer border ${
                                selectedExportFormat === 'csv'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              }`}
                              title="Switch primary export format to CSV"
                            >
                              Use CSV ({exportSizeEstimates.csvBytesFormatted})
                            </button>
                            <button
                              id="btn-select-format-json-tooltip"
                              data-testid="btn-select-format-json-tooltip"
                              type="button"
                              onClick={() => setSelectedExportFormat('json')}
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors cursor-pointer border ${
                                selectedExportFormat === 'json'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              }`}
                              title="Switch primary export format to JSON"
                            >
                              Use JSON ({exportSizeEstimates.jsonBytesFormatted})
                            </button>
                          </div>

                          <span className="text-[9.5px] text-zinc-400 font-mono">
                            ~{exportSizeEstimates.bytesPerRowCsv}B (CSV) vs ~{exportSizeEstimates.bytesPerRowJson}B (JSON)/row
                          </span>
                        </div>
                      </div>

                      {isDatabaseMutatingState ? (
                        <>
                          {/* Export Paused Header */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                              <Pause className="w-3.5 h-3.5 fill-amber-400 text-amber-400 animate-pulse" />
                              <span className="font-bold text-amber-300">Export Paused</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                id="badge-pending-mutations-count"
                                data-testid="badge-pending-mutations-count"
                                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/50 flex items-center gap-1"
                                title={`${pendingMutationsCount} active database mutation${pendingMutationsCount === 1 ? '' : 's'} pending completion`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                <span>{pendingMutationsCount} Pending</span>
                              </span>
                              <span
                                id="badge-serialization-deferred-pill"
                                data-testid="badge-serialization-deferred-pill"
                                className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700 flex items-center gap-1"
                              >
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                Lock
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 space-y-2.5">
                            {/* Explicit Data Consistency & Deferred Serialization Callout */}
                            <div
                              id="notice-export-paused-consistency"
                              data-testid="notice-export-paused-consistency"
                              className="bg-amber-950/60 rounded-md p-2.5 border border-amber-500/50"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs mb-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Serialization Deferred</span>
                              </div>
                              <p className="text-[11px] text-zinc-100 leading-snug font-medium">
                                Serialization is deferred to ensure data consistency.
                              </p>
                              <p className="text-[10px] text-zinc-300/90 mt-1 leading-relaxed">
                                {pendingMutationsCount > 1
                                  ? `${pendingMutationsCount} database mutations are currently mid-process. Export serialization is paused to prevent dirty reads and partial snapshot tearing.`
                                  : 'A database mutation is currently mid-process. Export serialization is paused to prevent dirty reads and partial snapshot tearing.'}{' '}
                                Serialization will automatically resume once in-flight transactions commit their WAL frames and B-Tree index updates.
                              </p>
                            </div>

                            {/* Active Pending Database Mutations & Estimation Telemetry */}
                            <div
                              id="section-pending-mutations-telemetry"
                              data-testid="section-pending-mutations-telemetry"
                              className="bg-zinc-800/90 rounded-md p-2.5 border border-amber-500/40 space-y-2 text-[11px]"
                            >
                              <div className="flex items-center justify-between text-zinc-300 font-medium">
                                <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
                                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                                  Active Pending Mutations:
                                </span>
                                <span
                                  id="active-pending-mutations-counter"
                                  data-testid="active-pending-mutations-counter"
                                  className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                >
                                  {pendingMutationsCount} active {pendingMutationsCount === 1 ? 'mutation' : 'mutations'}
                                </span>
                              </div>

                              {/* Estimated Wait Time for serialization to resume */}
                              <div className="flex items-center justify-between pt-1.5 border-t border-zinc-700/70 text-[11px]">
                                <span className="flex items-center gap-1 text-zinc-400 font-medium">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  Est. Wait to Resume Serialization:
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    id="export-estimated-wait-time"
                                    data-testid="export-estimated-wait-time"
                                    className="font-mono text-xs font-bold text-amber-300"
                                  >
                                    {estimatedWaitTimeText}
                                  </span>
                                  <button
                                    id="btn-copy-log-summary-inline"
                                    data-testid="btn-copy-log-summary-inline"
                                    aria-label="Copy Log Summary"
                                    type="button"
                                    onClick={handleCopyLogSummary}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/70 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-200 border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer"
                                    title="Copy pending mutation queue count and estimated wait time as Slack/Jira ticket summary"
                                  >
                                    {isCopiedSummary ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCheck className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy Log Summary</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Total Estimated Completion Progress Bar */}
                              <div
                                id="block-mutations-progress"
                                data-testid="block-mutations-progress"
                                className="pt-1.5 border-t border-zinc-700/70 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="flex items-center gap-1 text-zinc-400 font-medium">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    <span>Total Est. Completion:</span>
                                  </span>
                                  <span
                                    id="mutation-progress-percent-label"
                                    data-testid="mutation-progress-percent-label"
                                    className="font-mono text-xs font-bold text-amber-300"
                                  >
                                    {mutationProgressPercent}%
                                  </span>
                                </div>
                                <div
                                  id="progress-container-mutations"
                                  data-testid="progress-container-mutations"
                                  className="w-full bg-zinc-950/90 rounded-full h-1.5 overflow-hidden border border-zinc-700/70"
                                  title={`Total estimated completion: ${mutationProgressPercent}% across ${pendingMutationsCount} active pending database mutation${pendingMutationsCount === 1 ? '' : 's'}`}
                                >
                                  <div
                                    id="progress-bar-mutations"
                                    data-testid="progress-bar-mutations"
                                    role="progressbar"
                                    aria-valuenow={mutationProgressPercent}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    style={{ width: `${mutationProgressPercent}%` }}
                                    className="h-full rounded-full bg-linear-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300 ease-out shadow-xs shadow-amber-400/50"
                                  />
                                </div>
                              </div>

                              {/* In-Flight Mutations Queue List */}
                              <div className="pt-1.5 border-t border-zinc-700/70 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                  <span className="font-semibold text-zinc-300">Queue Breakdown ({pendingMutationsCount}):</span>
                                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                                    <span className="flex items-center gap-1 text-emerald-400 font-medium" title="Minor B-Tree overhead (in-place leaf update, 0 page splits)">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Minor
                                    </span>
                                    <span className="flex items-center gap-1 text-amber-400 font-medium" title="Moderate B-Tree overhead (localized page splits)">
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" /> Mod
                                    </span>
                                    <span className="flex items-center gap-1 text-rose-400 font-medium" title="Bulk B-Tree overhead (heavy node splits & tree rebalancing)">
                                      <AlertCircle className="w-2.5 h-2.5 text-rose-400" /> Bulk
                                    </span>
                                  </div>
                                </div>
                                <div
                                  id="active-pending-mutations-list"
                                  data-testid="active-pending-mutations-list"
                                  className="max-h-28 overflow-y-auto space-y-1 pr-0.5"
                                >
                                  {activeMutationsList.length > 0 ? (
                                    activeMutationsList.map((m, idx) => {
                                      const impact = getBTreeResourceImpact(m);
                                      return (
                                        <div
                                          key={m.id || idx}
                                          data-testid={`pending-mutation-item-${idx}`}
                                          className="flex items-center justify-between gap-1.5 text-[10px] px-2 py-1 rounded bg-zinc-900/80 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                                          title={`${m.description || `Transaction #${idx + 1}`} — ${impact.tooltipText}`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                              id={`icon-btree-impact-${idx}`}
                                              data-testid={`icon-btree-impact-${idx}`}
                                              data-impact-level={impact.level}
                                              className="shrink-0 flex items-center"
                                              title={impact.tooltipText}
                                            >
                                              {impact.level === 'bulk' ? (
                                                <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                                              ) : impact.level === 'moderate' ? (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                              ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                              )}
                                            </span>
                                            <span className="text-zinc-200 font-medium truncate">
                                              {m.description || `Transaction #${idx + 1}`}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span
                                              className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${impact.badgeBg} ${impact.badgeText} ${impact.badgeBorder}`}
                                              title={`Estimated B-Tree Impact: ${impact.label} (${impact.estimatedPageSplits})`}
                                            >
                                              {impact.badgeLabel}
                                            </span>
                                            <span className="font-mono text-[9px] text-zinc-400">
                                              {m.targetRows ? `${m.targetRows}r` : 'In-flight'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : activeInFlightMutation ? (
                                    (() => {
                                      const impact = getBTreeResourceImpact(activeInFlightMutation);
                                      return (
                                        <div
                                          data-testid="pending-mutation-item-active"
                                          className="flex items-center justify-between gap-1.5 text-[10px] px-2 py-1 rounded bg-zinc-900/80 border border-zinc-700/50"
                                          title={`${activeInFlightMutation.description} — ${impact.tooltipText}`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                              id="icon-btree-impact-active"
                                              data-testid="icon-btree-impact-active"
                                              data-impact-level={impact.level}
                                              className="shrink-0 flex items-center"
                                              title={impact.tooltipText}
                                            >
                                              {impact.level === 'bulk' ? (
                                                <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                                              ) : impact.level === 'moderate' ? (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                              ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                              )}
                                            </span>
                                            <span className="text-zinc-200 font-medium truncate">
                                              {activeInFlightMutation.description || 'Active transaction in progress'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span
                                              className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${impact.badgeBg} ${impact.badgeText} ${impact.badgeBorder}`}
                                              title={`Estimated B-Tree Impact: ${impact.label}`}
                                            >
                                              {impact.badgeLabel}
                                            </span>
                                            <span className="font-mono text-[9px] text-zinc-400">
                                              {activeInFlightMutation.targetRows ? `${activeInFlightMutation.targetRows}r` : 'In-flight'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="text-zinc-300 text-[10px] italic">
                                      Active transaction in progress
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-700/50 font-mono">
                                <span>Lock Scope: Heap Rows &amp; Indexes</span>
                                <span>Snapshot Isolation: Active</span>
                              </div>
                            </div>

                            {/* Last 3 Invalidation Triggers List */}
                            <div className="bg-zinc-800/60 rounded-md p-2 border border-zinc-700/60">
                              <div className="flex items-center justify-between mb-1.5 gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-200">
                                  <Layers className="w-3 h-3 text-amber-400" />
                                  Last 3 Invalidation Triggers
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {recurrentBulkCount >= 2 ? (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 uppercase tracking-wider flex items-center gap-1"
                                      title="Recurrent bulk operations are frequently clearing the cache"
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                      Recurrent Bulk ({recurrentBulkCount}/3)
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-medium text-zinc-400 font-mono">
                                      Prior Events
                                    </span>
                                  )}
                                  <button
                                    id="btn-copy-invalidation-logs"
                                    data-testid="btn-copy-invalidation-logs"
                                    type="button"
                                    onClick={handleCopyInvalidationLogs}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy Last 3 Invalidation Triggers formatted logs to clipboard"
                                  >
                                    {isCopiedLogs ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy Logs</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-copy-invalidation-json"
                                    data-testid="btn-copy-invalidation-json"
                                    type="button"
                                    onClick={handleCopyInvalidationJson}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy current invalidation trigger state as minified JSON string"
                                  >
                                    {isCopiedJson ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <FileCode className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy JSON</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-download-invalidation-logs-json"
                                    data-testid="btn-download-invalidation-logs-json"
                                    type="button"
                                    onClick={handleDownloadInvalidationLogsJson}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Download Last 3 Invalidation Triggers as JSON file"
                                  >
                                    {isDownloadedJson ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Saved!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Download JSON</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-export-all-logs"
                                    data-testid="btn-export-all-logs"
                                    data-id="btn-export-all-invalidation-logs-csv"
                                    aria-label="Export All Logs"
                                    type="button"
                                    onClick={handleExportAllInvalidationLogsCsv}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Export full list of invalidation trigger events as CSV (timestamps, reasons, bulk markers)"
                                  >
                                    {isExportedAllCsv ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Export All Logs (Done!)</span>
                                      </>
                                    ) : (
                                      <>
                                        <FileSpreadsheet className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Export All Logs</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-copy-log-summary"
                                    data-testid="btn-copy-log-summary"
                                    aria-label="Copy Log Summary"
                                    type="button"
                                    onClick={handleCopyLogSummary}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy current pending mutation queue count and estimated wait time as Slack/Jira summary"
                                  >
                                    {isCopiedSummary ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copy Log Summary (Copied!)</span>
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCheck className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy Log Summary</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                {last3Triggers.map((trigger) => (
                                  <div
                                    key={trigger.id}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-900/60 border border-zinc-700/50 text-[11px]"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            trigger.isBulk ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400'
                                          }`}
                                        />
                                        <span className="font-semibold text-zinc-200 truncate">
                                          {trigger.label}
                                        </span>
                                        {trigger.isBulk && (
                                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-medium">
                                            Bulk
                                          </span>
                                        )}
                                      </div>
                                      {trigger.details && (
                                        <div className="text-[10px] text-zinc-400 pl-3 truncate">
                                          {trigger.details}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 shrink-0 self-start mt-0.5">
                                      {formatTriggerTimeAgo(trigger.timestamp)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div
                                id="audit-invalidation-history-summary-mutating"
                                data-testid="audit-invalidation-history-summary-mutating"
                                className="mt-1.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 gap-2 flex-wrap"
                              >
                                <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  <span>Full Audit History: {invalidationHistory.length} trigger event{invalidationHistory.length === 1 ? '' : 's'} recorded</span>
                                </div>
                                <button
                                  id="btn-export-all-logs-audit-cta-mutating"
                                  data-testid="btn-export-all-logs-audit-cta"
                                  type="button"
                                  onClick={handleExportAllInvalidationLogsCsv}
                                  className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-amber-300 hover:text-amber-200 underline decoration-amber-500/50 hover:decoration-amber-400 transition-colors cursor-pointer"
                                  title="Export full audit CSV of cache invalidation triggers"
                                >
                                  <FileSpreadsheet className="w-2.5 h-2.5 text-amber-300" />
                                  <span>Export All Logs CSV ({invalidationHistory.length})</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-amber-300 pt-1 border-t border-zinc-800 font-medium">
                              <Clock className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                              <span>Awaiting transaction commit to resume clean serialization</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Cache Invalidated / Synchronized Ready State */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div className="flex items-center gap-1.5 font-semibold">
                              {isCacheInvalidatedPulsing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  <span className="text-amber-400">LRU Cache Invalidated</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-zinc-200">LRU Cache Synchronized</span>
                                </>
                              )}
                            </div>
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                                isCacheInvalidatedPulsing
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {isCacheInvalidatedPulsing ? 'Fresh Read Ready' : 'Cache Hot & Ready'}
                            </span>
                          </div>

                          <div className="mt-2.5 space-y-2.5">
                            {/* Explicit Last Cache Refresh listing */}
                            <div className="bg-zinc-800/90 rounded-md p-2 border border-zinc-700/80">
                              <div className="flex items-center justify-between text-[11px] text-zinc-300 mb-1">
                                <span className="flex items-center gap-1 text-zinc-400 font-medium">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  Last Cache Refresh:
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {cacheRefreshSecondsAgo} ago
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className="font-mono text-xs font-bold text-amber-300 tracking-tight">
                                  {formattedCacheRefreshTime}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {formattedCacheRefreshDate}
                                </span>
                              </div>
                            </div>

                            {/* Last 3 Invalidation Triggers List */}
                            <div className="bg-zinc-800/60 rounded-md p-2 border border-zinc-700/60">
                              <div className="flex items-center justify-between mb-1.5 gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-200">
                                  <Layers className="w-3 h-3 text-amber-400" />
                                  Last 3 Invalidation Triggers
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {recurrentBulkCount >= 2 ? (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 uppercase tracking-wider flex items-center gap-1"
                                      title="Recurrent bulk operations are frequently clearing the cache"
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                      Recurrent Bulk ({recurrentBulkCount}/3)
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-medium text-zinc-400 font-mono">
                                      Recent Events
                                    </span>
                                  )}
                                  <button
                                    id="btn-copy-invalidation-logs"
                                    data-testid="btn-copy-invalidation-logs"
                                    type="button"
                                    onClick={handleCopyInvalidationLogs}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy Last 3 Invalidation Triggers formatted logs to clipboard"
                                  >
                                    {isCopiedLogs ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy Logs</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-copy-invalidation-json"
                                    data-testid="btn-copy-invalidation-json"
                                    type="button"
                                    onClick={handleCopyInvalidationJson}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy current invalidation trigger state as minified JSON string"
                                  >
                                    {isCopiedJson ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <FileCode className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy JSON</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-download-invalidation-logs-json"
                                    data-testid="btn-download-invalidation-logs-json"
                                    type="button"
                                    onClick={handleDownloadInvalidationLogsJson}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Download Last 3 Invalidation Triggers as JSON file"
                                  >
                                    {isDownloadedJson ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Saved!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Download JSON</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-export-all-logs"
                                    data-testid="btn-export-all-logs"
                                    data-id="btn-export-all-invalidation-logs-csv"
                                    aria-label="Export All Logs"
                                    type="button"
                                    onClick={handleExportAllInvalidationLogsCsv}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Export full list of invalidation trigger events as CSV (timestamps, reasons, bulk markers)"
                                  >
                                    {isExportedAllCsv ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Export All Logs (Done!)</span>
                                      </>
                                    ) : (
                                      <>
                                        <FileSpreadsheet className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Export All Logs</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    id="btn-copy-log-summary"
                                    data-testid="btn-copy-log-summary"
                                    aria-label="Copy Log Summary"
                                    type="button"
                                    onClick={handleCopyLogSummary}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
                                    title="Copy current pending mutation queue count and estimated wait time as Slack/Jira summary"
                                  >
                                    {isCopiedSummary ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copy Log Summary (Copied!)</span>
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCheck className="w-2.5 h-2.5 text-amber-300" />
                                        <span>Copy Log Summary</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                {last3Triggers.map((trigger) => (
                                  <div
                                    key={trigger.id}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-900/60 border border-zinc-700/50 text-[11px]"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            trigger.isBulk ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400'
                                          }`}
                                        />
                                        <span className="font-semibold text-zinc-200 truncate">
                                          {trigger.label}
                                        </span>
                                        {trigger.isBulk && (
                                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-medium">
                                            Bulk
                                          </span>
                                        )}
                                      </div>
                                      {trigger.details && (
                                        <div className="text-[10px] text-zinc-400 pl-3 truncate">
                                          {trigger.details}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 shrink-0 self-start mt-0.5">
                                      {formatTriggerTimeAgo(trigger.timestamp)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {recurrentBulkCount >= 2 && (
                                <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] text-amber-300/90 leading-tight">
                                  Recurrent bulk writes are actively invalidating query memory; next export will execute a full table scan.
                                </div>
                              )}

                              <div
                                id="audit-invalidation-history-summary"
                                data-testid="audit-invalidation-history-summary"
                                className="mt-1.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 gap-2 flex-wrap"
                              >
                                <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Full Audit History: {invalidationHistory.length} trigger event{invalidationHistory.length === 1 ? '' : 's'} recorded</span>
                                </div>
                                <button
                                  id="btn-export-all-logs-audit-cta"
                                  data-testid="btn-export-all-logs-audit-cta"
                                  type="button"
                                  onClick={handleExportAllInvalidationLogsCsv}
                                  className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-amber-300 hover:text-amber-200 underline decoration-amber-500/50 hover:decoration-amber-400 transition-colors cursor-pointer"
                                  title="Export full audit CSV of cache invalidation triggers"
                                >
                                  <FileSpreadsheet className="w-2.5 h-2.5 text-amber-300" />
                                  <span>Export All Logs CSV ({invalidationHistory.length})</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1 border-t border-zinc-800 font-medium">
                              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>
                                {isCacheInvalidatedPulsing
                                  ? 'Next export will perform a live database read'
                                  : 'Zero-latency cached snapshot ready for immediate export'}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Active Threshold Alerts History Panel */}
                      <div
                        id="panel-active-threshold-alerts"
                        data-testid="panel-active-threshold-alerts"
                        className="mt-2.5 pt-2 border-t border-zinc-800/90 text-zinc-200"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Bell className="w-3 h-3 text-rose-400" />
                            <span className="font-semibold text-[11px] text-zinc-200 tracking-tight">
                              Active Threshold Alerts
                            </span>
                            <span
                              id="badge-threshold-alerts-count"
                              data-testid="badge-threshold-alerts-count"
                              className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            >
                              Last {Math.min(5, thresholdViolationsHistory.length)} ({thresholdViolationsHistory.length} logged)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-zinc-400 font-mono">
                              threshold: {mutationThreshold}s
                            </span>
                            <button
                              id="btn-toggle-pdf-export-settings"
                              data-testid="btn-toggle-pdf-export-settings"
                              aria-label="Export Settings"
                              aria-expanded={showPdfExportSettings}
                              type="button"
                              onClick={() => setShowPdfExportSettings((prev) => !prev)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer shadow-2xs ${
                                showPdfExportSettings
                                  ? 'bg-amber-950/80 text-amber-200 border border-amber-500/70 shadow-xs'
                                  : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 hover:text-white border border-zinc-700'
                              }`}
                              title="Customize sections to include in the generated PDF report"
                            >
                              <SlidersHorizontal className="w-2.5 h-2.5 text-amber-400" />
                              <span>Export Settings</span>
                              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showPdfExportSettings ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                              id="btn-preview-pdf-report"
                              data-testid="btn-preview-pdf-report"
                              aria-label="Preview PDF Report"
                              type="button"
                              onClick={() => setShowPdfPreviewModal(true)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/90 hover:bg-zinc-700/90 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-700 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs"
                              title="Preview live-rendered PDF document in modal before triggering download"
                            >
                              <Eye className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Preview</span>
                            </button>
                            <div className="relative inline-flex flex-col items-stretch">
                              <button
                                id="btn-generate-pdf-diagnostic-report"
                                data-testid="btn-generate-pdf-diagnostic-report"
                                aria-label="Generate PDF Report"
                                type="button"
                                onClick={handleGenerateDiagnosticCorrelationPdf}
                                disabled={isGeneratingDiagnosticPdf}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-200 border border-rose-600/70 hover:border-rose-400 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Generate Visual PDF Report of the diagnostic correlation report with sparklines for non-technical stakeholders"
                              >
                                {isDiagnosticPdfSuccess ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-emerald-300 font-semibold">PDF Generated!</span>
                                  </>
                                ) : isGeneratingDiagnosticPdf ? (
                                  <>
                                    <RefreshCw className="w-2.5 h-2.5 text-rose-300 animate-spin" />
                                    <span>Generating PDF...</span>
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-2.5 h-2.5 text-rose-300" />
                                    <span>Generate PDF Report</span>
                                  </>
                                )}
                              </button>
                              {isGeneratingDiagnosticPdf && (
                                <div
                                  id="progress-pdf-generating"
                                  data-testid="progress-pdf-generating"
                                  role="progressbar"
                                  aria-label="Generating PDF Report"
                                  className="w-full mt-1 h-1 bg-zinc-950/90 rounded-full overflow-hidden border border-rose-500/50 shadow-xs"
                                >
                                  <div className="h-full bg-linear-to-r from-rose-500 via-amber-400 to-rose-400 rounded-full animate-indeterminate" />
                                </div>
                              )}
                            </div>
                            <button
                              id="btn-diagnostic-correlation-report"
                              data-testid="btn-diagnostic-correlation-report"
                              aria-label="Generate Diagnostic Correlation Report"
                              type="button"
                              onClick={handleGenerateDiagnosticCorrelationReport}
                              disabled={isGeneratingDiagnosticReport}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900/80 active:bg-amber-800 text-amber-200 border border-amber-600/70 hover:border-amber-400 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                              title="Generate Diagnostic Correlation Report (JSON) mapping mutation clusters to latency spikes"
                            >
                              {isDiagnosticReportSuccess ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300 font-semibold">Report Generated!</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-2.5 h-2.5 text-amber-300" />
                                  <span>Diagnostic Correlation Report</span>
                                </>
                              )}
                            </button>
                            <button
                              id="btn-export-logs"
                              data-testid="btn-export-logs"
                              aria-label="Export Logs"
                              type="button"
                              onClick={handleExportThresholdAlertLogsCsv}
                              disabled={isExportingThresholdLogs}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800 text-emerald-200 border border-emerald-600/70 hover:border-emerald-400 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                              title="Export entire threshold alert history as a CSV file for long-term auditing"
                            >
                              {isExportThresholdLogsSuccess ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300 font-semibold">Logs Exported!</span>
                                </>
                              ) : (
                                <>
                                  <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-300" />
                                  <span>Export Logs</span>
                                  <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                    CSV
                                  </span>
                                </>
                              )}
                            </button>
                            <button
                              id="btn-clear-alert-history"
                              data-testid="btn-clear-alert-history"
                              aria-label="Clear Alert History"
                              type="button"
                              onClick={handleClearAlertHistory}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-rose-950/60 active:bg-rose-900/80 text-zinc-300 hover:text-rose-200 border border-zinc-700 hover:border-rose-600/70 text-[10px] font-medium transition-colors cursor-pointer shadow-2xs"
                              title="Clear all recorded threshold alerts and reset tracking state"
                            >
                              {isAlertHistoryCleared ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300 font-semibold">Cleared!</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>Clear Alert History</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* PDF Export Section Settings Accordion / Panel */}
                        {showPdfExportSettings && (
                          <div
                            id="panel-pdf-export-settings"
                            data-testid="panel-pdf-export-settings"
                            className="mb-2.5 p-2.5 rounded-md bg-zinc-900/95 border border-amber-500/40 shadow-sm text-zinc-200 space-y-2 animate-fadeIn"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                                <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                                <span>PDF Report Export Settings</span>
                              </div>
                              <span className="text-[9.5px] text-zinc-400">
                                Configure stakeholder layouts and section visibility for generated PDF reports
                              </span>
                            </div>

                            {/* Template Selector Dropdown & Stakeholder Configuration Controls */}
                            <div
                              id="panel-pdf-template-selector"
                              data-testid="panel-pdf-template-selector"
                              className="p-2 rounded bg-zinc-950/70 border border-zinc-800/90 flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                                  <label
                                    htmlFor="select-pdf-template"
                                    className="flex items-center gap-1.5 text-[10.5px] font-semibold text-zinc-200 shrink-0"
                                  >
                                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Template Selector:</span>
                                  </label>
                                  <div className="relative flex-1">
                                    <select
                                      id="select-pdf-template"
                                      data-testid="select-pdf-template"
                                      aria-label="Template Selector"
                                      value={currentMatchedTemplateId}
                                      onChange={(e) => handleSelectPdfTemplate(e.target.value)}
                                      className="w-full text-[11px] font-medium bg-zinc-900 border border-amber-500/50 hover:border-amber-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/40 rounded px-2.5 py-1 text-zinc-100 cursor-pointer shadow-xs transition-colors"
                                    >
                                      <optgroup label="Predefined Stakeholder Templates">
                                        {PREDEFINED_PDF_TEMPLATES.map((tmpl) => (
                                          <option key={tmpl.id} value={tmpl.id}>
                                            {tmpl.name} — {tmpl.audience}
                                          </option>
                                        ))}
                                      </optgroup>
                                      {savedCustomPdfTemplate && (
                                        <optgroup label="Saved Presets">
                                          <option value="saved-custom">
                                            ★ {savedCustomPdfTemplate.name}
                                          </option>
                                        </optgroup>
                                      )}
                                      {currentMatchedTemplateId === 'custom' && (
                                        <optgroup label="Current Configuration">
                                          <option value="custom">Custom Configuration (Modified)</option>
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>
                                </div>

                                {/* Save / Load Custom Template Action Buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    id="btn-save-pdf-template"
                                    data-testid="btn-save-pdf-template"
                                    aria-label="Save Custom Template"
                                    type="button"
                                    onClick={handleSaveCurrentAsCustomTemplate}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 border border-zinc-700 hover:border-amber-500/50 text-[10px] font-medium transition-colors cursor-pointer"
                                    title="Save current sections and page break settings as your custom preset in browser storage"
                                  >
                                    {isCustomTemplateSavedFeedback ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Preset Saved!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-2.5 h-2.5 text-amber-400" />
                                        <span>Save Preset</span>
                                      </>
                                    )}
                                  </button>

                                  {savedCustomPdfTemplate && (
                                    <button
                                      id="btn-load-pdf-template"
                                      data-testid="btn-load-pdf-template"
                                      aria-label="Load Custom Template"
                                      type="button"
                                      onClick={handleLoadCustomTemplate}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 text-[10px] font-medium transition-colors cursor-pointer"
                                      title="Load your saved custom section preset"
                                    >
                                      <FolderOpen className="w-2.5 h-2.5 text-blue-400" />
                                      <span>Load Saved</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Stakeholder Audience & Template Context Banner */}
                              <div className="flex items-start justify-between gap-2 px-2 py-1.5 rounded bg-zinc-900/90 border border-zinc-800/80 text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-zinc-200 flex items-center gap-1">
                                      <span>{activeTemplateMeta.name}</span>
                                    </span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5" />
                                      <span>Audience: {activeTemplateMeta.audience}</span>
                                    </span>
                                    {currentMatchedTemplateId === 'custom' && (
                                      <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        Modified Settings
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9.5px] text-zinc-400 leading-tight">
                                    {activeTemplateMeta.description}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                              {/* Trend Sparklines Section Card */}
                              <div className="flex flex-col justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
                                <label
                                  htmlFor="toggle-section-sparklines"
                                  className="flex items-start gap-2 cursor-pointer select-none"
                                >
                                  <input
                                    id="toggle-section-sparklines"
                                    data-testid="toggle-section-sparklines"
                                    type="checkbox"
                                    checked={pdfExportSections.includeSparklines}
                                    onChange={(e) =>
                                      setPdfExportSections((prev) => ({ ...prev, includeSparklines: e.target.checked }))
                                    }
                                    className="mt-0.5 accent-amber-500 rounded cursor-pointer"
                                  />
                                  <div className="flex flex-col text-[10.5px]">
                                    <span className="font-semibold text-zinc-200 flex items-center gap-1">
                                      <span>Trend Sparklines</span>
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">
                                        Visual Canvas
                                      </span>
                                    </span>
                                    <span className="text-[9.5px] text-zinc-400 leading-tight mt-0.5">
                                      Dual-panel latency response &amp; write mutation frequency charts with SLA limits
                                    </span>
                                  </div>
                                </label>
                                <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between">
                                  <label
                                    htmlFor="toggle-break-sparklines"
                                    className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                      !pdfExportSections.includeSparklines ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                    }`}
                                    title="Force this section to start on a new page"
                                  >
                                    <input
                                      id="toggle-break-sparklines"
                                      data-testid="toggle-break-sparklines"
                                      type="checkbox"
                                      disabled={!pdfExportSections.includeSparklines}
                                      checked={pdfExportSections.breakBeforeSparklines}
                                      onChange={(e) =>
                                        setPdfExportSections((prev) => ({ ...prev, breakBeforeSparklines: e.target.checked }))
                                      }
                                      className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                    />
                                    <span className="font-mono flex items-center gap-1">
                                      <span className={pdfExportSections.breakBeforeSparklines ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                        Force Page Break
                                      </span>
                                      <span className="text-zinc-500 text-[8.5px]">(Start on new page)</span>
                                    </span>
                                  </label>
                                  {pdfExportSections.breakBeforeSparklines && pdfExportSections.includeSparklines && (
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      New Page
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Detailed Mutation History Section Card */}
                              <div className="flex flex-col justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
                                <label
                                  htmlFor="toggle-section-mutation-history"
                                  className="flex items-start gap-2 cursor-pointer select-none"
                                >
                                  <input
                                    id="toggle-section-mutation-history"
                                    data-testid="toggle-section-mutation-history"
                                    type="checkbox"
                                    checked={pdfExportSections.includeMutationHistory}
                                    onChange={(e) =>
                                      setPdfExportSections((prev) => ({ ...prev, includeMutationHistory: e.target.checked }))
                                    }
                                    className="mt-0.5 accent-amber-500 rounded cursor-pointer"
                                  />
                                  <div className="flex flex-col text-[10.5px]">
                                    <span className="font-semibold text-zinc-200 flex items-center gap-1">
                                      <span>Detailed Mutation History</span>
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                        Data Tables
                                      </span>
                                    </span>
                                    <span className="text-[9.5px] text-zinc-400 leading-tight mt-0.5">
                                      Mutation clusters, lock holding times, and chronological root-cause chain of events
                                    </span>
                                  </div>
                                </label>
                                <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between">
                                  <label
                                    htmlFor="toggle-break-mutation-history"
                                    className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                      !pdfExportSections.includeMutationHistory ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                    }`}
                                    title="Force this section to start on a new page"
                                  >
                                    <input
                                      id="toggle-break-mutation-history"
                                      data-testid="toggle-break-mutation-history"
                                      type="checkbox"
                                      disabled={!pdfExportSections.includeMutationHistory}
                                      checked={pdfExportSections.breakBeforeMutationHistory}
                                      onChange={(e) =>
                                        setPdfExportSections((prev) => ({ ...prev, breakBeforeMutationHistory: e.target.checked }))
                                      }
                                      className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                    />
                                    <span className="font-mono flex items-center gap-1">
                                      <span className={pdfExportSections.breakBeforeMutationHistory ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                        Force Page Break
                                      </span>
                                      <span className="text-zinc-500 text-[8.5px]">(Start on new page)</span>
                                    </span>
                                  </label>
                                  {pdfExportSections.breakBeforeMutationHistory && pdfExportSections.includeMutationHistory && (
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      New Page
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Strategic Engineering Recommendations Card */}
                              <div className="flex flex-col justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
                                <label
                                  htmlFor="toggle-section-recommendations"
                                  className="flex items-start gap-2 cursor-pointer select-none"
                                >
                                  <input
                                    id="toggle-section-recommendations"
                                    data-testid="toggle-section-recommendations"
                                    type="checkbox"
                                    checked={pdfExportSections.includeRecommendations}
                                    onChange={(e) =>
                                      setPdfExportSections((prev) => ({ ...prev, includeRecommendations: e.target.checked }))
                                    }
                                    className="mt-0.5 accent-amber-500 rounded cursor-pointer"
                                  />
                                  <div className="flex flex-col text-[10.5px]">
                                    <span className="font-semibold text-zinc-200 flex items-center gap-1">
                                      <span>Strategic Recommendations</span>
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                        Action Plan
                                      </span>
                                    </span>
                                    <span className="text-[9.5px] text-zinc-400 leading-tight mt-0.5">
                                      Prioritized engineering remediation guidance (micro-batching, indexing, caching)
                                    </span>
                                  </div>
                                </label>
                                <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between">
                                  <label
                                    htmlFor="toggle-break-recommendations"
                                    className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                      !pdfExportSections.includeRecommendations ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                    }`}
                                    title="Force this section to start on a new page"
                                  >
                                    <input
                                      id="toggle-break-recommendations"
                                      data-testid="toggle-break-recommendations"
                                      type="checkbox"
                                      disabled={!pdfExportSections.includeRecommendations}
                                      checked={pdfExportSections.breakBeforeRecommendations}
                                      onChange={(e) =>
                                        setPdfExportSections((prev) => ({ ...prev, breakBeforeRecommendations: e.target.checked }))
                                      }
                                      className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                    />
                                    <span className="font-mono flex items-center gap-1">
                                      <span className={pdfExportSections.breakBeforeRecommendations ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                        Force Page Break
                                      </span>
                                      <span className="text-zinc-500 text-[8.5px]">(Start on new page)</span>
                                    </span>
                                  </label>
                                  {pdfExportSections.breakBeforeRecommendations && pdfExportSections.includeRecommendations && (
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      New Page
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Executive Summary Takeaways Card */}
                              <div className="flex flex-col justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
                                <label
                                  htmlFor="toggle-section-executive-summary"
                                  className="flex items-start gap-2 cursor-pointer select-none"
                                >
                                  <input
                                    id="toggle-section-executive-summary"
                                    data-testid="toggle-section-executive-summary"
                                    type="checkbox"
                                    checked={pdfExportSections.includeExecutiveSummary}
                                    onChange={(e) =>
                                      setPdfExportSections((prev) => ({ ...prev, includeExecutiveSummary: e.target.checked }))
                                    }
                                    className="mt-0.5 accent-amber-500 rounded cursor-pointer"
                                  />
                                  <div className="flex flex-col text-[10.5px]">
                                    <span className="font-semibold text-zinc-200 flex items-center gap-1">
                                      <span>Executive Narrative Callout</span>
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                                        Briefing
                                      </span>
                                    </span>
                                    <span className="text-[9.5px] text-zinc-400 leading-tight mt-0.5">
                                      Non-technical explanation of table mutex locks and latency degradation causality
                                    </span>
                                  </div>
                                </label>
                                <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between">
                                  <label
                                    htmlFor="toggle-break-executive-summary"
                                    className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                      !pdfExportSections.includeExecutiveSummary ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                    }`}
                                    title="Force this section to start on a new page"
                                  >
                                    <input
                                      id="toggle-break-executive-summary"
                                      data-testid="toggle-break-executive-summary"
                                      type="checkbox"
                                      disabled={!pdfExportSections.includeExecutiveSummary}
                                      checked={pdfExportSections.breakBeforeExecutiveSummary}
                                      onChange={(e) =>
                                        setPdfExportSections((prev) => ({ ...prev, breakBeforeExecutiveSummary: e.target.checked }))
                                      }
                                      className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                    />
                                    <span className="font-mono flex items-center gap-1">
                                      <span className={pdfExportSections.breakBeforeExecutiveSummary ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                        Force Page Break
                                      </span>
                                      <span className="text-zinc-500 text-[8.5px]">(Start on new page)</span>
                                    </span>
                                  </label>
                                  {pdfExportSections.breakBeforeExecutiveSummary && pdfExportSections.includeExecutiveSummary && (
                                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      New Page
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Presets and Done control */}
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px] flex-wrap gap-1">
                              <div className="flex items-center gap-1 text-zinc-400 flex-wrap">
                                <span className="font-mono text-[9.5px]">Templates:</span>
                                <button
                                  id="btn-preset-executive-summary"
                                  data-testid="btn-preset-executive-summary"
                                  type="button"
                                  onClick={() => handleSelectPdfTemplate('executive-summary')}
                                  className={`px-1.5 py-0.2 rounded transition-colors cursor-pointer ${
                                    currentMatchedTemplateId === 'executive-summary'
                                      ? 'bg-purple-900/60 text-purple-200 border border-purple-500/50 font-semibold'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                                  }`}
                                  title="Leadership & Executive briefing layout"
                                >
                                  Executive Summary
                                </button>
                                <button
                                  id="btn-preset-structured-multi-page"
                                  data-testid="btn-preset-structured-multi-page"
                                  type="button"
                                  onClick={() => handleSelectPdfTemplate('full-technical-audit')}
                                  className={`px-1.5 py-0.2 rounded transition-colors cursor-pointer ${
                                    currentMatchedTemplateId === 'full-technical-audit'
                                      ? 'bg-amber-900/60 text-amber-200 border border-amber-500/50 font-semibold'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200'
                                  }`}
                                  title="Full multi-page technical audit with page breaks"
                                >
                                  Full Technical Audit
                                </button>
                                <button
                                  id="btn-preset-troubleshooting-focused"
                                  data-testid="btn-preset-troubleshooting-focused"
                                  type="button"
                                  onClick={() => handleSelectPdfTemplate('troubleshooting-focused')}
                                  className={`px-1.5 py-0.2 rounded transition-colors cursor-pointer ${
                                    currentMatchedTemplateId === 'troubleshooting-focused'
                                      ? 'bg-blue-900/60 text-blue-200 border border-blue-500/50 font-semibold'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-blue-100'
                                  }`}
                                  title="Root cause & on-call triage focus"
                                >
                                  Troubleshooting Focused
                                </button>
                                <button
                                  id="btn-preset-visual-summary"
                                  data-testid="btn-preset-visual-summary"
                                  type="button"
                                  onClick={() => handleSelectPdfTemplate('visual-standup')}
                                  className={`px-1.5 py-0.2 rounded transition-colors cursor-pointer ${
                                    currentMatchedTemplateId === 'visual-standup'
                                      ? 'bg-rose-900/60 text-rose-200 border border-rose-500/50 font-semibold'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                                  }`}
                                  title="Visual standup overview with dual-panel charts"
                                >
                                  Visual Standup
                                </button>
                                <button
                                  id="btn-preset-detailed-data"
                                  data-testid="btn-preset-detailed-data"
                                  type="button"
                                  onClick={() => handleSelectPdfTemplate('data-compliance-audit')}
                                  className={`px-1.5 py-0.2 rounded transition-colors cursor-pointer ${
                                    currentMatchedTemplateId === 'data-compliance-audit'
                                      ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/50 font-semibold'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300 hover:text-emerald-100'
                                  }`}
                                  title="Compliance & deep mutation audit tables"
                                >
                                  Compliance Logs
                                </button>
                              </div>

                              <button
                                id="btn-close-pdf-export-settings"
                                data-testid="btn-close-pdf-export-settings"
                                type="button"
                                onClick={() => setShowPdfExportSettings(false)}
                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer font-medium"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}

                        {/* PDF Generation Error Toast / Alert with Retry Action */}
                        {diagnosticPdfError && (
                          <div
                            id="alert-pdf-generation-error"
                            data-testid="alert-pdf-generation-error"
                            role="alert"
                            aria-live="assertive"
                            className="mb-2 p-2 rounded bg-rose-950/80 border border-rose-600/80 text-rose-200 text-[11px] flex items-center justify-between gap-2 shadow-md animate-fadeIn"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-rose-100">PDF Generation Failed:</span>{' '}
                                <span className="text-rose-200 text-[10.5px] truncate inline-block max-w-[280px] sm:max-w-md align-bottom">
                                  {diagnosticPdfError}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                id="btn-retry-generate-pdf"
                                data-testid="btn-retry-generate-pdf"
                                aria-label="Retry PDF Generation"
                                type="button"
                                onClick={handleGenerateDiagnosticCorrelationPdf}
                                disabled={isGeneratingDiagnosticPdf}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-[10px] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                <RefreshCw className={`w-2.5 h-2.5 ${isGeneratingDiagnosticPdf ? 'animate-spin' : ''}`} />
                                <span>Retry</span>
                              </button>
                              <button
                                id="btn-dismiss-pdf-error"
                                data-testid="btn-dismiss-pdf-error"
                                aria-label="Dismiss error"
                                type="button"
                                onClick={() => setDiagnosticPdfError(null)}
                                className="p-0.5 rounded text-rose-300 hover:text-white hover:bg-rose-900/60 transition-colors cursor-pointer"
                                title="Dismiss notification"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {thresholdViolationsHistory.length === 0 ? (
                          <div className="text-[10.5px] text-zinc-400 italic p-2 rounded bg-zinc-950/40 border border-zinc-800/80 text-center">
                            No threshold violations recorded yet.
                          </div>
                        ) : (
                          <div
                            id="list-active-threshold-alerts"
                            data-testid="list-active-threshold-alerts"
                            className="space-y-1.5"
                          >
                            {thresholdViolationsHistory.slice(0, 5).map((item, idx) => {
                              const isCopied = copiedAlertItemId === item.id;
                              return (
                                <div
                                  key={item.id}
                                  id={`alert-history-item-${idx}`}
                                  data-testid={`alert-history-item-${idx}`}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700/80 text-[11px] transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                      <span
                                        className="font-medium text-zinc-200 truncate"
                                        title={item.mutationDescription}
                                      >
                                        {item.mutationDescription}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 pl-3 mt-0.5 font-mono">
                                      <span className="text-rose-300 font-semibold">
                                        {item.elapsedSeconds}s ({item.thresholdSeconds}s limit)
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {new Date(item.timestamp).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    id={`btn-copy-alert-item-${idx}`}
                                    data-testid={`btn-copy-alert-item-${idx}`}
                                    aria-label="Copy to Clipboard"
                                    title="Copy to Clipboard"
                                    type="button"
                                    onClick={() => handleCopyAlertItem(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-700 text-[10px] font-medium transition-colors cursor-pointer shrink-0"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-amber-300" />
                                        <span>Copy to Clipboard</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Diagnostic Correlation Report Footer Action */}
                        <div
                          id="footer-diagnostic-correlation-report"
                          data-testid="footer-diagnostic-correlation-report"
                          className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 min-w-0">
                            <Activity className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">Timestamp mapping &amp; cluster impact</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              id="btn-footer-preview-pdf-report"
                              data-testid="btn-footer-preview-pdf-report"
                              aria-label="Preview PDF Report"
                              type="button"
                              onClick={() => setShowPdfPreviewModal(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/90 hover:bg-zinc-700/90 active:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-700 text-[10px] font-medium transition-colors cursor-pointer shrink-0"
                              title="Preview live-rendered PDF document in modal before triggering download"
                            >
                              <Eye className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Preview</span>
                            </button>
                            <div className="relative inline-flex flex-col items-stretch">
                              <button
                                id="btn-footer-generate-pdf-report"
                                data-testid="btn-footer-generate-pdf-report"
                                aria-label="Generate PDF Report"
                                type="button"
                                onClick={handleGenerateDiagnosticCorrelationPdf}
                                disabled={isGeneratingDiagnosticPdf}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900/90 active:bg-rose-800 text-rose-200 hover:text-white border border-rose-600/70 hover:border-rose-400 text-[10px] font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                title="Generate Visual PDF Summary Report with sparklines for latency vs mutation frequency for non-technical stakeholders"
                              >
                                {isDiagnosticPdfSuccess ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-emerald-300">PDF Generated!</span>
                                  </>
                                ) : isGeneratingDiagnosticPdf ? (
                                  <>
                                    <RefreshCw className="w-2.5 h-2.5 text-rose-300 animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-2.5 h-2.5 text-rose-300" />
                                    <span>Generate PDF Report</span>
                                  </>
                                )}
                              </button>
                              {isGeneratingDiagnosticPdf && (
                                <div
                                  id="progress-footer-pdf-generating"
                                  data-testid="progress-footer-pdf-generating"
                                  role="progressbar"
                                  aria-label="Generating PDF Report"
                                  className="w-full mt-1 h-1 bg-zinc-950/90 rounded-full overflow-hidden border border-rose-500/50 shadow-xs"
                                >
                                  <div className="h-full bg-linear-to-r from-rose-500 via-amber-400 to-rose-400 rounded-full animate-indeterminate" />
                                </div>
                              )}
                            </div>
                            <button
                              id="btn-footer-diagnostic-correlation-report"
                              data-testid="btn-footer-diagnostic-correlation-report"
                              aria-label="Generate Diagnostic Correlation Report"
                              type="button"
                              onClick={handleGenerateDiagnosticCorrelationReport}
                              disabled={isGeneratingDiagnosticReport}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-amber-300 hover:text-amber-200 border border-zinc-700 hover:border-amber-500/60 text-[10px] font-semibold transition-colors cursor-pointer shrink-0"
                              title="Export Diagnostic Correlation Report JSON summarizing how mutation clusters influenced recent latency spikes by mapping event timestamps"
                            >
                              <Download className="w-2.5 h-2.5 text-amber-400" />
                              <span>Diagnostic Correlation Report</span>
                            </button>
                            <button
                              id="btn-footer-export-logs"
                              data-testid="btn-footer-export-logs"
                              aria-label="Export Logs"
                              type="button"
                              onClick={handleExportThresholdAlertLogsCsv}
                              disabled={isExportingThresholdLogs}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-emerald-300 hover:text-emerald-200 border border-zinc-700 hover:border-emerald-500/60 text-[10px] font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                              title="Export entire threshold alert history as a CSV file for long-term auditing"
                            >
                              {isExportThresholdLogsSuccess ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300">Logs Exported!</span>
                                </>
                              ) : (
                                <>
                                  <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Export Logs</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Tooltip downward pointing caret */}
                      <div className={`absolute top-full left-8 -mt-1 w-2.5 h-2.5 bg-zinc-900 border-r border-b ${
                        isDatabaseMutatingState ? 'border-amber-400/90' : 'border-amber-500/60'
                      } rotate-45`} />
                    </div>

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
                      className="absolute right-0 top-full mt-1 w-84 sm:w-88 bg-white border border-zinc-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden animate-fade-in divide-y divide-zinc-100 max-h-[88vh] overflow-y-auto"
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
                              <div className="flex items-center gap-1">
                                <kbd className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {selectedExportFormat === 'csv' ? shortcutKeyLabel : altShortcutKeyLabel}
                                </kbd>
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  RFC 4180
                                </span>
                              </div>
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
                              <div className="flex items-center gap-1">
                                <kbd className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {selectedExportFormat === 'json' ? shortcutKeyLabel : altShortcutKeyLabel}
                                </kbd>
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                  RFC 8259
                                </span>
                              </div>
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

                      {/* Section: CSV Header Configuration with 'Include Column Headers' Checkbox */}
                      <div
                        id="csv-header-toggle-section"
                        className="p-2.5 bg-zinc-50/90 border-t border-zinc-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                            CSV Export Options
                          </span>
                          <span
                            id="csv-header-toggle-status-badge"
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                              includeCsvHeaders
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-zinc-200 text-zinc-700 border-zinc-300'
                            }`}
                          >
                            {includeCsvHeaders ? 'HEADERS: ON' : 'HEADERS: OFF'}
                          </span>
                        </div>

                        <label
                          id="label-include-column-headers"
                          htmlFor="checkbox-include-column-headers"
                          title="Include Column Headers"
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all cursor-pointer shadow-2xs group select-none"
                        >
                          <input
                            id="checkbox-include-column-headers"
                            name="includeColumnHeaders"
                            type="checkbox"
                            checked={includeCsvHeaders}
                            onChange={(e) => {
                              e.stopPropagation();
                              setIncludeCsvHeaders(e.target.checked);
                            }}
                            className="w-4 h-4 mt-0.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer shrink-0"
                            title="Include Column Headers"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-zinc-900 group-hover:text-emerald-950 transition-colors">
                                Include Column Headers
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                              {includeCsvHeaders
                                ? 'Includes RFC 4180 column header row with order, customer, amount, and item fields.'
                                : 'Excludes header row from CSV output, streaming raw transaction data rows directly.'}
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Power-User Keyboard Shortcut Helper Callout */}
                      <div className="px-3 py-2 bg-indigo-50/70 border-t border-indigo-100/80 flex items-center justify-between text-[11px] text-indigo-950">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Keyboard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Power-User Shortcut:</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <kbd className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 shadow-3xs font-bold text-indigo-900">
                            {shortcutKeyLabel}
                          </kbd>
                          <span className="text-zinc-500 font-sans">Quick Export</span>
                        </div>
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

                      {/* Concurrency & Data Consistency Simulation Action */}
                      <div className="p-2.5 bg-amber-50/70 border-t border-amber-100/90 flex items-center justify-between gap-2 text-xs text-amber-950">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                            <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Simulate Mid-Process Mutation</span>
                          </div>
                          <p className="text-[10px] text-amber-800/80 leading-tight mt-0.5">
                            Locks mutations for 3s to inspect deferred serialization consistency.
                          </p>
                        </div>
                        <button
                          id="btn-simulate-mutation-lock"
                          type="button"
                          disabled={isDatabaseMutatingState}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulateMidProcessMutation();
                          }}
                          className="px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 active:bg-amber-400 text-amber-950 text-[10px] font-bold border border-amber-400/80 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDatabaseMutatingState ? 'Mid-Process...' : 'Lock DB'}
                        </button>
                      </div>

                      {/* Serialization Time Saved Summary Stat & 10-Op Micro Chart */}
                      <ExportSavingsSummaryChart
                        history={exportHistory}
                        selectedFormat={selectedExportFormat}
                      />
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
            dataTapeEntries={dataTapeEntries}
            exportHistory={exportHistory}
            onTriggerAuditBurst={() => handleHeaderExport(selectedExportFormat)}
            serializationLogs={serializationLogs}
            onLogLatencyAnomaly={handleLogLatencyAnomaly}
            onClearSerializationLogs={handleClearSerializationLogs}
            onDismissSerializationLog={handleDismissLog}
            onSimulateFault={handleSimulateFault}
            thresholdViolations={thresholdViolationsHistory}
            mutationThreshold={mutationThreshold}
            mutationHistory={mutationHistory}
          />
        ) : (
          /* Main Data Grid & Diagnostics View */
          <>
            {/* Interactive Architectural Controls */}
            <OptimizationControls flags={flags} onToggleFlag={handleToggleFlag} />

            {/* Serialization Errors & Throughput Anomalies Log Panel */}
            <SerializationErrorLogPanel
              logs={serializationLogs}
              onClearLogs={handleClearSerializationLogs}
              onDismissLog={handleDismissLog}
              onSimulateFault={handleSimulateFault}
              currentFormat={selectedExportFormat}
              currentRecordCount={queryResult.records.length}
            />

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
              selectedExportFormat={selectedExportFormat}
              onExportFormatChange={setSelectedExportFormat}
              onTriggerExport={handleHeaderExport}
              isExportingProp={isHeaderExporting}
              shortcutKeyLabel={shortcutKeyLabel}
              isShortcutFlashing={isShortcutFlashing}
              includeCsvHeaders={includeCsvHeaders}
              onIncludeCsvHeadersChange={setIncludeCsvHeaders}
              onDeleteRecords={handleDeleteRecords}
              cacheHit={queryResult.cacheHit}
              onExportComplete={(stats) => {
                setHeaderExportStats(stats);
                recordExportOperation(stats, selectedExportFormat);
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
        isAutoSaveEnabled={isQueueAutoSaveEnabled}
        onToggleAutoSave={() => setIsQueueAutoSaveEnabled(!isQueueAutoSaveEnabled)}
        onTriggerManualSlice={handleTriggerManualTapeSlice}
        onMutateDatabase={handleMutateDatabase}
        onClearTape={() => setDataTapeEntries([])}
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

      {/* Floating Keyboard Shortcut Trigger Notification Toast */}
      {shortcutToast && (
        <div
          id="keyboard-shortcut-export-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-50 max-w-sm w-full bg-zinc-900 border border-emerald-500/60 text-white rounded-xl p-3 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Keyboard className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-emerald-300">
                  {shortcutToast.key}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/50">
                  Keyboard Shortcut
                </span>
              </div>
              <p className="text-xs text-zinc-200 truncate mt-0.5">
                {shortcutToast.isEmpty
                  ? 'No matching filtered records to export'
                  : `Exported ${shortcutToast.rows.toLocaleString()} rows as ${
                      shortcutToast.format === 'json' ? 'Structured JSON' : 'Standard CSV'
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShortcutToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              aria-label="Dismiss shortcut notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Export Paused (Mid-Process Mutation) Notification Toast */}
      {exportPausedToast && (
        <div
          id="toast-export-paused-notice"
          data-testid="toast-export-paused-notice"
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-50 max-w-md w-full bg-zinc-900 border border-amber-500/80 text-white rounded-xl p-3.5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
              <Pause className="w-4 h-4 fill-amber-400 text-amber-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-amber-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Export Paused — Consistency Lock
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider font-bold">
                  Deferred
                </span>
              </div>
              <p className="text-xs text-zinc-100 font-medium mt-1 leading-snug">
                Serialization is deferred to ensure data consistency.
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                A database mutation is currently mid-process. Serialization will automatically unlock when heap writes and indexes commit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExportPausedToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss export paused notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Mutation Threshold Exceeded Alert Toast */}
      {thresholdAlert && (
        <div
          id="toast-mutation-threshold-alert"
          data-testid="toast-mutation-threshold-alert"
          role="alert"
          aria-live="assertive"
          className="fixed top-5 right-5 z-50 max-w-md w-full bg-zinc-900 border-2 border-rose-500/90 text-white rounded-xl p-3.5 shadow-2xl animate-in slide-in-from-top-4 fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-rose-300 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-rose-400" />
                  Mutation Threshold Exceeded
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider font-bold">
                  &gt; {thresholdAlert.thresholdSeconds}s
                </span>
              </div>
              <p className="text-xs text-zinc-100 font-medium mt-1 leading-snug">
                {thresholdAlert.mutationDescription}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                Duration: <span className="font-mono text-rose-300 font-bold">{thresholdAlert.elapsedSeconds}s</span> (Custom threshold: {thresholdAlert.thresholdSeconds}s).
              </p>
            </div>
            <button
              id="btn-dismiss-toast-threshold-alert"
              data-testid="btn-dismiss-toast-threshold-alert"
              type="button"
              onClick={() => setThresholdAlert(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss mutation threshold alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* Live PDF Report Preview Modal */}
      <DiagnosticPdfPreviewModal
        isOpen={showPdfPreviewModal}
        onClose={() => setShowPdfPreviewModal(false)}
        onDownload={handleGenerateDiagnosticCorrelationPdf}
        isDownloading={isGeneratingDiagnosticPdf}
        isDownloadSuccess={isDiagnosticPdfSuccess}
        thresholdViolations={thresholdViolationsHistory}
        mutationHistory={mutationHistory}
        trendHistory={trendHistory}
        mutationThreshold={mutationThreshold}
        currentFlags={flags}
        sectionsConfig={pdfExportSections}
        onUpdateSections={setPdfExportSections}
      />
    </div>
  );
}
