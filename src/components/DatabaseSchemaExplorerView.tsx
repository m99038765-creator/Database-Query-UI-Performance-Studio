import React, { useState } from 'react';
import { Database, Layers, Key, Link, AlertTriangle, CheckCircle2, Shield, ArrowRight, Zap, Table, Plus, Info, X, Download, Sparkles, History, Target, RefreshCw } from 'lucide-react';
import { OptimizationFlags } from '../types';

interface DatabaseSchemaExplorerViewProps {
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onClose?: () => void;
}

export const DatabaseSchemaExplorerView: React.FC<DatabaseSchemaExplorerViewProps> = ({
  flags,
  onToggleFlag,
  onClose
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('transactions');
  const [createdCustomIndexes, setCreatedCustomIndexes] = useState<string[]>([]);
  const [createdCompositeIndexes, setCreatedCompositeIndexes] = useState<string[]>([]);
  const [consolidatedIndexes, setConsolidatedIndexes] = useState<string[]>([]);
  const [isAnalyzingWorkload, setIsAnalyzingWorkload] = useState<boolean>(false);
  const [hasAnalyzedWorkload, setHasAnalyzedWorkload] = useState<boolean>(true);
  const [showQueryComplexityInfo, setShowQueryComplexityInfo] = useState<boolean>(false);
  const [compareWithBaseline, setCompareWithBaseline] = useState<boolean>(false);
  const [showSuggestIndexesModal, setShowSuggestIndexesModal] = useState<boolean>(false);
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(false);
  const [quickIndexChecked, setQuickIndexChecked] = useState<boolean>(false);
  const [hoveredIndexWhatIf, setHoveredIndexWhatIf] = useState<string | null>(null);

  const isIndexRedundant = (idxName: string, columns: string[]) => {
    if (consolidatedIndexes.includes(idxName)) return false;
    if (idxName.includes('email_missing') && createdCompositeIndexes.includes('email_status')) return true;
    if (idxName.includes('amount_missing') && createdCompositeIndexes.includes('category_amount')) return true;
    return false;
  };

  const handleConsolidateIndex = (idxName: string) => {
    setConsolidatedIndexes([...consolidatedIndexes, idxName]);
    if (idxName.includes('email_missing')) {
      setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'customer_email'));
    }
    if (idxName.includes('amount_missing')) {
      setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'amount'));
    }
  };

  const handleAnalyzeWorkload = () => {
    setIsAnalyzingWorkload(true);
    setTimeout(() => {
      setIsAnalyzingWorkload(false);
      setHasAnalyzedWorkload(true);
    }, 900);
  };

  const handleRevertAllIndexes = () => {
    setCreatedCustomIndexes([]);
    setCreatedCompositeIndexes([]);
    setConsolidatedIndexes([]);
  };

  interface SchemaSnapshot {
    id: string;
    name: string;
    timestamp: string;
    flags: OptimizationFlags;
    customIndexes: string[];
  }

  const [snapshots, setSnapshots] = useState<SchemaSnapshot[]>([
    {
      id: 'snapshot-default',
      name: 'Default Baseline State',
      timestamp: new Date().toLocaleTimeString(),
      flags: { batchEagerLoading: false, btreeIndexing: false, queryCaching: false, virtualizedDOM: false, deferredRendering: false },
      customIndexes: []
    }
  ]);
  const [showSnapshotsModal, setShowSnapshotsModal] = useState<boolean>(false);

  const handleTakeSnapshot = () => {
    const newSnapshot: SchemaSnapshot = {
      id: `snapshot-${Date.now()}`,
      name: `Schema Snapshot #${snapshots.length + 1}`,
      timestamp: new Date().toLocaleTimeString(),
      flags: { ...flags },
      customIndexes: [...createdCustomIndexes]
    };
    setSnapshots([...snapshots, newSnapshot]);
    setShowSnapshotsModal(true);
  };

  const handleRestoreSnapshot = (snap: SchemaSnapshot) => {
    setCreatedCustomIndexes([...snap.customIndexes]);
    setShowSnapshotsModal(false);
  };

  const handleBulkApplyAllIndexes = () => {
    if (!flags.btreeIndexing) {
      onToggleFlag('btreeIndexing');
    }
    if (!flags.batchEagerLoading) {
      onToggleFlag('batchEagerLoading');
    }
    const missing = ['customer_email', 'amount'].filter((col) => !createdCustomIndexes.includes(col));
    if (missing.length > 0) {
      setCreatedCustomIndexes([...createdCustomIndexes, ...missing]);
    }
    if (!createdCompositeIndexes.includes('email_status')) {
      setCreatedCompositeIndexes(['email_status', 'category_amount']);
    }
  };

  const tables = [
    {
      name: 'transactions',
      description: 'Primary transactional ledger storing 50,000+ orders and execution telemetry.',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'order_number', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: true },
        { name: 'customer_name', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'customer_email', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'amount', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: false },
        { name: 'status', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: flags.btreeIndexing },
        { name: 'category', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: flags.btreeIndexing },
        { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, indexed: true },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], active: true },
        { name: 'idx_orders_status_cat', type: 'Composite B-Tree', columns: ['status', 'category'], active: flags.btreeIndexing },
        { name: 'idx_transactions_date', type: 'B-Tree', columns: ['created_at'], active: true },
        { name: 'idx_transactions_email_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['customer_email'], active: createdCustomIndexes.includes('customer_email') },
        { name: 'idx_transactions_amount_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['amount'], active: createdCustomIndexes.includes('amount') },
        { name: 'idx_transactions_email_status', type: 'Composite B-Tree (AI Recommended)', columns: ['customer_email', 'status'], active: createdCompositeIndexes.includes('email_status') },
        { name: 'idx_transactions_category_amount', type: 'Composite B-Tree (AI Recommended)', columns: ['category', 'amount'], active: createdCompositeIndexes.includes('category_amount') },
      ],
      relationships: [
        { targetTable: 'line_items', type: 'One-to-Many', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'line_items',
      description: 'Order items table storing SKU details and quantities (N+1 query target if unbatched).',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'transaction_id', type: 'VARCHAR(36)', isPk: false, isFk: true, indexed: true },
        { name: 'sku', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: false },
        { name: 'quantity', type: 'INT', isPk: false, isFk: false, indexed: false },
        { name: 'unit_price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: false },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], active: true },
        { name: 'idx_line_items_tx', type: 'B-Tree (Foreign Key)', columns: ['transaction_id'], active: flags.batchEagerLoading }
      ],
      relationships: [
        { targetTable: 'transactions', type: 'Many-to-One', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'customers',
      description: 'Customer directory and enterprise tier tracking.',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'name', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'email', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: true },
        { name: 'tier', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: false },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], active: true },
        { name: 'idx_customers_email', type: 'B-Tree Unique', columns: ['email'], active: true }
      ],
      relationships: []
    }
  ];

  const currentTableData = tables.find((t) => t.name === selectedTable) || tables[0];

  const speedUpPercent = React.useMemo(() => {
    let score = 0;
    if (flags.btreeIndexing) score += 35;
    if (flags.batchEagerLoading) score += 30;
    if (flags.queryCaching) score += 15;
    if (flags.virtualizedDOM) score += 15;
    if (flags.deferredRendering) score += 5;
    if (createdCustomIndexes.length > 0) score += createdCustomIndexes.length * 5;
    return Math.min(100, score);
  }, [flags, createdCustomIndexes]);

  const getIndexImpactSummary = (indexName: string) => {
    if (indexName.includes('PRIMARY KEY')) {
      return { topQuery: 'Q1: ID Lookup', reduction: 'O(n) → O(1) Constant Seek' };
    } else if (indexName.includes('status_cat')) {
      return { topQuery: 'Q2: Status & Category Filter', reduction: 'O(n) → O(log n) Composite B-Tree' };
    } else if (indexName.includes('date')) {
      return { topQuery: 'Q3: Date Range Scan', reduction: 'O(n) → O(log n) Ordered B-Tree' };
    } else if (indexName.includes('email')) {
      return { topQuery: 'Q4: Customer Email Search', reduction: 'O(n) → O(log n) Leaf Node Seek' };
    } else if (indexName.includes('amount')) {
      return { topQuery: 'Q5: Amount Threshold Filter', reduction: 'O(n) → O(log n) Range Index Scan' };
    }
    return { topQuery: 'Top Queries #1-#5', reduction: 'O(n) → O(log n) Read Optimization' };
  };

  const getOptimizationPotential = (idxName: string) => {
    const lower = idxName.toLowerCase();
    if (lower.includes('primary') || lower.includes('clustered')) return '99.9% Complexity Reduction';
    if (lower.includes('composite') || lower.includes('status') || lower.includes('category')) return '99.7% Complexity Reduction';
    if (lower.includes('email') || lower.includes('customer')) return '99.2% Complexity Reduction';
    if (lower.includes('amount') || lower.includes('price')) return '98.8% Complexity Reduction';
    if (lower.includes('date') || lower.includes('time')) return '98.5% Complexity Reduction';
    return '97.5% Complexity Reduction';
  };

  const getWhatIfTop5Queries = (indexName: string) => {
    const isEmail = indexName.toLowerCase().includes('email') || indexName.toLowerCase().includes('customer');
    const isStatus = indexName.toLowerCase().includes('status') || indexName.toLowerCase().includes('cat');
    const isAmount = indexName.toLowerCase().includes('amount') || indexName.toLowerCase().includes('price');
    const isDate = indexName.toLowerCase().includes('date') || indexName.toLowerCase().includes('time') || indexName.toLowerCase().includes('timestamp');

    if (isEmail) {
      return [
        { query: 'SELECT * FROM transactions WHERE customer_email = ?', freq: '14,250/hr', before: '72.4ms', after: '0.3ms', improvement: '-99.6%' },
        { query: 'SELECT id, customer_email FROM transactions WHERE customer_email LIKE ?', freq: '8,400/hr', before: '65.0ms', after: '0.4ms', improvement: '-99.4%' },
        { query: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ?', freq: '5,120/hr', before: '84.2ms', after: '0.6ms', improvement: '-99.3%' },
        { query: 'SELECT COUNT(*) FROM transactions WHERE customer_email = ?', freq: '3,900/hr', before: '58.0ms', after: '0.2ms', improvement: '-99.6%' },
        { query: 'SELECT * FROM transactions WHERE customer_email = ? ORDER BY date DESC', freq: '2,100/hr', before: '91.5ms', after: '0.9ms', improvement: '-99.0%' }
      ];
    } else if (isStatus) {
      return [
        { query: 'SELECT * FROM transactions WHERE status = ? AND amount > ?', freq: '18,400/hr', before: '64.1ms', after: '0.5ms', improvement: '-99.2%' },
        { query: 'SELECT * FROM transactions GROUP BY status, category', freq: '9,200/hr', before: '98.5ms', after: '1.1ms', improvement: '-98.8%' },
        { query: 'SELECT * FROM transactions WHERE status = "pending" LIMIT 100', freq: '7,650/hr', before: '52.0ms', after: '0.3ms', improvement: '-99.4%' },
        { query: 'SELECT AVG(amount) FROM transactions WHERE status = ?', freq: '4,100/hr', before: '78.0ms', after: '0.7ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions WHERE status = ? ORDER BY amount DESC', freq: '3,200/hr', before: '88.0ms', after: '0.8ms', improvement: '-99.1%' }
      ];
    } else if (isAmount) {
      return [
        { query: 'SELECT * FROM transactions WHERE amount >= 1000 ORDER BY amount DESC', freq: '11,100/hr', before: '82.0ms', after: '0.4ms', improvement: '-99.5%' },
        { query: 'SELECT SUM(amount) FROM transactions WHERE category = ? AND amount > ?', freq: '8,900/hr', before: '95.4ms', after: '0.8ms', improvement: '-99.2%' },
        { query: 'SELECT * FROM transactions WHERE amount BETWEEN 100 AND 500', freq: '6,400/hr', before: '68.2ms', after: '0.5ms', improvement: '-99.3%' },
        { query: 'SELECT MIN(amount), MAX(amount) FROM transactions', freq: '3,100/hr', before: '55.0ms', after: '0.2ms', improvement: '-99.6%' },
        { query: 'SELECT * FROM transactions WHERE customer_id = ? AND amount > ?', freq: '2,800/hr', before: '74.0ms', after: '0.6ms', improvement: '-99.2%' }
      ];
    } else if (isDate) {
      return [
        { query: 'SELECT * FROM transactions WHERE date >= NOW() - INTERVAL 30 DAY', freq: '16,500/hr', before: '88.5ms', after: '0.8ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions ORDER BY date DESC LIMIT 50', freq: '12,300/hr', before: '76.0ms', after: '0.4ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions WHERE date BETWEEN ? AND ?', freq: '9,100/hr', before: '92.0ms', after: '0.9ms', improvement: '-99.0%' },
        { query: 'SELECT COUNT(*) FROM transactions WHERE date < ?', freq: '4,500/hr', before: '61.0ms', after: '0.3ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions WHERE status = ? AND date > ?', freq: '3,800/hr', before: '84.0ms', after: '0.7ms', improvement: '-99.2%' }
      ];
    } else {
      return [
        { query: 'SELECT * FROM transactions WHERE id = ?', freq: '22,000/hr', before: '45.0ms', after: '0.2ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions JOIN items ON ...', freq: '11,400/hr', before: '145.8ms', after: '1.2ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions WHERE reference_code = ?', freq: '8,200/hr', before: '68.0ms', after: '0.4ms', improvement: '-99.4%' },
        { query: 'SELECT * FROM transactions WHERE priority = "high"', freq: '5,100/hr', before: '59.0ms', after: '0.5ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions ORDER BY created_at DESC', freq: '3,900/hr', before: '90.0ms', after: '0.8ms', improvement: '-99.1%' }
      ];
    }
  };

  const handleCreateIndex = (colName: string) => {
    if (!createdCustomIndexes.includes(colName)) {
      setCreatedCustomIndexes([...createdCustomIndexes, colName]);
    }
  };

  const handleDownloadSchemaReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeOptimizationFlags: flags,
      tables,
      customCreatedIndexes: createdCustomIndexes,
      diagnosticSummary: {
        totalTables: tables.length,
        missingIndexesIdentified: ['customer_email', 'amount'],
        recommendation: 'Enable B-Tree Indexing and Batch Eager Loading to resolve query complexity bottlenecks.'
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema-diagnostic-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="DatabaseSchemaExplorerView bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/80 via-white to-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Database Schema Explorer</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                ER Diagram &amp; Index Audit
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Visualize relational table foreign keys, current B-Tree index coverage, and resolve missing index bottlenecks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 cursor-pointer select-none">
            <span>Compare with Baseline</span>
            <input
              type="checkbox"
              id="toggle-compare-baseline"
              checked={compareWithBaseline}
              onChange={(e) => setCompareWithBaseline(e.target.checked)}
              className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
          </label>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800 cursor-pointer select-none">
            <span>Show Index Stats (Size &amp; Hit Rate)</span>
            <input
              type="checkbox"
              id="toggle-detailed-stats"
              checked={showDetailedStats}
              onChange={(e) => setShowDetailedStats(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
          </label>

          <button
            type="button"
            onClick={handleTakeSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Snapshot current index configurations and switch between states"
          >
            <History className="w-3.5 h-3.5" />
            <span>Snapshot Schema ({snapshots.length})</span>
          </button>

          <button
            id="btn-quick-index-check"
            type="button"
            onClick={() => {
              setSelectedTable('transactions');
              setQuickIndexChecked(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs animate-pulse"
            title="Instantly highlight the most impactful missing indexes for currently active query search results"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Quick Index Check</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSuggestIndexesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Analyze query workload and recommend B-Tree indexes"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggest Missing Indexes</span>
          </button>

          <button
            type="button"
            id="btn-revert-all-indexes"
            data-testid="btn-revert-all-indexes"
            onClick={handleRevertAllIndexes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Immediately restore database schema to default initial state by resetting all custom index flags"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
            <span>Revert All Index Changes</span>
          </button>

          <button
            type="button"
            onClick={handleBulkApplyAllIndexes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Enable all high-priority missing indexes simultaneously to see cumulative performance impact"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Bulk Apply All</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSchemaReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Download JSON report of current schema diagnostic findings"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Download Schema Report</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQueryComplexityInfo(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Explain how missing indexes affect query complexity for top 3 slowest queries"
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>Query Complexity Guide</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Close Explorer
            </button>
          )}
        </div>
      </div>

      {/* Baseline Comparison Overlay Banner */}
      {compareWithBaseline && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-900 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Baseline Comparison Overlay Active: Comparing current optimized schema against unoptimized default (Baseline: 0 composite B-Tree indexes, unindexed foreign keys).</span>
          </div>
          <span className="font-mono font-bold bg-amber-200/80 text-amber-950 px-2.5 py-0.5 rounded text-[11px]">
            Δ: +{flags.btreeIndexing ? '2 Indexes' : '0 Indexes'} (O(log n) vs O(n))
          </span>
        </div>
      )}

      {/* Quick Index Check Analysis Banner */}
      {quickIndexChecked && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 text-xs text-orange-950 flex items-center justify-between animate-fadeIn shadow-inner">
          <div className="flex items-center gap-2.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-orange-500 animate-ping shrink-0" />
            <span>
              <strong>Quick Index Check Analysis:</strong> Identified 2 high-impact missing indexes (<code className="font-mono bg-orange-200/80 px-1.5 py-0.5 rounded font-bold text-orange-900">customer_email</code>, <code className="font-mono bg-orange-200/80 px-1.5 py-0.5 rounded font-bold text-orange-900">amount</code>) affecting active query search results. Estimated latency reduction: <strong className="text-emerald-700">72ms → 0.4ms (O(n) → O(log n))</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkApplyAllIndexes}
              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
            >
              Fix All Now
            </button>
            <button
              type="button"
              onClick={() => setQuickIndexChecked(false)}
              className="text-orange-700 hover:text-orange-900 px-1.5 py-1 text-[11px] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Query Complexity Modal Popup */}
      {showQueryComplexityInfo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Missing Indexes &amp; Query Complexity Reduction
                  </h3>
                  <p className="text-xs text-zinc-500">
                    How indexing transforms O(n) linear scans into O(log n) lookups for the top 3 slowest queries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQueryComplexityInfo(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>1. Customer Email Wildcard/Exact Lookup</span>
                  <span className="font-mono text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">O(n) → O(log n)</span>
                </div>
                <p className="text-zinc-600">
                  Searching by customer email without an index forces a full sequential table scan across all 50,000 transaction rows. Adding <code className="font-mono text-indigo-700">idx_transactions_email</code> builds a B-Tree structure, reducing row evaluation from 50,000 to ~12 operations.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>2. Transaction Amount Range Filters</span>
                  <span className="font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[10px]">O(n) Range Scan → O(log n) Seek</span>
                </div>
                <p className="text-zinc-600">
                  Range filters (<code className="font-mono">amount &gt; 500</code>) require inspecting unindexed decimal values row by row. Adding <code className="font-mono text-indigo-700">idx_transactions_amount</code> allows the query planner to instantly seek the B-Tree leaf node pointer.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>3. N+1 Line Items Foreign Key Cascades</span>
                  <span className="font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded text-[10px]">100+ Roundtrips → Batched IN Join</span>
                </div>
                <p className="text-zinc-600">
                  Unindexed foreign keys (<code className="font-mono">line_items.transaction_id</code>) trigger a separate database subquery for every order record (N+1 storm). Indexing the foreign key and batching joins reduces roundtrips from 100+ to just 2.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQueryComplexityInfo(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Missing Indexes Modal */}
      {showSuggestIndexesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Workload Analysis &amp; Index Recommendations
                  </h3>
                  <p className="text-xs text-zinc-500">
                    AI-powered query analyzer identified 3 missing B-Tree index configurations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestIndexesModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {createdCustomIndexes.length >= 2 && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Real-Time Conflict Detector: Overlapping Storage Overhead</div>
                    <div className="text-[11px] text-amber-800 mt-0.5">
                      Having {createdCustomIndexes.length} active custom single-column indexes introduces redundant leaf node storage overhead, increasing write latency by ~{(createdCustomIndexes.length * 6).toFixed(0)}% on bulk INSERT/UPDATE operations.
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900">idx_transactions_customer_email</span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">99.7% Speedup</span>
                </div>
                <p className="text-zinc-600">
                  <strong className="text-zinc-900">Target Query:</strong> Customer Email Wildcard Search (<code className="font-mono">WHERE customer_email LIKE '%...'</code>)<br />
                  <strong className="text-zinc-900">Impact:</strong> Eliminates full table scan across 50,000 rows.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!createdCustomIndexes.includes('customer_email')) {
                        setCreatedCustomIndexes([...createdCustomIndexes, 'customer_email']);
                      }
                    }}
                    disabled={createdCustomIndexes.includes('customer_email')}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
                  >
                    {createdCustomIndexes.includes('customer_email') ? 'Index Active' : 'Apply Suggested Index'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900">idx_transactions_amount</span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">95.4% Speedup</span>
                </div>
                <p className="text-zinc-600">
                  <strong className="text-zinc-900">Target Query:</strong> Transaction Amount Range Filter (<code className="font-mono">WHERE amount &gt; 500</code>)<br />
                  <strong className="text-zinc-900">Impact:</strong> Converts $O(n)$ range scan to $O(\log n)$ B-Tree leaf node pointer seek.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!createdCustomIndexes.includes('amount')) {
                        setCreatedCustomIndexes([...createdCustomIndexes, 'amount']);
                      }
                    }}
                    disabled={createdCustomIndexes.includes('amount')}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
                  >
                    {createdCustomIndexes.includes('amount') ? 'Index Active' : 'Apply Suggested Index'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900">idx_line_items_tx</span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">99.6% Speedup</span>
                </div>
                <p className="text-zinc-600">
                  <strong className="text-zinc-900">Target Query:</strong> N+1 Child Join Storm (<code className="font-mono">line_items.transaction_id</code>)<br />
                  <strong className="text-zinc-900">Impact:</strong> Batches 100+ separate roundtrips into a single indexed join.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!flags.batchEagerLoading) {
                        onToggleFlag('batchEagerLoading');
                      }
                    }}
                    disabled={flags.batchEagerLoading}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
                  >
                    {flags.batchEagerLoading ? 'Optimization Active' : 'Apply Batch Join'}
                  </button>
                </div>
              </div>

              {/* AI-Driven Composite Index Suggestions & Analyze Workload */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-indigo-50/50 to-white border border-indigo-200 rounded-xl text-indigo-950 space-y-3 mt-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-indigo-950 flex items-center gap-2">
                        <span>AI-Driven Composite Index &amp; Workload Analyzer</span>
                        <span className="bg-indigo-200 text-indigo-900 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                          Query History Scanner
                        </span>
                      </h4>
                      <p className="text-[11px] text-indigo-900 mt-0.5">
                        Scans recent execution traces for multi-column filtering patterns and generates optimal composite B-Tree index recommendations.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-analyze-workload"
                    data-testid="btn-analyze-workload"
                    onClick={handleAnalyzeWorkload}
                    disabled={isAnalyzingWorkload}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                  >
                    {isAnalyzingWorkload ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Workload...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-white" />
                        <span>Analyze Workload</span>
                      </>
                    )}
                  </button>
                </div>

                {hasAnalyzedWorkload && (
                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px] text-indigo-900">
                    <span className="flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Workload scan complete: 14,200 queries analyzed. 2 high-impact multi-column filtering bottlenecks identified.
                    </span>
                    <span className="font-mono text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      Confidence: 99.4%
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5">
                    <span>idx_transactions_email_status</span>
                    <span className="text-[10px] font-sans bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Composite (Email + Status)</span>
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">99.8% Speedup</span>
                </div>
                <p className="text-zinc-600">
                  <strong className="text-zinc-900">Multi-Column Query Pattern:</strong> <code className="font-mono">WHERE customer_email = ? AND status = ?</code> (5,120/hr)<br />
                  <strong className="text-zinc-900">Impact:</strong> Co-locates multi-attribute leaf nodes for O(log n) composite seek.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!createdCompositeIndexes.includes('email_status')) {
                        setCreatedCompositeIndexes([...createdCompositeIndexes, 'email_status']);
                      }
                    }}
                    disabled={createdCompositeIndexes.includes('email_status')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
                  >
                    {createdCompositeIndexes.includes('email_status') ? 'Composite Index Active' : 'Apply Composite Index'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5">
                    <span>idx_transactions_category_amount</span>
                    <span className="text-[10px] font-sans bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Composite (Category + Amount)</span>
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">99.2% Speedup</span>
                </div>
                <p className="text-zinc-600">
                  <strong className="text-zinc-900">Multi-Column Query Pattern:</strong> <code className="font-mono">WHERE category = ? AND amount &gt; ?</code> (8,900/hr)<br />
                  <strong className="text-zinc-900">Impact:</strong> Eliminates sorting and secondary table scans for range aggregations.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!createdCompositeIndexes.includes('category_amount')) {
                        setCreatedCompositeIndexes([...createdCompositeIndexes, 'category_amount']);
                      }
                    }}
                    disabled={createdCompositeIndexes.includes('category_amount')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
                  >
                    {createdCompositeIndexes.includes('category_amount') ? 'Composite Index Active' : 'Apply Composite Index'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSuggestIndexesModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Snapshots Manager Modal */}
      {showSnapshotsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Schema Snapshots Manager
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Switch between saved index configuration states to compare performance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotsModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto text-xs">
              {snapshots.map((snap) => (
                <div key={snap.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900">{snap.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      Saved at {snap.timestamp} • Custom Indexes: {snap.customIndexes.length}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreSnapshot(snap)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
                  >
                    Restore State
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSnapshotsModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[500px]">
        {/* Left Sidebar: Table List */}
        <div className="p-4 bg-zinc-50/80 border-r border-zinc-200 space-y-2">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2">
            Database Tables ({tables.length})
          </h3>
          {tables.map((tbl) => {
            const isSelected = tbl.name === selectedTable;
            return (
              <button
                key={tbl.name}
                type="button"
                onClick={() => setSelectedTable(tbl.name)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Table className={`w-4 h-4 ${isSelected ? 'text-indigo-200' : 'text-indigo-600'}`} />
                  <div>
                    <div className="font-mono font-bold text-xs">{tbl.name}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-zinc-500'}`}>
                      {tbl.columns.length} columns • {tbl.indexes.length} indexes
                    </div>
                  </div>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
              </button>
            );
          })}

          {/* Bottleneck Recommendation Box */}
          <div className="mt-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Query Bottleneck Detected</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Searching by <code className="font-mono bg-amber-100 px-1 rounded">customer_email</code> or <code className="font-mono bg-amber-100 px-1 rounded">amount</code> currently performs full table scans on 50,000 records.
            </p>
          </div>
        </div>

        {/* Right Main Area: Table Schema & Index Audit */}
        <div className="lg:col-span-3 p-6 space-y-6 overflow-y-auto">
          {/* Estimated Speed-Up Visual Gauge */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 rounded-2xl border border-indigo-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">
                  Estimated Query Execution Speed-Up Gauge
                </h4>
                <p className="text-xs text-zinc-500">
                  Dynamic performance acceleration derived from active B-Tree indexes, caching, and batch eager loading.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:w-48 bg-zinc-200 h-3 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    speedUpPercent > 80
                      ? 'bg-emerald-600'
                      : speedUpPercent > 40
                      ? 'bg-indigo-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${speedUpPercent}%` }}
                />
              </div>
              <div className="text-right whitespace-nowrap font-mono">
                <span className="text-xl font-bold text-zinc-900">+{speedUpPercent}%</span>
                <span className="text-[10px] block text-emerald-700 font-semibold">
                  {speedUpPercent > 80 ? '⚡ Maximum Throughput' : speedUpPercent > 40 ? '🚀 Accelerated' : '⚠️ Unoptimized'}
                </span>
              </div>
            </div>
          </div>

          {/* Table Header Details */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 font-mono flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-600" />
                <span>Table: {currentTableData.name}</span>
              </h3>
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
                {currentTableData.description}
              </span>
            </div>
          </div>

          {/* Columns Schema Table */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Columns &amp; Data Types
            </h4>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-700 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-200">
                    <th className="py-2.5 px-4 font-semibold">Column Name</th>
                    <th className="py-2.5 px-4 font-semibold">Data Type</th>
                    <th className="py-2.5 px-4 font-semibold">Constraints</th>
                    <th className="py-2.5 px-4 font-semibold">Index Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono text-zinc-700">
                  {currentTableData.columns.map((col) => {
                    const isIndexed = col.indexed || createdCustomIndexes.includes(col.name);
                    const isImpactfulMissing = quickIndexChecked && !isIndexed && (col.name === 'customer_email' || col.name === 'amount');
                    return (
                      <tr key={col.name} className={`hover:bg-zinc-50 transition-all ${isImpactfulMissing ? 'bg-orange-50/95 ring-2 ring-orange-400 font-semibold shadow-inner' : ''}`}>
                        <td className="py-2.5 px-4 font-bold text-zinc-900 flex items-center gap-1.5">
                          {col.isPk && <Key className="w-3.5 h-3.5 text-amber-500" title="Primary Key" />}
                          {col.isFk && <Link className="w-3.5 h-3.5 text-blue-500" title="Foreign Key" />}
                          <span>{col.name}</span>
                          {isImpactfulMissing && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-950 border border-orange-300 animate-pulse">
                              ⚡ Missing Impactful Index for Active Query
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-600">{col.type}</td>
                        <td className="py-2.5 px-4">
                          {col.isPk ? (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">PK</span>
                          ) : col.isFk ? (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">FK</span>
                          ) : (
                            <span className="text-zinc-400">NULLable</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {isIndexed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Indexed (B-Tree)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Unindexed (Full Scan)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {isIndexed ? (
                            !col.isPk && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (col.name === 'status' || col.name === 'category') {
                                    if (flags.btreeIndexing) onToggleFlag('btreeIndexing');
                                  } else {
                                    setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== col.name));
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                                title={`Undo optimization on column ${col.name}`}
                              >
                                <span>Undo Optimization</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCreateIndex(col.name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                              title={`Create B-Tree index on ${col.name}`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>Create Index</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current B-Tree Indexes */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Active Index Structures &amp; Performance Impact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentTableData.indexes.map((idx, i) => (
                <div
                  key={`idx-${i}`}
                  onMouseEnter={() => setHoveredIndexWhatIf(idx.name)}
                  onMouseLeave={() => setHoveredIndexWhatIf(null)}
                  className={`relative p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                    idx.active
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Interactive What-If Hover Tooltip */}
                  {hoveredIndexWhatIf === idx.name && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 text-white p-4 rounded-xl shadow-2xl border border-indigo-500/60 animate-fadeIn text-xs">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          <strong className="text-indigo-300">What-If Analysis: {idx.name}</strong>
                        </div>
                        <span className="font-mono text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                          Top 5 Frequent Slow Queries
                        </span>
                      </div>
                      <div className="space-y-2">
                        {getWhatIfTop5Queries(idx.name).map((q, qi) => (
                          <div key={qi} className="p-2 rounded bg-zinc-800/95 border border-zinc-700/80 flex flex-col gap-1">
                            <div className="font-mono text-[11px] text-zinc-200 truncate" title={q.query}>
                              {qi + 1}. {q.query}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-zinc-400">Freq: {q.freq}</span>
                              <div className="flex items-center gap-2">
                                <span className="line-through text-zinc-500">{q.before}</span>
                                <span className="text-zinc-300">→</span>
                                <span className="text-emerald-400 font-bold">{q.after}</span>
                                <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-bold border border-emerald-800">{q.improvement}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[10px] text-zinc-400 italic text-center">
                        💡 Hovering index structures dynamically estimates B-Tree execution time improvements.
                      </div>
                    </div>
                  )}
                  <div>
                    {(() => {
                      const redundant = isIndexRedundant(idx.name, idx.columns);
                      return redundant ? (
                        <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-[11px] text-amber-900 shadow-2xs">
                          <div className="flex items-center gap-2 font-semibold">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                            <span>Redundant Coverage (Covered by Composite Index)</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConsolidateIndex(idx.name);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors"
                          >
                            Consolidate
                          </button>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold text-zinc-900 mb-1">
                      <span className="font-mono">{idx.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-sans px-1.5 py-0.2 rounded font-bold shadow-2xs" title="Calculated Query Complexity Reduction">
                          ⚡ {getOptimizationPotential(idx.name)}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${idx.active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}`}>
                          {idx.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mb-2">
                      Type: {idx.type} • Columns: ({idx.columns.join(', ')})
                    </div>
                  </div>

                  {(() => {
                    const impact = getIndexImpactSummary(idx.name);
                    return (
                      <div className="my-2 p-2 bg-white/90 rounded-lg border border-zinc-200/80 text-[11px] space-y-0.5 shadow-2xs">
                        <div className="font-bold text-zinc-900 flex items-center justify-between">
                          <span>📊 {impact.topQuery}</span>
                          <span className="font-mono text-[10px] text-indigo-700 font-semibold">{impact.reduction}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {showDetailedStats && (
                    <div className="my-1.5 p-2 bg-indigo-50/70 rounded-lg border border-indigo-200 text-[11px] font-mono flex items-center justify-between text-indigo-950">
                      <span>Storage Size: <strong className="text-indigo-900">{idx.active ? (idx.name.includes('PRIMARY') ? '4.8 MB' : '2.1 MB') : '0 KB'}</strong></span>
                      <span>Hit Rate: <strong className="text-emerald-700">{idx.active ? '99.4%' : '0.0%'}</strong></span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 text-[11px]">
                    <span className={idx.active ? 'font-medium text-emerald-700' : 'text-zinc-500'}>
                      {idx.active ? '⚡ Optimizes WHERE & JOIN lookups to O(log n)' : '⚠️ Inactive or missing index'}
                    </span>
                    {idx.active && !idx.name.includes('PRIMARY KEY') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (idx.name.includes('status') || idx.name.includes('cat')) {
                            if (flags.btreeIndexing) onToggleFlag('btreeIndexing');
                          } else if (idx.columns.includes('customer_email')) {
                            setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'customer_email'));
                          } else if (idx.columns.includes('amount')) {
                            setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'amount'));
                          }
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded font-semibold text-[10px] transition-colors cursor-pointer shadow-2xs"
                        title="Revert / Undo optimization on this index"
                      >
                        Undo Optimization
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relational Foreign Key Graph */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Relational Foreign Key Graph &amp; Join Paths
            </h4>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              {currentTableData.relationships.length === 0 ? (
                <div className="text-xs text-zinc-500 italic">No foreign key relations mapped for this table.</div>
              ) : (
                currentTableData.relationships.map((rel, i) => (
                  <div key={`rel-${i}`} className="flex items-center justify-between bg-white p-3 rounded-lg border border-zinc-200 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-zinc-900">{currentTableData.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-bold text-indigo-700">{rel.targetTable}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-[11px]">{rel.foreignKey}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rel.optimized ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {rel.optimized ? 'Batched Join' : 'N+1 Unbatched'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
