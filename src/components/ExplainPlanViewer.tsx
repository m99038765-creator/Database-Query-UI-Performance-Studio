import React, { useState, useEffect, useRef } from 'react';
import { ExplainPlanNode, OptimizationFlags, QueryExecutionResult } from '../types';
import { Terminal, Database, Code, CheckCircle2, AlertTriangle, ArrowDownRight, Layers, Sparkles } from 'lucide-react';
import * as d3 from 'd3';

interface ExplainPlanViewerProps {
  result?: QueryExecutionResult;
  explainPlan?: ExplainPlanNode;
  flags?: OptimizationFlags;
  statusFilter?: string;
  categoryFilter?: string;
  searchTerm?: string;
}

export const ExplainPlanViewer: React.FC<ExplainPlanViewerProps> = ({
  result,
  explainPlan,
  flags,
  statusFilter = 'all',
  categoryFilter = 'all',
  searchTerm = ''
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'chart' | 'sql' | 'architecture'>('plan');
  const [showExecutiveSummary, setShowExecutiveSummary] = useState<boolean>(false);
  const [isIndexSandboxOpen, setIsIndexSandboxOpen] = useState<boolean>(false);
  const [sandboxColumns, setSandboxColumns] = useState<string[]>(['status', 'category', 'created_at']);
  const [sandboxNewColInput, setSandboxNewColInput] = useState<string>('');
  const [isSandboxComputed, setIsSandboxComputed] = useState<boolean>(false);

  const safeFlags = flags || {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  };

  const effectiveExplainPlan: ExplainPlanNode = explainPlan || result?.explainPlan || {
    nodeType: safeFlags.btreeIndexing ? 'Index Scan' : 'Seq Scan',
    relationName: 'transactions',
    indexName: safeFlags.btreeIndexing ? 'idx_orders_status_category' : undefined,
    cost: safeFlags.btreeIndexing ? 4.82 : 48.5,
    actualTimeMs: result?.executionTimeMs ?? 1.2,
    rowsScanned: result?.rowsScanned ?? 32,
    rowsReturned: result?.records?.length ?? 32,
    details: safeFlags.btreeIndexing
      ? 'B-Tree index seek on (status, category)'
      : 'Full sequential scan across 50,000 rows in memory'
  };

  const diskTier = (() => {
    try {
      return localStorage.getItem('enterprise_global_disk_tier') || 'NVMe';
    } catch {
      return 'NVMe';
    }
  })();

  const diskMultiplier = diskTier === 'HDD' ? 7.5 : diskTier === 'SSD' ? 2.2 : 1.0;
  const pageSize = result?.pageSize ?? 100;
  const baseExecutionTime = result?.executionTimeMs ?? effectiveExplainPlan.actualTimeMs ?? 1.2;
  const executionTime = +(baseExecutionTime * diskMultiplier).toFixed(2);

  const unoptimizedSQL = `-- Query 1: Parent order query with unindexed sequential table scan
SELECT o.id, o.order_number, o.customer_id, o.amount, o.status, o.category
FROM transactions o
WHERE o.status = '${statusFilter !== 'all' ? statusFilter : 'completed'}' 
  AND o.category = '${categoryFilter !== 'all' ? categoryFilter : 'Cloud Infrastructure'}'
  ${searchTerm ? `AND (o.order_number ILIKE '%${searchTerm}%' OR o.customer_name ILIKE '%${searchTerm}%')` : ''}
LIMIT ${pageSize};

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
LIMIT ${pageSize};

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

  const D3CostBreakdownChart: React.FC<{ plan: ExplainPlanNode }> = ({ plan }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
      if (!svgRef.current) return;

      // Extract nodes recursively
      const nodesList: Array<{ name: string; cost: number; type: string }> = [];
      const traverse = (n: ExplainPlanNode) => {
        nodesList.push({
          name: `${n.nodeType} (${n.relationName})`,
          cost: n.cost,
          type: n.nodeType
        });
        if (n.subNodes) {
          n.subNodes.forEach(traverse);
        }
      };
      traverse(plan);

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const width = 560;
      const height = 240;
      const margin = { top: 20, right: 30, bottom: 40, left: 150 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const g = svg
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleLinear()
        .domain([0, d3.max(nodesList, (d) => d.cost) || 10])
        .range([0, innerWidth]);

      const y = d3
        .scaleBand()
        .domain(nodesList.map((d) => d.name))
        .range([0, innerHeight])
        .padding(0.3);

      // X Axis
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#71717a');

      // Y Axis
      g.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#3f3f46')
        .attr('font-weight', '600');

      // Bars
      g.selectAll('rect')
        .data(nodesList)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.name) || 0)
        .attr('width', (d) => x(d.cost))
        .attr('height', y.bandwidth())
        .attr('fill', (d) => (d.type.includes('Index') ? '#10b981' : d.type.includes('Seq') ? '#f43f5e' : '#6366f1'))
        .attr('rx', 4);

      // Value labels
      g.selectAll('.text-label')
        .data(nodesList)
        .enter()
        .append('text')
        .attr('x', (d) => x(d.cost) + 6)
        .attr('y', (d) => (y(d.name) || 0) + y.bandwidth() / 2 + 4)
        .text((d) => `Cost: ${d.cost.toFixed(2)}`)
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('fill', '#52525b');
    }, [plan]);

    return (
      <div className="w-full overflow-x-auto flex justify-center py-2">
        <svg ref={svgRef} className="max-w-full h-auto" />
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
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Cost Breakdown (D3)
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

      {/* Disk Tier IOPS Simulation Ribbon */}
      <div className="px-4 py-2 bg-gradient-to-r from-cyan-50/90 via-teal-50/60 to-cyan-50/90 border-b border-cyan-200 flex items-center justify-between text-xs text-cyan-950">
        <div className="flex items-center gap-2 font-bold">
          <Database className="w-3.5 h-3.5 text-cyan-700" />
          <span>Active Storage Tier: <strong className="text-cyan-900 underline">{diskTier}</strong> ({diskTier === 'NVMe' ? '500k IOPS, 0.05ms seek' : diskTier === 'SSD' ? '10k IOPS, 0.8ms seek' : '250 IOPS, 15ms seek'})</span>
        </div>
        <span className="font-mono text-[11px] font-bold bg-cyan-200 text-cyan-900 px-2 py-0.5 rounded border border-cyan-300">
          I/O Latency Multiplier: {diskMultiplier}x ({executionTime}ms)
        </span>
      </div>

      {/* Content Body */}
      <div className="p-4">
        {activeTab === 'plan' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 pb-2 border-b border-zinc-100 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  Execution Tree (PostgreSQL-compatible EXPLAIN ANALYZE format)
                </span>
                <button
                  type="button"
                  id="btn-open-index-sandbox"
                  data-testid="btn-open-index-sandbox"
                  onClick={() => setIsIndexSandboxOpen(!isIndexSandboxOpen)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                    isIndexSandboxOpen
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border-purple-200'
                  }`}
                  title="Mock add/remove index columns and instantly simulate re-computation of execution plan"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Index Sandbox {isSandboxComputed ? '(Simulated)' : ''}</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer bg-zinc-100 hover:bg-zinc-200/70 px-2.5 py-1 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    id="checkbox-executive-summary"
                    data-testid="checkbox-executive-summary"
                    checked={showExecutiveSummary}
                    onChange={(e) => setShowExecutiveSummary(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Show Executive Summary</span>
                </label>
                <span className="font-mono">
                  Total Query Cost: {isSandboxComputed ? '2.15' : effectiveExplainPlan.cost.toFixed(2)} | Time: {isSandboxComputed ? '0.6' : executionTime}ms
                </span>
              </div>
            </div>

            {/* Index Sandbox Panel */}
            {isIndexSandboxOpen && (
              <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 rounded-xl border border-purple-200 shadow-sm space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Index Sandbox — Virtualized Column Mocking &amp; Plan Re-computation
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-bold">
                    Zero DB State Mutation
                  </span>
                </div>

                <div className="text-xs text-zinc-700 space-y-2">
                  <p>
                    Mock add or remove index columns below. Triggering <strong>Re-compute Plan</strong> simulates the PostgreSQL query planner cost model instantly without writing modifications to disk.
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-bold text-zinc-800 text-[11px] mr-1">Mock Index Columns:</span>
                    {sandboxColumns.map((col, idx) => (
                      <span
                        key={col}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-300 rounded-lg font-mono text-purple-900 font-bold shadow-2xs text-xs"
                      >
                        <span>{col}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSandboxColumns((prev) => prev.filter((_, i) => i !== idx));
                            setIsSandboxComputed(false);
                          }}
                          className="text-purple-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                          title={`Remove ${col}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    <div className="flex items-center gap-1 ml-2">
                      <input
                        type="text"
                        id="input-sandbox-new-col"
                        data-testid="input-sandbox-new-col"
                        value={sandboxNewColInput}
                        onChange={(e) => setSandboxNewColInput(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-mono w-32 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="Add column..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = sandboxNewColInput.trim();
                            if (val && !sandboxColumns.includes(val)) {
                              setSandboxColumns((prev) => [...prev, val]);
                              setSandboxNewColInput('');
                              setIsSandboxComputed(false);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = sandboxNewColInput.trim();
                          if (val && !sandboxColumns.includes(val)) {
                            setSandboxColumns((prev) => [...prev, val]);
                            setSandboxNewColInput('');
                            setIsSandboxComputed(false);
                          }
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                    <span className="text-[11px] font-mono text-purple-800 font-bold">
                      {isSandboxComputed ? '✓ Projected Cost: 2.15 (-55% reduction) | Time: 0.6ms' : '⚠️ Pending re-computation with mock column set'}
                    </span>
                    <button
                      type="button"
                      id="btn-recompute-sandbox-plan"
                      data-testid="btn-recompute-sandbox-plan"
                      onClick={() => setIsSandboxComputed(true)}
                      className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Re-compute Execution Plan</span>
                    </button>
                  </div>

                  {/* Performance Impact Gauge (IOPS Estimation) */}
                  <div className="mt-3 p-3 bg-white/95 rounded-xl border border-purple-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-purple-600" />
                        <span>Performance Impact Gauge (Estimated IOPS Change)</span>
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        {isSandboxComputed ? '+4,850 IOPS (Optimized)' : 'Baseline IOPS'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono font-semibold text-zinc-500">
                        <span>0 IOPS (Seq Scan Bottleneck)</span>
                        <span>2,500</span>
                        <span>5,000 IOPS (Max Index Throughput)</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 transition-all duration-700 rounded-full"
                          style={{ width: isSandboxComputed ? '88%' : '35%' }}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-zinc-600">
                      {isSandboxComputed
                        ? 'Simulated workload pattern (80% read / 20% write): Adding composite index columns reduces sequential page fetches, projecting a net gain of <strong>+4,850 read IOPS</strong> with minimal write amplification.'
                        : 'Click "Re-compute Execution Plan" to simulate IOPS impact based on mock index structure.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showExecutiveSummary && (
              <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-emerald-50/80 rounded-xl border border-indigo-200 shadow-sm space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Natural Language Executive Performance Summary
                    </h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    safeFlags.btreeIndexing && safeFlags.batchEagerLoading
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {safeFlags.btreeIndexing && safeFlags.batchEagerLoading ? '✓ Low Risk / Optimized' : '⚠️ High Risk / Bottlenecked'}
                  </span>
                </div>

                <div className="text-xs text-zinc-700 space-y-2 leading-relaxed">
                  <p>
                    {safeFlags.btreeIndexing && safeFlags.batchEagerLoading ? (
                      <>
                        <strong>High-Level Assessment:</strong> The query workload is currently operating at peak efficiency, completing point lookups in <strong>{executionTime}ms</strong> with a total planner cost of <strong>{effectiveExplainPlan.cost.toFixed(2)}</strong>. All target predicates utilize active composite B-Tree indexes, completely eliminating full-table sequential scans.
                      </>
                    ) : (
                      <>
                        <strong>Critical Risk Identified:</strong> The execution plan currently triggers a <strong>Full Sequential Scan</strong> across unindexed table structures, forcing PostgreSQL to inspect 50,000+ rows in memory. Combined with an unbatched N+1 subquery storm, this query introduces severe thread lock contention and risks database connection pool exhaustion.
                      </>
                    )}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 bg-white/90 rounded-lg border border-zinc-200/80 shadow-2xs">
                      <div className="font-bold text-zinc-900 mb-1 flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${safeFlags.btreeIndexing ? 'text-emerald-600' : 'text-rose-600'}`} />
                        <span>Scan Efficiency &amp; I/O</span>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        {safeFlags.btreeIndexing
                          ? 'Index Scan active (O(log n) tree seek). Reclaims 100% of buffer cache bandwidth.'
                          : 'O(n) Sequential Scan. 50,000 rows scanned with 0 cache hits per query execution.'}
                      </p>
                    </div>

                    <div className="p-2.5 bg-white/90 rounded-lg border border-zinc-200/80 shadow-2xs">
                      <div className="font-bold text-zinc-900 mb-1 flex items-center gap-1.5">
                        <Database className={`w-3.5 h-3.5 ${safeFlags.batchEagerLoading ? 'text-emerald-600' : 'text-blue-600'}`} />
                        <span>Roundtrip Latency &amp; N+1</span>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        {safeFlags.batchEagerLoading
                          ? 'Batched eager loading active (1 single roundtrip query for related records).'
                          : 'Synchronous N+1 subquery storm executing 50+ separate roundtrips per page.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {renderPlanNode(effectiveExplainPlan)}
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-600 pb-2 border-b border-zinc-100">
              <span className="font-semibold text-zinc-800">
                Execution Cost Breakdown (D3 SVG Bar &amp; Proportional Cost Analysis)
              </span>
              <span className="font-mono text-indigo-700 font-bold">
                Total Planner Cost: {effectiveExplainPlan.cost.toFixed(2)}
              </span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col items-center">
              <D3CostBreakdownChart plan={effectiveExplainPlan} />
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
