import {
  TransactionRecord,
  OrderItem,
  OptimizationFlags,
  QueryExecutionResult,
  ExplainPlanNode,
  OrderStatus,
  ProductCategory,
  CustomerTier,
  BulkImportOptions,
  BulkImportResult,
  BulkImportProgress,
  DatabaseStats,
  DatabaseUpdateEvent,
  DatabaseMutationHistoryEntry
} from '../types';

// Event bus for notifying external auditing / Queue Auto-Save subscribers
type DatabaseUpdateListener = (event: DatabaseUpdateEvent) => void;
const DATABASE_UPDATE_LISTENERS = new Set<DatabaseUpdateListener>();

export function subscribeDatabaseUpdate(listener: DatabaseUpdateListener): () => void {
  DATABASE_UPDATE_LISTENERS.add(listener);
  return () => {
    DATABASE_UPDATE_LISTENERS.delete(listener);
  };
}

export function notifyDatabaseUpdate(event: DatabaseUpdateEvent): void {
  DATABASE_UPDATE_LISTENERS.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('Error dispatching database update event:', err);
    }
  });
}

// Event bus for LRU cache invalidations caused by database mutations
export type CacheInvalidationListener = (reason?: string, lastRefreshedAt?: number) => void;
const CACHE_INVALIDATION_LISTENERS = new Set<CacheInvalidationListener>();
let LAST_CACHE_REFRESH_TIMESTAMP: number = Date.now();

export function getLastCacheRefreshTimestamp(): number {
  return LAST_CACHE_REFRESH_TIMESTAMP;
}

export function subscribeCacheInvalidation(listener: CacheInvalidationListener): () => void {
  CACHE_INVALIDATION_LISTENERS.add(listener);
  return () => {
    CACHE_INVALIDATION_LISTENERS.delete(listener);
  };
}

export function notifyCacheInvalidation(reason?: string, lastRefreshedAt?: number): void {
  const refreshTime = lastRefreshedAt ?? LAST_CACHE_REFRESH_TIMESTAMP;
  CACHE_INVALIDATION_LISTENERS.forEach((listener) => {
    try {
      listener(reason, refreshTime);
    } catch (err) {
      console.error('Error dispatching cache invalidation event:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('db:cache-invalidated', {
        detail: {
          reason: reason || 'database_mutation',
          lastRefreshedAt: refreshTime,
          timestamp: Date.now()
        }
      })
    );
  }
}

// In-Flight Database Mutation State Tracking & Consistency Lock Bus
export interface InFlightMutationState {
  id: string;
  type: string;
  description: string;
  startedAt: number;
  targetRows?: number;
  estimatedDurationMs?: number;
}

export type MutationStateListener = (
  isMutating: boolean,
  activeMutation: InFlightMutationState | null,
  pendingCount: number,
  allPending: InFlightMutationState[]
) => void;

const MUTATION_STATE_LISTENERS = new Set<MutationStateListener>();
const ACTIVE_IN_FLIGHT_MUTATIONS = new Map<string, InFlightMutationState>();

export function isDatabaseMutating(): boolean {
  return ACTIVE_IN_FLIGHT_MUTATIONS.size > 0;
}

export function getActivePendingMutationsCount(): number {
  return ACTIVE_IN_FLIGHT_MUTATIONS.size;
}

export function getActiveInFlightMutation(): InFlightMutationState | null {
  if (ACTIVE_IN_FLIGHT_MUTATIONS.size === 0) return null;
  const values = Array.from(ACTIVE_IN_FLIGHT_MUTATIONS.values());
  return values[values.length - 1];
}

export function getAllActiveInFlightMutations(): InFlightMutationState[] {
  return Array.from(ACTIVE_IN_FLIGHT_MUTATIONS.values());
}

export function subscribeMutationState(listener: MutationStateListener): () => void {
  MUTATION_STATE_LISTENERS.add(listener);
  const pending = Array.from(ACTIVE_IN_FLIGHT_MUTATIONS.values());
  const active = pending.length > 0 ? pending[pending.length - 1] : null;
  try {
    listener(pending.length > 0, active, pending.length, pending);
  } catch (err) {
    console.error('Error delivering initial mutation state:', err);
  }
  return () => {
    MUTATION_STATE_LISTENERS.delete(listener);
  };
}

export function notifyMutationState(): void {
  const pending = Array.from(ACTIVE_IN_FLIGHT_MUTATIONS.values());
  const isMutating = pending.length > 0;
  const active = isMutating ? pending[pending.length - 1] : null;
  const count = pending.length;

  MUTATION_STATE_LISTENERS.forEach((listener) => {
    try {
      listener(isMutating, active, count, pending);
    } catch (err) {
      console.error('Error dispatching mutation state event:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('db:mutation-state-change', {
        detail: {
          isMutating,
          activeMutation: active,
          pendingCount: count,
          allPending: pending
        }
      })
    );
  }
}

// History of executed and in-flight mutation events for telemetry and frequency analysis
const MUTATION_HISTORY_LOG: DatabaseMutationHistoryEntry[] = [
  // Seed mutation events corresponding to the seed bulk ingestion spike (seed-3 at now - 36s)
  {
    id: 'seed-mut-1',
    type: 'bulk_ingestion',
    description: 'Bulk Ingest Catalog Sync (120 rows)',
    startedAt: Date.now() - 36000,
    completedAt: Date.now() - 30200,
    targetRows: 120,
    durationMs: 5800
  },
  {
    id: 'seed-mut-2',
    type: 'status_transition',
    description: 'Batch Status Transition (50 orders in-flight)',
    startedAt: Date.now() - 37500,
    completedAt: Date.now() - 35100,
    targetRows: 50,
    durationMs: 2400
  },
  {
    id: 'seed-mut-3',
    type: 'high_risk_flag',
    description: 'High-Risk Audit Flag Update (50 orders)',
    startedAt: Date.now() - 34000,
    completedAt: Date.now() - 32000,
    targetRows: 50,
    durationMs: 2000
  },
  {
    id: 'seed-mut-4',
    type: 'bulk_ingestion',
    description: 'Live Ingest Append (+50 orders)',
    startedAt: Date.now() - 38000,
    completedAt: Date.now() - 36200,
    targetRows: 50,
    durationMs: 1800
  }
];

export function getDatabaseMutationHistory(): DatabaseMutationHistoryEntry[] {
  return [...MUTATION_HISTORY_LOG];
}

export function recordDatabaseMutationEvent(entry: DatabaseMutationHistoryEntry): void {
  MUTATION_HISTORY_LOG.push(entry);
  if (MUTATION_HISTORY_LOG.length > 200) {
    MUTATION_HISTORY_LOG.splice(0, MUTATION_HISTORY_LOG.length - 200);
  }
}

export function beginDatabaseMutation(
  type: string,
  description: string,
  targetRows?: number,
  estimatedDurationMs?: number
): () => void {
  const mutationId = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // Default estimated duration based on operation complexity (e.g. bulk ingest ~3.5s, batch status ~2.5s)
  const defaultDuration =
    estimatedDurationMs ||
    (type === 'bulk_ingestion' ? 3500 : type === 'status_transition' ? 2400 : 2000);

  const mutationObj: InFlightMutationState = {
    id: mutationId,
    type,
    description,
    startedAt: Date.now(),
    targetRows,
    estimatedDurationMs: defaultDuration
  };

  const historyEntry: DatabaseMutationHistoryEntry = {
    id: mutationId,
    type,
    description,
    startedAt: Date.now(),
    targetRows,
    durationMs: defaultDuration
  };
  recordDatabaseMutationEvent(historyEntry);

  ACTIVE_IN_FLIGHT_MUTATIONS.set(mutationId, mutationObj);
  notifyMutationState();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    historyEntry.completedAt = Date.now();
    historyEntry.durationMs = historyEntry.completedAt - historyEntry.startedAt;
    ACTIVE_IN_FLIGHT_MUTATIONS.delete(mutationId);
    notifyMutationState();
  };
}

// Deterministic seed data generator for 50,000 realistic records
const CATEGORIES: ProductCategory[] = [
  'Cloud Infrastructure',
  'Enterprise License',
  'Security Audit',
  'Database Cluster',
  'AI Inference'
];

const STATUSES: OrderStatus[] = ['completed', 'processing', 'flagged', 'failed'];
const TIERS: CustomerTier[] = ['Platinum', 'Gold', 'Silver', 'Standard'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1', 'sa-east-1'];

const COMPANIES = [
  'Acme Corp', 'Starlight Tech', 'Nexus Dynamics', 'Vanguard Systems',
  'OmniCorp Global', 'Apex Logistics', 'Hyperion Data', 'Crestline AI',
  'Pulse Health', 'Quantum Solutions', 'Vector Labs', 'Sovereign Capital'
];

const PRODUCTS = [
  { name: 'Distributed Postgres Shard', sku: 'PG-SHARD-01', price: 1250 },
  { name: 'GPU Cluster Hours (A100)', sku: 'GPU-A100-HR', price: 850 },
  { name: 'SOC-2 Compliance Scanner', sku: 'SOC2-SCAN', price: 420 },
  { name: 'Zero-Trust Mesh Gateway', sku: 'ZT-GW-X', price: 980 },
  { name: 'Multi-Region Read Replica', sku: 'DB-REPLICA-MR', price: 650 },
  { name: 'Real-time Telemetry Streamer', sku: 'TEL-STM-PRO', price: 340 }
];

// Pre-generated database memory store
let DB_RECORDS: TransactionRecord[] = [];
let DB_ITEMS_MAP = new Map<string, OrderItem[]>();

// Secondary B-Tree-like Indexes
let INDEX_STATUS_CATEGORY = new Map<string, number[]>();
let INDEX_CUSTOMER = new Map<string, number[]>();

// Synchronization state for secondary indexes
let IS_INDEX_SYNCHRONIZED = true;
let LAST_BULK_IMPORT_RESULT: BulkImportResult | null = null;

// In-Memory LRU Cache
const QUERY_CACHE = new Map<string, { result: QueryExecutionResult; timestamp: number }>();
const MAX_CACHE_SIZE = 50;

export function initializeDatabase() {
  if (DB_RECORDS.length > 0) return;

  const totalRecords = 50000;
  const records: TransactionRecord[] = new Array(totalRecords);

  for (let i = 0; i < totalRecords; i++) {
    const id = `rec_${i + 1}`;
    const company = COMPANIES[i % COMPANIES.length];
    const customerId = `cust_${(i % 450) + 1}`;
    const category = CATEGORIES[i % CATEGORIES.length];
    const status = STATUSES[(i * 7 + 3) % STATUSES.length];
    const tier = TIERS[(i * 3) % TIERS.length];
    const region = REGIONS[(i * 2) % REGIONS.length];
    const baseAmount = 300 + ((i * 137) % 18500);
    const dateOffsetDays = (i % 365);
    const date = new Date(Date.now() - dateOffsetDays * 86400000);

    const itemCount = 1 + (i % 4);
    const orderItems: OrderItem[] = [];
    for (let j = 0; j < itemCount; j++) {
      const prod = PRODUCTS[(i + j) % PRODUCTS.length];
      orderItems.push({
        id: `item_${i}_${j}`,
        name: prod.name,
        sku: prod.sku,
        unitPrice: prod.price,
        quantity: 1 + (j % 3)
      });
    }

    DB_ITEMS_MAP.set(id, orderItems);

    records[i] = {
      id,
      orderNumber: `ORD-${100000 + i}`,
      customerId,
      customerName: `${company} #${(i % 12) + 1}`,
      customerEmail: `billing@${company.toLowerCase().replace(/\s+/g, '')}.io`,
      customerTier: tier,
      status,
      category,
      amount: baseAmount,
      itemCount,
      region,
      createdAt: date.toISOString().split('T')[0]
    };

    // Populate Secondary Indexes
    const statusCatKey = `${status}::${category}`;
    const list = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
    list.push(i);
    INDEX_STATUS_CATEGORY.set(statusCatKey, list);

    const custList = INDEX_CUSTOMER.get(customerId) || [];
    custList.push(i);
    INDEX_CUSTOMER.set(customerId, custList);
  }

  DB_RECORDS = records;
}

export interface QueryFilters {
  searchTerm?: string;
  status?: OrderStatus | 'all';
  category?: ProductCategory | 'all';
  page: number;
  pageSize: number;
}

export function executeQuery(
  filters: QueryFilters,
  flags: OptimizationFlags
): QueryExecutionResult {
  initializeDatabase();

  const cacheKey = JSON.stringify({ filters, flags });

  // 1. Query Caching Check
  if (flags.queryCaching) {
    const cached = QUERY_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return {
        ...cached.result,
        cacheHit: true,
        executionTimeMs: 0.15,
        explainPlan: {
          nodeType: 'LRU Cache Lookup',
          relationName: 'query_cache_lru',
          cost: 0.01,
          actualTimeMs: 0.15,
          rowsScanned: 0,
          rowsReturned: cached.result.records.length,
          details: `Instant hash hit for key [${cacheKey.slice(0, 30)}...] with zero disk/memory traversal.`
        }
      };
    }
  }

  const startTime = performance.now();
  let rowsScanned = 0;
  let matchingIndices: number[] = [];
  let indexUsed: string | null = null;
  let simulatedError: string | null = null;
  let warningNotice: string | null = null;

  const { searchTerm, status, category, page, pageSize } = filters;
  const hasStatus = status && status !== 'all';
  const hasCategory = category && category !== 'all';

  // 2. B-Tree Indexing vs Full Table Scan
  const canUseBTree = flags.btreeIndexing && hasStatus && hasCategory;

  if (canUseBTree && IS_INDEX_SYNCHRONIZED) {
    indexUsed = 'idx_orders_status_category (B-Tree)';
    const key = `${status}::${category}`;
    const candidateIndices = INDEX_STATUS_CATEGORY.get(key) || [];
    rowsScanned = candidateIndices.length;

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      for (const idx of candidateIndices) {
        const r = DB_RECORDS[idx];
        if (
          r.orderNumber.toLowerCase().includes(term) ||
          r.customerName.toLowerCase().includes(term) ||
          r.customerEmail.toLowerCase().includes(term)
        ) {
          matchingIndices.push(idx);
        }
      }
    } else {
      matchingIndices = candidateIndices;
    }
  } else {
    // UNOPTIMIZED / OUT-OF-SYNC: Full sequential table scan across all records
    indexUsed = null;
    rowsScanned = DB_RECORDS.length;

    // Artificial CPU stall to model unindexed sequential memory scan overhead in databases
    const term = searchTerm ? searchTerm.toLowerCase().trim() : '';
    for (let i = 0; i < DB_RECORDS.length; i++) {
      const r = DB_RECORDS[i];
      const matchStatus = !hasStatus || r.status === status;
      const matchCat = !hasCategory || r.category === category;
      const matchTerm =
        !term ||
        r.orderNumber.toLowerCase().includes(term) ||
        r.customerName.toLowerCase().includes(term) ||
        r.customerEmail.toLowerCase().includes(term);

      if (matchStatus && matchCat && matchTerm) {
        matchingIndices.push(i);
      }
    }

    if (canUseBTree && !IS_INDEX_SYNCHRONIZED) {
      warningNotice = `Index Invalidation: Secondary B-Tree index is OUT-OF-SYNC following raw bulk load. Planner forced Seq Scan across all ${DB_RECORDS.length.toLocaleString()} rows. Run REINDEX to restore index acceleration.`;
    } else if (!flags.btreeIndexing) {
      warningNotice = `Warning: Unindexed Seq Scan evaluated all ${DB_RECORDS.length.toLocaleString()} rows in memory. High I/O overhead.`;
    }
  }

  // Calculate slice pagination
  const totalCount = matchingIndices.length;
  const offset = (page - 1) * pageSize;
  const pagedIndices = matchingIndices.slice(offset, offset + pageSize);

  // 3. N+1 Query Resolution vs N+1 Storm
  let activeQueriesCount = 1; // Base query
  const records: TransactionRecord[] = [];

  if (!flags.batchEagerLoading) {
    // UNOPTIMIZED: N+1 query problem!
    // Fires an individual query for every retrieved parent record to fetch line items
    activeQueriesCount += pagedIndices.length;

    if (activeQueriesCount > 40) {
      simulatedError = `Database Connection Pool Timeout: max_connections (25) exceeded due to ${activeQueriesCount} unbatched synchronous queries!`;
    }

    // Emulate N+1 latency: each subquery adds latency
    for (const idx of pagedIndices) {
      const baseRec = DB_RECORDS[idx];
      const items = DB_ITEMS_MAP.get(baseRec.id) || [];
      records.push({
        ...baseRec,
        items
      });
    }
  } else {
    // OPTIMIZED: Batch Eager Loading with pre-indexed single IN-clause join
    activeQueriesCount = 2; // 1 for orders, 1 batch join for all items
    for (const idx of pagedIndices) {
      const baseRec = DB_RECORDS[idx];
      const items = DB_ITEMS_MAP.get(baseRec.id) || [];
      records.push({
        ...baseRec,
        items
      });
    }
  }

  const rawEndTime = performance.now();
  let executionTimeMs = rawEndTime - startTime;

  // Add realistic simulated database network delay if unoptimized
  if (!flags.batchEagerLoading) {
    executionTimeMs += activeQueriesCount * 4.2; // 4.2ms roundtrip per unbatched query
  }
  if (!flags.btreeIndexing || !IS_INDEX_SYNCHRONIZED) {
    // Seq scan penalty scales proportionally with heap size (50,000 baseline = 48.5ms)
    const heapScale = DB_RECORDS.length / 50000;
    executionTimeMs += 48.5 * heapScale;
  }

  // Format Explain Plan Node
  const isIndexedScan = flags.btreeIndexing && IS_INDEX_SYNCHRONIZED && hasStatus && hasCategory;

  const explainPlan: ExplainPlanNode = isIndexedScan
    ? {
        nodeType: 'Index Scan',
        relationName: 'transactions',
        indexName: 'idx_orders_status_category',
        cost: 4.82,
        actualTimeMs: Number(executionTimeMs.toFixed(2)),
        rowsScanned,
        rowsReturned: records.length,
        filter: hasStatus || hasCategory ? `status = '${status}' AND category = '${category}'` : undefined,
        details: `B-Tree index hit. Bypassed ${Math.max(0, DB_RECORDS.length - rowsScanned).toLocaleString()} non-matching rows directly.`,
        subNodes: flags.batchEagerLoading
          ? [
              {
                nodeType: 'Hash Join',
                relationName: 'order_items',
                cost: 1.15,
                actualTimeMs: 0.45,
                rowsScanned: records.length * 3,
                rowsReturned: records.length * 3,
                details: 'Batch eager load using WHERE order_id IN (...) in a single efficient query.'
              }
            ]
          : [
              {
                nodeType: 'Nested Loop',
                relationName: 'order_items',
                cost: 145.2,
                actualTimeMs: Number((activeQueriesCount * 4.2).toFixed(2)),
                rowsScanned: activeQueriesCount * 12,
                rowsReturned: records.length * 3,
                details: `N+1 Query Cascade: Fired ${activeQueriesCount - 1} individual synchronous subqueries.`
              }
            ]
      }
    : {
        nodeType: 'Seq Scan',
        relationName: 'transactions',
        cost: 2840.0 * (DB_RECORDS.length / 50000),
        actualTimeMs: Number(executionTimeMs.toFixed(2)),
        rowsScanned,
        rowsReturned: records.length,
        filter: !IS_INDEX_SYNCHRONIZED && flags.btreeIndexing
          ? 'Index out-of-sync: Sequential scan fallback across entire heap'
          : 'Full table sequential scan without index lookup',
        details: `Full table sequential scan: Inspected all ${DB_RECORDS.length.toLocaleString()} rows across database storage.`,
        subNodes: !flags.batchEagerLoading
          ? [
              {
                nodeType: 'Nested Loop',
                relationName: 'order_items',
                cost: 2400.0,
                actualTimeMs: Number((activeQueriesCount * 4.2).toFixed(2)),
                rowsScanned: activeQueriesCount * 25,
                rowsReturned: records.length * 3,
                details: `N+1 Query Bottleneck: ${activeQueriesCount} separate connections opened sequentially.`
              }
            ]
          : undefined
      };

  const result: QueryExecutionResult = {
    records,
    totalCount,
    page,
    pageSize,
    executionTimeMs: Number(executionTimeMs.toFixed(2)),
    rowsScanned,
    cacheHit: false,
    indexUsed,
    explainPlan,
    activeQueriesCount,
    simulatedError,
    warningNotice
  };

  if (flags.queryCaching) {
    if (QUERY_CACHE.size >= MAX_CACHE_SIZE) {
      const firstKey = QUERY_CACHE.keys().next().value;
      if (firstKey) QUERY_CACHE.delete(firstKey);
    }
    LAST_CACHE_REFRESH_TIMESTAMP = Date.now();
    QUERY_CACHE.set(cacheKey, { result, timestamp: LAST_CACHE_REFRESH_TIMESTAMP });
  }

  return result;
}

export function clearDatabaseCache(reason?: string) {
  const previousRefreshTime = LAST_CACHE_REFRESH_TIMESTAMP;
  QUERY_CACHE.clear();
  notifyCacheInvalidation(reason, previousRefreshTime);
}

/**
 * Returns current database runtime telemetry stats
 */
export function getDatabaseStats(): DatabaseStats {
  initializeDatabase();
  return {
    totalRecords: DB_RECORDS.length,
    indexStatusCategorySize: INDEX_STATUS_CATEGORY.size,
    indexCustomerSize: INDEX_CUSTOMER.size,
    isIndexSynchronized: IS_INDEX_SYNCHRONIZED,
    cacheSize: QUERY_CACHE.size
  };
}

export function getLastBulkImportResult(): BulkImportResult | null {
  return LAST_BULK_IMPORT_RESULT;
}

/**
 * Executes a simulated large-scale data ingestion event.
 * Demonstrates the write-amplification vs query latency trade-off:
 * - realtime_indexed: synchronously updates B-Tree nodes, splits pages, invalidates cache; read queries stay <2ms immediately.
 * - raw_bulk_unindexed: fast heap write, but leaves indexes stale, forcing Seq Scans until explicit REINDEX.
 * - single_row_unbatched: simulates row-by-row transaction commits, showing connection/lock overhead.
 */
export async function performBulkDataImport(
  options: BulkImportOptions,
  onProgress?: (p: BulkImportProgress) => void
): Promise<BulkImportResult> {
  initializeDatabase();

  const { recordCount, mode, chunkSize = 500 } = options;
  const releaseMutation = beginDatabaseMutation(
    'bulk_ingestion',
    `Bulk Data Ingestion (${recordCount.toLocaleString()} rows, ${mode === 'raw_bulk_unindexed' ? 'Unindexed' : 'Indexed'})`,
    recordCount
  );

  try {
    const startCount = DB_RECORDS.length;
    const targetTotal = startCount + recordCount;

  // Probe read query latency BEFORE ingestion (with indexing active and cache off for clean baseline)
  const probeFilters: QueryFilters = {
    searchTerm: '',
    status: 'completed',
    category: 'Cloud Infrastructure',
    page: 1,
    pageSize: 100
  };
  const testFlags: OptimizationFlags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: false,
    virtualizedDOM: true,
    deferredRendering: true
  };
  const preProbe = executeQuery(probeFilters, testFlags);
  const readQueryLatencyBeforeMs = preProbe.executionTimeMs;

  onProgress?.({
    currentCount: 0,
    totalTarget: recordCount,
    percent: 0,
    elapsedMs: 0,
    currentThroughputRowsPerSec: 0,
    pageSplitsCount: 0,
    cacheInvalidated: false,
    phase: 'preparing'
  });

  const startTime = performance.now();
  let totalHeapWriteTime = 0;
  let totalIndexMaintenanceTime = 0;
  let totalWalTime = 0;
  let simulatedPageSplits = 0;

  // Ingestion loop processed in batches
  const batches = Math.ceil(recordCount / chunkSize);

  for (let b = 0; b < batches; b++) {
    const currentBatchStart = b * chunkSize;
    const currentBatchSize = Math.min(chunkSize, recordCount - currentBatchStart);
    const batchAbsoluteStart = startCount + currentBatchStart;

    const batchStartTime = performance.now();

    for (let i = 0; i < currentBatchSize; i++) {
      const globalIdx = batchAbsoluteStart + i;
      const id = `rec_${globalIdx + 1}`;
      const company = COMPANIES[globalIdx % COMPANIES.length];
      const customerId = `cust_${(globalIdx % 500) + 1}`;
      const category = CATEGORIES[globalIdx % CATEGORIES.length];
      const status = STATUSES[(globalIdx * 7 + 3) % STATUSES.length];
      const tier = TIERS[(globalIdx * 3) % TIERS.length];
      const region = REGIONS[(globalIdx * 2) % REGIONS.length];
      const baseAmount = 350 + ((globalIdx * 149) % 19000);
      const date = new Date(Date.now() - (globalIdx % 180) * 86400000);

      const itemCount = 1 + (globalIdx % 4);
      const orderItems: OrderItem[] = [];
      for (let j = 0; j < itemCount; j++) {
        const prod = PRODUCTS[(globalIdx + j) % PRODUCTS.length];
        orderItems.push({
          id: `item_${globalIdx}_${j}`,
          name: prod.name,
          sku: prod.sku,
          unitPrice: prod.price,
          quantity: 1 + (j % 3)
        });
      }

      DB_ITEMS_MAP.set(id, orderItems);

      const newRec: TransactionRecord = {
        id,
        orderNumber: `ORD-${100000 + globalIdx}`,
        customerId,
        customerName: `${company} [Ingested]`,
        customerEmail: `ops@${company.toLowerCase().replace(/\s+/g, '')}.io`,
        customerTier: tier,
        status,
        category,
        amount: baseAmount,
        itemCount,
        region,
        createdAt: date.toISOString().split('T')[0]
      };

      DB_RECORDS.push(newRec);

      // Mode-specific indexing behavior
      if (mode === 'realtime_indexed' || mode === 'single_row_unbatched') {
        const statusCatKey = `${status}::${category}`;
        const catList = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
        catList.push(globalIdx);
        INDEX_STATUS_CATEGORY.set(statusCatKey, catList);

        const custList = INDEX_CUSTOMER.get(customerId) || [];
        custList.push(globalIdx);
        INDEX_CUSTOMER.set(customerId, custList);
      }
    }

    // Accumulate simulated engine metrics based on architectural mode
    if (mode === 'realtime_indexed') {
      totalHeapWriteTime += currentBatchSize * 0.009;
      totalIndexMaintenanceTime += currentBatchSize * 0.027; // B-Tree leaf insertion & traversal
      totalWalTime += currentBatchSize * 0.006;
      simulatedPageSplits += Math.floor(currentBatchSize / 78);
      IS_INDEX_SYNCHRONIZED = true;
    } else if (mode === 'raw_bulk_unindexed') {
      totalHeapWriteTime += currentBatchSize * 0.008; // Raw sequential append
      totalIndexMaintenanceTime = 0;                  // Zero index maintenance!
      totalWalTime += currentBatchSize * 0.003;
      simulatedPageSplits = 0;
      IS_INDEX_SYNCHRONIZED = false;                  // Secondary index marked out-of-sync
    } else if (mode === 'single_row_unbatched') {
      totalHeapWriteTime += currentBatchSize * 0.038; // Individual autocommit overhead
      totalIndexMaintenanceTime += currentBatchSize * 0.045;
      totalWalTime += currentBatchSize * 0.026;
      simulatedPageSplits += Math.floor(currentBatchSize / 78);
      IS_INDEX_SYNCHRONIZED = true;
    }

    // Invalidate query cache upon write (prevent stale query results)
    clearDatabaseCache();

    const elapsedSoFar = performance.now() - startTime;
    const progressDone = currentBatchStart + currentBatchSize;
    const percent = Math.min(100, Math.round((progressDone / recordCount) * 100));
    const throughput = Math.round((progressDone / Math.max(0.01, elapsedSoFar / 1000)));

    onProgress?.({
      currentCount: progressDone,
      totalTarget: recordCount,
      percent,
      elapsedMs: Math.round(elapsedSoFar),
      currentThroughputRowsPerSec: throughput,
      pageSplitsCount: simulatedPageSplits,
      cacheInvalidated: true,
      phase: b === batches - 1 ? 'verifying' : 'writing_heap'
    });

    // Yield control to browser to allow live animation rendering
    await new Promise((resolve) => setTimeout(resolve, 32));
  }

  const totalDurationMs = Number((totalHeapWriteTime + totalIndexMaintenanceTime + totalWalTime).toFixed(2));

  // Probe read query latency AFTER ingestion
  const postProbe = executeQuery(probeFilters, testFlags);
  const readQueryLatencyAfterMs = postProbe.executionTimeMs;

  const result: BulkImportResult = {
    recordsAdded: recordCount,
    totalDatabaseRecords: DB_RECORDS.length,
    totalDurationMs,
    heapWriteTimeMs: Number(totalHeapWriteTime.toFixed(2)),
    indexMaintenanceTimeMs: Number(totalIndexMaintenanceTime.toFixed(2)),
    walWriteTimeMs: Number(totalWalTime.toFixed(2)),
    bTreePageSplits: simulatedPageSplits,
    indexesUpdated: mode === 'raw_bulk_unindexed' ? [] : ['idx_orders_status_category', 'idx_customer_id'],
    cacheInvalidated: true,
    rowsPerSecond: Math.round((recordCount / (totalDurationMs / 1000))),
    readQueryLatencyBeforeMs,
    readQueryLatencyAfterMs,
    mode,
    timestamp: Date.now()
  };

  LAST_BULK_IMPORT_RESULT = result;

  onProgress?.({
    currentCount: recordCount,
    totalTarget: recordCount,
    percent: 100,
    elapsedMs: Math.round(totalDurationMs),
    currentThroughputRowsPerSec: result.rowsPerSecond,
    pageSplitsCount: simulatedPageSplits,
    cacheInvalidated: true,
    phase: 'completed'
  });

  // Notify auditing / Queue Auto-Save subscribers of significant data ingest
  notifyDatabaseUpdate({
    type: 'bulk_import',
    description: `Bulk Ingest +${recordCount.toLocaleString()} rows (${mode === 'raw_bulk_unindexed' ? 'Unindexed' : 'Indexed'})`,
    recordsAdded: recordCount,
    totalRecords: DB_RECORDS.length,
    timestamp: Date.now()
  });

  return result;
  } finally {
    releaseMutation();
  }
}

/**
 * Rebuilds all database secondary indexes across the entire dataset.
 * Simulates the standard REINDEX TABLE command in production databases.
 */
export async function rebuildDatabaseIndexes(): Promise<{
  durationMs: number;
  indexedRecords: number;
  bTreePageSplits: number;
}> {
  initializeDatabase();
  const startTime = performance.now();

  INDEX_STATUS_CATEGORY.clear();
  INDEX_CUSTOMER.clear();

  const total = DB_RECORDS.length;
  for (let i = 0; i < total; i++) {
    const r = DB_RECORDS[i];
    const statusCatKey = `${r.status}::${r.category}`;
    const catList = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
    catList.push(i);
    INDEX_STATUS_CATEGORY.set(statusCatKey, catList);

    const custList = INDEX_CUSTOMER.get(r.customerId) || [];
    custList.push(i);
    INDEX_CUSTOMER.set(r.customerId, custList);
  }

  IS_INDEX_SYNCHRONIZED = true;
  clearDatabaseCache();

  // Simulated sorted bulk index build time (~0.015ms per tuple)
  const durationMs = Number((total * 0.015 + (performance.now() - startTime)).toFixed(2));

  // Notify auditing / Queue Auto-Save subscribers
  notifyDatabaseUpdate({
    type: 'rebuild_indexes',
    description: `Rebuild Secondary B-Tree Indexes (${total.toLocaleString()} rows)`,
    recordsModified: total,
    totalRecords: DB_RECORDS.length,
    timestamp: Date.now()
  });

  return {
    durationMs,
    indexedRecords: total,
    bTreePageSplits: Math.floor(total / 128) // bulk load packing factor
  };
}

/**
 * Resets the in-memory database to the original 50,000 baseline records.
 */
export function resetDatabaseToBaseline(): void {
  const baselineCount = 50000;
  if (DB_RECORDS.length > baselineCount) {
    // Prune items map for removed records
    for (let i = baselineCount; i < DB_RECORDS.length; i++) {
      DB_ITEMS_MAP.delete(`rec_${i + 1}`);
    }
    DB_RECORDS.length = baselineCount;
  }

  INDEX_STATUS_CATEGORY.clear();
  INDEX_CUSTOMER.clear();

  for (let i = 0; i < DB_RECORDS.length; i++) {
    const r = DB_RECORDS[i];
    const statusCatKey = `${r.status}::${r.category}`;
    const catList = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
    catList.push(i);
    INDEX_STATUS_CATEGORY.set(statusCatKey, catList);

    const custList = INDEX_CUSTOMER.get(r.customerId) || [];
    custList.push(i);
    INDEX_CUSTOMER.set(r.customerId, custList);
  }

  IS_INDEX_SYNCHRONIZED = true;
  LAST_BULK_IMPORT_RESULT = null;
  clearDatabaseCache();

  // Notify auditing / Queue Auto-Save subscribers
  notifyDatabaseUpdate({
    type: 'baseline_reset',
    description: `Database Reset to Baseline (${baselineCount.toLocaleString()} rows)`,
    recordsModified: 0,
    totalRecords: DB_RECORDS.length,
    timestamp: Date.now()
  });
}

/**
 * Executes a simulated batch transaction update on the database.
 * Modifies order records (e.g. status transition, risk auditing, or urgent batch)
 * and dispatches a database update notification.
 */
export function executeBatchMutation(
  mutationType: 'status_transition' | 'high_risk_flag' | 'insert_live' = 'status_transition',
  count = 50
): { affectedCount: number; description: string; totalRecords: number } {
  initializeDatabase();

  if (mutationType === 'insert_live') {
    const startIndex = DB_RECORDS.length;
    for (let i = 0; i < count; i++) {
      const idx = startIndex + i;
      const id = `rec_${idx + 1}`;
      const company = COMPANIES[idx % COMPANIES.length];
      const customerId = `cust_${(idx % 450) + 1}`;
      const category = CATEGORIES[idx % CATEGORIES.length];
      const status: OrderStatus = 'processing';
      const tier = TIERS[idx % TIERS.length];
      const region = REGIONS[idx % REGIONS.length];
      const amount = 850 + ((idx * 79) % 9200);

      const items: OrderItem[] = [
        {
          id: `item_live_${idx}_0`,
          name: 'Real-time Telemetry Streamer',
          sku: 'TEL-STM-PRO',
          unitPrice: 340,
          quantity: 2
        }
      ];
      DB_ITEMS_MAP.set(id, items);

      const newRec: TransactionRecord = {
        id,
        orderNumber: `ORD-LIVE-${200000 + idx}`,
        customerId,
        customerName: `${company} [Live Ingest]`,
        customerEmail: `ops@${company.toLowerCase().replace(/\s+/g, '')}.io`,
        customerTier: tier,
        status,
        category,
        amount,
        itemCount: items.length,
        region,
        createdAt: new Date().toISOString().split('T')[0],
        items
      };

      DB_RECORDS.push(newRec);

      // Maintain secondary indexes
      const statusCatKey = `${status}::${category}`;
      const catList = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
      catList.push(idx);
      INDEX_STATUS_CATEGORY.set(statusCatKey, catList);

      const custList = INDEX_CUSTOMER.get(customerId) || [];
      custList.push(idx);
      INDEX_CUSTOMER.set(customerId, custList);
    }

    clearDatabaseCache();
    const description = `Live Ingest Append (+${count} new transactions)`;

    notifyDatabaseUpdate({
      type: 'batch_mutation',
      description,
      recordsAdded: count,
      totalRecords: DB_RECORDS.length,
      timestamp: Date.now()
    });

    return { affectedCount: count, description, totalRecords: DB_RECORDS.length };
  }

  // Update existing records (e.g. status transition or high risk flag)
  const targetCount = Math.min(count, DB_RECORDS.length);
  let updatedCount = 0;

  for (let i = 0; i < DB_RECORDS.length && updatedCount < targetCount; i += Math.max(1, Math.floor(DB_RECORDS.length / targetCount))) {
    const r = DB_RECORDS[i];
    if (mutationType === 'status_transition') {
      // Cycle status: processing -> completed, flagged -> completed, failed -> processing
      const oldStatus = r.status;
      const nextStatus: OrderStatus =
        oldStatus === 'processing'
          ? 'completed'
          : oldStatus === 'flagged'
          ? 'completed'
          : oldStatus === 'failed'
          ? 'processing'
          : 'processing';
      
      // Update index
      const oldKey = `${oldStatus}::${r.category}`;
      const oldList = INDEX_STATUS_CATEGORY.get(oldKey);
      if (oldList) {
        const itemIdx = oldList.indexOf(i);
        if (itemIdx >= 0) oldList.splice(itemIdx, 1);
      }

      r.status = nextStatus;
      const newKey = `${nextStatus}::${r.category}`;
      const newList = INDEX_STATUS_CATEGORY.get(newKey) || [];
      newList.push(i);
      INDEX_STATUS_CATEGORY.set(newKey, newList);
      updatedCount++;
    } else {
      // high_risk_flag
      r.status = 'flagged';
      r.riskScore = 0.94;
      updatedCount++;
    }
  }

  clearDatabaseCache();

  const description =
    mutationType === 'status_transition'
      ? `Batch Status Transition (${updatedCount} orders updated to Completed/Processing)`
      : `High-Risk Audit Flag Applied (${updatedCount} orders flagged)`;

  notifyDatabaseUpdate({
    type: 'status_transition',
    description,
    recordsModified: updatedCount,
    totalRecords: DB_RECORDS.length,
    timestamp: Date.now()
  });

  return { affectedCount: updatedCount, description, totalRecords: DB_RECORDS.length };
}

/**
 * Deletes transactions by their unique ID array.
 * Cleans up item maps, rebuilds secondary indexes, clears query cache,
 * and broadcasts an audit update event.
 */
export function deleteRecordsByIds(recordIds: string[]): {
  deletedCount: number;
  totalRecords: number;
} {
  initializeDatabase();
  const idSet = new Set(recordIds);
  const initialLength = DB_RECORDS.length;

  DB_RECORDS = DB_RECORDS.filter((r) => {
    if (idSet.has(r.id)) {
      DB_ITEMS_MAP.delete(r.id);
      return false;
    }
    return true;
  });

  const deletedCount = initialLength - DB_RECORDS.length;

  // Rebuild secondary indexes to keep index pointers in sync
  INDEX_STATUS_CATEGORY.clear();
  INDEX_CUSTOMER.clear();

  for (let i = 0; i < DB_RECORDS.length; i++) {
    const r = DB_RECORDS[i];
    const statusCatKey = `${r.status}::${r.category}`;
    const catList = INDEX_STATUS_CATEGORY.get(statusCatKey) || [];
    catList.push(i);
    INDEX_STATUS_CATEGORY.set(statusCatKey, catList);

    const custList = INDEX_CUSTOMER.get(r.customerId) || [];
    custList.push(i);
    INDEX_CUSTOMER.set(r.customerId, custList);
  }

  IS_INDEX_SYNCHRONIZED = true;
  clearDatabaseCache();

  const description = `Batch Deletion (-${deletedCount.toLocaleString()} records removed)`;
  notifyDatabaseUpdate({
    type: 'batch_mutation',
    description,
    recordsModified: deletedCount,
    totalRecords: DB_RECORDS.length,
    timestamp: Date.now()
  });

  return {
    deletedCount,
    totalRecords: DB_RECORDS.length
  };
}

