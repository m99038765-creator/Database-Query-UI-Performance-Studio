import React, { useState, useEffect, useMemo } from 'react';
import { Database, Layers, Key, Link, AlertTriangle, CheckCircle2, Shield, ArrowRight, Zap, Table, Plus, Info, X, Download, Sparkles, History, Target, RefreshCw, Trash2, ChevronDown, ChevronRight, ChevronUp, Search, Filter, Activity, HeartPulse } from 'lucide-react';
import { OptimizationFlags } from '../types';

interface DatabaseSchemaExplorerViewProps {
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onClose?: () => void;
}

export interface SchemaSnapshot {
  id: string;
  name: string;
  timestamp: string;
  flags: OptimizationFlags;
  customIndexes: string[];
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
  const [showClusterAnalysisModal, setShowClusterAnalysisModal] = useState<boolean>(false);
  const [showIndexCleanupModal, setShowIndexCleanupModal] = useState<boolean>(false);
  const [isScanningCleanup, setIsScanningCleanup] = useState<boolean>(false);
  const [cleanupScanCompleted, setCleanupScanCompleted] = useState<boolean>(false);
  const [removedIndexes, setRemovedIndexes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'explorer' | 'dependency-chain'>('explorer');
  const [showWorkloadOptimizationModal, setShowWorkloadOptimizationModal] = useState<boolean>(false);
  const [isAutoOptimizingWorkload, setIsAutoOptimizingWorkload] = useState<boolean>(false);
  const [autoOptimizedCompleted, setAutoOptimizedCompleted] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [indexSearchQuery, setIndexSearchQuery] = useState<string>('');
  const [indexCategoryFilter, setIndexCategoryFilter] = useState<string>('all');
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);
  const [isExportingState, setIsExportingState] = useState<boolean>(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string>('idx_transactions_email_status');
  const [suggestionFilterTab, setSuggestionFilterTab] = useState<'all' | 'filter' | 'join' | 'composite'>('all');

  useEffect(() => {
    // Automatically expand the selected table category when selectedTable changes
    setCollapsedCategories((prev) => ({
      ...prev,
      [selectedTable]: false
    }));
  }, [selectedTable]);

  const expensiveQueriesWorkload = [
    {
      id: 'Q1',
      name: 'Multi-Column Category & Amount Range Aggregation',
      sql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category',
      frequency: '8,900 queries/hr',
      executionShare: '38.4% of DB read CPU time',
      unindexedLatency: '482 ms',
      optimizedLatency: '1.9 ms',
      speedup: '99.6%',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      optimalIndexName: 'idx_transactions_category_amount',
      optimalIndexType: 'Composite B-Tree (category, amount)',
      isToggled: createdCompositeIndexes.includes('category_amount'),
      impactExplanation: 'Replaces full table scan with an O(log n) composite index range seek, eliminating in-memory sorting and secondary lookups.'
    },
    {
      id: 'Q2',
      name: 'Customer Order Verification & Status Lookup',
      sql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20',
      frequency: '5,120 queries/hr',
      executionShare: '29.1% of DB read CPU time',
      unindexedLatency: '395 ms',
      optimizedLatency: '1.6 ms',
      speedup: '99.6%',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      optimalIndexName: 'idx_transactions_email_status',
      optimalIndexType: 'Composite B-Tree (customer_email, status)',
      isToggled: createdCompositeIndexes.includes('email_status'),
      impactExplanation: 'Co-locates customer email and order status in composite leaf nodes, preventing duplicate table lookups.'
    },
    {
      id: 'Q3',
      name: 'Active Order Dashboard & Pipeline Status Filtering',
      sql: 'SELECT * FROM transactions WHERE status = ? AND category = ?',
      frequency: '12,400 queries/hr',
      executionShare: '18.7% of DB read CPU time',
      unindexedLatency: '310 ms',
      optimizedLatency: '1.4 ms',
      speedup: '99.5%',
      throughputBefore: '32 QPS',
      throughputAfter: '7,140 QPS',
      optimalIndexName: 'idx_orders_status_cat',
      optimalIndexType: 'Composite B-Tree (status, category)',
      isToggled: flags.btreeIndexing,
      impactExplanation: 'Provides multi-column b-tree seek for high-frequency dashboard polling queries.'
    },
    {
      id: 'Q4',
      name: 'Relational Order Line-Items Child Join Storm',
      sql: 'SELECT * FROM line_items WHERE transaction_id IN (...)',
      frequency: '15,000 queries/hr',
      executionShare: '13.8% of DB read CPU time',
      unindexedLatency: '840 ms',
      optimizedLatency: '3.2 ms',
      speedup: '99.6%',
      throughputBefore: '12 QPS',
      throughputAfter: '3,125 QPS',
      optimalIndexName: 'idx_line_items_tx',
      optimalIndexType: 'Foreign Key B-Tree (transaction_id)',
      isToggled: flags.batchEagerLoading,
      impactExplanation: 'Collapses sequential N+1 relational sub-queries into a single index-accelerated batched hash join.'
    }
  ];

  const indexSuggestions = useMemo(() => [
    {
      id: 'idx_transactions_email_status',
      name: 'idx_transactions_email_status',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email', 'status'],
      type: 'Composite B-Tree',
      patternType: 'Compound Filter & Sort Clause',
      patternCategory: 'composite' as const,
      speedup: '99.8%',
      speedupFactor: '246x Faster',
      latencyBefore: '395 ms',
      latencyAfter: '1.6 ms',
      frequency: '5,120 queries/hr',
      executionShare: '29.1% of DB read CPU time',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      storageOverhead: '+4.2 MB (+8.7% footprint)',
      writeImpact: '+0.9ms on batch insert/update',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20;',
      targetQueryName: 'Customer Order Verification & Status Lookup',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Compound Equality)',
          code: 'WHERE customer_email = ? AND status = ?',
          explanation: 'Requires filtering both customer identity and order status simultaneously. With single-column indexes, the database planner must retrieve table heap pages to check the status field for every row matching email.'
        },
        {
          clauseType: 'Sort Clause (Indexed Ordering)',
          code: 'ORDER BY created_at DESC LIMIT 20',
          explanation: 'Forces an in-memory or temporary disk Sort buffer unless index leaf keys are already clustered or compound-seekable, leading to high latency spikes.'
        }
      ],
      whyExplanation: 'Single-column indexes on customer_email force the engine to inspect heap table pages for each candidate to evaluate status, incurring secondary table lookups and cache churn. The composite index co-locates both attributes directly in adjacent B-Tree leaf pages, enabling index-only candidate filtering and skipping 99.4% of table I/O reads.',
      plannerMechanics: 'The PostgreSQL / Cloud SQL query planner replaces an expensive Bitmap Heap Scan and in-memory filter recheck with a direct Index Scan seeking straight to the matching leaf nodes.',
      planBefore: "Seq Scan on transactions (cost=0.00..1845.00 rows=12 width=142)\n  Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      planAfter: "Index Scan using idx_transactions_email_status on transactions (cost=0.42..8.45 rows=12 width=142)\n  Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      isApplied: createdCompositeIndexes.includes('email_status'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('email_status')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'email_status'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'email_status']);
        }
      }
    },
    {
      id: 'idx_line_items_tx',
      name: 'idx_line_items_tx',
      targetTable: 'line_items',
      targetEntity: 'Order Items Entity',
      targetColumns: ['transaction_id'],
      type: 'Foreign Key B-Tree',
      patternType: 'Table Join Clause (N+1 Elimination)',
      patternCategory: 'join' as const,
      speedup: '99.6%',
      speedupFactor: '233x Faster',
      latencyBefore: '420 ms',
      latencyAfter: '1.8 ms',
      frequency: '15,000 queries/hr',
      executionShare: '24.5% of DB read CPU time',
      throughputBefore: '18 QPS',
      throughputAfter: '4,545 QPS',
      storageOverhead: '+3.1 MB (+6.4% footprint)',
      writeImpact: '+0.4ms on item insert',
      querySql: 'SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);',
      targetQueryName: 'Relational Order Items Detail Expansion',
      triggeringClauses: [
        {
          clauseType: 'Table Join Clause (Foreign Key Equality)',
          code: 'INNER JOIN transactions t ON line_items.transaction_id = transactions.id',
          explanation: 'Relational child join connecting line items to parent transactions. Without an index on foreign key transaction_id, each join lookup requires a full sequential scan of the 200,000-row child table.'
        },
        {
          clauseType: 'Filter Clause (Batched Transaction Lookup)',
          code: 'WHERE transactions.id IN (?)',
          explanation: 'When loading an order dashboard displaying multiple transactions, expanding line items triggers separate sequential scans per order (N+1 query storm).'
        }
      ],
      whyExplanation: 'Foreign key columns in relational databases do not automatically receive secondary indexes. Joining transactions with line_items forces the query planner into a Nested Loop with sequential scans on line_items (O(N*M) complexity). Adding idx_line_items_tx allows O(1) batched hash joins and logarithmic seeks, completely eliminating N+1 query storms.',
      plannerMechanics: 'The query optimizer converts a Nested Loop (Sequential Scan) into a Hash Join backed by a B-Tree Index Scan, reducing child table page reads from 2,400 pages to 4 pages.',
      planBefore: "Nested Loop (cost=0.00..4120.00 rows=350 width=88)\n  -> Seq Scan on transactions\n  -> Seq Scan on line_items Filter: (transaction_id = t.id)",
      planAfter: "Hash Join (cost=8.45..42.10 rows=350 width=88) Hash Cond: (li.transaction_id = t.id)\n  -> Index Scan using idx_line_items_tx on line_items li",
      isApplied: flags.batchEagerLoading,
      onToggle: () => onToggleFlag('batchEagerLoading')
    },
    {
      id: 'idx_transactions_category_amount',
      name: 'idx_transactions_category_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['category', 'amount'],
      type: 'Composite B-Tree',
      patternType: 'Filter + Range Aggregation Clause',
      patternCategory: 'composite' as const,
      speedup: '99.2%',
      speedupFactor: '253x Faster',
      latencyBefore: '482 ms',
      latencyAfter: '1.9 ms',
      frequency: '8,900 queries/hr',
      executionShare: '38.4% of DB read CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      storageOverhead: '+6.8 MB (+14.1% footprint)',
      writeImpact: '+1.1ms on batch write',
      querySql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category;',
      targetQueryName: 'Multi-Column Category & Amount Range Aggregation',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Equality on Partition Category)',
          code: 'WHERE category = ?',
          explanation: 'Categorical equality filter selecting the target merchandise department or product class.'
        },
        {
          clauseType: 'Range Filter Clause (Numeric Threshold)',
          code: 'AND amount > ?',
          explanation: 'Numeric inequality predicate requiring boundary seeks across large transaction volumes.'
        },
        {
          clauseType: 'Grouping Clause (In-Memory Aggregation)',
          code: 'GROUP BY category',
          explanation: 'Forces HashAggregate or Sort buffers if candidate keys are not already contiguous in leaf pages.'
        }
      ],
      whyExplanation: 'Filtering by equality on category AND a range condition on amount with single-column indexing leaves thousands of unneeded rows to be scanned and sorted in RAM. The composite index puts category first (equality), then amount (range), allowing the engine to seek directly to the category branch and scan only matching amount leaves with zero sorting overhead.',
      plannerMechanics: 'Replaces HashAggregate and temporary disk spillover with a stream-lined GroupAggregate read directly from ordered composite leaf pages.',
      planBefore: "HashAggregate (cost=1950.00..1960.00 rows=8 width=44)\n  -> Seq Scan on transactions Filter: ((category = 'Electronics'::text) AND (amount > 100.00))",
      planAfter: "GroupAggregate (cost=0.42..18.20 rows=8 width=44)\n  -> Index Scan using idx_transactions_category_amount on transactions Index Cond: ((category = 'Electronics'::text) AND (amount > 100.00))",
      isApplied: createdCompositeIndexes.includes('category_amount'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('category_amount')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'category_amount'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'category_amount']);
        }
      }
    },
    {
      id: 'idx_transactions_customer_email',
      name: 'idx_transactions_customer_email',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email'],
      type: 'Single-Column B-Tree',
      patternType: 'Filter Clause (Equality & Search)',
      patternCategory: 'filter' as const,
      speedup: '99.7%',
      speedupFactor: '241x Faster',
      latencyBefore: '72.4 ms',
      latencyAfter: '0.3 ms',
      frequency: '14,250 queries/hr',
      executionShare: '19.3% of DB read CPU time',
      throughputBefore: '14 QPS',
      throughputAfter: '3,330 QPS',
      storageOverhead: '+3.4 MB (+7.0% footprint)',
      writeImpact: '+0.5ms on user signup/order',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ?;',
      targetQueryName: 'Customer Account Profile & History Lookup',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Equality Predicate)',
          code: 'WHERE customer_email = ?',
          explanation: 'Point lookup clause matching unique customer email addresses across 50,000+ orders.'
        }
      ],
      whyExplanation: 'Without an index on customer_email, every customer login, receipt lookup, or profile load forces a full table scan across 50,000 records. An equality B-Tree index provides logarithmic O(log n) pointer traversal down root, branch, and leaf nodes, resolving in 0.3ms.',
      plannerMechanics: 'The query planner converts a full Seq Scan reading every page on disk into an Index Scan that retrieves only the matching record pointers.',
      planBefore: "Seq Scan on transactions (cost=0.00..1480.00 rows=3 width=128)\n  Filter: (customer_email = 'customer@domain.com'::text)",
      planAfter: "Index Scan using idx_transactions_customer_email on transactions (cost=0.42..8.44 rows=3 width=128)\n  Index Cond: (customer_email = 'customer@domain.com'::text)",
      isApplied: createdCustomIndexes.includes('customer_email'),
      onToggle: () => {
        if (createdCustomIndexes.includes('customer_email')) {
          setCreatedCustomIndexes(createdCustomIndexes.filter(c => c !== 'customer_email'));
        } else {
          setCreatedCustomIndexes([...createdCustomIndexes, 'customer_email']);
        }
      }
    },
    {
      id: 'idx_transactions_amount',
      name: 'idx_transactions_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['amount'],
      type: 'Single-Column B-Tree',
      patternType: 'Range Filter Clause',
      patternCategory: 'filter' as const,
      speedup: '95.4%',
      speedupFactor: '85x Faster',
      latencyBefore: '68.2 ms',
      latencyAfter: '0.8 ms',
      frequency: '6,400 queries/hr',
      executionShare: '12.8% of DB read CPU time',
      throughputBefore: '15 QPS',
      throughputAfter: '1,250 QPS',
      storageOverhead: '+2.8 MB (+5.8% footprint)',
      writeImpact: '+0.4ms on order insert',
      querySql: 'SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC;',
      targetQueryName: 'High-Value Order Threshold Inspection',
      triggeringClauses: [
        {
          clauseType: 'Range Filter Clause (Numeric Inequality)',
          code: 'WHERE amount > 500.00',
          explanation: 'Filters transactions exceeding fraud detection and risk review thresholds.'
        },
        {
          clauseType: 'Sort Clause (Descending Ordering)',
          code: 'ORDER BY amount DESC',
          explanation: 'Orders high-value results from largest to smallest.'
        }
      ],
      whyExplanation: 'Range filter clauses on numeric amounts require scanning all table rows unless an ordered B-Tree index provides a fast lower-bound seek pointer. Once the leaf node matching 500.00 is located, the engine traverses linked leaf pages in descending order without sorting.',
      plannerMechanics: 'Leverages natural bidirectional B-Tree leaf node chains with Index Scan Backward, bypassing in-memory sorting.',
      planBefore: "Sort (cost=1490.00..1495.00 rows=200 width=128) Sort Key: amount DESC\n  -> Seq Scan on transactions Filter: (amount > 500.00)",
      planAfter: "Index Scan Backward using idx_transactions_amount on transactions (cost=0.42..35.10 rows=200 width=128)\n  Index Cond: (amount > 500.00)",
      isApplied: createdCustomIndexes.includes('amount'),
      onToggle: () => {
        if (createdCustomIndexes.includes('amount')) {
          setCreatedCustomIndexes(createdCustomIndexes.filter(c => c !== 'amount'));
        } else {
          setCreatedCustomIndexes([...createdCustomIndexes, 'amount']);
        }
      }
    },
    {
      id: 'idx_orders_status_cat',
      name: 'idx_orders_status_cat',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['status', 'category'],
      type: 'Composite B-Tree',
      patternType: 'Compound Filter & Sort Clause',
      patternCategory: 'composite' as const,
      speedup: '99.5%',
      speedupFactor: '221x Faster',
      latencyBefore: '310 ms',
      latencyAfter: '1.4 ms',
      frequency: '12,400 queries/hr',
      executionShare: '18.7% of DB read CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,000 QPS',
      storageOverhead: '+4.0 MB (+8.3% footprint)',
      writeImpact: '+0.7ms on status change',
      querySql: 'SELECT * FROM transactions WHERE status = ? AND category = ?;',
      targetQueryName: 'Active Order Dashboard & Pipeline Status Filtering',
      triggeringClauses: [
        {
          clauseType: 'Compound Filter Clause (Categorical Equality)',
          code: 'WHERE status = ? AND category = ?',
          explanation: 'Operational dashboard query run continuously by customer support and warehouse teams.'
        }
      ],
      whyExplanation: 'Because status has low selectivity (only 4 distinct values: pending, completed, cancelled, refunded), a single-column index on status alone still forces the engine to inspect tens of thousands of rows to check category. The composite index groups status + category together, reducing the search space from 50,000 rows to fewer than 50 rows in a single index seek.',
      plannerMechanics: 'Prevents low-selectivity index scan fallbacks where the query planner would otherwise revert to a full table sequential scan.',
      planBefore: "Seq Scan on transactions (cost=0.00..1520.00 rows=45 width=128)\n  Filter: ((status = 'pending'::text) AND (category = 'Electronics'::text))",
      planAfter: "Index Scan using idx_orders_status_cat on transactions (cost=0.42..12.30 rows=45 width=128)\n  Index Cond: ((status = 'pending'::text) AND (category = 'Electronics'::text))",
      isApplied: flags.btreeIndexing,
      onToggle: () => onToggleFlag('btreeIndexing')
    }
  ], [createdCustomIndexes, createdCompositeIndexes, flags, onToggleFlag]);

  const handleAutoOptimizeWorkload = () => {
    setIsAutoOptimizingWorkload(true);
    setTimeout(() => {
      // 1. Toggle core B-Tree flags for expensive queries
      if (!flags.btreeIndexing) {
        onToggleFlag('btreeIndexing');
      }
      if (!flags.batchEagerLoading) {
        onToggleFlag('batchEagerLoading');
      }

      // 2. Toggle optimal composite B-Tree indexes for multi-column predicates
      setCreatedCompositeIndexes(['email_status', 'category_amount']);

      // 3. Ensure single-column indexes are set
      setCreatedCustomIndexes((prev) => Array.from(new Set([...prev, 'customer_email', 'amount'])));

      // 4. Prune dead unutilized index (idx_transactions_date) to prevent buffer cache pollution
      setRemovedIndexes((prev) => Array.from(new Set([...prev, 'idx_transactions_date'])));

      setIsAutoOptimizingWorkload(false);
      setAutoOptimizedCompleted(true);
      setHasAnalyzedWorkload(true);
      setShowWorkloadOptimizationModal(true);
    }, 650);
  };

  const handleRunIndexCleanupScan = () => {
    setShowIndexCleanupModal(true);
    setIsScanningCleanup(true);
    setTimeout(() => {
      setIsScanningCleanup(false);
      setCleanupScanCompleted(true);
    }, 750);
  };

  const isIndexUnutilized = (idxName: string) => {
    if (removedIndexes.includes(idxName)) return false;
    if (idxName === 'idx_transactions_date') return true;
    if (idxName.includes('amount_missing')) return true;
    if (idxName.includes('email_missing')) return true;
    return false;
  };

  const handleRemoveUnutilizedIndex = (idxName: string) => {
    if (!removedIndexes.includes(idxName)) {
      setRemovedIndexes((prev) => [...prev, idxName]);
    }
    if (idxName.includes('email_missing')) {
      setCreatedCustomIndexes((prev) => prev.filter((c) => c !== 'customer_email'));
    }
    if (idxName.includes('amount_missing')) {
      setCreatedCustomIndexes((prev) => prev.filter((c) => c !== 'amount'));
    }
  };

  const handleRestoreRemovedIndex = (idxName: string) => {
    setRemovedIndexes((prev) => prev.filter((n) => n !== idxName));
  };

  const handleRemoveAllUnutilized = () => {
    const unutilized = ['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'];
    setRemovedIndexes((prev) => Array.from(new Set([...prev, ...unutilized])));
    setCreatedCustomIndexes((prev) => prev.filter((c) => c !== 'customer_email' && c !== 'amount'));
  };

  const unutilizedDiagnostics = [
    {
      name: 'idx_transactions_date',
      table: 'transactions',
      column: 'created_at',
      type: 'B-Tree',
      size: '2.4 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Zero query predicates on created_at across the last 100 queries. The query planner ignores this index, wasting 2.4 MB of disk storage and causing 14% write I/O amplification on order ingestion.',
      writeImpact: '14% insert latency penalty'
    },
    {
      name: 'idx_transactions_amount_missing',
      table: 'transactions',
      column: 'amount',
      type: 'B-Tree (Single-column)',
      size: '2.1 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Low cardinality/selectivity on standalone amount filter. Recorded 0 hits in last 100 queries as multi-column queries favor full table scans or composite (category, amount) indexes.',
      writeImpact: '12% lock contention overhead'
    },
    {
      name: 'idx_transactions_email_missing',
      table: 'transactions',
      column: 'customer_email',
      type: 'B-Tree (Single-column)',
      size: '2.3 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Overlapped by composite (customer_email, status). Zero query hits recorded across the 100-query audit window for standalone lookups.',
      writeImpact: '12% B-tree maintenance overhead'
    }
  ];

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
    setRemovedIndexes([]);
    setCleanupScanCompleted(false);
    setAutoOptimizedCompleted(false);
  };

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
      entityName: 'Transactions Entity',
      entityBadge: 'Core Ledger',
      entityRole: 'Primary Relational Anchor',
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
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: !removedIndexes.includes('PRIMARY KEY (id)') },
        { name: 'idx_orders_status_cat', type: 'Composite B-Tree', columns: ['status', 'category'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: flags.btreeIndexing && !removedIndexes.includes('idx_orders_status_cat') },
        { name: 'idx_transactions_date', type: 'B-Tree', columns: ['created_at'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: !removedIndexes.includes('idx_transactions_date') },
        { name: 'idx_transactions_email_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['customer_email'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCustomIndexes.includes('customer_email') && !removedIndexes.includes('idx_transactions_email_missing') },
        { name: 'idx_transactions_amount_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['amount'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCustomIndexes.includes('amount') && !removedIndexes.includes('idx_transactions_amount_missing') },
        { name: 'idx_transactions_email_status', type: 'Composite B-Tree (AI Recommended)', columns: ['customer_email', 'status'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCompositeIndexes.includes('email_status') && !removedIndexes.includes('idx_transactions_email_status') },
        { name: 'idx_transactions_category_amount', type: 'Composite B-Tree (AI Recommended)', columns: ['category', 'amount'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCompositeIndexes.includes('category_amount') && !removedIndexes.includes('idx_transactions_category_amount') },
      ],
      relationships: [
        { targetTable: 'line_items', type: 'One-to-Many', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'line_items',
      entityName: 'Order Items Entity',
      entityBadge: 'Child Relation',
      entityRole: 'Itemized Order Breakdowns',
      description: 'Order items table storing SKU details and quantities (N+1 query target if unbatched).',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'transaction_id', type: 'VARCHAR(36)', isPk: false, isFk: true, indexed: true },
        { name: 'sku', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: false },
        { name: 'quantity', type: 'INT', isPk: false, isFk: false, indexed: false },
        { name: 'unit_price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: false },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: true },
        { name: 'idx_line_items_tx', type: 'B-Tree (Foreign Key)', columns: ['transaction_id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: flags.batchEagerLoading }
      ],
      relationships: [
        { targetTable: 'transactions', type: 'Many-to-One', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'customers',
      entityName: 'Customers Entity',
      entityBadge: 'Master Dimension',
      entityRole: 'Accounts & User Registry',
      description: 'Customer directory and enterprise tier tracking.',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'name', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'email', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: true },
        { name: 'tier', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: false },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true },
        { name: 'idx_customers_email', type: 'B-Tree Unique', columns: ['email'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true }
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
    } else if (indexName.includes('line_items') || indexName.includes('tx')) {
      return { topQuery: 'Q6: Relational Line Items Join', reduction: 'O(n) → O(1) Indexed Hash Join' };
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

  const getIndexHealthScore = (idxName: string, active: boolean, tableName: string) => {
    const isRemoved = removedIndexes.includes(idxName);
    const redundant = isIndexRedundant(idxName, []);

    // 1. Frequency of use score (35% weight)
    let frequencyScore = 0;
    let frequencyMetric = '0 hits';
    if (isRemoved) {
      frequencyScore = 0;
      frequencyMetric = 'Pruned from DB (0 hits)';
    } else if (idxName.includes('PRIMARY KEY')) {
      frequencyScore = 98;
      frequencyMetric = '22,000 queries/hr (Very High)';
    } else if (idxName.includes('orders_status_cat')) {
      frequencyScore = active ? 96 : 14;
      frequencyMetric = active ? '18,400 queries/hr (High)' : '0 hits (Unindexed fallback)';
    } else if (idxName.includes('line_items_tx')) {
      frequencyScore = active ? 95 : 12;
      frequencyMetric = active ? '15,000 queries/hr (High)' : '0 hits (N+1 fallback)';
    } else if (idxName.includes('email_status')) {
      frequencyScore = active ? 94 : 15;
      frequencyMetric = active ? '14,250 queries/hr (High)' : '0 hits (Missing)';
    } else if (idxName.includes('category_amount')) {
      frequencyScore = active ? 92 : 15;
      frequencyMetric = active ? '11,100 queries/hr (High)' : '0 hits (Missing)';
    } else if (idxName.includes('customers_email')) {
      frequencyScore = 88;
      frequencyMetric = '8,400 queries/hr (Moderate)';
    } else if (idxName.includes('email_missing') || idxName.includes('customer_email')) {
      if (!active) {
        frequencyScore = 15;
        frequencyMetric = '0 hits (Inactive)';
      } else if (redundant) {
        frequencyScore = 38;
        frequencyMetric = 'Bypassed by composite index';
      } else {
        frequencyScore = 82;
        frequencyMetric = '8,000 queries/hr (Moderate)';
      }
    } else if (idxName.includes('amount_missing') || idxName.includes('amount')) {
      if (!active) {
        frequencyScore = 15;
        frequencyMetric = '0 hits (Inactive)';
      } else if (redundant) {
        frequencyScore = 35;
        frequencyMetric = 'Bypassed by composite index';
      } else {
        frequencyScore = 78;
        frequencyMetric = '6,400 queries/hr (Moderate)';
      }
    } else if (idxName === 'idx_transactions_date') {
      frequencyScore = 4;
      frequencyMetric = '0 hits in last 100 queries';
    } else {
      frequencyScore = active ? 75 : 15;
      frequencyMetric = active ? 'Active query traffic' : 'Inactive';
    }

    // 2. Read-Write ratio score (35% weight)
    let readWriteScore = 0;
    let readWriteMetric = 'N/A';
    if (isRemoved) {
      readWriteScore = 92;
      readWriteMetric = '+14% Write Latency Saved';
    } else if (idxName.includes('PRIMARY KEY')) {
      readWriteScore = 97;
      readWriteMetric = '96:4 Read/Write (Zero Overhead)';
    } else if (idxName.includes('orders_status_cat') || idxName.includes('line_items_tx')) {
      readWriteScore = active ? 94 : 20;
      readWriteMetric = active ? '92:8 Read/Write (High Benefit)' : '100% Write Penalty';
    } else if (idxName.includes('email_status') || idxName.includes('category_amount')) {
      readWriteScore = active ? 92 : 20;
      readWriteMetric = active ? '90:10 Read/Write (Efficient)' : '100% Write Penalty';
    } else if (idxName.includes('customers_email')) {
      readWriteScore = 90;
      readWriteMetric = '88:12 Read/Write';
    } else if (idxName.includes('email_missing') || idxName.includes('amount_missing')) {
      if (!active) {
        readWriteScore = 20;
        readWriteMetric = 'Unindexed sequential penalty';
      } else if (redundant) {
        readWriteScore = 32;
        readWriteMetric = '30:70 R/W (Redundant Leaf Writes)';
      } else {
        readWriteScore = 74;
        readWriteMetric = '72:28 Read/Write (Single Column)';
      }
    } else if (idxName === 'idx_transactions_date') {
      readWriteScore = 8;
      readWriteMetric = '0:100 R/W (+14% Write Amplification)';
    } else {
      readWriteScore = active ? 70 : 20;
      readWriteMetric = active ? '70:30 Read/Write' : 'Unindexed';
    }

    // 3. Scan efficiency score (30% weight)
    let scanEfficiencyScore = 0;
    let scanEfficiencyMetric = 'O(n) Seq Scan';
    if (isRemoved) {
      scanEfficiencyScore = 85;
      scanEfficiencyMetric = 'Buffer cache reclaimed';
    } else if (idxName.includes('PRIMARY KEY')) {
      scanEfficiencyScore = 99;
      scanEfficiencyMetric = 'O(1) Clustered Point Seek';
    } else if (idxName.includes('orders_status_cat') || idxName.includes('email_status') || idxName.includes('category_amount')) {
      scanEfficiencyScore = active ? 97 : 14;
      scanEfficiencyMetric = active ? 'O(log n) Composite Range Seek' : 'O(n) Table Scan Fallback';
    } else if (idxName.includes('line_items_tx')) {
      scanEfficiencyScore = active ? 98 : 12;
      scanEfficiencyMetric = active ? 'O(1) Batched Hash Join Seek' : 'O(n) N+1 Subquery Storm';
    } else if (idxName.includes('customers_email')) {
      scanEfficiencyScore = 94;
      scanEfficiencyMetric = 'O(log n) Unique B-Tree Seek';
    } else if (idxName.includes('email_missing') || idxName.includes('amount_missing')) {
      if (!active) {
        scanEfficiencyScore = 15;
        scanEfficiencyMetric = 'O(n) Sequential Scan Fallback';
      } else if (redundant) {
        scanEfficiencyScore = 48;
        scanEfficiencyMetric = 'Partial Seek (Shadowed by Composite)';
      } else {
        scanEfficiencyScore = 82;
        scanEfficiencyMetric = 'O(log n) Single-Column Seek';
      }
    } else if (idxName === 'idx_transactions_date') {
      scanEfficiencyScore = 10;
      scanEfficiencyMetric = 'Ignored by Planner (Low Selectivity)';
    } else {
      scanEfficiencyScore = active ? 80 : 15;
      scanEfficiencyMetric = active ? 'O(log n) B-Tree Seek' : 'O(n) Seq Scan Fallback';
    }

    // Calculated overall Index Health Score (0-100)
    const score = Math.max(0, Math.min(100, Math.round(
      0.35 * frequencyScore + 0.35 * readWriteScore + 0.30 * scanEfficiencyScore
    )));

    let rating: 'Optimal' | 'Moderate' | 'Critical' = 'Optimal';
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let dotClass = 'bg-emerald-500';
    let textClass = 'text-emerald-700';

    if (score >= 80) {
      rating = 'Optimal';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      dotClass = 'bg-emerald-500';
      textClass = 'text-emerald-700';
    } else if (score >= 50) {
      rating = 'Moderate';
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      dotClass = 'bg-amber-500';
      textClass = 'text-amber-700';
    } else {
      rating = 'Critical';
      badgeClass = 'bg-rose-100 text-rose-900 border-rose-300';
      dotClass = 'bg-rose-500';
      textClass = 'text-rose-700';
    }

    let explanation = '';
    if (score >= 80) {
      explanation = 'High query frequency, strong read-to-write ratio, and optimal B-Tree seek efficiency.';
    } else if (score >= 50) {
      explanation = 'Moderate utilization or secondary lookup overhead; consider consolidation or monitoring.';
    } else {
      explanation = 'Low query frequency or high write amplification overhead; flagged as unutilized or bottleneck.';
    }

    return {
      score,
      rating,
      frequencyScore,
      frequencyMetric,
      readWriteScore,
      readWriteMetric,
      scanEfficiencyScore,
      scanEfficiencyMetric,
      badgeClass,
      dotClass,
      textClass,
      explanation
    };
  };

  const getBaselineComparisonForIndex = (idxName: string, active: boolean) => {
    if (idxName.includes('PRIMARY KEY')) {
      return {
        baselineStatus: 'Active in Baseline',
        baselineScan: 'Clustered Seek O(1)',
        currentStatus: 'Retained Baseline Anchor',
        isNewOptimization: false,
        speedup: 'Baseline Anchor',
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200'
      };
    }
    if (idxName === 'idx_transactions_date') {
      const isRemoved = removedIndexes.includes(idxName);
      return {
        baselineStatus: 'Lingering in Baseline (0 Hits)',
        baselineScan: 'Unused B-Tree Overhead (+14% Write I/O)',
        currentStatus: isRemoved ? 'Pruned in Optimization (+2.4MB Saved)' : 'Unpruned Overhead',
        isNewOptimization: isRemoved,
        speedup: isRemoved ? '+14% Write Latency Saved' : '0 Hits Recorded',
        badgeClass: isRemoved ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }
    return {
      baselineStatus: 'Missing in Baseline (Full Table Scan)',
      baselineScan: 'Sequential Scan O(n) on 50,000 rows',
      currentStatus: active ? 'Optimized B-Tree Active' : 'Missing Index Bottleneck',
      isNewOptimization: active,
      speedup: active ? '+99.6% Speedup (O(log n))' : 'Bottleneck Active',
      badgeClass: active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
    };
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

  const handleExportSchemaState = () => {
    setIsExportingState(true);

    const totalIdxCount = tables.reduce((acc, t) => acc + t.indexes.length, 0);
    const activeIdxCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((idx) => idx.active && !removedIndexes.includes(idx.name)).length,
      0
    );

    const schemaSnapshot = {
      snapshotMetadata: {
        exportVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedTimestamp: Date.now(),
        databaseEngine: 'PostgreSQL / Cloud SQL Relational Engine',
        stateDescription: 'Optimized Database Schema & Index Configuration Snapshot'
      },
      optimizationFlags: {
        ...flags
      },
      performanceImpact: {
        speedUpEstimatedPercent: speedUpPercent,
        totalTables: tables.length,
        totalIndexes: totalIdxCount,
        activeIndexes: activeIdxCount,
        prunedUnutilizedIndexes: removedIndexes.length,
        workloadLatencyImprovement: 'Up to 99.6% reduction on expensive queries'
      },
      indexConfiguration: {
        createdCustomIndexes: [...createdCustomIndexes],
        createdCompositeIndexes: [...createdCompositeIndexes],
        consolidatedIndexes: [...consolidatedIndexes],
        removedOrPrunedIndexes: [...removedIndexes]
      },
      tablesAndEntities: tables.map((t) => ({
        tableName: t.name,
        entityName: t.entityName,
        entityBadge: t.entityBadge,
        entityRole: t.entityRole,
        description: t.description,
        columnCount: t.columns.length,
        columns: t.columns.map((col) => ({
          name: col.name,
          type: col.type,
          isPk: col.isPk,
          isFk: col.isFk,
          indexed: col.indexed
        })),
        indexes: t.indexes.map((idx) => ({
          name: idx.name,
          type: idx.type,
          columns: idx.columns,
          targetTable: idx.targetTable,
          targetEntity: idx.targetEntity,
          active: idx.active && !removedIndexes.includes(idx.name),
          status: removedIndexes.includes(idx.name)
            ? 'REMOVED'
            : idx.active
            ? 'ACTIVE'
            : 'INACTIVE',
          optimizationComplexityReduction: getOptimizationPotential(idx.name),
          healthScore: getIndexHealthScore(idx.name, idx.active && !removedIndexes.includes(idx.name), t.name),
          impactSummary: getIndexImpactSummary(idx.name)
        })),
        relationships: t.relationships.map((rel) => ({
          targetTable: rel.targetTable,
          type: rel.type,
          foreignKey: rel.foreignKey,
          optimized: rel.optimized
        }))
      })),
      expensiveQueriesWorkload: expensiveQueriesWorkload.map((q) => ({
        id: q.id,
        name: q.name,
        frequency: q.frequency,
        executionShare: q.executionShare,
        unindexedLatency: q.unindexedLatency,
        optimizedLatency: q.optimizedLatency,
        speedup: q.speedup,
        optimalIndexName: q.optimalIndexName,
        optimalIndexType: q.optimalIndexType,
        isToggled: q.isToggled
      }))
    };

    const fileName = `schema-state-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const jsonBlob = new Blob([JSON.stringify(schemaSnapshot, null, 2)], {
      type: 'application/json'
    });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(downloadUrl);

    setTimeout(() => {
      setIsExportingState(false);
      setExportSuccessNotice(`Successfully exported schema state snapshot (${activeIdxCount} active indexes) to ${fileName}`);
    }, 400);

    setTimeout(() => {
      setExportSuccessNotice(null);
    }, 5000);
  };

  const renderContent = () => {
    if (activeTab === 'dependency-chain') {
      return (
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white">
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
            <h3 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
              <Link className="w-4 h-4 text-indigo-700" />
              <span>Relational Index Dependency &amp; Complement Chain</span>
            </h3>
            <p className="text-xs text-indigo-900">
              Visualizes how B-Tree indexes depend on parent primary keys and complement secondary filters to avoid redundant duplicate index allocations.
            </p>
          </div>

          <div className="space-y-4">
            {/* Chain Node 1 */}
            <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Entity Root: transactions.id (Clustered Primary Key)</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">O(1) Base Anchor</span>
              </div>
              <p className="text-xs text-zinc-600">
                Foundational root entity. All foreign key references and child tables (<code className="font-mono">line_items.transaction_id</code>) depend on this primary key to establish relational integrity.
              </p>
              <div className="pl-4 border-l-2 border-indigo-200 space-y-2 mt-2">
                <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs flex items-center justify-between">
                  <div>
                    <strong className="text-indigo-950 font-mono">└─ Complemented by: idx_transactions_email_status</strong>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Composite B-Tree index supersedes and covers single-column lookups on <code className="font-mono">customer_email</code>, avoiding redundant index storage.</p>
                  </div>
                  <span className="font-mono text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded shrink-0">Redundancy Prevented</span>
                </div>
              </div>
            </div>

            {/* Chain Node 2 */}
            <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Entity Root: transactions.category &amp; amount</span>
                </div>
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">Range Partition Anchor</span>
              </div>
              <p className="text-xs text-zinc-600">
                Multi-attribute filtering root. Serves range aggregations and category grouping queries.
              </p>
              <div className="pl-4 border-l-2 border-indigo-200 space-y-2 mt-2">
                <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs flex items-center justify-between">
                  <div>
                    <strong className="text-indigo-950 font-mono">└─ Complemented by: idx_transactions_category_amount</strong>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Co-locates category sorting buckets with amount b-tree ranges, completely replacing unindexed table scans.</p>
                  </div>
                  <span className="font-mono text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded shrink-0">Optimized Join Path</span>
                </div>
              </div>
            </div>

            {/* Chain Node 3 */}
            <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Foreign Key Dependency: line_items.transaction_id</span>
                </div>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Join Cascade Protection</span>
              </div>
              <p className="text-xs text-zinc-600">
                Child relation foreign key. Depends on parent <code className="font-mono">transactions.id</code> to prevent N+1 query storms.
              </p>
              <div className="pl-4 border-l-2 border-purple-200 space-y-2 mt-2">
                <div className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100 text-xs flex items-center justify-between">
                  <div>
                    <strong className="text-purple-950 font-mono">└─ Dependent Index: idx_line_items_tx</strong>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Batches child record loading into single indexed lookups when expanding transaction details.</p>
                  </div>
                  <span className="font-mono text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded shrink-0">N+1 Eliminated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
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

          {/* AI-Driven Suggestions Quick Callout Box */}
          <div className="mt-4 p-3.5 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200 rounded-xl text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>AI Index Suggestions</span>
              </div>
              <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                {indexSuggestions.filter(s => !s.isApplied).length} Available
              </span>
            </div>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Workload engine detected table join &amp; filter clause bottlenecks. Inspect the &ldquo;Why&rdquo; behind each recommendation.
            </p>
            <button
              type="button"
              id="btn-sidebar-open-suggestions-why"
              data-testid="btn-sidebar-open-suggestions-why"
              onClick={() => setShowSuggestIndexesModal(true)}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1"
            >
              <span>Open &apos;Why&apos; Side-Panel Summary</span>
              <ArrowRight className="w-3 h-3" />
            </button>
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
                      : speedUpPercent > 50
                      ? 'bg-indigo-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${speedUpPercent}%` }}
                />
              </div>
              <span className="font-mono font-bold text-sm text-zinc-900 min-w-[48px] text-right">
                {speedUpPercent}%
              </span>
            </div>
          </div>

          {/* Table Columns & Index Coverage (Baseline vs Current Overlay) */}
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Table Columns &amp; Index Coverage
                </h4>
                {compareWithBaseline && (
                  <span className="text-amber-800 font-sans font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-600" />
                    <span>Baseline Comparison Active</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {currentTableData.name} ({currentTableData.columns.length} columns)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 text-[10px] uppercase font-bold">
                    <th className="pb-2 font-semibold">Column</th>
                    <th className="pb-2 font-semibold">Type</th>
                    {compareWithBaseline && <th className="pb-2 font-semibold text-rose-700">Default Baseline Coverage</th>}
                    <th className="pb-2 font-semibold text-indigo-700">Current Schema Coverage</th>
                    <th className="pb-2 font-semibold text-emerald-700 text-right">Performance Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {currentTableData.columns.map((col) => {
                    const isColIndexedInBaseline = col.isPk;
                    let coverageLabel = 'Unindexed (Seq Scan O(n))';
                    let coverageBadge = 'bg-zinc-100 text-zinc-600';
                    let impactText = 'O(n) Sequential Scan';
                    let impactClass = 'text-zinc-500';

                    if (col.isPk) {
                      coverageLabel = 'Primary Key (Clustered B-Tree)';
                      coverageBadge = 'bg-indigo-100 text-indigo-800 font-bold';
                      impactText = 'O(1) Constant Base';
                      impactClass = 'text-indigo-700 font-bold';
                    } else if (col.name === 'created_at') {
                      const isPruned = removedIndexes.includes('idx_transactions_date');
                      coverageLabel = isPruned ? 'Pruned (0 Hits, Saved 2.4MB)' : 'B-Tree (idx_transactions_date)';
                      coverageBadge = isPruned ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700';
                      impactText = isPruned ? '+14% Write Latency Saved' : 'Unutilized (0 Hits)';
                      impactClass = isPruned ? 'text-emerald-700 font-bold' : 'text-zinc-500';
                    } else if (col.name === 'customer_email' && (createdCompositeIndexes.includes('email_status') || createdCustomIndexes.includes('customer_email'))) {
                      coverageLabel = createdCompositeIndexes.includes('email_status') ? 'Composite B-Tree (Email + Status)' : 'Single-Column B-Tree';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.6% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if (col.name === 'amount' && (createdCompositeIndexes.includes('category_amount') || createdCustomIndexes.includes('amount'))) {
                      coverageLabel = createdCompositeIndexes.includes('category_amount') ? 'Composite B-Tree (Category + Amount)' : 'Single-Column B-Tree';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.2% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if ((col.name === 'status' || col.name === 'category') && flags.btreeIndexing) {
                      coverageLabel = 'Composite B-Tree (Status + Category)';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.5% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if (col.name === 'transaction_id' && flags.batchEagerLoading) {
                      coverageLabel = 'Foreign Key B-Tree (idx_line_items_tx)';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.6% Speedup (Batched Join)';
                      impactClass = 'text-emerald-700 font-bold';
                    }

                    return (
                      <tr key={col.name} className="hover:bg-zinc-100/50 transition-colors">
                        <td className="py-2 font-bold text-zinc-900 flex items-center gap-1.5">
                          {col.isPk && <Key className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{col.name}</span>
                        </td>
                        <td className="py-2 text-zinc-500 text-[11px]">{col.type}</td>
                        {compareWithBaseline && (
                          <td className="py-2 text-[11px]">
                            {isColIndexedInBaseline ? (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">Clustered PK</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold line-through">
                                Unindexed (Seq Scan)
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded ${coverageBadge}`}>
                            {coverageLabel}
                          </span>
                        </td>
                        <td className={`py-2 text-[11px] text-right ${impactClass}`}>
                          {impactText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Index List Grouped by Target Entity & Table with Collapsible Categories */}
          <div id="indexes-grouped-list" data-testid="grouped-index-list" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200">
              <div>
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                  <span>Active Index Structures Grouped by Entity</span>
                  <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    {tables.reduce((acc, t) => acc + t.indexes.length, 0)} Total Indexes
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Indexes grouped by the table or entity they target, with collapsible categories for rapid scanning and navigation of large schemas.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Real-time Filter Text Input Field */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    id="filter-indexes-input"
                    name="filter-indexes-input"
                    data-testid="filter-indexes-input"
                    value={indexSearchQuery}
                    onChange={(e) => setIndexSearchQuery(e.target.value)}
                    placeholder="Filter indexes by name or target table..."
                    aria-label="Filter indexes by name or target table"
                    className="filter-indexes-input pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-52 sm:w-72 shadow-2xs font-mono transition-all"
                  />
                  {indexSearchQuery && (
                    <button
                      type="button"
                      id="btn-clear-index-filter"
                      data-testid="btn-clear-index-filter"
                      onClick={() => setIndexSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                      title="Clear filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Category Expand / Collapse Buttons */}
                <button
                  type="button"
                  id="btn-expand-all-categories"
                  data-testid="btn-expand-all-categories"
                  onClick={() => setCollapsedCategories({})}
                  className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  title="Expand all table & entity categories"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Expand All</span>
                </button>
                <button
                  type="button"
                  id="btn-collapse-all-categories"
                  data-testid="btn-collapse-all-categories"
                  onClick={() => {
                    const allCol: Record<string, boolean> = {};
                    tables.forEach((t) => {
                      allCol[t.name] = true;
                    });
                    setCollapsedCategories(allCol);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  title="Collapse all categories for high-level schema scanning"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Collapse All</span>
                </button>
              </div>
            </div>

            {/* Real-time Filter Active Notification Banner */}
            {indexSearchQuery && (
              <div
                id="active-filter-notification"
                data-testid="active-filter-notification"
                className="p-2.5 px-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 text-xs text-indigo-950 animate-fadeIn shadow-2xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Filtering indexes in real-time matching: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-900">&ldquo;{indexSearchQuery}&rdquo;</strong>
                  </span>
                  <span className="text-[11px] text-indigo-700">
                    (matching name or target table)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIndexSearchQuery('')}
                  className="text-[11px] text-indigo-700 hover:text-indigo-950 font-bold cursor-pointer underline flex items-center gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              </div>
            )}

            {/* Entity Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-zinc-400" />
                <span>Filter Entity:</span>
              </span>
              <button
                type="button"
                id="filter-entity-all"
                data-testid="filter-entity-all"
                onClick={() => setIndexCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                  indexCategoryFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
              >
                All Entities ({tables.reduce((acc, t) => acc + t.indexes.length, 0)})
              </button>
              {tables.map((t) => {
                const count = t.indexes.length;
                const isSelected = indexCategoryFilter === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    id={`filter-entity-${t.name}`}
                    data-testid={`filter-entity-${t.name}`}
                    onClick={() => {
                      setIndexCategoryFilter(t.name);
                      setCollapsedCategories((prev) => ({ ...prev, [t.name]: false }));
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-zinc-200 text-zinc-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Collapsible Categories Grouped by Entity */}
            <div className="space-y-3.5">
              {tables
                .filter((tbl) => indexCategoryFilter === 'all' || indexCategoryFilter === tbl.name)
                .map((tbl) => {
                  const queryLower = indexSearchQuery.trim().toLowerCase();
                  const matchingIndexes = tbl.indexes.filter((idx) => {
                    if (!queryLower) return true;
                    const matchesName = idx.name.toLowerCase().includes(queryLower);
                    const matchesTargetTable =
                      tbl.name.toLowerCase().includes(queryLower) ||
                      (idx.targetTable && idx.targetTable.toLowerCase().includes(queryLower)) ||
                      (tbl.entityName && tbl.entityName.toLowerCase().includes(queryLower)) ||
                      (idx.targetEntity && idx.targetEntity.toLowerCase().includes(queryLower));
                    const matchesColumns = idx.columns.some((c) => c.toLowerCase().includes(queryLower));
                    const matchesType = idx.type.toLowerCase().includes(queryLower);
                    return matchesName || matchesTargetTable || matchesColumns || matchesType;
                  });

                  if (queryLower && matchingIndexes.length === 0) {
                    return null;
                  }

                  const isCollapsed = queryLower ? false : !!collapsedCategories[tbl.name];
                  const activeCount = matchingIndexes.filter(
                    (idx) => idx.active && !removedIndexes.includes(idx.name)
                  ).length;

                  return (
                    <div
                      key={tbl.name}
                      data-testid={`collapsible-category-${tbl.name}`}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        selectedTable === tbl.name
                          ? 'border-indigo-300 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {/* Collapsible Category Header */}
                      <div
                        role="button"
                        tabIndex={0}
                        id={`category-header-${tbl.name}`}
                        data-testid={`category-header-${tbl.name}`}
                        onClick={() => {
                          setCollapsedCategories((prev) => ({
                            ...prev,
                            [tbl.name]: !isCollapsed
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCollapsedCategories((prev) => ({
                              ...prev,
                              [tbl.name]: !isCollapsed
                            }));
                          }
                        }}
                        className={`p-3.5 flex items-center justify-between cursor-pointer select-none transition-colors ${
                          selectedTable === tbl.name
                            ? 'bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/40'
                            : 'bg-zinc-50/80 hover:bg-zinc-100/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="p-1 rounded-md text-zinc-500 hover:text-zinc-800 transition-transform"
                            aria-label={isCollapsed ? `Expand ${tbl.name} indexes` : `Collapse ${tbl.name} indexes`}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            )}
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Table className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-bold text-xs text-zinc-900">
                              {tbl.entityName || tbl.name}
                            </span>
                            <span className="font-mono text-[10px] bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-300">
                              entity: {tbl.name}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {tbl.entityBadge}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const avgHealth = matchingIndexes.length > 0
                              ? Math.round(
                                  matchingIndexes.reduce(
                                    (sum, idx) => sum + getIndexHealthScore(idx.name, idx.active, tbl.name).score,
                                    0
                                  ) / matchingIndexes.length
                                )
                              : 0;
                            const avgBadgeClass =
                              avgHealth >= 80
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : avgHealth >= 50
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300';
                            return (
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${avgBadgeClass}`}
                                title={`Average calculated Index Health Score for ${tbl.entityName || tbl.name}: ${avgHealth}/100`}
                              >
                                <Activity className="w-3 h-3 shrink-0" />
                                <span>Avg Health: {avgHealth}/100</span>
                              </span>
                            );
                          })()}
                          <span className="text-[11px] font-mono font-semibold text-zinc-600">
                            {matchingIndexes.length} {matchingIndexes.length === 1 ? 'index' : 'indexes'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              activeCount > 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                            }`}
                          >
                            {activeCount} active
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
                            {isCollapsed ? 'Click to Expand ▾' : 'Click to Collapse ▴'}
                          </span>
                        </div>
                      </div>

                      {/* When Collapsed: Quick Index Summary Bar */}
                      {isCollapsed ? (
                        <div
                          onClick={() => {
                            setCollapsedCategories((prev) => ({
                              ...prev,
                              [tbl.name]: false
                            }));
                          }}
                          className="px-4 py-2 bg-white border-t border-zinc-100 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap overflow-hidden text-[10px]">
                            <span className="text-zinc-400 font-medium">Targeted indexes:</span>
                            {matchingIndexes.map((idx) => {
                              const isRemoved = removedIndexes.includes(idx.name);
                              const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
                              return (
                                <span
                                  key={idx.name}
                                  className={`font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                    isRemoved
                                      ? 'bg-zinc-100 text-zinc-400 line-through border-zinc-200'
                                      : health.badgeClass
                                  }`}
                                  title={`Health Score: ${health.score}/100 (${health.rating}) • Freq: ${health.frequencyScore}% • R/W: ${health.readWriteScore}% • Scan: ${health.scanEfficiencyScore}%`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRemoved ? 'bg-zinc-400' : health.dotClass}`} />
                                  <span>{idx.name}</span>
                                  <span className="font-bold">({health.score})</span>
                                </span>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold shrink-0">
                            Expand Category ▾
                          </span>
                        </div>
                      ) : (
                        /* When Expanded: Full Grid of Index Cards for this Target Entity */
                        <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 space-y-3">
                          {/* Entity Context Sub-bar */}
                          <div className="p-2.5 bg-white rounded-lg border border-zinc-200/80 text-[11px] text-zinc-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-800">{tbl.entityRole}:</span>
                              <span>{tbl.description}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(tbl.name);
                              }}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 flex items-center gap-1 ${
                                selectedTable === tbl.name
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{selectedTable === tbl.name ? 'Focused Table' : 'Focus in Schema ER'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Index Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {matchingIndexes.map((idx, i) => {
                              const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
                              const isRemoved = removedIndexes.includes(idx.name);

                              return (
                                <div
                                  key={`idx-${tbl.name}-${i}`}
                                  onMouseEnter={() => setHoveredIndexWhatIf(idx.name)}
                                  onMouseLeave={() => setHoveredIndexWhatIf(null)}
                                  className={`relative p-3.5 rounded-xl border flex flex-col justify-between transition-all bg-white ${
                                    idx.active
                                      ? 'border-emerald-300 shadow-2xs'
                                      : 'border-zinc-200 opacity-80 hover:opacity-100'
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

                                  {/* Baseline Comparison Ribbon */}
                                  {compareWithBaseline && (() => {
                                    const cmp = getBaselineComparisonForIndex(idx.name, idx.active);
                                    return (
                                      <div className={`mb-2.5 p-2 rounded-lg border text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                                        cmp.isNewOptimization
                                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                                          : 'bg-zinc-100/90 border-zinc-200 text-zinc-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5">
                                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          <span className="font-medium text-[11px]">
                                            <span className="line-through text-zinc-500 mr-1">Baseline: {cmp.baselineStatus}</span>
                                            <span className="text-zinc-400">➔</span>
                                            <span className="font-bold ml-1 text-emerald-800">Current: {cmp.currentStatus}</span>
                                          </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${cmp.badgeClass}`}>
                                          {cmp.speedup}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  <div>
                                    {/* Diagnostic Removal / Redundancy Banners */}
                                    {(() => {
                                      if (removedIndexes.includes(idx.name)) {
                                        return (
                                          <div className="mb-2 p-2 bg-zinc-100 border border-zinc-300 rounded-lg flex items-center justify-between text-[11px] text-zinc-600 shadow-2xs">
                                            <div className="flex items-center gap-1.5 font-medium">
                                              <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                              <span>Index Removed by Cleanup Diagnostic (+2.4 MB space saved)</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestoreRemovedIndex(idx.name);
                                              }}
                                              className="px-2 py-0.5 bg-white hover:bg-zinc-200 border border-zinc-300 text-zinc-700 font-semibold rounded text-[10px] cursor-pointer"
                                            >
                                              Restore
                                            </button>
                                          </div>
                                        );
                                      }
                                      if (cleanupScanCompleted && isIndexUnutilized(idx.name)) {
                                        return (
                                          <div className="mb-2 p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-[11px] text-rose-900 shadow-2xs">
                                            <div className="flex items-center gap-2 font-semibold">
                                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                              <div>
                                                <div>Unutilized in Last 100 Queries (0 Hits)</div>
                                                <div className="text-[10px] text-rose-700 font-normal">Flagged for removal • Reclaim 2.4 MB disk space</div>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveUnutilizedIndex(idx.name);
                                              }}
                                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors shrink-0"
                                            >
                                              Remove &amp; Free Space
                                            </button>
                                          </div>
                                        );
                                      }
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

                                    {/* Target Entity Pill */}
                                    <div className="text-[10px] font-mono text-zinc-500 mb-1.5 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <Table className="w-3 h-3 text-indigo-500" />
                                        <span>Target Entity: <strong className="text-zinc-700">{tbl.name}</strong></span>
                                      </span>
                                      <span className="text-zinc-400 font-sans">{tbl.entityBadge}</span>
                                    </div>

                                    {/* Index Header Row with Name, Health Score Badge, and Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-bold text-zinc-900 mb-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-indigo-950 font-bold">{idx.name}</span>
                                        {/* Color-Coded Index Health Score Badge (0-100) */}
                                        <span
                                          id={`health-score-${idx.name}`}
                                          data-testid={`health-score-${idx.name}`}
                                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition-all ${
                                            isRemoved ? 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through' : health.badgeClass
                                          }`}
                                          title={`Index Health Score: ${health.score}/100 (${health.rating}) • Frequency of Use: ${health.frequencyScore}% • Read-Write Ratio: ${health.readWriteScore}% • Scan Efficiency: ${health.scanEfficiencyScore}%`}
                                        >
                                          <HeartPulse className={`w-3 h-3 shrink-0 ${isRemoved ? 'text-zinc-400' : health.textClass}`} />
                                          <span>Health: {health.score}/100</span>
                                          <span className="font-sans font-extrabold text-[9px] uppercase px-1 rounded bg-black/5">
                                            {health.rating}
                                          </span>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-sans px-1.5 py-0.2 rounded font-bold shadow-2xs" title="Calculated Query Complexity Reduction">
                                          ⚡ {getOptimizationPotential(idx.name)}
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          isRemoved
                                            ? 'bg-zinc-200 text-zinc-600 line-through'
                                            : idx.active
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-zinc-200 text-zinc-600'
                                        }`}>
                                          {isRemoved ? 'REMOVED' : idx.active ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-[11px] text-zinc-500 font-mono mb-2">
                                      Type: {idx.type} • Columns: ({idx.columns.join(', ')})
                                    </div>
                                  </div>

                                  {/* Calculated Index Health Score Breakdown (Frequency, Read-Write Ratio, Scan Efficiency) */}
                                  <div
                                    id={`health-breakdown-${idx.name}`}
                                    data-testid={`health-breakdown-${idx.name}`}
                                    className={`my-2 p-2.5 rounded-lg border text-[11px] space-y-1.5 shadow-2xs transition-colors ${
                                      isRemoved
                                        ? 'bg-zinc-50 border-zinc-200 text-zinc-500'
                                        : health.score >= 80
                                        ? 'bg-emerald-50/60 border-emerald-200'
                                        : health.score >= 50
                                        ? 'bg-amber-50/60 border-amber-200'
                                        : 'bg-rose-50/60 border-rose-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                                        <HeartPulse className={`w-3.5 h-3.5 ${isRemoved ? 'text-zinc-400' : health.textClass}`} />
                                        <span>Index Health Metrics</span>
                                        <span className="text-[10px] font-mono text-zinc-500 font-normal hidden sm:inline">
                                          (0-100 calculated score)
                                        </span>
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                        isRemoved ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : health.badgeClass
                                      }`}>
                                        {health.score}/100 • {health.rating}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-0.5">
                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Frequency of Use (35% weight in score)">
                                          1. Frequency (35%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.frequencyScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.frequencyMetric}>
                                          {health.frequencyMetric}
                                        </div>
                                      </div>

                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Read-Write Ratio (35% weight in score)">
                                          2. R/W Ratio (35%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.readWriteScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.readWriteMetric}>
                                          {health.readWriteMetric}
                                        </div>
                                      </div>

                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Scan Efficiency (30% weight in score)">
                                          3. Scan Effic. (30%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.scanEfficiencyScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.scanEfficiencyMetric}>
                                          {health.scanEfficiencyMetric}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {(() => {
                                    const impact = getIndexImpactSummary(idx.name);
                                    return (
                                      <div className="my-2 p-2 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] space-y-0.5 shadow-2xs">
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
                                          } else if (idx.name.includes('line_items') || idx.columns.includes('transaction_id')) {
                                            if (flags.batchEagerLoading) onToggleFlag('batchEagerLoading');
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
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Empty state if search returns zero indexes */}
              {indexSearchQuery &&
                tables
                  .filter((tbl) => indexCategoryFilter === 'all' || indexCategoryFilter === tbl.name)
                  .every((tbl) => {
                    const q = indexSearchQuery.trim().toLowerCase();
                    return !tbl.indexes.some(
                      (idx) =>
                        idx.name.toLowerCase().includes(q) ||
                        idx.type.toLowerCase().includes(q) ||
                        idx.columns.some((c) => c.toLowerCase().includes(q)) ||
                        tbl.name.toLowerCase().includes(q) ||
                        (tbl.entityName && tbl.entityName.toLowerCase().includes(q)) ||
                        (idx.targetTable && idx.targetTable.toLowerCase().includes(q))
                    );
                  }) && (
                  <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-300 rounded-xl space-y-2 animate-fadeIn">
                    <p className="text-xs text-zinc-500">
                      No indexes found matching name or target table &ldquo;<span className="font-mono text-zinc-800 font-bold">{indexSearchQuery}</span>&rdquo; in the selected filter.
                    </p>
                    <button
                      type="button"
                      id="btn-empty-clear-filter"
                      data-testid="btn-empty-clear-filter"
                      onClick={() => {
                        setIndexSearchQuery('');
                        setIndexCategoryFilter('all');
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Clear Filter &amp; Show All Indexes
                    </button>
                  </div>
                )}
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
                  <div key={`rel-${i}`} className="bg-white p-3 rounded-lg border border-zinc-200 text-xs font-mono space-y-2">
                    <div className="flex items-center justify-between">
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
                    {compareWithBaseline && (
                      <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="line-through text-rose-700 font-mono text-[10px] bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Baseline: N+1 Unbatched (100+ DB queries, ~840ms)
                          </span>
                          <span className="text-zinc-400">➔</span>
                          <span className={`font-bold font-mono text-[10px] px-1.5 py-0.2 rounded border ${rel.optimized ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                            Current: {rel.optimized ? 'Batched Join (1 query, 3.2ms, +99.6% Speedup)' : 'N+1 Unbatched'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {rel.optimized ? '99 Queries Saved' : '0 Saved'}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
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
          {/* Real-time Index Filter Input Field */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              id="filter-indexes-input-header"
              name="filter-indexes-input-header"
              data-testid="filter-indexes-input-header"
              value={indexSearchQuery}
              onChange={(e) => setIndexSearchQuery(e.target.value)}
              placeholder="Filter indexes by name or target table..."
              aria-label="Filter indexes by name or target table"
              className="pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-48 sm:w-64 shadow-2xs font-mono"
            />
            {indexSearchQuery && (
              <button
                type="button"
                onClick={() => setIndexSearchQuery('')}
                className="absolute right-2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label
            htmlFor="toggle-compare-baseline"
            id="lbl-compare-baseline"
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all shadow-xs ${
              compareWithBaseline
                ? 'bg-amber-500 text-white border border-amber-600 ring-2 ring-amber-300'
                : 'bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900'
            }`}
            title="Overlay current index configuration against default unoptimized schema to visually highlight performance gains"
          >
            <span className="flex items-center gap-1.5">
              <Layers className={`w-3.5 h-3.5 ${compareWithBaseline ? 'text-white' : 'text-indigo-600'}`} />
              <span>Compare with Baseline</span>
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                id="toggle-compare-baseline"
                data-testid="toggle-compare-baseline"
                checked={compareWithBaseline}
                onChange={(e) => setCompareWithBaseline(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`w-8 h-4 rounded-full transition-colors relative ${compareWithBaseline ? 'bg-amber-900' : 'bg-zinc-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-[2px] transition-transform ${compareWithBaseline ? 'left-[18px]' : 'left-[2px]'}`} />
              </div>
            </div>
            {compareWithBaseline && (
              <span className="px-1.5 py-0.2 bg-amber-700 text-white rounded text-[10px] font-bold">
                ON
              </span>
            )}
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
            id="btn-ai-index-suggestions"
            data-testid="btn-ai-index-suggestions"
            onClick={() => setShowSuggestIndexesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Open AI-Driven Index Suggestion engine with 'Why' side-panel summary detailing query patterns"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Index Suggestions &amp; &apos;Why&apos; Panel</span>
            <span className="px-1.5 py-0.2 bg-black/20 text-white rounded-full text-[10px] font-mono font-bold">
              {indexSuggestions.filter(s => !s.isApplied).length} Available
            </span>
          </button>

          <button
            type="button"
            id="btn-auto-optimize-workload"
            data-testid="btn-auto-optimize-workload"
            onClick={handleAutoOptimizeWorkload}
            disabled={isAutoOptimizingWorkload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Automatically run workload analysis on query history and toggle optimal B-Tree indexes to maximize read throughput for expensive queries"
          >
            {isAutoOptimizingWorkload ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>Analyzing Workload...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Auto-Optimize Workload Indexes</span>
                {autoOptimizedCompleted && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-800 text-emerald-100 rounded-full text-[10px] font-bold">
                    Optimal
                  </span>
                )}
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-suggest-composite-indexes"
            data-testid="btn-suggest-composite-indexes"
            onClick={() => {
              setShowSuggestIndexesModal(true);
              handleAnalyzeWorkload();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Analyze query history to identify multi-column filtering patterns and propose composite index structures"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggest Composite Indexes</span>
          </button>

          <button
            type="button"
            id="btn-index-cleanup"
            data-testid="btn-index-cleanup"
            onClick={handleRunIndexCleanupScan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Perform diagnostic scan for any indexes unutilized in the last 100 queries and flag for removal to save disk space"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Index Cleanup</span>
            {cleanupScanCompleted && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-800 text-rose-100 rounded-full text-[10px] font-bold">
                {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} Flagged
              </span>
            )}
          </button>

          <button
            type="button"
            id="btn-cluster-analysis"
            data-testid="btn-cluster-analysis"
            onClick={() => setShowClusterAnalysisModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Analyze index clusters and query pattern overlap to consolidate indexes"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cluster Analysis</span>
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
            id="btn-export-schema-state"
            data-testid="btn-export-schema-state"
            onClick={handleExportSchemaState}
            disabled={isExportingState}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Generate a JSON snapshot of the current index configuration, allowing users to save their optimized state"
          >
            {isExportingState ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>Exporting Schema State...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Schema State</span>
              </>
            )}
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

      {/* Export Schema State Success Feedback Notification */}
      {exportSuccessNotice && (
        <div
          id="export-schema-state-success-alert"
          data-testid="export-schema-state-success-alert"
          className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-950 flex items-center justify-between gap-3 animate-fadeIn shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{exportSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-[11px] font-bold cursor-pointer hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* View Mode Tabs: Schema Explorer vs Dependency Chain */}
      <div className="px-6 py-2.5 bg-zinc-100/90 border-b border-zinc-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('explorer')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'explorer'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Schema Explorer &amp; Indexes</span>
        </button>
        <button
          type="button"
          id="btn-dependency-chain-tab"
          data-testid="btn-dependency-chain-tab"
          onClick={() => setActiveTab('dependency-chain')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'dependency-chain'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Index Dependency Chain</span>
        </button>
      </div>

      {/* Workload Auto-Optimization Active Status Banner */}
      {autoOptimizedCompleted && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-b border-emerald-200 px-6 py-3 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="font-bold flex items-center gap-2 text-emerald-950">
                <span>Optimal B-Tree Index Set Active</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-200 text-emerald-900 border border-emerald-300">
                  +15,400% Read Throughput
                </span>
                <span className="text-[10px] text-emerald-700 font-mono">P99: 1.9ms (-99.6%)</span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Workload analysis evaluated 14,200 queries: Toggled optimal composite B-Tree indexes (<code className="font-mono bg-emerald-100 px-1 rounded font-bold">category, amount</code> &amp; <code className="font-mono bg-emerald-100 px-1 rounded font-bold">customer_email, status</code>) and foreign key joins to maximize read throughput.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-view-workload-audit"
              data-testid="btn-view-workload-audit"
              onClick={() => setShowWorkloadOptimizationModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              View Workload Audit Report
            </button>
            <button
              type="button"
              onClick={() => setAutoOptimizedCompleted(false)}
              className="p-1 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Baseline Comparison Overlay Comprehensive Dashboard */}
      {compareWithBaseline && (
        <div id="baseline-comparison-overlay-dashboard" className="bg-gradient-to-b from-amber-50/90 via-orange-50/50 to-white border-b border-amber-200 px-6 py-4 space-y-4 animate-fadeIn shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Baseline Comparison Overlay Active</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                    Default vs. Current Schema Delta
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-0.5">
                  Overlays current index structures against the default unoptimized schema to visually measure empirical performance gains.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-apply-full-optimization-compare"
                data-testid="btn-apply-full-optimization-compare"
                onClick={handleAutoOptimizeWorkload}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Apply Full Optimization</span>
              </button>
              <button
                type="button"
                id="btn-reset-baseline-compare"
                data-testid="btn-reset-baseline-compare"
                onClick={handleRevertAllIndexes}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Baseline Default</span>
              </button>
              <button
                type="button"
                onClick={() => setCompareWithBaseline(false)}
                className="p-1.5 text-amber-800 hover:text-amber-950 rounded-lg hover:bg-amber-100 cursor-pointer"
                title="Exit Comparison Overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Column Comparison Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Default Baseline Schema */}
            <div className="p-4 bg-white/95 rounded-xl border border-rose-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                <span className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Default Baseline Schema</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                  Unoptimized
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Active Indexes:</span>
                  <strong className="font-mono text-zinc-900">1 (Primary Key Only)</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Execution Strategy:</span>
                  <strong className="font-mono text-rose-700">Seq Scan (O(n))</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Avg Query Latency:</span>
                  <strong className="font-mono text-rose-700 font-bold">482 ms</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Read Throughput:</span>
                  <strong className="font-mono text-zinc-800">120 QPS</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Relational Joins:</span>
                  <strong className="font-mono text-rose-700">N+1 (100+ Trips)</strong>
                </div>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg text-[11px] text-rose-900 border border-rose-100">
                ⚠️ Severe lock contention &amp; CPU spikes. Sequential scans on 50,000 records.
              </div>
            </div>

            {/* Column 2: Current Configuration */}
            <div className="p-4 bg-white/95 rounded-xl border border-indigo-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Current Schema State</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {speedUpPercent > 50 ? 'Optimized' : 'Partially Configured'}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Active Indexes:</span>
                  <strong className="font-mono text-indigo-900">
                    {currentTableData.indexes.filter(idx => idx.active && !removedIndexes.includes(idx.name)).length} Active
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Execution Strategy:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 50 ? 'B-Tree Seek (O(log n))' : 'Mixed Seek / Scan'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Avg Query Latency:</span>
                  <strong className="font-mono text-emerald-700 font-bold">
                    {speedUpPercent > 80 ? '1.8 ms' : speedUpPercent > 50 ? '42 ms' : '482 ms'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Read Throughput:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 80 ? '18,600 QPS' : speedUpPercent > 50 ? '3,200 QPS' : '120 QPS'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Relational Joins:</span>
                  <strong className="font-mono text-indigo-900">
                    {flags.batchEagerLoading ? 'Batched Hash Join (1 Trip)' : 'N+1 Unbatched'}
                  </strong>
                </div>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg text-[11px] text-indigo-900 border border-indigo-100">
                {speedUpPercent > 80
                  ? '⚡ Optimal B-Tree leaf node clustering enabled across all hot paths.'
                  : '🔧 Configure composite indexes and batch eager loading to unlock peak throughput.'}
              </div>
            </div>

            {/* Column 3: Performance Gains Achieved */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-white rounded-xl border border-emerald-300 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                  <span>Performance Gains Achieved</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  Delta Δ
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-700">
                  <span>⚡ Latency Reduction:</span>
                  <strong className="font-mono text-emerald-700 font-extrabold">
                    {speedUpPercent > 80 ? '-99.6% (482ms → 1.8ms)' : speedUpPercent > 50 ? '-91.2% (482ms → 42ms)' : '0% (Baseline)'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🚀 Throughput Multiplier:</span>
                  <strong className="font-mono text-emerald-700 font-extrabold">
                    {speedUpPercent > 80 ? '+15,400% (154x Gain)' : speedUpPercent > 50 ? '+2,566% (26x Gain)' : 'Baseline'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🛡️ Full Scans Avoided:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 50 ? '50,000 Rows Skipped' : '0'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🔄 Join Trips Saved:</span>
                  <strong className="font-mono text-emerald-700">
                    {flags.batchEagerLoading ? '99+ Queries / Request' : '0'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>💾 Write Contention:</span>
                  <strong className="font-mono text-emerald-700">
                    {removedIndexes.includes('idx_transactions_date') ? '-14% Lock Overhead' : '0%'}
                  </strong>
                </div>
              </div>
              <div className="p-2 bg-emerald-100/80 rounded-lg text-[11px] text-emerald-950 font-medium border border-emerald-200">
                🎉 Realized empirical gains: Zero full-table scans on search, category grouping, and relational joins.
              </div>
            </div>
          </div>
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

      {/* AI-Driven Index Suggestion Engine & 'Why' Side-Panel Summary Modal */}
      {showSuggestIndexesModal && (() => {
        const activeSuggestion = indexSuggestions.find(s => s.id === selectedSuggestionId) || indexSuggestions[0];
        const filteredSuggestions = indexSuggestions.filter(s => {
          if (suggestionFilterTab === 'all') return true;
          return s.patternCategory === suggestionFilterTab;
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col text-zinc-900 relative">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-emerald-600 text-white rounded-xl shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                        AI-Driven Index Suggestion Engine &amp; Workload Analyzer
                      </h3>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        14,200 Queries Analyzed
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                        99.4% Optimizer Confidence
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Analyzes execution traces to identify slow table joins &amp; filter clauses, providing a detailed &ldquo;Why&rdquo; side-panel summary for every recommendation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-auto-optimize-workload-modal"
                    data-testid="btn-auto-optimize-workload-modal"
                    onClick={() => {
                      handleAutoOptimizeWorkload();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                    title="Automatically apply optimal indexes across all query bottlenecks"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>Auto-Apply All Optimal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuggestIndexesModal(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                    aria-label="Close suggestions modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Master-Detail Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 overflow-hidden flex-1 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 min-h-0">
                {/* Left Panel: Suggestion List & Controls (5 columns) */}
                <div className="lg:col-span-5 p-4 sm:p-5 overflow-y-auto space-y-4 bg-zinc-50/60">
                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-[11px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-zinc-400" />
                      <span>Category:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      All ({indexSuggestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('filter')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'filter'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Filter Clauses ({indexSuggestions.filter(s => s.patternCategory === 'filter').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('join')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'join'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Table Joins ({indexSuggestions.filter(s => s.patternCategory === 'join').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('composite')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'composite'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Composite ({indexSuggestions.filter(s => s.patternCategory === 'composite').length})
                    </button>
                  </div>

                  {/* Workload Scanner Status Bar */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold text-zinc-900">Live Workload Analyzer</div>
                        <div className="text-[10px] text-zinc-500">Continuous execution trace telemetry</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-analyze-workload"
                      data-testid="btn-analyze-workload"
                      onClick={handleAnalyzeWorkload}
                      disabled={isAnalyzingWorkload}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold rounded text-[11px] cursor-pointer transition-colors shrink-0"
                    >
                      {isAnalyzingWorkload ? 'Scanning...' : 'Re-Scan Workload'}
                    </button>
                  </div>

                  {/* Overlapping Index Conflict Warning */}
                  {createdCustomIndexes.length >= 2 && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2 animate-fadeIn shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Overlapping Index Warning:</strong>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Multiple single-column custom indexes are active. Consider composite index consolidation to avoid +{(createdCustomIndexes.length * 6).toFixed(0)}% write amplification.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suggestion Cards List */}
                  <div className="space-y-2.5">
                    {filteredSuggestions.map((s) => {
                      const isSelected = selectedSuggestionId === s.id;
                      return (
                        <div
                          key={s.id}
                          id={`suggestion-card-${s.id}`}
                          data-testid={`suggestion-card-${s.id}`}
                          onClick={() => setSelectedSuggestionId(s.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs relative ${
                            isSelected
                              ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-md'
                              : 'bg-white hover:bg-zinc-100/70 border-zinc-200 hover:border-zinc-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-zinc-900">{s.name}</span>
                                {isSelected && (
                                  <span className="bg-indigo-600 text-white text-[9px] font-sans font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
                                    Active View
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono mt-0.5">
                                <Table className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{s.targetTable} ({s.targetColumns.join(', ')})</span>
                              </div>
                            </div>
                            <span className="bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded text-[10px] shrink-0 border border-emerald-200">
                              {s.speedup}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              s.patternCategory === 'join'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : s.patternCategory === 'composite'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {s.patternType}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {s.frequency}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-600 line-clamp-2 mb-2.5">
                            {s.targetQueryName}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSuggestionId(s.id);
                              }}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                            >
                              <span>View &ldquo;Why&rdquo; Breakdown</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                s.onToggle();
                              }}
                              className={`px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer transition-colors shadow-2xs ${
                                s.isApplied
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {s.isApplied ? '✓ Index Active' : 'Apply Index'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Storage vs Speedup Summary Box */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-amber-700" />
                        <span>Storage Footprint vs Speedup</span>
                      </span>
                      <span className="font-mono text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        Database: 48.2 MB
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Indexes trade modest disk storage (3–7 MB) and write amplification (&lt;1ms) for up to 99.8% read latency reduction across 14,200 hourly queries.
                    </p>
                  </div>
                </div>

                {/* Right Panel: The 'Why' Behind Each Suggestion Side-Panel Summary (7 columns) */}
                <div
                  id="suggestion-why-side-panel"
                  data-testid="suggestion-why-side-panel"
                  className="lg:col-span-7 p-5 sm:p-6 overflow-y-auto bg-white space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-5">
                    {/* Side-Panel Header & Breadcrumb */}
                    <div className="pb-4 border-b border-zinc-200">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider font-sans">
                            Recommendation &ldquo;Why&rdquo; Summary
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          activeSuggestion.isApplied
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-300'
                        }`}>
                          {activeSuggestion.isApplied ? 'OPTIMIZATION ACTIVE' : 'RECOMMENDED ACTION'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-mono font-bold text-zinc-900 flex items-center gap-2">
                            <span>{activeSuggestion.name}</span>
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mt-0.5">
                            <span>Target: <strong className="text-zinc-800">{activeSuggestion.targetTable}</strong> ({activeSuggestion.targetColumns.join(', ')})</span>
                            <span>•</span>
                            <span className="text-indigo-700 font-semibold">{activeSuggestion.type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-2xs">
                            ⚡ {activeSuggestion.speedup} ({activeSuggestion.speedupFactor})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 1: The 'Why' Behind This Suggestion */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-indigo-50/50 to-white border border-indigo-200 rounded-xl space-y-2 text-xs text-indigo-950 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-indigo-950">
                        <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                        <span className="text-xs uppercase tracking-wide">Why Was This Index Recommended?</span>
                      </div>
                      <p className="text-zinc-700 text-xs leading-relaxed">
                        {activeSuggestion.whyExplanation}
                      </p>
                    </div>

                    {/* Section 2: Specific Query Patterns Triggering Recommendation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 uppercase tracking-wide">
                          <Target className="w-4 h-4 text-indigo-600" />
                          <span>Triggering Query Patterns &amp; Clauses</span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {activeSuggestion.patternType}
                        </span>
                      </div>

                      {/* Triggering SQL Code Preview */}
                      <div className="bg-zinc-900 text-zinc-100 rounded-xl p-3.5 font-mono text-xs overflow-x-auto shadow-inner border border-zinc-800 space-y-1">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-sans font-bold flex items-center justify-between pb-1 border-b border-zinc-800">
                          <span>Target Query Template</span>
                          <span className="text-emerald-400">{activeSuggestion.frequency}</span>
                        </div>
                        <pre className="text-zinc-100 font-mono text-[11px] pt-1 whitespace-pre-wrap">
                          {activeSuggestion.querySql}
                        </pre>
                      </div>

                      {/* Detailed Triggering Clauses Analysis */}
                      <div className="space-y-2">
                        {activeSuggestion.triggeringClauses.map((clause, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200">
                                {clause.clauseType}
                              </span>
                              <code className="font-mono text-[11px] font-bold text-indigo-950 bg-white px-2 py-0.5 rounded border border-zinc-200">
                                {clause.code}
                              </code>
                            </div>
                            <p className="text-[11px] text-zinc-600 leading-relaxed">
                              {clause.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Workload Traffic & Latency Impact */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">Query Frequency</span>
                        <div className="font-mono font-bold text-zinc-900 text-sm">
                          {activeSuggestion.frequency}
                        </div>
                        <span className="text-[10px] text-zinc-500">Live production trace</span>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">CPU Workload Share</span>
                        <div className="font-mono font-bold text-indigo-700 text-sm">
                          {activeSuggestion.executionShare}
                        </div>
                        <span className="text-[10px] text-zinc-500">Total database read time</span>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">Latency Speedup</span>
                        <div className="font-mono font-bold text-emerald-700 text-sm flex items-center gap-1">
                          <span className="line-through text-zinc-400 text-xs">{activeSuggestion.latencyBefore}</span>
                          <span>→</span>
                          <span>{activeSuggestion.latencyAfter}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">{activeSuggestion.throughputAfter} throughput</span>
                      </div>
                    </div>

                    {/* Section 4: Query Execution Plan Comparison (Before vs After) */}
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs text-zinc-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Query Execution Plan (EXPLAIN) Comparison</span>
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-sans">
                            <span className="font-bold text-rose-900 text-xs">Without Recommended Index</span>
                            <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded">
                              O(n) Full Scan
                            </span>
                          </div>
                          <pre className="text-rose-950 text-[10px] whitespace-pre-wrap leading-tight bg-white/80 p-2 rounded border border-rose-200">
                            {activeSuggestion.planBefore}
                          </pre>
                        </div>

                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-sans">
                            <span className="font-bold text-emerald-900 text-xs">With Recommended Index</span>
                            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded">
                              O(log n) Leaf Seek
                            </span>
                          </div>
                          <pre className="text-emerald-950 text-[10px] whitespace-pre-wrap leading-tight bg-white/80 p-2 rounded border border-emerald-200">
                            {activeSuggestion.planAfter}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Planner Mechanics & Storage Tradeoff */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-800">Database Optimizer Mechanics:</span>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-zinc-600">Storage: <strong>{activeSuggestion.storageOverhead}</strong></span>
                          <span>•</span>
                          <span className="text-zinc-600">Write Cost: <strong>{activeSuggestion.writeImpact}</strong></span>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed">
                        {activeSuggestion.plannerMechanics}
                      </p>
                    </div>
                  </div>

                  {/* Side-Panel Action Footer */}
                  <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Recommendation status: <strong className={activeSuggestion.isApplied ? 'text-emerald-700' : 'text-zinc-700'}>
                        {activeSuggestion.isApplied ? 'Applied & Active in Schema' : 'Pending Deployment'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-sidepanel-toggle-suggestion"
                        data-testid="btn-sidepanel-toggle-suggestion"
                        onClick={activeSuggestion.onToggle}
                        className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                          activeSuggestion.isApplied
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {activeSuggestion.isApplied ? (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revert Optimization</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-white" />
                            <span>Apply This Recommendation</span>
                          </>
                        )}
                      </button>

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
              </div>
            </div>
          </div>
        );
      })()}

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

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <button
                type="button"
                id="btn-modal-export-schema-state"
                data-testid="btn-modal-export-schema-state"
                onClick={handleExportSchemaState}
                disabled={isExportingState}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Schema State</span>
              </button>
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

      {/* Main Content Grid or Dependency Chain View */}
      {renderContent()}

      {/* Cluster Analysis Modal */}
      {showClusterAnalysisModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">B-Tree Index Cluster Analysis</h3>
                  <p className="text-xs text-zinc-500">
                    Groups indexes serving overlapping query patterns and recommends optimal multi-column consolidation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Cluster 1 */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>Cluster #1: Customer Lookup &amp; Status Filtering</span>
                    <span className="bg-indigo-200 text-indigo-900 font-mono text-[10px] px-2 py-0.5 rounded font-bold">Overlap: 92%</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    High Consolidation Potential
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900">
                  <strong className="text-indigo-950">Indexes involved:</strong> <code className="font-mono">idx_transactions_email_missing</code>, <code className="font-mono">idx_transactions_email_status</code>
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-[11px] space-y-1">
                  <div className="font-semibold text-zinc-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recommendation: Consolidate into composite <code className="font-mono">idx_transactions_email_status</code></span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">
                    Eliminates redundant single-column lookup overhead, reducing write lock contention by 42% and saving 2.1 MB storage.
                  </p>
                </div>
              </div>

              {/* Cluster 2 */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>Cluster #2: Range Aggregations &amp; Category Filters</span>
                    <span className="bg-indigo-200 text-indigo-900 font-mono text-[10px] px-2 py-0.5 rounded font-bold">Overlap: 88%</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    High Consolidation Potential
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900">
                  <strong className="text-indigo-950">Indexes involved:</strong> <code className="font-mono">idx_transactions_amount_missing</code>, <code className="font-mono">idx_transactions_category_amount</code>
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-[11px] space-y-1">
                  <div className="font-semibold text-zinc-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recommendation: Consolidate into composite <code className="font-mono">idx_transactions_category_amount</code></span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">
                    Co-locates category buckets with sorted amount b-trees, eliminating secondary sorting passes for top-k queries.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Cluster Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Index Cleanup Diagnostic Modal */}
      {showIndexCleanupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Index Cleanup Diagnostic</span>
                    <span className="text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                      Last 100 Queries Analyzed
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Scans query engine execution logs to identify zero-hit indexes and flags them for removal to reclaim disk space.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexCleanupModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isScanningCleanup ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin" />
                  <Trash2 className="w-5 h-5 text-rose-600 absolute inset-0 m-auto" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-900">Auditing Query Engine Execution Logs...</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Scanning last 100 query executions for B-Tree index hit frequency, scan counts, and disk storage footprint...
                  </p>
                </div>
                <div className="w-48 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-600 h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Diagnostic Metrics Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Queries Audited</div>
                    <div className="text-base font-extrabold text-zinc-900 font-mono mt-0.5">100 / 100</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Past 24h Window</div>
                  </div>
                  <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-rose-600">Unutilized Indexes</div>
                    <div className="text-base font-extrabold text-rose-700 font-mono mt-0.5">
                      {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} Flagged
                    </div>
                    <div className="text-[10px] text-rose-600 mt-0.5">0 Hits Recorded</div>
                  </div>
                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-700">Disk Space Saved</div>
                    <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                      {((removedIndexes.length > 0 ? (removedIndexes.filter(name => ['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].includes(name)).length * 2.3) : 0)).toFixed(1)} MB
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">Reclaimed Disk</div>
                  </div>
                  <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-indigo-700">Write Latency</div>
                    <div className="text-base font-extrabold text-indigo-700 font-mono mt-0.5">
                      {removedIndexes.length > 0 ? `-${Math.min(38, removedIndexes.length * 14)}%` : '0%'}
                    </div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">I/O Overhead Cut</div>
                  </div>
                </div>

                {/* Banner / Bulk Action */}
                <div className="p-3.5 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-950">
                        Diagnostic Findings: Unused Indexes Detected
                      </h4>
                      <p className="text-[11px] text-rose-800">
                        {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length > 0
                          ? `Flagged ${['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} indexes with zero engine hits across the last 100 queries. Removing them will reclaim up to 6.8 MB disk space.`
                          : 'All unutilized indexes have been removed. Disk storage reclaimed and write overhead reduced.'}
                      </p>
                    </div>
                  </div>
                  {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].some(name => !removedIndexes.includes(name)) && (
                    <button
                      type="button"
                      onClick={handleRemoveAllUnutilized}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                    >
                      Remove All Unutilized (Save 6.8 MB)
                    </button>
                  )}
                </div>

                {/* List of unutilized indexes */}
                <div className="space-y-3">
                  {unutilizedDiagnostics.map((diag) => {
                    const isRemoved = removedIndexes.includes(diag.name);
                    return (
                      <div
                        key={diag.name}
                        className={`p-4 rounded-xl border transition-all ${
                          isRemoved
                            ? 'bg-zinc-50 border-zinc-200 opacity-70'
                            : 'bg-white border-rose-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2.5 mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-zinc-900">{diag.name}</span>
                              <span className="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                                {diag.table}.{diag.column}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                0 hits / 100 queries
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              Storage footprint: <strong className="text-zinc-700 font-mono">{diag.size}</strong> • Write I/O penalty: <strong className="text-rose-700">{diag.writeImpact}</strong>
                            </div>
                          </div>
                          <div>
                            {isRemoved ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Removed ({diag.size} freed)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreRemovedIndex(diag.name)}
                                  className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Restore
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveUnutilizedIndex(diag.name)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove &amp; Free {diag.size}</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          <strong className="text-zinc-800">Diagnostic Reason:</strong> {diag.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={handleRunIndexCleanupScan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Rescan Last 100 Queries</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIndexCleanupModal(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    Close Diagnostic
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workload Analysis & Auto-Optimization Modal */}
      {showWorkloadOptimizationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-xs">
                  <Zap className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Workload Analysis &amp; B-Tree Index Optimization</span>
                    <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Optimal Throughput Active
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Audited 14,200 query execution traces across recent workload history and toggled optimal B-Tree indexes for the most expensive queries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkloadOptimizationModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Top-Level Impact Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Queries Audited</div>
                  <div className="text-base font-extrabold text-zinc-900 font-mono mt-0.5">14,200 Traces</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Past 24h Workload</div>
                </div>
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Read Throughput</div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">18,600 QPS</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">+15,400% (was 120 QPS)</div>
                </div>
                <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-indigo-700">P99 Read Latency</div>
                  <div className="text-base font-extrabold text-indigo-700 font-mono mt-0.5">1.9 ms</div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">-99.6% (was 482 ms)</div>
                </div>
                <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Optimal B-Trees</div>
                  <div className="text-base font-extrabold text-purple-700 font-mono mt-0.5">4 Toggled ON</div>
                  <div className="text-[10px] text-purple-600 mt-0.5">100% Query Match</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Workload Optimization Active:</strong> All 4 critical bottleneck queries are now routed through dedicated composite and clustered B-Tree indexes. Sequential table scans eliminated.
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded shrink-0">
                  Confidence: 99.8%
                </span>
              </div>

              {/* Expensive Queries Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                  <span>Top 4 Most Expensive Queries (Audited from Query History)</span>
                  <span className="text-[11px] text-zinc-500 font-normal">Sorted by DB Read CPU Share</span>
                </div>

                {expensiveQueriesWorkload.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-zinc-50/80 hover:bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-bold font-mono">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-zinc-900">{q.name}</span>
                        <span className="text-[10px] font-mono bg-zinc-200 text-zinc-700 px-1.5 py-0.2 rounded font-semibold">
                          {q.frequency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {q.executionShare}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          INDEX TOGGLED ON
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-zinc-900 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      <code>{q.sql}</code>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Before Optimization</div>
                        <div className="text-zinc-700 font-mono font-bold mt-0.5">Latency: <span className="text-rose-600">{q.unindexedLatency}</span></div>
                        <div className="text-[10px] text-zinc-500 font-mono">Throughput: {q.throughputBefore}</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">After Optimal B-Tree</div>
                        <div className="text-zinc-700 font-mono font-bold mt-0.5">Latency: <span className="text-emerald-600">{q.optimizedLatency}</span></div>
                        <div className="text-[10px] text-emerald-700 font-mono font-bold">Throughput: {q.throughputAfter} ({q.speedup})</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Assigned B-Tree Index</div>
                        <div className="text-indigo-900 font-mono font-bold mt-0.5 truncate" title={q.optimalIndexName}>
                          {q.optimalIndexName}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{q.optimalIndexType}</div>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-600">
                      <strong className="text-zinc-800">Optimization Mechanism:</strong> {q.impactExplanation}
                    </p>
                  </div>
                ))}
              </div>

              {/* Dead Index Pruning Notice */}
              <div className="p-3 bg-zinc-100 rounded-xl border border-zinc-200 flex items-center justify-between text-xs text-zinc-700">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>
                    <strong>Buffer Contention Prevention:</strong> Flagged &amp; unlinked unutilized <code className="font-mono bg-zinc-200 px-1 rounded">idx_transactions_date</code> (0 engine hits in last 100 queries) to prevent buffer cache pollution and 14% write latency overhead.
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500 font-bold shrink-0">Pruned</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
              <button
                type="button"
                onClick={handleAutoOptimizeWorkload}
                disabled={isAutoOptimizingWorkload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAutoOptimizingWorkload ? 'animate-spin' : ''}`} />
                <span>Re-run Workload Analysis</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleRevertAllIndexes();
                    setShowWorkloadOptimizationModal(false);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Revert Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowWorkloadOptimizationModal(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Keep Optimal Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
