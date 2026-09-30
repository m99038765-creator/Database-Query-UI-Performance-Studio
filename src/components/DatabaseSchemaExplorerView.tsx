import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Database, Layers, Key, Link, AlertTriangle, CheckCircle2, Shield, ArrowRight, Zap, Table, Plus, Info, X, Download, Sparkles, History, Target, RefreshCw, Trash2, ChevronDown, ChevronRight, ChevronUp, Search, Filter, Activity, HeartPulse, Copy, UploadCloud, FileText, Check, FileCode, Lock, Unlock, Terminal, Code, Sliders } from 'lucide-react';
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
  createdCompositeIndexes?: string[];
  removedIndexes?: string[];
  lockedIndexes?: string[];
  isProtected?: boolean;
  importedCustomIndices?: Array<{
    name: string;
    type: string;
    columns: string[];
    targetTable: string;
    targetEntity?: string;
    active: boolean;
  }>;
  activeSchemaPrototypeName?: string;
  totalIndexesCount?: number;
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
  const [lockedIndexes, setLockedIndexes] = useState<string[]>([]);
  const [isAnalyzingWorkload, setIsAnalyzingWorkload] = useState<boolean>(false);
  const [hasAnalyzedWorkload, setHasAnalyzedWorkload] = useState<boolean>(true);
  const [showQueryComplexityInfo, setShowQueryComplexityInfo] = useState<boolean>(false);
  const [compareWithBaseline, setCompareWithBaseline] = useState<boolean>(false);
  const [showSuggestIndexesModal, setShowSuggestIndexesModal] = useState<boolean>(false);
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(false);
  const [showQueryImpact, setShowQueryImpact] = useState<boolean>(true);
  const [quickIndexChecked, setQuickIndexChecked] = useState<boolean>(false);
  const [hoveredIndexWhatIf, setHoveredIndexWhatIf] = useState<string | null>(null);
  const [showClusterAnalysisModal, setShowClusterAnalysisModal] = useState<boolean>(false);
  const [showIndexCleanupModal, setShowIndexCleanupModal] = useState<boolean>(false);
  const [showAutoCleanupPreviewModal, setShowAutoCleanupPreviewModal] = useState<boolean>(false);
  const [isScanningCleanup, setIsScanningCleanup] = useState<boolean>(false);
  const [cleanupScanCompleted, setCleanupScanCompleted] = useState<boolean>(false);
  const [removedIndexes, setRemovedIndexes] = useState<string[]>([]);
  const [reindexedIndexes, setReindexedIndexes] = useState<string[]>([]);
  const [simulatedFailedIndexes, setSimulatedFailedIndexes] = useState<string[]>([]);
  const [rebuildingIndexes, setRebuildingIndexes] = useState<string[]>([]);
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
  const [showBulkOptimizeModal, setShowBulkOptimizeModal] = useState<boolean>(false);
  const [showCrossReferenceReportModal, setShowCrossReferenceReportModal] = useState<boolean>(false);
  const [bulkDryRunActive, setBulkDryRunActive] = useState<boolean>(false);
  const [dryRunPreviewList, setDryRunPreviewList] = useState<Array<{ name: string; impact: string; projectedHealth: number }> | null>(null);
  const [bulkOptimizeSuccessNotice, setBulkOptimizeSuccessNotice] = useState<string | null>(null);
  const [isApplyingBulkOptimize, setIsApplyingBulkOptimize] = useState<boolean>(false);
  const [showAiSuggestionsSidePanel, setShowAiSuggestionsSidePanel] = useState<boolean>(true);
  const [disabledImpactEdges, setDisabledImpactEdges] = useState<Record<string, boolean>>({});
  const [selectedCompositeSuggestionId, setSelectedCompositeSuggestionId] = useState<string>('idx_transactions_email_status');
  const [compositePatternFilter, setCompositePatternFilter] = useState<'all' | 'transactions' | 'line_items' | 'customers'>('all');
  const [aiSuggestionSortBy, setAiSuggestionSortBy] = useState<'gain' | 'risk' | 'complexity'>('gain');
  const [copiedDdlIndex, setCopiedDdlIndex] = useState<string | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [importSuccessNotice, setImportSuccessNotice] = useState<string | null>(null);
  const [importedCustomIndices, setImportedCustomIndices] = useState<Array<{
    name: string;
    type: string;
    columns: string[];
    targetTable: string;
    targetEntity?: string;
    active: boolean;
  }>>([]);
  const [activeSchemaPrototypeName, setActiveSchemaPrototypeName] = useState<string>('Standard Workload Schema');
  const [bulkImportActiveTab, setBulkImportActiveTab] = useState<'upload' | 'presets' | 'schema-spec'>('upload');
  const [importJsonInput, setImportJsonInput] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importSnapshotBeforeApply, setImportSnapshotBeforeApply] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [enableAutoHealing, setEnableAutoHealing] = useState<boolean>(false);

  // Global keyboard shortcuts for power users (Ctrl+S to save snapshot, Ctrl+Shift+O to run bulk optimization)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleOpenSnapshotModal();
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleAutoOptimizeWorkload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // AI-Driven Composite Index Opportunities derived from analyzing user query pattern history
  const compositeIndexOpportunities = useMemo(() => [
    {
      id: 'idx_transactions_email_status',
      name: 'idx_transactions_email_status',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email', 'status'],
      compositeKey: 'email_status',
      patternCategory: 'Equality + Filter',
      speedup: '99.8%',
      speedupMultiplier: '246x Faster',
      latencyBefore: '395 ms',
      latencyAfter: '1.6 ms',
      frequencyPerHour: '5,120 queries/hr',
      executionShare: '29.1% DB CPU time',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      storageFootprint: '+4.2 MB (+8.7%)',
      writeImpact: '+0.9ms on batch write',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20;',
      queryPurpose: 'Customer Account Order Verification & Status Inspection',
      columnOrdering: [
        {
          column: 'customer_email',
          role: 'Leading Equality Key (High Selectivity)',
          rationale: 'Email address has high cardinality (~45,000 distinct values). Placing it first segments the index into tiny branches, isolating matching candidate rows instantly.'
        },
        {
          column: 'status',
          role: 'Trailing Filter Key (State Qualification)',
          rationale: 'Status has low selectivity (4 states: pending, completed, cancelled, refunded). Co-locating it second allows discarding non-matching orders right at the B-Tree leaf level without touching table heap pages.'
        }
      ],
      rationale: {
        summary: 'Single-column indexes on customer_email force the query engine to fetch underlying table heap pages for each row just to check the status field, triggering heavy disk buffer cache churn. The composite index co-locates customer_email and status directly in adjacent B-Tree leaf blocks, eliminating 99.4% of table I/O reads.',
        heapScanProblem: 'With single-column indexing, 1,200+ heap pages are traversed per query. With composite indexing, 0 heap pages are visited for non-matching records.',
        columnOrderJustification: 'Standard B-Tree rule: Equality predicates with high selectivity must lead before low-selectivity filter keys to maximize index branch traversal speed.',
        plannerMechanics: 'Transforms Bitmap Heap Scan + Filter Recheck into a direct logarithmic Index Scan seeking straight to matching leaf tuples.'
      },
      planBefore: "Seq Scan on transactions (cost=0.00..1845.00 rows=12 width=142)\n  Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      planAfter: "Index Scan using idx_transactions_email_status on transactions (cost=0.42..8.45 rows=12 width=142)\n  Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      ddlStatement: 'CREATE INDEX idx_transactions_email_status ON transactions (customer_email, status);',
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
      id: 'idx_transactions_category_amount',
      name: 'idx_transactions_category_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['category', 'amount'],
      compositeKey: 'category_amount',
      patternCategory: 'Equality + Range Aggregation',
      speedup: '99.6%',
      speedupMultiplier: '253x Faster',
      latencyBefore: '482 ms',
      latencyAfter: '1.9 ms',
      frequencyPerHour: '8,900 queries/hr',
      executionShare: '38.4% DB CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      storageFootprint: '+6.8 MB (+14.1%)',
      writeImpact: '+1.1ms on batch write',
      querySql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category;',
      queryPurpose: 'Departmental Category Revenue & Range Aggregation',
      columnOrdering: [
        {
          column: 'category',
          role: 'Leading Equality Key (Merchandise Category)',
          rationale: 'Category acts as the partition filter. Placing category first allows the B-Tree root search to descend directly to the leaf page section for that specific category.'
        },
        {
          column: 'amount',
          role: 'Trailing Range Key (Numeric Threshold)',
          rationale: 'Amount is evaluated as a range condition (> threshold). Placing amount second bounds the leaf page scan to only rows satisfying the threshold, eliminating temporary RAM sort buffers.'
        }
      ],
      rationale: {
        summary: 'Filtering by equality on category AND a range condition on amount without composite indexing forces PostgreSQL to either scan the whole table or load thousands of category rows into RAM to evaluate amount. This composite index groups category and amount in sorted order, turning an expensive table scan into a logarithmic seek.',
        heapScanProblem: 'Queries spend 38.4% of all DB read CPU time spilling HashAggregate batches to temporary disk buffers due to unindexed category-amount ranges.',
        columnOrderJustification: 'Critical B-Tree rule: Equality columns MUST precede Range columns. If amount were placed first, the engine could not use category for direct seeks after the range predicate.',
        plannerMechanics: 'Replaces HashAggregate and sequential disk spill with a stream GroupAggregate read directly from pre-sorted composite leaf blocks.'
      },
      planBefore: "HashAggregate (cost=1950.00..1960.00 rows=8 width=44)\n  -> Seq Scan on transactions Filter: ((category = 'Electronics'::text) AND (amount > 100.00))",
      planAfter: "GroupAggregate (cost=0.42..18.20 rows=8 width=44)\n  -> Index Scan using idx_transactions_category_amount on transactions Index Cond: ((category = 'Electronics'::text) AND (amount > 100.00))",
      ddlStatement: 'CREATE INDEX idx_transactions_category_amount ON transactions (category, amount);',
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
      id: 'idx_line_items_tx_price',
      name: 'idx_line_items_tx_price',
      targetTable: 'line_items',
      targetEntity: 'Order Items Entity',
      targetColumns: ['transaction_id', 'unit_price'],
      compositeKey: 'tx_price',
      patternCategory: 'Join + Price Filter',
      speedup: '99.5%',
      speedupMultiplier: '185x Faster',
      latencyBefore: '280 ms',
      latencyAfter: '1.5 ms',
      frequencyPerHour: '6,400 queries/hr',
      executionShare: '18.7% DB CPU time',
      throughputBefore: '35 QPS',
      throughputAfter: '6,470 QPS',
      storageFootprint: '+3.8 MB (+7.8%)',
      writeImpact: '+0.5ms on item add',
      querySql: 'SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = ? AND li.unit_price >= 50.00;',
      queryPurpose: 'High-Value Relational Child Item Expansion',
      columnOrdering: [
        {
          column: 'transaction_id',
          role: 'Foreign Key Anchor (Join Predicate)',
          rationale: 'Matches parent transactions.id. Leading position satisfies the relational join condition instantly.'
        },
        {
          column: 'unit_price',
          role: 'Secondary Numeric Filter (Covering Filter)',
          rationale: 'Filters high-value items directly within the index leaf, avoiding secondary heap page reads for cheaper items.'
        }
      ],
      rationale: {
        summary: 'Historical query traces show heavy traffic joining transactions with line_items while filtering for premium items (unit_price >= 50). A single foreign key index still requires fetching line_items rows from disk to check the price. This composite index allows an Index-Only Scan resolving the join and price filter with 0 table heap fetches.',
        heapScanProblem: 'Nested loop joins perform sequential table visits on line_items heap blocks for each order, causing 280ms latency spikes.',
        columnOrderJustification: 'transaction_id leads to bind the foreign key equality from the parent order, with unit_price following to filter lines in-index.',
        plannerMechanics: 'Upgrades Nested Loop with filter recheck into a direct Index Only Scan on line_items with zero table heap page fetches.'
      },
      planBefore: "Nested Loop (cost=0.00..2800.00 rows=40 width=88)\n  -> Seq Scan on line_items Filter: ((transaction_id = t.id) AND (unit_price >= 50.00))",
      planAfter: "Index Only Scan using idx_line_items_tx_price on line_items (cost=0.42..14.30 rows=40 width=88)\n  Index Cond: ((transaction_id = t.id) AND (unit_price >= 50.00))\n  Heap Fetches: 0",
      ddlStatement: 'CREATE INDEX idx_line_items_tx_price ON line_items (transaction_id, unit_price);',
      isApplied: createdCompositeIndexes.includes('tx_price'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('tx_price')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'tx_price'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'tx_price']);
        }
      }
    },
    {
      id: 'idx_customers_tier_created',
      name: 'idx_customers_tier_created',
      targetTable: 'customers',
      targetEntity: 'Customers Entity',
      targetColumns: ['tier', 'created_at'],
      compositeKey: 'tier_created',
      patternCategory: 'Equality + Order By',
      speedup: '99.3%',
      speedupMultiplier: '140x Faster',
      latencyBefore: '165 ms',
      latencyAfter: '1.2 ms',
      frequencyPerHour: '3,850 queries/hr',
      executionShare: '12.2% DB CPU time',
      throughputBefore: '42 QPS',
      throughputAfter: '5,880 QPS',
      storageFootprint: '+2.6 MB (+5.4%)',
      writeImpact: '+0.4ms on customer signup',
      querySql: 'SELECT id, name, email, tier FROM customers WHERE tier = ? ORDER BY created_at DESC LIMIT 50;',
      queryPurpose: 'Tiered Customer Cohort & Recent Signup Stream',
      columnOrdering: [
        {
          column: 'tier',
          role: 'Leading Equality Key (Membership Cohort)',
          rationale: 'Categorical filter matching target account level (e.g. enterprise, vip, standard).'
        },
        {
          column: 'created_at',
          role: 'Pre-Sorted Order Key (Zero-Sort Delivery)',
          rationale: 'Provides physical ordering by creation timestamp in the B-Tree leaf pages, satisfying ORDER BY created_at DESC with 0 memory sort buffers.'
        }
      ],
      rationale: {
        summary: 'Historical query logs show continuous dashboard polling for recent customer signups filtered by tier. Single-column indexing on tier locates matching records but forces PostgreSQL to sort all matching records in RAM before applying LIMIT 50. This composite index stores records already sorted by timestamp within each tier leaf chain, enabling instant early termination after 50 rows.',
        heapScanProblem: 'Explicit Sort nodes consume WorkMem and risk spilling to temporary disk files when customer tiers grow.',
        columnOrderJustification: 'tier leads to isolate the requested cohort. created_at follows in descending order to avoid filesort.',
        plannerMechanics: 'Replaces Bitmap Heap Scan + Sort node with an Index Scan Backward that halts execution as soon as 50 rows are produced.'
      },
      planBefore: "Limit (cost=160.00..165.00 rows=50 width=128)\n  -> Sort (cost=155.00..160.00) Sort Key: created_at DESC\n        -> Bitmap Heap Scan on customers Filter: (tier = 'enterprise'::text)",
      planAfter: "Limit (cost=0.42..12.50 rows=50 width=128)\n  -> Index Scan using idx_customers_tier_created on customers\n        Index Cond: (tier = 'enterprise'::text)\n        Buffers: shared hit=4",
      ddlStatement: 'CREATE INDEX idx_customers_tier_created ON customers (tier, created_at DESC);',
      isApplied: createdCompositeIndexes.includes('tier_created'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('tier_created')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'tier_created'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'tier_created']);
        }
      }
    }
  ], [createdCompositeIndexes]);

  const handleToggleLockIndex = (indexName: string) => {
    setLockedIndexes((prev) => {
      const isNowLocked = !prev.includes(indexName);
      const nextLocked = isNowLocked ? [...prev, indexName] : prev.filter((name) => name !== indexName);
      setImportSuccessNotice(
        isNowLocked
          ? `Locked index "${indexName}": High-priority manual lock enabled. Protected against Auto-Optimize and Index Cleanup.`
          : `Unlocked index "${indexName}": Can now be modified or pruned by automated operations.`
      );
      setTimeout(() => {
        setImportSuccessNotice(null);
      }, 4500);
      return nextLocked;
    });
  };

  const handleAutoOptimizeWorkload = () => {
    setIsAutoOptimizingWorkload(true);
    setTimeout(() => {
      // 1. Toggle core B-Tree flags for expensive queries (if affected indexes are not locked)
      if (!flags.btreeIndexing && !lockedIndexes.includes('idx_orders_status_cat')) {
        onToggleFlag('btreeIndexing');
      }
      if (!flags.batchEagerLoading && !lockedIndexes.includes('idx_line_items_tx')) {
        onToggleFlag('batchEagerLoading');
      }

      // 2. Toggle optimal composite B-Tree indexes for multi-column predicates (respecting locks)
      setCreatedCompositeIndexes((prev) => {
        const next = new Set(['email_status', 'category_amount', 'tx_price', 'tier_created']);
        if (lockedIndexes.includes('idx_transactions_email_status') && !prev.includes('email_status')) next.delete('email_status');
        if (lockedIndexes.includes('idx_transactions_category_amount') && !prev.includes('category_amount')) next.delete('category_amount');
        if (lockedIndexes.includes('idx_line_items_tx_price') && !prev.includes('tx_price')) next.delete('tx_price');
        if (lockedIndexes.includes('idx_customers_tier_created') && !prev.includes('tier_created')) next.delete('tier_created');
        return Array.from(next);
      });

      // 3. Ensure single-column indexes are set (respecting locks)
      setCreatedCustomIndexes((prev) => {
        const additions: string[] = [];
        if (!lockedIndexes.includes('idx_transactions_email_missing')) additions.push('customer_email');
        if (!lockedIndexes.includes('idx_transactions_amount_missing')) additions.push('amount');
        return Array.from(new Set([...prev, ...additions]));
      });

      // 4. Prune dead unutilized index (idx_transactions_date) to prevent buffer cache pollution ONLY if NOT locked
      if (!lockedIndexes.includes('idx_transactions_date')) {
        setRemovedIndexes((prev) => Array.from(new Set([...prev, 'idx_transactions_date'])));
      }

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
    if (lockedIndexes.includes(idxName)) {
      setImportSuccessNotice(`Cannot remove index "${idxName}": Index is locked as high-priority manual.`);
      setTimeout(() => setImportSuccessNotice(null), 4000);
      return;
    }
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
    const unutilized = ['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing']
      .filter((name) => !lockedIndexes.includes(name));
    setRemovedIndexes((prev) => Array.from(new Set([...prev, ...unutilized])));
    setCreatedCustomIndexes((prev) =>
      prev.filter((c) => {
        if (c === 'customer_email' && lockedIndexes.includes('idx_transactions_email_missing')) return true;
        if (c === 'amount' && lockedIndexes.includes('idx_transactions_amount_missing')) return true;
        return c !== 'customer_email' && c !== 'amount';
      })
    );
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
    if (lockedIndexes.includes(idxName)) {
      setImportSuccessNotice(`Cannot consolidate index "${idxName}": Index is locked as high-priority manual.`);
      setTimeout(() => setImportSuccessNotice(null), 4000);
      return;
    }
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
    const lockedCustom: string[] = [];
    if (lockedIndexes.includes('idx_transactions_email_missing')) lockedCustom.push('customer_email');
    if (lockedIndexes.includes('idx_transactions_amount_missing')) lockedCustom.push('amount');
    setCreatedCustomIndexes(lockedCustom);

    const lockedComposite: string[] = [];
    if (lockedIndexes.includes('idx_transactions_email_status')) lockedComposite.push('email_status');
    if (lockedIndexes.includes('idx_transactions_category_amount')) lockedComposite.push('category_amount');
    if (lockedIndexes.includes('idx_line_items_tx_price')) lockedComposite.push('tx_price');
    if (lockedIndexes.includes('idx_customers_tier_created')) lockedComposite.push('tier_created');
    setCreatedCompositeIndexes(lockedComposite);

    setConsolidatedIndexes([]);
    setRemovedIndexes([]);
    setImportedCustomIndices((prev) => prev.filter((idx) => lockedIndexes.includes(idx.name)));
    setActiveSchemaPrototypeName('Standard Workload Schema');
    setCleanupScanCompleted(false);
    setAutoOptimizedCompleted(false);
  };

  const [snapshots, setSnapshots] = useState<SchemaSnapshot[]>([
    {
      id: 'snapshot-default',
      name: 'Default Baseline State',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      flags: { batchEagerLoading: false, btreeIndexing: false, queryCaching: false, virtualizedDOM: false, deferredRendering: false },
      customIndexes: [],
      createdCompositeIndexes: [],
      removedIndexes: [],
      importedCustomIndices: [],
      activeSchemaPrototypeName: 'Default Baseline State',
      totalIndexesCount: 6
    }
  ]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>('snapshot-default');
  const [showNamedSnapshotModal, setShowNamedSnapshotModal] = useState<boolean>(false);
  const [newSnapshotName, setNewSnapshotName] = useState<string>('');
  const [showSnapshotsModal, setShowSnapshotsModal] = useState<boolean>(false);
  const [migrationVersion1Id, setMigrationVersion1Id] = useState<string>('snapshot-default');
  const [migrationVersion2Id, setMigrationVersion2Id] = useState<string>('snapshot-default');
  const [showCompareSchemaOverlay, setShowCompareSchemaOverlay] = useState<boolean>(false);
  const [compareSnapshotAId, setCompareSnapshotAId] = useState<string>('snapshot-default');
  const [compareSnapshotBId, setCompareSnapshotBId] = useState<string>('snapshot-default');

  const handleExportMigrationSQL = () => {
    const v1 = snapshots.find((s) => s.id === migrationVersion1Id) || snapshots[0];
    const v2 = snapshots.find((s) => s.id === migrationVersion2Id) || snapshots[snapshots.length - 1];
    if (!v1 || !v2) return;

    let sqlLines: string[] = [];
    sqlLines.push(`-- =====================================================================`);
    sqlLines.push(`-- PostgreSQL Production Migration Script`);
    sqlLines.push(`-- Generated from Schema Versioning Comparison`);
    sqlLines.push(`-- From Version: "${v1.name}" (${v1.timestamp})`);
    sqlLines.push(`-- To Version:   "${v2.name}" (${v2.timestamp})`);
    sqlLines.push(`-- =====================================================================\n`);

    sqlLines.push(`BEGIN;\n`);

    if (v1.flags?.btreeIndexing !== v2.flags?.btreeIndexing) {
      sqlLines.push(`-- [Flag Delta] btreeIndexing changed: ${v1.flags?.btreeIndexing} -> ${v2.flags?.btreeIndexing}`);
      sqlLines.push(`ALTER DATABASE CURRENT SET enable_seqscan = ${v2.flags?.btreeIndexing ? 'off' : 'on'};\n`);
    }

    const v1Custom = new Set(v1.customIndexes || []);
    const v2Custom = new Set(v2.customIndexes || []);

    for (const idx of v2Custom) {
      if (!v1Custom.has(idx)) {
        sqlLines.push(`-- [Add Custom Index]`);
        if (idx === 'customer_email') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_email_missing ON transactions (customer_email);`);
        } else if (idx === 'amount') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_amount_missing ON transactions (amount);`);
        } else {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_${idx} ON transactions (${idx});`);
        }
      }
    }

    for (const idx of v1Custom) {
      if (!v2Custom.has(idx)) {
        sqlLines.push(`-- [Drop Custom Index]`);
        if (idx === 'customer_email') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_email_missing;`);
        } else if (idx === 'amount') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_amount_missing;`);
        } else {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_${idx};`);
        }
      }
    }

    const v1Comp = new Set(v1.createdCompositeIndexes || []);
    const v2Comp = new Set(v2.createdCompositeIndexes || []);

    for (const comp of v2Comp) {
      if (!v1Comp.has(comp)) {
        sqlLines.push(`-- [Add Composite Index]`);
        if (comp === 'email_status') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_email_status ON transactions (customer_email, status);`);
        } else if (comp === 'category_amount') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_category_amount ON transactions (category, amount);`);
        } else if (comp === 'tx_price') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_line_items_tx_price ON line_items (transaction_id, unit_price);`);
        } else if (comp === 'tier_created') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_customers_tier_created ON customers (tier, created_at DESC);`);
        } else {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_${comp} ON transactions (${comp});`);
        }
      }
    }

    for (const comp of v1Comp) {
      if (!v2Comp.has(comp)) {
        sqlLines.push(`-- [Drop Composite Index]`);
        if (comp === 'email_status') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_email_status;`);
        } else if (comp === 'category_amount') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_category_amount;`);
        } else if (comp === 'tx_price') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_line_items_tx_price;`);
        } else if (comp === 'tier_created') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_customers_tier_created;`);
        } else {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_${comp};`);
        }
      }
    }

    const v1Removed = new Set(v1.removedIndexes || []);
    const v2Removed = new Set(v2.removedIndexes || []);

    for (const rem of v2Removed) {
      if (!v1Removed.has(rem)) {
        sqlLines.push(`-- [Prune Unutilized Index]`);
        sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS ${rem};`);
      }
    }

    sqlLines.push(`\nCOMMIT;`);

    const sqlContent = sqlLines.join('\n');
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_${v1.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_to_${v2.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setImportSuccessNotice(`Successfully generated & downloaded Migration SQL script between "${v1.name}" and "${v2.name}"!`);
    setTimeout(() => setImportSuccessNotice(null), 5000);
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
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'transactions' && !removedIndexes.includes(idx.name)),
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
        { name: 'unit_price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tx_price') },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: true },
        { name: 'idx_line_items_tx', type: 'B-Tree (Foreign Key)', columns: ['transaction_id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: flags.batchEagerLoading },
        { name: 'idx_line_items_tx_price', type: 'Composite B-Tree (AI Recommended)', columns: ['transaction_id', 'unit_price'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: createdCompositeIndexes.includes('tx_price') && !removedIndexes.includes('idx_line_items_tx_price') },
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'line_items' && !removedIndexes.includes(idx.name)),
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
        { name: 'tier', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tier_created') },
        { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tier_created') },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true },
        { name: 'idx_customers_email', type: 'B-Tree Unique', columns: ['email'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true },
        { name: 'idx_customers_tier_created', type: 'Composite B-Tree (AI Recommended)', columns: ['tier', 'created_at'], targetTable: 'customers', targetEntity: 'Customers Entity', active: createdCompositeIndexes.includes('tier_created') && !removedIndexes.includes('idx_customers_tier_created') },
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'customers' && !removedIndexes.includes(idx.name)),
      ],
      relationships: []
    },
    ...Array.from(new Set<string>(importedCustomIndices.map((i) => i.targetTable)))
      .filter((tableName: string) => !['transactions', 'line_items', 'customers'].includes(tableName))
      .map((tableName: string) => ({
        name: tableName,
        entityName: `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Entity`,
        entityBadge: 'Prototyped Entity',
        entityRole: 'Custom Imported Table',
        description: 'Prototyped database table schema imported from JSON index configuration.',
        columns: [
          { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
          ...Array.from(
            new Set<string>(importedCustomIndices.filter((i) => i.targetTable === tableName).flatMap((i) => i.columns))
          ).map((colName: string) => ({
            name: colName,
            type: 'VARCHAR(128)',
            isPk: false,
            isFk: false,
            indexed: true
          }))
        ],
        indexes: importedCustomIndices.filter((i) => i.targetTable === tableName && !removedIndexes.includes(i.name)),
        relationships: []
      }))
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

  // Sample index configuration presets for instant schema prototyping
  const samplePresets = useMemo(() => [
    {
      id: 'preset-ecommerce-high-throughput',
      name: 'E-Commerce Peak Workload (Full Composite)',
      badge: 'High Throughput',
      description: 'Co-locates multi-column filter predicates (email + status, category + amount, tx + price) to eliminate 99.4% of table heap lookups.',
      speedup: '253x Faster (482ms → 1.9ms)',
      tableCount: 3,
      indexCount: 6,
      jsonContent: JSON.stringify({
        name: "E-Commerce Peak Workload (Full Composite)",
        description: "Composite B-Tree coverage for customer verification, order category aggregations, and item joins.",
        optimizationFlags: {
          btreeIndexing: true,
          batchEagerLoading: true,
          queryCaching: true
        },
        indexConfiguration: {
          createdCompositeIndexes: ["email_status", "category_amount", "tx_price", "tier_created"],
          createdCustomIndexes: ["customer_email", "amount"],
          removedOrPrunedIndexes: ["idx_transactions_date"]
        },
        indices: [
          {
            name: "idx_transactions_status_amount",
            targetTable: "transactions",
            columns: ["status", "amount"],
            type: "Composite B-Tree",
            active: true
          },
          {
            name: "idx_line_items_sku_qty",
            targetTable: "line_items",
            columns: ["sku", "quantity"],
            type: "B-Tree (Covering)",
            active: true
          }
        ]
      }, null, 2)
    },
    {
      id: 'preset-analytics-aggregations',
      name: 'Analytics & Reporting Aggregations (OLAP)',
      badge: 'OLAP / Reporting',
      description: 'Optimized for heavy GROUP BY queries and date-range reporting without disk workmem spillover.',
      speedup: '180x Faster (320ms → 1.8ms)',
      tableCount: 3,
      indexCount: 4,
      jsonContent: JSON.stringify({
        name: "Analytics & Reporting Aggregations (OLAP)",
        description: "Pre-grouped range aggregates eliminating disk sorts and temporary RAM workmem spills.",
        optimizationFlags: {
          btreeIndexing: true,
          batchEagerLoading: true,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: ["category_amount", "tier_created"],
          createdCustomIndexes: ["amount"],
          removedOrPrunedIndexes: []
        },
        indices: [
          {
            name: "idx_transactions_cat_date",
            targetTable: "transactions",
            columns: ["category", "created_at"],
            type: "Composite B-Tree",
            active: true
          }
        ]
      }, null, 2)
    },
    {
      id: 'preset-write-heavy-lean',
      name: 'Write-Heavy Ingestion (Low Amplification)',
      badge: 'Write-Optimized',
      description: 'Prunes redundant single-column indexes to minimize WAL log write overhead and write lock latency during bulk ETL.',
      speedup: '+18% Write Throughput Saved',
      tableCount: 3,
      indexCount: 2,
      jsonContent: JSON.stringify({
        name: "Write-Heavy Ingestion (Low Amplification)",
        description: "Lean indexing strategy minimizing B-Tree leaf write amplification and buffer cache churn.",
        optimizationFlags: {
          btreeIndexing: false,
          batchEagerLoading: true,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: ["tx_price"],
          createdCustomIndexes: [],
          removedOrPrunedIndexes: ["idx_transactions_date", "idx_transactions_email_missing", "idx_transactions_amount_missing"]
        },
        indices: []
      }, null, 2)
    },
    {
      id: 'preset-3nf-baseline',
      name: '3NF Normalized Baseline (FK Only)',
      badge: 'Integrity Baseline',
      description: 'Standard relational primary keys and foreign key join anchors only. Useful as a baseline benchmark.',
      speedup: '1.0x (Unoptimized Baseline)',
      tableCount: 3,
      indexCount: 3,
      jsonContent: JSON.stringify({
        name: "3NF Normalized Baseline (FK Only)",
        description: "Relational integrity baseline without custom composite indexes for comparison.",
        optimizationFlags: {
          btreeIndexing: false,
          batchEagerLoading: false,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: [],
          createdCustomIndexes: [],
          removedOrPrunedIndexes: []
        },
        indices: []
      }, null, 2)
    }
  ], []);

  // Real-time JSON validation and schema parsing engine for Bulk Import
  const parsedImportResult = useMemo(() => {
    const raw = importJsonInput.trim();
    if (!raw) {
      return {
        isValid: false,
        error: null,
        config: null
      };
    }

    try {
      const data = JSON.parse(raw);
      let stateName = 'Custom Imported Schema State';
      let stateDescription = 'Imported index configurations for schema state prototyping.';
      const targetTables = new Set<string>();
      let compositeKeys: string[] = [];
      let customKeys: string[] = [];
      let prunedKeys: string[] = [];
      const flagOverrides: Partial<OptimizationFlags> = {};
      const customIndexList: Array<{
        name: string;
        type: string;
        columns: string[];
        targetTable: string;
        targetEntity?: string;
        active: boolean;
      }> = [];

      // Format 1: Direct snapshot or config object
      if (typeof data === 'object' && !Array.isArray(data)) {
        if (data.name) stateName = data.name;
        if (data.snapshotMetadata?.stateDescription) stateName = data.snapshotMetadata.stateDescription;
        if (data.description) stateDescription = data.description;

        // Flags
        const flagsObj = data.optimizationFlags || data.flags;
        if (flagsObj && typeof flagsObj === 'object') {
          if (typeof flagsObj.btreeIndexing === 'boolean') flagOverrides.btreeIndexing = flagsObj.btreeIndexing;
          if (typeof flagsObj.batchEagerLoading === 'boolean') flagOverrides.batchEagerLoading = flagsObj.batchEagerLoading;
          if (typeof flagsObj.queryCaching === 'boolean') flagOverrides.queryCaching = flagsObj.queryCaching;
        }

        // Index configurations
        const indexConfig = data.indexConfiguration || data.indexConfig || data;
        if (Array.isArray(indexConfig.createdCompositeIndexes)) {
          compositeKeys = indexConfig.createdCompositeIndexes;
        }
        if (Array.isArray(indexConfig.createdCustomIndexes)) {
          customKeys = indexConfig.createdCustomIndexes;
        }
        if (Array.isArray(indexConfig.removedOrPrunedIndexes)) {
          prunedKeys = indexConfig.removedOrPrunedIndexes;
        } else if (Array.isArray(indexConfig.removedIndexes)) {
          prunedKeys = indexConfig.removedIndexes;
        }

        // Extract custom index definitions if provided in indices / indexes array
        const rawIndices = data.indices || data.indexes;
        if (Array.isArray(rawIndices)) {
          rawIndices.forEach((item: any) => {
            if (item && typeof item === 'object' && item.name) {
              const tbl = item.targetTable || item.table || 'transactions';
              targetTables.add(tbl);
              const cols = Array.isArray(item.columns) ? item.columns : (item.column ? [item.column] : ['id']);
              customIndexList.push({
                name: item.name,
                type: item.type || (cols.length > 1 ? 'Composite B-Tree' : 'B-Tree'),
                columns: cols,
                targetTable: tbl,
                targetEntity: item.targetEntity || `${tbl.charAt(0).toUpperCase() + tbl.slice(1)} Entity`,
                active: item.active !== false
              });
            }
          });
        }

        if (Array.isArray(data.tablesAndEntities)) {
          data.tablesAndEntities.forEach((t: any) => {
            if (t.tableName) targetTables.add(t.tableName);
          });
        }
      } else if (Array.isArray(data)) {
        // Format 2: Direct array of index objects
        stateName = `Custom Index Array (${data.length} indices)`;
        data.forEach((item: any, idx: number) => {
          if (item && typeof item === 'object') {
            const tbl = item.targetTable || item.table || 'transactions';
            targetTables.add(tbl);
            const cols = Array.isArray(item.columns) ? item.columns : (item.column ? [item.column] : [`col_${idx}`]);
            const idxName = item.name || `idx_${tbl}_${cols.join('_')}`;
            customIndexList.push({
              name: idxName,
              type: item.type || (cols.length > 1 ? 'Composite B-Tree (Imported)' : 'B-Tree (Imported)'),
              columns: cols,
              targetTable: tbl,
              targetEntity: item.targetEntity || `${tbl.charAt(0).toUpperCase() + tbl.slice(1)} Entity`,
              active: item.active !== false
            });
            // Auto-detect composite shortcuts
            if (cols.includes('customer_email') && cols.includes('status')) compositeKeys.push('email_status');
            if (cols.includes('category') && cols.includes('amount')) compositeKeys.push('category_amount');
            if (cols.includes('transaction_id') && cols.includes('unit_price')) compositeKeys.push('tx_price');
            if (cols.includes('tier') && cols.includes('created_at')) compositeKeys.push('tier_created');
            if (cols.length === 1 && cols[0] === 'customer_email') customKeys.push('customer_email');
            if (cols.length === 1 && cols[0] === 'amount') customKeys.push('amount');
          }
        });
      }

      if (compositeKeys.length > 0) {
        compositeKeys.forEach(k => {
          if (['email_status', 'category_amount'].includes(k)) targetTables.add('transactions');
          if (k === 'tx_price') targetTables.add('line_items');
          if (k === 'tier_created') targetTables.add('customers');
        });
      }
      if (customKeys.length > 0) targetTables.add('transactions');
      if (targetTables.size === 0) {
        targetTables.add('transactions');
        targetTables.add('line_items');
        targetTables.add('customers');
      }

      const totalIndices = compositeKeys.length + customKeys.length + customIndexList.length;

      return {
        isValid: true,
        error: null,
        config: {
          name: stateName,
          description: stateDescription,
          targetTables: Array.from(targetTables),
          flags: flagOverrides,
          createdCompositeIndexes: Array.from(new Set(compositeKeys)),
          createdCustomIndexes: Array.from(new Set(customKeys)),
          removedIndexes: Array.from(new Set(prunedKeys)),
          customIndices: customIndexList,
          totalIndicesCount: totalIndices,
          targetTablesCount: targetTables.size
        }
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message || 'Invalid JSON syntax',
        config: null
      };
    }
  }, [importJsonInput]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setImportJsonInput(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleJsonTemplate = () => {
    const template = {
      $schema: "https://aistudio.google.com/schemas/database-index-config.v1.json",
      name: "Custom E-Commerce Prototype Schema",
      description: "Composite and single-column index configurations for prototyping schema throughput.",
      optimizationFlags: {
        btreeIndexing: true,
        batchEagerLoading: true,
        queryCaching: true
      },
      indexConfiguration: {
        createdCompositeIndexes: ["email_status", "category_amount", "tx_price", "tier_created"],
        createdCustomIndexes: ["customer_email", "amount"],
        removedOrPrunedIndexes: ["idx_transactions_date"]
      },
      indices: [
        {
          name: "idx_transactions_status_amount",
          targetTable: "transactions",
          columns: ["status", "amount"],
          type: "Composite B-Tree",
          active: true
        },
        {
          name: "idx_line_items_sku_qty",
          targetTable: "line_items",
          columns: ["sku", "quantity"],
          type: "B-Tree (Covering)",
          active: true
        }
      ]
    };
    const jsonBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = "sample-index-configuration-template.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleApplyImportedIndices = () => {
    if (!parsedImportResult.isValid || !parsedImportResult.config) return;
    const config = parsedImportResult.config;

    // 1. Snapshot current schema state if user requested
    if (importSnapshotBeforeApply) {
      const activeCount = tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length, 0);
      const autoSnap: SchemaSnapshot = {
        id: `snapshot-pre-import-${Date.now()}`,
        name: `Pre-Import Baseline (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        flags: { ...flags },
        customIndexes: [...createdCustomIndexes],
        createdCompositeIndexes: [...createdCompositeIndexes],
        removedIndexes: [...removedIndexes],
        lockedIndexes: [...lockedIndexes],
        importedCustomIndices: [...importedCustomIndices],
        activeSchemaPrototypeName: activeSchemaPrototypeName,
        totalIndexesCount: activeCount
      };
      setSnapshots(prev => [...prev, autoSnap]);
      setSelectedCheckpointId(autoSnap.id);
    }

    // 2. Apply flags if defined
    if (config.flags) {
      if (config.flags.btreeIndexing !== undefined && config.flags.btreeIndexing !== flags.btreeIndexing) {
        onToggleFlag('btreeIndexing');
      }
      if (config.flags.batchEagerLoading !== undefined && config.flags.batchEagerLoading !== flags.batchEagerLoading) {
        onToggleFlag('batchEagerLoading');
      }
      if (config.flags.queryCaching !== undefined && config.flags.queryCaching !== flags.queryCaching) {
        onToggleFlag('queryCaching');
      }
    }

    // 3. Apply composite indices
    if (config.createdCompositeIndexes) {
      setCreatedCompositeIndexes(config.createdCompositeIndexes);
    }

    // 4. Apply custom indices
    if (config.createdCustomIndexes) {
      setCreatedCustomIndexes(config.createdCustomIndexes);
    }

    // 5. Apply removed/pruned indices
    if (config.removedIndexes) {
      setRemovedIndexes(config.removedIndexes);
    }

    // 6. Apply custom imported table indices
    if (config.customIndices) {
      setImportedCustomIndices(config.customIndices);
    }

    // 7. Update active prototype state name
    setActiveSchemaPrototypeName(config.name);

    // 8. Close modal and show notification
    setShowBulkImportModal(false);
    setImportSuccessNotice(`Successfully imported & activated index configuration: "${config.name}" (${config.totalIndicesCount} indices across ${config.targetTablesCount} tables)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 6000);
  };

  const handleSelectCheckpoint = (checkpointId: string) => {
    const snap = snapshots.find((s) => s.id === checkpointId);
    if (!snap) return;

    setSelectedCheckpointId(checkpointId);

    // 1. Restore flags if defined
    if (snap.flags) {
      if (snap.flags.btreeIndexing !== undefined && snap.flags.btreeIndexing !== flags.btreeIndexing) {
        onToggleFlag('btreeIndexing');
      }
      if (snap.flags.batchEagerLoading !== undefined && snap.flags.batchEagerLoading !== flags.batchEagerLoading) {
        onToggleFlag('batchEagerLoading');
      }
      if (snap.flags.queryCaching !== undefined && snap.flags.queryCaching !== flags.queryCaching) {
        onToggleFlag('queryCaching');
      }
    }

    // 2. Restore custom indexes
    setCreatedCustomIndexes([...snap.customIndexes]);

    // 3. Restore composite indexes
    setCreatedCompositeIndexes(snap.createdCompositeIndexes ? [...snap.createdCompositeIndexes] : []);

    // 4. Restore removed indexes
    setRemovedIndexes(snap.removedIndexes ? [...snap.removedIndexes] : []);

    // 5. Restore locked indexes
    if (snap.lockedIndexes) {
      setLockedIndexes([...snap.lockedIndexes]);
    } else {
      setLockedIndexes([]);
    }

    // 6. Restore imported custom table indices
    setImportedCustomIndices(snap.importedCustomIndices ? [...snap.importedCustomIndices] : []);

    // 7. Restore prototype name
    if (snap.activeSchemaPrototypeName) {
      setActiveSchemaPrototypeName(snap.activeSchemaPrototypeName);
    } else {
      setActiveSchemaPrototypeName(snap.name);
    }

    // 8. Show user notification
    const totalCount = snap.totalIndexesCount ?? (snap.customIndexes.length + (snap.createdCompositeIndexes?.length ?? 0));
    setImportSuccessNotice(`Switched to checkpoint: "${snap.name}" (${totalCount} active indexes)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 5000);
  };

  const handleOpenSnapshotModal = () => {
    const activeCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length,
      0
    );
    const defaultName = `Checkpoint #${snapshots.length + 1} (${activeCount} Indexes)`;
    setNewSnapshotName(defaultName);
    setShowNamedSnapshotModal(true);
  };

  const handleCreateNamedSnapshot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length,
      0
    );
    const finalName = newSnapshotName.trim() || `Checkpoint #${snapshots.length + 1}`;
    const newSnapshot: SchemaSnapshot = {
      id: `checkpoint-${Date.now()}`,
      name: finalName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      flags: { ...flags },
      customIndexes: [...createdCustomIndexes],
      createdCompositeIndexes: [...createdCompositeIndexes],
      removedIndexes: [...removedIndexes],
      lockedIndexes: [...lockedIndexes],
      importedCustomIndices: [...importedCustomIndices],
      activeSchemaPrototypeName: finalName,
      totalIndexesCount: activeCount
    };

    setSnapshots((prev) => [...prev, newSnapshot]);
    setSelectedCheckpointId(newSnapshot.id);
    setActiveSchemaPrototypeName(finalName);
    setShowNamedSnapshotModal(false);
    setImportSuccessNotice(`Created checkpoint: "${finalName}" with current index configuration (${activeCount} indexes)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 5000);
  };

  const handleRestoreSnapshot = (snap: SchemaSnapshot) => {
    handleSelectCheckpoint(snap.id);
    setShowSnapshotsModal(false);
  };

  const handleReindexIndex = (indexName: string) => {
    if (!reindexedIndexes.includes(indexName)) {
      setReindexedIndexes([...reindexedIndexes, indexName]);
      setImportSuccessNotice(`Successfully executed REINDEX CONCURRENTLY on "${indexName}". Fragmentation reduced to 3% and index health score restored!`);
      setTimeout(() => setImportSuccessNotice(null), 4000);
    }
  };

  const handleToggleSimulateFailure = (indexName: string) => {
    setSimulatedFailedIndexes((prev) => {
      const next = prev.includes(indexName) ? prev.filter((n) => n !== indexName) : [...prev, indexName];
      const isFailed = next.includes(indexName);
      setImportSuccessNotice(
        isFailed
          ? `[Simulated Index Failure] Index "${indexName}" temporarily offline. Queries fall back to full table sequential scans (Latency: +700%, Cost: +900%).`
          : `[Index Recovered] Index "${indexName}" back online. Query execution plans restored.`
      );
      setTimeout(() => setImportSuccessNotice(null), 5000);
      return next;
    });
  };

  const handleRebuildIndex = (indexName: string) => {
    if (rebuildingIndexes.includes(indexName)) return;
    setRebuildingIndexes((prev) => [...prev, indexName]);
    setImportSuccessNotice(`[Maintenance Started] Rebuilding index "${indexName}" (performing VACUUM & REINDEX)...`);

    setTimeout(() => {
      setRebuildingIndexes((prev) => prev.filter((n) => n !== indexName));
      setReindexedIndexes((prev) => (prev.includes(indexName) ? prev : [...prev, indexName]));
      setImportSuccessNotice(`✓ Successfully completed maintenance rebuild on index "${indexName}". B-Tree pages defragmented and statistics updated.`);
      setTimeout(() => setImportSuccessNotice(null), 5000);
    }, 1500);
  };

  // Auto-Healing Effect: automatically re-index indexes with health < 50% when enabled
  useEffect(() => {
    if (!enableAutoHealing) return;
    tables.forEach((tbl) => {
      tbl.indexes.forEach((idx) => {
        const isRemoved = removedIndexes.includes(idx.name);
        if (isRemoved || !idx.active) return;
        const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
        const isReindexed = reindexedIndexes.includes(idx.name);
        if (health.score < 50 && !isReindexed) {
          handleReindexIndex(idx.name);
          setImportSuccessNotice(`[Auto-Healing Triggered] Index "${idx.name}" dropped to ${health.score}% health. Automatically executed REINDEX CONCURRENTLY!`);
          setTimeout(() => setImportSuccessNotice(null), 5000);
        }
      });
    });
  }, [enableAutoHealing, tables, removedIndexes, reindexedIndexes]);

  const handleToggleProtectSnapshot = (snapshotId: string) => {
    setSnapshots((prev) =>
      prev.map((s) => {
        if (s.id === snapshotId) {
          const nextProtected = !s.isProtected;
          setImportSuccessNotice(
            nextProtected
              ? `Snapshot "${s.name}" marked as Protected. Protected from automated overwrite and cleanup.`
              : `Snapshot "${s.name}" un-protected.`
          );
          setTimeout(() => setImportSuccessNotice(null), 4000);
          return { ...s, isProtected: nextProtected };
        }
        return s;
      })
    );
  };

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
    } else if (idxName.includes('email_status') || idxName.includes('category_amount') || idxName.includes('tx_price') || idxName.includes('tier_created')) {
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
    } else if (idxName.includes('orders_status_cat') || idxName.includes('email_status') || idxName.includes('category_amount') || idxName.includes('tx_price') || idxName.includes('tier_created')) {
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

  // Bulk Optimization Calculation Engine:
  // Evaluates every listed index across all tables, calculates the optimal state vs current state,
  // and projects the cumulative schema health, query throughput, and write overhead impacts.
  const bulkOptimizationPlan = useMemo(() => {
    const allListed = tables.flatMap((tbl) =>
      tbl.indexes.map((idx) => {
        const isRemoved = removedIndexes.includes(idx.name);
        const redundant = isIndexRedundant(idx.name, idx.columns);
        const currentHealth = getIndexHealthScore(idx.name, idx.active, tbl.name);

        let isOptimal = false;
        let recommendedAction: 'ACTIVATE' | 'PRUNE' | 'RESTORE' | 'KEEP_OPTIMAL' = 'KEEP_OPTIMAL';
        let actionTitle = 'Index in Optimal State';
        let reason = 'Operating at peak seek efficiency with balanced read/write metrics.';
        let impactDescription = 'Zero action needed; queries execute with optimal O(1) or O(log n) efficiency.';
        let speedupGain = 'Optimal';
        let projectedHealthScore = currentHealth.score;

        const isLocked = lockedIndexes.includes(idx.name);

        if (isLocked) {
          isOptimal = true;
          recommendedAction = 'KEEP_OPTIMAL';
          actionTitle = 'Index Locked (Protected)';
          reason = 'Protected by user lock from automated Auto-Optimize and Index Cleanup modifications.';
          impactDescription = 'Preserved in current user-defined configuration.';
          speedupGain = 'Locked (Protected)';
          projectedHealthScore = currentHealth.score;
        } else if (idx.name.includes('PRIMARY KEY')) {
          if (isRemoved) {
            isOptimal = false;
            recommendedAction = 'RESTORE';
            actionTitle = 'Restore Clustered Index';
            reason = 'Primary key was pruned; restoring it provides instant O(1) row access.';
            impactDescription = 'Restores primary record clustering and avoids full heap scan lookups.';
            speedupGain = 'O(n) → O(1) Seek';
            projectedHealthScore = 98;
          } else {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Primary Clustered Key';
            reason = 'Clustered B-Tree index is active and serving 22,000 queries/hr.';
            impactDescription = 'O(1) Clustered Point Seek.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          }
        } else if (idx.name === 'idx_transactions_date') {
          // Unutilized index with 0 hits in past query batches and write amplification
          if (isRemoved) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Pruned Status';
            reason = 'Unutilized index correctly removed from buffer cache and disk writes.';
            impactDescription = '+14% write latency saved; eliminates buffer cache pollution.';
            speedupGain = 'Optimal (+14% Write Saved)';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'PRUNE';
            actionTitle = 'Prune Unutilized Index';
            reason = 'Zero hits recorded across past 100 query batches; causing 0:100 R/W write amplification.';
            impactDescription = 'Reclaims buffer cache pages and eliminates write overhead on every order insert.';
            speedupGain = '+14% Write Latency Saved';
            projectedHealthScore = 90;
          }
        } else if (idx.name.includes('orders_status_cat')) {
          const isActive = flags.btreeIndexing && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Active Composite Index';
            reason = 'Active Composite B-Tree servicing 18,400 queries/hr.';
            impactDescription = 'O(log n) Composite Range Seek across status and category.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Activate Composite B-Tree';
            reason = 'Currently inactive; queries on status + category fall back to full table scan.';
            impactDescription = 'Reduces query scan cost from 1,845 to 8.45; eliminates sequential scan.';
            speedupGain = '99.7% Latency Reduction';
            projectedHealthScore = 96;
          }
        } else if (idx.name.includes('line_items_tx')) {
          const isActive = flags.batchEagerLoading;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Foreign Key Index';
            reason = 'Active foreign key B-Tree eliminating child join cascades.';
            impactDescription = 'Converts Nested Loop sequential scans to O(1) Hash Joins.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Foreign Key B-Tree';
            reason = 'Unindexed foreign key triggers 100+ separate roundtrips (N+1 storm).';
            impactDescription = 'Collapses sequential N+1 sub-queries into a single index-accelerated batch.';
            speedupGain = '233x Speedup (420ms → 1.8ms)';
            projectedHealthScore = 97;
          }
        } else if (idx.name.includes('email_status')) {
          const isActive = createdCompositeIndexes.includes('email_status') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain AI Composite Index';
            reason = 'Active composite index covering dual equality filter clause.';
            impactDescription = 'Avoids secondary heap visits for customer status queries.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (email, status)';
            reason = 'Customer order status queries suffer 395ms latency from heap lookups.';
            impactDescription = 'Co-locates customer_email and status in adjacent leaf nodes (395ms → 1.6ms).';
            speedupGain = '99.6% Speedup (246x Faster)';
            projectedHealthScore = 94;
          }
        } else if (idx.name.includes('category_amount')) {
          const isActive = createdCompositeIndexes.includes('category_amount') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Range Aggregation Index';
            reason = 'Active composite index accelerating categorical range aggregations.';
            impactDescription = 'Leaf node range seek with in-index ordering.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Range Aggregation Index';
            reason = 'Consumes 38.4% of total DB read CPU time without index coverage.';
            impactDescription = 'Transforms 482ms grouping scans into 1.9ms index range seeks.';
            speedupGain = '253x Speedup (482ms → 1.9ms)';
            projectedHealthScore = 93;
          }
        } else if (idx.name.includes('line_items_tx_price')) {
          const isActive = createdCompositeIndexes.includes('tx_price') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Child Join Composite Index';
            reason = 'Active covering composite index accelerating line item joins.';
            impactDescription = 'Zero heap page fetches during relational joins.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (transaction_id, unit_price)';
            reason = 'Child item price filter queries trigger expensive table heap reads.';
            impactDescription = 'Transforms Nested Loop to Covering Index Only Scan (280ms → 1.5ms).';
            speedupGain = '185x Speedup';
            projectedHealthScore = 95;
          }
        } else if (idx.name.includes('customers_tier_created')) {
          const isActive = createdCompositeIndexes.includes('tier_created') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Tier Ordering Composite Index';
            reason = 'Pre-sorts customer accounts by creation date directly in B-Tree leaves.';
            impactDescription = 'Satisfies ORDER BY created_at DESC with 0 RAM sort buffer.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (tier, created_at)';
            reason = 'VIP customer cohort queries require temporary RAM sort buffers.';
            impactDescription = 'Eliminates explicit Sort node with pre-ordered B-Tree streaming (165ms → 1.2ms).';
            speedupGain = '140x Speedup';
            projectedHealthScore = 94;
          }
        } else if (idx.name.includes('email_missing')) {
          const isCompositeCovered = createdCompositeIndexes.includes('email_status');
          const isCustomActive = createdCustomIndexes.includes('customer_email') && !isRemoved;
          if (isCompositeCovered) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Covered by Composite Index';
            reason = 'Prefix column covered by idx_transactions_email_status.';
            impactDescription = 'Optimally covered by multi-column B-Tree.';
            speedupGain = 'Optimal';
            projectedHealthScore = 82;
          } else if (isCustomActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Active Single-Column Index';
            reason = 'Single column index active for customer_email.';
            impactDescription = 'O(log n) Leaf Node Seek.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Email Index / Composite Coverage';
            reason = 'Full table scan on 50,000 rows when filtering customer email.';
            impactDescription = 'Enables direct leaf node lookup.';
            speedupGain = '99.2% Complexity Reduction';
            projectedHealthScore = 82;
          }
        } else if (idx.name.includes('amount_missing')) {
          const isCustomActive = createdCustomIndexes.includes('amount') && !isRemoved;
          if (isCustomActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Active Single-Column Index';
            reason = 'Index active on amount column.';
            impactDescription = 'O(log n) Range Index Scan.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Amount Numeric Range Index';
            reason = 'Unindexed decimal threshold scan checks 50,000 rows row-by-row.';
            impactDescription = 'Allows planner to seek directly to the boundary leaf node.';
            speedupGain = 'O(n) → O(log n) Seek';
            projectedHealthScore = 80;
          }
        } else if (idx.name.includes('customers_email')) {
          isOptimal = true;
          recommendedAction = 'KEEP_OPTIMAL';
          actionTitle = 'Retain Unique B-Tree Index';
          reason = 'Unique constraint index active and serving customer lookups.';
          impactDescription = 'O(log n) Unique B-Tree Seek.';
          speedupGain = 'Active';
          projectedHealthScore = currentHealth.score;
        } else {
          isOptimal = idx.active;
          recommendedAction = idx.active ? 'KEEP_OPTIMAL' : 'ACTIVATE';
          actionTitle = idx.active ? 'Retain Active Index' : 'Activate Index';
          reason = idx.active ? 'Active index.' : 'Inactive index.';
          impactDescription = 'Index seek optimization.';
          speedupGain = 'Optimal';
          projectedHealthScore = idx.active ? currentHealth.score : 80;
        }

        return {
          id: `${tbl.name}-${idx.name}`,
          tableName: tbl.name,
          tableEntity: tbl.entityName,
          indexName: idx.name,
          indexType: idx.type,
          columns: idx.columns,
          currentActive: idx.active,
          isRemoved,
          isRedundant: redundant,
          currentHealthScore: currentHealth.score,
          currentHealthRating: currentHealth.rating,
          currentBadgeClass: currentHealth.badgeClass,
          projectedHealthScore,
          isOptimal,
          recommendedAction,
          actionTitle,
          reason,
          impactDescription,
          speedupGain
        };
      })
    );

    const pendingChanges = allListed.filter((item) => !item.isOptimal);
    const totalCount = allListed.length;
    const optimalCount = allListed.filter((item) => item.isOptimal).length;
    const isFullyOptimized = pendingChanges.length === 0;

    const currentAvgHealth = Math.round(
      allListed.reduce((acc, item) => acc + item.currentHealthScore, 0) / (totalCount || 1)
    );
    const projectedAvgHealth = Math.round(
      allListed.reduce((acc, item) => acc + item.projectedHealthScore, 0) / (totalCount || 1)
    );
    const healthGain = Math.max(0, projectedAvgHealth - currentAvgHealth);

    return {
      allListed,
      pendingChanges,
      totalCount,
      optimalCount,
      isFullyOptimized,
      currentAvgHealth,
      projectedAvgHealth,
      healthGain
    };
  }, [tables, removedIndexes, flags, createdCompositeIndexes, createdCustomIndexes, lockedIndexes]);

  // Single button handler to apply all calculated optimal improvements at once
  const handleApplyBulkOptimize = () => {
    setIsApplyingBulkOptimize(true);
    setTimeout(() => {
      // 1. Enable primary B-Tree indexing flags (if related indexes are not locked)
      if (!flags.btreeIndexing && !lockedIndexes.includes('idx_orders_status_cat')) {
        onToggleFlag('btreeIndexing');
      }
      if (!flags.batchEagerLoading && !lockedIndexes.includes('idx_line_items_tx')) {
        onToggleFlag('batchEagerLoading');
      }

      // 2. Ensure composite indexes are activated (respecting locked indexes)
      setCreatedCompositeIndexes((prev) => {
        const next = new Set(['email_status', 'category_amount', 'tx_price', 'tier_created']);
        if (lockedIndexes.includes('idx_transactions_email_status') && !prev.includes('email_status')) next.delete('email_status');
        if (lockedIndexes.includes('idx_transactions_category_amount') && !prev.includes('category_amount')) next.delete('category_amount');
        if (lockedIndexes.includes('idx_line_items_tx_price') && !prev.includes('tx_price')) next.delete('tx_price');
        if (lockedIndexes.includes('idx_customers_tier_created') && !prev.includes('tier_created')) next.delete('tier_created');
        return Array.from(next);
      });

      // 3. Ensure custom bottleneck indexes are created (respecting locked indexes)
      setCreatedCustomIndexes((prev) => {
        const additions: string[] = [];
        if (!lockedIndexes.includes('idx_transactions_email_missing')) additions.push('customer_email');
        if (!lockedIndexes.includes('idx_transactions_amount_missing')) additions.push('amount');
        return Array.from(new Set([...prev, ...additions]));
      });

      // 4. Prune unutilized dead index (idx_transactions_date) to reclaim buffer cache & write latency ONLY if NOT locked
      // and un-remove any essential indexes (while preserving user locks)
      setRemovedIndexes((prev) => {
        const withoutEssentials = prev.filter((name) =>
          !name.includes('PRIMARY KEY') &&
          !name.includes('orders_status_cat') &&
          !name.includes('email_status') &&
          !name.includes('category_amount') &&
          !name.includes('tx_price') &&
          !name.includes('tier_created') &&
          !name.includes('line_items_tx') &&
          !lockedIndexes.includes(name)
        );
        if (!lockedIndexes.includes('idx_transactions_date')) {
          return Array.from(new Set([...withoutEssentials, 'idx_transactions_date']));
        }
        return withoutEssentials;
      });

      setIsApplyingBulkOptimize(false);
      setAutoOptimizedCompleted(true);
      setBulkOptimizeSuccessNotice(
        `Bulk Optimization Complete: Applied ${bulkOptimizationPlan.pendingChanges.length} optimal changes across all tables! All ${bulkOptimizationPlan.totalCount} indexes are now in their optimal state with average schema health increased to ${bulkOptimizationPlan.projectedAvgHealth}/100.`
      );
      setTimeout(() => {
        setBulkOptimizeSuccessNotice(null);
      }, 7000);
    }, 450);
  };

  // Real-time index search metrics and table isolation calculation for header filter
  const headerSearchMetrics = useMemo(() => {
    const queryLower = indexSearchQuery.trim().toLowerCase();
    const totalIndexes = tables.reduce((acc, t) => acc + t.indexes.length, 0);

    if (!queryLower) {
      return {
        totalIndexes,
        matchingCount: totalIndexes,
        isFiltering: false,
        matchingTablesCount: tables.length,
        tableMatches: {} as Record<string, number>
      };
    }

    let matchingCount = 0;
    const tableMatches: Record<string, number> = {};

    tables.forEach((tbl) => {
      const matchingIdxs = tbl.indexes.filter((idx) => {
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

      tableMatches[tbl.name] = matchingIdxs.length;
      matchingCount += matchingIdxs.length;
    });

    const matchingTablesCount = Object.values(tableMatches).filter((c) => c > 0).length;

    return {
      totalIndexes,
      matchingCount,
      isFiltering: true,
      matchingTablesCount,
      tableMatches
    };
  }, [tables, indexSearchQuery]);

  // Helper function to dynamically generate realistic PostgreSQL EXPLAIN mini-execution plan previews
  // reflecting whether an index is currently active, unindexed, pruned, or redundant
  const getMiniExecutionPlanPreview = (idxName: string, active: boolean, tableName: string) => {
    const isRemoved = removedIndexes.includes(idxName);
    const redundant = isIndexRedundant(idxName, []);

    if (idxName.includes('PRIMARY KEY')) {
      if (isRemoved) {
        return {
          nodeType: 'Seq Scan (Fallback)',
          isOptimized: false,
          cost: 'cost=0.00..1845.00 rows=1 width=142',
          execTime: '38.4 ms',
          scanMethod: 'O(n) Full Heap Scan',
          cacheHit: '0% (Buffer Thrash)',
          badgeText: '⚠️ Seq Scan Fallback',
          badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
          querySql: `SELECT * FROM ${tableName} WHERE id = '018f3a9e-uuid';`,
          planTree: `->  Seq Scan on ${tableName}  (cost=0.00..1845.00 rows=1 width=142)
      Filter: (id = '018f3a9e-uuid'::uuid)
      Rows Removed by Filter: 49999
      Buffers: shared read=1845`
        };
      }
      return {
        nodeType: 'Index Scan (Clustered)',
        isOptimized: true,
        cost: 'cost=0.29..8.31 rows=1 width=142',
        execTime: '0.04 ms',
        scanMethod: 'O(1) Clustered Point Seek',
        cacheHit: '100% Shared Cache',
        badgeText: '⚡ O(1) Clustered Seek (0.04ms)',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        querySql: `SELECT * FROM ${tableName} WHERE id = '018f3a9e-uuid';`,
        planTree: `->  Index Scan using PRIMARY KEY on ${tableName}  (cost=0.29..8.31 rows=1 width=142)
      Index Cond: (id = '018f3a9e-uuid'::uuid)
      Buffers: shared hit=3`
      };
    }

    if (idxName === 'idx_transactions_date') {
      if (isRemoved) {
        return {
          nodeType: 'Pruned Index (Zero Overhead)',
          isOptimized: true,
          cost: 'write_penalty=0.00ms rows=0',
          execTime: '0.00 ms (Write Reclaimed)',
          scanMethod: '+14% Faster INSERT / UPDATE',
          cacheHit: '2.4 MB Cache Freed',
          badgeText: '✓ Pruned (+14% Write Speedup)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `-- Unutilized index successfully dropped from buffer pool`,
          planTree: `->  Index Pruned from Physical Storage
      Disk Space Saved: 2.4 MB
      Write Amplification Penalty: 0% (was +14% write cost per tx)
      Audit Trace: 0 hits in past 14,200 workload queries`
        };
      }
      return {
        nodeType: 'Bitmap Index Scan (Unutilized)',
        isOptimized: false,
        cost: 'cost=12.50..890.00 rows=12000 width=142',
        execTime: '185.0 ms',
        scanMethod: 'Low Selectivity (+14% Write Drag)',
        cacheHit: 'High Cache Pollution',
        badgeText: '⚠️ Unutilized (0 Hits / 100 Qs)',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE created_at >= NOW() - INTERVAL '1 day';`,
        planTree: `->  Bitmap Heap Scan on transactions  (cost=12.50..890.00 rows=12000)
      Recheck Cond: (created_at >= '2026-09-28'::timestamp)
      ->  Bitmap Index Scan on idx_transactions_date  (cost=0.00..12.50)
      Notice: Zero hits recorded across recent production traffic`
      };
    }

    if (idxName.includes('orders_status_cat')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan (Composite B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..12.30 rows=45 width=128',
          execTime: '1.2 ms',
          scanMethod: 'O(log n) Composite Range Seek',
          cacheHit: '100% Buffer Cache Hit',
          badgeText: '⚡ 1.2ms (99.7% Latency Cut)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE status = 'pending' AND category = 'Electronics' LIMIT 50;`,
          planTree: `->  Index Scan using idx_orders_status_cat on transactions  (cost=0.42..12.30 rows=45 width=128)
      Index Cond: ((status = 'pending'::text) AND (category = 'Electronics'::text))
      Buffers: shared hit=4`
        };
      }
      return {
        nodeType: 'Seq Scan (Unindexed Filter)',
        isOptimized: false,
        cost: 'cost=0.00..1520.00 rows=45 width=128',
        execTime: '412.0 ms',
        scanMethod: 'O(n) Full Table Scan Fallback',
        cacheHit: 'Reads 50,000 Heap Rows',
        badgeText: '⚠️ 412ms Full Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE status = 'pending' AND category = 'Electronics' LIMIT 50;`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1520.00 rows=50000 width=128)
      Filter: ((status = 'pending'::text) AND (category = 'Electronics'::text))
      Rows Removed by Filter: 49955
      Buffers: shared read=1520`
      };
    }

    if (idxName.includes('line_items_tx')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Hash Join (Indexed FK Seek)',
          isOptimized: true,
          cost: 'cost=8.45..42.10 rows=350 width=88',
          execTime: '1.8 ms',
          scanMethod: 'O(1) Batched Foreign Key Seek',
          cacheHit: 'N+1 Storm Eliminated',
          badgeText: '⚡ 1.8ms (233x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);`,
          planTree: `->  Hash Join  (cost=8.45..42.10 rows=350 width=88)
      Hash Cond: (li.transaction_id = t.id)
      ->  Index Scan using idx_line_items_tx on line_items li  (cost=0.42..32.10)
            Index Cond: (transaction_id = ANY('{...}'::uuid[]))`
        };
      }
      return {
        nodeType: 'Nested Loop (Seq Scan per Row)',
        isOptimized: false,
        cost: 'cost=0.00..4120.00 rows=350 width=88',
        execTime: '420.0 ms',
        scanMethod: 'N+1 Query Storm (100+ roundtrips)',
        cacheHit: '100+ Table Scans',
        badgeText: '⚠️ 420ms N+1 Cascade',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);`,
        planTree: `->  Nested Loop  (cost=0.00..4120.00 rows=350 width=88)
      ->  Seq Scan on transactions t
      ->  Seq Scan on line_items li
            Filter: (transaction_id = t.id)  -- Executed 100+ times!`
      };
    }

    if (idxName.includes('email_status')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan (Compound B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..8.45 rows=12 width=142',
          execTime: '1.6 ms',
          scanMethod: 'O(log n) Dual Equality Leaf Seek',
          cacheHit: 'Zero Heap Cache Churn',
          badgeText: '⚡ 1.6ms (246x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com' AND status = 'completed';`,
          planTree: `->  Index Scan using idx_transactions_email_status on transactions  (cost=0.42..8.45 rows=12)
      Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))
      Buffers: shared hit=3`
        };
      }
      return {
        nodeType: 'Seq Scan (Missing Composite)',
        isOptimized: false,
        cost: 'cost=0.00..1845.00 rows=12 width=142',
        execTime: '395.0 ms',
        scanMethod: 'O(n) Table Scan Fallback',
        cacheHit: 'Full 50k Table Traversal',
        badgeText: '⚠️ 395ms Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com' AND status = 'completed';`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1845.00 rows=50000 width=142)
      Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))
      Rows Removed by Filter: 49988`
      };
    }

    if (idxName.includes('category_amount')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'GroupAggregate + Index Scan',
          isOptimized: true,
          cost: 'cost=0.42..15.60 rows=1 width=48',
          execTime: '1.9 ms',
          scanMethod: 'O(log n) Leaf Range Seek',
          cacheHit: 'In-Index Aggregation',
          badgeText: '⚡ 1.9ms (253x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = 'Books' AND amount > 50 GROUP BY category;`,
          planTree: `->  GroupAggregate  (cost=0.42..15.60 rows=1 width=48)
      Group Key: category
      ->  Index Scan using idx_transactions_category_amount on transactions
            Index Cond: ((category = 'Books'::text) AND (amount > 50.00))`
        };
      }
      return {
        nodeType: 'HashAggregate + Seq Scan',
        isOptimized: false,
        cost: 'cost=1520.00..1890.00 rows=1 width=48',
        execTime: '482.0 ms',
        scanMethod: 'Hash Spill to Disk Buffer',
        cacheHit: '38.4% CPU Share',
        badgeText: '⚠️ 482ms Hash Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = 'Books' AND amount > 50 GROUP BY category;`,
        planTree: `->  HashAggregate  (cost=1520.00..1890.00 rows=1 width=48)
      Group Key: category
      ->  Seq Scan on transactions
            Filter: ((category = 'Books'::text) AND (amount > 50.00))`
      };
    }

    if (idxName.includes('line_items_tx_price')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Only Scan (Covering Composite)',
          isOptimized: true,
          cost: 'cost=0.42..14.30 rows=40 width=88',
          execTime: '1.5 ms',
          scanMethod: 'O(log n) Covering Composite Seek',
          cacheHit: '0 Table Heap Fetches',
          badgeText: '⚡ 1.5ms (185x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = '018f3a9e-uuid' AND li.unit_price >= 50.00;`,
          planTree: `->  Index Only Scan using idx_line_items_tx_price on line_items li  (cost=0.42..14.30 rows=40)
      Index Cond: ((transaction_id = '018f3a9e-uuid'::uuid) AND (unit_price >= 50.00))
      Heap Fetches: 0`
        };
      }
      return {
        nodeType: 'Nested Loop + Seq Scan (Uncovered)',
        isOptimized: false,
        cost: 'cost=0.00..2800.00 rows=40 width=88',
        execTime: '280.0 ms',
        scanMethod: 'Sequential Heap Page Traversal',
        cacheHit: '1,200 Heap Fetches',
        badgeText: '⚠️ 280ms Unindexed Join Filter',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = '018f3a9e-uuid' AND li.unit_price >= 50.00;`,
        planTree: `->  Seq Scan on line_items li  (cost=0.00..2800.00 rows=200000 width=88)
      Filter: ((transaction_id = '018f3a9e-uuid'::uuid) AND (unit_price >= 50.00))`
      };
    }

    if (idxName.includes('customers_tier_created')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan Backward (Pre-Sorted)',
          isOptimized: true,
          cost: 'cost=0.42..12.50 rows=50 width=128',
          execTime: '1.2 ms',
          scanMethod: 'Early Exit Zero-Sort Seek',
          cacheHit: '100% In-Order Leaf Traversal',
          badgeText: '⚡ 1.2ms (140x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT id, name, email, tier FROM customers WHERE tier = 'enterprise' ORDER BY created_at DESC LIMIT 50;`,
          planTree: `->  Limit  (cost=0.42..12.50 rows=50 width=128)
      ->  Index Scan Backward using idx_customers_tier_created on customers
            Index Cond: (tier = 'enterprise'::text)
      Buffers: shared hit=4`
        };
      }
      return {
        nodeType: 'Sort Buffer Spill + Seq Scan',
        isOptimized: false,
        cost: 'cost=160.00..165.00 rows=50 width=128',
        execTime: '165.0 ms',
        scanMethod: 'In-Memory Sort Buffer Spill',
        cacheHit: 'Filesort on Disk WorkMem',
        badgeText: '⚠️ 165ms Sort Buffer Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT id, name, email, tier FROM customers WHERE tier = 'enterprise' ORDER BY created_at DESC LIMIT 50;`,
        planTree: `->  Limit  (cost=160.00..165.00 rows=50 width=128)
      ->  Sort  (cost=155.00..160.00)  Sort Key: created_at DESC
            Sort Method: external merge  Disk: 420kB
            ->  Seq Scan on customers  Filter: (tier = 'enterprise'::text)`
      };
    }

    if (idxName.includes('email_missing') || idxName.includes('customer_email')) {
      if (active && !isRemoved) {
        return {
          nodeType: redundant ? 'Index Scan (Shadowed)' : 'Index Scan (Single Column)',
          isOptimized: !redundant,
          cost: 'cost=0.42..14.20 rows=12 width=142',
          execTime: redundant ? '2.4 ms (Redundant)' : '1.8 ms',
          scanMethod: 'O(log n) Single-Column Seek',
          cacheHit: redundant ? 'Covered by composite' : '99.2% Hit Rate',
          badgeText: redundant ? '⚠️ Redundant Coverage' : '⚡ 1.8ms Index Seek',
          badgeClass: redundant ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com';`,
          planTree: `->  Index Scan using idx_transactions_email on transactions  (cost=0.42..14.20 rows=12)
      Index Cond: (customer_email = 'alice@example.com'::text)`
        };
      }
      return {
        nodeType: 'Seq Scan (Missing Index)',
        isOptimized: false,
        cost: 'cost=0.00..1845.00 rows=12 width=142',
        execTime: '395.0 ms',
        scanMethod: 'O(n) Table Scan',
        cacheHit: 'Heap Scan on 50k rows',
        badgeText: '⚠️ 395ms Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com';`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1845.00 rows=50000 width=142)
      Filter: (customer_email = 'alice@example.com'::text)`
      };
    }

    if (idxName.includes('amount_missing') || idxName.includes('amount')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan Backward (Ordered B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..42.10 rows=20 width=142',
          execTime: '0.8 ms',
          scanMethod: 'O(log n) Boundary Leaf Scan',
          cacheHit: 'Eliminates Disk Sort',
          badgeText: '⚡ 0.8ms Range Seek',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC LIMIT 20;`,
          planTree: `->  Limit  (cost=0.42..42.10 rows=20)
      ->  Index Scan Backward using idx_transactions_amount on transactions
            Index Cond: (amount > 500.00)`
        };
      }
      return {
        nodeType: 'Top-N Sort + Seq Scan',
        isOptimized: false,
        cost: 'cost=1845.00..2150.00 rows=20 width=142',
        execTime: '142.0 ms',
        scanMethod: 'In-Memory Sort Spill',
        cacheHit: '50k rows sorted',
        badgeText: '⚠️ 142ms Sort Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC LIMIT 20;`,
        planTree: `->  Top-N Sort  (cost=1845.00..2150.00 rows=20)
      Sort Key: amount DESC
      ->  Seq Scan on transactions  Filter: (amount > 500.00)`
      };
    }

    if (idxName.includes('customers_email')) {
      return {
        nodeType: 'Index Scan (Unique B-Tree)',
        isOptimized: true,
        cost: 'cost=0.29..8.31 rows=1 width=96',
        execTime: '0.05 ms',
        scanMethod: 'O(log n) Unique Key Seek',
        cacheHit: '100% Cache Hit',
        badgeText: '⚡ 0.05ms Unique Seek',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        querySql: `SELECT * FROM customers WHERE email = 'user@example.com';`,
        planTree: `->  Index Scan using idx_customers_email on customers  (cost=0.29..8.31 rows=1 width=96)
      Index Cond: (email = 'user@example.com'::text)`
      };
    }

    // Default fallback plan
    return {
      nodeType: active ? 'Index Scan' : 'Seq Scan',
      isOptimized: active,
      cost: active ? 'cost=0.42..18.40 rows=10' : 'cost=0.00..1845.00 rows=10',
      execTime: active ? '1.4 ms' : '150.0 ms',
      scanMethod: active ? 'O(log n) Seek' : 'O(n) Scan',
      cacheHit: active ? '100% Cache' : 'Disk Read',
      badgeText: active ? '⚡ 1.4ms Seek' : '⚠️ 150ms Scan',
      badgeClass: active ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-rose-900/60 text-rose-300 border-rose-700',
      querySql: `SELECT * FROM ${tableName} LIMIT 20;`,
      planTree: active
        ? `->  Index Scan using ${idxName} on ${tableName}  (cost=0.42..18.40 rows=10)`
        : `->  Seq Scan on ${tableName}  (cost=0.00..1845.00 rows=50000)`
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
      const indexDependencies = [
        {
          indexName: 'idx_transactions_email_status',
          targetTable: 'transactions',
          type: 'Composite B-Tree',
          riskLevel: 'Critical Risk',
          riskBadge: 'bg-rose-100 text-rose-800 border-rose-300',
          removalConsequence: 'Dropping this index forces full sequential table scans (O(n)), increasing user lookup latency from 1.2ms to 840ms and causing API gateway timeouts under peak traffic.',
          dependentQueries: [
            { name: 'Q1: Customer Email & Status Filtering', impact: 'O(log n) Index Scan → O(n) Full Heap Scan' },
            { name: 'Q4: Active Account Support Lookup', impact: 'Index Seek → Sequential Scan Timeout' }
          ],
          dependentReports: [
            { name: 'Customer Success Daily Audit Report', impact: 'Report generation time increases by 4,200%' },
            { name: 'Billing & Subscription Status Dashboard', impact: 'API connection pool lock contention' }
          ]
        },
        {
          indexName: 'idx_line_items_tx',
          targetTable: 'line_items',
          type: 'Foreign Key B-Tree',
          riskLevel: 'High Risk',
          riskBadge: 'bg-orange-100 text-orange-800 border-orange-300',
          removalConsequence: 'Removes foreign key join acceleration, re-introducing the synchronous N+1 subquery storm (100+ separate roundtrips per page) and risking connection pool exhaustion.',
          dependentQueries: [
            { name: 'Q6: Relational Line Items Join', impact: 'Batched Join → 100+ Unbatched N+1 Queries' },
            { name: 'Q8: Order Fulfillment Dispatch', impact: 'Thread lock contention on connection pool' }
          ],
          dependentReports: [
            { name: 'Daily E-Commerce Sales & Line Item Summary', impact: 'Database socket exhaustion and query timeout' },
            { name: 'Inventory & Stock Dispatch Audit', impact: 'Delayed fulfillment batch processing' }
          ]
        },
        {
          indexName: 'idx_transactions_category_amount',
          targetTable: 'transactions',
          type: 'Composite B-Tree',
          riskLevel: 'High Risk',
          riskBadge: 'bg-amber-100 text-amber-800 border-amber-300',
          removalConsequence: 'Disables sorted category and amount range index traversal, forcing SQLite/PostgreSQL to allocate RAM/disk temporary sort files and spilling sort memory.',
          dependentQueries: [
            { name: 'Q2: Category Revenue Filtering', impact: 'Index Scan Backward → Explicit Sort in RAM' },
            { name: 'Q5: High-Value Transaction Audit', impact: 'Bitmap Heap Scan + Costly Sort' }
          ],
          dependentReports: [
            { name: 'Executive Revenue Breakdown by Category', impact: 'Memory spill warnings and slow dashboard response' },
            { name: 'Fraud & High-Value Alert Monitor', impact: 'Delayed real-time anomaly detection' }
          ]
        },
        {
          indexName: 'idx_customers_tier_created',
          targetTable: 'customers',
          type: 'Composite B-Tree',
          riskLevel: 'Medium Risk',
          riskBadge: 'bg-blue-100 text-blue-800 border-blue-300',
          removalConsequence: 'Removes pre-sorted order delivery for customer tiers, requiring memory sort buffers to sort records descending by creation date.',
          dependentQueries: [
            { name: 'Q3: Enterprise Customer Signups', impact: 'Zero-Sort Delivery → Explicit Sort Buffer' },
            { name: 'Q7: VIP Cohort Retention Check', impact: 'Slower pagination and list rendering' }
          ],
          dependentReports: [
            { name: 'VIP Customer Growth & Retention Dashboard', impact: '140% increase in CPU time during report queries' },
            { name: 'Enterprise Account Activity Audit', impact: 'Slightly elevated query execution latency' }
          ]
        }
      ];

      return (
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white">
          <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                <Link className="w-4 h-4 text-indigo-700" />
                <span>Dependency Tree View: Index Impact &amp; Removal Risk Analysis</span>
              </h3>
              <button
                type="button"
                id="btn-auto-resolve-conflicts"
                data-testid="btn-auto-resolve-conflicts"
                onClick={() => {
                  setImportSuccessNotice('Successfully resolved conflicting table dependencies by intelligently merging overlapping composite indexes on `transactions`. Write lock contention reduced by 48%!');
                  setTimeout(() => setImportSuccessNotice(null), 5000);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                title="Intelligently suggests and merges index reordering when multiple critical reports share the same bottlenecked table"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Resolve Conflicts (Merge Shared Table Indexes)</span>
              </button>
            </div>
            <p className="text-xs text-indigo-900">
              Visualizes the nested hierarchy of dependent queries and enterprise reports tied to each database index. Highlights performance degradation and business risk if an index is pruned or removed.
            </p>
          </div>

          <div className="space-y-4">
            {indexDependencies.map((dep, idx) => {
              const isLocked = lockedIndexes.includes(dep.indexName);
              const isRemoved = removedIndexes.includes(dep.indexName);

              return (
                <div key={idx} className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
                      <span className="font-mono font-bold text-xs text-zinc-900">{dep.indexName}</span>
                      <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                        {dep.targetTable} • {dep.type}
                      </span>
                      {isLocked && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-700" />
                          LOCKED (Protected)
                        </span>
                      )}
                      {isRemoved && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold">
                          REMOVED
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${dep.riskBadge}`}>
                      Risk of Removal: {dep.riskLevel}
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Consequences of Removal / Pruning:</span>
                    </div>
                    <p className="text-rose-900 text-[11px] leading-relaxed">
                      {dep.removalConsequence}
                    </p>
                  </div>

                  {/* Nested Dependent Queries & Reports Tree */}
                  <div className="pl-4 border-l-2 border-indigo-200 space-y-3 pt-1">
                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-indigo-600" />
                        <span>Directly Dependent Queries ({dep.dependentQueries.length})</span>
                      </h5>
                      <div className="space-y-1.5">
                        {dep.dependentQueries.map((q, qi) => {
                          const edgeKey = `${dep.indexName}-query-${qi}`;
                          const isDisabled = !!disabledImpactEdges[edgeKey];
                          return (
                            <div key={qi} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-all ${isDisabled ? 'bg-zinc-200/50 border-zinc-300 opacity-60' : 'bg-zinc-50 border-zinc-200/80'}`}>
                              <span className={`font-bold ${isDisabled ? 'line-through text-zinc-500' : 'text-zinc-800'}`}>└─ {q.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded border ${isDisabled ? 'text-zinc-500 bg-zinc-200 border-zinc-300' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                                  {isDisabled ? 'Edge Bypassed (0ms impact)' : q.impact}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer" title="Toggle index relation edge">
                                  <input
                                    type="checkbox"
                                    id={`toggle-edge-${dep.indexName}-q-${qi}`}
                                    data-testid={`toggle-edge-${dep.indexName}-q-${qi}`}
                                    checked={!isDisabled}
                                    onChange={() => {
                                      setDisabledImpactEdges((prev) => ({ ...prev, [edgeKey]: !isDisabled }));
                                      setImportSuccessNotice(isDisabled ? `Enabled edge relation for query "${q.name}".` : `Disabled edge relation for query "${q.name}". Impact recalculated.`);
                                      setTimeout(() => setImportSuccessNotice(null), 4000);
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-purple-600" />
                        <span>Dependent Enterprise Reports ({dep.dependentReports.length})</span>
                      </h5>
                      <div className="space-y-1.5">
                        {dep.dependentReports.map((r, ri) => {
                          const edgeKey = `${dep.indexName}-report-${ri}`;
                          const isDisabled = !!disabledImpactEdges[edgeKey];
                          return (
                            <div key={ri} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${isDisabled ? 'bg-zinc-200/50 border-zinc-300 opacity-60' : 'bg-zinc-50 border-zinc-200/80'}`}>
                              <span className={`font-medium ${isDisabled ? 'line-through text-zinc-500' : 'text-zinc-800'}`}>└─ 📊 {r.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${isDisabled ? 'text-zinc-500 bg-zinc-200 border-zinc-300' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                                  {isDisabled ? 'Edge Bypassed (Lock Contention Cleared)' : r.impact}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer" title="Toggle index relation edge">
                                  <input
                                    type="checkbox"
                                    id={`toggle-edge-${dep.indexName}-r-${ri}`}
                                    data-testid={`toggle-edge-${dep.indexName}-r-${ri}`}
                                    checked={!isDisabled}
                                    onChange={() => {
                                      setDisabledImpactEdges((prev) => ({ ...prev, [edgeKey]: !isDisabled }));
                                      setImportSuccessNotice(isDisabled ? `Enabled report edge "${r.name}".` : `Disabled report edge "${r.name}". Impact recalculated.`);
                                      setTimeout(() => setImportSuccessNotice(null), 4000);
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className={`grid grid-cols-1 min-h-[500px] ${showAiSuggestionsSidePanel ? 'lg:grid-cols-12' : 'lg:grid-cols-4'}`}>
        {/* Left Sidebar: Table List */}
        <div className={`p-4 bg-zinc-50/80 border-r border-zinc-200 space-y-2 ${showAiSuggestionsSidePanel ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
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
                    <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                      <span>{tbl.name}</span>
                      {headerSearchMetrics.isFiltering && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                          (headerSearchMetrics.tableMatches[tbl.name] || 0) > 0
                            ? isSelected
                              ? 'bg-indigo-900 text-indigo-100'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-zinc-200 text-zinc-500'
                        }`}>
                          {headerSearchMetrics.tableMatches[tbl.name] || 0} match
                        </span>
                      )}
                    </div>
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
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                id="btn-sidebar-open-ai-side-panel"
                data-testid="btn-sidebar-open-ai-side-panel"
                onClick={() => setShowAiSuggestionsSidePanel(true)}
                className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-all shadow-2xs flex items-center justify-center gap-1"
                title="Display AI-Driven Index Suggestion side panel in Explorer view"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>AI Suggestions Side Panel</span>
                <span className="font-mono text-[9px] bg-white/20 px-1 rounded ml-0.5">
                  {showAiSuggestionsSidePanel ? 'Active' : 'Open'}
                </span>
              </button>
              <button
                type="button"
                id="btn-sidebar-open-suggestions-why"
                data-testid="btn-sidebar-open-suggestions-why"
                onClick={() => setShowSuggestIndexesModal(true)}
                className="w-full py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1"
              >
                <span>Full Diagnostics Modal</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
              <button
                type="button"
                id="btn-sidebar-bulk-import-indices"
                data-testid="btn-sidebar-bulk-import-indices"
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportActiveTab('upload');
                }}
                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-semibold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                title="Accept a JSON file of index configurations to quickly prototype different database schema states"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bulk Import Indices (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Main Area: Table Schema & Index Audit */}
        <div className={`p-6 space-y-6 overflow-y-auto ${
          showAiSuggestionsSidePanel ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-3'
        }`}>
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

                {/* Show Query Impact Toggle Button */}
                <button
                  type="button"
                  id="btn-toggle-query-impact-quick"
                  data-testid="btn-toggle-query-impact-quick"
                  onClick={() => setShowQueryImpact(!showQueryImpact)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showQueryImpact
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle dynamic mini-execution plan previews directly under each index listing"
                >
                  <Activity className={`w-3.5 h-3.5 ${showQueryImpact ? 'text-white' : 'text-indigo-600'}`} />
                  <span>Show Query Impact</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showQueryImpact ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {showQueryImpact ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Quick Bulk Optimize Button */}
                <button
                  type="button"
                  id="btn-quick-bulk-optimize"
                  data-testid="btn-quick-bulk-optimize"
                  onClick={handleApplyBulkOptimize}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                    bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-xs'
                  }`}
                  title="Calculate optimal changes for all listed indexes and apply all improvements at once"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkOptimizationPlan.isFullyOptimized
                      ? '✓ All Optimal'
                      : `Bulk Optimize (${bulkOptimizationPlan.pendingChanges.length})`}
                  </span>
                </button>

                {/* AI Suggestions Side Panel Quick Toggle Button */}
                <button
                  type="button"
                  id="btn-toggle-ai-sidepanel-quick"
                  data-testid="btn-toggle-ai-sidepanel-quick"
                  onClick={() => setShowAiSuggestionsSidePanel(!showAiSuggestionsSidePanel)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showAiSuggestionsSidePanel
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle AI-Driven Index Suggestion side panel in Explorer view"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel ? 'text-amber-300' : 'text-purple-600'}`} />
                  <span>AI Suggestions</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showAiSuggestionsSidePanel ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                    {showAiSuggestionsSidePanel ? 'OPEN' : '4'}
                  </span>
                </button>

                {/* Bulk Import Indices Quick Button */}
                <button
                  type="button"
                  id="btn-quick-bulk-import-indices"
                  data-testid="btn-quick-bulk-import-indices"
                  onClick={() => {
                    setShowBulkImportModal(true);
                    setBulkImportActiveTab('upload');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700"
                  title="Bulk import indices from a JSON configuration file to prototype database schema states"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Bulk Import Indices</span>
                </button>
              </div>
            </div>

            {/* Bulk Import Indices Success Notification Banner */}
            {importSuccessNotice && (
              <div
                id="bulk-import-success-notification"
                data-testid="bulk-import-success-notification"
                className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-white border border-purple-300 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-950 animate-fadeIn shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-purple-950">Index Configuration Prototyped Successfully!</strong>
                    <p className="text-[11px] text-purple-900 mt-0.5">{importSuccessNotice}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportSuccessNotice(null)}
                  className="text-purple-700 hover:text-purple-950 p-1 rounded cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bulk Optimize Success Notification Banner */}
            {bulkOptimizeSuccessNotice && (
              <div
                id="bulk-optimize-success-notification"
                data-testid="bulk-optimize-success-notification"
                className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950 animate-fadeIn shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-bold text-emerald-900">Bulk Optimization Applied Successfully!</strong>
                    <p className="text-[11px] text-emerald-800 mt-0.5">{bulkOptimizeSuccessNotice}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkOptimizeSuccessNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bulk Schema Optimizer Feature Banner & Single Action Button */}
            <div
              id="bulk-optimize-container"
              data-testid="bulk-optimize-container"
              className="p-4 bg-gradient-to-r from-emerald-50/95 via-teal-50/70 to-indigo-50/85 border border-emerald-200 rounded-2xl shadow-xs space-y-3.5"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-indigo-700 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
                    <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5 font-sans">
                        <span>Bulk Schema Optimizer</span>
                      </h4>
                      {bulkOptimizationPlan.isFullyOptimized ? (
                        <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>All {bulkOptimizationPlan.totalCount} Indexes In Optimal State</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shadow-2xs animate-pulse">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>{bulkOptimizationPlan.pendingChanges.length} Recommended Changes Calculated</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                      Evaluates all listed indexes across tables to calculate the mathematically optimal set of changes (activating missing foreign/composite keys and pruning dead indexes).
                    </p>
                  </div>
                </div>

                {/* The Single Button to Apply All Recommended Improvements At Once */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    id="btn-view-bulk-optimizer-calculation"
                    data-testid="btn-view-bulk-optimizer-calculation"
                    onClick={() => setShowBulkOptimizeModal(true)}
                    className="px-3 py-2 bg-white hover:bg-zinc-50 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs flex items-center gap-1.5"
                    title="Inspect calculated optimal changes breakdown for all listed indexes"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    <span>View Calculations ({bulkOptimizationPlan.pendingChanges.length} Pending)</span>
                  </button>

                  <button
                    type="button"
                    id="btn-apply-bulk-optimize"
                    data-testid="btn-apply-bulk-optimize"
                    onClick={handleApplyBulkOptimize}
                    disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-2 ${
                      bulkOptimizationPlan.isFullyOptimized
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white hover:shadow-md'
                    }`}
                    title="Apply all calculated optimal changes across all listed indexes in a single atomic batch"
                  >
                    {isApplyingBulkOptimize ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Applying Optimal Schema Changes...</span>
                      </>
                    ) : bulkOptimizationPlan.isFullyOptimized ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Schema Fully Optimized (Avg {bulkOptimizationPlan.currentAvgHealth}/100)</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        <span>Apply All Recommended Improvements ({bulkOptimizationPlan.pendingChanges.length} Changes)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Calculated Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-200/70 text-xs">
                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Schema Health Score</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-zinc-900 text-sm">{bulkOptimizationPlan.currentAvgHealth}/100</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {bulkOptimizationPlan.isFullyOptimized ? 'Optimal' : `${bulkOptimizationPlan.projectedAvgHealth}/100`}
                    </span>
                    {!bulkOptimizationPlan.isFullyOptimized && (
                      <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                        +{bulkOptimizationPlan.healthGain} pts
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Optimal vs Total</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono font-bold text-sm">
                    <span className={bulkOptimizationPlan.isFullyOptimized ? 'text-emerald-700' : 'text-amber-700'}>
                      {bulkOptimizationPlan.optimalCount} / {bulkOptimizationPlan.totalCount} Indexes
                    </span>
                    <span className="text-[10px] text-zinc-500 font-sans font-normal">
                      ({Math.round((bulkOptimizationPlan.optimalCount / bulkOptimizationPlan.totalCount) * 100)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Query Latency Gain</span>
                  <div className="flex items-center gap-1 mt-1 font-mono font-bold text-emerald-700 text-sm">
                    <span>Up to 99.6% Speedup</span>
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Write I/O Overhead</span>
                  <div className="flex items-center gap-1 mt-1 font-mono font-bold text-indigo-700 text-sm">
                    <span>+14% Latency Saved</span>
                  </div>
                </div>
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
                              const isLocked = lockedIndexes.includes(idx.name);

                              return (
                                <div
                                  key={`idx-${tbl.name}-${i}`}
                                  onMouseEnter={() => setHoveredIndexWhatIf(idx.name)}
                                  onMouseLeave={() => setHoveredIndexWhatIf(null)}
                                  className={`relative p-3.5 rounded-xl border flex flex-col justify-between transition-all bg-white ${
                                    isLocked
                                      ? 'border-amber-300 ring-1 ring-amber-200/80 shadow-xs'
                                      : idx.active
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
                                         <div
                                           id={`usage-heatmap-${idx.name}`}
                                           data-testid={`usage-heatmap-${idx.name}`}
                                           className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200/70 px-2 py-0.5 rounded-md border border-zinc-200 text-[10px] font-mono text-zinc-700 shadow-2xs"
                                           title="24-Hour Query Usage Heatmap: Visualizes query utilization intensity over 6 x 4-hour blocks across the last 24 hours"
                                         >
                                           <Activity className="w-3 h-3 text-indigo-600 shrink-0" />
                                           <span className="text-[9px] font-semibold text-zinc-600">24h Heatmap:</span>
                                           <div className="flex items-center gap-0.5">
                                             {[80, 45, 90, 65, 30, 95].map((val, hi) => {
                                               const intensity = (idx.name.length * (hi + 3) * 17) % 100;
                                               const bgClass =
                                                 intensity > 75
                                                   ? 'bg-emerald-600'
                                                   : intensity > 40
                                                   ? 'bg-teal-500'
                                                   : intensity > 20
                                                   ? 'bg-amber-400'
                                                   : 'bg-zinc-300';
                                               return (
                                                 <div
                                                   key={hi}
                                                   className={`w-1.5 h-3 rounded-xs ${bgClass}`}
                                                   title={`Block -${(6 - hi) * 4}h: ${intensity}% utilization`}
                                                 />
                                               );
                                             })}
                                           </div>
                                         </div>
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
                                            {isLocked ? (
                                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[10px] shrink-0">
                                                Protected (Locked)
                                              </span>
                                            ) : (
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
                                            )}
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
                                          {isLocked ? (
                                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[10px]">
                                              Protected (Locked)
                                            </span>
                                          ) : (
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
                                          )}
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
                                        {isLocked && (
                                          <span
                                            id={`locked-badge-${idx.name}`}
                                            data-testid={`locked-badge-${idx.name}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                                            title="High-priority manual lock enabled. Protected from automated optimization and index cleanup."
                                          >
                                            <Lock className="w-3 h-3 text-amber-700" />
                                            LOCKED
                                          </span>
                                        )}
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

                                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 pb-2">
                                      <div className="text-[11px] text-zinc-500 font-mono">
                                        Type: {idx.type} • Columns: ({idx.columns.join(', ')})
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          id={`btn-simulate-fail-${idx.name}`}
                                          data-testid={`btn-simulate-fail-${idx.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSimulateFailure(idx.name);
                                          }}
                                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                                            simulatedFailedIndexes.includes(idx.name)
                                              ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                              : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                                          }`}
                                          title="Temporarily disable this index's effect on queries to observe the immediate performance impact on execution plans in real-time."
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>{simulatedFailedIndexes.includes(idx.name) ? 'Simulating Failure (Offline)' : 'Simulate Index Failure'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          id={`btn-rebuild-${idx.name}`}
                                          data-testid={`btn-rebuild-${idx.name}`}
                                          disabled={rebuildingIndexes.includes(idx.name)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRebuildIndex(idx.name);
                                          }}
                                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                                          title="Trigger an immediate index maintenance rebuild operation (VACUUM & REINDEX)"
                                        >
                                          {rebuildingIndexes.includes(idx.name) ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              <span>Rebuilding...</span>
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="w-3 h-3" />
                                              <span>Rebuild Index</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {simulatedFailedIndexes.includes(idx.name) && (
                                    <div
                                      id={`simulate-fail-banner-${idx.name}`}
                                      data-testid={`simulate-fail-banner-${idx.name}`}
                                      className="my-2 p-2.5 bg-rose-100 border border-rose-400 rounded-lg flex items-center justify-between text-[11px] text-rose-950 shadow-xs animate-fadeIn"
                                    >
                                      <div className="flex items-center gap-2 font-semibold">
                                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 animate-bounce" />
                                        <div>
                                          <div>⚠️ [Simulated Failure Active] Index Offline</div>
                                          <div className="text-[10px] text-rose-800 font-normal">Execution plans falling back to full table sequential scan (Latency spiked from 1.2ms to 680ms; cost +900%).</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

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

                                  {/* Proactive Re-Index Action Banner if Low Health or Fragmentation > 30% */}
                                  {(() => {
                                    const isReindexed = reindexedIndexes.includes(idx.name);
                                    const fragmentation = isReindexed ? 3 : (idx.name.includes('missing') || idx.name.includes('date') || !idx.active) ? 38 : 12;
                                    const effectiveHealthScore = isReindexed ? Math.max(health.score, 95) : health.score;

                                    return (effectiveHealthScore < 70 || fragmentation > 30) && !isRemoved ? (
                                      <div
                                        id={`reindex-banner-${idx.name}`}
                                        data-testid={`reindex-banner-${idx.name}`}
                                        className="my-2 p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-[11px] text-rose-950 shadow-2xs"
                                      >
                                        <div className="flex items-center gap-2 font-semibold">
                                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                                          <div>
                                            <div>Index Fragmentation Alert: {fragmentation}% B-Tree Bloat Detected</div>
                                            <div className="text-[10px] text-rose-700 font-normal">Health score is {effectiveHealthScore}/100. Run REINDEX CONCURRENTLY to rebuild tree balance and eliminate sequential page reads.</div>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          id={`btn-reindex-${idx.name}`}
                                          data-testid={`btn-reindex-${idx.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReindexIndex(idx.name);
                                          }}
                                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors shrink-0"
                                        >
                                          ⚡ Run REINDEX CONCURRENTLY
                                        </button>
                                      </div>
                                    ) : null;
                                  })()}

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

                                  {/* Dynamic Mini-Execution Plan Preview under each index listing */}
                                  {showQueryImpact && (() => {
                                    const plan = getMiniExecutionPlanPreview(idx.name, idx.active, tbl.name);
                                    return (
                                      <div
                                        id={`mini-plan-${idx.name}`}
                                        data-testid={`mini-plan-${idx.name}`}
                                        className="my-2 p-3 bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 shadow-inner font-mono text-[11px] space-y-2 animate-fadeIn"
                                      >
                                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-1 font-sans">
                                          <div className="flex items-center gap-1.5 text-zinc-300">
                                            <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-300">
                                              Mini-Execution Plan (EXPLAIN)
                                            </span>
                                          </div>
                                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-2xs ${plan.badgeClass}`}>
                                            {plan.badgeText}
                                          </span>
                                        </div>

                                        {/* Visual Execution Tree */}
                                        <div className="space-y-1">
                                          <pre className="text-emerald-300/90 text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-black/60 p-2.5 rounded-lg border border-zinc-800/80">
                                            {plan.planTree}
                                          </pre>
                                        </div>

                                        {/* Planner Cost & Latency Metrics */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9.5px] font-mono text-zinc-400 pt-0.5">
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Planner Cost:</span>
                                            <span className="text-zinc-200 font-bold truncate ml-1">{plan.cost.split(' ')[0].replace('cost=', '')}</span>
                                          </div>
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Exec Latency:</span>
                                            <span className={plan.isOptimized ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                              {plan.execTime}
                                            </span>
                                          </div>
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Scan Method:</span>
                                            <span className="text-indigo-300 font-bold truncate ml-1">{plan.scanMethod}</span>
                                          </div>
                                        </div>

                                        {/* Target Query Preview */}
                                        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80 truncate">
                                          <span className="text-zinc-500 font-sans">Target Query: </span>
                                          <code className="text-zinc-300 text-[10px] font-mono">{plan.querySql}</code>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-zinc-200/60 text-[11px] gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={idx.active ? 'font-medium text-emerald-700' : 'text-zinc-500'}>
                                        {idx.active ? '⚡ Optimizes WHERE & JOIN lookups to O(log n)' : '⚠️ Inactive or missing index'}
                                      </span>
                                      {isLocked && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                          <Lock className="w-3 h-3 text-amber-700" />
                                          Manual High-Priority
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        id={`btn-lock-index-${idx.name}`}
                                        data-testid={`btn-lock-index-${idx.name}`}
                                        aria-label={isLocked ? `Unlock index ${idx.name}` : `Lock index ${idx.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleLockIndex(idx.name);
                                        }}
                                        className={`px-2.5 py-1 rounded-md font-bold text-[10px] transition-all cursor-pointer shadow-xs flex items-center gap-1.5 border ${
                                          isLocked
                                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 ring-1 ring-amber-300'
                                            : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400'
                                        }`}
                                        title={
                                          isLocked
                                            ? `Index is locked (High-Priority Manual). Protected from Auto-Optimize and Index Cleanup. Click to unlock.`
                                            : `Lock Index: Prevent Auto-Optimize and Index Cleanup operations from ever modifying or removing this high-priority index.`
                                        }
                                      >
                                        {isLocked ? (
                                          <>
                                            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                            <span>Locked Index</span>
                                          </>
                                        ) : (
                                          <>
                                            <Unlock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                            <span>Lock Index</span>
                                          </>
                                        )}
                                      </button>
                                      {idx.active && !idx.name.includes('PRIMARY KEY') && (
                                        <button
                                          type="button"
                                          disabled={isLocked}
                                          onClick={() => {
                                            if (isLocked) {
                                              setImportSuccessNotice(`Cannot undo optimization: Index "${idx.name}" is locked as high-priority manual.`);
                                              setTimeout(() => setImportSuccessNotice(null), 4000);
                                              return;
                                            }
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
                                          className={`px-2 py-0.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded font-semibold text-[10px] transition-colors shadow-2xs ${
                                            isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                          }`}
                                          title={isLocked ? 'Index is locked: Protected from automated modifications' : 'Revert / Undo optimization on this index'}
                                        >
                                          Undo Optimization
                                        </button>
                                      )}
                                    </div>
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

        {/* 'AI-Driven Index Suggestion' Side Panel */}
        {showAiSuggestionsSidePanel ? (
          <div
            id="ai-driven-index-suggestion-side-panel"
            data-testid="ai-driven-index-suggestion-side-panel"
            className="lg:col-span-4 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-zinc-200 bg-gradient-to-b from-indigo-50/40 via-white to-zinc-50/50 p-4 sm:p-5 space-y-4 overflow-y-auto flex flex-col max-h-[750px] lg:max-h-none"
          >
            {/* Side Panel Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-200">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                      AI-Driven Index Suggestions
                    </h3>
                    <span className="font-mono text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                      Query History AI
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                    Analyzed 14,200 user query patterns in history to uncover high-impact composite index opportunities.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-ai-side-panel"
                data-testid="btn-close-ai-side-panel"
                onClick={() => setShowAiSuggestionsSidePanel(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors shrink-0"
                title="Collapse AI-Driven Index Suggestion side panel"
                aria-label="Collapse side panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Query History Analytics Strip */}
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Historical Query Pattern Scope</span>
                </span>
                <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  14,200 Query Traces
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Opportunities</div>
                  <div className="font-mono font-bold text-xs text-purple-700 mt-0.5">
                    {compositeIndexOpportunities.length} Composite
                  </div>
                </div>
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Applied State</div>
                  <div className="font-mono font-bold text-xs text-emerald-700 mt-0.5">
                    {compositeIndexOpportunities.filter(o => o.isApplied).length} of {compositeIndexOpportunities.length} Active
                  </div>
                </div>
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Max Speedup</div>
                  <div className="font-mono font-bold text-xs text-indigo-700 mt-0.5">
                    253x Faster
                  </div>
                </div>
              </div>

              {/* Single Click Batch Action */}
              <button
                type="button"
                id="btn-apply-all-composite-opportunities"
                data-testid="btn-apply-all-composite-opportunities"
                onClick={() => {
                  setCreatedCompositeIndexes(['email_status', 'category_amount', 'tx_price', 'tier_created']);
                  setBulkOptimizeSuccessNotice('Successfully applied all 4 AI-recommended composite indexes across transactions, line_items, and customers!');
                  setTimeout(() => setBulkOptimizeSuccessNotice(null), 5000);
                }}
                disabled={compositeIndexOpportunities.every(o => o.isApplied)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                  compositeIndexOpportunities.every(o => o.isApplied)
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>
                  {compositeIndexOpportunities.every(o => o.isApplied)
                    ? '✓ All Composite Opportunities Active'
                    : `Apply All ${compositeIndexOpportunities.filter(o => !o.isApplied).length} Composite Opportunities`}
                </span>
              </button>
            </div>

            {/* Table Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
              </span>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('all')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                All ({compositeIndexOpportunities.length})
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('transactions')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'transactions'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                transactions (2)
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('line_items')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'line_items'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                line_items (1)
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('customers')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'customers'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                customers (1)
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center justify-between gap-2 pt-1 pb-1 border-t border-zinc-200/60 mt-2">
              <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">Rank Suggestions:</span>
              <select
                id="select-ai-suggestion-sort"
                data-testid="select-ai-suggestion-sort"
                value={aiSuggestionSortBy}
                onChange={(e) => setAiSuggestionSortBy(e.target.value as any)}
                className="text-xs bg-white border border-zinc-300 rounded-md py-1 px-2.5 text-zinc-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                aria-label="Sort AI Index Suggestions"
              >
                <option value="gain">Expected Performance Gain</option>
                <option value="risk">Risk Level</option>
                <option value="complexity">Complexity</option>
              </select>
            </div>

            {/* List of Composite Index Opportunities */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
              {compositeIndexOpportunities
                .filter(opp => compositePatternFilter === 'all' || opp.targetTable === compositePatternFilter)
                .sort((a, b) => {
                  if (aiSuggestionSortBy === 'gain') {
                    const speedA = parseInt(a.speedup?.replace(/\D/g, '') || '0', 10);
                    const speedB = parseInt(b.speedup?.replace(/\D/g, '') || '0', 10);
                    return speedB - speedA;
                  } else if (aiSuggestionSortBy === 'risk') {
                    const rank = (r?: string) => r?.includes('Critical') ? 3 : r?.includes('High') ? 2 : r?.includes('Medium') ? 1 : 0;
                    return rank(b.riskLevel) - rank(a.riskLevel);
                  } else {
                    return b.columns.length - a.columns.length;
                  }
                })
                .map((opp) => {
                  const isSelected = selectedCompositeSuggestionId === opp.id;
                  return (
                    <div
                      key={opp.id}
                      id={`composite-opportunity-${opp.id}`}
                      data-testid={`composite-opportunity-${opp.id}`}
                      className={`p-3.5 rounded-xl border transition-all text-xs space-y-3 bg-white ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-sm'
                          : 'border-zinc-200 hover:border-zinc-300 shadow-2xs'
                      }`}
                    >
                      {/* Opportunity Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs text-zinc-900">
                              {opp.name}
                            </span>
                            <span className="font-mono text-[9px] bg-zinc-100 text-zinc-700 px-1.5 py-0.2 rounded font-semibold border border-zinc-200">
                              {opp.targetTable}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {opp.queryPurpose}
                          </div>
                        </div>

                        {opp.isApplied ? (
                          <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0 border border-indigo-200">
                            +{opp.speedup} Speedup
                          </span>
                        )}
                      </div>

                      {/* Composite Column Ordering Structure */}
                      <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Composite Column Ordering Blueprint</span>
                          <span className="text-[9px] text-indigo-700 font-normal">Prefix Rule Enforced</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {opp.columnOrdering.map((col, idx) => (
                            <React.Fragment key={col.column}>
                              <div className="px-2 py-1 bg-white rounded border border-zinc-300 text-[10px] font-mono shadow-2xs">
                                <span className="text-zinc-400 font-sans mr-1">Col {idx + 1}:</span>
                                <strong className="text-indigo-950 font-bold">{col.column}</strong>
                              </div>
                              {idx < opp.columnOrdering.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Historical Query Pattern in History */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-zinc-700 flex items-center gap-1">
                            <Search className="w-3 h-3 text-indigo-600" />
                            <span>Query Pattern in History:</span>
                          </span>
                          <span className="font-mono text-zinc-500 font-medium">
                            {opp.frequencyPerHour} ({opp.executionShare})
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-950 text-indigo-200 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-zinc-800 shadow-inner">
                          {opp.querySql}
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-0.5 text-zinc-500">
                          <span>Latency delta: <strong className="text-rose-600 line-through">{opp.latencyBefore}</strong> ➔ <strong className="text-emerald-700 font-bold">{opp.latencyAfter}</strong></span>
                          <span className="font-mono text-emerald-700 font-extrabold">{opp.speedupMultiplier}</span>
                        </div>
                      </div>

                      {/* Rationale Section */}
                      <div className="p-2.5 bg-gradient-to-r from-indigo-50/70 to-purple-50/40 rounded-lg border border-indigo-200/80 space-y-1.5">
                        <div className="font-bold text-indigo-950 flex items-center gap-1 text-[11px]">
                          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Technical Rationale:</span>
                        </div>
                        <p className="text-[11px] text-zinc-700 leading-relaxed">
                          {opp.rationale.summary}
                        </p>
                        <div className="pt-1.5 border-t border-indigo-100 space-y-1 text-[10px]">
                          <div>
                            <strong className="text-indigo-900">Why this column order:</strong>
                            <span className="text-zinc-600 ml-1">{opp.rationale.columnOrderJustification}</span>
                          </div>
                          <div>
                            <strong className="text-indigo-900">Planner transformation:</strong>
                            <span className="text-zinc-600 ml-1">{opp.rationale.plannerMechanics}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setSelectedCompositeSuggestionId(opp.id)}
                          className={`text-[10px] font-semibold cursor-pointer underline hover:text-indigo-700 ${
                            isSelected ? 'text-indigo-700 font-bold' : 'text-zinc-500'
                          }`}
                        >
                          {isSelected ? 'Viewing SQL DDL & Plan ▼' : 'Inspect SQL DDL & Plan ►'}
                        </button>

                        <button
                          type="button"
                          id={`btn-toggle-composite-${opp.id}`}
                          data-testid={`btn-toggle-composite-${opp.id}`}
                          onClick={opp.onToggle}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                            opp.isApplied
                              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                          }`}
                        >
                          {opp.isApplied ? (
                            <>
                              <RefreshCw className="w-3 h-3 text-zinc-500" />
                              <span>Revert Optimization</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                              <span>Apply Composite Index</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Inspector when Selected */}
                      {isSelected && (
                        <div className="pt-2 border-t border-indigo-100 space-y-2 animate-fadeIn bg-indigo-50/30 p-2.5 rounded-lg border">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-zinc-800">PostgreSQL DDL Definition:</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(opp.ddlStatement);
                                setCopiedDdlIndex(opp.id);
                                setTimeout(() => setCopiedDdlIndex(null), 2500);
                              }}
                              className="text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer flex items-center gap-1"
                              title="Copy DDL command to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedDdlIndex === opp.id ? 'Copied!' : 'Copy DDL'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-zinc-900 text-emerald-300 rounded font-mono text-[10px] overflow-x-auto border border-zinc-800">
                            {opp.ddlStatement}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                            <div className="p-1.5 bg-white rounded border border-zinc-200">
                              <span className="text-zinc-500">Storage Footprint:</span>
                              <strong className="block text-zinc-800 font-mono mt-0.5">{opp.storageFootprint}</strong>
                            </div>
                            <div className="p-1.5 bg-white rounded border border-zinc-200">
                              <span className="text-zinc-500">Write Amplification:</span>
                              <strong className="block text-zinc-800 font-mono mt-0.5">{opp.writeImpact}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          /* Docked Tab when Side Panel is Collapsed */
          <div className="hidden lg:flex flex-col items-center justify-start border-l border-zinc-200 bg-zinc-50/80 p-2 shrink-0">
            <button
              type="button"
              id="btn-reopen-ai-side-panel"
              data-testid="btn-reopen-ai-side-panel"
              onClick={() => setShowAiSuggestionsSidePanel(true)}
              className="py-4 px-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl shadow-xs cursor-pointer flex flex-col items-center gap-2.5 transition-all hover:scale-105"
              title="Open AI-Driven Index Suggestion side panel"
            >
              <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
              <span className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                AI Suggestions Panel
              </span>
              <span className="font-mono text-[9px] bg-purple-100 text-purple-800 font-bold px-1 rounded-full">
                4
              </span>
            </button>
          </div>
        )}
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

          <label
            id="label-show-query-impact"
            data-testid="label-show-query-impact"
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer select-none transition-all shadow-2xs ${
              showQueryImpact
                ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 ring-1 ring-indigo-200'
                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
            title="Dynamically display a mini-execution plan preview directly under each index listing"
          >
            <Activity className={`w-3.5 h-3.5 ${showQueryImpact ? 'text-indigo-600' : 'text-zinc-500'}`} />
            <span>Show Query Impact</span>
            <input
              type="checkbox"
              id="toggle-show-query-impact"
              name="toggle-show-query-impact"
              data-testid="toggle-show-query-impact"
              checked={showQueryImpact}
              onChange={(e) => setShowQueryImpact(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
            {showQueryImpact && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[10px] font-bold">
                ON
              </span>
            )}
          </label>

          {/* 'Snapshot State' button and corresponding checkpoints dropdown to switch between multiple saved checkpoints instantly */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-1 shadow-2xs">
            <button
              type="button"
              id="btn-snapshot-state"
              data-testid="btn-snapshot-state"
              onClick={handleOpenSnapshotModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Create a named checkpoint of the current index configuration"
            >
              <History className="w-3.5 h-3.5 text-amber-300" />
              <span>Snapshot State</span>
            </button>

            <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-200">
              <label htmlFor="select-checkpoint-dropdown" className="text-[11px] text-zinc-500 font-semibold hidden md:inline select-none">
                Checkpoints:
              </label>
              <div className="relative">
                <select
                  id="select-checkpoint-dropdown"
                  data-testid="select-checkpoint-dropdown"
                  value={selectedCheckpointId}
                  onChange={(e) => handleSelectCheckpoint(e.target.value)}
                  className="text-xs bg-white border border-zinc-300 rounded-md py-1.5 pl-2.5 pr-8 text-zinc-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs appearance-none font-sans"
                  aria-label="Switch between saved checkpoints instantly"
                  title="Switch between saved checkpoints instantly"
                >
                  {snapshots.map((snap) => (
                    <option key={snap.id} value={snap.id}>
                      {snap.name} ({snap.totalIndexesCount ?? snap.customIndexes.length} idx • {snap.timestamp})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                id="btn-open-snapshots-manager"
                data-testid="btn-open-snapshots-manager"
                onClick={() => setShowSnapshotsModal(true)}
                className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-200/60 rounded-md cursor-pointer transition-colors"
                title="Manage all checkpoints & snapshots"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>

              <label
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer border shadow-2xs ${
                  enableAutoHealing
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-1 ring-emerald-300'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
                title="Enable Auto-Healing: Automatically executes REINDEX CONCURRENTLY when any index drops below 50% health."
              >
                <input
                  type="checkbox"
                  id="checkbox-enable-auto-healing"
                  data-testid="checkbox-enable-auto-healing"
                  checked={enableAutoHealing}
                  onChange={(e) => setEnableAutoHealing(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <HeartPulse className={`w-3.5 h-3.5 ${enableAutoHealing ? 'text-emerald-700 animate-pulse' : 'text-zinc-500'}`} />
                <span>Auto-Healing (&lt;50%)</span>
              </label>
            </div>
          </div>

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
            id="btn-toggle-ai-suggestions-sidepanel"
            data-testid="btn-toggle-ai-suggestions-sidepanel"
            onClick={() => setShowAiSuggestionsSidePanel(!showAiSuggestionsSidePanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              showAiSuggestionsSidePanel
                ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white border-purple-600 shadow-xs ring-1 ring-purple-300'
                : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title="Toggle AI-Driven Index Suggestion side panel in Explorer view"
          >
            <Sparkles className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel ? 'text-amber-300' : 'text-purple-600'}`} />
            <span>AI Index Suggestions Side Panel</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              showAiSuggestionsSidePanel ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
            }`}>
              {showAiSuggestionsSidePanel ? 'OPEN' : `${compositeIndexOpportunities.length} Opportunities`}
            </span>
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
            id="btn-bulk-optimize"
            data-testid="btn-bulk-optimize"
            onClick={handleApplyBulkOptimize}
            disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
              bulkOptimizationPlan.isFullyOptimized
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white'
            }`}
            title="Calculates optimal set of changes for all listed indexes and applies all recommended improvements at once"
          >
            {isApplyingBulkOptimize ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>Optimizing Schema...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Bulk Optimize</span>
                {bulkOptimizationPlan.isFullyOptimized ? (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-800 text-emerald-100 rounded-full text-[10px] font-bold">
                    Optimal (96/100)
                  </span>
                ) : (
                  <span className="ml-1 px-1.5 py-0.2 bg-black/25 text-white rounded-full text-[10px] font-mono font-bold">
                    {bulkOptimizationPlan.pendingChanges.length} Pending
                  </span>
                )}
              </>
            )}
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
            id="btn-cross-reference-report"
            data-testid="btn-cross-reference-report"
            onClick={() => setShowCrossReferenceReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Maps selected indexes against historical query performance data to identify zombie indexes that provide no measurable performance gain"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Cross-Reference Report</span>
          </button>

          <button
            type="button"
            id="btn-analyze-consolidation"
            data-testid="btn-analyze-consolidation"
            onClick={() => setShowClusterAnalysisModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Uses AI integration to analyze query execution patterns and suggest merging redundant or overlapping indexes into a single multi-column index"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyze for Consolidation</span>
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
            id="btn-toolbar-bulk-apply-all"
            data-testid="btn-toolbar-bulk-apply-all"
            onClick={handleApplyBulkOptimize}
            disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
              bulkOptimizationPlan.isFullyOptimized
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            }`}
            title="Calculate and enable all optimal index improvements across all listed tables at once"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>
              {bulkOptimizationPlan.isFullyOptimized
                ? '✓ All Optimal'
                : `Bulk Apply (${bulkOptimizationPlan.pendingChanges.length})`}
            </span>
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
            id="btn-bulk-import-indices"
            data-testid="btn-bulk-import-indices"
            onClick={() => {
              setShowBulkImportModal(true);
              setBulkImportActiveTab('upload');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Accept a JSON file of index configurations to quickly prototype different database schema states"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-300" />
            <span>Bulk Import Indices</span>
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

      {/* Bulk Import Indices Success Feedback Notification */}
      {importSuccessNotice && (
        <div
          id="bulk-import-schema-state-success-alert"
          data-testid="bulk-import-schema-state-success-alert"
          className="bg-purple-50 border-b border-purple-200 px-6 py-2.5 text-xs text-purple-950 flex items-center justify-between gap-3 animate-fadeIn shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-semibold">{importSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessNotice(null)}
            className="text-purple-700 hover:text-purple-950 text-[11px] font-bold cursor-pointer hover:underline"
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

      {/* Bulk Optimization Calculation Breakdown Modal */}
      {showBulkOptimizeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col text-zinc-900 relative">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-indigo-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                      Bulk Schema Optimizer — Calculation Breakdown
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                      {bulkOptimizationPlan.totalCount} Listed Indexes Analyzed
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                      Avg Health: {bulkOptimizationPlan.currentAvgHealth}/100 → {bulkOptimizationPlan.projectedAvgHealth}/100
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Calculated optimal set of changes for all listed database indexes to maximize query throughput while pruning redundant write overhead.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-zinc-300 shadow-2xs">
                  <input
                    type="checkbox"
                    id="checkbox-bulk-dry-run"
                    data-testid="checkbox-bulk-dry-run"
                    checked={bulkDryRunActive}
                    onChange={(e) => setBulkDryRunActive(e.target.checked)}
                    className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Dry Run (Preview Only)</span>
                </label>
                <button
                  type="button"
                  id="btn-modal-apply-bulk-optimize"
                  data-testid="btn-modal-apply-bulk-optimize"
                  onClick={() => {
                    if (bulkDryRunActive) {
                      const projected = bulkOptimizationPlan.pendingChanges.map((ch) => ({
                        name: ch.indexName,
                        impact: ch.description,
                        projectedHealth: 96
                      }));
                      setDryRunPreviewList(projected);
                      setShowBulkOptimizeModal(false);
                      setImportSuccessNotice('[Dry Run Mode] Schema left untouched. Projected performance improvements generated for preview.');
                      setTimeout(() => setImportSuccessNotice(null), 5000);
                    } else {
                      handleApplyBulkOptimize();
                      setShowBulkOptimizeModal(false);
                    }
                  }}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    bulkDryRunActive
                      ? 'bg-teal-700 hover:bg-teal-600 text-white'
                      : bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-sm'
                  }`}
                  title="Apply all recommended improvements or simulate a dry run preview"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkDryRunActive
                      ? `Run Dry Run Preview (${bulkOptimizationPlan.pendingChanges.length})`
                      : bulkOptimizationPlan.isFullyOptimized
                      ? '✓ All Optimal'
                      : `Apply All (${bulkOptimizationPlan.pendingChanges.length} Improvements)`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkOptimizeModal(false)}
                  className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                  aria-label="Close calculation modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* High-Level Calculation Metrics */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Optimization Scope</span>
                <div className="font-mono font-bold text-zinc-900 text-sm">
                  {bulkOptimizationPlan.totalCount} Listed Indexes
                </div>
                <div className="text-[10px] text-zinc-500">Across 3 database entities</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recommended Changes</span>
                <div className="font-mono font-bold text-amber-700 text-sm flex items-center gap-1.5">
                  <span>{bulkOptimizationPlan.pendingChanges.length} Changes Needed</span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {bulkOptimizationPlan.optimalCount} currently optimal
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Projected Health Gain</span>
                <div className="font-mono font-bold text-emerald-700 text-sm flex items-center gap-1">
                  <span>{bulkOptimizationPlan.currentAvgHealth}</span>
                  <span>→</span>
                  <span>{bulkOptimizationPlan.projectedAvgHealth}/100</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded ml-1">
                    +{bulkOptimizationPlan.healthGain}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">Optimal health tier</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Estimated Net Impact</span>
                <div className="font-mono font-bold text-indigo-700 text-sm">
                  +99.6% Speedup
                </div>
                <div className="text-[10px] text-indigo-600 font-medium">-14% dead index write I/O</div>
              </div>
            </div>

            {/* List / Table of Calculated Optimal Changes */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Calculated Index Status &amp; Recommended Actions</span>
                </h4>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {bulkOptimizationPlan.pendingChanges.length} of {bulkOptimizationPlan.totalCount} require modification
                </span>
              </div>

              <div className="space-y-2.5">
                {bulkOptimizationPlan.allListed.map((item) => (
                  <div
                    key={item.id}
                    id={`bulk-plan-item-${item.indexName}`}
                    data-testid={`bulk-plan-item-${item.indexName}`}
                    className={`p-3.5 rounded-xl border transition-all text-xs ${
                      !item.isOptimal
                        ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                        : 'bg-white border-zinc-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 text-xs">{item.indexName}</span>
                          <span className="text-[10px] bg-zinc-100 text-zinc-700 font-mono px-1.5 py-0.2 rounded border border-zinc-200">
                            {item.indexType}
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.2 rounded border border-indigo-200">
                            {item.tableEntity} ({item.tableName})
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-600">
                          Columns: <code className="font-mono text-zinc-800 bg-zinc-100 px-1 rounded">{item.columns.join(', ')}</code>
                        </div>

                        <p className="text-[11px] text-zinc-700 leading-relaxed pt-0.5">
                          {item.reason}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1.5 shrink-0">
                        {/* Health Score Transition */}
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${item.currentBadgeClass}`}>
                            Health: {item.currentHealthScore}
                          </span>
                          {!item.isOptimal && (
                            <>
                              <ArrowRight className="w-3 h-3 text-zinc-400" />
                              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {item.projectedHealthScore}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Calculated Recommendation Action Badge */}
                        <div>
                          {item.isOptimal ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Optimal (No Action Needed)</span>
                            </span>
                          ) : item.recommendedAction === 'PRUNE' ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-md">
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Action: Prune Dead Index</span>
                            </span>
                          ) : item.recommendedAction === 'RESTORE' ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded-md">
                              <Key className="w-3 h-3 text-indigo-600" />
                              <span>Action: Restore Primary Clustered Key</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                              <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                              <span>Action: {item.actionTitle}</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-emerald-700 font-bold">
                          {item.speedupGain}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer with Single Button */}
            <div className="p-4 sm:p-5 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-zinc-600">
                {bulkOptimizationPlan.isFullyOptimized ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>All {bulkOptimizationPlan.totalCount} listed indexes are operating in their optimal configuration.</span>
                  </span>
                ) : (
                  <span>
                    Calculated <strong className="text-amber-800 font-bold">{bulkOptimizationPlan.pendingChanges.length} improvements</strong> across {bulkOptimizationPlan.totalCount} listed indexes.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkOptimizeModal(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  id="btn-footer-apply-bulk-optimize"
                  data-testid="btn-footer-apply-bulk-optimize"
                  onClick={() => {
                    handleApplyBulkOptimize();
                    setShowBulkOptimizeModal(false);
                  }}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                    bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkOptimizationPlan.isFullyOptimized
                      ? 'Schema Fully Optimized'
                      : `Apply All Recommended Improvements (${bulkOptimizationPlan.pendingChanges.length} Changes)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Indices & Schema Prototyper Modal */}
      {showBulkImportModal && (
        <div
          id="bulk-import-indices-modal"
          data-testid="bulk-import-indices-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 relative">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-xs">
                  <UploadCloud className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                      Bulk Import Indices &amp; Schema Prototyper
                    </h3>
                    <span className="font-mono text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                      JSON Prototyping Engine
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Import or paste a JSON file of index configurations to quickly prototype and benchmark alternative database schema states.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-bulk-import-modal"
                data-testid="btn-close-bulk-import-modal"
                onClick={() => setShowBulkImportModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Schema State Indicator Bar */}
            <div className="px-5 py-2.5 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">Currently Active State:</span>
                <span className="font-bold text-zinc-800 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs font-mono">
                  {activeSchemaPrototypeName}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-600">
                <span>Active Indexes: <strong className="text-indigo-700">{tables.reduce((acc, t) => acc + t.indexes.filter(i => i.active && !removedIndexes.includes(i.name)).length, 0)}</strong></span>
                <span>•</span>
                <span>Speedup: <strong className="text-emerald-700">{speedUpPercent}%</strong></span>
              </div>
            </div>

            {/* Modal Body with Tabs */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 flex-wrap">
                <button
                  type="button"
                  id="tab-import-upload"
                  data-testid="tab-import-upload"
                  onClick={() => setBulkImportActiveTab('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload / Paste JSON File</span>
                </button>
                <button
                  type="button"
                  id="tab-import-presets"
                  data-testid="tab-import-presets"
                  onClick={() => setBulkImportActiveTab('presets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'presets'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Preset Schema Prototypes (4)</span>
                </button>
                <button
                  type="button"
                  id="tab-import-spec"
                  data-testid="tab-import-spec"
                  onClick={() => setBulkImportActiveTab('schema-spec')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'schema-spec'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>JSON Specification &amp; Sample Template</span>
                </button>
              </div>

              {/* TAB 1: Upload / Paste JSON */}
              {bulkImportActiveTab === 'upload' && (
                <div className="space-y-4">
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                      isDraggingFile
                        ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01]'
                        : 'border-zinc-300 hover:border-indigo-400 bg-zinc-50/60 hover:bg-indigo-50/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-white text-indigo-600 rounded-full shadow-xs border border-zinc-200">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-800">
                          {uploadedFileName ? (
                            <span className="text-indigo-600 font-mono">Loaded File: {uploadedFileName}</span>
                          ) : (
                            'Choose a .json index configuration file or drag & drop here'
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Accepts exported schema snapshots, index arrays, or custom configuration payloads (.json)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Direct JSON Paste & Syntax Editor */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <label htmlFor="import-json-textarea" className="font-bold text-zinc-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>JSON Index Configuration Payload</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {parsedImportResult.isValid ? (
                          <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Valid JSON ({parsedImportResult.config?.totalIndicesCount} indices, {parsedImportResult.config?.targetTablesCount} tables)</span>
                          </span>
                        ) : parsedImportResult.error ? (
                          <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Syntax Error</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Paste JSON or select a file above</span>
                        )}
                        {importJsonInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setImportJsonInput('');
                              setUploadedFileName(null);
                            }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      id="import-json-textarea"
                      data-testid="import-json-textarea"
                      rows={9}
                      value={importJsonInput}
                      onChange={(e) => setImportJsonInput(e.target.value)}
                      placeholder={`{\n  "name": "Custom E-Commerce Prototype Schema",\n  "optimizationFlags": { "btreeIndexing": true, "batchEagerLoading": true },\n  "indexConfiguration": {\n    "createdCompositeIndexes": ["email_status", "category_amount", "tx_price"],\n    "createdCustomIndexes": ["customer_email", "amount"],\n    "removedOrPrunedIndexes": ["idx_transactions_date"]\n  }\n}`}
                      className="w-full font-mono text-xs p-3 bg-zinc-900 text-zinc-100 rounded-xl border border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    />
                    {parsedImportResult.error && (
                      <p className="text-[11px] text-rose-600 font-mono mt-1">
                        ⚠️ Parse Error: {parsedImportResult.error}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Preset Schema Prototypes */}
              {bulkImportActiveTab === 'presets' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Select a pre-configured realistic database schema index state to instantly test workload behavior and latency transformations:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {samplePresets.map((preset) => (
                      <div
                        key={preset.id}
                        id={`preset-card-${preset.id}`}
                        data-testid={`preset-card-${preset.id}`}
                        className="p-4 rounded-xl border border-zinc-200 hover:border-indigo-400 hover:shadow-sm bg-white transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-zinc-900">
                              {preset.name}
                            </h4>
                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
                            {preset.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                          <div className="font-mono text-[11px] text-emerald-700 font-bold">
                            {preset.speedup}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setImportJsonInput(preset.jsonContent);
                              setUploadedFileName(`${preset.id}.json`);
                              setBulkImportActiveTab('upload');
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <span>Load into Prototyper</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Specification & Sample Template */}
              {bulkImportActiveTab === 'schema-spec' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2 text-zinc-800">
                    <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-600" />
                      <span>Supported JSON Schema Configurations</span>
                    </h4>
                    <p className="text-[11px] text-zinc-700 leading-relaxed">
                      The Bulk Importer accepts full schema snapshots exported from this viewer, custom array lists of indexes, or high-level index configuration files with optimization flags.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10.5px]">
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">createdCompositeIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;email_status&quot;, &quot;category_amount&quot;, &quot;tx_price&quot;, &quot;tier_created&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">createdCustomIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;customer_email&quot;, &quot;amount&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">removedOrPrunedIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;idx_transactions_date&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">indices (Custom list)</strong>
                        <span className="text-zinc-600">e.g. [&#123; name, targetTable, columns, type, active &#125;]</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-zinc-500 text-[11px]">Need a starting JSON file?</span>
                    <button
                      type="button"
                      id="btn-download-sample-index-template"
                      data-testid="btn-download-sample-index-template"
                      onClick={handleDownloadSampleJsonTemplate}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Download Sample Template (.json)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE PROTOTYPE PREVIEW CARD (Shown when valid JSON is loaded) */}
              {parsedImportResult.isValid && parsedImportResult.config && (
                <div
                  id="import-prototype-preview-card"
                  data-testid="import-prototype-preview-card"
                  className="p-4 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/80 rounded-xl border border-emerald-300 shadow-xs space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-emerald-600 text-white rounded-md">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <span>Prototype State Preview:</span>
                          <strong className="text-indigo-900 font-mono">{parsedImportResult.config.name}</strong>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {parsedImportResult.config.description}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      Ready to Apply
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Affected Tables</span>
                      <div className="font-mono font-bold text-zinc-800 mt-0.5">
                        {parsedImportResult.config.targetTables.join(', ')}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Composite Indexes</span>
                      <div className="font-mono font-bold text-purple-700 mt-0.5">
                        {parsedImportResult.config.createdCompositeIndexes.length} active
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Custom Indexes</span>
                      <div className="font-mono font-bold text-indigo-700 mt-0.5">
                        {parsedImportResult.config.createdCustomIndexes.length + parsedImportResult.config.customIndices.length} active
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Pruned Unutilized</span>
                      <div className="font-mono font-bold text-rose-700 mt-0.5">
                        {parsedImportResult.config.removedIndexes.length} removed
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={importSnapshotBeforeApply}
                  onChange={(e) => setImportSnapshotBeforeApply(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                />
                <span>Automatically snapshot current schema state before applying prototype</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-apply-bulk-imported-indices"
                  data-testid="btn-apply-bulk-imported-indices"
                  disabled={!parsedImportResult.isValid || !parsedImportResult.config}
                  onClick={handleApplyImportedIndices}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Apply Index Configuration &amp; Prototype State</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Named Checkpoint / Snapshot State Modal */}
      {showNamedSnapshotModal && (
        <div
          id="modal-snapshot-state"
          data-testid="modal-snapshot-state"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-xs">
                  <History className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Snapshot Schema State
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Create a named checkpoint of the current index configuration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-snapshot-modal"
                data-testid="btn-close-snapshot-modal"
                onClick={() => setShowNamedSnapshotModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNamedSnapshot} className="space-y-4">
              <div>
                <label htmlFor="input-checkpoint-name" className="block text-xs font-bold text-zinc-700 mb-1">
                  Checkpoint Name
                </label>
                <input
                  type="text"
                  id="input-checkpoint-name"
                  data-testid="input-checkpoint-name"
                  autoFocus
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder="e.g. Composite Index Experiment, Post-Optimization State..."
                  className="w-full text-xs px-3 py-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* State Summary to be captured */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs">
                <div className="font-semibold text-zinc-700 text-[11px] uppercase tracking-wider">
                  Configuration Captured in Checkpoint
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Total Active Indexes</span>
                    <strong className="text-indigo-700 font-mono">
                      {tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length, 0)} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Composite Indexes</span>
                    <strong className="text-purple-700 font-mono">
                      {createdCompositeIndexes.length} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Custom &amp; Imported</span>
                    <strong className="text-emerald-700 font-mono">
                      {createdCustomIndexes.length + importedCustomIndices.length} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Pruned Unutilized</span>
                    <strong className="text-rose-700 font-mono">
                      {removedIndexes.length} removed
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNamedSnapshotModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-checkpoint"
                  data-testid="btn-save-checkpoint"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save Checkpoint</span>
                </button>
              </div>
            </form>
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
                    Schema Snapshots &amp; Checkpoints Manager
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Switch between saved index configuration checkpoints to compare schema performance.
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
                <div
                  key={snap.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    selectedCheckpointId === snap.id
                      ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div>
                    <div className="font-bold text-zinc-900 flex items-center gap-2">
                      <span>{snap.name}</span>
                      {selectedCheckpointId === snap.id && (
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                          Active Checkpoint
                        </span>
                      )}
                      {snap.isProtected && (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold flex items-center gap-1 border border-amber-300">
                          <Shield className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                          Protected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Saved at {snap.timestamp} • Active Indexes: {snap.totalIndexesCount ?? snap.customIndexes.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id={`btn-toggle-protect-${snap.id}`}
                      data-testid={`btn-toggle-protect-${snap.id}`}
                      onClick={() => handleToggleProtectSnapshot(snap.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                        snap.isProtected
                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                          : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                      }`}
                      title={snap.isProtected ? 'Protected: Prevents automated overwrite or pruning' : 'Mark as Protected'}
                    >
                      <Shield className={`w-3.5 h-3.5 ${snap.isProtected ? 'text-amber-700 fill-amber-700' : 'text-zinc-400'}`} />
                      <span>{snap.isProtected ? 'Protected' : 'Protect'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(snap)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                        selectedCheckpointId === snap.id
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {selectedCheckpointId === snap.id ? 'Active' : 'Restore State'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Migration SQL Export Panel */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>Simulate Production Migration SQL Diff</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">From Version (Base)</label>
                  <select
                    value={migrationVersion1Id}
                    onChange={(e) => setMigrationVersion1Id(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">To Version (Target)</label>
                  <select
                    value={migrationVersion2Id}
                    onChange={(e) => setMigrationVersion2Id(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                id="btn-export-migration-sql"
                data-testid="btn-export-migration-sql"
                onClick={handleExportMigrationSQL}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Difference as 'Migration SQL' Script</span>
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-open-compare-schema-overlay"
                  data-testid="btn-open-compare-schema-overlay"
                  onClick={() => setShowCompareSchemaOverlay(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open Compare Schema overlay to highlight added, removed, or modified indexes between snapshots"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Compare Schema</span>
                </button>
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
              </div>
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

      {/* Compare Schema Overlay Modal */}
      {showCompareSchemaOverlay && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Compare Schema Overlay</h3>
                  <p className="text-xs text-zinc-500">
                    Visually highlights added, removed, or modified indexes between two selected snapshots.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareSchemaOverlay(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">Snapshot A (Base)</label>
                <select
                  value={compareSnapshotAId}
                  onChange={(e) => setCompareSnapshotAId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.timestamp})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">Snapshot B (Target)</label>
                <select
                  value={compareSnapshotBId}
                  onChange={(e) => setCompareSnapshotBId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.timestamp})</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const snapA = snapshots.find((s) => s.id === compareSnapshotAId) || snapshots[0];
              const snapB = snapshots.find((s) => s.id === compareSnapshotBId) || snapshots[snapshots.length - 1];
              if (!snapA || !snapB) return null;

              const setACustom = new Set(snapA.customIndexes || []);
              const setBCustom = new Set(snapB.customIndexes || []);
              const setAComp = new Set(snapA.createdCompositeIndexes || []);
              const setBComp = new Set(snapB.createdCompositeIndexes || []);

              const added = [...setBCustom].filter((x) => !setACustom.has(x)).concat([...setBComp].filter((x) => !setAComp.has(x)));
              const removed = [...setACustom].filter((x) => !setBCustom.has(x)).concat([...setAComp].filter((x) => !setBComp.has(x)));
              const modified = snapA.flags?.btreeIndexing !== snapB.flags?.btreeIndexing ? ['btreeIndexing optimization flag'] : [];

              return (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-emerald-700">Added Indexes</div>
                      <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">+{added.length}</div>
                    </div>
                    <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-rose-700">Removed Indexes</div>
                      <div className="text-base font-extrabold text-rose-800 font-mono mt-0.5">-{removed.length}</div>
                    </div>
                    <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-amber-700">Modified Deltas</div>
                      <div className="text-base font-extrabold text-amber-800 font-mono mt-0.5">{modified.length}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Visual Web Map Diff Highlights</h4>
                    {added.map((item, idx) => (
                      <div key={`add-${idx}`} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-emerald-950 font-bold">🟢 [Added] idx_{item}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-sans">New B-Tree Leaf Node</span>
                      </div>
                    ))}
                    {removed.map((item, idx) => (
                      <div key={`rem-${idx}`} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-rose-950 font-bold">🔴 [Removed] idx_{item}</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-sans">Pruned / Dropped Index</span>
                      </div>
                    ))}
                    {modified.map((item, idx) => (
                      <div key={`mod-${idx}`} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                        <span className="text-amber-950 font-bold">🟡 [Modified] {item}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">Flag Configuration Delta</span>
                      </div>
                    ))}
                    {added.length === 0 && removed.length === 0 && modified.length === 0 && (
                      <div className="p-6 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                        No structural differences detected between "{snapA.name}" and "{snapB.name}".
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCompareSchemaOverlay(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Preview Banner */}
      {dryRunPreviewList && (
        <div className="mx-6 mt-4 p-4 bg-teal-50 border border-teal-300 rounded-2xl shadow-md text-teal-950 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-600 text-white rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-teal-950">Bulk Optimization Dry Run — Projected Performance Preview</h4>
                <p className="text-xs text-teal-800">
                  Simulated execution plan preview. Schema state was NOT modified.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDryRunPreviewList(null)}
              className="text-teal-700 hover:text-teal-900 p-1 rounded-lg hover:bg-teal-100 cursor-pointer"
              title="Dismiss preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {dryRunPreviewList.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-2xs flex items-center justify-between font-mono">
                <span className="font-bold text-teal-900">{item.name}</span>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-sans font-semibold">
                  {item.impact}
                </span>
              </div>
            ))}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      id="btn-preview-auto-cleanup"
                      data-testid="btn-preview-auto-cleanup"
                      onClick={() => setShowAutoCleanupPreviewModal(true)}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-rose-300 text-rose-800 font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      <span>Preview Auto-Cleanup</span>
                    </button>
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
                            ) : lockedIndexes.includes(diag.name) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-1 rounded flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                                  Locked (Protected)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLockIndex(diag.name)}
                                  className="px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded text-[11px] font-semibold cursor-pointer"
                                  title="Unlock index to allow removal"
                                >
                                  Unlock
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
      {/* Cross-Reference Report Modal */}
      {showCrossReferenceReportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col text-zinc-900 relative">
            <div className="p-5 border-b border-zinc-200 bg-teal-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-600 text-white rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Historical Query Cross-Reference Report</h3>
                  <p className="text-xs text-zinc-600">
                    Maps active and custom indexes against 24-hour historical query execution logs to detect 'zombie' indexes with 0 hits and zero performance gain.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCrossReferenceReportModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Analyzed Indexes</span>
                  <div className="text-lg font-extrabold text-zinc-900 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + t.indexes.length, 0)}
                  </div>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">High-Utility Indexes</span>
                  <div className="text-lg font-extrabold text-emerald-800 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active).length, 0)}
                  </div>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Zombie Indexes Detected</span>
                  <div className="text-lg font-extrabold text-rose-800 font-mono mt-0.5">2</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Detected Zombie Indexes (Zero Query Hits &amp; Write Overhead)</h4>
                {[
                  { name: 'idx_legacy_audit_log_backup', table: 'transactions', writes: '14,250 writes/hr', reads: '0 reads', overhead: '18% disk write bloat' },
                  { name: 'idx_temp_staging_token', table: 'customers', writes: '4,100 writes/hr', reads: '0 reads', overhead: '7% write amplification' }
                ].map((zombie, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/80 border border-rose-300 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-rose-950 flex items-center gap-2">
                        <span>🧟 {zombie.name}</span>
                        <span className="text-[10px] font-sans bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-bold">ZOMBIE INDEX</span>
                      </div>
                      <div className="text-[11px] text-rose-800 mt-0.5">
                        Table: <span className="font-mono font-bold">{zombie.table}</span> • {zombie.writes} • <strong className="text-rose-950">{zombie.reads}</strong> • Impact: {zombie.overhead}
                      </div>
                    </div>
                    <button
                      type="button"
                      id={`btn-prune-zombie-${idx}`}
                      data-testid={`btn-prune-zombie-${idx}`}
                      onClick={() => {
                        setImportSuccessNotice(`Successfully pruned zombie index "${zombie.name}". Eliminating ${zombie.overhead} and reclaiming disk storage!`);
                        setTimeout(() => setImportSuccessNotice(null), 5000);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors shrink-0"
                    >
                      Prune Zombie Index
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowCrossReferenceReportModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Auto-Cleanup Modal */}
      {showAutoCleanupPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Preview: Next Maintenance Auto-Cleanup Cycle</h3>
                  <p className="text-xs text-zinc-500">
                    Lists exactly which unused or low-priority indexes are scheduled for pruning in the next automated maintenance window.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoCleanupPreviewModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 font-medium">
                💡 <strong>Dry Run Guarantee:</strong> This is a projected preview list. No schema modifications or index drops will occur until execution is explicitly confirmed.
              </div>

              <div className="space-y-2">
                {unutilizedDiagnostics
                  .filter((diag) => !removedIndexes.includes(diag.name))
                  .map((diag, idx) => (
                    <div key={idx} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-zinc-900 flex items-center gap-2">
                          <span>🗑️ {diag.name}</span>
                          <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                            0 Hits
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Target Entity: <span className="font-mono">{diag.table}</span> • Footprint: <span className="font-mono font-bold text-zinc-700">{diag.size}</span> • Reason: {diag.writeImpact}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        Queued for Pruning
                      </span>
                    </div>
                  ))}
                {unutilizedDiagnostics.filter((diag) => !removedIndexes.includes(diag.name)).length === 0 && (
                  <div className="p-8 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                    No unutilized indexes currently queued for auto-cleanup. Schema is fully optimized!
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">Next Maintenance Run: Tonight at 02:00 UTC</span>
              <button
                type="button"
                onClick={() => setShowAutoCleanupPreviewModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
