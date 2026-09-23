import { SerializationLogEntry, LatencyTrendPoint } from '../types';
import { ExportPerformanceResult, ExportFormat } from './csvExporter';

/**
 * Creates a structured 'Latency Anomaly' SerializationLogEntry when query/engine latency
 * exceeds the configured anomaly threshold.
 */
export function createLatencyAnomalyLog(
  point: LatencyTrendPoint,
  baselineLatency: number,
  anomalyThreshold: number,
  triggerSource?: string
): SerializationLogEntry {
  const now = new Date(point.timestamp || Date.now());
  const timeFormatted = point.timeFormatted || now.toTimeString().split(' ')[0];
  const variance = Math.max(0, point.executionTimeMs - baselineLatency);
  const source = triggerSource || point.triggerEvent || 'Database Query Execution';

  return {
    id: `latency-anomaly-${point.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: point.timestamp || Date.now(),
    timeFormatted,
    severity: 'anomaly',
    type: 'LATENCY_ANOMALY',
    format: 'engine',
    recordCount: point.rowsScanned || 50000,
    message: `Latency Anomaly: Spiked to ${point.executionTimeMs.toFixed(1)}ms (+${variance.toFixed(1)}ms variance above ${baselineLatency.toFixed(1)}ms baseline). Threshold: +${anomalyThreshold}ms.`,
    details: {
      durationMs: Number(point.executionTimeMs.toFixed(2)),
      baselineDurationMs: Number(baselineLatency.toFixed(2)),
      varianceMs: Number(variance.toFixed(2)),
      anomalyThresholdMs: anomalyThreshold,
      activeQueriesCount: point.activeQueriesCount || 1,
      cause: `Query runtime latency (+${variance.toFixed(1)}ms) exceeded the configured threshold (+${anomalyThreshold}ms) during execution.`,
      triggerSource: source
    }
  };
}

/**
 * Analyzes an export performance result for serialization anomalies or throughput degradations.
 */
export function detectSerializationAnomaly(
  stats: ExportPerformanceResult,
  format: ExportFormat,
  triggerSource = 'Manual User Export'
): SerializationLogEntry | null {
  const now = new Date();
  const timeFormatted = now.toTimeString().split(' ')[0];

  // 1. Throughput degradation check
  // Standard CSV baseline is ~22,000-35,000 rows/s; JSON baseline is ~10,000-16,000 rows/s
  const csvThroughputThreshold = 16000;
  const jsonThroughputThreshold = 7500;
  const isThroughputLow =
    (format === 'csv' && stats.throughputRowsPerSec < csvThroughputThreshold) ||
    (format === 'json' && stats.throughputRowsPerSec < jsonThroughputThreshold);

  if (isThroughputLow && stats.recordCount >= 50) {
    const baseline = format === 'csv' ? 24000 : 12000;
    const dropPct = Math.round(((baseline - stats.throughputRowsPerSec) / baseline) * 100);

    return {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'anomaly',
      type: 'THROUGHPUT_DEGRADATION',
      format,
      recordCount: stats.recordCount,
      message: `Throughput dipped to ${stats.throughputRowsPerSec.toLocaleString()} rows/sec (${dropPct}% below ${baseline.toLocaleString()} baseline).`,
      details: {
        throughputRowsPerSec: stats.throughputRowsPerSec,
        baselineThroughput: baseline,
        durationMs: stats.durationMs,
        cpuUsagePercent: stats.cpuUsagePercent,
        cause: `String buffer allocation overhead & garbage collector pause observed during ${format.toUpperCase()} formatting.`,
        triggerSource
      }
    };
  }

  // 2. High serialization latency spike (> 45ms or > 0.12ms per row for small subsets)
  const latencyPerRow = stats.recordCount > 0 ? stats.durationMs / stats.recordCount : 0;
  if (stats.durationMs > 45 || (stats.recordCount <= 250 && latencyPerRow > 0.12)) {
    return {
      id: `latency-spike-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'warning',
      type: 'LATENCY_SPIKE',
      format,
      recordCount: stats.recordCount,
      message: `Serialization latency spike detected: ${stats.durationMs.toFixed(1)}ms (${latencyPerRow.toFixed(3)} ms/row).`,
      details: {
        durationMs: stats.durationMs,
        baselineDurationMs: format === 'csv' ? 12 : 22,
        throughputRowsPerSec: stats.throughputRowsPerSec,
        cpuUsagePercent: stats.cpuUsagePercent,
        cause: 'Micro-task queue starvation or main thread layout recalculation concurrently triggered during serialization.',
        triggerSource
      }
    };
  }

  // 3. CPU Contention threshold check (>= 70% CPU observed)
  if (stats.cpuUsagePercent >= 70) {
    return {
      id: `cpu-contention-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'warning',
      type: 'CPU_CONTENTION',
      format,
      recordCount: stats.recordCount,
      message: `High host CPU contention (${stats.cpuUsagePercent}% utilization) during ${format.toUpperCase()} stringification.`,
      details: {
        cpuUsagePercent: stats.cpuUsagePercent,
        durationMs: stats.durationMs,
        throughputRowsPerSec: stats.throughputRowsPerSec,
        cause: 'Concurrent background workers and B-Tree index cache flushes competing for CPU cycles.',
        triggerSource
      }
    };
  }

  return null;
}

/**
 * Creates simulated logs to allow testing error states and anomaly handling.
 */
export function createSimulatedLog(
  mode: 'failure' | 'throughput_anomaly' | 'cpu_spike' | 'latency_anomaly',
  format: ExportFormat,
  recordCount: number
): SerializationLogEntry {
  const now = new Date();
  const timeFormatted = now.toTimeString().split(' ')[0];

  if (mode === 'latency_anomaly') {
    return {
      id: `latency-anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'anomaly',
      type: 'LATENCY_ANOMALY',
      format: 'engine',
      recordCount: recordCount || 50000,
      message: 'Latency Anomaly: Spiked to 384.6ms (+342.2ms variance above 42.4ms baseline). Threshold: +50ms.',
      details: {
        durationMs: 384.6,
        baselineDurationMs: 42.4,
        varianceMs: 342.2,
        anomalyThresholdMs: 50,
        activeQueriesCount: 8,
        cause: 'Unindexed secondary index table scan and unbuffered nested hash joins competing for thread pool workers.',
        triggerSource: 'Simulated Fault Injection: Query Engine Spike'
      }
    };
  }

  if (mode === 'failure') {
    return {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'error',
      type: 'SERIALIZATION_EXCEPTION',
      format,
      recordCount,
      message: `Fatal serialization abort: Memory limit exceeded or unhandled UTF-8 byte sequence in ${format.toUpperCase()} stream.`,
      details: {
        cause: `RangeError: String length exceeds Maximum Call Stack during recursive ${format.toUpperCase()} node traversal`,
        stackTrace: `at JSON.stringify (<anonymous>)\n  at exportRecordsToJson (csvExporter.ts:319)\n  at handleHeaderExport (App.tsx:593)`,
        fileSizeBytes: 0,
        triggerSource: 'Simulated Fault Injection'
      }
    };
  }

  if (mode === 'throughput_anomaly') {
    return {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      severity: 'anomaly',
      type: 'THROUGHPUT_DEGRADATION',
      format,
      recordCount,
      message: `Severe throughput degradation: Dropped to 3,840 rows/sec (84% below baseline).`,
      details: {
        throughputRowsPerSec: 3840,
        baselineThroughput: format === 'csv' ? 24000 : 12000,
        durationMs: 65.1,
        baselineDurationMs: 14.2,
        cpuUsagePercent: 62,
        cause: 'Heap memory pressure and heavy array reallocations during UTF-8 BOM encoding.',
        triggerSource: 'Simulated Fault Injection'
      }
    };
  }

  return {
    id: `contention-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    timeFormatted,
    severity: 'warning',
    type: 'CPU_CONTENTION',
    format,
    recordCount,
    message: `Core saturation warning: 88% CPU utilized during ${format.toUpperCase()} serialization.`,
    details: {
      cpuUsagePercent: 88,
      durationMs: 42.4,
      throughputRowsPerSec: format === 'csv' ? 11800 : 5400,
      cause: 'Host CPU throttled due to multi-threaded DOM reflow and concurrent buffer encoding.',
      triggerSource: 'Simulated Fault Injection'
    }
  };
}

/**
 * Returns initial historical anomaly and error logs.
 */
export function getInitialSerializationLogs(): SerializationLogEntry[] {
  const now = Date.now();
  const formatTime = (offsetMs: number) => {
    const d = new Date(now - offsetMs);
    return d.toTimeString().split(' ')[0];
  };

  return [
    {
      id: 'log-hist-1',
      timestamp: now - 110000,
      timeFormatted: formatTime(110000),
      severity: 'anomaly',
      type: 'THROUGHPUT_DEGRADATION',
      format: 'json',
      recordCount: 500,
      message: 'Throughput dipped to 13,700 rows/sec during deep nested item graph serialization.',
      details: {
        throughputRowsPerSec: 13700,
        baselineThroughput: 18000,
        durationMs: 36.4,
        baselineDurationMs: 27.5,
        cpuUsagePercent: 68,
        cause: '2-space indentation formatting and child SKU array mapping created heavy allocation overhead.',
        triggerSource: 'Queue Auto-Save [TAPE-002]'
      }
    },
    {
      id: 'log-hist-2',
      timestamp: now - 210000,
      timeFormatted: formatTime(210000),
      severity: 'warning',
      type: 'CPU_CONTENTION',
      format: 'json',
      recordCount: 250,
      message: 'Host CPU reached 49% utilization during concurrent WAL sync and JSON export.',
      details: {
        cpuUsagePercent: 49,
        durationMs: 18.9,
        throughputRowsPerSec: 13200,
        cause: 'Concurrent B-Tree index maintenance and JSON stringification.',
        triggerSource: 'Manual Export'
      }
    }
  ];
}
