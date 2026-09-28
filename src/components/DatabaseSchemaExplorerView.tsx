import React, { useState } from 'react';
import { Database, Layers, Key, Link, AlertTriangle, CheckCircle2, Shield, ArrowRight, Zap, Table, Plus, Info, X, Download } from 'lucide-react';
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
  const [showQueryComplexityInfo, setShowQueryComplexityInfo] = useState<boolean>(false);

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
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden flex flex-col">
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

        <div className="flex items-center gap-2">
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
                    return (
                      <tr key={col.name} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-4 font-bold text-zinc-900 flex items-center gap-1.5">
                          {col.isPk && <Key className="w-3.5 h-3.5 text-amber-500" title="Primary Key" />}
                          {col.isFk && <Link className="w-3.5 h-3.5 text-blue-500" title="Foreign Key" />}
                          <span>{col.name}</span>
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
                          {!isIndexed && (
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
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    idx.active
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-zinc-50 border-zinc-200 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-900 mb-1">
                      <span className="font-mono">{idx.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${idx.active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}`}>
                        {idx.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mb-2">
                      Type: {idx.type} • Columns: ({idx.columns.join(', ')})
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-emerald-700 pt-2 border-t border-zinc-200/60">
                    {idx.active ? '⚡ Optimizes WHERE & JOIN lookups to O(log n)' : '⚠️ Inactive or missing index'}
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
