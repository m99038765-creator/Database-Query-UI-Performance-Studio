import React, { useState, useMemo, useEffect } from 'react';
import {
  SerializationLogEntry,
  SerializationLogSeverity,
  SerializationAnomalyType,
  SerializationLogFormat,
  OptimizationLifecycleEvent,
  LifecycleActionType,
  LifecycleTriggerSource,
  TransactionRecord
} from '../types';
import { ExportFormat } from '../utils/csvExporter';
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  TrendingDown,
  Cpu,
  Zap,
  Trash2,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Database,
  X,
  Layers,
  HeartPulse,
  Plus,
  GitMerge,
  Check,
  Terminal,
  ArrowRight,
  Download,
  Flame
} from 'lucide-react';

interface SerializationErrorLogPanelProps {
  logs?: SerializationLogEntry[];
  onClearLogs?: () => void;
  onDismissLog?: (id: string) => void;
  onSimulateFault?: (mode?: 'failure' | 'throughput_anomaly' | 'cpu_spike' | 'latency_anomaly') => void;
  currentFormat?: ExportFormat;
  currentRecordCount?: number;
  lifecycleEvents?: OptimizationLifecycleEvent[];
  onClearLifecycleEvents?: () => void;
  alertThresholdMs?: number;
  records?: TransactionRecord[];
  flags?: {
    batchEagerLoading?: boolean;
    btreeIndexing?: boolean;
    [key: string]: any;
  };
}

const LIFECYCLE_STORAGE_KEY = 'perf_optimization_lifecycle_events_v1';

const DEFAULT_LIFECYCLE_EVENTS: OptimizationLifecycleEvent[] = [
  {
    id: 'opt-heal-01',
    timestamp: Date.now() - 1000 * 60 * 4,
    timeFormatted: '4 mins ago',
    action: 'HEAL',
    actionLabel: 'Auto-Healing Concurrent Reindex',
    triggerSource: 'Auto-Healing',
    targetIndex: 'idx_line_items_tx',
    targetTable: 'line_items',
    columns: ['transaction_id'],
    rationale: 'Auto-Healing detected 48% B-Tree leaf node bloat; index health fell to 42/100 (<50% threshold). Automatically rebuilt tree balance concurrently without table write locks.',
    executedDdl: 'REINDEX INDEX CONCURRENTLY idx_line_items_tx;',
    executionDurationMs: 18.4,
    healthDelta: { before: 42, after: 98, gain: 56 },
    latencyImpact: { beforeMs: '45.2 ms', afterMs: '3.2 ms', speedup: '92.9% faster' },
    writeOverheadDelta: 'Zero write lock interruption (Concurrent mode)',
    status: 'COMPLETED'
  },
  {
    id: 'opt-merge-02',
    timestamp: Date.now() - 1000 * 60 * 12,
    timeFormatted: '12 mins ago',
    action: 'MERGE',
    actionLabel: 'Multi-Column Index Consolidation',
    triggerSource: 'Consolidation',
    targetIndex: 'idx_orders_status_cat',
    targetTable: 'transactions',
    columns: ['status', 'category'],
    rationale: 'Consolidation Analyzer merged overlapping single-column indexes "idx_orders_status" and "idx_orders_cat" into a unified composite B-Tree, preventing duplicate leaf maintenance and saving 22% write overhead.',
    executedDdl: 'CREATE INDEX CONCURRENTLY idx_orders_status_cat ON transactions (status, category);\nDROP INDEX CONCURRENTLY idx_orders_status;\nDROP INDEX CONCURRENTLY idx_orders_cat;',
    executionDurationMs: 34.6,
    healthDelta: { before: 58, after: 95, gain: 37 },
    latencyImpact: { beforeMs: '310 ms', afterMs: '1.4 ms', speedup: '99.5% faster' },
    writeOverheadDelta: '-22.4% WAL write log reduction',
    status: 'COMPLETED'
  },
  {
    id: 'opt-create-03',
    timestamp: Date.now() - 1000 * 60 * 25,
    timeFormatted: '25 mins ago',
    action: 'CREATE',
    actionLabel: 'Autonomous Index Creation',
    triggerSource: 'Consolidation',
    targetIndex: 'idx_transactions_email_status',
    targetTable: 'transactions',
    columns: ['customer_email', 'status'],
    rationale: 'Auto-Healing and Workload Analyzer identified high-frequency query Q2 suffering 395ms sequential scans. Automatically synthesized composite B-Tree covering customer email and order status.',
    executedDdl: 'CREATE INDEX CONCURRENTLY idx_transactions_email_status ON transactions (customer_email, status);',
    executionDurationMs: 42.1,
    healthDelta: { before: 20, after: 97, gain: 77 },
    latencyImpact: { beforeMs: '395 ms', afterMs: '1.6 ms', speedup: '99.6% faster' },
    writeOverheadDelta: '+4.5% controlled insertion cost',
    status: 'COMPLETED'
  },
  {
    id: 'opt-delete-04',
    timestamp: Date.now() - 1000 * 60 * 45,
    timeFormatted: '45 mins ago',
    action: 'DELETE',
    actionLabel: 'Redundant Index Auto-Prune',
    triggerSource: 'Auto-Healing',
    targetIndex: 'idx_transactions_date',
    targetTable: 'transactions',
    columns: ['created_at'],
    rationale: 'Auto-Healing engine pruned unused index "idx_transactions_date" (0 seek hits in 24 hours, 14% WAL write lock latency penalty) to eliminate write amplification and save 4.2 MB memory.',
    executedDdl: 'DROP INDEX CONCURRENTLY idx_transactions_date;',
    executionDurationMs: 8.2,
    healthDelta: { before: 18, after: 92, gain: 74 },
    latencyImpact: { beforeMs: '140 ms write lock stall', afterMs: '0.0 ms write lock stall', speedup: '14% write latency saved' },
    writeOverheadDelta: '+14.0% write throughput unlocked',
    status: 'COMPLETED'
  },
  {
    id: 'opt-heal-05',
    timestamp: Date.now() - 1000 * 60 * 80,
    timeFormatted: '1 hr ago',
    action: 'HEAL',
    actionLabel: 'Relational Foreign Key Self-Healing',
    triggerSource: 'Auto-Healing',
    targetIndex: 'idx_line_items_tx',
    targetTable: 'line_items',
    columns: ['transaction_id'],
    rationale: 'Detected N+1 relational query storm due to missing index coverage on line_items foreign key. Automatically instantiated B-Tree index on transaction_id, converting sequential scans into batch hash joins.',
    executedDdl: 'CREATE INDEX CONCURRENTLY idx_line_items_tx ON line_items (transaction_id);',
    executionDurationMs: 29.5,
    healthDelta: { before: 12, after: 99, gain: 87 },
    latencyImpact: { beforeMs: '840 ms', afterMs: '3.2 ms', speedup: '99.6% faster' },
    writeOverheadDelta: '+3.8% write latency overhead',
    status: 'COMPLETED'
  }
];

const getStoredLifecycleEvents = (): OptimizationLifecycleEvent[] => {
  if (typeof window === 'undefined') return DEFAULT_LIFECYCLE_EVENTS;
  try {
    const raw = localStorage.getItem(LIFECYCLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse lifecycle events from localStorage', e);
  }
  return DEFAULT_LIFECYCLE_EVENTS;
};

export const SerializationErrorLogPanel: React.FC<SerializationErrorLogPanelProps> = ({
  logs = [],
  onClearLogs = () => {},
  onDismissLog = (_id?: any) => {},
  onSimulateFault = (_mode?: any) => {},
  currentFormat = 'csv',
  currentRecordCount = 50000,
  lifecycleEvents: propLifecycleEvents,
  onClearLifecycleEvents,
  alertThresholdMs = 100,
  records = [],
  flags = {}
}) => {
  const safeLogs = logs || [];
  const safeRecords = records || [];
  const alertThreshold = alertThresholdMs || 100;

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeMainTab, setActiveMainTab] = useState<'errors' | 'lifecycle' | 'reasoning' | 'outliers'>('errors');

  // Compute Latency Outliers exceeding alertThresholdMs
  const outlierQueries = useMemo(() => {
    if (!safeRecords || safeRecords.length === 0) return [];
    const results: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      status: string;
      category: string;
      itemCount: number;
      latencyMs: number;
      sqlQuery: string;
      table: string;
      exceededByMs: number;
    }> = [];

    const safeFlags = (flags || {}) as { batchEagerLoading?: boolean; btreeIndexing?: boolean; [key: string]: any };
    const batchEagerLoading = !!safeFlags.batchEagerLoading;
    const btreeIndexing = safeFlags.btreeIndexing ?? true;

    for (const r of safeRecords) {
      const recordItemCount = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      const unoptimizedMultiplier = (!batchEagerLoading) ? 45.0 : 8.0;
      const indexPenalty = (!btreeIndexing) ? 55.0 : 0.0;
      const latencyMs = batchEagerLoading 
        ? +(recordItemCount * 3.5 + 8.0).toFixed(1) 
        : +(20.0 + (recordItemCount * unoptimizedMultiplier) + indexPenalty).toFixed(1);

      if (latencyMs > alertThreshold) {
        const sqlQuery = batchEagerLoading
          ? `SELECT t.id, t.order_number, t.customer_name, t.amount, i.sku, i.name\nFROM transactions t\nLEFT JOIN line_items i ON i.transaction_id = t.id\nWHERE t.id = '${r.id}' AND t.status = '${r.status}';`
          : `SELECT * FROM transactions WHERE id = '${r.id}' AND status = '${r.status}';\n-- N+1 Subquery Storm (${recordItemCount} child lookups):\nSELECT * FROM line_items WHERE transaction_id = '${r.id}';`;

        results.push({
          id: r.id,
          orderNumber: r.orderNumber || r.id,
          customerName: r.customerName || 'Unknown Customer',
          status: r.status || 'pending',
          category: r.category || 'General',
          itemCount: recordItemCount,
          latencyMs,
          sqlQuery,
          table: r.tableName || 'transactions',
          exceededByMs: +(latencyMs - alertThreshold).toFixed(1)
        });
      }
    }
    return results;
  }, [safeRecords, alertThreshold, flags]);

  // Serialization Errors Tab Filters
  const [severityFilter, setSeverityFilter] = useState<SerializationLogSeverity | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'csv' | 'json' | 'engine'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Optimization Lifecycle Tab State
  const [localLifecycleEvents, setLocalLifecycleEvents] = useState<OptimizationLifecycleEvent[]>(getStoredLifecycleEvents);
  const activeLifecycleEvents = propLifecycleEvents || localLifecycleEvents;
  const [lifecycleActionFilter, setLifecycleActionFilter] = useState<LifecycleActionType | 'all'>('all');
  const [lifecycleTriggerFilter, setLifecycleTriggerFilter] = useState<LifecycleTriggerSource | 'all'>('all');
  const [expandedLifecycleId, setExpandedLifecycleId] = useState<string | null>(null);
  const [copiedDdlId, setCopiedDdlId] = useState<string | null>(null);
  const [lifecycleToast, setLifecycleToast] = useState<string | null>(null);

  // Sync lifecycle events to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(localLifecycleEvents));
    } catch (e) {
      console.warn('Failed to save lifecycle events to localStorage', e);
    }
  }, [localLifecycleEvents]);

  // Listen for optimization lifecycle actions dispatched by Auto-Healing and Consolidation
  useEffect(() => {
    const handleLifecycleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<OptimizationLifecycleEvent>>;
      if (!customEvent.detail) return;
      const detail = customEvent.detail;
      const newEvent: OptimizationLifecycleEvent = {
        id: `opt-live-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        timeFormatted: 'Just now',
        action: detail.action || 'HEAL',
        actionLabel: detail.actionLabel || 'Auto-Healing Optimization Action',
        triggerSource: detail.triggerSource || 'Auto-Healing',
        targetIndex: detail.targetIndex || 'idx_transactions_auto',
        targetTable: detail.targetTable || 'transactions',
        columns: detail.columns || ['id'],
        rationale: detail.rationale || 'Action automatically recorded by autonomous optimization engine.',
        executedDdl: detail.executedDdl || 'REINDEX INDEX CONCURRENTLY idx_transactions_auto;',
        executionDurationMs: detail.executionDurationMs || 15.2,
        healthDelta: detail.healthDelta || { before: 45, after: 98, gain: 53 },
        latencyImpact: detail.latencyImpact || { beforeMs: '310 ms', afterMs: '1.4 ms', speedup: '99.5% faster' },
        writeOverheadDelta: detail.writeOverheadDelta || 'Optimized',
        status: 'COMPLETED'
      };
      setLocalLifecycleEvents((prev) => [newEvent, ...prev]);
      setLifecycleToast(`Captured ${newEvent.actionLabel}: ${newEvent.targetIndex}`);
      setTimeout(() => setLifecycleToast(null), 3000);
    };

    window.addEventListener('optimization-lifecycle-event', handleLifecycleEvent);
    return () => window.removeEventListener('optimization-lifecycle-event', handleLifecycleEvent);
  }, []);

  // Filtered log entries for Errors tab
  const filteredLogs = useMemo(() => {
    return safeLogs.filter((log) => {
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      const matchesFormat =
        formatFilter === 'all' ||
        (formatFilter === 'engine'
          ? log.format === 'engine' || log.format === 'query'
          : log.format === formatFilter);
      return matchesSeverity && matchesFormat;
    });
  }, [safeLogs, severityFilter, formatFilter]);

  // Filtered entries for Optimization Lifecycle tab
  const filteredLifecycleEvents = useMemo(() => {
    return activeLifecycleEvents.filter((event) => {
      const matchesAction = lifecycleActionFilter === 'all' || event.action === lifecycleActionFilter;
      const matchesTrigger = lifecycleTriggerFilter === 'all' || event.triggerSource === lifecycleTriggerFilter;
      return matchesAction && matchesTrigger;
    });
  }, [activeLifecycleEvents, lifecycleActionFilter, lifecycleTriggerFilter]);

  // Aggregate count by severity for Errors tab
  const counts = useMemo(() => {
    const errorCount = safeLogs.filter((l) => l.severity === 'error').length;
    const anomalyCount = safeLogs.filter((l) => l.severity === 'anomaly').length;
    const warningCount = safeLogs.filter((l) => l.severity === 'warning').length;
    const latencyAnomaliesCount = safeLogs.filter(
      (l) => l.type === 'LATENCY_ANOMALY' || l.type === 'LATENCY_SPIKE'
    ).length;
    return {
      total: safeLogs.length,
      errors: errorCount,
      anomalies: anomalyCount,
      warnings: warningCount,
      latencyAnomalies: latencyAnomaliesCount
    };
  }, [safeLogs]);

  // Aggregate count by action type for Lifecycle tab
  const lifecycleCounts = useMemo(() => {
    const creates = activeLifecycleEvents.filter((e) => e.action === 'CREATE').length;
    const deletes = activeLifecycleEvents.filter((e) => e.action === 'DELETE').length;
    const merges = activeLifecycleEvents.filter((e) => e.action === 'MERGE').length;
    const heals = activeLifecycleEvents.filter((e) => e.action === 'HEAL').length;
    return {
      total: activeLifecycleEvents.length,
      creates,
      deletes,
      merges,
      heals
    };
  }, [activeLifecycleEvents]);

  const toggleExpandLog = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const toggleExpandLifecycle = (id: string) => {
    setExpandedLifecycleId((prev) => (prev === id ? null : id));
  };

  const handleCopyDdl = (id: string, ddl: string) => {
    navigator.clipboard?.writeText(ddl);
    setCopiedDdlId(id);
    setTimeout(() => setCopiedDdlId(null), 2000);
  };

  const handleClearLifecycle = () => {
    if (onClearLifecycleEvents) {
      onClearLifecycleEvents();
    } else {
      setLocalLifecycleEvents([]);
    }
  };

  const handleDownloadExportReport = () => {
    const reportData = {
      reportTitle: 'Enterprise Diagnostic Error & Optimization Lifecycle Report',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      summary: {
        totalLogs: safeLogs.length,
        errorCount: counts.errors,
        anomalyCount: counts.anomalies,
        warningCount: counts.warnings,
        totalLifecycleEvents: activeLifecycleEvents.length
      },
      logs: safeLogs,
      lifecycleEvents: activeLifecycleEvents,
      reasoningTraces: [
        {
          traceId: 'Trace #01',
          targetIndex: 'idx_transactions_email_status',
          query: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ?',
          speedup: '99.6% Faster (395ms → 1.6ms)',
          rationale: 'High cardinality filter predicate optimization.'
        },
        {
          traceId: 'Trace #02',
          targetIndex: 'idx_line_items_tx',
          query: 'SELECT * FROM line_items WHERE transaction_id = ?',
          speedup: '99.6% Faster (840ms → 3.2ms)',
          rationale: 'Foreign key join optimization avoiding N+1 query storms.'
        },
        {
          traceId: 'Trace #03',
          targetIndex: 'idx_transactions_date',
          query: 'DROP INDEX CONCURRENTLY idx_transactions_date;',
          speedup: '+14% Write Throughput Unlocked',
          rationale: 'Unused index auto-pruning to eliminate write WAL amplification.'
        }
      ]
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagnostic_optimization_report_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSimulateLifecycle = (action: LifecycleActionType) => {
    let newEv: OptimizationLifecycleEvent;
    const ts = Date.now();
    if (action === 'CREATE') {
      newEv = {
        id: `opt-sim-create-${ts}`,
        timestamp: ts,
        timeFormatted: 'Just now',
        action: 'CREATE',
        actionLabel: 'Autonomous Composite Index Creation',
        triggerSource: 'Consolidation',
        targetIndex: `idx_transactions_sim_${Math.random().toString(36).substring(2, 5)}`,
        targetTable: 'transactions',
        columns: ['category', 'amount'],
        rationale: 'Consolidation Analyzer detected range query aggregating amount over category; automatically created composite B-Tree index.',
        executedDdl: 'CREATE INDEX CONCURRENTLY idx_transactions_category_amount ON transactions (category, amount);',
        executionDurationMs: 38.2,
        healthDelta: { before: 25, after: 98, gain: 73 },
        latencyImpact: { beforeMs: '482 ms', afterMs: '1.9 ms', speedup: '99.6% faster' },
        writeOverheadDelta: '+4.8% controlled write cost',
        status: 'COMPLETED'
      };
    } else if (action === 'DELETE') {
      newEv = {
        id: `opt-sim-delete-${ts}`,
        timestamp: ts,
        timeFormatted: 'Just now',
        action: 'DELETE',
        actionLabel: 'Unused Index Auto-Prune',
        triggerSource: 'Auto-Healing',
        targetIndex: 'idx_transactions_date',
        targetTable: 'transactions',
        columns: ['created_at'],
        rationale: 'Auto-Healing detected 0 query seeks on idx_transactions_date while incurring 14% WAL write contention. Automatically dropped index.',
        executedDdl: 'DROP INDEX CONCURRENTLY idx_transactions_date;',
        executionDurationMs: 6.8,
        healthDelta: { before: 18, after: 94, gain: 76 },
        latencyImpact: { beforeMs: '140 ms write lock stall', afterMs: '0.0 ms', speedup: '14% write latency saved' },
        writeOverheadDelta: '+14.0% write throughput unlocked',
        status: 'COMPLETED'
      };
    } else if (action === 'MERGE') {
      newEv = {
        id: `opt-sim-merge-${ts}`,
        timestamp: ts,
        timeFormatted: 'Just now',
        action: 'MERGE',
        actionLabel: 'Composite Index Consolidation & Merge',
        triggerSource: 'Consolidation',
        targetIndex: 'idx_orders_status_cat',
        targetTable: 'transactions',
        columns: ['status', 'category'],
        rationale: 'Consolidation feature merged overlapping single-column indexes into a single composite B-Tree to eliminate redundant write penalties.',
        executedDdl: 'CREATE INDEX CONCURRENTLY idx_orders_status_cat ON transactions (status, category);\nDROP INDEX CONCURRENTLY idx_orders_status;\nDROP INDEX CONCURRENTLY idx_orders_category;',
        executionDurationMs: 32.1,
        healthDelta: { before: 54, after: 96, gain: 42 },
        latencyImpact: { beforeMs: '310 ms', afterMs: '1.4 ms', speedup: '99.5% faster' },
        writeOverheadDelta: '-22.0% write amplification saved',
        status: 'COMPLETED'
      };
    } else {
      newEv = {
        id: `opt-sim-heal-${ts}`,
        timestamp: ts,
        timeFormatted: 'Just now',
        action: 'HEAL',
        actionLabel: 'Auto-Healing Concurrent Reindex',
        triggerSource: 'Auto-Healing',
        targetIndex: 'idx_line_items_tx',
        targetTable: 'line_items',
        columns: ['transaction_id'],
        rationale: 'Auto-Healing detected index health dropped below 50% threshold. Automatically ran REINDEX CONCURRENTLY to balance B-Tree leaf pages.',
        executedDdl: 'REINDEX INDEX CONCURRENTLY idx_line_items_tx;',
        executionDurationMs: 19.3,
        healthDelta: { before: 44, after: 99, gain: 55 },
        latencyImpact: { beforeMs: '42.8 ms', afterMs: '2.4 ms', speedup: '94.4% faster' },
        writeOverheadDelta: 'Zero lock contention',
        status: 'COMPLETED'
      };
    }

    setLocalLifecycleEvents((prev) => [newEv, ...prev]);
    setLifecycleToast(`Simulated ${newEv.actionLabel}`);
    setTimeout(() => setLifecycleToast(null), 3000);
  };

  const getSeverityIcon = (log: SerializationLogEntry) => {
    if (log.type === 'LATENCY_ANOMALY' || log.type === 'LATENCY_SPIKE') {
      return <Zap className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    switch (log.severity) {
      case 'error':
        return <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'anomaly':
        return <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />;
    }
  };

  const getSeverityBadgeClass = (severity: SerializationLogSeverity) => {
    switch (severity) {
      case 'error':
        return 'bg-rose-100 text-rose-900 border-rose-200';
      case 'anomaly':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'warning':
        return 'bg-orange-100 text-orange-900 border-orange-200';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  const getActionBadge = (action: LifecycleActionType) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Plus className="w-3 h-3 text-emerald-600" />
            + INDEX CREATED
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <Trash2 className="w-3 h-3 text-rose-600" />
            - INDEX PRUNED
          </span>
        );
      case 'MERGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <Layers className="w-3 h-3 text-purple-600" />
            ⇄ CONSOLIDATED / MERGED
          </span>
        );
      case 'HEAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
            <HeartPulse className="w-3 h-3 text-teal-600 animate-pulse" />
            ⚡ AUTO-HEALED (REINDEX)
          </span>
        );
    }
  };

  const getTriggerSourceBadge = (source: LifecycleTriggerSource) => {
    switch (source) {
      case 'Auto-Healing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <HeartPulse className="w-3 h-3 text-emerald-600" />
            Auto-Healing Feature
          </span>
        );
      case 'Consolidation':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Layers className="w-3 h-3 text-indigo-600" />
            Consolidation Feature
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <Zap className="w-3 h-3 text-purple-600" />
            Autonomous Optimizer
          </span>
        );
    }
  };

  return (
    <div
      id="serialization-error-log-panel"
      className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden transition-all duration-200"
    >
      {/* Panel Header & Toggle Bar */}
      <div className="p-3 sm:px-4 bg-zinc-50/90 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <button
            id="btn-toggle-serialization-log-expand"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
            aria-label={isExpanded ? 'Collapse error log panel' : 'Expand error log panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-white shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-zinc-900">
                  Serialization Errors &amp; Optimization Lifecycle
                </span>
                {counts.errors > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {counts.errors} {counts.errors === 1 ? 'Error' : 'Errors'}
                  </span>
                ) : counts.anomalies > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {counts.anomalies} {counts.anomalies === 1 ? 'Anomaly' : 'Anomalies'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Normal Baselines
                  </span>
                )}
                <span
                  id="header-lifecycle-events-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  {activeLifecycleEvents.length} Lifecycle Events
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 hidden sm:block">
                Real-time audit log tracking serialization exceptions, latency anomalies, and autonomous Auto-Healing / Consolidation lifecycle actions.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0 flex-wrap">
          {/* Download Export Report Button */}
          <button
            type="button"
            id="btn-download-export-report"
            data-testid="btn-download-export-report"
            onClick={handleDownloadExportReport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-2xs mr-1"
            title="Download current logs, lifecycle events, and reasoning analysis as a JSON diagnostic report"
          >
            <Download className="w-3.5 h-3.5 text-indigo-200" />
            <span>Download Export Report</span>
          </button>

          {activeMainTab === 'errors' ? (
            <>
              {/* Quick simulation buttons for Errors tab */}
              <div className="relative inline-flex items-center gap-1 flex-wrap">
                <button
                  id="btn-simulate-latency-anomaly"
                  type="button"
                  onClick={() => onSimulateFault('latency_anomaly')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                  title="Simulate a database query latency spike anomaly"
                >
                  <Zap className="w-3 h-3 text-indigo-600" />
                  <span>Simulate Spike</span>
                </button>
                <button
                  id="btn-simulate-throughput-anomaly"
                  type="button"
                  onClick={() => onSimulateFault('throughput_anomaly')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                  title="Simulate a severe throughput degradation anomaly"
                >
                  <TrendingDown className="w-3 h-3 text-amber-600" />
                  <span>Simulate Anomaly</span>
                </button>
                <button
                  id="btn-simulate-serialization-failure"
                  type="button"
                  onClick={() => onSimulateFault('failure')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Simulate a fatal serialization stream exception"
                >
                  <AlertOctagon className="w-3 h-3 text-rose-600" />
                  <span>Simulate Failure</span>
                </button>
              </div>

              {logs.length > 0 && (
                <button
                  id="btn-clear-serialization-logs"
                  type="button"
                  onClick={onClearLogs}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Clear all logged events"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear Errors</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Quick simulation buttons for Optimization Lifecycle tab */}
              <div className="relative inline-flex items-center gap-1 flex-wrap">
                <button
                  id="btn-simulate-lifecycle-heal"
                  data-testid="btn-simulate-lifecycle-heal"
                  type="button"
                  onClick={() => handleSimulateLifecycle('HEAL')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Simulate Auto-Healing concurrent reindexing action"
                >
                  <HeartPulse className="w-3 h-3 text-emerald-600" />
                  <span>Simulate Auto-Heal</span>
                </button>
                <button
                  id="btn-simulate-lifecycle-merge"
                  data-testid="btn-simulate-lifecycle-merge"
                  type="button"
                  onClick={() => handleSimulateLifecycle('MERGE')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                  title="Simulate multi-column index consolidation & merge"
                >
                  <Layers className="w-3 h-3 text-purple-600" />
                  <span>Simulate Consolidation</span>
                </button>
                <button
                  id="btn-simulate-lifecycle-create"
                  data-testid="btn-simulate-lifecycle-create"
                  type="button"
                  onClick={() => handleSimulateLifecycle('CREATE')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                  title="Simulate autonomous index creation"
                >
                  <Plus className="w-3 h-3 text-blue-600" />
                  <span>Auto-Create</span>
                </button>
                <button
                  id="btn-simulate-lifecycle-delete"
                  data-testid="btn-simulate-lifecycle-delete"
                  type="button"
                  onClick={() => handleSimulateLifecycle('DELETE')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                  title="Simulate redundant index pruning deletion"
                >
                  <Trash2 className="w-3 h-3 text-rose-600" />
                  <span>Auto-Prune</span>
                </button>
              </div>

              {activeLifecycleEvents.length > 0 && (
                <button
                  id="btn-clear-lifecycle-events"
                  data-testid="btn-clear-lifecycle-events"
                  type="button"
                  onClick={handleClearLifecycle}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Clear all lifecycle events"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Clear Lifecycle</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Tab Switcher Bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 sm:px-4 bg-zinc-50/60">
        <div className="flex items-center gap-1">
          {/* Tab 1: Serialization Errors */}
          <button
            type="button"
            id="tab-serialization-errors"
            data-testid="tab-serialization-errors"
            onClick={() => setActiveMainTab('errors')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'errors'
                ? 'border-indigo-600 text-indigo-950 bg-white shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <AlertOctagon className={`w-3.5 h-3.5 ${activeMainTab === 'errors' ? 'text-rose-600' : 'text-zinc-400'}`} />
            <span>Serialization &amp; Latency Errors</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
              counts.total > 0 ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              {counts.total}
            </span>
          </button>

          {/* Tab 2: Optimization Lifecycle (NEW TAB) */}
          <button
            type="button"
            id="tab-optimization-lifecycle"
            data-testid="tab-optimization-lifecycle"
            onClick={() => setActiveMainTab('lifecycle')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'lifecycle'
                ? 'border-emerald-600 text-emerald-950 bg-white shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeMainTab === 'lifecycle' ? 'text-amber-500' : 'text-zinc-400'}`} />
            <span>Optimization Lifecycle</span>
            <span
              id="tab-lifecycle-count-badge"
              data-testid="tab-lifecycle-count-badge"
              className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-emerald-200"
            >
              {activeLifecycleEvents.length}
            </span>
          </button>

          {/* Tab: Latency Outliers */}
          <button
            type="button"
            id="tab-latency-outliers"
            data-testid="tab-latency-outliers"
            onClick={() => setActiveMainTab('outliers')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'outliers'
                ? 'border-rose-600 text-rose-950 bg-white shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${activeMainTab === 'outliers' ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
            <span>Latency Outliers</span>
            <span
              id="tab-outliers-count-badge"
              data-testid="tab-outliers-count-badge"
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                outlierQueries.length > 0 ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
              }`}
            >
              {outlierQueries.length}
            </span>
          </button>

          {/* Tab 3: Reasoning Log */}
          <button
            type="button"
            id="tab-reasoning-log"
            data-testid="tab-reasoning-log"
            onClick={() => setActiveMainTab('reasoning')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'reasoning'
                ? 'border-purple-600 text-purple-950 bg-white shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Terminal className={`w-3.5 h-3.5 ${activeMainTab === 'reasoning' ? 'text-purple-600' : 'text-zinc-400'}`} />
            <span>Reasoning Log</span>
            <span
              id="tab-reasoning-count-badge"
              data-testid="tab-reasoning-count-badge"
              className="bg-purple-100 text-purple-800 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-purple-200"
            >
              3
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
          {activeMainTab === 'lifecycle' ? (
            <span className="flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-Healing &amp; Consolidation Telemetry Stream Active</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-indigo-800 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Z-Score Anomaly Engine Running</span>
            </span>
          )}
        </div>
      </div>

      {/* Quick feedback toast */}
      {lifecycleToast && (
        <div
          id="lifecycle-action-toast"
          className="bg-emerald-600 text-white text-xs px-4 py-1.5 font-semibold flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>{lifecycleToast}</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-700/80 px-1.5 py-0.2 rounded">Event Logged</span>
        </div>
      )}

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3">
          {/* TAB 1: Serialization Errors View */}
          {activeMainTab === 'errors' && (
            <>
              {/* Filter Bar & Metric Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                {/* Severity Filter Tabs */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      severityFilter === 'all'
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All ({counts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('error')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      severityFilter === 'error'
                        ? 'bg-white text-rose-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-rose-700'
                    }`}
                  >
                    Errors ({counts.errors})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('anomaly')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      severityFilter === 'anomaly'
                        ? 'bg-white text-amber-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-amber-700'
                    }`}
                  >
                    Anomalies ({counts.anomalies})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('warning')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      severityFilter === 'warning'
                        ? 'bg-white text-orange-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-orange-700'
                    }`}
                  >
                    Warnings ({counts.warnings})
                  </button>
                </div>

                {/* Format Filter */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-400 font-medium">Format / Engine:</span>
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100">
                    <button
                      type="button"
                      onClick={() => setFormatFilter('all')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        formatFilter === 'all'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatFilter('csv')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        formatFilter === 'csv'
                          ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatFilter('json')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        formatFilter === 'json'
                          ? 'bg-white text-amber-800 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatFilter('engine')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        formatFilter === 'engine'
                          ? 'bg-white text-indigo-800 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Engine
                    </button>
                  </div>
                </div>
              </div>

              {/* Log Entries Stream List */}
              {filteredLogs.length === 0 ? (
                <div className="py-8 px-4 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-zinc-800">
                    {logs.length === 0
                      ? 'No serialization failures or latency anomalies detected'
                      : 'No logs match the current filter criteria'}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                    Telemetry is actively monitoring query runtimes, anomaly thresholds, and output serialization streams.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredLogs.map((log) => {
                    const isDetailOpen = expandedLogId === log.id;
                    const isCsv = log.format === 'csv';
                    const isJson = log.format === 'json';
                    const isLatencyAnomaly =
                      log.type === 'LATENCY_ANOMALY' || log.type === 'LATENCY_SPIKE';

                    return (
                      <div
                        key={log.id}
                        id={`serialization-log-entry-${log.id}`}
                        className={`rounded-lg border p-2.5 transition-all ${
                          log.severity === 'error'
                            ? 'bg-rose-50/40 border-rose-200'
                            : isLatencyAnomaly
                            ? 'bg-indigo-50/30 border-indigo-200'
                            : log.severity === 'anomaly'
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-orange-50/30 border-orange-200'
                        }`}
                      >
                        {/* Log Row Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="mt-0.5">{getSeverityIcon(log)}</div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${getSeverityBadgeClass(
                                    log.severity
                                  )}`}
                                >
                                  {log.severity}
                                </span>

                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                    isLatencyAnomaly
                                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                      : 'bg-white text-zinc-700 border-zinc-200'
                                  }`}
                                >
                                  {log.type.replace(/_/g, ' ')}
                                </span>

                                <span
                                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                                    isCsv
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isJson
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-zinc-100 text-zinc-800'
                                  }`}
                                >
                                  {log.format.toUpperCase()}
                                </span>

                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {log.timeFormatted}
                                </span>
                              </div>

                              <p className="text-xs text-zinc-800 font-medium mt-1 leading-snug">
                                {log.message}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {log.details && (
                              <button
                                type="button"
                                onClick={() => toggleExpandLog(log.id)}
                                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 px-1.5 py-0.5 rounded hover:bg-zinc-200/60 transition-colors cursor-pointer"
                              >
                                {isDetailOpen ? 'Hide' : 'Details'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDismissLog(log.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Dismiss log entry"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Details Drawer */}
                        {isDetailOpen && log.details && (
                          <div className="mt-2.5 pt-2.5 border-t border-zinc-200/70 text-xs space-y-1.5 font-mono">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                              {log.details.durationMs !== undefined && (
                                <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                                  <span className="text-zinc-400 block text-[9px] uppercase">
                                    Duration
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {log.details.durationMs.toFixed(1)} ms
                                  </span>
                                </div>
                              )}
                              {log.details.varianceMs !== undefined && (
                                <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                                  <span className="text-zinc-400 block text-[9px] uppercase">
                                    Variance
                                  </span>
                                  <span className="font-bold text-amber-700">
                                    +{log.details.varianceMs.toFixed(1)} ms
                                  </span>
                                </div>
                              )}
                              {log.details.throughputRowsPerSec !== undefined && (
                                <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                                  <span className="text-zinc-400 block text-[9px] uppercase">
                                    Throughput
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {log.details.throughputRowsPerSec.toLocaleString()} rows/s
                                  </span>
                                </div>
                              )}
                              {log.details.cpuUsagePercent !== undefined && (
                                <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                                  <span className="text-zinc-400 block text-[9px] uppercase">
                                    Host CPU
                                  </span>
                                  <span className="font-bold text-zinc-800">
                                    {log.details.cpuUsagePercent}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {log.details.cause && (
                              <div className="text-zinc-700">
                                <span className="font-bold text-zinc-900">Diagnosis: </span>
                                <span>{log.details.cause}</span>
                              </div>
                            )}

                            {log.details.triggerSource && (
                              <div className="text-zinc-500 text-[10px]">
                                <span className="font-medium">Trigger Source: </span>
                                <span>{log.details.triggerSource}</span>
                              </div>
                            )}

                            {log.details.stackTrace && (
                              <div className="mt-1">
                                <div className="text-[10px] font-bold text-rose-800 mb-0.5">
                                  Stack Trace:
                                </div>
                                <pre className="p-1.5 bg-zinc-900 text-rose-300 font-mono text-[9px] rounded overflow-x-auto leading-relaxed">
                                  {log.details.stackTrace}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: Optimization Lifecycle View */}
          {activeMainTab === 'lifecycle' && (
            <div id="optimization-lifecycle-tab-content" className="space-y-3">
              {/* Lifecycle Subtitle & Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                {/* Action Type Filter Tabs */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 text-[11px] font-medium flex-wrap">
                  <button
                    type="button"
                    onClick={() => setLifecycleActionFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      lifecycleActionFilter === 'all'
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All Actions ({lifecycleCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLifecycleActionFilter('CREATE')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      lifecycleActionFilter === 'CREATE'
                        ? 'bg-white text-emerald-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-emerald-700'
                    }`}
                  >
                    Creation ({lifecycleCounts.creates})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLifecycleActionFilter('DELETE')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      lifecycleActionFilter === 'DELETE'
                        ? 'bg-white text-rose-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-rose-700'
                    }`}
                  >
                    Deletion / Prune ({lifecycleCounts.deletes})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLifecycleActionFilter('MERGE')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      lifecycleActionFilter === 'MERGE'
                        ? 'bg-white text-purple-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-purple-700'
                    }`}
                  >
                    Consolidation ({lifecycleCounts.merges})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLifecycleActionFilter('HEAL')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      lifecycleActionFilter === 'HEAL'
                        ? 'bg-white text-teal-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-teal-700'
                    }`}
                  >
                    Auto-Healing ({lifecycleCounts.heals})
                  </button>
                </div>

                {/* Source Filter */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-400 font-medium">Trigger Feature:</span>
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100">
                    <button
                      type="button"
                      onClick={() => setLifecycleTriggerFilter('all')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        lifecycleTriggerFilter === 'all'
                          ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifecycleTriggerFilter('Auto-Healing')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        lifecycleTriggerFilter === 'Auto-Healing'
                          ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Auto-Healing
                    </button>
                    <button
                      type="button"
                      onClick={() => setLifecycleTriggerFilter('Consolidation')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        lifecycleTriggerFilter === 'Consolidation'
                          ? 'bg-white text-indigo-800 font-semibold shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Consolidation
                    </button>
                  </div>
                </div>
              </div>

              {/* Event Stream List */}
              {filteredLifecycleEvents.length === 0 ? (
                <div className="py-8 px-4 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-xs font-semibold text-zinc-800">
                    No Optimization Lifecycle events recorded yet
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto mb-3">
                    Automatic index creation, deletion, and consolidation merging executed by Auto-Healing and Consolidation features are captured here.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSimulateLifecycle('HEAL')}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer shadow-xs"
                    >
                      Simulate Auto-Healing Action
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateLifecycle('MERGE')}
                      className="px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-md cursor-pointer shadow-xs"
                    >
                      Simulate Consolidation Merge
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredLifecycleEvents.map((event) => {
                    const isDetailOpen = expandedLifecycleId === event.id;
                    const isCopied = copiedDdlId === event.id;

                    return (
                      <div
                        key={event.id}
                        id={`lifecycle-event-${event.id}`}
                        data-testid={`lifecycle-event-${event.id}`}
                        className={`rounded-lg border p-3 transition-all ${
                          event.action === 'CREATE'
                            ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300'
                            : event.action === 'DELETE'
                            ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-300'
                            : event.action === 'MERGE'
                            ? 'bg-purple-50/30 border-purple-200/80 hover:border-purple-300'
                            : 'bg-teal-50/30 border-teal-200/80 hover:border-teal-300'
                        }`}
                      >
                        {/* Event Card Header */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className="mt-0.5">
                              {event.action === 'CREATE' ? (
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                  <Plus className="w-4 h-4" />
                                </div>
                              ) : event.action === 'DELETE' ? (
                                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </div>
                              ) : event.action === 'MERGE' ? (
                                <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                                  <Layers className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                                  <HeartPulse className="w-4 h-4 animate-pulse" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {getActionBadge(event.action)}
                                {getTriggerSourceBadge(event.triggerSource)}
                                <span className="font-mono text-xs font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
                                  {event.targetIndex}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-sans">
                                  on table: <strong className="text-zinc-800 font-mono">{event.targetTable}</strong>
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono ml-auto sm:ml-0">
                                  {event.timeFormatted}
                                </span>
                              </div>

                              <p className="text-xs text-zinc-800 font-medium mt-1 leading-snug">
                                {event.rationale}
                              </p>

                              {/* Performance Delta Badges */}
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono">
                                {event.latencyImpact && (
                                  <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                                    <Zap className="w-3 h-3 text-emerald-600" />
                                    <span>Latency:</span>
                                    <span className="line-through text-zinc-400">{event.latencyImpact.beforeMs}</span>
                                    <span>→</span>
                                    <strong className="text-emerald-700">{event.latencyImpact.afterMs}</strong>
                                    <span className="text-emerald-600 font-bold">({event.latencyImpact.speedup})</span>
                                  </span>
                                )}

                                {event.healthDelta && (
                                  <span className="bg-teal-50 text-teal-900 border border-teal-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                                    <HeartPulse className="w-3 h-3 text-teal-600" />
                                    <span>Health:</span>
                                    <span>{event.healthDelta.before}/100</span>
                                    <span>→</span>
                                    <strong className="text-teal-700">{event.healthDelta.after}/100</strong>
                                    <span className="text-teal-600 font-bold">(+{event.healthDelta.gain} pts)</span>
                                  </span>
                                )}

                                {event.writeOverheadDelta && (
                                  <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
                                    {event.writeOverheadDelta}
                                  </span>
                                )}

                                <span className="text-zinc-400">
                                  Duration: <strong>{event.executionDurationMs}ms</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Detail & Action controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleExpandLifecycle(event.id)}
                              className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 px-1.5 py-0.5 rounded hover:bg-zinc-200/60 transition-colors cursor-pointer"
                            >
                              {isDetailOpen ? 'Hide DDL' : 'View DDL'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalLifecycleEvents((prev) => prev.filter((e) => e.id !== event.id));
                              }}
                              className="text-zinc-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Dismiss lifecycle event"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable DDL & Execution Plan Section */}
                        {isDetailOpen && (
                          <div className="mt-2.5 pt-2.5 border-t border-zinc-200/70 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-zinc-700 flex items-center gap-1">
                                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                                <span>Autonomous DDL Executed:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyDdl(event.id, event.executedDdl)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                                <span>{isCopied ? 'Copied SQL' : 'Copy DDL'}</span>
                              </button>
                            </div>
                            <pre className="p-2 bg-zinc-950 text-emerald-300 font-mono text-[10px] rounded-lg overflow-x-auto leading-relaxed border border-zinc-800 shadow-inner">
                              {event.executedDdl}
                            </pre>
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                              <span>Target Columns: ({event.columns.join(', ')})</span>
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                Status: {event.status}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Latency Outliers View */}
          {activeMainTab === 'outliers' && (
            <div id="latency-outliers-tab-content" className="space-y-3 animate-fadeIn">
              {/* Outliers Header / Stats Bar */}
              <div className="p-3 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/15 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-rose-950">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-rose-600 text-white shadow-xs">
                    <Flame className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                      <span>Query Latency Outliers Stream</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-950 font-mono font-bold text-[10px]">
                        {outlierQueries.length} Detected
                      </span>
                    </h4>
                    <p className="text-[11px] text-zinc-600">
                      Automatically capturing queries exceeding your active alert threshold (<strong className="text-rose-700 font-bold">{alertThresholdMs}ms</strong>)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <div className="bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-zinc-700 shadow-2xs">
                    Threshold: <strong className="text-rose-600">{alertThresholdMs}ms</strong>
                  </div>
                  {outlierQueries.length > 0 && (
                    <div className="bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-zinc-700 shadow-2xs">
                      Max Latency: <strong className="text-rose-700 font-bold">{Math.max(...outlierQueries.map(o => o.latencyMs))}ms</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Outlier Queries List */}
              {outlierQueries.length === 0 ? (
                <div className="py-12 text-center bg-zinc-50 rounded-xl border border-zinc-200 p-6">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h5 className="font-bold text-zinc-900 text-sm">No Latency Outliers Detected</h5>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                    All currently displayed database queries are executing within the optimal performance threshold (&lt; {alertThresholdMs}ms). Toggle off N+1 optimizations or lower the threshold to inspect query latency spikes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {outlierQueries.map((outlier) => (
                    <div
                      key={outlier.id}
                      className="bg-white rounded-xl border border-rose-200/80 p-3.5 shadow-2xs hover:shadow-sm transition-all space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                          <span className="font-bold text-zinc-900 text-xs">
                            Order #{outlier.orderNumber}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-600 text-xs">{outlier.customerName}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {outlier.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-600" />
                            <span>{outlier.latencyMs}ms</span>
                          </span>
                          <span className="text-[10px] bg-rose-950 text-rose-200 px-1.5 py-0.5 rounded font-bold">
                            +{outlier.exceededByMs}ms over limit
                          </span>
                        </div>
                      </div>

                      {/* Highlighted SQL Statement */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                          <span>Specific SQL Statement:</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(outlier.sqlQuery);
                              setLifecycleToast(`Copied SQL for Order #${outlier.orderNumber}`);
                              setTimeout(() => setLifecycleToast(null), 2500);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-[10px]"
                          >
                            Copy SQL
                          </button>
                        </div>
                        <pre className="p-2.5 bg-zinc-900 text-rose-200 font-mono text-[11px] rounded-lg border border-zinc-800 overflow-x-auto leading-relaxed">
                          {outlier.sqlQuery}
                        </pre>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100">
                        <span>Items / Subqueries: <strong className="text-zinc-800">{outlier.itemCount} items</strong></span>
                        <span className="text-rose-600 font-medium">Action Required: Enable B-Tree Indexing or Batch Eager Loading</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Reasoning Log View */}
          {activeMainTab === 'reasoning' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-purple-900">
                  <Terminal className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span className="font-bold">Autonomous Index Configuration Reasoning Trace</span>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Granular step-by-step decision rationale for why specific Quick Fix index configurations were selected, referencing historical performance data of similar queries.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-1 rounded-lg border border-purple-300">
                  3 Traces Analyzed
                </span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {/* Reasoning Trace 1 */}
                <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        Trace #01
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900">
                        idx_transactions_email_status
                      </span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        on table: <strong className="font-mono text-zinc-800">transactions</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      Speedup: 99.6% Faster (395ms → 1.6ms)
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900 text-purple-200 font-mono text-xs rounded-lg border border-zinc-800">
                    SELECT * FROM transactions WHERE customer_email = ? AND status = ?
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="font-semibold text-zinc-800 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Step-by-Step Decision Trace &amp; Historical Rationale:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-zinc-600 text-[11px] pl-1 font-mono">
                      <li><strong>Step 1 (Query Signature Parsing):</strong> Filter predicate detected on high-cardinality <code className="text-zinc-800">customer_email</code> combined with order <code className="text-zinc-800">status</code>.</li>
                      <li><strong>Step 2 (Cost Model Estimation):</strong> Sequential scan cost (412.5 CPU units) exceeded B-Tree index seek cost (1.2 units) by 344x across 50,000 historical records.</li>
                      <li><strong>Step 3 (Write Overhead Check):</strong> Verified +4.5% controlled insertion cost remains safely below the governor ceiling (max 15%).</li>
                      <li><strong>Step 4 (Execution Safety):</strong> Issued <code className="text-emerald-700">CREATE INDEX CONCURRENTLY</code> to prevent table write locks during synthesis.</li>
                    </ul>
                  </div>
                </div>

                {/* Reasoning Trace 2 */}
                <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
                        Trace #02
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900">
                        idx_line_items_tx
                      </span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        on table: <strong className="font-mono text-zinc-800">line_items</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      Speedup: 99.6% Faster (840ms → 3.2ms)
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900 text-teal-200 font-mono text-xs rounded-lg border border-zinc-800">
                    SELECT * FROM line_items WHERE transaction_id = ?
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>Step-by-Step Decision Trace &amp; Historical Rationale:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-zinc-600 text-[11px] pl-1 font-mono">
                      <li><strong>Step 1 (Relationship Mapping):</strong> Foreign key dependency analyzer flagged unindexed join relationship between <code className="text-zinc-800">transactions</code> and <code className="text-zinc-800">line_items</code> causing N+1 query storms.</li>
                      <li><strong>Step 2 (Loop Join Cost Analysis):</strong> Nested loop degradation scaled linearly with relation record count.</li>
                      <li><strong>Step 3 (Auto-Healing Synthesis):</strong> Synthesized B-Tree index on <code className="text-zinc-800">transaction_id</code>, converting sequential scans into batch hash joins in 29.5ms.</li>
                    </ul>
                  </div>
                </div>

                {/* Reasoning Trace 3 */}
                <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                        Trace #03
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-900">
                        idx_transactions_date (Pruned)
                      </span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        on table: <strong className="font-mono text-zinc-800">transactions</strong>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                      +14% Write Throughput Unlocked
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-900 text-rose-200 font-mono text-xs rounded-lg border border-zinc-800">
                    DROP INDEX CONCURRENTLY idx_transactions_date;
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      <span>Step-by-Step Decision Trace &amp; Historical Rationale:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-zinc-600 text-[11px] pl-1 font-mono">
                      <li><strong>Step 1 (Usage Telemetry Audit):</strong> Housekeeper tracked 0 query seeks on <code className="text-zinc-800">idx_transactions_date</code> over 24 hours.</li>
                      <li><strong>Step 2 (Write Contention Assessment):</strong> Dead index maintenance incurred 14% write amplification delay on high-volume batch inserts.</li>
                      <li><strong>Step 3 (Safe Removal):</strong> Executed concurrent drop to reclaim 4.2 MB memory and restore 100% write performance.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Telemetry Status Line */}
          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeMainTab === 'lifecycle'
                ? 'Optimization Lifecycle Monitor • Capturing Autonomous Index Creations, Deletions, & Consolidations'
                : 'Active Telemetry • Real-time Anomaly Thresholds & Serialization Stream Monitor'}
            </span>
            <span>Target: Table &amp; Performance Trends</span>
          </div>
        </div>
      )}
    </div>
  );
};
