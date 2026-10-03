import React, { useState, useRef, useMemo, useDeferredValue, useEffect } from 'react';
import {
  TransactionRecord,
  OptimizationFlags,
  OrderStatus,
  ProductCategory
} from '../types';
import { calculateRollingZScores } from '../utils/anomalyDetectionService';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
  Download,
  FileSpreadsheet,
  FileCode,
  Check,
  UploadCloud,
  Keyboard,
  Trash2,
  X,
  CheckSquare,
  Eye,
  EyeOff,
  Sliders,
  Database,
  Flame,
  Activity,
  Bell,
  Mail,
  AlertTriangle,
  BarChart2,
  History,
  RotateCcw,
  PlayCircle,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Monitor,
  Sparkles,
  TrendingUp,
  Pin,
  ArrowUp,
  Layers,
  Cpu
} from 'lucide-react';
import {
  exportRecords,
  exportRecordsToCsv,
  exportRecordsToJson,
  triggerFileDownload,
  compressBlobGzip,
  ExportFormat,
  ExportPerformanceResult
} from '../utils/csvExporter';
import { deleteRecordsByIds } from '../db/databaseEngine';
import { CpuPerformanceGlowBadge } from './CpuPerformanceGlowBadge';
import { DeleteConfirmationOverlay } from './DeleteConfirmationOverlay';
import { CompareLatencyModal } from './CompareLatencyModal';
import { LatencyDistributionModal } from './LatencyDistributionModal';
import { SearchHistoryDrawer } from './SearchHistoryDrawer';
import {
  QueryReplayDrawer,
  PRESET_REPLAY_SEQUENCES,
  getStoredReplaySequences,
  REPLAY_SEQUENCES_STORAGE_KEY
} from './QueryReplayDrawer';
import { QueryReplayInlineBar } from './QueryReplayInlineBar';
import { QueryReplayStep, QueryReplaySequence } from '../types';

interface VirtualizedTableProps {
  records: TransactionRecord[];
  totalCount?: number;
  flags?: OptimizationFlags;
  searchTerm?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  statusFilter?: OrderStatus | 'all' | 'All';
  onStatusChange?: (val: any) => void;
  categoryFilter?: ProductCategory | 'all' | 'All';
  selectedCategory?: ProductCategory | 'all' | 'All';
  onCategoryChange?: (val: any) => void;
  pageSize?: number;
  onPageSizeChange?: (val: number) => void;
  page?: number;
  onPageChange?: (val: number) => void;
  onFixNPlusOne?: () => void;
  simulatedError?: string | null;
  warningNotice?: string | null;
  virtualizedEnabled?: boolean;
  onOpenBulkImport?: () => void;
  onExportComplete?: (stats: ExportPerformanceResult) => void;
  selectedExportFormat?: ExportFormat;
  onExportFormatChange?: (format: ExportFormat) => void;
  onTriggerExport?: (format?: ExportFormat, isFromShortcut?: boolean) => void;
  isExportingProp?: boolean;
  shortcutKeyLabel?: string;
  isShortcutFlashing?: boolean;
  includeCsvHeaders?: boolean;
  onIncludeCsvHeadersChange?: (include: boolean) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  cacheHit?: boolean;
  onAutoOptimize?: () => void;
  showLatencyHeatmapProp?: boolean;
  onToggleLatencyHeatmap?: (enabled: boolean) => void;
  activeHeatmapLayersProp?: LatencyHeatmapLayersState;
  onHeatmapLayersChange?: (layers: LatencyHeatmapLayersState) => void;
  executionTimeMs?: number;
  isLoading?: boolean;
  onSimulateHeavyFetch?: () => void;
}

export interface LatencyHeatmapLayersState {
  dataFetch: boolean;   // Row Data Fetch Time (DB query, network, unbatched N+1 child joins)
  rowRender: boolean;   // Row Render Time (React 19 reconciliation, virtual DOM windowing overhead)
  domHydration: boolean;// DOM Hydration Cost (Virtual DOM element mounting, layout calculation reflow)
}

export type LatencyHeatmapBlendingMode = 'composite' | 'dominant';

const getRowSparklinePoints = (recordId: string, baseLatency: number, isUnoptimized: boolean) => {
  const points: number[] = [];
  let seed = 0;
  for (let i = 0; i < recordId.length; i++) {
    seed += recordId.charCodeAt(i);
  }
  for (let i = 0; i < 10; i++) {
    const pseudoRandom = Math.sin(seed + i * 99) * 12;
    const spike = isUnoptimized && (i === 3 || i === 7) ? baseLatency * 1.6 : 0;
    const val = Math.max(4, baseLatency + pseudoRandom + spike);
    points.push(val);
  }
  return points;
};

const renderInlineSparkline = (points: number[], width = 52, height = 18, strokeColor = '#e11d48') => {
  if (!points || points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points, min + 1);
  const range = max - min;
  
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
};

export interface PlanNodeInsight {
  id: string;
  nodeType: string;
  relationName: string;
  latencyMs: number;
  percentage: number;
  explanation: string;
  mechanics: string;
  severity: 'critical' | 'warning' | 'optimal';
  barColor: string;
}

export interface RecordQueryPlanInsight {
  totalLatencyMs: number;
  topNode: PlanNodeInsight;
  nodes: PlanNodeInsight[];
  summary: string;
  recommendation: string;
}

export const getRecordQueryPlanInsight = (
  rec: TransactionRecord,
  flags: OptimizationFlags
): RecordQueryPlanInsight => {
  const itemCount = rec.items && rec.items.length > 0 ? rec.items.length : (rec.itemCount || 1);

  // 1. Table Access Node (Seq Scan vs Index Scan)
  const isIndexed = !!flags.btreeIndexing;
  const seqScanMs = isIndexed ? 0.8 : 55.0;
  const tableNode: PlanNodeInsight = {
    id: 'table-access',
    nodeType: isIndexed ? 'Index Scan (B-Tree)' : 'Seq Scan (Full Table Scan)',
    relationName: 'transactions',
    latencyMs: seqScanMs,
    percentage: 0,
    explanation: isIndexed
      ? 'B-Tree index seek on (status, category) directly traversed index leaf nodes without scanning heap.'
      : 'Unindexed table structure forced full sequential scan across 50,000 heap pages on disk.',
    mechanics: isIndexed ? 'O(log N) B-Tree binary search' : 'O(N) sequential heap traversal (50,000 rows)',
    severity: isIndexed ? 'optimal' : 'critical',
    barColor: isIndexed ? 'bg-emerald-500' : 'bg-rose-500'
  };

  // 2. Join / Relation Node (Nested Loop vs Hash Join)
  const isBatched = !!flags.batchEagerLoading;
  const joinMs = isBatched ? +(0.8 + itemCount * 0.25).toFixed(1) : +(itemCount * 42.0).toFixed(1);
  const joinNode: PlanNodeInsight = {
    id: 'relation-join',
    nodeType: isBatched ? 'Hash Join (Batch Eager)' : 'Nested Loop (N+1 Query Storm)',
    relationName: 'order_items',
    latencyMs: joinMs,
    percentage: 0,
    explanation: isBatched
      ? `Single eager roundtrip with WHERE order_id IN (...) resolved ${itemCount} child line items.`
      : `Synchronous N+1 query storm: dispatched ${itemCount} separate roundtrip queries (SELECT * FROM order_items WHERE order_id = '${rec.id}').`,
    mechanics: isBatched ? 'In-memory hash table lookup' : `O(N * M) synchronous roundtrips (${itemCount} subqueries)`,
    severity: isBatched ? 'optimal' : 'critical',
    barColor: isBatched ? 'bg-teal-500' : 'bg-rose-600'
  };

  // 3. Buffer Pool / Cache Node
  const isCached = !!flags.queryCaching;
  const cacheMs = isCached ? 0.2 : 3.6;
  const cacheNode: PlanNodeInsight = {
    id: 'buffer-cache',
    nodeType: isCached ? 'LRU Cache Lookup' : 'Buffer Pool Disk I/O',
    relationName: 'shared_buffers',
    latencyMs: cacheMs,
    percentage: 0,
    explanation: isCached
      ? 'Served from in-memory LRU query cache, bypassing disk I/O and query re-planning.'
      : 'Cache bypassed; required reading raw database blocks from storage subsystem.',
    mechanics: isCached ? 'O(1) in-memory key lookup' : 'Random disk page read',
    severity: isCached ? 'optimal' : 'warning',
    barColor: isCached ? 'bg-indigo-400' : 'bg-amber-500'
  };

  // 4. Sort / Materialization Node
  const sortMs = +(0.6 + (rec.orderNumber.length % 3) * 0.2).toFixed(1);
  const sortNode: PlanNodeInsight = {
    id: 'sort-materialize',
    nodeType: 'Sort (Top-N Heapsort)',
    relationName: 'work_mem',
    latencyMs: sortMs,
    percentage: 0,
    explanation: 'In-memory sort on created_at DESC within allocated work_mem.',
    mechanics: 'Top-N heap sort in memory',
    severity: 'optimal',
    barColor: 'bg-blue-400'
  };

  const rawNodes = [tableNode, joinNode, cacheNode, sortNode];
  const totalLatencyMs = Number(rawNodes.reduce((sum, n) => sum + n.latencyMs, 0).toFixed(1));

  // Compute percentages & sort descending by latencyMs
  const nodes = rawNodes
    .map((n) => ({
      ...n,
      percentage: Number(((n.latencyMs / totalLatencyMs) * 100).toFixed(1))
    }))
    .sort((a, b) => b.latencyMs - a.latencyMs);

  const topNode = nodes[0];

  let summary = '';
  let recommendation = '';

  if (!isBatched && topNode.id === 'relation-join') {
    summary = `N+1 query storm on line items is the primary latency culprit, contributing ${topNode.percentage.toFixed(0)}% (${topNode.latencyMs.toFixed(1)}ms) of this record's fetch time.`;
    recommendation = `Enable Batch Eager Loading to replace ${itemCount} roundtrip queries with a single batched Hash Join.`;
  } else if (!isIndexed && topNode.id === 'table-access') {
    summary = `Full sequential table scan is the primary latency culprit, contributing ${topNode.percentage.toFixed(0)}% (${topNode.latencyMs.toFixed(1)}ms) by scanning 50,000 unindexed rows.`;
    recommendation = `Enable B-Tree Indexing to allow logarithmic index seeking directly to this record.`;
  } else if (isIndexed && isBatched) {
    summary = `Optimal query execution plan. All plan nodes operating within sub-millisecond B-Tree and hash join thresholds.`;
    recommendation = `Execution plan is fully tuned and optimized.`;
  } else {
    summary = `${topNode.nodeType} contributed the most to execution latency (${topNode.latencyMs.toFixed(1)}ms, ${topNode.percentage.toFixed(0)}%).`;
    recommendation = `Tune memory buffers and enable composite indexing for further acceleration.`;
  }

  return {
    totalLatencyMs,
    topNode,
    nodes,
    summary,
    recommendation
  };
};

const ROW_HEIGHT = 56;
const CONTAINER_HEIGHT = 520;

// Search History Constants and Helper
const SEARCH_HISTORY_STORAGE_KEY = 'perf_table_search_history_v1';
const INITIAL_SEARCH_HISTORY: string[] = [
  'Enterprise License',
  'ORD-9824',
  'completed',
  'acme.com',
  'Database Cluster'
];

const getStoredSearchHistory = (): string[] => {
  if (typeof window === 'undefined') return INITIAL_SEARCH_HISTORY;
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 10);
      }
    }
  } catch (err) {
    console.warn('Error reading search history from localStorage:', err);
  }
  return INITIAL_SEARCH_HISTORY;
};

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  records = [],
  totalCount = 50000,
  flags,
  searchTerm,
  searchQuery,
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  categoryFilter,
  selectedCategory,
  onCategoryChange,
  pageSize = 100,
  onPageSizeChange,
  page,
  onPageChange,
  onFixNPlusOne = () => {},
  simulatedError = null,
  warningNotice = null,
  virtualizedEnabled,
  onOpenBulkImport,
  onExportComplete,
  selectedExportFormat = 'csv',
  onExportFormatChange,
  onTriggerExport,
  isExportingProp,
  shortcutKeyLabel = 'Ctrl+E',
  isShortcutFlashing = false,
  includeCsvHeaders = true,
  onIncludeCsvHeadersChange,
  onDeleteRecords,
  cacheHit = false,
  onAutoOptimize = () => {},
  showLatencyHeatmapProp,
  onToggleLatencyHeatmap,
  activeHeatmapLayersProp,
  onHeatmapLayersChange,
  isLoading = false,
  onSimulateHeavyFetch
}) => {
  const safeFlags: OptimizationFlags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: virtualizedEnabled !== undefined ? virtualizedEnabled : true,
    deferredRendering: true,
    ...(flags || {})
  };

  // Ghost Rows & Heavy Loading State
  const [isHeavyLoading, setIsHeavyLoading] = useState<boolean>(Boolean(isLoading));
  const [ghostRowsEnabled, setGhostRowsEnabled] = useState<boolean>(true);
  const [ghostRowsCount] = useState<number>(12);
  const [heavyLoadingMessage, setHeavyLoadingMessage] = useState<string>('Fetching dataset batch...');
  const [fetchToast, setFetchToast] = useState<string | null>(null);
  const [showDomRenderPerfOverlay, setShowDomRenderPerfOverlay] = useState<boolean>(false);
  const [scrollRenderTimes, setScrollRenderTimes] = useState<number[]>([2.1, 4.3, 12.5, 17.8, 3.2, 5.1, 18.2, 4.0]);
  const [frameDropsCount, setFrameDropsCount] = useState<number>(2);

  useEffect(() => {
    if (typeof isLoading === 'boolean') {
      setIsHeavyLoading(isLoading);
    }
  }, [isLoading]);

  const triggerHeavyLoadingSimulation = (durationMs = 1200, message = 'Fetching dataset batch...') => {
    setHeavyLoadingMessage(message);
    setIsHeavyLoading(true);
    setTimeout(() => {
      setIsHeavyLoading(false);
      setFetchToast(`Loaded ${records.length.toLocaleString()} rows • Ghost placeholders maintained layout stability`);
      setTimeout(() => setFetchToast(null), 3500);
    }, durationMs);
    if (onSimulateHeavyFetch) {
      onSimulateHeavyFetch();
    }
  };

  const currentSearchTerm = searchTerm ?? searchQuery ?? '';
  const currentCategory = (categoryFilter ?? selectedCategory ?? 'all') as ProductCategory | 'all';
  const currentStatus = (statusFilter ?? 'all') as OrderStatus | 'all';

  const [scrollTop, setScrollTop] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [hoveredInsightRowId, setHoveredInsightRowId] = useState<string | null>(null);
  const [pinnedInsightRowId, setPinnedInsightRowId] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<ExportPerformanceResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalFormat, setInternalFormat] = useState<ExportFormat>(selectedExportFormat);
  const activeFormat = selectedExportFormat || internalFormat;
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const activeExporting = isExportingProp ?? isExporting;
  const [isCompactView, setIsCompactView] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('enterprise_table_compact_view_enabled');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const handleToggleCompactView = (val: boolean) => {
    setIsCompactView(val);
    try {
      localStorage.setItem('enterprise_table_compact_view_enabled', JSON.stringify(val));
    } catch (e) {
      console.error(e);
    }
  };

  const ROW_HEIGHT = isCompactView ? 38 : 56;

  // Selection & Batch Operations State
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [pinnedRowIds, setPinnedRowIds] = useState<Set<string>>(new Set());

  const handleTogglePinRow = (recordId: string) => {
    setPinnedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const pinnedRecords = useMemo(() => {
    return records.filter((rec) => pinnedRowIds.has(rec.id));
  }, [records, pinnedRowIds]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isLatencyDistModalOpen, setIsLatencyDistModalOpen] = useState(false);
  const [selectedMetricsRecord, setSelectedMetricsRecord] = useState<any | null>(null);
  const [batchNotification, setBatchNotification] = useState<{
    type: 'export' | 'delete';
    title: string;
    message: string;
    rowsProcessed: number;
    elapsedMs: number;
    format?: string;
  } | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Batch Export Options State (specifically for batch-exported files)
  const [batchIncludeHeaders, setBatchIncludeHeaders] = useState<boolean>(true);
  const [batchEnableCompression, setBatchEnableCompression] = useState<boolean>(false);
  const [isBatchOptionsOpen, setIsBatchOptionsOpen] = useState<boolean>(false);
  const batchOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutsideBatchOptions(event: MouseEvent) {
      if (batchOptionsRef.current && !batchOptionsRef.current.contains(event.target as Node)) {
        setIsBatchOptionsOpen(false);
      }
    }
    if (isBatchOptionsOpen) {
      document.addEventListener('mousedown', handleClickOutsideBatchOptions);
      return () => document.removeEventListener('mousedown', handleClickOutsideBatchOptions);
    }
  }, [isBatchOptionsOpen]);

  // Batch Delete Confirmation Overlay state
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  // Real-time Latency Heatmap Overlay State (active when batchEagerLoading is disabled)
  const [internalShowHeatmap, setInternalShowHeatmap] = useState(true);
  const showLatencyHeatmap = showLatencyHeatmapProp ?? internalShowHeatmap;
  const setShowLatencyHeatmap = onToggleLatencyHeatmap ?? setInternalShowHeatmap;

  // Dedicated Latency Heatmap Layers Sub-menu State (Row Render Time, Data Fetch Time, DOM Hydration Cost)
  const [heatmapLayers, setHeatmapLayers] = useState<LatencyHeatmapLayersState>(() => {
    if (activeHeatmapLayersProp) return activeHeatmapLayersProp;
    try {
      const saved = localStorage.getItem('virtualized_table_heatmap_layers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.dataFetch === 'boolean' && typeof parsed.rowRender === 'boolean' && typeof parsed.domHydration === 'boolean') {
          return parsed;
        }
      }
    } catch {}
    return {
      dataFetch: true,
      rowRender: true,
      domHydration: true,
    };
  });

  const [heatmapBlendingMode, setHeatmapBlendingMode] = useState<LatencyHeatmapBlendingMode>('composite');
  const [heatmapLayersMenuAnchor, setHeatmapLayersMenuAnchor] = useState<'header' | 'toolbar' | null>(null);
  const isHeatmapLayersMenuOpen = heatmapLayersMenuAnchor !== null;
  const setIsHeatmapLayersMenuOpen = (open: boolean) => setHeatmapLayersMenuAnchor(open ? (heatmapLayersMenuAnchor || 'toolbar') : null);
  const heatmapMenuRef = useRef<HTMLDivElement | null>(null);
  const heatmapToolbarMenuRef = useRef<HTMLDivElement | null>(null);

  // Sync to localStorage and prop
  useEffect(() => {
    try {
      localStorage.setItem('virtualized_table_heatmap_layers', JSON.stringify(heatmapLayers));
    } catch {}
    if (onHeatmapLayersChange) {
      onHeatmapLayersChange(heatmapLayers);
    }
  }, [heatmapLayers, onHeatmapLayersChange]);

  // Click outside and Escape key listener to close sub-menu
  useEffect(() => {
    if (!isHeatmapLayersMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (heatmapMenuRef.current && heatmapMenuRef.current.contains(target)) ||
        (heatmapToolbarMenuRef.current && heatmapToolbarMenuRef.current.contains(target))
      ) {
        return;
      }
      setHeatmapLayersMenuAnchor(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHeatmapLayersMenuAnchor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHeatmapLayersMenuOpen]);

  const activeHeatmapLayerCount = (heatmapLayers.dataFetch ? 1 : 0) + (heatmapLayers.rowRender ? 1 : 0) + (heatmapLayers.domHydration ? 1 : 0);
  const isAnyHeatmapLayerActive = showLatencyHeatmap && activeHeatmapLayerCount > 0;

  // Layer toggling handlers
  const handleToggleHeatmapLayer = (layerKey: keyof LatencyHeatmapLayersState) => {
    setHeatmapLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      // If toggling on, also make sure showLatencyHeatmap is true
      if (next[layerKey] && !showLatencyHeatmap) {
        setShowLatencyHeatmap(true);
      }
      return next;
    });
  };

  const handleSetAllHeatmapLayers = (enabled: boolean) => {
    setHeatmapLayers({
      dataFetch: enabled,
      rowRender: enabled,
      domHydration: enabled,
    });
    setShowLatencyHeatmap(enabled);
  };

  const handleIsolateHeatmapLayer = (layerKey: keyof LatencyHeatmapLayersState) => {
    setHeatmapLayers({
      dataFetch: layerKey === 'dataFetch',
      rowRender: layerKey === 'rowRender',
      domHydration: layerKey === 'domHydration',
    });
    setShowLatencyHeatmap(true);
  };

  // Helper to compute individual and composite latency breakdown for a given record
  const computeRowLatencyBreakdown = (rec: TransactionRecord) => {
    const recordItemCount = rec.items && rec.items.length > 0 ? rec.items.length : (rec.itemCount || 1);
    const unoptimizedMultiplier = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
    const indexPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;

    // 1. Data Fetch Time (DB query, network serialization, unbatched N+1 child lookups)
    const dataFetchMs = cacheHit 
      ? 0.9 
      : safeFlags.batchEagerLoading 
      ? +(recordItemCount * 3.5 + 8.0).toFixed(1) 
      : +(20.0 + (recordItemCount * unoptimizedMultiplier) + indexPenalty).toFixed(1);

    // 2. Row Render Time (React reconciliation, virtual DOM windowing overhead, cell formatting)
    const baseRender = safeFlags.virtualizedDOM ? 0.7 : 8.5;
    const deferredOverhead = safeFlags.deferredRendering ? 0 : 2.5;
    const rowRenderMs = +(baseRender + deferredOverhead + (recordItemCount * (safeFlags.virtualizedDOM ? 0.15 : 1.2))).toFixed(1);

    // 3. DOM Hydration Cost (Virtual DOM element mounting, layout calculation, item tags reflow)
    const isRowExpanded = expandedRowId === rec.id;
    const baseHydration = safeFlags.virtualizedDOM ? 0.5 : 4.8;
    const expansionHydration = isRowExpanded ? (recordItemCount * 0.8 + 2.4) : 0;
    const domHydrationMs = +(baseHydration + expansionHydration + (rec.status === 'flagged' ? 0.8 : 0.2)).toFixed(1);

    // Active composite latency value:
    let compositeActiveMs = 0;
    if (heatmapLayers.dataFetch) compositeActiveMs += dataFetchMs;
    if (heatmapLayers.rowRender) compositeActiveMs += rowRenderMs;
    if (heatmapLayers.domHydration) compositeActiveMs += domHydrationMs;
    compositeActiveMs = +compositeActiveMs.toFixed(1);

    // Dominant layer latency:
    const activeValues: number[] = [];
    if (heatmapLayers.dataFetch) activeValues.push(dataFetchMs);
    if (heatmapLayers.rowRender) activeValues.push(rowRenderMs);
    if (heatmapLayers.domHydration) activeValues.push(domHydrationMs);
    const dominantActiveMs = activeValues.length > 0 ? Math.max(...activeValues) : 0;

    const effectiveLatencyMs = heatmapBlendingMode === 'dominant' ? dominantActiveMs : compositeActiveMs;

    return {
      dataFetchMs,
      rowRenderMs,
      domHydrationMs,
      compositeActiveMs,
      effectiveLatencyMs,
      recordItemCount
    };
  };

  // Minimum Latency Filter Slider State (isolates performance-heavy records)
  const [minLatencyFilterMs, setMinLatencyFilterMs] = useState<number>(0);

  // Email & Latency Threshold Alert State
  const [alertThresholdMs, setAlertThresholdMs] = useState<number>(100);
  const [emailAlertEnabled, setEmailAlertEnabled] = useState<boolean>(true);
  const [alertEmail, setAlertEmail] = useState<string>('db-admin@enterprise-db.io');
  const [hasSentAlertEmail, setHasSentAlertEmail] = useState<boolean>(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);

  // Search History State & Drawer Management (Maintains last 10 unique searches)
  const [searchHistory, setSearchHistory] = useState<string[]>(getStoredSearchHistory);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistory));
    } catch (err) {
      console.warn('Error saving search history to localStorage:', err);
    }
  }, [searchHistory]);

  const handleRecordSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      // Deduplicate case-insensitively to ensure uniqueness
      const remaining = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      // Prepend newest query and enforce maximum 10 unique entries
      return [trimmed, ...remaining].slice(0, 10);
    });
  };

  const handleApplySearchHistory = (query: string) => {
    // Single-click re-run: Promotes query to top of unique history and triggers search
    handleRecordSearchQuery(query);
    onSearchChange?.(query);
  };

  const handleRemoveSearchHistory = (queryToRemove: string) => {
    setSearchHistory((prev) =>
      prev.filter((item) => item.toLowerCase() !== queryToRemove.toLowerCase())
    );
  };

  const handleClearSearchHistory = () => {
    setSearchHistory([]);
  };

  // Automatically record search queries when user finishes typing (debounced 1200ms)
  useEffect(() => {
    const term = currentSearchTerm.trim();
    if (!term || term.length < 2) return;
    const timeoutId = setTimeout(() => {
      handleRecordSearchQuery(term);
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [currentSearchTerm]);

  // Helper to calculate realistic step telemetry based on query string & active optimization flags
  const calculateDynamicStepMetrics = (
    queryText: string,
    stepNum: number,
    allRecords: TransactionRecord[],
    activeFlags: OptimizationFlags
  ): QueryReplayStep => {
    const q = queryText.toLowerCase().trim();
    const matches = allRecords.filter((r) => {
      if (!q) return true;
      return (
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerEmail.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });

    const baseMs = 1.2;
    const isIndexed = activeFlags.btreeIndexing;
    const isVirt = activeFlags.virtualizedDOM;
    const isDeferred = activeFlags.deferredRendering;
    const isBatch = activeFlags.batchEagerLoading;

    let queryLatency = isIndexed ? 1.4 : 45.0;
    if (q.length === 1) queryLatency *= 6.5; // Single letter regex wildcard
    if (q.includes('failed') || q.includes('corp.com') || q.includes('>')) queryLatency *= 3.8;
    if (!isBatch) queryLatency += 120.0;
    if (!isIndexed) queryLatency += (matches.length / 500) * 8.0;

    const domTime = isVirt ? 1.2 : Math.min(180, 15.0 + (matches.length / 250) * 1.5);
    const fps = isVirt ? 60 : Math.max(8, Math.round(60 - (domTime / 3.0)));

    const severity: 'none' | 'moderate' | 'critical' =
      queryLatency > 150 || fps < 20
        ? 'critical'
        : queryLatency > 50 || fps < 45
        ? 'moderate'
        : 'none';

    return {
      id: `step-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stepNumber: stepNum,
      query: queryText,
      timestamp: Date.now(),
      timeOffsetMs: stepNum * 2500,
      executionLatencyMs: +queryLatency.toFixed(1),
      baselineLatencyMs: baseMs,
      latencyDeltaPercent: Math.max(0, Math.round(((queryLatency - baseMs) / baseMs) * 100)),
      rowsMatched: matches.length,
      totalRowsScanned: allRecords.length || 50000,
      memoryUsageMb: +(2.0 + (matches.length / 50000) * 75).toFixed(1),
      cpuContentionPercent: Math.min(96, Math.round(8 + (queryLatency / 400) * 85)),
      indexUsed: isIndexed,
      indexName: isIndexed ? 'idx_transactions_search' : undefined,
      domRenderTimeMs: +domTime.toFixed(1),
      fps,
      virtualizationActive: isVirt,
      deferredRenderingActive: isDeferred,
      renderMode: isVirt ? 'virtualized' : isDeferred ? 'deferred_concurrent' : 'synchronous_blocking',
      uiResponsiveness: fps >= 50 ? 'fluid' : fps >= 25 ? 'sluggish' : 'frozen',
      degradationSeverity: severity,
      degradationCause: !isIndexed
        ? 'Unindexed table scan forced full heap record traversal across 50,000 rows.'
        : !isVirt
        ? 'Full DOM rendering without virtualization flooded React node tree, causing frame drops.'
        : severity === 'none'
        ? 'Optimal execution: B-Tree seek with virtualized windowing maintain 60 FPS.'
        : 'High result volume increased memory allocation and serialization delay.'
    };
  };

  // Query Replay & Degradation Analyzer State
  const [isQueryReplayDrawerOpen, setIsQueryReplayDrawerOpen] = useState(false);
  const [isReplayRecording, setIsReplayRecording] = useState(false);
  const [recordedReplaySteps, setRecordedReplaySteps] = useState<QueryReplayStep[]>([]);
  const [availableSequences, setAvailableSequences] = useState<QueryReplaySequence[]>(getStoredReplaySequences);
  const [activeReplaySequence, setActiveReplaySequence] = useState<QueryReplaySequence | null>(
    PRESET_REPLAY_SEQUENCES[0]
  );
  const [replayPlaybackIndex, setReplayPlaybackIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1.0);
  const [isReplayLooping, setIsReplayLooping] = useState<boolean>(true);
  const [showReplayInlineBar, setShowReplayInlineBar] = useState<boolean>(true);

  // Sync available sequences with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(REPLAY_SEQUENCES_STORAGE_KEY, JSON.stringify(availableSequences));
    } catch (e) {
      console.warn('Failed to save replay sequences to localStorage', e);
    }
  }, [availableSequences]);

  const currentReplaySteps = useMemo(() => {
    if (isReplayRecording && recordedReplaySteps.length > 0) {
      return recordedReplaySteps;
    }
    return activeReplaySequence?.steps || [];
  }, [isReplayRecording, recordedReplaySteps, activeReplaySequence]);

  const currentActiveReplayStep = useMemo(() => {
    if (currentReplaySteps.length === 0) return null;
    const idx = Math.min(Math.max(0, replayPlaybackIndex), currentReplaySteps.length - 1);
    return currentReplaySteps[idx] || null;
  }, [currentReplaySteps, replayPlaybackIndex]);

  const handleSeekReplayStep = (newIndex: number) => {
    const steps = currentReplaySteps;
    if (steps.length === 0) return;
    const clamped = Math.max(0, Math.min(newIndex, steps.length - 1));
    setReplayPlaybackIndex(clamped);
    const step = steps[clamped];
    if (step && onSearchChange) {
      onSearchChange(step.query);
    }
  };

  const handleNextReplayStep = () => {
    const steps = currentReplaySteps;
    if (steps.length === 0) return;
    if (replayPlaybackIndex < steps.length - 1) {
      handleSeekReplayStep(replayPlaybackIndex + 1);
    } else if (isReplayLooping) {
      handleSeekReplayStep(0);
    } else {
      setIsReplayPlaying(false);
    }
  };

  const handlePrevReplayStep = () => {
    if (replayPlaybackIndex > 0) {
      handleSeekReplayStep(replayPlaybackIndex - 1);
    }
  };

  const handleResetReplayStep = () => {
    handleSeekReplayStep(0);
  };

  const handleToggleReplayPlay = () => {
    if (!isReplayPlaying && replayPlaybackIndex >= currentReplaySteps.length - 1) {
      handleSeekReplayStep(0);
    }
    setIsReplayPlaying((prev) => !prev);
  };

  // Auto-play timer for Query Replay step-by-step playback
  useEffect(() => {
    if (!isReplayPlaying || !activeReplaySequence || activeReplaySequence.steps.length === 0) return;
    const intervalMs = Math.round(1800 / replaySpeed);
    const timer = setInterval(() => {
      setReplayPlaybackIndex((prev) => {
        let next = prev + 1;
        if (next >= activeReplaySequence.steps.length) {
          if (isReplayLooping) {
            next = 0;
          } else {
            setIsReplayPlaying(false);
            return prev;
          }
        }
        const step = activeReplaySequence.steps[next];
        if (step) {
          onSearchChange?.(step.query);
        }
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isReplayPlaying, activeReplaySequence, replaySpeed, isReplayLooping, onSearchChange]);

  const handleStartReplayRecording = () => {
    setIsReplayRecording(true);
    setRecordedReplaySteps([]);
    setIsReplayPlaying(false);
  };

  const handleStopReplayRecording = () => {
    setIsReplayRecording(false);
  };

  const handleAddRecordedStep = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    const stepNum = recordedReplaySteps.length + 1;
    const newStep = calculateDynamicStepMetrics(trimmed, stepNum, records, safeFlags);
    setRecordedReplaySteps((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].query.toLowerCase() === trimmed.toLowerCase()) {
        return prev;
      }
      return [...prev, newStep];
    });
  };

  // When live recording, capture typed/applied searches automatically (debounced)
  useEffect(() => {
    if (!isReplayRecording) return;
    const term = currentSearchTerm.trim();
    if (!term || term.length < 2) return;
    const timeoutId = setTimeout(() => {
      handleAddRecordedStep(term);
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [currentSearchTerm, isReplayRecording]);

  const handleSaveInlineRecordedSequence = (title: string) => {
    if (recordedReplaySteps.length === 0) return;
    const seqTitle = title.trim() || `Recorded Replay ${new Date().toLocaleTimeString()}`;
    const newSeq: QueryReplaySequence = {
      id: `seq-custom-${Date.now()}`,
      title: seqTitle,
      description: `Custom sequence of ${recordedReplaySteps.length} recorded searches capturing latency and rendering telemetry.`,
      createdAt: Date.now(),
      steps: [...recordedReplaySteps]
    };
    const updated = [newSeq, ...availableSequences];
    setAvailableSequences(updated);
    setActiveReplaySequence(newSeq);
    setReplayPlaybackIndex(0);
    setIsReplayRecording(false);
    try {
      localStorage.setItem(REPLAY_SEQUENCES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
  };

  // Time Machine State & Historical Checkpoints
  const [timeMachineSnapshots] = useState<Array<{
    id: string;
    label: string;
    timestamp: string;
    searchTerm: string;
    statusFilter: string;
    categoryFilter: string;
    recordCount: number;
    sampleSlice: TransactionRecord[];
  }>>(() => {
    return [
      {
        id: 'tm-1',
        label: 'Checkpoint #1 (Initial Load)',
        timestamp: '15 mins ago',
        searchTerm: '',
        statusFilter: 'all',
        categoryFilter: 'all',
        recordCount: records.length || 50000,
        sampleSlice: records.slice(0, 100)
      },
      {
        id: 'tm-2',
        label: 'Checkpoint #2 (Mid-Optimization)',
        timestamp: '10 mins ago',
        searchTerm: 'alice',
        statusFilter: 'completed',
        categoryFilter: 'Cloud Infrastructure',
        recordCount: Math.round((records.length || 50000) * 0.8),
        sampleSlice: records.filter(r => r.status === 'completed').slice(0, 100)
      },
      {
        id: 'tm-3',
        label: 'Checkpoint #3 (Peak Ingestion Surge)',
        timestamp: '5 mins ago',
        searchTerm: 'corp.com',
        statusFilter: 'processing',
        categoryFilter: 'Enterprise License',
        recordCount: Math.round((records.length || 50000) * 1.1),
        sampleSlice: records.filter(r => r.category === 'Enterprise License').slice(0, 100)
      },
      {
        id: 'tm-4',
        label: 'Checkpoint #4 (Post-Cleanup Audit)',
        timestamp: '2 mins ago',
        searchTerm: '',
        statusFilter: 'all',
        categoryFilter: 'Database Cluster',
        recordCount: Math.round((records.length || 50000) * 0.95),
        sampleSlice: records.filter(r => r.category === 'Database Cluster').slice(0, 100)
      },
      {
        id: 'tm-5',
        label: 'Checkpoint #5 (Live Current State)',
        timestamp: 'Just now',
        searchTerm: '',
        statusFilter: 'all',
        categoryFilter: 'all',
        recordCount: records.length,
        sampleSlice: records
      }
    ];
  });

  const [timeMachineIndex, setTimeMachineIndex] = useState<number>(4);
  const activeTimeMachineSnapshot = timeMachineSnapshots[timeMachineIndex] || timeMachineSnapshots[timeMachineSnapshots.length - 1];

  // 'Show Selected Only' toggle state for reviewing batch selections
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Automatically turn off 'Show Selected Only' if all selected rows are cleared
  useEffect(() => {
    if (selectedRowIds.size === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [selectedRowIds.size, showSelectedOnly]);

  // Filter records by selected rows and/or latency threshold filter & Time Machine snapshot
  const displayRecords = useMemo(() => {
    let list = timeMachineIndex < timeMachineSnapshots.length - 1
      ? activeTimeMachineSnapshot.sampleSlice
      : records;
    if (showSelectedOnly) {
      list = list.filter((r) => selectedRowIds.has(r.id));
    }
    if (minLatencyFilterMs > 0) {
      list = list.filter((r) => {
        const { effectiveLatencyMs } = computeRowLatencyBreakdown(r);
        return effectiveLatencyMs >= minLatencyFilterMs;
      });
    }
    return list;
  }, [records, showSelectedOnly, selectedRowIds, minLatencyFilterMs, safeFlags.batchEagerLoading, safeFlags.btreeIndexing, safeFlags.virtualizedDOM, safeFlags.deferredRendering, heatmapLayers, heatmapBlendingMode, timeMachineIndex, activeTimeMachineSnapshot, expandedRowId, cacheHit]);

  // Rolling Z-scores and anomaly detection service for displayed records
  const anomalyMap = useMemo(() => {
    return calculateRollingZScores(displayRecords);
  }, [displayRecords]);

  // Average table latency across displayed records based on active heatmap layers
  const averageTableLatencyMs = useMemo(() => {
    if (displayRecords.length === 0) return 0;
    let total = 0;
    for (const r of displayRecords) {
      const { effectiveLatencyMs } = computeRowLatencyBreakdown(r);
      total += effectiveLatencyMs;
    }
    return +(total / displayRecords.length).toFixed(1);
  }, [displayRecords, safeFlags.batchEagerLoading, safeFlags.btreeIndexing, safeFlags.virtualizedDOM, safeFlags.deferredRendering, heatmapLayers, heatmapBlendingMode, expandedRowId, cacheHit]);

  // Compute dataset-wide layer averages for the sub-menu indicators
  const datasetLayerAverages = useMemo(() => {
    if (displayRecords.length === 0) {
      return { avgFetchMs: 12.5, avgRenderMs: 1.2, avgHydrationMs: 0.8, avgTotalMs: 14.5 };
    }
    let totalFetch = 0;
    let totalRender = 0;
    let totalHydration = 0;
    let totalActive = 0;

    for (const r of displayRecords) {
      const breakdown = computeRowLatencyBreakdown(r);
      totalFetch += breakdown.dataFetchMs;
      totalRender += breakdown.rowRenderMs;
      totalHydration += breakdown.domHydrationMs;
      totalActive += breakdown.effectiveLatencyMs;
    }

    const count = displayRecords.length;
    return {
      avgFetchMs: +(totalFetch / count).toFixed(1),
      avgRenderMs: +(totalRender / count).toFixed(1),
      avgHydrationMs: +(totalHydration / count).toFixed(1),
      avgTotalMs: +(totalActive / count).toFixed(1)
    };
  }, [displayRecords, safeFlags.batchEagerLoading, safeFlags.btreeIndexing, safeFlags.virtualizedDOM, safeFlags.deferredRendering, heatmapLayers, heatmapBlendingMode, expandedRowId, cacheHit]);

  const historicalAverageLatency = 24.5;
  const isPerformanceRegressed = averageTableLatencyMs > historicalAverageLatency * 1.20;

  // Query Hotspot detection for tables undergoing unusually high write operations causing lock contention
  const isQueryHotspotDetected = averageTableLatencyMs > 65.0 || (!safeFlags.btreeIndexing && displayRecords.length > 5);
  const hotspotTableName = displayRecords.length > 0 && displayRecords[0].tableName ? displayRecords[0].tableName : 'transactions_audit_log';
  const hotspotWriteOpsPerSec = isQueryHotspotDetected ? Math.round(1450 + averageTableLatencyMs * 18) : 210;

  // Query execution cost bounds for relative heatmap shading across displayed records
  const { minRowCost, maxRowCost } = useMemo(() => {
    if (displayRecords.length === 0) return { minRowCost: 5, maxRowCost: 50 };
    let min = Infinity;
    let max = -Infinity;
    for (const r of displayRecords) {
      const { effectiveLatencyMs } = computeRowLatencyBreakdown(r);
      if (effectiveLatencyMs < min) min = effectiveLatencyMs;
      if (effectiveLatencyMs > max) max = effectiveLatencyMs;
    }
    return {
      minRowCost: min === Infinity ? 5 : min,
      maxRowCost: max === -Infinity ? 50 : Math.max(max, min + 1)
    };
  }, [displayRecords, safeFlags.batchEagerLoading, safeFlags.btreeIndexing, safeFlags.virtualizedDOM, safeFlags.deferredRendering, heatmapLayers, heatmapBlendingMode, expandedRowId, cacheHit]);

  // Reusable sub-menu popover for Latency Heatmap Layers
  const renderHeatmapLayersPopover = (align: 'left' | 'right' = 'left') => (
    <div
      id="submenu-heatmap-layers"
      data-testid="submenu-heatmap-layers"
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-zinc-200 p-4 z-50 animate-fadeIn text-zinc-800 text-xs divide-y divide-zinc-100`}
    >
      {/* Sub-menu Header */}
      <div className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                <span>Latency Heatmap Layers</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  isAnyHeatmapLayerActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {isAnyHeatmapLayerActive ? `${activeHeatmapLayerCount} Active` : 'Inactive'}
                </span>
              </h4>
              <p className="text-[11px] text-zinc-500">
                Toggle specific performance bottleneck dimensions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHeatmapLayersMenuAnchor(null)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
            title="Close sub-menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Individual Layer Toggles */}
      <div className="py-3 space-y-2.5">
        {/* Layer 1: Data Fetch Time */}
        <div
          id="layer-card-data-fetch"
          data-testid="layer-card-data-fetch"
          onClick={() => handleToggleHeatmapLayer('dataFetch')}
          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
            heatmapLayers.dataFetch
              ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/30'
              : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-100/60 opacity-75'
          }`}
        >
          <input
            type="checkbox"
            id="toggle-layer-data-fetch"
            data-testid="toggle-layer-data-fetch"
            checked={heatmapLayers.dataFetch}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleHeatmapLayer('dataFetch');
            }}
            className="mt-0.5 w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Data Fetch Time</span>
              </span>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-900 border border-rose-200 font-bold">
                  Avg: {datasetLayerAverages.avgFetchMs}ms
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">
              Database queries, disk page reads, and unbatched N+1 child joins.
            </p>
          </div>
        </div>

        {/* Layer 2: Row Render Time */}
        <div
          id="layer-card-row-render"
          data-testid="layer-card-row-render"
          onClick={() => handleToggleHeatmapLayer('rowRender')}
          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
            heatmapLayers.rowRender
              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
              : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-100/60 opacity-75'
          }`}
        >
          <input
            type="checkbox"
            id="toggle-layer-row-render"
            data-testid="toggle-layer-row-render"
            checked={heatmapLayers.rowRender}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleHeatmapLayer('rowRender');
            }}
            className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Row Render Time</span>
              </span>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200 font-bold">
                  Avg: {datasetLayerAverages.avgRenderMs}ms
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">
              React 19 reconciliation, virtual DOM windowing calculations, and cell parsing.
            </p>
          </div>
        </div>

        {/* Layer 3: DOM Hydration Cost */}
        <div
          id="layer-card-dom-hydration"
          data-testid="layer-card-dom-hydration"
          onClick={() => handleToggleHeatmapLayer('domHydration')}
          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
            heatmapLayers.domHydration
              ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/30'
              : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-100/60 opacity-75'
          }`}
        >
          <input
            type="checkbox"
            id="toggle-layer-dom-hydration"
            data-testid="toggle-layer-dom-hydration"
            checked={heatmapLayers.domHydration}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleHeatmapLayer('domHydration');
            }}
            className="mt-0.5 w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>DOM Hydration Cost</span>
              </span>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200 font-bold">
                  Avg: {datasetLayerAverages.avgHydrationMs}ms
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">
              Browser DOM node mounting, layout reflow, and expanded item tree layout cost.
            </p>
          </div>
        </div>
      </div>

      {/* Layer Presets & Quick Selection */}
      <div className="py-2.5">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Quick Presets:
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            Composite: <strong className="text-zinc-900">{datasetLayerAverages.avgTotalMs}ms</strong>
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            id="btn-preset-all-layers"
            data-testid="btn-preset-all-layers"
            onClick={() => handleSetAllHeatmapLayers(true)}
            className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] font-semibold cursor-pointer border border-zinc-200"
          >
            All Layers
          </button>
          <button
            type="button"
            id="btn-preset-only-fetch"
            data-testid="btn-preset-only-fetch"
            onClick={() => handleIsolateHeatmapLayer('dataFetch')}
            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-semibold cursor-pointer border border-rose-200"
          >
            Only Fetch
          </button>
          <button
            type="button"
            id="btn-preset-only-render"
            data-testid="btn-preset-only-render"
            onClick={() => handleIsolateHeatmapLayer('rowRender')}
            className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold cursor-pointer border border-amber-200"
          >
            Only Render
          </button>
          <button
            type="button"
            id="btn-preset-only-hydration"
            data-testid="btn-preset-only-hydration"
            onClick={() => handleIsolateHeatmapLayer('domHydration')}
            className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 text-[10px] font-semibold cursor-pointer border border-purple-200"
          >
            Only Hydration
          </button>
          <button
            type="button"
            id="btn-preset-disable-all"
            data-testid="btn-preset-disable-all"
            onClick={() => handleSetAllHeatmapLayers(false)}
            className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10px] font-medium cursor-pointer border border-zinc-200 ml-auto"
          >
            Disable
          </button>
        </div>
      </div>

      {/* Blending Mode Selector */}
      <div className="pt-2.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-zinc-600">Blending Mode:</span>
        <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-md">
          <button
            type="button"
            id="btn-blend-composite"
            data-testid="btn-blend-composite"
            onClick={() => setHeatmapBlendingMode('composite')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
              heatmapBlendingMode === 'composite'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Sum latency across all active layers for composite heatmap intensity"
          >
            Stacked Sum
          </button>
          <button
            type="button"
            id="btn-blend-dominant"
            data-testid="btn-blend-dominant"
            onClick={() => setHeatmapBlendingMode('dominant')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
              heatmapBlendingMode === 'dominant'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Highlight by the highest individual active bottleneck layer"
          >
            Dominant Peak
          </button>
        </div>
      </div>
    </div>
  );

  const handleExportHeatmapCsv = () => {
    const csvRows: string[] = [];
    csvRows.push('OrderNumber,CreatedAt,CustomerName,CustomerTier,Category,Region,Status,AmountUSD,ItemCount,DataFetchMs,RowRenderMs,DomHydrationMs,ActiveTotalLatencyMs,SeverityImpact,BatchEagerLoading,BTreeIndexing');
    
    for (const r of displayRecords) {
      const breakdown = computeRowLatencyBreakdown(r);
      const latencyMs = breakdown.effectiveLatencyMs;
      const severity = latencyMs > 150 ? 'High (>150ms)' : latencyMs >= 50 ? 'Moderate (50-150ms)' : 'Low (<50ms)';
      
      const escape = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
      csvRows.push([
        escape(r.orderNumber),
        escape(r.createdAt),
        escape(r.customerName),
        escape(r.customerTier),
        escape(r.category),
        escape(r.region),
        escape(r.status),
        r.amount.toFixed(2),
        breakdown.recordItemCount,
        breakdown.dataFetchMs.toFixed(1),
        breakdown.rowRenderMs.toFixed(1),
        breakdown.domHydrationMs.toFixed(1),
        latencyMs.toFixed(1),
        escape(severity),
        safeFlags.batchEagerLoading ? 'Enabled' : 'Disabled (N+1 Storm)',
        safeFlags.btreeIndexing ? 'Enabled' : 'Disabled (Seq Scan)'
      ].join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `latency_heatmap_analysis_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAvgLatencyExceeded = averageTableLatencyMs > alertThresholdMs;

  useEffect(() => {
    if (isAvgLatencyExceeded && emailAlertEnabled && !hasSentAlertEmail) {
      setHasSentAlertEmail(true);
      setEmailToast(`[Email Alert Sent to ${alertEmail}] Average table latency (${averageTableLatencyMs.toFixed(1)}ms) exceeded threshold (${alertThresholdMs}ms)!`);
      const timer = setTimeout(() => setEmailToast(null), 8000);
      return () => clearTimeout(timer);
    } else if (!isAvgLatencyExceeded) {
      setHasSentAlertEmail(false);
    }
  }, [isAvgLatencyExceeded, emailAlertEnabled, averageTableLatencyMs, alertThresholdMs, alertEmail, hasSentAlertEmail]);

  // Count selected rows among current filtered records
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    for (const r of records) {
      if (selectedRowIds.has(r.id)) count++;
    }
    return count;
  }, [records, selectedRowIds]);

  const currentRecordsToDisplay = showSelectedOnly ? displayRecords : records;

  const isAllVisibleSelected =
    currentRecordsToDisplay.length > 0 &&
    currentRecordsToDisplay.every((r) => selectedRowIds.has(r.id));
  const isSomeVisibleSelected =
    !isAllVisibleSelected &&
    currentRecordsToDisplay.some((r) => selectedRowIds.has(r.id));

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        for (const r of currentRecordsToDisplay) {
          next.delete(r.id);
        }
        return next;
      });
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        for (const r of currentRecordsToDisplay) {
          next.add(r.id);
        }
        return next;
      });
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleShowSelectedOnly = (enable: boolean) => {
    setShowSelectedOnly(enable);
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handleClearSelection = () => {
    setSelectedRowIds(new Set());
    setShowSelectedOnly(false);
  };

  const handleBatchExport = (formatToExport: ExportFormat = activeFormat) => {
    const selectedRecords = records.filter((r) => selectedRowIds.has(r.id));
    if (selectedRecords.length === 0 || activeExporting) return;

    setIsExporting(true);
    const startTime = performance.now();

    setTimeout(async () => {
      try {
        let { blob, filename, stats } = exportRecords(
          selectedRecords,
          formatToExport,
          `bulk_selected_transactions_${selectedRecords.length}`,
          { includeHeaders: batchIncludeHeaders }
        );

        let wasCompressed = false;
        if (batchEnableCompression) {
          const compressionResult = await compressBlobGzip(blob);
          if (compressionResult.isCompressed) {
            blob = compressionResult.blob;
            filename = `${filename}.gz`;
            wasCompressed = true;
            stats = {
              ...stats,
              fileSizeBytes: blob.size,
              formatName: `${stats.formatName} [GZIP]`
            };
          }
        }

        triggerFileDownload(blob, filename);
        setExportStats(stats);
        onExportComplete?.(stats);

        const elapsedMs = Math.max(0.1, Number((performance.now() - startTime).toFixed(1)));
        const compressionSuffix = wasCompressed ? ' (GZIP Compressed)' : '';
        const headerSuffix = formatToExport === 'csv' && !batchIncludeHeaders ? ' (No Headers)' : '';

        setBatchNotification({
          type: 'export',
          title: 'Bulk Export Completed',
          message: `Exported ${selectedRecords.length.toLocaleString()} rows to ${formatToExport.toUpperCase()}${compressionSuffix}${headerSuffix} in ${elapsedMs}ms`,
          rowsProcessed: selectedRecords.length,
          elapsedMs,
          format: `${formatToExport.toUpperCase()}${wasCompressed ? '.GZ' : ''}`
        });
        setTimeout(() => setBatchNotification(null), 5000);
      } catch (err) {
        console.error('Failed to bulk export selected records:', err);
      } finally {
        setIsExporting(false);
      }
    }, 10);
  };

  const handleRequestBatchDelete = () => {
    const selectedCount = selectedRowIds.size;
    if (selectedCount === 0) return;
    setIsDeleteConfirmationOpen(true);
  };

  const handleConfirmBatchDelete = () => {
    setIsDeleteConfirmationOpen(false);
    const selectedRecords = records.filter((r) => selectedRowIds.has(r.id));
    const idsToDelete = selectedRecords.map((r) => r.id);
    if (idsToDelete.length === 0) return;

    const startTime = performance.now();

    if (onDeleteRecords) {
      onDeleteRecords(idsToDelete);
    } else {
      deleteRecordsByIds(idsToDelete);
    }

    const elapsedMs = Math.max(0.1, Number((performance.now() - startTime).toFixed(1)));
    const deletedCount = idsToDelete.length;

    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      for (const id of idsToDelete) {
        next.delete(id);
      }
      return next;
    });

    setBatchNotification({
      type: 'delete',
      title: 'Batch Deletion Completed',
      message: `Permanently removed ${deletedCount.toLocaleString()} rows in ${elapsedMs}ms`,
      rowsProcessed: deletedCount,
      elapsedMs
    });
    setTimeout(() => setBatchNotification(null), 5000);
  };

  // Platform OS detection for bulk action shortcuts
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || navigator.platform);
  const bulkExportShortcutLabel = isMac ? '⌘⇧E' : 'Ctrl+Shift+E';
  const deleteSelectedShortcutLabel = isMac ? '⌘Backspace' : 'Ctrl+Backspace';
  const deleteSelectedShortcutBadge = isMac ? '⌘⌫' : 'Ctrl+⌫';

  // Global keyboard shortcuts for the bulk action toolbar:
  // - 'Ctrl+Shift+E' (or ⌘⇧E) for 'Bulk Export'
  // - 'Ctrl+Backspace' (or ⌘Backspace) to trigger 'Delete Selected' after confirmation
  useEffect(() => {
    const handleBulkActionShortcuts = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const target = e.target as HTMLElement | null;
      const isTextInput = target && (
        (target.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((target as HTMLInputElement).type)) ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // 1. Ctrl+Backspace -> Trigger 'Delete Selected' after confirmation
      if (e.key === 'Backspace' && !e.shiftKey && !e.altKey) {
        if (isTextInput) return; // Allow native text word deletion in text inputs
        if (selectedRowIds.size === 0) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (isDeleteConfirmationOpen) {
          handleConfirmBatchDelete();
        } else {
          handleRequestBatchDelete();
        }
        return;
      }

      // 2. Ctrl+Shift+E -> Trigger 'Bulk Export'
      if (e.key.toLowerCase() === 'e' && e.shiftKey && !e.altKey) {
        if (selectedRowIds.size === 0) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        handleBatchExport(activeFormat);
        return;
      }
    };

    window.addEventListener('keydown', handleBulkActionShortcuts, true);
    return () => window.removeEventListener('keydown', handleBulkActionShortcuts, true);
  }, [
    selectedRowIds,
    isDeleteConfirmationOpen,
    activeFormat,
    batchIncludeHeaders,
    batchEnableCompression,
    records,
    activeExporting
  ]);

  // Ctrl+H keyboard shortcut to toggle Data Density heatmap overlay
  useEffect(() => {
    const handleDataDensityShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        setShowLatencyHeatmap(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleDataDensityShortcut);
    return () => window.removeEventListener('keydown', handleDataDensityShortcut);
  }, []);

  const [internalIncludeHeaders, setInternalIncludeHeaders] = useState<boolean>(includeCsvHeaders);
  const activeIncludeHeaders = includeCsvHeaders !== undefined ? includeCsvHeaders : internalIncludeHeaders;

  const handleToggleIncludeHeaders = (val: boolean) => {
    setInternalIncludeHeaders(val);
    onIncludeCsvHeadersChange?.(val);
  };

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

  const handleExport = (formatToExport?: ExportFormat) => {
    const targetFormat = formatToExport || activeFormat;
    if (records.length === 0 || activeExporting) return;
    setIsExportDropdownOpen(false);

    if (onTriggerExport) {
      onTriggerExport(targetFormat, false);
      return;
    }

    setIsExporting(true);
    setTimeout(() => {
      try {
        const { blob, filename, stats } = exportRecords(records, targetFormat, 'filtered_transactions', {
          includeHeaders: activeIncludeHeaders
        });
        triggerFileDownload(blob, filename);
        setExportStats(stats);
        onExportComplete?.(stats);
      } catch (err) {
        console.error(`Failed to export ${targetFormat}:`, err);
      } finally {
        setIsExporting(false);
      }
    }, 10);
  };

  const handleExportCsv = () => {
    handleExport('csv');
  };

  // React 19 useDeferredValue for non-blocking search
  const deferredSearchTerm = useDeferredValue(currentSearchTerm);

  // If deferred rendering is off, simulate synchronous typing stall
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!safeFlags.deferredRendering && val.length > 2) {
      // Simulate heavy synchronous blocking thread work on keypress
      const start = performance.now();
      while (performance.now() - start < 45) {
        // block main thread to emulate heavy unoptimized UI lag
      }
    }
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const start = performance.now();
    setScrollTop(e.currentTarget.scrollTop);
    const end = performance.now();
    const duration = Math.round((end - start) * 10) / 10 + Math.random() * 3;
    setScrollRenderTimes((prev) => {
      const next = [...prev, duration];
      if (next.length > 25) next.shift();
      return next;
    });
    if (duration > 16.6) {
      setFrameDropsCount((prev) => prev + 1);
    }
  };

  // Calculate visible window slice if virtualizedDOM is enabled
  const { visibleRecords, startIndex, offsetY } = useMemo(() => {
    if (!safeFlags.virtualizedDOM) {
      // Unoptimized: Render ALL records into the DOM!
      return {
        visibleRecords: displayRecords,
        startIndex: 0,
        offsetY: 0
      };
    }

    // Optimized: Virtualized Windowing
    const visibleCount = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT);
    const buffer = 4; // overscan
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer);
    const end = Math.min(displayRecords.length, start + visibleCount + buffer * 2);

    const slice = displayRecords.slice(start, end);
    const offset = start * ROW_HEIGHT;

    return {
      visibleRecords: slice,
      startIndex: start,
      offsetY: offset
    };
  }, [displayRecords, scrollTop, safeFlags.virtualizedDOM]);

  const toggleExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Processing
          </span>
        );
      case 'flagged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" /> Flagged
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Gold':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Silver':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  // Ghost Row Placeholder Skeleton Generator for Heavy Data Loading Operations
  const renderGhostRows = (count = 12) => {
    return Array.from({ length: count }).map((_, idx) => {
      // Gentle gradient opacity fade to simulate depth and zero-lag streaming
      const opacityVal = Math.max(0.3, 0.9 - idx * 0.05);
      return (
        <div
          key={`ghost-row-${idx}`}
          id={`ghost-row-${idx}`}
          data-testid={`ghost-row-${idx}`}
          className={`grid grid-cols-12 px-4 ${isCompactView ? 'py-2' : 'py-3.5'} items-center text-xs border-b border-zinc-100 bg-zinc-50/50 transition-opacity select-none`}
          style={{
            minHeight: `${ROW_HEIGHT}px`,
            opacity: opacityVal
          }}
        >
          {/* Col 1: Checkbox & Index Skeleton */}
          <div className="col-span-1 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-zinc-200/90 animate-pulse shrink-0" />
            <div className="w-3.5 h-3 bg-zinc-200/60 rounded animate-pulse" />
          </div>

          {/* Col 2: Order ID & Timestamp Skeleton */}
          <div className="col-span-2 space-y-1.5 pr-2">
            <div className="h-3.5 bg-gradient-to-r from-zinc-200 via-zinc-300/80 to-zinc-200 rounded w-24 animate-pulse" />
            <div className="h-2.5 bg-zinc-200/60 rounded w-16 animate-pulse" />
          </div>

          {/* Col 3: Customer & Account Skeleton */}
          <div className="col-span-3 space-y-1.5 pr-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-zinc-200/80 shrink-0 animate-pulse" />
              <div className="h-3.5 bg-gradient-to-r from-zinc-200 via-zinc-300/80 to-zinc-200 rounded w-36 animate-pulse" />
            </div>
            <div className="h-2.5 bg-zinc-200/60 rounded w-44 animate-pulse" />
          </div>

          {/* Col 4: Category Skeleton */}
          <div className="col-span-2 pr-2">
            <div className="h-3.5 bg-zinc-200/80 rounded w-28 animate-pulse" />
          </div>

          {/* Col 5: Status Pill Skeleton */}
          <div className="col-span-1">
            <div className="h-5 bg-gradient-to-r from-zinc-200 via-zinc-300/70 to-zinc-200 rounded-full w-20 animate-pulse" />
          </div>

          {/* Col 6: Amount Skeleton */}
          <div className="col-span-2 text-right space-y-1 flex flex-col items-end pr-2">
            <div className="h-3.5 bg-gradient-to-r from-zinc-200 via-zinc-300/80 to-zinc-200 rounded w-20 animate-pulse" />
            <div className="h-2.5 bg-zinc-200/50 rounded w-12 animate-pulse" />
          </div>

          {/* Col 7: Items Skeleton */}
          <div className="col-span-1 text-center flex flex-col items-center justify-center gap-1">
            <div className="h-4 bg-zinc-200/80 rounded-full w-14 animate-pulse" />
            <div className="h-2.5 bg-zinc-200/50 rounded w-10 animate-pulse" />
          </div>
        </div>
      );
    });
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col relative">
      {/* Fetch Completion Toast */}
      {fetchToast && (
        <div
          id="toast-ghost-rows-loaded"
          data-testid="toast-ghost-rows-loaded"
          className="absolute top-4 right-4 z-50 px-3.5 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl shadow-xl border border-zinc-700 flex items-center gap-2 animate-fadeIn"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{fetchToast}</span>
          <button
            type="button"
            onClick={() => setFetchToast(null)}
            className="text-zinc-400 hover:text-white font-bold ml-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
      {/* Latency Heatmap Threshold Legend Bar */}
      <div className="bg-zinc-100/90 px-4 py-2 border-b border-zinc-200 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
          <Activity className="w-3.5 h-3.5 text-zinc-500" />
          <span>Heatmap Threshold Legend:</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-200"></span>
            <span className="text-zinc-700 font-medium">Green (&lt; 50ms)</span>
            <span className="text-zinc-400 text-[10px]">Optimal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block ring-2 ring-amber-200"></span>
            <span className="text-zinc-700 font-medium">Yellow (50–150ms)</span>
            <span className="text-zinc-400 text-[10px]">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-600 inline-block ring-2 ring-rose-200 animate-pulse"></span>
            <span className="text-zinc-700 font-medium">Red (&gt; 150ms)</span>
            <span className="text-zinc-400 text-[10px]">Critical Bottleneck</span>
          </div>
        </div>
      </div>

      {/* Time Machine UI State Snapshot Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 px-4 py-3 border-b border-indigo-500/30 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
            <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Time Machine UI State Replay
              </span>
              <span
                id="timemachine-checkpoint-badge"
                data-testid="timemachine-checkpoint-badge"
                className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 border border-amber-300"
              >
                {activeTimeMachineSnapshot.label}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-0.5">
              Move slider to travel through historical UI checkpoints. Re-renders table state exactly as it was at <strong className="text-amber-300">{activeTimeMachineSnapshot.timestamp}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-48 sm:w-64">
            <button
              type="button"
              onClick={() => setTimeMachineIndex((prev) => Math.max(0, prev - 1))}
              disabled={timeMachineIndex === 0}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 cursor-pointer"
              title="Jump to previous historical checkpoint"
            >
              ◀
            </button>
            <input
              type="range"
              id="time-machine-slider"
              data-testid="time-machine-slider"
              min="0"
              max={timeMachineSnapshots.length - 1}
              step="1"
              value={timeMachineIndex}
              onChange={(e) => setTimeMachineIndex(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setTimeMachineIndex((prev) => Math.min(timeMachineSnapshots.length - 1, prev + 1))}
              disabled={timeMachineIndex === timeMachineSnapshots.length - 1}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 cursor-pointer"
              title="Jump to next historical checkpoint"
            >
              ▶
            </button>
          </div>

          <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
            {timeMachineIndex + 1} / {timeMachineSnapshots.length}
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input & Search History Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-transactions"
              type="text"
              value={currentSearchTerm}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRecordSearchQuery(currentSearchTerm);
                }
              }}
              onBlur={() => {
                if (currentSearchTerm.trim()) {
                  handleRecordSearchQuery(currentSearchTerm);
                }
              }}
              placeholder="Search by order #, customer, or email..."
              className="w-full pl-9 pr-14 py-1.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
            />
            {currentSearchTerm && (
              <button
                type="button"
                id="btn-clear-search-term"
                data-testid="btn-clear-search-term"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 p-1 rounded-md cursor-pointer transition-colors shadow-2xs"
                title="Clear search query"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {!safeFlags.deferredRendering && !currentSearchTerm && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                Sync Blocking
              </span>
            )}
          </div>

          {/* Search History Drawer Trigger Button */}
          <button
            type="button"
            id="btn-open-search-history-drawer"
            data-testid="btn-open-search-history-drawer"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
              isHistoryDrawerOpen
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700 hover:text-zinc-900'
            }`}
            title="Open Search History (last 10 unique searches, re-run with 1 click)"
            aria-label="Search History"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <span>Search History</span>
            <span
              id="search-history-badge-count"
              data-testid="search-history-badge-count"
              className="bg-zinc-100 text-zinc-700 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-zinc-200"
            >
              {searchHistory.length}
            </span>
          </button>

          {/* Query Replay Trigger Button */}
          <button
            type="button"
            id="btn-open-query-replay"
            data-testid="btn-open-query-replay"
            onClick={() => setIsQueryReplayDrawerOpen(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
              isReplayRecording
                ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/30'
                : isReplayPlaying
                ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-500/30'
                : isQueryReplayDrawerOpen
                ? 'bg-indigo-50 border-indigo-300 text-indigo-800 ring-2 ring-indigo-500/20'
                : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700 hover:text-zinc-900'
            }`}
            title="Open Query Replay (record & playback search sequences to analyze degradation)"
            aria-label="Query Replay"
          >
            {isReplayRecording ? (
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>Query Replay</span>
            {isReplayRecording ? (
              <span className="bg-rose-100 text-rose-800 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-rose-200 animate-pulse">
                REC ({recordedReplaySteps.length})
              </span>
            ) : (
              <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-indigo-200">
                {currentReplaySteps.length} steps
              </span>
            )}
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-zinc-500 font-medium">Status:</span>
            <select
              id="select-status-filter"
              value={currentStatus}
              onChange={(e) => onStatusChange?.(e.target.value as OrderStatus | 'all')}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="flagged">Flagged</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-zinc-500 font-medium">Category:</span>
            <select
              id="select-category-filter"
              value={currentCategory}
              onChange={(e) => onCategoryChange?.(e.target.value as ProductCategory | 'all')}
              className="bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Cloud Infrastructure">Cloud Infrastructure</option>
              <option value="Enterprise License">Enterprise License</option>
              <option value="Security Audit">Security Audit</option>
              <option value="Database Cluster">Database Cluster</option>
              <option value="AI Inference">AI Inference</option>
            </select>
          </div>

          {/* Page Size */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-zinc-500 font-medium">Page Size:</span>
            <select
              id="select-page-size"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (ghostRowsEnabled && newSize >= 250) {
                  triggerHeavyLoadingSimulation(600, `Fetching ${newSize.toLocaleString()} rows buffer...`);
                }
                onPageSizeChange?.(newSize);
              }}
              className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1,000 rows (Heavy)</option>
            </select>
          </div>

          {/* Compact View Mode Toggle */}
          <div className="flex items-center gap-1 text-xs">
            <label
              id="label-toggle-compact-view"
              htmlFor="toggle-compact-view"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all border shadow-2xs select-none ${
                isCompactView
                  ? 'bg-indigo-950 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
              }`}
              title="Compact View mode reduces row vertical padding by 30-35%, fitting more database records on screen"
            >
              <input
                id="toggle-compact-view"
                data-testid="toggle-compact-view"
                type="checkbox"
                checked={isCompactView}
                onChange={(e) => handleToggleCompactView(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-400 text-indigo-600 focus:ring-indigo-500/30 accent-indigo-600 cursor-pointer shrink-0"
              />
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>Compact View</span>
              </span>
            </label>
          </div>

          {/* Ghost Rows Toggle */}
          <div className="flex items-center gap-1 text-xs">
            <label
              id="label-toggle-ghost-rows"
              htmlFor="toggle-ghost-rows"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all border shadow-2xs select-none ${
                ghostRowsEnabled
                  ? 'bg-purple-50 border-purple-300 text-purple-900 ring-1 ring-purple-400/40'
                  : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
              }`}
              title="Ghost Row visualization: Renders faded placeholder skeletons during heavy loading operations to improve perceived responsiveness"
            >
              <input
                id="toggle-ghost-rows"
                data-testid="toggle-ghost-rows"
                type="checkbox"
                checked={ghostRowsEnabled}
                onChange={(e) => setGhostRowsEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-400 text-purple-600 focus:ring-purple-500/30 accent-purple-600 cursor-pointer shrink-0"
              />
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-purple-600" />
                <span>Ghost Rows {ghostRowsEnabled ? 'ON' : 'OFF'}</span>
              </span>
            </label>
          </div>

          {/* DOM Render Perf Overlay Toggle Button */}
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              id="btn-toggle-dom-perf-overlay"
              data-testid="btn-toggle-dom-perf-overlay"
              onClick={() => setShowDomRenderPerfOverlay(!showDomRenderPerfOverlay)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
                showDomRenderPerfOverlay
                  ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-400/40'
                  : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
              }`}
              title="Toggle DOM Render Performance overlay tracking scroll render time and frame drops"
            >
              <Activity className={`w-3.5 h-3.5 ${showDomRenderPerfOverlay ? 'text-white animate-pulse' : 'text-rose-600'}`} />
              <span>DOM Render Perf {showDomRenderPerfOverlay ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Simulate Heavy Fetch Button */}
          <button
            type="button"
            id="btn-simulate-heavy-fetch"
            data-testid="btn-simulate-heavy-fetch"
            onClick={() => triggerHeavyLoadingSimulation(1200, "Simulating heavy 50,000-row database query fetch...")}
            disabled={isHeavyLoading}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
              isHeavyLoading
                ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 border-amber-300'
            }`}
            title="Simulate a heavy dataset loading operation to test and view the Ghost Row faded placeholders"
          >
            <Zap className={`w-3.5 h-3.5 ${isHeavyLoading ? 'text-amber-600 animate-bounce' : 'text-amber-500'}`} />
            <span>{isHeavyLoading ? 'Fetching...' : 'Simulate Heavy Fetch'}</span>
          </button>

          {/* Selected Rows Counter Chip & 'Show Selected Only' Toggle in Top Header */}
          {selectedVisibleCount > 0 && (
            <div className="flex items-center gap-2">
              <div
                id="toolbar-selected-counter-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md text-xs font-semibold shadow-2xs"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>{selectedVisibleCount} of {records.length} selected</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="ml-1 text-emerald-600 hover:text-emerald-900 rounded-full p-0.5 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Clear selection"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <label
                id="header-toggle-show-selected-only-label"
                htmlFor="header-toggle-show-selected-only"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all border shadow-2xs select-none ${
                  showSelectedOnly
                    ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                }`}
                title="Filter view to only show selected rows"
              >
                <input
                  id="header-toggle-show-selected-only"
                  data-testid="header-toggle-show-selected-only"
                  name="headerShowSelectedOnly"
                  type="checkbox"
                  checked={showSelectedOnly}
                  onChange={(e) => handleToggleShowSelectedOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
                />
                <Filter className={`w-3.5 h-3.5 ${showSelectedOnly ? 'text-white' : 'text-emerald-600'}`} />
                <span>Show Selected Only</span>
                {showSelectedOnly && (
                  <span className="font-mono text-[10px] bg-emerald-900 text-emerald-100 px-1.5 py-0.2 rounded font-bold">
                    {displayRecords.length}
                  </span>
                )}
              </label>
            </div>
          )}

          {/* Bulk Ingest Trigger */}
          {onOpenBulkImport && (
            <button
              id="btn-table-bulk-import"
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer ml-auto sm:ml-0"
              title="Open Bulk Data Ingestion Simulation Tool"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Bulk Ingest</span>
            </button>
          )}

          {/* Dedicated Latency Heatmap Layers Sub-Menu Dropdown */}
          <div className="relative" ref={heatmapMenuRef}>
            <button
              type="button"
              id="main-header-toggle-latency-heatmap"
              data-testid="btn-heatmap-layers-menu"
              onClick={() => setHeatmapLayersMenuAnchor((prev) => prev === 'header' ? null : 'header')}
              aria-expanded={heatmapLayersMenuAnchor === 'header'}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all border shadow-2xs select-none ${
                isAnyHeatmapLayerActive
                  ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400/40 shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200/70 border-zinc-300 text-zinc-700'
              }`}
              title="Open Latency Heatmap Layers sub-menu to toggle Row Render Time, Data Fetch Time, and DOM Hydration cost"
            >
              <Flame className={`w-3.5 h-3.5 ${isAnyHeatmapLayerActive ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Heatmap Layers</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                isAnyHeatmapLayerActive ? 'bg-rose-200 text-rose-950 border border-rose-300' : 'bg-zinc-200 text-zinc-600'
              }`}>
                {isAnyHeatmapLayerActive ? `${activeHeatmapLayerCount}/3` : 'OFF'}
              </span>
              <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${heatmapLayersMenuAnchor === 'header' ? 'rotate-180' : ''}`} />
            </button>

            {/* Heatmap Layers Sub-Menu Popover */}
            {heatmapLayersMenuAnchor === 'header' && renderHeatmapLayersPopover('left')}
          </div>

          {/* Main Header Latency Filter Slider Control */}
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-zinc-300 text-zinc-700 shadow-2xs">
            <span className="font-semibold text-zinc-800 flex items-center gap-1 text-xs">
              <span>Min Latency:</span>
              <strong className="font-mono text-rose-700">{minLatencyFilterMs}ms</strong>
            </span>
            <input
              id="main-header-latency-filter-slider"
              data-testid="main-header-latency-filter-slider"
              type="range"
              min="0"
              max="200"
              step="10"
              value={minLatencyFilterMs}
              onChange={(e) => setMinLatencyFilterMs(Number(e.target.value))}
              className="w-24 accent-rose-600 cursor-pointer h-1.5 bg-zinc-200 rounded-lg"
              title="Filter visible rows by minimum database fetch latency value to quickly isolate high-impact records"
            />
            {minLatencyFilterMs > 0 && (
              <button
                type="button"
                onClick={() => setMinLatencyFilterMs(0)}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 font-bold underline cursor-pointer ml-0.5"
                title="Reset latency filter"
              >
                Reset
              </button>
            )}
          </div>
          {/* Compare Latency Trigger Button */}
          <button
            type="button"
            id="btn-open-compare-latency"
            onClick={() => setIsCompareModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            title="Compare two different sets of optimization flags and run benchmark deltas side-by-side"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            <span>Compare Latency</span>
          </button>

          {/* Latency Distribution Histogram Trigger Button */}
          <button
            type="button"
            id="btn-open-latency-distribution"
            onClick={() => setIsLatencyDistModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 rounded-md text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            title="Open Recharts Latency Distribution Histogram to analyze spread and identify systemic outliers"
          >
            <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Latency Distribution</span>
          </button>

          <div
            id="table-keyboard-shortcut-hint"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100/90 text-zinc-600 rounded-md text-xs font-medium border border-zinc-200"
            title={`Press ${shortcutKeyLabel} to export CSV/JSON instantly`}
          >
            <Keyboard className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px] text-zinc-500">Shortcut:</span>
            <kbd className="font-mono font-bold text-zinc-800 bg-white px-1.5 py-0.2 rounded border border-zinc-300 text-[10px] shadow-3xs">
              {shortcutKeyLabel}
            </kbd>
          </div>

          {/* Visual Query Source Badge: LRU Cache Hit vs Direct DB Read */}
          <div
            id="badge-query-source"
            data-testid="badge-query-source"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border select-none whitespace-nowrap transition-colors shadow-2xs ml-auto sm:ml-0 ${
              cacheHit
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                : 'bg-zinc-100/90 text-zinc-700 border-zinc-200 hover:bg-zinc-200/60'
            }`}
            title={
              cacheHit
                ? 'Current query served from in-memory LRU cache (<0.2ms latency, zero table scan)'
                : 'Current query served via direct database read (table storage scan)'
            }
          >
            {cacheHit ? (
              <>
                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0 fill-emerald-500/20" />
                <span className="font-semibold text-[11px]">LRU Cache</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="font-semibold text-[11px]">Direct DB Read</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              </>
            )}
          </div>

          {/* Export CSV/JSON Dual Button Group with Dropdown */}
          <div ref={exportDropdownRef} className="relative inline-flex items-stretch rounded-md shadow-xs">
            <button
              id="btn-table-export-main"
              type="button"
              onClick={() => handleExport(activeFormat)}
              disabled={activeExporting || records.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-l-md text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                isShortcutFlashing
                  ? 'ring-4 ring-emerald-400 bg-emerald-700 shadow-lg scale-[1.02]'
                  : ''
              }`}
              title={`Export filtered records as ${activeFormat === 'json' ? 'JSON' : 'CSV'} (Shortcut: ${shortcutKeyLabel})`}
            >
              {activeExporting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  {activeFormat === 'json' ? (
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>
                    {activeFormat === 'json'
                      ? 'Export JSON'
                      : activeIncludeHeaders
                      ? 'Export CSV'
                      : 'Export CSV (No Headers)'}
                  </span>
                  <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded text-[10px] font-mono">
                    {records.length}
                  </span>
                  <kbd
                    className="hidden md:inline-flex items-center text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold"
                    title={`Press ${shortcutKeyLabel} to export`}
                  >
                    {shortcutKeyLabel}
                  </kbd>
                </>
              )}
            </button>

            {/* Dropdown Toggle for Format Selection */}
            <button
              id="btn-table-export-dropdown-toggle"
              type="button"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={activeExporting || records.length === 0}
              className="inline-flex items-center justify-center px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-r-md border-l border-zinc-700/80 text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Switch export format (CSV or JSON)"
              aria-label="Switch export format"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-300 transition-transform duration-150 ${
                  isExportDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isExportDropdownOpen && (
              <div
                id="table-export-dropdown-menu"
                className="absolute right-0 top-full mt-1 w-64 bg-white border border-zinc-200 rounded-lg shadow-xl z-30 py-1 overflow-hidden animate-fade-in divide-y divide-zinc-100"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/70">
                  Select Format ({shortcutKeyLabel})
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    id="btn-table-export-option-csv"
                    type="button"
                    onClick={() => {
                      if (onExportFormatChange) onExportFormatChange('csv');
                      setInternalFormat('csv');
                      handleExport('csv');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                      activeFormat === 'csv'
                        ? 'bg-emerald-50 text-emerald-950 font-medium'
                        : 'hover:bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Standard CSV</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {shortcutKeyLabel}
                      </kbd>
                      {activeFormat === 'csv' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                  </button>

                  <button
                    id="btn-table-export-option-json"
                    type="button"
                    onClick={() => {
                      if (onExportFormatChange) onExportFormatChange('json');
                      setInternalFormat('json');
                      handleExport('json');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer ${
                      activeFormat === 'json'
                        ? 'bg-amber-50 text-amber-950 font-medium'
                        : 'hover:bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-amber-600" />
                      <span>Structured JSON</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                        Shift+{shortcutKeyLabel}
                      </kbd>
                      {activeFormat === 'json' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                  </button>
                </div>

                {/* CSV Configuration Section with 'Include Column Headers' Checkbox */}
                <div
                  id="table-csv-header-toggle-section"
                  className="p-2 bg-zinc-50 border-t border-zinc-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label
                    id="label-table-include-column-headers"
                    htmlFor="table-checkbox-include-column-headers"
                    title="Include Column Headers"
                    className="flex items-center justify-between text-xs text-zinc-700 hover:text-zinc-900 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="table-checkbox-include-column-headers"
                        name="includeColumnHeaders"
                        type="checkbox"
                        checked={activeIncludeHeaders}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleIncludeHeaders(e.target.checked);
                        }}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
                        title="Include Column Headers"
                      />
                      <span className="font-semibold text-zinc-800 group-hover:text-emerald-950">
                        Include Column Headers
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        activeIncludeHeaders
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-zinc-200 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      {activeIncludeHeaders ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Search History Recent Chips Bar */}
      {searchHistory.length > 0 && (
        <div
          id="search-history-quick-chips-bar"
          className="px-4 py-1.5 bg-zinc-50/80 border-b border-zinc-200/80 flex items-center justify-between text-xs gap-2"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 py-0.5">
            <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1 shrink-0">
              <History className="w-3 h-3 text-zinc-400" />
              <span>Recent Searches:</span>
            </span>
            {searchHistory.slice(0, 5).map((q, idx) => {
              const isMatch = q.toLowerCase() === currentSearchTerm.trim().toLowerCase();
              return (
                <button
                  key={`${q}-${idx}`}
                  type="button"
                  id={`pill-search-recent-${idx}`}
                  data-testid={`pill-search-recent-${idx}`}
                  onClick={() => handleApplySearchHistory(q)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer truncate max-w-[160px] border shadow-3xs ${
                    isMatch
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold ring-1 ring-emerald-400/40'
                      : 'bg-white hover:bg-emerald-50 text-zinc-700 hover:text-emerald-800 border-zinc-200 hover:border-emerald-300'
                  }`}
                  title={`1-click re-run: "${q}"`}
                >
                  {q}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            id="btn-view-all-search-history"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 flex items-center gap-0.5 cursor-pointer ml-auto"
            title="Open complete Search History drawer"
          >
            <span>History Drawer ({searchHistory.length})</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Query Replay & Degradation Analyzer Bar */}
      <QueryReplayInlineBar
        sequences={availableSequences}
        activeSequence={activeReplaySequence}
        onSelectSequence={(seq) => {
          setActiveReplaySequence(seq);
          setReplayPlaybackIndex(0);
          if (seq.steps[0] && onSearchChange) {
            onSearchChange(seq.steps[0].query);
          }
        }}
        currentSteps={currentReplaySteps}
        activeStep={currentActiveReplayStep}
        currentPlaybackIndex={replayPlaybackIndex}
        onSeekStep={handleSeekReplayStep}
        isPlaying={isReplayPlaying}
        onTogglePlay={handleToggleReplayPlay}
        onNextStep={handleNextReplayStep}
        onPrevStep={handlePrevReplayStep}
        onResetStep={handleResetReplayStep}
        playbackSpeed={replaySpeed}
        onChangeSpeed={setReplaySpeed}
        isLooping={isReplayLooping}
        onToggleLoop={() => setIsReplayLooping((prev) => !prev)}
        isRecording={isReplayRecording}
        onToggleRecord={() => {
          if (isReplayRecording) {
            handleStopReplayRecording();
          } else {
            handleStartReplayRecording();
          }
        }}
        recordedCount={recordedReplaySteps.length}
        onSaveRecording={handleSaveInlineRecordedSequence}
        onClearRecording={() => setRecordedReplaySteps([])}
        currentSearchTerm={currentSearchTerm}
        onAddCurrentSearchToRecording={() => {
          if (currentSearchTerm.trim()) {
            handleAddRecordedStep(currentSearchTerm.trim());
          }
        }}
        isCollapsed={!showReplayInlineBar}
        onToggleCollapse={() => setShowReplayInlineBar((prev) => !prev)}
        onOpenFullDrawer={() => setIsQueryReplayDrawerOpen(true)}
      />

      {/* Export Performance Metric Telemetry */}
      {exportStats && (
        <div
          id="export-performance-telemetry"
          className="px-4 py-2 bg-emerald-50/90 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">CSV Export Performance:</span>
            <span className="text-emerald-800">
              Processed <strong className="font-mono text-emerald-950">{exportStats.recordCount.toLocaleString()}</strong> records ({exportStats.itemCount.toLocaleString()} line items, {(exportStats.fileSizeBytes / 1024).toFixed(1)} KB)
            </span>
          </div>
          <div className="flex items-center gap-2.5 font-mono text-[11px]">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/80">
              Time: <strong>{exportStats.durationMs}ms</strong>
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/80">
              Throughput: <strong>{exportStats.throughputRowsPerSec.toLocaleString()} rows/sec</strong>
            </span>
            <CpuPerformanceGlowBadge cpuPercent={exportStats.cpuUsagePercent} variant="inline" className="font-sans" />
            <button
              id="btn-dismiss-export-stats"
              type="button"
              onClick={() => setExportStats(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs ml-1 font-sans underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Callout Banner if N+1 or Pool Exhausted */}
      {simulatedError && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-rose-900">
                Active Database Bottleneck Detected!
              </div>
              <p className="text-xs text-rose-700 mt-0.5 font-mono">
                {simulatedError}
              </p>
              <p className="text-xs text-rose-600 mt-1">
                Root cause: The app is firing 1 separate subquery for every line item without batching.
              </p>
            </div>
          </div>
          <button
            id="btn-fix-n-plus-one-banner"
            type="button"
            onClick={onFixNPlusOne}
            className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            Fix N+1 Query Cascade
          </button>
        </div>
      )}

      {/* Warning Notice if Unindexed Full Table Scan */}
      {!safeFlags.btreeIndexing && warningNotice && !simulatedError && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>{warningNotice}</span>
          </div>
          <span className="text-[11px] font-medium text-amber-700">
            Enable B-Tree Index to reduce scan from 50k to &lt;35 rows
          </span>
        </div>
      )}

      {/* Batch Operation Notification Toast */}
      {batchNotification && (
        <div
          id="batch-operation-notification"
          role="status"
          aria-live="polite"
          className={`px-4 py-2.5 border-b flex items-center justify-between text-xs transition-all shadow-xs ${
            batchNotification.type === 'delete'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                batchNotification.type === 'delete'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {batchNotification.type === 'delete' ? (
                <Trash2 className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-900">{batchNotification.title}</span>
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-700">{batchNotification.message}</span>
            </div>

            {/* Metrics Chips: Rows Processed & Elapsed Time */}
            <div className="flex items-center gap-1.5 ml-1">
              <span
                id="batch-toast-rows-processed"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                  batchNotification.type === 'delete'
                    ? 'bg-rose-100/70 border-rose-300 text-rose-800'
                    : 'bg-emerald-100/70 border-emerald-300 text-emerald-800'
                }`}
                title="Number of rows processed"
              >
                <span>{batchNotification.rowsProcessed.toLocaleString()} rows</span>
              </span>

              <span
                id="batch-toast-elapsed-time"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-white border border-zinc-300 text-zinc-800 shadow-2xs"
                title="Elapsed processing time"
              >
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>{batchNotification.elapsedMs}ms</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            id="btn-dismiss-batch-toast"
            onClick={() => setBatchNotification(null)}
            className="text-zinc-500 hover:text-zinc-800 p-1 rounded-md hover:bg-black/5 transition-colors cursor-pointer shrink-0 ml-2"
            title="Dismiss toast notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Secondary Action Toolbar in Header (Appears only when one or more rows are selected) */}
      {selectedVisibleCount > 0 && (
        <div
          id="secondary-action-toolbar"
          data-testid="secondary-action-toolbar"
          className="px-4 py-2.5 bg-zinc-900 text-zinc-100 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-inner"
        >
          {/* Left: Selection Counter & Clear button */}
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span id="batch-selected-counter" className="font-bold text-sm text-white font-mono">
                {selectedVisibleCount}
              </span>
              <span className="text-zinc-300">
                of {records.length} visible row{records.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <button
              id="btn-batch-clear-selection"
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer ml-1 transition-colors"
            >
              Deselect all
            </button>
          </div>

          {/* Middle: 'Show Selected Only' Review Filter Toggle */}
          <div className="flex items-center">
            <label
              id="label-toggle-show-selected-only"
              htmlFor="toggle-show-selected-only"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all border select-none ${
                showSelectedOnly
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50 shadow-xs'
                  : 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-300'
              }`}
              title="Filter view to display only the rows currently marked for batch processing"
            >
              <input
                id="toggle-show-selected-only"
                data-testid="toggle-show-selected-only"
                name="showSelectedOnly"
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => handleToggleShowSelectedOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer shrink-0"
              />
              <span className="flex items-center gap-1.5">
                {showSelectedOnly ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Show Selected Only</span>
                {showSelectedOnly && (
                  <span className="text-[10px] bg-emerald-600 text-white font-mono px-1.5 py-0.2 rounded font-bold ml-0.5">
                    {displayRecords.length}
                  </span>
                )}
              </span>
            </label>
          </div>

          {/* Right: Secondary Action Buttons ('Bulk Export' & 'Delete Selected') */}
          <div className="flex items-center gap-2">
            {/* Bulk Export Button (Triggers download of only selected rows) */}
            <div className="inline-flex items-stretch rounded-md shadow-xs">
              <button
                id="btn-bulk-export"
                data-testid="btn-bulk-export"
                type="button"
                onClick={() => handleBatchExport(activeFormat)}
                disabled={activeExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-l-md text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title={`Bulk Export ${selectedVisibleCount} selected rows as ${activeFormat.toUpperCase()}${batchEnableCompression ? ' (GZIP)' : ''} (Shortcut: ${bulkExportShortcutLabel})`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Bulk Export</span>
                <span className="font-mono text-[10px] bg-emerald-700/80 text-emerald-100 px-1 py-0.2 rounded uppercase">
                  {activeFormat}
                </span>
                {batchEnableCompression && (
                  <span className="font-mono text-[9px] bg-emerald-800 text-emerald-200 px-1 py-0.2 rounded uppercase font-bold">
                    .gz
                  </span>
                )}
                <span className="font-mono text-[10px] text-emerald-200">
                  ({selectedVisibleCount})
                </span>
                <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-800/90 text-emerald-200 border border-emerald-500/50 shadow-2xs font-semibold ml-0.5">
                  {bulkExportShortcutLabel}
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => handleBatchExport(activeFormat === 'csv' ? 'json' : 'csv')}
                disabled={activeExporting}
                className="px-2 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-emerald-100 rounded-r-md text-[11px] font-mono border-l border-emerald-600 transition-colors cursor-pointer"
                title={`Quick export selected rows as ${activeFormat === 'csv' ? 'JSON' : 'CSV'}${batchEnableCompression ? ' (.gz)' : ''}`}
              >
                .{activeFormat === 'csv' ? 'json' : 'csv'}{batchEnableCompression ? '.gz' : ''}
              </button>
            </div>

            {/* Batch Export Options Sub-Menu */}
            <div className="relative" ref={batchOptionsRef}>
              <button
                id="btn-batch-export-options"
                data-testid="btn-batch-export-options"
                type="button"
                onClick={() => setIsBatchOptionsOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer border select-none ${
                  isBatchOptionsOpen || batchEnableCompression || !batchIncludeHeaders
                    ? 'bg-zinc-800 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/40 shadow-xs'
                    : 'bg-zinc-800 hover:bg-zinc-700/80 border-zinc-700 text-zinc-300'
                }`}
                title="Batch Export Options (configure headers and compression specifically for batch exports)"
                aria-expanded={isBatchOptionsOpen}
                aria-haspopup="true"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Batch Export Options</span>
                {batchEnableCompression && (
                  <span className="font-mono text-[9px] bg-emerald-900/90 text-emerald-300 border border-emerald-600/60 px-1 py-0.2 rounded font-bold">
                    GZIP
                  </span>
                )}
                {!batchIncludeHeaders && (
                  <span className="font-mono text-[9px] bg-amber-950 text-amber-300 border border-amber-600/60 px-1 py-0.2 rounded font-bold" title="Headers omitted">
                    No Hdr
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isBatchOptionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Batch Export Options Sub-Menu Dropdown */}
              {isBatchOptionsOpen && (
                <div
                  id="batch-export-options-submenu"
                  data-testid="batch-export-options-submenu"
                  className="absolute right-0 mt-1.5 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-3 z-50 text-xs text-zinc-200 flex flex-col gap-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <span className="font-semibold text-zinc-100 flex items-center gap-1.5 text-xs">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      Batch Export Options
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                      Batch Files Only
                    </span>
                  </div>

                  {/* Toggle 1: Include column headers */}
                  <label
                    id="label-batch-include-headers"
                    htmlFor="checkbox-batch-include-headers"
                    className="flex items-start gap-2.5 p-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-700 cursor-pointer transition-colors group select-none"
                  >
                    <input
                      id="checkbox-batch-include-headers"
                      data-testid="checkbox-batch-include-headers"
                      name="includeColumnHeaders"
                      type="checkbox"
                      checked={batchIncludeHeaders}
                      onChange={(e) => setBatchIncludeHeaders(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100 group-hover:text-emerald-300 transition-colors">
                          Include column headers
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                            batchIncludeHeaders
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {batchIncludeHeaders ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Add column header names row to batch-exported CSV files.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 2: Enable compression */}
                  <label
                    id="label-batch-enable-compression"
                    htmlFor="checkbox-batch-enable-compression"
                    className="flex items-start gap-2.5 p-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-700 cursor-pointer transition-colors group select-none"
                  >
                    <input
                      id="checkbox-batch-enable-compression"
                      data-testid="checkbox-batch-enable-compression"
                      name="enableCompression"
                      type="checkbox"
                      checked={batchEnableCompression}
                      onChange={(e) => setBatchEnableCompression(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-600 text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100 group-hover:text-emerald-300 transition-colors">
                          Enable compression
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                            batchEnableCompression
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {batchEnableCompression ? 'GZIP' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                        Compress batch export archive with GZIP (<code className="font-mono text-emerald-300">.gz</code>) to minimize file size.
                      </p>
                    </div>
                  </label>

                  {/* Submenu Footer: Output Preview and Done Action */}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Batch format: <strong className="text-emerald-300 font-mono">.{activeFormat}{batchEnableCompression ? '.gz' : ''}</strong>
                    </span>
                    <button
                      type="button"
                      id="btn-batch-options-done"
                      onClick={() => setIsBatchOptionsOpen(false)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs cursor-pointer transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Delete Selected Button (Triggers record removal confirmation overlay) */}
            <button
              id="btn-delete-selected"
              data-testid="btn-delete-selected"
              type="button"
              onClick={handleRequestBatchDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title={`Delete ${selectedVisibleCount} selected records from database (Shortcut: ${deleteSelectedShortcutLabel})`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-200" />
              <span>Delete Selected</span>
              <span className="font-mono text-[10px] bg-rose-700/90 text-rose-100 px-1.5 py-0.2 rounded">
                ({selectedVisibleCount})
              </span>
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-700 text-rose-100 border border-rose-400/60 shadow-2xs font-semibold ml-0.5">
                {deleteSelectedShortcutBadge}
              </kbd>
            </button>
          </div>
        </div>
      )}

      {/* Visual Alert Banner for Exceeded Average Latency Threshold */}
      {isAvgLatencyExceeded && (
        <div
          id="avg-latency-alert-banner"
          data-testid="avg-latency-alert-banner"
          className="px-4 py-2.5 bg-rose-600 text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white animate-bounce">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
            </span>
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>Performance Threshold Exceeded!</span>
                <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.2 rounded font-bold">
                  Avg: {averageTableLatencyMs.toFixed(1)}ms (Limit: {alertThresholdMs}ms)
                </span>
              </div>
              <p className="text-[11px] text-rose-100 mt-0.5">
                Table average latency has exceeded your diagnostic threshold. {emailAlertEnabled ? `Email notification dispatched to ${alertEmail}.` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onAutoOptimize) onAutoOptimize();
                setMinLatencyFilterMs(0);
              }}
              className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 font-bold rounded shadow-xs transition-colors cursor-pointer"
            >
              Auto-Resolve via Auto-Optimize
            </button>
            {emailToast && (
              <span className="text-[11px] font-mono bg-rose-800 text-rose-100 px-2 py-0.5 rounded border border-rose-400">
                {emailToast}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Performance Regression Alert Banner */}
      {isPerformanceRegressed && (
        <div
          id="performance-regression-banner"
          data-testid="performance-regression-banner"
          className="px-4 py-2.5 bg-amber-600 text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white animate-pulse">
              <TrendingUp className="w-4 h-4 text-white" />
            </span>
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>Performance Regression Alert!</span>
                <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.2 rounded font-bold">
                  Current Avg: {averageTableLatencyMs.toFixed(1)}ms (&gt;20% over historical baseline {historicalAverageLatency}ms)
                </span>
              </div>
              <p className="text-[11px] text-amber-100 mt-0.5">
                Query latency has increased significantly compared to historical averages. Use the performance diff tool to compare execution plans.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-performance-diff"
              onClick={() => setIsCompareModalOpen(true)}
              className="px-3 py-1 bg-white text-amber-900 hover:bg-amber-50 font-bold rounded shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-700" />
              <span>Side-by-Side Performance Diff</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Query Hotspot Banner */}
      {isQueryHotspotDetected && (
        <div
          id="query-hotspot-banner"
          data-testid="query-hotspot-banner"
          className="px-4 py-2.5 bg-rose-700 text-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-fadeIn border-t border-rose-800"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/25 text-white animate-bounce">
              <Flame className="w-4 h-4 text-amber-200" />
            </span>
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span>Query Hotspot &amp; Lock Contention Warning!</span>
                <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.2 rounded font-bold">
                  Table: {hotspotTableName}
                </span>
                <span className="text-[10px] font-mono bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded font-extrabold">
                  {hotspotWriteOpsPerSec} writes/sec
                </span>
              </div>
              <p className="text-[11px] text-rose-100 mt-0.5">
                Unusually high write volume detected on <span className="font-mono font-bold">{hotspotTableName}</span>. This is causing row-level lock contention and queuing delays.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-re-sequence-writes"
              data-testid="btn-re-sequence-writes"
              onClick={() => {
                alert(`Successfully re-sequenced write operations for table '${hotspotTableName}' to mitigate lock contention and deadlock hazards.`);
              }}
              className="px-3 py-1 bg-white text-rose-800 hover:bg-rose-50 font-bold rounded shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Re-sequence Writes</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Latency Heatmap Overlay Control Banner (Active when batchEagerLoading is disabled) */}
      {!safeFlags.batchEagerLoading && (
        <div
          id="latency-heatmap-overlay-bar"
          data-testid="latency-heatmap-overlay-bar"
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-b border-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
              <Flame className="w-3.5 h-3.5 text-rose-600" />
            </span>
            <div>
              <div className="font-bold text-rose-950 flex items-center gap-1.5">
                <span>Real-Time Latency Heatmap Overlay</span>
                <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded border border-rose-300 font-bold">
                  N+1 Storm Active
                </span>
                <span className="text-[10px] font-mono bg-zinc-900 text-amber-300 px-1.5 py-0.2 rounded">
                  Avg: {averageTableLatencyMs.toFixed(1)}ms
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Highlighting records &amp; columns contributing most to query latency due to unbatched subqueries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Latency Threshold Filter Slider */}
            <div className="flex items-center gap-2 bg-white/95 px-3 py-1 rounded-md border border-rose-200 text-zinc-700 shadow-2xs">
              <span className="font-semibold text-rose-950 flex items-center gap-1 text-[11px]">
                <span>Min Latency:</span>
                <strong className="font-mono text-rose-700">{minLatencyFilterMs}ms</strong>
              </span>
              <input
                id="latency-filter-slider"
                data-testid="latency-filter-slider"
                type="range"
                min="0"
                max="200"
                step="10"
                value={minLatencyFilterMs}
                onChange={(e) => setMinLatencyFilterMs(Number(e.target.value))}
                className="w-20 accent-rose-600 cursor-pointer h-1.5 bg-rose-200 rounded-lg"
                title="Filter visible rows by minimum latency value to isolate performance-heavy records"
              />
              {minLatencyFilterMs > 0 && (
                <button
                  type="button"
                  onClick={() => setMinLatencyFilterMs(0)}
                  className="text-[10px] text-rose-700 hover:text-rose-900 font-bold underline ml-0.5 cursor-pointer"
                  title="Reset latency filter"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Email & Latency Alert Config */}
            <div className="flex items-center gap-1.5 bg-white/95 px-2.5 py-1 rounded-md border border-rose-200 text-zinc-700 text-[11px]">
              <Bell className="w-3.5 h-3.5 text-rose-600 animate-pulse shrink-0" />
              <span className="font-medium text-zinc-800">Alert &gt;</span>
              <input
                id="input-alert-threshold"
                type="number"
                min="10"
                max="500"
                step="10"
                value={alertThresholdMs}
                onChange={(e) => setAlertThresholdMs(Math.max(10, Number(e.target.value)))}
                className="w-12 px-1 py-0.5 text-center font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded"
                title="User-defined average latency threshold (ms)"
              />
              <span className="text-zinc-500 font-mono">ms</span>
              <label className="flex items-center gap-1 cursor-pointer ml-1 select-none font-medium text-zinc-700" title="Enable automated email notifications when threshold is exceeded">
                <input
                  type="checkbox"
                  checked={emailAlertEnabled}
                  onChange={(e) => setEmailAlertEnabled(e.target.checked)}
                  className="w-3 h-3 text-rose-600 rounded border-rose-300 accent-rose-600 cursor-pointer"
                />
                <Mail className="w-3 h-3 text-zinc-600" />
              </label>
            </div>

            {/* Heatmap Legend */}
            <div className="hidden 2xl:flex items-center gap-2 text-[11px] font-medium text-zinc-600 bg-white/80 px-2.5 py-1 rounded-md border border-zinc-200">
              <span className="text-zinc-500 font-semibold">Thresholds:</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> &lt;50ms
              </span>
              <span className="text-zinc-300">•</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-mono">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> 50–150ms
              </span>
              <span className="text-zinc-300">•</span>
              <span className="inline-flex items-center gap-1 text-rose-700 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> &gt;150ms
              </span>
            </div>

            {/* Auto-Optimize Button */}
            <button
              type="button"
              id="btn-auto-optimize"
              data-testid="btn-auto-optimize"
              onClick={() => {
                if (onAutoOptimize) onAutoOptimize();
                setMinLatencyFilterMs(0);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Automatically resolve N+1 latency hotspots by toggling required optimization flags"
            >
              <Zap className="w-3.5 h-3.5 text-amber-200 animate-bounce" />
              <span>Auto-Optimize</span>
            </button>

            {/* Export Heatmap CSV Button */}
            <button
              type="button"
              id="btn-export-heatmap-csv"
              data-testid="btn-export-heatmap-csv"
              onClick={handleExportHeatmapCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Download a CSV containing the latency metrics for all records currently displayed in the table"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export Latency CSV</span>
            </button>

            {/* Dedicated Latency Heatmap Layers Sub-Menu Dropdown (replaces single global toggle) */}
            <div className="relative" ref={heatmapToolbarMenuRef}>
              <button
                type="button"
                id="btn-toolbar-heatmap-layers-menu"
                data-testid="toggle-latency-heatmap"
                onClick={() => setHeatmapLayersMenuAnchor((prev) => prev === 'toolbar' ? null : 'toolbar')}
                aria-expanded={heatmapLayersMenuAnchor === 'toolbar'}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all border shadow-2xs select-none ${
                  isAnyHeatmapLayerActive
                    ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400/40 shadow-xs'
                    : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                }`}
                title="Configure Latency Heatmap Layers (Row Render Time, Data Fetch Time, and DOM Hydration cost)"
              >
                <Flame className={`w-3.5 h-3.5 ${isAnyHeatmapLayerActive ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-semibold text-rose-950">Heatmap Layers</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  isAnyHeatmapLayerActive ? 'bg-rose-200 text-rose-950 border border-rose-300' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {isAnyHeatmapLayerActive ? `${activeHeatmapLayerCount}/3 Active` : 'OFF'}
                </span>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${heatmapLayersMenuAnchor === 'toolbar' ? 'rotate-180' : ''}`} />
              </button>

              {/* Sub-menu Popover */}
              {heatmapLayersMenuAnchor === 'toolbar' && renderHeatmapLayersPopover('right')}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Legend Display */}
      {isAnyHeatmapLayerActive && (
        <div className="bg-gradient-to-r from-zinc-50 via-zinc-100 to-rose-50/40 border-b border-zinc-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-700 animate-fadeIn">
          <div className="flex items-center gap-2 font-semibold">
            <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>Heatmap Intensity Legend:</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Active Layers Pill Tags */}
            <div className="flex items-center gap-1 bg-white/90 border border-zinc-200 px-2 py-0.5 rounded text-[11px] shadow-2xs">
              <span className="text-zinc-500 font-medium">Layers:</span>
              <button
                type="button"
                id="btn-legend-toggle-fetch"
                data-testid="btn-legend-toggle-fetch"
                onClick={() => handleToggleHeatmapLayer('dataFetch')}
                className={`px-1.5 py-0.2 rounded font-mono font-semibold cursor-pointer transition-colors ${
                  heatmapLayers.dataFetch ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-zinc-100 text-zinc-400 line-through'
                }`}
                title="Toggle Data Fetch Time Layer"
              >
                Fetch
              </button>
              <button
                type="button"
                id="btn-legend-toggle-render"
                data-testid="btn-legend-toggle-render"
                onClick={() => handleToggleHeatmapLayer('rowRender')}
                className={`px-1.5 py-0.2 rounded font-mono font-semibold cursor-pointer transition-colors ${
                  heatmapLayers.rowRender ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-zinc-100 text-zinc-400 line-through'
                }`}
                title="Toggle Row Render Time Layer"
              >
                Render
              </button>
              <button
                type="button"
                id="btn-legend-toggle-hydration"
                data-testid="btn-legend-toggle-hydration"
                onClick={() => handleToggleHeatmapLayer('domHydration')}
                className={`px-1.5 py-0.2 rounded font-mono font-semibold cursor-pointer transition-colors ${
                  heatmapLayers.domHydration ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-zinc-100 text-zinc-400 line-through'
                }`}
                title="Toggle DOM Hydration Cost Layer"
              >
                Hydration
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/60 border border-emerald-600"></span>
              <span>Fast (&lt;50ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/70 border border-amber-600"></span>
              <span>Moderate (50-150ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-600/80 border border-rose-700 animate-pulse"></span>
              <span>High Latency / Outlier (&gt;150ms)</span>
            </div>
            <div className="bg-white px-2 py-0.5 rounded border border-zinc-300 text-[11px] font-mono text-zinc-600">
              Intensity Gradient: <span className="text-rose-700 font-bold">Dynamic Scale (0ms - 250ms+)</span>
            </div>
          </div>
        </div>
      )}

      {/* Heavy Loading Ghost Rows Active Banner */}
      {isHeavyLoading && (
        <div
          id="banner-ghost-loading"
          data-testid="banner-ghost-loading"
          className="px-4 py-2.5 bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-purple-500/15 border-b border-purple-200 flex flex-wrap items-center justify-between gap-3 text-xs text-purple-950 animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping" />
            <strong className="font-bold text-purple-900">Heavy Dataset Loading:</strong>
            <span className="text-zinc-600 font-medium">{heavyLoadingMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              id="badge-ghost-row-status"
              data-testid="badge-ghost-row-status"
              className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs flex items-center gap-1"
            >
              <Eye className="w-3 h-3 text-purple-600" />
              <span>Ghost Placeholders Active ({ghostRowsCount} Rows)</span>
            </span>
          </div>
        </div>
      )}

      {/* Table Header */}
      <div
        id="table-column-header"
        data-testid="table-column-header"
        className={`grid grid-cols-12 px-4 ${isCompactView ? 'py-1.5' : 'py-3'} bg-zinc-100/80 border-b border-zinc-200 text-xs font-semibold text-zinc-600 select-none items-center`}
      >
        <div className="col-span-1 flex items-center gap-1.5">
          <label
            htmlFor="checkbox-select-all"
            className="flex items-center gap-1.5 cursor-pointer select-none group"
            title={
              isAllVisibleSelected
                ? `Deselect all ${currentRecordsToDisplay.length} visible records`
                : `Select all ${currentRecordsToDisplay.length} visible records`
            }
          >
            <input
              id="checkbox-select-all"
              name="selectAllVisibleRecords"
              type="checkbox"
              ref={selectAllCheckboxRef}
              checked={isAllVisibleSelected}
              onChange={handleToggleSelectAll}
              aria-label="Select all visible records"
              className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer accent-emerald-600 shrink-0"
            />
            <span className="font-semibold text-zinc-700 group-hover:text-zinc-900">#</span>
          </label>
          {selectedVisibleCount > 0 && (
            <span
              id="table-header-selected-counter"
              className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-300"
              title={`${selectedVisibleCount} rows selected`}
            >
              {selectedVisibleCount}
            </span>
          )}
        </div>
        <div className="col-span-2 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Order ID</span>
            <span
              className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 rounded font-normal hidden sm:inline-flex items-center gap-0.5 select-none"
              title="Hover or click 'Insight' on any row to reveal specific query plan node latency contributions"
            >
              <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
              <span>Plan Insights</span>
            </span>
            {showSelectedOnly && (
              <span
                id="header-selected-only-indicator"
                className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300 inline-flex items-center gap-1"
              >
                <Eye className="w-2.5 h-2.5 text-emerald-600" />
                <span>Selected Only</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span
              id="header-scan-density-order-id"
              data-testid="header-scan-density-order-id"
              className="text-[9px] font-mono text-rose-800 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 font-bold"
              title="Scan Density: 50,000 scanned / 100 returned (500:1 Inefficient Filter Ratio)"
            >
              Scan: 500:1 ⚠️
            </span>
            <span
              id="header-render-cost-order-id"
              data-testid="header-render-cost-order-id"
              className="text-[9px] font-mono text-amber-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200"
              title="DOM layout shift contribution: 2.1ms (14%)"
            >
              2.1ms (14%)
            </span>
          </div>
        </div>
        <div className="col-span-3 flex items-center justify-between gap-1">
          <span>Customer &amp; Account</span>
          <div className="flex items-center gap-1">
            <span
              id="header-scan-density-customer"
              data-testid="header-scan-density-customer"
              className="text-[9px] font-mono text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-bold"
              title="Scan Density: 25,000 scanned / 100 returned (250:1)"
            >
              Scan: 250:1
            </span>
            <span
              id="header-render-cost-customer"
              data-testid="header-render-cost-customer"
              className="text-[9px] font-mono text-rose-900 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 font-bold"
              title="Highest layout shift contribution: 4.8ms (32%)"
            >
              4.8ms (32%) ⚠️
            </span>
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-1">
          <span>Category</span>
          <div className="flex items-center gap-1">
            <span
              id="header-scan-density-category"
              data-testid="header-scan-density-category"
              className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-300 font-bold"
              title="Scan Density: 100 scanned / 100 returned (1:1 Optimal Index Seek)"
            >
              Scan: 1:1 ✨
            </span>
            <span
              id="header-render-cost-category"
              data-testid="header-render-cost-category"
              className="text-[9px] font-mono text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200"
              title="DOM layout shift contribution: 1.5ms (10%)"
            >
              1.5ms (10%)
            </span>
          </div>
        </div>
        <div className="col-span-1 flex items-center justify-between gap-1">
          <span>Status</span>
          <span
            id="header-render-cost-status"
            data-testid="header-render-cost-status"
            className="text-[9px] font-mono text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200"
            title="DOM layout shift contribution: 0.8ms (5%)"
          >
            0.8ms (5%)
          </span>
        </div>
        <div className="col-span-2 text-right flex items-center justify-end gap-1.5">
          <span
            id="header-render-cost-amount"
            data-testid="header-render-cost-amount"
            className="text-[9px] font-mono text-amber-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200"
            title="DOM layout shift contribution: 3.2ms (21%)"
          >
            3.2ms (21%)
          </span>
          <span>Amount</span>
        </div>
        <div className="col-span-1 text-center flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <span>Items</span>
            <button
              type="button"
              id="btn-header-cost-heatmap-toggle"
              data-testid="btn-header-cost-heatmap-toggle"
              onClick={() => {
                if (isAnyHeatmapLayerActive) {
                  handleSetAllHeatmapLayers(false);
                } else {
                  handleSetAllHeatmapLayers(true);
                }
              }}
              className={`p-0.5 rounded transition-colors cursor-pointer ${
                isAnyHeatmapLayerActive
                  ? 'text-rose-600 hover:bg-rose-100/50'
                  : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200'
              }`}
              title={`Execution Cost Heatmap Layers: ${isAnyHeatmapLayerActive ? `${activeHeatmapLayerCount}/3 Active (Click to disable)` : 'Inactive (Click to enable all)'}`}
              aria-label="Toggle Execution Cost Heatmap Layers"
            >
              <Flame className={`w-3.5 h-3.5 ${isAnyHeatmapLayerActive ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
            </button>
          </div>
          <span
            id="header-render-cost-items"
            data-testid="header-render-cost-items"
            className="text-[9px] font-mono text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200"
            title="DOM layout shift contribution: 2.6ms (18%)"
          >
            2.6ms (18%)
          </span>
        </div>
      </div>

      {/* Review Selected Rows Banner when 'Show Selected Only' is Active */}
      {showSelectedOnly && (
        <div
          id="review-selection-banner"
          data-testid="review-selection-banner"
          className="px-4 py-2 bg-emerald-50/90 border-b border-emerald-200 text-xs text-emerald-950 flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-2 font-medium">
            <Eye className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Reviewing <strong>{displayRecords.length}</strong> selected rows for batch processing (all other rows hidden).
            </span>
          </div>
          <button
            type="button"
            id="btn-banner-show-all-records"
            onClick={() => handleToggleShowSelectedOnly(false)}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer shrink-0 ml-2"
          >
            Show all {records.length} records
          </button>
        </div>
      )}

      {/* Active Replay Step UI Rendering State Ribbon */}
      {currentActiveReplayStep && (
        <div
          id="replay-active-rendering-ribbon"
          data-testid="replay-active-rendering-ribbon"
          className={`px-4 py-1.5 border-b text-xs flex items-center justify-between gap-3 shadow-3xs ${
            currentActiveReplayStep.degradationSeverity === 'critical'
              ? 'bg-rose-50/95 border-rose-300 text-rose-950 ring-1 ring-rose-400/30'
              : currentActiveReplayStep.degradationSeverity === 'moderate'
              ? 'bg-amber-50/95 border-amber-300 text-amber-950 ring-1 ring-amber-400/30'
              : 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold flex items-center gap-1">
              <Monitor className="w-3.5 h-3.5 text-indigo-700" />
              <span>UI Rendering State:</span>
            </span>
            <span className="font-semibold">
              {currentActiveReplayStep.renderMode === 'virtualized'
                ? 'Virtualized Viewport (Windowed O(1))'
                : currentActiveReplayStep.renderMode === 'deferred_concurrent'
                ? 'Concurrent Deferred Mode (React 19)'
                : 'Synchronous Main-Thread Blocking Dump'}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold border ${
                currentActiveReplayStep.fps >= 50
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : currentActiveReplayStep.fps >= 25
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
              }`}
            >
              {currentActiveReplayStep.fps} FPS ({currentActiveReplayStep.domRenderTimeMs}ms layout)
            </span>
            {currentActiveReplayStep.degradationSeverity !== 'none' && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 rounded px-1.5 py-0.2">
                Degradation Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] truncate">
            <span className="truncate text-zinc-600 hidden md:inline max-w-md">
              {currentActiveReplayStep.degradationCause}
            </span>
            <span className="font-mono font-bold shrink-0 text-indigo-900 bg-indigo-100/80 px-2 py-0.5 rounded border border-indigo-200">
              Step {currentActiveReplayStep.stepNumber}/{currentReplaySteps.length}
            </span>
          </div>
        </div>
      )}

      {/* Pinned Baseline Rows Section (Anchored at top of viewport for tracking baseline performance) */}
      {pinnedRecords.length > 0 && (
        <div
          id="pinned-baseline-rows-container"
          data-testid="pinned-baseline-rows-container"
          className="bg-amber-50/95 border-b-2 border-amber-300 shadow-sm shrink-0"
        >
          <div className="px-4 py-2 bg-amber-100/90 border-b border-amber-200 flex items-center justify-between text-xs font-semibold text-amber-950">
            <div className="flex items-center gap-2">
              <Pin className="w-3.5 h-3.5 text-amber-700 fill-amber-500 rotate-45 shrink-0" />
              <span>Pinned Baseline Records ({pinnedRecords.length}) — Anchored for performance comparison</span>
            </div>
            <button
              type="button"
              id="btn-unpin-all-rows"
              onClick={() => setPinnedRowIds(new Set())}
              className="text-[11px] text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              Unpin All
            </button>
          </div>
          <div className="divide-y divide-amber-200/70 max-h-48 overflow-y-auto">
            {pinnedRecords.map((rec) => {
              const recordItemCount = rec.items && rec.items.length > 0 ? rec.items.length : (rec.itemCount || 1);
              const unoptimizedMultiplier = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
              const indexPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
              const nPlusOneLatencyMs = safeFlags.batchEagerLoading 
                ? (recordItemCount * 4.0 + 10.0) 
                : (20.0 + (recordItemCount * unoptimizedMultiplier) + indexPenalty);

              return (
                <div
                  key={`pinned-${rec.id}`}
                  id={`pinned-row-${rec.id}`}
                  className="grid grid-cols-12 px-4 py-2 items-center text-xs bg-amber-50/70 hover:bg-amber-100/80 transition-colors border-b border-amber-200/40"
                >
                  <div className="col-span-1 flex items-center gap-1.5 text-amber-900 font-mono">
                    <button
                      type="button"
                      id={`btn-unpin-row-${rec.id}`}
                      onClick={() => handleTogglePinRow(rec.id)}
                      className="p-0.5 rounded bg-amber-200 text-amber-800 hover:bg-amber-300 transition-colors cursor-pointer"
                      title="Unpin baseline record row"
                      aria-label={`Unpin baseline record ${rec.orderNumber}`}
                    >
                      <Pin className="w-3 h-3 fill-amber-600 text-amber-800 rotate-45" />
                    </button>
                    <span className="text-[10px] bg-amber-200/90 text-amber-900 px-1 rounded font-bold">
                      PIN
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className="font-mono font-bold text-amber-950">{rec.orderNumber}</span>
                    <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                      {nPlusOneLatencyMs.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="col-span-3 text-amber-900 truncate">
                    {rec.customerName} <span className="text-amber-700 font-mono text-[10px]">({rec.customerEmail})</span>
                  </div>
                  <div className="col-span-2 text-amber-900 truncate">{rec.category}</div>
                  <div className="col-span-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/90 text-amber-900 capitalize">
                      {rec.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-right font-mono font-semibold text-amber-950">
                    ${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="col-span-1 text-center font-mono text-amber-900">
                    {recordItemCount} items
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOM Render Performance Telemetry Overlay */}
      {showDomRenderPerfOverlay && (
        <div
          id="dom-render-perf-overlay"
          data-testid="dom-render-perf-overlay"
          className="p-3 bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950 text-white border-b border-indigo-500/40 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-sans shadow-lg animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600/20 border border-rose-500/40 rounded-xl text-rose-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <span>DOM Render Performance Monitor</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  Target: 60 FPS (16.6ms budget)
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Tracking scroll calculation &amp; active window DOM render durations in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-zinc-800/90 px-3 py-1.5 rounded-xl border border-zinc-700 font-mono text-[11px]">
              <span className="text-zinc-400">Avg Render:</span>
              <strong className="text-emerald-400">
                {(scrollRenderTimes.reduce((a, b) => a + b, 0) / scrollRenderTimes.length).toFixed(1)}ms
              </strong>
            </div>

            <div className="flex items-center gap-2 bg-zinc-800/90 px-3 py-1.5 rounded-xl border border-zinc-700 font-mono text-[11px]">
              <span className="text-zinc-400">Frame Drops (&gt;16.6ms):</span>
              <strong className={frameDropsCount > 0 ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}>
                {frameDropsCount} jank spikes
              </strong>
            </div>

            <div className="flex items-center gap-2 bg-zinc-800/90 px-3 py-1.5 rounded-xl border border-zinc-700">
              <span className="text-[10px] font-semibold text-zinc-400">Scroll Frame Latency Graph:</span>
              <div className="flex items-end gap-0.5 h-6 w-28 bg-zinc-900/80 p-0.5 rounded border border-zinc-700/60">
                {scrollRenderTimes.slice(-16).map((ms, mi) => {
                  const isDrop = ms > 16.6;
                  const heightPct = Math.min(100, Math.max(10, (ms / 35) * 100));
                  return (
                    <div
                      key={mi}
                      style={{ height: `${heightPct}%` }}
                      className={`w-1.5 rounded-xs transition-all ${
                        isDrop ? 'bg-rose-500 ring-1 ring-rose-300' : 'bg-emerald-400'
                      }`}
                      title={`Scroll Event #${mi + 1}: ${ms.toFixed(1)}ms ${isDrop ? '(⚠️ Frame Drop)' : '(✓ Smooth)'}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const logData = {
                    exportType: 'dom_render_performance_logs',
                    exportedAt: new Date().toISOString(),
                    totalEvents: scrollRenderTimes.length,
                    frameDropsCount,
                    avgRenderMs: Number((scrollRenderTimes.reduce((a, b) => a + b, 0) / (scrollRenderTimes.length || 1)).toFixed(2)),
                    frames: scrollRenderTimes.map((ms, idx) => ({
                      eventId: idx + 1,
                      renderTimeMs: ms,
                      isFrameDrop: ms > 16.6
                    }))
                  };
                  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
                  triggerFileDownload(blob, `dom-render-performance-logs-${Date.now()}.json`);
                }}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                title="Download JSON file containing captured DOM render and scroll frame timing logs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Frame Logs</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScrollRenderTimes([2.1, 3.5, 4.1]);
                  setFrameDropsCount(0);
                }}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-zinc-600"
              >
                Reset Stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Table Viewport */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{ height: `${CONTAINER_HEIGHT}px` }}
        className="overflow-y-auto relative divide-y divide-zinc-100"
      >
        {isHeavyLoading && ghostRowsEnabled ? (
          <div
            id="ghost-rows-container"
            data-testid="ghost-rows-container"
            className="divide-y divide-zinc-100 animate-fadeIn"
          >
            {renderGhostRows(ghostRowsCount)}
          </div>
        ) : displayRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
            <Package className="w-10 h-10 text-zinc-300 mb-2" />
            <p className="text-sm font-medium text-zinc-700">
              {showSelectedOnly ? 'No selected rows to display' : 'No records found'}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {showSelectedOnly
                ? 'Select rows using the checkboxes or toggle off "Show Selected Only" to review all records.'
                : 'Try adjusting your search criteria or filter selections'}
            </p>
            {showSelectedOnly && (
              <button
                type="button"
                id="btn-empty-show-all-records"
                onClick={() => handleToggleShowSelectedOnly(false)}
                className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                Show All Records
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              height: safeFlags.virtualizedDOM ? `${displayRecords.length * ROW_HEIGHT}px` : 'auto',
              position: 'relative'
            }}
          >
            <div
              style={{
                transform: safeFlags.virtualizedDOM ? `translateY(${offsetY}px)` : 'none',
                position: safeFlags.virtualizedDOM ? 'absolute' : 'relative',
                top: 0,
                left: 0,
                right: 0
              }}
            >
              {visibleRecords.map((rec, index) => {
                const actualIndex = safeFlags.virtualizedDOM ? startIndex + index + 1 : index + 1;
                const isExpanded = expandedRowId === rec.id;
                const isSelected = selectedRowIds.has(rec.id);
                const planInsight = getRecordQueryPlanInsight(rec, safeFlags);
                const isInsightActive = hoveredInsightRowId === rec.id || pinnedInsightRowId === rec.id;

                const anomalyData = anomalyMap.get(rec.id);
                const isStatisticalOutlier = anomalyData ? anomalyData.isOutlier : false;
                const zScoreVal = anomalyData ? anomalyData.zScore : 0;

                const breakdown = computeRowLatencyBreakdown(rec);
                const effectiveLatencyMs = breakdown.effectiveLatencyMs;
                const nPlusOneLatencyMs = breakdown.dataFetchMs;
                const recordItemCount = breakdown.recordItemCount;
                
                let heatmapRowBg = '';
                let heatmapRowStyle: React.CSSProperties = { minHeight: `${ROW_HEIGHT}px` };
                let heatmapBadgeClass = '';
                let isHighCost = false;
                let isModerateCost = false;
                let relativeCostRatio = 0;

                if (isAnyHeatmapLayerActive) {
                  const range = Math.max(maxRowCost - minRowCost, 1);
                  relativeCostRatio = Math.max(0, Math.min(1, (effectiveLatencyMs - minRowCost) / range));
                  isHighCost = isStatisticalOutlier || effectiveLatencyMs > 150 || (relativeCostRatio >= 0.75 && effectiveLatencyMs > 40);
                  isModerateCost = !isHighCost && (effectiveLatencyMs >= 50 || relativeCostRatio >= 0.4);

                  if (isHighCost) {
                    const intensity = 0.12 + relativeCostRatio * 0.38;
                    heatmapRowStyle.backgroundColor = isSelected
                      ? `rgba(225, 29, 72, ${intensity + 0.12})`
                      : `rgba(225, 29, 72, ${intensity})`;
                    heatmapRowBg = isSelected ? 'border-rose-400 ring-2 ring-rose-500 shadow-md' : 'border-rose-300 ring-1 ring-rose-400/50 hover:bg-rose-100/50';
                    heatmapBadgeClass = 'bg-rose-600 text-white font-bold animate-pulse shadow-xs';
                  } else if (isModerateCost) {
                    const intensity = 0.08 + relativeCostRatio * 0.28;
                    heatmapRowStyle.backgroundColor = isSelected
                      ? `rgba(217, 119, 6, ${intensity + 0.1})`
                      : `rgba(217, 119, 6, ${intensity})`;
                    heatmapRowBg = isSelected ? 'border-amber-300' : 'border-amber-200 hover:bg-amber-100/40';
                    heatmapBadgeClass = 'bg-amber-500 text-white font-semibold';
                  } else {
                    const intensity = 0.04 + (1 - relativeCostRatio) * 0.18;
                    heatmapRowStyle.backgroundColor = isSelected
                      ? `rgba(16, 185, 129, ${intensity + 0.1})`
                      : `rgba(16, 185, 129, ${intensity})`;
                    heatmapRowBg = isSelected ? 'border-emerald-200' : 'border-emerald-100 hover:bg-emerald-50/40';
                    heatmapBadgeClass = 'bg-emerald-600 text-white font-medium';
                  }
                } else {
                  heatmapRowBg = isSelected
                    ? 'bg-emerald-50/90 hover:bg-emerald-100/70 border-emerald-200 shadow-2xs'
                    : isExpanded
                    ? 'bg-zinc-50 font-medium border-zinc-100'
                    : 'hover:bg-zinc-50/80 border-zinc-100';
                  heatmapBadgeClass = 'bg-zinc-100 text-zinc-700';
                }

                return (
                  <React.Fragment key={rec.id}>
                    <div
                      id={`row-${rec.id}`}
                      data-selected={isSelected}
                      aria-selected={isSelected}
                      onClick={() => setSelectedMetricsRecord(rec)}
                      title="Click to inspect full execution metrics, latency breakdown, and cache vs disk status"
                      className={`grid grid-cols-12 px-4 ${isCompactView ? 'py-1.5' : 'py-3'} items-center text-xs transition-colors cursor-pointer border-b relative group ${heatmapRowBg}`}
                      style={heatmapRowStyle}
                    >
                      {/* Row Hover Latency & Z-Score Anomaly Tooltip */}
                      {isAnyHeatmapLayerActive && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden group-hover:flex flex-col gap-1 px-3 py-2 bg-zinc-900/95 backdrop-blur-sm text-white rounded-lg shadow-xl text-[11px] font-mono z-30 pointer-events-none border border-zinc-700 animate-fadeIn min-w-[210px]">
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-700/80 pb-1">
                            <div className="flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
                              <span className="font-semibold text-zinc-200">Latency Heatmap:</span>
                            </div>
                            <strong className="text-rose-300 font-bold text-xs">{effectiveLatencyMs.toFixed(1)}ms</strong>
                          </div>

                          {/* Active layer breakdown chips */}
                          <div className="grid grid-cols-3 gap-1 pt-0.5 text-[10px]">
                            <div className={`p-1 rounded text-center ${heatmapLayers.dataFetch ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300' : 'text-zinc-500 opacity-60'}`}>
                              <div className="font-bold">Fetch</div>
                              <div>{breakdown.dataFetchMs.toFixed(1)}ms</div>
                            </div>
                            <div className={`p-1 rounded text-center ${heatmapLayers.rowRender ? 'bg-amber-950/80 border border-amber-700/60 text-amber-300' : 'text-zinc-500 opacity-60'}`}>
                              <div className="font-bold">Render</div>
                              <div>{breakdown.rowRenderMs.toFixed(1)}ms</div>
                            </div>
                            <div className={`p-1 rounded text-center ${heatmapLayers.domHydration ? 'bg-purple-950/80 border border-purple-700/60 text-purple-300' : 'text-zinc-500 opacity-60'}`}>
                              <div className="font-bold">DOM</div>
                              <div>{breakdown.domHydrationMs.toFixed(1)}ms</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5 text-zinc-300">
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              isHighCost
                                ? 'bg-rose-950 text-rose-300 border border-rose-500'
                                : isModerateCost
                                ? 'bg-amber-950 text-amber-300 border border-amber-500'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                            }`}>
                              Cost: {Math.round(relativeCostRatio * 100)}%
                            </span>
                            {isHighCost && (
                              <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold text-[9px] uppercase tracking-wider">
                                Expensive
                              </span>
                            )}
                            {isStatisticalOutlier && (
                              <span className="bg-rose-950 text-rose-300 border border-rose-500 px-1 py-0.2 rounded font-bold text-[9px]">
                                🚨 Z: {zScoreVal > 0 ? `+${zScoreVal.toFixed(2)}` : zScoreVal.toFixed(2)}σ
                              </span>
                            )}
                            <span className="text-zinc-400 text-[10px]">({recordItemCount} items)</span>
                          </div>
                        </div>
                      )}
                      {/* Checkbox, Index & Expand arrow */}
                      <div
                        className="col-span-1 flex items-center gap-1.5 text-zinc-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          id={`checkbox-select-row-${rec.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleRow(rec.id);
                          }}
                          aria-label={`Select order ${rec.orderNumber}`}
                          className="w-3.5 h-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer shrink-0 accent-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(rec.id);
                          }}
                          className={`p-0.5 rounded transition-colors ${
                            isSelected
                              ? 'hover:bg-emerald-200/60 text-emerald-700 hover:text-emerald-900'
                              : 'hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-600'
                          }`}
                          title={isExpanded ? 'Collapse row line items' : 'Expand row line items'}
                        >
                          {isExpanded ? (
                            <ChevronDown className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-800' : 'text-zinc-600'}`} />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : ''}`} />
                          )}
                        </button>
                        <button
                          type="button"
                          id={`btn-pin-row-${rec.id}`}
                          data-testid={`btn-pin-row-${rec.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePinRow(rec.id);
                          }}
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            pinnedRowIds.has(rec.id)
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-1 ring-amber-400'
                              : 'hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-600'
                          }`}
                          title={pinnedRowIds.has(rec.id) ? 'Unpin baseline performance row' : 'Pin row to top of viewport as baseline'}
                          aria-label={`Pin row ${rec.orderNumber}`}
                        >
                          <Pin className={`w-3 h-3 ${pinnedRowIds.has(rec.id) ? 'fill-amber-500 text-amber-700 rotate-45' : 'text-zinc-400'}`} />
                        </button>
                        <span
                          className={`font-mono text-[11px] select-none ${
                            isSelected ? 'text-emerald-800 font-semibold' : 'text-zinc-400'
                          }`}
                        >
                          {actualIndex}
                        </span>
                      </div>

                      {/* Order Number & Query Plan Insight */}
                      <div className="col-span-2 relative">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-mono font-medium ${
                              isSelected ? 'text-emerald-950 font-semibold' : 'text-zinc-900'
                            }`}
                          >
                            {rec.orderNumber}
                          </span>

                          {/* Small 'Insight' Tooltip Trigger Badge */}
                          <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              id={`btn-row-insight-${rec.id}`}
                              data-testid={`btn-row-insight-${rec.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPinnedInsightRowId((prev) => (prev === rec.id ? null : rec.id));
                              }}
                              onMouseEnter={() => setHoveredInsightRowId(rec.id)}
                              onMouseLeave={() => setHoveredInsightRowId(null)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border select-none ${
                                isInsightActive
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/40'
                                  : planInsight.topNode.severity === 'critical'
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 hover:border-rose-400'
                                  : planInsight.topNode.severity === 'warning'
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-400'
                                  : 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:border-indigo-300'
                              }`}
                              title={`Query Plan Insight: Top contributor is ${planInsight.topNode.nodeType} (${planInsight.topNode.percentage.toFixed(0)}% of latency)`}
                              aria-label={`View Query Plan Latency Insight for ${rec.orderNumber}`}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              <span>Insight</span>
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                  isInsightActive
                                    ? 'bg-indigo-700 text-white'
                                    : planInsight.topNode.severity === 'critical'
                                    ? 'bg-rose-100 text-rose-900'
                                    : planInsight.topNode.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {planInsight.topNode.latencyMs.toFixed(0)}ms
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className={`text-[10px] ${isSelected ? 'text-emerald-700/70' : 'text-zinc-400'}`}>
                          {rec.createdAt}
                        </div>

                        {/* Small 'Insight' Tooltip revealing specific query plan nodes contributing most to record's latency */}
                        {isInsightActive && (
                          <div
                            id={`tooltip-plan-insight-${rec.id}`}
                            data-testid={`tooltip-plan-insight-${rec.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute left-0 z-50 w-80 sm:w-96 p-4 bg-zinc-950/98 text-white rounded-xl shadow-2xl border border-zinc-700/90 text-xs backdrop-blur-md animate-fadeIn cursor-default select-text ring-1 ring-white/10 ${
                              index >= visibleRecords.length - 2 && visibleRecords.length > 3
                                ? 'bottom-full mb-1.5'
                                : 'top-full mt-1.5'
                            }`}
                          >
                            {/* Tooltip Header */}
                            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-bold text-zinc-100 text-xs">Query Plan Latency Breakdown</h4>
                                    <span className="font-mono text-[10px] text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-800">
                                      {rec.orderNumber}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">
                                    Total record fetch latency: <strong className="text-zinc-200 font-mono">{planInsight.totalLatencyMs.toFixed(1)}ms</strong>
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                id={`btn-close-insight-${rec.id}`}
                                data-testid={`btn-close-insight-${rec.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinnedInsightRowId(null);
                                  setHoveredInsightRowId(null);
                                }}
                                className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 cursor-pointer transition-colors"
                                title="Close insight tooltip"
                                aria-label="Close insight tooltip"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Dominant Plan Node Bottleneck Callout */}
                            <div
                              className={`p-2.5 rounded-lg border mb-3 flex items-start gap-2.5 ${
                                planInsight.topNode.severity === 'critical'
                                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                                  : planInsight.topNode.severity === 'warning'
                                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                                  : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                              }`}
                            >
                              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                planInsight.topNode.severity === 'critical'
                                  ? 'text-rose-400'
                                  : planInsight.topNode.severity === 'warning'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-bold text-[11px] uppercase tracking-wide">
                                    Top Contributor ({planInsight.topNode.percentage.toFixed(0)}%)
                                  </span>
                                  <span className="font-mono font-bold text-xs">
                                    +{planInsight.topNode.latencyMs.toFixed(1)} ms
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] font-semibold text-white mt-0.5">
                                  {planInsight.topNode.nodeType}
                                </div>
                                <p className="text-[10px] text-zinc-300 mt-1 leading-snug">
                                  {planInsight.topNode.explanation}
                                </p>
                              </div>
                            </div>

                            {/* Stacked Latency Contribution Visual Bar */}
                            <div className="mb-3 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                                <span>Plan Node Cost Distribution</span>
                                <span>100% of execution</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800 gap-0.5">
                                {planInsight.nodes.map((node) => (
                                  <div
                                    key={node.id}
                                    style={{ width: `${Math.max(node.percentage, 3)}%` }}
                                    className={`h-full ${node.barColor} transition-all`}
                                    title={`${node.nodeType}: ${node.latencyMs.toFixed(1)}ms (${node.percentage.toFixed(0)}%)`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Contributing Plan Nodes List (Ranked) */}
                            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
                              <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center justify-between">
                                <span>Specific Plan Nodes</span>
                                <span>Latency / Share</span>
                              </div>
                              {planInsight.nodes.map((node, nIdx) => (
                                <div
                                  key={node.id}
                                  className={`p-2 rounded-lg border text-[11px] flex flex-col gap-1 transition-colors ${
                                    node.severity === 'critical'
                                      ? 'bg-rose-950/20 border-rose-900/60'
                                      : node.severity === 'warning'
                                      ? 'bg-amber-950/20 border-amber-900/60'
                                      : 'bg-zinc-900/80 border-zinc-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${node.barColor}`} />
                                      <span className="font-mono font-bold text-zinc-200 truncate">
                                        #{nIdx + 1} {node.nodeType}
                                      </span>
                                    </div>
                                    <div className="font-mono font-bold shrink-0 flex items-center gap-1.5">
                                      <span className="text-zinc-100">{node.latencyMs.toFixed(1)}ms</span>
                                      <span className={`px-1 py-0.2 rounded text-[9px] ${
                                        node.severity === 'critical'
                                          ? 'bg-rose-900/80 text-rose-200'
                                          : node.severity === 'warning'
                                          ? 'bg-amber-900/80 text-amber-200'
                                          : 'bg-emerald-900/80 text-emerald-200'
                                      }`}>
                                        {node.percentage.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                                    <span className="font-mono text-zinc-500">rel: {node.relationName}</span>
                                    <span className="text-zinc-400 italic text-[10px]">{node.mechanics}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Optimization Insight Recommendation Footer */}
                            <div className="pt-2 border-t border-zinc-800 text-[11px] flex items-start gap-1.5 text-zinc-300">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-zinc-400 font-semibold">Tuning Guidance: </span>
                                <span className="text-zinc-200">{planInsight.recommendation}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Customer Info */}
                      <div className="col-span-3 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-zinc-900 truncate">
                            {rec.customerName}
                          </span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${getTierColor(
                              rec.customerTier
                            )}`}
                          >
                            {rec.customerTier}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          {rec.customerEmail}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="col-span-2 text-zinc-600 truncate">
                        {rec.category}
                        <div className="text-[10px] text-zinc-400">{rec.region}</div>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">{getStatusBadge(rec.status)}</div>

                      {/* Amount */}
                      <div className="col-span-2 text-right">
                        <span className="font-semibold text-zinc-900">
                          ${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-zinc-400 font-mono">USD</div>
                      </div>

                      {/* Item Count & Inline Sparkline */}
                      <div className="col-span-1 text-center flex flex-col items-center justify-center">
                        <span
                          className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-mono ${heatmapBadgeClass}`}
                          title={
                            !safeFlags.batchEagerLoading
                              ? `N+1 Latency Impact: ~${nPlusOneLatencyMs.toFixed(1)}ms (${recordItemCount} subqueries)`
                              : `Item Count: ${recordItemCount} (Batched)`
                          }
                        >
                          {recordItemCount} items
                        </span>
                        <div className="mt-0.5" title="Historical latency fluctuations over last 10 fetch operations">
                          {renderInlineSparkline(
                            getRowSparklinePoints(rec.id, nPlusOneLatencyMs, !safeFlags.batchEagerLoading),
                            48,
                            16,
                            !safeFlags.batchEagerLoading && nPlusOneLatencyMs > 150 ? '#e11d48' : !safeFlags.batchEagerLoading ? '#d97706' : '#059669'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Child Line Items (Proof of Eager Loading) */}
                    {isExpanded && rec.items && (
                      <div
                        className={`px-6 py-3 border-b transition-colors ${
                          isSelected ? 'bg-emerald-50/50 border-emerald-200' : 'bg-zinc-50/90 border-zinc-200'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-zinc-600 mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Order Line Items ({rec.items.length}) — Fetched via {safeFlags.batchEagerLoading ? 'Batch Eager Join (Optimized)' : 'N+1 Subquery (Slow)'}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {rec.items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white p-2.5 rounded-lg border border-zinc-200 text-xs shadow-2xs"
                            >
                              <div className="font-medium text-zinc-900 truncate">
                                {item.name}
                              </div>
                              <div className="flex items-center justify-between text-zinc-500 text-[11px] mt-1">
                                <span className="font-mono">{item.sku}</span>
                                <span>
                                  {item.quantity} × ${item.unitPrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Table Footer Telemetry & Info */}
      <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 gap-2">
        <div>
          Showing{' '}
          <span className="font-semibold text-zinc-800">
            {displayRecords.length > 0 ? startIndex + 1 : 0} -{' '}
            {Math.min(startIndex + visibleRecords.length, showSelectedOnly ? displayRecords.length : totalCount)}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-zinc-800">
            {showSelectedOnly ? displayRecords.length.toLocaleString() : totalCount.toLocaleString()}
          </span>{' '}
          {showSelectedOnly ? 'selected records' : 'matching transactions'}{' '}
          {showSelectedOnly ? '(filtered to review selection)' : '(from 50,000 DB records)'}
          {selectedVisibleCount > 0 && (
            <span
              id="footer-selected-counter"
              className="ml-2 font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1"
            >
              <CheckSquare className="w-3 h-3 text-emerald-600" />
              <span>{selectedVisibleCount} selected</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Pagination Controls */}
          {onPageChange && (
            <div className="flex items-center gap-1.5 bg-white border border-zinc-200 px-2 py-1 rounded-lg text-xs shadow-2xs">
              <button
                type="button"
                id="btn-prev-page"
                data-testid="btn-prev-page"
                disabled={(page || 1) <= 1 || isHeavyLoading}
                onClick={() => {
                  const newP = Math.max(1, (page || 1) - 1);
                  if (ghostRowsEnabled) {
                    triggerHeavyLoadingSimulation(500, `Loading page ${newP} records...`);
                  }
                  onPageChange(newP);
                }}
                className="px-2 py-0.5 rounded text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer font-bold transition-colors"
                title="Previous page"
              >
                ← Prev
              </button>
              <span className="font-mono font-bold text-zinc-800 px-1">
                Page {page || 1} of {Math.max(1, Math.ceil((totalCount || 50000) / pageSize))}
              </span>
              <button
                type="button"
                id="btn-next-page"
                data-testid="btn-next-page"
                disabled={(page || 1) >= Math.ceil((totalCount || 50000) / pageSize) || isHeavyLoading}
                onClick={() => {
                  const newP = (page || 1) + 1;
                  if (ghostRowsEnabled) {
                    triggerHeavyLoadingSimulation(500, `Loading page ${newP} records...`);
                  }
                  onPageChange(newP);
                }}
                className="px-2 py-0.5 rounded text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer font-bold transition-colors"
                title="Next page"
              >
                Next →
              </button>
            </div>
          )}

          <span
            id="badge-ghost-row-footer-indicator"
            data-testid="badge-ghost-row-footer-indicator"
            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              isHeavyLoading
                ? 'bg-purple-100 text-purple-900 border-purple-300 animate-pulse font-bold'
                : ghostRowsEnabled
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
            }`}
            title="Ghost Rows: Faded placeholder skeletons for perceived performance during heavy dataset queries"
          >
            Ghost Placeholders: {isHeavyLoading ? 'Rendering...' : ghostRowsEnabled ? 'Active' : 'Off'}
          </span>

          <span className="flex items-center gap-1 text-zinc-600">
            <span
              className={`w-2 h-2 rounded-full ${
                safeFlags.virtualizedDOM ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
              }`}
            />
            {safeFlags.virtualizedDOM
              ? 'DOM Windowing Active (15 Nodes)'
              : `Rendering All ${records.length} Nodes in DOM (High Lag)`}
          </span>
        </div>
      </div>

      {/* 'Are you sure?' Batch Delete Confirmation Overlay */}
      <DeleteConfirmationOverlay
        isOpen={isDeleteConfirmationOpen}
        onClose={() => setIsDeleteConfirmationOpen(false)}
        onConfirm={handleConfirmBatchDelete}
        selectedRecords={records.filter((r) => selectedRowIds.has(r.id))}
        totalDatabaseRecords={totalCount}
      />

      {/* Compare Latency Modal */}
      <CompareLatencyModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        initialFlags={safeFlags}
      />

      {/* Latency Distribution Histogram Modal */}
      <LatencyDistributionModal
        isOpen={isLatencyDistModalOpen}
        onClose={() => setIsLatencyDistModalOpen(false)}
        records={records}
        flags={safeFlags}
      />

      {/* Search History Drawer (Records last 10 unique searches, single-click re-run) */}
      <SearchHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        searchHistory={searchHistory}
        currentSearch={currentSearchTerm}
        onSelectQuery={handleApplySearchHistory}
        onRemoveQuery={handleRemoveSearchHistory}
        onClearHistory={handleClearSearchHistory}
        onSaveCurrentQuery={handleRecordSearchQuery}
      />

      {/* Query Replay Drawer (Records & playbacks searches to analyze degradation) */}
      <QueryReplayDrawer
        isOpen={isQueryReplayDrawerOpen}
        onClose={() => setIsQueryReplayDrawerOpen(false)}
        currentSearch={currentSearchTerm}
        onApplyQuery={(q) => {
          onSearchChange?.(q);
        }}
        flags={safeFlags}
        records={records}
        isRecording={isReplayRecording}
        onStartRecording={handleStartReplayRecording}
        onStopRecording={handleStopReplayRecording}
        recordedSteps={recordedReplaySteps}
        onClearRecording={() => setRecordedReplaySteps([])}
        onAddRecordedStep={handleAddRecordedStep}
        activeSequence={activeReplaySequence}
        onSelectSequence={(seq) => {
          setActiveReplaySequence(seq);
          setReplayPlaybackIndex(0);
          if (seq.steps[0] && onSearchChange) {
            onSearchChange(seq.steps[0].query);
          }
        }}
        currentPlaybackStepIndex={replayPlaybackIndex}
        onSeekStepIndex={handleSeekReplayStep}
        isPlaying={isReplayPlaying}
        onTogglePlay={handleToggleReplayPlay}
        playbackSpeed={replaySpeed}
        onChangePlaybackSpeed={(spd) => setReplaySpeed(spd)}
      />

      {/* Side-by-Side Performance Diff Modal */}
      <CompareLatencyModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        initialFlags={safeFlags}
      />

      {/* Row Execution Metrics Inspection Modal */}
      {selectedMetricsRecord && (() => {
        const breakdown = computeRowLatencyBreakdown(selectedMetricsRecord);
        const isCached = selectedMetricsRecord.status === 'completed' || breakdown.effectiveLatencyMs < 35;
        return (
          <div
            id="row-execution-metrics-modal"
            data-testid="row-execution-metrics-modal"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn font-sans"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-zinc-200 animate-scaleUp">
              <div className="p-5 bg-gradient-to-r from-zinc-900 to-indigo-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <span>Row Execution Metrics: {selectedMetricsRecord.orderNumber}</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Detailed diagnostic telemetry &amp; latency contribution for order ID {selectedMetricsRecord.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-close-row-metrics-modal"
                  data-testid="btn-close-row-metrics-modal"
                  onClick={() => setSelectedMetricsRecord(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Customer</div>
                    <div className="font-semibold text-zinc-900 mt-0.5">{selectedMetricsRecord.customerName}</div>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Status / Category</div>
                    <div className="font-semibold text-zinc-900 mt-0.5">{selectedMetricsRecord.status} ({selectedMetricsRecord.category})</div>
                  </div>
                </div>

                {/* Cached vs Disk Status Banner */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  isCached
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}>
                  <div className={`p-2 rounded-lg ${isCached ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span>{isCached ? '🟢 Buffer Pool Cache Hit (Memory L1/L2)' : '💾 Physical Disk I/O Read (Heap / Index Scan)'}</span>
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">
                      {isCached
                        ? 'Record data was served directly from shared_buffers memory cache without disk seek overhead.'
                        : 'Required physical random I/O read from block storage / NVMe disk tier.'}
                    </p>
                  </div>
                </div>

                {/* Latency Contribution Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Latency Contribution Breakdown</h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                    <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200">
                      <div className="text-[10px] uppercase font-semibold text-indigo-700">Total</div>
                      <div className="font-extrabold text-indigo-900 text-sm mt-0.5">{breakdown.effectiveLatencyMs.toFixed(1)}ms</div>
                    </div>
                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                      <div className="text-[10px] uppercase font-semibold text-rose-700">Fetch</div>
                      <div className="font-extrabold text-rose-900 text-sm mt-0.5">{breakdown.dataFetchMs.toFixed(1)}ms</div>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="text-[10px] uppercase font-semibold text-amber-700">Render</div>
                      <div className="font-extrabold text-amber-900 text-sm mt-0.5">{breakdown.rowRenderMs.toFixed(1)}ms</div>
                    </div>
                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="text-[10px] uppercase font-semibold text-purple-700">DOM</div>
                      <div className="font-extrabold text-purple-900 text-sm mt-0.5">{breakdown.domHydrationMs.toFixed(1)}ms</div>
                    </div>
                  </div>
                </div>

                {/* Additional Properties */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-zinc-800 uppercase tracking-wider">Execution Diagnostics</h4>
                  <div className="p-3 bg-zinc-900 text-zinc-200 rounded-xl font-mono text-[11px] space-y-1">
                    <div>Record ID: {selectedMetricsRecord.id}</div>
                    <div>Amount USD: ${selectedMetricsRecord.amount?.toLocaleString()}</div>
                    <div>Line Items Count: {breakdown.recordItemCount} items</div>
                    <div>Batch Eager Loading: {safeFlags.batchEagerLoading ? 'Enabled' : 'Disabled (N+1 Risk)'}</div>
                    <div>B-Tree Indexing: {safeFlags.btreeIndexing ? 'Active (Index Scan)' : 'Inactive (Seq Scan)'}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify({ record: selectedMetricsRecord, breakdown, isCached, flags: safeFlags }, null, 2)], { type: 'application/json' });
                    triggerFileDownload(blob, `row-execution-metrics-${selectedMetricsRecord.orderNumber}.json`);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Row JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMetricsRecord(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 'Back to Top' Floating Action Button */}
      {scrollTop > ROW_HEIGHT * 20 && (
        <button
          type="button"
          id="btn-back-to-top"
          data-testid="btn-back-to-top"
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setScrollTop(0);
          }}
          className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-full shadow-xl font-semibold text-xs transition-all animate-fadeIn cursor-pointer ring-2 ring-white/80"
          title="Scroll back to top of table header"
          aria-label="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 animate-bounce" />
          <span>Back to Top</span>
        </button>
      )}
    </div>
  );
};
