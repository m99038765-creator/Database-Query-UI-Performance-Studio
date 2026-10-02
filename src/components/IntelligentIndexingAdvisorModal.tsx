import React, { useState, useMemo } from 'react';
import {
  Compass,
  Sparkles,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Zap,
  Database,
  Search,
  Filter,
  ArrowRight,
  Clock,
  TrendingDown,
  TrendingUp,
  Code,
  FileCode,
  Terminal,
  ShieldCheck,
  X,
  RefreshCw,
  Play,
  RotateCcw,
  CheckSquare
} from 'lucide-react';
import { OptimizationFlags } from '../types';

export interface CoveringIndexPatch {
  id: string;
  patternTitle: string;
  targetTable: string;
  workloadSharePct: number;
  workloadQpm: number;
  querySql: string;
  indexName: string;
  keyColumns: string[];
  includeColumns: string[];
  ddlStatement: string;
  whyNeeded: string;
  currentScanType: string;
  currentCost: number;
  currentLatencyMs: number;
  currentHeapFetches: string;
  projectedScanType: string;
  projectedCost: number;
  projectedLatencyMs: number;
  projectedHeapFetches: string;
  speedupPct: number;
  estimatedDiskMb: number;
  workloadCategory: 'filter-sort' | 'join-eager' | 'text-search' | 'analytics';
}

export const COVERING_INDEX_CATALOG: CoveringIndexPatch[] = [
  {
    id: 'patch-cov-trans-status-cat-created',
    patternTitle: 'Pattern #1: Transactions Filter & Descending Sort Hotpath',
    targetTable: 'transactions',
    workloadSharePct: 46.8,
    workloadQpm: 14200,
    querySql: `SELECT id, order_number, customer_name, amount, status
FROM transactions
WHERE status = 'completed' AND category = 'Cloud Infrastructure'
ORDER BY created_at DESC
LIMIT 50;`,
    indexName: 'idx_cov_trans_status_cat_created',
    keyColumns: ['status', 'category', 'created_at DESC'],
    includeColumns: ['amount', 'customer_name', 'order_number', 'id'],
    ddlStatement: `CREATE INDEX CONCURRENTLY idx_cov_trans_status_cat_created
ON transactions (status, category, created_at DESC)
INCLUDE (amount, customer_name, order_number, id);`,
    whyNeeded: 'The WHERE clause filters on (status, category) and sorts by created_at DESC, while the SELECT projection requires amount, customer_name, and order_number. Without an INCLUDE clause, every matching row forces a random heap page fetch to disk to retrieve unindexed columns. Adding INCLUDE embeds projection attributes directly into B-Tree leaf pages, enabling a zero-heap Index-Only Scan.',
    currentScanType: 'Seq Scan (50,000 Rows Scanned)',
    currentCost: 48.50,
    currentLatencyMs: 24.0,
    currentHeapFetches: '45,000 blocks',
    projectedScanType: 'Index-Only Scan (Zero-Heap B-Tree)',
    projectedCost: 1.15,
    projectedLatencyMs: 0.78,
    projectedHeapFetches: '0 blocks (Cache Hit)',
    speedupPct: 96.8,
    estimatedDiskMb: 3.8,
    workloadCategory: 'filter-sort'
  },
  {
    id: 'patch-cov-order-items-fk-eager',
    patternTitle: 'Pattern #2: Child Line Items Eager Loading (N+1 Elimination)',
    targetTable: 'order_items',
    workloadSharePct: 31.7,
    workloadQpm: 9600,
    querySql: `SELECT id, order_id, sku, name, unit_price, quantity
FROM order_items
WHERE order_id IN ($1, $2, $3, ... $50)
ORDER BY id ASC;`,
    indexName: 'idx_cov_order_items_order_id_details',
    keyColumns: ['order_id', 'id ASC'],
    includeColumns: ['sku', 'name', 'unit_price', 'quantity'],
    ddlStatement: `CREATE INDEX CONCURRENTLY idx_cov_order_items_order_id_details
ON order_items (order_id, id ASC)
INCLUDE (sku, name, unit_price, quantity);`,
    whyNeeded: 'Parent transaction batched queries join line items by order_id. Without a covering foreign key index, child item lookups perform sequential table scans or secondary heap rechecks for sku and unit_price. Embedding line item columns in the index payload satisfies the entire eager loading batch in a single memory seek.',
    currentScanType: 'Seq Scan on order_items (Cascading)',
    currentCost: 25.40,
    currentLatencyMs: 18.2,
    currentHeapFetches: '25,000 blocks',
    projectedScanType: 'Index-Only Scan (Covering Foreign Key)',
    projectedCost: 0.65,
    projectedLatencyMs: 0.32,
    projectedHeapFetches: '0 blocks (Cache Hit)',
    speedupPct: 98.2,
    estimatedDiskMb: 2.4,
    workloadCategory: 'join-eager'
  },
  {
    id: 'patch-cov-trans-customer-created',
    patternTitle: 'Pattern #3: Customer Text Search & Timeline Aggregation',
    targetTable: 'transactions',
    workloadSharePct: 14.6,
    workloadQpm: 4500,
    querySql: `SELECT id, customer_name, amount, status, created_at
FROM transactions
WHERE customer_name ILIKE 'Acme%' AND created_at >= '2026-01-01'
ORDER BY created_at DESC;`,
    indexName: 'idx_cov_transactions_customer_created',
    keyColumns: ['customer_name text_pattern_ops', 'created_at DESC'],
    includeColumns: ['amount', 'status', 'id'],
    ddlStatement: `CREATE INDEX CONCURRENTLY idx_cov_transactions_customer_created
ON transactions (customer_name text_pattern_ops, created_at DESC)
INCLUDE (amount, status, id);`,
    whyNeeded: 'Prefix wildcard search (ILIKE Acme%) requires a specialized B-Tree operator class (text_pattern_ops). By attaching amount and status as non-key INCLUDE attributes, search autocomplete queries read all requested projection data directly from index memory leaves without hitting the transaction heap tables.',
    currentScanType: 'Bitmap Heap Scan with Page Rechecks',
    currentCost: 19.80,
    currentLatencyMs: 12.5,
    currentHeapFetches: '12,800 blocks',
    projectedScanType: 'Index-Only Scan (Covering Text Pattern)',
    projectedCost: 1.45,
    projectedLatencyMs: 1.10,
    projectedHeapFetches: '0 blocks (Cache Hit)',
    speedupPct: 91.2,
    estimatedDiskMb: 4.1,
    workloadCategory: 'text-search'
  },
  {
    id: 'patch-cov-trans-status-amount',
    patternTitle: 'Pattern #4: High-Value Analytics & Audit Range Queries',
    targetTable: 'transactions',
    workloadSharePct: 6.9,
    workloadQpm: 2100,
    querySql: `SELECT id, order_number, amount, category, status
FROM transactions
WHERE status = 'completed' AND amount >= 500.00
ORDER BY amount DESC
LIMIT 100;`,
    indexName: 'idx_cov_transactions_status_amount',
    keyColumns: ['status', 'amount DESC'],
    includeColumns: ['order_number', 'category', 'id'],
    ddlStatement: `CREATE INDEX CONCURRENTLY idx_cov_transactions_status_amount
ON transactions (status, amount DESC)
INCLUDE (order_number, category, id);`,
    whyNeeded: 'Analytical range filters on monetary amounts scan 50,000 rows to return only high-value tiers. A covering index with status and amount DESC aligns leaf page order directly with the ORDER BY amount DESC LIMIT 100, eliminating both table scans and sort buffers.',
    currentScanType: 'Seq Scan (High Row Volume Filter)',
    currentCost: 32.10,
    currentLatencyMs: 16.4,
    currentHeapFetches: '28,000 blocks',
    projectedScanType: 'Index-Only Scan (Covering Range Seek)',
    projectedCost: 0.90,
    projectedLatencyMs: 0.45,
    projectedHeapFetches: '0 blocks (Cache Hit)',
    speedupPct: 97.3,
    estimatedDiskMb: 3.2,
    workloadCategory: 'analytics'
  }
];

interface IntelligentIndexingAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCoveringIndex: (patch: CoveringIndexPatch) => void;
  onApplyAllPatches: (patches: CoveringIndexPatch[]) => void;
  patchedIndexIds: string[];
  flags?: OptimizationFlags;
  onToggleFlag?: (flag: keyof OptimizationFlags) => void;
}

export const IntelligentIndexingAdvisorModal: React.FC<IntelligentIndexingAdvisorModalProps> = ({
  isOpen,
  onClose,
  onApplyCoveringIndex,
  onApplyAllPatches,
  patchedIndexIds,
  flags,
  onToggleFlag
}) => {
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'patched'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [isPatchingAll, setIsPatchingAll] = useState<boolean>(false);
  const [copiedDdlId, setCopiedDdlId] = useState<string | null>(null);
  const [activeTabMode, setActiveTabMode] = useState<'cards' | 'cross-matrix'>('cards');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredPatches = COVERING_INDEX_CATALOG.filter((patch) => {
    const isPatched = patchedIndexIds.includes(patch.id);
    if (selectedTableFilter !== 'all' && patch.targetTable !== selectedTableFilter) {
      return false;
    }
    if (statusFilter === 'missing' && isPatched) return false;
    if (statusFilter === 'patched' && !isPatched) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = patch.patternTitle.toLowerCase().includes(q);
      const matchIndex = patch.indexName.toLowerCase().includes(q);
      const matchSql = patch.querySql.toLowerCase().includes(q);
      const matchTable = patch.targetTable.toLowerCase().includes(q);
      if (!matchTitle && !matchIndex && !matchSql && !matchTable) return false;
    }
    return true;
  });

  const missingPatches = COVERING_INDEX_CATALOG.filter(p => !patchedIndexIds.includes(p.id));
  const patchedCount = COVERING_INDEX_CATALOG.length - missingPatches.length;

  const handleCopyDdl = (ddl: string, id: string) => {
    navigator.clipboard.writeText(ddl);
    setCopiedDdlId(id);
    setTimeout(() => setCopiedDdlId(null), 3000);
  };

  const handleOneClickPatch = (patch: CoveringIndexPatch) => {
    setPatchingId(patch.id);
    setTimeout(() => {
      onApplyCoveringIndex(patch);
      setPatchingId(null);
      setToastMessage(`✓ Successfully applied one-click patch for '${patch.indexName}'! Zero-heap Index-Only Scan activated.`);
      setTimeout(() => setToastMessage(null), 4500);
    }, 450);
  };

  const handleOneClickPatchAll = () => {
    if (missingPatches.length === 0) return;
    setIsPatchingAll(true);
    setTimeout(() => {
      onApplyAllPatches(missingPatches);
      setIsPatchingAll(false);
      setToastMessage(`✓ Successfully patched all ${missingPatches.length} missing covering indexes! Workload converted to 100% Index-Only Scans.`);
      setTimeout(() => setToastMessage(null), 5000);
    }, 600);
  };

  return (
    <div
      id="modal-intelligent-indexing-advisor"
      data-testid="modal-intelligent-indexing-advisor"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
    >
      <div className="bg-white border-2 border-cyan-400 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-cyan-950 to-indigo-950 text-white flex items-center justify-between border-b border-cyan-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-600 text-white rounded-xl shadow-md ring-2 ring-cyan-300/30">
              <Compass className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Intelligent Indexing Advisor
                </h2>
                <span className="font-mono text-[10px] bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 px-2 py-0.5 rounded-full font-bold">
                  Covering Index Engine
                </span>
                <span className="font-mono text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  Zero-Heap Scans
                </span>
              </div>
              <p className="text-xs text-cyan-200/80 mt-0.5">
                Cross-references live SQL query patterns with missing covering indexes (INCLUDE clause) to eliminate secondary table heap lookups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-intelligent-advisor"
              data-testid="btn-close-intelligent-advisor"
              onClick={onClose}
              className="p-2 text-cyan-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Close Intelligent Indexing Advisor Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Impact Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-cyan-50/70 border-b border-cyan-200/80 text-xs shrink-0">
          <div className="p-2.5 bg-white rounded-xl border border-cyan-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Workload Audited</span>
            <div className="font-mono font-bold text-sm text-zinc-900 mt-0.5">30,400 QPM</div>
            <span className="text-[10px] text-zinc-500">Across 4 core query clusters</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-cyan-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Missing Covering Indexes</span>
            <div className="font-mono font-bold text-sm text-rose-700 mt-0.5">
              {missingPatches.length} Opportunity {missingPatches.length === 1 ? '' : 'Opportunities'}
            </div>
            <span className="text-[10px] text-zinc-500">
              {patchedCount} of {COVERING_INDEX_CATALOG.length} Patched
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-cyan-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Average Latency Drop</span>
            <div className="font-mono font-bold text-sm text-emerald-700 mt-0.5">↓ 95.8% Faster</div>
            <span className="text-[10px] text-zinc-500">From 17.8ms avg to 0.66ms</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-cyan-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Index-Only Scan Ratio</span>
            <div className="font-mono font-bold text-sm text-indigo-700 mt-0.5">
              {patchedCount === COVERING_INDEX_CATALOG.length ? '100% Zero-Heap' : `${Math.round((patchedCount / COVERING_INDEX_CATALOG.length) * 100)}% Conversion`}
            </div>
            <span className="text-[10px] text-zinc-500">Eliminates 110,800 buffer reads</span>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="p-3 sm:p-4 border-b border-zinc-200 bg-white flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Table filter tabs */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedTableFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedTableFilter === 'all' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All Tables ({COVERING_INDEX_CATALOG.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTableFilter('transactions')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedTableFilter === 'transactions' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                transactions (3)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTableFilter('order_items')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedTableFilter === 'order_items' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                order_items (1)
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('missing')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'missing' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-zinc-600'
                }`}
              >
                Missing ({missingPatches.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('patched')}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'patched' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-zinc-600'
                }`}
              >
                Patched ({patchedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search query patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 w-48 sm:w-56"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* One-Click Patch All Button */}
            <button
              type="button"
              id="btn-one-click-patch-all"
              data-testid="btn-one-click-patch-all"
              onClick={handleOneClickPatchAll}
              disabled={missingPatches.length === 0 || isPatchingAll}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                missingPatches.length === 0
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-80 cursor-not-allowed'
                  : isPatchingAll
                  ? 'bg-cyan-700 text-white animate-pulse'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white ring-2 ring-emerald-400/40'
              }`}
              title="Apply all recommended covering indexes with a single click"
            >
              {isPatchingAll ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Patching All DDL Statements...</span>
                </>
              ) : missingPatches.length === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>All Covering Indexes Patched</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>One-Click Patch All ({missingPatches.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-zinc-50/60">
          {filteredPatches.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-zinc-200 text-zinc-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-zinc-800 text-sm">No Unpatched Covering Indexes Found</div>
              <p className="text-xs text-zinc-500">
                All query patterns in the selected filter already have covering indexes active, achieving optimal Index-Only Scan throughput.
              </p>
            </div>
          ) : (
            filteredPatches.map((patch) => {
              const isPatched = patchedIndexIds.includes(patch.id);
              const isCurrentlyPatching = patchingId === patch.id;

              return (
                <div
                  key={patch.id}
                  id={`card-advisor-patch-${patch.id}`}
                  data-testid={`card-advisor-patch-${patch.id}`}
                  className={`bg-white rounded-xl border-2 transition-all p-4 space-y-3.5 shadow-xs ${
                    isPatched
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : 'border-zinc-200 hover:border-cyan-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between flex-wrap gap-2.5 pb-2.5 border-b border-zinc-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                          Table: {patch.targetTable}
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900">
                          {patch.patternTitle}
                        </h3>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-200">
                          {patch.workloadSharePct}% Workload ({patch.workloadQpm.toLocaleString()} QPM)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1 leading-snug">
                        Missing Covering Index: <code className="font-mono font-bold text-indigo-700">{patch.indexName}</code>
                      </p>
                    </div>

                    {/* Status Badge & One-Click Patch Action */}
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        isPatched
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                      }`}>
                        {isPatched ? '✓ Active in Schema (Patched)' : '⚠️ Missing Covering Index'}
                      </span>

                      {/* One-Click Patch Button */}
                      <button
                        type="button"
                        id={`btn-one-click-patch-${patch.id}`}
                        data-testid={`btn-one-click-patch-${patch.id}`}
                        onClick={() => handleOneClickPatch(patch)}
                        disabled={isPatched || isCurrentlyPatching}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          isPatched
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-80 cursor-default'
                            : isCurrentlyPatching
                            ? 'bg-cyan-600 text-white animate-pulse'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white ring-2 ring-emerald-300/50'
                        }`}
                        title="Execute DDL statement to create covering index with INCLUDE payload"
                      >
                        {isCurrentlyPatching ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Patching DDL...</span>
                          </>
                        ) : isPatched ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Patched (Active)</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                            <span>One-Click Patch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cross-Reference Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Existing Execution State */}
                    <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Current Execution State (Unindexed/Uncovered)</span>
                        </span>
                        <span className="font-mono text-[10px] bg-rose-200/80 text-rose-900 px-1.5 py-0.2 rounded font-bold">
                          Cost: {patch.currentCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-zinc-700">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Scan Type:</span>
                          <span className="font-mono font-semibold text-rose-900">{patch.currentScanType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Estimated Latency:</span>
                          <span className="font-mono font-bold text-rose-900">{patch.currentLatencyMs.toFixed(1)} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Heap Block Fetches:</span>
                          <span className="font-mono font-semibold text-rose-900">{patch.currentHeapFetches}</span>
                        </div>
                      </div>
                    </div>

                    {/* Projected Covering Index State */}
                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Projected Covering Index Performance</span>
                        </span>
                        <span className="font-mono text-[10px] bg-emerald-200 text-emerald-950 px-1.5 py-0.2 rounded font-bold">
                          Cost: {patch.projectedCost.toFixed(2)} (↓ {patch.speedupPct}%)
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-zinc-700">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Scan Type:</span>
                          <span className="font-mono font-bold text-emerald-800">{patch.projectedScanType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Projected Latency:</span>
                          <span className="font-mono font-bold text-emerald-800">{patch.projectedLatencyMs.toFixed(2)} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Heap Block Fetches:</span>
                          <span className="font-mono font-bold text-emerald-800">{patch.projectedHeapFetches}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Query Pattern Cross-Reference Code & DDL */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                      {/* Query Pattern SQL */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                          <div className="flex items-center gap-1.5">
                            <Terminal className="w-3 h-3 text-zinc-500" />
                            <span>Cross-Referenced Query Pattern:</span>
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500">SQL Pattern Filter</span>
                        </div>
                        <pre className="p-2.5 bg-zinc-900 text-emerald-400 font-mono text-[11px] rounded-lg border border-zinc-800 overflow-x-auto leading-relaxed h-28">
                          <code>{patch.querySql}</code>
                        </pre>
                      </div>

                      {/* Missing Covering Index DDL */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                          <div className="flex items-center gap-1.5">
                            <FileCode className="w-3 h-3 text-indigo-600" />
                            <span>Missing Covering Index DDL Patch:</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyDdl(patch.ddlStatement, patch.id)}
                            className="text-[10px] font-mono text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer font-bold"
                          >
                            {copiedDdlId === patch.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedDdlId === patch.id ? 'Copied' : 'Copy DDL'}</span>
                          </button>
                        </div>
                        <pre className="p-2.5 bg-zinc-950 text-cyan-300 font-mono text-[11px] rounded-lg border border-cyan-900/60 overflow-x-auto leading-relaxed h-28">
                          <code>{patch.ddlStatement}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Architectural Index Breakdown Chips */}
                    <div className="p-2.5 bg-zinc-100/90 rounded-lg border border-zinc-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-800 text-[11px]">B-Tree Key Predicates:</span>
                          {patch.keyColumns.map((col, idx) => (
                            <span key={idx} className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-indigo-900 border border-indigo-200">
                              {col}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-800 text-[11px]">Covering Payload (INCLUDE):</span>
                          {patch.includeColumns.map((col, idx) => (
                            <span key={idx} className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300">
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-600 leading-relaxed pt-1 border-t border-zinc-200/60">
                        <strong className="text-zinc-800">Why this covering index eliminates secondary heap lookups: </strong>
                        {patch.whyNeeded}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-zinc-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              All patches are applied with PostgreSQL <code className="font-mono bg-white px-1 py-0.2 rounded border">CONCURRENTLY</code> mode, ensuring zero table write lockouts in production.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              Close Advisor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
