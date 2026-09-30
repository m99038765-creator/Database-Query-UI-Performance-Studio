import React, { useState, useMemo } from 'react';
import {
  Flame,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Lock,
  Unlock,
  Layers,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Sparkles,
  Terminal,
  Database,
  TrendingDown,
  Activity,
  ArrowDownRight,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Zap,
  Sliders
} from 'lucide-react';

export interface DownstreamQuery {
  id: string;
  name: string;
  sqlPattern: string;
  queryType: 'Point Lookup' | 'Join Scan' | 'Filter & Range' | 'Aggregate Metric' | 'Real-Time Polling' | 'Audit / Batch';
  frequencyPerHour: number;
  latencyWithIndexMs: number;
  latencyWithoutIndexMs: number;
  consequence: string;
  criticality: 'critical' | 'high' | 'medium';
}

export interface DependencyTreeNode {
  indexName: string;
  targetTable: string;
  columns: string[];
  type: string;
  isClustered?: boolean;
  isActive: boolean;
  isLocked: boolean;
  isRemoved: boolean;
  downstreamQueries: DownstreamQuery[];
  totalQueriesAffected: number;
  riskCategory: 'critical' | 'elevated' | 'low' | 'unlinked';
  removalImpactSummary: string;
}

export interface ComplexityHeatmapPanelProps {
  lockedIndexes: string[];
  onToggleLockIndex: (indexName: string) => void;
  removedIndexes: string[];
  onRemoveIndex: (indexName: string) => void;
  onRestoreIndex: (indexName: string) => void;
  flags: {
    btreeIndexing: boolean;
    batchEagerLoading: boolean;
    queryCaching: boolean;
    virtualizedDOM: boolean;
    deferredRendering: boolean;
  };
  createdCompositeIndexes: string[];
  createdCustomIndexes: string[];
  importedCustomIndices?: Array<{
    name: string;
    targetTable: string;
    columns: string[];
    type: string;
  }>;
  onSelectIndexDetail?: (indexName: string) => void;
}

// Built-in downstream query catalog for production database indices
const BASE_DOWNSTREAM_QUERIES: Record<string, { queries: DownstreamQuery[]; consequence: string }> = {
  'PRIMARY KEY (id)': {
    consequence: 'Dropping clustered primary key degrades all point-lookups and relational joins to O(n) table scans, crashing checkout APIs and webhooks.',
    queries: [
      {
        id: 'q-pk-1',
        name: 'Q1: Customer Order Point Lookup',
        sqlPattern: 'SELECT * FROM transactions WHERE id = :orderId',
        queryType: 'Point Lookup',
        frequencyPerHour: 14500,
        latencyWithIndexMs: 0.4,
        latencyWithoutIndexMs: 420.0,
        consequence: 'Point seek transforms into full heap scan over 50,000 records',
        criticality: 'critical'
      },
      {
        id: 'q-pk-2',
        name: 'Q2: Row-level Lock on Checkout Mutation',
        sqlPattern: 'SELECT id, status FROM transactions WHERE id = :id FOR UPDATE',
        queryType: 'Point Lookup',
        frequencyPerHour: 6200,
        latencyWithIndexMs: 0.6,
        latencyWithoutIndexMs: 510.0,
        consequence: 'Causes table-wide row lock serialization and checkout queue stalls',
        criticality: 'critical'
      },
      {
        id: 'q-pk-3',
        name: 'Q3: Relational Child Items Join Anchor',
        sqlPattern: 'SELECT * FROM line_items li JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?)',
        queryType: 'Join Scan',
        frequencyPerHour: 8900,
        latencyWithIndexMs: 1.2,
        latencyWithoutIndexMs: 680.0,
        consequence: 'Batched join falls back to unindexed nested loops join',
        criticality: 'critical'
      },
      {
        id: 'q-pk-4',
        name: 'Q4: Payment Gateway Webhook Verification',
        sqlPattern: 'UPDATE transactions SET status = :status WHERE id = :id',
        queryType: 'Point Lookup',
        frequencyPerHour: 4800,
        latencyWithIndexMs: 0.5,
        latencyWithoutIndexMs: 490.0,
        consequence: 'Webhook acknowledgment timeout triggers repeat charge race conditions',
        criticality: 'critical'
      },
      {
        id: 'q-pk-5',
        name: 'Q5: Keyset Order Cursor Pagination',
        sqlPattern: 'SELECT * FROM transactions WHERE id > :lastId ORDER BY id ASC LIMIT 50',
        queryType: 'Filter & Range',
        frequencyPerHour: 3400,
        latencyWithIndexMs: 1.0,
        latencyWithoutIndexMs: 380.0,
        consequence: 'Windowed pagination requires full sequential scan and memory sort',
        criticality: 'high'
      },
      {
        id: 'q-pk-6',
        name: 'Q6: Transaction Reversal & Refund Dispatch',
        sqlPattern: 'SELECT amount, status FROM transactions WHERE id = :id',
        queryType: 'Point Lookup',
        frequencyPerHour: 1800,
        latencyWithIndexMs: 0.4,
        latencyWithoutIndexMs: 390.0,
        consequence: 'Delayed dispute processing and merchant reconciliation backlog',
        criticality: 'high'
      },
      {
        id: 'q-pk-7',
        name: 'Q7: Real-Time WebSocket Telemetry Batch',
        sqlPattern: 'SELECT id, status, amount FROM transactions WHERE id IN (:id1, :id2, :id3, ...)',
        queryType: 'Real-Time Polling',
        frequencyPerHour: 12200,
        latencyWithIndexMs: 1.4,
        latencyWithoutIndexMs: 720.0,
        consequence: 'Real-time live feeds freeze; HTTP socket timeouts under peak load',
        criticality: 'critical'
      },
      {
        id: 'q-pk-8',
        name: 'Q8: Real-time Fraud Scoring Pipeline',
        sqlPattern: 'SELECT risk_score, customer_email FROM transactions WHERE id = :id',
        queryType: 'Point Lookup',
        frequencyPerHour: 5100,
        latencyWithIndexMs: 0.5,
        latencyWithoutIndexMs: 440.0,
        consequence: 'Fraud scoring worker falls behind incoming transaction arrival rate',
        criticality: 'high'
      }
    ]
  },
  'idx_transactions_email_status': {
    consequence: 'Removes multi-column equality seek, forcing 50,000-row table heap scan on customer portal filtering and automated invoice generation.',
    queries: [
      {
        id: 'q-es-1',
        name: 'Q1: Customer Portal Active Order Listing',
        sqlPattern: "SELECT * FROM transactions WHERE customer_email = ? AND status = 'COMPLETED'",
        queryType: 'Filter & Range',
        frequencyPerHour: 11500,
        latencyWithIndexMs: 0.9,
        latencyWithoutIndexMs: 840.0,
        consequence: 'O(log n) composite seek degrades to 840ms sequential table scan',
        criticality: 'critical'
      },
      {
        id: 'q-es-2',
        name: 'Q2: Active Account Support Queue Lookup',
        sqlPattern: "SELECT * FROM transactions WHERE customer_email = ? AND status != 'CANCELLED'",
        queryType: 'Point Lookup',
        frequencyPerHour: 4200,
        latencyWithIndexMs: 1.1,
        latencyWithoutIndexMs: 890.0,
        consequence: 'Support rep dashboard hangs during active call verifications',
        criticality: 'critical'
      },
      {
        id: 'q-es-3',
        name: 'Q3: High-frequency Dashboard Polling',
        sqlPattern: "SELECT count(*) FROM transactions WHERE customer_email = ? AND status = 'PENDING'",
        queryType: 'Real-Time Polling',
        frequencyPerHour: 16800,
        latencyWithIndexMs: 0.7,
        latencyWithoutIndexMs: 650.0,
        consequence: 'Frequent polling locks database CPU cores at 100% capacity',
        criticality: 'critical'
      },
      {
        id: 'q-es-4',
        name: 'Q4: Customer Success Dispute Resolution',
        sqlPattern: "SELECT * FROM transactions WHERE customer_email = ? AND status = 'FAILED'",
        queryType: 'Filter & Range',
        frequencyPerHour: 2100,
        latencyWithIndexMs: 0.8,
        latencyWithoutIndexMs: 710.0,
        consequence: 'Escalation queries stall behind ongoing customer checkouts',
        criticality: 'high'
      },
      {
        id: 'q-es-5',
        name: 'Q5: Automated Receipt Resend Webhook',
        sqlPattern: 'SELECT id, amount, status FROM transactions WHERE customer_email = ? ORDER BY created_at DESC LIMIT 1',
        queryType: 'Point Lookup',
        frequencyPerHour: 3600,
        latencyWithIndexMs: 1.2,
        latencyWithoutIndexMs: 920.0,
        consequence: 'Webhook execution timeout causes delivery failure retries',
        criticality: 'high'
      },
      {
        id: 'q-es-6',
        name: 'Q6: Identity & Fraud Velocity Checker',
        sqlPattern: 'SELECT count(*) FROM transactions WHERE customer_email = ? AND created_at > NOW() - INTERVAL 1 HOUR',
        queryType: 'Aggregate Metric',
        frequencyPerHour: 5800,
        latencyWithIndexMs: 1.4,
        latencyWithoutIndexMs: 880.0,
        consequence: 'Disables rapid anomaly rejection; potential fraud pass-through',
        criticality: 'critical'
      }
    ]
  },
  'idx_line_items_tx': {
    consequence: 'Eliminates foreign key acceleration, re-introducing the synchronous N+1 subquery storm with 100+ separate roundtrips per page and socket exhaustion.',
    queries: [
      {
        id: 'q-li-1',
        name: 'Q1: Relational Order Line Items Expansion',
        sqlPattern: 'SELECT * FROM line_items WHERE transaction_id IN (:ids)',
        queryType: 'Join Scan',
        frequencyPerHour: 18400,
        latencyWithIndexMs: 1.1,
        latencyWithoutIndexMs: 940.0,
        consequence: '100+ unbatched sequential scans per page; connection pool exhausted',
        criticality: 'critical'
      },
      {
        id: 'q-li-2',
        name: 'Q2: Warehouse Fulfillment Picking Slip Dispatch',
        sqlPattern: 'SELECT sku, quantity FROM line_items WHERE transaction_id = ?',
        queryType: 'Point Lookup',
        frequencyPerHour: 7200,
        latencyWithIndexMs: 0.8,
        latencyWithoutIndexMs: 430.0,
        consequence: 'Assembly line barcode scanners stall awaiting database responses',
        criticality: 'critical'
      },
      {
        id: 'q-li-3',
        name: 'Q3: Total Order Margin & Tax Verification',
        sqlPattern: 'SELECT sum(quantity * unit_price) FROM line_items WHERE transaction_id = ?',
        queryType: 'Aggregate Metric',
        frequencyPerHour: 6400,
        latencyWithIndexMs: 0.9,
        latencyWithoutIndexMs: 480.0,
        consequence: 'Financial audit batch jobs exceed allowable SLA maintenance window',
        criticality: 'high'
      },
      {
        id: 'q-li-4',
        name: 'Q4: Packing Station Concurrency Lock',
        sqlPattern: 'SELECT * FROM line_items WHERE transaction_id = ? FOR SHARE',
        queryType: 'Join Scan',
        frequencyPerHour: 3900,
        latencyWithIndexMs: 0.7,
        latencyWithoutIndexMs: 410.0,
        consequence: 'Deadlocks between checkout item reservation and warehouse dispatch',
        criticality: 'high'
      },
      {
        id: 'q-li-5',
        name: 'Q5: RMA Return Merchandise Audit',
        sqlPattern: 'SELECT id, sku, quantity FROM line_items WHERE transaction_id = ? AND quantity > 0',
        queryType: 'Filter & Range',
        frequencyPerHour: 2200,
        latencyWithIndexMs: 0.8,
        latencyWithoutIndexMs: 460.0,
        consequence: 'Customer return portal slowdown during holiday return spikes',
        criticality: 'high'
      }
    ]
  },
  'idx_orders_status_cat': {
    consequence: 'Removes multi-column status and category coverage, forcing SQLite/PostgreSQL to perform disk buffer sorting and CPU-heavy bitmap heap scans.',
    queries: [
      {
        id: 'q-sc-1',
        name: 'Q1: Real-time Operations Dashboard Categorical Breakdown',
        sqlPattern: "SELECT count(*), sum(amount) FROM transactions WHERE status = 'COMPLETED' AND category = ?",
        queryType: 'Aggregate Metric',
        frequencyPerHour: 9800,
        latencyWithIndexMs: 1.8,
        latencyWithoutIndexMs: 560.0,
        consequence: 'Executive operations screen lags; aggregate query blocks writer thread',
        criticality: 'high'
      },
      {
        id: 'q-sc-2',
        name: 'Q2: Category Fulfillment Queue Dispatcher',
        sqlPattern: "SELECT * FROM transactions WHERE status = 'PENDING' AND category = ? LIMIT 100",
        queryType: 'Filter & Range',
        frequencyPerHour: 7400,
        latencyWithIndexMs: 1.2,
        latencyWithoutIndexMs: 490.0,
        consequence: 'Order processing pipeline latency climbs from 12ms to 680ms',
        criticality: 'high'
      },
      {
        id: 'q-sc-3',
        name: 'Q3: Daily Departmental Financial Settlement',
        sqlPattern: "SELECT category, sum(amount) FROM transactions WHERE status = 'SETTLED' GROUP BY category",
        queryType: 'Audit / Batch',
        frequencyPerHour: 1400,
        latencyWithIndexMs: 2.1,
        latencyWithoutIndexMs: 720.0,
        consequence: 'Nightly settlement batch runs past midnight, missing bank wire windows',
        criticality: 'high'
      },
      {
        id: 'q-sc-4',
        name: 'Q4: SLA Breach Alert Background Monitor',
        sqlPattern: "SELECT count(*) FROM transactions WHERE status = 'PROCESSING' AND category = 'Enterprise'",
        queryType: 'Real-Time Polling',
        frequencyPerHour: 11200,
        latencyWithIndexMs: 0.9,
        latencyWithoutIndexMs: 420.0,
        consequence: 'SLA watchdog cron triggers false-positive alarm storms due to query lag',
        criticality: 'critical'
      }
    ]
  },
  'idx_transactions_category_amount': {
    consequence: 'Forces sorted category and amount range index traversal to fall back to in-memory temporary sort buffers and disk spills.',
    queries: [
      {
        id: 'q-ca-1',
        name: 'Q1: Category Revenue High-Value Filtering',
        sqlPattern: 'SELECT * FROM transactions WHERE category = ? AND amount > 500.00',
        queryType: 'Filter & Range',
        frequencyPerHour: 5900,
        latencyWithIndexMs: 1.4,
        latencyWithoutIndexMs: 630.0,
        consequence: 'RAM sort buffer allocation overflows to disk temporary files',
        criticality: 'high'
      },
      {
        id: 'q-ca-2',
        name: 'Q2: Executive Category Breakdown by Amount',
        sqlPattern: 'SELECT category, avg(amount), max(amount) FROM transactions GROUP BY category',
        queryType: 'Aggregate Metric',
        frequencyPerHour: 3200,
        latencyWithIndexMs: 2.4,
        latencyWithoutIndexMs: 690.0,
        consequence: 'Memory spill warnings and 30x dashboard query slowdown',
        criticality: 'high'
      },
      {
        id: 'q-ca-3',
        name: 'Q3: High-Value Anomaly Alert Monitor',
        sqlPattern: "SELECT * FROM transactions WHERE category = 'Electronics' AND amount > 2500.00",
        queryType: 'Real-Time Polling',
        frequencyPerHour: 4800,
        latencyWithIndexMs: 1.1,
        latencyWithoutIndexMs: 580.0,
        consequence: 'Delayed real-time credit card fraud risk score evaluation',
        criticality: 'high'
      },
      {
        id: 'q-ca-4',
        name: 'Q4: Tiered Discount Reconciliation Job',
        sqlPattern: 'SELECT id, amount FROM transactions WHERE category = ? AND amount BETWEEN 100 AND 1000',
        queryType: 'Audit / Batch',
        frequencyPerHour: 1900,
        latencyWithIndexMs: 1.6,
        latencyWithoutIndexMs: 610.0,
        consequence: 'Reconciliation script execution time jumps from 4s to 2.8 minutes',
        criticality: 'medium'
      }
    ]
  },
  'idx_customers_tier_created': {
    consequence: 'Removes pre-sorted order delivery for customer tiers, requiring explicit sort buffers to order records descending by creation date.',
    queries: [
      {
        id: 'q-tc-1',
        name: 'Q1: Enterprise Customer Signup Onboarding',
        sqlPattern: "SELECT * FROM customers WHERE tier = 'Enterprise' ORDER BY created_at DESC LIMIT 25",
        queryType: 'Filter & Range',
        frequencyPerHour: 4100,
        latencyWithIndexMs: 1.1,
        latencyWithoutIndexMs: 240.0,
        consequence: 'Enterprise admin dashboard loses zero-sort instant pagination delivery',
        criticality: 'medium'
      },
      {
        id: 'q-tc-2',
        name: 'Q2: VIP Cohort Retention & Churn Analysis',
        sqlPattern: "SELECT count(*) FROM customers WHERE tier = 'VIP' AND created_at >= ?",
        queryType: 'Aggregate Metric',
        frequencyPerHour: 2800,
        latencyWithIndexMs: 1.4,
        latencyWithoutIndexMs: 310.0,
        consequence: '140% increase in CPU time during weekly cohort retention analysis',
        criticality: 'medium'
      },
      {
        id: 'q-tc-3',
        name: 'Q3: Annual Loyalty Tier Rollover Processing',
        sqlPattern: "SELECT id, email FROM customers WHERE tier = 'Gold' AND created_at < ?",
        queryType: 'Audit / Batch',
        frequencyPerHour: 800,
        latencyWithIndexMs: 1.2,
        latencyWithoutIndexMs: 260.0,
        consequence: 'Batch worker job runs 8x longer on database worker instances',
        criticality: 'medium'
      }
    ]
  },
  'idx_customers_email': {
    consequence: 'Disables unique B-tree lookup on email; forces full customer table scan during user login and authentication verification.',
    queries: [
      {
        id: 'q-ce-1',
        name: 'Q1: SSO & Passwordless Authentication Lookup',
        sqlPattern: 'SELECT * FROM customers WHERE email = ? LIMIT 1',
        queryType: 'Point Lookup',
        frequencyPerHour: 9200,
        latencyWithIndexMs: 0.4,
        latencyWithoutIndexMs: 180.0,
        consequence: 'Login authentication response latency jumps from 0.4ms to 180ms',
        criticality: 'high'
      },
      {
        id: 'q-ce-2',
        name: 'Q2: Duplicate Registration Collision Check',
        sqlPattern: 'SELECT id FROM customers WHERE email = ?',
        queryType: 'Point Lookup',
        frequencyPerHour: 4400,
        latencyWithIndexMs: 0.3,
        latencyWithoutIndexMs: 160.0,
        consequence: 'Customer signup form validation experiences noticeable UI lag',
        criticality: 'medium'
      }
    ]
  },
  'idx_line_items_tx_price': {
    consequence: 'Removes covering index on order item pricing; queries must fetch heap blocks to read unit_price column.',
    queries: [
      {
        id: 'q-lip-1',
        name: 'Q1: Price-Filtered Itemized Audit',
        sqlPattern: 'SELECT * FROM line_items WHERE transaction_id = ? AND unit_price > 50.00',
        queryType: 'Filter & Range',
        frequencyPerHour: 3100,
        latencyWithIndexMs: 0.8,
        latencyWithoutIndexMs: 290.0,
        consequence: 'Heap page fetches increase buffer pool cache misses by 64%',
        criticality: 'medium'
      },
      {
        id: 'q-lip-2',
        name: 'Q2: Bulk Item Margin Calculation',
        sqlPattern: 'SELECT transaction_id, sum(unit_price * quantity) FROM line_items WHERE transaction_id IN (?) GROUP BY transaction_id',
        queryType: 'Aggregate Metric',
        frequencyPerHour: 2400,
        latencyWithIndexMs: 1.4,
        latencyWithoutIndexMs: 380.0,
        consequence: 'Item margin aggregation requires additional secondary heap lookups',
        criticality: 'medium'
      }
    ]
  },
  'idx_transactions_date': {
    consequence: 'Unutilized single-column date index with low selectivity. Dropping reclaims write maintenance overhead with minimal query degradation.',
    queries: [
      {
        id: 'q-td-1',
        name: 'Q1: Historical Range Archival',
        sqlPattern: 'SELECT * FROM transactions WHERE created_at < NOW() - INTERVAL 1 YEAR',
        queryType: 'Audit / Batch',
        frequencyPerHour: 120,
        latencyWithIndexMs: 2.1,
        latencyWithoutIndexMs: 120.0,
        consequence: 'Infrequent quarterly archival batch experiences negligible slowdown',
        criticality: 'medium'
      }
    ]
  },
  'idx_transactions_email_missing': {
    consequence: 'Bottlenecked unindexed column. Creating this index eliminates 50,000-record sequential scans on email lookups.',
    queries: [
      {
        id: 'q-tem-1',
        name: 'Q1: Customer Support Email Lookup',
        sqlPattern: 'SELECT * FROM transactions WHERE customer_email = ?',
        queryType: 'Point Lookup',
        frequencyPerHour: 6200,
        latencyWithIndexMs: 0.8,
        latencyWithoutIndexMs: 480.0,
        consequence: 'Full table sequential scan without index',
        criticality: 'high'
      },
      {
        id: 'q-tem-2',
        name: 'Q2: Email Transaction History Export',
        sqlPattern: 'SELECT id, amount, status FROM transactions WHERE customer_email = ?',
        queryType: 'Filter & Range',
        frequencyPerHour: 2800,
        latencyWithIndexMs: 1.2,
        latencyWithoutIndexMs: 510.0,
        consequence: 'Customer history export lags',
        criticality: 'medium'
      }
    ]
  },
  'idx_transactions_amount_missing': {
    consequence: 'Bottlenecked unindexed column. Single-column range scan for amount thresholds.',
    queries: [
      {
        id: 'q-tam-1',
        name: 'Q1: Amount Range Threshold Query',
        sqlPattern: 'SELECT * FROM transactions WHERE amount > 1000.00',
        queryType: 'Filter & Range',
        frequencyPerHour: 1800,
        latencyWithIndexMs: 1.5,
        latencyWithoutIndexMs: 380.0,
        consequence: 'Heap scan over all transactions table blocks',
        criticality: 'medium'
      }
    ]
  }
};

export const ComplexityHeatmapPanel: React.FC<ComplexityHeatmapPanelProps> = ({
  lockedIndexes,
  onToggleLockIndex,
  removedIndexes,
  onRemoveIndex,
  onRestoreIndex,
  flags,
  createdCompositeIndexes,
  createdCustomIndexes,
  importedCustomIndices = [],
  onSelectIndexDetail
}) => {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'elevated' | 'low' | 'unlinked'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'queries-desc' | 'queries-asc' | 'name-asc'>('queries-desc');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'PRIMARY KEY (id)': true,
    'idx_transactions_email_status': true,
    'idx_line_items_tx': true
  });
  const [disabledQueryEdges, setDisabledQueryEdges] = useState<Record<string, boolean>>({});
  const [activeSimulationIndex, setActiveSimulationIndex] = useState<string | null>(null);

  // Build the complete dependency tree data with downstream query counts and heatmap categories
  const treeNodes: DependencyTreeNode[] = useMemo(() => {
    const rawList: Array<{
      indexName: string;
      targetTable: string;
      columns: string[];
      type: string;
      isClustered?: boolean;
      isActive: boolean;
    }> = [
      {
        indexName: 'PRIMARY KEY (id)',
        targetTable: 'transactions',
        columns: ['id'],
        type: 'B-Tree (Clustered)',
        isClustered: true,
        isActive: !removedIndexes.includes('PRIMARY KEY (id)')
      },
      {
        indexName: 'idx_transactions_email_status',
        targetTable: 'transactions',
        columns: ['customer_email', 'status'],
        type: 'Composite B-Tree (AI Recommended)',
        isActive: createdCompositeIndexes.includes('email_status') && !removedIndexes.includes('idx_transactions_email_status')
      },
      {
        indexName: 'idx_line_items_tx',
        targetTable: 'line_items',
        columns: ['transaction_id'],
        type: 'B-Tree (Foreign Key)',
        isActive: flags.batchEagerLoading && !removedIndexes.includes('idx_line_items_tx')
      },
      {
        indexName: 'idx_orders_status_cat',
        targetTable: 'transactions',
        columns: ['status', 'category'],
        type: 'Composite B-Tree',
        isActive: flags.btreeIndexing && !removedIndexes.includes('idx_orders_status_cat')
      },
      {
        indexName: 'idx_transactions_category_amount',
        targetTable: 'transactions',
        columns: ['category', 'amount'],
        type: 'Composite B-Tree (AI Recommended)',
        isActive: createdCompositeIndexes.includes('category_amount') && !removedIndexes.includes('idx_transactions_category_amount')
      },
      {
        indexName: 'idx_customers_tier_created',
        targetTable: 'customers',
        columns: ['tier', 'created_at'],
        type: 'Composite B-Tree (AI Recommended)',
        isActive: createdCompositeIndexes.includes('tier_created') && !removedIndexes.includes('idx_customers_tier_created')
      },
      {
        indexName: 'idx_customers_email',
        targetTable: 'customers',
        columns: ['email'],
        type: 'B-Tree Unique',
        isActive: !removedIndexes.includes('idx_customers_email')
      },
      {
        indexName: 'idx_line_items_tx_price',
        targetTable: 'line_items',
        columns: ['transaction_id', 'unit_price'],
        type: 'Composite B-Tree (AI Recommended)',
        isActive: createdCompositeIndexes.includes('tx_price') && !removedIndexes.includes('idx_line_items_tx_price')
      },
      {
        indexName: 'idx_transactions_date',
        targetTable: 'transactions',
        columns: ['created_at'],
        type: 'B-Tree',
        isActive: !removedIndexes.includes('idx_transactions_date')
      }
    ];

    // If custom unindexed columns were created, include them
    if (createdCustomIndexes.includes('customer_email')) {
      rawList.push({
        indexName: 'idx_transactions_email_missing',
        targetTable: 'transactions',
        columns: ['customer_email'],
        type: 'B-Tree (Missing Bottleneck)',
        isActive: !removedIndexes.includes('idx_transactions_email_missing')
      });
    }
    if (createdCustomIndexes.includes('amount')) {
      rawList.push({
        indexName: 'idx_transactions_amount_missing',
        targetTable: 'transactions',
        columns: ['amount'],
        type: 'B-Tree (Missing Bottleneck)',
        isActive: !removedIndexes.includes('idx_transactions_amount_missing')
      });
    }

    // Imported custom indexes from JSON configs
    importedCustomIndices.forEach((customIdx) => {
      if (!rawList.some((r) => r.indexName === customIdx.name)) {
        rawList.push({
          indexName: customIdx.name,
          targetTable: customIdx.targetTable,
          columns: customIdx.columns,
          type: customIdx.type || 'Custom B-Tree',
          isActive: !removedIndexes.includes(customIdx.name)
        });
      }
    });

    return rawList.map((item) => {
      const isLocked = lockedIndexes.includes(item.indexName);
      const isRemoved = removedIndexes.includes(item.indexName);

      const catalogData = BASE_DOWNSTREAM_QUERIES[item.indexName];
      let downstreamQueries: DownstreamQuery[] = [];
      let consequence = 'Generic index pruning consequence: May increase latency for matching filter predicates.';

      if (catalogData) {
        downstreamQueries = catalogData.queries;
        consequence = catalogData.consequence;
      } else {
        // Dynamically synthesize realistic downstream queries for custom/imported indexes
        const colList = item.columns.join(', ');
        downstreamQueries = [
          {
            id: `q-dyn-${item.indexName}-1`,
            name: `Q1: Filter on ${item.targetTable} (${colList})`,
            sqlPattern: `SELECT * FROM ${item.targetTable} WHERE ${item.columns[0]} = ?`,
            queryType: 'Filter & Range',
            frequencyPerHour: 1800,
            latencyWithIndexMs: 1.2,
            latencyWithoutIndexMs: 320.0,
            consequence: `Full sequential scan over ${item.targetTable} if ${item.indexName} is dropped`,
            criticality: 'medium'
          }
        ];
        consequence = `Supports fast lookup on ${item.targetTable} across columns [${colList}].`;
      }

      const totalQueriesAffected = downstreamQueries.length;

      // Color-coding heatmap category rules based on downstream queries count:
      // 5+ queries => critical risk (fiery rose/crimson)
      // 3-4 queries => elevated risk (vibrant orange/amber)
      // 1-2 queries => low risk (indigo/blue)
      // 0 queries => unlinked / safe to prune (zinc)
      let riskCategory: 'critical' | 'elevated' | 'low' | 'unlinked' = 'low';
      if (totalQueriesAffected >= 5) {
        riskCategory = 'critical';
      } else if (totalQueriesAffected >= 3) {
        riskCategory = 'elevated';
      } else if (totalQueriesAffected >= 1) {
        riskCategory = 'low';
      } else {
        riskCategory = 'unlinked';
      }

      return {
        ...item,
        isLocked,
        isRemoved,
        downstreamQueries,
        totalQueriesAffected,
        riskCategory,
        removalImpactSummary: consequence
      };
    });
  }, [flags, createdCompositeIndexes, createdCustomIndexes, importedCustomIndices, lockedIndexes, removedIndexes]);

  // Aggregate telemetry metrics
  const telemetry = useMemo(() => {
    const totalIndexes = treeNodes.length;
    const criticalNodes = treeNodes.filter((n) => n.riskCategory === 'critical');
    const elevatedNodes = treeNodes.filter((n) => n.riskCategory === 'elevated');
    const lowNodes = treeNodes.filter((n) => n.riskCategory === 'low');
    const unlinkedNodes = treeNodes.filter((n) => n.riskCategory === 'unlinked');

    const totalQueriesMapped = treeNodes.reduce((acc, n) => acc + n.totalQueriesAffected, 0);
    const maxQueriesOnSingleIndex = Math.max(...treeNodes.map((n) => n.totalQueriesAffected), 0);
    const lockedHighRiskCount = criticalNodes.filter((n) => n.isLocked).length;

    return {
      totalIndexes,
      criticalCount: criticalNodes.length,
      elevatedCount: elevatedNodes.length,
      lowCount: lowNodes.length,
      unlinkedCount: unlinkedNodes.length,
      totalQueriesMapped,
      maxQueriesOnSingleIndex,
      lockedHighRiskCount,
      allCriticalProtected: criticalNodes.length > 0 && criticalNodes.every((n) => n.isLocked)
    };
  }, [treeNodes]);

  // Filtered and sorted tree nodes
  const filteredNodes = useMemo(() => {
    return treeNodes
      .filter((node) => {
        // Risk Filter
        if (riskFilter !== 'all' && node.riskCategory !== riskFilter) {
          return false;
        }
        // Table Filter
        if (tableFilter !== 'all' && node.targetTable !== tableFilter) {
          return false;
        }
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchIndex = node.indexName.toLowerCase().includes(q);
          const matchTable = node.targetTable.toLowerCase().includes(q);
          const matchColumns = node.columns.some((c) => c.toLowerCase().includes(q));
          const matchDownstream = node.downstreamQueries.some(
            (dq) => dq.name.toLowerCase().includes(q) || dq.sqlPattern.toLowerCase().includes(q)
          );
          if (!matchIndex && !matchTable && !matchColumns && !matchDownstream) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'queries-desc') {
          return b.totalQueriesAffected - a.totalQueriesAffected;
        } else if (sortBy === 'queries-asc') {
          return a.totalQueriesAffected - b.totalQueriesAffected;
        } else {
          return a.indexName.localeCompare(b.indexName);
        }
      });
  }, [treeNodes, riskFilter, tableFilter, searchQuery, sortBy]);

  // Quick Action: Protect all Critical / High-Risk Indexes with 1 click
  const handleProtectAllHighRisk = () => {
    const criticalNodes = treeNodes.filter((n) => n.riskCategory === 'critical' && !n.isLocked);
    criticalNodes.forEach((n) => {
      onToggleLockIndex(n.indexName);
    });
  };

  // Expand or Collapse All nodes
  const toggleAllNodes = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    treeNodes.forEach((n) => {
      nextState[n.indexName] = expand;
    });
    setExpandedNodes(nextState);
  };

  // Heatmap styling helper functions
  const getNodeHeatmapStyles = (risk: 'critical' | 'elevated' | 'low' | 'unlinked', isRemoved: boolean) => {
    if (isRemoved) {
      return {
        cardBg: 'bg-zinc-100 border-zinc-300 opacity-60',
        badgeBg: 'bg-zinc-300 text-zinc-700 border-zinc-400',
        pillBg: 'bg-zinc-200 text-zinc-600',
        dotColor: 'bg-zinc-400 ring-zinc-300',
        barColor: 'bg-zinc-400',
        titleColor: 'line-through text-zinc-500'
      };
    }

    switch (risk) {
      case 'critical':
        return {
          cardBg: 'bg-gradient-to-r from-rose-50/95 via-red-50/70 to-rose-100/40 border-rose-300 ring-1 ring-rose-400/40 shadow-xs',
          badgeBg: 'bg-rose-600 text-white border-rose-700 shadow-2xs font-extrabold',
          pillBg: 'bg-rose-100 text-rose-900 border-rose-300',
          dotColor: 'bg-rose-600 ring-rose-300 animate-pulse',
          barColor: 'bg-rose-600',
          titleColor: 'text-rose-950 font-bold'
        };
      case 'elevated':
        return {
          cardBg: 'bg-gradient-to-r from-amber-50/95 via-orange-50/70 to-amber-100/40 border-amber-300 ring-1 ring-amber-400/30 shadow-xs',
          badgeBg: 'bg-amber-500 text-white border-amber-600 shadow-2xs font-bold',
          pillBg: 'bg-amber-100 text-amber-900 border-amber-300',
          dotColor: 'bg-amber-500 ring-amber-300',
          barColor: 'bg-amber-500',
          titleColor: 'text-amber-950 font-bold'
        };
      case 'low':
        return {
          cardBg: 'bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-100/30 border-blue-200 shadow-2xs',
          badgeBg: 'bg-indigo-600 text-white border-indigo-700 font-semibold',
          pillBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          dotColor: 'bg-indigo-500 ring-indigo-300',
          barColor: 'bg-indigo-500',
          titleColor: 'text-indigo-950 font-bold'
        };
      case 'unlinked':
        return {
          cardBg: 'bg-zinc-50 border-zinc-200',
          badgeBg: 'bg-zinc-200 text-zinc-700 border-zinc-300',
          pillBg: 'bg-zinc-100 text-zinc-600 border-zinc-200',
          dotColor: 'bg-zinc-400 ring-zinc-200',
          barColor: 'bg-zinc-300',
          titleColor: 'text-zinc-800'
        };
    }
  };

  return (
    <div
      id="side-panel-complexity-heatmap"
      data-testid="side-panel-complexity-heatmap"
      className="space-y-4 animate-fadeIn"
    >
      {/* Top Banner: Complexity Heatmap Overview & Telemetry Strip */}
      <div className="p-3.5 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-xl shadow-xs border border-indigo-900/60 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-600 text-white rounded-lg shadow-inner flex items-center justify-center">
              <Flame className="w-4 h-4 animate-pulse text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black tracking-tight text-white uppercase">
                  Complexity Heatmap
                </h4>
                <span className="font-mono text-[9px] bg-rose-500/30 text-rose-200 border border-rose-400/40 px-1.5 py-0.2 rounded font-bold">
                  Blast Radius AI
                </span>
              </div>
              <p className="text-[10px] text-indigo-200 mt-0.5 leading-snug">
                Color-codes dependency tree nodes by downstream queries affected.
              </p>
            </div>
          </div>

          {/* Quick Protect Button */}
          {telemetry.criticalCount > 0 && (
            <button
              type="button"
              id="btn-protect-all-high-risk"
              data-testid="btn-protect-all-high-risk"
              onClick={handleProtectAllHighRisk}
              disabled={telemetry.allCriticalProtected}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer ${
                telemetry.allCriticalProtected
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 cursor-default'
                  : 'bg-rose-600 hover:bg-rose-500 text-white hover:scale-[1.02]'
              }`}
              title="Locks all high-risk indexes (5+ downstream queries) to prevent accidental dropping in migrations"
            >
              {telemetry.allCriticalProtected ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>All High-Risk Protected</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3 text-amber-300" />
                  <span>Protect {telemetry.criticalCount - telemetry.lockedHighRiskCount} High-Risk</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 4-Stat Metric Strip */}
        <div className="grid grid-cols-4 gap-1.5 text-center pt-1 border-t border-indigo-900/60 font-mono text-[10px]">
          <div className="bg-indigo-950/60 p-1.5 rounded-lg border border-indigo-800/40">
            <span className="text-[9px] text-zinc-400 block font-sans">High-Risk</span>
            <span id="metric-high-risk-indexes" className="font-bold text-rose-400 text-xs">
              {telemetry.criticalCount}
            </span>
          </div>
          <div className="bg-indigo-950/60 p-1.5 rounded-lg border border-indigo-800/40">
            <span className="text-[9px] text-zinc-400 block font-sans">Elevated</span>
            <span className="font-bold text-amber-400 text-xs">
              {telemetry.elevatedCount}
            </span>
          </div>
          <div className="bg-indigo-950/60 p-1.5 rounded-lg border border-indigo-800/40">
            <span className="text-[9px] text-zinc-400 block font-sans">Low-Risk</span>
            <span className="font-bold text-indigo-300 text-xs">
              {telemetry.lowCount}
            </span>
          </div>
          <div className="bg-indigo-950/60 p-1.5 rounded-lg border border-indigo-800/40">
            <span className="text-[9px] text-zinc-400 block font-sans">Queries Mapped</span>
            <span id="metric-total-queries-mapped" className="font-bold text-emerald-400 text-xs">
              {telemetry.totalQueriesMapped}
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Color Scale Legend Strip */}
      <div
        id="complexity-heatmap-legend"
        data-testid="complexity-heatmap-legend"
        className="p-2.5 bg-white rounded-xl border border-zinc-200 shadow-2xs space-y-2 text-xs"
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-zinc-800 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            <span>Heatmap Blast Radius Color Scale:</span>
          </span>
          <span className="text-[10px] text-zinc-500 italic">Click pill to filter</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setRiskFilter(riskFilter === 'critical' ? 'all' : 'critical')}
            className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
              riskFilter === 'critical'
                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400'
                : 'bg-rose-50 text-rose-950 border-rose-300 hover:bg-rose-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600 inline-block shrink-0" />
                Critical (5+)
              </span>
              <span className={`font-mono text-[10px] px-1 rounded font-bold ${riskFilter === 'critical' ? 'bg-white text-rose-900' : 'bg-rose-200 text-rose-900'}`}>
                {telemetry.criticalCount}
              </span>
            </div>
            <div className={`text-[9px] mt-0.5 truncate ${riskFilter === 'critical' ? 'text-rose-100' : 'text-rose-800'}`}>
              Severe blast radius
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRiskFilter(riskFilter === 'elevated' ? 'all' : 'elevated')}
            className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
              riskFilter === 'elevated'
                ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300'
                : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                Elevated (3-4)
              </span>
              <span className={`font-mono text-[10px] px-1 rounded font-bold ${riskFilter === 'elevated' ? 'bg-white text-amber-900' : 'bg-amber-200 text-amber-900'}`}>
                {telemetry.elevatedCount}
              </span>
            </div>
            <div className={`text-[9px] mt-0.5 truncate ${riskFilter === 'elevated' ? 'text-amber-100' : 'text-amber-800'}`}>
              Sort buffer spill
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRiskFilter(riskFilter === 'low' ? 'all' : 'low')}
            className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
              riskFilter === 'low'
                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
                : 'bg-indigo-50 text-indigo-950 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block shrink-0" />
                Low (1-2)
              </span>
              <span className={`font-mono text-[10px] px-1 rounded font-bold ${riskFilter === 'low' ? 'bg-white text-indigo-900' : 'bg-indigo-200 text-indigo-900'}`}>
                {telemetry.lowCount}
              </span>
            </div>
            <div className={`text-[9px] mt-0.5 truncate ${riskFilter === 'low' ? 'text-indigo-100' : 'text-indigo-700'}`}>
              Isolated queries
            </div>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            id="input-complexity-heatmap-search"
            data-testid="input-complexity-heatmap-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search indexes, tables, or queries..."
            className="w-full bg-white border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[10px] text-zinc-400 hover:text-zinc-700 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 flex-wrap text-xs">
          {/* Table Filter Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {['all', 'transactions', 'line_items', 'customers'].map((tbl) => (
              <button
                key={tbl}
                type="button"
                onClick={() => setTableFilter(tbl)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  tableFilter === tbl
                    ? 'bg-zinc-800 text-white shadow-2xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                }`}
              >
                {tbl === 'all' ? 'All Tables' : tbl}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-zinc-500">Sort:</span>
            <select
              id="select-complexity-sort"
              data-testid="select-complexity-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-zinc-200 text-zinc-800 text-[10px] font-medium rounded-md px-1.5 py-0.5 focus:outline-hidden cursor-pointer"
            >
              <option value="queries-desc">Queries (Highest Blast Radius)</option>
              <option value="queries-asc">Queries (Lowest / Pruning Candidates)</option>
              <option value="name-asc">Index Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tree Expand / Collapse All Controls */}
        <div className="flex items-center justify-between text-[11px] px-1 text-zinc-500 pt-0.5">
          <span>
            Showing <strong>{filteredNodes.length}</strong> of {treeNodes.length} dependency nodes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-expand-all-tree"
              onClick={() => toggleAllNodes(true)}
              className="text-[10px] text-indigo-600 hover:underline cursor-pointer font-semibold"
            >
              Expand All
            </button>
            <span>•</span>
            <button
              type="button"
              id="btn-collapse-all-tree"
              onClick={() => toggleAllNodes(false)}
              className="text-[10px] text-zinc-500 hover:underline cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Dependency Tree Nodes (Color-Coded Heatmap List) */}
      <div className="space-y-3 pr-0.5 max-h-[620px] overflow-y-auto">
        {filteredNodes.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl border border-zinc-200 text-zinc-500 space-y-2">
            <Info className="w-5 h-5 mx-auto text-zinc-400" />
            <div className="text-xs font-bold text-zinc-700">No matching dependency nodes</div>
            <p className="text-[11px]">Adjust your filter or search query to view dependency tree nodes.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRiskFilter('all');
                setTableFilter('all');
              }}
              className="text-xs text-indigo-600 hover:underline font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isExpanded = !!expandedNodes[node.indexName];
            const styles = getNodeHeatmapStyles(node.riskCategory, node.isRemoved);
            const isSimulating = activeSimulationIndex === node.indexName;

            return (
              <div
                key={node.indexName}
                id={`heatmap-node-${node.indexName}`}
                data-testid={`heatmap-node-${node.indexName}`}
                className={`rounded-xl border transition-all text-xs overflow-hidden ${styles.cardBg}`}
              >
                {/* Tree Node Root Header */}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {/* Node Expand Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNodes((prev) => ({
                            ...prev,
                            [node.indexName]: !prev[node.indexName]
                          }))
                        }
                        className="p-1 rounded hover:bg-black/5 text-zinc-600 cursor-pointer mt-0.5 transition-colors shrink-0"
                        title={isExpanded ? 'Collapse downstream queries' : 'Expand downstream queries'}
                        aria-label="Toggle node expansion"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`w-2.5 h-2.5 rounded-full ${styles.dotColor} shrink-0`} />
                          <span
                            className={`font-mono text-xs truncate ${styles.titleColor}`}
                            title={node.indexName}
                          >
                            {node.indexName}
                          </span>

                          {/* Table Badge */}
                          <span className="font-mono text-[9px] bg-white/80 text-zinc-700 px-1.5 py-0.2 rounded font-semibold border border-zinc-200 shrink-0">
                            {node.targetTable}
                          </span>

                          {/* Clustered badge */}
                          {node.isClustered && (
                            <span className="font-mono text-[9px] bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded font-bold shrink-0">
                              Clustered
                            </span>
                          )}

                          {/* Locked Badge */}
                          {node.isLocked && (
                            <span className="font-mono text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 shrink-0">
                              <Lock className="w-2.5 h-2.5 text-amber-700" />
                              LOCKED
                            </span>
                          )}

                          {/* Removed Badge */}
                          {node.isRemoved && (
                            <span className="font-mono text-[9px] bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                              PRUNED
                            </span>
                          )}
                        </div>

                        {/* Columns & Type */}
                        <div className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{node.type}</span>
                          <span>•</span>
                          <span className="font-mono text-[9.5px] bg-white/60 px-1 rounded border border-zinc-200">
                            [{node.columns.join(', ')}]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Downstream Queries Affected Badge (The Heatmap Focal Point) */}
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        id={`badge-queries-count-${node.indexName}`}
                        data-testid={`badge-queries-count-${node.indexName}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${styles.badgeBg}`}
                        title={`${node.totalQueriesAffected} downstream queries rely directly or indirectly on this index`}
                      >
                        {node.riskCategory === 'critical' ? (
                          <Flame className="w-3 h-3 text-amber-300 fill-current animate-pulse" />
                        ) : node.riskCategory === 'elevated' ? (
                          <AlertTriangle className="w-3 h-3 text-white" />
                        ) : (
                          <Activity className="w-3 h-3 text-white" />
                        )}
                        <span>
                          {node.totalQueriesAffected} {node.totalQueriesAffected === 1 ? 'Query' : 'Queries'}
                        </span>
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">
                        {node.riskCategory === 'critical'
                          ? 'Critical Risk'
                          : node.riskCategory === 'elevated'
                          ? 'Elevated Risk'
                          : node.riskCategory === 'low'
                          ? 'Low Risk'
                          : 'Safe to Prune'}
                      </span>
                    </div>
                  </div>

                  {/* Removal Impact Consequence Summary */}
                  <div className="p-2 bg-white/80 rounded-lg border border-zinc-200/80 text-[11px] leading-relaxed text-zinc-700">
                    <strong className="text-zinc-900 block font-semibold mb-0.5 flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Downstream Blast Radius Consequence:</span>
                    </strong>
                    <span className="text-zinc-600">{node.removalImpactSummary}</span>
                  </div>

                  {/* Node Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5">
                    <div className="flex items-center gap-1.5">
                      {/* Lock / Protect Toggle Button */}
                      <button
                        type="button"
                        id={`btn-lock-${node.indexName}`}
                        data-testid={`btn-lock-${node.indexName}`}
                        onClick={() => onToggleLockIndex(node.indexName)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                          node.isLocked
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                            : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                        }`}
                        title={
                          node.isLocked
                            ? 'Unlock index (allows pruning or schema mutations)'
                            : 'Lock index against accidental pruning or removal'
                        }
                      >
                        {node.isLocked ? (
                          <>
                            <Unlock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Unlock</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5 text-zinc-500" />
                            <span>Lock Index</span>
                          </>
                        )}
                      </button>

                      {/* Simulate Drop / Prune Toggle */}
                      {!node.isClustered && (
                        <button
                          type="button"
                          id={`btn-simulate-drop-${node.indexName}`}
                          data-testid={`btn-simulate-drop-${node.indexName}`}
                          onClick={() => {
                            if (node.isRemoved) {
                              onRestoreIndex(node.indexName);
                            } else {
                              onRemoveIndex(node.indexName);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                            node.isRemoved
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                          title={
                            node.isRemoved
                              ? 'Restore this index to the active schema'
                              : 'Simulate dropping this index to inspect query plan degradation'
                          }
                        >
                          {node.isRemoved ? (
                            <>
                              <RefreshCw className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-2.5 h-2.5 text-rose-600" />
                              <span>Simulate Drop</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNodes((prev) => ({
                          ...prev,
                          [node.indexName]: !prev[node.indexName]
                        }))
                      }
                      className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>{isExpanded ? 'Hide Queries' : `Inspect ${node.totalQueriesAffected} Queries`}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Downstream Query Tree Hierarchy */}
                {isExpanded && (
                  <div
                    id={`tree-branch-${node.indexName}`}
                    data-testid={`tree-branch-${node.indexName}`}
                    className="p-3 bg-white/95 border-t border-zinc-200/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider pb-1 border-b border-zinc-100">
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-indigo-600" />
                        <span>Downstream Query Dependency Nodes ({node.downstreamQueries.length})</span>
                      </span>
                      <span>Latency Blast Radius</span>
                    </div>

                    <div className="space-y-2 pt-0.5">
                      {node.downstreamQueries.map((query, qIdx) => {
                        const edgeKey = `${node.indexName}-${query.id}`;
                        const isEdgeDisabled = !!disabledQueryEdges[edgeKey];
                        const slowdownMultiplier = (query.latencyWithoutIndexMs / query.latencyWithIndexMs).toFixed(0);

                        return (
                          <div
                            key={query.id}
                            className={`p-2.5 rounded-lg border transition-all space-y-1.5 ${
                              isEdgeDisabled
                                ? 'bg-zinc-100/70 border-zinc-200 opacity-60'
                                : query.criticality === 'critical'
                                ? 'bg-rose-50/60 border-rose-200'
                                : query.criticality === 'high'
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-zinc-50 border-zinc-200/80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] text-zinc-400">
                                    {qIdx === node.downstreamQueries.length - 1 ? '└─' : '├─'}
                                  </span>
                                  <strong className={`font-medium text-xs ${isEdgeDisabled ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                                    {query.name}
                                  </strong>
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white text-zinc-700 border border-zinc-200 font-semibold">
                                    {query.queryType}
                                  </span>
                                  <span className="text-[9px] font-mono text-zinc-500">
                                    ~{query.frequencyPerHour.toLocaleString()} calls/hr
                                  </span>
                                </div>
                              </div>

                              {/* Latency Comparison Tag */}
                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                    isEdgeDisabled
                                      ? 'bg-zinc-200 text-zinc-500 border-zinc-300'
                                      : query.latencyWithoutIndexMs > 500
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                      : query.latencyWithoutIndexMs > 250
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  {isEdgeDisabled
                                    ? 'Edge Bypassed'
                                    : `${query.latencyWithIndexMs}ms → ${query.latencyWithoutIndexMs}ms (+${slowdownMultiplier}x)`}
                                </span>
                              </div>
                            </div>

                            {/* SQL Pattern snippet */}
                            <div className="p-1.5 bg-zinc-900 text-indigo-200 rounded font-mono text-[10px] overflow-x-auto border border-zinc-800">
                              {query.sqlPattern}
                            </div>

                            {/* Consequence text */}
                            <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-0.5">
                              <span className="text-rose-900 font-medium truncate max-w-[280px]">
                                ⚠ {query.consequence}
                              </span>

                              {/* Edge Toggle */}
                              <label className="inline-flex items-center gap-1 cursor-pointer shrink-0" title="Simulate bypassing this specific downstream edge">
                                <span className="text-[9px] text-zinc-400">Edge:</span>
                                <input
                                  type="checkbox"
                                  checked={!isEdgeDisabled}
                                  onChange={() =>
                                    setDisabledQueryEdges((prev) => ({
                                      ...prev,
                                      [edgeKey]: !isEdgeDisabled
                                    }))
                                  }
                                  className="w-3 h-3 rounded accent-indigo-600 cursor-pointer"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
