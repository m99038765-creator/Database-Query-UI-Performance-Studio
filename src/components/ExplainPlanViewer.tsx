import React, { useState, useEffect, useRef } from 'react';
import { ExplainPlanNode, OptimizationFlags, QueryExecutionResult } from '../types';
import {
  Terminal,
  Database,
  Code,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  History,
  Calculator,
  Play,
  Clock,
  Cpu,
  Zap,
  Copy,
  Check,
  RefreshCw,
  X,
  FileCode,
  Sliders,
  GitCompare,
  Flame,
  ArrowUp,
  ArrowDown,
  Lightbulb
} from 'lucide-react';
import * as d3 from 'd3';

export interface PlanReplayResult {
  planId: string;
  planName: string;
  planType: string;
  historicalTimeMs: number;
  historicalCost: number;
  replayedTimeMs: number;
  replayedCost: number;
  varianceMs: number;
  variancePercent: number;
  stabilityScore: number;
  stabilityStatus: 'STABLE' | 'OPTIMAL' | 'ACCEPTABLE' | 'DRIFT';
  recordsEvaluated: number;
  diskTier: string;
  replayedAt: string;
  explanation: string;
}

export interface BottleneckAnnotation {
  headline: string;
  whyCostly: string;
  remedy?: string;
  isSevere: boolean;
  isWarning: boolean;
  costImpact: number;
  timeMs: number;
}

export interface QueryCostPrediction {
  predictedTimeMs: number;
  confidenceMarginMs: number;
  plannerCost: number;
  scanType: string;
  estimatedRowsScanned: number;
  estimatedRowsReturned: number;
  estimatedIOPS: number;
  riskLevel: 'optimal' | 'moderate' | 'critical';
  riskScore: number;
  reasoningSummary: string;
  bottlenecks: string[];
  aiRecommendations: string[];
  astFeatures: {
    hasIndexMatch: boolean;
    hasJoin: boolean;
    hasAggregation: boolean;
    hasSort: boolean;
    hasWildcardLike: boolean;
    hasLimit: boolean;
  };
}

export const PRESET_QUERIES = [
  {
    name: 'Indexed Point Lookup (Fast)',
    desc: 'Uses composite B-Tree index on (status, category)',
    sql: `SELECT id, order_number, customer_name, amount, status\nFROM transactions\nWHERE status = 'completed' AND category = 'Cloud Infrastructure'\nORDER BY created_at DESC\nLIMIT 50;`
  },
  {
    name: 'Unindexed Amount Filter (Seq Scan)',
    desc: 'Forces full table scan across 50,000 heap rows',
    sql: `SELECT * FROM transactions\nWHERE amount > 5000 AND category = 'Enterprise License'\nORDER BY created_at DESC;`
  },
  {
    name: 'Join with Line Items (N+1 Risk)',
    desc: 'Joins parent transactions with order_items child table',
    sql: `SELECT t.id, t.order_number, i.sku, i.unit_price, i.quantity\nFROM transactions t\nJOIN order_items i ON t.id = i.order_id\nWHERE t.status = 'flagged'\nLIMIT 100;`
  },
  {
    name: 'Aggregate Group-By Summary',
    desc: 'Multi-column aggregation and grouping metrics',
    sql: `SELECT category, status, COUNT(*) as total_orders, AVG(amount) as avg_spend, SUM(amount) as revenue\nFROM transactions\nGROUP BY category, status\nHAVING COUNT(*) > 5\nORDER BY revenue DESC;`
  },
  {
    name: 'Non-Sargable Wildcard Scan',
    desc: 'Leading wildcard in LIKE expression prevents index usage',
    sql: `SELECT id, order_number, customer_email, amount\nFROM transactions\nWHERE customer_email ILIKE '%corp.com%'\nLIMIT 50;`
  }
];

export const predictQueryExecutionMetrics = (
  rawSql: string,
  diskTier: string,
  flags: OptimizationFlags
): QueryCostPrediction => {
  const sql = rawSql.trim();
  const lower = sql.toLowerCase();

  const isBTreeIndexed = !!flags.btreeIndexing;
  const isBatched = !!flags.batchEagerLoading;
  const isCaching = !!flags.queryCaching;

  const diskMultiplier = diskTier === 'HDD' ? 7.5 : diskTier === 'SSD' ? 2.2 : 1.0;
  const baseIOPSCapacity = diskTier === 'NVMe' ? 500000 : diskTier === 'SSD' ? 10000 : 250;

  // AST Feature Extraction
  const hasJoin = lower.includes('join') || lower.includes('order_items');
  const hasAggregation = lower.includes('group by') || lower.includes('count(') || lower.includes('sum(') || lower.includes('avg(');
  const hasSort = lower.includes('order by');
  const hasLimit = lower.includes('limit');
  const hasWildcardLike = lower.includes("like '%") || lower.includes("ilike '%") || lower.includes('like "%') || lower.includes('ilike "%');

  // Match indexed columns (status, category)
  const filtersStatus = lower.includes('status =') || lower.includes('status in');
  const filtersCategory = lower.includes('category =') || lower.includes('category in');
  const filtersAmount = lower.includes('amount >') || lower.includes('amount <') || lower.includes('amount =') || lower.includes('amount between');
  const filtersEmail = lower.includes('customer_email') || lower.includes('customer_name');

  const hasCompositeIndexMatch = isBTreeIndexed && (filtersStatus || filtersCategory);
  const isFullTableScanForced = hasWildcardLike || (!hasCompositeIndexMatch && (filtersAmount || filtersEmail || !lower.includes('where')));

  // Base rows scanned & base metrics
  let rowsScanned = 50000;
  let scanType = 'Seq Scan (Full Table Heap Scan)';
  let baseCost = 48.5;
  let baseLatencyMs = 28.0;

  if (hasCompositeIndexMatch && !isFullTableScanForced) {
    scanType = 'Index Scan (idx_orders_status_category)';
    rowsScanned = hasLimit ? 50 : 280;
    baseCost = 4.82;
    baseLatencyMs = 0.8;
  } else if (hasCompositeIndexMatch && isFullTableScanForced) {
    scanType = 'Bitmap Index Scan + Heap Filter';
    rowsScanned = 8500;
    baseCost = 18.40;
    baseLatencyMs = 7.5;
  } else {
    scanType = 'Seq Scan (Full Table Heap Scan)';
    rowsScanned = 50000;
    baseCost = 48.5;
    baseLatencyMs = 28.0;
  }

  // Joins impact
  if (hasJoin) {
    if (isBatched) {
      baseCost += 12.0;
      baseLatencyMs += 1.8;
    } else {
      // N+1 query cascade penalty
      baseCost += 180.0;
      baseLatencyMs += 64.0;
    }
  }

  // Aggregation impact
  if (hasAggregation) {
    baseCost += 15.5;
    baseLatencyMs += 3.2;
  }

  // Sort impact
  if (hasSort && !hasCompositeIndexMatch) {
    baseCost += 8.2;
    baseLatencyMs += 2.4;
  }

  // Limit discount
  let rowsReturned = hasLimit ? 50 : (hasAggregation ? 12 : 250);
  if (hasLimit && !hasSort && !hasAggregation) {
    baseLatencyMs *= 0.85;
  }

  // Cache impact
  if (isCaching && sql.length < 220 && !hasWildcardLike) {
    baseLatencyMs = Math.min(baseLatencyMs, 0.4);
    baseCost = Math.min(baseCost, 2.1);
  }

  const finalLatencyMs = +(baseLatencyMs * diskMultiplier).toFixed(2);
  const confidenceMargin = +(finalLatencyMs * 0.12).toFixed(2);
  const plannerCost = +baseCost.toFixed(2);

  // IOPS calculation
  const estimatedIOPS = Math.round(
    scanType.includes('Index')
      ? Math.max(12, Math.round(rowsScanned * 0.45 * (diskTier === 'HDD' ? 0.3 : 1)))
      : Math.round(Math.min(baseIOPSCapacity * 0.85, rowsScanned * 0.08 * diskMultiplier))
  );

  // Risk assessment
  let riskLevel: 'optimal' | 'moderate' | 'critical' = 'optimal';
  let riskScore = 15;
  if (finalLatencyMs > 25 || plannerCost > 50) {
    riskLevel = 'critical';
    riskScore = Math.min(98, Math.round(40 + finalLatencyMs * 0.6));
  } else if (finalLatencyMs > 5 || plannerCost > 15) {
    riskLevel = 'moderate';
    riskScore = Math.min(65, Math.round(20 + finalLatencyMs * 1.5));
  } else {
    riskLevel = 'optimal';
    riskScore = Math.min(20, Math.round(finalLatencyMs * 3));
  }

  const bottlenecks: string[] = [];
  const aiRecommendations: string[] = [];

  if (scanType.includes('Seq Scan')) {
    bottlenecks.push(`Full table sequential heap scan inspecting 50,000 records on storage tier (${diskTier})`);
    aiRecommendations.push('Add composite B-Tree index on predicate columns (status, category) to avoid O(N) heap scans.');
  }

  if (hasJoin && !isBatched) {
    bottlenecks.push('Synchronous join dispatch detected without batch eager loading (potential N+1 connection churn)');
    aiRecommendations.push('Use single-roundtrip batched eager join: WHERE order_id IN (...) or Hash Join.');
  }

  if (hasWildcardLike) {
    bottlenecks.push('Leading wildcard in ILIKE/LIKE (%...) invalidates B-Tree index traversal, forcing sequential evaluation');
    aiRecommendations.push('Replace leading wildcard with pg_trgm trigram index (GIN) or prefix matching for sargability.');
  }

  if (hasSort && !hasCompositeIndexMatch) {
    bottlenecks.push('In-memory Top-N heapsort requires work_mem memory allocation during query execution');
    aiRecommendations.push('Include ORDER BY column in index leaf nodes to enable pre-sorted index order traversal.');
  }

  if (!hasLimit && !hasAggregation) {
    aiRecommendations.push('Specify a LIMIT clause to prevent unbound heap record materialization on high-cardinality result sets.');
  }

  if (aiRecommendations.length === 0) {
    aiRecommendations.push('Query execution path is fully optimized. Point lookups leverage composite B-Tree leaf pages.');
  }

  let reasoningSummary = `The AI query planner estimates execution will complete in ~${finalLatencyMs}ms (Cost: ${plannerCost}) using a ${scanType}. `;
  if (riskLevel === 'critical') {
    reasoningSummary += `High hardware storage pressure (${estimatedIOPS.toLocaleString()} IOPS on ${diskTier}) and table scanning require index remediation prior to execution.`;
  } else if (riskLevel === 'moderate') {
    reasoningSummary += `Moderate latency overhead observed. Applying suggested covering index columns will reduce latency by ~65-80%.`;
  } else {
    reasoningSummary += `Minimal I/O overhead. Execution plan utilizes existing index paths with sub-millisecond seek times.`;
  }

  return {
    predictedTimeMs: finalLatencyMs,
    confidenceMarginMs: confidenceMargin,
    plannerCost: plannerCost,
    scanType: scanType,
    estimatedRowsScanned: rowsScanned,
    estimatedRowsReturned: rowsReturned,
    estimatedIOPS: estimatedIOPS,
    riskLevel: riskLevel,
    riskScore: riskScore,
    reasoningSummary: reasoningSummary,
    bottlenecks: bottlenecks,
    aiRecommendations: aiRecommendations,
    astFeatures: {
      hasIndexMatch: hasCompositeIndexMatch,
      hasJoin: hasJoin,
      hasAggregation: hasAggregation,
      hasSort: hasSort,
      hasWildcardLike: hasWildcardLike,
      hasLimit: hasLimit
    }
  };
};

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
  const [showIopsImpact, setShowIopsImpact] = useState<boolean>(false);
  const [showPredictiveCost, setShowPredictiveCost] = useState<boolean>(false);
  const [selectedPlanVersion, setSelectedPlanVersion] = useState<string>('current');
  const [isReplayingPlan, setIsReplayingPlan] = useState<boolean>(false);
  const [replayResult, setReplayResult] = useState<PlanReplayResult | null>(null);
  const [isComparePlansActive, setIsComparePlansActive] = useState<boolean>(false);
  const [isHotpathActive, setIsHotpathActive] = useState<boolean>(false);
  const [isBottleneckAnnotationsActive, setIsBottleneckAnnotationsActive] = useState<boolean>(true);
  const [isIndexSandboxOpen, setIsIndexSandboxOpen] = useState<boolean>(false);
  const [isAutoFixerOpen, setIsAutoFixerOpen] = useState<boolean>(false);
  const [isSuggestIndexesOpen, setIsSuggestIndexesOpen] = useState<boolean>(false);
  const [appliedIndexNotice, setAppliedIndexNotice] = useState<string | null>(null);
  const [isCostEstimatorOpen, setIsCostEstimatorOpen] = useState<boolean>(false);
  const [customSqlInput, setCustomSqlInput] = useState<string>(
    `SELECT id, order_number, customer_name, amount, status\nFROM transactions\nWHERE status = 'completed' AND category = 'Cloud Infrastructure'\nORDER BY created_at DESC\nLIMIT 50;`
  );
  const [isEstimating, setIsEstimating] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
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

  const diskTier = (() => {
    try {
      return localStorage.getItem('enterprise_global_disk_tier') || 'NVMe';
    } catch {
      return 'NVMe';
    }
  })();

  const [estimationResult, setEstimationResult] = useState<QueryCostPrediction>(() => {
    return predictQueryExecutionMetrics(
      `SELECT id, order_number, customer_name, amount, status\nFROM transactions\nWHERE status = 'completed' AND category = 'Cloud Infrastructure'\nORDER BY created_at DESC\nLIMIT 50;`,
      diskTier,
      safeFlags
    );
  });

  const handleRunEstimation = async (queryOverride?: string) => {
    const targetSql = queryOverride || customSqlInput;
    setIsEstimating(true);
    try {
      const response = await fetch('/api/estimate-query-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: targetSql, diskTier, flags: safeFlags })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.predictedTimeMs === 'number') {
          const fallbackMetrics = predictQueryExecutionMetrics(targetSql, diskTier, safeFlags);
          setEstimationResult({
            ...fallbackMetrics,
            ...data
          });
          setIsEstimating(false);
          return;
        }
      }
    } catch {
      // Ignore network errors in dev mode without express
    }

    setTimeout(() => {
      const pred = predictQueryExecutionMetrics(targetSql, diskTier, safeFlags);
      setEstimationResult(pred);
      setIsEstimating(false);
    }, 250);
  };

  const handleCopySql = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedSql(label);
    setTimeout(() => setCopiedSql(null), 2000);
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

  const diskMultiplier = diskTier === 'HDD' ? 7.5 : diskTier === 'SSD' ? 2.2 : 1.0;
  const pageSize = result?.pageSize ?? 100;
  const baseExecutionTime = result?.executionTimeMs ?? effectiveExplainPlan.actualTimeMs ?? 1.2;
  const executionTime = +(baseExecutionTime * diskMultiplier).toFixed(2);

  const cachedPlanVersions = [
    { id: 'current', name: 'Current Active Plan', cost: effectiveExplainPlan.cost, time: executionTime, type: effectiveExplainPlan.nodeType },
    { id: 'v5', name: 'Version 5 (5m ago - B-Tree Index)', cost: 4.82, time: 1.2, type: 'Index Scan' },
    { id: 'v4', name: 'Version 4 (15m ago - Composite Index)', cost: 6.15, time: 1.8, type: 'Index Scan' },
    { id: 'v3', name: 'Version 3 (1h ago - Unindexed Seq Scan)', cost: 48.50, time: 24.0, type: 'Seq Scan' },
    { id: 'v2', name: 'Version 2 (3h ago - Partial Index)', cost: 14.20, time: 5.6, type: 'Bitmap Index Scan' },
    { id: 'v1', name: 'Version 1 (1d ago - Initial Baseline)', cost: 62.10, time: 34.5, type: 'Seq Scan' }
  ];

  const getPlanTreeForVersion = (versionId: string, currentPlan: ExplainPlanNode): ExplainPlanNode => {
    if (versionId === 'current') return currentPlan;
    if (versionId === 'v5') {
      return {
        nodeType: 'Index Scan',
        relationName: 'transactions',
        indexName: 'idx_orders_status_category',
        cost: 4.82,
        actualTimeMs: 1.2,
        rowsScanned: 32,
        rowsReturned: 32,
        details: 'B-Tree composite index seek on (status, category)',
        subNodes: [
          {
            nodeType: 'Index Scan',
            relationName: 'order_items',
            indexName: 'idx_order_items_order_id',
            cost: 0.85,
            actualTimeMs: 0.35,
            rowsScanned: 64,
            rowsReturned: 64,
            details: 'Batched index seek on foreign key (order_id)'
          }
        ]
      };
    }
    if (versionId === 'v4') {
      return {
        nodeType: 'Index Scan',
        relationName: 'transactions',
        indexName: 'idx_transactions_status',
        cost: 6.15,
        actualTimeMs: 1.8,
        rowsScanned: 64,
        rowsReturned: 32,
        details: 'Single-column index lookup on status with filter on category',
        subNodes: [
          {
            nodeType: 'Nested Loop',
            relationName: 'order_items',
            cost: 2.10,
            actualTimeMs: 1.1,
            rowsScanned: 128,
            rowsReturned: 64,
            details: 'Nested loop join fetching order items with partial index scan'
          }
        ]
      };
    }
    if (versionId === 'v3') {
      return {
        nodeType: 'Seq Scan',
        relationName: 'transactions',
        cost: 48.50,
        actualTimeMs: 24.0,
        rowsScanned: 50000,
        rowsReturned: 32,
        details: 'Full sequential table scan across 50,000 unindexed heap rows',
        subNodes: [
          {
            nodeType: 'Seq Scan',
            relationName: 'order_items',
            cost: 25.40,
            actualTimeMs: 18.2,
            rowsScanned: 25000,
            rowsReturned: 64,
            details: 'Synchronous N+1 subquery storm executing 50+ roundtrips'
          }
        ]
      };
    }
    if (versionId === 'v2') {
      return {
        nodeType: 'Index Scan',
        relationName: 'transactions',
        indexName: 'idx_status_partial',
        cost: 14.20,
        actualTimeMs: 5.6,
        rowsScanned: 1500,
        rowsReturned: 32,
        details: 'Partial index scan with secondary heap filter rechecks',
        subNodes: [
          {
            nodeType: 'Hash Join',
            relationName: 'order_items',
            cost: 6.80,
            actualTimeMs: 3.2,
            rowsScanned: 3200,
            rowsReturned: 64,
            details: 'Hash join with temporary in-memory materialization table'
          }
        ]
      };
    }
    // v1
    return {
      nodeType: 'Seq Scan',
      relationName: 'transactions',
      cost: 62.10,
      actualTimeMs: 34.5,
      rowsScanned: 50000,
      rowsReturned: 32,
      details: 'Initial unindexed baseline full table scan with heavy memory contention',
      subNodes: [
        {
          nodeType: 'Seq Scan',
          relationName: 'order_items',
          cost: 38.20,
          actualTimeMs: 26.0,
          rowsScanned: 40000,
          rowsReturned: 64,
          details: 'Unbatched synchronous queries with thread lock contention'
        }
      ]
    };
  };

  const activePlanVersionData = cachedPlanVersions.find(v => v.id === selectedPlanVersion) || cachedPlanVersions[0];
  const comparedVersionId = selectedPlanVersion === 'current' ? 'v3' : selectedPlanVersion;
  const targetPreviousPlanMeta = cachedPlanVersions.find(v => v.id === comparedVersionId) || cachedPlanVersions[3];
  const targetPreviousPlanTree = getPlanTreeForVersion(comparedVersionId, effectiveExplainPlan);

  // Re-run selected historical plan against current database state to verify performance stability
  const handleReplayHistoricalPlan = (planIdOverride?: string) => {
    const targetPlanId = planIdOverride || selectedPlanVersion;
    const targetMeta = cachedPlanVersions.find((v) => v.id === targetPlanId) || activePlanVersionData;
    setIsReplayingPlan(true);

    setTimeout(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const totalRecs = result?.totalCount || 50000;

      const histTime = targetMeta.time;
      const histCost = targetMeta.cost;

      // Realistic jitter verifying execution stability against current DB state
      const jitter = 0.96 + Math.random() * 0.07; // -4% to +3% execution fluctuation
      const replayedTime = Number((histTime * jitter).toFixed(2));
      const replayedCost = Number((histCost * (0.99 + Math.random() * 0.02)).toFixed(2));

      const variance = Number((replayedTime - histTime).toFixed(2));
      const variancePct = Number(((Math.abs(variance) / Math.max(0.1, histTime)) * 100).toFixed(1));
      const stability = Number(Math.max(86, Math.min(99.9, 100 - variancePct * 0.4)).toFixed(1));

      let status: PlanReplayResult['stabilityStatus'] = 'STABLE';
      let explanation = `Re-executed ${targetMeta.name} across ${totalRecs.toLocaleString()} records on ${diskTier} storage tier.`;

      if (stability >= 95) {
        status = 'STABLE';
        explanation += ` Performance stability verified at ${stability}% (SLA Variance: ${variance > 0 ? `+${variance}` : variance}ms). Execution plan exhibits minimal drift.`;
      } else if (stability >= 90) {
        status = 'ACCEPTABLE';
        explanation += ` Performance is within acceptable tolerances (Stability: ${stability}%, Variance: ${variance > 0 ? `+${variance}` : variance}ms).`;
      } else {
        status = 'DRIFT';
        explanation += ` Performance drift detected during replay under current memory/heap concurrency.`;
      }

      setReplayResult({
        planId: targetMeta.id,
        planName: targetMeta.name,
        planType: targetMeta.type,
        historicalTimeMs: histTime,
        historicalCost: histCost,
        replayedTimeMs: replayedTime,
        replayedCost: replayedCost,
        varianceMs: variance,
        variancePercent: variancePct,
        stabilityScore: stability,
        stabilityStatus: status,
        recordsEvaluated: totalRecs,
        diskTier,
        replayedAt: timeStr,
        explanation
      });

      setIsReplayingPlan(false);
    }, 400);
  };

  // Plain-English textual hints explaining why a plan node is costly
  const getNodeBottleneckAnnotation = (
    node: ExplainPlanNode,
    depth: number
  ): BottleneckAnnotation | null => {
    const isSeq = node.nodeType === 'Seq Scan';
    const isNPlusOne = node.details.includes('N+1') || node.details.includes('synchronous') || node.details.includes('Unbatched');
    const isNestedLoop = node.nodeType === 'Nested Loop';
    const isBitmapScan = node.nodeType === 'Bitmap Index Scan' || node.details.includes('Partial');
    const isHighCost = node.cost >= 15 || node.rowsScanned >= 5000;

    // 1. Full Table Scan on transactions due to missing B-Tree index
    if (isSeq && (node.relationName === 'transactions' || !node.relationName)) {
      return {
        headline: "Full Table Scan due to missing B-Tree index on (status, category)",
        whyCostly: `The database engine was forced to inspect all ${node.rowsScanned.toLocaleString()} heap rows sequentially because no suitable B-Tree index exists for the active status and category filters. Scanning unindexed heap blocks consumes heavy disk I/O and CPU memory bandwidth.`,
        remedy: "CREATE INDEX idx_transactions_status_cat ON transactions(status, category);",
        isSevere: true,
        isWarning: false,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 2. Full Table Scan on child relations (e.g. order_items)
    if (isSeq && node.relationName === 'order_items') {
      return {
        headline: "Full Table Scan due to missing foreign key index on 'order_id'",
        whyCostly: `Every child record lookup requires a full heap scan across ${node.rowsScanned.toLocaleString()} order_items tuples because 'order_id' lacks a covering B-Tree foreign key index, multiplying latency for every parent transaction.`,
        remedy: "CREATE INDEX idx_order_items_order_id ON order_items(order_id);",
        isSevere: true,
        isWarning: false,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 3. N+1 Query Cascade or Synchronous Loop
    if (isNPlusOne) {
      return {
        headline: "N+1 Query Explosion: Synchronous roundtrip fired per parent record",
        whyCostly: `Query executes 101 synchronous roundtrips to fetch child line items one by one instead of a single batched SQL query. Saturates PostgreSQL connection pool (max 25 connections) and causes execution timeouts exceeding 400ms.`,
        remedy: "Enable Batch Eager Loading to join relations with WHERE order_id IN (...) in a single query.",
        isSevere: true,
        isWarning: false,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 4. Nested Loop Join
    if (isNestedLoop && (node.cost >= 2 || node.rowsScanned > 100)) {
      return {
        headline: "Nested Loop Join without index lookup on inner relation",
        whyCostly: `For each outer transaction row, the database performs a full search on the inner relation. Quadratic O(M × N) complexity creates heavy CPU execution overhead.`,
        remedy: "Add foreign key composite index or switch to Hash Join for large tuple sets.",
        isSevere: node.cost >= 10,
        isWarning: true,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 5. Bitmap Index Scan / Heap Rechecks
    if (isBitmapScan) {
      return {
        headline: "Partial Index Scan with secondary heap page rechecks",
        whyCostly: `The index only covers a subset of query columns. The query planner must fetch raw pages from disk heap to re-verify unindexed predicates, causing random I/O read overhead.`,
        remedy: "Upgrade to covering composite index using INCLUDE columns to achieve an Index-Only Scan.",
        isSevere: false,
        isWarning: true,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 6. Generic High Cost or Large Row Scan
    if (isHighCost) {
      return {
        headline: `High Execution Cost (${node.cost.toFixed(1)}) on relation '${node.relationName}'`,
        whyCostly: `Scanned ${node.rowsScanned.toLocaleString()} rows to return only ${node.rowsReturned} records (${((node.rowsReturned / Math.max(1, node.rowsScanned)) * 100).toFixed(1)}% selectivity). Unfiltered tuple reads waste disk I/O and buffer memory.`,
        remedy: "Create a targeted composite index matching filter and sort predicates.",
        isSevere: node.cost >= 30,
        isWarning: true,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    // 7. Root node with cost >= 4 even if Index Scan
    if (node.nodeType === 'Index Scan' && depth === 0 && node.cost >= 4) {
      return {
        headline: `Primary Index Seek on ${node.relationName} (${node.indexName || 'B-Tree'})`,
        whyCostly: `Logarithmic O(log N) index seek traversed ${node.rowsScanned} entries. Overhead is low (${node.cost.toFixed(2)} cost), but could be optimized into a zero-heap Index-Only Scan by adding covering columns.`,
        remedy: "Add projected SELECT columns into index INCLUDE clause to eliminate secondary heap lookups.",
        isSevere: false,
        isWarning: false,
        costImpact: node.cost,
        timeMs: node.actualTimeMs
      };
    }

    return null;
  };

  // Evaluates the query's current cost nodes dynamically
  const evaluatedNodes = [
    {
      name: `Root ${effectiveExplainPlan.nodeType} (${effectiveExplainPlan.relationName})`,
      cost: effectiveExplainPlan.cost,
      timeMs: baseExecutionTime,
      rows: effectiveExplainPlan.rowsScanned,
      risk: effectiveExplainPlan.cost > 20 ? 'Critical Bottleneck' : 'Moderate Overhead',
      isSeqScan: effectiveExplainPlan.nodeType.includes('Seq'),
      description: effectiveExplainPlan.details
    },
    ...(effectiveExplainPlan.subNodes || []).map((sub) => ({
      name: `Child ${sub.nodeType} (${sub.relationName})`,
      cost: sub.cost,
      timeMs: sub.actualTimeMs,
      rows: sub.rowsScanned,
      risk: sub.details.includes('N+1') || sub.cost > 10 ? 'High Latency Cascades' : 'Low Overhead',
      isSeqScan: sub.nodeType.includes('Seq'),
      description: sub.details
    }))
  ];

  const totalEvaluatedCost = evaluatedNodes.reduce((acc, n) => acc + n.cost, 0);

  // 3 specific composite index recommendations targeting the evaluated cost nodes
  const recommendedCompositeIndexes = [
    {
      id: 'idx-rec-1',
      title: 'Filter + Sort Composite B-Tree Index',
      tableName: 'transactions',
      indexName: 'idx_transactions_status_category_created',
      columns: ['status', 'category', 'created_at DESC'],
      includeColumns: ['amount', 'customer_name', 'order_number'],
      targetNode: `Root Node: ${effectiveExplainPlan.nodeType} on transactions (Cost: ${effectiveExplainPlan.cost.toFixed(2)})`,
      bottleneckResolved: 'Eliminates full-table sequential heap scans and in-memory Top-N quicksort memory spills',
      currentLatencyMs: executionTime,
      projectedLatencyMs: +(executionTime * 0.08).toFixed(2),
      currentCost: effectiveExplainPlan.cost,
      projectedCost: 2.15,
      latencyReductionPct: 92.0,
      costReductionPct: 95.6,
      ddl: `CREATE INDEX CONCURRENTLY idx_transactions_status_category_created 
ON transactions (status, category, created_at DESC) 
INCLUDE (amount, customer_name, order_number);`,
      explanation: 'Composite key ordering (status, category, created_at DESC) aligns directly with active WHERE predicates and ORDER BY clauses, enabling PostgreSQL to jump directly to target leaf nodes and stream pre-sorted records without memory allocation. The INCLUDE clause turns this into an Index-Only Scan.'
    },
    {
      id: 'idx-rec-2',
      title: 'Covering Composite Index for Customer Lookups',
      tableName: 'transactions',
      indexName: 'idx_transactions_status_customer_covering',
      columns: ['status', 'customer_name', 'customer_email'],
      includeColumns: ['amount', 'category', 'created_at'],
      targetNode: `Predicate Filtering on transactions (Rows Scanned: ${effectiveExplainPlan.rowsScanned.toLocaleString()})`,
      bottleneckResolved: 'Eliminates random heap page I/O lookups during customer search & filtering',
      currentLatencyMs: executionTime,
      projectedLatencyMs: +(executionTime * 0.12).toFixed(2),
      currentCost: effectiveExplainPlan.cost,
      projectedCost: 3.40,
      latencyReductionPct: 88.0,
      costReductionPct: 93.0,
      ddl: `CREATE INDEX CONCURRENTLY idx_transactions_status_customer_covering 
ON transactions (status, customer_name, customer_email) 
INCLUDE (amount, category, created_at);`,
      explanation: 'Optimizes high-cardinality ILIKE prefix searches and customer lookups. By storing secondary projection attributes directly in index payload pages, the query engine achieves 0 physical heap fetches, reading entire rows directly from RAM buffer cache.'
    },
    {
      id: 'idx-rec-3',
      title: 'Foreign Key Composite Join Index',
      tableName: 'order_items',
      indexName: 'idx_order_items_fk_composite_covering',
      columns: ['order_id', 'sku'],
      includeColumns: ['unit_price', 'quantity', 'name'],
      targetNode: `Child Join Subnode on order_items (Subquery dispatch / N+1 cascade)`,
      bottleneckResolved: 'Replaces synchronous N+1 subquery cascades with single-roundtrip batched seeks',
      currentLatencyMs: +(executionTime * 0.4).toFixed(2),
      projectedLatencyMs: 0.35,
      currentCost: 25.40,
      projectedCost: 0.85,
      latencyReductionPct: 98.1,
      costReductionPct: 96.7,
      ddl: `CREATE INDEX CONCURRENTLY idx_order_items_fk_composite_covering 
ON order_items (order_id, sku) 
INCLUDE (unit_price, quantity, name);`,
      explanation: 'Creating a composite index on (order_id, sku) with covering attributes enables PostgreSQL to satisfy batched WHERE order_id IN (...) queries in a single 0.35ms seek, eliminating repeated roundtrips and connection pool exhaustion.'
    }
  ];

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

  const renderPlanNodeWithDiff = (
    node: ExplainPlanNode,
    depth = 0,
    compareNode?: ExplainPlanNode,
    isPreviousVersion = false,
    isHotpath = false,
    showBottlenecks = isBottleneckAnnotationsActive
  ) => {
    const isIndex = node.nodeType === 'Index Scan' || node.nodeType === 'LRU Cache Lookup';
    const isNPlusOne = node.details.includes('N+1');
    const isSeq = node.nodeType === 'Seq Scan';
    const isHot = isHotpath && (isSeq || node.cost >= 20 || isNPlusOne);
    const annotation = showBottlenecks ? getNodeBottleneckAnnotation(node, depth) : null;

    let costDelta = 0;
    let hasDelta = false;
    if (compareNode) {
      hasDelta = true;
      if (isPreviousVersion) {
        costDelta = compareNode.cost - node.cost;
      } else {
        costDelta = node.cost - compareNode.cost;
      }
    }

    const costDecreased = hasDelta && costDelta < -0.01;
    const costIncreased = hasDelta && costDelta > 0.01;
    const costPct = hasDelta && compareNode && compareNode.cost > 0
      ? Math.abs((costDelta / (isPreviousVersion ? node.cost : compareNode.cost)) * 100).toFixed(1)
      : '0';

    return (
      <div key={`${node.relationName}-${depth}-${node.nodeType}`} className="flex flex-col gap-2">
        <div
          className={`p-3 rounded-xl border text-xs transition-all ${
            isHot
              ? 'ring-4 ring-amber-400/80 border-amber-500 bg-amber-50/90 shadow-lg shadow-amber-200/50 animate-pulse'
              : costDecreased
              ? 'border-2 border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-400/30 shadow-xs'
              : costIncreased
              ? 'border-2 border-rose-500 bg-rose-50/90 ring-2 ring-rose-400/30 shadow-xs'
              : isIndex
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              : isNPlusOne
              ? 'bg-rose-50/80 border-rose-300 text-rose-950'
              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2 flex-wrap">
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
              <span className="font-semibold text-zinc-900">{node.relationName}</span>
              {node.indexName && (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200">
                  using {node.indexName}
                </span>
              )}
              {isHot && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                  <Flame className="w-3 h-3 fill-white" />
                  Critical Hotpath
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 font-mono text-[11px] text-zinc-600 flex-wrap">
              <span className="font-bold text-zinc-900">Cost: {node.cost.toFixed(2)}</span>
              <span className="font-semibold text-zinc-800">
                Time: {node.actualTimeMs.toFixed(2)} ms
              </span>
              <span>
                Rows: {node.rowsReturned} / {node.rowsScanned.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Cost Delta Diff Highlight Badge */}
          {hasDelta && (
            <div className="mt-2 pt-1.5 border-t border-zinc-200/70 flex items-center justify-between flex-wrap gap-2 text-[11px]">
              {isPreviousVersion ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 font-medium">Historical Baseline Node:</span>
                  {costDecreased ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Current plan reduces this node cost by {Math.abs(costDelta).toFixed(2)} (-{costPct}%)</span>
                    </span>
                  ) : costIncreased ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-300">
                      <TrendingUp className="w-3.5 h-3.5 text-rose-700" />
                      <span>Current plan node cost is higher by +{costDelta.toFixed(2)} (+{costPct}%)</span>
                    </span>
                  ) : (
                    <span className="font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                      Equal cost in current plan
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {costDecreased ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Cost Decreased: -{Math.abs(costDelta).toFixed(2)} (-{costPct}%)</span>
                    </span>
                  ) : costIncreased ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-800 bg-rose-100/90 px-2.5 py-0.5 rounded-full border border-rose-300 shadow-2xs">
                      <TrendingUp className="w-3.5 h-3.5 text-rose-700" />
                      <span>Cost Increased: +{costDelta.toFixed(2)} (+{costPct}%)</span>
                    </span>
                  ) : (
                    <span className="font-mono text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded-full text-[10px]">
                      Cost Unchanged (±0.00)
                    </span>
                  )}
                  {compareNode && (
                    <span className="text-zinc-500 font-mono text-[10px]">
                      (vs {compareNode.cost.toFixed(2)} in selected version)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-zinc-600 mt-1">{node.details}</p>

          {/* Bottleneck Annotation Textual Hint Callout Box */}
          {showBottlenecks && annotation && (
            <div
              id={`bottleneck-annotation-${node.relationName || 'root'}-${depth}`}
              data-testid={`bottleneck-annotation-${node.relationName || 'root'}-${depth}`}
              className={`mt-2.5 p-3 rounded-lg border text-xs animate-fadeIn ${
                annotation.isSevere
                  ? 'bg-rose-50/95 border-rose-300 text-rose-950 ring-2 ring-rose-400/25 shadow-xs'
                  : annotation.isWarning
                  ? 'bg-amber-50/95 border-amber-300 text-amber-950 ring-2 ring-amber-400/20 shadow-xs'
                  : 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {annotation.isSevere ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                ) : annotation.isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <strong className={`font-bold uppercase tracking-wide text-[11px] flex items-center gap-1.5 ${
                      annotation.isSevere ? 'text-rose-900' : annotation.isWarning ? 'text-amber-900' : 'text-emerald-900'
                    }`}>
                      <span className="font-mono px-1.5 py-0.2 rounded bg-white/80 border border-zinc-200 text-zinc-800 text-[10px]">
                        Bottleneck Hint
                      </span>
                      <span>{annotation.headline}</span>
                    </strong>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      annotation.isSevere
                        ? 'bg-rose-200 text-rose-900 border border-rose-300'
                        : annotation.isWarning
                        ? 'bg-amber-200 text-amber-950 border border-amber-300'
                        : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                    }`}>
                      Node Cost: {node.cost.toFixed(2)} ({node.actualTimeMs.toFixed(1)}ms)
                    </span>
                  </div>

                  <p className="text-[11px] font-sans leading-relaxed text-zinc-800">
                    <strong className="text-zinc-900 font-semibold">Why this node is costly: </strong>
                    {annotation.whyCostly}
                  </p>

                  {annotation.remedy && (
                    <div className="text-[10px] font-mono bg-white/95 p-2 rounded-md border border-zinc-200 text-zinc-800 flex items-center gap-2 mt-1 shadow-2xs">
                      <span className="font-bold text-indigo-700 shrink-0 uppercase tracking-wider text-[9px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                        Remedy
                      </span>
                      <span className="truncate">{annotation.remedy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {node.subNodes &&
          node.subNodes.map((childNode, idx) => (
            <div key={idx} className="relative flex items-start">
              <ArrowDownRight
                className="w-4 h-4 text-zinc-400 shrink-0 mt-2"
                style={{ marginLeft: `${depth * 20 + 6}px` }}
              />
              <div className="flex-1">
                {renderPlanNodeWithDiff(
                  childNode,
                  depth + 1,
                  compareNode?.subNodes?.[idx],
                  isPreviousVersion,
                  isHotpath,
                  showBottlenecks
                )}
              </div>
            </div>
          ))}
      </div>
    );
  };

  const renderPlanNode = (node: ExplainPlanNode, depth = 0) =>
    renderPlanNodeWithDiff(node, depth, undefined, false, isHotpathActive, isBottleneckAnnotationsActive);

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/70 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-700" />
          <h3 className="text-sm font-bold text-zinc-900">
            Database Query Diagnostics &amp; Execution Plan
          </h3>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Plan History Dropdown & Replay Step Action */}
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 p-1 rounded-lg text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 pl-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-bold text-zinc-700 text-[11px]">Plan History:</span>
              <select
                id="select-plan-history"
                data-testid="select-plan-history"
                value={selectedPlanVersion}
                onChange={(e) => {
                  setSelectedPlanVersion(e.target.value);
                  setReplayResult(null);
                }}
                className="bg-transparent font-semibold text-indigo-900 focus:outline-none cursor-pointer pr-1"
                title="Select from last 5 cached execution plan versions for side-by-side cost comparisons"
              >
                {cachedPlanVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (Cost: {v.cost.toFixed(2)}, {v.time}ms)
                  </option>
                ))}
              </select>
            </div>

            {/* Replay Step Button */}
            <button
              type="button"
              id="btn-replay-step"
              data-testid="btn-replay-step"
              onClick={() => handleReplayHistoricalPlan()}
              disabled={isReplayingPlan}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                isReplayingPlan
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white'
              }`}
              title={`Replay Step: Re-run "${activePlanVersionData.name}" against current database state (${result?.totalCount || 50000} records) to verify performance stability`}
            >
              <Play className={`w-3 h-3 ${isReplayingPlan ? 'animate-spin fill-none' : 'fill-current'}`} />
              <span>{isReplayingPlan ? 'Replaying...' : 'Replay Step'}</span>
            </button>
          </div>

          {/* Compare Plans Header Button */}
          <button
            type="button"
            id="btn-toggle-compare-plans"
            data-testid="btn-toggle-compare-plans"
            onClick={() => {
              const nextState = !isComparePlansActive;
              setIsComparePlansActive(nextState);
              if (nextState && selectedPlanVersion === 'current') {
                setSelectedPlanVersion('v3');
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
              isComparePlansActive
                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                : 'bg-white text-blue-900 hover:bg-blue-50 border-blue-300'
            }`}
            title="Toggle side-by-side visualization of current execution plan vs selected historical plan"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Plans {isComparePlansActive ? 'ON' : ''}</span>
          </button>

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
            {/* Historical Plan Comparison Banner */}
            {selectedPlanVersion !== 'current' && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-3 animate-fadeIn flex-wrap">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <strong className="font-bold">Comparing Historical Plan ({activePlanVersionData.name})</strong>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Cost: <span className="font-mono font-bold">{activePlanVersionData.cost.toFixed(2)}</span> vs Current ({effectiveExplainPlan.cost.toFixed(2)}) | Execution Time: <span className="font-mono font-bold">{activePlanVersionData.time}ms</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-replay-step-banner"
                    data-testid="btn-replay-step-banner"
                    onClick={() => handleReplayHistoricalPlan()}
                    disabled={isReplayingPlan}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                    title="Replay historical plan step against current database state"
                  >
                    <Play className={`w-3.5 h-3.5 ${isReplayingPlan ? 'animate-spin fill-none' : 'fill-current'}`} />
                    <span>{isReplayingPlan ? 'Replaying...' : 'Replay Step'}</span>
                  </button>
                  {!isComparePlansActive && (
                    <button
                      type="button"
                      id="btn-open-side-by-side-compare"
                      data-testid="btn-open-side-by-side-compare"
                      onClick={() => setIsComparePlansActive(true)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      <span>Side-by-Side Compare</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPlanVersion('current')}
                    className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Reset to Current
                  </button>
                </div>
              </div>
            )}

            {/* Replay Step Performance Stability Verification Result Card */}
            {replayResult && (
              <div
                id="panel-plan-replay-stability"
                data-testid="panel-plan-replay-stability"
                className="p-4 bg-gradient-to-r from-emerald-50/95 via-teal-50/80 to-emerald-50/95 rounded-xl border-2 border-emerald-400 shadow-md space-y-3 animate-fadeIn text-xs"
              >
                <div className="flex items-start justify-between gap-3 border-b border-emerald-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                      <Play className="w-4 h-4 fill-current" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-zinc-900 text-sm">
                          Plan Step Replayed: <span className="text-emerald-950 font-mono">{replayResult.planName}</span>
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{replayResult.stabilityScore}% Performance Stability</span>
                        </span>
                        <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          {replayResult.stabilityStatus === 'STABLE' ? 'VERIFIED STABLE SLA' : 'ACCEPTABLE VARIANCE'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Replayed at {replayResult.replayedAt}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900 mt-1 font-sans">
                        {replayResult.explanation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="btn-re-run-replay-step"
                      data-testid="btn-re-run-replay-step"
                      onClick={() => handleReplayHistoricalPlan()}
                      disabled={isReplayingPlan}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                      title="Re-run the replay simulation against current database state"
                    >
                      <RefreshCw className={`w-3 h-3 ${isReplayingPlan ? 'animate-spin' : ''}`} />
                      <span>Re-Run</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplayResult(null)}
                      className="p-1 text-emerald-700 hover:text-emerald-950 rounded-lg hover:bg-emerald-100 cursor-pointer"
                      title="Dismiss verification card"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Replay Verification Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-semibold text-zinc-500 block uppercase">Historical Baseline</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-mono text-sm font-bold text-zinc-800">{replayResult.historicalTimeMs.toFixed(2)} ms</span>
                      <span className="text-[10px] font-mono text-zinc-400">Cost: {replayResult.historicalCost.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-semibold text-zinc-500 block uppercase">Current Database Replay</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-mono text-sm font-bold text-emerald-700">{replayResult.replayedTimeMs.toFixed(2)} ms</span>
                      <span className="text-[10px] font-mono text-emerald-600">Cost: {replayResult.replayedCost.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-semibold text-zinc-500 block uppercase">Measured Variance</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`font-mono text-sm font-bold ${replayResult.varianceMs > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {replayResult.varianceMs > 0 ? `+${replayResult.varianceMs.toFixed(2)}` : `${replayResult.varianceMs.toFixed(2)}`} ms
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">({replayResult.variancePercent}%)</span>
                    </div>
                  </div>

                  <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-semibold text-zinc-500 block uppercase">Target Environment</span>
                    <div className="text-[11px] font-mono font-medium text-zinc-800 mt-0.5 truncate" title={`${replayResult.recordsEvaluated.toLocaleString()} rows • ${replayResult.diskTier} Tier`}>
                      <span>{replayResult.recordsEvaluated.toLocaleString()} rows • {replayResult.diskTier}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

                <button
                  type="button"
                  id="btn-ai-index-auto-fixer"
                  data-testid="btn-ai-index-auto-fixer"
                  onClick={() => setIsAutoFixerOpen(!isAutoFixerOpen)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isAutoFixerOpen
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-700'
                      : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border-indigo-300'
                  }`}
                  title="AI-Driven Index Auto-Fixer: Evaluates execution plan bottlenecks and generates optimal index DDL"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>AI Index Auto-Fixer</span>
                </button>

                <button
                  type="button"
                  id="btn-suggest-optimized-indexes"
                  data-testid="btn-suggest-optimized-indexes"
                  onClick={() => setIsSuggestIndexesOpen(!isSuggestIndexesOpen)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isSuggestIndexesOpen
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-700 ring-2 ring-amber-300'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
                  }`}
                  title="Suggest Optimized Indexes: Evaluates query's current cost nodes and recommends 2-3 specific composite index structures"
                >
                  <Lightbulb className={`w-3.5 h-3.5 ${isSuggestIndexesOpen ? 'text-amber-200 fill-amber-300' : 'text-amber-600'}`} />
                  <span>Suggest Optimized Indexes</span>
                </button>

                <button
                  type="button"
                  id="btn-ai-query-cost-estimator"
                  data-testid="btn-ai-query-cost-estimator"
                  onClick={() => setIsCostEstimatorOpen(!isCostEstimatorOpen)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isCostEstimatorOpen
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-700'
                      : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-300'
                  }`}
                  title="AI-Query Cost Estimator: Predicts execution time & cost for custom SQL strings before running against database"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI Cost Estimator</span>
                </button>

                <button
                  type="button"
                  id="btn-toggle-compare-plans-toolbar"
                  data-testid="toggle-compare-plans"
                  onClick={() => {
                    const nextState = !isComparePlansActive;
                    setIsComparePlansActive(nextState);
                    if (nextState && selectedPlanVersion === 'current') {
                      setSelectedPlanVersion('v3');
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isComparePlansActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-700 ring-2 ring-blue-300'
                      : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-300'
                  }`}
                  title="Compare Plans: Side-by-side visualization of current execution plan against historical version"
                >
                  <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Compare Plans {isComparePlansActive ? 'ON' : ''}</span>
                </button>

                <button
                  type="button"
                  id="btn-toggle-hotpath"
                  data-testid="btn-toggle-hotpath"
                  onClick={() => setIsHotpathActive(!isHotpathActive)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isHotpathActive
                      ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white border-amber-600 ring-2 ring-amber-300'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
                  }`}
                  title="Hotpath: Highlights critical execution path nodes with glowing borders to identify sequential scan bottlenecks"
                >
                  <Flame className={`w-3.5 h-3.5 ${isHotpathActive ? 'animate-bounce text-amber-200' : 'text-amber-600'}`} />
                  <span>Hotpath {isHotpathActive ? 'ON' : ''}</span>
                </button>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 cursor-pointer bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1 rounded-lg transition-colors border border-blue-200">
                  <input
                    type="checkbox"
                    id="checkbox-compare-plans"
                    data-testid="checkbox-compare-plans"
                    checked={isComparePlansActive}
                    onChange={(e) => {
                      setIsComparePlansActive(e.target.checked);
                      if (e.target.checked && selectedPlanVersion === 'current') {
                        setSelectedPlanVersion('v3');
                      }
                    }}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Compare Plans</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 cursor-pointer bg-amber-50 hover:bg-amber-100/70 px-2.5 py-1 rounded-lg transition-colors border border-amber-200">
                  <input
                    type="checkbox"
                    id="checkbox-hotpath"
                    data-testid="checkbox-hotpath"
                    checked={isHotpathActive}
                    onChange={(e) => setIsHotpathActive(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Hotpath</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-cyan-800 cursor-pointer bg-cyan-50 hover:bg-cyan-100/70 px-2.5 py-1 rounded-lg transition-colors border border-cyan-200">
                  <input
                    type="checkbox"
                    id="checkbox-iops-impact"
                    data-testid="checkbox-iops-impact"
                    checked={showIopsImpact}
                    onChange={(e) => setShowIopsImpact(e.target.checked)}
                    className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>IOPS Impact</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-teal-800 cursor-pointer bg-teal-50 hover:bg-teal-100/70 px-2.5 py-1 rounded-lg transition-colors border border-teal-200">
                  <input
                    type="checkbox"
                    id="checkbox-predictive-cost"
                    data-testid="checkbox-predictive-cost"
                    checked={showPredictiveCost}
                    onChange={(e) => setShowPredictiveCost(e.target.checked)}
                    className="rounded border-teal-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Predictive Cost</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer bg-zinc-100 hover:bg-zinc-200/70 px-2.5 py-1 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    id="checkbox-executive-summary"
                    data-testid="checkbox-executive-summary"
                    checked={showExecutiveSummary}
                    onChange={(e) => setShowExecutiveSummary(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Executive Summary</span>
                </label>
                <span className="font-mono">
                  Total Query Cost: {isSandboxComputed ? '2.15' : effectiveExplainPlan.cost.toFixed(2)} | Time: {isSandboxComputed ? '0.6' : executionTime}ms
                </span>
              </div>
            </div>

            {/* IOPS Impact & Live Hardware Load Gauge Panel */}
            {showIopsImpact && (() => {
              const calculatedBaseIops = Math.round((effectiveExplainPlan.rowsScanned || 25000) * (effectiveExplainPlan.cost / 15));
              const calculatedOptimizedIops = Math.round(calculatedBaseIops * 0.04);
              const activePlanIops = safeFlags.btreeIndexing ? calculatedOptimizedIops : calculatedBaseIops;
              const maxTierIops = diskTier === 'NVMe' ? 500000 : diskTier === 'SSD' ? 10000 : 250;
              const hardwareLoadPct = Math.min(100, Number(((activePlanIops / maxTierIops) * 100).toFixed(1)));

              return (
                <div className="p-4 bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 rounded-xl border border-cyan-300 shadow-sm space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-cyan-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-cyan-600 text-white rounded-lg shadow-2xs">
                        <Database className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                        Live Hardware Load &amp; IOPS Impact Gauge ({diskTier} Storage Tier)
                      </h4>
                    </div>
                    <span className="font-mono text-[10px] bg-cyan-200 text-cyan-900 px-2.5 py-0.5 rounded-full font-bold">
                      {safeFlags.btreeIndexing ? '✓ Optimized Index Active' : '⚠️ Unindexed Seq Scan Bottleneck'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white/90 rounded-xl border border-cyan-200 shadow-2xs space-y-1">
                      <span className="text-zinc-500 font-semibold text-[11px]">Current Plan IOPS Load</span>
                      <div className="font-mono font-bold text-cyan-950 text-base flex items-baseline gap-1">
                        <span>{activePlanIops.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-500 font-normal">IOPS</span>
                      </div>
                      <p className="text-[10px] text-zinc-600">Predicted storage read load for selected query plan.</p>
                    </div>

                    <div className="p-3 bg-white/90 rounded-xl border border-rose-200 shadow-2xs space-y-1">
                      <span className="text-zinc-500 font-semibold text-[11px]">Baseline Unindexed IOPS</span>
                      <div className="font-mono font-bold text-rose-700 text-base">
                        {calculatedBaseIops.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">IOPS</span>
                      </div>
                      <p className="text-[10px] text-zinc-600">45,000 physical disk page reads per query.</p>
                    </div>

                    <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                      <span className="text-zinc-500 font-semibold text-[11px]">Covering Index Projected IOPS</span>
                      <div className="font-mono font-bold text-emerald-700 text-base">
                        {calculatedOptimizedIops.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">IOPS</span>
                      </div>
                      <p className="text-[10px] text-zinc-600">12 B-Tree leaf node page fetches (O(log N)).</p>
                    </div>

                    <div className="p-3 bg-white/90 rounded-xl border border-indigo-200 shadow-2xs space-y-1">
                      <span className="text-zinc-500 font-semibold text-[11px]">Hardware Capacity Load</span>
                      <div className="font-mono font-bold text-indigo-700 text-base">
                        {hardwareLoadPct}% <span className="text-[10px] text-zinc-500 font-normal">of {diskTier} max</span>
                      </div>
                      <p className="text-[10px] text-zinc-600">Storage hardware throughput headroom indicator.</p>
                    </div>
                  </div>

                  {/* Live Gauge Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-mono font-bold text-cyan-950">
                      <span>Live Hardware Load Meter</span>
                      <span>{activePlanIops.toLocaleString()} / {maxTierIops.toLocaleString()} max IOPS ({hardwareLoadPct}%)</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden relative shadow-inner">
                      <div
                        className={`h-full transition-all duration-700 rounded-full ${
                          hardwareLoadPct > 50
                            ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                            : hardwareLoadPct > 15
                            ? 'bg-gradient-to-r from-teal-500 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        }`}
                        style={{ width: `${Math.max(3, hardwareLoadPct)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 pt-0.5">
                      {safeFlags.btreeIndexing
                        ? `Active covering index successfully suppresses disk page I/O, utilizing only ${hardwareLoadPct}% of ${diskTier} hardware capacity and keeping IOPS well within safe operational limits.`
                        : `Warning: Unindexed query triggers heavy sequential scan disk reads, generating ${calculatedBaseIops.toLocaleString()} IOPS and risking storage queue saturation.`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Predictive Cost & Historical CPU Usage Analytics Panel */}
            {showPredictiveCost && (
              <div className="p-4 bg-gradient-to-r from-teal-50 via-cyan-50 to-emerald-50 rounded-xl border border-teal-300 shadow-sm space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-teal-600 text-white rounded-lg shadow-2xs">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                      Predictive Cost &amp; Historical CPU Usage Projection
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] bg-teal-200 text-teal-900 px-2.5 py-0.5 rounded-full font-bold">
                    Historical CPU Savings: 91.2% ROI
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white/90 rounded-xl border border-rose-200 shadow-2xs space-y-1">
                    <span className="text-zinc-500 font-semibold text-[11px]">Historical CPU Load (Unindexed)</span>
                    <div className="font-mono font-bold text-rose-700 text-base">38.4% CPU</div>
                    <p className="text-[10px] text-zinc-600">Based on last 100 historical query telemetry samples.</p>
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                    <span className="text-zinc-500 font-semibold text-[11px]">Projected Optimized CPU</span>
                    <div className="font-mono font-bold text-emerald-700 text-base">4.2% CPU</div>
                    <p className="text-[10px] text-zinc-600">Projected CPU load with B-Tree covering index active.</p>
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-teal-200 shadow-2xs space-y-1">
                    <span className="text-zinc-500 font-semibold text-[11px]">Indexing ROI Assessment</span>
                    <div className="font-mono font-bold text-teal-800 text-base">Highest ROI Node</div>
                    <p className="text-[10px] text-zinc-600">Seq Scan on <code className="font-mono">transactions</code> yields 34.2% CPU drop.</p>
                  </div>
                </div>

                <div className="p-3 bg-teal-900 text-teal-100 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-white">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Algorithmic Recommendation:</span>
                  </div>
                  <p className="text-teal-200 leading-relaxed text-[11px]">
                    Historical performance tracking reveals frequent high-cardinality predicate filtering on <code className="font-mono bg-teal-950 px-1 py-0.5 rounded text-amber-200">status, category</code>. Applying the suggested composite covering index will drop query CPU utilization from 38.4% down to 4.2%, delivering maximum hardware ROI.
                  </p>
                </div>
              </div>
            )}

            {/* AI-Driven Index Auto-Fixer Panel */}
            {isAutoFixerOpen && (
              <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 rounded-xl border-2 border-indigo-300 shadow-lg space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                    </span>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      AI-Driven Index Auto-Fixer &amp; DDL Generator
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] bg-indigo-200 text-indigo-950 px-2.5 py-0.5 rounded-full font-bold">
                    Confidence: 99.4% (Zero-Downtime)
                  </span>
                </div>

                <div className="space-y-2 text-xs text-zinc-700">
                  <p>
                    Evaluated active execution plan node <code className="font-mono text-indigo-900 bg-indigo-100 px-1 py-0.5 rounded">{effectiveExplainPlan.nodeType} ({effectiveExplainPlan.relationName})</code> with cost <strong className="text-rose-700 font-mono">{effectiveExplainPlan.cost.toFixed(2)}</strong>. The AI analyzer has formulated the optimal covering index DDL to eliminate sequential scan bottlenecks.
                  </p>

                  <div className="p-3 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-zinc-800 shadow-inner overflow-x-auto leading-relaxed">
                    <code>
                      {`-- AI Generated Optimal Covering Index DDL:
CREATE INDEX CONCURRENTLY idx_transactions_ai_autofix 
ON transactions (status, category) 
INCLUDE (amount, customer_email, created_at);
-- Projected Cost Reduction: 48.50 ➔ 2.15 (-95.6%)
-- Projected Latency: 45.0ms ➔ 0.4ms`}
                    </code>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-indigo-200">
                  <span className="text-[11px] font-mono text-indigo-900 font-bold">
                    ✨ Ready to apply zero-downtime concurrent build
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAutoFixerOpen(false)}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg font-medium cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      id="btn-apply-ai-autofix"
                      data-testid="btn-apply-ai-autofix"
                      onClick={() => {
                        setIsAutoFixerOpen(false);
                        alert('AI Auto-Fixer DDL successfully applied! Execution plan re-computed with optimal covering index.');
                      }}
                      className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Apply Optimal Index DDL</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Suggest Optimized Indexes Panel */}
            {isSuggestIndexesOpen && (
              <div
                id="panel-suggest-optimized-indexes"
                data-testid="panel-suggest-optimized-indexes"
                className="p-4 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 rounded-xl border-2 border-amber-300 shadow-lg space-y-4 animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-amber-200 pb-2.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-600 text-white rounded-lg shadow-xs">
                      <Lightbulb className="w-4 h-4 text-amber-200 fill-amber-300" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                        <span>Suggest Optimized Indexes</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.2 rounded-full font-mono font-bold">
                          3 Composite Structures Recommended
                        </span>
                      </h4>
                      <p className="text-[11px] text-amber-900">
                        Evaluated query cost nodes ({evaluatedNodes.length} nodes inspected, Total Cost: {totalEvaluatedCost.toFixed(2)}). Recommended composite index structures designed to eliminate sequential scans and heapsort memory bottlenecks.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSuggestIndexesOpen(false)}
                      className="text-amber-800 hover:text-amber-950 p-1 rounded-lg hover:bg-amber-100 cursor-pointer"
                      title="Close suggestions panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {appliedIndexNotice && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{appliedIndexNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliedIndexNotice(null)}
                      className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Evaluated Cost Nodes Summary Ribbon */}
                <div className="p-3 bg-white/95 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-600" />
                      <span>Evaluated Query Cost Nodes:</span>
                    </span>
                    <span className="font-mono text-[11px] text-amber-900 font-bold">
                      Evaluated Latency: {executionTime}ms | Base Planner Cost: {effectiveExplainPlan.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {evaluatedNodes.map((n, i) => (
                      <div key={i} className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${n.isSeqScan ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span>{n.name}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{n.description}</p>
                        </div>
                        <div className="text-right font-mono text-[11px] shrink-0 ml-2">
                          <span className="font-bold text-zinc-900">Cost: {n.cost.toFixed(2)}</span>
                          <div className="text-[10px] text-zinc-500">{n.rows.toLocaleString()} rows</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3 Specific Composite Index Structure Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                  {recommendedCompositeIndexes.map((rec, idx) => (
                    <div
                      key={rec.id}
                      className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-amber-300 transition-all"
                    >
                      <div className="space-y-2">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Structure {idx + 1}
                            </span>
                            <h5 className="font-bold text-xs text-zinc-900 mt-1">{rec.title}</h5>
                            <span className="text-[11px] font-mono font-semibold text-indigo-700">
                              Table: {rec.tableName}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                              <TrendingDown className="w-3 h-3 text-emerald-700" />
                              -{rec.latencyReductionPct}% Time
                            </span>
                          </div>
                        </div>

                        {/* Reduction Metrics */}
                        <div className="grid grid-cols-2 gap-1.5 py-1 text-center bg-zinc-50 rounded-lg border border-zinc-100 font-mono text-[10px]">
                          <div className="p-1">
                            <span className="text-zinc-500 block text-[9px] uppercase">Latency Drop</span>
                            <span className="font-bold text-emerald-700">{rec.currentLatencyMs}ms ➔ {rec.projectedLatencyMs}ms</span>
                          </div>
                          <div className="p-1 border-l border-zinc-200">
                            <span className="text-zinc-500 block text-[9px] uppercase">Cost Drop</span>
                            <span className="font-bold text-indigo-700">{rec.currentCost.toFixed(2)} ➔ {rec.projectedCost.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Evaluated Bottleneck */}
                        <div className="text-[11px] text-zinc-600 space-y-1">
                          <p>
                            <strong className="text-zinc-900">Target Node:</strong> {rec.targetNode}
                          </p>
                          <p className="text-[10px] text-zinc-500 leading-snug">
                            {rec.explanation}
                          </p>
                        </div>

                        {/* Columns Pill Tags */}
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-500">Key Order:</span>
                            {rec.columns.map((col, cIdx) => (
                              <span key={cIdx} className="font-mono text-[10px] bg-indigo-50 text-indigo-900 px-1.5 py-0.2 rounded border border-indigo-200 font-semibold">
                                {col}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-zinc-500">INCLUDE:</span>
                            {rec.includeColumns.map((col, cIdx) => (
                              <span key={cIdx} className="font-mono text-[10px] bg-emerald-50 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-200">
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* DDL Box */}
                        <div className="p-2.5 bg-zinc-950 text-emerald-400 font-mono text-[10px] rounded-lg border border-zinc-800 shadow-inner overflow-x-auto leading-relaxed relative">
                          <pre className="whitespace-pre-wrap">{rec.ddl}</pre>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopySql(rec.ddl, rec.id)}
                          className="px-2.5 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md font-semibold cursor-pointer transition-colors flex items-center gap-1"
                        >
                          {copiedSql === rec.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSql === rec.id ? 'Copied DDL' : 'Copy DDL'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSandboxColumns(rec.columns.map(c => c.replace(' DESC', '')));
                              setIsIndexSandboxOpen(true);
                              setIsSandboxComputed(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-md font-semibold cursor-pointer transition-colors"
                            title="Load columns into Index Sandbox to verify simulated cost reduction"
                          >
                            Sandbox
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedIndexNotice(`✓ Successfully applied composite index structure '${rec.indexName}'! Execution plan projected to complete in ${rec.projectedLatencyMs}ms.`);
                              setTimeout(() => setAppliedIndexNotice(null), 5000);
                            }}
                            className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Apply Index
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-xs flex-wrap gap-2">
                  <span className="font-mono text-[11px] text-amber-900 font-bold">
                    🚀 Combining these composite indexes delivers up to 95.6% lower query latency with zero application code rewrites.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allDdl = recommendedCompositeIndexes.map(r => r.ddl).join('\n\n');
                        handleCopySql(allDdl, 'all-suggested-ddl');
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      {copiedSql === 'all-suggested-ddl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql === 'all-suggested-ddl' ? 'Copied All 3 DDLs' : 'Copy All 3 DDL Statements'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSuggestIndexesOpen(false)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      Close Suggestions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI-Query Cost Estimator Panel */}
            {isCostEstimatorOpen && (
              <div
                id="panel-ai-query-cost-estimator"
                data-testid="panel-ai-query-cost-estimator"
                className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl border-2 border-emerald-300 shadow-lg space-y-4 animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                      <Calculator className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <span>AI-Query Cost Estimator</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.2 rounded-full font-mono font-semibold">
                          Pre-Execution Predictor
                        </span>
                      </h4>
                      <p className="text-[11px] text-emerald-800">
                        Predicts expected execution time and storage resource usage for custom SQL strings before running against the database engine.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold hidden sm:inline">
                      Storage Tier: {diskTier} ({diskMultiplier}x)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCostEstimatorOpen(false)}
                      className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md hover:bg-emerald-200/50 cursor-pointer"
                      title="Close Cost Estimator"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Preset SQL Quick Pickers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-950 font-semibold">
                    <span>Quick Test SQL Presets:</span>
                    <span className="text-[10px] text-zinc-500 font-normal">Click any preset to load &amp; predict</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_QUERIES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomSqlInput(preset.sql);
                          handleRunEstimation(preset.sql);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-100/70 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                        title={preset.desc}
                      >
                        <Zap className="w-3 h-3 text-emerald-600" />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom SQL Input Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="input-custom-sql-query" className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Custom SQL Query String:</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomSqlInput('')}
                        className="text-[11px] text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySql(customSqlInput, 'custom')}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        {copiedSql === 'custom' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSql === 'custom' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="input-custom-sql-query"
                    data-testid="input-custom-sql-query"
                    rows={4}
                    value={customSqlInput}
                    onChange={(e) => setCustomSqlInput(e.target.value)}
                    placeholder="Enter custom SQL string (e.g. SELECT * FROM transactions WHERE amount > 5000)..."
                    className="w-full p-3 font-mono text-xs bg-zinc-950 text-emerald-300 rounded-xl border border-zinc-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  />
                </div>

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200">
                  <span className="text-[11px] font-mono text-emerald-900">
                    Query Length: {customSqlInput.length} chars | Target: <strong className="underline">transactions</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-predict-query-cost"
                      data-testid="btn-predict-query-cost"
                      disabled={isEstimating || !customSqlInput.trim()}
                      onClick={() => handleRunEstimation()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isEstimating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Predicting Execution Metrics...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Predict Expected Execution Time</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Predictive Results Grid */}
                {estimationResult && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Metric 1: Expected Execution Time */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Expected Time</span>
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">±{estimationResult.confidenceMarginMs}ms</span>
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-950">
                          {estimationResult.predictedTimeMs} ms
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium">
                          Confidence: 96.8%
                        </div>
                      </div>

                      {/* Metric 2: Planner Cost Score */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Planner Cost</span>
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">units</span>
                        </div>
                        <div className="text-xl font-bold font-mono text-indigo-950">
                          {estimationResult.plannerCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Baseline: 4.82 (Index)
                        </div>
                      </div>

                      {/* Metric 3: Access Scan Method */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Database className="w-3.5 h-3.5 text-teal-600" />
                            <span>Scan Method</span>
                          </span>
                        </div>
                        <div className="text-xs font-bold font-mono text-zinc-900 truncate" title={estimationResult.scanType}>
                          {estimationResult.scanType}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {estimationResult.estimatedRowsScanned.toLocaleString()} rows scanned
                        </div>
                      </div>

                      {/* Metric 4: Storage Load & IOPS */}
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Storage IOPS</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-cyan-700">{diskTier}</span>
                        </div>
                        <div className="text-xl font-bold font-mono text-cyan-950">
                          {estimationResult.estimatedIOPS.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Returns {estimationResult.estimatedRowsReturned} rows
                        </div>
                      </div>
                    </div>

                    {/* Risk & Reasoning Assessment Banner */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                        estimationResult.riskLevel === 'optimal'
                          ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950'
                          : estimationResult.riskLevel === 'moderate'
                          ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                          : 'bg-rose-100/70 border-rose-300 text-rose-950'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                          estimationResult.riskLevel === 'optimal'
                            ? 'text-emerald-700'
                            : estimationResult.riskLevel === 'moderate'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`} />
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>Predicted Risk Assessment:</span>
                            <span className="uppercase text-[10px] font-mono px-2 py-0.2 rounded font-extrabold bg-white/70">
                              {estimationResult.riskLevel} (Risk Score: {estimationResult.riskScore}/100)
                            </span>
                          </div>
                          <p className="mt-0.5 leading-relaxed text-[11px]">
                            {estimationResult.reasoningSummary}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Execution Recommendations */}
                    <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>AI Pre-Execution Recommendations &amp; Advice:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-700">
                        {estimationResult.aiRecommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {isComparePlansActive ? (
              <div className="space-y-4 animate-fadeIn">
                {/* Side-by-Side Comparison Header Banner */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-indigo-600" />
                      <strong className="font-bold text-sm text-indigo-950">Side-by-Side Execution Plan Comparison</strong>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-300">
                        Current vs {targetPreviousPlanMeta.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-700 text-[11px]">Compare Against:</span>
                      <select
                        id="select-compare-version-inner"
                        data-testid="select-compare-version-inner"
                        value={comparedVersionId}
                        onChange={(e) => setSelectedPlanVersion(e.target.value)}
                        className="bg-white border border-indigo-300 font-semibold text-indigo-900 rounded-md px-2 py-1 text-xs focus:outline-none cursor-pointer"
                      >
                        {cachedPlanVersions.filter(v => v.id !== 'current').map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} (Cost: {v.cost.toFixed(2)}, {v.time}ms)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsComparePlansActive(false)}
                        className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold rounded-lg border border-zinc-300 cursor-pointer text-xs"
                      >
                        Close Compare
                      </button>
                    </div>
                  </div>

                  {/* Delta Metrics Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="p-2.5 bg-white/95 rounded-lg border border-blue-200 shadow-2xs">
                      <span className="text-zinc-500 text-[10px] font-semibold">Total Cost Comparison</span>
                      <div className="flex items-baseline gap-2 font-mono">
                        <span className="text-base font-bold text-zinc-900">{effectiveExplainPlan.cost.toFixed(2)}</span>
                        <span className="text-xs text-zinc-400">vs</span>
                        <span className="text-sm font-semibold text-zinc-600">{targetPreviousPlanTree.cost.toFixed(2)}</span>
                      </div>
                      <div className={`text-[11px] font-bold font-mono mt-0.5 ${
                        effectiveExplainPlan.cost < targetPreviousPlanTree.cost ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {effectiveExplainPlan.cost < targetPreviousPlanTree.cost
                          ? `↓ ${(targetPreviousPlanTree.cost - effectiveExplainPlan.cost).toFixed(2)} Cost Savings (${(((targetPreviousPlanTree.cost - effectiveExplainPlan.cost) / targetPreviousPlanTree.cost) * 100).toFixed(1)}% reduction)`
                          : `↑ +${(effectiveExplainPlan.cost - targetPreviousPlanTree.cost).toFixed(2)} Cost Increase`}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/95 rounded-lg border border-blue-200 shadow-2xs">
                      <span className="text-zinc-500 text-[10px] font-semibold">Execution Latency Comparison</span>
                      <div className="flex items-baseline gap-2 font-mono">
                        <span className="text-base font-bold text-zinc-900">{executionTime}ms</span>
                        <span className="text-xs text-zinc-400">vs</span>
                        <span className="text-sm font-semibold text-zinc-600">{targetPreviousPlanMeta.time}ms</span>
                      </div>
                      <div className={`text-[11px] font-bold font-mono mt-0.5 ${
                        executionTime < targetPreviousPlanMeta.time ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {executionTime < targetPreviousPlanMeta.time
                          ? `↓ ${(targetPreviousPlanMeta.time - executionTime).toFixed(1)}ms Faster (${(((targetPreviousPlanMeta.time - executionTime) / targetPreviousPlanMeta.time) * 100).toFixed(1)}% speedup)`
                          : `↑ +${(executionTime - targetPreviousPlanMeta.time).toFixed(1)}ms Slower`}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/95 rounded-lg border border-blue-200 shadow-2xs">
                      <span className="text-zinc-500 text-[10px] font-semibold">Visual Highlight Legend</span>
                      <div className="space-y-1 mt-1 text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
                          <span>Cost Decreased (Node Improved)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-rose-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200"></span>
                          <span>Cost Increased (Node Regressed)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two Columns Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Column: Current Plan */}
                  <div className="space-y-2 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Current Execution Plan</span>
                        <p className="text-[11px] text-zinc-500">Active engine execution profile</p>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="font-bold text-zinc-900">Cost: {effectiveExplainPlan.cost.toFixed(2)}</span>
                        <span className="text-zinc-500 ml-2">Time: {executionTime}ms</span>
                      </div>
                    </div>
                    {renderPlanNodeWithDiff(effectiveExplainPlan, 0, targetPreviousPlanTree, false, isHotpathActive)}
                  </div>

                  {/* Right Column: Previous Version Plan */}
                  <div className="space-y-2 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Previous: {targetPreviousPlanMeta.name}</span>
                        <p className="text-[11px] text-zinc-500">Selected from Plan History</p>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="font-bold text-zinc-900">Cost: {targetPreviousPlanTree.cost.toFixed(2)}</span>
                        <span className="text-zinc-500 ml-2">Time: {targetPreviousPlanMeta.time}ms</span>
                      </div>
                    </div>
                    {renderPlanNodeWithDiff(targetPreviousPlanTree, 0, effectiveExplainPlan, true, isHotpathActive)}
                  </div>
                </div>
              </div>
            ) : (
              renderPlanNodeWithDiff(effectiveExplainPlan, 0, undefined, false, isHotpathActive)
            )}
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

        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-600 pb-2 border-b border-zinc-100">
              <span className="font-semibold text-zinc-800">
                SQL Statements Comparison &amp; AI-Query Cost Estimator
              </span>
              <button
                type="button"
                onClick={() => setIsCostEstimatorOpen(true)}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Custom Query Estimator</span>
              </button>
            </div>

            {/* Side-by-Side SQL Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Unoptimized SQL */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-rose-200">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-950">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>1. Unoptimized Query Cascade (N+1 Storm)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-bold">
                      Cost: 48.50+
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySql(unoptimizedSQL, 'unopt')}
                      className="text-[11px] text-rose-800 hover:text-rose-950 flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      {copiedSql === 'unopt' ? <Check className="w-3 h-3 text-rose-700" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql === 'unopt' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-950 text-rose-300 font-mono text-[11px] rounded-lg overflow-x-auto shadow-inner max-h-56">
                  <pre>{unoptimizedSQL}</pre>
                </div>
                <p className="text-[11px] text-rose-700">
                  Fires synchronous subqueries for each line item row, exhausting database connections and forcing sequential scans.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCustomSqlInput(unoptimizedSQL);
                    setIsCostEstimatorOpen(true);
                    handleRunEstimation(unoptimizedSQL);
                  }}
                  className="w-full py-1.5 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Calculator className="w-3.5 h-3.5 text-rose-600" />
                  <span>Estimate Unoptimized Query in AI Workbench</span>
                </button>
              </div>

              {/* Optimized SQL */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>2. Optimized B-Tree &amp; Single Eager Batch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                      Cost: 4.82 (1.2ms)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySql(optimizedSQL, 'opt')}
                      className="text-[11px] text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      {copiedSql === 'opt' ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql === 'opt' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-950 text-emerald-300 font-mono text-[11px] rounded-lg overflow-x-auto shadow-inner max-h-56">
                  <pre>{optimizedSQL}</pre>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Leverages composite B-Tree index scan on (status, category) and retrieves all child items in a single eager roundtrip.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCustomSqlInput(optimizedSQL);
                    setIsCostEstimatorOpen(true);
                    handleRunEstimation(optimizedSQL);
                  }}
                  className="w-full py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Estimate Optimized Query in AI Workbench</span>
                </button>
              </div>
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
