import {
  LatencyTrendPoint,
  OptimizationFlags,
  DataTapeEntry,
  DatabaseMutationHistoryEntry
} from '../types';
import { triggerFileDownload } from './csvExporter';

export interface AnomalyAuditReportPayload {
  auditReportMetadata: {
    reportId: string;
    reportTitle: string;
    reportFormat: string;
    formatVersion: string;
    generatedAt: string;
    generatedTimestamp: number;
    auditedSystem: string;
    tableContext: {
      tableName: string;
      totalHeapRows: number;
      partitioning: string;
    };
    auditCriteria: {
      configuredAnomalyThresholdMs: number;
      configuredMutationThresholdSeconds: number;
      targetSlaMs: number;
      acceptableThresholdMs: number;
    };
    auditorExecutiveSummary: string;
  };
  systemPerformanceMetrics: {
    latencySummary: {
      totalSnapshotsAnalyzed: number;
      baselineLatencyMs: number;
      meanLatencyMs: number;
      medianLatencyMs: number;
      minLatencyMs: number;
      maxLatencyMs: number;
      p50LatencyMs: number;
      p90LatencyMs: number;
      p95LatencyMs: number;
      p99LatencyMs: number;
      standardDeviationMs: number;
      slaCompliancePercent: number;
      acceptableCompliancePercent: number;
      slaBreachPercent: number;
    };
    workloadAndConcurrency: {
      totalRowsScanned: number;
      averageRowsScanned: number;
      totalActiveQueriesRecorded: number;
      averageActiveQueriesPerSnapshot: number;
      cacheHitCount: number;
      cacheHitRatePercent: number;
      simulatedFaultsCount: number;
    };
    currentOptimizationFlags: OptimizationFlags;
  };
  anomalyDetectionSummary: {
    totalAnomaliesDetected: number;
    highDurationMutationsCount: number;
    outlierSpikesCount: number;
    slaBreachesCount: number;
    correlatedMutationIncidentsCount: number;
    maxVarianceObservedMs: number;
  };
  latencyAnomalies: Array<{
    sequenceIndex: number;
    pointId: string;
    timestamp: number;
    timeIso: string;
    timeFormatted: string;
    triggerEvent: string;
    executionLatencyMs: number;
    baselineLatencyMs: number;
    latencyVarianceAboveBaselineMs: number;
    latencyDeltaVsPreviousMs: number | null;
    anomalyClassification: 'High-Duration Mutation' | 'Outlier Spike' | 'Degraded Latency' | 'SLA Breach';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    slaStatus: 'MET (<15ms)' | 'ACCEPTABLE (15-60ms)' | 'BREACHED (>60ms)';
    isHighDurationMutation: boolean;
    correlatedMutation: {
      isCorrelated: boolean;
      mutationId?: string;
      description?: string;
      thresholdSeconds?: number;
      elapsedSeconds?: number;
      thresholdExceededBySeconds?: number;
      violationTimestamp?: number;
    } | null;
    mutationFrequencyAtSnapshot: {
      eventsPerMinute: number;
      isElevatedConcurrency: boolean;
    };
    technicalSpecifications: {
      accessMethod: string;
      rowsScanned: number;
      activeQueriesCount: number;
      cacheHit: boolean;
      simulatedError: string | null;
      activeFlags: OptimizationFlags;
    };
  }>;
  correlatedMutationEvents: Array<{
    mutationId: string;
    description: string;
    type: string;
    startedAt: number | null;
    startedAtIso: string | null;
    completedAt: number | null;
    completedAtIso: string | null;
    durationSeconds: number;
    thresholdSeconds: number;
    thresholdExceeded: boolean;
    excessSeconds: number;
    status: string;
    correlatedLatencySpikeMs?: number;
  }>;
  completeTelemetrySequence: Array<{
    sequenceIndex: number;
    id: string;
    timestamp: number;
    timeFormatted: string;
    triggerEvent: string;
    executionTimeMs: number;
    deltaMs?: number;
    rowsScanned: number;
    activeQueriesCount: number;
    cacheHit?: boolean;
    isHighDurationMutation?: boolean;
    mutationFrequencyPerMin?: number;
    flags: OptimizationFlags;
  }>;
}

/**
 * Calculates percentile from a sorted array of numbers.
 */
function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper === lower) return sorted[index];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Derives query access method description from active flags and event context.
 */
function deriveAccessMethod(point: LatencyTrendPoint): string {
  if (point.cacheHit) {
    return 'In-Memory LRU Cache Hit (Bypassed Engine)';
  }
  if (point.isHighDurationMutation) {
    return 'B-Tree Index Range Scan + Table Exclusive Mutex Wait';
  }
  if (!point.flags.btreeIndexing) {
    return 'Sequential Table Scan (Full Heap Scan 50,000 Rows)';
  }
  if (!point.flags.batchEagerLoading) {
    return 'Indexed Primary Probe + 100 Child Queries (N+1 Cascade)';
  }
  return 'B-Tree Index Seek + Parallel Eager Fetch (Optimized)';
}

/**
 * Generates structured JSON report payload for external performance audit.
 */
export function generateAnomalyAuditReport(options: {
  trendHistory: LatencyTrendPoint[];
  baselineLatency: number;
  meanLatency: number;
  stdDevLatency: number;
  anomalyThreshold: number;
  thresholdViolations?: Array<{
    id: string;
    mutationId: string;
    mutationDescription: string;
    thresholdSeconds: number;
    elapsedSeconds: number;
    timestamp: number;
  }>;
  mutationThreshold?: number;
  mutationHistory?: DatabaseMutationHistoryEntry[];
  currentFlags: OptimizationFlags;
  dataTapeEntries?: DataTapeEntry[];
  checkHighDurationFn: (
    point: LatencyTrendPoint,
    violations: Array<any>
  ) => { isHighDurationMutation: boolean; reason?: string; violation?: any };
  calculatePointMutationFreqFn: (
    point: LatencyTrendPoint,
    allPoints: LatencyTrendPoint[],
    mutationHistory: DatabaseMutationHistoryEntry[],
    thresholdViolations: Array<any>,
    dataTapeEntries: DataTapeEntry[]
  ) => number;
}): AnomalyAuditReportPayload {
  const {
    trendHistory,
    baselineLatency,
    meanLatency,
    stdDevLatency,
    anomalyThreshold,
    thresholdViolations = [],
    mutationThreshold = 5,
    mutationHistory = [],
    currentFlags,
    dataTapeEntries = [],
    checkHighDurationFn,
    calculatePointMutationFreqFn
  } = options;

  const now = new Date();
  const sortedLatencies = [...trendHistory.map((p) => p.executionTimeMs)].sort((a, b) => a - b);

  const minLatency = sortedLatencies.length > 0 ? sortedLatencies[0] : 0;
  const maxLatency = sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0;
  const p50 = getPercentile(sortedLatencies, 50);
  const p90 = getPercentile(sortedLatencies, 90);
  const p95 = getPercentile(sortedLatencies, 95);
  const p99 = getPercentile(sortedLatencies, 99);

  const slaComplianceCount = trendHistory.filter((p) => p.executionTimeMs < 15).length;
  const acceptableCount = trendHistory.filter(
    (p) => p.executionTimeMs >= 15 && p.executionTimeMs <= 60
  ).length;
  const breachedCount = trendHistory.filter((p) => p.executionTimeMs > 60).length;

  const slaCompliancePercent =
    trendHistory.length > 0 ? Number(((slaComplianceCount / trendHistory.length) * 100).toFixed(1)) : 100;
  const acceptableCompliancePercent =
    trendHistory.length > 0 ? Number(((acceptableCount / trendHistory.length) * 100).toFixed(1)) : 0;
  const slaBreachPercent =
    trendHistory.length > 0 ? Number(((breachedCount / trendHistory.length) * 100).toFixed(1)) : 0;

  const totalRowsScanned = trendHistory.reduce((sum, p) => sum + p.rowsScanned, 0);
  const totalActiveQueries = trendHistory.reduce((sum, p) => sum + p.activeQueriesCount, 0);
  const cacheHitCount = trendHistory.filter((p) => p.cacheHit).length;
  const simulatedFaultsCount = trendHistory.filter((p) => Boolean(p.simulatedError)).length;

  // Process and detect all latency anomalies
  const detectedAnomalies: AnomalyAuditReportPayload['latencyAnomalies'] = [];
  let maxVarianceObserved = 0;
  let highDurationCount = 0;
  let outlierSpikesCount = 0;
  let correlatedMutationIncidentsCount = 0;

  trendHistory.forEach((point, idx) => {
    const variance = point.executionTimeMs - baselineLatency;
    if (variance > maxVarianceObserved) {
      maxVarianceObserved = variance;
    }

    const highDurationResult = checkHighDurationFn(point, thresholdViolations);
    const isHighDuration = highDurationResult.isHighDurationMutation;
    const isOutlierVariance = variance >= anomalyThreshold;
    const isSlaBreached = point.executionTimeMs > 60;

    // Qualify as an anomaly if high duration mutation, outlier variance above threshold, or severe SLA breach
    if (isHighDuration || isOutlierVariance || isSlaBreached) {
      if (isHighDuration) highDurationCount++;
      if (isOutlierVariance && !isHighDuration) outlierSpikesCount++;

      let classification: AnomalyAuditReportPayload['latencyAnomalies'][0]['anomalyClassification'] =
        'Outlier Spike';
      if (isHighDuration) {
        classification = 'High-Duration Mutation';
      } else if (isSlaBreached && variance >= anomalyThreshold) {
        classification = 'Outlier Spike';
      } else if (isSlaBreached) {
        classification = 'SLA Breach';
      } else {
        classification = 'Degraded Latency';
      }

      let severity: AnomalyAuditReportPayload['latencyAnomalies'][0]['severity'] = 'LOW';
      if (point.executionTimeMs >= 100 || (isHighDuration && variance >= 50)) {
        severity = 'CRITICAL';
      } else if (point.executionTimeMs >= 50 || isHighDuration || isOutlierVariance) {
        severity = 'HIGH';
      } else if (point.executionTimeMs >= 15) {
        severity = 'MEDIUM';
      }

      const pointTime = point.timestamp || Date.now();
      const mFreq = calculatePointMutationFreqFn(
        point,
        trendHistory,
        mutationHistory,
        thresholdViolations,
        dataTapeEntries
      );

      // Find correlated violation or mutation
      let correlatedMutationData: AnomalyAuditReportPayload['latencyAnomalies'][0]['correlatedMutation'] = null;
      if (highDurationResult.violation) {
        const v = highDurationResult.violation;
        correlatedMutationData = {
          isCorrelated: true,
          mutationId: v.mutationId,
          description: v.mutationDescription,
          thresholdSeconds: v.thresholdSeconds,
          elapsedSeconds: v.elapsedSeconds,
          thresholdExceededBySeconds: Number((v.elapsedSeconds - v.thresholdSeconds).toFixed(2)),
          violationTimestamp: v.timestamp
        };
        correlatedMutationIncidentsCount++;
      } else {
        // Look up within 30s window in mutationHistory
        const matchedMutation = mutationHistory.find((m) => {
          const mTime = m.startedAt || m.completedAt || 0;
          return mTime > 0 && Math.abs(mTime - pointTime) <= 30000;
        });

        if (matchedMutation) {
          const duration =
            matchedMutation.durationMs !== undefined
              ? matchedMutation.durationMs / 1000
              : (matchedMutation.completedAt && matchedMutation.startedAt
                ? (matchedMutation.completedAt - matchedMutation.startedAt) / 1000
                : 0);
          correlatedMutationData = {
            isCorrelated: true,
            mutationId: matchedMutation.id,
            description: matchedMutation.description,
            thresholdSeconds: mutationThreshold,
            elapsedSeconds: Number(duration.toFixed(2)),
            thresholdExceededBySeconds: duration > mutationThreshold ? Number((duration - mutationThreshold).toFixed(2)) : 0,
            violationTimestamp: matchedMutation.startedAt
          };
          correlatedMutationIncidentsCount++;
        }
      }

      detectedAnomalies.push({
        sequenceIndex: idx,
        pointId: point.id,
        timestamp: point.timestamp,
        timeIso: new Date(point.timestamp).toISOString(),
        timeFormatted: point.timeFormatted,
        triggerEvent: point.triggerEvent,
        executionLatencyMs: Number(point.executionTimeMs.toFixed(2)),
        baselineLatencyMs: Number(baselineLatency.toFixed(2)),
        latencyVarianceAboveBaselineMs: Number(variance.toFixed(2)),
        latencyDeltaVsPreviousMs: point.deltaMs !== undefined ? Number(point.deltaMs.toFixed(2)) : null,
        anomalyClassification: classification,
        severity,
        slaStatus: point.executionTimeMs < 15 ? 'MET (<15ms)' : point.executionTimeMs <= 60 ? 'ACCEPTABLE (15-60ms)' : 'BREACHED (>60ms)',
        isHighDurationMutation: Boolean(isHighDuration),
        correlatedMutation: correlatedMutationData,
        mutationFrequencyAtSnapshot: {
          eventsPerMinute: mFreq,
          isElevatedConcurrency: mFreq >= 4
        },
        technicalSpecifications: {
          accessMethod: deriveAccessMethod(point),
          rowsScanned: point.rowsScanned,
          activeQueriesCount: point.activeQueriesCount,
          cacheHit: Boolean(point.cacheHit),
          simulatedError: point.simulatedError || null,
          activeFlags: point.flags
        }
      });
    }
  });

  // Consolidate correlated mutation events from mutationHistory and thresholdViolations
  const consolidatedMutationsMap = new Map<string, AnomalyAuditReportPayload['correlatedMutationEvents'][0]>();

  // Add all from mutationHistory
  mutationHistory.forEach((m) => {
    const duration =
      m.durationMs !== undefined
        ? m.durationMs / 1000
        : (m.completedAt && m.startedAt ? (m.completedAt - m.startedAt) / 1000 : 0);
    const exceeded = duration > mutationThreshold;

    // Check if correlated with any anomaly latency spike
    const spike = detectedAnomalies.find(
      (a) =>
        a.correlatedMutation?.mutationId === m.id ||
        (m.startedAt && Math.abs(a.timestamp - m.startedAt) <= 30000)
    );

    consolidatedMutationsMap.set(m.id, {
      mutationId: m.id,
      description: m.description,
      type: m.type,
      startedAt: m.startedAt,
      startedAtIso: m.startedAt ? new Date(m.startedAt).toISOString() : null,
      completedAt: m.completedAt || null,
      completedAtIso: m.completedAt ? new Date(m.completedAt).toISOString() : null,
      durationSeconds: Number(duration.toFixed(2)),
      thresholdSeconds: mutationThreshold,
      thresholdExceeded: exceeded,
      excessSeconds: exceeded ? Number((duration - mutationThreshold).toFixed(2)) : 0,
      status: m.completedAt ? 'completed' : 'in_progress',
      correlatedLatencySpikeMs: spike ? spike.executionLatencyMs : undefined
    });
  });

  // Ensure any threshold violations not yet in mutationHistory are captured
  thresholdViolations.forEach((v) => {
    if (!consolidatedMutationsMap.has(v.mutationId)) {
      const exceeded = v.elapsedSeconds > v.thresholdSeconds;
      consolidatedMutationsMap.set(v.mutationId, {
        mutationId: v.mutationId,
        description: v.mutationDescription,
        type: 'mutation_threshold_violation',
        startedAt: v.timestamp ? v.timestamp - v.elapsedSeconds * 1000 : null,
        startedAtIso: v.timestamp ? new Date(v.timestamp - v.elapsedSeconds * 1000).toISOString() : null,
        completedAt: v.timestamp || null,
        completedAtIso: v.timestamp ? new Date(v.timestamp).toISOString() : null,
        durationSeconds: Number(v.elapsedSeconds.toFixed(2)),
        thresholdSeconds: v.thresholdSeconds,
        thresholdExceeded: exceeded,
        excessSeconds: exceeded ? Number((v.elapsedSeconds - v.thresholdSeconds).toFixed(2)) : 0,
        status: 'threshold_violated',
        correlatedLatencySpikeMs: undefined
      });
    }
  });

  // Complete telemetry sequence with calculated mutation frequency
  const completeTelemetrySequence = trendHistory.map((p, idx) => ({
    sequenceIndex: idx,
    id: p.id,
    timestamp: p.timestamp,
    timeFormatted: p.timeFormatted,
    triggerEvent: p.triggerEvent,
    executionTimeMs: Number(p.executionTimeMs.toFixed(2)),
    deltaMs: p.deltaMs !== undefined ? Number(p.deltaMs.toFixed(2)) : undefined,
    rowsScanned: p.rowsScanned,
    activeQueriesCount: p.activeQueriesCount,
    cacheHit: p.cacheHit,
    isHighDurationMutation: p.isHighDurationMutation,
    mutationFrequencyPerMin: calculatePointMutationFreqFn(
      p,
      trendHistory,
      mutationHistory,
      thresholdViolations,
      dataTapeEntries
    ),
    flags: p.flags
  }));

  // Build auditor executive summary text
  const auditorSummary = [
    `Audit completed across ${trendHistory.length} continuous optimization snapshots.`,
    `Baseline latency achieved: ${minLatency.toFixed(2)}ms, Peak degradation: ${maxLatency.toFixed(2)}ms (P95: ${p95.toFixed(2)}ms).`,
    `Detected ${detectedAnomalies.length} latency anomalies (${highDurationCount} High-Duration Mutations, ${outlierSpikesCount} Outlier Spikes).`,
    highDurationCount > 0
      ? `Identified strong correlation between long-running database write transactions (> ${mutationThreshold}s threshold) and concurrent read latency degradation.`
      : `No severe write transaction threshold violations correlated with read latency spikes.`,
    `Current SLA Compliance: ${slaCompliancePercent}% (<15ms SLA target). Recommendation: Maintain B-Tree Indexing and LRU Query Caching to prevent seq scans and N+1 cascading read stalls.`
  ].join(' ');

  return {
    auditReportMetadata: {
      reportId: `ANOMALY-AUDIT-${now.getTime()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      reportTitle: 'Database Performance & Latency Anomaly Audit Report',
      reportFormat: 'JSON_PERFORMANCE_AUDIT',
      formatVersion: '2.4.0',
      generatedAt: now.toISOString(),
      generatedTimestamp: now.getTime(),
      auditedSystem: 'Database Query & UI Performance Optimizer',
      tableContext: {
        tableName: 'transactions',
        totalHeapRows: 50000,
        partitioning: 'Single-Node Heap Table with B-Tree Index'
      },
      auditCriteria: {
        configuredAnomalyThresholdMs: anomalyThreshold,
        configuredMutationThresholdSeconds: mutationThreshold,
        targetSlaMs: 15.0,
        acceptableThresholdMs: 60.0
      },
      auditorExecutiveSummary: auditorSummary
    },
    systemPerformanceMetrics: {
      latencySummary: {
        totalSnapshotsAnalyzed: trendHistory.length,
        baselineLatencyMs: Number(baselineLatency.toFixed(2)),
        meanLatencyMs: Number(meanLatency.toFixed(2)),
        medianLatencyMs: Number(p50.toFixed(2)),
        minLatencyMs: Number(minLatency.toFixed(2)),
        maxLatencyMs: Number(maxLatency.toFixed(2)),
        p50LatencyMs: Number(p50.toFixed(2)),
        p90LatencyMs: Number(p90.toFixed(2)),
        p95LatencyMs: Number(p95.toFixed(2)),
        p99LatencyMs: Number(p99.toFixed(2)),
        standardDeviationMs: Number(stdDevLatency.toFixed(2)),
        slaCompliancePercent,
        acceptableCompliancePercent,
        slaBreachPercent
      },
      workloadAndConcurrency: {
        totalRowsScanned,
        averageRowsScanned: trendHistory.length > 0 ? Math.round(totalRowsScanned / trendHistory.length) : 0,
        totalActiveQueriesRecorded: totalActiveQueries,
        averageActiveQueriesPerSnapshot: trendHistory.length > 0 ? Number((totalActiveQueries / trendHistory.length).toFixed(1)) : 0,
        cacheHitCount,
        cacheHitRatePercent: trendHistory.length > 0 ? Number(((cacheHitCount / trendHistory.length) * 100).toFixed(1)) : 0,
        simulatedFaultsCount
      },
      currentOptimizationFlags: currentFlags
    },
    anomalyDetectionSummary: {
      totalAnomaliesDetected: detectedAnomalies.length,
      highDurationMutationsCount: highDurationCount,
      outlierSpikesCount,
      slaBreachesCount: breachedCount,
      correlatedMutationIncidentsCount,
      maxVarianceObservedMs: Number(maxVarianceObserved.toFixed(2))
    },
    latencyAnomalies: detectedAnomalies,
    correlatedMutationEvents: Array.from(consolidatedMutationsMap.values()),
    completeTelemetrySequence
  };
}

/**
 * Generates and triggers browser download of the Anomaly Audit JSON file.
 */
export function exportAnomalyAuditJsonFile(
  options: Parameters<typeof generateAnomalyAuditReport>[0],
  customFilenamePrefix: string = 'database-latency-anomaly-audit'
): { report: AnomalyAuditReportPayload; filename: string; fileSizeBytes: number } {
  const report = generateAnomalyAuditReport(options);
  const jsonString = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${customFilenamePrefix}-${dateStr}.json`;

  triggerFileDownload(blob, filename);

  return {
    report,
    filename,
    fileSizeBytes: blob.size
  };
}
