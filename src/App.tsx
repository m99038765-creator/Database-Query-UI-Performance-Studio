import { motion } from 'framer-motion';
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
import {
  exportDiagnosticCorrelationPdf,
  DiagnosticPdfSectionId,
  DiagnosticPdfSectionsConfig,
  DiagnosticPdfSectionGroup,
  DEFAULT_PDF_SECTION_ORDER
} from './utils/diagnosticCorrelationPdfGenerator';
import {
  DataTapeEntry,
  DatabaseUpdateEvent,
  SerializationLogEntry,
  DatabaseMutationHistoryEntry
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
  getDatabaseMutationHistory,
  getLastCompletedMutation
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
  Sparkle,
  ShieldCheck,
  Search,
  Table,
  TrendingDown,
  Download,
  Clock,
  Check,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileJson,
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
  SeparatorHorizontal,
  Eye,
  EyeOff,
  Bookmark,
  Save,
  Folder,
  FolderOpen,
  FolderX,
  Users,
  Pin,
  Timer,
  GripVertical,
  ChevronUp,
  Minimize2,
  Maximize2,
  RotateCcw,
  ArrowUpDown,
  HelpCircle,
  Info,
  Palette
} from 'lucide-react';
import {
  PREDEFINED_PDF_TEMPLATES,
  PdfReportTemplate,
  getSavedCustomTemplate,
  saveCustomTemplate,
  matchTemplateId
} from './utils/pdfReportTemplates';

export const DEFAULT_PDF_SECTION_GROUPS: DiagnosticPdfSectionGroup[] = [
  { id: 'group_metrics', title: 'Metrics Domain Group', sectionIds: ['sparklines'], isCollapsed: false },
  { id: 'group_logs', title: 'Logs Domain Group', sectionIds: ['mutationHistory'], isCollapsed: false },
  { id: 'group_strategy', title: 'Strategy Domain Group', sectionIds: ['recommendations'], isCollapsed: false },
  { id: 'group_summary', title: 'Summary Domain Group', sectionIds: ['executiveSummary'], isCollapsed: false }
];

const PDF_SECTION_CONFIG_ITEMS: Record<
  DiagnosticPdfSectionId,
  {
    id: DiagnosticPdfSectionId;
    title: string;
    tag: string;
    badge: string;
    badgeClass: string;
    description: string;
    includeKey: 'includeSparklines' | 'includeMutationHistory' | 'includeRecommendations' | 'includeExecutiveSummary';
    breakKey: 'breakBeforeSparklines' | 'breakBeforeMutationHistory' | 'breakBeforeRecommendations' | 'breakBeforeExecutiveSummary';
    noteKey: 'sparklinesNote' | 'mutationHistoryNote' | 'recommendationsNote' | 'executiveSummaryNote';
    metadataKey: 'includeMetadataSparklines' | 'includeMetadataMutationHistory' | 'includeMetadataRecommendations' | 'includeMetadataExecutiveSummary';
    inputSectionId: string;
    inputBreakId: string;
    inputNoteId: string;
    inputMetadataId: string;
    inputPaddingId: string;
    paddingKey: 'paddingSparklines' | 'paddingMutationHistory' | 'paddingRecommendations' | 'paddingExecutiveSummary';
    filenamePrefixKey: 'sparklinesFilenamePrefix' | 'mutationHistoryFilenamePrefix' | 'recommendationsFilenamePrefix' | 'executiveSummaryFilenamePrefix';
    inputFilenamePrefixId: string;
    delimiterKey: 'sparklinesDelimiter' | 'mutationHistoryDelimiter' | 'recommendationsDelimiter' | 'executiveSummaryDelimiter';
    inputDelimiterId: string;
    showDividerKey: 'showDividerSparklines' | 'showDividerMutationHistory' | 'showDividerRecommendations' | 'showDividerExecutiveSummary';
    dividerColorKey: 'dividerColorSparklines' | 'dividerColorMutationHistory' | 'dividerColorRecommendations' | 'dividerColorExecutiveSummary';
    dividerStyleKey: 'dividerStyleSparklines' | 'dividerStyleMutationHistory' | 'dividerStyleRecommendations' | 'dividerStyleExecutiveSummary';
    dividerThicknessKey: 'dividerThicknessSparklines' | 'dividerThicknessMutationHistory' | 'dividerThicknessRecommendations' | 'dividerThicknessExecutiveSummary';
    inputDividerToggleId: string;
    inputDividerStyleId: string;
    inputDividerThicknessId: string;
    tip: string;
    icon: React.ComponentType<{ className?: string }>;
    barColor: string;
  }
> = {
  sparklines: {
    id: 'sparklines',
    icon: Activity,
    barColor: 'bg-blue-500',
    tag: 'Metrics',
    title: 'Trend Sparklines',
    badge: 'Visual Canvas',
    badgeClass: 'bg-blue-500/20 text-blue-300',
    description: 'Dual-panel latency response & write mutation frequency charts with SLA limits',
    includeKey: 'includeSparklines',
    breakKey: 'breakBeforeSparklines',
    noteKey: 'sparklinesNote',
    metadataKey: 'includeMetadataSparklines',
    inputSectionId: 'toggle-section-sparklines',
    inputBreakId: 'toggle-break-sparklines',
    inputNoteId: 'input-custom-note-sparklines',
    inputMetadataId: 'toggle-metadata-sparklines',
    inputPaddingId: 'slider-padding-sparklines',
    paddingKey: 'paddingSparklines',
    filenamePrefixKey: 'sparklinesFilenamePrefix',
    inputFilenamePrefixId: 'input-filename-prefix-sparklines',
    delimiterKey: 'sparklinesDelimiter',
    inputDelimiterId: 'select-delimiter-sparklines',
    showDividerKey: 'showDividerSparklines',
    dividerColorKey: 'dividerColorSparklines',
    dividerStyleKey: 'dividerStyleSparklines',
    dividerThicknessKey: 'dividerThicknessSparklines',
    inputDividerToggleId: 'toggle-show-dividers-sparklines',
    inputDividerStyleId: 'select-divider-style-sparklines',
    inputDividerThicknessId: 'select-divider-thickness-sparklines',
    tip: 'Pro-tip: Derived from real-time telemetry buffer recording 50Hz latency sample windows and write mutation frequency counters against SLA thresholds.'
  },
  mutationHistory: {
    id: 'mutationHistory',
    icon: Table,
    barColor: 'bg-amber-500',
    tag: 'Logs',
    title: 'Detailed Mutation History',
    badge: 'Data Tables',
    badgeClass: 'bg-amber-500/20 text-amber-300',
    description: 'Mutation clusters, lock holding times, and chronological root-cause chain of events',
    includeKey: 'includeMutationHistory',
    breakKey: 'breakBeforeMutationHistory',
    noteKey: 'mutationHistoryNote',
    metadataKey: 'includeMetadataMutationHistory',
    inputSectionId: 'toggle-section-mutation-history',
    inputBreakId: 'toggle-break-mutation-history',
    inputNoteId: 'input-custom-note-mutation-history',
    inputMetadataId: 'toggle-metadata-mutation-history',
    inputPaddingId: 'slider-padding-mutation-history',
    paddingKey: 'paddingMutationHistory',
    filenamePrefixKey: 'mutationHistoryFilenamePrefix',
    inputFilenamePrefixId: 'input-filename-prefix-mutation-history',
    delimiterKey: 'mutationHistoryDelimiter',
    inputDelimiterId: 'select-delimiter-mutation-history',
    showDividerKey: 'showDividerMutationHistory',
    dividerColorKey: 'dividerColorMutationHistory',
    dividerStyleKey: 'dividerStyleMutationHistory',
    dividerThicknessKey: 'dividerThicknessMutationHistory',
    inputDividerToggleId: 'toggle-show-dividers-mutation-history',
    inputDividerStyleId: 'select-divider-style-mutation-history',
    inputDividerThicknessId: 'select-divider-thickness-mutation-history',
    tip: 'Pro-tip: Aggregated from transaction mutex acquisition logs, deadlock detectors, and chronological root-cause tracing events.'
  },
  recommendations: {
    id: 'recommendations',
    icon: Zap,
    barColor: 'bg-emerald-500',
    tag: 'Strategy',
    title: 'Strategic Recommendations',
    badge: 'Action Plan',
    badgeClass: 'bg-emerald-500/20 text-emerald-300',
    description: 'Prioritized engineering remediation guidance (micro-batching, indexing, caching)',
    includeKey: 'includeRecommendations',
    breakKey: 'breakBeforeRecommendations',
    noteKey: 'recommendationsNote',
    metadataKey: 'includeMetadataRecommendations',
    inputSectionId: 'toggle-section-recommendations',
    inputBreakId: 'toggle-break-recommendations',
    inputNoteId: 'input-custom-note-recommendations',
    inputMetadataId: 'toggle-metadata-recommendations',
    inputPaddingId: 'slider-padding-recommendations',
    paddingKey: 'paddingRecommendations',
    filenamePrefixKey: 'recommendationsFilenamePrefix',
    inputFilenamePrefixId: 'input-filename-prefix-recommendations',
    delimiterKey: 'recommendationsDelimiter',
    inputDelimiterId: 'select-delimiter-recommendations',
    showDividerKey: 'showDividerRecommendations',
    dividerColorKey: 'dividerColorRecommendations',
    dividerStyleKey: 'dividerStyleRecommendations',
    dividerThicknessKey: 'dividerThicknessRecommendations',
    inputDividerToggleId: 'toggle-show-dividers-recommendations',
    inputDividerStyleId: 'select-divider-style-recommendations',
    inputDividerThicknessId: 'select-divider-thickness-recommendations',
    tip: 'Pro-tip: Generated via automated heuristic rule engines analyzing lock contention hot-spots, index scan efficiency, and query cache hit rates.'
  },
  executiveSummary: {
    id: 'executiveSummary',
    icon: FileText,
    barColor: 'bg-purple-500',
    tag: 'Summary',
    title: 'Executive Narrative Callout',
    badge: 'Briefing',
    badgeClass: 'bg-purple-500/20 text-purple-300',
    description: 'Non-technical explanation of table mutex locks and latency degradation causality',
    includeKey: 'includeExecutiveSummary',
    breakKey: 'breakBeforeExecutiveSummary',
    noteKey: 'executiveSummaryNote',
    metadataKey: 'includeMetadataExecutiveSummary',
    inputSectionId: 'toggle-section-executive-summary',
    inputBreakId: 'toggle-break-executive-summary',
    inputNoteId: 'input-custom-note-executive-summary',
    inputMetadataId: 'toggle-metadata-executive-summary',
    inputPaddingId: 'slider-padding-executive-summary',
    paddingKey: 'paddingExecutiveSummary',
    filenamePrefixKey: 'executiveSummaryFilenamePrefix',
    inputFilenamePrefixId: 'input-filename-prefix-executive-summary',
    delimiterKey: 'executiveSummaryDelimiter',
    inputDelimiterId: 'select-delimiter-executive-summary',
    showDividerKey: 'showDividerExecutiveSummary',
    dividerColorKey: 'dividerColorExecutiveSummary',
    dividerStyleKey: 'dividerStyleExecutiveSummary',
    dividerThicknessKey: 'dividerThicknessExecutiveSummary',
    inputDividerToggleId: 'toggle-show-dividers-executive-summary',
    inputDividerStyleId: 'select-divider-style-executive-summary',
    inputDividerThicknessId: 'select-divider-thickness-executive-summary',
    tip: 'Pro-tip: Synthesized using executive summarization algorithms that translate low-level table mutex locks into business impact metrics.'
  }
};

export const DIVIDER_THICKNESS_OPTIONS = [
  { value: 1, label: '1px (Thin)' },
  { value: 1.5, label: '1.5px (Default)' },
  { value: 2, label: '2px (Medium)' },
  { value: 3, label: '3px (Thick)' },
] as const;

export const DIVIDER_STYLE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
] as const;

export const DIVIDER_COLOR_OPTIONS = [
  { value: '#cbd5e1', label: 'Slate (Default)', bgClass: 'bg-slate-300' },
  { value: '#f59e0b', label: 'Amber', bgClass: 'bg-amber-400' },
  { value: '#10b981', label: 'Emerald', bgClass: 'bg-emerald-400' },
  { value: '#3b82f6', label: 'Blue', bgClass: 'bg-blue-400' },
  { value: '#71717a', label: 'Zinc', bgClass: 'bg-zinc-400' },
  { value: '#ef4444', label: 'Rose', bgClass: 'bg-rose-400' },
];

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
  const [isExportCopied, setIsExportCopied] = useState<boolean>(false);
  const exportCopiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('csv');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Show confirmation prompt state: when enabled, requires confirmation modal before triggering CSV/JSON export
  const [isExportConfirmationPromptEnabled, setIsExportConfirmationPromptEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('applet_export_confirmation_prompt') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('applet_export_confirmation_prompt', String(isExportConfirmationPromptEnabled));
    } catch {
      // ignore
    }
  }, [isExportConfirmationPromptEnabled]);

  const [isExportConfirmationModalOpen, setIsExportConfirmationModalOpen] = useState<boolean>(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<ExportFormat>('csv');
  const [pendingExportIsFromShortcut, setPendingExportIsFromShortcut] = useState<boolean>(false);

  // Closes export confirmation modal while preserving tooltip pinned state if active
  const handleCloseExportConfirmationModal = () => {
    setIsExportConfirmationModalOpen(false);
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }
  };

  // Escape key handler to close export confirmation modal
  useEffect(() => {
    if (!isExportConfirmationModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExportConfirmationModalOpen(false);
        if (isTooltipPinnedRef.current) {
          setIsTooltipPinned(true);
          setIsExportHovered(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportConfirmationModalOpen]);

  // CSV Column Headers Inclusion / Exclusion state (dynamically updates serialization logic)
  const [includeCsvHeaders, setIncludeCsvHeaders] = useState<boolean>(true);
  const includeCsvHeadersRef = useRef(includeCsvHeaders);
  useEffect(() => {
    includeCsvHeadersRef.current = includeCsvHeaders;
  }, [includeCsvHeaders]);

  // Export operations history (last 10) correlated with system CPU usage for the sparkline
  const [exportHistory, setExportHistory] = useState<ExportHistoryPoint[]>(() => generateInitialExportHistory());
  const systemCpu = useSystemCpuMonitor();

  // Duration of last export to emphasize serialization performance on #btn-header-export-csv
  const lastExportDurationMs = useMemo(() => {
    if (headerExportStats?.durationMs !== undefined && headerExportStats?.durationMs !== null) {
      return headerExportStats.durationMs;
    }
    if (exportHistory.length > 0 && exportHistory[exportHistory.length - 1]?.durationMs !== undefined) {
      return exportHistory[exportHistory.length - 1].durationMs;
    }
    return null;
  }, [headerExportStats, exportHistory]);

  const formattedLastExportDuration = useMemo(() => {
    if (lastExportDurationMs === null || lastExportDurationMs === undefined) return null;
    const rounded = Math.round(lastExportDurationMs);
    const displayMs = lastExportDurationMs < 1 ? '<1' : rounded <= 0 ? '1' : rounded;
    return `Last: ${displayMs}ms`;
  }, [lastExportDurationMs]);

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
  const [isHeaderExportBtnHovered, setIsHeaderExportBtnHovered] = useState<boolean>(false);
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

  // Last completed database mutation tracking for #btn-header-export-csv 'Last Mutation' badge
  const appMountTimestamp = useRef<number>(Date.now());
  const [lastCompletedMutation, setLastCompletedMutation] = useState<DatabaseMutationHistoryEntry | null>(() =>
    getLastCompletedMutation()
  );
  const [completedMutationClock, setCompletedMutationClock] = useState<number>(() => Date.now());

  // Tracks explicit deferred export action requested by user while a database mutation is active
  const [deferredExportRequest, setDeferredExportRequest] = useState<{
    format: ExportFormat;
    isFromShortcut: boolean;
    timestamp: number;
  } | null>(null);

  // Live countdown ticker while database is mutating (100ms intervals for smooth sub-second updates)
  useEffect(() => {
    if (!isDatabaseMutatingState) return;
    const interval = setInterval(() => {
      setMutationClock(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, [isDatabaseMutatingState]);

  // Window in ms for a mutation to be considered "recently completed" (45 seconds)
  const RECENT_MUTATION_WINDOW_MS = 45000;

  // Active clock ticker while a recently completed mutation is within the window (updates every 500ms)
  useEffect(() => {
    const hasCandidate =
      Boolean(lastCompletedMutation?.completedAt) ||
      mutationHistory.some(
        (m) =>
          Boolean(m.completedAt) &&
          (!m.id?.startsWith('seed-') || (m.completedAt || 0) >= appMountTimestamp.current)
      );

    if (!hasCandidate) return;

    const interval = setInterval(() => {
      setCompletedMutationClock(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [lastCompletedMutation, mutationHistory]);

  // Derived state for the small 'Last Mutation' badge on #btn-header-export-csv
  const recentCompletedMutationInfo = useMemo(() => {
    let candidate = lastCompletedMutation;
    if (!candidate || !candidate.completedAt) {
      const fromHistory = mutationHistory
        .filter(
          (m) =>
            Boolean(m.completedAt && m.completedAt > 0) &&
            (!m.id?.startsWith('seed-') || (m.completedAt || 0) >= appMountTimestamp.current)
        )
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
      if (fromHistory) {
        candidate = fromHistory;
      }
    }

    if (!candidate || !candidate.completedAt) return null;

    const elapsedMs = Math.max(0, completedMutationClock - candidate.completedAt);
    if (elapsedMs > RECENT_MUTATION_WINDOW_MS) {
      return null;
    }

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const formattedDuration =
      elapsedSeconds < 1
        ? '<1s ago'
        : elapsedSeconds === 1
        ? '1s ago'
        : `${elapsedSeconds}s ago`;

    return {
      mutation: candidate,
      type: candidate.type,
      description: candidate.description,
      completedAt: candidate.completedAt,
      elapsedSeconds,
      formattedDuration,
      durationMs: candidate.durationMs
    };
  }, [lastCompletedMutation, mutationHistory, completedMutationClock]);

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
      const lastComp = getLastCompletedMutation();
      if (lastComp) {
        setLastCompletedMutation(lastComp);
        setCompletedMutationClock(Date.now());
      }
    });

    const handleMutationCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ mutation: DatabaseMutationHistoryEntry }>;
      if (customEvent.detail?.mutation) {
        setLastCompletedMutation(customEvent.detail.mutation);
        setCompletedMutationClock(Date.now());
      }
    };
    const handleMutationStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        isMutating: boolean;
        lastCompletedMutation?: DatabaseMutationHistoryEntry | null;
      }>;
      if (customEvent.detail?.lastCompletedMutation) {
        setLastCompletedMutation(customEvent.detail.lastCompletedMutation);
        setCompletedMutationClock(Date.now());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('db:mutation-completed', handleMutationCompleted);
      window.addEventListener('db:mutation-state-change', handleMutationStateChange);
    }

    return () => {
      unsubscribeCache();
      unsubscribeMutation();
      if (timer) clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('db:mutation-completed', handleMutationCompleted);
        window.removeEventListener('db:mutation-state-change', handleMutationStateChange);
      }
    };
  }, []);

  // Compute live countdown and expected wait time for deferred export action
  const deferredWaitCountdown = useMemo(() => {
    if (!isDatabaseMutatingState || pendingMutationsCount === 0 || activeMutationsList.length === 0) {
      return {
        remainingMs: 0,
        remainingSeconds: 0,
        formattedSeconds: '0.0s',
        formattedTimer: '00:00.0',
        totalExpectedMs: 2500,
        elapsedMs: 2500,
        percentComplete: 100,
        isDeferred: Boolean(isDatabaseMutatingState)
      };
    }

    const now = mutationClock;
    let maxRemainingMs = 0;
    let maxExpectedTotalDuration = 0;
    let maxElapsed = 0;

    activeMutationsList.forEach((m) => {
      const elapsed = Math.max(0, now - m.startedAt);
      const estDuration = m.estimatedDurationMs || 2500;
      const remaining = Math.max(100, estDuration - elapsed);
      if (remaining > maxRemainingMs) {
        maxRemainingMs = remaining;
        maxExpectedTotalDuration = estDuration;
        maxElapsed = elapsed;
      }
    });

    // Buffer 500ms per additional pending mutation for WAL frame flushes and B-Tree index balancing
    const queueBuffer = Math.max(0, pendingMutationsCount - 1) * 500;
    const totalRemainingMs = Math.max(100, maxRemainingMs + queueBuffer);
    const totalDurationWithBuffer = Math.max(totalRemainingMs, maxExpectedTotalDuration + queueBuffer);
    const remainingSeconds = Math.max(0.1, totalRemainingMs / 1000);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    const tenths = Math.floor((remainingSeconds * 10) % 10);
    const formattedSeconds = remainingSeconds >= 60
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;

    const progressPct = Math.min(
      98,
      Math.max(4, Math.round(((totalDurationWithBuffer - totalRemainingMs) / totalDurationWithBuffer) * 100))
    );

    return {
      remainingMs: totalRemainingMs,
      remainingSeconds,
      formattedSeconds,
      formattedTimer,
      totalExpectedMs: totalDurationWithBuffer,
      elapsedMs: maxElapsed,
      percentComplete: progressPct,
      isDeferred: true
    };
  }, [isDatabaseMutatingState, pendingMutationsCount, activeMutationsList, mutationClock]);

  // Compute estimated wait time based on active pending mutations and live countdown
  const estimatedWaitTimeText = useMemo(() => {
    if (!isDatabaseMutatingState || pendingMutationsCount === 0 || activeMutationsList.length === 0) {
      return 'Resuming shortly...';
    }
    const { remainingSeconds } = deferredWaitCountdown;
    if (remainingSeconds < 1) {
    }
  }, [isDatabaseMutatingState, pendingMutationsCount, activeMutationsList, deferredWaitCountdown]);

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
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }

    setIsExportingThresholdLogs(true);
    try {
      const escapeCsvValue = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
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
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to export threshold alerts audit logs as CSV:', err);
    } finally {
      setIsExportingThresholdLogs(false);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    }
  };

  const [isGeneratingDiagnosticReport, setIsGeneratingDiagnosticReport] = useState(false);
  const [isDiagnosticReportSuccess, setIsDiagnosticReportSuccess] = useState(false);

  const [isGeneratingDiagnosticPdf, setIsGeneratingDiagnosticPdf] = useState(false);
  const [isDiagnosticPdfSuccess, setIsDiagnosticPdfSuccess] = useState(false);
  const [diagnosticPdfError, setDiagnosticPdfError] = useState<string | null>(null);
  const [showPdfExportSettings, setShowPdfExportSettings] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const PDF_EXPORT_SECTIONS_STORAGE_KEY = 'benchmark_pdf_export_sections_config';

  const [pdfExportSections, setPdfExportSections] = useState<DiagnosticPdfSectionsConfig>(() => {
    const defaultSections: DiagnosticPdfSectionsConfig = {
      includePageNumbers: true,
      includeSparklines: true,
      includeMutationHistory: true,
      includeRecommendations: true,
      includeExecutiveSummary: true,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: true,
      breakBeforeRecommendations: true,
      breakBeforeExecutiveSummary: false,
      sparklinesNote: '',
      mutationHistoryNote: '',
      recommendationsNote: '',
      executiveSummaryNote: '',
      includeMetadataSparklines: true,
      includeMetadataMutationHistory: true,
      includeMetadataRecommendations: true,
      includeMetadataExecutiveSummary: true,
      paddingSparklines: 10,
      paddingMutationHistory: 10,
      paddingRecommendations: 10,
      paddingExecutiveSummary: 10,
      sparklinesDelimiter: ',',
      mutationHistoryDelimiter: ',',
      recommendationsDelimiter: ',',
      executiveSummaryDelimiter: ',',
      sparklinesFilenamePrefix: '',
      mutationHistoryFilenamePrefix: '',
      recommendationsFilenamePrefix: '',
      executiveSummaryFilenamePrefix: '',
      showDividerSparklines: true,
      showDividerMutationHistory: true,
      showDividerRecommendations: true,
      showDividerExecutiveSummary: true,
      dividerColor: '#cbd5e1',
      dividerColorSparklines: '#cbd5e1',
      dividerColorMutationHistory: '#cbd5e1',
      dividerColorRecommendations: '#cbd5e1',
      dividerColorExecutiveSummary: '#cbd5e1',
      dividerStyle: 'solid',
      dividerStyleSparklines: 'solid',
      dividerStyleMutationHistory: 'solid',
      dividerStyleRecommendations: 'solid',
      dividerStyleExecutiveSummary: 'solid',
      dividerThickness: 1.5,
      dividerThicknessSparklines: 1.5,
      dividerThicknessMutationHistory: 1.5,
      dividerThicknessRecommendations: 1.5,
      dividerThicknessExecutiveSummary: 1.5,
      sectionOrder: [...DEFAULT_PDF_SECTION_ORDER],
      sectionGroups: DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }))
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(PDF_EXPORT_SECTIONS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...defaultSections,
            ...parsed,
            showDividerSparklines: parsed.showDividerSparklines !== undefined ? parsed.showDividerSparklines : true,
            showDividerMutationHistory: parsed.showDividerMutationHistory !== undefined ? parsed.showDividerMutationHistory : true,
            showDividerRecommendations: parsed.showDividerRecommendations !== undefined ? parsed.showDividerRecommendations : true,
            showDividerExecutiveSummary: parsed.showDividerExecutiveSummary !== undefined ? parsed.showDividerExecutiveSummary : true,
            dividerColor: parsed.dividerColor || '#cbd5e1',
            dividerColorSparklines: parsed.dividerColorSparklines || '#cbd5e1',
            dividerColorMutationHistory: parsed.dividerColorMutationHistory || '#cbd5e1',
            dividerColorRecommendations: parsed.dividerColorRecommendations || '#cbd5e1',
            dividerColorExecutiveSummary: parsed.dividerColorExecutiveSummary || '#cbd5e1',
            dividerStyle: parsed.dividerStyle || 'solid',
            dividerStyleSparklines: parsed.dividerStyleSparklines || 'solid',
            dividerStyleMutationHistory: parsed.dividerStyleMutationHistory || 'solid',
            dividerStyleRecommendations: parsed.dividerStyleRecommendations || 'solid',
            dividerStyleExecutiveSummary: parsed.dividerStyleExecutiveSummary || 'solid',
            dividerThickness: parsed.dividerThickness !== undefined ? parsed.dividerThickness : 1.5,
            dividerThicknessSparklines: parsed.dividerThicknessSparklines !== undefined ? parsed.dividerThicknessSparklines : 1.5,
            dividerThicknessMutationHistory: parsed.dividerThicknessMutationHistory !== undefined ? parsed.dividerThicknessMutationHistory : 1.5,
            dividerThicknessRecommendations: parsed.dividerThicknessRecommendations !== undefined ? parsed.dividerThicknessRecommendations : 1.5,
            dividerThicknessExecutiveSummary: parsed.dividerThicknessExecutiveSummary !== undefined ? parsed.dividerThicknessExecutiveSummary : 1.5,
          };
        }
      } catch (err) {
        console.error('Failed to load stored PDF sections config:', err);
      }
    }
    return defaultSections;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(PDF_EXPORT_SECTIONS_STORAGE_KEY, JSON.stringify(pdfExportSections));
      } catch (err) {
        console.error('Failed to save PDF sections config to localStorage:', err);
      }
    }
  }, [pdfExportSections]);

  // Drag-and-drop state for PDF export sections reordering in #panel-pdf-export-settings
  const [draggedPdfSectionIndex, setDraggedPdfSectionIndex] = useState<number | null>(null);
  const [dragOverPdfSectionIndex, setDragOverPdfSectionIndex] = useState<number | null>(null);
  const [draggedPdfSectionId, setDraggedPdfSectionId] = useState<string | null>(null);
  const [dragOverPdfSectionId, setDragOverPdfSectionId] = useState<string | null>(null);
  const [collapsedPdfSections, setCollapsedPdfSections] = useState<Record<string, boolean>>({});
  const [hoveredPreviewSectionId, setHoveredPreviewSectionId] = useState<DiagnosticPdfSectionId | null>(null);
  const [activeInfoTooltipSectionId, setActiveInfoTooltipSectionId] = useState<string | null>(null);
  const [previewRefreshTimestamps, setPreviewRefreshTimestamps] = useState<Record<string, number>>({});
    const [generatingSnapshotSectionId, setGeneratingSnapshotSectionId] = useState<DiagnosticPdfSectionId | null>(null);
  const [copiedPdfSettings, setCopiedPdfSettings] = useState(false);
  const [copiedNoteSectionId, setCopiedNoteSectionId] = useState<DiagnosticPdfSectionId | null>(null);
  const [copiedSectionConfigId, setCopiedSectionConfigId] = useState<string | null>(null);
  const [copyConfigToast, setCopyConfigToast] = useState<{
    sectionId: string;
    sectionTitle: string;
    timestamp: number;
  } | null>(null);
  const copyConfigToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pdfSectionSearchQuery, setPdfSectionSearchQuery] = useState('');
  const [globalCsvNamingPattern, setGlobalCsvNamingPattern] = useState('{section_name}_{timestamp}');
  const [patternAppliedSuccess, setPatternAppliedSuccess] = useState(false);
  const [showPdfCardDescriptions, setShowPdfCardDescriptions] = useState(true);
  const [isDetailedPdfLayout, setIsDetailedPdfLayout] = useState(true);
  const [isGroupSectionsMode, setIsGroupSectionsMode] = useState(false);
  const [isGroupByTagActive, setIsGroupByTagActive] = useState(false);
  const [pdfSectionSortMode, setPdfSectionSortMode] = useState<'default' | 'title' | 'tag'>('default');
  const [resetSectionGroupsSuccess, setResetSectionGroupsSuccess] = useState(false);
  const [resetDividersSuccess, setResetDividersSuccess] = useState(false);
  const [pdfDividerColorFilter, setPdfDividerColorFilter] = useState<string>('all');

  const areAllSectionGroupsCollapsed = useMemo(() => {
    const groups = pdfExportSections.sectionGroups && pdfExportSections.sectionGroups.length > 0
      ? pdfExportSections.sectionGroups
      : DEFAULT_PDF_SECTION_GROUPS;
    return groups.length > 0 && groups.every((g) => g.isCollapsed);
  }, [pdfExportSections.sectionGroups]);

  const handleToggleAllSectionGroups = () => {
    setPdfExportSections((prev) => {
      const groups = prev.sectionGroups && prev.sectionGroups.length > 0
        ? prev.sectionGroups
        : DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }));

      const allCurrentlyCollapsed = groups.every((g) => g.isCollapsed);
      const nextCollapsedState = !allCurrentlyCollapsed;

      return {
        ...prev,
        sectionGroups: groups.map((g) => ({
          ...g,
          isCollapsed: nextCollapsedState
        }))
      };
    });
    setIsGroupSectionsMode(true);
  };

  const handleExpandAllSectionGroups = () => {
    setPdfExportSections((prev) => {
      const groups = prev.sectionGroups && prev.sectionGroups.length > 0
        ? prev.sectionGroups
        : DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }));
      return {
        ...prev,
        sectionGroups: groups.map((g) => ({ ...g, isCollapsed: false }))
      };
    });
    setIsGroupSectionsMode(true);
  };

  const handleCollapseAllSectionGroups = () => {
    setPdfExportSections((prev) => {
      const groups = prev.sectionGroups && prev.sectionGroups.length > 0
        ? prev.sectionGroups
        : DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }));
      return {
        ...prev,
        sectionGroups: groups.map((g) => ({ ...g, isCollapsed: true }))
      };
    });
    setIsGroupSectionsMode(true);
  };
  const [selectedSectionsForGroup, setSelectedSectionsForGroup] = useState<DiagnosticPdfSectionId[]>([]);
  const [newGroupTitleInput, setNewGroupTitleInput] = useState('');
  const noteChangeTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const getSectionMetricsExplanation = (
    baseId: DiagnosticPdfSectionId,
    displayTitle: string,
    recordsCount: number,
    violationsCount: number,
    isIncluded: boolean,
    paddingValue: number,
    isBreakBefore: boolean
  ) => {
    if (baseId === 'sparklines') {
      const pts = Math.max(12, Math.round(recordsCount * 1.5));
      return {
        category: 'Visual Latency & Write Frequency',
        summary: 'Dual-panel 50Hz timeseries tracking latency response and write mutation velocity against SLA thresholds.',
        metrics: [
          { label: '50Hz Latency Samples', value: `~${pts} telemetry data points tracking min, mean, and peak execution times` },
          { label: 'SLA Boundary Violations', value: `${violationsCount} detected threshold excursions (Warning: >80ms, Critical: >120ms)` },
          { label: 'Write Mutation Frequency', value: 'Rolling transactions/second frequency mapped against mutex contention' },
          { label: 'Document Layout', value: `Page break ${isBreakBefore ? 'Enabled' : 'Disabled'}, ${paddingValue}mm bottom padding, status: ${isIncluded ? 'Included' : 'Excluded'}` }
        ],
        textSummary: `Trend Sparklines metrics: ~${pts} latency telemetry sample points, ${violationsCount} SLA violations, write mutation velocity vs SLA limits (${isIncluded ? 'Included' : 'Excluded'}).`
      };
    } else if (baseId === 'mutationHistory') {
      return {
        category: 'Chronological Audit Chain',
        summary: 'Tabular audit log of database write clusters, lock acquisition times, and chronological root-cause sequence of events.',
        metrics: [
          { label: 'Database Mutation Rows', value: `${recordsCount} database transaction records currently queried & mapped` },
          { label: 'Lock Holding Duration', value: 'Transaction mutex acquisition latency & lock holding times (microseconds)' },
          { label: 'Causal Sequence of Events', value: 'Precursor operations, transaction commits, and rollback incidents' },
          { label: 'Metadata & Provenance', value: 'Lock mode (Shared/Exclusive), client thread origin, RFC 3339 timestamps' }
        ],
        textSummary: `Detailed Mutation History metrics: ${recordsCount} transaction mutation records, mutex lock holding durations, and root-cause events (${isIncluded ? 'Included' : 'Excluded'}).`
      };
    } else if (baseId === 'recommendations') {
      const findings = Math.min(10, Math.max(3, Math.round(recordsCount / 4)));
      return {
        category: 'Engineering Remediation',
        summary: 'Automated heuristic directives generated by diagnostic analyzer rules to resolve lock contention hotspots and database latency bottlenecks.',
        metrics: [
          { label: 'Prioritized Remediation Actions', value: `${findings} prioritized tactical directives (micro-batching, index optimization, connection pooling)` },
          { label: 'Index & Scan Efficiency', value: 'Sequential table scan vs index seek frequency ratio evaluation' },
          { label: 'Lock Contention Mitigation', value: 'Transaction isolation level tuning & deadlock prevention advisories' },
          { label: 'Impact & Severity Tiers', value: 'Categorized into High, Medium, and Low severity engineering action items' }
        ],
        textSummary: `Strategic Recommendations metrics: ${findings} prioritized engineering remediation items, index scan efficiency, and lock contention mitigation (${isIncluded ? 'Included' : 'Excluded'}).`
      };
    } else {
      const callouts = Math.max(1, Math.round(recordsCount / 8));
      return {
        category: 'Executive Narrative',
        summary: 'High-level management briefing that translates low-level table mutex locks into clear business risk and performance impact narratives.',
        metrics: [
          { label: 'Strategic Callouts', value: `${callouts} core non-technical summary findings explaining system degradation causality` },
          { label: 'Downtime Risk Level', value: `${violationsCount > 5 ? 'Elevated' : violationsCount > 0 ? 'Moderate' : 'Low'} operational risk assessment` },
          { label: 'Remediation Roadmap', value: 'Executive summary sign-off roadmap for engineering leadership and stakeholders' }
        ],
        textSummary: `Executive Narrative metrics: ${callouts} non-technical causality takeaways, SLA compliance score, and operational risk assessment (${isIncluded ? 'Included' : 'Excluded'}).`
      };
    }
  };

  const currentSectionOrder = useMemo(() => {
    const list = pdfExportSections.sectionOrder || DEFAULT_PDF_SECTION_ORDER;
    const cleanList: string[] = [];
    list.forEach((id) => {
      const baseId = id.includes('_dup_') ? id.split('_dup_')[0] : id;
      if (PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId] && !cleanList.includes(id)) {
        cleanList.push(id);
      }
    });
    DEFAULT_PDF_SECTION_ORDER.forEach((id) => {
      if (!cleanList.includes(id)) {
        cleanList.push(id);
      }
    });
    return cleanList;
  }, [pdfExportSections.sectionOrder]);

  const filteredSectionOrder = useMemo(() => {
    let list = currentSectionOrder;
    if (pdfSectionSortMode === 'title') {
      list = [...list].sort((a, b) => {
        const baseA = a.includes('_dup_') ? a.split('_dup_')[0] : a;
        const baseB = b.includes('_dup_') ? b.split('_dup_')[0] : b;
        const titleA = PDF_SECTION_CONFIG_ITEMS[baseA as DiagnosticPdfSectionId]?.title || '';
        const titleB = PDF_SECTION_CONFIG_ITEMS[baseB as DiagnosticPdfSectionId]?.title || '';
        return titleA.localeCompare(titleB);
      });
    } else if (pdfSectionSortMode === 'tag') {
      list = [...list].sort((a, b) => {
        const baseA = a.includes('_dup_') ? a.split('_dup_')[0] : a;
        const baseB = b.includes('_dup_') ? b.split('_dup_')[0] : b;
        const tagA = PDF_SECTION_CONFIG_ITEMS[baseA as DiagnosticPdfSectionId]?.tag || '';
        const tagB = PDF_SECTION_CONFIG_ITEMS[baseB as DiagnosticPdfSectionId]?.tag || '';
        return tagA.localeCompare(tagB);
      });
    }

    if (pdfSectionSearchQuery.trim()) {
      const q = pdfSectionSearchQuery.toLowerCase();
      list = list.filter((id) => {
        const baseId = id.includes('_dup_') ? id.split('_dup_')[0] : id;
        const item = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId];
        if (!item) return false;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.badge.toLowerCase().includes(q) ||
          (item.tag && item.tag.toLowerCase().includes(q))
        );
      });
    }

    if (pdfDividerColorFilter && pdfDividerColorFilter !== 'all') {
      const targetColor = pdfDividerColorFilter.toLowerCase();
      list = list.filter((id) => {
        const baseId = id.includes('_dup_') ? id.split('_dup_')[0] : id;
        const item = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId];
        if (!item) return false;
        const color = ((pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1').toLowerCase();
        return color === targetColor;
      });
    }

    if (isGroupByTagActive) {
      list = [...list].sort((a, b) => {
        const baseA = a.includes('_dup_') ? a.split('_dup_')[0] : a;
        const baseB = b.includes('_dup_') ? b.split('_dup_')[0] : b;
        const tagA = PDF_SECTION_CONFIG_ITEMS[baseA as DiagnosticPdfSectionId]?.tag || 'Other';
        const tagB = PDF_SECTION_CONFIG_ITEMS[baseB as DiagnosticPdfSectionId]?.tag || 'Other';
        return tagA.localeCompare(tagB);
      });
    }
    return list;
  }, [currentSectionOrder, pdfSectionSearchQuery, isGroupByTagActive, pdfSectionSortMode, pdfDividerColorFilter, pdfExportSections]);

  const dividerColorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DIVIDER_COLOR_OPTIONS.forEach((c) => {
      counts[c.value.toLowerCase()] = 0;
    });

    currentSectionOrder.forEach((id) => {
      const baseId = id.includes('_dup_') ? id.split('_dup_')[0] : id;
      const item = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId];
      if (!item) return;
      const color = ((pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1').toLowerCase();
      counts[color] = (counts[color] || 0) + 1;
    });
    return counts;
  }, [currentSectionOrder, pdfExportSections]);

  const [copiedAllNotes, setCopiedAllNotes] = useState(false);

  const handleCopyAllNotes = async () => {
    try {
      const notesList: string[] = [];
      filteredSectionOrder.forEach((id) => {
        const item = PDF_SECTION_CONFIG_ITEMS[id];
        if (item) {
          const note = String(pdfExportSections[item.noteKey] || '').trim();
          if (note) {
            notesList.push(`### ${item.title}\n${note}`);
          }
        }
      });
        (notesList.length > 0 ? notesList.join('\n\n') : '*(No custom notes entered for visible section cards)*');
      await navigator.clipboard.writeText(combinedText);
      setCopiedAllNotes(true);
      setTimeout(() => setCopiedAllNotes(false), 2000);
    } catch (err) {
      console.error('Failed to copy all notes:', err);
    }
  };

  const handleCopyPdfSettings = async () => {
    try {
      const jsonStr = JSON.stringify(pdfExportSections, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopiedPdfSettings(true);
      setTimeout(() => setCopiedPdfSettings(false), 2000);
    } catch (err) {
      console.error('Failed to copy PDF settings to clipboard:', err);
    }
  };

  // Auto-refresh listener for #panel-pdf-export-settings: automatically updates preview timestamps and refreshes snapshots when section inclusion, page breaks, notes, or section order update
  useEffect(() => {
    const timer = setTimeout(() => {
      // Refresh timestamps for all active sections to reflect latest configuration
      const now = Date.now();
      setPreviewRefreshTimestamps((prev) => {
        const next = { ...prev };
        DEFAULT_PDF_SECTION_ORDER.forEach((id) => {
          next[id] = now;
        });
        return next;
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [
    pdfExportSections.includeSparklines,
    pdfExportSections.includeMutationHistory,
    pdfExportSections.includeRecommendations,
    pdfExportSections.includeExecutiveSummary,
    pdfExportSections.breakBeforeSparklines,
    pdfExportSections.breakBeforeMutationHistory,
    pdfExportSections.breakBeforeRecommendations,
    pdfExportSections.breakBeforeExecutiveSummary,
    pdfExportSections.showDividerSparklines,
    pdfExportSections.showDividerMutationHistory,
    pdfExportSections.showDividerRecommendations,
    pdfExportSections.showDividerExecutiveSummary,
    pdfExportSections.dividerStyleSparklines,
    pdfExportSections.dividerStyleMutationHistory,
    pdfExportSections.dividerStyleRecommendations,
    pdfExportSections.dividerStyleExecutiveSummary,
    pdfExportSections.sparklinesNote,
    pdfExportSections.mutationHistoryNote,
    pdfExportSections.recommendationsNote,
    pdfExportSections.executiveSummaryNote,
    pdfExportSections.sectionOrder
  ]);



  const isOrderCustomized = useMemo(() => {
    const current = pdfExportSections.sectionOrder || DEFAULT_PDF_SECTION_ORDER;
    if (current.length !== DEFAULT_PDF_SECTION_ORDER.length) return true;
    return current.some((val, idx) => val !== DEFAULT_PDF_SECTION_ORDER[idx]);
  }, [pdfExportSections.sectionOrder]);

  const handleMovePdfSectionBySectionId = (sectionId: string, direction: 'up' | 'down') => {
    setPdfExportSections((prev) => {
      const order = [...(prev.sectionOrder || DEFAULT_PDF_SECTION_ORDER)];
      const fromIndex = order.indexOf(sectionId);
      if (fromIndex === -1) return prev;
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= order.length) return prev;
      const [movedItem] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, movedItem);
      return {
        ...prev,
        sectionOrder: order
      };
    });
  };

  const handleMovePdfSection = (fromIndex: number, toIndex: number) => {
    setPdfExportSections((prev) => {
      const order = [...(prev.sectionOrder || DEFAULT_PDF_SECTION_ORDER)];
      if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length) {
        return prev;
      }
      const [movedItem] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, movedItem);
      return {
        ...prev,
        sectionOrder: order
      };
    });
  };

  const handleDuplicatePdfSection = (baseId: string) => {
    const item = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId];
    if (!item) return;
    setPdfExportSections((prev) => {
      const order = [...(prev.sectionOrder || DEFAULT_PDF_SECTION_ORDER)];
      order.push(newId as any);
      return {
        ...prev,
        sectionOrder: order
      };
    });
  };

  const handleRemovePdfSection = (sectionId: string) => {
    setPdfExportSections((prev) => {
      const order = [...(prev.sectionOrder || DEFAULT_PDF_SECTION_ORDER)].filter((id) => id !== sectionId);
      return {
        ...prev,
        sectionOrder: order
      };
    });
  };

  const handleBulkTogglePdfSections = (enable: boolean) => {
    setPdfExportSections((prev) => ({
      ...prev,
      includeSparklines: enable,
      includeMutationHistory: enable,
      includeRecommendations: enable,
      includeExecutiveSummary: enable,
    }));
  };

  const handleBulkSetPadding = (padding: number) => {
    setPdfExportSections((prev) => ({
      ...prev,
      paddingSparklines: padding,
      paddingMutationHistory: padding,
      paddingRecommendations: padding,
      paddingExecutiveSummary: padding,
    }));
  };

  const handleToggleSelectSectionForGroup = (sectionId: DiagnosticPdfSectionId) => {
    setSelectedSectionsForGroup((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const handleCreateSectionGroup = () => {
    if (selectedSectionsForGroup.length === 0) return;
    const groupTitle = newGroupTitleInput.trim() || `Folder Group ${(pdfExportSections.sectionGroups?.length || 0) + 1}`;
    const newGroup = {
      title: groupTitle,
      sectionIds: [...selectedSectionsForGroup],
      isCollapsed: false
    };
    setPdfExportSections((prev) => ({
      ...prev,
      sectionGroups: [...(prev.sectionGroups || []), newGroup]
    }));
    setSelectedSectionsForGroup([]);
    setNewGroupTitleInput('');
  };

  const handleDeleteSectionGroup = (groupId: string) => {
    setPdfExportSections((prev) => ({
      ...prev,
      sectionGroups: (prev.sectionGroups || []).filter((g) => g.id !== groupId)
    }));
  };

  const handleToggleSectionGroupCollapse = (groupId: string) => {
    setPdfExportSections((prev) => ({
      ...prev,
      sectionGroups: (prev.sectionGroups || []).map((g) =>
        g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
      )
    }));
  };

  const handleResetSectionGroup = (groupId: string) => {
    const group = (pdfExportSections.sectionGroups || []).find((g) => g.id === groupId);
    if (!group) return;
    setPdfExportSections((prev) => {
      const next = { ...prev };
      group.sectionIds.forEach((sectionId) => {
        const item = PDF_SECTION_CONFIG_ITEMS[sectionId];
        if (item) {
          next[item.includeKey] = true;
          next[item.breakKey] = false;
          next[item.noteKey] = '';
          next[item.metadataKey] = false;
          next[item.paddingKey] = 10;
        }
      });
      return next;
    });
  };

    const handleGenerateSnapshot = async (sectionId: DiagnosticPdfSectionId) => {
    setGeneratingSnapshotSectionId(sectionId);
    setHoveredPreviewSectionId(sectionId);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setPreviewRefreshTimestamps((prev) => ({ ...prev, [sectionId]: Date.now() }));
    setGeneratingSnapshotSectionId(null);
  };

  const handleResetPdfSectionOrder = () => {
    setPdfExportSections((prev) => ({
      ...prev,
      sectionOrder: [...DEFAULT_PDF_SECTION_ORDER]
    }));
  };

  const handleResetAllPdfLayouts = () => {
    setPdfExportSections({
      includeSparklines: true,
      includeMutationHistory: true,
      includeRecommendations: true,
      includeExecutiveSummary: true,
      breakBeforeSparklines: false,
      breakBeforeMutationHistory: true,
      breakBeforeRecommendations: true,
      breakBeforeExecutiveSummary: false,
      sparklinesNote: '',
      mutationHistoryNote: '',
      recommendationsNote: '',
      executiveSummaryNote: '',
      includeMetadataSparklines: true,
      includeMetadataMutationHistory: true,
      includeMetadataRecommendations: true,
      includeMetadataExecutiveSummary: true,
      paddingSparklines: 10,
      paddingMutationHistory: 10,
      paddingRecommendations: 10,
      paddingExecutiveSummary: 10,
      sparklinesDelimiter: ',',
      mutationHistoryDelimiter: ',',
      recommendationsDelimiter: ',',
      executiveSummaryDelimiter: ',',
      sparklinesFilenamePrefix: '',
      mutationHistoryFilenamePrefix: '',
      recommendationsFilenamePrefix: '',
      executiveSummaryFilenamePrefix: '',
      showDividerSparklines: true,
      showDividerMutationHistory: true,
      showDividerRecommendations: true,
      showDividerExecutiveSummary: true,
      sectionOrder: [...DEFAULT_PDF_SECTION_ORDER]
    });
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(`card-pdf-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-950/50', 'transition-all', 'duration-500');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-950/50');
      }, 2000);
    }
  };

  const handleResetSectionGroups = () => {
    setPdfExportSections((prev) => ({
      ...prev,
      sectionGroups: DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g, isCollapsed: false })),
      groupByTag: false,
      sectionOrder: [...DEFAULT_PDF_SECTION_ORDER]
    }));
    setIsGroupByTagActive(false);
    setPdfSectionSortMode('default');
    setIsGroupSectionsMode(false);
    setSelectedSectionsForGroup([]);
    setNewGroupTitleInput('');
    setResetSectionGroupsSuccess(true);
    setTimeout(() => {
      setResetSectionGroupsSuccess(false);
    }, 2000);
  };

  const handleResetAllDividers = () => {
    setPdfExportSections((prev) => {
      const next = { ...prev };
      // Globally reset Show Dividers status for all sections back to system default (true)
      next.showDividerSparklines = true;
      next.showDividerMutationHistory = true;
      next.showDividerRecommendations = true;
      next.showDividerExecutiveSummary = true;

      // Globally reset divider colors for all sections back to system default (Slate: #cbd5e1)
      next.dividerColor = '#cbd5e1';
      next.dividerColorSparklines = '#cbd5e1';
      next.dividerColorMutationHistory = '#cbd5e1';
      next.dividerColorRecommendations = '#cbd5e1';
      next.dividerColorExecutiveSummary = '#cbd5e1';

      // Globally reset divider line styles for all sections back to system default (Solid)
      next.dividerStyle = 'solid';
      next.dividerStyleSparklines = 'solid';
      next.dividerStyleMutationHistory = 'solid';
      next.dividerStyleRecommendations = 'solid';
      next.dividerStyleExecutiveSummary = 'solid';

      // Globally reset divider thickness for all sections back to system default (1.5px)
      next.dividerThickness = 1.5;
      next.dividerThicknessSparklines = 1.5;
      next.dividerThicknessMutationHistory = 1.5;
      next.dividerThicknessRecommendations = 1.5;
      next.dividerThicknessExecutiveSummary = 1.5;

      // Reset any duplicate or dynamically configured section keys
      Object.keys(next).forEach((key) => {
        if (key.startsWith('showDivider')) {
          (next as any)[key] = true;
        }
        if (key.startsWith('dividerColor')) {
          (next as any)[key] = '#cbd5e1';
        }
        if (key.startsWith('dividerStyle')) {
          (next as any)[key] = 'solid';
        }
        if (key.startsWith('dividerThickness')) {
          (next as any)[key] = 1.5;
        }
      });

      return next;
    });

    // Refresh snapshots for all sections so changes immediately reflect in live previews
    DEFAULT_PDF_SECTION_ORDER.forEach((id) => {
      handleGenerateSnapshot(id);
    });

    setPdfDividerColorFilter('all');
    setResetDividersSuccess(true);
    setTimeout(() => {
      setResetDividersSuccess(false);
    }, 2000);
  };

  const handleAutoGroupCategories = () => {
    const categoryMap: Record<string, DiagnosticPdfSectionId[]> = {
      'Metrics': [],
      'Logs': [],
      'Strategy': [],
      'Summary': []
    };

    DEFAULT_PDF_SECTION_ORDER.forEach((id) => {
      const item = PDF_SECTION_CONFIG_ITEMS[id];
      if (item) {
        const cat = item.tag || 'Metrics';
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(id);
      }
    });

    const newGroups = Object.entries(categoryMap)
      .filter(([_, ids]) => ids.length > 0)
      .map(([catName, ids], idx) => ({
        title: `${catName} Domain Group`,
        sectionIds: ids,
        isCollapsed: false
      }));

    setPdfExportSections((prev) => ({
      ...prev,
      sectionGroups: newGroups
    }));
    setIsGroupSectionsMode(true);
  };

  const resolveNamingPattern = (pattern: string, sectionId: string, dateObj: Date = new Date()) => {
    const sectionSlugs: Record<string, string> = {
      sparklines: 'sparklines',
      mutationHistory: 'mutation_history',
      recommendations: 'recommendations',
      executiveSummary: 'executive_summary'
    };
    const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
    const sectionSlug = sectionSlugs[baseId] || baseId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const sectionTitle = (PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId]?.title || sectionId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');

    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const mm = pad(dateObj.getMonth() + 1);
    const dd = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const min = pad(dateObj.getMinutes());
    const ss = pad(dateObj.getSeconds());

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    const recordsCount = String(queryResult.records.length || 0);

    const safePattern = (pattern || '{section_name}_{timestamp}').trim();
    let resolved = safePattern
      .replace(/{section_name}/gi, sectionSlug)
      .replace(/{section_title}/gi, sectionTitle)
      .replace(/{section_id}/gi, sectionId)
      .replace(/{timestamp}/gi, timeStr)
      .replace(/{date}/gi, dateStr)
      .replace(/{records}/gi, recordsCount);

    resolved = resolved.replace(/[\/\\:*?"<>|]/g, '_').trim();
    return resolved || `${sectionSlug}_${timeStr}`;
  };

  const handleApplyNamingPatternToAllCards = () => {
    const pattern = globalCsvNamingPattern.trim() || '{section_name}_{timestamp}';
    const now = new Date();
    setPdfExportSections((prev) => {
      const next = { ...prev, globalCsvNamingPattern: pattern };
      Object.values(PDF_SECTION_CONFIG_ITEMS).forEach((item) => {
        const resolved = resolveNamingPattern(pattern, item.id, now);
        next[item.filenamePrefixKey] = resolved;
      });
      return next;
    });
    setPatternAppliedSuccess(true);
    setTimeout(() => setPatternAppliedSuccess(false), 2500);
  };

  const handleResetAllFilenamePrefixes = () => {
    setPdfExportSections((prev) => {
      const next = { ...prev };
      Object.values(PDF_SECTION_CONFIG_ITEMS).forEach((item) => {
        next[item.filenamePrefixKey] = '';
      });
      return next;
    });
  };

  const handleExportSectionData = (sectionId: DiagnosticPdfSectionId) => {
    const itemConfig = PDF_SECTION_CONFIG_ITEMS[sectionId];
    const prefixKey = itemConfig?.filenamePrefixKey;
    const customPrefix = prefixKey ? (pdfExportSections as any)[prefixKey] : '';
    let cleanPrefix = '';
    if (customPrefix && customPrefix.trim()) {
      cleanPrefix = customPrefix.includes('{')
        ? resolveNamingPattern(customPrefix, sectionId)
        : customPrefix.trim();
    } else {
      cleanPrefix = resolveNamingPattern(globalCsvNamingPattern || '{section_name}_{timestamp}', sectionId);
    }
    const delimiterKey = itemConfig?.delimiterKey;
    const rawDelimiter = delimiterKey ? (pdfExportSections as any)[delimiterKey] : ',';
    const delimiter = rawDelimiter === '\t' || rawDelimiter === '\\t' || rawDelimiter === 'tab' ? '\t' : rawDelimiter === ';' ? ';' : ',';
    let filename = `${cleanPrefix}${delimiter === '\t' ? '.tsv' : '.csv'}`;

    let rows: string[][] = [];
    if (sectionId === 'sparklines') {
      rows.push(['Timestamp', 'RecordID', 'MetricName', 'Value']);
      queryResult.records.forEach((rec) => {
        rows.push([new Date(rec.timestamp).toISOString(), String(rec.id), 'PrimaryMetric', String(rec.primaryMetricValue ?? 0)]);
      });
    } else if (sectionId === 'mutationHistory') {
      rows.push(['ID', 'Timestamp', 'DatabaseTable', 'Operation', 'Severity']);
      queryResult.records.forEach((rec) => {
        rows.push([String(rec.id), new Date(rec.timestamp).toISOString(), rec.dbTable || 'MainTable', rec.operation || 'UPDATE', rec.severity || 'INFO']);
      });
    } else if (sectionId === 'recommendations') {
      rows.push(['ItemID', 'Title', 'Category', 'Priority', 'Description']);
      rows.push(['REC-01', 'Optimize Index Coverage', 'Database', 'High', 'Add compound index on timestamp and severity for faster range scans.']);
      rows.push(['REC-02', 'Cache Aggregation Queries', 'Performance', 'Medium', 'Enable Redis query result caching for frequent metric summaries.']);
      rows.push(['REC-03', 'Adjust Polling Frequency', 'Monitoring', 'Low', 'Reduce heartbeat polling frequency during off-peak hours to save bandwidth.']);
    } else if (sectionId === 'executiveSummary') {
      rows.push(['FindingID', 'Category', 'Severity', 'Summary']);
      rows.push(['FIND-01', 'System Health', 'Normal', 'All primary health checks passing within normal operational parameters.']);
      rows.push(['FIND-02', 'Database Latency', 'Warning', 'P95 query latency spiked briefly during background compaction.']);
    } else {
      rows.push(['RecordID', 'Timestamp', 'Value']);
      queryResult.records.forEach((rec) => {
        rows.push([String(rec.id), new Date(rec.timestamp).toISOString(), String(rec.primaryMetricValue ?? 0)]);
      });
    }

    const d = delimiter === '\t' ? '\t' : delimiter;
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(d)).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSectionStats = (sectionId: DiagnosticPdfSectionId) => {
    const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
    const itemConfig = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId] || PDF_SECTION_CONFIG_ITEMS[sectionId as DiagnosticPdfSectionId];
    if (!itemConfig) return;

    const isIncluded = Boolean((pdfExportSections as any)[itemConfig.includeKey]);
    const padding = Number((pdfExportSections as any)[itemConfig.paddingKey] ?? 10);
    const note = String((pdfExportSections as any)[itemConfig.noteKey] || '');
    const rawDelimiter = (pdfExportSections as any)[itemConfig.delimiterKey] || ',';
    const delimiter = rawDelimiter === '\t' || rawDelimiter === '\\t' || rawDelimiter === 'tab' ? '\t' : rawDelimiter === ';' ? ';' : ',';
    const delimiterName = delimiter === '\t' ? 'Tab' : delimiter === ';' ? 'Semicolon' : 'Comma';
    const breakBefore = Boolean((pdfExportSections as any)[itemConfig.breakKey]);
    const isDivider = (pdfExportSections as any)[itemConfig.showDividerKey] !== false;
    const includeMetadata = Boolean((pdfExportSections as any)[itemConfig.metadataKey]);
    const filenamePrefix = String((pdfExportSections as any)[itemConfig.filenamePrefixKey] || '');
    const evaluatedPrefix = resolveNamingPattern(filenamePrefix || globalCsvNamingPattern, sectionId);

    const statsPayload = {
      sectionId,
      baseId,
      sectionTitle: itemConfig.title,
      category: itemConfig.tag,
      description: itemConfig.description,
      isIncluded,
      exportedAt: new Date().toISOString(),
      configurationMetadata: {
        padding: {
          value: padding,
          unit: 'px',
          default: 10,
          isCustomized: padding !== 10
        },
        note: {
          content: note,
          hasCustomNote: Boolean(note.trim()),
          length: note.length
        },
        delimiters: {
          selectedDelimiter: delimiter === '\t' ? '\\t' : delimiter,
          delimiterName: delimiterName,
          fileExtension: delimiter === '\t' ? '.tsv' : '.csv',
          options: ['Comma (,)', 'Tab (\\t)', 'Semicolon (;)']
        },
        breakSettings: {
          breakBefore: breakBefore,
          isPageBreakEnabled: breakBefore,
          behavior: breakBefore ? 'Force start on new PDF page' : 'Render continuously after previous section'
        },
        dividerSettings: {
          showDivider: isDivider,
          isDividerVisible: isDivider,
          dividerColor: (pdfExportSections as any)[itemConfig.dividerColorKey] || '#cbd5e1',
          dividerStyle: (pdfExportSections as any)[itemConfig.dividerStyleKey] || 'solid',
          behavior: isDivider ? `Render visible ${(pdfExportSections as any)[itemConfig.dividerStyleKey] || 'solid'} separator line between sections` : 'No separator line'
        },
        additionalSettings: {
          includeMetadataFooter: includeMetadata,
          customFilenamePrefix: filenamePrefix || null,
          evaluatedExportFilename: `${evaluatedPrefix}${delimiter === '\t' ? '.tsv' : '.csv'}`
        }
      },
      summary: {
        totalConfiguredFields: 5,
        paddingPx: padding,
        hasNote: Boolean(note.trim()),
        delimiter: delimiterName,
        pageBreak: breakBefore ? 'Enabled' : 'Disabled',
        showDividers: isDivider ? 'Enabled' : 'Disabled'
      }
    };

    const jsonString = JSON.stringify(statsPayload, null, 2);
    const encodedUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${sectionId}_section_stats.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySectionConfiguration = async (sectionId: string) => {
    const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
    const itemConfig = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId] || PDF_SECTION_CONFIG_ITEMS[sectionId as DiagnosticPdfSectionId];
    if (!itemConfig) return;

    const isIncluded = Boolean((pdfExportSections as any)[itemConfig.includeKey]);
    const padding = Number((pdfExportSections as any)[itemConfig.paddingKey] ?? 10);
    const note = String((pdfExportSections as any)[itemConfig.noteKey] || '');
    const rawDelimiter = (pdfExportSections as any)[itemConfig.delimiterKey] || ',';
    const delimiter = rawDelimiter === '\t' || rawDelimiter === '\\t' || rawDelimiter === 'tab' ? '\t' : rawDelimiter === ';' ? ';' : ',';
    const delimiterLabel = delimiter === '\t' ? 'Tab' : delimiter === ';' ? 'Semicolon' : 'Comma';
    const breakBefore = Boolean((pdfExportSections as any)[itemConfig.breakKey]);
    const isDivider = (pdfExportSections as any)[itemConfig.showDividerKey] !== false;
    const dividerColor = (pdfExportSections as any)[itemConfig.dividerColorKey] || '#cbd5e1';
    const dividerStyle = (pdfExportSections as any)[itemConfig.dividerStyleKey] || 'solid';
    const dividerThickness = Number((pdfExportSections as any)[itemConfig.dividerThicknessKey] ?? 1.5);
    const includeMetadata = Boolean((pdfExportSections as any)[itemConfig.metadataKey]);
    const filenamePrefix = String((pdfExportSections as any)[itemConfig.filenamePrefixKey] || '');

    const configPayload = {
      sectionId,
      sectionTitle: itemConfig.title,
      category: itemConfig.tag,
      description: itemConfig.description,
      isIncluded,
      padding,
      note,
      delimiter: delimiter === '\t' ? '\\t' : delimiter,
      metadata: includeMetadata,
      dividers: isDivider,
      dividerColor,
      dividerStyle,
      dividerThickness,
      breakBefore,
      filenamePrefix,
      configuration: {
        padding,
        note,
        delimiter: delimiter === '\t' ? '\\t' : delimiter,
        metadata: includeMetadata,
        dividers: isDivider,
        dividerColor,
        dividerStyle,
        dividerThickness
      },
      exportedAt: new Date().toISOString()
    };

    const formattedJson = JSON.stringify(configPayload, null, 2);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedJson);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = formattedJson;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSectionConfigId(sectionId);
      setTimeout(() => {
        setCopiedSectionConfigId(null);
      }, 2000);

      // Trigger toast notification at bottom of screen
      if (copyConfigToastTimeoutRef.current) {
        clearTimeout(copyConfigToastTimeoutRef.current);
      }
      setCopyConfigToast({
        sectionId,
        sectionTitle: itemConfig.title,
        timestamp: Date.now()
      });
      copyConfigToastTimeoutRef.current = setTimeout(() => {
        setCopyConfigToast(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy section configuration to clipboard:', err);
    }
  };

  const handleDividerUpdate = (
    fieldKey: 'show' | 'color' | 'style' | 'thickness',
    val: any,
    targetItem: { showDividerKey: string; dividerColorKey: string; dividerStyleKey: string; dividerThicknessKey: string; id: DiagnosticPdfSectionId }
  ) => {
    setPdfExportSections((prev) => {
      const next = { ...prev };
      if (isSyncDividersLocked) {
        Object.values(PDF_SECTION_CONFIG_ITEMS).forEach((item) => {
          if (fieldKey === 'show') {
            (next as any)[item.showDividerKey] = val;
          } else if (fieldKey === 'color') {
            (next as any)[item.dividerColorKey] = val;
          } else if (fieldKey === 'style') {
            (next as any)[item.dividerStyleKey] = val;
            (next as any)[item.showDividerKey] = true;
          } else if (fieldKey === 'thickness') {
            (next as any)[item.dividerThicknessKey] = val;
          }
        });
      } else {
        if (fieldKey === 'show') {
          (next as any)[targetItem.showDividerKey] = val;
        } else if (fieldKey === 'color') {
          (next as any)[targetItem.dividerColorKey] = val;
        } else if (fieldKey === 'style') {
          (next as any)[targetItem.dividerStyleKey] = val;
          (next as any)[targetItem.showDividerKey] = true;
        } else if (fieldKey === 'thickness') {
          (next as any)[targetItem.dividerThicknessKey] = val;
        }
      }
      return next;
    });
    if (isSyncDividersLocked) {
      DEFAULT_PDF_SECTION_ORDER.forEach((id) => handleGenerateSnapshot(id));
    } else {
      handleGenerateSnapshot(targetItem.id);
    }
  };

  const handleResetSinglePdfSection = (sectionId: DiagnosticPdfSectionId) => {
    setPdfExportSections((prev) => {
      const next = { ...prev };
      if (sectionId === 'sparklines') {
        next.sparklinesNote = '';
        next.paddingSparklines = 10;
        next.breakBeforeSparklines = false;
        next.includeMetadataSparklines = true;
        next.sparklinesFilenamePrefix = '';
        next.sparklinesDelimiter = ',';
        next.showDividerSparklines = true;
        next.dividerColorSparklines = '#cbd5e1';
        next.dividerStyleSparklines = 'solid';
        next.dividerThicknessSparklines = 1.5;
      } else if (sectionId === 'mutationHistory') {
        next.mutationHistoryNote = '';
        next.paddingMutationHistory = 10;
        next.mutationHistoryFilenamePrefix = '';
        next.mutationHistoryDelimiter = ',';
        next.showDividerMutationHistory = true;
        next.dividerColorMutationHistory = '#cbd5e1';
        next.dividerStyleMutationHistory = 'solid';
        next.dividerThicknessMutationHistory = 1.5;
        next.breakBeforeMutationHistory = true;
        next.includeMetadataMutationHistory = true;
      } else if (sectionId === 'recommendations') {
        next.recommendationsNote = '';
        next.paddingRecommendations = 10;
        next.breakBeforeRecommendations = true;
        next.includeMetadataRecommendations = true;
        next.recommendationsFilenamePrefix = '';
        next.recommendationsDelimiter = ',';
        next.showDividerRecommendations = true;
        next.dividerColorRecommendations = '#cbd5e1';
        next.dividerStyleRecommendations = 'solid';
        next.dividerThicknessRecommendations = 1.5;
      } else if (sectionId === 'executiveSummary') {
        next.executiveSummaryNote = '';
        next.paddingExecutiveSummary = 10;
        next.breakBeforeExecutiveSummary = false;
        next.includeMetadataExecutiveSummary = true;
        next.executiveSummaryFilenamePrefix = '';
        next.executiveSummaryDelimiter = ',';
        next.showDividerExecutiveSummary = true;
        next.dividerColorExecutiveSummary = '#cbd5e1';
        next.dividerStyleExecutiveSummary = 'solid';
        next.dividerThicknessExecutiveSummary = 1.5;
      }
      return next;
    });
  };

  const handlePdfSectionDragStart = (e: React.DragEvent, index: number, sectionId?: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (sectionId) {
      e.dataTransfer.setData('application/x-section-id', sectionId);
      setDraggedPdfSectionId(sectionId);
    }
    setDraggedPdfSectionIndex(index);
  };

  const handlePdfSectionDragOver = (e: React.DragEvent, index: number, sectionId?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPdfSectionIndex !== index) {
      setDragOverPdfSectionIndex(index);
    }
    if (sectionId && dragOverPdfSectionId !== sectionId) {
      setDragOverPdfSectionId(sectionId);
    }
  };

  const handlePdfSectionDragEnter = (e: React.DragEvent, index: number, sectionId?: string) => {
    e.preventDefault();
    setDragOverPdfSectionIndex(index);
    if (sectionId) {
      setDragOverPdfSectionId(sectionId);
    }
  };

  const handlePdfSectionDragLeave = (e: React.DragEvent, index: number, sectionId?: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dragOverPdfSectionIndex === index) {
      setDragOverPdfSectionIndex(null);
    }
    if (sectionId && dragOverPdfSectionId === sectionId) {
      setDragOverPdfSectionId(null);
    }
  };

  const handlePdfSectionDrop = (e: React.DragEvent, targetIndex: number, targetSectionId?: string) => {
    e.preventDefault();
    const sourceSectionId = draggedPdfSectionId || e.dataTransfer.getData('application/x-section-id');
    if (sourceSectionId && targetSectionId && sourceSectionId !== targetSectionId) {
      setPdfExportSections((prev) => {
        const order = [...(prev.sectionOrder || DEFAULT_PDF_SECTION_ORDER)];
        const fromIdx = order.indexOf(sourceSectionId);
        const toIdx = order.indexOf(targetSectionId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [movedItem] = order.splice(fromIdx, 1);
          order.splice(toIdx, 0, movedItem);
          return {
            ...prev,
            sectionOrder: order
          };
        }
        return prev;
      });
    } else {
      const sourceRaw = e.dataTransfer.getData('text/plain');
      const sourceIndex = draggedPdfSectionIndex !== null ? draggedPdfSectionIndex : parseInt(sourceRaw, 10);
      if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
        handleMovePdfSection(sourceIndex, targetIndex);
      }
    }
    setDraggedPdfSectionIndex(null);
    setDraggedPdfSectionId(null);
    setDragOverPdfSectionIndex(null);
    setDragOverPdfSectionId(null);
  };

  const handlePdfSectionDragEnd = () => {
    setDraggedPdfSectionIndex(null);
    setDraggedPdfSectionId(null);
    setDragOverPdfSectionIndex(null);
    setDragOverPdfSectionId(null);
  };

  const [showBatchExportModal, setShowBatchExportModal] = useState(false);

  const handleBatchExportAllSections = () => {
    setShowBatchExportModal(true);
  };

  const confirmBatchExport = () => {
    setShowBatchExportModal(false);
    Object.values(PDF_SECTION_CONFIG_ITEMS).forEach((item, idx) => {
      const isIncluded = Boolean((pdfExportSections as any)[item.includeKey]);
      if (isIncluded) {
        setTimeout(() => {
          handleExportSectionData(item.id);
        }, idx * 250);
      }
    });
  };

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
        setPdfExportSections((prev) => ({
          ...prev,
          ...savedCustomPdfTemplate.sections,
          showDividerSparklines: savedCustomPdfTemplate.sections.showDividerSparklines ?? prev.showDividerSparklines ?? true,
          showDividerMutationHistory: savedCustomPdfTemplate.sections.showDividerMutationHistory ?? prev.showDividerMutationHistory ?? true,
          showDividerRecommendations: savedCustomPdfTemplate.sections.showDividerRecommendations ?? prev.showDividerRecommendations ?? true,
          showDividerExecutiveSummary: savedCustomPdfTemplate.sections.showDividerExecutiveSummary ?? prev.showDividerExecutiveSummary ?? true,
          sectionOrder: savedCustomPdfTemplate.sections.sectionOrder || prev.sectionOrder || [...DEFAULT_PDF_SECTION_ORDER]
        }));
      }
      return;
    }
    const found = PREDEFINED_PDF_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      setPdfExportSections((prev) => ({
        ...prev,
        ...found.sections,
        showDividerSparklines: found.sections.showDividerSparklines ?? prev.showDividerSparklines ?? true,
        showDividerMutationHistory: found.sections.showDividerMutationHistory ?? prev.showDividerMutationHistory ?? true,
        showDividerRecommendations: found.sections.showDividerRecommendations ?? prev.showDividerRecommendations ?? true,
        showDividerExecutiveSummary: found.sections.showDividerExecutiveSummary ?? prev.showDividerExecutiveSummary ?? true,
        sectionOrder: found.sections.sectionOrder || prev.sectionOrder || [...DEFAULT_PDF_SECTION_ORDER]
      }));
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
      setPdfExportSections((prev) => ({
        ...prev,
        ...savedCustomPdfTemplate.sections,
        showDividerSparklines: savedCustomPdfTemplate.sections.showDividerSparklines ?? prev.showDividerSparklines ?? true,
        showDividerMutationHistory: savedCustomPdfTemplate.sections.showDividerMutationHistory ?? prev.showDividerMutationHistory ?? true,
        showDividerRecommendations: savedCustomPdfTemplate.sections.showDividerRecommendations ?? prev.showDividerRecommendations ?? true,
        showDividerExecutiveSummary: savedCustomPdfTemplate.sections.showDividerExecutiveSummary ?? prev.showDividerExecutiveSummary ?? true,
        sectionOrder: savedCustomPdfTemplate.sections.sectionOrder || prev.sectionOrder || [...DEFAULT_PDF_SECTION_ORDER]
      }));
    }
  };

  // Export Preset Manager State & Handlers for Multiple Named Snapshots with Category Folders
  interface ExportPresetItem {
    id: string;
    name: string;
    folder?: string;
    createdAt: number;
    sections: DiagnosticPdfSectionsConfig;
  }
  const EXPORT_PRESETS_LIST_STORAGE_KEY = 'diagnostic_export_presets_list_v1';

  const [exportPresetsList, setExportPresetsList] = useState<ExportPresetItem[]>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(EXPORT_PRESETS_LIST_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ExportPresetItem[];
    } catch (err) {
      console.error('Failed to load export presets list:', err);
      return [];
    }
  });
  const [newPresetNameInput, setNewPresetNameInput] = useState<string>('');
  const [newPresetFolderInput, setNewPresetFolderInput] = useState<string>('General');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [presetActionFeedback, setPresetActionFeedback] = useState<string | null>(null);
  const [deletedPresetsUndoState, setDeletedPresetsUndoState] = useState<{ presets: ExportPresetItem[]; timer: any } | null>(null);
  const [previewPresetItem, setPreviewPresetItem] = useState<ExportPresetItem | null>(null);
  const [presetSearchQuery, setPresetSearchQuery] = useState<string>('');
  const [presetTimeFilter, setPresetTimeFilter] = useState<'all' | '7days' | '30days'>('all');
  const [isSyncDividersLocked, setIsSyncDividersLocked] = useState<boolean>(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [presetSortMode, setPresetSortMode] = useState<'date' | 'name'>('date');

  const filteredExportPresetsList = useMemo(() => {
    let list = exportPresetsList;
    if (presetTimeFilter === '7days') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => p.createdAt >= cutoff);
    } else if (presetTimeFilter === '30days') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => p.createdAt >= cutoff);
    }

    if (!presetSearchQuery.trim()) return list;
    const q = presetSearchQuery.trim().toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.folder || 'General').toLowerCase().includes(q)
    );
  }, [exportPresetsList, presetSearchQuery, presetTimeFilter]);

  const availableFolders = useMemo(() => {
    const set = new Set<string>(['General', 'Audits', 'Executive', 'Production']);
    exportPresetsList.forEach((p) => {
      if (p.folder) set.add(p.folder);
    });
    return Array.from(set);
  }, [exportPresetsList]);

  const handleSaveNewExportPreset = () => {
    const rawName = newPresetNameInput.trim();
    if (!rawName) {
      setPresetActionFeedback('Warning: Preset name cannot be empty.');
      setTimeout(() => setPresetActionFeedback(null), 3000);
      return;
    }
    const nameExists = exportPresetsList.some(
      (p) => p.name.trim().toLowerCase() === rawName.toLowerCase()
    );
    if (nameExists) {
      setPresetActionFeedback(`Warning: Preset name "${rawName}" already exists! Please use a unique name.`);
      setTimeout(() => setPresetActionFeedback(null), 3500);
      return;
    }

    const folderName = newPresetFolderInput.trim() || 'General';
    const newPreset: ExportPresetItem = {
      name: rawName,
      folder: folderName,
      createdAt: Date.now(),
      sections: JSON.parse(JSON.stringify(pdfExportSections))
    };
    const updated = [newPreset, ...exportPresetsList];
    setExportPresetsList(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save export presets list:', err);
      }
    }
    setNewPresetNameInput('');
    setPresetActionFeedback(`Saved preset "${rawName}" in folder "${folderName}"!`);
    setTimeout(() => setPresetActionFeedback(null), 3000);
  };

  const handleLoadExportPreset = (preset: ExportPresetItem) => {
    setPdfExportSections((prev) => ({
      ...prev,
      ...preset.sections,
      showDividerSparklines: preset.sections.showDividerSparklines ?? prev.showDividerSparklines ?? true,
      showDividerMutationHistory: preset.sections.showDividerMutationHistory ?? prev.showDividerMutationHistory ?? true,
      showDividerRecommendations: preset.sections.showDividerRecommendations ?? prev.showDividerRecommendations ?? true,
      showDividerExecutiveSummary: preset.sections.showDividerExecutiveSummary ?? prev.showDividerExecutiveSummary ?? true,
      sectionOrder: preset.sections.sectionOrder || prev.sectionOrder || [...DEFAULT_PDF_SECTION_ORDER]
    }));
    setPresetActionFeedback(`Loaded preset "${preset.name}"!`);
    setTimeout(() => setPresetActionFeedback(null), 3000);
  };

  const handleBatchDeletePresets = () => {
    if (selectedPresetIds.length === 0) return;
    const targets = exportPresetsList.filter((p) => selectedPresetIds.includes(p.id));
    const updated = exportPresetsList.filter((p) => !selectedPresetIds.includes(p.id));
    setExportPresetsList(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update export presets list:', err);
      }
    }
    if (deletedPresetsUndoState?.timer) {
      clearTimeout(deletedPresetsUndoState.timer);
    }
    const timer = setTimeout(() => {
      setDeletedPresetsUndoState(null);
    }, 5000);
    setDeletedPresetsUndoState({ presets: targets, timer });
    setPresetActionFeedback(`Deleted ${selectedPresetIds.length} presets.`);
    setSelectedPresetIds([]);
    setTimeout(() => setPresetActionFeedback(null), 2500);
  };

  const handleBatchMovePresets = (targetFolder: string) => {
    if (selectedPresetIds.length === 0 || !targetFolder) return;
    const updated = exportPresetsList.map((p) => selectedPresetIds.includes(p.id) ? { ...p, folder: targetFolder } : p);
    setExportPresetsList(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update preset folders:', err);
      }
    }
    setPresetActionFeedback(`Moved ${selectedPresetIds.length} presets to "${targetFolder}".`);
    setSelectedPresetIds([]);
    setTimeout(() => setPresetActionFeedback(null), 2500);
  };

  const handleBatchExportPresets = () => {
    if (selectedPresetIds.length === 0) return;
    const itemsToExport = exportPresetsList.filter((p) => selectedPresetIds.includes(p.id));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itemsToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setPresetActionFeedback(`Exported ${itemsToExport.length} presets.`);
    setTimeout(() => setPresetActionFeedback(null), 2500);
  };

  const handleDeleteExportPreset = (presetId: string) => {
    const target = exportPresetsList.find((p) => p.id === presetId);
    if (!target) return;
    const updated = exportPresetsList.filter((p) => p.id !== presetId);
    setExportPresetsList(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update export presets list:', err);
      }
    }
    if (deletedPresetsUndoState?.timer) {
      clearTimeout(deletedPresetsUndoState.timer);
    }
    const timer = setTimeout(() => {
      setDeletedPresetsUndoState(null);
    }, 5000);
    setDeletedPresetsUndoState({ presets: [target], timer });
    setPresetActionFeedback('Deleted preset.');
    setTimeout(() => setPresetActionFeedback(null), 2500);
  };

  const handleUndoDeletePresets = () => {
    if (!deletedPresetsUndoState) return;
    if (deletedPresetsUndoState.timer) {
      clearTimeout(deletedPresetsUndoState.timer);
    }
    const restored = [...deletedPresetsUndoState.presets, ...exportPresetsList];
    setExportPresetsList(restored);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(restored));
      } catch (err) {
        console.error('Failed to restore export presets:', err);
      }
    }
    setPresetActionFeedback(`Restored ${deletedPresetsUndoState.presets.length} preset(s)!`);
    setDeletedPresetsUndoState(null);
    setTimeout(() => setPresetActionFeedback(null), 3000);
  };

  const handleMovePresetFolder = (presetId: string, targetFolder: any) => {
    const updated = exportPresetsList.map((p) => p.id === presetId ? { ...p, folder: targetFolder || 'General' } : p);
    setExportPresetsList(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(EXPORT_PRESETS_LIST_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update preset folder:', err);
      }
    }
    setPresetActionFeedback('Moved preset to folder.');
    setTimeout(() => setPresetActionFeedback(null), 2000);
  };

  const toggleFolderCollapse = (folderName: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
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
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }
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
          sections: {
            ...pdfExportSections,
            groupByTag: isGroupByTagActive
          }
        }
      });
      setIsDiagnosticPdfSuccess(true);
      setDiagnosticPdfError(null);
      setTimeout(() => {
        setIsDiagnosticPdfSuccess(false);
      }, 2500);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err: any) {
      console.error('Failed to generate diagnostic correlation PDF report:', err);
      const errorMessage =
        err?.message ||
        'Failed to generate visual PDF report. Please verify diagnostic history and try again.';
      setDiagnosticPdfError(errorMessage);
    } finally {
      setIsGeneratingDiagnosticPdf(false);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    }
  };

  // Generate Diagnostic Correlation Report as JSON summarizing mutation clusters & latency spikes
  const handleGenerateDiagnosticCorrelationReport = () => {
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }
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
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to generate diagnostic correlation report:', err);
    } finally {
      setIsGeneratingDiagnosticReport(false);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
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
  }, [lastCacheRefreshedAt, isExportHovered, liveMonitoringClock]);

  // Copy Logs state and export tooltip interaction helpers
  const [isCopiedLogs, setIsCopiedLogs] = useState<boolean>(false);
  const isExportHoveredRef = useRef<boolean>(false);
  useEffect(() => {
    isExportHoveredRef.current = isExportHovered;
  }, [isExportHovered]);

  // Click-to-pin state: keeps tooltip permanently open until clicking outside or pin icon
  const [isTooltipPinned, setIsTooltipPinned] = useState<boolean>(false);
  const isTooltipPinnedRef = useRef<boolean>(false);
  useEffect(() => {
    isTooltipPinnedRef.current = isTooltipPinned;
  }, [isTooltipPinned]);

  const handleTogglePin = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsTooltipPinned((prev) => {
      const next = !prev;
      if (!next) {
        setIsExportHovered(false);
      } else {
        setIsExportHovered(true);
      }
      return next;
    });
  };

  // Instantly closes the pinned tooltip and resets the isTooltipPinned state
  const handleCancelPinnedTooltip = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsTooltipPinned(false);
    isTooltipPinnedRef.current = false;
    setIsExportHovered(false);
    isExportHoveredRef.current = false;
    setIsLiveMonitoring(false);
    setIsHeaderExportBtnHovered(false);
    if (exportHoverEnterTimeoutRef.current) {
      clearTimeout(exportHoverEnterTimeoutRef.current);
      exportHoverEnterTimeoutRef.current = null;
    }
    if (exportHoverLeaveTimeoutRef.current) {
      clearTimeout(exportHoverLeaveTimeoutRef.current);
      exportHoverLeaveTimeoutRef.current = null;
    }
    if (exportHoverTimeoutRef.current) {
      clearTimeout(exportHoverTimeoutRef.current);
      exportHoverTimeoutRef.current = null;
    }
  };

  const handleExportButtonClick = (e: React.MouseEvent) => {
    // Click-to-pin: pins the tooltip open permanently until user clicks outside or on the pin icon
    setIsTooltipPinned(true);
    setIsExportHovered(true);
    handleHeaderExport(selectedExportFormat);
  };

  const exportHoverEnterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exportHoverLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exportHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleExportMouseEnter = () => {
    // Clear any pending mouseleave timer immediately
    if (exportHoverLeaveTimeoutRef.current) {
      clearTimeout(exportHoverLeaveTimeoutRef.current);
      exportHoverLeaveTimeoutRef.current = null;
    }
    if (exportHoverTimeoutRef.current) {
      clearTimeout(exportHoverTimeoutRef.current);
      exportHoverTimeoutRef.current = null;
    }

    // If tooltip is already active, maintain open state without re-debouncing
    if (isExportHoveredRef.current || isTooltipPinnedRef.current) {
      setIsExportHovered(true);
      return;
    }

    // 300ms display delay before opening to prevent unwanted flickering when quickly moving over the button
    if (exportHoverEnterTimeoutRef.current) {
      clearTimeout(exportHoverEnterTimeoutRef.current);
    }
    exportHoverEnterTimeoutRef.current = setTimeout(() => {
      setIsExportHovered(true);
      exportHoverEnterTimeoutRef.current = null;
    }, 300);
  };

  const handleExportMouseLeave = () => {
    if (isLiveMonitoring || isTooltipPinnedRef.current) return;

    // Clear any pending mouseenter timer so edge jitters don't falsely open
    if (exportHoverEnterTimeoutRef.current) {
      clearTimeout(exportHoverEnterTimeoutRef.current);
      exportHoverEnterTimeoutRef.current = null;
    }

    // Robust 250ms debounce before closing to allow smooth transit across button/tooltip boundaries
    if (exportHoverLeaveTimeoutRef.current) {
      clearTimeout(exportHoverLeaveTimeoutRef.current);
    }
    if (exportHoverTimeoutRef.current) {
      clearTimeout(exportHoverTimeoutRef.current);
    }

    const leaveTimer = setTimeout(() => {
      if (!isLiveMonitoring && !isTooltipPinnedRef.current) {
        setIsExportHovered(false);
      }
      exportHoverLeaveTimeoutRef.current = null;
      exportHoverTimeoutRef.current = null;
    }, 250);

    exportHoverLeaveTimeoutRef.current = leaveTimer;
    exportHoverTimeoutRef.current = leaveTimer;
  };

  useEffect(() => {
    return () => {
      if (exportHoverEnterTimeoutRef.current) {
        clearTimeout(exportHoverEnterTimeoutRef.current);
      }
      if (exportHoverLeaveTimeoutRef.current) {
        clearTimeout(exportHoverLeaveTimeoutRef.current);
      }
      if (exportHoverTimeoutRef.current) {
        clearTimeout(exportHoverTimeoutRef.current);
      }
      if (exportCopiedTimeoutRef.current) {
        clearTimeout(exportCopiedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyInvalidationLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }
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
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to copy invalidation triggers to clipboard:', err);
    }
  };

  const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);

  const handleCopyLogSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }

    const summary = [
      `*Database Mutation & Cache Performance Summary*`,
      `• Pending Mutation Queue Count: ${pendingMutationsCount} active ${pendingMutationsCount === 1 ? 'mutation' : 'mutations'}`,
      `• Estimated Wait Time: ${estimatedWaitTimeText}`,
      `• Total Est. Completion: ${mutationProgressPercent}%`,
      `• Serialization Status: ${isDatabaseMutatingState ? 'PAUSED (Serialization Deferred)' : 'READY (Fresh Read Active)'}`,
      `• Lock Scope: Heap Rows & B-Tree Indexes (Snapshot Isolation)`,
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
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to copy log summary to clipboard:', err);
    }
  };

  const [isCopiedJson, setIsCopiedJson] = useState<boolean>(false);

  const handleCopyInvalidationJson = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }

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
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to copy minified invalidation triggers JSON to clipboard:', err);
    }
  };

  const [isDownloadedJson, setIsDownloadedJson] = useState<boolean>(false);

  const handleDownloadInvalidationLogsJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }

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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsDownloadedJson(true);
      setTimeout(() => setIsDownloadedJson(false), 2000);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
    } catch (err) {
      console.error('Failed to download invalidation triggers JSON:', err);
    }
  };

  const [isExportedAllCsv, setIsExportedAllCsv] = useState<boolean>(false);

  const handleExportAllInvalidationLogsCsv = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isTooltipPinnedRef.current) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
    }

    try {
      const escapeCsvValue = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExportedAllCsv(true);
      setTimeout(() => setIsExportedAllCsv(false), 2500);
      if (isTooltipPinnedRef.current) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
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


  // Close export dropdown or unpin tooltip on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Never unpin/close if clicking inside the export dropdown or tooltip
      if (exportDropdownRef.current && exportDropdownRef.current.contains(target)) {
        return;
      }

      // Never unpin/close if interacting with confirmation modal or its backdrop
      const confirmationModal = document.getElementById('modal-export-confirmation');
      const confirmationBackdrop = document.getElementById('modal-export-confirmation-backdrop');
      if (
        (confirmationModal && confirmationModal.contains(target)) ||
        (confirmationBackdrop && confirmationBackdrop.contains(target))
      ) {
        return;
      }

      // Never unpin/close if interacting with PDF preview modal or its backdrop
      const pdfModal = document.getElementById('modal-pdf-preview-backdrop');
      if (pdfModal && pdfModal.contains(target)) {
        return;
      }

      // If user triggers an export or copy action anywhere in the application while tooltip is pinned, keep it pinned
      const isExportOrCopyAction = !!target.closest?.(
        'button[data-testid*="export"], button[data-testid*="copy"], button[id*="export"], button[id*="copy"], [data-id*="export"], [data-id*="copy"]'
      );
      if (isExportOrCopyAction && isTooltipPinnedRef.current) {
        return;
      }

      setIsExportDropdownOpen(false);
      setIsTooltipPinned(false);
      setIsExportHovered(false);
    }
    if (isExportDropdownOpen || isTooltipPinned) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExportDropdownOpen, isTooltipPinned]);

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
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: result.readQueryLatencyAfterMs,
      rowsScanned: result.indexesUpdated.length > 0 ? 2500 : result.totalDatabaseRecords,
      activeQueriesCount: 1,
      cacheHit: false,
      flags: { ...flags },
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

  // Auto-execute deferred export when database mutation finishes
  const prevMutatingRef = useRef<boolean>(isDatabaseMutatingState);
  useEffect(() => {
    if (prevMutatingRef.current && !isDatabaseMutatingState && deferredExportRequest) {
      const req = deferredExportRequest;
      setDeferredExportRequest(null);
      setTimeout(() => {
        handleHeaderExport(req.format, req.isFromShortcut, true);
      }, 50);
    }
    prevMutatingRef.current = isDatabaseMutatingState;
  }, [isDatabaseMutatingState, deferredExportRequest]);

  const handleHeaderExport = (formatToExport?: ExportFormat, isFromShortcut?: boolean, bypassConfirmation?: boolean) => {
    // Retain pinned status: if tooltip is pinned, it must remain pinned through copy and export actions
    const wasPinned = isTooltipPinnedRef.current || isTooltipPinned;

    // If a database mutation is currently mid-process, defer serialization to ensure data consistency
    if (isDatabaseMutatingState) {
      const format = formatToExport || selectedExportFormatRef.current;
      setDeferredExportRequest({
        format,
        isFromShortcut: Boolean(isFromShortcut),
        timestamp: Date.now()
      });
      setExportPausedToast(
        `Export Action Deferred: ${pendingMutationsCount} active database mutation${pendingMutationsCount === 1 ? ' is' : 's are'} mid-process. Queued with live countdown.`
      );
      setTimeout(() => setExportPausedToast(null), 4500);
      setIsTooltipPinned(true);
      setIsExportHovered(true);
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
      if (wasPinned) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
      }
      return;
    }

    // Intercept with confirmation modal if enabled and not explicitly bypassed
    if (isExportConfirmationPromptEnabled && !bypassConfirmation) {
      setPendingExportFormat(format);
      setPendingExportIsFromShortcut(!!isFromShortcut);
      setIsExportConfirmationModalOpen(true);
      if (wasPinned) {
        setIsTooltipPinned(true);
        setIsExportHovered(true);
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

    // Ensure pinned state is maintained while export is underway
    if (wasPinned) {
      setIsTooltipPinned(true);
      setIsExportHovered(true);
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

        // Copy serialized content to clipboard for instant pasting
        try {
          if (format === 'json') {
            const jsonText = JSON.stringify(recordsToExport, null, 2);
            navigator?.clipboard?.writeText?.(jsonText);
          } else {
            const { csvString } = buildCsvString(recordsToExport, { includeHeaders: includeCsvHeadersRef.current });
            navigator?.clipboard?.writeText?.(csvString);
          }
        } catch {
          // ignore clipboard errors
        }

        // Temporarily show 'Copied!' label inside #btn-header-export-csv
        setIsExportCopied(true);
        if (exportCopiedTimeoutRef.current) {
          clearTimeout(exportCopiedTimeoutRef.current);
        }
        exportCopiedTimeoutRef.current = setTimeout(() => {
          setIsExportCopied(false);
          exportCopiedTimeoutRef.current = null;
          // Ensure tooltip remains pinned after temporary 'Copied!' label duration expires
          if (isTooltipPinnedRef.current) {
            setIsTooltipPinned(true);
            setIsExportHovered(true);
          }
        }, 2200);

        // Explicitly keep tooltip pinned open after triggering export or copy action
        if (wasPinned) {
          setIsTooltipPinned(true);
          setIsExportHovered(true);
        }
      } catch (err: unknown) {
        const errorLog: SerializationLogEntry = {
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
        if (wasPinned) {
          setIsTooltipPinned(true);
          setIsExportHovered(true);
        }
      }
    }, 10);
  };

  // Power-user keyboard shortcut: Ctrl+E (or ⌘E on Mac) to trigger Export CSV/JSON directly from Table view
  // Escape key to immediately unpin and close the #btn-header-export-csv tooltip if open or pinned
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Handle Escape key: immediately unpin and close the #btn-header-export-csv tooltip if currently open or pinned
      if (e.key === 'Escape') {
        // If a modal is open, let the modal handle Escape dismiss without unpinning tooltip
        if (
          isExportConfirmationModalOpen ||
          showPdfPreviewModal ||
          isBulkImportOpen ||
          isDataTapeModalOpen ||
          isBenchmarkOpen
        ) {
          return;
        }

        if (
          isTooltipPinned ||
          isExportHovered ||
          isTooltipPinnedRef.current ||
          isExportHoveredRef.current
        ) {
          e.preventDefault();
          setIsTooltipPinned(false);
          setIsExportHovered(false);
          setIsLiveMonitoring(false);
          if (exportHoverEnterTimeoutRef.current) {
            clearTimeout(exportHoverEnterTimeoutRef.current);
            exportHoverEnterTimeoutRef.current = null;
          }
          if (exportHoverLeaveTimeoutRef.current) {
            clearTimeout(exportHoverLeaveTimeoutRef.current);
            exportHoverLeaveTimeoutRef.current = null;
          }
          if (exportHoverTimeoutRef.current) {
            clearTimeout(exportHoverTimeoutRef.current);
            exportHoverTimeoutRef.current = null;
          }
          return;
        }
      }

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
    shortcutKeyLabel,
    isTooltipPinned,
    isExportHovered
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
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: queryResult.executionTimeMs,
      rowsScanned: queryResult.rowsScanned,
      activeQueriesCount: queryResult.activeQueriesCount,
      cacheHit: false,
      flags: { ...flags },
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
        isBenchmarking={isBenchmarkOpen}
        hasErrors={hasErrors}
        activeErrorCount={activeErrorsCount}
        activeView={activeView}
        onSelectView={setActiveView}
        trendCount={trendHistory.length}
        totalRecords={totalDatabaseRecords}
        isIndexSynchronized={isIndexSynchronized}
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
              </div>
              <p className="text-xs opacity-85 mt-0.5">
                {!hasErrors
                  : 'Unbatched N+1 queries, unindexed table scans, and unwindowed DOM nodes are degrading database latency and frame rate.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hasErrors ? (
              <button
                type="button"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 transition-colors cursor-pointer"
              >
                Inspect Unoptimized State
              </button>
            ) : (
              <button
                type="button"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                Apply All Optimizations
              </button>
          </div>
        

        {/* 1. Live Telemetry Metrics */}
        <MetricsBar
          queryResult={queryResult}
          flags={flags}
          currentFps={currentFps}
          renderedDomCount={domNodeCount}
          totalDatabaseRecords={totalDatabaseRecords}
        />

        {/* View Mode Tabs Navigation & View Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-1.5 bg-zinc-200/70 p-1 rounded-xl">
            <button
              id="main-tab-grid"
              type="button"
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
                <span className="text-xs text-zinc-500 hidden md:inline-block">
                  Virtual grid with RFC 4180 CSV / JSON export and query execution tree
                </span>

                {/* Historical Data Tape Auditor Access Button */}
                <button
                  id="btn-open-historical-data-tape"
                  type="button"
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
                </button>

                {/* Export Dropdown Split Button */}
                <div ref={exportDropdownRef} className="relative inline-flex ml-auto sm:ml-0 shadow-xs rounded-lg">
                  {/* Primary Export Action Button with Click-to-Pin Support */}
                  <button
                    id="btn-header-export-csv"
                    data-testid="btn-header-export-csv"
                    type="button"
                    onClick={handleExportButtonClick}
                    onMouseEnter={() => {
                      setIsHeaderExportBtnHovered(true);
                      handleExportMouseEnter();
                    }}
                    onMouseLeave={() => {
                      setIsHeaderExportBtnHovered(false);
                      handleExportMouseLeave();
                    }}
                    onFocus={() => {
                      setIsHeaderExportBtnHovered(true);
                      handleExportMouseEnter();
                    }}
                    onBlur={() => {
                      setIsHeaderExportBtnHovered(false);
                      handleExportMouseLeave();
                    }}
                    aria-describedby={
                      isExportPulsing || isExportHovered || isLiveMonitoring || isTooltipPinned
                        ? 'tooltip-cache-invalidation-fresh-read'
                        : undefined
                    }
                    data-pinned={isTooltipPinned ? 'true' : 'false'}
                    data-serialization-ready={isHeaderExportBtnHovered ? 'true' : 'false'}
                    data-copied={isExportCopied ? 'true' : 'false'}
                    data-export-deferred={isDatabaseMutatingState ? 'true' : 'false'}
                    data-deferred-wait-seconds={isDatabaseMutatingState ? deferredWaitCountdown.formattedSeconds : undefined}
                    data-last-mutation-recent={recentCompletedMutationInfo ? 'true' : 'false'}
                    data-last-mutation-type={recentCompletedMutationInfo ? recentCompletedMutationInfo.type : undefined}
                    data-last-mutation-duration={recentCompletedMutationInfo ? recentCompletedMutationInfo.formattedDuration : undefined}
                    disabled={isHeaderExporting || queryResult.records.length === 0}
                    className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-r-0 border-zinc-300 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-98 ${
                      isShortcutFlashing
                        ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-950 shadow-md scale-102'
                        : isExportCopied && isTooltipPinned
                        ? 'ring-2 ring-amber-400 border-amber-400 bg-emerald-50 text-emerald-950 shadow-xs shadow-amber-500/20 animate-pinned-ring-shift z-10'
                        : isExportCopied
                        ? 'ring-2 ring-emerald-500/80 bg-emerald-50 text-emerald-950 border-emerald-400 shadow-xs shadow-emerald-500/20'
                        : isExportPulsing
                        ? 'ring-2 ring-amber-500 bg-amber-50/90 text-amber-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                        : isTooltipPinned
                        ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/60 text-amber-950 shadow-xs shadow-amber-500/20 animate-pinned-ring-shift z-10'
                        : ''
                    }`}
                    title={
                      isTooltipPinned
                        ? `Tooltip pinned open (Click pin icon or outside to unpin). Export as ${
                            selectedExportFormat === 'json' ? 'JSON' : 'CSV'
                          }`
                        : isDatabaseMutatingState
                        ? `Export Action Deferred (${deferredWaitCountdown.formattedSeconds} expected wait time): Database mutation is mid-process (${pendingMutationsCount} active pending). Serialization is deferred to ensure data consistency`
                        : recentCompletedMutationInfo
                        ? `Export query results as ${
                            selectedExportFormat === 'json'
                              ? 'JSON'
                              : includeCsvHeaders
                              ? 'CSV (with headers)'
                              : 'CSV (headerless)'
                          } (Last Mutation: ${recentCompletedMutationInfo.type} finished ${recentCompletedMutationInfo.formattedDuration}) (Shortcut: ${shortcutKeyLabel}, ${altShortcutKeyLabel} for alternate)`
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
                        {isExportCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span
                              id="label-export-copied"
                              data-testid="label-export-copied"
                              className="font-bold text-emerald-700"
                            >
                              Copied!
                            </span>
                          </>
                        ) : (
                          <>
                            {selectedExportFormat === 'json' ? (
                              <FileCode className={`w-3.5 h-3.5 ${isExportPulsing ? 'text-amber-700 animate-pulse' : 'text-amber-600'}`} />
                            ) : (
                              <FileSpreadsheet className={`w-3.5 h-3.5 ${isExportPulsing ? 'text-amber-700 animate-pulse' : 'text-emerald-600'}`} />
                            <span>
                              {selectedExportFormat === 'json'
                                ? 'Export JSON'
                                : includeCsvHeaders
                                ? 'Export CSV'
                                : 'Export CSV (No Headers)'}
                            </span>
                          </>
                        {/* Dynamic pill-shaped format badge ('CSV' or 'JSON') with high-performance preparation sparkle indicator */}
                        <span className="relative inline-flex items-center">
                          <span
                            id="badge-header-export-format"
                            data-testid="badge-header-export-format"
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold tracking-wide border shadow-2xs transition-all select-none ${
                              isExportCopied
                                ? 'bg-emerald-300 text-emerald-950 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse'
                                : selectedExportFormat === 'json'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 group-hover:border-amber-400 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 group-hover:border-emerald-400 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                            }`}
                            title={`Active export format: ${selectedExportFormat === 'json' ? 'JSON' : 'CSV'} (High-performance serialization prepared)`}
                          >
                            <Sparkle
                              className={`w-2.5 h-2.5 transition-all duration-300 shrink-0 ${
                                isHeaderExportBtnHovered
                                  ? 'opacity-100 scale-100 text-amber-500 fill-amber-400 animate-sparkle-twinkle'
                                  : 'opacity-0 scale-0 -ml-1 w-0 overflow-hidden'
                              } group-hover:opacity-100 group-hover:scale-100 group-hover:ml-0 group-hover:w-2.5 group-hover:animate-sparkle-twinkle text-amber-500 fill-amber-400`}
                            />
                            <span>{selectedExportFormat === 'json' ? 'JSON' : 'CSV'}</span>
                          </span>

                          {/* Subtle floating sparkle icon effect near format badge */}
                          <span
                            id="sparkle-header-export-ready"
                            data-testid="sparkle-header-export-ready"
                            className={`pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center transition-all duration-300 ease-out ${
                              isHeaderExportBtnHovered
                                ? 'opacity-100 scale-100 rotate-0'
                                : 'opacity-0 scale-0 -rotate-45'
                            } group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-0`}
                            title="High-performance serialization prepared for execution"
                            aria-label="High-performance serialization prepared for execution"
                          >
                            <span className="relative flex items-center justify-center">
                              {/* Pulsing ambient glint */}
                              <span className="absolute -inset-1 rounded-full bg-amber-400/35 blur-[1.5px] animate-ping" />
                              <Sparkles
                                id="icon-export-serialization-sparkle"
                                data-testid="icon-export-serialization-sparkle"
                                className="relative w-3.5 h-3.5 text-amber-500 fill-amber-300/40 drop-shadow-[0_1px_3px_rgba(217,119,6,0.6)] animate-sparkle-twinkle"
                              />
                            </span>
                          </span>
                        </span>
                        {/* Tiny, subtle badge displaying duration of last export to emphasize performance */}
                        {formattedLastExportDuration && (
                          <span
                            id="badge-header-export-duration"
                            data-testid="badge-header-export-duration"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-semibold tracking-tight border bg-emerald-50 text-emerald-700 border-emerald-200/90 shadow-2xs select-none transition-colors"
                          >
                            <Zap className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span>{formattedLastExportDuration}</span>
                          </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold border transition-colors ${
                          isExportPulsing
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : isTooltipPinned
                            ? 'bg-amber-100/80 text-amber-900 border-amber-300'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                          {queryResult.records.length}
                        </span>

                        {isTooltipPinned && (
                          <span
                            id="badge-header-tooltip-pinned"
                            data-testid="badge-header-tooltip-pinned"
                            role="button"
                            tabIndex={0}
                            aria-label="Unpin tooltip"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(e);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleTogglePin();
                              }
                            }}
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs ml-0.5 hover:bg-amber-200 cursor-pointer"
                            title="Tooltip pinned open (click to unpin)"
                          >
                            <Pin className="w-2.5 h-2.5 rotate-45 fill-amber-700 text-amber-700" />
                            <span>Pinned</span>
                          </span>

                        {/* Small 'Last Mutation' badge appearing only when a database mutation recently completed */}
                        {recentCompletedMutationInfo && (
                          <span
                            id="badge-header-last-mutation"
                            data-testid="badge-header-last-mutation"
                            data-badge="last-mutation"
                            data-mutation-type={recentCompletedMutationInfo.type}
                            data-duration-since-finished={recentCompletedMutationInfo.formattedDuration}
                            data-seconds-since-finished={recentCompletedMutationInfo.elapsedSeconds}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[9.5px] font-semibold tracking-tight border bg-blue-50 text-blue-900 border-blue-200/90 shadow-2xs select-none transition-all ml-0.5 animate-in fade-in"
                            title={`Last Mutation: ${recentCompletedMutationInfo.type} completed ${recentCompletedMutationInfo.formattedDuration}`}
                          >
                            <span id="badge-last-mutation" data-testid="badge-last-mutation" className="inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              <span className="font-bold text-blue-950">Last Mutation:</span>
                              <span id="badge-last-mutation-type" data-testid="badge-last-mutation-type" className="font-bold text-blue-800">
                                {recentCompletedMutationInfo.type}
                              </span>
                              <span className="text-blue-400">&bull;</span>
                              <span id="badge-last-mutation-duration" data-testid="badge-last-mutation-duration" className="text-blue-700 font-medium">
                                {recentCompletedMutationInfo.formattedDuration}
                              </span>
                            </span>
                          </span>

                        {isDatabaseMutatingState ? (
                          <span
                            id="badge-export-paused"
                            data-testid="badge-export-paused"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-300 text-amber-950 border border-amber-500/90 shadow-2xs animate-pulse ml-0.5"
                            title={`Database mutation is mid-process (${pendingMutationsCount} active pending): Export action deferred (${deferredWaitCountdown.formattedSeconds} expected wait time)`}
                          >
                            <Pause className="w-2.5 h-2.5 fill-amber-900 text-amber-900" />
                            <span>Export Paused ({deferredWaitCountdown.formattedSeconds})</span>
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
                      </>
                  </button>

                  {/* Custom Tooltip: includes Performance Comparison Table, 'Export Paused' state during mid-process mutations, Last 3 Invalidation Triggers & Export All Logs Audit CSV */}
                  <div
                    id="tooltip-cache-invalidation-fresh-read"
                    data-testid="tooltip-cache-invalidation-fresh-read"
                    data-tooltip="tooltip-header-export-csv"
                    data-pinned={isTooltipPinned ? 'true' : 'false'}
                    data-export-deferred={isDatabaseMutatingState ? 'true' : 'false'}
                    data-deferred-wait-seconds={isDatabaseMutatingState ? deferredWaitCountdown.formattedSeconds : undefined}
                    role="tooltip"
                    onMouseEnter={handleExportMouseEnter}
                    onMouseLeave={handleExportMouseLeave}
                    className={`absolute bottom-full mb-2.5 left-0 z-50 w-80 sm:w-[420px] max-h-[85vh] overflow-y-auto p-3 rounded-lg bg-zinc-900/95 backdrop-blur-xs text-zinc-100 text-xs shadow-2xl border ${
                      thresholdAlert
                        ? 'border-rose-500/90 shadow-rose-500/20 ring-1 ring-rose-500/40'
                        : isDatabaseMutatingState
                        ? 'border-amber-400/90 shadow-amber-500/20 ring-1 ring-amber-400/30'
                        : isTooltipPinned
                        ? 'border-amber-500/80 shadow-amber-500/20 ring-1 ring-amber-500/40'
                        : 'border-zinc-700 shadow-zinc-950/50'
                    } transition-all duration-150 ${
                      isExportHovered || isTooltipPinned || isLiveMonitoring || isThresholdInputFocused || isExportPulsing
                        ? 'opacity-100 translate-y-0 visible pointer-events-auto'
                        : 'opacity-0 translate-y-1 invisible pointer-events-none'
                    }`}
                  >
                      {/* Live Monitoring & Click-to-Pin Bar */}
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
                        <div className="flex items-center gap-2 text-[10px]">
                          {isLiveMonitoring ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              Auto-updating (1s)
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-mono">1s interval</span>

                          {/* Pin Tooltip Toggle Button */}
                          <button
                            id="btn-pin-tooltip"
                            data-testid="btn-pin-tooltip"
                            data-id="btn-pin-tooltip"
                            aria-label={isTooltipPinned ? 'Unpin tooltip' : 'Pin tooltip'}
                            aria-pressed={isTooltipPinned}
                            type="button"
                            onClick={handleTogglePin}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                              isTooltipPinned
                                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-xs ring-1 ring-amber-400/40'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-600'
                            }`}
                            title={isTooltipPinned ? 'Tooltip pinned open (click to unpin or click outside)' : 'Click to pin tooltip open permanently'}
                          >
                            <Pin
                              id="icon-tooltip-pin"
                              data-testid="icon-tooltip-pin"
                              className={`w-2.5 h-2.5 transition-transform ${
                                isTooltipPinned ? 'rotate-45 text-amber-400 fill-amber-400' : 'text-zinc-400'
                              }`}
                            />
                            <span>{isTooltipPinned ? 'Pinned' : 'Pin'}</span>
                          </button>

                          {/* Cancel Button: instantly closes tooltip and resets isTooltipPinned */}
                          {isTooltipPinned && (
                            <button
                              id="btn-cancel-pinned-tooltip"
                              data-testid="btn-cancel-pinned-tooltip"
                              aria-label="Cancel"
                              type="button"
                              onClick={handleCancelPinnedTooltip}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-rose-500/50 bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-200 hover:text-white transition-colors cursor-pointer shadow-2xs"
                              title="Instantly close tooltip and reset pinned state (alternative to clicking outside)"
                            >
                              <X className="w-2.5 h-2.5 text-rose-300" />
                              <span>Cancel</span>
                            </button>
                        </div>
                      </div>

                      {/* Show Confirmation Prompt Toggle Setting */}
                      <div
                        id="control-export-confirmation"
                        data-testid="control-export-confirmation"
                        className="px-2.5 py-2 mb-2 rounded bg-zinc-950/80 border border-zinc-700/80 text-[11px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="toggle-export-confirmation-prompt"
                            className="flex items-center gap-1.5 font-semibold text-zinc-200 cursor-pointer select-none"
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 ${isExportConfirmationPromptEnabled ? 'text-emerald-400' : 'text-zinc-400'}`} />
                            <span>Show confirmation prompt</span>
                          </label>
                          <span
                            id="badge-export-confirmation-status"
                            data-testid="badge-export-confirmation-status"
                            className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                              isExportConfirmationPromptEnabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {isExportConfirmationPromptEnabled ? 'Enabled' : 'Off'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-[10px] text-zinc-400 leading-snug">
                            Display a modal requiring confirmation before triggering CSV or JSON serialization
                          </p>
                          <input
                            id="toggle-export-confirmation-prompt"
                            data-testid="toggle-export-confirmation-prompt"
                            aria-label="Show confirmation prompt"
                            type="checkbox"
                            checked={isExportConfirmationPromptEnabled}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-zinc-900 cursor-pointer accent-emerald-500 shrink-0"
                          />
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
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer border ${
                                  mutationThreshold === preset
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700'
                                }`}
                                title={`Set threshold to ${preset}s`}
                              >
                                {preset}s
                              </button>
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

                      {/* Recently Completed Mutation Notice in Tooltip */}
                      {recentCompletedMutationInfo && (
                        <div
                          id="card-recently-completed-mutation"
                          data-testid="card-recently-completed-mutation"
                          className="flex items-start gap-2 p-2 mb-2.5 rounded bg-blue-950/70 border border-blue-500/60 text-[11px] text-blue-200 animate-in fade-in"
                        >
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-blue-200 text-xs flex items-center gap-1">
                                Last Mutation Completed
                              </span>
                              <span
                                id="badge-tooltip-last-mutation-duration"
                                data-testid="badge-tooltip-last-mutation-duration"
                                className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold"
                              >
                                {recentCompletedMutationInfo.formattedDuration}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-200 font-medium mt-0.5 truncate">
                              {recentCompletedMutationInfo.description || `Transaction: ${recentCompletedMutationInfo.type}`}
                            </p>
                            <div className="flex items-center justify-between text-[9px] text-blue-300/90 mt-1 font-mono">
                              <span>Type: <strong className="text-blue-200">{recentCompletedMutationInfo.type}</strong></span>
                              <span>Finished {recentCompletedMutationInfo.formattedDuration}</span>
                            </div>
                          
                           </div>
                           </div>

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
                      
                          {/* Export Paused Header */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                              <Pause className="w-3.5 h-3.5 fill-amber-400 text-amber-400 animate-pulse" />
                              <span className="font-bold text-amber-300">Export Paused</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                id="badge-export-deferred-countdown"
                                data-testid="badge-export-deferred-countdown"
                                className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40 flex items-center gap-1"
                                title={`Live countdown: ${deferredWaitCountdown.formattedSeconds} estimated wait time`}
                              >
                                <Timer className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                                <span>{deferredWaitCountdown.formattedSeconds}</span>
                              </span>
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
                            {/* Explicit Highlight: Export Action Currently Deferred with Live Wait Time Countdown */}
                            <div
                              id="banner-export-action-deferred"
                              data-testid="banner-export-action-deferred"
                              role="alert"
                              aria-live="polite"
                              className="p-3 rounded-lg bg-gradient-to-br from-amber-950/95 via-amber-900/70 to-zinc-950/95 border-2 border-amber-400/90 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40 text-amber-100 space-y-2.5 animate-in fade-in"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/25 border border-amber-400/80 shrink-0">
                                    <Clock className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-amber-200 tracking-wide uppercase">
                                        Export Action Currently Deferred
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-amber-300/80 leading-tight">
                                      Active database mutation in progress &bull; Serialization paused
                                    </p>
                                  </div>
                                </div>
                                <span
                                  id="badge-export-deferred-status"
                                  data-testid="badge-export-deferred-status"
                                  className="text-[9.5px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400 text-amber-950 border border-amber-300 shadow-xs shrink-0 animate-pulse"
                                >
                                  {deferredExportRequest ? 'Queued' : 'Deferred'}
                                </span>
                              </div>

                              {/* Prominent Live Countdown of Expected Wait Time */}
                              <div
                                id="box-deferred-export-countdown"
                                data-testid="box-deferred-export-countdown"
                                className="p-2.5 rounded-md bg-zinc-950/85 border border-amber-500/60 shadow-inner flex items-center justify-between gap-3"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                                    <Timer className="w-3 h-3 text-amber-400 animate-pulse" />
                                    <span>Expected Wait Time</span>
                                  </div>
                                  <p className="text-[9.5px] text-zinc-300 leading-tight">
                                    Live countdown until serialization resumes
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <div
                                    id="export-live-countdown-timer"
                                    data-testid="export-live-countdown-timer"
                                    aria-label={`Expected wait time: ${deferredWaitCountdown.formattedSeconds}`}
                                    className="font-mono text-base font-extrabold text-amber-300 tracking-tight flex items-baseline justify-end gap-1"
                                  >
                                    <span>{deferredWaitCountdown.formattedSeconds}</span>
                                  </div>
                                  <div
                                    id="export-live-countdown-subtext"
                                    data-testid="export-live-countdown-subtext"
                                    className="text-[9px] font-mono text-amber-400/90"
                                  >
                                    {deferredWaitCountdown.remainingSeconds < 1
                                      ? '<1s remaining'
                                  </div>
                                

                                {/* Export Preset Manager */}
                                <div
                                  id="export-preset-manager"
                                  data-testid="export-preset-manager"
                                  className="p-2.5 rounded bg-zinc-950/90 border border-amber-500/30 text-zinc-200 space-y-2 mt-2 shadow-inner"
                                >
                                  {/* Divider Preset Selector Theme Bar */}
                             <div className="flex items-center justify-between p-2 rounded bg-zinc-950/80 border border-zinc-800 text-[9.5px] font-mono gap-2 flex-wrap mb-1.5">
                               <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                                 <Palette className="w-3 h-3 text-amber-400" />
                                 <span>Divider Preset Theme:</span>
                               </div>
                               <div className="flex items-center gap-1.5 flex-wrap">
                                 {[
                                   { id: 'minimal', label: 'Modern Minimal', style: 'solid', thickness: 1, color: '#cbd5e1' },
                                   { id: 'heavy', label: 'Heavy Emphasis', style: 'solid', thickness: 3, color: '#f59e0b' },
                                   { id: 'subtle', label: 'Subtle Separation', style: 'dashed', thickness: 1.5, color: '#71717a' },
                                   { id: 'vibrant', label: 'Vibrant Accent', style: 'dotted', thickness: 2, color: '#3b82f6' },
                                 ].map((theme) => (
                                   <button
                                     key={theme.id}
                                     id={`btn-divider-preset-${theme.id}`}
                                     data-testid={`btn-divider-preset-${theme.id}`}
                                     type="button"
                                     onClick={() => {
                                       setPdfExportSections((prev) => {
                                         const next = { ...prev };
                                         Object.values(PDF_SECTION_CONFIG_ITEMS).forEach((item) => {
                                           (next as any)[item.dividerStyleKey] = theme.style;
                                           (next as any)[item.dividerThicknessKey] = theme.thickness;
                                           (next as any)[item.dividerColorKey] = theme.color;
                                           (next as any)[item.showDividerKey] = true;
                                         });
                                         return next;
                                       });
                                       DEFAULT_PDF_SECTION_ORDER.forEach((id) => handleGenerateSnapshot(id));
                                       setPresetActionFeedback(`Applied divider theme "${theme.label}" across all sections.`);
                                       setTimeout(() => setPresetActionFeedback(null), 2500);
                                     }}
                                     className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-200 border border-zinc-700 transition-colors cursor-pointer font-medium"
                                     title={`Apply divider preset theme "${theme.label}" across all sections`}
                                   >
                                     {theme.label}
                                   </button>
                               </div>
                             </div>

                             <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-2">
                                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-300 font-mono">
                                      <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Export Preset Manager (Multiple Named Snapshots)</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                     {deletedPresetsUndoState && (
                                       <button
                                         id="btn-undo-delete-presets"
                                         data-testid="btn-undo-delete-presets"
                                         type="button"
                                         onClick={handleUndoDeletePresets}
                                         className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-[9.5px] transition-colors cursor-pointer shadow-xs animate-bounce"
                                         title="Undo deletion and restore deleted presets"
                                       >
                                         <RotateCcw className="w-3 h-3" />
                                         <span>Undo Delete ({deletedPresetsUndoState.presets.length})</span>
                                       </button>
                                     {presetActionFeedback && (
                                      <span className="text-[9.5px] text-emerald-300 font-mono animate-fadeIn flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span>{presetActionFeedback}</span>
                                      </span>
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      id="input-new-preset-name"
                                      data-testid="input-new-preset-name"
                                      type="text"
                                      placeholder="Enter preset name (e.g. Q3 Audit Snapshot)..."
                                      value={newPresetNameInput}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSaveNewExportPreset();
                                        }
                                      }}
                                      className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded px-2 py-1 text-[10px] font-mono text-zinc-200 shadow-xs"
                                      aria-label="New export preset name"
                                    />
                                    <button
                                      id="btn-save-new-export-preset"
                                      data-testid="btn-save-new-export-preset"
                                      type="button"
                                      onClick={handleSaveNewExportPreset}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-[10px] transition-colors cursor-pointer shadow-xs"
                                      title="Save current export configuration as a new named preset snapshot"
                                    >
                                      <Save className="w-3 h-3" />
                                      <span>Save New Preset</span>
                                    </button>
                                  </div>

                                  {/* Saved Presets List */}
                                  {exportPresetsList.length === 0 ? (
                                    <div className="text-[9.5px] text-zinc-400 font-mono italic py-1 px-1">
                                      No custom export presets saved yet. Type a name above and click "Save New Preset" to store multiple configuration snapshots beyond the default template!
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                      {exportPresetsList.map((preset) => (
                                        <div
                                          key={preset.id}
                                          data-testid={`preset-item-${preset.id}`}
                                          className="flex items-center justify-between p-1.5 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-[10px] gap-2 transition-colors"
                                        >
                                          <div className="flex items-center gap-2 overflow-hidden">
                                                      <input
                                                        id={`checkbox-preset-${preset.id}`}
                                                        data-testid={`checkbox-preset-${preset.id}`}
                                                        type="checkbox"
                                                        onChange={(e) => {
                                                          e.stopPropagation();
                                                          if (e.target.checked) {
                                                            setSelectedPresetIds((prev) => [...prev, preset.id]);
                                                          } else {
                                                            setSelectedPresetIds((prev) => prev.filter((id) => id !== preset.id));
                                                          }
                                                        }}
                                                        className="accent-amber-500 w-3 h-3 rounded cursor-pointer shrink-0"
                                                        aria-label={`Select preset ${preset.name}`}
                                                      />
                                            <span className="font-semibold text-zinc-200 truncate font-mono">{preset.name}</span>
                                            <span className="text-[8.5px] font-mono text-zinc-400 shrink-0">
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              id={`btn-load-preset-${preset.id}`}
                                              data-testid={`btn-load-preset-${preset.id}`}
                                              type="button"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-blue-200 border border-zinc-700 text-[9px] font-mono font-medium transition-colors cursor-pointer"
                                              title={`Load preset "${preset.name}" into current export settings`}
                                            >
                                              <FolderOpen className="w-2.5 h-2.5" />
                                              <span>Load</span>
                                            </button>
                                            <button
                                              id={`btn-delete-preset-${preset.id}`}
                                              data-testid={`btn-delete-preset-${preset.id}`}
                                              type="button"
                                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-zinc-700 text-[9px] font-mono transition-colors cursor-pointer"
                                              title={`Delete preset "${preset.name}"`}
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        </div>
                                    </div>
                                
                              

                              {/* Dynamic Countdown Progress Bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                                  <span>Snapshot Lock Resolution</span>
                                  <span className="text-amber-300 font-semibold">{deferredWaitCountdown.percentComplete}%</span>
                                </div>
                                <div
                                  id="progress-container-deferred-countdown"
                                  data-testid="progress-container-deferred-countdown"
                                  className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-amber-500/30"
                                  title={`Estimated completion: ${deferredWaitCountdown.percentComplete}% (${deferredWaitCountdown.formattedSeconds} remaining)`}
                                >
                                  <div
                                    id="progress-bar-deferred-countdown"
                                    data-testid="progress-bar-deferred-countdown"
                                    role="progressbar"
                                    aria-valuenow={deferredWaitCountdown.percentComplete}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    style={{ width: `${deferredWaitCountdown.percentComplete}%` }}
                                    className="h-full rounded-full bg-linear-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-150 shadow-xs shadow-amber-400/50"
                                  />
                                </div>
                              

                              {/* Deferred Export Queue / Auto-Execution Notice if triggered */}
                              {deferredExportRequest ? (
                                <div
                                  id="notice-export-action-queued-status"
                                  data-testid="notice-export-action-queued-status"
                                  className="flex items-center justify-between gap-2 p-2 rounded bg-amber-500/15 border border-amber-400/40 text-[10.5px]"
                                >
                                  <div className="flex items-center gap-1.5 text-amber-200 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>
                                    </span>
                                  </div>
                                  <button
                                    id="btn-cancel-deferred-export"
                                    data-testid="btn-cancel-deferred-export"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeferredExportRequest(null);
                                    }}
                                    className="text-[9.5px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-600 transition-colors cursor-pointer shrink-0"
                                    title="Cancel queued automatic export"
                                  >
                                    Cancel
                                  </button>
                                 </div>
                               ) : (
                                 <div
                                   id="notice-export-action-deferral-reason"
                                   data-testid="notice-export-action-deferral-reason"
                                   className="text-[10px] text-zinc-300/90 leading-relaxed bg-zinc-950/60 p-2 rounded border border-zinc-800/80"
                                 >
                                   Export serialization is currently deferred to ensure snapshot isolation and prevent dirty reads while in-flight transactions commit WAL frames.
                                 </div>
                            

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
                                
                              

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-700/50 font-mono">
                                <span>Lock Scope: Heap Rows &amp; Indexes</span>
                                <span>Snapshot Isolation: Active</span>
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
                                      </div>
                                      {trigger.details && (
                                        <div className="text-[10px] text-zinc-400 pl-3 truncate">
                                          {trigger.details}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 shrink-0 self-start mt-0.5">
                                    </span>
                                  </div>
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
                                      </div>
                                      {trigger.details && (
                                        <div className="text-[10px] text-zinc-400 pl-3 truncate">
                                          {trigger.details}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 shrink-0 self-start mt-0.5">
                                    </span>
                                  </div>
                              </div>

                              {recurrentBulkCount >= 2 && (
                                <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] text-amber-300/90 leading-tight">
                                  Recurrent bulk writes are actively invalidating query memory; next export will execute a full table scan.
                                </div>

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
                            

                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1 border-t border-zinc-800 font-medium">
                              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>
                                {isCacheInvalidatedPulsing
                                  ? 'Next export will perform a live database read'
                                  : 'Zero-latency cached snapshot ready for immediate export'}
                              </span>
                            </div>
                          

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
                            </button>
                          </div>
                        

                        {/* PDF Export Section Settings Accordion / Panel */}
                        {showPdfExportSettings && (
                          <div
                            id="panel-pdf-export-settings"
                            data-testid="panel-pdf-export-settings"
                            className="mb-2.5 p-2.5 rounded-md bg-zinc-900/95 border border-amber-500/40 shadow-sm text-zinc-200 space-y-2 animate-fadeIn"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                                <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                                <span>PDF Report Export Settings</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  id="btn-toggle-pdf-descriptions"
                                  data-testid="btn-toggle-pdf-descriptions"
                                  type="button"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                  title="Toggle visibility of descriptive text under section card titles for a compact view"
                                >
                                  {showPdfCardDescriptions ? (
                                    <>
                                      <EyeOff className="w-3 h-3 text-amber-300" />
                                      <span>Hide Descriptions</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3 h-3 text-amber-300" />
                                      <span>Show Descriptions</span>
                                    </>
                                </button>
                                <button
                                  id="btn-toggle-pdf-layout"
                                  data-testid="btn-toggle-pdf-layout"
                                  type="button"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                  title="Toggle between Compact Layout (title and toggle only) and Detailed Layout (all configuration controls visible)"
                                >
                                  {isDetailedPdfLayout ? (
                                    <>
                                      <Minimize2 className="w-3 h-3 text-amber-300" />
                                      <span>Compact Layout</span>
                                    </>
                                  ) : (
                                    <>
                                      <Maximize2 className="w-3 h-3 text-amber-300" />
                                      <span>Detailed Layout</span>
                                    </>
                                </button>
                                  <button
                                    id="btn-bulk-enable-all"
                                    data-testid="btn-bulk-enable-all"
                                    type="button"
                                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                     title="Enable all sections at once"
                                   >
                                     Enable All
                                   </button>
                                   <button
                                     id="btn-bulk-disable-all"
                                     data-testid="btn-bulk-disable-all"
                                     type="button"
                                     className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                     title="Disable all sections at once"
                                   >
                                     Disable All
                                   </button>
                                    <button
                                      id="btn-copy-all-notes"
                                      data-testid="btn-copy-all-notes"
                                      type="button"
                                      onClick={handleCopyAllNotes}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                      title="Aggregate and copy all custom notes from visible section cards as a formatted document outline to clipboard"
                                    >
                                      {copiedAllNotes ? (
                                        <>
                                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                                          <span className="text-emerald-300 font-semibold">Notes Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Copy All Notes</span>
                                        </>
                                    </button>
                                    <button
                                      id="btn-batch-export-sections"
                                      data-testid="btn-batch-export-sections"
                                      type="button"
                                      onClick={handleBatchExportAllSections}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-emerald-300 border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                      title="Export all enabled section data files as CSVs in a single batch using the configured naming pattern"
                                    >
                                      <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-400" />
                                      <span>Batch Export CSVs</span>
                                    </button>
                                    <button
                                      id="btn-toggle-page-numbers"
                                      data-testid="btn-toggle-page-numbers"
                                      type="button"
                                      onClick={() => {
                                        setPdfExportSections((prev) => ({
                                          ...prev,
                                          includePageNumbers: prev.includePageNumbers === false ? true : false
                                        }));
                                      }}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-medium transition-colors cursor-pointer ${
                                        pdfExportSections.includePageNumbers !== false
                                          ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 hover:bg-amber-900/50'
                                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
                                      }`}
                                      title="Toggle inclusion of page numbers ('Page X of Y') in the PDF document footer"
                                    >
                                      <FileText className="w-2.5 h-2.5 text-amber-400" />
                                      <span>Page Numbers: {pdfExportSections.includePageNumbers !== false ? 'On' : 'Off'}</span>
                                    </button>
                                    <button
                                      id="btn-reset-section-groups"
                                      data-testid="btn-reset-section-groups"
                                      type="button"
                                      onClick={handleResetSectionGroups}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                      title="Revert all section grouping to default, removing any custom folders or categories"
                                    >
                                      {resetSectionGroupsSuccess ? (
                                        <>
                                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                                          <span className="text-emerald-300 font-semibold">Groups Reset!</span>
                                        </>
                                      ) : (
                                        <>
                                          <FolderX className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Reset Section Groups</span>
                                        </>
                                    </button>
                                    <button
                                      id="btn-toggle-expand-collapse-groups"
                                      data-testid="btn-toggle-expand-collapse-groups"
                                      type="button"
                                      onClick={handleToggleAllSectionGroups}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                      title={areAllSectionGroupsCollapsed ? "Expand all section group folders at once" : "Collapse all section group folders at once"}
                                      aria-label={areAllSectionGroupsCollapsed ? "Expand All" : "Collapse All"}
                                    >
                                      {areAllSectionGroupsCollapsed ? (
                                        <>
                                          <FolderOpen className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Expand All</span>
                                        </>
                                      ) : (
                                        <>
                                          <Folder className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Collapse All</span>
                                        </>
                                    </button>
                                     <button
                                       id="btn-reset-all-dividers"
                                       data-testid="btn-reset-all-dividers"
                                       type="button"
                                       onClick={handleResetAllDividers}
                                       className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                       title="Globally reset 'Show Dividers' status and color for all sections back to the system default"
                                       aria-label="Reset All Dividers"
                                     >
                                       {resetDividersSuccess ? (
                                         <>
                                           <Check className="w-2.5 h-2.5 text-emerald-400" />
                                           <span className="text-emerald-300 font-semibold">Dividers Reset!</span>
                                         </>
                                       ) : (
                                         <>
                                           <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                                           <span>Reset All Dividers</span>
                                         </>
                                     </button>
                                     {/* Filter by Color Dropdown */}
                                     <div
                                       id="container-filter-by-divider-color"
                                       data-testid="container-filter-by-divider-color"
                                       className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-[9.5px] transition-colors"
                                     >
                                       <Palette className="w-3 h-3 text-amber-400 shrink-0" />
                                       <label
                                         htmlFor="select-filter-by-divider-color"
                                         className="text-zinc-300 font-medium whitespace-nowrap cursor-pointer select-none"
                                       >
                                         Filter by Color:
                                       </label>
                                       <select
                                         id="select-filter-by-divider-color"
                                         data-testid="select-filter-by-divider-color"
                                         data-alt-id="select-filter-by-color"
                                         aria-label="Filter section cards by divider color"
                                         value={pdfDividerColorFilter}
                                         className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/40 rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-100 cursor-pointer transition-colors"
                                       >
                                         <option value="all">All Colors ({currentSectionOrder.length})</option>
                                         {DIVIDER_COLOR_OPTIONS.map((c) => (
                                           <option key={c.value} value={c.value}>
                                             {c.label} ({dividerColorCounts[c.value.toLowerCase()] || 0})
                                           </option>
                                       </select>
                                       {pdfDividerColorFilter !== 'all' && (
                                         <button
                                           id="btn-clear-color-filter"
                                           data-testid="btn-clear-color-filter"
                                           type="button"
                                           className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                                           title="Clear color filter"
                                           aria-label="Clear color filter"
                                         >
                                           <X className="w-2.5 h-2.5" />
                                         </button>
                                     </div>
                                 <span className="text-[9.5px] text-zinc-400 hidden sm:inline">
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
                                       className="w-full text-[11px] font-medium bg-zinc-900 border border-amber-500/50 hover:border-amber-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/40 rounded px-2.5 py-1 text-zinc-100 cursor-pointer shadow-xs transition-colors"
                                     >
                                       <optgroup label="Predefined Stakeholder Templates">
                                         {PREDEFINED_PDF_TEMPLATES.map((tmpl) => (
                                           <option key={tmpl.id} value={tmpl.id}>
                                             {tmpl.name} — {tmpl.audience}
                                           </option>
                                       </optgroup>
                                       {savedCustomPdfTemplate && (
                                         <optgroup label="Saved Presets">
                                           <option value="saved-custom">
                                             Saved Preset: {savedCustomPdfTemplate.name}
                                           </option>
                                         </optgroup>
                                       {currentMatchedTemplateId === 'custom' && (
                                         <optgroup label="Current Configuration">
                                           <option value="custom">Custom Configuration (Modified)</option>
                                         </optgroup>
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
                                   </div>
                                   <span className="text-[9.5px] text-zinc-400 leading-tight">
                                     {activeTemplateMeta.description}
                                   </span>
                                 </div>
                               </div>
                             

                             {/* Section Sorting & Auto-Grouping Control Bar */}
                             <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-zinc-950/70 border border-zinc-800/80 flex-wrap gap-2">
                               <div className="flex items-center gap-2 flex-wrap">
                                 <div className="flex items-center gap-1">
                                   <label htmlFor="select-pdf-section-sort" className="font-semibold text-zinc-300 flex items-center gap-1">
                                     <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                                     <span>Sort Sections:</span>
                                   </label>
                                   <select
                                     id="select-pdf-section-sort"
                                     data-testid="select-pdf-section-sort"
                                     aria-label="Sort Sections"
                                     value={pdfSectionSortMode}
                                     className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-zinc-200 text-[10px] rounded px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                                   >
                                     <option value="default">In-Order (Default)</option>
                                     <option value="title">Title (A-Z)</option>
                                     <option value="tag">Tag / Category (A-Z)</option>
                                   </select>
                                 </div>
                                 <label
                                   htmlFor="toggle-auto-group-category"
                                   className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                                   title="Automatically group and sort cards by data domain category in report output and preview"
                                 >
                                   <input
                                     id="toggle-auto-group-category"
                                     data-testid="toggle-auto-group-category"
                                     type="checkbox"
                                     checked={isGroupByTagActive}
                                     className="accent-amber-500 rounded cursor-pointer"
                                   />
                                   <span className="font-medium text-zinc-200">Auto-Group by Category</span>
                                 </label>
                                 <button
                                   id="btn-reset-section-groups-bar"
                                   data-testid="btn-reset-section-groups-bar"
                                   type="button"
                                   onClick={handleResetSectionGroups}
                                   className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 hover:text-amber-200 border border-zinc-800 hover:border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                   title="Revert all section grouping to default, removing any custom folders or categories"
                                 >
                                   <FolderX className="w-2.5 h-2.5 text-amber-400" />
                                   <span>Reset Section Groups</span>
                                 </button>
                                 <div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
                                   <button
                                     id="btn-expand-all-groups"
                                     data-testid="btn-expand-all-groups"
                                     type="button"
                                     onClick={handleExpandAllSectionGroups}
                                     className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                     title="Expand all section group folders"
                                   >
                                     <FolderOpen className="w-2.5 h-2.5 text-amber-400" />
                                     <span>Expand All</span>
                                   </button>
                                   <button
                                     id="btn-collapse-all-groups"
                                     data-testid="btn-collapse-all-groups"
                                     type="button"
                                     onClick={handleCollapseAllSectionGroups}
                                     className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 text-[9.5px] font-medium transition-colors cursor-pointer"
                                     title="Collapse all section group folders"
                                   >
                                     <Folder className="w-2.5 h-2.5 text-amber-400" />
                                     <span>Collapse All</span>
                                   </button>
                                 </div>
                               </div>
                             </div>

                              {/* Export Preset Manager with Category Folders */}
                              <div
                                id="export-preset-manager"
                                data-testid="export-preset-manager"
                                className="p-2.5 rounded bg-zinc-950/90 border border-amber-500/30 text-zinc-200 space-y-2.5 shadow-inner"
                              >
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-300 font-mono">
                                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Export Preset Manager (Category Folders)</span>
                                  </div>
                                  {presetActionFeedback && (
                                    <span className="text-[9.5px] text-emerald-300 font-mono animate-fadeIn flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>{presetActionFeedback}</span>
                                    </span>
                                </div>

                                {/* Save Preset Controls with Folder Selection */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <input
                                    id="input-new-preset-name"
                                    data-testid="input-new-preset-name"
                                    type="text"
                                    placeholder="Preset Name (e.g. Q3 SLA Report)..."
                                    value={newPresetNameInput}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveNewExportPreset();
                                      }
                                    }}
                                    className="flex-1 min-w-[160px] bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded px-2 py-1 text-[10px] font-mono text-zinc-200 shadow-xs"
                                    aria-label="New export preset name"
                                  />
                                  <select
                                    id="select-new-preset-folder"
                                    data-testid="select-new-preset-folder"
                                    value={newPresetFolderInput}
                                    className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded px-2 py-1 text-[10px] font-mono text-amber-300 cursor-pointer shadow-xs"
                                    title="Select category folder for new preset"
                                    aria-label="Select category folder"
                                  >
                                    {['General', 'Audits', 'Executive', 'Production'].map((f) => (
                                      <option key={f} value={f}>📁 {f}</option>
                                    {availableFolders.filter(f => !['General', 'Audits', 'Executive', 'Production'].includes(f)).map((f) => (
                                      <option key={f} value={f}>📁 {f}</option>
                                  </select>
                                  <button
                                    id="btn-save-new-export-preset"
                                    data-testid="btn-save-new-export-preset"
                                    type="button"
                                    onClick={handleSaveNewExportPreset}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-[10px] transition-colors cursor-pointer shadow-xs shrink-0"
                                    title="Save current export configuration as a new named preset in the selected folder"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Save Preset</span>
                                  </button>
                                </div>

                                {/* Search Bar for Export Presets */}
                                <div className="relative flex items-center">
                                  <Search className="absolute left-2.5 w-3 h-3 text-zinc-400 pointer-events-none" />
                                  <input
                                    id="input-preset-search"
                                    data-testid="input-preset-search"
                                    type="text"
                                    placeholder="Search presets by name or folder..."
                                    value={presetSearchQuery}
                                    className="w-full bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded pl-7 pr-6 py-1 text-[10px] font-mono text-zinc-200 shadow-xs"
                                    aria-label="Search saved export presets"
                                  />
                                  {presetSearchQuery && (
                                    <button
                                      type="button"
                                      className="absolute right-2 text-[9px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                      title="Clear search"
                                    >
                                      ✕
                                    </button>
                                </div>

                                
                                {/* Recent Usage Time Filter Buttons */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 mb-1.5">
                                  <span className="text-[9px] text-zinc-400 font-mono">Usage Filter:</span>
                                  {[
                                    { id: 'all', label: 'All Time' },
                                    { id: '7days', label: 'Last 7 Days' },
                                    { id: '30days', label: 'Last 30 Days' },
                                  ].map((tf) => {
                                    const active = presetTimeFilter === tf.id;
                                    return (
                                      <button
                                        key={tf.id}
                                        id={`btn-preset-time-filter-${tf.id}`}
                                        data-testid={`btn-preset-time-filter-${tf.id}`}
                                        type="button"
                                        className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer border ${
                                          active
                                            ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400'
                                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                                        }`}
                                      >
                                        {tf.label}
                                      </button>
                                    );
                                </div>
                                {/* Preset Sort Controls */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 mb-2">
                                  <span className="text-[9px] text-zinc-400 font-mono">Sort By:</span>
                                  {[
                                    { id: 'date', label: 'Newest First' },
                                    { id: 'name', label: 'Name (A-Z)' },
                                  ].map((sm) => {
                                    const active = presetSortMode === sm.id;
                                    return (
                                      <button
                                        key={sm.id}
                                        id={`btn-preset-sort-${sm.id}`}
                                        data-testid={`btn-preset-sort-${sm.id}`}
                                        type="button"
                                        className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer border ${
                                          active
                                            ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400'
                                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                                        }`}
                                      >
                                        {sm.label}
                                      </button>
                                    );
                                </div>
{/* Batch Action Toolbar */}
                                 {exportPresetsList.length > 0 && (
                                   <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-amber-500/40 text-[9.5px] font-mono gap-2 flex-wrap mb-1.5">
                                     <div className="flex items-center gap-2">
                                       <input
                                         id="checkbox-select-all-presets"
                                         data-testid="checkbox-select-all-presets"
                                         type="checkbox"
                                         checked={selectedPresetIds.length > 0 && selectedPresetIds.length === filteredExportPresetsList.length}
                                         onChange={(e) => {
                                           if (e.target.checked) {
                                             setSelectedPresetIds(filteredExportPresetsList.map((p) => p.id));
                                           } else {
                                             setSelectedPresetIds([]);
                                           }
                                         }}
                                         className="accent-amber-500 w-3 h-3 rounded cursor-pointer"
                                         aria-label="Select all filtered export presets"
                                       />
                                       <span className="text-amber-300 font-semibold">
                                         {selectedPresetIds.length > 0 ? `${selectedPresetIds.length} selected` : 'Select All'}
                                       </span>
                                     </div>
                                     {selectedPresetIds.length > 0 && (
                                       <div className="flex items-center gap-1.5 flex-wrap">
                                         <select
                                           id="select-batch-folder"
                                           data-testid="select-batch-folder"
                                           onChange={(e) => {
                                             const folder = e.target.value;
                                             if (folder) handleBatchMovePresets(folder);
                                             e.target.value = '';
                                           }}
                                           defaultValue=""
                                           className="bg-zinc-950 border border-zinc-700 hover:border-amber-500/60 rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-200 cursor-pointer"
                                           title="Batch move selected presets to another folder"
                                         >
                                           <option value="" disabled>Move to folder...</option>
                                           {['General', 'Audits', 'Executive', 'Production'].map((f) => (
                                             <option key={f} value={f}>{f}</option>
                                           {availableFolders.filter(f => !['General', 'Audits', 'Executive', 'Production'].includes(f)).map((f) => (
                                             <option key={f} value={f}>{f}</option>
                                         </select>
                                         <button
                                           id="btn-batch-export-presets"
                                           data-testid="btn-batch-export-presets"
                                           type="button"
                                           onClick={handleBatchExportPresets}
                                           className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-blue-300 hover:text-blue-200 border border-zinc-700 text-[9px] font-mono font-medium transition-colors cursor-pointer"
                                           title="Bulk export selected presets as JSON file"
                                         >
                                           <FolderOpen className="w-2.5 h-2.5" />
                                           <span>Export Selected</span>
                                         </button>
                                         <button
                                           id="btn-batch-delete-presets"
                                           data-testid="btn-batch-delete-presets"
                                           type="button"
                                           onClick={handleBatchDeletePresets}
                                           className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-200 border border-rose-800 text-[9px] font-mono font-medium transition-colors cursor-pointer"
                                           title="Batch delete selected presets"
                                         >
                                           <Trash2 className="w-2.5 h-2.5" />
                                           <span>Delete Selected</span>
                                         </button>
                                       </div>
                                   </div>

                                 {/* Saved Presets Grouped by Category Folder */}
                                {exportPresetsList.length === 0 ? (
                                  <div className="text-[9.5px] text-zinc-400 font-mono italic py-1 px-1">
                                    No custom export presets saved yet. Create named configuration snapshots and organize them into category folders!
                                  </div>
                                ) : filteredExportPresetsList.length === 0 ? (
                                   <div className="text-[9.5px] text-zinc-400 font-mono italic py-1 px-1">
                                     No custom export presets saved yet. Create named configuration snapshots and organize them into category folders!
                                   </div>
                                 ) : filteredExportPresetsList.length === 0 ? (
                                   <div className="text-[9.5px] text-zinc-400 font-mono py-2 px-1 text-center space-y-1.5">
                                     <div>No export presets found matching "<span className="text-amber-300 font-semibold">{presetSearchQuery}</span>".</div>
                                     <button
                                       type="button"
                                       className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[9px] font-mono cursor-pointer"
                                     >
                                       Clear Search Filter
                                     </button>
                                   </div>
                                 ) : (
                                   <motion.div
                                     key={`${presetSearchQuery}-${presetTimeFilter}-${presetSortMode}-${exportPresetsList.length}`}
                                     initial={{ opacity: 0, y: 6 }}
                                     animate={{ opacity: 1, y: 0 }}
                                     transition={{ duration: 0.25, ease: 'easeOut' }}
                                     className="space-y-2 max-h-52 overflow-y-auto pr-1"
                                   >
                                     {Array.from(new Set(filteredExportPresetsList.map((p) => p.folder || 'General'))).map((folderName: string) => {
                                       const folderPresets = filteredExportPresetsList
                                          .filter((p) => (p.folder || 'General') === folderName)
                                          .sort((a, b) => {
                                            if (presetSortMode === 'name') {
                                              return a.name.localeCompare(b.name);
                                            } else {
                                              return b.createdAt - a.createdAt;
                                            }
                                          });
                                       const isCollapsed = Boolean(collapsedFolders[folderName]);

                                       return (
                                         <motion.div
                                           key={folderName}
                                           initial={{ opacity: 0, scale: 0.99 }}
                                           animate={{ opacity: 1, scale: 1 }}
                                           transition={{ duration: 0.2 }}
                                           className="rounded bg-zinc-900/60 border border-zinc-800/80 overflow-hidden"
                                         >
                                           {/* Folder Header */}
                                           <div
                                             className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/90 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/70 select-none transition-colors"
                                             title={`Click to ${isCollapsed ? 'expand' : 'collapse'} folder "${folderName}"`}
                                           >
                                             <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-amber-200">
                                               <Folder className="w-3.5 h-3.5 text-amber-400" />
                                               <span>{folderName}</span>
                                               <span className="text-[8.5px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                 {folderPresets.length} {folderPresets.length === 1 ? 'preset' : 'presets'}
                                               </span>
                                             </div>
                                             <div className="text-zinc-400 text-[10px]">
                                               {isCollapsed ? '▼' : '▲'}
                                             </div>
                                           

                                            </div>
                                           {/* Folder Content List */}
                                           {!isCollapsed && (
                                             <div className="p-1.5 space-y-1">
                                               {folderPresets.map((preset) => (
                                                 <div
                                                   key={preset.id}
                                                   data-testid={`preset-item-${preset.id}`}
                                                   className="flex items-center justify-between p-1.5 rounded bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 text-[10px] gap-2 transition-colors"
                                                 >
                                                   <div className="flex items-center gap-2 overflow-hidden">
                                                     <span className="font-semibold text-zinc-200 truncate font-mono">{preset.name}</span>
                                                     <span className="text-[8px] font-mono text-zinc-400 shrink-0">
                                                     </span>
                                                   </div>
                                                   <div className="flex items-center gap-1.5 shrink-0">
                                                     {/* Move folder selector dropdown */}
                                                     <select
                                                       value={preset.folder || 'General'}
                                                       className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[8.5px] font-mono text-zinc-300 cursor-pointer"
                                                       title="Move preset to another folder"
                                                       aria-label="Move preset to another folder"
                                                     >
                                                       {['General', 'Audits', 'Executive', 'Production'].map((f) => (
                                                         <option key={f} value={f}>{f}</option>
                                                       {availableFolders.filter(f => !['General', 'Audits', 'Executive', 'Production'].includes(f)).map((f) => (
                                                         <option key={f} value={f}>{f}</option>
                                                     </select>
                                                     <button
                                                       id={`btn-preview-preset-${preset.id}`}
                                                       data-testid={`btn-preview-preset-${preset.id}`}
                                                       type="button"
                                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 border border-zinc-700 text-[9px] font-mono font-medium transition-colors cursor-pointer"
                                                       title={`Preview settings of preset "${preset.name}"`}
                                                     >
                                                       <Eye className="w-2.5 h-2.5" />
                                                       <span>Preview</span>
                                                     </button>
                                                     <button
                                                       id={`btn-load-preset-${preset.id}`}
                                                       data-testid={`btn-load-preset-${preset.id}`}
                                                       type="button"
                                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                                       title={`Load export configuration preset "${preset.name}" into current export settings`}
                                                     >
                                                       <Check className="w-2.5 h-2.5" />
                                                       <span>Load</span>
                                                     </button>
                                                     <button
                                                       id={`btn-delete-preset-${preset.id}`}
                                                       data-testid={`btn-delete-preset-${preset.id}`}
                                                       type="button"
                                                       className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-zinc-700 text-[9px] font-mono transition-colors cursor-pointer"
                                                       title={`Delete preset "${preset.name}"`}
                                                     >
                                                       <Trash2 className="w-2.5 h-2.5" />
                                                       <span>Delete</span>
                                                     </button>
                                                   </div>
                                                 </div>
                                              </div>
                                             
                                         </motion.div>
                                       );
                                   </motion.div>
                              {/* Highlighted Preset Configuration Preview Box */}
                              {previewPresetItem && (
                                <div
                                  id="preset-preview-box"
                                  data-testid="preset-preview-box"
                                  className="p-3 rounded bg-amber-950/30 border border-amber-500/60 space-y-3 animate-fadeIn text-[10px] font-mono mt-2 shadow-md"
                                >
                                  {/* Visual Mini-Rendered Card Preview Panel */}
                                  <div className="p-3 rounded bg-zinc-950 border border-amber-500/30 space-y-2">
                                    <div className="text-amber-400 font-bold text-[10px] flex items-center gap-1.5">
                                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Visual Report Card Preview (Mini-Rendered Snapshot)</span>
                                    </div>
                                    <div className="p-3 rounded bg-zinc-900 border border-zinc-700/80 space-y-2.5 shadow-inner">
                                      {/* Mock Section 1: Sparklines */}
                                      <div style={{ paddingTop: `${previewPresetItem.sections.paddingSparklines ?? 10}px`, paddingBottom: `${previewPresetItem.sections.paddingSparklines ?? 10}px` }} className="transition-all">
                                        <div className="flex items-center justify-between text-[9px] font-semibold text-zinc-200">
                                          <span>📊 Sparklines & Performance Trend</span>
                                          <span className="text-[8px] text-amber-300/80 font-mono">Padding: {previewPresetItem.sections.paddingSparklines ?? 10}px</span>
                                        </div>
                                        <div className="h-4 bg-zinc-800/80 rounded mt-1 opacity-70 flex items-center px-2 text-[8px] text-zinc-400 font-mono">Trend chart preview placeholder</div>
                                      </div>

                                      {/* Mock Divider 1 */}
                                      <div
                                        style={{
                                          borderTopWidth: `${previewPresetItem.sections.dividerThickness ?? 1.5}px`,
                                          borderTopStyle: (previewPresetItem.sections.dividerStyle as any) || 'solid',
                                          borderTopColor: previewPresetItem.sections.dividerColor || '#cbd5e1'
                                        }}
                                      />

                                      {/* Mock Section 2: Mutation History */}
                                      <div style={{ paddingTop: `${previewPresetItem.sections.paddingMutationHistory ?? 10}px`, paddingBottom: `${previewPresetItem.sections.paddingMutationHistory ?? 10}px` }} className="transition-all">
                                        <div className="flex items-center justify-between text-[9px] font-semibold text-zinc-200">
                                          <span>🔄 State Mutation Audit Log</span>
                                          <span className="text-[8px] text-amber-300/80 font-mono">Padding: {previewPresetItem.sections.paddingMutationHistory ?? 10}px</span>
                                        </div>
                                        <div className="h-4 bg-zinc-800/80 rounded mt-1 opacity-70 flex items-center px-2 text-[8px] text-zinc-400 font-mono">Audit table preview placeholder</div>
                                      </div>

                                      {/* Mock Divider 2 */}
                                      <div
                                        style={{
                                          borderTopWidth: `${previewPresetItem.sections.dividerThickness ?? 1.5}px`,
                                          borderTopStyle: (previewPresetItem.sections.dividerStyle as any) || 'solid',
                                          borderTopColor: previewPresetItem.sections.dividerColor || '#cbd5e1'
                                        }}
                                      />

                                      {/* Mock Section 3: Recommendations */}
                                      <div style={{ paddingTop: `${previewPresetItem.sections.paddingRecommendations ?? 10}px`, paddingBottom: `${previewPresetItem.sections.paddingRecommendations ?? 10}px` }} className="transition-all">
                                        <div className="flex items-center justify-between text-[9px] font-semibold text-zinc-200">
                                          <span>💡 AI Optimization Recommendations</span>
                                          <span className="text-[8px] text-amber-300/80 font-mono">Padding: {previewPresetItem.sections.paddingRecommendations ?? 10}px</span>
                                        </div>
                                        <div className="h-4 bg-zinc-800/80 rounded mt-1 opacity-70 flex items-center px-2 text-[8px] text-zinc-400 font-mono">Recommendations list preview placeholder</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[8.5px] text-zinc-400 px-1 pt-0.5">
                                      <span>Style: <strong className="text-amber-300 uppercase">{previewPresetItem.sections.dividerStyle || 'solid'}</strong></span>
                                      <span>Thickness: <strong className="text-amber-300">{previewPresetItem.sections.dividerThickness ?? 1.5}px</strong></span>
                                      <span className="flex items-center gap-1">Color: <span className="w-2.5 h-2.5 rounded inline-block border border-zinc-600" style={{ backgroundColor: previewPresetItem.sections.dividerColor || '#cbd5e1' }} /> <strong className="text-amber-300">{previewPresetItem.sections.dividerColor || '#cbd5e1'}</strong></span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-1">
                                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Preset Preview: {previewPresetItem.name}</span>
                                      <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-900/50 text-amber-200 border border-amber-500/40">
                                        Folder: {previewPresetItem.folder || 'General'}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="text-amber-400 hover:text-amber-200 text-[10px] cursor-pointer"
                                      title="Close preview"
                                    >
                                      ✕ Close
                                    </button>
                                  </div>

                                  {/* Highlights: Padding, Style, Color */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300">
                                    <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-1">
                                      <div className="text-amber-400 font-semibold text-[9.5px]">🎨 Divider Configuration</div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Style:</span>
                                        <span className="font-mono text-zinc-200 uppercase">{previewPresetItem.sections.dividerStyle || 'solid'}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Thickness:</span>
                                        <span className="font-mono text-zinc-200">{previewPresetItem.sections.dividerThickness ?? 1.5}px</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Color:</span>
                                        <div className="flex items-center gap-1">
                                          <span
                                            className="w-3 h-3 rounded border border-zinc-600 inline-block"
                                            style={{ backgroundColor: previewPresetItem.sections.dividerColor || '#cbd5e1' }}
                                          />
                                          <span className="font-mono text-zinc-200">{previewPresetItem.sections.dividerColor || '#cbd5e1'}</span>
                                        </div>
                                      </div>
                                      {/* Live Divider Preview Line */}
                                      <div className="pt-1">
                                        <div className="text-[8px] text-zinc-500 mb-0.5">Live Divider Render:</div>
                                        <div
                                          className="w-full"
                                          style={{
                                            borderTopWidth: `${previewPresetItem.sections.dividerThickness ?? 1.5}px`,
                                            borderTopStyle: (previewPresetItem.sections.dividerStyle as any) || 'solid',
                                            borderTopColor: previewPresetItem.sections.dividerColor || '#cbd5e1'
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-1">
                                      <div className="text-amber-400 font-semibold text-[9.5px]">📐 Section Padding Settings</div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Sparklines Padding:</span>
                                        <span className="font-mono text-zinc-200">{previewPresetItem.sections.paddingSparklines ?? 10}px</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Mutation History Padding:</span>
                                        <span className="font-mono text-zinc-200">{previewPresetItem.sections.paddingMutationHistory ?? 10}px</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Recommendations Padding:</span>
                                        <span className="font-mono text-zinc-200">{previewPresetItem.sections.paddingRecommendations ?? 10}px</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px]">
                                        <span className="text-zinc-400">Executive Summary Padding:</span>
                                        <span className="font-mono text-zinc-200">{previewPresetItem.sections.paddingExecutiveSummary ?? 10}px</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      id="btn-load-previewed-preset"
                                      data-testid="btn-load-previewed-preset"
                                      type="button"
                                      onClick={() => {
                                        handleLoadExportPreset(previewPresetItem);
                                        setPreviewPresetItem(null);
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold text-[10px] transition-colors cursor-pointer"
                                    >
                                      <FolderOpen className="w-3 h-3" />
                                      <span>Load This Preset Now</span>
                                    </button>
                                  
                                   </div>
                                   </div>
                              

                              {/* Global CSV Default Naming Pattern Setting */}
                              <div
                                id="container-pdf-global-naming-pattern"
                                data-testid="container-pdf-global-naming-pattern"
                                className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 flex flex-col gap-2 shadow-xs transition-colors focus-within:border-amber-500/50"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 text-zinc-200 text-[10.5px] font-semibold">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>Global CSV Filename Naming Pattern:</span>
                                    <span className="text-[9.5px] font-normal text-zinc-400 hidden sm:inline">
                                      Define standard filename pattern (e.g., {'{section_name}_{timestamp}'}) for all exported section CSVs
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {patternAppliedSuccess && (
                                      <span
                                        id="badge-naming-pattern-applied-success"
                                        data-testid="badge-naming-pattern-applied-success"
                                        className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 font-semibold animate-fadeIn"
                                      >
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span>Applied to all cards!</span>
                                      </span>
                                    <button
                                      id="btn-apply-naming-pattern-all-cards"
                                      data-testid="btn-apply-naming-pattern-all-cards"
                                      type="button"
                                      onClick={handleApplyNamingPatternToAllCards}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-zinc-950 font-semibold text-[10px] transition-colors cursor-pointer shadow-xs"
                                      title="Apply this global naming pattern to all existing section cards in one click"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      <span>Apply Pattern to All Existing Cards</span>
                                    </button>
                                    <button
                                      id="btn-reset-naming-pattern-all-cards"
                                      data-testid="btn-reset-naming-pattern-all-cards"
                                      type="button"
                                      onClick={handleResetAllFilenamePrefixes}
                                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[10px] font-medium transition-colors cursor-pointer"
                                      title="Clear custom prefixes from all cards to use dynamic global pattern"
                                    >
                                      Reset Card Prefixes
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                  <div className="relative flex-1 min-w-[220px]">
                                    <input
                                      id="input-global-csv-naming-pattern"
                                      data-testid="input-global-csv-naming-pattern"
                                      type="text"
                                      aria-label="Global CSV Filename Naming Pattern"
                                      value={globalCsvNamingPattern}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setGlobalCsvNamingPattern(val);
                                        setPdfExportSections((prev) => ({
                                          ...prev,
                                          globalCsvNamingPattern: val
                                        }));
                                      }}
                                      placeholder="{section_name}_{timestamp}"
                                      className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/40 text-zinc-100 font-mono text-[10.5px] shadow-xs"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-zinc-400 shrink-0">
                                    <span className="text-zinc-500">Live Preview:</span>
                                    <span
                                      id="preview-global-csv-naming-pattern"
                                      data-testid="preview-global-csv-naming-pattern"
                                      className="px-2 py-0.5 rounded bg-zinc-900 text-amber-300 border border-zinc-800 font-semibold"
                                      title="Live evaluated preview for Trend Sparklines CSV"
                                    >
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-[9.5px] text-zinc-400 flex-wrap">
                                  <span className="text-zinc-500 font-mono text-[9px]">Pattern variables:</span>
                                  {[
                                    { var: '{section_name}', desc: 'Section slug (sparklines, mutation_history, etc.)' },
                                    { var: '{timestamp}', desc: 'Timestamp (YYYYMMDD_HHMMSS)' },
                                    { var: '{date}', desc: 'Calendar date (YYYY-MM-DD)' },
                                    { var: '{records}', desc: 'Telemetry record count' }
                                  ].map((v) => (
                                    <button
                                      key={v.var}
                                      type="button"
                                      onClick={() => {
                                        if (!globalCsvNamingPattern.includes(v.var)) {
                                          setGlobalCsvNamingPattern((prev) => prev ? `${prev}_${v.var}` : v.var);
                                        }
                                      }}
                                      className="font-mono text-zinc-300 hover:text-amber-300 text-[9px] bg-zinc-900 hover:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-800 transition-colors cursor-pointer"
                                      title={v.desc}
                                    >
                                      {v.var}
                                    </button>

                                  <span className="text-zinc-500 font-mono text-[9px] ml-2">Presets:</span>
                                  {[
                                    '{section_name}_{timestamp}',
                                    '{section_name}_{date}',
                                    '{section_name}_{records}rows',
                                    'export_{section_name}_{timestamp}'
                                  ].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => {
                                        setGlobalCsvNamingPattern(preset);
                                        setPdfExportSections((prev) => ({
                                          ...prev,
                                          globalCsvNamingPattern: preset
                                        }));
                                      }}
                                      className={`px-1.5 py-0.2 rounded font-mono text-[9px] cursor-pointer transition-colors border ${
                                        globalCsvNamingPattern === preset
                                          ? 'bg-amber-500/25 border-amber-500/60 text-amber-200 font-semibold'
                                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                </div>
                              

                             {/* Section Configuration Quick Search Area */}
                             <div
                               id="container-pdf-section-quick-search"
                               data-testid="container-pdf-section-quick-search"
                               className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 flex flex-col gap-2 shadow-xs transition-colors focus-within:border-amber-500/50"
                             >
                               <div className="flex items-center justify-between gap-2 flex-wrap">
                                 <label
                                   htmlFor="input-pdf-section-quick-search"
                                   className="flex items-center gap-1.5 text-[10.5px] font-semibold text-zinc-200 cursor-pointer select-none"
                                 >
                                   <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                   <span>Quick Search:</span>
                                   <span className="text-[9.5px] font-normal text-zinc-400 hidden sm:inline">
                                     Filter section cards instantly by keyword while dragging &amp; reordering
                                   </span>
                                 </label>

                                 <div className="flex items-center gap-1.5">
                                   {pdfSectionSearchQuery.trim() ? (
                                     <span
                                       id="badge-quick-search-results-count"
                                       data-testid="badge-quick-search-results-count"
                                       className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                                     >
                                       <span>{filteredSectionOrder.length} of {currentSectionOrder.length} sections matched</span>
                                     </span>
                                   ) : (
                                     <span className="text-[9px] font-mono text-zinc-500">
                                       {currentSectionOrder.length} sections available
                                     </span>
                                 </div>
                               </div>

                               <div className="relative flex items-center">
                                 <Search className="absolute left-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                                 <input
                                   id="input-pdf-section-quick-search"
                                   data-testid="input-pdf-section-quick-search"
                                   data-alt-id="input-pdf-section-search"
                                   aria-label="Quick Search section cards"
                                   type="text"
                                   placeholder="Quick Search sections by title, tag, or metric (e.g., Sparklines, Latency, Audit, Summary)..."
                                   value={pdfSectionSearchQuery}
                                   className="w-full pl-8 pr-8 py-1.5 rounded bg-zinc-900 border border-zinc-700/80 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/40 text-zinc-100 placeholder:text-zinc-500 text-[10.5px] transition-colors shadow-xs"
                                 />
                                 {pdfSectionSearchQuery && (
                                   <button
                                     id="btn-clear-pdf-section-quick-search"
                                     data-testid="btn-clear-pdf-section-quick-search"
                                     type="button"
                                     className="absolute right-2 p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                     title="Clear Quick Search filter"
                                    >                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                               </div>

                               {/* Quick Keyword Filter Chips */}
                               <div className="flex items-center gap-1.5 text-[9.5px] text-zinc-400 flex-wrap">
                                 <span className="text-zinc-500 font-mono text-[9px]">Suggested filters:</span>
                                 {[
                                   { label: 'Sparklines', query: 'Sparklines' },
                                   { label: 'Mutation', query: 'Mutation' },
                                   { label: 'Recommendations', query: 'Recommendations' },
                                   { label: 'Executive', query: 'Executive' },
                                   { label: 'Metrics', query: 'Metrics' },
                                   { label: 'Logs', query: 'Logs' }
                                 ].map((chip) => {
                                   const isActive = pdfSectionSearchQuery.toLowerCase() === chip.query.toLowerCase();
                                   return (
                                     <button
                                       key={chip.label}
                                       type="button"
                                       onClick={() => {
                                         setPdfSectionSearchQuery(isActive ? '' : chip.query);
                                       }}
                                       className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-colors cursor-pointer border ${
                                         isActive
                                           ? 'bg-amber-500/25 border-amber-500/60 text-amber-200 font-semibold'
                                           : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                       }`}
                                     >
                                       {chip.label}
                                     </button>
                                   );
                                 {pdfSectionSearchQuery && (
                                   <button
                                     type="button"
                                     className="ml-auto text-amber-400 hover:text-amber-300 underline text-[9px] cursor-pointer"
                                   >
                                     Reset Filter
                                   </button>
                               </div>
                             

                             {/* Section Reordering Control Banner */}
                             <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-zinc-950/70 border border-zinc-800/80 flex-wrap gap-2">
                               <div className="flex items-center gap-1.5 text-zinc-300">
                                 <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                 <span className="font-semibold text-zinc-200">Drag-and-Drop Section Layout:</span>
                                 <span className="text-zinc-400 text-[9.5px]">
                                   Drag cards or use arrows to visually customize report section order
                                 </span>
                               </div>
                               <div className="flex items-center gap-2">
                                 {isOrderCustomized && (
                                   <span
                                     id="badge-pdf-custom-order"
                                     data-testid="badge-pdf-custom-order"
                                     className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                                   >
                                     Custom Order Active
                                   </span>
                                 <button
                                   id="btn-copy-pdf-settings"
                                    data-testid="btn-copy-pdf-settings"
                                    type="button"
                                    onClick={handleCopyPdfSettings}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 text-[9.5px] font-medium transition-colors cursor-pointer mr-1"
                                    title="Copy current PDF export configuration JSON to clipboard"
                                  >
                                    {copiedPdfSettings ? (
                                      <>
                                        <ClipboardCheck className="w-2.5 h-2.5 text-emerald-400" />
                                        <span className="text-emerald-300 font-semibold">Copied JSON!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-2.5 h-2.5 text-amber-400" />
                                        <span>Copy Settings</span>
                                      </>
                                  </button>
                                  <button
                                    id="btn-reset-all-pdf-layouts"
                                    data-testid="btn-reset-all-pdf-layouts"
                                    type="button"
                                    onClick={handleResetAllPdfLayouts}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/40 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-[9.5px] font-semibold transition-colors cursor-pointer mr-1"
                                    title="Reset section order, inclusion toggles, and page breaks for all cards simultaneously"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    <span>Reset All Layouts</span>
                                  </button>
                                  <button
                                    id="btn-reset-pdf-section-order"
                                   data-testid="btn-reset-pdf-section-order"
                                   type="button"
                                   onClick={handleResetPdfSectionOrder}
                                   className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 text-[9.5px] font-medium transition-colors cursor-pointer"
                                   title="Reset sections to default sequential order"
                                 >
                                   <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                                   <span>Reset Order</span>
                                 </button>
                               </div>
                             </div>

                             {/* Drag-and-drop Reorderable Section Cards */}
                             <div
                               id="container-pdf-export-sections"
                               data-testid="container-pdf-export-sections"
                               className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5"
                             >
                               {draggedPdfSectionIndex !== null && (
                                 <div
                                   id="banner-pdf-dragging-active"
                                   data-testid="banner-pdf-dragging-active"
                                   className="col-span-full px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-dashed border-amber-500/60 text-amber-300 text-[10px] font-medium flex items-center justify-between animate-pulse flex-wrap gap-1 shadow-xs"
                                 >
                                   <div className="flex items-center gap-1.5">
                                     <span>📍 Dragging section {draggedPdfSectionId ? `"${PDF_SECTION_CONFIG_ITEMS[draggedPdfSectionId.includes('_dup_') ? (draggedPdfSectionId.split('_dup_')[0] as DiagnosticPdfSectionId) : (draggedPdfSectionId as DiagnosticPdfSectionId)]?.title || draggedPdfSectionId}"` : ''}</span>
                                     <span className="text-zinc-400 font-normal">• Drop over any visible section card to reorder position</span>
                                   </div>
                                   {pdfSectionSearchQuery.trim() ? (
                                     <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40">
                                       Quick Search Active: &quot;{pdfSectionSearchQuery}&quot; ({filteredSectionOrder.length} visible)
                                     </span>
                                   ) : (
                                      <span className="font-mono text-[9px]">Source Position: #{draggedPdfSectionIndex + 1}</span>
                                  </div>
                               {filteredSectionOrder.length === 0 ? (
                                 <div
                                   id="empty-pdf-section-quick-search-results"
                                   data-testid="empty-pdf-section-quick-search-results"
                                   className="col-span-full py-6 text-center bg-zinc-950/60 rounded border border-zinc-800 text-zinc-400 text-[11px] flex flex-col items-center justify-center gap-1.5 shadow-xs"
                                 >
                                   {pdfDividerColorFilter !== 'all' ? (
                                     <>
                                       <Palette className="w-5 h-5 text-amber-400/80 mb-0.5" />
                                       <span>
                                         No matching section cards with divider color &ldquo;
                                         <span className="text-amber-300 font-semibold">
                                           {DIVIDER_COLOR_OPTIONS.find((c) => c.value.toLowerCase() === pdfDividerColorFilter.toLowerCase())?.label || pdfDividerColorFilter}
                                         </span>
                                         &rdquo;
                                       </span>
                                       <span className="text-[10px] text-zinc-500">
                                         Try selecting &ldquo;All Colors&rdquo; or change divider colors using the selector on individual cards
                                       </span>
                                       <button
                                         id="btn-clear-empty-color-filter"
                                         data-testid="btn-clear-empty-color-filter"
                                         type="button"
                                         onClick={() => {
                                           setPdfDividerColorFilter('all');
                                           setPdfSectionSearchQuery('');
                                         }}
                                         className="mt-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 border border-zinc-700 text-[10px] font-medium cursor-pointer transition-colors"
                                       >
                                         Show All Section Cards
                                       </button>
                                     </>
                                   ) : (
                                     <>
                                       <Search className="w-5 h-5 text-zinc-600 mb-0.5" />
                                       <span>No matching PDF section cards found for &ldquo;<span className="text-amber-300 font-semibold">{pdfSectionSearchQuery}</span>&rdquo;</span>
                                       <span className="text-[10px] text-zinc-500">Try searching for keywords like &ldquo;Sparklines&rdquo;, &ldquo;History&rdquo;, &ldquo;Metrics&rdquo;, or &ldquo;Audit&rdquo;</span>
                                       <button
                                         id="btn-clear-empty-quick-search"
                                         data-testid="btn-clear-empty-quick-search"
                                         type="button"
                                         className="mt-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 border border-zinc-700 text-[10px] font-medium cursor-pointer transition-colors"
                                       >
                                          Clear Quick Search filter
                                        </button>
                                      </>
                                  </div>
                                ) : (

                                 (() => {
                                   const renderCard = (sectionId: string, index: number) => {
                                  const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
                                  const item = PDF_SECTION_CONFIG_ITEMS[baseId as DiagnosticPdfSectionId];
                                  if (!item) return null;
                                  const isDuplicate = sectionId.includes('_dup_');
                                  const displayTitle = isDuplicate ? `${item.title} (Copy)` : item.title;
                                  const isIncluded = Boolean(pdfExportSections[item.includeKey]);
                                  const isBreak = Boolean(pdfExportSections[item.breakKey]);
                                  const isDivider = (pdfExportSections as any)[item.showDividerKey] !== false;
                                  const isDragging = draggedPdfSectionIndex === index;
                                  const isDragOver = dragOverPdfSectionIndex === index;

                                  return (
                                    <div
                                      key={sectionId}
                                      id={`card-pdf-section-${sectionId}`}
                                      data-testid={`card-pdf-section-${sectionId}`}
                                      data-section-id={sectionId}
                                      data-order-index={index}
                                      draggable={true}
                                      onDragEnd={handlePdfSectionDragEnd}
                                      className={`relative group flex flex-col justify-between p-2 pl-10 rounded overflow-hidden transition-all select-none ${
                                        isDragging
                                          ? 'opacity-30 border-2 border-dashed border-amber-500 bg-amber-950/25 scale-[0.98]'
                                          : isDragOver
                                          ? 'border-2 border-dashed border-amber-400 ring-4 ring-amber-400/40 bg-amber-950/60 shadow-xl scale-[1.02]'
                                          : draggedPdfSectionIndex !== null
                                          ? 'border border-dashed border-zinc-700/80 bg-zinc-900/70 hover:border-amber-500/60'
                                          : 'bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80'
                                      }`}
                                    >
                                      {/* Left Edge Categorical Indicator Bar */}
                                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.barColor} opacity-90`} />

                                      {/* Left Edge Explicit Drag Handle Visual Indicator */}
                                      <div
                                        id={`drag-handle-${sectionId}`}
                                        data-testid={`drag-handle-${item.id}`}
                                        data-testid-section={`drag-handle-${sectionId}`}
                                        data-drag-handle="true"
                                        draggable={true}
                                        className="absolute left-1.5 top-0 bottom-0 w-7 flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-amber-400 group-hover:text-zinc-300 hover:bg-amber-500/15 active:bg-amber-500/25 border-r border-zinc-800/80 group-hover:border-zinc-700/80 bg-zinc-950/60 transition-all z-10 select-none shadow-inner"
                                        title={`Drag Handle: Click and drag to reorder ${displayTitle}`}
                                        aria-label={`Drag Handle: Click and drag to reorder ${displayTitle}`}
                                      >
                                        <GripVertical className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-zinc-400 group-hover:text-amber-400" />
                                        <span
                                          data-testid={`drag-handle-text-${item.id}`}
                                          className="text-[7px] font-mono font-bold tracking-tighter text-zinc-400 group-hover:text-amber-300 uppercase leading-none select-none"
                                        >
                                          DRAG
                                        </span>
                                        <span className="sr-only">Drag Handle: Click and drag to reorder ${displayTitle}</span>
                                      

                                      {/* Hover-activated Pro-Tip Tooltip Banner */}
                                      <div className="absolute inset-x-2 bottom-2 z-30 p-2 rounded bg-zinc-900/95 border border-amber-500/50 shadow-2xl text-[10px] text-zinc-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-start gap-1.5 backdrop-blur-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-semibold text-amber-300 font-mono text-[9px] uppercase tracking-wider">Data Provenance Pro-Tip</span>
                                          <span className="text-[9.5px] text-zinc-300 leading-tight">{item.tip}</span>
                                        </div>
                                      </div>
                                      {isDragOver && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-bold text-[9px] shadow-lg animate-bounce flex items-center gap-1">
                                          <span>📍 Drop to Reorder (# {index + 1})</span>
                                        
                                   </div>
                                      <div>
                                        {/* Card Reordering Header Bar with Drag Handle & Position Badge */}
                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800/70 text-[9.5px]">
                                          <div className="flex items-center gap-1.5">
                                            <div
                                              data-testid={`drag-handle-header-${item.id}`}
                                              className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-zinc-500 hover:text-amber-400 transition-colors flex items-center shrink-0"
                                              title="Click & drag to reorder this section in the generated PDF report"
                                              aria-label={`Drag handle to reorder ${item.title}`}
                                            >
                                              <GripVertical className="w-3.5 h-3.5" />
                                            </div>
                                            <span
                                              data-testid={`badge-section-order-${item.id}`}
                                              className="font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 border border-zinc-700 text-[8.5px]"
                                              title={`Position #${index + 1} in generated PDF report sequence`}
                                            >
                                              Position #{index + 1}
                                            </span>

                                            {/* Show Dividers Toggle in Card Header */}
                                            {(() => {
                                              const toggleInputId = isDuplicate ? `${item.inputDividerToggleId}-${sectionId}` : item.inputDividerToggleId;
                                              return (
                                                <label
                                                  htmlFor={toggleInputId}
                                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8.5px] font-medium transition-colors cursor-pointer select-none ml-1 ${
                                                    isDivider
                                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                                                      : 'bg-zinc-800/80 border-zinc-700/70 text-zinc-400 hover:text-zinc-200'
                                                  } ${!isIncluded ? 'opacity-40 pointer-events-none' : ''}`}
                                                  title={`Controls whether a visible separator line is rendered between sections in the final PDF document after ${displayTitle}`}
                                                >
                                                  <input
                                                     id={toggleInputId}
                                                     data-testid={toggleInputId}
                                                     type="checkbox"
                                                     checked={isDivider}
                                                     disabled={!isIncluded || isSyncDividersLocked}
                                                     aria-label={`Toggle horizontal separator line after ${displayTitle}`}
                                                     onChange={(e) => {
                                                       const val = e.target.checked;
                                                       setPdfExportSections((prev) => ({ ...prev, [item.showDividerKey]: val }));
                                                       handleGenerateSnapshot(item.id);
                                                     }}
                                                     className="accent-amber-500 w-2.5 h-2.5 rounded cursor-pointer disabled:opacity-40"
                                                   />
                                                   <SeparatorHorizontal className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                                   <div className="flex flex-col leading-tight">
                                                     <span>Show Dividers</span>
                                                     {isSyncDividersLocked && (
                                                       <span className="text-[7.5px] font-mono text-amber-400 font-semibold tracking-tight">Auto-Synced</span>
                                                   </div>
                                                  {/* Small dynamic line preview showing style, color, and thickness */}
                                                  <span
                                                    id={`divider-line-preview-toggle-${sectionId}`}
                                                    data-testid={`divider-line-preview-toggle-${item.id}`}
                                                    data-testid-section={`divider-line-preview-toggle-${sectionId}`}
                                                    className={`inline-block w-6 transition-all shrink-0 rounded-xs ml-0.5 ${
                                                      !isDivider ? 'opacity-20 grayscale' : 'opacity-100'
                                                    }`}
                                                    style={{
                                                      borderColor: isDivider ? ((pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1') : '#71717a',
                                                      borderTopStyle: isDivider ? (String((pdfExportSections as any)[item.dividerStyleKey] || 'solid').toLowerCase() === 'dashed' ? 'dashed' : String((pdfExportSections as any)[item.dividerStyleKey] || 'solid').toLowerCase() === 'dotted' ? 'dotted' : 'solid') : 'solid',
                                                      height: 0
                                                    }}
                                                    aria-label="Divider line preview"
                                                  />
                                                </label>
                                              );
                                            {isDivider && (
                                              <select
                                                id={`select-divider-color-${sectionId}`}
                                                data-testid={`select-divider-color-${item.id}`}
                                                value={(pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1'}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setPdfExportSections((prev) => ({ ...prev, [item.dividerColorKey]: val }));
                                                  handleGenerateSnapshot(item.id);
                                                }}
                                                className="ml-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded px-1 py-0.5 text-[8.5px] font-mono text-zinc-300 focus:outline-none cursor-pointer"
                                                title={`Divider line color for ${displayTitle}`}
                                                aria-label={`Divider line color for ${displayTitle}`}
                                              >
                                                <option value="#cbd5e1">Slate (Default)</option>
                                                <option value="#f59e0b">Amber</option>
                                                <option value="#10b981">Emerald</option>
                                                <option value="#3b82f6">Blue</option>
                                                <option value="#71717a">Zinc</option>
                                                <option value="#ef4444">Rose</option>
                                              </select>

                                            {/* Dropdown configuration to toggle between Solid, Dashed, and Dotted line styles */}
                                            <div className="flex items-center gap-1 ml-1.5">
                                              <label
                                                htmlFor={isDuplicate ? `select-divider-style-${sectionId}` : item.inputDividerStyleId}
                                                className={`text-[8.5px] font-mono select-none flex items-center gap-0.5 ${
                                                  !isIncluded ? 'opacity-40 pointer-events-none text-zinc-500' : 'text-zinc-400'
                                                }`}
                                                title={`Section divider line style for ${displayTitle}`}
                                              >
                                                <span className="font-medium hidden sm:inline">Style:</span>
                                              </label>
                                              <select
                                                id={isDuplicate ? `select-divider-style-${sectionId}` : item.inputDividerStyleId}
                                                data-testid={`select-divider-style-${item.id}`}
                                                data-testid-section={`select-divider-style-${sectionId}`}
                                                name={`divider-style-${sectionId}`}
                                                disabled={!isIncluded}
                                                onChange={(e) => {
                                                  const val = e.target.value.toLowerCase();
                                                  setPdfExportSections((prev) => ({
                                                    ...prev,
                                                    [item.dividerStyleKey]: val,
                                                    [item.showDividerKey]: true
                                                  }));
                                                  handleGenerateSnapshot(item.id);
                                                }}
                                                className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded px-1.5 py-0.5 text-[8.5px] font-mono text-zinc-200 cursor-pointer disabled:opacity-40 shadow-xs"
                                                title={`Select section divider line style for ${displayTitle} (Solid, Dashed, Dotted)`}
                                                aria-label={`Select section divider line style for ${displayTitle}`}
                                              >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                              </select>

                                              {/* Segmented Toggle Buttons for quick line style toggling */}
                                              <div
                                                id={`container-divider-style-${sectionId}`}
                                                data-testid={`container-divider-style-${item.id}`}
                                                role="group"
                                                aria-label={`Toggle divider line style for ${displayTitle}`}
                                                className="inline-flex items-center rounded bg-zinc-900 border border-zinc-700/80 p-0.5 text-[8px] font-mono select-none"
                                                title={`Divider line style for ${displayTitle}: Solid, Dashed, or Dotted`}
                                              >
                                                {(['Solid', 'Dashed', 'Dotted'] as const).map((styleOpt) => {
                                                  const sVal = styleOpt.toLowerCase();
                                                  const activeStyle = String((pdfExportSections as any)[item.dividerStyleKey] || 'solid').toLowerCase();
                                                  const isSelected = activeStyle === sVal;
                                                  return (
                                                    <button
                                                      key={styleOpt}
                                                      id={`btn-divider-style-${sVal}-${sectionId}`}
                                                      data-testid={`btn-divider-style-${sVal}-${item.id}`}
                                                      type="button"
                                                      disabled={!isIncluded}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPdfExportSections((prev) => ({
                                                          ...prev,
                                                          [item.dividerStyleKey]: sVal,
                                                          [item.showDividerKey]: true
                                                        }));
                                                        handleGenerateSnapshot(item.id);
                                                      }}
                                                      className={`px-1.5 py-0.2 rounded transition-all cursor-pointer font-medium ${
                                                        isSelected
                                                          ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                                                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                                      }`}
                                                      title={`Switch divider line style to ${styleOpt}`}
                                                      aria-label={`${styleOpt} divider style for ${displayTitle}`}
                                                      aria-pressed={isSelected}
                                                    >
                                                      {styleOpt}
                                                    </button>
                                                  );
                                              </div>
                                            </div>
                                          </div>
                                          </div>

                                          <div className="flex items-center gap-0.5">
                                            <button
                                              id={`btn-move-up-section-${item.id}`}
                                              data-testid={`btn-move-up-section-${item.id}`}
                                              type="button"
                                              disabled={currentSectionOrder.indexOf(sectionId) <= 0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMovePdfSectionBySectionId(sectionId, 'up');
                                              }}
                                              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                                              title={`Move ${item.title} up in PDF report order`}
                                              aria-label={`Move ${item.title} up in PDF report order`}
                                            >
                                              <ChevronUp className="w-3 h-3" />
                                            </button>
                                            <button
                                              id={`btn-move-down-section-${item.id}`}
                                              data-testid={`btn-move-down-section-${item.id}`}
                                              type="button"
                                              disabled={currentSectionOrder.indexOf(sectionId) >= currentSectionOrder.length - 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMovePdfSectionBySectionId(sectionId, 'down');
                                              }}
                                              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                                              title={`Move ${item.title} down in PDF report order`}
                                              aria-label={`Move ${item.title} down in PDF report order`}
                                            >
                                              <ChevronDown className="w-3 h-3" />
                                            </button>
                                             <button
                                               id={`btn-reset-section-${item.id}`}
                                               data-testid={`btn-reset-section-${item.id}`}
                                               type="button"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleResetSinglePdfSection(item.id);
                                               }}
                                               className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-amber-200 border border-zinc-700 text-[8.5px] font-medium transition-colors cursor-pointer ml-1"
                                               title={`Restore note, padding, and page break for ${item.title} to system defaults`}
                                             >
                                               <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                                               <span>Restore Default</span>
                                             </button>
                                             <button
                                               id={`btn-export-section-data-${item.id}`}
                                               data-testid={`btn-export-section-data-${item.id}`}
                                               type="button"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleExportSectionData(item.id);
                                               }}
                                               className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-emerald-300 border border-zinc-700 text-[8.5px] font-medium transition-colors cursor-pointer ml-1"
                                               title={`Export data subset associated with ${item.title} as a standalone CSV file`}
                                             >
                                               <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-400" />
                                               <span>Export Section Data</span>
                                             </button>
                                             <button
                                               id={`btn-export-section-stats-${item.id}`}
                                               data-testid={`btn-export-section-stats-${item.id}`}
                                               type="button"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleExportSectionStats(item.id);
                                               }}
                                               className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-purple-300 border border-zinc-700 text-[8.5px] font-medium transition-colors cursor-pointer ml-1"
                                               title={`Export configuration metadata (padding, note, delimiters, and break settings) for ${item.title} as a JSON file`}
                                             >
                                               <FileJson className="w-2.5 h-2.5 text-purple-400" />
                                               <span>Export Section Stats</span>
                                             </button>
                                             <button
                                               id={isDuplicate ? `btn-copy-json-${sectionId}` : `btn-copy-json-${item.id}`}
                                               data-testid={`btn-copy-json-${item.id}`}
                                               type="button"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleCopySectionConfiguration(sectionId);
                                               }}
                                               className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8.5px] font-medium transition-all cursor-pointer ml-1 select-none ${
                                                 copiedSectionConfigId === sectionId
                                                   ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-xs ring-1 ring-emerald-500/30'
                                                   : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-amber-300 border-zinc-700'
                                               }`}
                                               title={`Copy JSON: Copy configuration state (padding, note, delimiter, metadata, dividers) for ${displayTitle} to clipboard as formatted JSON`}
                                               aria-label={`Copy JSON for ${displayTitle}`}
                                             >
                                               {copiedSectionConfigId === sectionId ? (
                                                 <>
                                                   <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                                   <span className="text-emerald-300 font-semibold">Copied JSON!</span>
                                                 </>
                                               ) : (
                                                 <>
                                                   <Copy className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                                   <span>Copy JSON</span>
                                                 </>
                                             </button>
                                          </div>
                                        

                                        {/* Main Section Enable Toggle */}
                                        <div
                                          htmlFor={item.inputSectionId}
                                          className="flex items-start gap-2 cursor-pointer select-none"
                                        >
                                          <input
                                            id={item.inputSectionId}
                                            data-testid={item.inputSectionId}
                                            type="checkbox"
                                            checked={isIncluded}
                                            onChange={(e) => {
                                              const val = e.target.checked;
                                              setPdfExportSections((prev) => ({ ...prev, [item.includeKey]: val }));
                                              handleGenerateSnapshot(item.id);
                                            }}
                                            className="mt-0.5 accent-amber-500 rounded cursor-pointer"
                                          />
                                           <div className="flex flex-col text-[10.5px] flex-1">
                                             <div className="flex items-center justify-between gap-1 w-full">
                                               {(() => {
                                                 const paddingVal = Number(pdfExportSections[item.paddingKey] ?? 10);
                                                 const metricsExplanation = getSectionMetricsExplanation(
                                                   baseId as DiagnosticPdfSectionId,
                                                   displayTitle,
                                                   queryResult.records.length,
                                                   thresholdViolationsHistory.length,
                                                   isIncluded,
                                                   paddingVal,
                                                   isBreak
                                                 );

                                                 return (
                                                   <span
                                                     className="font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer hover:text-amber-300 transition-colors group/title flex-wrap"
                                                     title="Click to smoothly scroll and highlight card configuration"
                                                   >
                                                     <item.icon className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover/title:scale-110 transition-transform" />
                                                     <span>{displayTitle}</span>

                                                     {/* Info Icon with Dynamic Tooltip explaining specific data metrics included */}
                                                     <span
                                                       className="relative inline-flex items-center"
                                                     >
                                                       <button
                                                         id={`btn-info-section-${item.id}`}
                                                         data-testid={`btn-info-section-${item.id}`}
                                                         type="button"
                                                         onClick={(e) => {
                                                           e.stopPropagation();
                                                           e.preventDefault();
                                                           setActiveInfoTooltipSectionId(activeInfoTooltipSectionId === sectionId ? null : sectionId);
                                                         }}
                                                         className="p-0.5 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none"
                                                         title={metricsExplanation.textSummary}
                                                         aria-label={`View data metrics included in ${displayTitle}`}
                                                       >
                                                         <Info className="w-3 h-3 text-cyan-400 hover:text-cyan-300 transition-colors" />
                                                       </button>

                                                       {/* Dynamic Tooltip Popover */}
                                                       {activeInfoTooltipSectionId === sectionId && (
                                                         <div
                                                           id={`tooltip-info-section-${item.id}`}
                                                           data-testid={`tooltip-info-section-${item.id}`}
                                                           role="tooltip"
                                                           className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-50 w-72 sm:w-80 p-2.5 rounded-lg bg-zinc-900/98 border border-cyan-500/60 shadow-2xl text-[10.5px] text-zinc-200 pointer-events-auto backdrop-blur-md animate-fadeIn"
                                                         >
                                                           <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
                                                             <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                                                               <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                               <span>{displayTitle} — Included Metrics</span>
                                                             </div>
                                                             <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800">
                                                               {metricsExplanation.category}
                                                             </span>
                                                           </div>

                                                           <p className="text-[10px] text-zinc-300 leading-tight mb-2 font-normal">
                                                             {metricsExplanation.summary}
                                                           </p>

                                                           <div className="space-y-1.5 bg-zinc-950/80 rounded p-2 border border-zinc-800/80 mb-2 font-normal">
                                                             <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block">
                                                               Specific Metrics Measured:
                                                             </span>
                                                             <ul className="space-y-1 text-[9.5px]">
                                                               {metricsExplanation.metrics.map((m, idx) => (
                                                                 <li key={idx} className="flex items-start gap-1.5 leading-snug">
                                                                   <span className="text-cyan-400 mt-0.5">•</span>
                                                                   <span>
                                                                     <strong className="text-zinc-100 font-medium">{m.label}:</strong>{' '}
                                                                     <span className="text-zinc-300">{m.value}</span>
                                                                   </span>
                                                                 </li>
                                                             </ul>
                                                           </div>

                                                           <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-1.5 font-normal">
                                                             <span className="text-amber-400/90 font-medium">
                                                               Live telemetry: {queryResult.records.length} records analyzed
                                                             </span>
                                                             <span className="text-zinc-500">
                                                               Section: {isIncluded ? 'Included' : 'Excluded'}
                                                             </span>
                                                           </div>
                                                         </div>
                                                     </span>

                                                     <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${item.badgeClass}`}>
                                                       {item.badge}
                                                     </span>
                                                     <span
                                                       data-testid={`badge-data-points-${item.id}`}
                                                       className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40"
                                                       title={`Estimated rows / data points for ${item.title} based on current database query filters (${queryResult.records.length} records)`}
                                                     >
                                                       {item.id === 'sparklines'
                                                         : item.id === 'mutationHistory'
                                                         ? `${queryResult.records.length} records`
                                                         : item.id === 'recommendations'
                                                     </span>
                                                   </span>
                                                 );
                                               <span
                                                 title={item.tip}
                                                 className="text-zinc-400 hover:text-amber-300 transition-colors cursor-help p-0.5 inline-flex items-center shrink-0"
                                                 aria-label={item.tip}
                                               >
                                                 <HelpCircle className="w-3 h-3 text-amber-400/80 hover:text-amber-300" />
                                               </span>
                                             </div>
                                            {showPdfCardDescriptions && (
                                            <span className="text-[9.5px] text-zinc-400 leading-tight mt-0.5">
                                              {item.description}
                                            </span>
                                          
                                         </div>
                                      

                                       {isDetailedPdfLayout && (
                                       <div>
                                      {/* Add Custom Note Input Field */}
                                      <div className="mt-2 pt-1.5 border-t border-zinc-800/70">
                                        <div className="flex flex-col gap-1">
                                          <label
                                            htmlFor={item.inputNoteId}
                                            className={`text-[9.5px] font-medium flex items-center justify-between ${
                                              !isIncluded ? 'opacity-40 pointer-events-none text-zinc-500' : 'text-zinc-300'
                                            }`}
                                          >
                                            <span>Add Custom Note:</span>
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[8.5px] text-zinc-500 font-mono">Section Commentary</span>
                                              <button
                                                id={`btn-copy-note-${item.id}`}
                                                data-testid={`btn-copy-note-${item.id}`}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const noteText = String(pdfExportSections[item.noteKey] || '');
                                                  if (!noteText.trim()) return;
                                                  navigator.clipboard.writeText(noteText).then(() => {
                                                    setCopiedNoteSectionId(item.id);
                                                    setTimeout(() => setCopiedNoteSectionId((curr) => curr === item.id ? null : curr), 2000);
                                                  }).catch(() => {});
                                                }}
                                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-[8.5px] font-medium transition-colors cursor-pointer disabled:opacity-25 disabled:pointer-events-none"
                                                title={`Copy custom note for ${item.title} to clipboard for reuse elsewhere`}
                                              >
                                                {copiedNoteSectionId === item.id ? (
                                                  <>
                                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                                    <span className="text-emerald-300 font-semibold">Copied!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="w-2.5 h-2.5 text-amber-400" />
                                                    <span>Copy Note</span>
                                                  </>
                                              </button>
                                            </div>
                                          </label>
                                          <input
                                            id={item.inputNoteId}
                                            data-testid={item.inputNoteId}
                                            type="text"
                                            disabled={!isIncluded}
                                            placeholder="Add custom note for this section..."
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setPdfExportSections((prev) => ({
                                                ...prev,
                                                [item.noteKey]: val
                                              }));
                                              if (noteChangeTimeoutsRef.current[item.id]) {
                                                clearTimeout(noteChangeTimeoutsRef.current[item.id]);
                                              }
                                              noteChangeTimeoutsRef.current[item.id] = setTimeout(() => {
                                                handleGenerateSnapshot(item.id);
                                              }, 500);
                                            }}
                                            draggable={false}
                                            className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-[10px] focus:outline-none focus:border-amber-500/80 disabled:opacity-30 disabled:pointer-events-none"
                                          />
                                        </div>
                                      </div>

                                      {/* Page Break & Metadata Controls */}
                                      <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                                        <label
                                          htmlFor={item.inputBreakId}
                                          className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                            !isIncluded ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                          }`}
                                          title="Force this section to start on a new page"
                                        >
                                          <input
                                            id={item.inputBreakId}
                                            data-testid={item.inputBreakId}
                                            type="checkbox"
                                            disabled={!isIncluded}
                                            checked={isBreak}
                                            onChange={(e) => {
                                              const val = e.target.checked;
                                              setPdfExportSections((prev) => ({ ...prev, [item.breakKey]: val }));
                                              handleGenerateSnapshot(item.id);
                                            }}
                                            className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                          />
                                          <span className="font-mono flex items-center gap-1">
                                            <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                                            <span className={isBreak ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                              Insert Page Break
                                            </span>
                                          </span>
                                        </label>

                                        <label
                                          htmlFor={item.inputMetadataId}
                                          className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                            !isIncluded ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                          }`}
                                          title="Include section metadata footer row in PDF with timestamp & data point count"
                                        >
                                          <input
                                            id={item.inputMetadataId}
                                            data-testid={item.inputMetadataId}
                                            type="checkbox"
                                            disabled={!isIncluded}
                                            onChange={(e) => {
                                              const val = e.target.checked;
                                              setPdfExportSections((prev) => ({ ...prev, [item.metadataKey]: val }));
                                              handleGenerateSnapshot(item.id);
                                            }}
                                            className="accent-amber-500 rounded cursor-pointer w-3 h-3"
                                          />
                                          <span className="font-mono flex items-center gap-1">
                                            <span className={Boolean(pdfExportSections[item.metadataKey]) ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>
                                              Include Metadata
                                            </span>
                                          </span>
                                        </label>
                                       </div>

                                       {/* Section Divider Line Style Dropdown Configuration */}
                                       {isDivider && (
                                         <div
                                          id={`container-divider-style-detailed-${sectionId}`}
                                          data-testid={`container-divider-style-detailed-${item.id}`}
                                          className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between gap-2 flex-wrap text-[9.5px]"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <SeparatorHorizontal className="w-3 h-3 text-amber-400 shrink-0" />
                                            <label
                                              htmlFor={`select-divider-style-detailed-${sectionId}`}
                                              className="font-mono text-zinc-300 font-medium cursor-pointer"
                                            >
                                              Divider Line Style:
                                            </label>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <select
                                              id={`select-divider-style-detailed-${sectionId}`}
                                              data-testid={`select-divider-style-detailed-${item.id}`}
                                              disabled={!isIncluded}
                                              onChange={(e) => {
                                                const val = e.target.value.toLowerCase();
                                                setPdfExportSections((prev) => ({
                                                  ...prev,
                                                  [item.dividerStyleKey]: val,
                                                  [item.showDividerKey]: true
                                                }));
                                                handleGenerateSnapshot(item.id);
                                              }}
                                              className="bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none rounded px-2 py-0.5 text-[9px] font-mono text-zinc-200 cursor-pointer shadow-xs disabled:opacity-40"
                                              title={`Select section divider line style for ${displayTitle} (Solid, Dashed, Dotted)`}
                                              aria-label={`Select section divider line style for ${displayTitle}`}
                                            >
                                              <option value="solid">Solid</option>
                                              <option value="dashed">Dashed</option>
                                              <option value="dotted">Dotted</option>
                                            </select>

                                            <div
                                              className="inline-flex items-center rounded bg-zinc-900 border border-zinc-700 p-0.5 text-[8.5px] font-mono select-none"
                                              role="group"
                                              aria-label={`Toggle divider line style for ${displayTitle}`}
                                            >
                                              {(['Solid', 'Dashed', 'Dotted'] as const).map((styleOpt) => {
                                                const sVal = styleOpt.toLowerCase();
                                                const activeStyle = String((pdfExportSections as any)[item.dividerStyleKey] || 'solid').toLowerCase();
                                                const isSelected = activeStyle === sVal;
                                                return (
                                                  <button
                                                    key={styleOpt}
                                                    id={`btn-divider-style-detailed-${sVal}-${sectionId}`}
                                                    data-testid={`btn-divider-style-detailed-${sVal}-${item.id}`}
                                                    type="button"
                                                    disabled={!isIncluded}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setPdfExportSections((prev) => ({
                                                        ...prev,
                                                        [item.dividerStyleKey]: sVal,
                                                        [item.showDividerKey]: true
                                                      }));
                                                      handleGenerateSnapshot(item.id);
                                                    }}
                                                    className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                                                      isSelected
                                                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                                    }`}
                                                    title={`Switch divider line style to ${styleOpt}`}
                                                    aria-label={`${styleOpt} divider style for ${displayTitle}`}
                                                    aria-pressed={isSelected}
                                                  >
                                                    {styleOpt}
                                                  </button>
                                                );
                                            </div>
                                            {/* Live line style preview mini border */}
                                            <motion.div
                                              initial={{ opacity: 0.4, scaleX: 0.9 }}
                                              animate={{ opacity: 1, scaleX: 1 }}
                                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                                              className="w-12 h-0 border-t transition-all shrink-0"
                                              style={{
                                                borderColor: (pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1',
                                                borderTopStyle: ((pdfExportSections as any)[item.dividerStyleKey] || 'solid') === 'dashed' ? 'dashed' : ((pdfExportSections as any)[item.dividerStyleKey] || 'solid') === 'dotted' ? 'dotted' : 'solid',
                                              }}
                                            />
                                          
                                        
                                          </div>

                                       {/* Vertical Padding Slider Control */}
                                       <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                                         <label
                                           htmlFor={item.inputPaddingId}
                                           className={`flex items-center gap-1.5 text-[9.5px] cursor-pointer select-none transition-colors ${
                                             !isIncluded ? 'opacity-40 pointer-events-none' : 'text-zinc-300'
                                           }`}
                                           title="Adjust vertical white space / padding around this section in generated PDF"
                                         >
                                           <span className="font-mono text-zinc-400">Vertical Padding:</span>
                                           <span className="text-amber-300 font-semibold font-mono">
                                           </span>
                                         </label>
                                         <input
                                           id={item.inputPaddingId}
                                           data-testid={item.inputPaddingId}
                                           type="range"
                                           min="0"
                                           max="30"
                                           step="2"
                                           disabled={!isIncluded}
                                           onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setPdfExportSections((prev) => ({ ...prev, [item.paddingKey]: val }));
                                             handleGenerateSnapshot(item.id);
                                           }}
                                           className="w-24 accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
                                         />
                                       </div>

                                       {/* CSV Filename Prefix & Pattern Control */}
                                       <div className="mt-2 pt-1.5 border-t border-zinc-800/70 flex flex-col gap-1">
                                         <div className="flex items-center justify-between text-[9.5px]">
                                           <label
                                             htmlFor={item.inputFilenamePrefixId}
                                             className={`flex items-center gap-1 font-mono cursor-pointer select-none transition-colors ${
                                               !isIncluded ? 'opacity-40 pointer-events-none' : 'text-zinc-300 hover:text-amber-200'
                                             }`}
                                             title="Customize exported CSV filename prefix for this section"
                                           >
                                             <FileSpreadsheet className="w-3 h-3 text-emerald-400 shrink-0" />
                                             <span>CSV Filename Prefix:</span>
                                           </label>
                                           <div className="flex items-center gap-1">
                                             <button
                                               id={`btn-apply-pattern-section-${item.id}`}
                                               data-testid={`btn-apply-pattern-section-${item.id}`}
                                               type="button"
                                               disabled={!isIncluded}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 const resolved = resolveNamingPattern(globalCsvNamingPattern, item.id);
                                                 setPdfExportSections((prev) => ({
                                                   ...prev,
                                                   [item.filenamePrefixKey]: resolved
                                                 }));
                                               }}
                                               className="px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-amber-200 border border-zinc-700 text-[8.5px] font-medium transition-colors cursor-pointer disabled:opacity-25"
                                               title="Apply global naming pattern to this section"
                                             >
                                               Apply Pattern
                                             </button>
                                             {String(pdfExportSections[item.filenamePrefixKey] || '').trim() && (
                                               <button
                                                 type="button"
                                                 disabled={!isIncluded}
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setPdfExportSections((prev) => ({
                                                     ...prev,
                                                     [item.filenamePrefixKey]: ''
                                                   }));
                                                 }}
                                                 className="text-zinc-500 hover:text-zinc-300 text-[8.5px] underline cursor-pointer"
                                                 title="Clear custom prefix and use dynamic pattern default"
                                               >
                                                 Clear
                                               </button>
                                           </div>
                                         </div>
                                         <div className="flex items-center gap-1.5">
                                           <input
                                             id={item.inputFilenamePrefixId}
                                             data-testid={item.inputFilenamePrefixId}
                                             type="text"
                                             disabled={!isIncluded}
                                             onChange={(e) => {
                                               const val = e.target.value;
                                               setPdfExportSections((prev) => ({
                                                 ...prev,
                                                 [item.filenamePrefixKey]: val
                                               }));
                                             }}
                                             className="flex-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 text-[10px] focus:outline-none focus:border-amber-500/80 disabled:opacity-30 font-mono"
                                           />
                                           <span className="text-[9px] font-mono text-zinc-400 font-semibold">
                                             {((pdfExportSections as any)[item.delimiterKey] === '\t' || (pdfExportSections as any)[item.delimiterKey] === 'tab' || (pdfExportSections as any)[item.delimiterKey] === '\\t') ? '.tsv' : '.csv'}
                                           </span>
                                         </div>

                                         {/* Delimiter Selection Dropdown */}
                                         <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-[9.5px]">
                                           <label
                                             htmlFor={item.inputDelimiterId}
                                             className={`flex items-center gap-1 font-mono cursor-pointer select-none transition-colors ${
                                               !isIncluded ? 'opacity-40 pointer-events-none' : 'text-zinc-400 hover:text-zinc-200'
                                             }`}
                                             title="Toggle between Comma, Tab, and Semicolon delimiters for individual CSV export"
                                           >
                                             <span className="font-semibold text-zinc-300">Delimiter:</span>
                                           </label>
                                           <div className="flex items-center gap-1.5">
                                             <select
                                               id={item.inputDelimiterId}
                                               data-testid={item.inputDelimiterId}
                                               aria-label={`Delimiter for ${item.title}`}
                                               disabled={!isIncluded}
                                               value={
                                                 (pdfExportSections as any)[item.delimiterKey] === '\t' ||
                                                 (pdfExportSections as any)[item.delimiterKey] === 'tab' ||
                                                 (pdfExportSections as any)[item.delimiterKey] === '\\t'
                                                   ? '\t'
                                                   : (pdfExportSections as any)[item.delimiterKey] === ';'
                                                   ? ';'
                                                   : ','
                                               }
                                               onChange={(e) => {
                                                 const val = e.target.value;
                                                 setPdfExportSections((prev) => ({
                                                   ...prev,
                                                   [item.delimiterKey]: val
                                                 }));
                                               }}
                                               className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 hover:border-amber-500/60 focus:border-amber-400 focus:outline-none text-zinc-100 text-[9.5px] font-mono disabled:opacity-30 cursor-pointer shadow-xs"
                                             >
                                               <option value=",">Comma (,)</option>
                                               <option value={'\t'}>Tab (\t)</option>
                                               <option value=";">Semicolon (;)</option>
                                             </select>
                                             <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">
                                               {((pdfExportSections as any)[item.delimiterKey] === '\t' || (pdfExportSections as any)[item.delimiterKey] === 'tab' || (pdfExportSections as any)[item.delimiterKey] === '\\t')
                                                 ? 'TSV'
                                                 : (pdfExportSections as any)[item.delimiterKey] === ';'
                                                 ? 'Semicolon'
                                                 : 'CSV'}
                                             </span>
                                           </div>
                                         </div>

                                         {/* Card Configuration Stats Summary Footer */}
                                         <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between gap-1.5 flex-wrap text-[9px]">
                                           <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[8.5px]">
                                             <span>•</span>
                                             <span>Break: <strong className={isBreak ? 'text-amber-300' : 'text-zinc-500'}>{isBreak ? 'Yes' : 'No'}</strong></span>
                                             <span>•</span>
                                             <span>Note: <strong className={String(pdfExportSections[item.noteKey] || '').trim() ? 'text-emerald-400' : 'text-zinc-500'}>{String(pdfExportSections[item.noteKey] || '').trim() ? 'Custom' : 'None'}</strong></span>
                                             <span>•</span>
                                           </div>
                                           <button
                                             id={`btn-export-section-stats-detailed-${item.id}`}
                                             data-testid={`btn-export-section-stats-detailed-${item.id}`}
                                             type="button"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               handleExportSectionStats(item.id);
                                             }}
                                             className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-purple-300 hover:text-purple-200 border border-purple-500/30 text-[8.5px] font-medium transition-colors cursor-pointer"
                                             title={`Download JSON summarizing configuration metadata (padding, note, delimiters, break settings) for ${item.title}`}
                                           >
                                             <FileJson className="w-2.5 h-2.5 text-purple-400" />
                                             <span>Export Section Stats</span>
                                           </button>
                                         </div>
                                         </div>



                                        {/* Visual Live Divider Preview at Bottom of Card */}
                                       {isDivider && (
                                         <div
                                           id={`divider-preview-${sectionId}`}
                                           data-testid={`divider-preview-${item.id}`}
                                           className="w-full mt-2 pt-1 border-t transition-all select-none"
                                           style={{
                                             borderColor: (pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1',
                                             borderTopStyle: ((pdfExportSections as any)[item.dividerStyleKey] || 'solid') === 'dashed' ? 'dashed' : ((pdfExportSections as any)[item.dividerStyleKey] || 'solid') === 'dotted' ? 'dotted' : 'solid',
                                             borderTopWidth: '1.5px'
                                           }}
                                         >
                                           <div className="flex items-center justify-between text-[7.5px] font-mono text-zinc-400 uppercase tracking-wider pt-0.5">
                                             <span>Color: {(pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1'}</span>
                                            </div>
                                          </div>
                                    
                                         </div>
                                         </div>
                                     );
                                    };

                                    const sectionGroupsToRender = (pdfExportSections.sectionGroups && pdfExportSections.sectionGroups.length > 0)
                                      ? pdfExportSections.sectionGroups
                                      : DEFAULT_PDF_SECTION_GROUPS;
                                   const ungroupedSections = filteredSectionOrder.filter((sectionId) => {
                                     const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
                                     return !assignedSectionIds.has(baseId as DiagnosticPdfSectionId) && !assignedSectionIds.has(sectionId as any);
                                   });

                                   return (
                                     <div className="col-span-full flex flex-col gap-2.5 w-full">
                                       {sectionGroupsToRender.map((group) => {
                                         const groupSections = filteredSectionOrder.filter((sectionId) => {
                                           const baseId = sectionId.includes('_dup_') ? sectionId.split('_dup_')[0] : sectionId;
                                           return group.sectionIds.includes(baseId as DiagnosticPdfSectionId) || group.sectionIds.includes(sectionId as any);
                                         });

                                         return (
                                           <div
                                             key={group.id}
                                             id={`section-group-folder-${group.id}`}
                                             data-testid={`section-group-folder-${group.id}`}
                                             className="rounded-lg bg-zinc-950/70 border border-zinc-800/90 overflow-hidden shadow-xs transition-all"
                                           >
                                             {/* Folder Header */}
                                             <div
                                               className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 cursor-pointer select-none hover:bg-zinc-850 transition-colors"
                                             >
                                               <div className="flex items-center gap-2">
                                                 <button
                                                   type="button"
                                                   id={`btn-toggle-group-collapse-${group.id}`}
                                                   data-testid={`btn-toggle-group-collapse-${group.id}`}
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     handleToggleSectionGroupCollapse(group.id);
                                                   }}
                                                   className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer"
                                                   aria-label={group.isCollapsed ? `Expand ${group.title}` : `Collapse ${group.title}`}
                                                   title={group.isCollapsed ? `Expand ${group.title}` : `Collapse ${group.title}`}
                                                 >
                                                   {group.isCollapsed ? (
                                                     <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                                   ) : (
                                                     <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                                                 </button>

                                                 {group.isCollapsed ? (
                                                   <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                 ) : (
                                                   <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />

                                                 <div className="flex items-center gap-2 flex-wrap">
                                                   <span className="font-semibold text-xs text-zinc-200">{group.title}</span>
                                                   <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 border border-zinc-700/80">
                                                     {groupSections.length} {groupSections.length === 1 ? 'section' : 'sections'}
                                                   </span>
                                                   {group.isCollapsed && (
                                                     <span className="text-[9px] text-zinc-500 font-mono italic">
                                                       (Collapsed)
                                                     </span>
                                                 </div>
                                               </div>

                                                 <button
                                                   type="button"
                                                   className="text-[9px] font-medium px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
                                                 >
                                                   {group.isCollapsed ? 'Expand' : 'Collapse'}
                                                 </button>
                                               </div>
                                             </div>

                                             {/* Folder Content */}
                                             {!group.isCollapsed ? (
                                               <div className="p-2">
                                                 {groupSections.length === 0 ? (
                                                   <div className="py-2.5 text-center text-zinc-500 text-[10px] italic">
                                                     No matching sections in this folder
                                                   </div>
                                                 ) : (
                                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                     {groupSections.map((secId) => {
                                                       const idx = filteredSectionOrder.indexOf(secId);
                                                       return renderCard(secId, idx >= 0 ? idx : 0);
                                                   </div>
                                               </div>
                                             ) : (
                                               <div
                                                 className="px-3 py-1.5 text-[9.5px] text-zinc-500 hover:text-zinc-300 cursor-pointer flex items-center justify-between border-t border-zinc-900/40 bg-zinc-950/40 hover:bg-zinc-900/30 transition-colors"
                                               >
                                                 <span>Folder collapsed — {groupSections.length} section{groupSections.length === 1 ? '' : 's'} hidden</span>
                                                 <span className="text-amber-400/80 hover:text-amber-300 text-[9px] underline">Click to expand</span>
                                               </div>
                                           </div>
                                         );

                                       {/* Ungrouped Sections if any */}
                                       {ungroupedSections.length > 0 && (
                                         <div
                                           id="section-group-folder-ungrouped"
                                           data-testid="section-group-folder-ungrouped"
                                           className="rounded-lg bg-zinc-950/70 border border-zinc-800/90 overflow-hidden shadow-xs"
                                         >
                                           <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80">
                                             <div className="flex items-center gap-2">
                                               <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                               <span className="font-semibold text-xs text-zinc-200">Other / Ungrouped Sections</span>
                                               <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 border border-zinc-700/80">
                                                 {ungroupedSections.length} {ungroupedSections.length === 1 ? 'section' : 'sections'}
                                               </span>
                                             </div>
                                           </div>
                                           <div className="p-2">
                                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                               {ungroupedSections.map((secId) => {
                                                 const idx = filteredSectionOrder.indexOf(secId);
                                                 return renderCard(secId, idx >= 0 ? idx : 0);
                                             </div>
                                           </div>
                                         
                                     
                                   );
                                 })()
                            

                            {/* Quick Presets and Done control */}
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px] flex-wrap gap-1">
                              <div className="flex items-center gap-1 text-zinc-400 flex-wrap">
                                <span className="font-mono text-[9.5px]">Templates:</span>
                                <button
                                  id="btn-preset-executive-summary"
                                  data-testid="btn-preset-executive-summary"
                                  type="button"
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
                                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer font-medium"
                              >
                                Done
                              </button>
                            </div>
                          

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
                                className="p-0.5 rounded text-rose-300 hover:text-white hover:bg-rose-900/60 transition-colors cursor-pointer"
                                title="Dismiss notification"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          

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
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    id={`btn-copy-alert-item-${idx}`}
                                    data-testid={`btn-copy-alert-item-${idx}`}
                                    aria-label="Copy to Clipboard"
                                    title="Copy to Clipboard"
                                    type="button"
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
                                  </button>
                                
                              );
                          

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
                            </button>
                          
                        

                      {/* Tooltip downward pointing caret */}
                      <div className={`absolute top-full left-8 -mt-1 w-2.5 h-2.5 bg-zinc-900 border-r border-b ${
                        isDatabaseMutatingState ? 'border-amber-400/90' : 'border-amber-500/60'
                      } rotate-45`} />

                  {/* Dropdown Menu Trigger Toggle */}
                  <button
                    id="btn-header-export-dropdown-toggle"
                    type="button"
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
                        </button>

                        {/* Option: Structured JSON */}
                        <button
                          id="btn-export-option-json"
                          type="button"
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
                        </button>
                      

                      {/* Section: CSV Header Configuration with 'Include Column Headers' Checkbox */}
                      <div
                        id="csv-header-toggle-section"
                        className="p-2.5 bg-zinc-50/90 border-t border-zinc-100"
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
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700/90 mt-1 leading-tight">
                  {headerExportStats.format === 'csv'
                </p>
              </div>

              {/* Metric 2: Estimated Wire Transfer GZIP Ratio */}
              <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Est. GZIP Wire Size
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-mono text-base font-bold text-emerald-950">
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
      </main>

      {/* Benchmark Suite Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
      />

      {/* Bulk Data Ingestion Simulation Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onImportComplete={handleBulkImportComplete}
        onResetComplete={handleResetComplete}
      />

      {/* Historical Data Tape Auditor Modal */}
      <HistoricalDataTapeModal
        isOpen={isDataTapeModalOpen}
        entries={dataTapeEntries}
        isAutoSaveEnabled={isQueueAutoSaveEnabled}
        onTriggerManualSlice={handleTriggerManualTapeSlice}
        onMutateDatabase={handleMutateDatabase}
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
                </span>
              </div>
            </div>
            <button
              type="button"
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
                      shortcutToast.format === 'json' ? 'Structured JSON' : 'Standard CSV'
                    }`}
              </p>
            </div>
            <button
              type="button"
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              aria-label="Dismiss shortcut notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        

      {/* Floating Configuration Copied to Clipboard Notification Toast */}
      {copyConfigToast && (
        <div
          id="toast-config-copied-clipboard"
          data-testid="toast-config-copied-clipboard"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-auto bg-zinc-900/95 border border-emerald-500/70 text-white rounded-xl px-4 py-3 shadow-2xl shadow-emerald-950/40 backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-200 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white">
                  Configuration copied to clipboard
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700 font-medium">
                  {copyConfigToast.sectionTitle}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Section JSON configuration ready to share or audit.
              </p>
            </div>
            <button
              id="btn-dismiss-toast-config-copied"
              data-testid="btn-dismiss-toast-config-copied"
              type="button"
              onClick={() => {
                if (copyConfigToastTimeoutRef.current) {
                  clearTimeout(copyConfigToastTimeoutRef.current);
                }
                setCopyConfigToast(null);
              }}
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Dismiss copy confirmation toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        

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
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss export paused notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        

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
              className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss mutation threshold alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        
      {/* Export Confirmation Modal */}
      {isExportConfirmationModalOpen && (
        <div
          id="modal-export-confirmation-backdrop"
          data-testid="modal-export-confirmation-backdrop"
          onClick={handleCloseExportConfirmationModal}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="modal-export-confirmation"
            data-testid="modal-export-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-export-confirmation-title"
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-5 text-zinc-100 space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="modal-export-confirmation-title"
                    data-testid="modal-export-confirmation-title"
                    className="text-sm font-bold text-white tracking-tight"
                  >
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    User confirmation is required before proceeding with data serialization
                  </p>
                </div>
              </div>
              <button
                id="btn-close-export-confirmation-modal"
                data-testid="btn-close-export-confirmation-modal"
                type="button"
                onClick={handleCloseExportConfirmationModal}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close export confirmation modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Details Summary */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400">Serialization Format:</span>
                <span className="font-semibold text-white flex items-center gap-1.5 font-mono">
                  {pendingExportFormat === 'json' ? (
                    <>
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      JSON (Structured Records)
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      CSV {includeCsvHeaders ? '(with headers)' : '(headerless)'}
                    </>
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400">Query Records:</span>
                <span className="font-semibold font-mono text-emerald-300">
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400">Target Filename:</span>
                <span className="font-mono text-zinc-300 text-[11px]">
                  filtered_transactions.{pendingExportFormat}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-400">Output Action:</span>
                <span className="text-[11px] text-zinc-300">
                  File Download & Clipboard Copy
                </span>
              </div>
            </div>

            <p className="text-[11.5px] text-zinc-300 leading-relaxed">
            </p>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                id="btn-cancel-export-confirmation"
                data-testid="btn-cancel-export-confirmation"
                type="button"
                onClick={handleCloseExportConfirmationModal}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-export"
                data-testid="btn-confirm-export"
                type="button"
                onClick={() => {
                  const wasPinned = isTooltipPinnedRef.current || isTooltipPinned;
                  setIsExportConfirmationModalOpen(false);
                  handleHeaderExport(pendingExportFormat, pendingExportIsFromShortcut, true);
                  if (wasPinned) {
                    setIsTooltipPinned(true);
                    setIsExportHovered(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          
        

      {/* Batch Export Confirmation Modal */}
      {showBatchExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            id="modal-batch-export-confirmation"
            data-testid="modal-batch-export-confirmation"
            className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col p-5 gap-4 text-zinc-100"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Confirm Batch Data Export</h3>
                  <p className="text-[11px] text-zinc-400">Export multiple sections simultaneously</p>
                </div>
              </div>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-zinc-300">
              <p>
                You are about to export all enabled sections in your current PDF export configuration.
              </p>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                <span className="text-[11px] text-zinc-400 font-medium">Sections to be exported:</span>
                <ul className="list-disc list-inside text-[11px] text-zinc-200 space-y-1 font-mono">
                  {Object.values(PDF_SECTION_CONFIG_ITEMS)
                    .filter((item) => Boolean((pdfExportSections as any)[item.includeKey]))
                    .map((item) => {
                      const prefixKey = item.filenamePrefixKey;
                      const customPrefix = prefixKey ? (pdfExportSections as any)[prefixKey] : '';
                      let cleanPrefix = '';
                      if (customPrefix && customPrefix.trim()) {
                        cleanPrefix = customPrefix.includes('{')
                          ? resolveNamingPattern(customPrefix, item.id)
                          : customPrefix.trim();
                      } else {
                        cleanPrefix = resolveNamingPattern(globalCsvNamingPattern || '{section_name}_{timestamp}', item.id);
                      }
                      const delimiterKey = item.delimiterKey;
                      const rawDelimiter = delimiterKey ? (pdfExportSections as any)[delimiterKey] : ',';
                      const ext = rawDelimiter === '\t' || rawDelimiter === 'tab' || rawDelimiter === '\\t' ? 'tsv' : 'csv';
                      return (
                        <li key={item.id} className="flex items-center justify-between">
                          <span>{item.title}</span>
                          <span className="text-amber-400 text-[10px]">{cleanPrefix}.{ext}</span>
                        </li>
                      );
                </ul>
              </div>
              <p className="text-[10px] text-zinc-400">
                Total files to be generated:{' '}
                <span className="text-zinc-100 font-semibold font-mono">
                  {Object.values(PDF_SECTION_CONFIG_ITEMS).filter((item) => Boolean((pdfExportSections as any)[item.includeKey])).length}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-batch-export"
                data-testid="btn-confirm-batch-export"
                onClick={confirmBatchExport}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-zinc-950 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-900/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Confirm & Export All</span>
              </button>
            </div>
          </div>
        

      {/* Live PDF Report Preview Modal */}
      <DiagnosticPdfPreviewModal
        isOpen={showPdfPreviewModal}
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
    
  );
}
