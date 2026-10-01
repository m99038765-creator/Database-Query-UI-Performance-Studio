import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OptimizationFlags, OrderStatus, ProductCategory, LatencyTrendPoint, BulkImportResult, SerializationLogEntry } from './types';
import { executeQuery, initializeDatabase, getDatabaseStats } from './db/databaseEngine';
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
import { AlertTriangle, X } from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [alertThresholdMs, setAlertThresholdMs] = useState<number>(100);
  const [showLatencyHeatmap, setShowLatencyHeatmap] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
  const [trendHistory, setTrendHistory] = useState<LatencyTrendPoint[]>([]);
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
      />

      <OptimizationControls
        flags={flags}
        onToggleFlag={(key) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
        onResetAll={() => setFlags({ batchEagerLoading: true, btreeIndexing: true, queryCaching: true, virtualizedDOM: true, deferredRendering: true })}
        onApplyFlags={(newFlags) => setFlags(newFlags)}
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
        onResetMetrics={() => {
          setTrendHistory([]);
          setSerializationLogs([]);
          setDataTapeEntries([]);
          setProactiveToast(null);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {activeView === 'grid' ? (
          <>
            <ExplainPlanViewer
              result={queryResult}
              explainPlan={queryResult.explainPlan}
              flags={flags}
              statusFilter={statusFilter}
              categoryFilter={selectedCategory}
              searchTerm={searchQuery}
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
            onToggleFlag={(key) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
            onClose={() => setActiveView('grid')}
          />
        ) : (
          <PerformanceTrendsView
            trendHistory={trendHistory}
            currentFlags={flags}
            onToggleFlag={(key) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
            onToggleAll={(enable) => setFlags({
              batchEagerLoading: enable,
              btreeIndexing: enable,
              queryCaching: enable,
              virtualizedDOM: enable,
              deferredRendering: enable
            })}
            onClearHistory={() => setTrendHistory([])}
            onRunOptimizationSequence={() => {}}
            isSimulatingSequence={false}
            onAppendTrendPoint={(point) => setTrendHistory((prev) => [...prev, point])}
            thresholdViolations={thresholdViolationsHistory}
            mutationThreshold={mutationThreshold}
            mutationHistory={mutationHistory}
            dataTapeEntries={dataTapeEntries}
            alertThresholdMs={alertThresholdMs}
            onAlertThresholdChange={(val) => setAlertThresholdMs(val)}
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
        onToggleFlag={(key) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
        onToggleAll={(enable) => setFlags({
          batchEagerLoading: enable,
          btreeIndexing: enable,
          queryCaching: enable,
          virtualizedDOM: enable,
          deferredRendering: enable
        })}
        onClearHistory={() => setTrendHistory([])}
        onRunOptimizationSequence={() => {}}
        isSimulatingSequence={false}
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
