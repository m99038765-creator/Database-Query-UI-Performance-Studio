export type CustomerTier = 'Platinum' | 'Gold' | 'Silver' | 'Standard';
export type OrderStatus = 'completed' | 'processing' | 'flagged' | 'failed';
export type ProductCategory = 
  | 'Cloud Infrastructure'
  | 'Enterprise License'
  | 'Security Audit'
  | 'Database Cluster'
  | 'AI Inference';

export interface OrderItem {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

export interface TransactionRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerTier: CustomerTier;
  status: OrderStatus;
  category: ProductCategory;
  amount: number;
  itemCount: number;
  region: string;
  createdAt: string;
  items?: OrderItem[];
  // Computed stats for stress testing
  hashChecksum?: string;
  riskScore?: number;
}

export interface OptimizationFlags {
  batchEagerLoading: boolean; // Solves N+1 query storm / connection timeout
  btreeIndexing: boolean;     // Solves full table scan (50k rows -> index lookup)
  queryCaching: boolean;      // LRU query caching for sub-millisecond response
  virtualizedDOM: boolean;    // Solves UI rendering lag (windowing: 15 nodes instead of 5,000+)
  deferredRendering: boolean; // Concurrent non-blocking React 19 deferred state
}

export interface ExplainPlanNode {
  nodeType: 'Index Scan' | 'Seq Scan' | 'Hash Join' | 'Nested Loop' | 'LRU Cache Lookup';
  relationName: string;
  indexName?: string;
  cost: number;
  actualTimeMs: number;
  rowsScanned: number;
  rowsReturned: number;
  filter?: string;
  details: string;
  subNodes?: ExplainPlanNode[];
}

export interface QueryExecutionResult {
  records: TransactionRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  executionTimeMs: number;
  rowsScanned: number;
  cacheHit: boolean;
  indexUsed: string | null;
  explainPlan: ExplainPlanNode;
  activeQueriesCount: number;
  simulatedError: string | null;
  warningNotice: string | null;
}

export interface BenchmarkStep {
  name: string;
  unoptimizedTime: number;
  optimizedTime: number;
  unoptimizedRowsScanned: number;
  optimizedRowsScanned: number;
  fpsBefore: number;
  fpsAfter: number;
  improvementPercent: number;
}

export interface LatencyTrendPoint {
  id: string;
  timestamp: number;
  timeFormatted: string;
  executionTimeMs: number;
  rowsScanned: number;
  activeQueriesCount: number;
  cacheHit: boolean;
  flags: OptimizationFlags;
  triggerEvent: string;
  flagToggled?: keyof OptimizationFlags;
  flagToggledState?: boolean;
  deltaMs?: number; // negative means improved (faster)
  simulatedError: string | null;
}

export type BulkImportMode = 'realtime_indexed' | 'raw_bulk_unindexed' | 'single_row_unbatched';

export interface BulkImportOptions {
  recordCount: number;
  mode: BulkImportMode;
  chunkSize?: number;
}

export interface BulkImportProgress {
  currentCount: number;
  totalTarget: number;
  percent: number;
  elapsedMs: number;
  currentThroughputRowsPerSec: number;
  pageSplitsCount: number;
  cacheInvalidated: boolean;
  phase: 'preparing' | 'writing_heap' | 'updating_indexes' | 'verifying' | 'completed';
}

export interface BulkImportResult {
  recordsAdded: number;
  totalDatabaseRecords: number;
  totalDurationMs: number;
  heapWriteTimeMs: number;
  indexMaintenanceTimeMs: number;
  walWriteTimeMs: number;
  bTreePageSplits: number;
  indexesUpdated: string[];
  cacheInvalidated: boolean;
  rowsPerSecond: number;
  readQueryLatencyBeforeMs: number;
  readQueryLatencyAfterMs: number;
  mode: BulkImportMode;
  timestamp: number;
}

export interface DatabaseStats {
  totalRecords: number;
  indexStatusCategorySize: number;
  indexCustomerSize: number;
  isIndexSynchronized: boolean;
  cacheSize: number;
}

export type DatabaseUpdateEventType =
  | 'bulk_import'
  | 'baseline_reset'
  | 'rebuild_indexes'
  | 'batch_mutation'
  | 'status_transition';

export interface DatabaseUpdateEvent {
  type: DatabaseUpdateEventType;
  description: string;
  recordsAdded?: number;
  recordsModified?: number;
  totalRecords: number;
  timestamp: number;
}

export interface DataTapeFilterSummary {
  searchTerm: string;
  status: OrderStatus | 'all';
  category: ProductCategory | 'all';
  pageSize: number;
}

export interface DataTapeEntry {
  tapeId: string; // e.g. "TAPE-001"
  sequenceNumber: number;
  timestamp: number;
  timeFormatted: string;
  isoTimestamp: string;
  triggerEvent: string; // e.g. "Bulk Ingestion (+5,000 rows)", "Order Status Batch Update"
  databaseTotalRecords: number;
  format: 'csv' | 'json';
  formatName: string;
  recordCount: number;
  itemCount: number;
  fileSizeBytes: number;
  durationMs: number;
  cpuUsagePercent: number;
  throughputRowsPerSec: number;
  checksumSha256: string; // Cryptographic audit verification hash
  filterSummary: DataTapeFilterSummary;
  filename: string;
  content: string; // In-memory full text payload for instant slice download
  payloadPreview: string; // Snippet preview for auditor inspection
}
