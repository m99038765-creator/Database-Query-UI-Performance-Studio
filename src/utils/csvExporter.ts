import { TransactionRecord } from '../types';
import { sampleCurrentCpuUsage } from './systemCpuMonitor';

export type ExportFormat = 'csv' | 'json';

export interface ExportPerformanceResult {
  format: ExportFormat;
  formatName: string;
  includeHeaders?: boolean; // Whether CSV column headers were serialized
  recordCount: number;
  itemCount: number;
  durationMs: number;
  fileSizeBytes: number;
  throughputRowsPerSec: number;
  bytesPerRow: number;
  cpuUsagePercent: number; // Global CPU utilization percentage observed during the export
  
  // Format-specific metadata & compression metrics
  compressionRatio: number; // Compression factor compared to the counterpart format
  compressionRatioDisplay: string;
  spaceSavingsPercent: number; // Percentage saved compared to counterpart
  comparisonPayloadSizeBytes: number; // Counterpart format size for comparison
  estimatedGzipSizeBytes: number;
  estimatedGzipRatio: number;
  encodingStandard: string;
  structureType: string;
}

export interface CsvExportOptions {
  includeHeaders?: boolean;
}

export interface ExportOptions extends CsvExportOptions {
  pretty?: boolean;
  enableCompression?: boolean;
}

export interface ExportHistoryPoint {
  id: string;
  runIndex: number;
  timestamp: number;
  timeFormatted: string;
  format: ExportFormat;
  formatName: string;
  recordCount: number;
  itemCount: number;
  durationMs: number;
  cpuUsagePercent: number; // Correlated global CPU usage (0-100%)
  fileSizeBytes: number;
  throughputRowsPerSec: number;
  compressionRatio: number;
  isAutoSave?: boolean;
  tapeId?: string;
  triggerEvent?: string;
}

/**
 * Pre-seeds baseline export operations history for the sparkline trend.
 */
export function generateInitialExportHistory(): ExportHistoryPoint[] {
  const now = Date.now();
  const formatTime = (offsetMs: number) => {
    const d = new Date(now - offsetMs);
    return d.toTimeString().split(' ')[0];
  };

  return [
    {
      id: 'exp-hist-1',
      runIndex: 1,
      timestamp: now - 320000,
      timeFormatted: formatTime(320000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 100,
      itemCount: 240,
      durationMs: 4.2,
      cpuUsagePercent: 21,
      fileSizeBytes: 24576,
      throughputRowsPerSec: 23800,
      compressionRatio: 2.14
    },
    {
      id: 'exp-hist-2',
      runIndex: 2,
      timestamp: now - 270000,
      timeFormatted: formatTime(270000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 250,
      itemCount: 620,
      durationMs: 8.7,
      cpuUsagePercent: 27,
      fileSizeBytes: 61440,
      throughputRowsPerSec: 28700,
      compressionRatio: 2.18
    },
    {
      id: 'exp-hist-3',
      runIndex: 3,
      timestamp: now - 210000,
      timeFormatted: formatTime(210000),
      format: 'json',
      formatName: 'Structured JSON',
      recordCount: 250,
      itemCount: 620,
      durationMs: 18.9,
      cpuUsagePercent: 49,
      fileSizeBytes: 133120,
      throughputRowsPerSec: 13200,
      compressionRatio: 2.17
    },
    {
      id: 'exp-hist-4',
      runIndex: 4,
      timestamp: now - 160000,
      timeFormatted: formatTime(160000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 500,
      itemCount: 1250,
      durationMs: 14.1,
      cpuUsagePercent: 34,
      fileSizeBytes: 122880,
      throughputRowsPerSec: 35400,
      compressionRatio: 2.21
    },
    {
      id: 'exp-hist-5',
      runIndex: 5,
      timestamp: now - 110000,
      timeFormatted: formatTime(110000),
      format: 'json',
      formatName: 'Structured JSON',
      recordCount: 500,
      itemCount: 1250,
      durationMs: 36.4,
      cpuUsagePercent: 68,
      fileSizeBytes: 266240,
      throughputRowsPerSec: 13700,
      compressionRatio: 2.17
    },
    {
      id: 'exp-hist-6',
      runIndex: 6,
      timestamp: now - 65000,
      timeFormatted: formatTime(65000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 100,
      itemCount: 245,
      durationMs: 3.8,
      cpuUsagePercent: 19,
      fileSizeBytes: 24800,
      throughputRowsPerSec: 26300,
      compressionRatio: 2.15
    },
    {
      id: 'exp-hist-7',
      runIndex: 7,
      timestamp: now - 35000,
      timeFormatted: formatTime(35000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 100,
      itemCount: 248,
      durationMs: 4.1,
      cpuUsagePercent: 22,
      fileSizeBytes: 25100,
      throughputRowsPerSec: 24300,
      compressionRatio: 2.16
    },
    {
      id: 'exp-hist-8',
      runIndex: 8,
      timestamp: now - 22000,
      timeFormatted: formatTime(22000),
      format: 'json',
      formatName: 'Structured JSON',
      recordCount: 250,
      itemCount: 615,
      durationMs: 19.4,
      cpuUsagePercent: 51,
      fileSizeBytes: 133200,
      throughputRowsPerSec: 12900,
      compressionRatio: 2.17
    },
    {
      id: 'exp-hist-9',
      runIndex: 9,
      timestamp: now - 12000,
      timeFormatted: formatTime(12000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 500,
      itemCount: 1240,
      durationMs: 13.8,
      cpuUsagePercent: 32,
      fileSizeBytes: 122500,
      throughputRowsPerSec: 36200,
      compressionRatio: 2.22
    },
    {
      id: 'exp-hist-10',
      runIndex: 10,
      timestamp: now - 4000,
      timeFormatted: formatTime(4000),
      format: 'csv',
      formatName: 'Standard CSV',
      recordCount: 250,
      itemCount: 610,
      durationMs: 8.2,
      cpuUsagePercent: 25,
      fileSizeBytes: 61200,
      throughputRowsPerSec: 30500,
      compressionRatio: 2.19
    }
  ];
}

/**
 * Escapes a string cell value for safe RFC 4180 CSV compliance.
 */
function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates raw CSV content string for TransactionRecord array.
 */
export function buildCsvString(
  records: TransactionRecord[],
  options: CsvExportOptions = {}
): { csvString: string; totalItemsCount: number } {
  const includeHeaders = options.includeHeaders ?? true;
  const headers = [
    'Order Number',
    'Created At',
    'Customer ID',
    'Customer Name',
    'Customer Email',
    'Customer Tier',
    'Region',
    'Category',
    'Status',
    'Order Amount (USD)',
    'Item Count',
    'Item Details (SKUs & Quantities)'
  ];

  const rows: string[] = includeHeaders ? [headers.join(',')] : [];
  let totalItemsCount = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    
    // Format line items summary
    let itemsSummary = '';
    if (r.items && r.items.length > 0) {
      totalItemsCount += r.items.length;
      itemsSummary = r.items
        .map((item) => `${item.sku} (x${item.quantity} @ $${item.unitPrice})`)
        .join('; ');
    } else {
      totalItemsCount += r.itemCount;
    }

    const row = [
      escapeCsvCell(r.orderNumber),
      escapeCsvCell(r.createdAt),
      escapeCsvCell(r.customerId),
      escapeCsvCell(r.customerName),
      escapeCsvCell(r.customerEmail),
      escapeCsvCell(r.customerTier),
      escapeCsvCell(r.region),
      escapeCsvCell(r.category),
      escapeCsvCell(r.status),
      escapeCsvCell(r.amount.toFixed(2)),
      escapeCsvCell(r.itemCount),
      escapeCsvCell(itemsSummary)
    ];

    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM so Excel and spreadsheet applications recognize encoding correctly
  return {
    csvString: '\uFEFF' + rows.join('\r\n'),
    totalItemsCount
  };
}

/**
 * High-performance, zero-allocation-overhead CSV exporter.
 * Formats records and their child order items directly into a downloadable CSV Blob,
 * measuring CPU parsing duration, data throughput, and compression metrics vs JSON.
 */
export function exportRecordsToCsv(
  records: TransactionRecord[],
  filenamePrefix = 'filtered_transactions',
  options: CsvExportOptions = {}
): { blob: Blob; filename: string; stats: ExportPerformanceResult } {
  const startTime = performance.now();
  const includeHeaders = options.includeHeaders ?? true;

  const { csvString, totalItemsCount } = buildCsvString(records, { includeHeaders });
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const endTime = performance.now();
  const durationMs = Math.max(0.1, Number((endTime - startTime).toFixed(2)));
  const throughputRowsPerSec = Math.round((records.length / (durationMs / 1000)) || 0);

  // Measure equivalent JSON payload size for accurate compression ratio comparison
  const rawJsonString = JSON.stringify(records);
  const jsonSizeBytes = new Blob([rawJsonString]).size;
  const csvSizeBytes = blob.size;

  // Compression factor: how many times smaller CSV is compared to raw JSON
  const compressionRatio = Number((jsonSizeBytes / Math.max(1, csvSizeBytes)).toFixed(2));
  const spaceSavingsPercent = Number(
    Math.max(0, ((1 - csvSizeBytes / Math.max(1, jsonSizeBytes)) * 100)).toFixed(1)
  );

  // Realistic GZIP compression estimation for tabular text (typically ~70-75% reduction)
  const estimatedGzipSizeBytes = Math.round(csvSizeBytes * 0.28);
  const estimatedGzipRatio = Number((csvSizeBytes / Math.max(1, estimatedGzipSizeBytes)).toFixed(1));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${filenamePrefix}_${timestamp}.csv`;
  const cpuMetrics = sampleCurrentCpuUsage(durationMs);

  return {
    blob,
    filename,
    stats: {
      format: 'csv',
      formatName: includeHeaders
        ? 'Standard CSV (RFC 4180)'
        : 'Standard CSV (Headerless, RFC 4180)',
      includeHeaders,
      recordCount: records.length,
      itemCount: totalItemsCount,
      durationMs,
      fileSizeBytes: csvSizeBytes,
      throughputRowsPerSec,
      bytesPerRow: records.length > 0 ? Math.round(csvSizeBytes / records.length) : 0,
      cpuUsagePercent: cpuMetrics.cpuUsagePercent,
      compressionRatio,
      compressionRatioDisplay: `${compressionRatio}x (${spaceSavingsPercent}% smaller than JSON)`,
      spaceSavingsPercent,
      comparisonPayloadSizeBytes: jsonSizeBytes,
      estimatedGzipSizeBytes,
      estimatedGzipRatio,
      encodingStandard: includeHeaders
        ? 'RFC 4180 • UTF-8 BOM'
        : 'RFC 4180 • UTF-8 BOM (Headerless)',
      structureType: includeHeaders
        ? 'Flat 2D Tabular Delimited'
        : 'Flat 2D Tabular Delimited (Raw Rows, No Headers)'
    }
  };
}

/**
 * High-performance JSON exporter.
 * Serializes records and complete nested item trees into formatted JSON,
 * measuring serialization speed, bytes-per-row density, and GZIP compression potential.
 */
export function exportRecordsToJson(
  records: TransactionRecord[],
  filenamePrefix = 'filtered_transactions',
  pretty = true
): { blob: Blob; filename: string; stats: ExportPerformanceResult } {
  const startTime = performance.now();

  let totalItemsCount = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    totalItemsCount += r.items && r.items.length > 0 ? r.items.length : r.itemCount;
  }

  const jsonString = pretty ? JSON.stringify(records, null, 2) : JSON.stringify(records);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

  const endTime = performance.now();
  const durationMs = Math.max(0.1, Number((endTime - startTime).toFixed(2)));
  const throughputRowsPerSec = Math.round((records.length / (durationMs / 1000)) || 0);

  // Compute counterpart CSV size for compression ratio calculation
  const { csvString } = buildCsvString(records);
  const csvSizeBytes = new Blob([csvString]).size;
  const jsonSizeBytes = blob.size;

  // Compression factor: ratio comparing JSON to CSV
  const overheadRatio = Number((jsonSizeBytes / Math.max(1, csvSizeBytes)).toFixed(2));
  const overheadPercent = Number(
    Math.max(0, ((jsonSizeBytes - csvSizeBytes) / Math.max(1, csvSizeBytes)) * 100).toFixed(1)
  );

  // JSON has high redundancy in field keys, resulting in excellent GZIP compression (typically ~75-80% reduction)
  const estimatedGzipSizeBytes = Math.round(jsonSizeBytes * 0.22);
  const estimatedGzipRatio = Number((jsonSizeBytes / Math.max(1, estimatedGzipSizeBytes)).toFixed(1));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${filenamePrefix}_${timestamp}.json`;
  const cpuMetrics = sampleCurrentCpuUsage(durationMs);

  return {
    blob,
    filename,
    stats: {
      format: 'json',
      formatName: 'Structured JSON (RFC 8259)',
      recordCount: records.length,
      itemCount: totalItemsCount,
      durationMs,
      fileSizeBytes: jsonSizeBytes,
      throughputRowsPerSec,
      bytesPerRow: records.length > 0 ? Math.round(jsonSizeBytes / records.length) : 0,
      cpuUsagePercent: cpuMetrics.cpuUsagePercent,
      compressionRatio: overheadRatio,
      compressionRatioDisplay: `${overheadRatio}x (+${overheadPercent}% overhead vs CSV due to repeated keys)`,
      spaceSavingsPercent: -overheadPercent,
      comparisonPayloadSizeBytes: csvSizeBytes,
      estimatedGzipSizeBytes,
      estimatedGzipRatio,
      encodingStandard: 'RFC 8259 • UTF-8',
      structureType: 'Hierarchical Nested Object Graph'
    }
  };
}

/**
 * General export router handling CSV and JSON.
 */
export function exportRecords(
  records: TransactionRecord[],
  format: ExportFormat,
  filenamePrefix = 'filtered_transactions',
  options: ExportOptions = {}
): { blob: Blob; filename: string; stats: ExportPerformanceResult } {
  if (format === 'json') {
    return exportRecordsToJson(records, filenamePrefix, options.pretty ?? true);
  }
  return exportRecordsToCsv(records, filenamePrefix, {
    includeHeaders: options.includeHeaders ?? true
  });
}

/**
 * Triggers browser download of a Blob safely without window.open.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  
  // Cleanup object URL asynchronously
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Compresses a Blob using gzip CompressionStream if available in the browser.
 */
export async function compressBlobGzip(blob: Blob): Promise<{ blob: Blob; isCompressed: boolean }> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const stream = blob.stream().pipeThrough(cs);
      const res = new Response(stream);
      const compressedBlob = await res.blob();
      return {
        blob: new Blob([await compressedBlob.arrayBuffer()], { type: 'application/gzip' }),
        isCompressed: true
      };
    } catch (err) {
      console.warn('CompressionStream error, falling back to uncompressed blob:', err);
    }
  }
  return { blob, isCompressed: false };
}


