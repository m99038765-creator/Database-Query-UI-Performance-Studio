import React, { useState, useRef, useMemo, useDeferredValue } from 'react';
import {
  TransactionRecord,
  OptimizationFlags,
  OrderStatus,
  ProductCategory
} from '../types';
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
  Check,
  UploadCloud
} from 'lucide-react';
import {
  exportRecordsToCsv,
  triggerFileDownload,
  ExportPerformanceResult
} from '../utils/csvExporter';
import { CpuPerformanceGlowBadge } from './CpuPerformanceGlowBadge';

interface VirtualizedTableProps {
  records: TransactionRecord[];
  totalCount: number;
  flags: OptimizationFlags;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: OrderStatus | 'all';
  onStatusChange: (val: OrderStatus | 'all') => void;
  categoryFilter: ProductCategory | 'all';
  onCategoryChange: (val: ProductCategory | 'all') => void;
  pageSize: number;
  onPageSizeChange: (val: number) => void;
  onFixNPlusOne: () => void;
  simulatedError: string | null;
  warningNotice: string | null;
  onOpenBulkImport?: () => void;
  onExportComplete?: (stats: ExportPerformanceResult) => void;
}

const ROW_HEIGHT = 56;
const CONTAINER_HEIGHT = 520;

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  records,
  totalCount,
  flags,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  pageSize,
  onPageSizeChange,
  onFixNPlusOne,
  simulatedError,
  warningNotice,
  onOpenBulkImport,
  onExportComplete
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<ExportPerformanceResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExportCsv = () => {
    if (records.length === 0 || isExporting) return;
    setIsExporting(true);
    
    // Allow React to paint the loading state if exporting large datasets
    setTimeout(() => {
      try {
        const { blob, filename, stats } = exportRecordsToCsv(records);
        triggerFileDownload(blob, filename);
        setExportStats(stats);
        onExportComplete?.(stats);
      } catch (err) {
        console.error('Failed to export CSV:', err);
      } finally {
        setIsExporting(false);
      }
    }, 10);
  };

  // React 19 useDeferredValue for non-blocking search
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // If deferred rendering is off, simulate synchronous typing stall
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!flags.deferredRendering && val.length > 2) {
      // Simulate heavy synchronous blocking thread work on keypress
      const start = performance.now();
      while (performance.now() - start < 45) {
        // block main thread to emulate heavy unoptimized UI lag
      }
    }
    onSearchChange(val);
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calculate visible window slice if virtualizedDOM is enabled
  const { visibleRecords, startIndex, offsetY } = useMemo(() => {
    if (!flags.virtualizedDOM) {
      // Unoptimized: Render ALL records into the DOM!
      return {
        visibleRecords: records,
        startIndex: 0,
        offsetY: 0
      };
    }

    // Optimized: Virtualized Windowing
    const visibleCount = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT);
    const buffer = 4; // overscan
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer);
    const end = Math.min(records.length, start + visibleCount + buffer * 2);

    const slice = records.slice(start, end);
    const offset = start * ROW_HEIGHT;

    return {
      visibleRecords: slice,
      startIndex: start,
      offsetY: offset
    };
  }, [records, scrollTop, flags.virtualizedDOM]);

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
      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-transactions"
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Search by order #, customer, or email..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
          />
          {!flags.deferredRendering && (
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
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as OrderStatus | 'all')}
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
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value as ProductCategory | 'all')}
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

          {/* Export CSV Button */}
          <button
            id="btn-export-csv"
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting || records.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-md text-xs font-medium transition-colors shadow-xs ml-auto sm:ml-0 cursor-pointer disabled:cursor-not-allowed"
            title="Export currently filtered table records as a CSV file"
          >
            {isExporting ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-zinc-300" />
                <span>Export CSV</span>
                <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded text-[10px] font-mono">
                  {records.length}
                </span>
              </>
            )}
          </button>
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
      {!flags.btreeIndexing && warningNotice && !simulatedError && (
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

      {/* Table Header */}
      <div className="grid grid-cols-12 px-4 py-3 bg-zinc-100/70 border-b border-zinc-200 text-xs font-semibold text-zinc-600 select-none">
        <div className="col-span-1 flex items-center">#</div>
        <div className="col-span-2">Order ID</div>
        <div className="col-span-3">Customer &amp; Account</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1">Status</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-1 text-center">Items</div>
      </div>

      {/* Scrollable Table Viewport */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{ height: `${CONTAINER_HEIGHT}px` }}
        className="overflow-y-auto relative divide-y divide-zinc-100"
      >
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
            <Package className="w-10 h-10 text-zinc-300 mb-2" />
            <p className="text-sm font-medium text-zinc-700">No records found</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Try adjusting your search criteria or filter selections
            </p>
          </div>
        ) : (
          <div
            style={{
              height: flags.virtualizedDOM ? `${records.length * ROW_HEIGHT}px` : 'auto',
              position: 'relative'
            }}
          >
            <div
              style={{
                transform: flags.virtualizedDOM ? `translateY(${offsetY}px)` : 'none',
                position: flags.virtualizedDOM ? 'absolute' : 'relative',
                top: 0,
                left: 0,
                right: 0
              }}
            >
              {visibleRecords.map((rec, index) => {
                const actualIndex = flags.virtualizedDOM ? startIndex + index + 1 : index + 1;
                const isExpanded = expandedRowId === rec.id;

                return (
                  <React.Fragment key={rec.id}>
                    <div
                      id={`row-${rec.id}`}
                      onClick={() => toggleExpand(rec.id)}
                      className={`grid grid-cols-12 px-4 py-3 items-center text-xs hover:bg-zinc-50/80 transition-colors cursor-pointer border-b border-zinc-100 ${
                        isExpanded ? 'bg-zinc-50 font-medium' : ''
                      }`}
                      style={{ minHeight: `${ROW_HEIGHT}px` }}
                    >
                      {/* Index & Expand arrow */}
                      <div className="col-span-1 flex items-center gap-1 text-zinc-400">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span className="font-mono text-[11px]">{actualIndex}</span>
                      </div>

                      {/* Order Number */}
                      <div className="col-span-2">
                        <span className="font-mono font-medium text-zinc-900">
                          {rec.orderNumber}
                        </span>
                        <div className="text-[10px] text-zinc-400">{rec.createdAt}</div>
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

                      {/* Item Count */}
                      <div className="col-span-1 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 font-semibold text-xs">
                          {rec.itemCount}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Child Line Items (Proof of Eager Loading) */}
                    {isExpanded && rec.items && (
                      <div className="bg-zinc-50/90 px-6 py-3 border-b border-zinc-200">
                        <div className="text-[11px] font-semibold text-zinc-600 mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Order Line Items ({rec.items.length}) — Fetched via {flags.batchEagerLoading ? 'Batch Eager Join (Optimized)' : 'N+1 Subquery (Slow)'}</span>
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
            {records.length > 0 ? startIndex + 1 : 0} -{' '}
            {Math.min(startIndex + visibleRecords.length, totalCount)}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-zinc-800">
            {totalCount.toLocaleString()}
          </span>{' '}
          matching transactions (from 50,000 DB records)
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-zinc-600">
            <span
              className={`w-2 h-2 rounded-full ${
                flags.virtualizedDOM ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
              }`}
            />
            {flags.virtualizedDOM
              ? 'DOM Windowing Active (15 Nodes)'
              : `Rendering All ${records.length} Nodes in DOM (High Lag)`}
          </span>
        </div>
      </div>
    </div>
  );
};
