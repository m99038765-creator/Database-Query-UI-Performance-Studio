import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OptimizationFlags, OrderStatus, ProductCategory, LatencyTrendPoint, BulkImportResult, SerializationLogEntry, LowUsageThresholdsConfig, DEFAULT_LOW_USAGE_THRESHOLDS } from './types';
import { executeQuery, initializeDatabase, getDatabaseStats, getPlanCacheTTLSeconds, setPlanCacheTTLSeconds, clearDatabaseCache } from './db/databaseEngine';
import { useFpsMonitor } from './utils/fpsTracker';
import { Header } from './components/Header';
import { OptimizationControls } from './components/OptimizationControls';
import { MetricsBar } from './components/MetricsBar';
import { VirtualizedTable } from './components/VirtualizedTable';
import { ExplainPlanViewer } from './components/ExplainPlanViewer';
import { BenchmarkModal } from './components/BenchmarkModal';
import { PerformanceTrendsView } from './components/PerformanceTrendsView';
import { BulkImportModal } from './components/BulkImportModal';
import { DiagnosticPdfPreviewModal } from './components/DiagnosticPdfPreviewModal';
import { HistoricalDataTapeModal } from './components/HistoricalDataTapeModal';
import { SerializationErrorLogPanel } from './components/SerializationErrorLogPanel';
import { SystemResourceMonitor } from './components/SystemResourceMonitor';
import { LatencyComparisonView } from './components/LatencyComparisonView';
import { DatabaseSchemaExplorerView } from './components/DatabaseSchemaExplorerView';
import { OptimizationWizardModal } from './components/OptimizationWizardModal';
import { LatencyLegend } from './components/LatencyLegend';
import { AlertTriangle, X, Flame, Zap } from 'lucide-react';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import {
  exportRecordsToCsv,
  ExportFormat,
  ExportPerformanceResult,
  ExportHistoryPoint,
  generateInitialExportHistory
} from './utils/csvExporter';
import {
  exportDiagnosticCorrelationPdf,
  DiagnosticPdfSectionId,
  DiagnosticPdfSectionsConfig,
  DiagnosticPdfSectionGroup,
  DEFAULT_PDF_SECTION_ORDER
} from './utils/diagnosticCorrelationPdfGenerator';
import {
  DatabaseMutationHistoryEntry,
  DataTapeEntry
} from './types';
import {
  getDatabaseMutationHistory
} from './db/databaseEngine';
import {
  getInitialDataTapeEntries,
  createDataTapeEntry
} from './utils/auditDataTape';
import {
  getInitialSerializationLogs
} from './utils/serializationLogger';
import { getInitialTrendHistory } from './utils/initialTrendHistory';

export const DEFAULT_PDF_SECTION_GROUPS: DiagnosticPdfSectionGroup[] = [
  { id: 'group_metrics', title: 'Metrics Domain Group', sectionIds: ['sparklines'], isCollapsed: false },
  { id: 'group_logs', title: 'Logs Domain Group', sectionIds: ['mutationHistory'], isCollapsed: false },
  { id: 'group_strategy', title: 'Strategy Domain Group', sectionIds: ['recommendations'], isCollapsed: false },
  { id: 'group_summary', title: 'Summary Domain Group', sectionIds: ['executiveSummary'], isCollapsed: false }
];

export const PDF_SECTION_CONFIG_ITEMS: Record<
  DiagnosticPdfSectionId,
  {
    id: DiagnosticPdfSectionId;
    title: string;
    tag: string;
    badge: string;
    badgeClass: string;
    description: string;
    includeKey: 'includeSparklines' | 'includeMutationHistory' | 'includeRecommendations' | 'includeExecutiveSummary';
    breakKey: 'breakBeforeSparklines' | 'breakBeforeMutationHistory' | 'breakBeforeRecommendations' | 'breakBeforeExecutiveSummary';
    noteKey: 'sparklinesNote' | 'mutationHistoryNote' | 'recommendationsNote' | 'executiveSummaryNote';
    metadataKey: 'includeMetadataSparklines' | 'includeMetadataMutationHistory' | 'includeMetadataRecommendations' | 'includeMetadataExecutiveSummary';
    paddingKey: 'paddingSparklines' | 'paddingMutationHistory' | 'paddingRecommendations' | 'paddingExecutiveSummary';
    delimiterKey: 'sparklinesDelimiter' | 'mutationHistoryDelimiter' | 'recommendationsDelimiter' | 'executiveSummaryDelimiter';
    filenamePrefixKey: 'sparklinesFilenamePrefix' | 'mutationHistoryFilenamePrefix' | 'recommendationsFilenamePrefix' | 'executiveSummaryFilenamePrefix';
    showDividerKey: 'showDividerSparklines' | 'showDividerMutationHistory' | 'showDividerRecommendations' | 'showDividerExecutiveSummary';
    dividerColorKey: 'dividerColorSparklines' | 'dividerColorMutationHistory' | 'dividerColorRecommendations' | 'dividerColorExecutiveSummary';
    dividerStyleKey: 'dividerStyleSparklines' | 'dividerStyleMutationHistory' | 'dividerStyleRecommendations' | 'dividerStyleExecutiveSummary';
    dividerThicknessKey: 'dividerThicknessSparklines' | 'dividerThicknessMutationHistory' | 'dividerThicknessRecommendations' | 'dividerThicknessExecutiveSummary';
    barColor: string;
    inputDividerStyleId: string;
  }
> = {
  sparklines: {
    id: 'sparklines',
    title: 'Visual Latency & Write Frequency',
    tag: 'Metrics',
    badge: '50Hz Telemetry',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    description: 'Dual-panel 50Hz timeseries tracking latency response and write mutation velocity against SLA thresholds.',
    includeKey: 'includeSparklines',
    breakKey: 'breakBeforeSparklines',
    noteKey: 'sparklinesNote',
    metadataKey: 'includeMetadataSparklines',
    paddingKey: 'paddingSparklines',
    delimiterKey: 'sparklinesDelimiter',
    filenamePrefixKey: 'sparklinesFilenamePrefix',
    showDividerKey: 'showDividerSparklines',
    dividerColorKey: 'dividerColorSparklines',
    dividerStyleKey: 'dividerStyleSparklines',
    dividerThicknessKey: 'dividerThicknessSparklines',
    barColor: 'bg-cyan-500',
    inputDividerStyleId: 'select-divider-style-sparklines'
  },
  mutationHistory: {
    id: 'mutationHistory',
    title: 'Chronological Audit Chain',
    tag: 'Logs',
    badge: 'WAL Audit Log',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Tabular audit log of database write clusters, lock acquisition times, and chronological root-cause sequence of events.',
    includeKey: 'includeMutationHistory',
    breakKey: 'breakBeforeMutationHistory',
    noteKey: 'mutationHistoryNote',
    metadataKey: 'includeMetadataMutationHistory',
    paddingKey: 'paddingMutationHistory',
    delimiterKey: 'mutationHistoryDelimiter',
    filenamePrefixKey: 'mutationHistoryFilenamePrefix',
    showDividerKey: 'showDividerMutationHistory',
    dividerColorKey: 'dividerColorMutationHistory',
    dividerStyleKey: 'dividerStyleMutationHistory',
    dividerThicknessKey: 'dividerThicknessMutationHistory',
    barColor: 'bg-amber-500',
    inputDividerStyleId: 'select-divider-style-mutationHistory'
  },
  recommendations: {
    id: 'recommendations',
    title: 'Engineering Remediation Plan',
    tag: 'Strategy',
    badge: 'Heuristic Rules',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Automated heuristic directives generated by diagnostic analyzer rules to resolve lock contention hotspots and database latency bottlenecks.',
    includeKey: 'includeRecommendations',
    breakKey: 'breakBeforeRecommendations',
    noteKey: 'recommendationsNote',
    metadataKey: 'includeMetadataRecommendations',
    paddingKey: 'paddingRecommendations',
    delimiterKey: 'recommendationsDelimiter',
    filenamePrefixKey: 'recommendationsFilenamePrefix',
    showDividerKey: 'showDividerRecommendations',
    dividerColorKey: 'dividerColorRecommendations',
    dividerStyleKey: 'dividerStyleRecommendations',
    dividerThicknessKey: 'dividerThicknessRecommendations',
    barColor: 'bg-emerald-500',
    inputDividerStyleId: 'select-divider-style-recommendations'
  },
  executiveSummary: {
    id: 'executiveSummary',
    title: 'Executive Summary Briefing',
    tag: 'Summary',
    badge: 'Stakeholder View',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    description: 'High-level management briefing translating low-level table mutex locks into clear business risk and performance impact narratives.',
    includeKey: 'includeExecutiveSummary',
    breakKey: 'breakBeforeExecutiveSummary',
    noteKey: 'executiveSummaryNote',
    metadataKey: 'includeMetadataExecutiveSummary',
    paddingKey: 'paddingExecutiveSummary',
    delimiterKey: 'executiveSummaryDelimiter',
    filenamePrefixKey: 'executiveSummaryFilenamePrefix',
    showDividerKey: 'showDividerExecutiveSummary',
    dividerColorKey: 'dividerColorExecutiveSummary',
    dividerStyleKey: 'dividerStyleExecutiveSummary',
    dividerThicknessKey: 'dividerThicknessExecutiveSummary',
    barColor: 'bg-rose-500',
    inputDividerStyleId: 'select-divider-style-executiveSummary'
  }
};

export default function App() {
  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
  }, []);

  const [flags, setFlags] = useState<OptimizationFlags>({
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true,
  });

  const [lowUsageThresholds, setLowUsageThresholds] = useState<LowUsageThresholdsConfig>(() => {
    try {
      const saved = localStorage.getItem('enterprise_low_usage_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_LOW_USAGE_THRESHOLDS;
    } catch {
      return DEFAULT_LOW_USAGE_THRESHOLDS;
    }
  });

  const handleLowUsageThresholdsChange = (config: LowUsageThresholdsConfig) => {
    setLowUsageThresholds(config);
    try {
      localStorage.setItem('enterprise_low_usage_thresholds', JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [alertThresholdMs, setAlertThresholdMs] = useState<number>(100);
  const [performanceBudgetMs, setPerformanceBudgetMs] = useState<number>(200);
  const [showLatencyHeatmap, setShowLatencyHeatmap] = useState(true);
  const [showQueryIntensityOverlay, setShowQueryIntensityOverlay] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Plan Cache TTL state (in seconds)
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enterprise_plan_cache_ttl');
      return saved ? Number(saved) : getPlanCacheTTLSeconds();
    } catch {
      return 60;
    }
  });

  const handleCacheTtlChange = (newTtl: number) => {
    setCacheTtlSeconds(newTtl);
    setPlanCacheTTLSeconds(newTtl);
    setRefreshKey((k) => k + 1);
  };

  const handlePurgePlanCache = () => {
    clearDatabaseCache('User Purged Plan Cache');
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  const queryResult = useMemo(() => {
    const _tick = refreshKey;
    return executeQuery({
      searchTerm: searchQuery,
      category: selectedCategory,
      status: statusFilter,
      page,
      pageSize
    }, flags);
  }, [flags, searchQuery, selectedCategory, statusFilter, page, pageSize, refreshKey]);

  const dbStats = useMemo(() => getDatabaseStats(), [queryResult]);
  const fps = useFpsMonitor();

  // Modals state
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isPerformanceTrendsOpen, setIsPerformanceTrendsOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isHistoricalDataTapeOpen, setIsHistoricalDataTapeOpen] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [isOptimizationWizardOpen, setIsOptimizationWizardOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<{
    action: string;
    flagName: string;
    enabled: boolean;
    combo: string;
  } | null>(null);

  // PDF Export Sections config
  const [pdfExportSections, setPdfExportSections] = useState<DiagnosticPdfSectionsConfig>(() => ({
    includePageNumbers: true,
    includeSparklines: true,
    includeMutationHistory: true,
    includeRecommendations: true,
    includeExecutiveSummary: true,
    breakBeforeSparklines: false,
    breakBeforeMutationHistory: true,
    breakBeforeRecommendations: true,
    breakBeforeExecutiveSummary: false,
    sparklinesNote: '',
    mutationHistoryNote: '',
    recommendationsNote: '',
    executiveSummaryNote: '',
    includeMetadataSparklines: true,
    includeMetadataMutationHistory: true,
    includeMetadataRecommendations: true,
    includeMetadataExecutiveSummary: true,
    paddingSparklines: 10,
    paddingMutationHistory: 10,
    paddingRecommendations: 10,
    paddingExecutiveSummary: 10,
    sparklinesDelimiter: ',',
    mutationHistoryDelimiter: ',',
    recommendationsDelimiter: ',',
    executiveSummaryDelimiter: ',',
    sparklinesFilenamePrefix: '',
    mutationHistoryFilenamePrefix: '',
    recommendationsFilenamePrefix: '',
    executiveSummaryFilenamePrefix: '',
    showDividerSparklines: true,
    showDividerMutationHistory: true,
    showDividerRecommendations: true,
    showDividerExecutiveSummary: true,
    dividerColor: '#cbd5e1',
    dividerColorSparklines: '#cbd5e1',
    dividerColorMutationHistory: '#cbd5e1',
    dividerColorRecommendations: '#cbd5e1',
    dividerColorExecutiveSummary: '#cbd5e1',
    dividerStyle: 'solid',
    dividerStyleSparklines: 'solid',
    dividerStyleMutationHistory: 'solid',
    dividerStyleRecommendations: 'solid',
    dividerStyleExecutiveSummary: 'solid',
    dividerThickness: 1.5,
    dividerThicknessSparklines: 1.5,
    dividerThicknessMutationHistory: 1.5,
    dividerThicknessRecommendations: 1.5,
    dividerThicknessExecutiveSummary: 1.5,
    sectionOrder: [...DEFAULT_PDF_SECTION_ORDER],
    sectionGroups: DEFAULT_PDF_SECTION_GROUPS.map((g) => ({ ...g }))
  }));

  const [isGeneratingDiagnosticPdf, setIsGeneratingDiagnosticPdf] = useState(false);
  const [isDiagnosticPdfSuccess, setIsDiagnosticPdfSuccess] = useState(false);
  const [thresholdViolationsHistory] = useState<any[]>([]);
  const [mutationHistory] = useState<DatabaseMutationHistoryEntry[]>(() => getDatabaseMutationHistory());
  const [trendHistory, setTrendHistory] = useState<LatencyTrendPoint[]>(() => getInitialTrendHistory());
  const [isSimulatingSequence, setIsSimulatingSequence] = useState(false);

  const handleToggleFlag = (key: keyof OptimizationFlags) => {
    setFlags((prev) => {
      const nextState = !prev[key];
      const nextFlags = { ...prev, [key]: nextState };

      const now = Date.now();
      const d = new Date(now);
      const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

      let baseLatency = 0.15;
      let rowsScanned = 100;
      let activeQueries = 1;
      let isCacheHit = false;
      let simulatedError: string | null = null;

      if (!nextFlags.batchEagerLoading) {
        baseLatency = 468.4 + Math.random() * 20;
        rowsScanned = 50000;
        activeQueries = 101;
        simulatedError = 'Database Connection Pool Timeout: max_connections (25) exceeded!';
      } else if (!nextFlags.btreeIndexing) {
        baseLatency = 49.2 + Math.random() * 6;
        rowsScanned = 50000;
      } else if (!nextFlags.virtualizedDOM) {
        baseLatency = 18.5 + Math.random() * 3;
      } else if (!nextFlags.deferredRendering) {
        baseLatency = 3.6 + Math.random() * 1.2;
      } else if (!nextFlags.queryCaching) {
        baseLatency = 1.42 + Math.random() * 0.3;
      } else {
        baseLatency = 0.15 + Math.random() * 0.06;
        isCacheHit = true;
      }

      setTrendHistory((h) => {
        const prevPoint = h[h.length - 1];
        const prevLatency = prevPoint ? prevPoint.executionTimeMs : 1.2;
        const delta = Number((baseLatency - prevLatency).toFixed(2));

        const newPoint: LatencyTrendPoint = {
          id: `pt-flag-${now}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          timeFormatted,
          executionTimeMs: Number(baseLatency.toFixed(2)),
          rowsScanned,
          activeQueriesCount: activeQueries,
          cacheHit: isCacheHit,
          flags: nextFlags,
          flagToggled: key,
          flagToggledState: nextState,
          deltaMs: delta,
          triggerEvent: `Flag ${key}: ${nextState ? 'ON' : 'OFF'} (${nextState ? 'Optimized' : 'Regression'})`,
          simulatedError
        };

        return [...h, newPoint];
      });

      return nextFlags;
    });
  };

  // Global Keyboard Shortcuts for Performance Optimizations (e.g. Ctrl+I, Ctrl+C, Ctrl+B, Ctrl+V, Ctrl+D)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      // '?' or 'Shift+/' opens shortcuts cheat sheet (when not typing in an input)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Escape closes shortcuts modal
      if (e.key === 'Escape' && isShortcutsModalOpen) {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Trigger shortcut toast helper
      const notifyShortcut = (combo: string, flagName: string, enabled: boolean) => {
        setShortcutToast({
          action: `${flagName} ${enabled ? 'ENABLED' : 'DISABLED'}`,
          flagName,
          enabled,
          combo
        });
      };

      // 1. Ctrl+I / ⌘I -> Toggle B-Tree Indexing
      if (isModifier && key === 'i' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.btreeIndexing;
          handleToggleFlag('btreeIndexing');
          notifyShortcut(e.metaKey ? '⌘I' : 'Ctrl+I', 'B-Tree Indexing', nextVal);
          return;
        }
      }

      // 2. Ctrl+C / ⌘C -> Toggle LRU Query Cache (only when no text is highlighted and not in text input)
      // Also Alt+C unconditionally
      if ((isModifier && key === 'c' && !e.shiftKey && !e.altKey) || (e.altKey && key === 'c')) {
        const selectedText = window.getSelection()?.toString();
        const hasSelection = selectedText && selectedText.trim().length > 0;
        if (!isInput && !hasSelection) {
          e.preventDefault();
          const nextVal = !flags.queryCaching;
          handleToggleFlag('queryCaching');
          notifyShortcut(e.metaKey ? '⌘C' : 'Ctrl+C', 'LRU Query Caching', nextVal);
          return;
        }
      }

      // 3. Ctrl+B / ⌘B -> Toggle Batch Eager Loading (N+1 query elimination)
      if (isModifier && key === 'b' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.batchEagerLoading;
          handleToggleFlag('batchEagerLoading');
          notifyShortcut(e.metaKey ? '⌘B' : 'Ctrl+B', 'Batch Eager Loading', nextVal);
          return;
        }
      }

      // 4. Ctrl+V / ⌘V -> Toggle DOM Virtualization (only when not in text input)
      if (isModifier && key === 'v' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.virtualizedDOM;
          handleToggleFlag('virtualizedDOM');
          notifyShortcut(e.metaKey ? '⌘V' : 'Ctrl+V', 'DOM Virtualization', nextVal);
          return;
        }
      }

      // 5. Ctrl+D / ⌘D -> Toggle Deferred Rendering
      if (isModifier && key === 'd' && !e.shiftKey && !e.altKey) {
        if (!isInput) {
          e.preventDefault();
          const nextVal = !flags.deferredRendering;
          handleToggleFlag('deferredRendering');
          notifyShortcut(e.metaKey ? '⌘D' : 'Ctrl+D', 'Deferred Rendering', nextVal);
          return;
        }
      }

      // 6. Ctrl+Shift+O / ⌘Shift+O -> Toggle All Optimizations (Fix All / Simulate Bottlenecks)
      if (isModifier && (e.shiftKey || e.altKey) && key === 'o') {
        if (!isInput) {
          e.preventDefault();
          const allActive = Object.values(flags).every(Boolean);
          const nextVal = !allActive;
          setFlags({
            batchEagerLoading: nextVal,
            btreeIndexing: nextVal,
            queryCaching: nextVal,
            virtualizedDOM: nextVal,
            deferredRendering: nextVal
          });
          notifyShortcut(
            e.metaKey ? '⌘Shift+O' : 'Ctrl+Shift+O',
            nextVal ? 'All Optimizations' : 'Bottleneck Simulation',
            nextVal
          );
          return;
        }
      }

      // 7. Ctrl+Shift+B / ⌘Shift+B -> Open Benchmark Modal
      if (isModifier && e.shiftKey && key === 'b') {
        if (!isInput) {
          e.preventDefault();
          setIsBenchmarkModalOpen(true);
          notifyShortcut(e.metaKey ? '⌘Shift+B' : 'Ctrl+Shift+B', 'Benchmark Modal', true);
          return;
        }
      }

      // 8. Ctrl+Shift+F / ⌘Shift+F -> Fix All (Automatically apply all missing optimizations & indexes)
      if (isModifier && e.shiftKey && key === 'f') {
        if (!isInput) {
          e.preventDefault();
          setFlags({
            batchEagerLoading: true,
            btreeIndexing: true,
            queryCaching: true,
            virtualizedDOM: true,
            deferredRendering: true
          });
          notifyShortcut(e.metaKey ? '⌘Shift+F' : 'Ctrl+Shift+F', 'Fix All (Applied All Optimizations)', true);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [flags, isShortcutsModalOpen]);

  // Auto-dismiss shortcut toast after 2.8 seconds
  useEffect(() => {
    if (!shortcutToast) return;
    const timer = setTimeout(() => {
      setShortcutToast(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [shortcutToast]);

  const handleRunOptimizationSequence = () => {
    if (isSimulatingSequence) return;
    setIsSimulatingSequence(true);

    const steps: { flag: keyof OptimizationFlags; enable: boolean; label: string }[] = [
      { flag: 'queryCaching', enable: false, label: 'Disable LRU Query Caching' },
      { flag: 'queryCaching', enable: true, label: 'Restore LRU Query Caching' },
      { flag: 'btreeIndexing', enable: false, label: 'Disable B-Tree Indexing (Full Table Scan)' },
      { flag: 'btreeIndexing', enable: true, label: 'Restore B-Tree Indexing' },
      { flag: 'batchEagerLoading', enable: false, label: 'Disable Batch Eager Loading (N+1 Storm)' },
      { flag: 'batchEagerLoading', enable: true, label: 'Restore Batch Eager Loading' },
      { flag: 'virtualizedDOM', enable: false, label: 'Disable DOM Virtualization' },
      { flag: 'virtualizedDOM', enable: true, label: 'Restore DOM Virtualization' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx >= steps.length) {
        clearInterval(interval);
        setIsSimulatingSequence(false);
        return;
      }
      const s = steps[stepIdx];
      stepIdx++;
      setFlags((prev) => {
        const nextFlags = { ...prev, [s.flag]: s.enable };
        const now = Date.now();
        const d = new Date(now);
        const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

        let baseLatency = 0.16;
        let rowsScanned = 100;
        let activeQueries = 1;
        let isCacheHit = false;
        let simulatedError: string | null = null;

        if (!nextFlags.batchEagerLoading) {
          baseLatency = 472.5;
          rowsScanned = 50000;
          activeQueries = 101;
          simulatedError = 'Database Connection Pool Timeout: max_connections (25) exceeded!';
        } else if (!nextFlags.btreeIndexing) {
          baseLatency = 51.8;
          rowsScanned = 50000;
        } else if (!nextFlags.virtualizedDOM) {
          baseLatency = 19.2;
        } else if (!nextFlags.queryCaching) {
          baseLatency = 1.45;
        } else {
          baseLatency = 0.15;
          isCacheHit = true;
        }

        setTrendHistory((h) => {
          const prevPt = h[h.length - 1];
          const prevLat = prevPt ? prevPt.executionTimeMs : 1.2;
          const delta = Number((baseLatency - prevLat).toFixed(2));
          return [
            ...h,
            {
              id: `pt-seq-${now}-${stepIdx}`,
              timestamp: now,
              timeFormatted,
              executionTimeMs: Number(baseLatency.toFixed(2)),
              rowsScanned,
              activeQueriesCount: activeQueries,
              cacheHit: isCacheHit,
              flags: nextFlags,
              flagToggled: s.flag,
              flagToggledState: s.enable,
              deltaMs: delta,
              triggerEvent: `Simulation: ${s.label}`,
              simulatedError
            }
          ];
        });

        return nextFlags;
      });
    }, 750);
  };
  const [mutationThreshold] = useState<number>(100);
  const [activeView, setActiveView] = useState<'grid' | 'trends' | 'comparison' | 'schema'>('grid');
  const [serializationLogs, setSerializationLogs] = useState<SerializationLogEntry[]>(() => getInitialSerializationLogs());
  const [dataTapeEntries, setDataTapeEntries] = useState<DataTapeEntry[]>(() => getInitialDataTapeEntries());
  const [selectedTapeEntry, setSelectedTapeEntry] = useState<DataTapeEntry | null>(null);

  const handleAutoCaptureSnapshot = async (
    triggerEvent: string,
    details: { memoryMb: number; cpuUsage: number; slope: number }
  ) => {
    try {
      const records = queryResult.records || [];
      const { entry } = await createDataTapeEntry({
        records,
        format: 'json',
        triggerEvent: `[AUTO-CAPTURE] ${triggerEvent} (RAM: ${details.memoryMb}MB, CPU: ${details.cpuUsage}%, Trend: +${details.slope.toFixed(1)} MB/min)`,
        databaseTotalRecords: queryResult.totalCount,
        filterSummary: {
          searchTerm: searchQuery,
          status: statusFilter,
          category: selectedCategory,
          pageSize: queryResult.records.length
        },
        sequenceNumber: dataTapeEntries.length + 1,
        includeHeaders: true
      });

      setDataTapeEntries((prev) => [entry, ...prev]);
      setProactiveToast({
        title: 'Auto-Capture: Critical Threshold',
        message: `Performance snapshot auto-captured to Historical Data Tape (${entry.tapeId}): ${triggerEvent}`
      });
    } catch (err) {
      console.error('Failed to auto-capture performance snapshot:', err);
    }
  };

  const [proactiveToast, setProactiveToast] = useState<{
    title: string;
    message: string;
    flagToEnable?: keyof OptimizationFlags;
    flagName?: string;
  } | null>(null);

  useEffect(() => {
    if (queryResult.executionTimeMs > 130 && !flags.btreeIndexing) {
      setProactiveToast({
        title: 'High Latency Detected',
        message: `Query took ${queryResult.executionTimeMs.toFixed(1)}ms due to sequential table scan.`,
        flagToEnable: 'btreeIndexing',
        flagName: 'B-Tree Indexing'
      });
    } else if (queryResult.executionTimeMs > 110 && !flags.batchEagerLoading) {
      setProactiveToast({
        title: 'Connection Pool Warning',
        message: `N+1 query cascade detected (${queryResult.executionTimeMs.toFixed(1)}ms).`,
        flagToEnable: 'batchEagerLoading',
        flagName: 'Batch Eager Loading'
      });
    }
  }, [queryResult.executionTimeMs, flags.btreeIndexing, flags.batchEagerLoading]);

  const handleGenerateDiagnosticCorrelationPdf = async () => {
    setIsGeneratingDiagnosticPdf(true);
    try {
      await exportDiagnosticCorrelationPdf({
        currentFlags: flags,
        options: { sections: pdfExportSections },
        thresholdViolations: thresholdViolationsHistory,
        mutationHistory,
        trendHistory,
        mutationThreshold
      });
      setIsDiagnosticPdfSuccess(true);
      setTimeout(() => setIsDiagnosticPdfSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
    } finally {
      setIsGeneratingDiagnosticPdf(false);
    }
  };

  const handleExportCsv = () => {
    exportRecordsToCsv(queryResult.records);
  };

  const handleExportDiagnosticPackage = () => {
    const diagnosticPackage = {
      packageVersion: 'v1.0.0',
      exportTimestamp: new Date().toISOString(),
      systemState: {
        flags,
        totalRecords: queryResult.totalCount || 50000,
        cacheHit: queryResult.cacheHit,
        executionTimeMs: queryResult.executionTimeMs,
        activeErrorsCount: queryResult.simulatedError ? 1 : 0
      },
      performanceTrends: trendHistory.slice(-20),
      auditDataTapes: dataTapeEntries.slice(-10),
      serializationLogsCount: serializationLogs.length
    };

    const blob = new Blob([JSON.stringify(diagnosticPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_diagnostic_package_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleQuickSnapshot = async () => {
    try {
      const records = queryResult.records || [];
      const { entry } = await createDataTapeEntry({
        records,
        format: 'json',
        triggerEvent: `[QUICK SNAPSHOT] Manual Header Capture at ${new Date().toLocaleTimeString()}`,
        databaseTotalRecords: queryResult.totalCount,
        filterSummary: {
          searchTerm: searchQuery,
          status: statusFilter,
          category: selectedCategory,
          pageSize: queryResult.records.length
        },
        sequenceNumber: dataTapeEntries.length + 1,
        includeHeaders: true
      });

      setDataTapeEntries((prev) => [entry, ...prev]);
      setProactiveToast({
        title: 'Quick Snapshot Saved',
        message: `System configuration and metrics persisted to Historical Data Tape (${entry.tapeId}) successfully.`
      });
      setTimeout(() => setProactiveToast(null), 4000);
    } catch (err) {
      console.error('Failed to create quick snapshot:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      <Header
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onRunBenchmark={() => setIsBenchmarkModalOpen(true)}
        isBenchmarking={false}
        hasErrors={false}
        activeErrorCount={0}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        trendCount={trendHistory.length}
        totalRecords={queryResult.totalCount || 50000}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
        onOpenTrends={() => {
          setActiveView('trends');
          setIsPerformanceTrendsOpen(true);
        }}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
        onOpenHistoryTape={() => setIsHistoricalDataTapeOpen(true)}
        onExportCsv={handleExportCsv}
        onOpenPdfPreview={() => setShowPdfPreviewModal(true)}
        onOpenWizard={() => setIsOptimizationWizardOpen(true)}
        dataTapeEntries={dataTapeEntries}
        onSelectTapeEntry={(entry) => {
          setSelectedTapeEntry(entry);
          setIsHistoricalDataTapeOpen(true);
        }}
        onExportDiagnosticPackage={handleExportDiagnosticPackage}
        onQuickSnapshot={handleQuickSnapshot}
        showQueryIntensityOverlay={showQueryIntensityOverlay}
        onToggleQueryIntensityOverlay={setShowQueryIntensityOverlay}
        onOpenShortcutsCheatSheet={() => setIsShortcutsModalOpen(true)}
      />

      <OptimizationControls
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onResetAll={() => setFlags({ batchEagerLoading: true, btreeIndexing: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true })}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
        lowUsageThresholds={lowUsageThresholds}
        onLowUsageThresholdsChange={handleLowUsageThresholdsChange}
        cacheTtl={cacheTtlSeconds}
        onCacheTtlChange={handleCacheTtlChange}
        onPurgePlanCache={handlePurgePlanCache}
      />

      <MetricsBar
        queryResult={queryResult}
        flags={flags}
        dbStats={dbStats}
        fps={fps}
        currentFps={fps}
        renderedDomCount={flags.virtualizedDOM ? Math.min(queryResult.records.length, 18) : queryResult.records.length}
        totalDatabaseRecords={dbStats?.totalRecords || 50000}
        onOpenBulkImport={() => setIsBulkImportOpen(true)}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={(enabled) => setAutoRefreshEnabled(enabled)}
        alertThresholdMs={alertThresholdMs}
        onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
        heatmapModeEnabled={showLatencyHeatmap}
        onToggleHeatmapMode={setShowLatencyHeatmap}
        performanceBudgetMs={performanceBudgetMs}
        onPerformanceBudgetChange={setPerformanceBudgetMs}
        onToggleFlag={handleToggleFlag}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
        onAutoOptimize={() => setFlags({
          batchEagerLoading: true,
          btreeIndexing: true,
          queryCaching: true,
          virtualizedDOM: true,
          deferredRendering: true
        })}
        onResetMetrics={() => {
          setTrendHistory([]);
          setSerializationLogs([]);
          setDataTapeEntries([]);
          setProactiveToast(null);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* Global Query Intensity Heatmap Overlay Banner */}
        {showQueryIntensityOverlay && (
          <div className="p-4 bg-gradient-to-r from-rose-950 via-amber-950 to-zinc-950 text-white rounded-2xl border-2 border-rose-500 shadow-2xl flex items-center justify-between gap-4 animate-fadeIn relative z-40 ring-4 ring-rose-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md animate-bounce">
                <Flame className="w-6 h-6 text-amber-200" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-white tracking-wide">🔥 Global Query Intensity Heatmap Overlay Active</h3>
                  <span className="font-mono text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">High Thermal Load</span>
                </div>
                <p className="text-xs text-rose-200">
                  Visualizing execution plan cost bottlenecks, sequential scan memory pressure, and N+1 query hotspots across the application interface in real-time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQueryIntensityOverlay(false)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
            >
              Disable Overlay
            </button>
          </div>
        )}

        {activeView === 'grid' ? (
          <>
            <ExplainPlanViewer
              result={queryResult}
              explainPlan={queryResult.explainPlan}
              flags={flags}
              statusFilter={statusFilter}
              categoryFilter={selectedCategory}
              searchTerm={searchQuery}
              cacheTtl={cacheTtlSeconds}
              onCacheTtlChange={handleCacheTtlChange}
              onPurgeCache={handlePurgePlanCache}
              onRefreshPlan={() => setRefreshKey((k) => k + 1)}
            />

            <LatencyLegend showLatencyHeatmap={showLatencyHeatmap} />

            <VirtualizedTable
              records={queryResult.records}
              totalCount={queryResult.totalCount}
              flags={flags}
              searchTerm={searchQuery}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              categoryFilter={selectedCategory}
              onCategoryChange={setSelectedCategory}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              virtualizedEnabled={flags.virtualizedDOM}
              simulatedError={queryResult.simulatedError}
              warningNotice={queryResult.warningNotice}
              showLatencyHeatmapProp={showLatencyHeatmap}
              onToggleLatencyHeatmap={setShowLatencyHeatmap}
              onFixNPlusOne={() => setFlags((prev) => ({ ...prev, batchEagerLoading: true }))}
              onAutoOptimize={() => setFlags({
                batchEagerLoading: true,
                btreeIndexing: true,
                queryCaching: true,
                virtualizedDOM: true,
                deferredRendering: true
              })}
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
              cacheHit={queryResult.cacheHit}
              executionTimeMs={queryResult.executionTimeMs}
            />

            <SerializationErrorLogPanel
              logs={serializationLogs}
              onClearLogs={() => setSerializationLogs([])}
              onDismissLog={(id) => setSerializationLogs((prev) => prev.filter((l) => l.id !== id))}
              onSimulateFault={() => {}}
              currentFormat="csv"
              currentRecordCount={queryResult.totalCount || 50000}
              alertThresholdMs={alertThresholdMs}
              records={queryResult.records}
              flags={flags}
            />
          </>
        ) : activeView === 'comparison' ? (
          <LatencyComparisonView
            trendHistory={trendHistory}
            onClose={() => setActiveView('grid')}
          />
        ) : activeView === 'schema' ? (
          <DatabaseSchemaExplorerView
            flags={flags}
            onToggleFlag={handleToggleFlag}
            onClose={() => setActiveView('grid')}
            lowUsageThresholds={lowUsageThresholds}
          />
        ) : (
          <PerformanceTrendsView
            trendHistory={trendHistory}
            currentFlags={flags}
            onToggleFlag={handleToggleFlag}
            onApplyFlags={setFlags}
            onToggleAll={(enable) => setFlags({
              batchEagerLoading: enable,
              btreeIndexing: enable,
              queryCaching: enable,
              virtualizedDOM: enable,
              deferredRendering: enable
            })}
            onClearHistory={() => setTrendHistory([])}
            onRunOptimizationSequence={handleRunOptimizationSequence}
            isSimulatingSequence={isSimulatingSequence}
            onAppendTrendPoint={(point) => setTrendHistory((prev) => [...prev, point])}
            thresholdViolations={thresholdViolationsHistory}
            mutationThreshold={mutationThreshold}
            mutationHistory={mutationHistory}
            dataTapeEntries={dataTapeEntries}
            alertThresholdMs={alertThresholdMs}
            onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
            onFilterVirtualizedTable={(query) => setSearchQuery(query)}
            onNavigateToGrid={() => setActiveView('grid')}
          />
        )}
      </main>

      {/* Modals */}
      <BenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
        currentFlags={flags}
        onApplyFlags={setFlags}
      />

      <PerformanceTrendsView
        isOpen={isPerformanceTrendsOpen}
        onClose={() => setIsPerformanceTrendsOpen(false)}
        trendHistory={trendHistory}
        currentFlags={flags}
        onToggleFlag={handleToggleFlag}
        onApplyFlags={setFlags}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onClearHistory={() => setTrendHistory([])}
        onRunOptimizationSequence={handleRunOptimizationSequence}
        isSimulatingSequence={isSimulatingSequence}
        onAppendTrendPoint={(point) => setTrendHistory((prev) => [...prev, point])}
        thresholdViolations={thresholdViolationsHistory}
        mutationThreshold={mutationThreshold}
        mutationHistory={mutationHistory}
        dataTapeEntries={dataTapeEntries}
        alertThresholdMs={alertThresholdMs}
        onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={(res: BulkImportResult) => {
          // Trigger refresh
          setPage(1);
        }}
      />

      <HistoricalDataTapeModal
        isOpen={isHistoricalDataTapeOpen}
        onClose={() => setIsHistoricalDataTapeOpen(false)}
        entries={dataTapeEntries}
        initialEntries={dataTapeEntries}
        initialSelectedEntry={selectedTapeEntry}
        onClearTape={() => setDataTapeEntries([])}
      />

      <DiagnosticPdfPreviewModal
        isOpen={showPdfPreviewModal}
        onClose={() => setShowPdfPreviewModal(false)}
        onDownload={handleGenerateDiagnosticCorrelationPdf}
        isDownloading={isGeneratingDiagnosticPdf}
        isDownloadSuccess={isDiagnosticPdfSuccess}
        thresholdViolations={thresholdViolationsHistory}
        mutationHistory={mutationHistory}
        trendHistory={trendHistory}
        mutationThreshold={mutationThreshold}
        currentFlags={flags}
        sectionsConfig={pdfExportSections}
        onUpdateSections={setPdfExportSections}
      />

      {/* System Resource Monitor Widget */}
      <SystemResourceMonitor
        flags={flags}
        recordCount={queryResult.totalCount}
        cacheHit={queryResult.cacheHit}
        onAutoCaptureSnapshot={handleAutoCaptureSnapshot}
      />

      {/* Optimization Wizard Modal */}
      <OptimizationWizardModal
        isOpen={isOptimizationWizardOpen}
        onClose={() => setIsOptimizationWizardOpen(false)}
        flags={flags}
        queryResult={queryResult}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
      />

      {/* Global Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        flags={flags}
        onToggleFlag={handleToggleFlag}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onOpenBenchmark={() => setIsBenchmarkModalOpen(true)}
      />

      {/* Shortcut Execution Feedback Toast */}
      {shortcutToast && (
        <div
          id="toast-shortcut-execution"
          data-testid="toast-shortcut-execution"
          className="fixed bottom-6 right-6 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 text-white px-4 py-2.5 rounded-xl shadow-2xl animate-metric-slide-up flex items-center gap-3 ring-2 ring-amber-400/20"
        >
          <div className={`p-1.5 rounded-lg border ${
            shortcutToast.enabled
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-semibold text-zinc-100 flex items-center gap-2">
              <span>Hotkey Registered</span>
              <kbd className="font-mono text-[10px] bg-zinc-950 text-amber-300 border border-zinc-700 px-1.5 py-0.2 rounded font-bold shadow-2xs">
                {shortcutToast.combo}
              </kbd>
            </div>
            <div className="text-zinc-300 text-[11px] mt-0.5">
              {shortcutToast.flagName}:{' '}
              <span className={`font-mono font-bold ${
                shortcutToast.enabled ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {shortcutToast.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShortcutToast(null)}
            className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proactive Optimization Suggestion Toast */}
      {proactiveToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-zinc-900 border border-zinc-700 text-white p-4 rounded-xl shadow-2xl max-w-md animate-fadeIn flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white flex items-center justify-between">
              <span>{proactiveToast.title}</span>
              <button
                type="button"
                onClick={() => setProactiveToast(null)}
                className="text-zinc-400 hover:text-white cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </h4>
            <p className="text-xs text-zinc-300 mt-0.5">
              {proactiveToast.message} Proactively suggest enabling <strong className="text-amber-300">{proactiveToast.flagName}</strong> to optimize performance.
            </p>
            {proactiveToast.flagToEnable && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (proactiveToast.flagToEnable) {
                      setFlags((prev) => ({ ...prev, [proactiveToast.flagToEnable!]: true }));
                    }
                    setProactiveToast(null);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Enable {proactiveToast.flagName} Now
                </button>
                <button
                  type="button"
                  onClick={() => setProactiveToast(null)}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
