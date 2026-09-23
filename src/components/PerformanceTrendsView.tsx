import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  LatencyTrendPoint,
  OptimizationFlags,
  DataTapeEntry,
  SerializationLogEntry,
  DatabaseMutationHistoryEntry
} from '../types';
import { ExportHistoryPoint } from '../utils/csvExporter';
import { ExportFrequencyCpuCorrelationChart } from './ExportFrequencyCpuCorrelationChart';
import { SnapshotCompareModal } from './SnapshotCompareModal';
import { DatabaseStatePopover } from './DatabaseStatePopover';
import { PdfReportModal } from './PdfReportModal';
import { SerializationErrorLogPanel } from './SerializationErrorLogPanel';
import { playAnomalyChime } from '../utils/soundEffects';
import { createLatencyAnomalyLog } from '../utils/serializationLogger';
import { exportAnomalyAuditJsonFile } from '../utils/anomalyAuditReportGenerator';
import {
  TrendingDown,
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Columns,
  XCircle,
  TrendingUp,
  Minus,
  FileText,
  Download,
  Tag,
  Radio,
  Pause,
  Bell,
  BellOff,
  ShieldAlert,
  Volume2,
  X
} from 'lucide-react';

interface PerformanceTrendsViewProps {
  trendHistory: LatencyTrendPoint[];
  currentFlags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onToggleAll: (enable: boolean) => void;
  onClearHistory: () => void;
  onRunOptimizationSequence: () => void;
  isSimulatingSequence: boolean;
  onAppendTrendPoint?: (point: LatencyTrendPoint) => void;
  dataTapeEntries?: DataTapeEntry[];
  exportHistory?: ExportHistoryPoint[];
  onTriggerAuditBurst?: () => void;
  serializationLogs?: SerializationLogEntry[];
  onLogLatencyAnomaly?: (log: SerializationLogEntry) => void;
  onClearSerializationLogs?: () => void;
  onDismissSerializationLog?: (id: string) => void;
  onSimulateFault?: (mode: 'failure' | 'throughput_anomaly' | 'cpu_spike' | 'latency_anomaly') => void;
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
}


export interface EventAnnotationConfig {
  label: string;
  subLabel: string;
  badgeType: 'bulk_ingest' | 'spike' | 'baseline' | 'optimized' | 'reset';
  bgColor: string;
  borderColor: string;
  textColor: string;
  subTextColor: string;
  leaderColor: string;
  isSpike: boolean;
}

export function checkHighDurationMutationCorrelation(
  point: LatencyTrendPoint,
  violations: Array<{
    id?: string;
    mutationId?: string;
    mutationDescription?: string;
    thresholdSeconds?: number;
    elapsedSeconds?: number;
    timestamp?: number;
  }> = []
): {
  isHighDurationMutation: boolean;
  violation?: {
    mutationDescription?: string;
    thresholdSeconds?: number;
    elapsedSeconds?: number;
    timestamp?: number;
  };
  reason: string;
} {
  // 1. Explicit property flag on data point
  if (point.isHighDurationMutation) {
    return {
      isHighDurationMutation: true,
      violation: point.correlatedThresholdViolation,
      reason: point.correlatedThresholdViolation
        ? `Exceeded ${point.correlatedThresholdViolation.thresholdSeconds || 5}s threshold (${point.correlatedThresholdViolation.elapsedSeconds || 5}s)`
        : 'Flagged as High-Duration Mutation'
    };
  }

  const evt = point.triggerEvent || '';
  const evtLower = evt.toLowerCase();

  if (
    evtLower.includes('high-duration mutation') ||
    evtLower.includes('high duration mutation') ||
    (evtLower.includes('mutation') && evtLower.includes('threshold violation'))
  ) {
    return {
      isHighDurationMutation: true,
      reason: 'Trigger event explicitly identifies threshold violation'
    };
  }

  // 2. Correlation with registered threshold violations
  if (violations && violations.length > 0) {
    for (const v of violations) {
      if (!v) continue;
      const vTime = v.timestamp || 0;
      const durationMs = Math.max((v.elapsedSeconds || 5) * 1000, 5000) + 15000;
      const timeDiff = Math.abs(point.timestamp - vTime);

      const vDesc = (v.mutationDescription || '').toLowerCase();
      const keywords = vDesc.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
      const matchesKeyword = keywords.some((k) => evtLower.includes(k));

      if (timeDiff <= durationMs || matchesKeyword) {
        return {
          isHighDurationMutation: true,
          violation: v,
          reason: `Correlated with ${v.mutationDescription || 'Mutation'} (${v.elapsedSeconds || 5}s > ${v.thresholdSeconds || 5}s)`
        };
      }
    }
  }

  return { isHighDurationMutation: false, reason: '' };
}

export function getPointAnnotation(
  point: LatencyTrendPoint,
  thresholdViolations: Array<{
    id?: string;
    mutationId?: string;
    mutationDescription?: string;
    thresholdSeconds?: number;
    elapsedSeconds?: number;
    timestamp?: number;
  }> = []
): EventAnnotationConfig | null {
  // 0. High-Duration Mutation: Check correlation with mutation threshold violations
  const highDuration = checkHighDurationMutationCorrelation(point, thresholdViolations);
  if (highDuration.isHighDurationMutation) {
    const subLabel = highDuration.violation
      ? `>${highDuration.violation.thresholdSeconds || 5}s limit (${point.executionTimeMs.toFixed(1)}ms)`
      : `Threshold Violated (${point.executionTimeMs.toFixed(1)}ms)`;

    return {
      label: '⚡ High-Duration Mutation',
      subLabel,
      badgeType: 'spike',
      bgColor: '#fff1f2',
      borderColor: '#e11d48',
      textColor: '#9f1239',
      subTextColor: '#be123c',
      leaderColor: '#e11d48',
      isSpike: true
    };
  }

  const evt = point.triggerEvent || '';
  const evtLower = evt.toLowerCase();

  // 1. Bulk Ingest events (User-triggered or simulated data ingestion)
  if (evtLower.includes('bulk ingest') || evtLower.includes('bulk load') || evtLower.includes('ingest +')) {
    const isUnindexed = evtLower.includes('unindexed') || evtLower.includes('raw');
    const isSingleRow = evtLower.includes('single-row') || evtLower.includes('unbatched');

    const matchCount = evt.match(/\+([\d,]+k?)/i);
    const countStr = matchCount ? matchCount[1] : '';

    if (isUnindexed) {
      return {
        label: countStr ? `⚡ Bulk Ingest +${countStr}` : '⚡ Bulk Ingest (Raw)',
        subLabel: `Unindexed (${point.executionTimeMs.toFixed(1)}ms)`,
        badgeType: 'bulk_ingest',
        bgColor: '#fff1f2',
        borderColor: '#f43f5e',
        textColor: '#9f1239',
        subTextColor: '#e11d48',
        leaderColor: '#f43f5e',
        isSpike: true
      };
    }

    if (isSingleRow) {
      return {
        label: countStr ? `⚠️ Bulk Ingest +${countStr}` : '⚠️ Bulk Ingest',
        subLabel: `Single-Row (${point.executionTimeMs.toFixed(1)}ms)`,
        badgeType: 'bulk_ingest',
        bgColor: '#fff7ed',
        borderColor: '#fb923c',
        textColor: '#9a3412',
        subTextColor: '#ea580c',
        leaderColor: '#fb923c',
        isSpike: true
      };
    }

    return {
      label: countStr ? `📦 Bulk Ingest +${countStr}` : '📦 Bulk Ingest',
      subLabel: `B-Tree Indexed (${point.executionTimeMs.toFixed(1)}ms)`,
      badgeType: 'bulk_ingest',
      bgColor: '#eff6ff',
      borderColor: '#3b82f6',
      textColor: '#1e40af',
      subTextColor: '#2563eb',
      leaderColor: '#3b82f6',
      isSpike: false
    };
  }

  // 2. Baseline or All Optimizations Disabled
  if (evtLower.includes('all flags off') || evtLower.includes('all optimizations disabled') || evt.includes('Baseline')) {
    return {
      label: '⚠️ Baseline (All OFF)',
      subLabel: `50k Seq Scan (${point.executionTimeMs.toFixed(0)}ms)`,
      badgeType: 'baseline',
      bgColor: '#fef2f2',
      borderColor: '#ef4444',
      textColor: '#991b1b',
      subTextColor: '#dc2626',
      leaderColor: '#ef4444',
      isSpike: true
    };
  }

  // 3. Database Reindex / Reset
  if (evtLower.includes('reindex') || evtLower.includes('database reset')) {
    return {
      label: evtLower.includes('reindex') ? '🔧 B-Tree Reindexed' : '🔄 Baseline Reset',
      subLabel: `Compacted (${point.executionTimeMs.toFixed(1)}ms)`,
      badgeType: 'reset',
      bgColor: '#ecfdf5',
      borderColor: '#10b981',
      textColor: '#065f46',
      subTextColor: '#059669',
      leaderColor: '#10b981',
      isSpike: false
    };
  }

  // 4. Standalone major Latency Spikes (deltaMs >= 50ms)
  if (point.deltaMs && point.deltaMs >= 50 && !evtLower.includes('filter')) {
    return {
      label: '⚠️ Latency Spike',
      subLabel: `+${point.deltaMs.toFixed(0)}ms (${point.executionTimeMs.toFixed(0)}ms)`,
      badgeType: 'spike',
      bgColor: '#fff1f2',
      borderColor: '#f43f5e',
      textColor: '#9f1239',
      subTextColor: '#e11d48',
      leaderColor: '#f43f5e',
      isSpike: true
    };
  }

  // 5. Periodic Background Daemon Harvest / Sync (Live Streaming)
  if (evtLower.includes('daemon harvest')) {
    const isLag = evtLower.includes('lag');
    return {
      label: isLag ? '⏱️ Daemon Sync Lag' : '⚡ Daemon Sync',
      subLabel: `${point.executionTimeMs.toFixed(1)}ms (${point.activeQueriesCount} q)`,
      badgeType: isLag ? 'spike' : 'optimized',
      bgColor: isLag ? '#fff7ed' : '#f0fdf4',
      borderColor: isLag ? '#f97316' : '#22c55e',
      textColor: isLag ? '#9a3412' : '#166534',
      subTextColor: isLag ? '#ea580c' : '#15803d',
      leaderColor: isLag ? '#f97316' : '#22c55e',
      isSpike: isLag
    };
  }

  return null;
}

/**
 * Calculates the number of database mutation events occurring per minute
 * around a specific point's timestamp to visualize the correlation between
 * high write concurrency and read latency spikes.
 */
export function calculatePointMutationFrequency(
  point: LatencyTrendPoint,
  allPoints: LatencyTrendPoint[] = [],
  mutationHistory: DatabaseMutationHistoryEntry[] = [],
  thresholdViolations: Array<{ timestamp?: number; mutationDescription?: string }> = [],
  dataTapeEntries: DataTapeEntry[] = []
): number {
  if (typeof point.mutationFrequencyPerMin === 'number') {
    return point.mutationFrequencyPerMin;
  }

  const pointTime = point.timestamp || Date.now();
  const halfWindowMs = 30000; // 30s before and 30s after = 60-second window (1 minute)

  let count = 0;

  // 1. In-flight and historical database mutations within the 1-minute window
  mutationHistory.forEach((m) => {
    const mTime = m.startedAt || m.completedAt || 0;
    if (mTime > 0 && Math.abs(mTime - pointTime) <= halfWindowMs) {
      count++;
    }
  });

  // 2. High-duration mutation threshold violations within the window
  thresholdViolations.forEach((v) => {
    if (v.timestamp && Math.abs(v.timestamp - pointTime) <= halfWindowMs) {
      count++;
    }
  });

  // 3. Data tape entries generated by bulk ingestion/mutations within the window
  dataTapeEntries.forEach((t) => {
    if (t.timestamp && Math.abs(t.timestamp - pointTime) <= halfWindowMs) {
      const trig = (t.triggerEvent || '').toLowerCase();
      if (
        trig.includes('ingest') ||
        trig.includes('batch') ||
        trig.includes('status') ||
        trig.includes('mutation')
      ) {
        count++;
      }
    }
  });

  // 4. Other trend points in the sequence representing mutations within the window
  allPoints.forEach((p) => {
    if (p.id !== point.id && Math.abs(p.timestamp - pointTime) <= halfWindowMs) {
      const pEvt = (p.triggerEvent || '').toLowerCase();
      if (
        p.isHighDurationMutation ||
        pEvt.includes('bulk') ||
        pEvt.includes('ingest') ||
        pEvt.includes('mutation') ||
        pEvt.includes('transition') ||
        pEvt.includes('append')
      ) {
        count++;
      }
    }
  });

  // 5. If this point itself is a mutation, include it and scale for batch magnitude
  const thisEvt = (point.triggerEvent || '').toLowerCase();
  const isDirectMutation =
    point.isHighDurationMutation ||
    thisEvt.includes('bulk') ||
    thisEvt.includes('ingest') ||
    thisEvt.includes('mutation') ||
    thisEvt.includes('transition') ||
    thisEvt.includes('append');

  if (isDirectMutation) {
    count++;
    // Bulk ingests (such as seed-3 with 120 or 15,000 rows) or high-duration mutations exhibit high burst frequency
    if (thisEvt.includes('bulk') || point.isHighDurationMutation) {
      count = Math.max(count, 8);
    } else if (thisEvt.includes('transition') || thisEvt.includes('flag')) {
      count = Math.max(count, 4);
    }
  }

  return count;
}

export const PerformanceTrendsView: React.FC<PerformanceTrendsViewProps> = ({
  trendHistory,
  currentFlags,
  onToggleFlag,
  onToggleAll,
  onClearHistory,
  onRunOptimizationSequence,
  isSimulatingSequence,
  onAppendTrendPoint,
  dataTapeEntries = [],
  exportHistory = [],
  onTriggerAuditBurst,
  serializationLogs,
  onLogLatencyAnomaly,
  onClearSerializationLogs,
  onDismissSerializationLog,
  onSimulateFault,
  thresholdViolations = [],
  mutationThreshold = 5,
  mutationHistory = []
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const barChartRef = useRef<SVGSVGElement>(null);

  const [scaleType, setScaleType] = useState<'linear' | 'log'>('linear');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: LatencyTrendPoint;
    x: number;
    y: number;
  } | null>(null);

  // Real-Time 'Live' Mode State (Appends synthetic background metrics every 5 seconds)
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);
  const tickCounterRef = useRef<number>(0);
  const currentFlagsRef = useRef(currentFlags);
  const trendHistoryRef = useRef(trendHistory);

  useEffect(() => {
    currentFlagsRef.current = currentFlags;
  }, [currentFlags]);

  useEffect(() => {
    trendHistoryRef.current = trendHistory;
  }, [trendHistory]);

  // Real-time Synthetic Background Telemetry Interval (5 Seconds)
  useEffect(() => {
    if (!isLiveMode) {
      setCountdownSeconds(5);
      return;
    }

    // 1-second countdown ticker for UI responsiveness
    const countdownInterval = setInterval(() => {
      setCountdownSeconds((prev) => (prev <= 1 ? 5 : prev - 1));
    }, 1000);

    // 5-second interval generating synthetic background metric data point
    const liveMetricInterval = setInterval(() => {
      tickCounterRef.current += 1;
      const tick = tickCounterRef.current;
      const flags = currentFlagsRef.current;
      const history = trendHistoryRef.current;
      const now = new Date();
      const timeFormatted = now.toTimeString().split(' ')[0];

      // Subtle realistic execution jitter (+-12%)
      const jitter = 0.88 + Math.random() * 0.24;

      let baseLatency: number;
      let rowsScanned: number;
      let activeQueriesCount: number;
      let isCacheHit = false;
      let simulatedError: string | null = null;
      let triggerEvent: string;

      if (!flags.batchEagerLoading) {
        // Severe N+1 cascade
        baseLatency = (440 + Math.random() * 70) * jitter;
        rowsScanned = 50000;
        activeQueriesCount = 101;
        simulatedError = 'Database Connection Pool Timeout: max_connections (25) exceeded!';
        triggerEvent = 'Background Metric Ping: N+1 Cascade';
      } else if (!flags.btreeIndexing) {
        // Full table scan
        baseLatency = (48 + Math.random() * 14) * jitter;
        rowsScanned = 50000;
        activeQueriesCount = 1;
        triggerEvent = 'Background Metric Ping: 50k Seq Scan';
      } else if (flags.queryCaching && Math.random() < 0.75) {
        // Cache hit
        baseLatency = 0.12 + Math.random() * 0.16;
        rowsScanned = 100;
        activeQueriesCount = 1;
        isCacheHit = true;
        triggerEvent = 'Background Metric Ping: Cache Hit (LRU)';
      } else {
        // Indexed query probe
        baseLatency = (1.2 + Math.random() * 0.85) * jitter;
        rowsScanned = 2400 + Math.floor(Math.random() * 200);
        activeQueriesCount = 1;
        triggerEvent = 'Background Metric Ping: B-Tree Index Probe';
      }

      // Every 5th tick, simulate an occasional periodic background daemon harvest
      if (tick % 5 === 0) {
        triggerEvent = flags.btreeIndexing
          ? 'Background Daemon Harvest (Indexed)'
          : 'Background Daemon Harvest (Seq Scan Lag)';
      }

      const prevPoint = history[history.length - 1];
      const prevLatency = prevPoint ? prevPoint.executionTimeMs : baseLatency;
      const deltaMs = Number((baseLatency - prevLatency).toFixed(2));

      const newPoint: LatencyTrendPoint = {
        id: `pt-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        timeFormatted,
        executionTimeMs: Number(baseLatency.toFixed(2)),
        rowsScanned,
        activeQueriesCount,
        cacheHit: isCacheHit,
        flags: { ...flags },
        triggerEvent,
        deltaMs: Math.abs(deltaMs) > 0.05 ? deltaMs : undefined,
        simulatedError
      };

      if (onAppendTrendPoint) {
        onAppendTrendPoint(newPoint);
      }
    }, 5000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(liveMetricInterval);
    };
  }, [isLiveMode, onAppendTrendPoint]);

  // Snapshot Compare Mode state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareIndexA, setCompareIndexA] = useState<number>(0);
  const [compareIndexB, setCompareIndexB] = useState<number>(() => Math.max(0, trendHistory.length - 1));

  // PDF Benchmark Documentation Report Modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Technical Specs Popover state for clicked D3 chart point
  const [popoverPoint, setPopoverPoint] = useState<{
    point: LatencyTrendPoint;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 700, height: 360 });

  // On-Graph Text Annotations for Specific Events (Bulk Ingest, Spikes, Resets)
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Toggle for overlaying secondary Y-axis plotting mutation events per minute
  const [showMutationFrequency, setShowMutationFrequency] = useState(false);

  // Pre-calculated mutation frequencies for all points in trendHistory
  const pointMutationFreqs = useMemo(() => {
    return trendHistory.map((point) =>
      calculatePointMutationFrequency(
        point,
        trendHistory,
        mutationHistory,
        thresholdViolations,
        dataTapeEntries
      )
    );
  }, [trendHistory, mutationHistory, thresholdViolations, dataTapeEntries]);

  const maxMutationFreq = useMemo(() => {
    return Math.max(...pointMutationFreqs, 0);
  }, [pointMutationFreqs]);

  // Anomaly Threshold slider state (latency variance threshold in milliseconds)
  const [anomalyThreshold, setAnomalyThreshold] = useState<number>(50);

  // Statistical calculations for anomaly and variance detection
  const baselineLatency = useMemo(() => {
    if (trendHistory.length === 0) return 0;
    return Math.min(...trendHistory.map((p) => p.executionTimeMs));
  }, [trendHistory]);

  const meanLatency = useMemo(() => {
    if (trendHistory.length === 0) return 0;
    return trendHistory.reduce((sum, p) => sum + p.executionTimeMs, 0) / trendHistory.length;
  }, [trendHistory]);

  const stdDevLatency = useMemo(() => {
    if (trendHistory.length <= 1) return 0;
    const variance =
      trendHistory.reduce((sum, p) => sum + Math.pow(p.executionTimeMs - meanLatency, 2), 0) /
      trendHistory.length;
    return Math.sqrt(variance);
  }, [trendHistory, meanLatency]);

  const effectiveAnomalyCutoff = useMemo(() => {
    return baselineLatency + anomalyThreshold;
  }, [baselineLatency, anomalyThreshold]);

  const outlierPoints = useMemo(() => {
    return trendHistory.filter((p) => {
      const variance = p.executionTimeMs - baselineLatency;
      return variance >= anomalyThreshold;
    });
  }, [trendHistory, baselineLatency, anomalyThreshold]);

  // Push-notifications & Browser Alerts state
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // State for Anomaly Audit Report export
  const [isExportingAnomalyReport, setIsExportingAnomalyReport] = useState(false);
  const [anomalyExportSuccessNotice, setAnomalyExportSuccessNotice] = useState<string | null>(null);

  const handleExportAnomalyReport = () => {
    setIsExportingAnomalyReport(true);
    try {
      const { filename, report } = exportAnomalyAuditJsonFile({
        trendHistory,
        baselineLatency,
        meanLatency,
        stdDevLatency,
        anomalyThreshold,
        thresholdViolations,
        mutationThreshold,
        mutationHistory,
        currentFlags,
        dataTapeEntries,
        checkHighDurationFn: checkHighDurationMutationCorrelation,
        calculatePointMutationFreqFn: calculatePointMutationFrequency
      });

      setAnomalyExportSuccessNotice(
        `Exported ${filename} (${report.anomalyDetectionSummary.totalAnomaliesDetected} anomalies, ${report.correlatedMutationEvents.length} mutation records)`
      );
      setTimeout(() => {
        setAnomalyExportSuccessNotice(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to export anomaly audit report JSON:', err);
    } finally {
      setIsExportingAnomalyReport(false);
    }
  };

  // Track which outlier spike point IDs have been logged to avoid duplicated logs
  const loggedSpikeIdsRef = useRef<Set<string>>(new Set());

  // In-app Alert Toast Banner for latency spikes
  const [activeAlertBanner, setActiveAlertBanner] = useState<{
    id: string;
    title: string;
    message: string;
    varianceMs: number;
    executionTimeMs: number;
    triggerEvent?: string;
    time: string;
    isWelcome?: boolean;
  } | null>(null);

  // Toggle for integrated Serialization & Latency Anomaly Log Panel inside Performance Trends View
  const [showIntegratedLogPanel, setShowIntegratedLogPanel] = useState<boolean>(true);

  // Synchronize any existing outliers in history into the error log panel
  const syncExistingOutliers = () => {
    if (!onLogLatencyAnomaly) return;
    outlierPoints.forEach((point) => {
      if (!loggedSpikeIdsRef.current.has(point.id)) {
        loggedSpikeIdsRef.current.add(point.id);
        const anomalyLog = createLatencyAnomalyLog(
          point,
          baselineLatency,
          anomalyThreshold
        );
        onLogLatencyAnomaly(anomalyLog);
      }
    });
  };

  // Checkbox toggle handler with native push notification request
  const handleToggleAlerts = async (enabled: boolean) => {
    setAlertsEnabled(enabled);
    if (enabled) {
      // Request native Notification permission if available and not yet requested
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            const perm = await Notification.requestPermission();
            setNotificationPermission(perm);
            if (perm === 'granted') {
              try {
                new Notification('🔔 Latency Anomaly Alerts Enabled', {
                  body: `Push alerts active: You will be notified when query latency spikes exceed +${anomalyThreshold}ms variance.`,
                  icon: '/favicon.ico'
                });
              } catch (e) {
                console.warn('Native notification failed', e);
              }
            }
          } catch (err) {
            console.warn('Notification permission error', err);
          }
        } else {
          setNotificationPermission(Notification.permission);
        }
      }

      // Play chime confirmation
      playAnomalyChime();

      // Show confirmation toast
      setActiveAlertBanner({
        id: `alert-init-${Date.now()}`,
        title: 'Spike Alerts & Anomaly Tracking Activated',
        message: `Browser alerts and telemetry tracking are active for query latency spikes exceeding +${anomalyThreshold}ms variance (${effectiveAnomalyCutoff.toFixed(1)}ms cutoff).`,
        varianceMs: anomalyThreshold,
        executionTimeMs: effectiveAnomalyCutoff,
        time: new Date().toLocaleTimeString(),
        isWelcome: true
      });

      // Synchronize existing outliers into the error log panel
      syncExistingOutliers();
    } else {
      setActiveAlertBanner(null);
    }
  };

  // Helper to inject a simulated latency spike for testing alerts and error log tracking
  const handleSimulateLatencySpike = () => {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0];
    const spikeLatency = baselineLatency + anomalyThreshold + 95 + Math.random() * 45;
    const variance = spikeLatency - baselineLatency;

    const testPoint: LatencyTrendPoint = {
      id: `spike-test-${Date.now()}`,
      timestamp: Date.now(),
      timeFormatted,
      executionTimeMs: Number(spikeLatency.toFixed(1)),
      rowsScanned: 50000,
      activeQueriesCount: 16,
      cacheHit: false,
      flags: { ...currentFlags },
      triggerEvent: 'Simulated Latency Spike (Buffer Contention)',
      deltaMs: Number(variance.toFixed(1)),
      simulatedError: null
    };

    if (onAppendTrendPoint) {
      onAppendTrendPoint(testPoint);
    }
  };

  // Listen for latency spikes or High-Duration Mutations exceeding thresholds and alert + log
  useEffect(() => {
    if (trendHistory.length === 0) return;

    // Latest trend point
    const latestPoint = trendHistory[trendHistory.length - 1];
    if (!latestPoint) return;

    const highDuration = checkHighDurationMutationCorrelation(latestPoint, thresholdViolations);
    const isHighDuration = highDuration.isHighDurationMutation;
    const variance = latestPoint.executionTimeMs - baselineLatency;
    const isSpike = variance >= anomalyThreshold;

    if ((isSpike || isHighDuration) && !loggedSpikeIdsRef.current.has(latestPoint.id)) {
      loggedSpikeIdsRef.current.add(latestPoint.id);

      // Track in Serialization Error Log Panel as 'Latency Anomaly' / 'High-Duration Mutation' event
      if (onLogLatencyAnomaly) {
        const anomalyLog = createLatencyAnomalyLog(
          latestPoint,
          baselineLatency,
          anomalyThreshold,
          isHighDuration ? `High-Duration Mutation: ${highDuration.reason}` : undefined
        );
        if (isHighDuration) {
          anomalyLog.message = `High-Duration Mutation Anomaly: ${latestPoint.triggerEvent || 'Mutation'} exceeded duration threshold. Latency: ${latestPoint.executionTimeMs.toFixed(1)}ms (${highDuration.reason}).`;
        }
        onLogLatencyAnomaly(anomalyLog);
      }

      // If user enabled push-notifications or browser alerts:
      if (alertsEnabled) {
        // 1. Audio alert chime
        playAnomalyChime();

        // 2. Native Web Notification API
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(
              isHighDuration
                ? '🚨 High-Duration Mutation Anomaly Detected'
                : '🚨 Latency Spike Anomaly Detected',
              {
                body: isHighDuration
                  ? `High-Duration Mutation: ${latestPoint.triggerEvent || 'Mutation'} correlated with threshold violation (${latestPoint.executionTimeMs.toFixed(1)}ms).`
                  : `Query latency reached ${latestPoint.executionTimeMs.toFixed(1)}ms (+${variance.toFixed(1)}ms variance, threshold: +${anomalyThreshold}ms) during ${latestPoint.triggerEvent || 'query execution'}.`,
                tag: `anomaly-${latestPoint.id}`
              }
            );
          } catch (e) {
            console.warn('Native notification failed', e);
          }
        }

        // 3. High-visibility in-browser alert toast banner
        setActiveAlertBanner({
          id: latestPoint.id,
          title: isHighDuration
            ? 'High-Duration Mutation Anomaly'
            : 'Latency Spike Exceeded Threshold',
          message: isHighDuration
            ? `Query latency correlated with mutation threshold violation during ${latestPoint.triggerEvent || 'mutation execution'}. ${highDuration.reason}.`
            : `Query latency spiked to ${latestPoint.executionTimeMs.toFixed(1)}ms (+${variance.toFixed(1)}ms variance above ${baselineLatency.toFixed(1)}ms baseline). Threshold is +${anomalyThreshold}ms.`,
          varianceMs: variance,
          executionTimeMs: latestPoint.executionTimeMs,
          triggerEvent: latestPoint.triggerEvent,
          time: latestPoint.timeFormatted || new Date().toLocaleTimeString()
        });
      }
    }
  }, [trendHistory, baselineLatency, anomalyThreshold, alertsEnabled, onLogLatencyAnomaly, thresholdViolations]);

  // Auto-dismiss alert toast after 8 seconds
  useEffect(() => {
    if (!activeAlertBanner) return;
    const timer = setTimeout(() => {
      setActiveAlertBanner(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeAlertBanner]);

  // Count of tracked Latency Anomaly logs
  const latencyAnomaliesCount = useMemo(() => {
    if (!serializationLogs) return 0;
    return serializationLogs.filter(
      (l) => l.type === 'LATENCY_ANOMALY' || l.type === 'LATENCY_SPIKE'
    ).length;
  }, [serializationLogs]);

  // Count of points correlated with mutation threshold violations (High-Duration Mutations)
  const highDurationMutationsCount = useMemo(() => {
    return trendHistory.filter(
      (p) => checkHighDurationMutationCorrelation(p, thresholdViolations).isHighDurationMutation
    ).length;
  }, [trendHistory, thresholdViolations]);

  // Count active annotated points
  const annotatedPointsCount = useMemo(() => {
    return trendHistory.filter((p) => getPointAnnotation(p, thresholdViolations) !== null).length;
  }, [trendHistory, thresholdViolations]);

  // Update chart container dimensions for accurate popover boundary positioning
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const updateSize = () => {
      if (chartContainerRef.current) {
        setContainerDimensions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Dismiss or keep popover synchronized if trendHistory changes
  useEffect(() => {
    if (trendHistory.length === 0) {
      setPopoverPoint(null);
    } else if (popoverPoint) {
      if (popoverPoint.index >= trendHistory.length) {
        setPopoverPoint(null);
      } else {
        setPopoverPoint((prev) => (prev ? { ...prev, point: trendHistory[prev.index] } : null));
      }
    }
  }, [trendHistory.length]);

  // Dismiss popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopoverPoint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync snapshot B with the latest point when new points are recorded if it was tracking the end
  useEffect(() => {
    if (trendHistory.length > 0) {
      setCompareIndexB((prev) => {
        if (prev >= trendHistory.length) {
          return trendHistory.length - 1;
        }
        return prev;
      });
      setCompareIndexA((prev) => {
        if (prev >= trendHistory.length) {
          return 0;
        }
        return prev;
      });
    }
  }, [trendHistory.length]);

  // Compute key trend summary metrics
  const metrics = useMemo(() => {
    if (trendHistory.length === 0) {
      return {
        peakLatency: 0,
        lowestLatency: 0,
        currentLatency: 0,
        maxImprovementMs: 0,
        maxImprovementPercent: 0,
        totalToggles: 0
      };
    }

    const latencies = trendHistory.map((p) => p.executionTimeMs);
    const peakLatency = Math.max(...latencies);
    const lowestLatency = Math.min(...latencies);
    const currentLatency = latencies[latencies.length - 1];

    let maxImprovementMs = 0;
    let maxImprovementPercent = 0;

    if (peakLatency > 0 && lowestLatency < peakLatency) {
      maxImprovementMs = peakLatency - lowestLatency;
      maxImprovementPercent = Math.round(((peakLatency - lowestLatency) / peakLatency) * 100);
    }

    return {
      peakLatency,
      lowestLatency,
      currentLatency,
      maxImprovementMs,
      maxImprovementPercent,
      totalToggles: trendHistory.length
    };
  }, [trendHistory]);

  // Selected point details (defaults to latest point if none clicked)
  const activeDetailPoint =
    selectedPointIndex !== null && trendHistory[selectedPointIndex]
      ? trendHistory[selectedPointIndex]
      : trendHistory[trendHistory.length - 1] || null;

  // D3 Primary Trend Line & Area Chart Render
  useEffect(() => {
    if (!svgRef.current || !chartContainerRef.current || trendHistory.length === 0) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 700;
    const height = 340;
    const margin = { top: 25, right: showMutationFrequency ? 65 : 35, bottom: 45, left: 65 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Clicking blank chart area dismisses the technical specs popover
    svg.on('click', () => {
      setPopoverPoint(null);
    });

    svg.attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: index of sequence points
    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(trendHistory.length - 1, 1)])
      .range([0, innerWidth]);

    // Y Scale: Linear vs Log
    const latencies = trendHistory.map((d) => d.executionTimeMs);
    const maxVal = Math.max(...latencies, 10);
    const minVal = Math.max(Math.min(...latencies), 0.05);

    let yScale: d3.ScaleContinuousNumeric<number, number>;
    if (scaleType === 'log') {
      yScale = d3
        .scaleLog()
        .domain([Math.max(0.08, minVal * 0.8), maxVal * 1.3])
        .range([innerHeight, 0]);
    } else {
      yScale = d3
        .scaleLinear()
        .domain([0, maxVal * 1.18])
        .nice()
        .range([innerHeight, 0]);
    }

    // Define gradients
    const defs = svg.append('defs');

    // Area fill gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'latency-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.4);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.02);

    // Annotation drop shadow filter
    const filter = defs
      .append('filter')
      .attr('id', 'annotation-shadow')
      .attr('x', '-15%')
      .attr('y', '-15%')
      .attr('width', '140%')
      .attr('height', '140%');

    filter
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 2)
      .attr('stdDeviation', 2.5)
      .attr('flood-color', '#000000')
      .attr('flood-opacity', 0.12);

    // Gridlines (Horizontal)
    const yAxisTicks = yScale.ticks(scaleType === 'log' ? 4 : 5);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e4e4e7')
      .attr('stroke-dasharray', '3,3');

    // Threshold SLA Reference Lines (15ms fast SLA target)
    if (yScale.domain()[0] <= 15 && yScale.domain()[1] >= 15) {
      const y15 = yScale(15);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y15)
        .attr('y2', y15)
        .attr('stroke', '#059669')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '5,4');

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', y15 - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#059669')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, monospace')
        .text('SLA Target (15ms)');
    }

    // High Latency Degradation Line (60ms)
    if (yScale.domain()[0] <= 60 && yScale.domain()[1] >= 60) {
      const y60 = yScale(60);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y60)
        .attr('y2', y60)
        .attr('stroke', '#e11d48')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '5,4');

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', y60 - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#e11d48')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, monospace')
        .text('Degraded Threshold (60ms)');
    }

    // Dynamic Anomaly Threshold Line based on latency variance slider
    if (yScale.domain()[0] <= effectiveAnomalyCutoff && yScale.domain()[1] >= effectiveAnomalyCutoff) {
      const yAnomaly = yScale(effectiveAnomalyCutoff);

      // Shaded anomaly zone above the threshold line
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', Math.max(0, yAnomaly))
        .attr('fill', '#f43f5e')
        .attr('opacity', 0.04)
        .attr('pointer-events', 'none');

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yAnomaly)
        .attr('y2', yAnomaly)
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.6)
        .attr('stroke-dasharray', '6,3');

      g.append('text')
        .attr('x', 8)
        .attr('y', yAnomaly - 5)
        .attr('text-anchor', 'start')
        .attr('fill', '#e11d48')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, monospace')
        .text(`⚡ Anomaly Threshold (+${anomalyThreshold}ms variance / ${effectiveAnomalyCutoff.toFixed(1)}ms)`);
    }

    // D3 Area generator
    const areaGenerator = d3
      .area<LatencyTrendPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScale(Math.max(d.executionTimeMs, 0.05)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(trendHistory)
      .attr('fill', 'url(#latency-area-gradient)')
      .attr('d', areaGenerator);

    // D3 Line generator
    const lineGenerator = d3
      .line<LatencyTrendPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(Math.max(d.executionTimeMs, 0.05)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(trendHistory)
      .attr('fill', 'none')
      .attr('stroke', '#059669')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGenerator);

    // Secondary Y-Scale & Mutation Frequency Overlay
    const maxFreqDomain = Math.max(Math.ceil(maxMutationFreq * 1.25), 4);
    const yMutationScale = d3
      .scaleLinear()
      .domain([0, maxFreqDomain])
      .nice()
      .range([innerHeight, 0]);

    if (showMutationFrequency) {
      // Mutation frequency area gradient
      const mutationAreaGradient = defs
        .append('linearGradient')
        .attr('id', 'mutation-frequency-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      mutationAreaGradient
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#f59e0b')
        .attr('stop-opacity', 0.22);

      mutationAreaGradient
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#f59e0b')
        .attr('stop-opacity', 0.01);

      // Area generator for mutation frequency
      const mutationAreaGenerator = d3
        .area<number>()
        .x((_, i) => xScale(i))
        .y0(innerHeight)
        .y1((val) => yMutationScale(val))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pointMutationFreqs)
        .attr('class', 'mutation-frequency-area-path')
        .attr('fill', 'url(#mutation-frequency-gradient)')
        .attr('d', mutationAreaGenerator)
        .attr('pointer-events', 'none');

      // Line generator for mutation frequency
      const mutationLineGenerator = d3
        .line<number>()
        .x((_, i) => xScale(i))
        .y((val) => yMutationScale(val))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pointMutationFreqs)
        .attr('class', 'mutation-frequency-line-path')
        .attr('fill', 'none')
        .attr('stroke', '#d97706')
        .attr('stroke-width', 2.2)
        .attr('stroke-dasharray', '5,3')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', mutationLineGenerator)
        .attr('pointer-events', 'none');

      // Diamond nodes for mutation frequency along the sequence
      pointMutationFreqs.forEach((freq, idx) => {
        const cx = xScale(idx);
        const cy = yMutationScale(freq);

        const markerGroup = g
          .append('g')
          .attr('class', 'mutation-frequency-marker pointer-events-none')
          .attr('data-testid', `marker-mutation-frequency-${idx}`);

        markerGroup
          .append('rect')
          .attr('x', cx - 3.5)
          .attr('y', cy - 3.5)
          .attr('width', 7)
          .attr('height', 7)
          .attr('transform', `rotate(45, ${cx}, ${cy})`)
          .attr('fill', freq > 0 ? '#fef3c7' : '#f4f4f5')
          .attr('stroke', freq > 0 ? '#d97706' : '#a1a1aa')
          .attr('stroke-width', 1.5);

        if (freq > 0) {
          markerGroup
            .append('text')
            .attr('x', cx)
            .attr('y', cy - 8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#b45309')
            .attr('font-size', '9px')
            .attr('font-weight', '700')
            .attr('font-family', 'ui-monospace, monospace')
            .text(`${freq}/m`);
        }
      });

      // Secondary Right Y Axis (Mutations per Minute)
      const yMutationAxis = d3
        .axisRight(yMutationScale)
        .ticks(Math.min(5, Math.max(3, maxFreqDomain)))
        .tickFormat((d) => `${d}/min`);

      const rightAxisGroup = g
        .append('g')
        .attr('class', 'y-axis-secondary-mutation')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(yMutationAxis)
        .attr('color', '#d97706');

      rightAxisGroup
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, monospace')
        .attr('fill', '#b45309');

      // Right Axis Title: Mutation Frequency (events/min)
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', innerWidth + 50)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#b45309')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-sans-serif, system-ui')
        .text('Mutation Frequency (events/min)');
    }

    // D3 Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(trendHistory.length, 8))
      .tickFormat((d) => {
        const idx = Math.round(Number(d));
        if (trendHistory[idx]) {
          return `#${idx + 1} ${trendHistory[idx].timeFormatted}`;
        }
        return `#${idx + 1}`;
      });

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(scaleType === 'log' ? 4 : 5)
      .tickFormat((d) => `${d}ms`);

    // Draw X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#71717a')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('dy', '12px');

    // Draw Y Axis
    g.append('g')
      .call(yAxis)
      .attr('color', '#71717a')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, monospace');

    // Axis Labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -48)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#71717a')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('Query Execution Latency (ms)');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#71717a')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('Optimization Event Sequence');

    // Vertical Event markers and Data Point Circles
    trendHistory.forEach((point, idx) => {
      const cx = xScale(idx);
      const cy = yScale(Math.max(point.executionTimeMs, 0.05));
      const isFast = point.executionTimeMs < 15;
      const isDegraded = point.executionTimeMs > 60;
      const isSelected = selectedPointIndex === idx;
      const isCompareA = isCompareOpen && compareIndexA === idx;
      const isCompareB = isCompareOpen && compareIndexB === idx;

      const isPopoverActive = popoverPoint?.index === idx;

      // Vertical guide on selected, popover-active, compare points, or current point
      if (isSelected || isPopoverActive || isCompareA || isCompareB || idx === trendHistory.length - 1) {
        g.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', isPopoverActive ? '#2563eb' : isCompareA ? '#f59e0b' : isCompareB ? '#10b981' : isSelected ? '#3b82f6' : '#a1a1aa')
          .attr('stroke-width', isPopoverActive || isCompareA || isCompareB || isSelected ? 1.5 : 1)
          .attr('stroke-dasharray', isPopoverActive || isCompareA || isCompareB ? 'none' : isSelected ? 'none' : '2,2');
      }

      // Outer point pulse halo
      if (idx === trendHistory.length - 1) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 10)
          .attr('fill', isFast ? '#10b981' : isDegraded ? '#ef4444' : '#f59e0b')
          .attr('opacity', 0.25);
      }

      // Check if point exceeds anomaly threshold variance or correlates with a mutation threshold violation
      const highDuration = checkHighDurationMutationCorrelation(point, thresholdViolations);
      const isHighDuration = highDuration.isHighDurationMutation;
      const pointVariance = point.executionTimeMs - baselineLatency;
      const isOutlier = pointVariance >= anomalyThreshold || isHighDuration;

      // Outer glowing beacon halo for High-Duration Mutation or Outliers
      if (isHighDuration) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 15)
          .attr('fill', '#ffe4e6')
          .attr('stroke', '#e11d48')
          .attr('stroke-width', 2.2)
          .attr('stroke-dasharray', '4,2')
          .attr('opacity', 0.9)
          .attr('data-testid', `beacon-high-duration-mutation-${idx}`)
          .attr('class', 'animate-pulse');

        // Floating label indicator directly above the node
        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 13)
          .attr('text-anchor', 'middle')
          .attr('fill', '#be123c')
          .attr('font-size', '8.5px')
          .attr('font-weight', 'bold')
          .attr('font-family', 'ui-sans-serif, system-ui')
          .attr('class', 'select-none pointer-events-none')
          .text('High-Duration Mutation');
      } else if (isOutlier) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 12)
          .attr('fill', '#ffe4e6')
          .attr('stroke', '#f43f5e')
          .attr('stroke-width', 1.8)
          .attr('stroke-dasharray', '3,2')
          .attr('opacity', 0.85);
      }

      // Outer ring for compare target A (Amber)
      if (isCompareA) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 9)
          .attr('fill', 'none')
          .attr('stroke', '#d97706')
          .attr('stroke-width', 2.5);

        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 12)
          .attr('text-anchor', 'middle')
          .attr('fill', '#b45309')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('A');
      }

      // Outer ring for compare target B (Emerald)
      if (isCompareB) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 9)
          .attr('fill', 'none')
          .attr('stroke', '#059669')
          .attr('stroke-width', 2.5);

        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 12)
          .attr('text-anchor', 'middle')
          .attr('fill', '#047857')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('B');
      }

      // Outer focus ring for popover active point (Blue pulse)
      if (isPopoverActive) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 11)
          .attr('fill', 'none')
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '3,2');
      }

      // Outer ring for selected (if not compare and not popover active)
      if (isSelected && !isCompareA && !isCompareB && !isPopoverActive) {
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 8)
          .attr('fill', 'none')
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 2);
      }

      // Main circle node
      const pointColor = isCompareA
        ? '#d97706'
        : isCompareB
        ? '#059669'
        : isPopoverActive
        ? '#2563eb'
        : isHighDuration
        ? '#be123c'
        : isOutlier
        ? '#e11d48'
        : isFast
        ? '#059669'
        : isDegraded
        ? '#dc2626'
        : '#d97706';

      const circle = g
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isCompareA || isCompareB || isSelected || isPopoverActive ? 6.5 : isHighDuration ? 6.5 : isOutlier ? 6.0 : 4.5)
        .attr('fill', isCompareA ? '#fef3c7' : isCompareB ? '#d1fae5' : isPopoverActive ? '#dbeafe' : isHighDuration ? '#fee2e2' : isOutlier ? '#fff1f2' : '#ffffff')
        .attr('stroke', pointColor)
        .attr('stroke-width', isHighDuration ? 3.0 : isOutlier ? 2.8 : 2.5)
        .attr('cursor', 'pointer')
        .attr('data-anomaly-type', isHighDuration ? 'high-duration-mutation' : isOutlier ? 'outlier-spike' : 'normal')
        .attr('data-is-high-duration-mutation', isHighDuration ? 'true' : 'false')
        .attr('class', 'transition-all duration-150');

      // Click data point on D3 chart to open detailed technical specifications popover
      circle.on('click', (event: any) => {
        if (event && event.stopPropagation) {
          event.stopPropagation();
        }
        const pointWithFreq: LatencyTrendPoint = {
          ...point,
          mutationFrequencyPerMin: pointMutationFreqs[idx]
        };
        setSelectedPointIndex(idx);
        setPopoverPoint({
          point: pointWithFreq,
          index: idx,
          x: cx + margin.left,
          y: cy + margin.top
        });
      });

      // Hover crosshair & tooltip
      circle
        .on('mouseenter', () => {
          circle.attr('r', 7.5).attr('fill', pointColor);
          setHoveredPoint({
            point,
            x: cx + margin.left,
            y: cy + margin.top
          });
        })
        .on('mouseleave', () => {
          circle
            .attr('r', isCompareA || isCompareB || isSelected || isPopoverActive ? 6.5 : 4.5)
            .attr('fill', isCompareA ? '#fef3c7' : isCompareB ? '#d1fae5' : isPopoverActive ? '#dbeafe' : '#ffffff');
          setHoveredPoint(null);
        });
    });

    // 5. On-Graph Text Annotations for Specific Events (Bulk Ingest, Spikes, Baseline, High-Duration Mutation)
    if (showAnnotations) {
      const annotationLayer = g.append('g').attr('class', 'chart-annotations-layer');

      trendHistory.forEach((point, idx) => {
        const ann = getPointAnnotation(point, thresholdViolations);
        if (!ann) return;

        const isHighDurationAnn = ann.label.includes('High-Duration');
        const cx = xScale(idx);
        const cy = yScale(Math.max(point.executionTimeMs, 0.05));
        const isNearTop = cy < 85;
        const cardWidth = isHighDurationAnn ? 166 : 142;
        const cardHeight = 36;

        // Prevent overflowing past chart innerWidth bounds
        let boxX = cx - cardWidth / 2;
        if (boxX < 2) boxX = 2;
        if (boxX + cardWidth > innerWidth - 2) boxX = innerWidth - cardWidth - 2;

        // Alternate vertical position if consecutive points both have annotations
        const verticalStagger = idx % 2 === 1 && !isNearTop ? 14 : 0;

        let targetY: number;
        let lineStartY: number;
        let lineEndY: number;

        if (isNearTop) {
          // Point is near the top; position callout box below the circle
          lineStartY = cy + 9;
          targetY = cy + 24;
          lineEndY = targetY;
        } else {
          // Normal: position callout box above the circle
          lineStartY = cy - 9;
          targetY = cy - 24 - cardHeight - verticalStagger;
          if (targetY < 2) targetY = 2;
          lineEndY = targetY + cardHeight;
        }

        const annGroup = annotationLayer
          .append('g')
          .attr('class', 'event-annotation-item cursor-pointer')
          .attr('data-testid', `annotation-item-${idx}`)
          .attr('title', `${ann.label} - Click to view technical database state specs`)
          .on('click', (event: any) => {
            if (event && event.stopPropagation) {
              event.stopPropagation();
            }
            setSelectedPointIndex(idx);
            setPopoverPoint({
              point,
              index: idx,
              x: cx + margin.left,
              y: cy + margin.top
            });
          });

        // Vertical Connecting Leader Line
        annGroup
          .append('line')
          .attr('x1', cx)
          .attr('y1', lineStartY)
          .attr('x2', cx)
          .attr('y2', lineEndY)
          .attr('stroke', ann.leaderColor)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '2,2');

        // Leader Line Anchor Dot on Circle Node
        annGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', lineStartY)
          .attr('r', 2)
          .attr('fill', ann.leaderColor);

        // Annotation Card Background Box with drop shadow
        annGroup
          .append('rect')
          .attr('x', boxX)
          .attr('y', targetY)
          .attr('width', cardWidth)
          .attr('height', cardHeight)
          .attr('rx', 6)
          .attr('ry', 6)
          .attr('fill', ann.bgColor)
          .attr('stroke', ann.borderColor)
          .attr('stroke-width', 1.4)
          .attr('filter', 'url(#annotation-shadow)');

        // Primary Event Label (e.g., ⚡ High-Duration Mutation or 📦 Bulk Ingest)
        annGroup
          .append('text')
          .attr('x', boxX + 8)
          .attr('y', targetY + 15)
          .attr('fill', ann.textColor)
          .attr('font-size', isHighDurationAnn ? '10px' : '10.5px')
          .attr('font-weight', '700')
          .text(ann.label);

        // Secondary Specification / Latency Subtext
        annGroup
          .append('text')
          .attr('x', boxX + 8)
          .attr('y', targetY + 28)
          .attr('fill', ann.subTextColor)
          .attr('font-size', '9px')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-weight', '600')
          .text(ann.subLabel);

        // Alert indicator pill for degradation / mutation events
        if (ann.isSpike) {
          const pillWidth = isHighDurationAnn ? 52 : 26;
          const pillX = boxX + cardWidth - pillWidth - 6;
          const pillY = targetY + 6;

          annGroup
            .append('rect')
            .attr('x', pillX)
            .attr('y', pillY)
            .attr('width', pillWidth)
            .attr('height', 12)
            .attr('rx', 3)
            .attr('fill', ann.borderColor)
            .attr('opacity', 0.25);

          annGroup
            .append('text')
            .attr('x', pillX + pillWidth / 2)
            .attr('y', pillY + 9)
            .attr('text-anchor', 'middle')
            .attr('fill', ann.textColor)
            .attr('font-size', isHighDurationAnn ? '7px' : '8px')
            .attr('font-weight', '800')
            .text(isHighDurationAnn ? 'MUTATION' : 'SPIKE');
        }

        // Hover effect to highlight card border
        annGroup
          .on('mouseenter', function () {
            d3.select(this).select('rect').attr('stroke-width', 2.2);
          })
          .on('mouseleave', function () {
            d3.select(this).select('rect').attr('stroke-width', 1.4);
          });
      });
    }

    // 6. Dedicated 'Outlier' / 'High-Duration Mutation' Tags
    const outlierLayer = g.append('g').attr('class', 'chart-outlier-tags-layer');

    trendHistory.forEach((point, idx) => {
      const highDuration = checkHighDurationMutationCorrelation(point, thresholdViolations);
      const isHighDuration = highDuration.isHighDurationMutation;
      const variance = point.executionTimeMs - baselineLatency;
      const isOutlier = variance >= anomalyThreshold || isHighDuration;
      if (!isOutlier) return;

      const cx = xScale(idx);
      const cy = yScale(Math.max(point.executionTimeMs, 0.05));
      const isNearTop = cy < 75;
      const tagText = isHighDuration ? '⚡ High-Duration Mutation' : '⚡ OUTLIER';
      const tagWidth = isHighDuration ? 144 : 68;
      const tagHeight = 18;

      let tagX = cx - tagWidth / 2;
      if (tagX < 2) tagX = 2;
      if (tagX + tagWidth > innerWidth - 2) tagX = innerWidth - tagWidth - 2;

      const hasAnnotation = showAnnotations && getPointAnnotation(point, thresholdViolations) !== null;
      let tagY: number;

      if (hasAnnotation) {
        // Offset above or below the event annotation card
        if (isNearTop) {
          tagY = cy + 24 + 36 + 5;
        } else {
          tagY = cy - 24 - 36 - tagHeight - 4;
          if (tagY < 2) {
            tagY = cy + 18;
          }
        }
      } else {
        // Direct tag above or below the node
        tagY = isNearTop ? cy + 15 : cy - 26;
      }

      const outlierTagGroup = outlierLayer
        .append('g')
        .attr('class', 'outlier-chart-tag cursor-pointer')
        .attr('data-anomaly-type', isHighDuration ? 'high-duration-mutation' : 'outlier')
        .attr('data-testid', isHighDuration ? `tag-high-duration-mutation-${idx}` : `tag-outlier-${idx}`)
        .attr(
          'title',
          isHighDuration
            ? `High-Duration Mutation: ${point.executionTimeMs.toFixed(1)}ms (${highDuration.reason}) - Click to view technical specs`
            : `Outlier Spike: ${point.executionTimeMs.toFixed(1)}ms (+${variance.toFixed(1)}ms variance) - Click to view technical specs`
        )
        .on('click', (event: any) => {
          if (event && event.stopPropagation) {
            event.stopPropagation();
          }
          const pointWithFreq: LatencyTrendPoint = {
            ...point,
            mutationFrequencyPerMin: pointMutationFreqs[idx]
          };
          setSelectedPointIndex(idx);
          setPopoverPoint({
            point: pointWithFreq,
            index: idx,
            x: cx + margin.left,
            y: cy + margin.top
          });
        });

      // Pointer connecting line if not sitting beside an annotation card
      if (!hasAnnotation) {
        outlierTagGroup
          .append('line')
          .attr('x1', cx)
          .attr('y1', isNearTop ? cy + 7 : cy - 7)
          .attr('x2', cx)
          .attr('y2', isNearTop ? tagY : tagY + tagHeight)
          .attr('stroke', isHighDuration ? '#e11d48' : '#f43f5e')
          .attr('stroke-width', 1.2)
          .attr('stroke-dasharray', '2,2');
      }

      // Outlier Tag pill background
      outlierTagGroup
        .append('rect')
        .attr('x', tagX)
        .attr('y', tagY)
        .attr('width', tagWidth)
        .attr('height', tagHeight)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', '#fff1f2')
        .attr('stroke', isHighDuration ? '#e11d48' : '#f43f5e')
        .attr('stroke-width', isHighDuration ? 1.6 : 1.4)
        .attr('filter', 'url(#annotation-shadow)');

      // Outlier Tag Text
      outlierTagGroup
        .append('text')
        .attr('x', tagX + tagWidth / 2)
        .attr('y', tagY + 12.5)
        .attr('text-anchor', 'middle')
        .attr('fill', isHighDuration ? '#881337' : '#9f1239')
        .attr('font-size', isHighDuration ? '8.5px' : '9.5px')
        .attr('font-weight', '800')
        .attr('font-family', 'ui-monospace, monospace')
        .attr('letter-spacing', '0.02em')
        .text(tagText);

      // Hover feedback
      outlierTagGroup
        .on('mouseenter', function () {
          d3.select(this).select('rect').attr('stroke-width', 2.2).attr('fill', '#ffe4e6');
        })
        .on('mouseleave', function () {
          d3.select(this).select('rect').attr('stroke-width', 1.4).attr('fill', '#fff1f2');
        });
    });
  }, [
    trendHistory,
    scaleType,
    selectedPointIndex,
    isCompareOpen,
    compareIndexA,
    compareIndexB,
    popoverPoint?.index,
    showAnnotations,
    showMutationFrequency,
    anomalyThreshold,
    baselineLatency,
    thresholdViolations,
    mutationHistory,
    pointMutationFreqs,
    maxMutationFreq
  ]);

  // Secondary D3 Horizontal Breakdown Chart: Flag Impact
  useEffect(() => {
    if (!barChartRef.current) return;

    const svg = d3.select(barChartRef.current);
    svg.selectAll('*').remove();

    const width = 340;
    const height = 180;
    const margin = { top: 15, right: 65, bottom: 25, left: 110 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Flag latency savings data
    const savingsData = [
      { name: 'Batch Eager Join', deltaMs: 420.0, enabled: currentFlags.batchEagerLoading },
      { name: 'B-Tree Indexing', deltaMs: 48.5, enabled: currentFlags.btreeIndexing },
      { name: 'Query LRU Cache', deltaMs: 1.35, enabled: currentFlags.queryCaching }
    ];

    const yScale = d3
      .scaleBand()
      .domain(savingsData.map((d) => d.name))
      .range([0, innerHeight])
      .padding(0.3);

    const xScale = d3
      .scaleLinear()
      .domain([0, 450])
      .range([0, innerWidth]);

    // Bars
    g.selectAll('.bar')
      .data(savingsData)
      .enter()
      .append('rect')
      .attr('y', (d) => yScale(d.name) || 0)
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', (d) => (d.enabled ? xScale(d.deltaMs) : xScale(12)))
      .attr('rx', 4)
      .attr('fill', (d) => (d.enabled ? '#10b981' : '#e4e4e7'));

    // Text values
    g.selectAll('.val-label')
      .data(savingsData)
      .enter()
      .append('text')
      .attr('x', (d) => (d.enabled ? xScale(d.deltaMs) + 6 : xScale(12) + 6))
      .attr('y', (d) => (yScale(d.name) || 0) + yScale.bandwidth() / 2 + 4)
      .attr('fill', (d) => (d.enabled ? '#065f46' : '#a1a1aa'))
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'ui-monospace, monospace')
      .text((d) => (d.enabled ? `-${d.deltaMs}ms` : 'Inactive'));

    // Y Axis labels
    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .attr('color', '#52525b')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('dx', '-6px');

    g.select('.domain').remove();
  }, [currentFlags]);

  return (
    <div className="space-y-6" id="performance-trends-view">
      {/* High-visibility Latency Spike Anomaly Alert Toast */}
      {activeAlertBanner && (
        <div
          id="latency-anomaly-alert-banner"
          className="fixed top-4 right-4 z-50 max-w-md w-full bg-zinc-950 text-white rounded-xl p-4 shadow-2xl border-2 border-rose-500/80 animate-in fade-in slide-in-from-top-4 duration-300"
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0 mt-0.5">
                <Zap className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500 text-zinc-950 px-1.5 py-0.5 rounded">
                    {activeAlertBanner.isWelcome ? 'Alerts Activated' : 'Latency Anomaly'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {activeAlertBanner.time}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-1">
                  {activeAlertBanner.title}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {activeAlertBanner.message}
                </p>
                {activeAlertBanner.triggerEvent && (
                  <div className="mt-2 text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                    Source: <span className="text-zinc-200">{activeAlertBanner.triggerEvent}</span>
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Tracked as 'Latency Anomaly' in Error Log
                  </span>
                </div>
              </div>
            </div>
            <button
              id="btn-dismiss-latency-anomaly-alert"
              type="button"
              onClick={() => setActiveAlertBanner(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              Current Latency
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                metrics.currentLatency < 15
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {metrics.currentLatency < 15 ? 'FAST' : 'EVALUATING'}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 font-mono">
            {metrics.currentLatency.toFixed(2)}
            <span className="text-sm font-normal text-zinc-500 ml-1">ms</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {metrics.currentLatency < 15
              ? 'Meets standard database SLA (<15ms)'
              : 'Above recommended latency target'}
          </p>
          <div
            className={`absolute bottom-0 left-0 right-0 h-1 ${
              metrics.currentLatency < 15 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              Max Latency Drop
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
              +{metrics.maxImprovementPercent}% FASTER
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-mono">
            {metrics.maxImprovementMs.toFixed(1)}
            <span className="text-sm font-normal text-zinc-500 ml-1">ms saved</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Peak: {metrics.peakLatency.toFixed(1)}ms → Best: {metrics.lowestLatency.toFixed(2)}ms
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              Timeline Data Points
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                isLiveMode
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {isLiveMode ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  STREAMING (5s)
                </>
              ) : (
                'SNAPSHOTS'
              )}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 font-mono">
            {metrics.totalToggles}
            <span className="text-sm font-normal text-zinc-500 ml-1">events</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {isLiveMode
              ? `Real-time stream active (next synthetic ping in ${countdownSeconds}s)`
              : 'Logs every flag toggle and query state change'}
          </p>
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Active Optimizations
            </span>
            <span className="text-[10px] font-bold bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
              {Object.values(currentFlags).filter(Boolean).length}/5 ON
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 font-mono">
            {Object.values(currentFlags).every(Boolean) ? '100%' : `${Object.values(currentFlags).filter(Boolean).length * 20}%`}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {Object.values(currentFlags).every(Boolean)
              ? 'All 5 flags enabled'
              : 'Toggle flags to test impact'}
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* 2. Interactive Flag Toggles Toolbar & Simulation Trigger */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Optimization Flag Controller</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Toggle any flag below to immediately generate a new latency measurement on the D3 chart
            </p>
          </div>

          {/* Quick Simulation & Compare Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-open-snapshot-compare"
              type="button"
              onClick={() => setIsCompareOpen(true)}
              disabled={trendHistory.length < 2}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer border ${
                isCompareOpen
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-zinc-300 hover:bg-zinc-50 text-zinc-800'
              } disabled:opacity-40`}
              title={trendHistory.length < 2 ? 'Need at least 2 snapshots to compare' : 'Open side-by-side snapshot comparison'}
            >
              <Columns className="w-3.5 h-3.5 text-blue-600" />
              <span>Snapshot Compare</span>
              {trendHistory.length >= 2 && (
                <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                  #{compareIndexA + 1} vs #{compareIndexB + 1}
                </span>
              )}
            </button>

            <button
              id="btn-run-seq-simulation"
              type="button"
              onClick={onRunOptimizationSequence}
              disabled={isSimulatingSequence}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSimulatingSequence ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Simulating Sequence...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Auto-Run 5-Step Optimization Sequence</span>
                </>
              )}
            </button>

            <button
              id="btn-export-anomaly-report"
              data-testid="btn-export-anomaly-report"
              type="button"
              onClick={handleExportAnomalyReport}
              disabled={isExportingAnomalyReport || trendHistory.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Generate a JSON file containing all latency anomalies, correlated mutation events, and system performance metrics from current trend history for external performance audit"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingAnomalyReport ? 'Exporting...' : 'Export Anomaly Report'}</span>
            </button>

            <button
              id="btn-open-pdf-report"
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Generate and download formatted PDF benchmark report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export PDF Report</span>
            </button>

            <button
              id="btn-clear-trend-history"
              type="button"
              onClick={onClearHistory}
              disabled={isSimulatingSequence || trendHistory.length <= 1}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Reset history to current state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
              <span>Reset History</span>
            </button>
          </div>
        </div>

        {/* Anomaly Report Export Success Feedback Toast */}
        {anomalyExportSuccessNotice && (
          <div
            id="toast-anomaly-report-exported"
            data-testid="toast-anomaly-report-exported"
            className="flex items-center justify-between gap-2 px-3.5 py-2 mt-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium animate-fadeIn shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{anomalyExportSuccessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnomalyExportSuccessNotice(null)}
              className="text-amber-700 hover:text-amber-950 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 5 Flag Switcher Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-zinc-100">
          {(
            [
              {
                key: 'btreeIndexing' as const,
                title: 'B-Tree Index',
                penalty: 'Scan 50k vs Index'
              },
              {
                key: 'batchEagerLoading' as const,
                title: 'Batch Eager Join',
                penalty: '2 vs 101 queries'
              },
              {
                key: 'queryCaching' as const,
                title: 'LRU Cache',
                penalty: '0.15ms vs disk'
              },
              {
                key: 'virtualizedDOM' as const,
                title: 'DOM Virtualization',
                penalty: '14 vs 5k nodes'
              },
              {
                key: 'deferredRendering' as const,
                title: 'Concurrent State',
                penalty: 'No main thread stall'
              }
            ] as const
          ).map((item) => {
            const isEnabled = currentFlags[item.key];
            return (
              <button
                key={item.key}
                id={`btn-trend-toggle-${item.key}`}
                type="button"
                onClick={() => onToggleFlag(item.key)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isEnabled
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 hover:bg-emerald-100/70'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{item.title}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isEnabled ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-zinc-300'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{item.penalty}</span>
                  <span
                    className={`font-semibold text-[10px] uppercase px-1 py-0.2 rounded ${
                      isEnabled ? 'bg-emerald-200/70 text-emerald-900' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Snapshot Compare Active Banner & Quick Selector */}
      {trendHistory.length >= 2 && (
        <div className={`p-3.5 rounded-xl border transition-all ${
          isCompareOpen 
            ? 'bg-blue-50/70 border-blue-200' 
            : 'bg-zinc-50/80 border-zinc-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                <Columns className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <span>Snapshot Compare Mode</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    Side-by-Side Analysis
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Select baseline (A) and comparison target (B) to highlight metric differences across optimization states
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-banner-export-pdf"
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-50 text-blue-700 text-xs font-semibold border border-blue-200 shadow-2xs transition-colors cursor-pointer"
                title="Export current snapshot comparison as formatted PDF"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Export PDF</span>
              </button>

              <button
                id="btn-trigger-snapshot-modal"
                type="button"
                onClick={() => setIsCompareOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Open Full Comparison Matrix</span>
              </button>
            </div>
          </div>

          {/* Quick Snapshot Selectors Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-zinc-200/70 text-xs">
            {/* Snapshot A selector */}
            <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-amber-900 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] inline-flex items-center justify-center font-mono">A</span>
                  Baseline Snapshot
                </span>
                <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  {trendHistory[compareIndexA]?.executionTimeMs.toFixed(1)} ms
                </span>
              </div>
              <select
                id="select-snapshot-compare-a"
                value={compareIndexA}
                onChange={(e) => setCompareIndexA(Number(e.target.value))}
                className="w-full bg-zinc-50 border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-800 focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {trendHistory.map((pt, idx) => (
                  <option key={pt.id} value={idx}>
                    #{idx + 1}: {pt.triggerEvent} ({pt.executionTimeMs.toFixed(1)}ms)
                  </option>
                ))}
              </select>
            </div>

            {/* Snapshot B selector */}
            <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] inline-flex items-center justify-center font-mono">B</span>
                  Comparison Target
                </span>
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {trendHistory[compareIndexB]?.executionTimeMs.toFixed(1)} ms
                </span>
              </div>
              <select
                id="select-snapshot-compare-b"
                value={compareIndexB}
                onChange={(e) => setCompareIndexB(Number(e.target.value))}
                className="w-full bg-zinc-50 border border-zinc-300 rounded px-2 py-1 text-xs text-zinc-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {trendHistory.map((pt, idx) => (
                  <option key={pt.id} value={idx}>
                    #{idx + 1}: {pt.triggerEvent} ({pt.executionTimeMs.toFixed(1)}ms)
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Presets */}
            <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs flex flex-col justify-between">
              <span className="font-bold text-zinc-800 text-[11px] mb-1">Comparison Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCompareIndexA(0);
                    setCompareIndexB(trendHistory.length - 1);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  First vs Latest
                </button>
                {trendHistory.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompareIndexA(trendHistory.length - 2);
                      setCompareIndexB(trendHistory.length - 1);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    Last 2 Steps
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Find highest and lowest points
                    let maxIdx = 0;
                    let minIdx = 0;
                    trendHistory.forEach((pt, i) => {
                      if (pt.executionTimeMs > trendHistory[maxIdx].executionTimeMs) maxIdx = i;
                      if (pt.executionTimeMs < trendHistory[minIdx].executionTimeMs) minIdx = i;
                    });
                    setCompareIndexA(maxIdx);
                    setCompareIndexB(minIdx);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  Peak vs Lowest
                </button>
              </div>
            </div>

            {/* Inline Quick Delta Stat */}
            {trendHistory[compareIndexA] && trendHistory[compareIndexB] && (() => {
              const pA = trendHistory[compareIndexA];
              const pB = trendHistory[compareIndexB];
              const deltaMs = pB.executionTimeMs - pA.executionTimeMs;
              const deltaPercent = pA.executionTimeMs > 0 ? ((deltaMs / pA.executionTimeMs) * 100) : 0;
              const isImprovement = deltaMs < 0;

              return (
                <div className={`p-2.5 rounded-lg border shadow-2xs flex flex-col justify-between ${
                  isImprovement 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                    : deltaMs > 0
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-800'
                }`}>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>Selected Delta:</span>
                    <span className="font-mono">
                      {isImprovement ? `↓ ${Math.abs(deltaPercent).toFixed(1)}%` : deltaMs > 0 ? `↑ ${deltaPercent.toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                  <div className="font-mono text-base font-bold">
                    {deltaMs < 0 ? `-${Math.abs(deltaMs).toFixed(1)} ms` : deltaMs > 0 ? `+${deltaMs.toFixed(1)} ms` : '0.0 ms'}
                  </div>
                  <div className="text-[10px] opacity-80 truncate">
                    {isImprovement ? 'Performance improved in snapshot B' : deltaMs > 0 ? 'Latency degraded in snapshot B' : 'Equivalent latency'}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. Primary D3 Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main D3 Trend Time-Series */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-5 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900">
                  Database Latency Trends Over Time
                </h2>
                <span className="text-[11px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                  D3.js Visualization
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Visualizing latency drops and spikes as flags are toggled in real time
              </p>
            </div>

            {/* Chart Display Controls: Live Stream, Annotations & Scale */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Real-time 'Live' Mode Stream Toggle */}
              <button
                id="btn-toggle-live-mode"
                type="button"
                onClick={() => setIsLiveMode(!isLiveMode)}
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isLiveMode
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
                title="Toggle real-time streaming: generates and appends a synthetic background metric every 5 seconds"
              >
                {isLiveMode ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Live (5s)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-emerald-200/90 text-emerald-950">
                      {countdownSeconds}s
                    </span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Live Mode</span>
                  </>
                )}
              </button>

              <button
                id="btn-toggle-chart-annotations"
                type="button"
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showAnnotations
                    ? 'bg-blue-50/90 border-blue-300 text-blue-900 shadow-2xs'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
                title="Toggle on-graph text annotations for user actions, Bulk Ingest, and spikes"
              >
                <Tag className={`w-3.5 h-3.5 ${showAnnotations ? 'text-blue-600' : 'text-zinc-400'}`} />
                <span>Annotations</span>
                {annotatedPointsCount > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      showAnnotations ? 'bg-blue-200/90 text-blue-950' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {annotatedPointsCount}
                  </span>
                )}
              </button>

              {/* Show Mutation Frequency Secondary Y-Axis Overlay Toggle */}
              <button
                id="btn-toggle-mutation-frequency"
                data-testid="btn-toggle-mutation-frequency"
                type="button"
                onClick={() => setShowMutationFrequency(!showMutationFrequency)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showMutationFrequency
                    ? 'bg-amber-50/95 border-amber-400 text-amber-900 shadow-2xs'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                }`}
                title="Overlay secondary Y-axis plotting mutation events per minute to visualize their impact on latency spikes"
              >
                <Activity className={`w-3.5 h-3.5 ${showMutationFrequency ? 'text-amber-600' : 'text-zinc-400'}`} />
                <span>Show Mutation Frequency</span>
                {showMutationFrequency && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-amber-200 text-amber-950">
                    {maxMutationFreq > 0 ? `${maxMutationFreq}/m` : 'ON'}
                  </span>
                )}
              </button>

              {/* D3 Scale Selector */}
              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs">
                <button
                  type="button"
                  onClick={() => setScaleType('linear')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    scaleType === 'linear'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Linear
                </button>
                <button
                  type="button"
                  onClick={() => setScaleType('log')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    scaleType === 'log'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Log
                </button>
              </div>
            </div>
          </div>

          {/* Active Live Streaming Banner */}
          {isLiveMode && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 bg-emerald-50/90 border border-emerald-200 rounded-lg text-emerald-900 mb-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold">Real-Time Telemetry Stream Active:</span>
                <span className="text-emerald-800">
                  Logging synthetic background database query metrics every 5 seconds.
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 font-medium">
                <span>Next sample:</span>
                <span className="bg-emerald-200 text-emerald-950 font-bold px-1.5 py-0.5 rounded">
                  {countdownSeconds}s
                </span>
              </div>
            </div>
          )}

          {/* Anomaly Threshold & Latency Variance Slider Control Bar */}
          <div className="bg-zinc-50/90 border border-zinc-200/90 rounded-xl p-3 mb-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Slider Title & Live Variance Readout */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <label
                  htmlFor="anomaly-threshold-slider"
                  className="text-xs font-bold text-zinc-900 cursor-pointer"
                >
                  Anomaly Threshold:
                </label>
                <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shadow-2xs">
                  +{anomalyThreshold} ms variance
                </span>
                <span className="text-[11px] text-zinc-500">
                  (Cutoff: &gt; {effectiveAnomalyCutoff.toFixed(1)} ms)
                </span>
              </div>

              {/* Detected Outliers Badge & Quick Variance Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  id="outliers-detected-badge"
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                    outlierPoints.length > 0
                      ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {outlierPoints.length > 0 ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                      <span>{outlierPoints.length} Outlier{outlierPoints.length === 1 ? '' : 's'} Marked</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>0 Outliers (Normal)</span>
                    </>
                  )}
                </span>

                {/* Inline Export Anomaly Report Shortcut */}
                <button
                  id="btn-export-anomaly-report-inline"
                  data-testid="btn-export-anomaly-report-inline"
                  type="button"
                  onClick={handleExportAnomalyReport}
                  disabled={isExportingAnomalyReport || trendHistory.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Generate JSON file containing all latency anomalies, correlated mutation events, and system metrics for performance audit"
                >
                  <Download className="w-3 h-3 text-amber-600" />
                  <span>Export Anomaly Report</span>
                </button>

                {/* Quick Presets */}
                <div className="inline-flex p-0.5 bg-zinc-200/80 rounded-lg text-[10px] font-medium border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setAnomalyThreshold(25)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      anomalyThreshold === 25
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Set 25ms variance threshold (Strict detection)"
                  >
                    Strict (25ms)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnomalyThreshold(50)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      anomalyThreshold === 50
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Set 50ms variance threshold (Balanced detection)"
                  >
                    Balanced (50ms)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnomalyThreshold(100)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      anomalyThreshold === 100
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Set 100ms variance threshold (Relaxed detection)"
                  >
                    Relaxed (100ms)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnomalyThreshold(200)}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      anomalyThreshold === 200
                        ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Set 200ms variance threshold (Only massive spikes)"
                  >
                    High (200ms)
                  </button>
                </div>
              </div>
            </div>

            {/* Slider Track with Interactive Input */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 font-medium w-10">10ms</span>
              <input
                id="anomaly-threshold-slider"
                type="range"
                min={10}
                max={300}
                step={5}
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                title={`Anomaly threshold slider: currently +${anomalyThreshold}ms latency variance`}
              />
              <span className="text-[10px] font-mono text-zinc-500 font-medium w-10 text-right">300ms</span>
            </div>

            {/* Anomaly Alerts Checkbox & Integration Control Bar */}
            <div className="pt-2.5 border-t border-zinc-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <label
                  htmlFor="checkbox-enable-anomaly-alerts"
                  className="inline-flex items-center gap-2 cursor-pointer select-none group"
                >
                  <input
                    id="checkbox-enable-anomaly-alerts"
                    type="checkbox"
                    checked={alertsEnabled}
                    onChange={(e) => handleToggleAlerts(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500/30 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-zinc-800 group-hover:text-zinc-950 flex items-center gap-1.5">
                    <Bell className={`w-3.5 h-3.5 ${alertsEnabled ? 'text-rose-600' : 'text-zinc-400'}`} />
                    Enable Push-Notifications &amp; Browser Alerts on Latency Spikes
                  </span>
                </label>

                {/* Alerts Active / Paused Pill */}
                {alertsEnabled ? (
                  <span
                    id="anomaly-alerts-active-badge"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {notificationPermission === 'granted'
                        ? 'Push & In-App Alerts Active'
                        : 'Browser Alerts & Sound Active'}
                    </span>
                  </span>
                ) : (
                  <span
                    id="anomaly-alerts-paused-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-500 bg-zinc-100 border border-zinc-200"
                  >
                    <BellOff className="w-3 h-3 text-zinc-400" />
                    Alerts Paused
                  </span>
                )}
              </div>

              {/* Action Buttons: Test Spike Alert & Toggle Error Log Panel */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-test-latency-spike-alert"
                  type="button"
                  onClick={handleSimulateLatencySpike}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 shadow-2xs transition-colors cursor-pointer"
                  title="Inject an intentional latency spike exceeding the threshold to test alerts and anomaly log entry"
                >
                  <Zap className="w-3 h-3 text-rose-600" />
                  <span>Test Spike Alert</span>
                </button>

                {serializationLogs && (
                  <button
                    id="btn-toggle-integrated-log-panel"
                    type="button"
                    onClick={() => setShowIntegratedLogPanel(!showIntegratedLogPanel)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition-colors cursor-pointer"
                    title="Toggle the integrated Serialization & Latency Anomaly log panel"
                  >
                    <ShieldAlert className="w-3 h-3 text-indigo-600" />
                    <span>Anomaly Log</span>
                    <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-white text-indigo-800 text-[10px] border border-indigo-200">
                      {latencyAnomaliesCount} {latencyAnomaliesCount === 1 ? 'anomaly' : 'anomalies'}
                    </span>
                  </button>
                )}

                {highDurationMutationsCount > 0 && (
                  <span
                    id="badge-high-duration-mutations-count"
                    data-testid="badge-high-duration-mutations-count"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs"
                    title={`${highDurationMutationsCount} latency data point(s) correlated with mutation threshold violations`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                    <span>
                      {highDurationMutationsCount} High-Duration Mutation{highDurationMutationsCount === 1 ? '' : 's'}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>


          {/* D3 Canvas Container */}
          <div ref={chartContainerRef} className="relative w-full flex-1 min-h-[340px]">
            <svg ref={svgRef} className="w-full h-full overflow-visible" />

            {/* Floating D3 Hover Tooltip (suppressed for the active popover node) */}
            {hoveredPoint && (!popoverPoint || hoveredPoint.point.id !== popoverPoint.point.id) && (
              <div
                className="absolute z-20 pointer-events-none bg-zinc-900 text-white rounded-lg p-3 shadow-xl border border-zinc-700 text-xs max-w-xs transition-all duration-75"
                style={{
                  left: Math.min(hoveredPoint.x + 12, (chartContainerRef.current?.clientWidth || 500) - 220),
                  top: Math.max(10, hoveredPoint.y - 110)
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5 mb-1.5">
                  <span className="font-bold text-zinc-200">{hoveredPoint.point.triggerEvent}</span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {hoveredPoint.point.timeFormatted}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4 my-1">
                  <span className="text-zinc-400">Execution Latency:</span>
                  <span className="font-mono font-bold text-sm text-emerald-400">
                    {hoveredPoint.point.executionTimeMs.toFixed(2)} ms
                  </span>
                </div>

                {/* Mutation Frequency row in Tooltip */}
                {(() => {
                  const mFreq = calculatePointMutationFrequency(
                    hoveredPoint.point,
                    trendHistory,
                    mutationHistory,
                    thresholdViolations,
                    dataTapeEntries
                  );
                  return (
                    <>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-amber-400" />
                          Mutation Frequency:
                        </span>
                        <span className="font-mono font-bold text-amber-300">
                          {mFreq} events/min
                        </span>
                      </div>
                      {mFreq >= 4 && (
                        <div className="flex items-center justify-between text-[10px] bg-amber-950/80 border border-amber-600/60 text-amber-200 px-2 py-0.5 rounded my-1 font-mono">
                          <span className="flex items-center gap-1 font-semibold text-amber-300">
                            ⚡ High Mutation Activity
                          </span>
                          <span className="text-amber-300 font-bold">+{mFreq}/min impact</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* High-Duration Mutation or Anomaly Outlier Badge in Tooltip */}
                {(() => {
                  const highDuration = checkHighDurationMutationCorrelation(hoveredPoint.point, thresholdViolations);
                  if (highDuration.isHighDurationMutation) {
                    return (
                      <div
                        id="tooltip-badge-high-duration-mutation"
                        data-testid="tooltip-badge-high-duration-mutation"
                        className="flex items-center justify-between text-[11px] bg-rose-950/95 border border-rose-500 text-rose-200 px-2 py-1 rounded my-1.5 font-mono shadow-xs"
                      >
                        <span className="flex items-center gap-1 font-bold text-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          High-Duration Mutation
                        </span>
                        <span className="font-semibold text-[10px] text-rose-300">
                          {highDuration.violation
                            ? `>${highDuration.violation.thresholdSeconds}s limit`
                            : 'Threshold Correlated'}
                        </span>
                      </div>
                    );
                  }
                  if (hoveredPoint.point.executionTimeMs - baselineLatency >= anomalyThreshold) {
                    return (
                      <div className="flex items-center justify-between text-[11px] bg-rose-950/90 border border-rose-800 text-rose-200 px-2 py-1 rounded my-1.5 font-mono">
                        <span className="flex items-center gap-1 font-bold text-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Outlier Spike
                        </span>
                        <span className="font-semibold">
                          +{(hoveredPoint.point.executionTimeMs - baselineLatency).toFixed(1)}ms variance
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {hoveredPoint.point.deltaMs !== undefined && (
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Delta vs Previous:</span>
                    <span
                      className={`font-mono font-semibold flex items-center gap-0.5 ${
                        hoveredPoint.point.deltaMs < 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {hoveredPoint.point.deltaMs < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                      {hoveredPoint.point.deltaMs < 0
                        ? `${Math.abs(hoveredPoint.point.deltaMs).toFixed(1)}ms faster`
                        : `+${hoveredPoint.point.deltaMs.toFixed(1)}ms slower`}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800 pt-1 mt-1">
                  <span>Rows Scanned: {hoveredPoint.point.rowsScanned.toLocaleString()}</span>
                  <span>Queries: {hoveredPoint.point.activeQueriesCount}</span>
                </div>
              </div>
            )}

            {/* Detailed Database Technical Specifications Popover (Click to Open) */}
            {popoverPoint && (
              <DatabaseStatePopover
                point={popoverPoint.point}
                index={popoverPoint.index}
                totalPoints={trendHistory.length}
                position={{ x: popoverPoint.x, y: popoverPoint.y }}
                containerWidth={containerDimensions.width}
                containerHeight={containerDimensions.height}
                currentFlags={currentFlags}
                onApplyFlags={(targetFlags) => {
                  (Object.keys(targetFlags) as (keyof OptimizationFlags)[]).forEach((flagKey) => {
                    if (currentFlags[flagKey] !== targetFlags[flagKey]) {
                      onToggleFlag(flagKey);
                    }
                  });
                }}
                onCompareSnapshot={(idx) => {
                  setCompareIndexB(idx);
                  setIsCompareOpen(true);
                  setPopoverPoint(null);
                }}
                onClose={() => setPopoverPoint(null)}
              />
            )}
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                <span>Fast (&lt;15ms SLA)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span>Acceptable (15-60ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
                <span>Degraded (&gt;60ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-100 border-2 border-rose-600 inline-block" />
                <span className="text-rose-700 font-semibold">Outlier Spike (&gt;+{anomalyThreshold}ms)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-200 border-2 border-rose-700 border-dashed inline-block" />
                <span className="text-rose-900 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse inline-block" />
                  High-Duration Mutation
                </span>
              </span>
              {showMutationFrequency && (
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-0.5 border-t-2 border-dashed border-amber-600 inline-block" />
                  <span className="w-2.5 h-2.5 rotate-45 bg-amber-100 border border-amber-600 inline-block -ml-1.5" />
                  <span className="text-amber-800 font-bold flex items-center gap-1">
                    Mutation Frequency (events/min)
                  </span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-medium">
              💡 Click any point on the chart to inspect full database technical specifications
            </span>
          </div>
        </div>

        {/* Right Col: Flag Impact Breakdown & Selected Point Details */}
        <div className="space-y-4">
          {/* Secondary D3 Chart: Latency Impact Breakdown */}
          <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Flag Latency Savings Breakdown</span>
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              D3 horizontal bars measuring isolated ms reduction per feature
            </p>
            <div className="flex justify-center">
              <svg ref={barChartRef} className="overflow-visible" />
            </div>
            <div className="bg-zinc-50 rounded-lg p-2.5 text-[11px] text-zinc-600 border border-zinc-200 mt-2 space-y-1">
              <div className="font-semibold text-zinc-800">Key takeaway:</div>
              <div>
                Batch Eager joins save over <strong className="text-emerald-700">400ms</strong> by
                eliminating synchronous roundtrips per order item.
              </div>
            </div>
          </div>

          {/* Selected Point Inspection Card */}
          {activeDetailPoint && (
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                <span className="text-xs font-bold text-zinc-900">
                  Inspecting Event: {activeDetailPoint.triggerEvent}
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  {activeDetailPoint.timeFormatted}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Measured Latency:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {activeDetailPoint.executionTimeMs.toFixed(2)} ms
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Rows Scanned:</span>
                  <span className="font-mono font-medium text-zinc-800">
                    {activeDetailPoint.rowsScanned.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Active Queries Fired:</span>
                  <span className="font-mono font-medium text-zinc-800">
                    {activeDetailPoint.activeQueriesCount}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Cache Result:</span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      activeDetailPoint.cacheHit
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {activeDetailPoint.cacheHit ? 'CACHE HIT' : 'CACHE MISS'}
                  </span>
                </div>
              </div>

              {/* Flags State at that Snapshot */}
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <div className="text-[11px] font-semibold text-zinc-700 mb-2">
                  Flags at Snapshot:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(activeDetailPoint.flags).map(([key, val]) => (
                    <span
                      key={key}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        val
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-500 line-through'
                      }`}
                    >
                      {key}: {val ? 'ON' : 'OFF'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Audit Export Frequency vs. System CPU Load (60-Minute Telemetry) */}
      <ExportFrequencyCpuCorrelationChart
        dataTapeEntries={dataTapeEntries}
        exportHistory={exportHistory}
        onTriggerAuditBurst={onTriggerAuditBurst}
      />

      {/* 5. Event History Chronology Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-zinc-700" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Optimization Latency Event Log ({trendHistory.length} recorded)
            </h3>
            {isLiveMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                STREAMING (5s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Latest events appear at the top
            </span>
            <button
              id="btn-log-export-pdf"
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
              title="Generate PDF benchmark report"
            >
              <FileText className="w-3 h-3 text-blue-600" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
          {[...trendHistory].reverse().map((point, revIdx) => {
            const originalIndex = trendHistory.length - 1 - revIdx;
            const isSelected = selectedPointIndex === originalIndex;
            const isFast = point.executionTimeMs < 15;

            return (
              <div
                key={point.id}
                onClick={() => setSelectedPointIndex(originalIndex)}
                className={`px-4 py-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                    : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-zinc-400 w-6">
                    #{originalIndex + 1}
                  </span>
                  <div>
                    <span className="font-medium text-zinc-900">
                      {point.triggerEvent}
                    </span>
                    <span className="text-[11px] text-zinc-400 ml-2">
                      {point.timeFormatted}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  {/* Quick Specs Popover Trigger & Set Baseline A or Target B */}
                  <div className="flex items-center gap-1 opacity-80 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Inspect technical specifications popover"
                      onClick={() => {
                        setSelectedPointIndex(originalIndex);
                        const width = containerDimensions.width;
                        const height = containerDimensions.height;
                        const frac = originalIndex / Math.max(trendHistory.length - 1, 1);
                        setPopoverPoint({
                          point,
                          index: originalIndex,
                          x: 65 + frac * (width - 100),
                          y: height * 0.4
                        });
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Specs
                    </button>
                    <button
                      type="button"
                      title="Set as Baseline Snapshot A"
                      onClick={() => setCompareIndexA(originalIndex)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        compareIndexA === originalIndex
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      Set A
                    </button>
                    <button
                      type="button"
                      title="Set as Comparison Target Snapshot B"
                      onClick={() => setCompareIndexB(originalIndex)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                        compareIndexB === originalIndex
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      Set B
                    </button>
                  </div>

                  {point.deltaMs !== undefined && (
                    <span
                      className={`text-[11px] ${
                        point.deltaMs < 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {point.deltaMs < 0
                        ? `↓ ${Math.abs(point.deltaMs).toFixed(1)}ms`
                        : `↑ ${point.deltaMs.toFixed(1)}ms`}
                    </span>
                  )}
                  {(() => {
                    const mFreq = calculatePointMutationFrequency(
                      point,
                      trendHistory,
                      mutationHistory,
                      thresholdViolations,
                      dataTapeEntries
                    );
                    if (mFreq > 0) {
                      return (
                        <span
                          className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1"
                          title={`Concurrent Mutation Frequency: ${mFreq} events/minute`}
                        >
                          <Activity className="w-2.5 h-2.5 text-amber-500" />
                          {mFreq}/m
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const highDuration = checkHighDurationMutationCorrelation(point, thresholdViolations);
                    if (highDuration.isHighDurationMutation) {
                      return (
                        <span
                          className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-rose-800 bg-rose-100 border border-rose-400 px-1.5 py-0.5 rounded shadow-2xs"
                          title={`High-Duration Mutation (${highDuration.reason})`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                          HIGH-DURATION MUTATION
                        </span>
                      );
                    }
                    if (point.executionTimeMs - baselineLatency >= anomalyThreshold) {
                      return (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] text-rose-700 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                          OUTLIER
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-xs ${
                      isFast
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {point.executionTimeMs.toFixed(2)} ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Integrated Serialization Error & Latency Anomaly Event Log Panel */}
      {showIntegratedLogPanel && serializationLogs && (
        <div id="integrated-serialization-log-section" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Telemetry Log Integration: Serialization Errors &amp; Latency Anomalies
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                Active Threshold: +{anomalyThreshold}ms
              </span>
              <button
                type="button"
                onClick={() => setShowIntegratedLogPanel(false)}
                className="text-[11px] text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
              >
                Hide Panel
              </button>
            </div>
          </div>
          <SerializationErrorLogPanel
            logs={serializationLogs}
            onClearLogs={onClearSerializationLogs || (() => {})}
            onDismissLog={onDismissSerializationLog || (() => {})}
            onSimulateFault={onSimulateFault || (() => {})}
            currentFormat="csv"
            currentRecordCount={trendHistory[trendHistory.length - 1]?.rowsScanned || 50000}
          />
        </div>
      )}

      {/* Floating 'Download Performance Report' Button */}
      <button
        id="floating-btn-download-performance-report"
        type="button"
        onClick={() => setIsPdfModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs shadow-xl hover:shadow-2xl border border-zinc-700/60 ring-4 ring-black/5 transition-all duration-200 cursor-pointer active:scale-95 group animate-fadeIn"
        title="Generate and download formatted PDF performance report"
      >
        <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 group-hover:bg-blue-500 transition-colors shadow-2xs">
          <Download className="w-3.5 h-3.5 text-white" />
        </span>
        <span className="tracking-tight">Download Performance Report</span>
        <span className="bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold transition-colors">
          PDF
        </span>
      </button>

      {/* Snapshot Compare Modal */}
      {isCompareOpen && (
        <SnapshotCompareModal
          trendHistory={trendHistory}
          indexA={compareIndexA}
          indexB={compareIndexB}
          onSelectIndexA={setCompareIndexA}
          onSelectIndexB={setCompareIndexB}
          onExportPdf={() => {
            setIsPdfModalOpen(true);
          }}
          onClose={() => setIsCompareOpen(false)}
        />
      )}

      {/* PDF Documentation Generator Modal */}
      {isPdfModalOpen && (
        <PdfReportModal
          trendHistory={trendHistory}
          currentFlags={currentFlags}
          indexA={compareIndexA}
          indexB={compareIndexB}
          svgElement={svgRef.current}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}
    </div>
  );
};
