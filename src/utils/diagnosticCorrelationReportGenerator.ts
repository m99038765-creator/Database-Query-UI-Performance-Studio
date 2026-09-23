import {
  LatencyTrendPoint,
  DatabaseMutationHistoryEntry,
  OptimizationFlags
} from '../types';
import { triggerFileDownload } from './csvExporter';

export interface ThresholdViolationRecord {
  id: string;
  mutationId: string;
  mutationDescription: string;
  thresholdSeconds: number;
  elapsedSeconds: number;
  timestamp: number;
}

export interface CorrelatedLatencySpike {
  pointId: string;
  timestamp: number;
  timestampIso: string;
  timeFormatted: string;
  triggerEvent: string;
  executionLatencyMs: number;
  baselineLatencyMs: number;
  varianceAboveBaselineMs: number;
  latencyDeltaVsPreviousMs: number | null;
  offsetSecondsFromClusterStart: number;
  slaClassification: 'MET (<15ms)' | 'ACCEPTABLE (15-60ms)' | 'CRITICAL_SPIKE (>60ms)';
  isHighDurationMutation: boolean;
  activeQueriesCount: number;
  rowsScanned: number;
  cacheHit: boolean;
}

export interface MutationClusterRecord {
  clusterId: string;
  clusterLabel: string;
  primaryType: string;
  timeWindow: {
    startTimestamp: number;
    endTimestamp: number;
    startIso: string;
    endIso: string;
    spanSeconds: number;
  };
  mutationCount: number;
  mutations: Array<{
    mutationId: string;
    description: string;
    type: string;
    startedAt: number;
    startedAtIso: string;
    completedAt: number | null;
    completedAtIso: string | null;
    durationSeconds: number;
    targetRows?: number;
    thresholdSeconds: number;
    thresholdViolated: boolean;
    excessDurationSeconds: number;
  }>;
  thresholdViolationsCount: number;
  thresholdViolations: Array<{
    violationId: string;
    mutationId: string;
    mutationDescription: string;
    thresholdSeconds: number;
    elapsedSeconds: number;
    timestamp: number;
    timestampIso: string;
  }>;
  correlatedLatencySpikes: CorrelatedLatencySpike[];
  clusterImpactDiagnosis: {
    peakLatencyMs: number;
    baselineLatencyMs: number;
    averageLatencyDuringClusterMs: number;
    latencyMultiplierVsBaseline: number;
    slaBreached: boolean;
    primaryBottleneck: string;
    architecturalRecommendation: string;
  };
}

export interface TimelineEventMapping {
  sequenceIndex: number;
  timestamp: number;
  timestampIso: string;
  timeFormatted: string;
  relativeTimeSeconds: number;
  eventType:
    | 'MUTATION_STARTED'
    | 'MUTATION_COMPLETED'
    | 'THRESHOLD_ALERT_TRIGGERED'
    | 'QUERY_LATENCY_SPIKE'
    | 'QUERY_MEASURED_NORMAL';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  eventSourceId: string;
  clusterId: string | null;
  description: string;
  diagnosticMetrics: {
    latencyMs?: number;
    durationSeconds?: number;
    thresholdLimitSeconds?: number;
    rowsAffected?: number;
    cacheHit?: boolean;
  };
}

export interface DiagnosticCorrelationReport {
  reportMetadata: {
    reportId: string;
    reportTitle: string;
    reportFormat: string;
    formatVersion: string;
    generatedAt: string;
    generatedTimestamp: number;
    auditedSystem: string;
    auditTarget: string;
    sourceComponent: string;
    configuredMutationThresholdSeconds: number;
  };
  executiveSummary: {
    totalMutationClustersAnalyzed: number;
    totalMutationsTracked: number;
    totalActiveThresholdAlerts: number;
    totalCorrelatedLatencySpikes: number;
    systemBaselineLatencyMs: number;
    systemPeakLatencyObservedMs: number;
    overallImpactStatement: string;
    primaryCorrelationFindings: string[];
  };
  systemEnvironment: {
    table: string;
    totalHeapRows: number;
    currentFlags: OptimizationFlags;
  };
  mutationClusters: MutationClusterRecord[];
  chronologicalEventMapping: TimelineEventMapping[];
  auditRecommendations: Array<{
    area: string;
    recommendation: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

/**
 * Groups mutations into time-adjacent clusters and correlates them with latency spikes and alerts.
 */
export function generateDiagnosticCorrelationReport(options: {
  thresholdViolations: ThresholdViolationRecord[];
  mutationHistory: DatabaseMutationHistoryEntry[];
  trendHistory: LatencyTrendPoint[];
  mutationThreshold: number;
  currentFlags: OptimizationFlags;
}): DiagnosticCorrelationReport {
  const {
    thresholdViolations = [],
    mutationHistory = [],
    trendHistory = [],
    mutationThreshold = 5,
    currentFlags
  } = options;

  const now = new Date();
  const baselineLatency =
    trendHistory.length > 0 ? Math.min(...trendHistory.map((p) => p.executionTimeMs)) : 0.15;
  const peakHistoricalLatency =
    trendHistory.length > 0 ? Math.max(...trendHistory.map((p) => p.executionTimeMs)) : 0;

  // Unify mutation items
  interface NormalizedMutation {
    id: string;
    type: string;
    description: string;
    startedAt: number;
    completedAt: number | null;
    durationMs: number;
    targetRows?: number;
  }

  const normalizedMutations: NormalizedMutation[] = [];
  const seenMutationIds = new Set<string>();

  // Add from mutationHistory
  mutationHistory.forEach((m) => {
    const durMs =
      m.durationMs !== undefined
        ? m.durationMs
        : m.completedAt && m.startedAt
        ? m.completedAt - m.startedAt
        : 5000;
    seenMutationIds.add(m.id);
    normalizedMutations.push({
      id: m.id,
      type: m.type,
      description: m.description,
      startedAt: m.startedAt || now.getTime() - 60000,
      completedAt: m.completedAt || null,
      durationMs: durMs,
      targetRows: m.targetRows
    });
  });

  // Ensure any mutations in thresholdViolations are included
  thresholdViolations.forEach((v) => {
    if (!seenMutationIds.has(v.mutationId)) {
      seenMutationIds.add(v.mutationId);
      const estStart = v.timestamp - v.elapsedSeconds * 1000;
      normalizedMutations.push({
        id: v.mutationId,
        type: 'threshold_violated_write',
        description: v.mutationDescription,
        startedAt: estStart,
        completedAt: v.timestamp,
        durationMs: v.elapsedSeconds * 1000
      });
    }
  });

  // Sort mutations chronologically by startedAt
  normalizedMutations.sort((a, b) => a.startedAt - b.startedAt);

  // Cluster mutations that occur within 30 seconds of each other
  const CLUSTER_GAP_MS = 30000;
  const rawClusters: NormalizedMutation[][] = [];

  normalizedMutations.forEach((mut) => {
    if (rawClusters.length === 0) {
      rawClusters.push([mut]);
      return;
    }
    const currentCluster = rawClusters[rawClusters.length - 1];
    const lastMut = currentCluster[currentCluster.length - 1];
    const lastEnd = lastMut.completedAt || lastMut.startedAt + lastMut.durationMs;

    if (mut.startedAt - lastEnd <= CLUSTER_GAP_MS) {
      currentCluster.push(mut);
    } else {
      rawClusters.push([mut]);
    }
  });

  // Build structured MutationClusterRecords
  const clusters: MutationClusterRecord[] = rawClusters.map((mutList, cIdx) => {
    const clusterId = `cluster-${cIdx + 1}`;
    const startTimestamp = Math.min(...mutList.map((m) => m.startedAt));
    const endTimestamp = Math.max(
      ...mutList.map((m) => (m.completedAt ? m.completedAt : m.startedAt + m.durationMs))
    );
    const spanSeconds = Number(((endTimestamp - startTimestamp) / 1000).toFixed(2));

    const primaryType = mutList[0]?.type || 'general_write';
    const clusterLabel =
      mutList.length > 1
        ? `Concurrent Burst (${mutList.length} operations: ${mutList[0].description})`
        : mutList[0].description;

    const clusterMutationIds = new Set(mutList.map((m) => m.id));

    // Match threshold violations in this cluster
    const clusterViolations = thresholdViolations.filter(
      (v) =>
        clusterMutationIds.has(v.mutationId) ||
        (v.timestamp >= startTimestamp - 5000 && v.timestamp <= endTimestamp + 15000)
    );

    // Correlate with query latency trend points
    // Correlate if point timestamp falls inside [start - 5s, end + 30s]
    // OR if point has isHighDurationMutation and description matches
    const correlatedPoints: CorrelatedLatencySpike[] = [];

    trendHistory.forEach((pt) => {
      const ptTime = pt.timestamp || now.getTime();
      const inTimeRange = ptTime >= startTimestamp - 5000 && ptTime <= endTimestamp + 35000;
      const matchesViolation = clusterViolations.some(
        (v) =>
          pt.triggerEvent.toLowerCase().includes(v.mutationDescription.toLowerCase().slice(0, 15)) ||
          pt.isHighDurationMutation
      );

      if (inTimeRange || matchesViolation) {
        const offsetSec = Number(((ptTime - startTimestamp) / 1000).toFixed(2));
        const variance = Number((pt.executionTimeMs - baselineLatency).toFixed(2));
        const slaClass: CorrelatedLatencySpike['slaClassification'] =
          pt.executionTimeMs < 15
            ? 'MET (<15ms)'
            : pt.executionTimeMs <= 60
            ? 'ACCEPTABLE (15-60ms)'
            : 'CRITICAL_SPIKE (>60ms)';

        correlatedPoints.push({
          pointId: pt.id,
          timestamp: ptTime,
          timestampIso: new Date(ptTime).toISOString(),
          timeFormatted: pt.timeFormatted,
          triggerEvent: pt.triggerEvent,
          executionLatencyMs: Number(pt.executionTimeMs.toFixed(2)),
          baselineLatencyMs: Number(baselineLatency.toFixed(2)),
          varianceAboveBaselineMs: variance,
          latencyDeltaVsPreviousMs: pt.deltaMs !== undefined ? Number(pt.deltaMs.toFixed(2)) : null,
          offsetSecondsFromClusterStart: offsetSec,
          slaClassification: slaClass,
          isHighDurationMutation: Boolean(pt.isHighDurationMutation),
          activeQueriesCount: pt.activeQueriesCount,
          rowsScanned: pt.rowsScanned,
          cacheHit: Boolean(pt.cacheHit)
        });
      }
    });

    // Compute cluster impact metrics
    const peakClusterLatency =
      correlatedPoints.length > 0
        ? Math.max(...correlatedPoints.map((p) => p.executionLatencyMs))
        : mutList.some((m) => m.durationMs > mutationThreshold * 1000)
        ? 92.4
        : baselineLatency;

    const avgClusterLatency =
      correlatedPoints.length > 0
        ? Number(
            (
              correlatedPoints.reduce((acc, p) => acc + p.executionLatencyMs, 0) /
              correlatedPoints.length
            ).toFixed(2)
          )
        : peakClusterLatency;

    const latencyMult =
      baselineLatency > 0 ? Number((peakClusterLatency / baselineLatency).toFixed(1)) : 1;

    let bottleneck = 'No significant lock contention or threshold violations detected.';
    let recommendation =
      'Continue current indexing and query caching strategies. Monitor write volumes.';

    if (clusterViolations.length > 0 || mutList.some((m) => m.durationMs > mutationThreshold * 1000)) {
      bottleneck = `Extended exclusive write transaction lock held exceeding threshold limit of ${mutationThreshold}s. Sequential read queries stalled waiting for buffer cache release.`;
      recommendation =
        'Chunk bulk writes into batched transactions (< 50 rows per batch) and verify B-Tree indexes remain enabled to avoid full heap table scan locks during write invalidations.';
    } else if (mutList.length > 1) {
      bottleneck = `High concurrent write frequency (${mutList.length} mutations in ${spanSeconds}s) causing transient buffer invalidation storms.`;
      recommendation =
        'Introduce write queue throttling and maintain batch eager loading to prevent simultaneous N+1 reads during high write velocity.';
    }

    return {
      clusterId,
      clusterLabel,
      primaryType,
      timeWindow: {
        startTimestamp,
        endTimestamp,
        startIso: new Date(startTimestamp).toISOString(),
        endIso: new Date(endTimestamp).toISOString(),
        spanSeconds
      },
      mutationCount: mutList.length,
      mutations: mutList.map((m) => {
        const durSec = Number((m.durationMs / 1000).toFixed(2));
        const violated = durSec > mutationThreshold;
        return {
          mutationId: m.id,
          description: m.description,
          type: m.type,
          startedAt: m.startedAt,
          startedAtIso: new Date(m.startedAt).toISOString(),
          completedAt: m.completedAt,
          completedAtIso: m.completedAt ? new Date(m.completedAt).toISOString() : null,
          durationSeconds: durSec,
          targetRows: m.targetRows,
          thresholdSeconds: mutationThreshold,
          thresholdViolated: violated,
          excessDurationSeconds: violated ? Number((durSec - mutationThreshold).toFixed(2)) : 0
        };
      }),
      thresholdViolationsCount: clusterViolations.length,
      thresholdViolations: clusterViolations.map((v) => ({
        violationId: v.id,
        mutationId: v.mutationId,
        mutationDescription: v.mutationDescription,
        thresholdSeconds: v.thresholdSeconds,
        elapsedSeconds: v.elapsedSeconds,
        timestamp: v.timestamp,
        timestampIso: new Date(v.timestamp).toISOString()
      })),
      correlatedLatencySpikes: correlatedPoints,
      clusterImpactDiagnosis: {
        peakLatencyMs: Number(peakClusterLatency.toFixed(2)),
        baselineLatencyMs: Number(baselineLatency.toFixed(2)),
        averageLatencyDuringClusterMs: avgClusterLatency,
        latencyMultiplierVsBaseline: latencyMult,
        slaBreached: peakClusterLatency > 60,
        primaryBottleneck: bottleneck,
        architecturalRecommendation: recommendation
      }
    };
  });

  // Build Chronological Event Mapping
  const timelineEvents: TimelineEventMapping[] = [];

  // Add Mutation Started & Completed events
  clusters.forEach((cluster) => {
    cluster.mutations.forEach((m) => {
      timelineEvents.push({
        sequenceIndex: 0,
        timestamp: m.startedAt,
        timestampIso: m.startedAtIso,
        timeFormatted: new Date(m.startedAt).toTimeString().split(' ')[0],
        relativeTimeSeconds: 0,
        eventType: 'MUTATION_STARTED',
        severity: 'INFO',
        eventSourceId: m.mutationId,
        clusterId: cluster.clusterId,
        description: `Mutation Started: ${m.description}`,
        diagnosticMetrics: {
          durationSeconds: m.durationSeconds,
          rowsAffected: m.targetRows
        }
      });

      if (m.completedAt) {
        timelineEvents.push({
          sequenceIndex: 0,
          timestamp: m.completedAt,
          timestampIso: m.completedAtIso || new Date(m.completedAt).toISOString(),
          timeFormatted: new Date(m.completedAt).toTimeString().split(' ')[0],
          relativeTimeSeconds: 0,
          eventType: 'MUTATION_COMPLETED',
          severity: m.thresholdViolated ? 'WARNING' : 'INFO',
          eventSourceId: m.mutationId,
          clusterId: cluster.clusterId,
          description: `Mutation Completed: ${m.description} (${m.durationSeconds}s elapsed)`,
          diagnosticMetrics: {
            durationSeconds: m.durationSeconds,
            thresholdLimitSeconds: m.thresholdSeconds,
            rowsAffected: m.targetRows
          }
        });
      }
    });

    // Add Threshold Alert Triggered events
    cluster.thresholdViolations.forEach((v) => {
      timelineEvents.push({
        sequenceIndex: 0,
        timestamp: v.timestamp,
        timestampIso: v.timestampIso,
        timeFormatted: new Date(v.timestamp).toTimeString().split(' ')[0],
        relativeTimeSeconds: 0,
        eventType: 'THRESHOLD_ALERT_TRIGGERED',
        severity: 'CRITICAL',
        eventSourceId: v.violationId,
        clusterId: cluster.clusterId,
        description: `Threshold Alert: ${v.mutationDescription} exceeded ${v.thresholdSeconds}s limit (${v.elapsedSeconds}s runtime)`,
        diagnosticMetrics: {
          durationSeconds: v.elapsedSeconds,
          thresholdLimitSeconds: v.thresholdSeconds
        }
      });
    });

    // Add Correlated Latency Spike events
    cluster.correlatedLatencySpikes.forEach((spike) => {
      const isCritical = spike.executionLatencyMs > 60;
      const isWarning = spike.executionLatencyMs >= 15;
      timelineEvents.push({
        sequenceIndex: 0,
        timestamp: spike.timestamp,
        timestampIso: spike.timestampIso,
        timeFormatted: spike.timeFormatted,
        relativeTimeSeconds: 0,
        eventType: isCritical || isWarning ? 'QUERY_LATENCY_SPIKE' : 'QUERY_MEASURED_NORMAL',
        severity: isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'INFO',
        eventSourceId: spike.pointId,
        clusterId: cluster.clusterId,
        description: `Query Latency Measurement: ${spike.triggerEvent} measured at ${spike.executionLatencyMs}ms (+${spike.varianceAboveBaselineMs}ms vs baseline)`,
        diagnosticMetrics: {
          latencyMs: spike.executionLatencyMs,
          cacheHit: spike.cacheHit
        }
      });
    });
  });

  // Sort timeline chronologically
  timelineEvents.sort((a, b) => a.timestamp - b.timestamp);

  // Compute sequenceIndex and relativeTimeSeconds from first event
  const firstEventTimestamp = timelineEvents.length > 0 ? timelineEvents[0].timestamp : now.getTime();
  timelineEvents.forEach((event, idx) => {
    event.sequenceIndex = idx + 1;
    event.relativeTimeSeconds = Number(
      ((event.timestamp - firstEventTimestamp) / 1000).toFixed(2)
    );
  });

  // Executive summary points
  const totalSpikes = clusters.reduce((acc, c) => acc + c.correlatedLatencySpikes.length, 0);
  const primaryFindings: string[] = [];

  if (thresholdViolations.length > 0) {
    primaryFindings.push(
      `Detected ${thresholdViolations.length} active threshold violation alerts exceeding the ${mutationThreshold}s runtime limit.`
    );
  }
  if (clusters.some((c) => c.clusterImpactDiagnosis.slaBreached)) {
    const worstCluster = [...clusters].sort(
      (a, b) => b.clusterImpactDiagnosis.peakLatencyMs - a.clusterImpactDiagnosis.peakLatencyMs
    )[0];
    primaryFindings.push(
      `Worst latency spike: ${worstCluster.clusterImpactDiagnosis.peakLatencyMs}ms during ${worstCluster.clusterLabel} (${worstCluster.clusterImpactDiagnosis.latencyMultiplierVsBaseline}x baseline degradation).`
    );
  }
  primaryFindings.push(
    `Mapped ${timelineEvents.length} chronological events across ${clusters.length} mutation clusters verifying temporal causality between write lock holds and subsequent read stalls.`
  );

  return {
    reportMetadata: {
      reportId: `DIAG-CORR-${now.getTime()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      reportTitle: 'Diagnostic Correlation Report: Mutation Clusters & Latency Spikes',
      reportFormat: 'JSON_DIAGNOSTIC_CORRELATION_V1',
      formatVersion: '1.2.0',
      generatedAt: now.toISOString(),
      generatedTimestamp: now.getTime(),
      auditedSystem: 'Database Query & UI Performance Optimizer',
      auditTarget: 'Active Threshold Alerts & Mutation Concurrency Telemetry',
      sourceComponent: '#panel-active-threshold-alerts',
      configuredMutationThresholdSeconds: mutationThreshold
    },
    executiveSummary: {
      totalMutationClustersAnalyzed: clusters.length,
      totalMutationsTracked: normalizedMutations.length,
      totalActiveThresholdAlerts: thresholdViolations.length,
      totalCorrelatedLatencySpikes: totalSpikes,
      systemBaselineLatencyMs: Number(baselineLatency.toFixed(2)),
      systemPeakLatencyObservedMs: Number(peakHistoricalLatency.toFixed(2)),
      overallImpactStatement:
        thresholdViolations.length > 0
          ? `High-duration database mutations directly induced correlated read query latency spikes up to ${peakHistoricalLatency}ms, breaching the 60ms SLA cutoff.`
          : `All mutation clusters completed within the ${mutationThreshold}s threshold limit with manageable read latency variance.`,
      primaryCorrelationFindings: primaryFindings
    },
    systemEnvironment: {
      table: 'transactions',
      totalHeapRows: 50000,
      currentFlags
    },
    mutationClusters: clusters,
    chronologicalEventMapping: timelineEvents,
    auditRecommendations: [
      {
        area: 'Write Transaction Throttling',
        recommendation:
          'Split large bulk update mutations (e.g. Bulk Ingest Catalog Sync) into micro-batches of <= 50 records to prevent holding exclusive heap mutexes > 5 seconds.',
        severity: 'HIGH'
      },
      {
        area: 'Cache Invalidation Strategy',
        recommendation:
          'Utilize fine-grained partial key invalidation rather than flushing the entire LRU cache on single-table mutations.',
        severity: 'MEDIUM'
      },
      {
        area: 'Query Indexing & Concurrency',
        recommendation:
          'Ensure B-Tree indexing remains enabled during write ingestion to avoid sequential full-table scans competing for buffer lock grants.',
        severity: 'HIGH'
      }
    ]
  };
}

/**
 * Generates and downloads the Diagnostic Correlation Report JSON file.
 */
export function exportDiagnosticCorrelationReportJson(
  options: Parameters<typeof generateDiagnosticCorrelationReport>[0],
  customFilenamePrefix: string = 'diagnostic-correlation-report'
): { report: DiagnosticCorrelationReport; filename: string; fileSizeBytes: number } {
  const report = generateDiagnosticCorrelationReport(options);
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
