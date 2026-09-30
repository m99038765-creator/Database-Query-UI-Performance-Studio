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
  BarChart2
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
}

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

const ROW_HEIGHT = 56;
const CONTAINER_HEIGHT = 520;

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
  onToggleLatencyHeatmap
}) => {
  const safeFlags: OptimizationFlags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: virtualizedEnabled !== undefined ? virtualizedEnabled : true,
    deferredRendering: true,
    ...(flags || {})
  };

  const currentSearchTerm = searchTerm ?? searchQuery ?? '';
  const currentCategory = (categoryFilter ?? selectedCategory ?? 'all') as ProductCategory | 'all';
  const currentStatus = (statusFilter ?? 'all') as OrderStatus | 'all';

  const [scrollTop, setScrollTop] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<ExportPerformanceResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalFormat, setInternalFormat] = useState<ExportFormat>(selectedExportFormat);
  const activeFormat = selectedExportFormat || internalFormat;
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const activeExporting = isExportingProp ?? isExporting;

  // Selection & Batch Operations State
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isLatencyDistModalOpen, setIsLatencyDistModalOpen] = useState(false);
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

  // Minimum Latency Filter Slider State (isolates performance-heavy records)
  const [minLatencyFilterMs, setMinLatencyFilterMs] = useState<number>(0);

  // Email & Latency Threshold Alert State
  const [alertThresholdMs, setAlertThresholdMs] = useState<number>(100);
  const [emailAlertEnabled, setEmailAlertEnabled] = useState<boolean>(true);
  const [alertEmail, setAlertEmail] = useState<string>('db-admin@enterprise-db.io');
  const [hasSentAlertEmail, setHasSentAlertEmail] = useState<boolean>(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);

  // 'Show Selected Only' toggle state for reviewing batch selections
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Automatically turn off 'Show Selected Only' if all selected rows are cleared
  useEffect(() => {
    if (selectedRowIds.size === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [selectedRowIds.size, showSelectedOnly]);

  // Filter records by selected rows and/or latency threshold filter
  const displayRecords = useMemo(() => {
    let list = records;
    if (showSelectedOnly) {
      list = list.filter((r) => selectedRowIds.has(r.id));
    }
    if (!safeFlags.batchEagerLoading && minLatencyFilterMs > 0) {
      list = list.filter((r) => {
        const itemCnt = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
        const unoptMult = 45.0;
        const idxPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
        const latencyMs = 20.0 + (itemCnt * unoptMult) + idxPenalty;
        return latencyMs >= minLatencyFilterMs;
      });
    }
    return list;
  }, [records, showSelectedOnly, selectedRowIds, minLatencyFilterMs, safeFlags.batchEagerLoading, safeFlags.btreeIndexing]);

  // Rolling Z-scores and anomaly detection service for displayed records
  const anomalyMap = useMemo(() => {
    return calculateRollingZScores(displayRecords);
  }, [displayRecords]);

  // Average table latency across displayed records
  const averageTableLatencyMs = useMemo(() => {
    if (displayRecords.length === 0) return 0;
    let total = 0;
    for (const r of displayRecords) {
      const itemCnt = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      const unoptMult = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
      const idxPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
      const latencyMs = safeFlags.batchEagerLoading ? (itemCnt * 4.0 + 10.0) : (20.0 + (itemCnt * unoptMult) + idxPenalty);
      total += latencyMs;
    }
    return total / displayRecords.length;
  }, [displayRecords, safeFlags.batchEagerLoading, safeFlags.btreeIndexing]);

  // Query execution cost bounds for relative heatmap shading across displayed records
  const { minRowCost, maxRowCost } = useMemo(() => {
    if (displayRecords.length === 0) return { minRowCost: 10, maxRowCost: 50 };
    let min = Infinity;
    let max = -Infinity;
    for (const r of displayRecords) {
      const itemCnt = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      const unoptMult = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
      const idxPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
      const cost = safeFlags.batchEagerLoading ? (itemCnt * 4.0 + 10.0) : (20.0 + (itemCnt * unoptMult) + idxPenalty);
      if (cost < min) min = cost;
      if (cost > max) max = cost;
    }
    return {
      minRowCost: min === Infinity ? 10 : min,
      maxRowCost: max === -Infinity ? 50 : Math.max(max, min + 1)
    };
  }, [displayRecords, safeFlags.batchEagerLoading, safeFlags.btreeIndexing]);

  const handleExportHeatmapCsv = () => {
    const csvRows: string[] = [];
    csvRows.push('OrderNumber,CreatedAt,CustomerName,CustomerTier,Category,Region,Status,AmountUSD,ItemCount,FetchLatencyMs,SeverityImpact,BatchEagerLoading,BTreeIndexing');
    
    for (const r of displayRecords) {
      const itemCnt = r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      const unoptMult = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
      const idxPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
      const latencyMs = safeFlags.batchEagerLoading ? (itemCnt * 4.0 + 10.0) : (20.0 + (itemCnt * unoptMult) + idxPenalty);
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
        itemCnt,
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
    setScrollTop(e.currentTarget.scrollTop);
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

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
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

      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-transactions"
            type="text"
            value={currentSearchTerm}
            onChange={handleInputChange}
            placeholder="Search by order #, customer, or email..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
          />
          {!safeFlags.deferredRendering && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
              Sync Blocking
            </span>
          )}
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
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1,000 rows (Heavy)</option>
            </select>
          </div>

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

          {/* Main Header Toggle Switch for Real-Time Execution Cost Heatmap Overlay */}
          <label
            id="main-header-toggle-latency-heatmap"
            data-testid="toggle-execution-cost-heatmap"
            htmlFor="main-header-toggle-heatmap-input"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all border shadow-2xs select-none ${
              showLatencyHeatmap
                ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400/40'
                : 'bg-zinc-100 hover:bg-zinc-200/70 border-zinc-300 text-zinc-700'
            }`}
            title="Enable or disable the real-time query execution cost heatmap overlay across table rows"
          >
            <input
              id="main-header-toggle-heatmap-input"
              data-testid="main-header-toggle-heatmap-input"
              type="checkbox"
              checked={showLatencyHeatmap}
              onChange={(e) => setShowLatencyHeatmap(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500/30 accent-rose-600 cursor-pointer"
            />
            <Flame className={`w-3.5 h-3.5 ${showLatencyHeatmap ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
            <span>Cost Heatmap</span>
          </label>

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

            {/* Toggle Heatmap Overlay */}
            <label
              id="label-toggle-latency-heatmap"
              htmlFor="toggle-latency-heatmap"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white hover:bg-zinc-50 border border-rose-300 text-zinc-800 font-medium cursor-pointer transition-colors shadow-2xs select-none"
            >
              <input
                id="toggle-latency-heatmap"
                data-testid="toggle-latency-heatmap"
                type="checkbox"
                checked={showLatencyHeatmap}
                onChange={(e) => setShowLatencyHeatmap(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500/30 accent-rose-600 cursor-pointer shrink-0"
              />
              <span className="font-semibold text-rose-950">Heatmap</span>
            </label>
          </div>
        </div>
      )}

      {/* Heatmap Legend Display */}
      {showLatencyHeatmap && (
        <div className="bg-gradient-to-r from-zinc-50 via-zinc-100 to-rose-50/40 border-b border-zinc-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-700 animate-fadeIn">
          <div className="flex items-center gap-2 font-semibold">
            <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>Heatmap Intensity Legend:</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
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

      {/* Table Header */}
      <div
        id="table-column-header"
        data-testid="table-column-header"
        className="grid grid-cols-12 px-4 py-3 bg-zinc-100/80 border-b border-zinc-200 text-xs font-semibold text-zinc-600 select-none items-center"
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
        <div className="col-span-2 flex items-center gap-2">
          <span>Order ID</span>
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
        <div className="col-span-3">Customer &amp; Account</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1">Status</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-1 text-center flex items-center justify-center gap-1">
          <span>Items</span>
          <button
            type="button"
            id="btn-header-cost-heatmap-toggle"
            data-testid="btn-header-cost-heatmap-toggle"
            onClick={() => setShowLatencyHeatmap(!showLatencyHeatmap)}
            className={`p-0.5 rounded transition-colors cursor-pointer ${
              showLatencyHeatmap
                ? 'text-rose-600 hover:bg-rose-100/50'
                : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200'
            }`}
            title={`Execution Cost Heatmap: ${showLatencyHeatmap ? 'Active (Click to hide)' : 'Inactive (Click to show)'}`}
            aria-label="Toggle Execution Cost Heatmap"
          >
            <Flame className={`w-3.5 h-3.5 ${showLatencyHeatmap ? 'text-rose-600 animate-pulse' : 'text-zinc-400'}`} />
          </button>
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

      {/* Scrollable Table Viewport */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{ height: `${CONTAINER_HEIGHT}px` }}
        className="overflow-y-auto relative divide-y divide-zinc-100"
      >
        {displayRecords.length === 0 ? (
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

                const anomalyData = anomalyMap.get(rec.id);
                const isStatisticalOutlier = anomalyData ? anomalyData.isOutlier : false;
                const zScoreVal = anomalyData ? anomalyData.zScore : 0;

                const recordItemCount = rec.items && rec.items.length > 0 ? rec.items.length : (rec.itemCount || 1);
                const unoptimizedMultiplier = (!safeFlags.batchEagerLoading) ? 45.0 : 8.0;
                const indexPenalty = (!safeFlags.btreeIndexing) ? 55.0 : 0.0;
                const nPlusOneLatencyMs = safeFlags.batchEagerLoading 
                  ? (recordItemCount * 4.0 + 10.0) 
                  : (20.0 + (recordItemCount * unoptimizedMultiplier) + indexPenalty);
                
                let heatmapRowBg = '';
                let heatmapRowStyle: React.CSSProperties = { minHeight: `${ROW_HEIGHT}px` };
                let heatmapBadgeClass = '';
                let isHighCost = false;
                let isModerateCost = false;
                let relativeCostRatio = 0;

                if (showLatencyHeatmap) {
                  const range = Math.max(maxRowCost - minRowCost, 1);
                  relativeCostRatio = Math.max(0, Math.min(1, (nPlusOneLatencyMs - minRowCost) / range));
                  isHighCost = isStatisticalOutlier || nPlusOneLatencyMs > 150 || (relativeCostRatio >= 0.75 && nPlusOneLatencyMs > 40);
                  isModerateCost = !isHighCost && (nPlusOneLatencyMs >= 50 || relativeCostRatio >= 0.4);

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
                      onClick={() => toggleExpand(rec.id)}
                      title={
                        showLatencyHeatmap
                          ? `Database Fetch Latency: ${nPlusOneLatencyMs.toFixed(1)}ms | Relative Query Cost: ${Math.round(relativeCostRatio * 100)}% (Z-score: ${zScoreVal.toFixed(2)}σ)`
                          : undefined
                      }
                      className={`grid grid-cols-12 px-4 py-3 items-center text-xs transition-colors cursor-pointer border-b relative group ${heatmapRowBg}`}
                      style={heatmapRowStyle}
                    >
                      {/* Row Hover Latency & Z-Score Anomaly Tooltip */}
                      {showLatencyHeatmap && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg shadow-xl text-[11px] font-mono z-30 pointer-events-none border border-zinc-700 animate-fadeIn">
                          <Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
                          <span>Fetch Latency: <strong className="text-rose-300 font-bold">{nPlusOneLatencyMs.toFixed(1)}ms</strong></span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isHighCost
                              ? 'bg-rose-950 text-rose-300 border border-rose-500'
                              : isModerateCost
                              ? 'bg-amber-950 text-amber-300 border border-amber-500'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                          }`}>
                            Cost: {Math.round(relativeCostRatio * 100)}%
                          </span>
                          {isHighCost && (
                            <span className="bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider">
                              Expensive Record
                            </span>
                          )}
                          {isStatisticalOutlier && (
                            <span className="bg-rose-950 text-rose-300 border border-rose-500 px-1.5 py-0.5 rounded font-bold text-[10px]">
                              🚨 Outlier (Z = {zScoreVal > 0 ? `+${zScoreVal.toFixed(2)}` : zScoreVal.toFixed(2)}σ)
                            </span>
                          )}
                          <span className="text-zinc-400 text-[10px]">({recordItemCount} queries)</span>
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
                        <span
                          className={`font-mono text-[11px] select-none ${
                            isSelected ? 'text-emerald-800 font-semibold' : 'text-zinc-400'
                          }`}
                        >
                          {actualIndex}
                        </span>
                      </div>

                      {/* Order Number */}
                      <div className="col-span-2">
                        <span
                          className={`font-mono font-medium ${
                            isSelected ? 'text-emerald-950 font-semibold' : 'text-zinc-900'
                          }`}
                        >
                          {rec.orderNumber}
                        </span>
                        <div className={`text-[10px] ${isSelected ? 'text-emerald-700/70' : 'text-zinc-400'}`}>
                          {rec.createdAt}
                        </div>
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

        <div className="flex items-center gap-3">
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
    </div>
  );
};
