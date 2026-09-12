import React, { useState } from 'react';
import { ExplainPlanNode, OptimizationFlags, QueryExecutionResult } from '../types';
import { Terminal, Database, Code, CheckCircle2, AlertTriangle, ArrowDownRight, Layers } from 'lucide-react';

interface ExplainPlanViewerProps {
  result: QueryExecutionResult;
  flags: OptimizationFlags;
  statusFilter: string;
  categoryFilter: string;
  searchTerm: string;
}

export const ExplainPlanViewer: React.FC<ExplainPlanViewerProps> = ({
  result,
  flags,
  statusFilter,
  categoryFilter,
  searchTerm
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'sql' | 'architecture'>('plan');

  const unoptimizedSQL = `-- Query 1: Parent order query with unindexed sequential table scan
SELECT o.id, o.order_number, o.customer_id, o.amount, o.status, o.category
FROM transactions o
WHERE o.status = '${statusFilter !== 'all' ? statusFilter : 'completed'}' 
  AND o.category = '${categoryFilter !== 'all' ? categoryFilter : 'Cloud Infrastructure'}'
  ${searchTerm ? `AND (o.order_number ILIKE '%${searchTerm}%' OR o.customer_name ILIKE '%${searchTerm}%')` : ''}
LIMIT ${result.pageSize};

-- Query 2..N: N+1 Subquery Storm (fired synchronously for EACH order row)
-- Executes 50-100+ separate roundtrips, exhausting connection pool:
SELECT * FROM order_items WHERE order_id = 'rec_1';
SELECT * FROM order_items WHERE order_id = 'rec_2';
SELECT * FROM order_items WHERE order_id = 'rec_3';
... [Repeats for every single row in pagination]`;

  const optimizedSQL = `-- Step 1: Composite B-Tree Index definition
CREATE INDEX idx_orders_status_category ON transactions (status, category);

-- Step 2: High performance index scan query (cost: 4.82, takes 1.2ms)
SELECT o.id, o.order_number, o.customer_id, o.amount, o.status, o.category
FROM transactions o
WHERE o.status = '${statusFilter !== 'all' ? statusFilter : 'completed'}' 
  AND o.category = '${categoryFilter !== 'all' ? categoryFilter : 'Cloud Infrastructure'}'
  ${searchTerm ? `AND (o.order_number ILIKE '%${searchTerm}%' OR o.customer_name ILIKE '%${searchTerm}%')` : ''}
ORDER BY o.created_at DESC
LIMIT ${result.pageSize};

-- Step 3: Batch eager loading of child items in a SINGLE roundtrip (eliminates N+1)
SELECT i.order_id, i.sku, i.name, i.unit_price, i.quantity
FROM order_items i
WHERE i.order_id IN (/* Batched 50 IDs from Query 1 */);`;

  const renderPlanNode = (node: ExplainPlanNode, depth = 0) => {
    const isIndex = node.nodeType === 'Index Scan' || node.nodeType === 'LRU Cache Lookup';
    const isNPlusOne = node.details.includes('N+1');

    return (
      <div key={`${node.relationName}-${depth}`} className="flex flex-col gap-2">
        <div
          className={`p-3 rounded-lg border text-xs ${
            isIndex
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : isNPlusOne
              ? 'bg-rose-50/80 border-rose-300 text-rose-950'
              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  isIndex
                    ? 'bg-emerald-200 text-emerald-900'
                    : isNPlusOne
                    ? 'bg-rose-200 text-rose-900'
                    : 'bg-zinc-200 text-zinc-800'
                }`}
              >
                {node.nodeType}
              </span>
              <span className="font-semibold">{node.relationName}</span>
              {node.indexName && (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                  using {node.indexName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-600">
              <span>Cost: {node.cost.toFixed(2)}</span>
              <span className="font-semibold text-zinc-900">
                Time: {node.actualTimeMs.toFixed(2)} ms
              </span>
              <span>
                Rows: {node.rowsReturned} / {node.rowsScanned.toLocaleString()} scanned
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 mt-1">{node.details}</p>
        </div>

        {node.subNodes &&
          node.subNodes.map((childNode, idx) => (
            <div key={idx} className="relative flex items-start">
              <ArrowDownRight
                className="w-4 h-4 text-zinc-400 shrink-0 mt-2"
                style={{ marginLeft: `${depth * 20 + 6}px` }}
              />
              <div className="flex-1">{renderPlanNode(childNode, depth + 1)}</div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/70">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-700" />
          <h3 className="text-sm font-bold text-zinc-900">
            Database Query Diagnostics &amp; Execution Plan
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-zinc-200/80 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            EXPLAIN Tree
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            SQL Statements
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Architecture Fixes
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4">
        {activeTab === 'plan' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 pb-1 border-b border-zinc-100">
              <span className="font-medium">
                Execution Tree (PostgreSQL-compatible EXPLAIN ANALYZE format)
              </span>
              <span className="font-mono">
                Total Query Cost: {result.explainPlan.cost.toFixed(2)} | Time: {result.executionTimeMs}ms
              </span>
            </div>

            {renderPlanNode(result.explainPlan)}
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className={flags.btreeIndexing && flags.batchEagerLoading ? 'text-emerald-700' : 'text-rose-700'}>
                  {flags.btreeIndexing && flags.batchEagerLoading
                    ? '✓ Optimized Query Plan with Batch Eager Join & B-Tree Index'
                    : '✗ Unoptimized Query Plan (Full Sequential Scan + N+1 Subquery Storm)'}
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">Dialect: ANSI SQL / PostgreSQL</span>
              </div>

              <pre className="p-3.5 bg-zinc-900 text-zinc-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-zinc-800">
                {flags.btreeIndexing && flags.batchEagerLoading ? optimizedSQL : unoptimizedSQL}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                1. B-Tree Index Strategy
              </div>
              <p className="text-zinc-600 leading-relaxed">
                By indexing <code className="font-mono bg-zinc-200/70 px-1 py-0.5 rounded text-[11px]">(status, category)</code>, 
                the database query engine traverses an $O(\log N)$ tree to jump straight to the target pointers, skipping 49,960 
                irrelevant records and avoiding costly disk buffer churn.
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5 mb-1">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                2. Resolving N+1 Query Cascades
              </div>
              <p className="text-zinc-600 leading-relaxed">
                N+1 query patterns open a new socket and parse a new SQL statement for each child record. 
                Using batch eager loading (<code className="font-mono bg-zinc-200/70 px-1 py-0.5 rounded text-[11px]">WHERE order_id IN (...)</code>) 
                retrieves all associated items in a single roundtrip, preventing connection pool exhaustion.
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                3. UI DOM Virtualization
              </div>
              <p className="text-zinc-600 leading-relaxed">
                Rendering 1,000+ complex DOM nodes causes layout thrashing and garbage collection spikes. 
                DOM windowing calculates the scroll offset dynamically and mounts only 15 active nodes, keeping frame rates at a constant 60 FPS.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
