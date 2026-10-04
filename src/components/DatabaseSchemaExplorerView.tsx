import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Database, Layers, Key, Link, AlertTriangle, CheckCircle2, Shield, ShieldCheck, ShieldAlert, ArrowRight, Zap, Table, Plus, Info, X, Download, Sparkles, History, Target, RefreshCw, Trash2, ChevronDown, ChevronRight, ChevronUp, Search, Filter, Activity, Flame, HeartPulse, Copy, UploadCloud, FileText, Check, FileCode, Lock, Unlock, Terminal, Code, Sliders, TrendingUp, CheckSquare, GitMerge, PieChart, BarChart2, Clock, Compass } from 'lucide-react';
import { OptimizationFlags, LowUsageThresholdsConfig, DEFAULT_LOW_USAGE_THRESHOLDS } from '../types';
import { SerializationErrorLogPanel } from './SerializationErrorLogPanel';
import { IndexEfficiencyTrendChart } from './IndexEfficiencyTrendChart';
import { IndexPerformanceDeltaBarChart } from './IndexPerformanceDeltaBarChart';
import { ComplexityHeatmapPanel } from './ComplexityHeatmapPanel';
import { IndexLifecycleAnalyticsPanel } from './IndexLifecycleAnalyticsPanel';
import { IndexUsageOverviewDashboard } from './IndexUsageOverviewDashboard';
import { IntelligentIndexingAdvisorModal, CoveringIndexPatch, COVERING_INDEX_CATALOG } from './IntelligentIndexingAdvisorModal';
import { IndexImpactMap, IndexImpactMapItem } from './IndexImpactMap';
import { IndexHealthMonitor } from './IndexHealthMonitor';
import { IndexStorageHeatmap } from './IndexStorageHeatmap';
import { IndexHeatmap } from './IndexHeatmap';
import { GlobalIndexCorrelationChart } from './GlobalIndexCorrelationChart';
import { IndexChangeHistoryPanel } from './IndexChangeHistoryPanel';

interface DatabaseSchemaExplorerViewProps {
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onClose?: () => void;
  lowUsageThresholds?: LowUsageThresholdsConfig;
}

export interface SchemaSnapshot {
  id: string;
  name: string;
  timestamp: string;
  flags: OptimizationFlags;
  customIndexes: string[];
  createdCompositeIndexes?: string[];
  removedIndexes?: string[];
  lockedIndexes?: string[];
  isProtected?: boolean;
  importedCustomIndices?: Array<{
    name: string;
    type: string;
    columns: string[];
    targetTable: string;
    targetEntity?: string;
    active: boolean;
  }>;
  activeSchemaPrototypeName?: string;
  totalIndexesCount?: number;
}

const IndexActivitySparkline: React.FC<{ indexName: string; reads: number; writes: number }> = ({ indexName, reads, writes }) => {
  const hash = indexName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const readPoints = [
    Math.round((reads / 5) * (0.6 + ((hash % 7) * 0.1))),
    Math.round((reads / 5) * (0.8 + (((hash + 3) % 5) * 0.15))),
    Math.round((reads / 5) * (0.5 + (((hash * 2) % 9) * 0.1))),
    Math.round((reads / 5) * (1.1 + (((hash + 7) % 4) * 0.2))),
    Math.round((reads / 5) * (0.9 + (((hash * 3) % 6) * 0.1)))
  ];
  const writePoints = [
    Math.round((writes / 5) * (0.7 + (((hash + 1) % 6) * 0.1))),
    Math.round((writes / 5) * (0.9 + (((hash + 4) % 4) * 0.15))),
    Math.round((writes / 5) * (1.2 + (((hash * 5) % 3) * 0.2))),
    Math.round((writes / 5) * (0.6 + (((hash + 2) % 8) * 0.1))),
    Math.round((writes / 5) * (0.8 + (((hash * 4) % 5) * 0.15)))
  ];

  const maxVal = Math.max(1, ...readPoints, ...writePoints);
  const width = 130;
  const height = 34;

  const getPointsString = (pts: number[]) => {
    return pts.map((val, idx) => {
      const x = (idx / (pts.length - 1)) * (width - 12) + 6;
      const y = height - 6 - (val / maxVal) * (height - 12);
      return `${x},${y}`;
    }).join(' ');
  };

  const readPath = getPointsString(readPoints);
  const writePath = getPointsString(writePoints);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const labels = ['T-5m', 'T-4m', 'T-3m', 'T-2m', 'Now'];

  return (
    <div className="p-2.5 bg-white/95 rounded-xl border border-indigo-200 my-1 text-xs space-y-1 shadow-2xs font-mono">
      <div className="flex items-center justify-between text-[10px] text-zinc-600 font-bold border-b border-zinc-100 pb-1">
        <span className="text-indigo-950 flex items-center gap-1">
          <Activity className="w-3 h-3 text-indigo-600 animate-pulse" />
          <span>5-Min Read/Write Sparkline</span>
        </span>
        {hoverIdx !== null ? (
          <span className="text-[9px] bg-indigo-100 text-indigo-950 px-1.5 py-0.2 rounded font-mono font-bold">
            {labels[hoverIdx]}: {readPoints[hoverIdx]}R / {writePoints[hoverIdx]}W
          </span>
        ) : (
          <span className="text-[9px] text-zinc-400">Interactive (Hover)</span>
        )}
      </div>
      <div className="relative flex items-center justify-center pt-1">
        <svg width={width} height={height} className="overflow-visible">
          <line x1="6" y1="6" x2={width - 6} y2="6" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="6" y1={height / 2} x2={width - 6} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2 2" />

          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={readPath}
          />
          <polyline
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={writePath}
          />

          {readPoints.map((val, idx) => {
            const x = (idx / (readPoints.length - 1)) * (width - 12) + 6;
            const yRead = height - 6 - (val / maxVal) * (height - 12);
            const yWrite = height - 6 - (writePoints[idx] / maxVal) * (height - 12);
            const isHovered = hoverIdx === idx;
            return (
              <g key={`spark-${idx}`}>
                <circle
                  cx={x}
                  cy={yRead}
                  r={isHovered ? 5 : 3}
                  className="fill-emerald-600 stroke-white stroke-2 cursor-pointer transition-all"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
                <circle
                  cx={x}
                  cy={yWrite}
                  r={isHovered ? 5 : 3}
                  className="fill-rose-600 stroke-white stroke-2 cursor-pointer transition-all"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono px-0.5 pt-0.5">
        <span>T-5m</span>
        <span className="text-emerald-700 font-semibold">Reads (—)</span>
        <span className="text-rose-700 font-semibold">Writes (—)</span>
        <span>Now</span>
      </div>
    </div>
  );
};

const IndexSizeTrendSparkline: React.FC<{ indexName: string; baseSizeMb?: number }> = ({ indexName, baseSizeMb = 12.4 }) => {
  const hash = indexName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isBloated = (hash % 3 === 0) || indexName.includes('composite');
  const growthMultiplier = isBloated ? 1.45 : 1.05;

  const sizePoints = [
    +(baseSizeMb * (0.8 + ((hash % 5) * 0.05))).toFixed(1),
    +(baseSizeMb * (0.85 + (((hash + 2) % 6) * 0.04))).toFixed(1),
    +(baseSizeMb * (0.9 + (((hash * 3) % 4) * 0.06))).toFixed(1),
    +(baseSizeMb * (0.96 + (((hash + 4) % 5) * 0.05))).toFixed(1),
    +(baseSizeMb * (1.0 + (((hash * 2) % 3) * 0.08))).toFixed(1),
    +(baseSizeMb * growthMultiplier).toFixed(1)
  ];

  const minSize = Math.min(...sizePoints);
  const maxSize = Math.max(...sizePoints, minSize + 0.5);
  const width = 120;
  const height = 30;

  const getPointsString = (pts: number[]) => {
    return pts.map((val, idx) => {
      const x = (idx / (pts.length - 1)) * (width - 10) + 5;
      const y = height - 5 - ((val - minSize) / (maxSize - minSize || 1)) * (height - 10);
      return `${x},${y}`;
    }).join(' ');
  };

  const pathStr = getPointsString(sizePoints);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const timeLabels = ['24h ago', '18h ago', '12h ago', '6h ago', '2h ago', 'Now'];

  return (
    <div className="p-2 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1 shadow-2xs font-mono my-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-600 font-bold border-b border-zinc-100 pb-1">
        <span className="flex items-center gap-1 text-zinc-800">
          <Database className="w-3 h-3 text-cyan-600" />
          <span>Size Trend (24h)</span>
        </span>
        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
          isBloated ? 'bg-rose-100 text-rose-900 animate-pulse' : 'bg-emerald-100 text-emerald-900'
        }`}>
          {isBloated ? 'Bloated (+45%)' : 'Stable'}
        </span>
      </div>
      <div className="relative flex items-center justify-center pt-1">
        <svg width={width} height={height} className="overflow-visible">
          <line x1="5" y1="5" x2={width - 5} y2="5" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="5" y1={height / 2} x2={width - 5} y2={height / 2} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2 2" />

          <polyline
            fill="none"
            stroke={isBloated ? '#f43f5e' : '#0ea5e9'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pathStr}
          />

          {sizePoints.map((val, idx) => {
            const x = (idx / (sizePoints.length - 1)) * (width - 10) + 5;
            const y = height - 5 - ((val - minSize) / (maxSize - minSize || 1)) * (height - 10);
            const isHovered = hoverIdx === idx;
            return (
              <circle
                key={`size-pt-${idx}`}
                cx={x}
                cy={y}
                r={isHovered ? 4.5 : 2.5}
                className={`stroke-white stroke-2 cursor-pointer transition-all ${isHovered ? 'fill-indigo-600' : isBloated ? 'fill-rose-600' : 'fill-cyan-600'}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <title>{timeLabels[idx]}: {val} MB</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono px-0.5 pt-0.5">
        <span>24h ago</span>
        <strong className="text-zinc-900 font-bold">{sizePoints[sizePoints.length - 1]} MB</strong>
        <span>Now</span>
      </div>
    </div>
  );
};

export const DatabaseSchemaExplorerView: React.FC<DatabaseSchemaExplorerViewProps> = ({
  flags,
  onToggleFlag,
  onClose,
  lowUsageThresholds
}) => {
  // Low Usage Policy Configuration State
  const [lowUsageConfig, setLowUsageConfig] = useState<LowUsageThresholdsConfig>(() => {
    if (lowUsageThresholds) return lowUsageThresholds;
    try {
      const saved = localStorage.getItem('enterprise_low_usage_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_LOW_USAGE_THRESHOLDS;
    } catch {
      return DEFAULT_LOW_USAGE_THRESHOLDS;
    }
  });

  useEffect(() => {
    if (lowUsageThresholds) {
      setLowUsageConfig(lowUsageThresholds);
    }
  }, [lowUsageThresholds]);

  useEffect(() => {
    const handleThresholdsUpdate = (e: any) => {
      if (e.detail) {
        setLowUsageConfig(e.detail);
      }
    };
    window.addEventListener('low-usage-thresholds-updated', handleThresholdsUpdate);
    return () => {
      window.removeEventListener('low-usage-thresholds-updated', handleThresholdsUpdate);
    };
  }, []);

  const [selectedTable, setSelectedTable] = useState<string>('transactions');
  const [createdCustomIndexes, setCreatedCustomIndexes] = useState<string[]>([]);
  const [createdCompositeIndexes, setCreatedCompositeIndexes] = useState<string[]>([]);
  const [consolidatedIndexes, setConsolidatedIndexes] = useState<string[]>([]);
  const [lockedIndexes, setLockedIndexes] = useState<string[]>([]);
  const [isAnalyzingWorkload, setIsAnalyzingWorkload] = useState<boolean>(false);
  const [hasAnalyzedWorkload, setHasAnalyzedWorkload] = useState<boolean>(true);
  const [showQueryComplexityInfo, setShowQueryComplexityInfo] = useState<boolean>(false);
  const [compareWithBaseline, setCompareWithBaseline] = useState<boolean>(false);
  const [showSuggestIndexesModal, setShowSuggestIndexesModal] = useState<boolean>(false);
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(false);
  const [showQueryImpact, setShowQueryImpact] = useState<boolean>(true);
  const [quickIndexChecked, setQuickIndexChecked] = useState<boolean>(false);
  const [hoveredIndexWhatIf, setHoveredIndexWhatIf] = useState<string | null>(null);
  const [showClusterAnalysisModal, setShowClusterAnalysisModal] = useState<boolean>(false);
  const [showIndexCleanupModal, setShowIndexCleanupModal] = useState<boolean>(false);
  const [showAutoCleanupPreviewModal, setShowAutoCleanupPreviewModal] = useState<boolean>(false);
  const [isScanningCleanup, setIsScanningCleanup] = useState<boolean>(false);
  const [cleanupScanCompleted, setCleanupScanCompleted] = useState<boolean>(false);
  const [removedIndexes, setRemovedIndexes] = useState<string[]>([]);
  const [reindexedIndexes, setReindexedIndexes] = useState<string[]>([]);
  const [simulatedFailedIndexes, setSimulatedFailedIndexes] = useState<string[]>([]);
  const [rebuildingIndexes, setRebuildingIndexes] = useState<string[]>([]);
  const [hoveredImpactReasoningIndex, setHoveredImpactReasoningIndex] = useState<string | null>(null);
  const [isBulkOptimizationModeActive, setIsBulkOptimizationModeActive] = useState<boolean>(false);
  const [isExecutingBulkOptimize, setIsExecutingBulkOptimize] = useState<boolean>(false);
  const [dependencyZoomLevel, setDependencyZoomLevel] = useState<number>(1);
  const [dependencyPanOffset, setDependencyPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningDependency, setIsPanningDependency] = useState<boolean>(false);
  const [panStartPos, setPanStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'explorer' | 'dependency-chain' | 'index-dependency' | 'index-health-monitor' | 'index-storage-heatmap' | 'index-heatmap'>('explorer');
  const [showImpactPredictionModal, setShowImpactPredictionModal] = useState<boolean>(false);
  const [selectedPredictionIndex, setSelectedPredictionIndex] = useState<any | null>(null);
  const [simulatedIndexModifications, setSimulatedIndexModifications] = useState<Record<string, 'active' | 'modified' | 'removed'>>({});
  const [showWorkloadOptimizationModal, setShowWorkloadOptimizationModal] = useState<boolean>(false);
  const [isAutoOptimizingWorkload, setIsAutoOptimizingWorkload] = useState<boolean>(false);
  const [autoOptimizedCompleted, setAutoOptimizedCompleted] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [indexSearchQuery, setIndexSearchQuery] = useState<string>('');
  const [indexCategoryFilter, setIndexCategoryFilter] = useState<string>('all');
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);
  const [isExportingState, setIsExportingState] = useState<boolean>(false);
  const [isExportingImpactReport, setIsExportingImpactReport] = useState<boolean>(false);
  const [showLifecycleLogModal, setShowLifecycleLogModal] = useState<boolean>(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string>('idx_transactions_email_status');
  const [suggestionFilterTab, setSuggestionFilterTab] = useState<'all' | 'filter' | 'join' | 'composite'>('all');
  const [showBulkOptimizeModal, setShowBulkOptimizeModal] = useState<boolean>(false);
  const [showCrossReferenceReportModal, setShowCrossReferenceReportModal] = useState<boolean>(false);
  const [bulkDryRunActive, setBulkDryRunActive] = useState<boolean>(false);
  const [dryRunPreviewList, setDryRunPreviewList] = useState<Array<{ name: string; impact: string; projectedHealth: number }> | null>(null);
  const [bulkOptimizeSuccessNotice, setBulkOptimizeSuccessNotice] = useState<string | null>(null);
  const [coveringConflictToast, setCoveringConflictToast] = useState<{ message: string; conflictingIndex: string } | null>(null);
  const [isApplyingBulkOptimize, setIsApplyingBulkOptimize] = useState<boolean>(false);
  const [animatingBulkIndexName, setAnimatingBulkIndexName] = useState<string | null>(null);
  const [showAiSuggestionsSidePanel, setShowAiSuggestionsSidePanel] = useState<boolean>(true);
  const [sidePanelViewMode, setSidePanelViewMode] = useState<'suggestions' | 'complexity-heatmap' | 'lifecycle-analytics' | 'index-usage' | 'correlation' | 'history'>('complexity-heatmap');
  const [disabledImpactEdges, setDisabledImpactEdges] = useState<Record<string, boolean>>({});
  const [selectedCompositeSuggestionId, setSelectedCompositeSuggestionId] = useState<string>('idx_transactions_email_status');
  const [compositePatternFilter, setCompositePatternFilter] = useState<'all' | 'transactions' | 'line_items' | 'customers'>('all');
  const [aiSuggestionSortBy, setAiSuggestionSortBy] = useState<'gain' | 'risk' | 'complexity'>('gain');
  const [copiedDdlIndex, setCopiedDdlIndex] = useState<string | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [showIndexDiffViewerModal, setShowIndexDiffViewerModal] = useState<boolean>(false);
  const [hoveredDiffProp, setHoveredDiffProp] = useState<string | null>(null);
  const [showBulkOptimizePopover, setShowBulkOptimizePopover] = useState<boolean>(false);
  const [showIntelligentAdvisorModal, setShowIntelligentAdvisorModal] = useState<boolean>(false);
  const [showIndexRecommendationEngineModal, setShowIndexRecommendationEngineModal] = useState<boolean>(false);
  const [appliedEngineIndexIds, setAppliedEngineIndexIds] = useState<string[]>([]);
  const [patchedCoveringIndexIds, setPatchedCoveringIndexIds] = useState<string[]>([]);

  const fullTableScanRecommendations = useMemo(() => [
    {
      id: 'rec_transactions_full_scan',
      name: 'idx_transactions_scan_covering',
      tableName: 'transactions',
      createStatement: 'CREATE INDEX CONCURRENTLY idx_transactions_scan_covering ON transactions (customer_id, status) INCLUDE (amount, created_at);',
      queryScenario: 'SELECT * FROM transactions WHERE customer_id = $1 AND status = $2 ORDER BY created_at DESC;',
      scanCost: 48.50,
      optimizedCost: 2.15,
      frequencyPerMin: '420 queries/min',
      rowsScanned: '50,000 full rows',
      speedup: '95.6%'
    },
    {
      id: 'rec_order_items_scan',
      name: 'idx_order_items_product_covering',
      tableName: 'order_items',
      createStatement: 'CREATE INDEX CONCURRENTLY idx_order_items_product_covering ON order_items (product_id) INCLUDE (quantity, unit_price);',
      queryScenario: 'SELECT sum(quantity) FROM order_items WHERE product_id = $1 GROUP BY product_id;',
      scanCost: 34.20,
      optimizedCost: 1.80,
      frequencyPerMin: '280 queries/min',
      rowsScanned: '125,000 table rows',
      speedup: '94.7%'
    },
    {
      id: 'rec_customers_tier_scan',
      name: 'idx_customers_tier_covering',
      tableName: 'customers',
      createStatement: 'CREATE INDEX CONCURRENTLY idx_customers_tier_covering ON customers (tier) INCLUDE (signup_date, email);',
      queryScenario: 'SELECT email FROM customers WHERE tier = \'enterprise\' AND signup_date > NOW() - INTERVAL \'30 days\';',
      scanCost: 28.90,
      optimizedCost: 1.45,
      frequencyPerMin: '190 queries/min',
      rowsScanned: '10,000 table rows',
      speedup: '95.0%'
    },
    {
      id: 'rec_audit_logs_scan',
      name: 'idx_audit_logs_timestamp_covering',
      tableName: 'audit_logs',
      createStatement: 'CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp_covering ON audit_logs (timestamp) INCLUDE (severity, message);',
      queryScenario: 'SELECT * FROM audit_logs WHERE timestamp >= NOW() - INTERVAL \'1 hour\' AND severity = \'ERROR\';',
      scanCost: 62.10,
      optimizedCost: 3.10,
      frequencyPerMin: '510 queries/min',
      rowsScanned: '250,000 log entries',
      speedup: '95.0%'
    }
  ], []);

  const handleApplyCoveringPatch = (patch: CoveringIndexPatch) => {
    setPatchedCoveringIndexIds((prev) => Array.from(new Set([...prev, patch.id])));
    if (!flags.btreeIndexing) {
      onToggleFlag('btreeIndexing');
    }
    if (patch.id.includes('order-items') && !flags.batchEagerLoading) {
      onToggleFlag('batchEagerLoading');
    }
    setCreatedCompositeIndexes((prev) => Array.from(new Set([...prev, patch.indexName])));
  };

  const handleApplyAllCoveringPatches = (patches: CoveringIndexPatch[]) => {
    const allIds = COVERING_INDEX_CATALOG.map((p) => p.id);
    setPatchedCoveringIndexIds(allIds);
    if (!flags.btreeIndexing) {
      onToggleFlag('btreeIndexing');
    }
    if (!flags.batchEagerLoading) {
      onToggleFlag('batchEagerLoading');
    }
    const newComposite = COVERING_INDEX_CATALOG.map((p) => p.indexName);
    setCreatedCompositeIndexes((prev) => Array.from(new Set([...prev, ...newComposite])));
  };
  const [indexListLayout, setIndexListLayout] = useState<'table' | 'cards' | 'map'>('table');
  const [showIndexImpactMap, setShowIndexImpactMap] = useState<boolean>(false);
  const [isGroupByTable, setIsGroupByTable] = useState<boolean>(false);
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});
  const [isWhatIfAnalysisActive, setIsWhatIfAnalysisActive] = useState<boolean>(false);
  const [isLockContentionHeatmapActive, setIsLockContentionHeatmapActive] = useState<boolean>(false);
  const [batchProtectionEnabled, setBatchProtectionEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('enterprise_batch_index_protection_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [globalHousekeeperEnabled, setGlobalHousekeeperEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('enterprise_global_housekeeper_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [housekeeperFrequency, setHousekeeperFrequency] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('enterprise_global_housekeeper_frequency');
      return saved || 'weekly';
    } catch {
      return 'weekly';
    }
  });

  const [showHousekeeperModal, setShowHousekeeperModal] = useState<boolean>(false);
  const [isScanningHousekeeper, setIsScanningHousekeeper] = useState<boolean>(false);

  const handleToggleGlobalHousekeeper = (enabled: boolean) => {
    setGlobalHousekeeperEnabled(enabled);
    try {
      localStorage.setItem('enterprise_global_housekeeper_enabled', JSON.stringify(enabled));
    } catch (e) {
      console.error(e);
    }
  };

  const handleHousekeeperFrequencyChange = (freq: string) => {
    setHousekeeperFrequency(freq);
    try {
      localStorage.setItem('enterprise_global_housekeeper_frequency', freq);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunHousekeeperScan = () => {
    setIsScanningHousekeeper(true);
    setTimeout(() => {
      setIsScanningHousekeeper(false);
      setShowHousekeeperModal(true);
    }, 800);
  };

  const handleExecuteHousekeeperRemoval = (indexNames: string[]) => {
    setRemovedIndexes((prev) => Array.from(new Set([...prev, ...indexNames])));
    setShowHousekeeperModal(false);
    setImportSuccessNotice(`[Global Housekeeper] Safely removed ${indexNames.length} unprotected low-usage indexes. Reclaimed disk space.`);
    setTimeout(() => setImportSuccessNotice(null), 4000);
  };

  const handleToggleBatchProtection = (enabled: boolean) => {
    setBatchProtectionEnabled(enabled);
    try {
      localStorage.setItem('enterprise_batch_index_protection_enabled', JSON.stringify(enabled));
    } catch (e) {
      console.error(e);
    }
  };
  const [whatIfModifications, setWhatIfModifications] = useState<Record<string, string[]>>({});
  const [activeWhatIfModalIndex, setActiveWhatIfModalIndex] = useState<{ name: string; tableName: string; columns: string[] } | null>(null);
  const [activeImpactPredictionIndex, setActiveImpactPredictionIndex] = useState<{ name: string; tableName: string; columns: string[] } | null>(null);
  const [whatIfInputText, setWhatIfInputText] = useState<string>('');
  const [showConflictDashboardModal, setShowConflictDashboardModal] = useState<boolean>(false);
  const [showReconcileIndexesModal, setShowReconcileIndexesModal] = useState<boolean>(false);
  const [resolvedConflicts, setResolvedConflicts] = useState<Record<string, boolean>>({});
  const [resolvedConstraintConflicts, setResolvedConstraintConflicts] = useState<Record<string, boolean>>({});
  const [showSchemaDiffLiveModal, setShowSchemaDiffLiveModal] = useState<boolean>(false);
  const [schemaDiffTargetSnapshotId, setSchemaDiffTargetSnapshotId] = useState<string>('');

  const handleMergeConflictGroup = (groupId: string, indexNamesToPrune: string[]) => {
    setResolvedConflicts((prev) => ({ ...prev, [groupId]: true }));
    setRemovedIndexes((prev) => Array.from(new Set([...prev, ...indexNamesToPrune])));
  };
  const [isResequencingWrites, setIsResequencingWrites] = useState<boolean>(false);
  const [clusterContentionResolved, setClusterContentionResolved] = useState<boolean>(false);

  const handleResequenceWrites = () => {
    setIsResequencingWrites(true);
    setTimeout(() => {
      setIsResequencingWrites(false);
      setClusterContentionResolved(true);
    }, 1200);
  };
  const [selectedIndexes, setSelectedIndexes] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState<boolean>(false);
  const [indexRankSort, setIndexRankSort] = useState<
    | 'impact_desc'
    | 'impact_asc'
    | 'latency_desc'
    | 'latency_asc'
    | 'query_desc'
    | 'write_asc'
    | 'health_desc'
    | 'name'
    | 'ratio_desc'
    | 'ratio_asc'
    | 'usage'
    | 'size'
    | 'fragmentation'
    | 'write_intensity'
  >('impact_desc');
  const [showIndexImpactHeatmap, setShowIndexImpactHeatmap] = useState<boolean>(true);
  const [showUsageHeatmap, setShowUsageHeatmap] = useState<boolean>(true);
  const [importSuccessNotice, setImportSuccessNotice] = useState<string | null>(null);
  const [importedCustomIndices, setImportedCustomIndices] = useState<Array<{
    name: string;
    type: string;
    columns: string[];
    targetTable: string;
    targetEntity?: string;
    active: boolean;
  }>>([]);
  const [activeSchemaPrototypeName, setActiveSchemaPrototypeName] = useState<string>('Standard Workload Schema');
  const [bulkImportActiveTab, setBulkImportActiveTab] = useState<'upload' | 'presets' | 'schema-spec'>('upload');
  const [importJsonInput, setImportJsonInput] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importSnapshotBeforeApply, setImportSnapshotBeforeApply] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [enableAutoHealing, setEnableAutoHealing] = useState<boolean>(false);

  // Global keyboard shortcuts for power users (Ctrl+S to save snapshot, Ctrl+Shift+O to run bulk optimization)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleOpenSnapshotModal();
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleAutoOptimizeWorkload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Automatically expand the selected table category when selectedTable changes
    setCollapsedCategories((prev) => ({
      ...prev,
      [selectedTable]: false
    }));
  }, [selectedTable]);

  const expensiveQueriesWorkload = [
    {
      id: 'Q1',
      name: 'Multi-Column Category & Amount Range Aggregation',
      sql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category',
      frequency: '8,900 queries/hr',
      executionShare: '38.4% of DB read CPU time',
      unindexedLatency: '482 ms',
      optimizedLatency: '1.9 ms',
      speedup: '99.6%',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      optimalIndexName: 'idx_transactions_category_amount',
      optimalIndexType: 'Composite B-Tree (category, amount)',
      isToggled: createdCompositeIndexes.includes('category_amount'),
      impactExplanation: 'Replaces full table scan with an O(log n) composite index range seek, eliminating in-memory sorting and secondary lookups.'
    },
    {
      id: 'Q2',
      name: 'Customer Order Verification & Status Lookup',
      sql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20',
      frequency: '5,120 queries/hr',
      executionShare: '29.1% of DB read CPU time',
      unindexedLatency: '395 ms',
      optimizedLatency: '1.6 ms',
      speedup: '99.6%',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      optimalIndexName: 'idx_transactions_email_status',
      optimalIndexType: 'Composite B-Tree (customer_email, status)',
      isToggled: createdCompositeIndexes.includes('email_status'),
      impactExplanation: 'Co-locates customer email and order status in composite leaf nodes, preventing duplicate table lookups.'
    },
    {
      id: 'Q3',
      name: 'Active Order Dashboard & Pipeline Status Filtering',
      sql: 'SELECT * FROM transactions WHERE status = ? AND category = ?',
      frequency: '12,400 queries/hr',
      executionShare: '18.7% of DB read CPU time',
      unindexedLatency: '310 ms',
      optimizedLatency: '1.4 ms',
      speedup: '99.5%',
      throughputBefore: '32 QPS',
      throughputAfter: '7,140 QPS',
      optimalIndexName: 'idx_orders_status_cat',
      optimalIndexType: 'Composite B-Tree (status, category)',
      isToggled: flags.btreeIndexing,
      impactExplanation: 'Provides multi-column b-tree seek for high-frequency dashboard polling queries.'
    },
    {
      id: 'Q4',
      name: 'Relational Order Line-Items Child Join Storm',
      sql: 'SELECT * FROM line_items WHERE transaction_id IN (...)',
      frequency: '15,000 queries/hr',
      executionShare: '13.8% of DB read CPU time',
      unindexedLatency: '840 ms',
      optimizedLatency: '3.2 ms',
      speedup: '99.6%',
      throughputBefore: '12 QPS',
      throughputAfter: '3,125 QPS',
      optimalIndexName: 'idx_line_items_tx',
      optimalIndexType: 'Foreign Key B-Tree (transaction_id)',
      isToggled: flags.batchEagerLoading,
      impactExplanation: 'Collapses sequential N+1 relational sub-queries into a single index-accelerated batched hash join.'
    }
  ];

  const indexSuggestions = useMemo(() => [
    {
      id: 'idx_transactions_email_status',
      name: 'idx_transactions_email_status',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email', 'status'],
      type: 'Composite B-Tree',
      patternType: 'Compound Filter & Sort Clause',
      patternCategory: 'composite' as const,
      speedup: '99.8%',
      speedupFactor: '246x Faster',
      latencyBefore: '395 ms',
      latencyAfter: '1.6 ms',
      frequency: '5,120 queries/hr',
      executionShare: '29.1% of DB read CPU time',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      storageOverhead: '+4.2 MB (+8.7% footprint)',
      writeImpact: '+0.9ms on batch insert/update',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20;',
      targetQueryName: 'Customer Order Verification & Status Lookup',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Compound Equality)',
          code: 'WHERE customer_email = ? AND status = ?',
          explanation: 'Requires filtering both customer identity and order status simultaneously. With single-column indexes, the database planner must retrieve table heap pages to check the status field for every row matching email.'
        },
        {
          clauseType: 'Sort Clause (Indexed Ordering)',
          code: 'ORDER BY created_at DESC LIMIT 20',
          explanation: 'Forces an in-memory or temporary disk Sort buffer unless index leaf keys are already clustered or compound-seekable, leading to high latency spikes.'
        }
      ],
      whyExplanation: 'Single-column indexes on customer_email force the engine to inspect heap table pages for each candidate to evaluate status, incurring secondary table lookups and cache churn. The composite index co-locates both attributes directly in adjacent B-Tree leaf pages, enabling index-only candidate filtering and skipping 99.4% of table I/O reads.',
      plannerMechanics: 'The PostgreSQL / Cloud SQL query planner replaces an expensive Bitmap Heap Scan and in-memory filter recheck with a direct Index Scan seeking straight to the matching leaf nodes.',
      planBefore: "Seq Scan on transactions (cost=0.00..1845.00 rows=12 width=142)\n  Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      planAfter: "Index Scan using idx_transactions_email_status on transactions (cost=0.42..8.45 rows=12 width=142)\n  Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      isApplied: createdCompositeIndexes.includes('email_status'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('email_status')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'email_status'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'email_status']);
        }
      }
    },
    {
      id: 'idx_line_items_tx',
      name: 'idx_line_items_tx',
      targetTable: 'line_items',
      targetEntity: 'Order Items Entity',
      targetColumns: ['transaction_id'],
      type: 'Foreign Key B-Tree',
      patternType: 'Table Join Clause (N+1 Elimination)',
      patternCategory: 'join' as const,
      speedup: '99.6%',
      speedupFactor: '233x Faster',
      latencyBefore: '420 ms',
      latencyAfter: '1.8 ms',
      frequency: '15,000 queries/hr',
      executionShare: '24.5% of DB read CPU time',
      throughputBefore: '18 QPS',
      throughputAfter: '4,545 QPS',
      storageOverhead: '+3.1 MB (+6.4% footprint)',
      writeImpact: '+0.4ms on item insert',
      querySql: 'SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);',
      targetQueryName: 'Relational Order Items Detail Expansion',
      triggeringClauses: [
        {
          clauseType: 'Table Join Clause (Foreign Key Equality)',
          code: 'INNER JOIN transactions t ON line_items.transaction_id = transactions.id',
          explanation: 'Relational child join connecting line items to parent transactions. Without an index on foreign key transaction_id, each join lookup requires a full sequential scan of the 200,000-row child table.'
        },
        {
          clauseType: 'Filter Clause (Batched Transaction Lookup)',
          code: 'WHERE transactions.id IN (?)',
          explanation: 'When loading an order dashboard displaying multiple transactions, expanding line items triggers separate sequential scans per order (N+1 query storm).'
        }
      ],
      whyExplanation: 'Foreign key columns in relational databases do not automatically receive secondary indexes. Joining transactions with line_items forces the query planner into a Nested Loop with sequential scans on line_items (O(N*M) complexity). Adding idx_line_items_tx allows O(1) batched hash joins and logarithmic seeks, completely eliminating N+1 query storms.',
      plannerMechanics: 'The query optimizer converts a Nested Loop (Sequential Scan) into a Hash Join backed by a B-Tree Index Scan, reducing child table page reads from 2,400 pages to 4 pages.',
      planBefore: "Nested Loop (cost=0.00..4120.00 rows=350 width=88)\n  -> Seq Scan on transactions\n  -> Seq Scan on line_items Filter: (transaction_id = t.id)",
      planAfter: "Hash Join (cost=8.45..42.10 rows=350 width=88) Hash Cond: (li.transaction_id = t.id)\n  -> Index Scan using idx_line_items_tx on line_items li",
      isApplied: flags.batchEagerLoading,
      onToggle: () => onToggleFlag('batchEagerLoading')
    },
    {
      id: 'idx_transactions_category_amount',
      name: 'idx_transactions_category_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['category', 'amount'],
      type: 'Composite B-Tree',
      patternType: 'Filter + Range Aggregation Clause',
      patternCategory: 'composite' as const,
      speedup: '99.2%',
      speedupFactor: '253x Faster',
      latencyBefore: '482 ms',
      latencyAfter: '1.9 ms',
      frequency: '8,900 queries/hr',
      executionShare: '38.4% of DB read CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      storageOverhead: '+6.8 MB (+14.1% footprint)',
      writeImpact: '+1.1ms on batch write',
      querySql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category;',
      targetQueryName: 'Multi-Column Category & Amount Range Aggregation',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Equality on Partition Category)',
          code: 'WHERE category = ?',
          explanation: 'Categorical equality filter selecting the target merchandise department or product class.'
        },
        {
          clauseType: 'Range Filter Clause (Numeric Threshold)',
          code: 'AND amount > ?',
          explanation: 'Numeric inequality predicate requiring boundary seeks across large transaction volumes.'
        },
        {
          clauseType: 'Grouping Clause (In-Memory Aggregation)',
          code: 'GROUP BY category',
          explanation: 'Forces HashAggregate or Sort buffers if candidate keys are not already contiguous in leaf pages.'
        }
      ],
      whyExplanation: 'Filtering by equality on category AND a range condition on amount with single-column indexing leaves thousands of unneeded rows to be scanned and sorted in RAM. The composite index puts category first (equality), then amount (range), allowing the engine to seek directly to the category branch and scan only matching amount leaves with zero sorting overhead.',
      plannerMechanics: 'Replaces HashAggregate and temporary disk spillover with a stream-lined GroupAggregate read directly from ordered composite leaf pages.',
      planBefore: "HashAggregate (cost=1950.00..1960.00 rows=8 width=44)\n  -> Seq Scan on transactions Filter: ((category = 'Electronics'::text) AND (amount > 100.00))",
      planAfter: "GroupAggregate (cost=0.42..18.20 rows=8 width=44)\n  -> Index Scan using idx_transactions_category_amount on transactions Index Cond: ((category = 'Electronics'::text) AND (amount > 100.00))",
      isApplied: createdCompositeIndexes.includes('category_amount'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('category_amount')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'category_amount'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'category_amount']);
        }
      }
    },
    {
      id: 'idx_transactions_customer_email',
      name: 'idx_transactions_customer_email',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email'],
      type: 'Single-Column B-Tree',
      patternType: 'Filter Clause (Equality & Search)',
      patternCategory: 'filter' as const,
      speedup: '99.7%',
      speedupFactor: '241x Faster',
      latencyBefore: '72.4 ms',
      latencyAfter: '0.3 ms',
      frequency: '14,250 queries/hr',
      executionShare: '19.3% of DB read CPU time',
      throughputBefore: '14 QPS',
      throughputAfter: '3,330 QPS',
      storageOverhead: '+3.4 MB (+7.0% footprint)',
      writeImpact: '+0.5ms on user signup/order',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ?;',
      targetQueryName: 'Customer Account Profile & History Lookup',
      triggeringClauses: [
        {
          clauseType: 'Filter Clause (Equality Predicate)',
          code: 'WHERE customer_email = ?',
          explanation: 'Point lookup clause matching unique customer email addresses across 50,000+ orders.'
        }
      ],
      whyExplanation: 'Without an index on customer_email, every customer login, receipt lookup, or profile load forces a full table scan across 50,000 records. An equality B-Tree index provides logarithmic O(log n) pointer traversal down root, branch, and leaf nodes, resolving in 0.3ms.',
      plannerMechanics: 'The query planner converts a full Seq Scan reading every page on disk into an Index Scan that retrieves only the matching record pointers.',
      planBefore: "Seq Scan on transactions (cost=0.00..1480.00 rows=3 width=128)\n  Filter: (customer_email = 'customer@domain.com'::text)",
      planAfter: "Index Scan using idx_transactions_customer_email on transactions (cost=0.42..8.44 rows=3 width=128)\n  Index Cond: (customer_email = 'customer@domain.com'::text)",
      isApplied: createdCustomIndexes.includes('customer_email'),
      onToggle: () => {
        if (createdCustomIndexes.includes('customer_email')) {
          setCreatedCustomIndexes(createdCustomIndexes.filter(c => c !== 'customer_email'));
        } else {
          setCreatedCustomIndexes([...createdCustomIndexes, 'customer_email']);
        }
      }
    },
    {
      id: 'idx_transactions_amount',
      name: 'idx_transactions_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['amount'],
      type: 'Single-Column B-Tree',
      patternType: 'Range Filter Clause',
      patternCategory: 'filter' as const,
      speedup: '95.4%',
      speedupFactor: '85x Faster',
      latencyBefore: '68.2 ms',
      latencyAfter: '0.8 ms',
      frequency: '6,400 queries/hr',
      executionShare: '12.8% of DB read CPU time',
      throughputBefore: '15 QPS',
      throughputAfter: '1,250 QPS',
      storageOverhead: '+2.8 MB (+5.8% footprint)',
      writeImpact: '+0.4ms on order insert',
      querySql: 'SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC;',
      targetQueryName: 'High-Value Order Threshold Inspection',
      triggeringClauses: [
        {
          clauseType: 'Range Filter Clause (Numeric Inequality)',
          code: 'WHERE amount > 500.00',
          explanation: 'Filters transactions exceeding fraud detection and risk review thresholds.'
        },
        {
          clauseType: 'Sort Clause (Descending Ordering)',
          code: 'ORDER BY amount DESC',
          explanation: 'Orders high-value results from largest to smallest.'
        }
      ],
      whyExplanation: 'Range filter clauses on numeric amounts require scanning all table rows unless an ordered B-Tree index provides a fast lower-bound seek pointer. Once the leaf node matching 500.00 is located, the engine traverses linked leaf pages in descending order without sorting.',
      plannerMechanics: 'Leverages natural bidirectional B-Tree leaf node chains with Index Scan Backward, bypassing in-memory sorting.',
      planBefore: "Sort (cost=1490.00..1495.00 rows=200 width=128) Sort Key: amount DESC\n  -> Seq Scan on transactions Filter: (amount > 500.00)",
      planAfter: "Index Scan Backward using idx_transactions_amount on transactions (cost=0.42..35.10 rows=200 width=128)\n  Index Cond: (amount > 500.00)",
      isApplied: createdCustomIndexes.includes('amount'),
      onToggle: () => {
        if (createdCustomIndexes.includes('amount')) {
          setCreatedCustomIndexes(createdCustomIndexes.filter(c => c !== 'amount'));
        } else {
          setCreatedCustomIndexes([...createdCustomIndexes, 'amount']);
        }
      }
    },
    {
      id: 'idx_orders_status_cat',
      name: 'idx_orders_status_cat',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['status', 'category'],
      type: 'Composite B-Tree',
      patternType: 'Compound Filter & Sort Clause',
      patternCategory: 'composite' as const,
      speedup: '99.5%',
      speedupFactor: '221x Faster',
      latencyBefore: '310 ms',
      latencyAfter: '1.4 ms',
      frequency: '12,400 queries/hr',
      executionShare: '18.7% of DB read CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,000 QPS',
      storageOverhead: '+4.0 MB (+8.3% footprint)',
      writeImpact: '+0.7ms on status change',
      querySql: 'SELECT * FROM transactions WHERE status = ? AND category = ?;',
      targetQueryName: 'Active Order Dashboard & Pipeline Status Filtering',
      triggeringClauses: [
        {
          clauseType: 'Compound Filter Clause (Categorical Equality)',
          code: 'WHERE status = ? AND category = ?',
          explanation: 'Operational dashboard query run continuously by customer support and warehouse teams.'
        }
      ],
      whyExplanation: 'Because status has low selectivity (only 4 distinct values: pending, completed, cancelled, refunded), a single-column index on status alone still forces the engine to inspect tens of thousands of rows to check category. The composite index groups status + category together, reducing the search space from 50,000 rows to fewer than 50 rows in a single index seek.',
      plannerMechanics: 'Prevents low-selectivity index scan fallbacks where the query planner would otherwise revert to a full table sequential scan.',
      planBefore: "Seq Scan on transactions (cost=0.00..1520.00 rows=45 width=128)\n  Filter: ((status = 'pending'::text) AND (category = 'Electronics'::text))",
      planAfter: "Index Scan using idx_orders_status_cat on transactions (cost=0.42..12.30 rows=45 width=128)\n  Index Cond: ((status = 'pending'::text) AND (category = 'Electronics'::text))",
      isApplied: flags.btreeIndexing,
      onToggle: () => onToggleFlag('btreeIndexing')
    }
  ], [createdCustomIndexes, createdCompositeIndexes, flags, onToggleFlag]);

  // AI-Driven Composite Index Opportunities derived from analyzing user query pattern history
  const compositeIndexOpportunities = useMemo(() => [
    {
      id: 'idx_transactions_email_status',
      name: 'idx_transactions_email_status',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['customer_email', 'status'],
      compositeKey: 'email_status',
      patternCategory: 'Equality + Filter',
      speedup: '99.8%',
      speedupMultiplier: '246x Faster',
      latencyBefore: '395 ms',
      latencyAfter: '1.6 ms',
      frequencyPerHour: '5,120 queries/hr',
      executionShare: '29.1% DB CPU time',
      throughputBefore: '25 QPS',
      throughputAfter: '6,250 QPS',
      storageFootprint: '+4.2 MB (+8.7%)',
      writeImpact: '+0.9ms on batch write',
      querySql: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ? ORDER BY created_at DESC LIMIT 20;',
      queryPurpose: 'Customer Account Order Verification & Status Inspection',
      columnOrdering: [
        {
          column: 'customer_email',
          role: 'Leading Equality Key (High Selectivity)',
          rationale: 'Email address has high cardinality (~45,000 distinct values). Placing it first segments the index into tiny branches, isolating matching candidate rows instantly.'
        },
        {
          column: 'status',
          role: 'Trailing Filter Key (State Qualification)',
          rationale: 'Status has low selectivity (4 states: pending, completed, cancelled, refunded). Co-locating it second allows discarding non-matching orders right at the B-Tree leaf level without touching table heap pages.'
        }
      ],
      rationale: {
        summary: 'Single-column indexes on customer_email force the query engine to fetch underlying table heap pages for each row just to check the status field, triggering heavy disk buffer cache churn. The composite index co-locates customer_email and status directly in adjacent B-Tree leaf blocks, eliminating 99.4% of table I/O reads.',
        heapScanProblem: 'With single-column indexing, 1,200+ heap pages are traversed per query. With composite indexing, 0 heap pages are visited for non-matching records.',
        columnOrderJustification: 'Standard B-Tree rule: Equality predicates with high selectivity must lead before low-selectivity filter keys to maximize index branch traversal speed.',
        plannerMechanics: 'Transforms Bitmap Heap Scan + Filter Recheck into a direct logarithmic Index Scan seeking straight to matching leaf tuples.'
      },
      planBefore: "Seq Scan on transactions (cost=0.00..1845.00 rows=12 width=142)\n  Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      planAfter: "Index Scan using idx_transactions_email_status on transactions (cost=0.42..8.45 rows=12 width=142)\n  Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))",
      ddlStatement: 'CREATE INDEX idx_transactions_email_status ON transactions (customer_email, status);',
      isApplied: createdCompositeIndexes.includes('email_status'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('email_status')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'email_status'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'email_status']);
        }
      }
    },
    {
      id: 'idx_transactions_category_amount',
      name: 'idx_transactions_category_amount',
      targetTable: 'transactions',
      targetEntity: 'Transactions Entity',
      targetColumns: ['category', 'amount'],
      compositeKey: 'category_amount',
      patternCategory: 'Equality + Range Aggregation',
      speedup: '99.6%',
      speedupMultiplier: '253x Faster',
      latencyBefore: '482 ms',
      latencyAfter: '1.9 ms',
      frequencyPerHour: '8,900 queries/hr',
      executionShare: '38.4% DB CPU time',
      throughputBefore: '21 QPS',
      throughputAfter: '5,260 QPS',
      storageFootprint: '+6.8 MB (+14.1%)',
      writeImpact: '+1.1ms on batch write',
      querySql: 'SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = ? AND amount > ? GROUP BY category;',
      queryPurpose: 'Departmental Category Revenue & Range Aggregation',
      columnOrdering: [
        {
          column: 'category',
          role: 'Leading Equality Key (Merchandise Category)',
          rationale: 'Category acts as the partition filter. Placing category first allows the B-Tree root search to descend directly to the leaf page section for that specific category.'
        },
        {
          column: 'amount',
          role: 'Trailing Range Key (Numeric Threshold)',
          rationale: 'Amount is evaluated as a range condition (> threshold). Placing amount second bounds the leaf page scan to only rows satisfying the threshold, eliminating temporary RAM sort buffers.'
        }
      ],
      rationale: {
        summary: 'Filtering by equality on category AND a range condition on amount without composite indexing forces PostgreSQL to either scan the whole table or load thousands of category rows into RAM to evaluate amount. This composite index groups category and amount in sorted order, turning an expensive table scan into a logarithmic seek.',
        heapScanProblem: 'Queries spend 38.4% of all DB read CPU time spilling HashAggregate batches to temporary disk buffers due to unindexed category-amount ranges.',
        columnOrderJustification: 'Critical B-Tree rule: Equality columns MUST precede Range columns. If amount were placed first, the engine could not use category for direct seeks after the range predicate.',
        plannerMechanics: 'Replaces HashAggregate and sequential disk spill with a stream GroupAggregate read directly from pre-sorted composite leaf blocks.'
      },
      planBefore: "HashAggregate (cost=1950.00..1960.00 rows=8 width=44)\n  -> Seq Scan on transactions Filter: ((category = 'Electronics'::text) AND (amount > 100.00))",
      planAfter: "GroupAggregate (cost=0.42..18.20 rows=8 width=44)\n  -> Index Scan using idx_transactions_category_amount on transactions Index Cond: ((category = 'Electronics'::text) AND (amount > 100.00))",
      ddlStatement: 'CREATE INDEX idx_transactions_category_amount ON transactions (category, amount);',
      isApplied: createdCompositeIndexes.includes('category_amount'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('category_amount')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'category_amount'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'category_amount']);
        }
      }
    },
    {
      id: 'idx_line_items_tx_price',
      name: 'idx_line_items_tx_price',
      targetTable: 'line_items',
      targetEntity: 'Order Items Entity',
      targetColumns: ['transaction_id', 'unit_price'],
      compositeKey: 'tx_price',
      patternCategory: 'Join + Price Filter',
      speedup: '99.5%',
      speedupMultiplier: '185x Faster',
      latencyBefore: '280 ms',
      latencyAfter: '1.5 ms',
      frequencyPerHour: '6,400 queries/hr',
      executionShare: '18.7% DB CPU time',
      throughputBefore: '35 QPS',
      throughputAfter: '6,470 QPS',
      storageFootprint: '+3.8 MB (+7.8%)',
      writeImpact: '+0.5ms on item add',
      querySql: 'SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = ? AND li.unit_price >= 50.00;',
      queryPurpose: 'High-Value Relational Child Item Expansion',
      columnOrdering: [
        {
          column: 'transaction_id',
          role: 'Foreign Key Anchor (Join Predicate)',
          rationale: 'Matches parent transactions.id. Leading position satisfies the relational join condition instantly.'
        },
        {
          column: 'unit_price',
          role: 'Secondary Numeric Filter (Covering Filter)',
          rationale: 'Filters high-value items directly within the index leaf, avoiding secondary heap page reads for cheaper items.'
        }
      ],
      rationale: {
        summary: 'Historical query traces show heavy traffic joining transactions with line_items while filtering for premium items (unit_price >= 50). A single foreign key index still requires fetching line_items rows from disk to check the price. This composite index allows an Index-Only Scan resolving the join and price filter with 0 table heap fetches.',
        heapScanProblem: 'Nested loop joins perform sequential table visits on line_items heap blocks for each order, causing 280ms latency spikes.',
        columnOrderJustification: 'transaction_id leads to bind the foreign key equality from the parent order, with unit_price following to filter lines in-index.',
        plannerMechanics: 'Upgrades Nested Loop with filter recheck into a direct Index Only Scan on line_items with zero table heap page fetches.'
      },
      planBefore: "Nested Loop (cost=0.00..2800.00 rows=40 width=88)\n  -> Seq Scan on line_items Filter: ((transaction_id = t.id) AND (unit_price >= 50.00))",
      planAfter: "Index Only Scan using idx_line_items_tx_price on line_items (cost=0.42..14.30 rows=40 width=88)\n  Index Cond: ((transaction_id = t.id) AND (unit_price >= 50.00))\n  Heap Fetches: 0",
      ddlStatement: 'CREATE INDEX idx_line_items_tx_price ON line_items (transaction_id, unit_price);',
      isApplied: createdCompositeIndexes.includes('tx_price'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('tx_price')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'tx_price'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'tx_price']);
        }
      }
    },
    {
      id: 'idx_customers_tier_created',
      name: 'idx_customers_tier_created',
      targetTable: 'customers',
      targetEntity: 'Customers Entity',
      targetColumns: ['tier', 'created_at'],
      compositeKey: 'tier_created',
      patternCategory: 'Equality + Order By',
      speedup: '99.3%',
      speedupMultiplier: '140x Faster',
      latencyBefore: '165 ms',
      latencyAfter: '1.2 ms',
      frequencyPerHour: '3,850 queries/hr',
      executionShare: '12.2% DB CPU time',
      throughputBefore: '42 QPS',
      throughputAfter: '5,880 QPS',
      storageFootprint: '+2.6 MB (+5.4%)',
      writeImpact: '+0.4ms on customer signup',
      querySql: 'SELECT id, name, email, tier FROM customers WHERE tier = ? ORDER BY created_at DESC LIMIT 50;',
      queryPurpose: 'Tiered Customer Cohort & Recent Signup Stream',
      columnOrdering: [
        {
          column: 'tier',
          role: 'Leading Equality Key (Membership Cohort)',
          rationale: 'Categorical filter matching target account level (e.g. enterprise, vip, standard).'
        },
        {
          column: 'created_at',
          role: 'Pre-Sorted Order Key (Zero-Sort Delivery)',
          rationale: 'Provides physical ordering by creation timestamp in the B-Tree leaf pages, satisfying ORDER BY created_at DESC with 0 memory sort buffers.'
        }
      ],
      rationale: {
        summary: 'Historical query logs show continuous dashboard polling for recent customer signups filtered by tier. Single-column indexing on tier locates matching records but forces PostgreSQL to sort all matching records in RAM before applying LIMIT 50. This composite index stores records already sorted by timestamp within each tier leaf chain, enabling instant early termination after 50 rows.',
        heapScanProblem: 'Explicit Sort nodes consume WorkMem and risk spilling to temporary disk files when customer tiers grow.',
        columnOrderJustification: 'tier leads to isolate the requested cohort. created_at follows in descending order to avoid filesort.',
        plannerMechanics: 'Replaces Bitmap Heap Scan + Sort node with an Index Scan Backward that halts execution as soon as 50 rows are produced.'
      },
      planBefore: "Limit (cost=160.00..165.00 rows=50 width=128)\n  -> Sort (cost=155.00..160.00) Sort Key: created_at DESC\n        -> Bitmap Heap Scan on customers Filter: (tier = 'enterprise'::text)",
      planAfter: "Limit (cost=0.42..12.50 rows=50 width=128)\n  -> Index Scan using idx_customers_tier_created on customers\n        Index Cond: (tier = 'enterprise'::text)\n        Buffers: shared hit=4",
      ddlStatement: 'CREATE INDEX idx_customers_tier_created ON customers (tier, created_at DESC);',
      isApplied: createdCompositeIndexes.includes('tier_created'),
      onToggle: () => {
        if (createdCompositeIndexes.includes('tier_created')) {
          setCreatedCompositeIndexes(createdCompositeIndexes.filter(c => c !== 'tier_created'));
        } else {
          setCreatedCompositeIndexes([...createdCompositeIndexes, 'tier_created']);
        }
      }
    }
  ], [createdCompositeIndexes]);

  const handleToggleLockIndex = (indexName: string) => {
    setLockedIndexes((prev) => {
      const isNowLocked = !prev.includes(indexName);
      const nextLocked = isNowLocked ? [...prev, indexName] : prev.filter((name) => name !== indexName);
      setImportSuccessNotice(
        isNowLocked
          ? `Locked index "${indexName}": High-priority manual lock enabled. Protected against Auto-Optimize and Index Cleanup.`
          : `Unlocked index "${indexName}": Can now be modified or pruned by automated operations.`
      );
      setTimeout(() => {
        setImportSuccessNotice(null);
      }, 4500);
      return nextLocked;
    });
  };

  const handleToggleSelectIndex = (indexName: string) => {
    setSelectedIndexes((prev) =>
      prev.includes(indexName) ? prev.filter((name) => name !== indexName) : [...prev, indexName]
    );
  };

  const handleSelectAllVisible = (visibleNames: string[]) => {
    const allSelected = visibleNames.length > 0 && visibleNames.every((name) => selectedIndexes.includes(name));
    if (allSelected) {
      setSelectedIndexes((prev) => prev.filter((name) => !visibleNames.includes(name)));
    } else {
      setSelectedIndexes((prev) => Array.from(new Set([...prev, ...visibleNames])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIndexes([]);
  };

  const handleBulkToggleProtected = () => {
    if (selectedIndexes.length === 0) return;
    const allProtected = selectedIndexes.every((name) => lockedIndexes.includes(name));
    if (allProtected) {
      // Mass Unprotect
      setLockedIndexes((prev) => prev.filter((name) => !selectedIndexes.includes(name)));
      setImportSuccessNotice(`Unlocked (unprotected) ${selectedIndexes.length} selected index(es). They can now be modified or pruned by Auto-Optimize.`);
    } else {
      // Mass Protect
      setLockedIndexes((prev) => Array.from(new Set([...prev, ...selectedIndexes])));
      setImportSuccessNotice(`Locked (protected) ${selectedIndexes.length} selected index(es). Protected against Auto-Optimize and Index Cleanup.`);
    }
    setTimeout(() => setImportSuccessNotice(null), 4500);

    const ev = new CustomEvent('optimization-lifecycle-event', {
      detail: {
        action: allProtected ? 'PRUNE' : 'RESTORE',
        actionLabel: allProtected ? 'Bulk Unlock (Unprotect) Indexes' : 'Bulk Lock (Protect) Indexes',
        triggerSource: 'Bulk Actions Bar',
        targetIndex: selectedIndexes.join(', '),
        targetTable: 'multiple',
        columns: [],
        rationale: allProtected
          ? `Mass-unprotected ${selectedIndexes.length} indexes via Floating Bulk Actions bar.`
          : `Mass-protected ${selectedIndexes.length} indexes with high-priority manual locks against automated cleanup.`,
        executedDdl: selectedIndexes.map((idx) => `-- ${allProtected ? 'UNLOCK' : 'LOCK'} INDEX ${idx};`).join('\n'),
        executionDurationMs: +(6 + Math.random() * 8).toFixed(1),
        status: 'COMPLETED'
      }
    });
    window.dispatchEvent(ev);
  };

  const handleBulkProtect = () => {
    if (selectedIndexes.length === 0) return;
    setLockedIndexes((prev) => Array.from(new Set([...prev, ...selectedIndexes])));
    setImportSuccessNotice(`Marked ${selectedIndexes.length} selected index(es) as Protected against automated changes.`);
    setTimeout(() => setImportSuccessNotice(null), 4500);

    const ev = new CustomEvent('optimization-lifecycle-event', {
      detail: {
        action: 'RESTORE',
        actionLabel: 'Bulk Protect Indexes',
        triggerSource: 'Bulk Actions Bar',
        targetIndex: selectedIndexes.join(', '),
        targetTable: 'multiple',
        columns: [],
        rationale: `Protected ${selectedIndexes.length} indexes against automated cleanup.`,
        executedDdl: selectedIndexes.map((idx) => `-- LOCK INDEX ${idx};`).join('\n'),
        executionDurationMs: +(5 + Math.random() * 6).toFixed(1),
        status: 'COMPLETED'
      }
    });
    window.dispatchEvent(ev);
  };

  const handleBulkUnprotect = () => {
    if (selectedIndexes.length === 0) return;
    setLockedIndexes((prev) => prev.filter((name) => !selectedIndexes.includes(name)));
    setImportSuccessNotice(`Removed protection from ${selectedIndexes.length} index(es). They can now be optimized.`);
    setTimeout(() => setImportSuccessNotice(null), 4500);

    const ev = new CustomEvent('optimization-lifecycle-event', {
      detail: {
        action: 'PRUNE',
        actionLabel: 'Bulk Unprotect Indexes',
        triggerSource: 'Bulk Actions Bar',
        targetIndex: selectedIndexes.join(', '),
        targetTable: 'multiple',
        columns: [],
        rationale: `Removed locks on ${selectedIndexes.length} indexes.`,
        executedDdl: selectedIndexes.map((idx) => `-- UNLOCK INDEX ${idx};`).join('\n'),
        executionDurationMs: +(5 + Math.random() * 6).toFixed(1),
        status: 'COMPLETED'
      }
    });
    window.dispatchEvent(ev);
  };

  const handleBulkReindex = () => {
    if (selectedIndexes.length === 0) return;
    setIsBulkOperating(true);
    const count = selectedIndexes.length;
    setImportSuccessNotice(`[Bulk Maintenance Started] Executing zero-downtime REINDEX CONCURRENTLY across ${count} selected index trees...`);

    setTimeout(() => {
      setReindexedIndexes((prev) => Array.from(new Set([...prev, ...selectedIndexes])));
      setIsBulkOperating(false);
      setImportSuccessNotice(`✓ Successfully completed bulk REINDEX CONCURRENTLY on ${count} indexes! Fragmentation reduced to 3% and health restored to 98/100.`);
      setTimeout(() => setImportSuccessNotice(null), 5000);

      const ev = new CustomEvent('optimization-lifecycle-event', {
        detail: {
          action: 'HEAL',
          actionLabel: 'Bulk Concurrent Reindex',
          triggerSource: 'Bulk Actions Bar',
          targetIndex: selectedIndexes.slice(0, 4).join(', ') + (count > 4 ? ` (+${count - 4} more)` : ''),
          targetTable: 'multiple',
          columns: ['composite'],
          rationale: `Executed mass zero-downtime concurrent reindex across ${count} selected index trees.`,
          executedDdl: selectedIndexes.map((idx) => `REINDEX INDEX CONCURRENTLY ${idx};`).join('\n'),
          executionDurationMs: +(32 + count * 9).toFixed(1),
          healthDelta: { before: 44, after: 98, gain: 54 },
          latencyImpact: { beforeMs: '138.0 ms', afterMs: '2.9 ms', speedup: '97.9% faster' },
          writeOverheadDelta: 'Zero lock contention (Concurrent B-Tree rebuild)',
          status: 'COMPLETED'
        }
      });
      window.dispatchEvent(ev);
    }, 1100);
  };

  const handleAutoOptimizeWorkload = () => {
    setIsAutoOptimizingWorkload(true);
    setTimeout(() => {
      // 1. Toggle core B-Tree flags for expensive queries (if affected indexes are not locked)
      if (!flags.btreeIndexing && !lockedIndexes.includes('idx_orders_status_cat')) {
        onToggleFlag('btreeIndexing');
      }
      if (!flags.batchEagerLoading && !lockedIndexes.includes('idx_line_items_tx')) {
        onToggleFlag('batchEagerLoading');
      }

      // 2. Toggle optimal composite B-Tree indexes for multi-column predicates (respecting locks)
      setCreatedCompositeIndexes((prev) => {
        const next = new Set(['email_status', 'category_amount', 'tx_price', 'tier_created']);
        if (lockedIndexes.includes('idx_transactions_email_status') && !prev.includes('email_status')) next.delete('email_status');
        if (lockedIndexes.includes('idx_transactions_category_amount') && !prev.includes('category_amount')) next.delete('category_amount');
        if (lockedIndexes.includes('idx_line_items_tx_price') && !prev.includes('tx_price')) next.delete('tx_price');
        if (lockedIndexes.includes('idx_customers_tier_created') && !prev.includes('tier_created')) next.delete('tier_created');
        return Array.from(next);
      });

      // 3. Ensure single-column indexes are set (respecting locks)
      setCreatedCustomIndexes((prev) => {
        const additions: string[] = [];
        if (!lockedIndexes.includes('idx_transactions_email_missing')) additions.push('customer_email');
        if (!lockedIndexes.includes('idx_transactions_amount_missing')) additions.push('amount');
        return Array.from(new Set([...prev, ...additions]));
      });

      // 4. Prune dead unutilized index (idx_transactions_date) to prevent buffer cache pollution ONLY if NOT locked
      if (!lockedIndexes.includes('idx_transactions_date')) {
        setRemovedIndexes((prev) => Array.from(new Set([...prev, 'idx_transactions_date'])));
      }

      setIsAutoOptimizingWorkload(false);
      setAutoOptimizedCompleted(true);
      setHasAnalyzedWorkload(true);
      setShowWorkloadOptimizationModal(true);
    }, 650);
  };

  const handleRunIndexCleanupScan = () => {
    setShowIndexCleanupModal(true);
    setIsScanningCleanup(true);
    setTimeout(() => {
      setIsScanningCleanup(false);
      setCleanupScanCompleted(true);
    }, 750);
  };

  const isIndexUnutilized = (idxName: string) => {
    if (removedIndexes.includes(idxName)) return false;
    if (idxName === 'idx_transactions_date') return true;
    if (idxName.includes('amount_missing')) return true;
    if (idxName.includes('email_missing')) return true;
    return false;
  };

  const handleRemoveUnutilizedIndex = (idxName: string) => {
    if (lockedIndexes.includes(idxName)) {
      setImportSuccessNotice(`Cannot remove index "${idxName}": Index is locked as high-priority manual.`);
      setTimeout(() => setImportSuccessNotice(null), 4000);
      return;
    }
    if (!removedIndexes.includes(idxName)) {
      setRemovedIndexes((prev) => [...prev, idxName]);
      const diag = unutilizedDiagnostics.find((d) => d.name === idxName);
      const ev = new CustomEvent('optimization-lifecycle-event', {
        detail: {
          action: 'DELETE',
          actionLabel: 'Redundant Index Auto-Prune',
          triggerSource: 'Auto-Healing',
          targetIndex: idxName,
          targetTable: diag?.table || 'transactions',
          columns: diag ? [diag.column] : ['id'],
          rationale: `Index "${idxName}" pruned to eliminate write amplification and reclaim disk space.`,
          executedDdl: `DROP INDEX CONCURRENTLY ${idxName};`,
          executionDurationMs: +(5 + Math.random() * 4).toFixed(1),
          healthDelta: { before: 20, after: 92, gain: 72 },
          latencyImpact: { beforeMs: '120 ms write lock stall', afterMs: '0.0 ms', speedup: '100% write lock eliminated' },
          writeOverheadDelta: '+12.5% write throughput unlocked',
          status: 'COMPLETED'
        }
      });
      window.dispatchEvent(ev);
    }
    if (idxName.includes('email_missing')) {
      setCreatedCustomIndexes((prev) => prev.filter((c) => c !== 'customer_email'));
    }
    if (idxName.includes('amount_missing')) {
      setCreatedCustomIndexes((prev) => prev.filter((c) => c !== 'amount'));
    }
  };

  const handleRestoreRemovedIndex = (idxName: string) => {
    setRemovedIndexes((prev) => prev.filter((n) => n !== idxName));
  };

  const handleRemoveAllUnutilized = () => {
    const unutilized = ['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing']
      .filter((name) => !lockedIndexes.includes(name));
    setRemovedIndexes((prev) => Array.from(new Set([...prev, ...unutilized])));
    setCreatedCustomIndexes((prev) =>
      prev.filter((c) => {
        if (c === 'customer_email' && lockedIndexes.includes('idx_transactions_email_missing')) return true;
        if (c === 'amount' && lockedIndexes.includes('idx_transactions_amount_missing')) return true;
        return c !== 'customer_email' && c !== 'amount';
      })
    );

    // Dispatch lifecycle deletion events for each unutilized index pruned
    unutilized.forEach((idxName) => {
      const diag = unutilizedDiagnostics.find((d) => d.name === idxName);
      const ev = new CustomEvent('optimization-lifecycle-event', {
        detail: {
          action: 'DELETE',
          actionLabel: 'Redundant Index Auto-Prune',
          triggerSource: 'Auto-Healing',
          targetIndex: idxName,
          targetTable: diag?.table || 'transactions',
          columns: diag ? [diag.column] : ['created_at'],
          rationale: `Auto-Healing engine pruned unused index "${idxName}" (0 query seeks in 24h, high write amplification) to reclaim ${diag?.size || '2.3 MB'} memory and eliminate lock contention.`,
          executedDdl: `DROP INDEX CONCURRENTLY ${idxName};`,
          executionDurationMs: +(6 + Math.random() * 5).toFixed(1),
          healthDelta: { before: 18, after: 95, gain: 77 },
          latencyImpact: { beforeMs: '140 ms write lock stall', afterMs: '0.0 ms write lock stall', speedup: '14% write latency saved' },
          writeOverheadDelta: '+14.0% write throughput unlocked',
          status: 'COMPLETED'
        }
      });
      window.dispatchEvent(ev);
    });
  };

  const unutilizedDiagnostics = [
    {
      name: 'idx_transactions_date',
      table: 'transactions',
      column: 'created_at',
      type: 'B-Tree',
      size: '2.4 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Zero query predicates on created_at across the last 100 queries. The query planner ignores this index, wasting 2.4 MB of disk storage and causing 14% write I/O amplification on order ingestion.',
      writeImpact: '14% insert latency penalty'
    },
    {
      name: 'idx_transactions_amount_missing',
      table: 'transactions',
      column: 'amount',
      type: 'B-Tree (Single-column)',
      size: '2.1 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Low cardinality/selectivity on standalone amount filter. Recorded 0 hits in last 100 queries as multi-column queries favor full table scans or composite (category, amount) indexes.',
      writeImpact: '12% lock contention overhead'
    },
    {
      name: 'idx_transactions_email_missing',
      table: 'transactions',
      column: 'customer_email',
      type: 'B-Tree (Single-column)',
      size: '2.3 MB',
      hits: 0,
      totalQueries: 100,
      reason: 'Overlapped by composite (customer_email, status). Zero query hits recorded across the 100-query audit window for standalone lookups.',
      writeImpact: '12% B-tree maintenance overhead'
    }
  ];

  const isIndexRedundant = (idxName: string, columns: string[]) => {
    if (consolidatedIndexes.includes(idxName)) return false;
    if (idxName.includes('email_missing') && createdCompositeIndexes.includes('email_status')) return true;
    if (idxName.includes('amount_missing') && createdCompositeIndexes.includes('category_amount')) return true;
    return false;
  };

  const handleConsolidateIndex = (idxName: string) => {
    if (lockedIndexes.includes(idxName)) {
      setImportSuccessNotice(`Cannot consolidate index "${idxName}": Index is locked as high-priority manual.`);
      setTimeout(() => setImportSuccessNotice(null), 4000);
      return;
    }
    setConsolidatedIndexes([...consolidatedIndexes, idxName]);
    if (idxName.includes('email_missing')) {
      setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'customer_email'));
      if (!createdCompositeIndexes.includes('email_status')) {
        setCreatedCompositeIndexes([...createdCompositeIndexes, 'email_status']);
      }
    }
    if (idxName.includes('amount_missing')) {
      setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'amount'));
      if (!createdCompositeIndexes.includes('category_amount')) {
        setCreatedCompositeIndexes([...createdCompositeIndexes, 'category_amount']);
      }
    }

    // Dispatch Consolidation Merge Event to window
    const isEmail = idxName.includes('email_missing');
    const targetIdx = isEmail ? 'idx_transactions_email_status' : 'idx_transactions_category_amount';
    const targetCols = isEmail ? ['customer_email', 'status'] : ['category', 'amount'];
    const ddl = isEmail
      ? `CREATE INDEX CONCURRENTLY idx_transactions_email_status ON transactions (customer_email, status);\nDROP INDEX CONCURRENTLY ${idxName};`
      : `CREATE INDEX CONCURRENTLY idx_transactions_category_amount ON transactions (category, amount);\nDROP INDEX CONCURRENTLY ${idxName};`;

    const ev = new CustomEvent('optimization-lifecycle-event', {
      detail: {
        action: 'MERGE',
        actionLabel: 'Multi-Column Index Consolidation',
        triggerSource: 'Consolidation',
        targetIndex: targetIdx,
        targetTable: 'transactions',
        columns: targetCols,
        rationale: `Consolidation feature merged overlapping single-column index "${idxName}" into composite B-Tree index "${targetIdx}", reducing write amplification and query latency.`,
        executedDdl: ddl,
        executionDurationMs: +(30 + Math.random() * 15).toFixed(1),
        healthDelta: { before: 52, after: 96, gain: 44 },
        latencyImpact: { beforeMs: '310.0 ms', afterMs: '1.4 ms', speedup: '99.5% faster' },
        writeOverheadDelta: '-22.4% WAL write lock reduction',
        status: 'COMPLETED'
      }
    });
    window.dispatchEvent(ev);
    setImportSuccessNotice(`[Consolidation Executed] Merged "${idxName}" into composite index "${targetIdx}". Captured in Optimization Lifecycle!`);
    setTimeout(() => setImportSuccessNotice(null), 5000);
  };

  const handleAnalyzeWorkload = () => {
    setIsAnalyzingWorkload(true);
    setTimeout(() => {
      setIsAnalyzingWorkload(false);
      setHasAnalyzedWorkload(true);
    }, 900);
  };

  const handleRevertAllIndexes = () => {
    const lockedCustom: string[] = [];
    if (lockedIndexes.includes('idx_transactions_email_missing')) lockedCustom.push('customer_email');
    if (lockedIndexes.includes('idx_transactions_amount_missing')) lockedCustom.push('amount');
    setCreatedCustomIndexes(lockedCustom);

    const lockedComposite: string[] = [];
    if (lockedIndexes.includes('idx_transactions_email_status')) lockedComposite.push('email_status');
    if (lockedIndexes.includes('idx_transactions_category_amount')) lockedComposite.push('category_amount');
    if (lockedIndexes.includes('idx_line_items_tx_price')) lockedComposite.push('tx_price');
    if (lockedIndexes.includes('idx_customers_tier_created')) lockedComposite.push('tier_created');
    setCreatedCompositeIndexes(lockedComposite);

    setConsolidatedIndexes([]);
    setRemovedIndexes([]);
    setImportedCustomIndices((prev) => prev.filter((idx) => lockedIndexes.includes(idx.name)));
    setActiveSchemaPrototypeName('Standard Workload Schema');
    setCleanupScanCompleted(false);
    setAutoOptimizedCompleted(false);
  };

  const [snapshots, setSnapshots] = useState<SchemaSnapshot[]>([
    {
      id: 'snapshot-default',
      name: 'Default Baseline State',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      flags: { batchEagerLoading: false, btreeIndexing: false, queryCaching: false, virtualizedDOM: false, deferredRendering: false },
      customIndexes: [],
      createdCompositeIndexes: [],
      removedIndexes: [],
      importedCustomIndices: [],
      activeSchemaPrototypeName: 'Default Baseline State',
      totalIndexesCount: 6
    }
  ]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string>('snapshot-default');
  const [showNamedSnapshotModal, setShowNamedSnapshotModal] = useState<boolean>(false);
  const [newSnapshotName, setNewSnapshotName] = useState<string>('');
  const [showSnapshotsModal, setShowSnapshotsModal] = useState<boolean>(false);
  const [migrationVersion1Id, setMigrationVersion1Id] = useState<string>('snapshot-default');
  const [migrationVersion2Id, setMigrationVersion2Id] = useState<string>('snapshot-default');
  const [showCompareSchemaOverlay, setShowCompareSchemaOverlay] = useState<boolean>(false);
  const [compareSnapshotAId, setCompareSnapshotAId] = useState<string>('snapshot-default');
  const [compareSnapshotBId, setCompareSnapshotBId] = useState<string>('snapshot-default');

  const handleExportMigrationSQL = () => {
    const v1 = snapshots.find((s) => s.id === migrationVersion1Id) || snapshots[0];
    const v2 = snapshots.find((s) => s.id === migrationVersion2Id) || snapshots[snapshots.length - 1];
    if (!v1 || !v2) return;

    let sqlLines: string[] = [];
    sqlLines.push(`-- =====================================================================`);
    sqlLines.push(`-- PostgreSQL Production Migration Script`);
    sqlLines.push(`-- Generated from Schema Versioning Comparison`);
    sqlLines.push(`-- From Version: "${v1.name}" (${v1.timestamp})`);
    sqlLines.push(`-- To Version:   "${v2.name}" (${v2.timestamp})`);
    sqlLines.push(`-- =====================================================================\n`);

    sqlLines.push(`BEGIN;\n`);

    if (v1.flags?.btreeIndexing !== v2.flags?.btreeIndexing) {
      sqlLines.push(`-- [Flag Delta] btreeIndexing changed: ${v1.flags?.btreeIndexing} -> ${v2.flags?.btreeIndexing}`);
      sqlLines.push(`ALTER DATABASE CURRENT SET enable_seqscan = ${v2.flags?.btreeIndexing ? 'off' : 'on'};\n`);
    }

    const v1Custom = new Set(v1.customIndexes || []);
    const v2Custom = new Set(v2.customIndexes || []);

    for (const idx of v2Custom) {
      if (!v1Custom.has(idx)) {
        sqlLines.push(`-- [Add Custom Index]`);
        if (idx === 'customer_email') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_email_missing ON transactions (customer_email);`);
        } else if (idx === 'amount') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_amount_missing ON transactions (amount);`);
        } else {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_${idx} ON transactions (${idx});`);
        }
      }
    }

    for (const idx of v1Custom) {
      if (!v2Custom.has(idx)) {
        sqlLines.push(`-- [Drop Custom Index]`);
        if (idx === 'customer_email') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_email_missing;`);
        } else if (idx === 'amount') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_amount_missing;`);
        } else {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_${idx};`);
        }
      }
    }

    const v1Comp = new Set(v1.createdCompositeIndexes || []);
    const v2Comp = new Set(v2.createdCompositeIndexes || []);

    for (const comp of v2Comp) {
      if (!v1Comp.has(comp)) {
        sqlLines.push(`-- [Add Composite Index]`);
        if (comp === 'email_status') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_email_status ON transactions (customer_email, status);`);
        } else if (comp === 'category_amount') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_transactions_category_amount ON transactions (category, amount);`);
        } else if (comp === 'tx_price') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_line_items_tx_price ON line_items (transaction_id, unit_price);`);
        } else if (comp === 'tier_created') {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_customers_tier_created ON customers (tier, created_at DESC);`);
        } else {
          sqlLines.push(`CREATE INDEX CONCURRENTLY idx_${comp} ON transactions (${comp});`);
        }
      }
    }

    for (const comp of v1Comp) {
      if (!v2Comp.has(comp)) {
        sqlLines.push(`-- [Drop Composite Index]`);
        if (comp === 'email_status') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_email_status;`);
        } else if (comp === 'category_amount') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_category_amount;`);
        } else if (comp === 'tx_price') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_line_items_tx_price;`);
        } else if (comp === 'tier_created') {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_customers_tier_created;`);
        } else {
          sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS idx_${comp};`);
        }
      }
    }

    const v1Removed = new Set(v1.removedIndexes || []);
    const v2Removed = new Set(v2.removedIndexes || []);

    for (const rem of v2Removed) {
      if (!v1Removed.has(rem)) {
        sqlLines.push(`-- [Prune Unutilized Index]`);
        sqlLines.push(`DROP INDEX CONCURRENTLY IF EXISTS ${rem};`);
      }
    }

    sqlLines.push(`\nCOMMIT;`);

    const sqlContent = sqlLines.join('\n');
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_${v1.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_to_${v2.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setImportSuccessNotice(`Successfully generated & downloaded Migration SQL script between "${v1.name}" and "${v2.name}"!`);
    setTimeout(() => setImportSuccessNotice(null), 5000);
  };

  const handleBulkApplyAllIndexes = () => {
    if (!flags.btreeIndexing) {
      onToggleFlag('btreeIndexing');
    }
    if (!flags.batchEagerLoading) {
      onToggleFlag('batchEagerLoading');
    }
    const missing = ['customer_email', 'amount'].filter((col) => !createdCustomIndexes.includes(col));
    if (missing.length > 0) {
      setCreatedCustomIndexes([...createdCustomIndexes, ...missing]);
    }
    if (!createdCompositeIndexes.includes('email_status')) {
      setCreatedCompositeIndexes(['email_status', 'category_amount']);
    }
  };

  const tables = [
    {
      name: 'transactions',
      entityName: 'Transactions Entity',
      entityBadge: 'Core Ledger',
      entityRole: 'Primary Relational Anchor',
      description: 'Primary transactional ledger storing 50,000+ orders and execution telemetry.',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'order_number', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: true },
        { name: 'customer_name', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'customer_email', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'amount', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: false },
        { name: 'status', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: flags.btreeIndexing },
        { name: 'category', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: flags.btreeIndexing },
        { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, indexed: true },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: !removedIndexes.includes('PRIMARY KEY (id)') },
        { name: 'idx_orders_status_cat', type: 'Composite B-Tree', columns: ['status', 'category'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: flags.btreeIndexing && !removedIndexes.includes('idx_orders_status_cat') },
        { name: 'idx_orders_cat_status', type: 'Composite B-Tree (Inverted Covering)', columns: ['category', 'status'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: flags.btreeIndexing && !removedIndexes.includes('idx_orders_cat_status') && !resolvedConstraintConflicts['transactions-category-status'] },
        { name: 'idx_transactions_date', type: 'B-Tree', columns: ['created_at'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: !removedIndexes.includes('idx_transactions_date') },
        { name: 'idx_transactions_email_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['customer_email'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCustomIndexes.includes('customer_email') && !removedIndexes.includes('idx_transactions_email_missing') },
        { name: 'idx_transactions_amount_missing', type: 'B-Tree (Missing Bottleneck)', columns: ['amount'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCustomIndexes.includes('amount') && !removedIndexes.includes('idx_transactions_amount_missing') },
        { name: 'idx_transactions_email_status', type: 'Composite B-Tree (AI Recommended)', columns: ['customer_email', 'status'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCompositeIndexes.includes('email_status') && !removedIndexes.includes('idx_transactions_email_status') },
        { name: 'idx_transactions_category_amount', type: 'Composite B-Tree (AI Recommended)', columns: ['category', 'amount'], targetTable: 'transactions', targetEntity: 'Transactions Entity', active: createdCompositeIndexes.includes('category_amount') && !removedIndexes.includes('idx_transactions_category_amount') },
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'transactions' && !removedIndexes.includes(idx.name)),
      ],
      relationships: [
        { targetTable: 'line_items', type: 'One-to-Many', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'line_items',
      entityName: 'Order Items Entity',
      entityBadge: 'Child Relation',
      entityRole: 'Itemized Order Breakdowns',
      description: 'Order items table storing SKU details and quantities (N+1 query target if unbatched).',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'transaction_id', type: 'VARCHAR(36)', isPk: false, isFk: true, indexed: true },
        { name: 'sku', type: 'VARCHAR(64)', isPk: false, isFk: false, indexed: false },
        { name: 'quantity', type: 'INT', isPk: false, isFk: false, indexed: false },
        { name: 'unit_price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tx_price') },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: true },
        { name: 'idx_line_items_tx', type: 'B-Tree (Foreign Key)', columns: ['transaction_id'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: flags.batchEagerLoading },
        { name: 'idx_line_items_tx_price', type: 'Composite B-Tree (AI Recommended)', columns: ['transaction_id', 'unit_price'], targetTable: 'line_items', targetEntity: 'Order Items Entity', active: createdCompositeIndexes.includes('tx_price') && !removedIndexes.includes('idx_line_items_tx_price') },
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'line_items' && !removedIndexes.includes(idx.name)),
      ],
      relationships: [
        { targetTable: 'transactions', type: 'Many-to-One', foreignKey: 'line_items.transaction_id -> transactions.id', optimized: flags.batchEagerLoading }
      ]
    },
    {
      name: 'customers',
      entityName: 'Customers Entity',
      entityBadge: 'Master Dimension',
      entityRole: 'Accounts & User Registry',
      description: 'Customer directory and enterprise tier tracking.',
      columns: [
        { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
        { name: 'name', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: false },
        { name: 'email', type: 'VARCHAR(128)', isPk: false, isFk: false, indexed: true },
        { name: 'tier', type: 'VARCHAR(32)', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tier_created') },
        { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, indexed: createdCompositeIndexes.includes('tier_created') },
      ],
      indexes: [
        { name: 'PRIMARY KEY (id)', type: 'B-Tree (Clustered)', columns: ['id'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true },
        { name: 'idx_customers_email', type: 'B-Tree Unique', columns: ['email'], targetTable: 'customers', targetEntity: 'Customers Entity', active: true },
        { name: 'idx_customers_tier_created', type: 'Composite B-Tree (AI Recommended)', columns: ['tier', 'created_at'], targetTable: 'customers', targetEntity: 'Customers Entity', active: createdCompositeIndexes.includes('tier_created') && !removedIndexes.includes('idx_customers_tier_created') },
        ...importedCustomIndices.filter((idx) => idx.targetTable === 'customers' && !removedIndexes.includes(idx.name)),
      ],
      relationships: []
    },
    ...Array.from(new Set<string>(importedCustomIndices.map((i) => i.targetTable)))
      .filter((tableName: string) => !['transactions', 'line_items', 'customers'].includes(tableName))
      .map((tableName: string) => ({
        name: tableName,
        entityName: `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Entity`,
        entityBadge: 'Prototyped Entity',
        entityRole: 'Custom Imported Table',
        description: 'Prototyped database table schema imported from JSON index configuration.',
        columns: [
          { name: 'id', type: 'VARCHAR(36)', isPk: true, isFk: false, indexed: true },
          ...Array.from(
            new Set<string>(importedCustomIndices.filter((i) => i.targetTable === tableName).flatMap((i) => i.columns))
          ).map((colName: string) => ({
            name: colName,
            type: 'VARCHAR(128)',
            isPk: false,
            isFk: false,
            indexed: true
          }))
        ],
        indexes: importedCustomIndices.filter((i) => i.targetTable === tableName && !removedIndexes.includes(i.name)),
        relationships: []
      }))
  ];

  const currentTableData = tables.find((t) => t.name === selectedTable) || tables[0];

  interface ConstraintConflictPair {
    id: string;
    tableName: string;
    entityName: string;
    indexA: { name: string; type: string; columns: string[] };
    indexB: { name: string; type: string; columns: string[] };
    columnsSet: string[];
    columnOrderA: string;
    columnOrderB: string;
    writeAmplificationPercent: number;
    wastedStorageMb: number;
    recommendedKeep: string;
    reason: string;
  }

  // Constraint Conflict Monitor: Watches active indexes for overlapping covering indexes with different column ordering
  const detectedConstraintConflicts = useMemo<ConstraintConflictPair[]>(() => {
    const conflicts: ConstraintConflictPair[] = [];

    tables.forEach((tbl) => {
      const activeIdxs = tbl.indexes.filter(
        (i) => i.active && !removedIndexes.includes(i.name)
      );

      for (let i = 0; i < activeIdxs.length; i++) {
        for (let j = i + 1; j < activeIdxs.length; j++) {
          const a = activeIdxs[i];
          const b = activeIdxs[j];

          if (a.columns.length < 2 || b.columns.length < 2) continue;
          if (a.columns.length !== b.columns.length) continue;

          // Check if same set of columns
          const setA = new Set(a.columns);
          const hasSameCols = b.columns.every((col) => setA.has(col));

          // Check if different ordering
          const orderA = a.columns.join(', ');
          const orderB = b.columns.join(', ');

          if (hasSameCols && orderA !== orderB) {
            const conflictId = `${tbl.name}-${[...a.columns].sort().join('-')}`;
            if (!resolvedConstraintConflicts[conflictId]) {
              conflicts.push({
                id: conflictId,
                tableName: tbl.name,
                entityName: tbl.entityName,
                indexA: { name: a.name, type: a.type, columns: a.columns },
                indexB: { name: b.name, type: b.type, columns: b.columns },
                columnsSet: [...a.columns].sort(),
                columnOrderA: orderA,
                columnOrderB: orderB,
                writeAmplificationPercent: 22,
                wastedStorageMb: 6.4,
                recommendedKeep: a.name,
                reason: `Both '${a.name}' and '${b.name}' cover columns (${orderA}) vs (${orderB}). Due to B-Tree leftmost prefix traversal, maintaining dual inverted covering indexes doubles WAL logging and write lock contention.`
              });
            }
          }
        }
      }
    });

    return conflicts;
  }, [tables, removedIndexes, resolvedConstraintConflicts]);

  const speedUpPercent = React.useMemo(() => {
    let score = 0;
    if (flags.btreeIndexing) score += 35;
    if (flags.batchEagerLoading) score += 30;
    if (flags.queryCaching) score += 15;
    if (flags.virtualizedDOM) score += 15;
    if (flags.deferredRendering) score += 5;
    if (createdCustomIndexes.length > 0) score += createdCustomIndexes.length * 5;
    return Math.min(100, score);
  }, [flags, createdCustomIndexes]);

  // Sample index configuration presets for instant schema prototyping
  const samplePresets = useMemo(() => [
    {
      id: 'preset-ecommerce-high-throughput',
      name: 'E-Commerce Peak Workload (Full Composite)',
      badge: 'High Throughput',
      description: 'Co-locates multi-column filter predicates (email + status, category + amount, tx + price) to eliminate 99.4% of table heap lookups.',
      speedup: '253x Faster (482ms → 1.9ms)',
      tableCount: 3,
      indexCount: 6,
      jsonContent: JSON.stringify({
        name: "E-Commerce Peak Workload (Full Composite)",
        description: "Composite B-Tree coverage for customer verification, order category aggregations, and item joins.",
        optimizationFlags: {
          btreeIndexing: true,
          batchEagerLoading: true,
          queryCaching: true
        },
        indexConfiguration: {
          createdCompositeIndexes: ["email_status", "category_amount", "tx_price", "tier_created"],
          createdCustomIndexes: ["customer_email", "amount"],
          removedOrPrunedIndexes: ["idx_transactions_date"]
        },
        indices: [
          {
            name: "idx_transactions_status_amount",
            targetTable: "transactions",
            columns: ["status", "amount"],
            type: "Composite B-Tree",
            active: true
          },
          {
            name: "idx_line_items_sku_qty",
            targetTable: "line_items",
            columns: ["sku", "quantity"],
            type: "B-Tree (Covering)",
            active: true
          }
        ]
      }, null, 2)
    },
    {
      id: 'preset-analytics-aggregations',
      name: 'Analytics & Reporting Aggregations (OLAP)',
      badge: 'OLAP / Reporting',
      description: 'Optimized for heavy GROUP BY queries and date-range reporting without disk workmem spillover.',
      speedup: '180x Faster (320ms → 1.8ms)',
      tableCount: 3,
      indexCount: 4,
      jsonContent: JSON.stringify({
        name: "Analytics & Reporting Aggregations (OLAP)",
        description: "Pre-grouped range aggregates eliminating disk sorts and temporary RAM workmem spills.",
        optimizationFlags: {
          btreeIndexing: true,
          batchEagerLoading: true,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: ["category_amount", "tier_created"],
          createdCustomIndexes: ["amount"],
          removedOrPrunedIndexes: []
        },
        indices: [
          {
            name: "idx_transactions_cat_date",
            targetTable: "transactions",
            columns: ["category", "created_at"],
            type: "Composite B-Tree",
            active: true
          }
        ]
      }, null, 2)
    },
    {
      id: 'preset-write-heavy-lean',
      name: 'Write-Heavy Ingestion (Low Amplification)',
      badge: 'Write-Optimized',
      description: 'Prunes redundant single-column indexes to minimize WAL log write overhead and write lock latency during bulk ETL.',
      speedup: '+18% Write Throughput Saved',
      tableCount: 3,
      indexCount: 2,
      jsonContent: JSON.stringify({
        name: "Write-Heavy Ingestion (Low Amplification)",
        description: "Lean indexing strategy minimizing B-Tree leaf write amplification and buffer cache churn.",
        optimizationFlags: {
          btreeIndexing: false,
          batchEagerLoading: true,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: ["tx_price"],
          createdCustomIndexes: [],
          removedOrPrunedIndexes: ["idx_transactions_date", "idx_transactions_email_missing", "idx_transactions_amount_missing"]
        },
        indices: []
      }, null, 2)
    },
    {
      id: 'preset-3nf-baseline',
      name: '3NF Normalized Baseline (FK Only)',
      badge: 'Integrity Baseline',
      description: 'Standard relational primary keys and foreign key join anchors only. Useful as a baseline benchmark.',
      speedup: '1.0x (Unoptimized Baseline)',
      tableCount: 3,
      indexCount: 3,
      jsonContent: JSON.stringify({
        name: "3NF Normalized Baseline (FK Only)",
        description: "Relational integrity baseline without custom composite indexes for comparison.",
        optimizationFlags: {
          btreeIndexing: false,
          batchEagerLoading: false,
          queryCaching: false
        },
        indexConfiguration: {
          createdCompositeIndexes: [],
          createdCustomIndexes: [],
          removedOrPrunedIndexes: []
        },
        indices: []
      }, null, 2)
    }
  ], []);

  // Real-time JSON validation and schema parsing engine for Bulk Import
  const parsedImportResult = useMemo(() => {
    const raw = importJsonInput.trim();
    if (!raw) {
      return {
        isValid: false,
        error: null,
        config: null
      };
    }

    try {
      const data = JSON.parse(raw);
      let stateName = 'Custom Imported Schema State';
      let stateDescription = 'Imported index configurations for schema state prototyping.';
      const targetTables = new Set<string>();
      let compositeKeys: string[] = [];
      let customKeys: string[] = [];
      let prunedKeys: string[] = [];
      const flagOverrides: Partial<OptimizationFlags> = {};
      const customIndexList: Array<{
        name: string;
        type: string;
        columns: string[];
        targetTable: string;
        targetEntity?: string;
        active: boolean;
      }> = [];

      // Format 1: Direct snapshot or config object
      if (typeof data === 'object' && !Array.isArray(data)) {
        if (data.name) stateName = data.name;
        if (data.snapshotMetadata?.stateDescription) stateName = data.snapshotMetadata.stateDescription;
        if (data.description) stateDescription = data.description;

        // Flags
        const flagsObj = data.optimizationFlags || data.flags;
        if (flagsObj && typeof flagsObj === 'object') {
          if (typeof flagsObj.btreeIndexing === 'boolean') flagOverrides.btreeIndexing = flagsObj.btreeIndexing;
          if (typeof flagsObj.batchEagerLoading === 'boolean') flagOverrides.batchEagerLoading = flagsObj.batchEagerLoading;
          if (typeof flagsObj.queryCaching === 'boolean') flagOverrides.queryCaching = flagsObj.queryCaching;
        }

        // Index configurations
        const indexConfig = data.indexConfiguration || data.indexConfig || data;
        if (Array.isArray(indexConfig.createdCompositeIndexes)) {
          compositeKeys = indexConfig.createdCompositeIndexes;
        }
        if (Array.isArray(indexConfig.createdCustomIndexes)) {
          customKeys = indexConfig.createdCustomIndexes;
        }
        if (Array.isArray(indexConfig.removedOrPrunedIndexes)) {
          prunedKeys = indexConfig.removedOrPrunedIndexes;
        } else if (Array.isArray(indexConfig.removedIndexes)) {
          prunedKeys = indexConfig.removedIndexes;
        }

        // Extract custom index definitions if provided in indices / indexes array
        const rawIndices = data.indices || data.indexes;
        if (Array.isArray(rawIndices)) {
          rawIndices.forEach((item: any) => {
            if (item && typeof item === 'object' && item.name) {
              const tbl = item.targetTable || item.table || 'transactions';
              targetTables.add(tbl);
              const cols = Array.isArray(item.columns) ? item.columns : (item.column ? [item.column] : ['id']);
              customIndexList.push({
                name: item.name,
                type: item.type || (cols.length > 1 ? 'Composite B-Tree' : 'B-Tree'),
                columns: cols,
                targetTable: tbl,
                targetEntity: item.targetEntity || `${tbl.charAt(0).toUpperCase() + tbl.slice(1)} Entity`,
                active: item.active !== false
              });
            }
          });
        }

        if (Array.isArray(data.tablesAndEntities)) {
          data.tablesAndEntities.forEach((t: any) => {
            if (t.tableName) targetTables.add(t.tableName);
          });
        }
      } else if (Array.isArray(data)) {
        // Format 2: Direct array of index objects
        stateName = `Custom Index Array (${data.length} indices)`;
        data.forEach((item: any, idx: number) => {
          if (item && typeof item === 'object') {
            const tbl = item.targetTable || item.table || 'transactions';
            targetTables.add(tbl);
            const cols = Array.isArray(item.columns) ? item.columns : (item.column ? [item.column] : [`col_${idx}`]);
            const idxName = item.name || `idx_${tbl}_${cols.join('_')}`;
            customIndexList.push({
              name: idxName,
              type: item.type || (cols.length > 1 ? 'Composite B-Tree (Imported)' : 'B-Tree (Imported)'),
              columns: cols,
              targetTable: tbl,
              targetEntity: item.targetEntity || `${tbl.charAt(0).toUpperCase() + tbl.slice(1)} Entity`,
              active: item.active !== false
            });
            // Auto-detect composite shortcuts
            if (cols.includes('customer_email') && cols.includes('status')) compositeKeys.push('email_status');
            if (cols.includes('category') && cols.includes('amount')) compositeKeys.push('category_amount');
            if (cols.includes('transaction_id') && cols.includes('unit_price')) compositeKeys.push('tx_price');
            if (cols.includes('tier') && cols.includes('created_at')) compositeKeys.push('tier_created');
            if (cols.length === 1 && cols[0] === 'customer_email') customKeys.push('customer_email');
            if (cols.length === 1 && cols[0] === 'amount') customKeys.push('amount');
          }
        });
      }

      if (compositeKeys.length > 0) {
        compositeKeys.forEach(k => {
          if (['email_status', 'category_amount'].includes(k)) targetTables.add('transactions');
          if (k === 'tx_price') targetTables.add('line_items');
          if (k === 'tier_created') targetTables.add('customers');
        });
      }
      if (customKeys.length > 0) targetTables.add('transactions');
      if (targetTables.size === 0) {
        targetTables.add('transactions');
        targetTables.add('line_items');
        targetTables.add('customers');
      }

      const totalIndices = compositeKeys.length + customKeys.length + customIndexList.length;

      return {
        isValid: true,
        error: null,
        config: {
          name: stateName,
          description: stateDescription,
          targetTables: Array.from(targetTables),
          flags: flagOverrides,
          createdCompositeIndexes: Array.from(new Set(compositeKeys)),
          createdCustomIndexes: Array.from(new Set(customKeys)),
          removedIndexes: Array.from(new Set(prunedKeys)),
          customIndices: customIndexList,
          totalIndicesCount: totalIndices,
          targetTablesCount: targetTables.size
        }
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message || 'Invalid JSON syntax',
        config: null
      };
    }
  }, [importJsonInput]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setImportJsonInput(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleJsonTemplate = () => {
    const template = {
      $schema: "https://aistudio.google.com/schemas/database-index-config.v1.json",
      name: "Custom E-Commerce Prototype Schema",
      description: "Composite and single-column index configurations for prototyping schema throughput.",
      optimizationFlags: {
        btreeIndexing: true,
        batchEagerLoading: true,
        queryCaching: true
      },
      indexConfiguration: {
        createdCompositeIndexes: ["email_status", "category_amount", "tx_price", "tier_created"],
        createdCustomIndexes: ["customer_email", "amount"],
        removedOrPrunedIndexes: ["idx_transactions_date"]
      },
      indices: [
        {
          name: "idx_transactions_status_amount",
          targetTable: "transactions",
          columns: ["status", "amount"],
          type: "Composite B-Tree",
          active: true
        },
        {
          name: "idx_line_items_sku_qty",
          targetTable: "line_items",
          columns: ["sku", "quantity"],
          type: "B-Tree (Covering)",
          active: true
        }
      ]
    };
    const jsonBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = "sample-index-configuration-template.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleApplyImportedIndices = () => {
    if (!parsedImportResult.isValid || !parsedImportResult.config) return;
    const config = parsedImportResult.config;

    // 1. Snapshot current schema state if user requested
    if (importSnapshotBeforeApply) {
      const activeCount = tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length, 0);
      const autoSnap: SchemaSnapshot = {
        id: `snapshot-pre-import-${Date.now()}`,
        name: `Pre-Import Baseline (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        flags: { ...flags },
        customIndexes: [...createdCustomIndexes],
        createdCompositeIndexes: [...createdCompositeIndexes],
        removedIndexes: [...removedIndexes],
        lockedIndexes: [...lockedIndexes],
        importedCustomIndices: [...importedCustomIndices],
        activeSchemaPrototypeName: activeSchemaPrototypeName,
        totalIndexesCount: activeCount
      };
      setSnapshots(prev => [...prev, autoSnap]);
      setSelectedCheckpointId(autoSnap.id);
    }

    // 2. Apply flags if defined
    if (config.flags) {
      if (config.flags.btreeIndexing !== undefined && config.flags.btreeIndexing !== flags.btreeIndexing) {
        onToggleFlag('btreeIndexing');
      }
      if (config.flags.batchEagerLoading !== undefined && config.flags.batchEagerLoading !== flags.batchEagerLoading) {
        onToggleFlag('batchEagerLoading');
      }
      if (config.flags.queryCaching !== undefined && config.flags.queryCaching !== flags.queryCaching) {
        onToggleFlag('queryCaching');
      }
    }

    // 3. Apply composite indices
    if (config.createdCompositeIndexes) {
      setCreatedCompositeIndexes(config.createdCompositeIndexes);
    }

    // 4. Apply custom indices
    if (config.createdCustomIndexes) {
      setCreatedCustomIndexes(config.createdCustomIndexes);
    }

    // 5. Apply removed/pruned indices
    if (config.removedIndexes) {
      setRemovedIndexes(config.removedIndexes);
    }

    // 6. Apply custom imported table indices
    if (config.customIndices) {
      setImportedCustomIndices(config.customIndices);
    }

    // 7. Update active prototype state name
    setActiveSchemaPrototypeName(config.name);

    // 8. Close modal and show notification
    setShowBulkImportModal(false);
    setImportSuccessNotice(`Successfully imported & activated index configuration: "${config.name}" (${config.totalIndicesCount} indices across ${config.targetTablesCount} tables)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 6000);
  };

  const handleSelectCheckpoint = (checkpointId: string) => {
    const snap = snapshots.find((s) => s.id === checkpointId);
    if (!snap) return;

    setSelectedCheckpointId(checkpointId);

    // 1. Restore flags if defined
    if (snap.flags) {
      if (snap.flags.btreeIndexing !== undefined && snap.flags.btreeIndexing !== flags.btreeIndexing) {
        onToggleFlag('btreeIndexing');
      }
      if (snap.flags.batchEagerLoading !== undefined && snap.flags.batchEagerLoading !== flags.batchEagerLoading) {
        onToggleFlag('batchEagerLoading');
      }
      if (snap.flags.queryCaching !== undefined && snap.flags.queryCaching !== flags.queryCaching) {
        onToggleFlag('queryCaching');
      }
    }

    // 2. Restore custom indexes
    setCreatedCustomIndexes([...snap.customIndexes]);

    // 3. Restore composite indexes
    setCreatedCompositeIndexes(snap.createdCompositeIndexes ? [...snap.createdCompositeIndexes] : []);

    // 4. Restore removed indexes
    setRemovedIndexes(snap.removedIndexes ? [...snap.removedIndexes] : []);

    // 5. Restore locked indexes
    if (snap.lockedIndexes) {
      setLockedIndexes([...snap.lockedIndexes]);
    } else {
      setLockedIndexes([]);
    }

    // 6. Restore imported custom table indices
    setImportedCustomIndices(snap.importedCustomIndices ? [...snap.importedCustomIndices] : []);

    // 7. Restore prototype name
    if (snap.activeSchemaPrototypeName) {
      setActiveSchemaPrototypeName(snap.activeSchemaPrototypeName);
    } else {
      setActiveSchemaPrototypeName(snap.name);
    }

    // 8. Show user notification
    const totalCount = snap.totalIndexesCount ?? (snap.customIndexes.length + (snap.createdCompositeIndexes?.length ?? 0));
    setImportSuccessNotice(`Switched to checkpoint: "${snap.name}" (${totalCount} active indexes)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 5000);
  };

  const handleOpenSnapshotModal = () => {
    const activeCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length,
      0
    );
    const defaultName = `Checkpoint #${snapshots.length + 1} (${activeCount} Indexes)`;
    setNewSnapshotName(defaultName);
    setShowNamedSnapshotModal(true);
  };

  const handleCreateNamedSnapshot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length,
      0
    );
    const finalName = newSnapshotName.trim() || `Checkpoint #${snapshots.length + 1}`;
    const newSnapshot: SchemaSnapshot = {
      id: `checkpoint-${Date.now()}`,
      name: finalName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      flags: { ...flags },
      customIndexes: [...createdCustomIndexes],
      createdCompositeIndexes: [...createdCompositeIndexes],
      removedIndexes: [...removedIndexes],
      lockedIndexes: [...lockedIndexes],
      importedCustomIndices: [...importedCustomIndices],
      activeSchemaPrototypeName: finalName,
      totalIndexesCount: activeCount
    };

    setSnapshots((prev) => [...prev, newSnapshot]);
    setSelectedCheckpointId(newSnapshot.id);
    setActiveSchemaPrototypeName(finalName);
    setShowNamedSnapshotModal(false);
    setImportSuccessNotice(`Created checkpoint: "${finalName}" with current index configuration (${activeCount} indexes)`);
    setTimeout(() => {
      setImportSuccessNotice(null);
    }, 5000);
  };

  const handleRestoreSnapshot = (snap: SchemaSnapshot) => {
    handleSelectCheckpoint(snap.id);
    setShowSnapshotsModal(false);
  };

  const handleReindexIndex = (indexName: string, isAutoHeal = false) => {
    if (!reindexedIndexes.includes(indexName)) {
      setReindexedIndexes([...reindexedIndexes, indexName]);
      setImportSuccessNotice(`Successfully executed REINDEX CONCURRENTLY on "${indexName}". Fragmentation reduced to 3% and index health score restored!`);
      setTimeout(() => setImportSuccessNotice(null), 4000);

      // Dispatch Optimization Lifecycle Event
      const ev = new CustomEvent('optimization-lifecycle-event', {
        detail: {
          action: 'HEAL',
          actionLabel: isAutoHeal ? 'Auto-Healing Concurrent Reindex' : 'Manual Index Maintenance Reindex',
          triggerSource: 'Auto-Healing',
          targetIndex: indexName,
          targetTable: 'transactions',
          columns: ['transaction_id'],
          rationale: isAutoHeal
            ? `Auto-Healing detected index "${indexName}" dropped below 50% health threshold. Automatically reindexed concurrently without table locks.`
            : `Maintenance reindex executed on "${indexName}". B-Tree pages rebalanced and bloat cleared.`,
          executedDdl: `REINDEX INDEX CONCURRENTLY ${indexName};`,
          executionDurationMs: +(14 + Math.random() * 10).toFixed(1),
          healthDelta: { before: 42, after: 98, gain: 56 },
          latencyImpact: { beforeMs: '145.0 ms', afterMs: '2.8 ms', speedup: '98.1% faster' },
          writeOverheadDelta: 'Zero lock contention (Concurrent mode)',
          status: 'COMPLETED'
        }
      });
      window.dispatchEvent(ev);
    }
  };

  const handleToggleSimulateFailure = (indexName: string) => {
    setSimulatedFailedIndexes((prev) => {
      const next = prev.includes(indexName) ? prev.filter((n) => n !== indexName) : [...prev, indexName];
      const isFailed = next.includes(indexName);
      setImportSuccessNotice(
        isFailed
          ? `[Simulated Index Failure] Index "${indexName}" temporarily offline. Queries fall back to full table sequential scans (Latency: +700%, Cost: +900%).`
          : `[Index Recovered] Index "${indexName}" back online. Query execution plans restored.`
      );
      setTimeout(() => setImportSuccessNotice(null), 5000);
      return next;
    });
  };

  const handleRebuildIndex = (indexName: string) => {
    if (rebuildingIndexes.includes(indexName)) return;
    setRebuildingIndexes((prev) => [...prev, indexName]);
    setImportSuccessNotice(`[Maintenance Started] Rebuilding index "${indexName}" (performing VACUUM & REINDEX)...`);

    setTimeout(() => {
      setRebuildingIndexes((prev) => prev.filter((n) => n !== indexName));
      setReindexedIndexes((prev) => (prev.includes(indexName) ? prev : [...prev, indexName]));
      setImportSuccessNotice(`✓ Successfully completed maintenance rebuild on index "${indexName}". B-Tree pages defragmented and statistics updated.`);
      setTimeout(() => setImportSuccessNotice(null), 5000);
    }, 1500);
  };

  // Auto-Healing Effect: automatically re-index indexes with health < 50% when enabled
  useEffect(() => {
    if (!enableAutoHealing) return;
    tables.forEach((tbl) => {
      tbl.indexes.forEach((idx) => {
        const isRemoved = removedIndexes.includes(idx.name);
        if (isRemoved || !idx.active) return;
        const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
        const isReindexed = reindexedIndexes.includes(idx.name);
        if (health.score < 50 && !isReindexed) {
          handleReindexIndex(idx.name);
          setImportSuccessNotice(`[Auto-Healing Triggered] Index "${idx.name}" dropped to ${health.score}% health. Automatically executed REINDEX CONCURRENTLY!`);
          setTimeout(() => setImportSuccessNotice(null), 5000);
        }
      });
    });
  }, [enableAutoHealing, tables, removedIndexes, reindexedIndexes]);

  const handleToggleProtectSnapshot = (snapshotId: string) => {
    setSnapshots((prev) =>
      prev.map((s) => {
        if (s.id === snapshotId) {
          const nextProtected = !s.isProtected;
          setImportSuccessNotice(
            nextProtected
              ? `Snapshot "${s.name}" marked as Protected. Protected from automated overwrite and cleanup.`
              : `Snapshot "${s.name}" un-protected.`
          );
          setTimeout(() => setImportSuccessNotice(null), 4000);
          return { ...s, isProtected: nextProtected };
        }
        return s;
      })
    );
  };

  const getIndexImpactSummary = (indexName: string) => {
    if (indexName.includes('PRIMARY KEY')) {
      return { topQuery: 'Q1: ID Lookup', reduction: 'O(n) → O(1) Constant Seek' };
    } else if (indexName.includes('status_cat')) {
      return { topQuery: 'Q2: Status & Category Filter', reduction: 'O(n) → O(log n) Composite B-Tree' };
    } else if (indexName.includes('date')) {
      return { topQuery: 'Q3: Date Range Scan', reduction: 'O(n) → O(log n) Ordered B-Tree' };
    } else if (indexName.includes('email')) {
      return { topQuery: 'Q4: Customer Email Search', reduction: 'O(n) → O(log n) Leaf Node Seek' };
    } else if (indexName.includes('amount')) {
      return { topQuery: 'Q5: Amount Threshold Filter', reduction: 'O(n) → O(log n) Range Index Scan' };
    } else if (indexName.includes('line_items') || indexName.includes('tx')) {
      return { topQuery: 'Q6: Relational Line Items Join', reduction: 'O(n) → O(1) Indexed Hash Join' };
    }
    return { topQuery: 'Top Queries #1-#5', reduction: 'O(n) → O(log n) Read Optimization' };
  };

  const getOptimizationPotential = (idxName: string) => {
    const lower = idxName.toLowerCase();
    if (lower.includes('primary') || lower.includes('clustered')) return '99.9% Complexity Reduction';
    if (lower.includes('composite') || lower.includes('status') || lower.includes('category')) return '99.7% Complexity Reduction';
    if (lower.includes('email') || lower.includes('customer')) return '99.2% Complexity Reduction';
    if (lower.includes('amount') || lower.includes('price')) return '98.8% Complexity Reduction';
    if (lower.includes('date') || lower.includes('time')) return '98.5% Complexity Reduction';
    return '97.5% Complexity Reduction';
  };

  const getIndexHealthScore = (idxName: string, active: boolean, tableName: string) => {
    const isRemoved = removedIndexes.includes(idxName);
    const redundant = isIndexRedundant(idxName, []);

    // 1. Frequency of use score (35% weight)
    let frequencyScore = 0;
    let frequencyMetric = '0 hits';
    if (isRemoved) {
      frequencyScore = 0;
      frequencyMetric = 'Pruned from DB (0 hits)';
    } else if (idxName.includes('PRIMARY KEY')) {
      frequencyScore = 98;
      frequencyMetric = '22,000 queries/hr (Very High)';
    } else if (idxName.includes('orders_status_cat')) {
      frequencyScore = active ? 96 : 14;
      frequencyMetric = active ? '18,400 queries/hr (High)' : '0 hits (Unindexed fallback)';
    } else if (idxName.includes('line_items_tx')) {
      frequencyScore = active ? 95 : 12;
      frequencyMetric = active ? '15,000 queries/hr (High)' : '0 hits (N+1 fallback)';
    } else if (idxName.includes('email_status')) {
      frequencyScore = active ? 94 : 15;
      frequencyMetric = active ? '14,250 queries/hr (High)' : '0 hits (Missing)';
    } else if (idxName.includes('category_amount')) {
      frequencyScore = active ? 92 : 15;
      frequencyMetric = active ? '11,100 queries/hr (High)' : '0 hits (Missing)';
    } else if (idxName.includes('customers_email')) {
      frequencyScore = 88;
      frequencyMetric = '8,400 queries/hr (Moderate)';
    } else if (idxName.includes('email_missing') || idxName.includes('customer_email')) {
      if (!active) {
        frequencyScore = 15;
        frequencyMetric = '0 hits (Inactive)';
      } else if (redundant) {
        frequencyScore = 38;
        frequencyMetric = 'Bypassed by composite index';
      } else {
        frequencyScore = 82;
        frequencyMetric = '8,000 queries/hr (Moderate)';
      }
    } else if (idxName.includes('amount_missing') || idxName.includes('amount')) {
      if (!active) {
        frequencyScore = 15;
        frequencyMetric = '0 hits (Inactive)';
      } else if (redundant) {
        frequencyScore = 35;
        frequencyMetric = 'Bypassed by composite index';
      } else {
        frequencyScore = 78;
        frequencyMetric = '6,400 queries/hr (Moderate)';
      }
    } else if (idxName === 'idx_transactions_date') {
      frequencyScore = 4;
      frequencyMetric = '0 hits in last 100 queries';
    } else {
      frequencyScore = active ? 75 : 15;
      frequencyMetric = active ? 'Active query traffic' : 'Inactive';
    }

    // 2. Read-Write ratio score (35% weight)
    let readWriteScore = 0;
    let readWriteMetric = 'N/A';
    if (isRemoved) {
      readWriteScore = 92;
      readWriteMetric = '+14% Write Latency Saved';
    } else if (idxName.includes('PRIMARY KEY')) {
      readWriteScore = 97;
      readWriteMetric = '96:4 Read/Write (Zero Overhead)';
    } else if (idxName.includes('orders_status_cat') || idxName.includes('line_items_tx')) {
      readWriteScore = active ? 94 : 20;
      readWriteMetric = active ? '92:8 Read/Write (High Benefit)' : '100% Write Penalty';
    } else if (idxName.includes('email_status') || idxName.includes('category_amount') || idxName.includes('tx_price') || idxName.includes('tier_created')) {
      readWriteScore = active ? 92 : 20;
      readWriteMetric = active ? '90:10 Read/Write (Efficient)' : '100% Write Penalty';
    } else if (idxName.includes('customers_email')) {
      readWriteScore = 90;
      readWriteMetric = '88:12 Read/Write';
    } else if (idxName.includes('email_missing') || idxName.includes('amount_missing')) {
      if (!active) {
        readWriteScore = 20;
        readWriteMetric = 'Unindexed sequential penalty';
      } else if (redundant) {
        readWriteScore = 32;
        readWriteMetric = '30:70 R/W (Redundant Leaf Writes)';
      } else {
        readWriteScore = 74;
        readWriteMetric = '72:28 Read/Write (Single Column)';
      }
    } else if (idxName === 'idx_transactions_date') {
      readWriteScore = 8;
      readWriteMetric = '0:100 R/W (+14% Write Amplification)';
    } else {
      readWriteScore = active ? 70 : 20;
      readWriteMetric = active ? '70:30 Read/Write' : 'Unindexed';
    }

    // 3. Scan efficiency score (30% weight)
    let scanEfficiencyScore = 0;
    let scanEfficiencyMetric = 'O(n) Seq Scan';
    if (isRemoved) {
      scanEfficiencyScore = 85;
      scanEfficiencyMetric = 'Buffer cache reclaimed';
    } else if (idxName.includes('PRIMARY KEY')) {
      scanEfficiencyScore = 99;
      scanEfficiencyMetric = 'O(1) Clustered Point Seek';
    } else if (idxName.includes('orders_status_cat') || idxName.includes('email_status') || idxName.includes('category_amount') || idxName.includes('tx_price') || idxName.includes('tier_created')) {
      scanEfficiencyScore = active ? 97 : 14;
      scanEfficiencyMetric = active ? 'O(log n) Composite Range Seek' : 'O(n) Table Scan Fallback';
    } else if (idxName.includes('line_items_tx')) {
      scanEfficiencyScore = active ? 98 : 12;
      scanEfficiencyMetric = active ? 'O(1) Batched Hash Join Seek' : 'O(n) N+1 Subquery Storm';
    } else if (idxName.includes('customers_email')) {
      scanEfficiencyScore = 94;
      scanEfficiencyMetric = 'O(log n) Unique B-Tree Seek';
    } else if (idxName.includes('email_missing') || idxName.includes('amount_missing')) {
      if (!active) {
        scanEfficiencyScore = 15;
        scanEfficiencyMetric = 'O(n) Sequential Scan Fallback';
      } else if (redundant) {
        scanEfficiencyScore = 48;
        scanEfficiencyMetric = 'Partial Seek (Shadowed by Composite)';
      } else {
        scanEfficiencyScore = 82;
        scanEfficiencyMetric = 'O(log n) Single-Column Seek';
      }
    } else if (idxName === 'idx_transactions_date') {
      scanEfficiencyScore = 10;
      scanEfficiencyMetric = 'Ignored by Planner (Low Selectivity)';
    } else {
      scanEfficiencyScore = active ? 80 : 15;
      scanEfficiencyMetric = active ? 'O(log n) B-Tree Seek' : 'O(n) Seq Scan Fallback';
    }

    // Calculated overall Index Health Score (0-100)
    const score = Math.max(0, Math.min(100, Math.round(
      0.35 * frequencyScore + 0.35 * readWriteScore + 0.30 * scanEfficiencyScore
    )));

    let rating: 'Optimal' | 'Moderate' | 'Critical' = 'Optimal';
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let dotClass = 'bg-emerald-500';
    let textClass = 'text-emerald-700';

    if (score >= 80) {
      rating = 'Optimal';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      dotClass = 'bg-emerald-500';
      textClass = 'text-emerald-700';
    } else if (score >= 50) {
      rating = 'Moderate';
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      dotClass = 'bg-amber-500';
      textClass = 'text-amber-700';
    } else {
      rating = 'Critical';
      badgeClass = 'bg-rose-100 text-rose-900 border-rose-300';
      dotClass = 'bg-rose-500';
      textClass = 'text-rose-700';
    }

    let explanation = '';
    if (score >= 80) {
      explanation = 'High query frequency, strong read-to-write ratio, and optimal B-Tree seek efficiency.';
    } else if (score >= 50) {
      explanation = 'Moderate utilization or secondary lookup overhead; consider consolidation or monitoring.';
    } else {
      explanation = 'Low query frequency or high write amplification overhead; flagged as unutilized or bottleneck.';
    }

    return {
      score,
      rating,
      frequencyScore,
      frequencyMetric,
      readWriteScore,
      readWriteMetric,
      scanEfficiencyScore,
      scanEfficiencyMetric,
      badgeClass,
      dotClass,
      textClass,
      explanation
    };
  };

  // Calculates inactivity duration (days), query hit metrics, and flags low usage indexes
  const getIndexInactivityStats = (
    idxName: string,
    active: boolean,
    tableName: string
  ) => {
    let daysInactive = 0;
    let queryHits = 500;
    let readWriteRatio = 6.4;
    let lastScanLabel = 'Active in past 24h';
    let inactivityReason = 'Actively scanned by production queries within the last 24 hours.';

    if (idxName === 'idx_transactions_date') {
      daysInactive = 14;
      queryHits = 0;
      readWriteRatio = 0.2;
      lastScanLabel = '14 days ago';
      inactivityReason = 'No query predicates hit created_at for 14 days. Queries favor sequential scans or composite indexes.';
    } else if (idxName === 'idx_orders_cat_status') {
      daysInactive = 19;
      queryHits = 0;
      readWriteRatio = 0.1;
      lastScanLabel = '19 days ago';
      inactivityReason = 'Inverted covering index unused for 19 days. Query planner prefers canonical idx_orders_status_cat.';
    } else if (idxName.includes('amount_missing') || (idxName.includes('amount') && !idxName.includes('category_amount'))) {
      daysInactive = 12;
      queryHits = 0;
      readWriteRatio = 0.4;
      lastScanLabel = '12 days ago';
      inactivityReason = 'Standalone amount filter unutilized for 12 days; 0 scan hits recorded in audit window.';
    } else if (idxName.includes('email_missing') || (idxName.includes('customer_email') && !idxName.includes('email_status'))) {
      daysInactive = 9;
      queryHits = 0;
      readWriteRatio = 0.5;
      lastScanLabel = '9 days ago';
      inactivityReason = 'Shadowed by composite (customer_email, status); 0 hits over the last 9 days.';
    } else if (!active) {
      if (idxName.includes('orders_status_cat')) {
        daysInactive = 8;
        queryHits = 0;
        readWriteRatio = 0.0;
        lastScanLabel = '8 days ago';
        inactivityReason = 'Optimization flag disabled for 8 days. Queries degraded to sequential scans.';
      } else if (idxName.includes('line_items_tx')) {
        daysInactive = 11;
        queryHits = 0;
        readWriteRatio = 0.0;
        lastScanLabel = '11 days ago';
        inactivityReason = 'Batch eager loading flag disabled for 11 days. Causing N+1 nested loop scans.';
      } else {
        daysInactive = 10;
        queryHits = 0;
        readWriteRatio = 0.3;
        lastScanLabel = '10 days ago';
        inactivityReason = 'Disabled index with 0 queries recorded over the past 10 days.';
      }
    } else if (idxName.includes('PRIMARY KEY')) {
      daysInactive = 0;
      queryHits = 22000;
      readWriteRatio = 24.5;
      lastScanLabel = 'Today (Continuous)';
      inactivityReason = 'Clustered primary key actively queried in every lookup.';
    } else if (idxName.includes('email_status') || idxName.includes('category_amount') || idxName.includes('tx_price') || idxName.includes('tier_created')) {
      daysInactive = 0;
      queryHits = 14250;
      readWriteRatio = 18.0;
      lastScanLabel = 'Today';
      inactivityReason = 'Composite index handling high-throughput queries.';
    } else if (idxName.includes('customers_email')) {
      daysInactive = 1;
      queryHits = 8400;
      readWriteRatio = 12.0;
      lastScanLabel = 'Yesterday';
      inactivityReason = 'Customer unique email lookup actively accessed.';
    } else {
      const charCode = (idxName.charCodeAt(0) + idxName.length * 7) % 15;
      daysInactive = charCode > 9 ? charCode : 2;
      queryHits = daysInactive > 7 ? 0 : 450;
      readWriteRatio = daysInactive > 7 ? 0.9 : 5.8;
      lastScanLabel = daysInactive > 7 ? `${daysInactive} days ago` : 'Past 48h';
      inactivityReason = daysInactive > 7 ? `No scans in ${daysInactive} days.` : 'Regular query traffic.';
    }

    const isInactiveOver7Days = daysInactive > 7;
    const isFlaggedLowUsage = lowUsageConfig.enabled && (
      daysInactive > 7 || 
      daysInactive >= lowUsageConfig.daysInactive || 
      queryHits < lowUsageConfig.minQueryHits || 
      readWriteRatio < lowUsageConfig.minReadWriteRatio
    );

    return {
      daysInactive,
      queryHits,
      readWriteRatio,
      lastScanLabel,
      inactivityReason,
      isInactiveOver7Days,
      isFlaggedLowUsage
    };
  };

  const getIndexReasoningSummary = (idxName: string, tableName: string) => {
    const hash = idxName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const logHitCount = 4200 + (hash % 15000);
    const avgLatencyMs = (0.28 + ((hash % 15) * 0.08)).toFixed(2);
    const seqScanAvoidedCount = 1840 + (hash % 5000);
    const queryLogSnippet = `SELECT * FROM ${tableName} WHERE ${idxName.replace('idx_', '').replace(/_/g, ' ')} = $1 ORDER BY timestamp DESC LIMIT 50;`;
    
    return {
      logHitCount,
      avgLatencyMs,
      seqScanAvoidedCount,
      queryLogSnippet,
      reasoning: `Flagged as high-impact based on analysis of ${logHitCount.toLocaleString()} recent query log executions. This index eliminated sequential scan fallbacks on table "${tableName}" (${seqScanAvoidedCount.toLocaleString()} full-table scans avoided in the last 24h), reducing P99 execution latency from ~680ms down to ${avgLatencyMs}ms (-99.2% gain).`
    };
  };

  // Calculates an 'Index Impact Score' using a weighted average of query performance improvement and write-latency penalty
  const calculateIndexImpactScore = (
    idxName: string,
    active: boolean,
    tableName: string,
    isRemoved: boolean,
    isLocked: boolean
  ) => {
    if (isRemoved) {
      return {
        score: 12,
        queryImprovement: 0,
        writePenalty: 0,
        readBenefitMultiplier: '0x (Pruned)',
        overallValueRating: 'Negative / Prune' as const,
        badgeClass: 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through',
        ratingColor: 'text-zinc-500'
      };
    }

    const lower = idxName.toLowerCase();
    let queryImprovement = 75.0;
    let writePenalty = 4.0;
    let readBenefitMultiplier = '45x Faster';

    if (lower.includes('primary') || lower.includes('pk_') || idxName.includes('PRIMARY KEY')) {
      queryImprovement = 99.9;
      writePenalty = 1.8;
      readBenefitMultiplier = '350x Faster (O(1))';
    } else if (lower.includes('orders_status_cat')) {
      queryImprovement = active ? 99.6 : 14.0;
      writePenalty = 4.2;
      readBenefitMultiplier = active ? '280x Faster' : '1x (Fallback)';
    } else if (lower.includes('line_items_tx')) {
      queryImprovement = active ? 99.6 : 12.0;
      writePenalty = 3.8;
      readBenefitMultiplier = active ? '253x Faster' : '1x (N+1 Storm)';
    } else if (lower.includes('email_status')) {
      queryImprovement = active ? 99.5 : 15.0;
      writePenalty = 4.5;
      readBenefitMultiplier = active ? '240x Faster' : '1x (Missing)';
    } else if (lower.includes('category_amount')) {
      queryImprovement = active ? 99.1 : 15.0;
      writePenalty = 4.8;
      readBenefitMultiplier = active ? '210x Faster' : '1x (Missing)';
    } else if (lower.includes('tx_price') || lower.includes('tier_created')) {
      queryImprovement = active ? 98.4 : 10.0;
      writePenalty = 4.9;
      readBenefitMultiplier = active ? '180x Faster' : '1x (Unindexed)';
    } else if (lower.includes('customers_email')) {
      queryImprovement = 96.5;
      writePenalty = 2.8;
      readBenefitMultiplier = '95x Faster';
    } else if (idxName === 'idx_transactions_date') {
      queryImprovement = 0.0;
      writePenalty = 14.0;
      readBenefitMultiplier = '1.0x (0 Hits, High Overhead)';
    } else if (lower.includes('email_missing') || lower.includes('amount_missing')) {
      queryImprovement = active ? 86.0 : 15.0;
      writePenalty = 6.2;
      readBenefitMultiplier = active ? '65x Faster' : '1x';
    } else {
      queryImprovement = active ? 88.0 : 18.0;
      writePenalty = 4.5;
      readBenefitMultiplier = active ? '75x Faster' : '1x';
    }

    // Weighted average: 75% query performance improvement benefit, 25% write latency efficiency (100 - writePenalty * 4)
    const writeEfficiency = Math.max(0, 100 - writePenalty * 4);
    const score = Math.max(0, Math.min(100, Math.round(queryImprovement * 0.75 + writeEfficiency * 0.25)));

    let overallValueRating: 'Exceptional' | 'High Value' | 'Moderate' | 'Marginal' | 'Negative / Prune' = 'Moderate';
    let badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-300';
    let ratingColor = 'text-indigo-700';

    if (score >= 90) {
      overallValueRating = 'Exceptional';
      badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      ratingColor = 'text-emerald-700';
    } else if (score >= 75) {
      overallValueRating = 'High Value';
      badgeClass = 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
      ratingColor = 'text-teal-700';
    } else if (score >= 50) {
      overallValueRating = 'Moderate';
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      ratingColor = 'text-amber-700';
    } else if (score >= 30) {
      overallValueRating = 'Marginal';
      badgeClass = 'bg-orange-100 text-orange-900 border-orange-300';
      ratingColor = 'text-orange-700';
    } else {
      overallValueRating = 'Negative / Prune';
      badgeClass = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      ratingColor = 'text-rose-700';
    }

    return {
      score,
      queryImprovement,
      writePenalty,
      readBenefitMultiplier,
      overallValueRating,
      badgeClass,
      ratingColor
    };
  };

  // Calculates an index's total query latency contribution, workload impact, and heatmap shading
  const calculateIndexLatencyContribution = (
    idxName: string,
    active: boolean,
    tableName: string,
    isRemoved: boolean
  ) => {
    const lower = idxName.toLowerCase();
    let queryLatencyContributionMs = 120.0;
    let baselineQueryName = 'Standard Table Scan';
    let queryFrequencyPerHour = '4,500 queries/hr';
    let executionShare = '8.5%';

    if (lower.includes('primary') || lower.includes('pk_') || idxName.includes('PRIMARY KEY')) {
      queryLatencyContributionMs = 0.3;
      baselineQueryName = 'Clustered PK Lookup (Point Seek)';
      queryFrequencyPerHour = '45,000 queries/hr';
      executionShare = '0.1%';
    } else if (lower.includes('line_items_tx')) {
      queryLatencyContributionMs = 840.0;
      baselineQueryName = 'Relational Order Line-Items Child Join Storm';
      queryFrequencyPerHour = '15,000 queries/hr';
      executionShare = '37.6%';
    } else if (lower.includes('category_amount')) {
      queryLatencyContributionMs = 482.0;
      baselineQueryName = 'Multi-Column Category & Amount Range Aggregation';
      queryFrequencyPerHour = '8,900 queries/hr';
      executionShare = '21.6%';
    } else if (lower.includes('email_status')) {
      queryLatencyContributionMs = 395.0;
      baselineQueryName = 'Customer Order Verification & Status Lookup';
      queryFrequencyPerHour = '5,120 queries/hr';
      executionShare = '17.7%';
    } else if (lower.includes('orders_status_cat')) {
      queryLatencyContributionMs = 310.0;
      baselineQueryName = 'Active Order Dashboard & Pipeline Status Filtering';
      queryFrequencyPerHour = '12,400 queries/hr';
      executionShare = '13.9%';
    } else if (lower.includes('amount_missing')) {
      queryLatencyContributionMs = 482.0;
      baselineQueryName = 'Sequential Amount Range Scan';
      queryFrequencyPerHour = '6,200 queries/hr';
      executionShare = '15.2%';
    } else if (lower.includes('email_missing')) {
      queryLatencyContributionMs = 395.0;
      baselineQueryName = 'Unindexed Customer Email Filter';
      queryFrequencyPerHour = '4,800 queries/hr';
      executionShare = '12.4%';
    } else if (lower.includes('tier_created')) {
      queryLatencyContributionMs = 165.0;
      baselineQueryName = 'Customer Tier & Account Date Range Seek';
      queryFrequencyPerHour = '3,200 queries/hr';
      executionShare = '7.4%';
    } else if (idxName === 'idx_transactions_date') {
      queryLatencyContributionMs = 140.0;
      baselineQueryName = 'WAL Write-Lock Buffer Stall (0 Query Hits, High Overhead)';
      queryFrequencyPerHour = '8,200 write tx/hr';
      executionShare = '6.3%';
    } else if (lower.includes('customers_email')) {
      queryLatencyContributionMs = 68.2;
      baselineQueryName = 'Customer Email Unique Point Seek';
      queryFrequencyPerHour = '2,800 queries/hr';
      executionShare = '3.1%';
    } else if (lower.includes('tx_price')) {
      queryLatencyContributionMs = 280.0;
      baselineQueryName = 'Line Item Pricing Aggregate Filter';
      queryFrequencyPerHour = '3,600 queries/hr';
      executionShare = '12.5%';
    } else {
      queryLatencyContributionMs = 110.0;
      baselineQueryName = 'Secondary Index Range Seek';
      queryFrequencyPerHour = '2,400 queries/hr';
      executionShare = '4.9%';
    }

    // Heat tiers based on total query latency contribution:
    // Critical: >= 400ms (Heaviest query bottlenecks in the database)
    // High: 250ms - 399ms (Significant latency contribution)
    // Moderate: 100ms - 249ms (Noticeable latency contribution)
    // Optimal / Low: < 100ms (Fast execution)
    let heatTier: 'critical' | 'high' | 'moderate' | 'low' = 'low';
    let rowBgClass = 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500';
    let cardBgClass = 'bg-emerald-50/30 border-emerald-300 ring-1 ring-emerald-200/60 shadow-2xs';
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let textColor = 'text-emerald-700';
    let tierLabel = 'Optimal (<100ms)';
    let heatIntensity = 'Optimal';

    if (queryLatencyContributionMs >= 400) {
      heatTier = 'critical';
      rowBgClass = 'bg-rose-100/80 hover:bg-rose-100 border-l-4 border-l-rose-600 font-medium text-rose-950';
      cardBgClass = 'bg-rose-100/60 border-rose-400 ring-2 ring-rose-400/50 shadow-xs';
      badgeClass = 'bg-rose-200 text-rose-900 border-rose-400 font-bold';
      textColor = 'text-rose-700';
      tierLabel = 'Critical (>400ms)';
      heatIntensity = 'Critical Latency';
    } else if (queryLatencyContributionMs >= 250) {
      heatTier = 'high';
      rowBgClass = 'bg-rose-50/80 hover:bg-rose-100/60 border-l-4 border-l-rose-500 text-rose-900';
      cardBgClass = 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-300/60 shadow-2xs';
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      textColor = 'text-rose-600';
      tierLabel = 'High (250–400ms)';
      heatIntensity = 'High Latency';
    } else if (queryLatencyContributionMs >= 100) {
      heatTier = 'moderate';
      rowBgClass = 'bg-amber-50/80 hover:bg-amber-100/60 border-l-4 border-l-amber-500 text-amber-950';
      cardBgClass = 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/60 shadow-2xs';
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
      textColor = 'text-amber-700';
      tierLabel = 'Moderate (100–250ms)';
      heatIntensity = 'Moderate Latency';
    }

    return {
      queryLatencyContributionMs,
      baselineQueryName,
      queryFrequencyPerHour,
      executionShare,
      heatTier,
      rowBgClass,
      cardBgClass,
      badgeClass,
      textColor,
      tierLabel,
      heatIntensity
    };
  };

  // Calculates an index's read-to-write ratio, usage heatmap classification (Read Heavy [Green] vs Write Heavy [Red]),
  // exact operations metrics, and visual styling classes.
  const calculateIndexUsageHeatmap = (
    idxName: string,
    active: boolean,
    tableName: string,
    isRemoved: boolean
  ) => {
    const lower = idxName.toLowerCase();
    
    // Hash seed for consistent deterministic simulation per index
    const seedVal = Math.abs(idxName.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 13), 19)) % 100;
    
    let reads = 18000 + (seedVal * 450);
    let writes = 2500 + (seedVal * 80);

    // Contextual realistic overrides
    if (lower.includes('primary') || lower.includes('pk_') || idxName.includes('PRIMARY KEY')) {
      reads = 142000 + (seedVal * 500);
      writes = 2800 + (seedVal * 20);
    } else if (lower.includes('covering') || lower.includes('orders_status_items_total') || lower.includes('query_pack')) {
      reads = 118000 + (seedVal * 600);
      writes = 1900 + (seedVal * 15);
    } else if (lower.includes('category_amount') || lower.includes('email_status') || lower.includes('orders_status_cat')) {
      reads = 86000 + (seedVal * 400);
      writes = 2100 + (seedVal * 30);
    } else if (lower.includes('line_items_tx')) {
      reads = 64000 + (seedVal * 350);
      writes = 2600 + (seedVal * 40);
    } else if (lower.includes('amount_missing') || lower.includes('email_missing')) {
      reads = 38000 + (seedVal * 200);
      writes = 1800 + (seedVal * 25);
    } else if (lower.includes('tier_created') || lower.includes('customers_email')) {
      reads = 29000 + (seedVal * 180);
      writes = 3400 + (seedVal * 50);
    } else if (
      idxName === 'idx_transactions_date' ||
      lower.includes('legacy') ||
      lower.includes('staging') ||
      lower.includes('temp') ||
      lower.includes('backup')
    ) {
      // Zombie / Dead unutilized index with massive write penalty and near-zero reads
      reads = 150 + (seedVal * 2);
      writes = 14800 + (seedVal * 120);
    }

    if (isRemoved || !active) {
      reads = 0;
      writes = 0;
    }

    const ratio = writes > 0 ? Number((reads / writes).toFixed(1)) : (reads > 0 ? 99.9 : 0);
    const readPercentage = Math.round((reads / Math.max(1, reads + writes)) * 100);
    const writePercentage = 100 - readPercentage;

    // Classification:
    // Read Heavy (Green): ratio >= 5.0 (High read throughput acceleration vs small write overhead)
    // Read Leaning (Teal): 3.0 <= ratio < 5.0
    // Balanced (Amber/Yellow): 1.5 <= ratio < 3.0
    // Write Heavy (Red): ratio < 1.5 (High write overhead/amplification with low read ROI)
    let usageTier: 'read-heavy' | 'read-leaning' | 'balanced' | 'write-heavy' = 'balanced';
    let label = 'Balanced';
    let badgeLabel = `Balanced (${ratio}x)`;
    let badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
    let rowBgClass = 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-500';
    let cardBgClass = 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-200/60 shadow-2xs';
    let textColor = 'text-amber-700';
    let verdict = 'Moderate read utilization balances table write maintenance costs.';

    if (ratio >= 5.0) {
      usageTier = 'read-heavy';
      label = 'Read Heavy';
      badgeLabel = `Read Heavy (${ratio}x)`;
      badgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold';
      rowBgClass = 'bg-emerald-50/70 hover:bg-emerald-100/60 border-l-4 border-l-emerald-600 font-medium text-emerald-950';
      cardBgClass = 'bg-emerald-50/40 border-emerald-400 ring-1 ring-emerald-300/80 shadow-2xs';
      textColor = 'text-emerald-700 font-bold';
      verdict = 'High Read Heavy ROI: B-Tree index satisfies frequent read lookups with minimal write penalty.';
    } else if (ratio >= 3.0) {
      usageTier = 'read-leaning';
      label = 'Read Leaning';
      badgeLabel = `Read Leaning (${ratio}x)`;
      badgeClass = 'bg-teal-100 text-teal-900 border-teal-300 font-medium';
      rowBgClass = 'bg-teal-50/40 hover:bg-teal-100/50 border-l-4 border-l-teal-500';
      cardBgClass = 'bg-teal-50/30 border-teal-300 ring-1 ring-teal-200 shadow-2xs';
      textColor = 'text-teal-700 font-semibold';
      verdict = 'Optimal read acceleration outweighs index maintenance overhead.';
    } else if (ratio < 1.5) {
      usageTier = 'write-heavy';
      label = 'Write Heavy';
      badgeLabel = `Write Heavy (${ratio}x)`;
      badgeClass = 'bg-rose-100 text-rose-950 border-rose-400 font-bold';
      rowBgClass = 'bg-rose-100/80 hover:bg-rose-100 border-l-4 border-l-rose-600 font-medium text-rose-950';
      cardBgClass = 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-300/70 shadow-xs';
      textColor = 'text-rose-700 font-bold';
      verdict = 'Severe Write Heavy Overhead: Frequent table writes suffer B-Tree tree-rebalancing stalls for rarely queried data.';
    }

    return {
      reads,
      writes,
      ratio,
      readPercentage,
      writePercentage,
      usageTier,
      label,
      badgeLabel,
      badgeClass,
      rowBgClass,
      cardBgClass,
      textColor,
      verdict
    };
  };

  // Bulk Optimization Calculation Engine:
  // Evaluates every listed index across all tables, calculates the optimal state vs current state,
  // and projects the cumulative schema health, query throughput, and write overhead impacts.
  const bulkOptimizationPlan = useMemo(() => {
    const allListed = tables.flatMap((tbl) =>
      tbl.indexes.map((idx) => {
        const isRemoved = removedIndexes.includes(idx.name);
        const redundant = isIndexRedundant(idx.name, idx.columns);
        const currentHealth = getIndexHealthScore(idx.name, idx.active, tbl.name);

        let isOptimal = false;
        let recommendedAction: 'ACTIVATE' | 'PRUNE' | 'RESTORE' | 'KEEP_OPTIMAL' = 'KEEP_OPTIMAL';
        let actionTitle = 'Index in Optimal State';
        let reason = 'Operating at peak seek efficiency with balanced read/write metrics.';
        let impactDescription = 'Zero action needed; queries execute with optimal O(1) or O(log n) efficiency.';
        let speedupGain = 'Optimal';
        let projectedHealthScore = currentHealth.score;

        const isLocked = lockedIndexes.includes(idx.name);

        if (isLocked) {
          isOptimal = true;
          recommendedAction = 'KEEP_OPTIMAL';
          actionTitle = 'Index Locked (Protected)';
          reason = 'Protected by user lock from automated Auto-Optimize and Index Cleanup modifications.';
          impactDescription = 'Preserved in current user-defined configuration.';
          speedupGain = 'Locked (Protected)';
          projectedHealthScore = currentHealth.score;
        } else if (idx.name.includes('PRIMARY KEY')) {
          if (isRemoved) {
            isOptimal = false;
            recommendedAction = 'RESTORE';
            actionTitle = 'Restore Clustered Index';
            reason = 'Primary key was pruned; restoring it provides instant O(1) row access.';
            impactDescription = 'Restores primary record clustering and avoids full heap scan lookups.';
            speedupGain = 'O(n) → O(1) Seek';
            projectedHealthScore = 98;
          } else {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Primary Clustered Key';
            reason = 'Clustered B-Tree index is active and serving 22,000 queries/hr.';
            impactDescription = 'O(1) Clustered Point Seek.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          }
        } else if (idx.name === 'idx_transactions_date') {
          // Unutilized index with 0 hits in past query batches and write amplification
          if (isRemoved) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Pruned Status';
            reason = 'Unutilized index correctly removed from buffer cache and disk writes.';
            impactDescription = '+14% write latency saved; eliminates buffer cache pollution.';
            speedupGain = 'Optimal (+14% Write Saved)';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'PRUNE';
            actionTitle = 'Prune Unutilized Index';
            reason = 'Zero hits recorded across past 100 query batches; causing 0:100 R/W write amplification.';
            impactDescription = 'Reclaims buffer cache pages and eliminates write overhead on every order insert.';
            speedupGain = '+14% Write Latency Saved';
            projectedHealthScore = 90;
          }
        } else if (idx.name.includes('orders_status_cat')) {
          const isActive = flags.btreeIndexing && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Active Composite Index';
            reason = 'Active Composite B-Tree servicing 18,400 queries/hr.';
            impactDescription = 'O(log n) Composite Range Seek across status and category.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Activate Composite B-Tree';
            reason = 'Currently inactive; queries on status + category fall back to full table scan.';
            impactDescription = 'Reduces query scan cost from 1,845 to 8.45; eliminates sequential scan.';
            speedupGain = '99.7% Latency Reduction';
            projectedHealthScore = 96;
          }
        } else if (idx.name.includes('line_items_tx')) {
          const isActive = flags.batchEagerLoading;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Foreign Key Index';
            reason = 'Active foreign key B-Tree eliminating child join cascades.';
            impactDescription = 'Converts Nested Loop sequential scans to O(1) Hash Joins.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Foreign Key B-Tree';
            reason = 'Unindexed foreign key triggers 100+ separate roundtrips (N+1 storm).';
            impactDescription = 'Collapses sequential N+1 sub-queries into a single index-accelerated batch.';
            speedupGain = '233x Speedup (420ms → 1.8ms)';
            projectedHealthScore = 97;
          }
        } else if (idx.name.includes('email_status')) {
          const isActive = createdCompositeIndexes.includes('email_status') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain AI Composite Index';
            reason = 'Active composite index covering dual equality filter clause.';
            impactDescription = 'Avoids secondary heap visits for customer status queries.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (email, status)';
            reason = 'Customer order status queries suffer 395ms latency from heap lookups.';
            impactDescription = 'Co-locates customer_email and status in adjacent leaf nodes (395ms → 1.6ms).';
            speedupGain = '99.6% Speedup (246x Faster)';
            projectedHealthScore = 94;
          }
        } else if (idx.name.includes('category_amount')) {
          const isActive = createdCompositeIndexes.includes('category_amount') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Range Aggregation Index';
            reason = 'Active composite index accelerating categorical range aggregations.';
            impactDescription = 'Leaf node range seek with in-index ordering.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Range Aggregation Index';
            reason = 'Consumes 38.4% of total DB read CPU time without index coverage.';
            impactDescription = 'Transforms 482ms grouping scans into 1.9ms index range seeks.';
            speedupGain = '253x Speedup (482ms → 1.9ms)';
            projectedHealthScore = 93;
          }
        } else if (idx.name.includes('line_items_tx_price')) {
          const isActive = createdCompositeIndexes.includes('tx_price') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Child Join Composite Index';
            reason = 'Active covering composite index accelerating line item joins.';
            impactDescription = 'Zero heap page fetches during relational joins.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (transaction_id, unit_price)';
            reason = 'Child item price filter queries trigger expensive table heap reads.';
            impactDescription = 'Transforms Nested Loop to Covering Index Only Scan (280ms → 1.5ms).';
            speedupGain = '185x Speedup';
            projectedHealthScore = 95;
          }
        } else if (idx.name.includes('customers_tier_created')) {
          const isActive = createdCompositeIndexes.includes('tier_created') && !isRemoved;
          if (isActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Retain Tier Ordering Composite Index';
            reason = 'Pre-sorts customer accounts by creation date directly in B-Tree leaves.';
            impactDescription = 'Satisfies ORDER BY created_at DESC with 0 RAM sort buffer.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Composite B-Tree (tier, created_at)';
            reason = 'VIP customer cohort queries require temporary RAM sort buffers.';
            impactDescription = 'Eliminates explicit Sort node with pre-ordered B-Tree streaming (165ms → 1.2ms).';
            speedupGain = '140x Speedup';
            projectedHealthScore = 94;
          }
        } else if (idx.name.includes('email_missing')) {
          const isCompositeCovered = createdCompositeIndexes.includes('email_status');
          const isCustomActive = createdCustomIndexes.includes('customer_email') && !isRemoved;
          if (isCompositeCovered) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Covered by Composite Index';
            reason = 'Prefix column covered by idx_transactions_email_status.';
            impactDescription = 'Optimally covered by multi-column B-Tree.';
            speedupGain = 'Optimal';
            projectedHealthScore = 82;
          } else if (isCustomActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Active Single-Column Index';
            reason = 'Single column index active for customer_email.';
            impactDescription = 'O(log n) Leaf Node Seek.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Email Index / Composite Coverage';
            reason = 'Full table scan on 50,000 rows when filtering customer email.';
            impactDescription = 'Enables direct leaf node lookup.';
            speedupGain = '99.2% Complexity Reduction';
            projectedHealthScore = 82;
          }
        } else if (idx.name.includes('amount_missing')) {
          const isCustomActive = createdCustomIndexes.includes('amount') && !isRemoved;
          if (isCustomActive) {
            isOptimal = true;
            recommendedAction = 'KEEP_OPTIMAL';
            actionTitle = 'Active Single-Column Index';
            reason = 'Index active on amount column.';
            impactDescription = 'O(log n) Range Index Scan.';
            speedupGain = 'Active';
            projectedHealthScore = currentHealth.score;
          } else {
            isOptimal = false;
            recommendedAction = 'ACTIVATE';
            actionTitle = 'Deploy Amount Numeric Range Index';
            reason = 'Unindexed decimal threshold scan checks 50,000 rows row-by-row.';
            impactDescription = 'Allows planner to seek directly to the boundary leaf node.';
            speedupGain = 'O(n) → O(log n) Seek';
            projectedHealthScore = 80;
          }
        } else if (idx.name.includes('customers_email')) {
          isOptimal = true;
          recommendedAction = 'KEEP_OPTIMAL';
          actionTitle = 'Retain Unique B-Tree Index';
          reason = 'Unique constraint index active and serving customer lookups.';
          impactDescription = 'O(log n) Unique B-Tree Seek.';
          speedupGain = 'Active';
          projectedHealthScore = currentHealth.score;
        } else {
          isOptimal = idx.active;
          recommendedAction = idx.active ? 'KEEP_OPTIMAL' : 'ACTIVATE';
          actionTitle = idx.active ? 'Retain Active Index' : 'Activate Index';
          reason = idx.active ? 'Active index.' : 'Inactive index.';
          impactDescription = 'Index seek optimization.';
          speedupGain = 'Optimal';
          projectedHealthScore = idx.active ? currentHealth.score : 80;
        }

        return {
          id: `${tbl.name}-${idx.name}`,
          tableName: tbl.name,
          tableEntity: tbl.entityName,
          indexName: idx.name,
          indexType: idx.type,
          columns: idx.columns,
          currentActive: idx.active,
          isRemoved,
          isRedundant: redundant,
          currentHealthScore: currentHealth.score,
          currentHealthRating: currentHealth.rating,
          currentBadgeClass: currentHealth.badgeClass,
          projectedHealthScore,
          isOptimal,
          recommendedAction,
          actionTitle,
          reason,
          impactDescription,
          speedupGain
        };
      })
    );

    const pendingChanges = allListed.filter((item) => !item.isOptimal);
    const totalCount = allListed.length;
    const optimalCount = allListed.filter((item) => item.isOptimal).length;
    const isFullyOptimized = pendingChanges.length === 0;

    const currentAvgHealth = Math.round(
      allListed.reduce((acc, item) => acc + item.currentHealthScore, 0) / (totalCount || 1)
    );
    const projectedAvgHealth = Math.round(
      allListed.reduce((acc, item) => acc + item.projectedHealthScore, 0) / (totalCount || 1)
    );
    const healthGain = Math.max(0, projectedAvgHealth - currentAvgHealth);

    return {
      allListed,
      pendingChanges,
      totalCount,
      optimalCount,
      isFullyOptimized,
      currentAvgHealth,
      projectedAvgHealth,
      healthGain
    };
  }, [tables, removedIndexes, flags, createdCompositeIndexes, createdCustomIndexes, lockedIndexes]);

  // Aggregated list of all schema indexes ranked by Index Impact Score or user criteria
  const allRankedSchemaIndexes = useMemo(() => {
    const list: Array<{
      table: string;
      entityBadge?: string;
      index: typeof tables[0]['indexes'][0];
      health: ReturnType<typeof getIndexHealthScore>;
      impact: ReturnType<typeof calculateIndexImpactScore>;
      latencyHeat: ReturnType<typeof calculateIndexLatencyContribution>;
      usageHeat: ReturnType<typeof calculateIndexUsageHeatmap>;
      inactivityStats: ReturnType<typeof getIndexInactivityStats>;
      isRemoved: boolean;
      isLocked: boolean;
    }> = [];

    tables
      .filter((tbl) => indexCategoryFilter === 'all' || indexCategoryFilter === 'low-usage' || indexCategoryFilter === tbl.name)
      .forEach((tbl) => {
        const queryLower = indexSearchQuery.trim().toLowerCase();
        tbl.indexes.forEach((idx) => {
          if (queryLower) {
            const matchesName = idx.name.toLowerCase().includes(queryLower);
            const matchesTargetTable =
              tbl.name.toLowerCase().includes(queryLower) ||
              (idx.targetTable && idx.targetTable.toLowerCase().includes(queryLower)) ||
              (tbl.entityName && tbl.entityName.toLowerCase().includes(queryLower)) ||
              (idx.targetEntity && idx.targetEntity.toLowerCase().includes(queryLower));
            const matchesColumns = idx.columns.some((c) => c.toLowerCase().includes(queryLower));
            const matchesType = idx.type.toLowerCase().includes(queryLower);
            if (!matchesName && !matchesTargetTable && !matchesColumns && !matchesType) return;
          }

          const isRemoved = removedIndexes.includes(idx.name);
          const isLocked = lockedIndexes.includes(idx.name);
          const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
          const impact = calculateIndexImpactScore(idx.name, idx.active, tbl.name, isRemoved, isLocked);
          const latencyHeat = calculateIndexLatencyContribution(idx.name, idx.active, tbl.name, isRemoved);
          const usageHeat = calculateIndexUsageHeatmap(idx.name, idx.active, tbl.name, isRemoved);
          const inactivityStats = getIndexInactivityStats(idx.name, idx.active, tbl.name);

          if (indexCategoryFilter === 'low-usage' && !inactivityStats.isInactiveOver7Days) {
            return;
          }

          list.push({
            table: tbl.name,
            entityBadge: tbl.entityBadge,
            index: idx,
            health,
            impact,
            latencyHeat,
            usageHeat,
            inactivityStats,
            isRemoved,
            isLocked
          });
        });
      });

    // Sort according to indexRankSort
    list.sort((a, b) => {
      if (indexRankSort === 'usage') {
        const usageA = a.usageHeat.reads + a.usageHeat.writes;
        const usageB = b.usageHeat.reads + b.usageHeat.writes;
        return usageB - usageA;
      }
      if (indexRankSort === 'size') {
        const sizeA = (a.index.name.length * 2.4) + 12.0;
        const sizeB = (b.index.name.length * 2.4) + 12.0;
        return sizeB - sizeA;
      }
      if (indexRankSort === 'fragmentation') {
        const fragA = 100 - a.health.score;
        const fragB = 100 - b.health.score;
        return fragB - fragA;
      }
      if (indexRankSort === 'write_intensity') {
        const writeA = a.impact.writePenalty * 100;
        const writeB = b.impact.writePenalty * 100;
        return writeB - writeA;
      }
      if (indexRankSort === 'impact_desc') return b.impact.score - a.impact.score;
      if (indexRankSort === 'impact_asc') return a.impact.score - b.impact.score;
      if (indexRankSort === 'latency_desc') return b.latencyHeat.queryLatencyContributionMs - a.latencyHeat.queryLatencyContributionMs;
      if (indexRankSort === 'latency_asc') return a.latencyHeat.queryLatencyContributionMs - b.latencyHeat.queryLatencyContributionMs;
      if (indexRankSort === 'ratio_desc') return b.usageHeat.ratio - a.usageHeat.ratio;
      if (indexRankSort === 'ratio_asc') return a.usageHeat.ratio - b.usageHeat.ratio;
      if (indexRankSort === 'query_desc') return b.impact.queryImprovement - a.impact.queryImprovement;
      if (indexRankSort === 'write_asc') return a.impact.writePenalty - b.impact.writePenalty;
      if (indexRankSort === 'health_desc') return b.health.score - a.health.score;
      if (indexRankSort === 'name') return a.index.name.localeCompare(b.index.name);
      return b.impact.score - a.impact.score;
    });

    return list;
  }, [tables, indexCategoryFilter, indexSearchQuery, removedIndexes, lockedIndexes, flags, createdCompositeIndexes, createdCustomIndexes, indexRankSort, lowUsageConfig]);

  const groupedByTableIndexes = useMemo(() => {
    const map = new Map<string, typeof allRankedSchemaIndexes>();
    for (const item of allRankedSchemaIndexes) {
      if (!map.has(item.table)) {
        map.set(item.table, []);
      }
      map.get(item.table)!.push(item);
    }
    return Array.from(map.entries()).map(([tableName, indexes]) => ({
      tableName,
      indexes,
      avgHealth: Math.round(indexes.reduce((sum, i) => sum + i.health.score, 0) / (indexes.length || 1))
    }));
  }, [allRankedSchemaIndexes]);

  const indexImpactMapItems: IndexImpactMapItem[] = useMemo(() => {
    return allRankedSchemaIndexes.map((item) => ({
      name: item.index.name,
      table: item.table,
      columns: item.index.columns,
      type: item.index.type,
      reads: item.usageHeat.reads,
      writes: item.usageHeat.writes,
      ratio: item.usageHeat.ratio,
      readPercentage: item.usageHeat.readPercentage,
      writePercentage: item.usageHeat.writePercentage,
      queryCostMs: item.latencyHeat.queryLatencyContributionMs,
      impactScore: item.impact.score,
      healthScore: item.health.score,
      isRemoved: item.isRemoved,
      isLocked: item.isLocked,
      active: item.index.active,
      entityBadge: item.entityBadge
    }));
  }, [allRankedSchemaIndexes]);

  // Total count of indexes inactive for more than 7 days
  const lowUsageFlaggedCount = useMemo(() => {
    let count = 0;
    tables.forEach((tbl) => {
      tbl.indexes.forEach((idx) => {
        const stats = getIndexInactivityStats(idx.name, idx.active, tbl.name);
        if (stats.isInactiveOver7Days) count++;
      });
    });
    return count;
  }, [tables, lowUsageConfig]);

  // Single button handler to apply all calculated optimal improvements at once with sequential transition animation
  const handleApplyBulkOptimize = () => {
    setIsApplyingBulkOptimize(true);
    const pendingNames = bulkOptimizationPlan.pendingChanges.map((ch) => ch.indexName);
    let step = 0;
    const interval = setInterval(() => {
      if (step < pendingNames.length) {
        setAnimatingBulkIndexName(pendingNames[step]);
        step++;
      } else {
        clearInterval(interval);
        setAnimatingBulkIndexName(null);

        // 1. Enable primary B-Tree indexing flags (if related indexes are not locked)
        if (!flags.btreeIndexing && !lockedIndexes.includes('idx_orders_status_cat')) {
          onToggleFlag('btreeIndexing');
        }
        if (!flags.batchEagerLoading && !lockedIndexes.includes('idx_line_items_tx')) {
          onToggleFlag('batchEagerLoading');
        }

        // 2. Ensure composite indexes are activated (respecting locked indexes)
        setCreatedCompositeIndexes((prev) => {
          const next = new Set(['email_status', 'category_amount', 'tx_price', 'tier_created']);
          if (lockedIndexes.includes('idx_transactions_email_status') && !prev.includes('email_status')) next.delete('email_status');
          if (lockedIndexes.includes('idx_transactions_category_amount') && !prev.includes('category_amount')) next.delete('category_amount');
          if (lockedIndexes.includes('idx_line_items_tx_price') && !prev.includes('tx_price')) next.delete('tx_price');
          if (lockedIndexes.includes('idx_customers_tier_created') && !prev.includes('tier_created')) next.delete('tier_created');
          return Array.from(next);
        });

        // 3. Ensure custom bottleneck indexes are created (respecting locked indexes)
        setCreatedCustomIndexes((prev) => {
          const additions: string[] = [];
          if (!lockedIndexes.includes('idx_transactions_email_missing')) additions.push('customer_email');
          if (!lockedIndexes.includes('idx_transactions_amount_missing')) additions.push('amount');
          return Array.from(new Set([...prev, ...additions]));
        });

        // 4. Prune unutilized dead index (idx_transactions_date) to reclaim buffer cache & write latency ONLY if NOT locked
        // and un-remove any essential indexes (while preserving user locks)
        setRemovedIndexes((prev) => {
          const withoutEssentials = prev.filter((name) =>
            !name.includes('PRIMARY KEY') &&
            !name.includes('orders_status_cat') &&
            !name.includes('email_status') &&
            !name.includes('category_amount') &&
            !name.includes('tx_price') &&
            !name.includes('tier_created') &&
            !name.includes('line_items_tx') &&
            !lockedIndexes.includes(name)
          );
          if (!lockedIndexes.includes('idx_transactions_date')) {
            return Array.from(new Set([...withoutEssentials, 'idx_transactions_date']));
          }
          return withoutEssentials;
        });

        setIsApplyingBulkOptimize(false);
        setAutoOptimizedCompleted(true);
        setBulkOptimizeSuccessNotice(
          `Bulk Optimization Complete: Applied ${bulkOptimizationPlan.pendingChanges.length} optimal changes across all tables! All ${bulkOptimizationPlan.totalCount} indexes are now in their optimal state with average schema health increased to ${bulkOptimizationPlan.projectedAvgHealth}/100.`
        );
        setCoveringConflictToast({
          message: `Bulk index creation generated a 'covering index' conflict with existing high-priority index "idx_transactions_date" and "idx_line_items_tx_price" (overlapping column subsets).`,
          conflictingIndex: 'idx_transactions_date'
        });
        setTimeout(() => {
          setBulkOptimizeSuccessNotice(null);
        }, 7000);
      }
    }, 280);
  };

  // Real-time index search metrics and table isolation calculation for header filter
  const headerSearchMetrics = useMemo(() => {
    const queryLower = indexSearchQuery.trim().toLowerCase();
    const totalIndexes = tables.reduce((acc, t) => acc + t.indexes.length, 0);

    if (!queryLower) {
      return {
        totalIndexes,
        matchingCount: totalIndexes,
        isFiltering: false,
        matchingTablesCount: tables.length,
        tableMatches: {} as Record<string, number>
      };
    }

    let matchingCount = 0;
    const tableMatches: Record<string, number> = {};

    tables.forEach((tbl) => {
      const matchingIdxs = tbl.indexes.filter((idx) => {
        const matchesName = idx.name.toLowerCase().includes(queryLower);
        const matchesTargetTable =
          tbl.name.toLowerCase().includes(queryLower) ||
          (idx.targetTable && idx.targetTable.toLowerCase().includes(queryLower)) ||
          (tbl.entityName && tbl.entityName.toLowerCase().includes(queryLower)) ||
          (idx.targetEntity && idx.targetEntity.toLowerCase().includes(queryLower));
        const matchesColumns = idx.columns.some((c) => c.toLowerCase().includes(queryLower));
        const matchesType = idx.type.toLowerCase().includes(queryLower);
        return matchesName || matchesTargetTable || matchesColumns || matchesType;
      });

      tableMatches[tbl.name] = matchingIdxs.length;
      matchingCount += matchingIdxs.length;
    });

    const matchingTablesCount = Object.values(tableMatches).filter((c) => c > 0).length;

    return {
      totalIndexes,
      matchingCount,
      isFiltering: true,
      matchingTablesCount,
      tableMatches
    };
  }, [tables, indexSearchQuery]);

  // Helper function to dynamically generate realistic PostgreSQL EXPLAIN mini-execution plan previews
  // reflecting whether an index is currently active, unindexed, pruned, or redundant
  const getMiniExecutionPlanPreview = (idxName: string, active: boolean, tableName: string) => {
    const isRemoved = removedIndexes.includes(idxName);
    const redundant = isIndexRedundant(idxName, []);

    if (idxName.includes('PRIMARY KEY')) {
      if (isRemoved) {
        return {
          nodeType: 'Seq Scan (Fallback)',
          isOptimized: false,
          cost: 'cost=0.00..1845.00 rows=1 width=142',
          execTime: '38.4 ms',
          scanMethod: 'O(n) Full Heap Scan',
          cacheHit: '0% (Buffer Thrash)',
          badgeText: '⚠️ Seq Scan Fallback',
          badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
          querySql: `SELECT * FROM ${tableName} WHERE id = '018f3a9e-uuid';`,
          planTree: `->  Seq Scan on ${tableName}  (cost=0.00..1845.00 rows=1 width=142)
      Filter: (id = '018f3a9e-uuid'::uuid)
      Rows Removed by Filter: 49999
      Buffers: shared read=1845`
        };
      }
      return {
        nodeType: 'Index Scan (Clustered)',
        isOptimized: true,
        cost: 'cost=0.29..8.31 rows=1 width=142',
        execTime: '0.04 ms',
        scanMethod: 'O(1) Clustered Point Seek',
        cacheHit: '100% Shared Cache',
        badgeText: '⚡ O(1) Clustered Seek (0.04ms)',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        querySql: `SELECT * FROM ${tableName} WHERE id = '018f3a9e-uuid';`,
        planTree: `->  Index Scan using PRIMARY KEY on ${tableName}  (cost=0.29..8.31 rows=1 width=142)
      Index Cond: (id = '018f3a9e-uuid'::uuid)
      Buffers: shared hit=3`
      };
    }

    if (idxName === 'idx_transactions_date') {
      if (isRemoved) {
        return {
          nodeType: 'Pruned Index (Zero Overhead)',
          isOptimized: true,
          cost: 'write_penalty=0.00ms rows=0',
          execTime: '0.00 ms (Write Reclaimed)',
          scanMethod: '+14% Faster INSERT / UPDATE',
          cacheHit: '2.4 MB Cache Freed',
          badgeText: '✓ Pruned (+14% Write Speedup)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `-- Unutilized index successfully dropped from buffer pool`,
          planTree: `->  Index Pruned from Physical Storage
      Disk Space Saved: 2.4 MB
      Write Amplification Penalty: 0% (was +14% write cost per tx)
      Audit Trace: 0 hits in past 14,200 workload queries`
        };
      }
      return {
        nodeType: 'Bitmap Index Scan (Unutilized)',
        isOptimized: false,
        cost: 'cost=12.50..890.00 rows=12000 width=142',
        execTime: '185.0 ms',
        scanMethod: 'Low Selectivity (+14% Write Drag)',
        cacheHit: 'High Cache Pollution',
        badgeText: '⚠️ Unutilized (0 Hits / 100 Qs)',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE created_at >= NOW() - INTERVAL '1 day';`,
        planTree: `->  Bitmap Heap Scan on transactions  (cost=12.50..890.00 rows=12000)
      Recheck Cond: (created_at >= '2026-09-28'::timestamp)
      ->  Bitmap Index Scan on idx_transactions_date  (cost=0.00..12.50)
      Notice: Zero hits recorded across recent production traffic`
      };
    }

    if (idxName.includes('orders_status_cat')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan (Composite B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..12.30 rows=45 width=128',
          execTime: '1.2 ms',
          scanMethod: 'O(log n) Composite Range Seek',
          cacheHit: '100% Buffer Cache Hit',
          badgeText: '⚡ 1.2ms (99.7% Latency Cut)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE status = 'pending' AND category = 'Electronics' LIMIT 50;`,
          planTree: `->  Index Scan using idx_orders_status_cat on transactions  (cost=0.42..12.30 rows=45 width=128)
      Index Cond: ((status = 'pending'::text) AND (category = 'Electronics'::text))
      Buffers: shared hit=4`
        };
      }
      return {
        nodeType: 'Seq Scan (Unindexed Filter)',
        isOptimized: false,
        cost: 'cost=0.00..1520.00 rows=45 width=128',
        execTime: '412.0 ms',
        scanMethod: 'O(n) Full Table Scan Fallback',
        cacheHit: 'Reads 50,000 Heap Rows',
        badgeText: '⚠️ 412ms Full Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE status = 'pending' AND category = 'Electronics' LIMIT 50;`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1520.00 rows=50000 width=128)
      Filter: ((status = 'pending'::text) AND (category = 'Electronics'::text))
      Rows Removed by Filter: 49955
      Buffers: shared read=1520`
      };
    }

    if (idxName.includes('line_items_tx')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Hash Join (Indexed FK Seek)',
          isOptimized: true,
          cost: 'cost=8.45..42.10 rows=350 width=88',
          execTime: '1.8 ms',
          scanMethod: 'O(1) Batched Foreign Key Seek',
          cacheHit: 'N+1 Storm Eliminated',
          badgeText: '⚡ 1.8ms (233x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);`,
          planTree: `->  Hash Join  (cost=8.45..42.10 rows=350 width=88)
      Hash Cond: (li.transaction_id = t.id)
      ->  Index Scan using idx_line_items_tx on line_items li  (cost=0.42..32.10)
            Index Cond: (transaction_id = ANY('{...}'::uuid[]))`
        };
      }
      return {
        nodeType: 'Nested Loop (Seq Scan per Row)',
        isOptimized: false,
        cost: 'cost=0.00..4120.00 rows=350 width=88',
        execTime: '420.0 ms',
        scanMethod: 'N+1 Query Storm (100+ roundtrips)',
        cacheHit: '100+ Table Scans',
        badgeText: '⚠️ 420ms N+1 Cascade',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT li.* FROM line_items li INNER JOIN transactions t ON li.transaction_id = t.id WHERE t.id IN (?);`,
        planTree: `->  Nested Loop  (cost=0.00..4120.00 rows=350 width=88)
      ->  Seq Scan on transactions t
      ->  Seq Scan on line_items li
            Filter: (transaction_id = t.id)  -- Executed 100+ times!`
      };
    }

    if (idxName.includes('email_status')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan (Compound B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..8.45 rows=12 width=142',
          execTime: '1.6 ms',
          scanMethod: 'O(log n) Dual Equality Leaf Seek',
          cacheHit: 'Zero Heap Cache Churn',
          badgeText: '⚡ 1.6ms (246x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com' AND status = 'completed';`,
          planTree: `->  Index Scan using idx_transactions_email_status on transactions  (cost=0.42..8.45 rows=12)
      Index Cond: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))
      Buffers: shared hit=3`
        };
      }
      return {
        nodeType: 'Seq Scan (Missing Composite)',
        isOptimized: false,
        cost: 'cost=0.00..1845.00 rows=12 width=142',
        execTime: '395.0 ms',
        scanMethod: 'O(n) Table Scan Fallback',
        cacheHit: 'Full 50k Table Traversal',
        badgeText: '⚠️ 395ms Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com' AND status = 'completed';`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1845.00 rows=50000 width=142)
      Filter: ((customer_email = 'alice@example.com'::text) AND (status = 'completed'::text))
      Rows Removed by Filter: 49988`
      };
    }

    if (idxName.includes('category_amount')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'GroupAggregate + Index Scan',
          isOptimized: true,
          cost: 'cost=0.42..15.60 rows=1 width=48',
          execTime: '1.9 ms',
          scanMethod: 'O(log n) Leaf Range Seek',
          cacheHit: 'In-Index Aggregation',
          badgeText: '⚡ 1.9ms (253x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = 'Books' AND amount > 50 GROUP BY category;`,
          planTree: `->  GroupAggregate  (cost=0.42..15.60 rows=1 width=48)
      Group Key: category
      ->  Index Scan using idx_transactions_category_amount on transactions
            Index Cond: ((category = 'Books'::text) AND (amount > 50.00))`
        };
      }
      return {
        nodeType: 'HashAggregate + Seq Scan',
        isOptimized: false,
        cost: 'cost=1520.00..1890.00 rows=1 width=48',
        execTime: '482.0 ms',
        scanMethod: 'Hash Spill to Disk Buffer',
        cacheHit: '38.4% CPU Share',
        badgeText: '⚠️ 482ms Hash Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT category, AVG(amount), COUNT(*) FROM transactions WHERE category = 'Books' AND amount > 50 GROUP BY category;`,
        planTree: `->  HashAggregate  (cost=1520.00..1890.00 rows=1 width=48)
      Group Key: category
      ->  Seq Scan on transactions
            Filter: ((category = 'Books'::text) AND (amount > 50.00))`
      };
    }

    if (idxName.includes('line_items_tx_price')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Only Scan (Covering Composite)',
          isOptimized: true,
          cost: 'cost=0.42..14.30 rows=40 width=88',
          execTime: '1.5 ms',
          scanMethod: 'O(log n) Covering Composite Seek',
          cacheHit: '0 Table Heap Fetches',
          badgeText: '⚡ 1.5ms (185x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = '018f3a9e-uuid' AND li.unit_price >= 50.00;`,
          planTree: `->  Index Only Scan using idx_line_items_tx_price on line_items li  (cost=0.42..14.30 rows=40)
      Index Cond: ((transaction_id = '018f3a9e-uuid'::uuid) AND (unit_price >= 50.00))
      Heap Fetches: 0`
        };
      }
      return {
        nodeType: 'Nested Loop + Seq Scan (Uncovered)',
        isOptimized: false,
        cost: 'cost=0.00..2800.00 rows=40 width=88',
        execTime: '280.0 ms',
        scanMethod: 'Sequential Heap Page Traversal',
        cacheHit: '1,200 Heap Fetches',
        badgeText: '⚠️ 280ms Unindexed Join Filter',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT li.sku, li.quantity, li.unit_price FROM line_items li WHERE li.transaction_id = '018f3a9e-uuid' AND li.unit_price >= 50.00;`,
        planTree: `->  Seq Scan on line_items li  (cost=0.00..2800.00 rows=200000 width=88)
      Filter: ((transaction_id = '018f3a9e-uuid'::uuid) AND (unit_price >= 50.00))`
      };
    }

    if (idxName.includes('customers_tier_created')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan Backward (Pre-Sorted)',
          isOptimized: true,
          cost: 'cost=0.42..12.50 rows=50 width=128',
          execTime: '1.2 ms',
          scanMethod: 'Early Exit Zero-Sort Seek',
          cacheHit: '100% In-Order Leaf Traversal',
          badgeText: '⚡ 1.2ms (140x Faster)',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT id, name, email, tier FROM customers WHERE tier = 'enterprise' ORDER BY created_at DESC LIMIT 50;`,
          planTree: `->  Limit  (cost=0.42..12.50 rows=50 width=128)
      ->  Index Scan Backward using idx_customers_tier_created on customers
            Index Cond: (tier = 'enterprise'::text)
      Buffers: shared hit=4`
        };
      }
      return {
        nodeType: 'Sort Buffer Spill + Seq Scan',
        isOptimized: false,
        cost: 'cost=160.00..165.00 rows=50 width=128',
        execTime: '165.0 ms',
        scanMethod: 'In-Memory Sort Buffer Spill',
        cacheHit: 'Filesort on Disk WorkMem',
        badgeText: '⚠️ 165ms Sort Buffer Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT id, name, email, tier FROM customers WHERE tier = 'enterprise' ORDER BY created_at DESC LIMIT 50;`,
        planTree: `->  Limit  (cost=160.00..165.00 rows=50 width=128)
      ->  Sort  (cost=155.00..160.00)  Sort Key: created_at DESC
            Sort Method: external merge  Disk: 420kB
            ->  Seq Scan on customers  Filter: (tier = 'enterprise'::text)`
      };
    }

    if (idxName.includes('email_missing') || idxName.includes('customer_email')) {
      if (active && !isRemoved) {
        return {
          nodeType: redundant ? 'Index Scan (Shadowed)' : 'Index Scan (Single Column)',
          isOptimized: !redundant,
          cost: 'cost=0.42..14.20 rows=12 width=142',
          execTime: redundant ? '2.4 ms (Redundant)' : '1.8 ms',
          scanMethod: 'O(log n) Single-Column Seek',
          cacheHit: redundant ? 'Covered by composite' : '99.2% Hit Rate',
          badgeText: redundant ? '⚠️ Redundant Coverage' : '⚡ 1.8ms Index Seek',
          badgeClass: redundant ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com';`,
          planTree: `->  Index Scan using idx_transactions_email on transactions  (cost=0.42..14.20 rows=12)
      Index Cond: (customer_email = 'alice@example.com'::text)`
        };
      }
      return {
        nodeType: 'Seq Scan (Missing Index)',
        isOptimized: false,
        cost: 'cost=0.00..1845.00 rows=12 width=142',
        execTime: '395.0 ms',
        scanMethod: 'O(n) Table Scan',
        cacheHit: 'Heap Scan on 50k rows',
        badgeText: '⚠️ 395ms Table Scan',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE customer_email = 'alice@example.com';`,
        planTree: `->  Seq Scan on transactions  (cost=0.00..1845.00 rows=50000 width=142)
      Filter: (customer_email = 'alice@example.com'::text)`
      };
    }

    if (idxName.includes('amount_missing') || idxName.includes('amount')) {
      if (active && !isRemoved) {
        return {
          nodeType: 'Index Scan Backward (Ordered B-Tree)',
          isOptimized: true,
          cost: 'cost=0.42..42.10 rows=20 width=142',
          execTime: '0.8 ms',
          scanMethod: 'O(log n) Boundary Leaf Scan',
          cacheHit: 'Eliminates Disk Sort',
          badgeText: '⚡ 0.8ms Range Seek',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          querySql: `SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC LIMIT 20;`,
          planTree: `->  Limit  (cost=0.42..42.10 rows=20)
      ->  Index Scan Backward using idx_transactions_amount on transactions
            Index Cond: (amount > 500.00)`
        };
      }
      return {
        nodeType: 'Top-N Sort + Seq Scan',
        isOptimized: false,
        cost: 'cost=1845.00..2150.00 rows=20 width=142',
        execTime: '142.0 ms',
        scanMethod: 'In-Memory Sort Spill',
        cacheHit: '50k rows sorted',
        badgeText: '⚠️ 142ms Sort Spill',
        badgeClass: 'bg-rose-900/60 text-rose-300 border-rose-700',
        querySql: `SELECT * FROM transactions WHERE amount > 500.00 ORDER BY amount DESC LIMIT 20;`,
        planTree: `->  Top-N Sort  (cost=1845.00..2150.00 rows=20)
      Sort Key: amount DESC
      ->  Seq Scan on transactions  Filter: (amount > 500.00)`
      };
    }

    if (idxName.includes('customers_email')) {
      return {
        nodeType: 'Index Scan (Unique B-Tree)',
        isOptimized: true,
        cost: 'cost=0.29..8.31 rows=1 width=96',
        execTime: '0.05 ms',
        scanMethod: 'O(log n) Unique Key Seek',
        cacheHit: '100% Cache Hit',
        badgeText: '⚡ 0.05ms Unique Seek',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        querySql: `SELECT * FROM customers WHERE email = 'user@example.com';`,
        planTree: `->  Index Scan using idx_customers_email on customers  (cost=0.29..8.31 rows=1 width=96)
      Index Cond: (email = 'user@example.com'::text)`
      };
    }

    // Default fallback plan
    return {
      nodeType: active ? 'Index Scan' : 'Seq Scan',
      isOptimized: active,
      cost: active ? 'cost=0.42..18.40 rows=10' : 'cost=0.00..1845.00 rows=10',
      execTime: active ? '1.4 ms' : '150.0 ms',
      scanMethod: active ? 'O(log n) Seek' : 'O(n) Scan',
      cacheHit: active ? '100% Cache' : 'Disk Read',
      badgeText: active ? '⚡ 1.4ms Seek' : '⚠️ 150ms Scan',
      badgeClass: active ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-rose-900/60 text-rose-300 border-rose-700',
      querySql: `SELECT * FROM ${tableName} LIMIT 20;`,
      planTree: active
        ? `->  Index Scan using ${idxName} on ${tableName}  (cost=0.42..18.40 rows=10)`
        : `->  Seq Scan on ${tableName}  (cost=0.00..1845.00 rows=50000)`
    };
  };

  const getBaselineComparisonForIndex = (idxName: string, active: boolean) => {
    if (idxName.includes('PRIMARY KEY')) {
      return {
        baselineStatus: 'Active in Baseline',
        baselineScan: 'Clustered Seek O(1)',
        currentStatus: 'Retained Baseline Anchor',
        isNewOptimization: false,
        speedup: 'Baseline Anchor',
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200'
      };
    }
    if (idxName === 'idx_transactions_date') {
      const isRemoved = removedIndexes.includes(idxName);
      return {
        baselineStatus: 'Lingering in Baseline (0 Hits)',
        baselineScan: 'Unused B-Tree Overhead (+14% Write I/O)',
        currentStatus: isRemoved ? 'Pruned in Optimization (+2.4MB Saved)' : 'Unpruned Overhead',
        isNewOptimization: isRemoved,
        speedup: isRemoved ? '+14% Write Latency Saved' : '0 Hits Recorded',
        badgeClass: isRemoved ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }
    return {
      baselineStatus: 'Missing in Baseline (Full Table Scan)',
      baselineScan: 'Sequential Scan O(n) on 50,000 rows',
      currentStatus: active ? 'Optimized B-Tree Active' : 'Missing Index Bottleneck',
      isNewOptimization: active,
      speedup: active ? '+99.6% Speedup (O(log n))' : 'Bottleneck Active',
      badgeClass: active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
    };
  };

  const getWhatIfTop5Queries = (indexName: string) => {
    const isEmail = indexName.toLowerCase().includes('email') || indexName.toLowerCase().includes('customer');
    const isStatus = indexName.toLowerCase().includes('status') || indexName.toLowerCase().includes('cat');
    const isAmount = indexName.toLowerCase().includes('amount') || indexName.toLowerCase().includes('price');
    const isDate = indexName.toLowerCase().includes('date') || indexName.toLowerCase().includes('time') || indexName.toLowerCase().includes('timestamp');

    if (isEmail) {
      return [
        { query: 'SELECT * FROM transactions WHERE customer_email = ?', freq: '14,250/hr', before: '72.4ms', after: '0.3ms', improvement: '-99.6%' },
        { query: 'SELECT id, customer_email FROM transactions WHERE customer_email LIKE ?', freq: '8,400/hr', before: '65.0ms', after: '0.4ms', improvement: '-99.4%' },
        { query: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ?', freq: '5,120/hr', before: '84.2ms', after: '0.6ms', improvement: '-99.3%' },
        { query: 'SELECT COUNT(*) FROM transactions WHERE customer_email = ?', freq: '3,900/hr', before: '58.0ms', after: '0.2ms', improvement: '-99.6%' },
        { query: 'SELECT * FROM transactions WHERE customer_email = ? ORDER BY date DESC', freq: '2,100/hr', before: '91.5ms', after: '0.9ms', improvement: '-99.0%' }
      ];
    } else if (isStatus) {
      return [
        { query: 'SELECT * FROM transactions WHERE status = ? AND amount > ?', freq: '18,400/hr', before: '64.1ms', after: '0.5ms', improvement: '-99.2%' },
        { query: 'SELECT * FROM transactions GROUP BY status, category', freq: '9,200/hr', before: '98.5ms', after: '1.1ms', improvement: '-98.8%' },
        { query: 'SELECT * FROM transactions WHERE status = "pending" LIMIT 100', freq: '7,650/hr', before: '52.0ms', after: '0.3ms', improvement: '-99.4%' },
        { query: 'SELECT AVG(amount) FROM transactions WHERE status = ?', freq: '4,100/hr', before: '78.0ms', after: '0.7ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions WHERE status = ? ORDER BY amount DESC', freq: '3,200/hr', before: '88.0ms', after: '0.8ms', improvement: '-99.1%' }
      ];
    } else if (isAmount) {
      return [
        { query: 'SELECT * FROM transactions WHERE amount >= 1000 ORDER BY amount DESC', freq: '11,100/hr', before: '82.0ms', after: '0.4ms', improvement: '-99.5%' },
        { query: 'SELECT SUM(amount) FROM transactions WHERE category = ? AND amount > ?', freq: '8,900/hr', before: '95.4ms', after: '0.8ms', improvement: '-99.2%' },
        { query: 'SELECT * FROM transactions WHERE amount BETWEEN 100 AND 500', freq: '6,400/hr', before: '68.2ms', after: '0.5ms', improvement: '-99.3%' },
        { query: 'SELECT MIN(amount), MAX(amount) FROM transactions', freq: '3,100/hr', before: '55.0ms', after: '0.2ms', improvement: '-99.6%' },
        { query: 'SELECT * FROM transactions WHERE customer_id = ? AND amount > ?', freq: '2,800/hr', before: '74.0ms', after: '0.6ms', improvement: '-99.2%' }
      ];
    } else if (isDate) {
      return [
        { query: 'SELECT * FROM transactions WHERE date >= NOW() - INTERVAL 30 DAY', freq: '16,500/hr', before: '88.5ms', after: '0.8ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions ORDER BY date DESC LIMIT 50', freq: '12,300/hr', before: '76.0ms', after: '0.4ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions WHERE date BETWEEN ? AND ?', freq: '9,100/hr', before: '92.0ms', after: '0.9ms', improvement: '-99.0%' },
        { query: 'SELECT COUNT(*) FROM transactions WHERE date < ?', freq: '4,500/hr', before: '61.0ms', after: '0.3ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions WHERE status = ? AND date > ?', freq: '3,800/hr', before: '84.0ms', after: '0.7ms', improvement: '-99.2%' }
      ];
    } else {
      return [
        { query: 'SELECT * FROM transactions WHERE id = ?', freq: '22,000/hr', before: '45.0ms', after: '0.2ms', improvement: '-99.5%' },
        { query: 'SELECT * FROM transactions JOIN items ON ...', freq: '11,400/hr', before: '145.8ms', after: '1.2ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions WHERE reference_code = ?', freq: '8,200/hr', before: '68.0ms', after: '0.4ms', improvement: '-99.4%' },
        { query: 'SELECT * FROM transactions WHERE priority = "high"', freq: '5,100/hr', before: '59.0ms', after: '0.5ms', improvement: '-99.1%' },
        { query: 'SELECT * FROM transactions ORDER BY created_at DESC', freq: '3,900/hr', before: '90.0ms', after: '0.8ms', improvement: '-99.1%' }
      ];
    }
  };

  const handleCreateIndex = (colName: string) => {
    if (!createdCustomIndexes.includes(colName)) {
      setCreatedCustomIndexes([...createdCustomIndexes, colName]);
      setCoveringConflictToast({
        message: `New index on column "${colName}" creates a 'covering index' conflict with existing high-priority index "idx_transactions_date" (overlapping prefix set and duplicate B-Tree leaf pages).`,
        conflictingIndex: 'idx_transactions_date'
      });
    }
  };

  const handleDownloadSchemaReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeOptimizationFlags: flags,
      tables,
      customCreatedIndexes: createdCustomIndexes,
      diagnosticSummary: {
        totalTables: tables.length,
        missingIndexesIdentified: ['customer_email', 'amount'],
        recommendation: 'Enable B-Tree Indexing and Batch Eager Loading to resolve query complexity bottlenecks.'
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema-diagnostic-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSchemaState = () => {
    setIsExportingState(true);

    const totalIdxCount = tables.reduce((acc, t) => acc + t.indexes.length, 0);
    const activeIdxCount = tables.reduce(
      (acc, t) => acc + t.indexes.filter((idx) => idx.active && !removedIndexes.includes(idx.name)).length,
      0
    );

    const schemaSnapshot = {
      snapshotMetadata: {
        exportVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedTimestamp: Date.now(),
        databaseEngine: 'PostgreSQL / Cloud SQL Relational Engine',
        stateDescription: 'Optimized Database Schema & Index Configuration Snapshot'
      },
      optimizationFlags: {
        ...flags
      },
      performanceImpact: {
        speedUpEstimatedPercent: speedUpPercent,
        totalTables: tables.length,
        totalIndexes: totalIdxCount,
        activeIndexes: activeIdxCount,
        prunedUnutilizedIndexes: removedIndexes.length,
        workloadLatencyImprovement: 'Up to 99.6% reduction on expensive queries'
      },
      indexConfiguration: {
        createdCustomIndexes: [...createdCustomIndexes],
        createdCompositeIndexes: [...createdCompositeIndexes],
        consolidatedIndexes: [...consolidatedIndexes],
        removedOrPrunedIndexes: [...removedIndexes]
      },
      tablesAndEntities: tables.map((t) => ({
        tableName: t.name,
        entityName: t.entityName,
        entityBadge: t.entityBadge,
        entityRole: t.entityRole,
        description: t.description,
        columnCount: t.columns.length,
        columns: t.columns.map((col) => ({
          name: col.name,
          type: col.type,
          isPk: col.isPk,
          isFk: col.isFk,
          indexed: col.indexed
        })),
        indexes: t.indexes.map((idx) => ({
          name: idx.name,
          type: idx.type,
          columns: idx.columns,
          targetTable: idx.targetTable,
          targetEntity: idx.targetEntity,
          active: idx.active && !removedIndexes.includes(idx.name),
          status: removedIndexes.includes(idx.name)
            ? 'REMOVED'
            : idx.active
            ? 'ACTIVE'
            : 'INACTIVE',
          optimizationComplexityReduction: getOptimizationPotential(idx.name),
          healthScore: getIndexHealthScore(idx.name, idx.active && !removedIndexes.includes(idx.name), t.name),
          impactSummary: getIndexImpactSummary(idx.name)
        })),
        relationships: t.relationships.map((rel) => ({
          targetTable: rel.targetTable,
          type: rel.type,
          foreignKey: rel.foreignKey,
          optimized: rel.optimized
        }))
      })),
      expensiveQueriesWorkload: expensiveQueriesWorkload.map((q) => ({
        id: q.id,
        name: q.name,
        frequency: q.frequency,
        executionShare: q.executionShare,
        unindexedLatency: q.unindexedLatency,
        optimizedLatency: q.optimizedLatency,
        speedup: q.speedup,
        optimalIndexName: q.optimalIndexName,
        optimalIndexType: q.optimalIndexType,
        isToggled: q.isToggled
      }))
    };

    const fileName = `schema-state-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const jsonBlob = new Blob([JSON.stringify(schemaSnapshot, null, 2)], {
      type: 'application/json'
    });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(downloadUrl);

    setTimeout(() => {
      setIsExportingState(false);
      setExportSuccessNotice(`Successfully exported schema state snapshot (${activeIdxCount} active indexes) to ${fileName}`);
    }, 400);

    setTimeout(() => {
      setExportSuccessNotice(null);
    }, 5000);
  };

  // Generates and downloads a structured JSON 'Index Impact Report' containing the current index list,
  // their health scores, and latency contribution metrics for external analysis.
  const handleExportImpactReport = () => {
    setIsExportingImpactReport(true);

    const totalIndexes = allRankedSchemaIndexes.length;
    const activeIndexes = allRankedSchemaIndexes.filter((item) => item.index.active && !item.isRemoved).length;
    const prunedIndexes = allRankedSchemaIndexes.filter((item) => item.isRemoved).length;
    const lockedIndexesCount = allRankedSchemaIndexes.filter((item) => item.isLocked).length;

    const avgHealthScore = totalIndexes > 0
      ? Math.round(allRankedSchemaIndexes.reduce((sum, item) => sum + item.health.score, 0) / totalIndexes)
      : 0;

    const avgImpactScore = totalIndexes > 0
      ? Math.round(allRankedSchemaIndexes.reduce((sum, item) => sum + item.impact.score, 0) / totalIndexes)
      : 0;

    const totalLatencyMs = Number(
      allRankedSchemaIndexes
        .reduce((sum, item) => sum + item.latencyHeat.queryLatencyContributionMs, 0)
        .toFixed(1)
    );

    const criticalCount = allRankedSchemaIndexes.filter((item) => item.latencyHeat.heatTier === 'critical').length;
    const highCount = allRankedSchemaIndexes.filter((item) => item.latencyHeat.heatTier === 'high').length;
    const moderateCount = allRankedSchemaIndexes.filter((item) => item.latencyHeat.heatTier === 'moderate').length;
    const optimalCount = allRankedSchemaIndexes.filter((item) => item.latencyHeat.heatTier === 'low').length;

    const impactReportData = {
      reportMetadata: {
        title: 'Index Impact & Query Latency Diagnostic Report',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedTimestamp: Date.now(),
        databaseEngine: 'PostgreSQL / Cloud SQL Relational Engine',
        schemaPrototype: activeSchemaPrototypeName,
        currentFilter: indexCategoryFilter,
        currentRankingSort: indexRankSort,
        description: 'Comprehensive analysis of database schema index health scores, impact scores, and total query latency contributions for external analysis and automated profiling.'
      },
      systemOptimizationFlags: {
        ...flags
      },
      summaryMetrics: {
        totalIndexesAnalyzed: totalIndexes,
        activeIndexes,
        prunedIndexes,
        lockedIndexesCount,
        averageHealthScore: avgHealthScore,
        averageImpactScore: avgImpactScore,
        totalWorkloadLatencyContributionMs: totalLatencyMs,
        latencyDistribution: {
          criticalGreaterThan400ms: criticalCount,
          high250to400ms: highCount,
          moderate100to250ms: moderateCount,
          optimalLessThan100ms: optimalCount
        }
      },
      indexes: allRankedSchemaIndexes.map((item, rankIdx) => ({
        rank: rankIdx + 1,
        indexName: item.index.name,
        targetTable: item.table,
        entityBadge: item.entityBadge || 'Standard Entity',
        indexType: item.index.type,
        columns: item.index.columns,
        status: item.isRemoved ? 'REMOVED' : item.index.active ? 'ACTIVE' : 'INACTIVE',
        isLocked: item.isLocked,
        healthScore: {
          score: item.health.score,
          rating: item.health.rating,
          frequencyScore: item.health.frequencyScore,
          readWriteScore: item.health.readWriteScore,
          scanEfficiencyScore: item.health.scanEfficiencyScore,
          statusDescription: item.health.status
        },
        impactScore: {
          score: item.impact.score,
          overallValueRating: item.impact.overallValueRating,
          queryPerformanceImprovementPercent: item.impact.queryImprovement,
          writeLatencyPenaltyPercent: item.impact.writePenalty,
          readBenefitMultiplier: item.impact.readBenefitMultiplier
        },
        latencyContributionMetrics: {
          latencyContributionMs: item.latencyHeat.queryLatencyContributionMs,
          executionSharePercent: item.latencyHeat.executionShare,
          queryFrequencyPerHour: item.latencyHeat.queryFrequencyPerHour,
          associatedQuery: item.latencyHeat.baselineQueryName,
          heatTier: item.latencyHeat.heatTier,
          heatIntensity: item.latencyHeat.heatIntensity,
          tierLabel: item.latencyHeat.tierLabel
        }
      })),
      expensiveQueriesWorkload: expensiveQueriesWorkload.map((q) => ({
        id: q.id,
        name: q.name,
        frequency: q.frequency,
        executionShare: q.executionShare,
        unindexedLatency: q.unindexedLatency,
        optimizedLatency: q.optimizedLatency,
        speedup: q.speedup,
        optimalIndexName: q.optimalIndexName,
        optimalIndexType: q.optimalIndexType,
        isToggled: q.isToggled
      }))
    };

    const fileName = `index-impact-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const jsonBlob = new Blob([JSON.stringify(impactReportData, null, 2)], {
      type: 'application/json'
    });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = downloadUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(downloadUrl);

    setTimeout(() => {
      setIsExportingImpactReport(false);
      setExportSuccessNotice(`Successfully generated & exported Index Impact Report (${totalIndexes} indexes analyzed) to ${fileName}`);
    }, 350);

    setTimeout(() => {
      setExportSuccessNotice(null);
    }, 5000);
  };

  const renderIndexDependencyVisualization = () => {
    return (
      <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto bg-white">
        <div className="p-4 bg-gradient-to-r from-indigo-50/95 via-purple-50/70 to-blue-50/90 border border-indigo-200 rounded-xl space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-indigo-700" />
              <span>Covering Index Dependency &amp; Blast Radius Visualization</span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-indigo-200 text-indigo-950 border border-indigo-300">
                {COVERING_INDEX_CATALOG.length} Covering Indexes Mapped
              </span>

              {/* Interactive Pan & Zoom Toolbar */}
              <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg p-1 shadow-2xs text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setDependencyZoomLevel(prev => Math.max(0.5, prev - 0.15))}
                  className="px-2 py-0.5 hover:bg-indigo-50 rounded text-indigo-900 font-bold cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="px-2 text-indigo-950 font-bold">{Math.round(dependencyZoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setDependencyZoomLevel(prev => Math.min(2.0, prev + 0.15))}
                  className="px-2 py-0.5 hover:bg-indigo-50 rounded text-indigo-900 font-bold cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => { setDependencyZoomLevel(1); setDependencyPanOffset({ x: 0, y: 0 }); }}
                  className="px-2 py-0.5 bg-indigo-600 text-white rounded font-bold cursor-pointer ml-1"
                  title="Reset Pan & Zoom"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed">
            Illustrates exact query and stored procedure dependency trees for specific covering indexes. Use interactive pan-and-zoom controls above or click and drag the canvas to navigate large database schemas without losing context.
          </p>
        </div>

        {/* Pan & Zoom Canvas Container */}
        <div
          className="relative overflow-hidden border border-zinc-200 rounded-2xl bg-zinc-50/50 p-4 cursor-grab active:cursor-grabbing select-none max-h-[58vh]"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('button')) return;
            setIsPanningDependency(true);
            setPanStartPos({ x: e.clientX - dependencyPanOffset.x, y: e.clientY - dependencyPanOffset.y });
          }}
          onMouseMove={(e) => {
            if (!isPanningDependency) return;
            setDependencyPanOffset({ x: e.clientX - panStartPos.x, y: e.clientY - panStartPos.y });
          }}
          onMouseUp={() => setIsPanningDependency(false)}
          onMouseLeave={() => setIsPanningDependency(false)}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setDependencyZoomLevel(prev => Math.min(2.0, Math.max(0.5, prev + delta)));
          }}
        >
          <div
            className="space-y-4 transition-transform origin-top-left"
            style={{
              transform: `scale(${dependencyZoomLevel}) translate(${dependencyPanOffset.x}px, ${dependencyPanOffset.y}px)`
            }}
          >
            {COVERING_INDEX_CATALOG.map((patch) => {
            const simState = simulatedIndexModifications[patch.indexName] || 'active';
            const isRemoved = simState === 'removed';
            const isModified = simState === 'modified';

            return (
              <div
                key={patch.id}
                className={`p-4 rounded-xl border transition-all space-y-3.5 ${
                  isRemoved
                    ? 'bg-rose-50/60 border-rose-300 opacity-80'
                    : isModified
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-zinc-200 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${isRemoved ? 'bg-rose-600' : isModified ? 'bg-amber-500' : 'bg-emerald-600'}`} />
                    <span className="font-mono font-bold text-xs text-zinc-900">{patch.indexName}</span>
                    <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                      Table: {patch.targetTable} • {patch.workloadSharePct}% Workload Share
                    </span>
                    {isRemoved && (
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-900 border border-rose-400 rounded text-[10px] font-bold">
                        SIMULATED REMOVAL (Pruned)
                      </span>
                    )}
                    {isModified && (
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-950 border border-amber-400 rounded text-[10px] font-bold">
                        SIMULATED MODIFICATION (Dropped INCLUDE)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-zinc-600">Simulation State:</span>
                    <select
                      value={simState}
                      onChange={(e) => {
                        const val = e.target.value as 'active' | 'modified' | 'removed';
                        setSimulatedIndexModifications(prev => ({ ...prev, [patch.indexName]: val }));
                        setImportSuccessNotice(`Index "${patch.indexName}" simulation state changed to: ${val.toUpperCase()}. Downstream impacts recalculated.`);
                        setTimeout(() => setImportSuccessNotice(null), 4000);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-zinc-300 text-zinc-800 cursor-pointer shadow-2xs"
                    >
                      <option value="active">Active (Covering Index-Only Scan)</option>
                      <option value="modified">Modified (Dropped INCLUDE Payload)</option>
                      <option value="removed">Removed / Pruned (Seq Scan Fallback)</option>
                    </select>
                  </div>
                </div>

                {/* Index Definition & Inclusion Payload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 font-mono text-[11px]">
                    <span className="text-zinc-500 block font-sans font-semibold mb-1">Key Columns:</span>
                    <span className="text-zinc-900 font-bold">({patch.keyColumns.join(', ')})</span>
                  </div>
                  <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-200 font-mono text-[11px]">
                    <span className="text-indigo-900 block font-sans font-semibold mb-1">INCLUDE Payload Columns:</span>
                    <span className="text-indigo-950 font-bold">({patch.includeColumns.join(', ')})</span>
                  </div>
                </div>

                {isRemoved && (
                  <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-xs space-y-1 text-rose-950 animate-fadeIn">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>CRITICAL IMPACT: Index Removal Detected</span>
                    </div>
                    <p className="text-[11px] text-rose-900">
                      Scan Plan degrades from <strong className="text-rose-950">Index-Only Scan</strong> to <strong className="text-rose-950">{patch.currentScanType}</strong>. Query latency spikes from <strong className="font-mono text-emerald-800">{patch.projectedLatencyMs}ms</strong> to <strong className="font-mono text-rose-900">{patch.currentLatencyMs}ms (+{patch.speedupPct}% slower)</strong>, forcing {patch.currentHeapFetches} from disk storage.
                    </p>
                  </div>
                )}

                {isModified && (
                  <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg text-xs space-y-1 text-amber-950 animate-fadeIn">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>WARNING: Index Modification Detected (INCLUDE Payload Dropped)</span>
                    </div>
                    <p className="text-[11px] text-amber-900">
                      Dropping non-key INCLUDE columns forces secondary heap rechecks. Latency increases by ~450% as queries must perform random page I/O to fetch projection columns from table heap pages.
                    </p>
                  </div>
                )}

                {/* Directly Relying Queries & Stored Procedures Tree */}
                <div className="pl-4 border-l-2 border-indigo-300 space-y-3 pt-1">
                  <div>
                    <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-indigo-600" />
                      <span>Directly Relying Queries</span>
                    </h5>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2 text-xs font-mono">
                      <div className="font-bold text-zinc-900">
                        {patch.patternTitle}
                      </div>
                      <pre className="text-[11px] text-indigo-950 bg-white p-2 rounded border border-zinc-200 overflow-x-auto whitespace-pre-wrap">
                        {patch.querySql}
                      </pre>
                      <div className="text-[10px] text-zinc-600 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-zinc-200">
                        <span>Current Latency: <strong className="text-emerald-700 font-bold">{isRemoved ? patch.currentLatencyMs : patch.projectedLatencyMs}ms</strong></span>
                        <span>Scan Type: <strong className="text-indigo-800 font-bold">{isRemoved ? patch.currentScanType : patch.projectedScanType}</strong></span>
                        <span>Heap Fetches: <strong className="text-zinc-900 font-bold">{isRemoved ? patch.currentHeapFetches : patch.projectedHeapFetches}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Database className="w-3 h-3 text-purple-600" />
                      <span>Directly Relying Stored Procedures</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-purple-50/70 rounded-lg border border-purple-200 space-y-1">
                        <div className="font-mono font-bold text-purple-950 text-[11px]">
                          sp_execute_workload_batch_{patch.targetTable}
                        </div>
                        <p className="text-[10px] text-purple-900">
                          Relies on {patch.indexName} for zero-lock transactional batch updates and index-only range scans.
                        </p>
                        <div className="text-[10px] font-mono font-bold text-purple-700 pt-1">
                          Status: {isRemoved ? '⚠️ TIMEOUT / LOCK RISK' : '✅ OPTIMAL (0.3ms seek)'}
                        </div>
                      </div>
                      <div className="p-2.5 bg-purple-50/70 rounded-lg border border-purple-200 space-y-1">
                        <div className="font-mono font-bold text-purple-950 text-[11px]">
                          sp_audit_reconciliation_ledger
                        </div>
                        <p className="text-[10px] text-purple-900">
                          Executes nightly audit sweeps requiring covering index leaf order to avoid temp file sort spills.
                        </p>
                        <div className="text-[10px] font-mono font-bold text-purple-700 pt-1">
                          Status: {isRemoved ? '⚠️ MEMORY SPILL WARNING' : '✅ FAST (Zero-Heap)'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    );
  };

  const renderImpactPredictionModal = () => {
    if (!showImpactPredictionModal || !selectedPredictionIndex) return null;
    const idx = selectedPredictionIndex;
    const isBTree = idx.type === 'B-Tree' || idx.type === 'Composite B-Tree';
    const currentLatency = isBTree ? 16.4 : 32.1;
    const projectedLatency = isBTree ? 0.78 : 1.45;
    const speedup = isBTree ? 95.2 : 91.5;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-2xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/20 text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Impact Prediction &amp; Latency Reduction Analysis</h3>
                <p className="text-[11px] text-purple-200 font-mono">Index: {idx.name} ({idx.targetTable || idx.table})</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowImpactPredictionModal(false)}
              className="p-1 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                <span className="text-[11px] text-zinc-500 font-medium block">Current Query Latency</span>
                <span className="font-mono font-bold text-lg text-zinc-900">{currentLatency} ms</span>
                <span className="text-[10px] text-zinc-500 block">Seq Scan / Unoptimized</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-800 font-medium block">Optimized / Rebuilt Latency</span>
                <span className="font-mono font-bold text-lg text-emerald-700">{projectedLatency} ms</span>
                <span className="text-[10px] text-emerald-700 block">Covering Index-Only Scan</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                <span className="text-[11px] text-purple-800 font-medium block">Estimated Gain</span>
                <span className="font-mono font-bold text-lg text-purple-700">+{speedup}% Faster</span>
                <span className="text-[10px] text-purple-700 block">Zero-Heap Memory Seek</span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>Predicted Performance Impact Summary:</span>
              </div>
              <p className="text-indigo-900 leading-relaxed">
                Rebuilding or optimizing <strong>{idx.name}</strong> eliminates random heap page fetches and sort memory spills. Common queries relying on this index will experience a <strong className="text-indigo-950 font-bold">{speedup}% latency reduction</strong>, saving an estimated <strong className="text-indigo-950 font-bold">38,000 disk I/O blocks</strong> per execution and delivering an immediate throughput boost of <strong className="text-indigo-950 font-bold">+12,500 QPM</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Common Queries Impacted</h4>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between">
                  <span className="font-bold text-zinc-800">Q1: Primary Filter &amp; Descending Sort</span>
                  <span className="text-emerald-700 font-bold">{currentLatency}ms → {projectedLatency}ms (-{speedup}%)</span>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between">
                  <span className="font-bold text-zinc-800">Q4: Active Account Support Lookup</span>
                  <span className="text-emerald-700 font-bold">14.2ms → 0.65ms (-95.4%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowImpactPredictionModal(false)}
              className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                handleReindexIndex(idx.name);
                setShowImpactPredictionModal(false);
                setImportSuccessNotice(`Successfully rebuilt and optimized index "${idx.name}". Projected latency reduction applied!`);
                setTimeout(() => setImportSuccessNotice(null), 4500);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rebuild &amp; Optimize Index Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === 'index-heatmap') {
      return (
        <div className="p-6">
          <IndexHeatmap
            tables={tables}
            onRebuildIndex={(idxName) => handleRebuildIndex(idxName)}
            onDropIndex={(idxName, tblName) => {
              setRemovedIndexes((prev) => [...prev, idxName]);
            }}
            onSuccessNotice={(msg) => {
              setImportSuccessNotice(msg);
              setTimeout(() => setImportSuccessNotice(null), 5000);
            }}
          />
        </div>
      );
    }
    if (activeTab === 'index-storage-heatmap') {
      return (
        <div className="p-6">
          <IndexStorageHeatmap
            tables={tables}
            onRebuildIndex={(idxName) => handleRebuildIndex(idxName)}
            onDropIndex={(idxName, tblName) => {
              setRemovedIndexes((prev) => [...prev, idxName]);
            }}
            onSuccessNotice={(msg) => {
              setImportSuccessNotice(msg);
              setTimeout(() => setImportSuccessNotice(null), 5000);
            }}
          />
        </div>
      );
    }
    if (activeTab === 'index-health-monitor') {
      return (
        <div className="p-6">
          <IndexHealthMonitor
            tables={tables}
            onRebuildIndex={(idxName) => handleRebuildIndex(idxName)}
            onDropIndex={(idxName, tblName) => {
              setRemovedIndexes((prev) => [...prev, idxName]);
            }}
            onSuccessNotice={(msg) => {
              setImportSuccessNotice(msg);
              setTimeout(() => setImportSuccessNotice(null), 5000);
            }}
          />
        </div>
      );
    }
    if (activeTab === 'index-dependency') {
      return renderIndexDependencyVisualization();
    }
    if (activeTab === 'dependency-chain') {
      const indexDependencies = [
        {
          indexName: 'idx_transactions_email_status',
          targetTable: 'transactions',
          type: 'Composite B-Tree',
          riskLevel: 'Critical Risk',
          riskBadge: 'bg-rose-100 text-rose-800 border-rose-300',
          removalConsequence: 'Dropping this index forces full sequential table scans (O(n)), increasing user lookup latency from 1.2ms to 840ms and causing API gateway timeouts under peak traffic.',
          dependentQueries: [
            { name: 'Q1: Customer Email & Status Filtering', impact: 'O(log n) Index Scan → O(n) Full Heap Scan' },
            { name: 'Q4: Active Account Support Lookup', impact: 'Index Seek → Sequential Scan Timeout' }
          ],
          dependentReports: [
            { name: 'Customer Success Daily Audit Report', impact: 'Report generation time increases by 4,200%' },
            { name: 'Billing & Subscription Status Dashboard', impact: 'API connection pool lock contention' }
          ]
        },
        {
          indexName: 'idx_line_items_tx',
          targetTable: 'line_items',
          type: 'Foreign Key B-Tree',
          riskLevel: 'High Risk',
          riskBadge: 'bg-orange-100 text-orange-800 border-orange-300',
          removalConsequence: 'Removes foreign key join acceleration, re-introducing the synchronous N+1 subquery storm (100+ separate roundtrips per page) and risking connection pool exhaustion.',
          dependentQueries: [
            { name: 'Q6: Relational Line Items Join', impact: 'Batched Join → 100+ Unbatched N+1 Queries' },
            { name: 'Q8: Order Fulfillment Dispatch', impact: 'Thread lock contention on connection pool' }
          ],
          dependentReports: [
            { name: 'Daily E-Commerce Sales & Line Item Summary', impact: 'Database socket exhaustion and query timeout' },
            { name: 'Inventory & Stock Dispatch Audit', impact: 'Delayed fulfillment batch processing' }
          ]
        },
        {
          indexName: 'idx_transactions_category_amount',
          targetTable: 'transactions',
          type: 'Composite B-Tree',
          riskLevel: 'High Risk',
          riskBadge: 'bg-amber-100 text-amber-800 border-amber-300',
          removalConsequence: 'Disables sorted category and amount range index traversal, forcing SQLite/PostgreSQL to allocate RAM/disk temporary sort files and spilling sort memory.',
          dependentQueries: [
            { name: 'Q2: Category Revenue Filtering', impact: 'Index Scan Backward → Explicit Sort in RAM' },
            { name: 'Q5: High-Value Transaction Audit', impact: 'Bitmap Heap Scan + Costly Sort' }
          ],
          dependentReports: [
            { name: 'Executive Revenue Breakdown by Category', impact: 'Memory spill warnings and slow dashboard response' },
            { name: 'Fraud & High-Value Alert Monitor', impact: 'Delayed real-time anomaly detection' }
          ]
        },
        {
          indexName: 'idx_customers_tier_created',
          targetTable: 'customers',
          type: 'Composite B-Tree',
          riskLevel: 'Medium Risk',
          riskBadge: 'bg-blue-100 text-blue-800 border-blue-300',
          removalConsequence: 'Removes pre-sorted order delivery for customer tiers, requiring memory sort buffers to sort records descending by creation date.',
          dependentQueries: [
            { name: 'Q3: Enterprise Customer Signups', impact: 'Zero-Sort Delivery → Explicit Sort Buffer' },
            { name: 'Q7: VIP Cohort Retention Check', impact: 'Slower pagination and list rendering' }
          ],
          dependentReports: [
            { name: 'VIP Customer Growth & Retention Dashboard', impact: '140% increase in CPU time during report queries' },
            { name: 'Enterprise Account Activity Audit', impact: 'Slightly elevated query execution latency' }
          ]
        }
      ];

      return (
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-white">
          <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                <Link className="w-4 h-4 text-indigo-700" />
                <span>Dependency Tree View: Index Impact &amp; Removal Risk Analysis</span>
              </h3>
              <button
                type="button"
                id="btn-auto-resolve-conflicts"
                data-testid="btn-auto-resolve-conflicts"
                onClick={() => {
                  setImportSuccessNotice('Successfully resolved conflicting table dependencies by intelligently merging overlapping composite indexes on `transactions`. Write lock contention reduced by 48%!');
                  setTimeout(() => setImportSuccessNotice(null), 5000);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                title="Intelligently suggests and merges index reordering when multiple critical reports share the same bottlenecked table"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Resolve Conflicts (Merge Shared Table Indexes)</span>
              </button>
            </div>
            <p className="text-xs text-indigo-900">
              Visualizes the nested hierarchy of dependent queries and enterprise reports tied to each database index. Highlights performance degradation and business risk if an index is pruned or removed.
            </p>
          </div>

          <div className="space-y-4">
            {indexDependencies.map((dep, idx) => {
              const isLocked = lockedIndexes.includes(dep.indexName);
              const isRemoved = removedIndexes.includes(dep.indexName);

              return (
                <div key={idx} className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
                      <span className="font-mono font-bold text-xs text-zinc-900">{dep.indexName}</span>
                      <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                        {dep.targetTable} • {dep.type}
                      </span>
                      {isLocked && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-700" />
                          LOCKED (Protected)
                        </span>
                      )}
                      {isRemoved && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold">
                          REMOVED
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${dep.riskBadge}`}>
                      Risk of Removal: {dep.riskLevel}
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Consequences of Removal / Pruning:</span>
                    </div>
                    <p className="text-rose-900 text-[11px] leading-relaxed">
                      {dep.removalConsequence}
                    </p>
                  </div>

                  {/* Nested Dependent Queries & Reports Tree */}
                  <div className="pl-4 border-l-2 border-indigo-200 space-y-3 pt-1">
                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-indigo-600" />
                        <span>Directly Dependent Queries ({dep.dependentQueries.length})</span>
                      </h5>
                      <div className="space-y-1.5">
                        {dep.dependentQueries.map((q, qi) => {
                          const edgeKey = `${dep.indexName}-query-${qi}`;
                          const isDisabled = !!disabledImpactEdges[edgeKey];
                          return (
                            <div key={qi} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-all ${isDisabled ? 'bg-zinc-200/50 border-zinc-300 opacity-60' : 'bg-zinc-50 border-zinc-200/80'}`}>
                              <span className={`font-bold ${isDisabled ? 'line-through text-zinc-500' : 'text-zinc-800'}`}>└─ {q.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded border ${isDisabled ? 'text-zinc-500 bg-zinc-200 border-zinc-300' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                                  {isDisabled ? 'Edge Bypassed (0ms impact)' : q.impact}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer" title="Toggle index relation edge">
                                  <input
                                    type="checkbox"
                                    id={`toggle-edge-${dep.indexName}-q-${qi}`}
                                    data-testid={`toggle-edge-${dep.indexName}-q-${qi}`}
                                    checked={!isDisabled}
                                    onChange={() => {
                                      setDisabledImpactEdges((prev) => ({ ...prev, [edgeKey]: !isDisabled }));
                                      setImportSuccessNotice(isDisabled ? `Enabled edge relation for query "${q.name}".` : `Disabled edge relation for query "${q.name}". Impact recalculated.`);
                                      setTimeout(() => setImportSuccessNotice(null), 4000);
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-purple-600" />
                        <span>Dependent Enterprise Reports ({dep.dependentReports.length})</span>
                      </h5>
                      <div className="space-y-1.5">
                        {dep.dependentReports.map((r, ri) => {
                          const edgeKey = `${dep.indexName}-report-${ri}`;
                          const isDisabled = !!disabledImpactEdges[edgeKey];
                          return (
                            <div key={ri} className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${isDisabled ? 'bg-zinc-200/50 border-zinc-300 opacity-60' : 'bg-zinc-50 border-zinc-200/80'}`}>
                              <span className={`font-medium ${isDisabled ? 'line-through text-zinc-500' : 'text-zinc-800'}`}>└─ 📊 {r.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${isDisabled ? 'text-zinc-500 bg-zinc-200 border-zinc-300' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                                  {isDisabled ? 'Edge Bypassed (Lock Contention Cleared)' : r.impact}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer" title="Toggle index relation edge">
                                  <input
                                    type="checkbox"
                                    id={`toggle-edge-${dep.indexName}-r-${ri}`}
                                    data-testid={`toggle-edge-${dep.indexName}-r-${ri}`}
                                    checked={!isDisabled}
                                    onChange={() => {
                                      setDisabledImpactEdges((prev) => ({ ...prev, [edgeKey]: !isDisabled }));
                                      setImportSuccessNotice(isDisabled ? `Enabled report edge "${r.name}".` : `Disabled report edge "${r.name}". Impact recalculated.`);
                                      setTimeout(() => setImportSuccessNotice(null), 4000);
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className={`grid grid-cols-1 min-h-[500px] ${showAiSuggestionsSidePanel ? 'lg:grid-cols-12' : 'lg:grid-cols-4'}`}>
        {/* Left Sidebar: Table List */}
        <div className={`p-4 bg-zinc-50/80 border-r border-zinc-200 space-y-2 ${showAiSuggestionsSidePanel ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-2">
            Database Tables ({tables.length})
          </h3>
          {tables.map((tbl) => {
            const isSelected = tbl.name === selectedTable;
            return (
              <button
                key={tbl.name}
                type="button"
                onClick={() => setSelectedTable(tbl.name)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Table className={`w-4 h-4 ${isSelected ? 'text-indigo-200' : 'text-indigo-600'}`} />
                  <div>
                    <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                      <span>{tbl.name}</span>
                      {headerSearchMetrics.isFiltering && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                          (headerSearchMetrics.tableMatches[tbl.name] || 0) > 0
                            ? isSelected
                              ? 'bg-indigo-900 text-indigo-100'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-zinc-200 text-zinc-500'
                        }`}>
                          {headerSearchMetrics.tableMatches[tbl.name] || 0} match
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-zinc-500'}`}>
                      {tbl.columns.length} columns • {tbl.indexes.length} indexes
                    </div>
                  </div>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
              </button>
            );
          })}

          {/* Bottleneck Recommendation Box */}
          <div className="mt-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Query Bottleneck Detected</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Searching by <code className="font-mono bg-amber-100 px-1 rounded">customer_email</code> or <code className="font-mono bg-amber-100 px-1 rounded">amount</code> currently performs full table scans on 50,000 records.
            </p>
          </div>

          {/* AI-Driven Suggestions Quick Callout Box */}
          <div className="mt-4 p-3.5 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200 rounded-xl text-xs space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>AI Index Suggestions</span>
              </div>
              <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                {indexSuggestions.filter(s => !s.isApplied).length} Available
              </span>
            </div>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Workload engine detected table join &amp; filter clause bottlenecks. Inspect the &ldquo;Why&rdquo; behind each recommendation.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                id="btn-sidebar-open-complexity-heatmap"
                data-testid="btn-sidebar-open-complexity-heatmap"
                onClick={() => {
                  setShowAiSuggestionsSidePanel(true);
                  setSidePanelViewMode('complexity-heatmap');
                }}
                className="w-full py-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-all shadow-2xs flex items-center justify-center gap-1"
                title="Display Complexity Heatmap in side panel"
              >
                <Flame className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                <span>Complexity Heatmap</span>
                <span className="font-mono text-[9px] bg-white/20 px-1 rounded ml-0.5">
                  Tree
                </span>
              </button>
              <button
                type="button"
                id="btn-sidebar-open-ai-side-panel"
                data-testid="btn-sidebar-open-ai-side-panel"
                onClick={() => {
                  setShowAiSuggestionsSidePanel(true);
                  setSidePanelViewMode('suggestions');
                }}
                className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-all shadow-2xs flex items-center justify-center gap-1"
                title="Display AI-Driven Index Suggestion side panel in Explorer view"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>AI Suggestions Side Panel</span>
                <span className="font-mono text-[9px] bg-white/20 px-1 rounded ml-0.5">
                  {showAiSuggestionsSidePanel && sidePanelViewMode === 'suggestions' ? 'Active' : 'Open'}
                </span>
              </button>
              <button
                type="button"
                id="btn-sidebar-open-suggestions-why"
                data-testid="btn-sidebar-open-suggestions-why"
                onClick={() => setShowSuggestIndexesModal(true)}
                className="w-full py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1"
              >
                <span>Full Diagnostics Modal</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
              <button
                type="button"
                id="btn-sidebar-bulk-import-indices"
                data-testid="btn-sidebar-bulk-import-indices"
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportActiveTab('upload');
                }}
                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-semibold rounded-lg text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                title="Accept a JSON file of index configurations to quickly prototype different database schema states"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bulk Import Indices (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Main Area: Table Schema & Index Audit */}
        <div className={`p-6 space-y-6 overflow-y-auto ${
          showAiSuggestionsSidePanel ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-3'
        }`}>
          {/* Estimated Speed-Up Visual Gauge */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 rounded-2xl border border-indigo-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">
                  Estimated Query Execution Speed-Up Gauge
                </h4>
                <p className="text-xs text-zinc-500">
                  Dynamic performance acceleration derived from active B-Tree indexes, caching, and batch eager loading.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:w-48 bg-zinc-200 h-3 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    speedUpPercent > 80
                      ? 'bg-emerald-600'
                      : speedUpPercent > 50
                      ? 'bg-indigo-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${speedUpPercent}%` }}
                />
              </div>
              <span className="font-mono font-bold text-sm text-zinc-900 min-w-[48px] text-right">
                {speedUpPercent}%
              </span>
            </div>
          </div>

          {/* Global Index Efficiency Summary Card */}
          {(() => {
            const totalActiveIndexesCount = tables.reduce((acc, t) => acc + t.indexes.filter(i => i.active && !removedIndexes.includes(i.name)).length, 0);
            const totalCompositeIndexesCount = createdCompositeIndexes.length;
            const aggregatePerformanceGainPercent = Math.min(98.5, Math.max(12.0, speedUpPercent * 0.9 + totalActiveIndexesCount * 4.5));
            const estimatedMaintenanceCostMb = +(totalActiveIndexesCount * 1.8 + totalCompositeIndexesCount * 3.2).toFixed(1);
            const writeAmplificationOverhead = +(totalActiveIndexesCount * 0.6 + totalCompositeIndexesCount * 1.2).toFixed(1);
            const netIndexEfficiencyScore = Math.min(99.0, Math.max(40.0, +(aggregatePerformanceGainPercent / Math.max(1, writeAmplificationOverhead * 0.35)).toFixed(1)));
            return (
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-white to-teal-50 rounded-2xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                      <span>Global Index Efficiency Summary</span>
                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                        Score: {netIndexEfficiencyScore}%
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Aggregate performance gain vs. storage &amp; write maintenance overhead across {totalActiveIndexesCount} active indexes.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full sm:w-auto font-mono text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 shadow-2xs text-center">
                    <span className="text-[10px] text-emerald-700 block uppercase font-semibold">Perf Gain</span>
                    <strong className="text-emerald-900 text-sm font-extrabold">+{aggregatePerformanceGainPercent.toFixed(1)}%</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-zinc-200 shadow-2xs text-center">
                    <span className="text-[10px] text-zinc-500 block uppercase font-semibold">Maint Cost</span>
                    <strong className="text-zinc-900 text-sm font-extrabold">{estimatedMaintenanceCostMb} MB</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-zinc-200 shadow-2xs text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-zinc-500 block uppercase font-semibold">Write Amp</span>
                    <strong className="text-amber-700 text-sm font-extrabold">{writeAmplificationOverhead}%</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Database Storage Impact Analysis Tool Card */}
          {(() => {
            const allIndexesFlattened = tables.flatMap(t => t.indexes);
            const unusedIndexesCount = allIndexesFlattened.filter(i => (!i.active || i.hitRate < 35 || removedIndexes.includes(i.name))).length + (removedIndexes.length > 0 ? 0 : 2);
            const totalStorageMb = +(allIndexesFlattened.length * 3.4).toFixed(1);
            const potentialDropSavingsMb = +(unusedIndexesCount * 3.1).toFixed(1);
            const potentialCompressionSavingsMb = +(totalStorageMb * 0.38).toFixed(1);
            const potentialDropSavingsKb = Math.round(potentialDropSavingsMb * 1024);
            const potentialCompressionSavingsKb = Math.round(potentialCompressionSavingsMb * 1024);

            return (
              <div className="p-4 bg-gradient-to-r from-cyan-50 via-white to-indigo-50 rounded-2xl border border-cyan-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-600 text-white rounded-xl shadow-xs">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                      <span>Database Storage Impact Analysis</span>
                      <span className="text-[10px] font-mono bg-cyan-100 text-cyan-900 px-2 py-0.5 rounded font-bold">
                        {unusedIndexesCount} Unused Indexes Found
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Calculates potential disk footprint reduction if unutilized or redundant indexes were dropped or compressed.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-cyan-200 shadow-2xs text-center">
                    <span className="text-[10px] text-cyan-800 block uppercase font-semibold">Drop Savings</span>
                    <strong className="text-cyan-950 text-sm font-extrabold">{potentialDropSavingsMb} MB</strong>
                    <span className="text-[9px] text-zinc-400 block">({potentialDropSavingsKb.toLocaleString()} KB)</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-200 shadow-2xs text-center">
                    <span className="text-[10px] text-indigo-700 block uppercase font-semibold">Compression Savings</span>
                    <strong className="text-indigo-900 text-sm font-extrabold">{potentialCompressionSavingsMb} MB</strong>
                    <span className="text-[9px] text-zinc-400 block">({potentialCompressionSavingsKb.toLocaleString()} KB)</span>
                  </div>
                  <button
                    type="button"
                    id="btn-open-index-cleanup-modal-storage"
                    data-testid="btn-open-index-cleanup-modal-storage"
                    onClick={() => setShowIndexCleanupModal(true)}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Prune Unused</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Index Fragmentation Analysis Chart Card */}
          {(() => {
            const tableIndexes = currentTableData.indexes.filter(i => !removedIndexes.includes(i.name));
            return (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Index Physical Fragmentation &amp; Reorganization Advisor
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Threshold: &gt;30% triggers REORGANIZE recommendation
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tableIndexes.map((idx, idxIdx) => {
                    const fragPercent = +(((idx.name.length * 7 + idxIdx * 19) % 55) + (idx.active ? 8 : 42)).toFixed(1);
                    const needsReorg = fragPercent > 30;

                    return (
                      <div key={idx.name} className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs font-mono ${
                        needsReorg ? 'bg-rose-50/90 border-rose-300 text-rose-950' : 'bg-white border-zinc-200 text-zinc-900'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate" title={idx.name}>{idx.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            needsReorg ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {fragPercent}% Frag
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              needsReorg ? 'bg-rose-600' : fragPercent > 15 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, fragPercent)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-200/60 font-sans">
                          <span className="text-zinc-500">Type: B-Tree Index</span>
                          {needsReorg ? (
                            <button
                              type="button"
                              onClick={() => {
                                setReindexedIndexes(prev => Array.from(new Set([...prev, idx.name])));
                              }}
                              disabled={reindexedIndexes.includes(idx.name)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] cursor-pointer shadow-2xs transition-all disabled:opacity-50"
                            >
                              {reindexedIndexes.includes(idx.name) ? 'Reorganized ✓' : 'REORGANIZE (SQL)'}
                            </button>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[10px]">Optimal Health</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Table Columns & Index Coverage (Baseline vs Current Overlay) */}
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Table Columns &amp; Index Coverage
                </h4>
                {compareWithBaseline && (
                  <span className="text-amber-800 font-sans font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-600" />
                    <span>Baseline Comparison Active</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {currentTableData.name} ({currentTableData.columns.length} columns)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 text-[10px] uppercase font-bold">
                    <th className="pb-2 font-semibold">Column</th>
                    <th className="pb-2 font-semibold">Type</th>
                    {compareWithBaseline && <th className="pb-2 font-semibold text-rose-700">Default Baseline Coverage</th>}
                    <th className="pb-2 font-semibold text-indigo-700">Current Schema Coverage</th>
                    <th className="pb-2 font-semibold text-emerald-700 text-right">Performance Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {currentTableData.columns.map((col) => {
                    const isColIndexedInBaseline = col.isPk;
                    let coverageLabel = 'Unindexed (Seq Scan O(n))';
                    let coverageBadge = 'bg-zinc-100 text-zinc-600';
                    let impactText = 'O(n) Sequential Scan';
                    let impactClass = 'text-zinc-500';

                    if (col.isPk) {
                      coverageLabel = 'Primary Key (Clustered B-Tree)';
                      coverageBadge = 'bg-indigo-100 text-indigo-800 font-bold';
                      impactText = 'O(1) Constant Base';
                      impactClass = 'text-indigo-700 font-bold';
                    } else if (col.name === 'created_at') {
                      const isPruned = removedIndexes.includes('idx_transactions_date');
                      coverageLabel = isPruned ? 'Pruned (0 Hits, Saved 2.4MB)' : 'B-Tree (idx_transactions_date)';
                      coverageBadge = isPruned ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700';
                      impactText = isPruned ? '+14% Write Latency Saved' : 'Unutilized (0 Hits)';
                      impactClass = isPruned ? 'text-emerald-700 font-bold' : 'text-zinc-500';
                    } else if (col.name === 'customer_email' && (createdCompositeIndexes.includes('email_status') || createdCustomIndexes.includes('customer_email'))) {
                      coverageLabel = createdCompositeIndexes.includes('email_status') ? 'Composite B-Tree (Email + Status)' : 'Single-Column B-Tree';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.6% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if (col.name === 'amount' && (createdCompositeIndexes.includes('category_amount') || createdCustomIndexes.includes('amount'))) {
                      coverageLabel = createdCompositeIndexes.includes('category_amount') ? 'Composite B-Tree (Category + Amount)' : 'Single-Column B-Tree';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.2% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if ((col.name === 'status' || col.name === 'category') && flags.btreeIndexing) {
                      coverageLabel = 'Composite B-Tree (Status + Category)';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.5% Speedup (O(log n))';
                      impactClass = 'text-emerald-700 font-bold';
                    } else if (col.name === 'transaction_id' && flags.batchEagerLoading) {
                      coverageLabel = 'Foreign Key B-Tree (idx_line_items_tx)';
                      coverageBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                      impactText = '99.6% Speedup (Batched Join)';
                      impactClass = 'text-emerald-700 font-bold';
                    }

                    return (
                      <tr key={col.name} className="hover:bg-zinc-100/50 transition-colors">
                        <td className="py-2 font-bold text-zinc-900 flex items-center gap-1.5">
                          {col.isPk && <Key className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{col.name}</span>
                        </td>
                        <td className="py-2 text-zinc-500 text-[11px]">{col.type}</td>
                        {compareWithBaseline && (
                          <td className="py-2 text-[11px]">
                            {isColIndexedInBaseline ? (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">Clustered PK</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold line-through">
                                Unindexed (Seq Scan)
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded ${coverageBadge}`}>
                            {coverageLabel}
                          </span>
                        </td>
                        <td className={`py-2 text-[11px] text-right ${impactClass}`}>
                          {impactText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Index List Grouped by Target Entity & Table with Collapsible Categories */}
          <div id="indexes-grouped-list" data-testid="grouped-index-list" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200">
              <div>
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                  <span>Active Index Structures Grouped by Entity</span>
                  <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    {tables.reduce((acc, t) => acc + t.indexes.length, 0)} Total Indexes
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Indexes grouped by the table or entity they target, with collapsible categories for rapid scanning and navigation of large schemas.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Real-time Filter Text Input Field */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    id="filter-indexes-input"
                    name="filter-indexes-input"
                    data-testid="filter-indexes-input"
                    value={indexSearchQuery}
                    onChange={(e) => setIndexSearchQuery(e.target.value)}
                    placeholder="Filter by column name, index type, or table name..."
                    aria-label="Filter indexes by column name, index type, or table name"
                    className="filter-indexes-input pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-52 sm:w-72 shadow-2xs font-mono transition-all"
                  />
                  {indexSearchQuery && (
                    <button
                      type="button"
                      id="btn-clear-index-filter"
                      data-testid="btn-clear-index-filter"
                      onClick={() => setIndexSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                      title="Clear filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Category Expand / Collapse Buttons */}
                <button
                  type="button"
                  id="btn-expand-all-categories"
                  data-testid="btn-expand-all-categories"
                  onClick={() => setCollapsedCategories({})}
                  className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  title="Expand all table & entity categories"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Expand All</span>
                </button>
                <button
                  type="button"
                  id="btn-collapse-all-categories"
                  data-testid="btn-collapse-all-categories"
                  onClick={() => {
                    const allCol: Record<string, boolean> = {};
                    tables.forEach((t) => {
                      allCol[t.name] = true;
                    });
                    setCollapsedCategories(allCol);
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  title="Collapse all categories for high-level schema scanning"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Collapse All</span>
                </button>

                {/* Index Ranking & Sorting Selector */}
                <div className="flex items-center gap-1.5 bg-white border border-zinc-300 px-2.5 py-1 rounded-lg text-xs shadow-2xs">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-zinc-700 text-[11px] shrink-0">Rank by:</span>
                  <select
                    id="select-index-rank-sort"
                    data-testid="select-index-rank-sort"
                    value={indexRankSort}
                    onChange={(e) => setIndexRankSort(e.target.value as any)}
                    className="bg-transparent font-bold text-indigo-900 text-xs focus:outline-none cursor-pointer"
                    title="Rank indexes by overall value (Index Impact Score), query latency contribution, query improvement, write penalty, or health"
                  >
                    <option value="impact_desc">Index Impact Score (High ➔ Low)</option>
                    <option value="impact_asc">Index Impact Score (Low ➔ High / Pruning)</option>
                    <option value="latency_desc">Query Latency Contribution (High ➔ Low / Most Expensive)</option>
                    <option value="latency_asc">Query Latency Contribution (Low ➔ High / Least Expensive)</option>
                    <option value="ratio_desc">Usage Ratio (Read Heavy First ➔ High ROI)</option>
                    <option value="ratio_asc">Usage Ratio (Write Heavy First ➔ Bottlenecks)</option>
                    <option value="query_desc">Query Speedup (+%)</option>
                    <option value="write_asc">Lowest Write Penalty (-%)</option>
                    <option value="health_desc">Health Score</option>
                    <option value="name">Alphabetical</option>
                  </select>
                </div>

                {/* View Mode Toggle: Table View vs Grouped Cards */}
                <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 bg-zinc-100 shadow-2xs">
                  <button
                    type="button"
                    id="btn-index-view-table"
                    data-testid="btn-index-view-table"
                    onClick={() => setIndexListLayout('table')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      indexListLayout === 'table'
                        ? 'bg-white text-indigo-900 shadow-xs font-bold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Switch to Index List Table view featuring the 'Index Impact Score' column"
                  >
                    <Table className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    id="btn-index-view-cards"
                    data-testid="btn-index-view-cards"
                    onClick={() => setIndexListLayout('cards')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      indexListLayout === 'cards'
                        ? 'bg-white text-indigo-900 shadow-xs font-bold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Switch to Entity Grouped Cards view"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cards View</span>
                  </button>
                  <button
                    type="button"
                    id="btn-index-view-impact-map"
                    data-testid="btn-index-view-impact-map"
                    onClick={() => {
                      setIndexListLayout('map');
                      setShowIndexImpactMap(true);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      indexListLayout === 'map'
                        ? 'bg-white text-indigo-900 shadow-xs font-bold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Switch to coordinate-based Index Impact Map view"
                  >
                    <Compass className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Impact Map</span>
                  </button>
                </div>

                {/* Group by Table Toggle Button */}
                <button
                  type="button"
                  id="btn-index-group-by-table"
                  data-testid="btn-index-group-by-table"
                  onClick={() => setIsGroupByTable(!isGroupByTable)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isGroupByTable
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                  }`}
                  title="Visually restructure the index list into collapsible segments organized by database table"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Group by Table</span>
                  {isGroupByTable && (
                    <span className="font-mono text-[10px] bg-indigo-800 text-indigo-100 px-1.5 py-0.2 rounded font-bold">
                      ON
                    </span>
                  )}
                </button>

                {/* What-If Analysis Toggle Button */}
                <button
                  type="button"
                  id="btn-what-if-analysis-toggle"
                  data-testid="btn-what-if-analysis-toggle"
                  onClick={() => setIsWhatIfAnalysisActive(!isWhatIfAnalysisActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isWhatIfAnalysisActive
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                  }`}
                  title="Temporarily modify index columns and observe projected latency changes in ExplainPlanViewer without database writes"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>What-If Analysis {Object.keys(whatIfModifications).length > 0 ? `(${Object.keys(whatIfModifications).length})` : ''}</span>
                  {isWhatIfAnalysisActive && (
                    <span className="font-mono text-[10px] bg-purple-800 text-purple-100 px-1.5 py-0.2 rounded font-bold">
                      ON
                    </span>
                  )}
                </button>

                {/* Lock Contention Heatmap Toggle Button */}
                <button
                  type="button"
                  id="btn-lock-contention-heatmap-toggle"
                  data-testid="btn-lock-contention-heatmap-toggle"
                  onClick={() => setIsLockContentionHeatmapActive(!isLockContentionHeatmapActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isLockContentionHeatmapActive
                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs ring-1 ring-rose-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                  }`}
                  title="Visualize tables experiencing high wait times or deadlocks using color-coded lock contention nodes"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>Lock Contention Heatmap</span>
                  {isLockContentionHeatmapActive && (
                    <span className="font-mono text-[10px] bg-white/25 text-white px-1.5 py-0.2 rounded font-bold">
                      ACTIVE
                    </span>
                  )}
                </button>

                {/* Batch Protection Toggle Button */}
                <button
                  type="button"
                  id="btn-batch-protection-toggle"
                  data-testid="btn-batch-protection-toggle"
                  onClick={() => handleToggleBatchProtection(!batchProtectionEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    batchProtectionEnabled
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                  }`}
                  title="Automatically apply 'Protected' status to all newly created indexes for a grace period of 24 hours to prevent premature auto-cleanup"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                  <span>Batch Protection (24h Grace)</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${batchProtectionEnabled ? 'bg-white/25 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                    {batchProtectionEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Index Impact Heatmap Toggle Button in Header */}
                <button
                  type="button"
                  id="btn-toggle-index-impact-heatmap"
                  data-testid="toggle-index-impact-heatmap"
                  onClick={() => setShowIndexImpactHeatmap(!showIndexImpactHeatmap)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showIndexImpactHeatmap
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-1 ring-rose-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle Index Impact Heatmap to shade index list rows according to their total query latency contribution"
                  aria-label="Toggle Index Impact Heatmap"
                >
                  <Flame className={`w-3.5 h-3.5 ${showIndexImpactHeatmap ? 'text-amber-200 animate-pulse' : 'text-rose-500'}`} />
                  <span>Index Impact Heatmap</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showIndexImpactHeatmap ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {showIndexImpactHeatmap ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Usage Heatmap (Read-to-Write Ratio) Toggle Button in Header */}
                <button
                  type="button"
                  id="btn-toggle-usage-heatmap"
                  data-testid="toggle-usage-heatmap"
                  onClick={() => setShowUsageHeatmap(!showUsageHeatmap)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showUsageHeatmap
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle Usage Heatmap: Color-codes indexes based on read-to-write ratio, making Read Heavy (Green) vs Write Heavy (Red) instantly obvious"
                  aria-label="Toggle Usage Heatmap"
                >
                  <TrendingUp className={`w-3.5 h-3.5 ${showUsageHeatmap ? 'text-emerald-200 animate-pulse' : 'text-emerald-600'}`} />
                  <span>Usage Heatmap (R/W)</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showUsageHeatmap ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                    {showUsageHeatmap ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Index Impact Map Toggle Button */}
                <button
                  type="button"
                  id="btn-toggle-index-impact-map"
                  data-testid="btn-toggle-index-impact-map"
                  onClick={() => {
                    const nextState = !showIndexImpactMap;
                    setShowIndexImpactMap(nextState);
                    if (nextState) setIndexListLayout('map');
                    else if (indexListLayout === 'map') setIndexListLayout('table');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showIndexImpactMap || indexListLayout === 'map'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle visual Index Impact Map: Displays coordinate grid correlating Read/Write activity with query execution costs to isolate inefficient index clusters"
                >
                  <Compass className={`w-3.5 h-3.5 ${showIndexImpactMap || indexListLayout === 'map' ? 'text-indigo-200' : 'text-indigo-600'}`} />
                  <span>Index Impact Map</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showIndexImpactMap || indexListLayout === 'map' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                    {showIndexImpactMap || indexListLayout === 'map' ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Export Impact Report Button in Index List Header */}
                <button
                  type="button"
                  id="btn-toolbar-export-impact-report"
                  data-testid="btn-toolbar-export-impact-report"
                  onClick={handleExportImpactReport}
                  disabled={isExportingImpactReport}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 hover:border-zinc-400 text-zinc-800 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                  title="Generate a structured JSON file containing the current index list, their associated health scores, and latency contribution metrics for external analysis"
                  aria-label="Export Impact Report"
                >
                  {isExportingImpactReport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-rose-600" />
                      <span>Export Impact Report</span>
                    </>
                  )}
                </button>

                {/* Show Query Impact Toggle Button */}
                <button
                  type="button"
                  id="btn-toggle-query-impact-quick"
                  data-testid="btn-toggle-query-impact-quick"
                  onClick={() => setShowQueryImpact(!showQueryImpact)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showQueryImpact
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle dynamic mini-execution plan previews directly under each index listing"
                >
                  <Activity className={`w-3.5 h-3.5 ${showQueryImpact ? 'text-white' : 'text-indigo-600'}`} />
                  <span>Show Query Impact</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showQueryImpact ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                    {showQueryImpact ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Quick Bulk Optimize Button */}
                <button
                  type="button"
                  id="btn-quick-bulk-optimize"
                  data-testid="btn-quick-bulk-optimize"
                  onClick={handleApplyBulkOptimize}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                    bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-xs'
                  }`}
                  title="Calculate optimal changes for all listed indexes and apply all improvements at once"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkOptimizationPlan.isFullyOptimized
                      ? '✓ All Optimal'
                      : `Bulk Optimize (${bulkOptimizationPlan.pendingChanges.length})`}
                  </span>
                </button>

                {/* Complexity Heatmap Side Panel Quick Toggle Button */}
                <button
                  type="button"
                  id="btn-toolbar-complexity-heatmap"
                  data-testid="btn-toolbar-complexity-heatmap"
                  onClick={() => {
                    if (showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap') {
                      setShowAiSuggestionsSidePanel(false);
                    } else {
                      setShowAiSuggestionsSidePanel(true);
                      setSidePanelViewMode('complexity-heatmap');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-1 ring-rose-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Open Complexity Heatmap in side panel to inspect dependency tree nodes and downstream query blast radius"
                >
                  <Flame className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap' ? 'text-amber-200 animate-pulse' : 'text-rose-600'}`} />
                  <span>Complexity Heatmap</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'}`}>
                    Tree
                  </span>
                </button>

                {/* AI Suggestions Side Panel Quick Toggle Button */}
                <button
                  type="button"
                  id="btn-toggle-ai-sidepanel-quick"
                  data-testid="btn-toggle-ai-sidepanel-quick"
                  onClick={() => setShowAiSuggestionsSidePanel(!showAiSuggestionsSidePanel)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    showAiSuggestionsSidePanel
                      ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Toggle AI-Driven Index Suggestion side panel in Explorer view"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel ? 'text-amber-300' : 'text-purple-600'}`} />
                  <span>AI Suggestions</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${showAiSuggestionsSidePanel ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                    {showAiSuggestionsSidePanel ? 'OPEN' : '4'}
                  </span>
                </button>

                {/* Bulk Import Indices Quick Button */}
                <button
                  type="button"
                  id="btn-quick-bulk-import-indices"
                  data-testid="btn-quick-bulk-import-indices"
                  onClick={() => {
                    setShowBulkImportModal(true);
                    setBulkImportActiveTab('upload');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700"
                  title="Bulk import indices from a JSON configuration file to prototype database schema states"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Bulk Import Indices</span>
                </button>

                {/* Cluster Analysis Toggle Button */}
                <button
                  type="button"
                  id="btn-cluster-analysis-toggle"
                  data-testid="btn-cluster-analysis-toggle"
                  onClick={() => setShowClusterAnalysisModal(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    clusterContentionResolved
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Analyze index write clusters triggering lock contention and deadlocks during concurrent operations"
                >
                  <Activity className={`w-3.5 h-3.5 ${clusterContentionResolved ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span>Cluster Analysis</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${clusterContentionResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {clusterContentionResolved ? '✓ Resolved' : '2 Groups'}
                  </span>
                </button>

                {/* Conflict Resolution Dashboard Toggle Button */}
                <button
                  type="button"
                  id="btn-conflict-resolution-toggle"
                  data-testid="btn-conflict-resolution-toggle"
                  onClick={() => setShowConflictDashboardModal(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all border ${
                    Object.keys(resolvedConflicts).length >= 2
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="Open Conflict Resolution Dashboard to manage identical column sets and redundant covering indexes"
                >
                  <GitMerge className={`w-3.5 h-3.5 ${Object.keys(resolvedConflicts).length >= 2 ? 'text-emerald-600' : 'text-indigo-600'}`} />
                  <span>Conflict Resolution</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${Object.keys(resolvedConflicts).length >= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                    {Object.keys(resolvedConflicts).length >= 2 ? '✓ Resolved' : '2 Conflicts'}
                  </span>
                </button>
              </div>
            </div>

            {/* Bulk Import Indices Success Notification Banner */}
            {importSuccessNotice && (
              <div
                id="bulk-import-success-notification"
                data-testid="bulk-import-success-notification"
                className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-white border border-purple-300 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-950 animate-fadeIn shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-purple-950">Index Configuration Prototyped Successfully!</strong>
                    <p className="text-[11px] text-purple-900 mt-0.5">{importSuccessNotice}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportSuccessNotice(null)}
                  className="text-purple-700 hover:text-purple-950 p-1 rounded cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bulk Optimize Success Notification Banner */}
            {bulkOptimizeSuccessNotice && (
              <div
                id="bulk-optimize-success-notification"
                data-testid="bulk-optimize-success-notification"
                className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950 animate-fadeIn shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-bold text-emerald-900">Bulk Optimization Applied Successfully!</strong>
                    <p className="text-[11px] text-emerald-800 mt-0.5">{bulkOptimizeSuccessNotice}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkOptimizeSuccessNotice(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Bulk Schema Optimizer Feature Banner & Single Action Button */}
            <div
              id="bulk-optimize-container"
              data-testid="bulk-optimize-container"
              className="p-4 bg-gradient-to-r from-emerald-50/95 via-teal-50/70 to-indigo-50/85 border border-emerald-200 rounded-2xl shadow-xs space-y-3.5"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-indigo-700 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
                    <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5 font-sans">
                        <span>Bulk Schema Optimizer</span>
                      </h4>
                      {bulkOptimizationPlan.isFullyOptimized ? (
                        <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>All {bulkOptimizationPlan.totalCount} Indexes In Optimal State</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shadow-2xs animate-pulse">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>{bulkOptimizationPlan.pendingChanges.length} Recommended Changes Calculated</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                      Evaluates all listed indexes across tables to calculate the mathematically optimal set of changes (activating missing foreign/composite keys and pruning dead indexes).
                    </p>
                  </div>
                </div>

                {/* The Single Button to Apply All Recommended Improvements At Once */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    id="btn-view-bulk-optimizer-calculation"
                    data-testid="btn-view-bulk-optimizer-calculation"
                    onClick={() => setShowBulkOptimizeModal(true)}
                    className="px-3 py-2 bg-white hover:bg-zinc-50 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs flex items-center gap-1.5"
                    title="Inspect calculated optimal changes breakdown for all listed indexes"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    <span>View Calculations ({bulkOptimizationPlan.pendingChanges.length} Pending)</span>
                  </button>

                  <button
                    type="button"
                    id="btn-apply-bulk-optimize"
                    data-testid="btn-apply-bulk-optimize"
                    onClick={handleApplyBulkOptimize}
                    disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-2 ${
                      bulkOptimizationPlan.isFullyOptimized
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white hover:shadow-md'
                    }`}
                    title="Apply all calculated optimal changes across all listed indexes in a single atomic batch"
                  >
                    {isApplyingBulkOptimize ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Applying Optimal Schema Changes...</span>
                      </>
                    ) : bulkOptimizationPlan.isFullyOptimized ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Schema Fully Optimized (Avg {bulkOptimizationPlan.currentAvgHealth}/100)</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        <span>Apply All Recommended Improvements ({bulkOptimizationPlan.pendingChanges.length} Changes)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Calculated Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-200/70 text-xs">
                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Schema Health Score</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono font-bold text-zinc-900 text-sm">{bulkOptimizationPlan.currentAvgHealth}/100</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {bulkOptimizationPlan.isFullyOptimized ? 'Optimal' : `${bulkOptimizationPlan.projectedAvgHealth}/100`}
                    </span>
                    {!bulkOptimizationPlan.isFullyOptimized && (
                      <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                        +{bulkOptimizationPlan.healthGain} pts
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Optimal vs Total</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono font-bold text-sm">
                    <span className={bulkOptimizationPlan.isFullyOptimized ? 'text-emerald-700' : 'text-amber-700'}>
                      {bulkOptimizationPlan.optimalCount} / {bulkOptimizationPlan.totalCount} Indexes
                    </span>
                    <span className="text-[10px] text-zinc-500 font-sans font-normal">
                      ({Math.round((bulkOptimizationPlan.optimalCount / bulkOptimizationPlan.totalCount) * 100)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Query Latency Gain</span>
                  <div className="flex items-center gap-1 mt-1 font-mono font-bold text-emerald-700 text-sm">
                    <span>Up to 99.6% Speedup</span>
                  </div>
                </div>

                <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Write I/O Overhead</span>
                  <div className="flex items-center gap-1 mt-1 font-mono font-bold text-indigo-700 text-sm">
                    <span>+14% Latency Saved</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Filter Active Notification Banner */}
            {indexSearchQuery && (
              <div
                id="active-filter-notification"
                data-testid="active-filter-notification"
                className="p-2.5 px-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 text-xs text-indigo-950 animate-fadeIn shadow-2xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Filtering indexes in real-time matching: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-900">&ldquo;{indexSearchQuery}&rdquo;</strong>
                  </span>
                  <span className="text-[11px] text-indigo-700">
                    (matching column name, index type, or table name)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIndexSearchQuery('')}
                  className="text-[11px] text-indigo-700 hover:text-indigo-950 font-bold cursor-pointer underline flex items-center gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              </div>
            )}

            {/* Lock Contention Heatmap Overlay Banner */}
            {isLockContentionHeatmapActive && (
              <div
                id="lock-contention-heatmap-overlay"
                data-testid="lock-contention-heatmap-overlay"
                className="p-4 bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white rounded-2xl shadow-lg border border-rose-700 space-y-3 animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-rose-700/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-white/20 text-amber-200 rounded-xl shadow-2xs animate-pulse">
                      <Flame className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-100">
                      Real-Time Lock Contention Heatmap &amp; Deadlock Monitor
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] bg-amber-400 text-zinc-950 px-2 py-0.5 rounded-full font-extrabold shadow-2xs">
                    🔴 High Contention Active
                  </span>
                </div>

                <p className="text-xs text-rose-100">
                  Visualizing database tables experiencing high lock wait times, exclusive row locks, and deadlock hazards during concurrent write bursts:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {tables.slice(0, 3).map((tbl, idx) => {
                    const waitTimeMs = idx === 0 ? 1420 : idx === 1 ? 680 : 190;
                    const statusColor = idx === 0 ? 'bg-rose-600/90 border-rose-400 text-rose-50' : idx === 1 ? 'bg-amber-600/90 border-amber-400 text-amber-50' : 'bg-emerald-600/90 border-emerald-400 text-emerald-50';
                    const riskLevel = idx === 0 ? 'Critical Lock Wait (Deadlock Risk)' : idx === 1 ? 'Moderate Contention' : 'Low Contention / Healthy';

                    return (
                      <div
                        key={`contention-node-${tbl.name}`}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${statusColor}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-mono text-xs flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 opacity-90" />
                            <span>{tbl.entityName || tbl.name}</span>
                          </span>
                          <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/30 text-white">
                            {waitTimeMs}ms wait
                          </span>
                        </div>
                        <div className="text-[11px] opacity-95 flex items-center justify-between">
                          <span>Status:</span>
                          <span className="font-bold">{riskLevel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Batch Protection Active Status Banner */}
            {batchProtectionEnabled && (
              <div
                id="batch-protection-active-banner"
                data-testid="batch-protection-active-banner"
                className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-950 animate-fadeIn shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Batch Protection Active (24h Grace Period):</strong> Newly created batch indexes are automatically locked with <strong>Protected</strong> status to prevent premature auto-cleanup.
                  </span>
                </div>
                <span className="font-mono text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold shrink-0">
                  Grace Period: 24 Hours
                </span>
              </div>
            )}

            {/* Entity Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-zinc-400" />
                <span>Filter Entity:</span>
              </span>
              <button
                type="button"
                id="filter-entity-all"
                data-testid="filter-entity-all"
                onClick={() => setIndexCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                  indexCategoryFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
              >
                All Entities ({tables.reduce((acc, t) => acc + t.indexes.length, 0)})
              </button>
              <button
                type="button"
                id="filter-entity-low-usage"
                data-testid="filter-entity-low-usage"
                onClick={() => setIndexCategoryFilter(indexCategoryFilter === 'low-usage' ? 'all' : 'low-usage')}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  indexCategoryFilter === 'low-usage'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
                title="Filter indexes flagged as low usage (inactive for >7 days)"
              >
                <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                <span>Flagged Low Usage (&gt;7d)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  indexCategoryFilter === 'low-usage' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-950'
                }`}>
                  {lowUsageFlaggedCount}
                </span>
              </button>
              {tables.map((t) => {
                const count = t.indexes.length;
                const isSelected = indexCategoryFilter === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    id={`filter-entity-${t.name}`}
                    data-testid={`filter-entity-${t.name}`}
                    onClick={() => {
                      setIndexCategoryFilter(t.name);
                      setCollapsedCategories((prev) => ({ ...prev, [t.name]: false }));
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-zinc-200 text-zinc-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Index List Views: Ranked Index Table vs Grouped by Table Segments vs Cards vs Impact Map */}
            {(showIndexImpactMap || indexListLayout === 'map') ? (
              <IndexImpactMap
                indexes={indexImpactMapItems}
                onSelectIndex={(idxName) => {
                  handleToggleSelectIndex(idxName);
                }}
                onReindex={(idxName) => handleReindexIndex(idxName)}
                onDropIndex={(idxName) => {
                  setRemovedIndexes((prev) => [...prev, idxName]);
                  setImportSuccessNotice(`🗑️ [Index Dropped] "${idxName}" removed. Observe query plan sequential scan impact.`);
                  setTimeout(() => setImportSuccessNotice(null), 4000);
                }}
                onWhatIf={(idxName) => {
                  const targetIdx = allRankedSchemaIndexes.find(i => i.index.name === idxName);
                  if (targetIdx) {
                    setActiveWhatIfModalIndex({
                      name: targetIdx.index.name,
                      tableName: targetIdx.table,
                      columns: targetIdx.index.columns
                    });
                  }
                }}
                onClose={() => {
                  setShowIndexImpactMap(false);
                  setIndexListLayout('table');
                }}
              />
            ) : indexListLayout === 'table' ? (
              isGroupByTable ? (
                <div id="indexes-grouped-by-table-container" data-testid="indexes-grouped-by-table-container" className="space-y-4">
                  {groupedByTableIndexes.length === 0 ? (
                    <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500 text-xs">
                      No indexes matching &ldquo;{indexSearchQuery}&rdquo; found in the selected filter.
                    </div>
                  ) : (
                    groupedByTableIndexes.map(({ tableName, indexes, avgHealth }) => {
                      const isCollapsed = !!collapsedTables[tableName];
                      const allSelected = indexes.length > 0 && indexes.every((item) => selectedIndexes.includes(item.index.name));
                      const someSelected = indexes.some((item) => selectedIndexes.includes(item.index.name));

                      return (
                        <div
                          key={`grouped-table-${tableName}`}
                          id={`grouped-table-section-${tableName}`}
                          data-testid={`grouped-table-section-${tableName}`}
                          className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs"
                        >
                          {/* Table Segment Header */}
                          <div
                            className="p-3 bg-gradient-to-r from-indigo-50/90 via-white to-zinc-50 border-b border-zinc-200 flex items-center justify-between cursor-pointer select-none"
                            onClick={() => setCollapsedTables((prev) => ({ ...prev, [tableName]: !prev[tableName] }))}
                          >
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                className="text-zinc-500 hover:text-zinc-800 p-0.5 rounded cursor-pointer"
                                aria-label="Toggle section"
                              >
                                {isCollapsed ? <ChevronRight className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
                              </button>
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-zinc-900 font-mono text-sm">{tableName}</span>
                                <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200 font-bold">
                                  {indexes.length} index{indexes.length === 1 ? '' : 'es'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-zinc-500 hidden sm:inline">
                                Avg Health: <strong className={avgHealth >= 80 ? 'text-emerald-700' : 'text-amber-700'}>{avgHealth}/100</strong>
                              </span>
                              <span className="text-indigo-600 font-semibold text-[11px]">
                                {isCollapsed ? 'Expand Table Segment' : 'Collapse Segment'}
                              </span>
                            </div>
                          </div>

                          {/* Table Segment Content */}
                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs font-mono border-collapse">
                                <thead className="bg-zinc-100/90 text-zinc-700 uppercase tracking-wider text-[10px] border-b border-zinc-200 select-none">
                                  <tr>
                                    <th className="py-2.5 px-3 font-bold w-10 text-center">
                                      <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={(el) => {
                                          if (el) {
                                            el.indeterminate = someSelected && !allSelected;
                                          }
                                        }}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const names = indexes.map((i) => i.index.name);
                                          handleSelectAllVisible(names);
                                        }}
                                        className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                      />
                                    </th>
                                    <th className="py-2.5 px-3 font-bold w-14 text-center">Rank</th>
                                    <th className="py-2.5 px-3 font-bold">Index Name</th>
                                    <th className="py-2.5 px-3 font-bold">Type &amp; Columns</th>
                                    {showIndexImpactHeatmap && (
                                      <th className="py-2.5 px-3 font-bold text-center bg-rose-50/80 border-x border-rose-200 text-rose-950">
                                        Latency Contribution
                                      </th>
                                    )}
                                    {showUsageHeatmap && (
                                      <th className="py-2.5 px-3 font-bold text-center bg-gradient-to-r from-emerald-50/90 to-rose-50/90 border-x border-emerald-200 text-zinc-900">
                                        <div className="flex items-center justify-center gap-1">
                                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Usage Heatmap (R:W)</span>
                                        </div>
                                      </th>
                                    )}
                                    <th className="py-2.5 px-3 font-bold text-center">Query Gain</th>
                                    <th className="py-2.5 px-3 font-bold text-center">Write Penalty</th>
                                    <th className="py-2.5 px-3 font-bold text-center bg-indigo-50/70 border-x border-indigo-200 text-indigo-950">
                                      Impact Score
                                    </th>
                                    <th className="py-2.5 px-3 font-bold text-center">Health</th>
                                    <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {indexes.map((item, idx) => {
                                    const { index, health, impact, latencyHeat, usageHeat, inactivityStats, isRemoved, isLocked } = item;
                                    const isSelected = selectedIndexes.includes(index.name);
                                    return (
                                      <tr
                                        key={`grouped-row-${tableName}-${index.name}`}
                                        id={`index-row-${index.name}`}
                                        data-testid={`index-row-${index.name}`}
                                        className={`transition-colors ${
                                          isSelected
                                            ? 'bg-indigo-50/70 ring-1 ring-indigo-400'
                                            : showUsageHeatmap
                                            ? usageHeat.rowBgClass
                                            : showIndexImpactHeatmap
                                            ? latencyHeat.rowBgClass
                                            : isRemoved
                                            ? 'bg-zinc-50/60 opacity-60 hover:bg-zinc-100/80'
                                            : impact.score >= 90
                                            ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                            : impact.score < 30
                                            ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                            : 'hover:bg-zinc-50/80'
                                        }`}
                                      >
                                        <td className="py-3 px-3 text-center">
                                          <input
                                            type="checkbox"
                                            id={`checkbox-index-${index.name}`}
                                            data-testid={`checkbox-index-${index.name}`}
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectIndex(index.name)}
                                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                          />
                                        </td>
                                        <td className="py-3 px-3 text-center font-bold text-zinc-500">
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700">
                                            #{idx + 1}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-indigo-950 font-bold">{index.name}</span>
                                            {isLocked && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                Protected
                                              </span>
                                            )}
                                            {isRemoved && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                Pruned
                                              </span>
                                            )}
                                            {inactivityStats && inactivityStats.daysInactive > 7 && (
                                              <span
                                                id={`badge-low-usage-${index.name}`}
                                                data-testid={`badge-low-usage-${index.name}`}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-fadeIn shrink-0"
                                                title={`Low Usage: Inactive for ${inactivityStats.daysInactive} days (>7d threshold). Last scan: ${inactivityStats.lastScanLabel}. ${inactivityStats.inactivityReason}`}
                                              >
                                                <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                                <span>Inactive &gt;7d ({inactivityStats.daysInactive}d)</span>
                                              </span>
                                            )}
                                            {showUsageHeatmap && (
                                              <span
                                                id={`grouped-row-usage-heatmap-badge-${index.name}`}
                                                data-testid={`grouped-row-usage-heatmap-badge-${index.name}`}
                                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shadow-2xs inline-flex items-center gap-0.5 ${usageHeat.badgeClass}`}
                                                title={`Usage Heatmap: ${usageHeat.ratio}x Read:Write Ratio (${usageHeat.reads.toLocaleString()} reads vs ${usageHeat.writes.toLocaleString()} writes). ${usageHeat.verdict}`}
                                              >
                                                <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                                                <span>{usageHeat.badgeLabel}</span>
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="text-zinc-700 font-mono text-[11px]">
                                            <span className="font-bold text-indigo-800">{index.type}</span> ({index.columns.join(', ')})
                                          </div>
                                        </td>
                                        {showIndexImpactHeatmap && (
                                          <td className="py-3 px-3 text-center bg-rose-50/30 border-x border-rose-100 font-mono font-bold">
                                            <span className={latencyHeat.textClass}>{latencyHeat.queryLatencyContributionMs}ms</span>
                                          </td>
                                        )}
                                        {showUsageHeatmap && (
                                          <td className="py-3 px-3 text-center bg-zinc-50/40 border-x border-zinc-200/80">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                              <div className="flex items-center gap-1 font-mono text-xs font-bold">
                                                <span className={usageHeat.textColor}>{usageHeat.ratio}x</span>
                                                <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                                  usageHeat.usageTier === 'read-heavy'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : usageHeat.usageTier === 'write-heavy'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                  {usageHeat.label}
                                                </span>
                                              </div>
                                              <div className="w-20 bg-zinc-200 h-1.5 rounded-full overflow-hidden flex shadow-inner">
                                                <div
                                                  className="h-full bg-emerald-500"
                                                  style={{ width: `${usageHeat.readPercentage}%` }}
                                                  title={`Reads: ${usageHeat.reads.toLocaleString()} (${usageHeat.readPercentage}%)`}
                                                />
                                                <div
                                                  className="h-full bg-rose-500"
                                                  style={{ width: `${usageHeat.writePercentage}%` }}
                                                  title={`Writes: ${usageHeat.writes.toLocaleString()} (${usageHeat.writePercentage}%)`}
                                                />
                                              </div>
                                              <div className="text-[9px] font-mono text-zinc-500 flex items-center justify-between w-20">
                                                <span className="text-emerald-700 font-bold">{usageHeat.readPercentage}%R</span>
                                                <span className="text-rose-700 font-bold">{usageHeat.writePercentage}%W</span>
                                              </div>
                                            </div>
                                          </td>
                                        )}
                                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                                          +{index.type === 'B-Tree' ? '98%' : '75%'}
                                        </td>
                                        <td className="py-3 px-3 text-center font-mono text-rose-700">
                                          -{impact.writePenalty}%
                                        </td>
                                        <td className="py-3 px-4 text-center bg-indigo-50/40 border-x border-indigo-100">
                                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                            impact.score >= 80 ? 'bg-emerald-100 text-emerald-800' : impact.score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {impact.score} / 100
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                            health.score >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {health.score}/100
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <div className="inline-flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleToggleLockIndex(index.name)}
                                              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                                                isLocked ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                              }`}
                                              title={isLocked ? 'Unlock / Unprotect index' : 'Lock / Protect index'}
                                            >
                                              <Shield className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleReindexIndex(index.name)}
                                              className="p-1.5 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs transition-colors cursor-pointer"
                                              title="Reindex Concurrently"
                                            >
                                              <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div
                id="indexes-ranked-table-container"
                data-testid="indexes-ranked-table-container"
                className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs"
              >
                <div className="p-3 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <strong className="text-zinc-900">Ranked Schema Index Directory:</strong>
                      <span className="text-zinc-600 ml-1">
                        Ranked by <strong className="text-indigo-900">{indexRankSort === 'impact_desc' ? 'Index Impact Score (High to Low)' : indexRankSort === 'impact_asc' ? 'Index Impact Score (Lowest / Pruning Candidates)' : indexRankSort === 'latency_desc' ? 'Query Latency Contribution (High to Low / Most Expensive)' : indexRankSort === 'latency_asc' ? 'Query Latency Contribution (Low to High)' : indexRankSort}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500 flex-wrap">
                    {showUsageHeatmap && (
                      <div
                        id="index-usage-heatmap-legend"
                        data-testid="index-usage-heatmap-legend"
                        className="flex flex-wrap items-center gap-2 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-rose-50/90 border border-emerald-300/80 px-2.5 py-1 rounded-md text-emerald-950 font-sans shadow-2xs text-[11px]"
                      >
                        <span className="font-bold flex items-center gap-1 text-emerald-900">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Usage Heatmap:</span>
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                          <span>Read Heavy (Green)</span>
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-teal-50 text-teal-900 border border-teal-200 font-medium text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                          <span>Read Leaning</span>
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span>Balanced</span>
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-100 text-rose-950 border border-rose-400 font-bold text-[10px]">
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                          <span>Write Heavy (Red)</span>
                        </span>
                      </div>
                    )}
                    {showIndexImpactHeatmap && (
                      <div
                        id="index-latency-heatmap-legend"
                        data-testid="index-latency-heatmap-legend"
                        className="flex flex-wrap items-center gap-2.5 bg-rose-50/90 border border-rose-200/90 px-2.5 py-1 rounded-md text-rose-950 font-sans shadow-2xs"
                      >
                        <span className="font-bold flex items-center gap-1 text-rose-800">
                          <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                          <span>Latency Heatmap:</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                          <span className="font-semibold text-rose-900">&gt;400ms (Critical)</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                          <span className="font-medium text-rose-800">250–400ms</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span className="font-medium text-amber-800">100–250ms</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="font-medium text-emerald-800">&lt;100ms (Optimal)</span>
                        </span>
                      </div>
                    )}
                    <span>Showing <strong>{allRankedSchemaIndexes.length}</strong> indexes</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table
                    id="indexes-impact-table"
                    data-testid="indexes-impact-table"
                    className="w-full text-left text-xs font-mono border-collapse"
                  >
                    <thead className="bg-zinc-100/90 text-zinc-700 uppercase tracking-wider text-[10px] border-b border-zinc-200 select-none">
                      <tr>
                        <th className="py-2.5 px-3 font-bold w-10 text-center select-none">
                          <input
                            type="checkbox"
                            id="checkbox-select-all-indexes"
                            data-testid="checkbox-select-all-indexes"
                            checked={allRankedSchemaIndexes.length > 0 && allRankedSchemaIndexes.every((item) => selectedIndexes.includes(item.index.name))}
                            ref={(el) => {
                              if (el) {
                                const hasSome = allRankedSchemaIndexes.some((item) => selectedIndexes.includes(item.index.name));
                                const hasAll = allRankedSchemaIndexes.length > 0 && allRankedSchemaIndexes.every((item) => selectedIndexes.includes(item.index.name));
                                el.indeterminate = hasSome && !hasAll;
                              }
                            }}
                            onChange={() => {
                              const visibleNames = allRankedSchemaIndexes.map((item) => item.index.name);
                              handleSelectAllVisible(visibleNames);
                            }}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            title="Select / deselect all visible indexes"
                          />
                        </th>
                        <th className="py-2.5 px-3 font-bold w-14 text-center">Rank</th>
                        <th className="py-2.5 px-3 font-bold">Index Name &amp; Entity</th>
                        <th className="py-2.5 px-3 font-bold">Type &amp; Columns</th>
                        {showIndexImpactHeatmap && (
                          <th className="py-2.5 px-3 font-bold text-center bg-rose-50/80 border-x border-rose-200 text-rose-950">
                            <div className="flex items-center justify-center gap-1">
                              <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                              <span>Latency Contribution</span>
                            </div>
                          </th>
                        )}
                        {showUsageHeatmap && (
                          <th className="py-2.5 px-3 font-bold text-center bg-gradient-to-r from-emerald-50/90 to-rose-50/90 border-x border-emerald-200 text-zinc-900">
                            <div className="flex items-center justify-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Usage Heatmap (R:W)</span>
                            </div>
                          </th>
                        )}
                        <th className="py-2.5 px-3 font-bold text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>Query Gain</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 font-bold text-center">
                          <div className="flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span>Write Penalty</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-4 font-bold text-center bg-indigo-50/70 border-x border-indigo-200 text-indigo-950">
                          <div className="flex items-center justify-center gap-1.5 font-bold">
                            <Target className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Index Impact Score</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 font-bold text-center">Health</th>
                        <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {allRankedSchemaIndexes.length === 0 ? (
                        <tr>
                          <td colSpan={9 + (showIndexImpactHeatmap ? 1 : 0) + (showUsageHeatmap ? 1 : 0)} className="py-8 text-center text-zinc-500 font-sans">
                            No indexes matching &ldquo;{indexSearchQuery}&rdquo; found in the selected filter.
                          </td>
                        </tr>
                      ) : (
                        allRankedSchemaIndexes.map((item, idx) => {
                          const { index, table, entityBadge, health, impact, latencyHeat, usageHeat, inactivityStats, isRemoved, isLocked } = item;
                          const isSelected = selectedIndexes.includes(index.name);
                          return (
                            <tr
                              key={`table-row-${table}-${index.name}`}
                              id={`index-row-${index.name}`}
                              data-testid={`index-row-${index.name}`}
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50/70 ring-1 ring-indigo-400'
                                  : showUsageHeatmap
                                  ? usageHeat.rowBgClass
                                  : showIndexImpactHeatmap
                                  ? latencyHeat.rowBgClass
                                  : isRemoved
                                  ? 'bg-zinc-50/60 opacity-60 hover:bg-zinc-100/80'
                                  : impact.score >= 90
                                  ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                  : impact.score < 30
                                  ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                  : 'hover:bg-zinc-50/80'
                              }`}
                            >
                              {/* Row Selection Checkbox */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  id={`checkbox-index-${index.name}`}
                                  data-testid={`checkbox-index-${index.name}`}
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectIndex(index.name)}
                                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                  title={`Select "${index.name}" for mass-toggling protection or re-indexing`}
                                />
                              </td>

                              {/* Rank Position */}
                              <td className="py-3 px-3 text-center font-bold text-zinc-500">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                                  idx === 0
                                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                                    : idx === 1
                                    ? 'bg-zinc-200 text-zinc-800'
                                    : idx === 2
                                    ? 'bg-amber-50 text-amber-900'
                                    : 'bg-zinc-100 text-zinc-700'
                                }`}>
                                  #{idx + 1}
                                </span>
                              </td>

                              {/* Index Name & Entity */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-indigo-950 font-bold">{index.name}</span>
                                  {isLocked && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      LOCKED
                                    </span>
                                  )}
                                  {inactivityStats && inactivityStats.daysInactive > 7 && (
                                    <span
                                      id={`badge-low-usage-${index.name}`}
                                      data-testid={`badge-low-usage-${index.name}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-fadeIn shrink-0"
                                      title={`Low Usage: Inactive for ${inactivityStats.daysInactive} days (>7d threshold). Last scan: ${inactivityStats.lastScanLabel}. ${inactivityStats.inactivityReason}`}
                                    >
                                      <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                      <span>Inactive &gt;7d ({inactivityStats.daysInactive}d)</span>
                                    </span>
                                  )}
                                  {showUsageHeatmap && (
                                    <span
                                      id={`table-row-usage-heatmap-badge-${index.name}`}
                                      data-testid={`table-row-usage-heatmap-badge-${index.name}`}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shadow-2xs inline-flex items-center gap-0.5 ${usageHeat.badgeClass}`}
                                      title={`Usage Heatmap: ${usageHeat.ratio}x Read:Write Ratio (${usageHeat.reads.toLocaleString()} reads vs ${usageHeat.writes.toLocaleString()} writes). ${usageHeat.verdict}`}
                                    >
                                      <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                                      <span>{usageHeat.badgeLabel}</span>
                                    </span>
                                  )}
                                  {showIndexImpactHeatmap && (
                                    <span
                                      id={`table-row-heatmap-badge-${index.name}`}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shadow-2xs inline-flex items-center gap-0.5 ${latencyHeat.badgeClass}`}
                                    >
                                      <Flame className="w-2.5 h-2.5" />
                                      <span>{latencyHeat.heatIntensity}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-sans mt-0.5 flex items-center gap-1">
                                  <Table className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>{table}</span>
                                  {entityBadge && <span className="text-zinc-400">• {entityBadge}</span>}
                                </div>
                                {showIndexImpactHeatmap && (
                                  <div className="text-[10px] text-zinc-600 font-sans mt-1 flex items-center gap-1 flex-wrap">
                                    <span className="font-medium text-zinc-500">Workload latency:</span>
                                    <strong className="text-rose-900 font-mono font-bold">{latencyHeat.queryLatencyContributionMs}ms</strong>
                                    <span className="text-zinc-400">({latencyHeat.executionShare} share)</span>
                                  </div>
                                )}
                              </td>

                              {/* Type & Columns */}
                              <td className="py-3 px-3 text-zinc-600 text-[11px]">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-bold mr-1 border border-zinc-200 text-[10px]">
                                  {index.type}
                                </span>
                                <span className="text-zinc-500 font-sans">({index.columns.join(', ')})</span>
                              </td>

                              {/* Latency Contribution Column (when heatmap active) */}
                              {showIndexImpactHeatmap && (
                                <td className="py-3 px-3 text-center bg-rose-50/40 border-x border-rose-200/80">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <div className="flex items-center gap-1">
                                      <Flame className="w-3 h-3 text-rose-600" />
                                      <span
                                        id={`table-latency-value-${index.name}`}
                                        data-testid={`table-latency-value-${index.name}`}
                                        className="font-mono text-xs font-bold text-rose-950"
                                      >
                                        {latencyHeat.queryLatencyContributionMs} ms
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-zinc-500 font-sans">
                                      {latencyHeat.executionShare} DB read time
                                    </div>
                                    <div className="w-20 bg-zinc-200 h-1.5 rounded-full overflow-hidden mt-0.5">
                                      <div
                                        className={`h-full ${
                                          latencyHeat.heatTier === 'critical'
                                            ? 'bg-rose-600'
                                            : latencyHeat.heatTier === 'high'
                                            ? 'bg-rose-400'
                                            : latencyHeat.heatTier === 'moderate'
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.round((latencyHeat.queryLatencyContributionMs / 840) * 100))}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              )}

                              {/* Usage Heatmap Column (Read-to-Write Ratio) */}
                              {showUsageHeatmap && (
                                <td className="py-3 px-3 text-center bg-zinc-50/40 border-x border-zinc-200/80">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <div className="flex items-center gap-1 font-mono text-xs font-bold">
                                      <span
                                        id={`table-usage-ratio-${index.name}`}
                                        data-testid={`table-usage-ratio-${index.name}`}
                                        className={usageHeat.textColor}
                                      >
                                        {usageHeat.ratio}x
                                      </span>
                                      <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                        usageHeat.usageTier === 'read-heavy'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : usageHeat.usageTier === 'write-heavy'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {usageHeat.label}
                                      </span>
                                    </div>
                                    <div className="w-20 bg-zinc-200 h-1.5 rounded-full overflow-hidden flex shadow-inner">
                                      <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${usageHeat.readPercentage}%` }}
                                        title={`Reads: ${usageHeat.reads.toLocaleString()} (${usageHeat.readPercentage}%)`}
                                      />
                                      <div
                                        className="h-full bg-rose-500 transition-all duration-300"
                                        style={{ width: `${usageHeat.writePercentage}%` }}
                                        title={`Writes: ${usageHeat.writes.toLocaleString()} (${usageHeat.writePercentage}%)`}
                                      />
                                    </div>
                                    <div className="text-[9px] font-mono text-zinc-500 flex items-center justify-between w-20">
                                      <span className="text-emerald-700 font-bold">{usageHeat.readPercentage}%R</span>
                                      <span className="text-rose-700 font-bold">{usageHeat.writePercentage}%W</span>
                                    </div>
                                  </div>
                                </td>
                              )}

                              {/* Query Improvement (+%) */}
                              <td className="py-3 px-3 text-center">
                                {isRemoved ? (
                                  <span className="text-zinc-400 text-[11px] line-through">0%</span>
                                ) : (
                                  <div>
                                    <span className="font-bold text-emerald-700 text-[11px]">
                                      +{impact.queryImprovement.toFixed(1)}%
                                    </span>
                                    <div className="text-[9px] text-zinc-500 font-sans">
                                      {impact.readBenefitMultiplier}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Write Latency Penalty (-%) */}
                              <td className="py-3 px-3 text-center">
                                {isRemoved ? (
                                  <span className="text-emerald-700 text-[10px] font-bold">
                                    +14% Overhead Saved
                                  </span>
                                ) : (
                                  <div>
                                    <span className="font-bold text-rose-600 text-[11px]">
                                      -{impact.writePenalty.toFixed(1)}%
                                    </span>
                                    <div className="text-[9px] text-zinc-500 font-sans">
                                      Write overhead
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* NEW COLUMN: Index Impact Score (Overall Value) */}
                              <td className="py-3 px-4 text-center bg-indigo-50/40 border-x border-indigo-100">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      id={`table-impact-score-${index.name}`}
                                      data-testid={`table-impact-score-${index.name}`}
                                      className={`px-2 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${impact.badgeClass}`}
                                      title={`Index Impact Score: ${impact.score}/100 • Weighted avg: 75% Query Gain (+${impact.queryImprovement.toFixed(1)}%) & 25% Write Efficiency (-${impact.writePenalty.toFixed(1)}% overhead)`}
                                    >
                                      {impact.score} / 100
                                    </span>
                                    <span className={`font-sans font-extrabold text-[10px] uppercase ${impact.ratingColor}`}>
                                      {impact.overallValueRating}
                                    </span>
                                  </div>
                                  <div className="w-24 bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all ${
                                        impact.score >= 90
                                          ? 'bg-emerald-600'
                                          : impact.score >= 75
                                          ? 'bg-teal-500'
                                          : impact.score >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${impact.score}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Health Score */}
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${health.badgeClass}`}>
                                  {health.score}/100
                                </span>
                              </td>

                              {/* Actions & Status */}
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLockIndex(index.name)}
                                    className={`p-1 rounded cursor-pointer transition-colors ${
                                      isLocked
                                        ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                        : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                    title={isLocked ? 'Unlock index' : 'Lock index'}
                                  >
                                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    id={`table-btn-copy-sql-${index.name}`}
                                    data-testid={`table-btn-copy-sql-${index.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const ddl = `CREATE INDEX CONCURRENTLY ${index.name} ON ${table} (${index.columns.join(', ')});`;
                                      navigator.clipboard?.writeText(ddl);
                                      setCopiedDdlIndex(index.name);
                                      setImportSuccessNotice(`[Copied to Clipboard] CREATE SQL syntax for index "${index.name}" copied.`);
                                      setTimeout(() => setImportSuccessNotice(null), 4000);
                                    }}
                                    className="p-1 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                                    title="Copy CREATE INDEX SQL DDL statement to clipboard"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isRemoved
                                      ? 'bg-zinc-200 text-zinc-600 line-through'
                                      : index.active
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-zinc-200 text-zinc-600'
                                  }`}>
                                    {isRemoved ? 'REMOVED' : index.active ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
              <div className="space-y-3.5">
              {tables
                .filter((tbl) => indexCategoryFilter === 'all' || indexCategoryFilter === tbl.name)
                .map((tbl) => {
                  const queryLower = indexSearchQuery.trim().toLowerCase();
                  const matchingIndexes = tbl.indexes.filter((idx) => {
                    if (!queryLower) return true;
                    const matchesName = idx.name.toLowerCase().includes(queryLower);
                    const matchesTargetTable =
                      tbl.name.toLowerCase().includes(queryLower) ||
                      (idx.targetTable && idx.targetTable.toLowerCase().includes(queryLower)) ||
                      (tbl.entityName && tbl.entityName.toLowerCase().includes(queryLower)) ||
                      (idx.targetEntity && idx.targetEntity.toLowerCase().includes(queryLower));
                    const matchesColumns = idx.columns.some((c) => c.toLowerCase().includes(queryLower));
                    const matchesType = idx.type.toLowerCase().includes(queryLower);
                    return matchesName || matchesTargetTable || matchesColumns || matchesType;
                  });

                  if (queryLower && matchingIndexes.length === 0) {
                    return null;
                  }

                  const isCollapsed = queryLower ? false : !!collapsedCategories[tbl.name];
                  const activeCount = matchingIndexes.filter(
                    (idx) => idx.active && !removedIndexes.includes(idx.name)
                  ).length;

                  return (
                    <div
                      key={tbl.name}
                      data-testid={`collapsible-category-${tbl.name}`}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        selectedTable === tbl.name
                          ? 'border-indigo-300 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {/* Collapsible Category Header */}
                      <div
                        role="button"
                        tabIndex={0}
                        id={`category-header-${tbl.name}`}
                        data-testid={`category-header-${tbl.name}`}
                        onClick={() => {
                          setCollapsedCategories((prev) => ({
                            ...prev,
                            [tbl.name]: !isCollapsed
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCollapsedCategories((prev) => ({
                              ...prev,
                              [tbl.name]: !isCollapsed
                            }));
                          }
                        }}
                        className={`p-3.5 flex items-center justify-between cursor-pointer select-none transition-colors ${
                          selectedTable === tbl.name
                            ? 'bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/40'
                            : 'bg-zinc-50/80 hover:bg-zinc-100/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="p-1 rounded-md text-zinc-500 hover:text-zinc-800 transition-transform"
                            aria-label={isCollapsed ? `Expand ${tbl.name} indexes` : `Collapse ${tbl.name} indexes`}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            )}
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            <Table className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-bold text-xs text-zinc-900">
                              {tbl.entityName || tbl.name}
                            </span>
                            <span className="font-mono text-[10px] bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-300">
                              entity: {tbl.name}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {tbl.entityBadge}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const avgHealth = matchingIndexes.length > 0
                              ? Math.round(
                                  matchingIndexes.reduce(
                                    (sum, idx) => sum + getIndexHealthScore(idx.name, idx.active, tbl.name).score,
                                    0
                                  ) / matchingIndexes.length
                                )
                              : 0;
                            const avgBadgeClass =
                              avgHealth >= 80
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : avgHealth >= 50
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-rose-100 text-rose-900 border-rose-300';
                            return (
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${avgBadgeClass}`}
                                title={`Average calculated Index Health Score for ${tbl.entityName || tbl.name}: ${avgHealth}/100`}
                              >
                                <Activity className="w-3 h-3 shrink-0" />
                                <span>Avg Health: {avgHealth}/100</span>
                              </span>
                            );
                          })()}
                          <span className="text-[11px] font-mono font-semibold text-zinc-600">
                            {matchingIndexes.length} {matchingIndexes.length === 1 ? 'index' : 'indexes'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              activeCount > 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                            }`}
                          >
                            {activeCount} active
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
                            {isCollapsed ? 'Click to Expand ▾' : 'Click to Collapse ▴'}
                          </span>
                        </div>
                      </div>

                      {/* When Collapsed: Quick Index Summary Bar */}
                      {isCollapsed ? (
                        <div
                          onClick={() => {
                            setCollapsedCategories((prev) => ({
                              ...prev,
                              [tbl.name]: false
                            }));
                          }}
                          className="px-4 py-2 bg-white border-t border-zinc-100 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap overflow-hidden text-[10px]">
                            <span className="text-zinc-400 font-medium">Targeted indexes:</span>
                            {matchingIndexes.map((idx) => {
                              const isRemoved = removedIndexes.includes(idx.name);
                              const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
                              return (
                                <span
                                  key={idx.name}
                                  className={`font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                    isRemoved
                                      ? 'bg-zinc-100 text-zinc-400 line-through border-zinc-200'
                                      : health.badgeClass
                                  }`}
                                  title={`Health Score: ${health.score}/100 (${health.rating}) • Freq: ${health.frequencyScore}% • R/W: ${health.readWriteScore}% • Scan: ${health.scanEfficiencyScore}%`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRemoved ? 'bg-zinc-400' : health.dotClass}`} />
                                  <span>{idx.name}</span>
                                  <span className="font-bold">({health.score})</span>
                                </span>
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold shrink-0">
                            Expand Category ▾
                          </span>
                        </div>
                      ) : (
                        /* When Expanded: Full Grid of Index Cards for this Target Entity */
                        <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 space-y-3">
                          {/* Entity Context Sub-bar */}
                          <div className="p-2.5 bg-white rounded-lg border border-zinc-200/80 text-[11px] text-zinc-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-800">{tbl.entityRole}:</span>
                              <span>{tbl.description}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(tbl.name);
                              }}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 flex items-center gap-1 ${
                                selectedTable === tbl.name
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{selectedTable === tbl.name ? 'Focused Table' : 'Focus in Schema ER'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Index Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {matchingIndexes.map((idx, i) => {
                              const health = getIndexHealthScore(idx.name, idx.active, tbl.name);
                              const isRemoved = removedIndexes.includes(idx.name);
                              const isLocked = lockedIndexes.includes(idx.name);
                              const impact = calculateIndexImpactScore(idx.name, idx.active, tbl.name, isRemoved, isLocked);
                              const latencyHeat = calculateIndexLatencyContribution(idx.name, idx.active, tbl.name, isRemoved);
                              const usageHeat = calculateIndexUsageHeatmap(idx.name, idx.active, tbl.name, isRemoved);
                              const isSelected = selectedIndexes.includes(idx.name);

                              return (
                                <div
                                  key={`idx-${tbl.name}-${i}`}
                                  onMouseEnter={() => setHoveredIndexWhatIf(idx.name)}
                                  onMouseLeave={() => setHoveredIndexWhatIf(null)}
                                  className={`relative p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
                                    isSelected
                                      ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/40 shadow-sm'
                                      : showUsageHeatmap
                                      ? `${usageHeat.cardBgClass} ${animatingBulkIndexName === idx.name ? 'scale-[1.01] ring-2 ring-emerald-400' : ''}`
                                      : showIndexImpactHeatmap
                                      ? `${latencyHeat.cardBgClass} ${animatingBulkIndexName === idx.name ? 'scale-[1.01] ring-2 ring-emerald-400' : ''}`
                                      : animatingBulkIndexName === idx.name
                                      ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400 scale-[1.01] shadow-md bg-white'
                                      : isLocked
                                      ? 'border-amber-300 ring-1 ring-amber-200/80 shadow-xs bg-white'
                                      : idx.active
                                      ? 'border-emerald-300 shadow-2xs bg-white'
                                      : 'border-zinc-200 opacity-80 hover:opacity-100 bg-white'
                                  }`}
                                >
                                  {/* Interactive What-If Hover Tooltip */}
                                  {hoveredIndexWhatIf === idx.name && (
                                    <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 text-white p-4 rounded-xl shadow-2xl border border-indigo-500/60 animate-fadeIn text-xs">
                                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
                                        <div className="flex items-center gap-2">
                                          <Sparkles className="w-4 h-4 text-indigo-400" />
                                          <strong className="text-indigo-300">What-If Analysis: {idx.name}</strong>
                                        </div>
                                        <span className="font-mono text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                                          Top 5 Frequent Slow Queries
                                        </span>
                                         <div
                                           id={`usage-heatmap-${idx.name}`}
                                           data-testid={`usage-heatmap-${idx.name}`}
                                           className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200/70 px-2 py-0.5 rounded-md border border-zinc-200 text-[10px] font-mono text-zinc-700 shadow-2xs"
                                           title="24-Hour Query Usage Heatmap: Visualizes query utilization intensity over 6 x 4-hour blocks across the last 24 hours"
                                         >
                                           <Activity className="w-3 h-3 text-indigo-600 shrink-0" />
                                           <span className="text-[9px] font-semibold text-zinc-600">24h Heatmap:</span>
                                           <div className="flex items-center gap-0.5">
                                             {[80, 45, 90, 65, 30, 95].map((val, hi) => {
                                               const intensity = (idx.name.length * (hi + 3) * 17) % 100;
                                               const bgClass =
                                                 intensity > 75
                                                   ? 'bg-emerald-600'
                                                   : intensity > 40
                                                   ? 'bg-teal-500'
                                                   : intensity > 20
                                                   ? 'bg-amber-400'
                                                   : 'bg-zinc-300';
                                               return (
                                                 <div
                                                   key={hi}
                                                   className={`w-1.5 h-3 rounded-xs ${bgClass}`}
                                                   title={`Block -${(6 - hi) * 4}h: ${intensity}% utilization`}
                                                 />
                                               );
                                             })}
                                           </div>
                                         </div>
                                      </div>
                                      <div className="space-y-2">
                                        {getWhatIfTop5Queries(idx.name).map((q, qi) => (
                                          <div key={qi} className="p-2 rounded bg-zinc-800/95 border border-zinc-700/80 flex flex-col gap-1">
                                            <div className="font-mono text-[11px] text-zinc-200 truncate" title={q.query}>
                                              {qi + 1}. {q.query}
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono">
                                              <span className="text-zinc-400">Freq: {q.freq}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="line-through text-zinc-500">{q.before}</span>
                                                <span className="text-zinc-300">→</span>
                                                <span className="text-emerald-400 font-bold">{q.after}</span>
                                                <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-bold border border-emerald-800">{q.improvement}</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-2 text-[10px] text-zinc-400 italic text-center">
                                        💡 Hovering index structures dynamically estimates B-Tree execution time improvements.
                                      </div>
                                    </div>
                                  )}

                                  {/* Baseline Comparison Ribbon */}
                                  {compareWithBaseline && (() => {
                                    const cmp = getBaselineComparisonForIndex(idx.name, idx.active);
                                    return (
                                      <div className={`mb-2.5 p-2 rounded-lg border text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                                        cmp.isNewOptimization
                                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                                          : 'bg-zinc-100/90 border-zinc-200 text-zinc-800'
                                      }`}>
                                        <div className="flex items-center gap-1.5">
                                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          <span className="font-medium text-[11px]">
                                            <span className="line-through text-zinc-500 mr-1">Baseline: {cmp.baselineStatus}</span>
                                            <span className="text-zinc-400">➔</span>
                                            <span className="font-bold ml-1 text-emerald-800">Current: {cmp.currentStatus}</span>
                                          </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${cmp.badgeClass}`}>
                                          {cmp.speedup}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  <div>
                                    {/* Diagnostic Removal / Redundancy Banners */}
                                    {(() => {
                                      if (removedIndexes.includes(idx.name)) {
                                        return (
                                          <div className="mb-2 p-2 bg-zinc-100 border border-zinc-300 rounded-lg flex items-center justify-between text-[11px] text-zinc-600 shadow-2xs">
                                            <div className="flex items-center gap-1.5 font-medium">
                                              <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                              <span>Index Removed by Cleanup Diagnostic (+2.4 MB space saved)</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestoreRemovedIndex(idx.name);
                                              }}
                                              className="px-2 py-0.5 bg-white hover:bg-zinc-200 border border-zinc-300 text-zinc-700 font-semibold rounded text-[10px] cursor-pointer"
                                            >
                                              Restore
                                            </button>
                                          </div>
                                        );
                                      }
                                      if (cleanupScanCompleted && isIndexUnutilized(idx.name)) {
                                        return (
                                          <div className="mb-2 p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-[11px] text-rose-900 shadow-2xs">
                                            <div className="flex items-center gap-2 font-semibold">
                                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                              <div>
                                                <div>Unutilized in Last 100 Queries (0 Hits)</div>
                                                <div className="text-[10px] text-rose-700 font-normal">Flagged for removal • Reclaim 2.4 MB disk space</div>
                                              </div>
                                            </div>
                                            {isLocked ? (
                                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[10px] shrink-0">
                                                Protected (Locked)
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveUnutilizedIndex(idx.name);
                                                }}
                                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors shrink-0"
                                              >
                                                Remove &amp; Free Space
                                              </button>
                                            )}
                                          </div>
                                        );
                                      }
                                      const redundant = isIndexRedundant(idx.name, idx.columns);
                                      return redundant ? (
                                        <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-[11px] text-amber-900 shadow-2xs">
                                          <div className="flex items-center gap-2 font-semibold">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                                            <span>Redundant Coverage (Covered by Composite Index)</span>
                                          </div>
                                          {isLocked ? (
                                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[10px]">
                                              Protected (Locked)
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleConsolidateIndex(idx.name);
                                              }}
                                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors"
                                            >
                                              Consolidate
                                            </button>
                                          )}
                                        </div>
                                      ) : null;
                                    })()}

                                    {/* Target Entity Pill */}
                                    <div className="text-[10px] font-mono text-zinc-500 mb-1.5 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <Table className="w-3 h-3 text-indigo-500" />
                                        <span>Target Entity: <strong className="text-zinc-700">{tbl.name}</strong></span>
                                      </span>
                                      <span className="text-zinc-400 font-sans">{tbl.entityBadge}</span>
                                    </div>

                                    {/* Index Header Row with Name, Health Score Badge, and Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-bold text-zinc-900 mb-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                          type="checkbox"
                                          id={`checkbox-card-index-${idx.name}`}
                                          data-testid={`checkbox-card-index-${idx.name}`}
                                          checked={selectedIndexes.includes(idx.name)}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleToggleSelectIndex(idx.name);
                                          }}
                                          className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                          title={`Select index "${idx.name}" for mass-toggling protection or re-indexing`}
                                        />
                                        <span className="font-mono text-indigo-950 font-bold">{idx.name}</span>
                                        {isLocked && (
                                          <span
                                            id={`locked-badge-${idx.name}`}
                                            data-testid={`locked-badge-${idx.name}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                                            title="High-priority manual lock enabled. Protected from automated optimization and index cleanup."
                                          >
                                            <Lock className="w-3 h-3 text-amber-700" />
                                            LOCKED
                                          </span>
                                        )}
                                        {(() => {
                                          const cardInactivity = getIndexInactivityStats(idx.name, idx.active, tbl.name);
                                          if (cardInactivity.daysInactive > 7) {
                                            return (
                                              <span
                                                id={`card-badge-low-usage-${idx.name}`}
                                                data-testid={`card-badge-low-usage-${idx.name}`}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-fadeIn shrink-0"
                                                title={`Low Usage: Inactive for ${cardInactivity.daysInactive} days (>7d threshold). Last scan: ${cardInactivity.lastScanLabel}. ${cardInactivity.inactivityReason}`}
                                              >
                                                <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                                                <span>Inactive &gt;7d ({cardInactivity.daysInactive}d)</span>
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                        {/* Color-Coded Index Health Score Badge (0-100) */}
                                        <span
                                          id={`health-score-${idx.name}`}
                                          data-testid={`health-score-${idx.name}`}
                                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition-all ${
                                            isRemoved ? 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through' : health.badgeClass
                                          }`}
                                          title={`Index Health Score: ${health.score}/100 (${health.rating}) • Frequency of Use: ${health.frequencyScore}% • Read-Write Ratio: ${health.readWriteScore}% • Scan Efficiency: ${health.scanEfficiencyScore}%`}
                                        >
                                          <HeartPulse className={`w-3 h-3 shrink-0 ${isRemoved ? 'text-zinc-400' : health.textClass}`} />
                                          <span>Health: {health.score}/100</span>
                                          <span className="font-sans font-extrabold text-[9px] uppercase px-1 rounded bg-black/5">
                                            {health.rating}
                                          </span>
                                        </span>

                                        {/* Color-Coded Index Impact Score Badge (0-100) */}
                                        <div className="relative inline-block">
                                          <span
                                            id={`card-impact-score-${idx.name}`}
                                            data-testid={`card-impact-score-${idx.name}`}
                                            onMouseEnter={() => setHoveredImpactReasoningIndex(idx.name)}
                                            onMouseLeave={() => setHoveredImpactReasoningIndex(null)}
                                            className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition-all cursor-help ${
                                              isRemoved ? 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through' : impact.badgeClass
                                            }`}
                                            title="Hover for Reasoning Summary based on recent query logs"
                                          >
                                            <Target className="w-3 h-3 shrink-0 text-indigo-600" />
                                            <span>Impact: {impact.score}/100</span>
                                            <span className={`font-sans font-extrabold text-[9px] uppercase px-1 rounded bg-black/5 ${impact.ratingColor}`}>
                                              {impact.overallValueRating}
                                            </span>
                                          </span>

                                          {/* Interactive Reasoning Summary Tooltip */}
                                          {hoveredImpactReasoningIndex === idx.name && (() => {
                                            const reasoning = getIndexReasoningSummary(idx.name, tbl.name);
                                            return (
                                              <div className="absolute left-0 bottom-full mb-2 z-50 w-80 bg-zinc-900 text-white p-3.5 rounded-xl shadow-2xl border border-indigo-500/60 animate-fadeIn text-xs space-y-2.5 font-sans">
                                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                                  <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span>Reasoning Summary: {idx.name}</span>
                                                  </div>
                                                  <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800">
                                                    Query Logs Analyzed
                                                  </span>
                                                </div>
                                                <p className="text-[11px] text-zinc-200 leading-relaxed font-sans">
                                                  {reasoning.reasoning}
                                                </p>
                                                <div className="p-2 bg-zinc-800/90 rounded border border-zinc-700/80 font-mono text-[10px] text-indigo-200 space-y-1">
                                                  <div className="text-zinc-400 text-[9px]">Recent Query Log Pattern:</div>
                                                  <div className="truncate">{reasoning.queryLogSnippet}</div>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-800">
                                                  <span>Executions: <strong className="text-emerald-400">{reasoning.logHitCount.toLocaleString()}</strong></span>
                                                  <span>Avg Latency: <strong className="text-indigo-300">{reasoning.avgLatencyMs}ms</strong></span>
                                                  <span>Seq Scans Avoided: <strong className="text-amber-400">{reasoning.seqScanAvoidedCount.toLocaleString()}</strong></span>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Color-Coded Usage Heatmap (Read/Write Ratio) Badge */}
                                        {showUsageHeatmap && (
                                          <span
                                            id={`card-usage-heat-${idx.name}`}
                                            data-testid={`card-usage-heat-${idx.name}`}
                                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition-all ${usageHeat.badgeClass}`}
                                            title={`Read-to-Write Ratio: ${usageHeat.ratio}x (${usageHeat.reads.toLocaleString()} reads vs ${usageHeat.writes.toLocaleString()} writes). ${usageHeat.verdict}`}
                                          >
                                            <TrendingUp className="w-3 h-3 shrink-0" />
                                            <span>{usageHeat.badgeLabel}</span>
                                          </span>
                                        )}

                                        {/* Color-Coded Index Impact Heatmap Latency Badge */}
                                        {showIndexImpactHeatmap && (
                                          <span
                                            id={`card-latency-heat-${idx.name}`}
                                            data-testid={`card-latency-heat-${idx.name}`}
                                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shadow-2xs transition-all ${latencyHeat.badgeClass}`}
                                            title={`Total Query Latency Contribution: ${latencyHeat.queryLatencyContributionMs} ms (${latencyHeat.executionShare} of workload) • Query: ${latencyHeat.baselineQueryName}`}
                                          >
                                            <Flame className="w-3 h-3 shrink-0 text-rose-600 animate-pulse" />
                                            <span>{latencyHeat.queryLatencyContributionMs}ms Latency</span>
                                            <span className="font-sans font-extrabold text-[9px] uppercase px-1 rounded bg-black/5">
                                              {latencyHeat.heatIntensity}
                                            </span>
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-sans px-1.5 py-0.2 rounded font-bold shadow-2xs" title="Calculated Query Complexity Reduction">
                                          ⚡ {getOptimizationPotential(idx.name)}
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          isRemoved
                                            ? 'bg-zinc-200 text-zinc-600 line-through'
                                            : idx.active
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-zinc-200 text-zinc-600'
                                        }`}>
                                          {isRemoved ? 'REMOVED' : idx.active ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
                                      <IndexActivitySparkline indexName={idx.name} reads={usageHeat.reads} writes={usageHeat.writes} />
                                      <IndexSizeTrendSparkline indexName={idx.name} />
                                    </div>

                                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 pb-2">
                                      <div className="text-[11px] text-zinc-500 font-mono">
                                        Type: {idx.type} • Columns: ({idx.columns.join(', ')})
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          id={`btn-drop-index-${idx.name}`}
                                          data-testid={`btn-drop-index-${idx.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isRemoved) {
                                              handleRestoreRemovedIndex(idx.name);
                                            } else {
                                              setRemovedIndexes((prev) => [...prev, idx.name]);
                                              setImportSuccessNotice(`🗑️ [Index Dropped] "${idx.name}" removed from table "${tbl.name}". Observe query performance impact: queries now fall back to full table sequential scans with increased latency and reduced throughput.`);
                                              setTimeout(() => setImportSuccessNotice(null), 5000);
                                              const ev = new CustomEvent('optimization-lifecycle-event', {
                                                detail: {
                                                  action: 'DELETE',
                                                  actionLabel: 'Manual Drop Index',
                                                  triggerSource: 'Index Details Pane',
                                                  targetIndex: idx.name,
                                                  targetTable: tbl.name,
                                                },
                                              });
                                              window.dispatchEvent(ev);
                                            }
                                          }}
                                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                                            isRemoved
                                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700'
                                              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                          }`}
                                          title={isRemoved ? 'Restore this dropped index' : 'Simulate dropping this index and observe query performance impact'}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>{isRemoved ? 'Restore Index' : 'Drop Index'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          id={`btn-simulate-fail-${idx.name}`}
                                          data-testid={`btn-simulate-fail-${idx.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSimulateFailure(idx.name);
                                          }}
                                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
                                            simulatedFailedIndexes.includes(idx.name)
                                              ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                              : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                                          }`}
                                          title="Temporarily disable this index's effect on queries to observe the immediate performance impact on execution plans in real-time."
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>{simulatedFailedIndexes.includes(idx.name) ? 'Simulating Failure (Offline)' : 'Simulate Index Failure'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          id={`btn-copy-sql-${idx.name}`}
                                           data-testid={`btn-copy-sql-${idx.name}`}
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             const ddl = `CREATE INDEX CONCURRENTLY ${idx.name} ON ${tbl.name} (${idx.columns.join(', ')});`;
                                             navigator.clipboard?.writeText(ddl);
                                             setCopiedDdlIndex(idx.name);
                                             setImportSuccessNotice(`[Copied to Clipboard] CREATE SQL syntax for index "${idx.name}" copied.`);
                                             setTimeout(() => setImportSuccessNotice(null), 4000);
                                           }}
                                           className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                                           title="Copy CREATE/DROP SQL syntax for this index to clipboard"
                                         >
                                           <Copy className="w-3 h-3 text-indigo-600" />
                                           <span>{copiedDdlIndex === idx.name ? 'Copied SQL!' : 'Copy SQL'}</span>
                                         </button>

                                         <button
                                           type="button"
                                           id={`btn-impact-prediction-${idx.name}`}
                                           data-testid={`btn-impact-prediction-${idx.name}`}
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setSelectedPredictionIndex(idx);
                                             setShowImpactPredictionModal(true);
                                           }}
                                           className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                                           title="Calculate and display estimated latency reduction for common queries if this index were optimized or rebuilt"
                                         >
                                           <Sparkles className="w-3 h-3 text-purple-600" />
                                           <span>Impact Prediction</span>
                                         </button>

                                         <button
                                           type="button"
                                           id={`btn-rebuild-${idx.name}`}
                                          data-testid={`btn-rebuild-${idx.name}`}
                                          disabled={rebuildingIndexes.includes(idx.name)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRebuildIndex(idx.name);
                                          }}
                                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                                          title="Trigger an immediate index maintenance rebuild operation (VACUUM & REINDEX)"
                                        >
                                          {rebuildingIndexes.includes(idx.name) ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              <span>Rebuilding...</span>
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="w-3 h-3" />
                                              <span>Rebuild Index</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {simulatedFailedIndexes.includes(idx.name) && (
                                    <div
                                      id={`simulate-fail-banner-${idx.name}`}
                                      data-testid={`simulate-fail-banner-${idx.name}`}
                                      className="my-2 p-2.5 bg-rose-100 border border-rose-400 rounded-lg flex items-center justify-between text-[11px] text-rose-950 shadow-xs animate-fadeIn"
                                    >
                                      <div className="flex items-center gap-2 font-semibold">
                                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 animate-bounce" />
                                        <div>
                                          <div>⚠️ [Simulated Failure Active] Index Offline</div>
                                          <div className="text-[10px] text-rose-800 font-normal">Execution plans falling back to full table sequential scan (Latency spiked from 1.2ms to 680ms; cost +900%).</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Calculated Index Health Score Breakdown (Frequency, Read-Write Ratio, Scan Efficiency) */}
                                  <div
                                    id={`health-breakdown-${idx.name}`}
                                    data-testid={`health-breakdown-${idx.name}`}
                                    className={`my-2 p-2.5 rounded-lg border text-[11px] space-y-1.5 shadow-2xs transition-colors ${
                                      isRemoved
                                        ? 'bg-zinc-50 border-zinc-200 text-zinc-500'
                                        : health.score >= 80
                                        ? 'bg-emerald-50/60 border-emerald-200'
                                        : health.score >= 50
                                        ? 'bg-amber-50/60 border-amber-200'
                                        : 'bg-rose-50/60 border-rose-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                                        <HeartPulse className={`w-3.5 h-3.5 ${isRemoved ? 'text-zinc-400' : health.textClass}`} />
                                        <span>Index Health Metrics</span>
                                        <span className="text-[10px] font-mono text-zinc-500 font-normal hidden sm:inline">
                                          (0-100 calculated score)
                                        </span>
                                      </div>
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                        isRemoved ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : health.badgeClass
                                      }`}>
                                        {health.score}/100 • {health.rating}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-0.5">
                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Frequency of Use (35% weight in score)">
                                          1. Frequency (35%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.frequencyScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.frequencyMetric}>
                                          {health.frequencyMetric}
                                        </div>
                                      </div>

                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Read-Write Ratio (35% weight in score)">
                                          2. R/W Ratio (35%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.readWriteScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.readWriteMetric}>
                                          {health.readWriteMetric}
                                        </div>
                                      </div>

                                      <div className="bg-white/95 p-1.5 rounded border border-zinc-200/90 flex flex-col justify-between shadow-2xs">
                                        <div className="text-zinc-500 font-medium truncate" title="Scan Efficiency (30% weight in score)">
                                          3. Scan Effic. (30%)
                                        </div>
                                        <div className="font-mono font-bold text-zinc-800 text-[11px] mt-0.5">
                                          {health.scanEfficiencyScore}/100
                                        </div>
                                        <div className="text-[9px] text-zinc-500 truncate" title={health.scanEfficiencyMetric}>
                                          {health.scanEfficiencyMetric}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Proactive Re-Index Action Banner if Low Health or Fragmentation > 30% */}
                                  {(() => {
                                    const isReindexed = reindexedIndexes.includes(idx.name);
                                    const fragmentation = isReindexed ? 3 : (idx.name.includes('missing') || idx.name.includes('date') || !idx.active) ? 38 : 12;
                                    const effectiveHealthScore = isReindexed ? Math.max(health.score, 95) : health.score;

                                    return (effectiveHealthScore < 70 || fragmentation > 30) && !isRemoved ? (
                                      <div
                                        id={`reindex-banner-${idx.name}`}
                                        data-testid={`reindex-banner-${idx.name}`}
                                        className="my-2 p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between text-[11px] text-rose-950 shadow-2xs"
                                      >
                                        <div className="flex items-center gap-2 font-semibold">
                                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                                          <div>
                                            <div>Index Fragmentation Alert: {fragmentation}% B-Tree Bloat Detected</div>
                                            <div className="text-[10px] text-rose-700 font-normal">Health score is {effectiveHealthScore}/100. Run REINDEX CONCURRENTLY to rebuild tree balance and eliminate sequential page reads.</div>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          id={`btn-reindex-${idx.name}`}
                                          data-testid={`btn-reindex-${idx.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReindexIndex(idx.name);
                                          }}
                                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] shadow-xs cursor-pointer transition-colors shrink-0"
                                        >
                                          ⚡ Run REINDEX CONCURRENTLY
                                        </button>
                                      </div>
                                    ) : null;
                                  })()}

                                  {(() => {
                                    const impact = getIndexImpactSummary(idx.name);
                                    return (
                                      <div className="my-2 p-2 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] space-y-0.5 shadow-2xs">
                                        <div className="font-bold text-zinc-900 flex items-center justify-between">
                                          <span>📊 {impact.topQuery}</span>
                                          <span className="font-mono text-[10px] text-indigo-700 font-semibold">{impact.reduction}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {showDetailedStats && (
                                    <div className="my-1.5 p-2 bg-indigo-50/70 rounded-lg border border-indigo-200 text-[11px] font-mono flex items-center justify-between text-indigo-950">
                                      <span>Storage Size: <strong className="text-indigo-900">{idx.active ? (idx.name.includes('PRIMARY') ? '4.8 MB' : '2.1 MB') : '0 KB'}</strong></span>
                                      <span>Hit Rate: <strong className="text-emerald-700">{idx.active ? '99.4%' : '0.0%'}</strong></span>
                                    </div>
                                  )}

                                  {/* Dynamic Mini-Execution Plan Preview under each index listing */}
                                  {showQueryImpact && (() => {
                                    const plan = getMiniExecutionPlanPreview(idx.name, idx.active, tbl.name);
                                    return (
                                      <div
                                        id={`mini-plan-${idx.name}`}
                                        data-testid={`mini-plan-${idx.name}`}
                                        className="my-2 p-3 bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 shadow-inner font-mono text-[11px] space-y-2 animate-fadeIn"
                                      >
                                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 flex-wrap gap-1 font-sans">
                                          <div className="flex items-center gap-1.5 text-zinc-300">
                                            <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-300">
                                              Mini-Execution Plan (EXPLAIN)
                                            </span>
                                          </div>
                                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-2xs ${plan.badgeClass}`}>
                                            {plan.badgeText}
                                          </span>
                                        </div>

                                        {/* Visual Execution Tree */}
                                        <div className="space-y-1">
                                          <pre className="text-emerald-300/90 text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-black/60 p-2.5 rounded-lg border border-zinc-800/80">
                                            {plan.planTree}
                                          </pre>
                                        </div>

                                        {/* Planner Cost & Latency Metrics */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[9.5px] font-mono text-zinc-400 pt-0.5">
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Planner Cost:</span>
                                            <span className="text-zinc-200 font-bold truncate ml-1">{plan.cost.split(' ')[0].replace('cost=', '')}</span>
                                          </div>
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Exec Latency:</span>
                                            <span className={plan.isOptimized ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                              {plan.execTime}
                                            </span>
                                          </div>
                                          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800/80 flex items-center justify-between">
                                            <span className="text-zinc-500 font-sans">Scan Method:</span>
                                            <span className="text-indigo-300 font-bold truncate ml-1">{plan.scanMethod}</span>
                                          </div>
                                        </div>

                                        {/* Target Query Preview */}
                                        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80 truncate">
                                          <span className="text-zinc-500 font-sans">Target Query: </span>
                                          <code className="text-zinc-300 text-[10px] font-mono">{plan.querySql}</code>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-zinc-200/60 text-[11px] gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={idx.active ? 'font-medium text-emerald-700' : 'text-zinc-500'}>
                                        {idx.active ? '⚡ Optimizes WHERE & JOIN lookups to O(log n)' : '⚠️ Inactive or missing index'}
                                      </span>
                                      {isLocked && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                          <Lock className="w-3 h-3 text-amber-700" />
                                          Manual High-Priority
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        id={`btn-lock-index-${idx.name}`}
                                        data-testid={`btn-lock-index-${idx.name}`}
                                        aria-label={isLocked ? `Unlock index ${idx.name}` : `Lock index ${idx.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleLockIndex(idx.name);
                                        }}
                                        className={`px-2.5 py-1 rounded-md font-bold text-[10px] transition-all cursor-pointer shadow-xs flex items-center gap-1.5 border ${
                                          isLocked
                                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 ring-1 ring-amber-300'
                                            : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400'
                                        }`}
                                        title={
                                          isLocked
                                            ? `Index is locked (High-Priority Manual). Protected from Auto-Optimize and Index Cleanup. Click to unlock.`
                                            : `Lock Index: Prevent Auto-Optimize and Index Cleanup operations from ever modifying or removing this high-priority index.`
                                        }
                                      >
                                        {isLocked ? (
                                          <>
                                            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                            <span>Locked Index</span>
                                          </>
                                        ) : (
                                          <>
                                            <Unlock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                            <span>Lock Index</span>
                                          </>
                                        )}
                                      </button>
                                      {idx.active && !idx.name.includes('PRIMARY KEY') && (
                                        <button
                                          type="button"
                                          disabled={isLocked}
                                          onClick={() => {
                                            if (isLocked) {
                                              setImportSuccessNotice(`Cannot undo optimization: Index "${idx.name}" is locked as high-priority manual.`);
                                              setTimeout(() => setImportSuccessNotice(null), 4000);
                                              return;
                                            }
                                            if (idx.name.includes('status') || idx.name.includes('cat')) {
                                              if (flags.btreeIndexing) onToggleFlag('btreeIndexing');
                                            } else if (idx.name.includes('line_items') || idx.columns.includes('transaction_id')) {
                                              if (flags.batchEagerLoading) onToggleFlag('batchEagerLoading');
                                            } else if (idx.columns.includes('customer_email')) {
                                              setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'customer_email'));
                                            } else if (idx.columns.includes('amount')) {
                                              setCreatedCustomIndexes(createdCustomIndexes.filter((c) => c !== 'amount'));
                                            }
                                          }}
                                          className={`px-2 py-0.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded font-semibold text-[10px] transition-colors shadow-2xs ${
                                            isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                          }`}
                                          title={isLocked ? 'Index is locked: Protected from automated modifications' : 'Revert / Undo optimization on this index'}
                                        >
                                          Undo Optimization
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Empty state if search returns zero indexes */}
              {indexSearchQuery &&
                tables
                  .filter((tbl) => indexCategoryFilter === 'all' || indexCategoryFilter === tbl.name)
                  .every((tbl) => {
                    const q = indexSearchQuery.trim().toLowerCase();
                    return !tbl.indexes.some(
                      (idx) =>
                        idx.name.toLowerCase().includes(q) ||
                        idx.type.toLowerCase().includes(q) ||
                        idx.columns.some((c) => c.toLowerCase().includes(q)) ||
                        tbl.name.toLowerCase().includes(q) ||
                        (tbl.entityName && tbl.entityName.toLowerCase().includes(q)) ||
                        (idx.targetTable && idx.targetTable.toLowerCase().includes(q))
                    );
                  }) && (
                  <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-300 rounded-xl space-y-2 animate-fadeIn">
                    <p className="text-xs text-zinc-500">
                      No indexes found matching name or target table &ldquo;<span className="font-mono text-zinc-800 font-bold">{indexSearchQuery}</span>&rdquo; in the selected filter.
                    </p>
                    <button
                      type="button"
                      id="btn-empty-clear-filter"
                      data-testid="btn-empty-clear-filter"
                      onClick={() => {
                        setIndexSearchQuery('');
                        setIndexCategoryFilter('all');
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Clear Filter &amp; Show All Indexes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Relational Foreign Key Graph */}
          <div>
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Relational Foreign Key Graph &amp; Join Paths
            </h4>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              {currentTableData.relationships.length === 0 ? (
                <div className="text-xs text-zinc-500 italic">No foreign key relations mapped for this table.</div>
              ) : (
                currentTableData.relationships.map((rel, i) => (
                  <div key={`rel-${i}`} className="bg-white p-3 rounded-lg border border-zinc-200 text-xs font-mono space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-zinc-900">{currentTableData.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-bold text-indigo-700">{rel.targetTable}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 text-[11px]">{rel.foreignKey}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rel.optimized ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {rel.optimized ? 'Batched Join' : 'N+1 Unbatched'}
                        </span>
                      </div>
                    </div>
                    {compareWithBaseline && (
                      <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="line-through text-rose-700 font-mono text-[10px] bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Baseline: N+1 Unbatched (100+ DB queries, ~840ms)
                          </span>
                          <span className="text-zinc-400">➔</span>
                          <span className={`font-bold font-mono text-[10px] px-1.5 py-0.2 rounded border ${rel.optimized ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                            Current: {rel.optimized ? 'Batched Join (1 query, 3.2ms, +99.6% Speedup)' : 'N+1 Unbatched'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {rel.optimized ? '99 Queries Saved' : '0 Saved'}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 'AI-Driven Index Suggestion' Side Panel */}
        {showAiSuggestionsSidePanel ? (
          <div
            id="ai-driven-index-suggestion-side-panel"
            data-testid="ai-driven-index-suggestion-side-panel"
            className="lg:col-span-4 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-zinc-200 bg-gradient-to-b from-indigo-50/40 via-white to-zinc-50/50 p-4 sm:p-5 space-y-4 overflow-y-auto flex flex-col max-h-[750px] lg:max-h-none"
          >
            {/* Side Panel Header with Mode Switcher */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-200">
              <div className="flex items-start gap-2.5">
                <div className={`p-2 rounded-xl shadow-xs shrink-0 mt-0.5 text-white ${
                  sidePanelViewMode === 'complexity-heatmap'
                    ? 'bg-gradient-to-br from-rose-600 via-amber-600 to-rose-700'
                    : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800'
                }`}>
                  {sidePanelViewMode === 'complexity-heatmap' ? (
                    <Flame className="w-4 h-4 text-amber-200 animate-pulse" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                      {sidePanelViewMode === 'complexity-heatmap'
                        ? 'Complexity Heatmap (Tree View)'
                        : 'AI-Driven Index Suggestions'}
                    </h3>
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                      sidePanelViewMode === 'complexity-heatmap'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-purple-100 text-purple-800 border-purple-200'
                    }`}>
                      {sidePanelViewMode === 'complexity-heatmap' ? 'Downstream Blast Radius' : 'Query History AI'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                    {sidePanelViewMode === 'complexity-heatmap'
                      ? 'Color-codes dependency tree nodes by number of downstream queries affected to identify high-risk indexes.'
                      : 'Analyzed 14,200 user query patterns in history to uncover high-impact composite index opportunities.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-ai-side-panel"
                data-testid="btn-close-ai-side-panel"
                onClick={() => setShowAiSuggestionsSidePanel(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors shrink-0"
                title="Collapse side panel"
                aria-label="Collapse side panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Side Panel View Mode Tabs */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200/80">
              <button
                type="button"
                id="btn-side-panel-tab-complexity-heatmap"
                data-testid="btn-side-panel-tab-complexity-heatmap"
                onClick={() => setSidePanelViewMode('complexity-heatmap')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'complexity-heatmap'
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Complexity Heatmap</span>
              </button>
              <button
                type="button"
                id="btn-side-panel-tab-suggestions"
                data-testid="btn-side-panel-tab-suggestions"
                onClick={() => setSidePanelViewMode('suggestions')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'suggestions'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Suggestions</span>
                <span className="font-mono text-[9px] bg-white/20 px-1 rounded">4</span>
              </button>
              <button
                type="button"
                id="btn-side-panel-tab-lifecycle"
                data-testid="btn-side-panel-tab-lifecycle"
                onClick={() => setSidePanelViewMode('lifecycle-analytics')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'lifecycle-analytics'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Lifecycle</span>
              </button>
              <button
                type="button"
                id="btn-side-panel-tab-usage"
                data-testid="btn-side-panel-tab-usage"
                onClick={() => setSidePanelViewMode('index-usage')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'index-usage'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Index Usage</span>
              </button>
              <button
                type="button"
                id="btn-side-panel-tab-correlation"
                data-testid="btn-side-panel-tab-correlation"
                onClick={() => setSidePanelViewMode('correlation')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'correlation'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Correlation</span>
              </button>
              <button
                type="button"
                id="btn-side-panel-tab-history"
                data-testid="btn-side-panel-tab-history"
                onClick={() => setSidePanelViewMode('history')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidePanelViewMode === 'history'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
            </div>

            {sidePanelViewMode === 'complexity-heatmap' ? (
              <ComplexityHeatmapPanel
                lockedIndexes={lockedIndexes}
                onToggleLockIndex={handleToggleLockIndex}
                removedIndexes={removedIndexes}
                onRemoveIndex={handleRemoveUnutilizedIndex}
                onRestoreIndex={handleRestoreRemovedIndex}
                flags={flags}
                createdCompositeIndexes={createdCompositeIndexes}
                createdCustomIndexes={createdCustomIndexes}
                importedCustomIndices={importedCustomIndices}
                onSelectIndexDetail={(indexName) => {
                  setSelectedCompositeSuggestionId(indexName);
                }}
              />
            ) : sidePanelViewMode === 'lifecycle-analytics' ? (
              <IndexLifecycleAnalyticsPanel
                tables={tables}
                lockedIndexes={lockedIndexes}
                createdCompositeIndexes={createdCompositeIndexes}
                createdCustomIndexes={createdCustomIndexes}
                batchProtectionEnabled={batchProtectionEnabled}
              />
            ) : sidePanelViewMode === 'index-usage' ? (
              <IndexUsageOverviewDashboard
                tables={tables}
                lockedIndexes={lockedIndexes}
                createdCompositeIndexes={createdCompositeIndexes}
                createdCustomIndexes={createdCustomIndexes}
              />
            ) : sidePanelViewMode === 'correlation' ? (
              <GlobalIndexCorrelationChart />
            ) : sidePanelViewMode === 'history' ? (
              <IndexChangeHistoryPanel />
            ) : (
              <>
            {/* High-Read Query Pattern Automator & One-Click Apply Index */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-indigo-50/90 rounded-xl border border-indigo-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>High-Read Query Pattern Automator</span>
                </span>
                <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                  4 Patterns Identified
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                AI analyzer identified high-read-count query execution traces lacking covering indexes. Click <strong>'One-Click Apply Index'</strong> to instantly resolve full table scan bottlenecks.
              </p>
              <div className="space-y-2">
                {[
                  {
                    id: 'hr_1',
                    query: 'SELECT * FROM transactions WHERE customer_id = $1 AND status = $2',
                    reads: '420 queries/min',
                    missingIndex: 'idx_transactions_customer_status_covering',
                    createStatement: 'CREATE INDEX CONCURRENTLY idx_transactions_customer_status_covering ON transactions (customer_id, status) INCLUDE (amount);',
                    isApplied: appliedEngineIndexIds.includes('rec_transactions_full_scan') || appliedEngineIndexIds.includes('hr_1')
                  },
                  {
                    id: 'hr_2',
                    query: 'SELECT sum(quantity) FROM order_items WHERE product_id = $1 GROUP BY product_id',
                    reads: '280 queries/min',
                    missingIndex: 'idx_order_items_product_covering',
                    createStatement: 'CREATE INDEX CONCURRENTLY idx_order_items_product_covering ON order_items (product_id) INCLUDE (quantity, unit_price);',
                    isApplied: appliedEngineIndexIds.includes('rec_order_items_scan') || appliedEngineIndexIds.includes('hr_2')
                  },
                  {
                    id: 'hr_3',
                    query: 'SELECT email FROM customers WHERE tier = \'enterprise\' AND signup_date > ...',
                    reads: '190 queries/min',
                    missingIndex: 'idx_customers_tier_covering',
                    createStatement: 'CREATE INDEX CONCURRENTLY idx_customers_tier_covering ON customers (tier) INCLUDE (signup_date, email);',
                    isApplied: appliedEngineIndexIds.includes('rec_customers_tier_scan') || appliedEngineIndexIds.includes('hr_3')
                  },
                  {
                    id: 'hr_4',
                    query: 'SELECT * FROM audit_logs WHERE timestamp >= NOW() - INTERVAL \'1 hour\'',
                    reads: '510 queries/min',
                    missingIndex: 'idx_audit_logs_timestamp_covering',
                    createStatement: 'CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp_covering ON audit_logs (timestamp) INCLUDE (severity, message);',
                    isApplied: appliedEngineIndexIds.includes('rec_audit_logs_scan') || appliedEngineIndexIds.includes('hr_4')
                  }
                ].map((pat) => (
                  <div key={pat.id} className="p-2.5 bg-white rounded-lg border border-indigo-100 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-[10px] font-bold text-zinc-900 truncate max-w-[200px]" title={pat.query}>
                          {pat.query}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
                          <span className="font-semibold text-rose-700">{pat.reads}</span>
                          <span className="font-mono text-indigo-800">{pat.missingIndex}</span>
                        </div>
                      </div>
                      <div>
                        {pat.isApplied ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Applied</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            id={`btn-one-click-apply-${pat.id}`}
                            data-testid={`btn-one-click-apply-${pat.id}`}
                            onClick={() => {
                              setAppliedEngineIndexIds(prev => Array.from(new Set([...prev, pat.id])));
                              if (!flags.btreeIndexing) onToggleFlag('btreeIndexing');
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>One-Click Apply Index</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Query History Analytics Strip */}
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Historical Query Pattern Scope</span>
                </span>
                <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  14,200 Query Traces
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Opportunities</div>
                  <div className="font-mono font-bold text-xs text-purple-700 mt-0.5">
                    {compositeIndexOpportunities.length} Composite
                  </div>
                </div>
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Applied State</div>
                  <div className="font-mono font-bold text-xs text-emerald-700 mt-0.5">
                    {compositeIndexOpportunities.filter(o => o.isApplied).length} of {compositeIndexOpportunities.length} Active
                  </div>
                </div>
                <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="text-[10px] text-zinc-500 font-medium">Max Speedup</div>
                  <div className="font-mono font-bold text-xs text-indigo-700 mt-0.5">
                    253x Faster
                  </div>
                </div>
              </div>

              {/* Suggestion History Trend Chart */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI Suggestion History &amp; Evolution</span>
                  </h4>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                    Last 5 Epochs
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Visualizes how AI recommendations evolved as query workloads and table join patterns shifted over time.
                </p>
                <div className="space-y-1.5 pt-1">
                  {[
                    { epoch: 'Epoch 1 (24h ago)', count: 1, confidence: '68%', focus: 'Single-column filter scans', color: 'bg-amber-400' },
                    { epoch: 'Epoch 2 (18h ago)', count: 2, confidence: '79%', focus: 'Initial multi-column join checks', color: 'bg-purple-400' },
                    { epoch: 'Epoch 3 (12h ago)', count: 3, confidence: '88%', focus: 'Composite filtering on orders & tx', color: 'bg-indigo-500' },
                    { epoch: 'Epoch 4 (6h ago)', count: 4, confidence: '94%', focus: 'Advanced covering index inclusion', color: 'bg-teal-500' },
                    { epoch: 'Epoch 5 (Current)', count: compositeIndexOpportunities.length, confidence: '99.4%', focus: 'Optimal multi-table composite set', color: 'bg-emerald-600' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-zinc-200/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-800">
                        <span>{item.epoch}</span>
                        <span className="text-indigo-700">{item.confidence} AI Confidence</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} transition-all`} style={{ width: `${Math.min(100, (item.count / 4) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-zinc-600 shrink-0">{item.count} Active Recs</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 italic">Focus: {item.focus}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Single Click Batch Action */}
              <button
                type="button"
                id="btn-apply-all-composite-opportunities"
                data-testid="btn-apply-all-composite-opportunities"
                onClick={() => {
                  setCreatedCompositeIndexes(['email_status', 'category_amount', 'tx_price', 'tier_created']);
                  setBulkOptimizeSuccessNotice('Successfully applied all 4 AI-recommended composite indexes across transactions, line_items, and customers!');
                  setTimeout(() => setBulkOptimizeSuccessNotice(null), 5000);
                }}
                disabled={compositeIndexOpportunities.every(o => o.isApplied)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                  compositeIndexOpportunities.every(o => o.isApplied)
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>
                  {compositeIndexOpportunities.every(o => o.isApplied)
                    ? '✓ All Composite Opportunities Active'
                    : `Apply All ${compositeIndexOpportunities.filter(o => !o.isApplied).length} Composite Opportunities`}
                </span>
              </button>
            </div>

            {/* 'Efficiency Trend' Chart in Index Side Panel */}
            <IndexEfficiencyTrendChart
              selectedIndexId={selectedCompositeSuggestionId}
              onSelectIndexId={(id) => setSelectedCompositeSuggestionId(id)}
            />

            {/* 'Performance Delta' Bar Chart in Index Side Panel */}
            <IndexPerformanceDeltaBarChart
              selectedIndexId={selectedCompositeSuggestionId}
              onSelectIndexId={(id) => setSelectedCompositeSuggestionId(id)}
            />

            {/* Table Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
              </span>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('all')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                All ({compositeIndexOpportunities.length})
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('transactions')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'transactions'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                transactions (2)
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('line_items')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'line_items'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                line_items (1)
              </button>
              <button
                type="button"
                onClick={() => setCompositePatternFilter('customers')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  compositePatternFilter === 'customers'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                customers (1)
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center justify-between gap-2 pt-1 pb-1 border-t border-zinc-200/60 mt-2">
              <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">Rank Suggestions:</span>
              <select
                id="select-ai-suggestion-sort"
                data-testid="select-ai-suggestion-sort"
                value={aiSuggestionSortBy}
                onChange={(e) => setAiSuggestionSortBy(e.target.value as any)}
                className="text-xs bg-white border border-zinc-300 rounded-md py-1 px-2.5 text-zinc-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                aria-label="Sort AI Index Suggestions"
              >
                <option value="gain">Expected Performance Gain</option>
                <option value="risk">Risk Level</option>
                <option value="complexity">Complexity</option>
              </select>
            </div>

            {/* List of Composite Index Opportunities */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
              {compositeIndexOpportunities
                .filter(opp => compositePatternFilter === 'all' || opp.targetTable === compositePatternFilter)
                .sort((a, b) => {
                  if (aiSuggestionSortBy === 'gain') {
                    const speedA = parseInt(a.speedup?.replace(/\D/g, '') || '0', 10);
                    const speedB = parseInt(b.speedup?.replace(/\D/g, '') || '0', 10);
                    return speedB - speedA;
                  } else if (aiSuggestionSortBy === 'risk') {
                    const rank = (r?: string) => r?.includes('Critical') ? 3 : r?.includes('High') ? 2 : r?.includes('Medium') ? 1 : 0;
                    return rank(b.riskLevel) - rank(a.riskLevel);
                  } else {
                    return b.columns.length - a.columns.length;
                  }
                })
                .map((opp) => {
                  const isSelected = selectedCompositeSuggestionId === opp.id;
                  return (
                    <div
                      key={opp.id}
                      id={`composite-opportunity-${opp.id}`}
                      data-testid={`composite-opportunity-${opp.id}`}
                      className={`p-3.5 rounded-xl border transition-all text-xs space-y-3 bg-white ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-sm'
                          : 'border-zinc-200 hover:border-zinc-300 shadow-2xs'
                      }`}
                    >
                      {/* Opportunity Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs text-zinc-900">
                              {opp.name}
                            </span>
                            <span className="font-mono text-[9px] bg-zinc-100 text-zinc-700 px-1.5 py-0.2 rounded font-semibold border border-zinc-200">
                              {opp.targetTable}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {opp.queryPurpose}
                          </div>
                        </div>

                        {opp.isApplied ? (
                          <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full shrink-0 border border-indigo-200">
                            +{opp.speedup} Speedup
                          </span>
                        )}
                      </div>

                      {/* Composite Column Ordering Structure */}
                      <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                          <span>Composite Column Ordering Blueprint</span>
                          <span className="text-[9px] text-indigo-700 font-normal">Prefix Rule Enforced</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {opp.columnOrdering.map((col, idx) => (
                            <React.Fragment key={col.column}>
                              <div className="px-2 py-1 bg-white rounded border border-zinc-300 text-[10px] font-mono shadow-2xs">
                                <span className="text-zinc-400 font-sans mr-1">Col {idx + 1}:</span>
                                <strong className="text-indigo-950 font-bold">{col.column}</strong>
                              </div>
                              {idx < opp.columnOrdering.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Historical Query Pattern in History */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-zinc-700 flex items-center gap-1">
                            <Search className="w-3 h-3 text-indigo-600" />
                            <span>Query Pattern in History:</span>
                          </span>
                          <span className="font-mono text-zinc-500 font-medium">
                            {opp.frequencyPerHour} ({opp.executionShare})
                          </span>
                        </div>
                        <div className="p-2 bg-zinc-950 text-indigo-200 rounded-lg font-mono text-[10.5px] overflow-x-auto border border-zinc-800 shadow-inner">
                          {opp.querySql}
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-0.5 text-zinc-500">
                          <span>Latency delta: <strong className="text-rose-600 line-through">{opp.latencyBefore}</strong> ➔ <strong className="text-emerald-700 font-bold">{opp.latencyAfter}</strong></span>
                          <span className="font-mono text-emerald-700 font-extrabold">{opp.speedupMultiplier}</span>
                        </div>
                      </div>

                      {/* Rationale Section */}
                      <div className="p-2.5 bg-gradient-to-r from-indigo-50/70 to-purple-50/40 rounded-lg border border-indigo-200/80 space-y-1.5">
                        <div className="font-bold text-indigo-950 flex items-center gap-1 text-[11px]">
                          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Technical Rationale:</span>
                        </div>
                        <p className="text-[11px] text-zinc-700 leading-relaxed">
                          {opp.rationale.summary}
                        </p>
                        <div className="pt-1.5 border-t border-indigo-100 space-y-1 text-[10px]">
                          <div>
                            <strong className="text-indigo-900">Why this column order:</strong>
                            <span className="text-zinc-600 ml-1">{opp.rationale.columnOrderJustification}</span>
                          </div>
                          <div>
                            <strong className="text-indigo-900">Planner transformation:</strong>
                            <span className="text-zinc-600 ml-1">{opp.rationale.plannerMechanics}</span>
                          </div>
                        </div>
                      </div>

                      {/* Predictive Usage Section */}
                      <div className="p-2.5 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-xl border border-indigo-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-950 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Predictive 30-Day Usage Forecast</span>
                          </span>
                          <span className="font-mono text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.2 rounded font-bold">
                            99.8% Confidence
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-0.5 text-[10px]">
                          <div className="p-1.5 bg-white/80 rounded border border-indigo-100">
                            <span className="text-zinc-500 block">Est. 30-Day Invocations:</span>
                            <span className="font-mono font-extrabold text-indigo-900 text-xs">
                              ~{(opp.id.length * 12450 + 34200).toLocaleString()} hits
                            </span>
                          </div>
                          <div className="p-1.5 bg-white/80 rounded border border-indigo-100">
                            <span className="text-zinc-500 block">Query Engine Hit Probability:</span>
                            <span className="font-mono font-extrabold text-emerald-700 text-xs">
                              94.2% Index-Only Scan
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => setSelectedCompositeSuggestionId(opp.id)}
                          className={`text-[10px] font-semibold cursor-pointer underline hover:text-indigo-700 ${
                            isSelected ? 'text-indigo-700 font-bold' : 'text-zinc-500'
                          }`}
                        >
                          {isSelected ? 'Viewing SQL DDL & Plan ▼' : 'Inspect SQL DDL & Plan ►'}
                        </button>

                        <button
                          type="button"
                          id={`btn-toggle-composite-${opp.id}`}
                          data-testid={`btn-toggle-composite-${opp.id}`}
                          onClick={opp.onToggle}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                            opp.isApplied
                              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                          }`}
                        >
                          {opp.isApplied ? (
                            <>
                              <RefreshCw className="w-3 h-3 text-zinc-500" />
                              <span>Revert Optimization</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                              <span>Apply Composite Index</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Inspector when Selected */}
                      {isSelected && (
                        <div className="pt-2 border-t border-indigo-100 space-y-2 animate-fadeIn bg-indigo-50/30 p-2.5 rounded-lg border">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-zinc-800">PostgreSQL DDL Definition:</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(opp.ddlStatement);
                                setCopiedDdlIndex(opp.id);
                                setTimeout(() => setCopiedDdlIndex(null), 2500);
                              }}
                              className="text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer flex items-center gap-1"
                              title="Copy DDL command to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedDdlIndex === opp.id ? 'Copied!' : 'Copy DDL'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-zinc-900 text-emerald-300 rounded font-mono text-[10px] overflow-x-auto border border-zinc-800">
                            {opp.ddlStatement}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                            <div className="p-1.5 bg-white rounded border border-zinc-200">
                              <span className="text-zinc-500">Storage Footprint:</span>
                              <strong className="block text-zinc-800 font-mono mt-0.5">{opp.storageFootprint}</strong>
                            </div>
                            <div className="p-1.5 bg-white rounded border border-zinc-200">
                              <span className="text-zinc-500">Write Amplification:</span>
                              <strong className="block text-zinc-800 font-mono mt-0.5">{opp.writeImpact}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            </>
            )}
          </div>
        ) : (
          /* Docked Tab when Side Panel is Collapsed */
          <div className="hidden lg:flex flex-col items-center justify-start border-l border-zinc-200 bg-zinc-50/80 p-2 shrink-0 space-y-2">
            <button
              type="button"
              id="btn-reopen-complexity-heatmap-side-panel"
              data-testid="btn-reopen-complexity-heatmap-side-panel"
              onClick={() => {
                setShowAiSuggestionsSidePanel(true);
                setSidePanelViewMode('complexity-heatmap');
              }}
              className="py-4 px-2 bg-gradient-to-b from-rose-50 to-amber-50 hover:from-rose-100 hover:to-amber-100 border border-rose-300 text-rose-950 rounded-xl shadow-xs cursor-pointer flex flex-col items-center gap-2.5 transition-all hover:scale-105"
              title="Open Complexity Heatmap side panel (Dependency tree & downstream query blast radius)"
            >
              <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
              <span className="[writing-mode:vertical-rl] text-[11px] font-extrabold tracking-wider uppercase text-rose-900">
                Complexity Heatmap
              </span>
              <span className="font-mono text-[9px] bg-rose-200 text-rose-900 font-bold px-1 rounded-full">
                Tree
              </span>
            </button>
            <button
              type="button"
              id="btn-reopen-ai-side-panel"
              data-testid="btn-reopen-ai-side-panel"
              onClick={() => {
                setShowAiSuggestionsSidePanel(true);
                setSidePanelViewMode('suggestions');
              }}
              className="py-4 px-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl shadow-xs cursor-pointer flex flex-col items-center gap-2.5 transition-all hover:scale-105"
              title="Open AI-Driven Index Suggestion side panel"
            >
              <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
              <span className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                AI Suggestions
              </span>
              <span className="font-mono text-[9px] bg-purple-100 text-purple-800 font-bold px-1 rounded-full">
                4
              </span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="DatabaseSchemaExplorerView bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/80 via-white to-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Database Schema Explorer</span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                ER Diagram &amp; Index Audit
              </span>

              {/* Constraint Conflict Monitor Warning Badge */}
              {detectedConstraintConflicts.length > 0 ? (
                <button
                  type="button"
                  id="badge-constraint-conflict-monitor"
                  data-testid="badge-constraint-conflict-monitor"
                  onClick={() => setShowReconcileIndexesModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm ring-2 ring-amber-300 animate-pulse transition-all cursor-pointer select-none"
                  title="Constraint Conflict Monitor: Overlapping covering indexes with different column ordering detected. Click to reconcile."
                  aria-label="Constraint Conflict Monitor Warning"
                >
                  <AlertTriangle className="w-3.5 h-3.5 fill-amber-200 text-amber-950 shrink-0" />
                  <span>Constraint Conflict ({detectedConstraintConflicts.length} Overlapping)</span>
                  <span className="text-[10px] bg-amber-900/60 text-amber-100 px-1.5 py-0.2 rounded-full font-mono">
                    Reconcile
                  </span>
                </button>
              ) : Object.keys(resolvedConstraintConflicts).length > 0 ? (
                <button
                  type="button"
                  id="badge-constraint-conflict-monitor-resolved"
                  data-testid="badge-constraint-conflict-monitor"
                  onClick={() => setShowReconcileIndexesModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer shadow-2xs select-none"
                  title="All overlapping covering index constraint conflicts reconciled."
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Covering Constraints: Reconciled</span>
                </button>
              ) : null}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Visualize relational table foreign keys, current B-Tree index coverage, and resolve missing index bottlenecks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Real-time Index Filter Input Field */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              id="filter-indexes-input-header"
              name="filter-indexes-input-header"
              data-testid="filter-indexes-input-header"
              value={indexSearchQuery}
              onChange={(e) => setIndexSearchQuery(e.target.value)}
              placeholder="Filter indexes by name or target table..."
              aria-label="Filter indexes by name or target table"
              className="pl-8 pr-7 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-48 sm:w-64 shadow-2xs font-mono"
            />
            {indexSearchQuery && (
              <button
                type="button"
                onClick={() => setIndexSearchQuery('')}
                className="absolute right-2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown in Header */}
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-xs font-semibold text-zinc-600 select-none">Sort By:</span>
            <div className="relative">
              <select
                id="select-header-sort-by"
                data-testid="select-header-sort-by"
                value={indexRankSort}
                onChange={(e) => setIndexRankSort(e.target.value as any)}
                className="bg-transparent font-mono text-xs font-bold text-indigo-950 focus:outline-hidden cursor-pointer pr-5 appearance-none"
                aria-label="Sort indexes by usage, size, fragmentation level, or write intensity"
                title="Sort indexes by usage, size, fragmentation level, or write intensity"
              >
                <option value="usage">Index Usage (High ➔ Low)</option>
                <option value="size">Size (Largest ➔ Smallest)</option>
                <option value="fragmentation">Fragmentation Level (High ➔ Low)</option>
                <option value="write_intensity">Write Intensity (High ➔ Low)</option>
                <option value="impact_desc">Index Impact Score</option>
                <option value="latency_desc">Query Latency Contribution</option>
                <option value="health_desc">Health Score</option>
              </select>
              <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <label
            htmlFor="toggle-compare-baseline"
            id="lbl-compare-baseline"
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all shadow-xs ${
              compareWithBaseline
                ? 'bg-amber-500 text-white border border-amber-600 ring-2 ring-amber-300'
                : 'bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900'
            }`}
            title="Overlay current index configuration against default unoptimized schema to visually highlight performance gains"
          >
            <span className="flex items-center gap-1.5">
              <Layers className={`w-3.5 h-3.5 ${compareWithBaseline ? 'text-white' : 'text-indigo-600'}`} />
              <span>Compare with Baseline</span>
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                id="toggle-compare-baseline"
                data-testid="toggle-compare-baseline"
                checked={compareWithBaseline}
                onChange={(e) => setCompareWithBaseline(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`w-8 h-4 rounded-full transition-colors relative ${compareWithBaseline ? 'bg-amber-900' : 'bg-zinc-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-[2px] transition-transform ${compareWithBaseline ? 'left-[18px]' : 'left-[2px]'}`} />
              </div>
            </div>
            {compareWithBaseline && (
              <span className="px-1.5 py-0.2 bg-amber-700 text-white rounded text-[10px] font-bold">
                ON
              </span>
            )}
          </label>

          {/* Bulk Index Optimization Toggle in Header */}
          <label
            htmlFor="toggle-bulk-index-optimization"
            id="lbl-bulk-index-optimization"
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all shadow-xs ${
              isBulkOptimizationModeActive
                ? 'bg-purple-600 text-white border border-purple-700 ring-2 ring-purple-300'
                : 'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800'
            }`}
            title="Toggle Bulk Index Optimization mode to mass-select and execute REORGANIZE or REBUILD based on fragmentation levels"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className={`w-3.5 h-3.5 ${isBulkOptimizationModeActive ? 'text-white' : 'text-purple-600'}`} />
              <span>Bulk Index Optimization</span>
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                id="toggle-bulk-index-optimization"
                data-testid="toggle-bulk-index-optimization"
                checked={isBulkOptimizationModeActive}
                onChange={(e) => {
                  setIsBulkOptimizationModeActive(e.target.checked);
                  if (e.target.checked && selectedIndexes.length === 0) {
                    const allNames = allRankedSchemaIndexes.map(item => item.index.name);
                    setSelectedIndexes(allNames);
                  }
                }}
                className="sr-only peer"
              />
              <div className={`w-8 h-4 rounded-full transition-colors relative ${isBulkOptimizationModeActive ? 'bg-purple-950' : 'bg-zinc-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-[2px] transition-transform ${isBulkOptimizationModeActive ? 'left-[18px]' : 'left-[2px]'}`} />
              </div>
            </div>
            {isBulkOptimizationModeActive && (
              <span className="px-1.5 py-0.2 bg-purple-900 text-white rounded text-[10px] font-bold">
                ACTIVE
              </span>
            )}
          </label>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800 cursor-pointer select-none">
            <span>Show Index Stats (Size &amp; Hit Rate)</span>
            <input
              type="checkbox"
              id="toggle-detailed-stats"
              checked={showDetailedStats}
              onChange={(e) => setShowDetailedStats(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
          </label>

          <label
            id="label-show-query-impact"
            data-testid="label-show-query-impact"
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer select-none transition-all shadow-2xs ${
              showQueryImpact
                ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 ring-1 ring-indigo-200'
                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
            title="Dynamically display a mini-execution plan preview directly under each index listing"
          >
            <Activity className={`w-3.5 h-3.5 ${showQueryImpact ? 'text-indigo-600' : 'text-zinc-500'}`} />
            <span>Show Query Impact</span>
            <input
              type="checkbox"
              id="toggle-show-query-impact"
              name="toggle-show-query-impact"
              data-testid="toggle-show-query-impact"
              checked={showQueryImpact}
              onChange={(e) => setShowQueryImpact(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
            />
            {showQueryImpact && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[10px] font-bold">
                ON
              </span>
            )}
          </label>

          {/* 'Snapshot State' button and corresponding checkpoints dropdown to switch between multiple saved checkpoints instantly */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-1 shadow-2xs">
            <button
              type="button"
              id="btn-snapshot-state"
              data-testid="btn-snapshot-state"
              onClick={handleOpenSnapshotModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Create a named checkpoint of the current index configuration"
            >
              <History className="w-3.5 h-3.5 text-amber-300" />
              <span>Snapshot State</span>
            </button>

            <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-200">
              <label htmlFor="select-checkpoint-dropdown" className="text-[11px] text-zinc-500 font-semibold hidden md:inline select-none">
                Checkpoints:
              </label>
              <div className="relative">
                <select
                  id="select-checkpoint-dropdown"
                  data-testid="select-checkpoint-dropdown"
                  value={selectedCheckpointId}
                  onChange={(e) => handleSelectCheckpoint(e.target.value)}
                  className="text-xs bg-white border border-zinc-300 rounded-md py-1.5 pl-2.5 pr-8 text-zinc-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs appearance-none font-sans"
                  aria-label="Switch between saved checkpoints instantly"
                  title="Switch between saved checkpoints instantly"
                >
                  {snapshots.map((snap) => (
                    <option key={snap.id} value={snap.id}>
                      {snap.name} ({snap.totalIndexesCount ?? snap.customIndexes.length} idx • {snap.timestamp})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                id="btn-open-snapshots-manager"
                data-testid="btn-open-snapshots-manager"
                onClick={() => setShowSnapshotsModal(true)}
                className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-200/60 rounded-md cursor-pointer transition-colors"
                title="Manage all checkpoints & snapshots"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>

              <label
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer border shadow-2xs ${
                  enableAutoHealing
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-1 ring-emerald-300'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
                title="Enable Auto-Healing: Automatically executes REINDEX CONCURRENTLY when any index drops below 50% health."
              >
                <input
                  type="checkbox"
                  id="checkbox-enable-auto-healing"
                  data-testid="checkbox-enable-auto-healing"
                  checked={enableAutoHealing}
                  onChange={(e) => setEnableAutoHealing(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <HeartPulse className={`w-3.5 h-3.5 ${enableAutoHealing ? 'text-emerald-700 animate-pulse' : 'text-zinc-500'}`} />
                <span>Auto-Healing (&lt;50%)</span>
              </label>
            </div>
          </div>

          <button
            id="btn-quick-index-check"
            type="button"
            onClick={() => {
              setSelectedTable('transactions');
              setQuickIndexChecked(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs animate-pulse"
            title="Instantly highlight the most impactful missing indexes for currently active query search results"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Quick Index Check</span>
          </button>

          <button
            type="button"
            id="btn-header-open-complexity-heatmap"
            data-testid="btn-header-open-complexity-heatmap"
            onClick={() => {
              if (showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap') {
                setShowAiSuggestionsSidePanel(false);
              } else {
                setShowAiSuggestionsSidePanel(true);
                setSidePanelViewMode('complexity-heatmap');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap'
                ? 'bg-gradient-to-r from-rose-700 via-amber-700 to-rose-800 text-white border-rose-600 shadow-xs ring-1 ring-rose-300'
                : 'bg-white hover:bg-rose-50 border-rose-200 text-rose-900'
            }`}
            title="Open Complexity Heatmap in side panel to color-code dependency tree nodes by downstream queries affected"
          >
            <Flame className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap' ? 'text-amber-200 animate-pulse' : 'text-rose-600'}`} />
            <span>Complexity Heatmap</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              showAiSuggestionsSidePanel && sidePanelViewMode === 'complexity-heatmap' ? 'bg-rose-950 text-rose-200' : 'bg-rose-100 text-rose-800'
            }`}>
              Tree
            </span>
          </button>

          <button
            type="button"
            id="btn-toggle-ai-suggestions-sidepanel"
            data-testid="btn-toggle-ai-suggestions-sidepanel"
            onClick={() => setShowAiSuggestionsSidePanel(!showAiSuggestionsSidePanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border ${
              showAiSuggestionsSidePanel
                ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white border-purple-600 shadow-xs ring-1 ring-purple-300'
                : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title="Toggle AI-Driven Index Suggestion side panel in Explorer view"
          >
            <Sparkles className={`w-3.5 h-3.5 ${showAiSuggestionsSidePanel ? 'text-amber-300' : 'text-purple-600'}`} />
            <span>AI Index Suggestions Side Panel</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              showAiSuggestionsSidePanel ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
            }`}>
              {showAiSuggestionsSidePanel ? 'OPEN' : `${compositeIndexOpportunities.length} Opportunities`}
            </span>
          </button>

          <button
            type="button"
            id="btn-ai-index-suggestions"
            data-testid="btn-ai-index-suggestions"
            onClick={() => setShowSuggestIndexesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Open AI-Driven Index Suggestion engine with 'Why' side-panel summary detailing query patterns"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Index Suggestions &amp; &apos;Why&apos; Panel</span>
            <span className="px-1.5 py-0.2 bg-black/20 text-white rounded-full text-[10px] font-mono font-bold">
              {indexSuggestions.filter(s => !s.isApplied).length} Available
            </span>
          </button>

          <button
            type="button"
            id="btn-intelligent-indexing-advisor"
            data-testid="btn-intelligent-indexing-advisor"
            onClick={() => setShowIntelligentAdvisorModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border border-cyan-400/40"
            title="Open Intelligent Indexing Advisor to cross-reference query patterns with missing covering indexes and apply One-Click Patches"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-200" />
            <span>Intelligent Indexing Advisor</span>
            <span className="px-1.5 py-0.2 bg-black/25 text-cyan-100 rounded-full text-[10px] font-mono font-bold">
              {COVERING_INDEX_CATALOG.filter(p => !patchedCoveringIndexIds.includes(p.id)).length} Missing
            </span>
          </button>

          <button
            type="button"
            id="btn-index-recommendation-engine"
            data-testid="btn-index-recommendation-engine"
            onClick={() => setShowIndexRecommendationEngineModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs border border-violet-400/40"
            title="Open Index Recommendation Engine for AI analysis of recent query execution plans and Full Table Scan scenarios"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-200" />
            <span>Index Recommendation Engine</span>
            <span className="px-1.5 py-0.2 bg-black/25 text-violet-100 rounded-full text-[10px] font-mono font-bold">
              {fullTableScanRecommendations.filter(r => !appliedEngineIndexIds.includes(r.id)).length} Scans Identified
            </span>
          </button>

          <div
            className="relative inline-block"
            onMouseEnter={() => setShowBulkOptimizePopover(true)}
            onMouseLeave={() => setShowBulkOptimizePopover(false)}
          >
            <button
              type="button"
              id="btn-bulk-optimize"
              data-testid="btn-bulk-optimize"
              onClick={handleApplyBulkOptimize}
              disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                bulkOptimizationPlan.isFullyOptimized
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white'
              }`}
              title="Calculates optimal set of changes for all listed indexes and applies all recommended improvements at once"
            >
              {isApplyingBulkOptimize ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                  <span>Optimizing Schema...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Bulk Optimize</span>
                  {bulkOptimizationPlan.isFullyOptimized ? (
                    <span className="ml-1 px-1.5 py-0.2 bg-emerald-800 text-emerald-100 rounded-full text-[10px] font-bold">
                      Optimal (96/100)
                    </span>
                  ) : (
                    <span className="ml-1 px-1.5 py-0.2 bg-black/25 text-white rounded-full text-[10px] font-mono font-bold">
                      {bulkOptimizationPlan.pendingChanges.length} Pending
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Optimization Summary Hover Popover */}
            {showBulkOptimizePopover && (
              <div
                id="bulk-optimize-summary-popover"
                data-testid="bulk-optimize-summary-popover"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-zinc-900 text-white p-3.5 rounded-xl shadow-2xl border border-emerald-500/50 z-50 text-xs animate-fadeIn font-sans"
              >
                <div className="flex items-center justify-between font-bold text-emerald-400 mb-2 border-b border-zinc-800 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>Bulk Optimization Summary</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Ready to Apply</span>
                </div>
                <div className="space-y-1.5 text-zinc-300 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>🗑️ Indexes to be Removed:</span>
                    <span className="font-mono font-bold text-rose-400">1 Unutilized</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>🔗 Indexes to be Merged:</span>
                    <span className="font-mono font-bold text-amber-400">2 Overlapping</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>✨ Indexes to be Created:</span>
                    <span className="font-mono font-bold text-emerald-400">4 Composite</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Projected Schema Health:</span>
                    <span className="font-mono font-bold text-emerald-400">98 / 100 (+34 pts)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-global-housekeeper"
            data-testid="btn-global-housekeeper"
            onClick={handleRunHousekeeperScan}
            disabled={isScanningHousekeeper}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Run Global Housekeeper scan for unprotected low-usage indexes with weekly schedule"
          >
            {isScanningHousekeeper ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-200" />
                <span>Housekeeper Scanning...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
                <span>Global Housekeeper ({housekeeperFrequency})</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-auto-optimize-workload"
            data-testid="btn-auto-optimize-workload"
            onClick={handleAutoOptimizeWorkload}
            disabled={isAutoOptimizingWorkload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Automatically run workload analysis on query history and toggle optimal B-Tree indexes to maximize read throughput for expensive queries"
          >
            {isAutoOptimizingWorkload ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>Analyzing Workload...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Auto-Optimize Workload Indexes</span>
                {autoOptimizedCompleted && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-800 text-emerald-100 rounded-full text-[10px] font-bold">
                    Optimal
                  </span>
                )}
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-suggest-composite-indexes"
            data-testid="btn-suggest-composite-indexes"
            onClick={() => {
              setShowSuggestIndexesModal(true);
              handleAnalyzeWorkload();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Analyze query history to identify multi-column filtering patterns and propose composite index structures"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggest Composite Indexes</span>
          </button>

          <button
            type="button"
            id="btn-index-cleanup"
            data-testid="btn-index-cleanup"
            onClick={handleRunIndexCleanupScan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Perform diagnostic scan for any indexes unutilized in the last 100 queries and flag for removal to save disk space"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Index Cleanup</span>
            {cleanupScanCompleted && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-800 text-rose-100 rounded-full text-[10px] font-bold">
                {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} Flagged
              </span>
            )}
          </button>

          <button
            type="button"
            id="btn-cluster-analysis"
            data-testid="btn-cluster-analysis"
            onClick={() => setShowClusterAnalysisModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Analyze index clusters and query pattern overlap to consolidate indexes"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cluster Analysis</span>
          </button>

          <button
            type="button"
            id="btn-cross-reference-report"
            data-testid="btn-cross-reference-report"
            onClick={() => setShowCrossReferenceReportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Maps selected indexes against historical query performance data to identify zombie indexes that provide no measurable performance gain"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Cross-Reference Report</span>
          </button>

          <button
            type="button"
            id="btn-analyze-consolidation"
            data-testid="btn-analyze-consolidation"
            onClick={() => setShowClusterAnalysisModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Uses AI integration to analyze query execution patterns and suggest merging redundant or overlapping indexes into a single multi-column index"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyze for Consolidation</span>
          </button>

          <button
            type="button"
            id="btn-revert-all-indexes"
            data-testid="btn-revert-all-indexes"
            onClick={handleRevertAllIndexes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Immediately restore database schema to default initial state by resetting all custom index flags"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
            <span>Revert All Index Changes</span>
          </button>

          <button
            type="button"
            id="btn-toolbar-bulk-apply-all"
            data-testid="btn-toolbar-bulk-apply-all"
            onClick={handleApplyBulkOptimize}
            disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
              bulkOptimizationPlan.isFullyOptimized
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            }`}
            title="Calculate and enable all optimal index improvements across all listed tables at once"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>
              {bulkOptimizationPlan.isFullyOptimized
                ? '✓ All Optimal'
                : `Bulk Apply (${bulkOptimizationPlan.pendingChanges.length})`}
            </span>
          </button>

          <button
            type="button"
            id="btn-export-schema-state"
            data-testid="btn-export-schema-state"
            onClick={handleExportSchemaState}
            disabled={isExportingState}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Generate a JSON snapshot of the current index configuration, allowing users to save their optimized state"
          >
            {isExportingState ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>Exporting Schema State...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Schema State</span>
              </>
            )}
          </button>

          {/* Export Impact Report Primary Action in Header */}
          <button
            type="button"
            id="btn-export-impact-report"
            data-testid="btn-export-impact-report"
            onClick={handleExportImpactReport}
            disabled={isExportingImpactReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Generate a structured JSON file containing the current index list, their associated health scores, and latency contribution metrics for external analysis"
            aria-label="Export Impact Report"
          >
            {isExportingImpactReport ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-200" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-rose-100" />
                <span>Export Impact Report</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-bulk-import-indices"
            data-testid="btn-bulk-import-indices"
            onClick={() => {
              setShowBulkImportModal(true);
              setBulkImportActiveTab('upload');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Accept a JSON file of index configurations to quickly prototype different database schema states"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-300" />
            <span>Bulk Import Indices</span>
          </button>

          {/* Optimization Lifecycle Log Header Action */}
          <button
            type="button"
            id="btn-view-optimization-lifecycle-log"
            data-testid="btn-view-optimization-lifecycle-log"
            onClick={() => setShowLifecycleLogModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-700 hover:from-emerald-600 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Open Optimization Lifecycle Log capturing automatic index creation, deletion, and consolidation merging"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Optimization Lifecycle</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSchemaReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Download JSON report of current schema diagnostic findings"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Download Schema Report</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQueryComplexityInfo(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Explain how missing indexes affect query complexity for top 3 slowest queries"
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>Query Complexity Guide</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Close Explorer
            </button>
          )}
        </div>
      </div>

      {/* Export Schema State Success Feedback Notification */}
      {exportSuccessNotice && (
        <div
          id="export-schema-state-success-alert"
          data-testid="export-schema-state-success-alert"
          className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-950 flex items-center justify-between gap-3 animate-fadeIn shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{exportSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-[11px] font-bold cursor-pointer hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bulk Import Indices Success Feedback Notification */}
      {importSuccessNotice && (
        <div
          id="bulk-import-schema-state-success-alert"
          data-testid="bulk-import-schema-state-success-alert"
          className="bg-purple-50 border-b border-purple-200 px-6 py-2.5 text-xs text-purple-950 flex items-center justify-between gap-3 animate-fadeIn shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-semibold">{importSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessNotice(null)}
            className="text-purple-700 hover:text-purple-950 text-[11px] font-bold cursor-pointer hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* View Mode Tabs: Schema Explorer vs Dependency Chain */}
      <div className="px-6 py-2.5 bg-zinc-100/90 border-b border-zinc-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('explorer')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'explorer'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Schema Explorer &amp; Indexes</span>
        </button>
        <button
          type="button"
          id="btn-dependency-chain-tab"
          data-testid="btn-dependency-chain-tab"
          onClick={() => setActiveTab('dependency-chain')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'dependency-chain'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Index Dependency Chain</span>
        </button>
        <button
          type="button"
          id="btn-index-dependency-tab"
          data-testid="btn-index-dependency-tab"
          onClick={() => setActiveTab('index-dependency')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'index-dependency'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Covering Index Dependencies</span>
        </button>
        <button
          type="button"
          id="btn-index-health-monitor-tab"
          data-testid="btn-index-health-monitor-tab"
          onClick={() => setActiveTab('index-health-monitor')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'index-health-monitor'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
          <span>Index Health Monitor</span>
        </button>
        <button
          type="button"
          id="btn-index-storage-heatmap-tab"
          data-testid="btn-index-storage-heatmap-tab"
          onClick={() => setActiveTab('index-storage-heatmap')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'index-storage-heatmap'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-600" />
          <span>Index Storage Heatmap</span>
        </button>
        <button
          type="button"
          id="btn-index-heatmap-tab"
          data-testid="btn-index-heatmap-tab"
          onClick={() => setActiveTab('index-heatmap')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'index-heatmap'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Index Heatmap (D3 Bubble)</span>
        </button>
      </div>

      {/* Workload Auto-Optimization Active Status Banner */}
      {autoOptimizedCompleted && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-b border-emerald-200 px-6 py-3 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="font-bold flex items-center gap-2 text-emerald-950">
                <span>Optimal B-Tree Index Set Active</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-200 text-emerald-900 border border-emerald-300">
                  +15,400% Read Throughput
                </span>
                <span className="text-[10px] text-emerald-700 font-mono">P99: 1.9ms (-99.6%)</span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Workload analysis evaluated 14,200 queries: Toggled optimal composite B-Tree indexes (<code className="font-mono bg-emerald-100 px-1 rounded font-bold">category, amount</code> &amp; <code className="font-mono bg-emerald-100 px-1 rounded font-bold">customer_email, status</code>) and foreign key joins to maximize read throughput.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-view-workload-audit"
              data-testid="btn-view-workload-audit"
              onClick={() => setShowWorkloadOptimizationModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              View Workload Audit Report
            </button>
            <button
              type="button"
              onClick={() => setAutoOptimizedCompleted(false)}
              className="p-1 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Baseline Comparison Overlay Comprehensive Dashboard */}
      {compareWithBaseline && (
        <div id="baseline-comparison-overlay-dashboard" className="bg-gradient-to-b from-amber-50/90 via-orange-50/50 to-white border-b border-amber-200 px-6 py-4 space-y-4 animate-fadeIn shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Baseline Comparison Overlay Active</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                    Default vs. Current Schema Delta
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-0.5">
                  Overlays current index structures against the default unoptimized schema to visually measure empirical performance gains.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-apply-full-optimization-compare"
                data-testid="btn-apply-full-optimization-compare"
                onClick={handleAutoOptimizeWorkload}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Apply Full Optimization</span>
              </button>
              <button
                type="button"
                id="btn-reset-baseline-compare"
                data-testid="btn-reset-baseline-compare"
                onClick={handleRevertAllIndexes}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Baseline Default</span>
              </button>
              <button
                type="button"
                onClick={() => setCompareWithBaseline(false)}
                className="p-1.5 text-amber-800 hover:text-amber-950 rounded-lg hover:bg-amber-100 cursor-pointer"
                title="Exit Comparison Overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Column Comparison Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Default Baseline Schema */}
            <div className="p-4 bg-white/95 rounded-xl border border-rose-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                <span className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Default Baseline Schema</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                  Unoptimized
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Active Indexes:</span>
                  <strong className="font-mono text-zinc-900">1 (Primary Key Only)</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Execution Strategy:</span>
                  <strong className="font-mono text-rose-700">Seq Scan (O(n))</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Avg Query Latency:</span>
                  <strong className="font-mono text-rose-700 font-bold">482 ms</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Read Throughput:</span>
                  <strong className="font-mono text-zinc-800">120 QPS</strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Relational Joins:</span>
                  <strong className="font-mono text-rose-700">N+1 (100+ Trips)</strong>
                </div>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg text-[11px] text-rose-900 border border-rose-100">
                ⚠️ Severe lock contention &amp; CPU spikes. Sequential scans on 50,000 records.
              </div>
            </div>

            {/* Column 2: Current Configuration */}
            <div className="p-4 bg-white/95 rounded-xl border border-indigo-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Current Schema State</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {speedUpPercent > 50 ? 'Optimized' : 'Partially Configured'}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Active Indexes:</span>
                  <strong className="font-mono text-indigo-900">
                    {currentTableData.indexes.filter(idx => idx.active && !removedIndexes.includes(idx.name)).length} Active
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Execution Strategy:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 50 ? 'B-Tree Seek (O(log n))' : 'Mixed Seek / Scan'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Avg Query Latency:</span>
                  <strong className="font-mono text-emerald-700 font-bold">
                    {speedUpPercent > 80 ? '1.8 ms' : speedUpPercent > 50 ? '42 ms' : '482 ms'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Read Throughput:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 80 ? '18,600 QPS' : speedUpPercent > 50 ? '3,200 QPS' : '120 QPS'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Relational Joins:</span>
                  <strong className="font-mono text-indigo-900">
                    {flags.batchEagerLoading ? 'Batched Hash Join (1 Trip)' : 'N+1 Unbatched'}
                  </strong>
                </div>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg text-[11px] text-indigo-900 border border-indigo-100">
                {speedUpPercent > 80
                  ? '⚡ Optimal B-Tree leaf node clustering enabled across all hot paths.'
                  : '🔧 Configure composite indexes and batch eager loading to unlock peak throughput.'}
              </div>
            </div>

            {/* Column 3: Performance Gains Achieved */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-white rounded-xl border border-emerald-300 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                  <span>Performance Gains Achieved</span>
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  Delta Δ
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-700">
                  <span>⚡ Latency Reduction:</span>
                  <strong className="font-mono text-emerald-700 font-extrabold">
                    {speedUpPercent > 80 ? '-99.6% (482ms → 1.8ms)' : speedUpPercent > 50 ? '-91.2% (482ms → 42ms)' : '0% (Baseline)'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🚀 Throughput Multiplier:</span>
                  <strong className="font-mono text-emerald-700 font-extrabold">
                    {speedUpPercent > 80 ? '+15,400% (154x Gain)' : speedUpPercent > 50 ? '+2,566% (26x Gain)' : 'Baseline'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🛡️ Full Scans Avoided:</span>
                  <strong className="font-mono text-emerald-700">
                    {speedUpPercent > 50 ? '50,000 Rows Skipped' : '0'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>🔄 Join Trips Saved:</span>
                  <strong className="font-mono text-emerald-700">
                    {flags.batchEagerLoading ? '99+ Queries / Request' : '0'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-zinc-700">
                  <span>💾 Write Contention:</span>
                  <strong className="font-mono text-emerald-700">
                    {removedIndexes.includes('idx_transactions_date') ? '-14% Lock Overhead' : '0%'}
                  </strong>
                </div>
              </div>
              <div className="p-2 bg-emerald-100/80 rounded-lg text-[11px] text-emerald-950 font-medium border border-emerald-200">
                🎉 Realized empirical gains: Zero full-table scans on search, category grouping, and relational joins.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Index Check Analysis Banner */}
      {quickIndexChecked && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 text-xs text-orange-950 flex items-center justify-between animate-fadeIn shadow-inner">
          <div className="flex items-center gap-2.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-orange-500 animate-ping shrink-0" />
            <span>
              <strong>Quick Index Check Analysis:</strong> Identified 2 high-impact missing indexes (<code className="font-mono bg-orange-200/80 px-1.5 py-0.5 rounded font-bold text-orange-900">customer_email</code>, <code className="font-mono bg-orange-200/80 px-1.5 py-0.5 rounded font-bold text-orange-900">amount</code>) affecting active query search results. Estimated latency reduction: <strong className="text-emerald-700">72ms → 0.4ms (O(n) → O(log n))</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkApplyAllIndexes}
              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
            >
              Fix All Now
            </button>
            <button
              type="button"
              onClick={() => setQuickIndexChecked(false)}
              className="text-orange-700 hover:text-orange-900 px-1.5 py-1 text-[11px] font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Query Complexity Modal Popup */}
      {showQueryComplexityInfo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Missing Indexes &amp; Query Complexity Reduction
                  </h3>
                  <p className="text-xs text-zinc-500">
                    How indexing transforms O(n) linear scans into O(log n) lookups for the top 3 slowest queries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQueryComplexityInfo(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>1. Customer Email Wildcard/Exact Lookup</span>
                  <span className="font-mono text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px]">O(n) → O(log n)</span>
                </div>
                <p className="text-zinc-600">
                  Searching by customer email without an index forces a full sequential table scan across all 50,000 transaction rows. Adding <code className="font-mono text-indigo-700">idx_transactions_email</code> builds a B-Tree structure, reducing row evaluation from 50,000 to ~12 operations.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>2. Transaction Amount Range Filters</span>
                  <span className="font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[10px]">O(n) Range Scan → O(log n) Seek</span>
                </div>
                <p className="text-zinc-600">
                  Range filters (<code className="font-mono">amount &gt; 500</code>) require inspecting unindexed decimal values row by row. Adding <code className="font-mono text-indigo-700">idx_transactions_amount</code> allows the query planner to instantly seek the B-Tree leaf node pointer.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                <div className="font-bold text-zinc-900 flex items-center justify-between">
                  <span>3. N+1 Line Items Foreign Key Cascades</span>
                  <span className="font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded text-[10px]">100+ Roundtrips → Batched IN Join</span>
                </div>
                <p className="text-zinc-600">
                  Unindexed foreign keys (<code className="font-mono">line_items.transaction_id</code>) trigger a separate database subquery for every order record (N+1 storm). Indexing the foreign key and batching joins reduces roundtrips from 100+ to just 2.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQueryComplexityInfo(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI-Driven Index Suggestion Engine & 'Why' Side-Panel Summary Modal */}
      {showSuggestIndexesModal && (() => {
        const activeSuggestion = indexSuggestions.find(s => s.id === selectedSuggestionId) || indexSuggestions[0];
        const filteredSuggestions = indexSuggestions.filter(s => {
          if (suggestionFilterTab === 'all') return true;
          return s.patternCategory === suggestionFilterTab;
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col text-zinc-900 relative">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-emerald-600 text-white rounded-xl shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                        AI-Driven Index Suggestion Engine &amp; Workload Analyzer
                      </h3>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        14,200 Queries Analyzed
                      </span>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                        99.4% Optimizer Confidence
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Analyzes execution traces to identify slow table joins &amp; filter clauses, providing a detailed &ldquo;Why&rdquo; side-panel summary for every recommendation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-auto-optimize-workload-modal"
                    data-testid="btn-auto-optimize-workload-modal"
                    onClick={() => {
                      handleAutoOptimizeWorkload();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                    title="Automatically apply optimal indexes across all query bottlenecks"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>Auto-Apply All Optimal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuggestIndexesModal(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                    aria-label="Close suggestions modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Master-Detail Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 overflow-hidden flex-1 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 min-h-0">
                {/* Left Panel: Suggestion List & Controls (5 columns) */}
                <div className="lg:col-span-5 p-4 sm:p-5 overflow-y-auto space-y-4 bg-zinc-50/60">
                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-[11px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-zinc-400" />
                      <span>Category:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      All ({indexSuggestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('filter')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'filter'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Filter Clauses ({indexSuggestions.filter(s => s.patternCategory === 'filter').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('join')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'join'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Table Joins ({indexSuggestions.filter(s => s.patternCategory === 'join').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionFilterTab('composite')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        suggestionFilterTab === 'composite'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      Composite ({indexSuggestions.filter(s => s.patternCategory === 'composite').length})
                    </button>
                  </div>

                  {/* Workload Scanner Status Bar */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center justify-between gap-2 shadow-2xs text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold text-zinc-900">Live Workload Analyzer</div>
                        <div className="text-[10px] text-zinc-500">Continuous execution trace telemetry</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-analyze-workload"
                      data-testid="btn-analyze-workload"
                      onClick={handleAnalyzeWorkload}
                      disabled={isAnalyzingWorkload}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold rounded text-[11px] cursor-pointer transition-colors shrink-0"
                    >
                      {isAnalyzingWorkload ? 'Scanning...' : 'Re-Scan Workload'}
                    </button>
                  </div>

                  {/* Overlapping Index Conflict Warning */}
                  {createdCustomIndexes.length >= 2 && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2 animate-fadeIn shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Overlapping Index Warning:</strong>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Multiple single-column custom indexes are active. Consider composite index consolidation to avoid +{(createdCustomIndexes.length * 6).toFixed(0)}% write amplification.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suggestion Cards List */}
                  <div className="space-y-2.5">
                    {filteredSuggestions.map((s) => {
                      const isSelected = selectedSuggestionId === s.id;
                      return (
                        <div
                          key={s.id}
                          id={`suggestion-card-${s.id}`}
                          data-testid={`suggestion-card-${s.id}`}
                          onClick={() => setSelectedSuggestionId(s.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs relative ${
                            isSelected
                              ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-md'
                              : 'bg-white hover:bg-zinc-100/70 border-zinc-200 hover:border-zinc-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-zinc-900">{s.name}</span>
                                {isSelected && (
                                  <span className="bg-indigo-600 text-white text-[9px] font-sans font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
                                    Active View
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono mt-0.5">
                                <Table className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{s.targetTable} ({s.targetColumns.join(', ')})</span>
                              </div>
                            </div>
                            <span className="bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded text-[10px] shrink-0 border border-emerald-200">
                              {s.speedup}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              s.patternCategory === 'join'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : s.patternCategory === 'composite'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {s.patternType}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {s.frequency}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-600 line-clamp-2 mb-2.5">
                            {s.targetQueryName}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSuggestionId(s.id);
                              }}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                            >
                              <span>View &ldquo;Why&rdquo; Breakdown</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                s.onToggle();
                              }}
                              className={`px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer transition-colors shadow-2xs ${
                                s.isApplied
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {s.isApplied ? '✓ Index Active' : 'Apply Index'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Storage vs Speedup Summary Box */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-amber-700" />
                        <span>Storage Footprint vs Speedup</span>
                      </span>
                      <span className="font-mono text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        Database: 48.2 MB
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Indexes trade modest disk storage (3–7 MB) and write amplification (&lt;1ms) for up to 99.8% read latency reduction across 14,200 hourly queries.
                    </p>
                  </div>
                </div>

                {/* Right Panel: The 'Why' Behind Each Suggestion Side-Panel Summary (7 columns) */}
                <div
                  id="suggestion-why-side-panel"
                  data-testid="suggestion-why-side-panel"
                  className="lg:col-span-7 p-5 sm:p-6 overflow-y-auto bg-white space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-5">
                    {/* Side-Panel Header & Breadcrumb */}
                    <div className="pb-4 border-b border-zinc-200">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider font-sans">
                            Recommendation &ldquo;Why&rdquo; Summary
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          activeSuggestion.isApplied
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-300'
                        }`}>
                          {activeSuggestion.isApplied ? 'OPTIMIZATION ACTIVE' : 'RECOMMENDED ACTION'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-mono font-bold text-zinc-900 flex items-center gap-2">
                            <span>{activeSuggestion.name}</span>
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mt-0.5">
                            <span>Target: <strong className="text-zinc-800">{activeSuggestion.targetTable}</strong> ({activeSuggestion.targetColumns.join(', ')})</span>
                            <span>•</span>
                            <span className="text-indigo-700 font-semibold">{activeSuggestion.type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-2xs">
                            ⚡ {activeSuggestion.speedup} ({activeSuggestion.speedupFactor})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 1: The 'Why' Behind This Suggestion */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-indigo-50/50 to-white border border-indigo-200 rounded-xl space-y-2 text-xs text-indigo-950 shadow-2xs">
                      <div className="flex items-center gap-2 font-bold text-indigo-950">
                        <Info className="w-4 h-4 text-indigo-700 shrink-0" />
                        <span className="text-xs uppercase tracking-wide">Why Was This Index Recommended?</span>
                      </div>
                      <p className="text-zinc-700 text-xs leading-relaxed">
                        {activeSuggestion.whyExplanation}
                      </p>
                    </div>

                    {/* Section 2: Specific Query Patterns Triggering Recommendation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 uppercase tracking-wide">
                          <Target className="w-4 h-4 text-indigo-600" />
                          <span>Triggering Query Patterns &amp; Clauses</span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {activeSuggestion.patternType}
                        </span>
                      </div>

                      {/* Triggering SQL Code Preview */}
                      <div className="bg-zinc-900 text-zinc-100 rounded-xl p-3.5 font-mono text-xs overflow-x-auto shadow-inner border border-zinc-800 space-y-1">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-sans font-bold flex items-center justify-between pb-1 border-b border-zinc-800">
                          <span>Target Query Template</span>
                          <span className="text-emerald-400">{activeSuggestion.frequency}</span>
                        </div>
                        <pre className="text-zinc-100 font-mono text-[11px] pt-1 whitespace-pre-wrap">
                          {activeSuggestion.querySql}
                        </pre>
                      </div>

                      {/* Detailed Triggering Clauses Analysis */}
                      <div className="space-y-2">
                        {activeSuggestion.triggeringClauses.map((clause, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200">
                                {clause.clauseType}
                              </span>
                              <code className="font-mono text-[11px] font-bold text-indigo-950 bg-white px-2 py-0.5 rounded border border-zinc-200">
                                {clause.code}
                              </code>
                            </div>
                            <p className="text-[11px] text-zinc-600 leading-relaxed">
                              {clause.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Workload Traffic & Latency Impact */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">Query Frequency</span>
                        <div className="font-mono font-bold text-zinc-900 text-sm">
                          {activeSuggestion.frequency}
                        </div>
                        <span className="text-[10px] text-zinc-500">Live production trace</span>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">CPU Workload Share</span>
                        <div className="font-mono font-bold text-indigo-700 text-sm">
                          {activeSuggestion.executionShare}
                        </div>
                        <span className="text-[10px] text-zinc-500">Total database read time</span>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                        <span className="text-[10px] text-zinc-500 font-medium">Latency Speedup</span>
                        <div className="font-mono font-bold text-emerald-700 text-sm flex items-center gap-1">
                          <span className="line-through text-zinc-400 text-xs">{activeSuggestion.latencyBefore}</span>
                          <span>→</span>
                          <span>{activeSuggestion.latencyAfter}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">{activeSuggestion.throughputAfter} throughput</span>
                      </div>
                    </div>

                    {/* Section 4: Query Execution Plan Comparison (Before vs After) */}
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs text-zinc-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Query Execution Plan (EXPLAIN) Comparison</span>
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-sans">
                            <span className="font-bold text-rose-900 text-xs">Without Recommended Index</span>
                            <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded">
                              O(n) Full Scan
                            </span>
                          </div>
                          <pre className="text-rose-950 text-[10px] whitespace-pre-wrap leading-tight bg-white/80 p-2 rounded border border-rose-200">
                            {activeSuggestion.planBefore}
                          </pre>
                        </div>

                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between font-sans">
                            <span className="font-bold text-emerald-900 text-xs">With Recommended Index</span>
                            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded">
                              O(log n) Leaf Seek
                            </span>
                          </div>
                          <pre className="text-emerald-950 text-[10px] whitespace-pre-wrap leading-tight bg-white/80 p-2 rounded border border-emerald-200">
                            {activeSuggestion.planAfter}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Planner Mechanics & Storage Tradeoff */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-800">Database Optimizer Mechanics:</span>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-zinc-600">Storage: <strong>{activeSuggestion.storageOverhead}</strong></span>
                          <span>•</span>
                          <span className="text-zinc-600">Write Cost: <strong>{activeSuggestion.writeImpact}</strong></span>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed">
                        {activeSuggestion.plannerMechanics}
                      </p>
                    </div>
                  </div>

                  {/* Side-Panel Action Footer */}
                  <div className="pt-4 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">
                      Recommendation status: <strong className={activeSuggestion.isApplied ? 'text-emerald-700' : 'text-zinc-700'}>
                        {activeSuggestion.isApplied ? 'Applied & Active in Schema' : 'Pending Deployment'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-sidepanel-toggle-suggestion"
                        data-testid="btn-sidepanel-toggle-suggestion"
                        onClick={activeSuggestion.onToggle}
                        className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                          activeSuggestion.isApplied
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {activeSuggestion.isApplied ? (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revert Optimization</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 fill-white" />
                            <span>Apply This Recommendation</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSuggestIndexesModal(false)}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk Optimization Calculation Breakdown Modal */}
      {showBulkOptimizeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col text-zinc-900 relative">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-indigo-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-600 text-white rounded-xl shadow-xs">
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                      Bulk Schema Optimizer — Calculation Breakdown
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                      {bulkOptimizationPlan.totalCount} Listed Indexes Analyzed
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                      Avg Health: {bulkOptimizationPlan.currentAvgHealth}/100 → {bulkOptimizationPlan.projectedAvgHealth}/100
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Calculated optimal set of changes for all listed database indexes to maximize query throughput while pruning redundant write overhead.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-zinc-300 shadow-2xs">
                  <input
                    type="checkbox"
                    id="checkbox-bulk-dry-run"
                    data-testid="checkbox-bulk-dry-run"
                    checked={bulkDryRunActive}
                    onChange={(e) => setBulkDryRunActive(e.target.checked)}
                    className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Dry Run (Preview Only)</span>
                </label>
                <button
                  type="button"
                  id="btn-modal-apply-bulk-optimize"
                  data-testid="btn-modal-apply-bulk-optimize"
                  onClick={() => {
                    if (bulkDryRunActive) {
                      const projected = bulkOptimizationPlan.pendingChanges.map((ch) => ({
                        name: ch.indexName,
                        impact: ch.description,
                        projectedHealth: 96
                      }));
                      setDryRunPreviewList(projected);
                      setShowBulkOptimizeModal(false);
                      setImportSuccessNotice('[Dry Run Mode] Schema left untouched. Projected performance improvements generated for preview.');
                      setTimeout(() => setImportSuccessNotice(null), 5000);
                    } else {
                      handleApplyBulkOptimize();
                      setShowBulkOptimizeModal(false);
                    }
                  }}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    bulkDryRunActive
                      ? 'bg-teal-700 hover:bg-teal-600 text-white'
                      : bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-sm'
                  }`}
                  title="Apply all recommended improvements or simulate a dry run preview"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkDryRunActive
                      ? `Run Dry Run Preview (${bulkOptimizationPlan.pendingChanges.length})`
                      : bulkOptimizationPlan.isFullyOptimized
                      ? '✓ All Optimal'
                      : `Apply All (${bulkOptimizationPlan.pendingChanges.length} Improvements)`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkOptimizeModal(false)}
                  className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                  aria-label="Close calculation modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* High-Level Calculation Metrics */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Optimization Scope</span>
                <div className="font-mono font-bold text-zinc-900 text-sm">
                  {bulkOptimizationPlan.totalCount} Listed Indexes
                </div>
                <div className="text-[10px] text-zinc-500">Across 3 database entities</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recommended Changes</span>
                <div className="font-mono font-bold text-amber-700 text-sm flex items-center gap-1.5">
                  <span>{bulkOptimizationPlan.pendingChanges.length} Changes Needed</span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {bulkOptimizationPlan.optimalCount} currently optimal
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Projected Health Gain</span>
                <div className="font-mono font-bold text-emerald-700 text-sm flex items-center gap-1">
                  <span>{bulkOptimizationPlan.currentAvgHealth}</span>
                  <span>→</span>
                  <span>{bulkOptimizationPlan.projectedAvgHealth}/100</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded ml-1">
                    +{bulkOptimizationPlan.healthGain}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">Optimal health tier</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Estimated Net Impact</span>
                <div className="font-mono font-bold text-indigo-700 text-sm">
                  +99.6% Speedup
                </div>
                <div className="text-[10px] text-indigo-600 font-medium">-14% dead index write I/O</div>
              </div>
            </div>

            {/* List / Table of Calculated Optimal Changes */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Calculated Index Status &amp; Recommended Actions</span>
                </h4>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {bulkOptimizationPlan.pendingChanges.length} of {bulkOptimizationPlan.totalCount} require modification
                </span>
              </div>

              <div className="space-y-2.5">
                {bulkOptimizationPlan.allListed.map((item) => (
                  <div
                    key={item.id}
                    id={`bulk-plan-item-${item.indexName}`}
                    data-testid={`bulk-plan-item-${item.indexName}`}
                    className={`p-3.5 rounded-xl border transition-all text-xs ${
                      !item.isOptimal
                        ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                        : 'bg-white border-zinc-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 text-xs">{item.indexName}</span>
                          <span className="text-[10px] bg-zinc-100 text-zinc-700 font-mono px-1.5 py-0.2 rounded border border-zinc-200">
                            {item.indexType}
                          </span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.2 rounded border border-indigo-200">
                            {item.tableEntity} ({item.tableName})
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-600">
                          Columns: <code className="font-mono text-zinc-800 bg-zinc-100 px-1 rounded">{item.columns.join(', ')}</code>
                        </div>

                        <p className="text-[11px] text-zinc-700 leading-relaxed pt-0.5">
                          {item.reason}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1.5 shrink-0">
                        {/* Health Score Transition */}
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${item.currentBadgeClass}`}>
                            Health: {item.currentHealthScore}
                          </span>
                          {!item.isOptimal && (
                            <>
                              <ArrowRight className="w-3 h-3 text-zinc-400" />
                              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {item.projectedHealthScore}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Calculated Recommendation Action Badge */}
                        <div>
                          {item.isOptimal ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Optimal (No Action Needed)</span>
                            </span>
                          ) : item.recommendedAction === 'PRUNE' ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-md">
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Action: Prune Dead Index</span>
                            </span>
                          ) : item.recommendedAction === 'RESTORE' ? (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded-md">
                              <Key className="w-3 h-3 text-indigo-600" />
                              <span>Action: Restore Primary Clustered Key</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                              <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                              <span>Action: {item.actionTitle}</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-emerald-700 font-bold">
                          {item.speedupGain}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer with Single Button */}
            <div className="p-4 sm:p-5 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-zinc-600">
                {bulkOptimizationPlan.isFullyOptimized ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>All {bulkOptimizationPlan.totalCount} listed indexes are operating in their optimal configuration.</span>
                  </span>
                ) : (
                  <span>
                    Calculated <strong className="text-amber-800 font-bold">{bulkOptimizationPlan.pendingChanges.length} improvements</strong> across {bulkOptimizationPlan.totalCount} listed indexes.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkOptimizeModal(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  id="btn-footer-apply-bulk-optimize"
                  data-testid="btn-footer-apply-bulk-optimize"
                  onClick={() => {
                    handleApplyBulkOptimize();
                    setShowBulkOptimizeModal(false);
                  }}
                  disabled={isApplyingBulkOptimize || bulkOptimizationPlan.isFullyOptimized}
                  className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                    bulkOptimizationPlan.isFullyOptimized
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default opacity-90'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    {bulkOptimizationPlan.isFullyOptimized
                      ? 'Schema Fully Optimized'
                      : `Apply All Recommended Improvements (${bulkOptimizationPlan.pendingChanges.length} Changes)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Indices & Schema Prototyper Modal */}
      {showBulkImportModal && (
        <div
          id="bulk-import-indices-modal"
          data-testid="bulk-import-indices-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 relative">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-xs">
                  <UploadCloud className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                      Bulk Import Indices &amp; Schema Prototyper
                    </h3>
                    <span className="font-mono text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                      JSON Prototyping Engine
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Import or paste a JSON file of index configurations to quickly prototype and benchmark alternative database schema states.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-bulk-import-modal"
                data-testid="btn-close-bulk-import-modal"
                onClick={() => setShowBulkImportModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Schema State Indicator Bar */}
            <div className="px-5 py-2.5 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-medium">Currently Active State:</span>
                <span className="font-bold text-zinc-800 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs font-mono">
                  {activeSchemaPrototypeName}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-600">
                <span>Active Indexes: <strong className="text-indigo-700">{tables.reduce((acc, t) => acc + t.indexes.filter(i => i.active && !removedIndexes.includes(i.name)).length, 0)}</strong></span>
                <span>•</span>
                <span>Speedup: <strong className="text-emerald-700">{speedUpPercent}%</strong></span>
              </div>
            </div>

            {/* Modal Body with Tabs */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 flex-wrap">
                <button
                  type="button"
                  id="tab-import-upload"
                  data-testid="tab-import-upload"
                  onClick={() => setBulkImportActiveTab('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload / Paste JSON File</span>
                </button>
                <button
                  type="button"
                  id="tab-import-presets"
                  data-testid="tab-import-presets"
                  onClick={() => setBulkImportActiveTab('presets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'presets'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Preset Schema Prototypes (4)</span>
                </button>
                <button
                  type="button"
                  id="tab-import-spec"
                  data-testid="tab-import-spec"
                  onClick={() => setBulkImportActiveTab('schema-spec')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    bulkImportActiveTab === 'schema-spec'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>JSON Specification &amp; Sample Template</span>
                </button>
              </div>

              {/* TAB 1: Upload / Paste JSON */}
              {bulkImportActiveTab === 'upload' && (
                <div className="space-y-4">
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                      isDraggingFile
                        ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01]'
                        : 'border-zinc-300 hover:border-indigo-400 bg-zinc-50/60 hover:bg-indigo-50/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-white text-indigo-600 rounded-full shadow-xs border border-zinc-200">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-800">
                          {uploadedFileName ? (
                            <span className="text-indigo-600 font-mono">Loaded File: {uploadedFileName}</span>
                          ) : (
                            'Choose a .json index configuration file or drag & drop here'
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Accepts exported schema snapshots, index arrays, or custom configuration payloads (.json)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Direct JSON Paste & Syntax Editor */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <label htmlFor="import-json-textarea" className="font-bold text-zinc-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>JSON Index Configuration Payload</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {parsedImportResult.isValid ? (
                          <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Valid JSON ({parsedImportResult.config?.totalIndicesCount} indices, {parsedImportResult.config?.targetTablesCount} tables)</span>
                          </span>
                        ) : parsedImportResult.error ? (
                          <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Syntax Error</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Paste JSON or select a file above</span>
                        )}
                        {importJsonInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setImportJsonInput('');
                              setUploadedFileName(null);
                            }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      id="import-json-textarea"
                      data-testid="import-json-textarea"
                      rows={9}
                      value={importJsonInput}
                      onChange={(e) => setImportJsonInput(e.target.value)}
                      placeholder={`{\n  "name": "Custom E-Commerce Prototype Schema",\n  "optimizationFlags": { "btreeIndexing": true, "batchEagerLoading": true },\n  "indexConfiguration": {\n    "createdCompositeIndexes": ["email_status", "category_amount", "tx_price"],\n    "createdCustomIndexes": ["customer_email", "amount"],\n    "removedOrPrunedIndexes": ["idx_transactions_date"]\n  }\n}`}
                      className="w-full font-mono text-xs p-3 bg-zinc-900 text-zinc-100 rounded-xl border border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    />
                    {parsedImportResult.error && (
                      <p className="text-[11px] text-rose-600 font-mono mt-1">
                        ⚠️ Parse Error: {parsedImportResult.error}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Preset Schema Prototypes */}
              {bulkImportActiveTab === 'presets' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Select a pre-configured realistic database schema index state to instantly test workload behavior and latency transformations:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {samplePresets.map((preset) => (
                      <div
                        key={preset.id}
                        id={`preset-card-${preset.id}`}
                        data-testid={`preset-card-${preset.id}`}
                        className="p-4 rounded-xl border border-zinc-200 hover:border-indigo-400 hover:shadow-sm bg-white transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-zinc-900">
                              {preset.name}
                            </h4>
                            <span className="font-mono text-[9px] bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
                            {preset.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                          <div className="font-mono text-[11px] text-emerald-700 font-bold">
                            {preset.speedup}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setImportJsonInput(preset.jsonContent);
                              setUploadedFileName(`${preset.id}.json`);
                              setBulkImportActiveTab('upload');
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <span>Load into Prototyper</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Specification & Sample Template */}
              {bulkImportActiveTab === 'schema-spec' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2 text-zinc-800">
                    <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-600" />
                      <span>Supported JSON Schema Configurations</span>
                    </h4>
                    <p className="text-[11px] text-zinc-700 leading-relaxed">
                      The Bulk Importer accepts full schema snapshots exported from this viewer, custom array lists of indexes, or high-level index configuration files with optimization flags.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10.5px]">
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">createdCompositeIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;email_status&quot;, &quot;category_amount&quot;, &quot;tx_price&quot;, &quot;tier_created&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">createdCustomIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;customer_email&quot;, &quot;amount&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">removedOrPrunedIndexes</strong>
                        <span className="text-zinc-600">e.g. [&quot;idx_transactions_date&quot;]</span>
                      </div>
                      <div className="p-2 bg-white rounded border border-indigo-100">
                        <strong className="text-indigo-900 block font-sans">indices (Custom list)</strong>
                        <span className="text-zinc-600">e.g. [&#123; name, targetTable, columns, type, active &#125;]</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-zinc-500 text-[11px]">Need a starting JSON file?</span>
                    <button
                      type="button"
                      id="btn-download-sample-index-template"
                      data-testid="btn-download-sample-index-template"
                      onClick={handleDownloadSampleJsonTemplate}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-semibold rounded-lg text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Download Sample Template (.json)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE PROTOTYPE PREVIEW CARD (Shown when valid JSON is loaded) */}
              {parsedImportResult.isValid && parsedImportResult.config && (
                <div
                  id="import-prototype-preview-card"
                  data-testid="import-prototype-preview-card"
                  className="p-4 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/80 rounded-xl border border-emerald-300 shadow-xs space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-emerald-600 text-white rounded-md">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <span>Prototype State Preview:</span>
                          <strong className="text-indigo-900 font-mono">{parsedImportResult.config.name}</strong>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {parsedImportResult.config.description}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      Ready to Apply
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Affected Tables</span>
                      <div className="font-mono font-bold text-zinc-800 mt-0.5">
                        {parsedImportResult.config.targetTables.join(', ')}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Composite Indexes</span>
                      <div className="font-mono font-bold text-purple-700 mt-0.5">
                        {parsedImportResult.config.createdCompositeIndexes.length} active
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Custom Indexes</span>
                      <div className="font-mono font-bold text-indigo-700 mt-0.5">
                        {parsedImportResult.config.createdCustomIndexes.length + parsedImportResult.config.customIndices.length} active
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">Pruned Unutilized</span>
                      <div className="font-mono font-bold text-rose-700 mt-0.5">
                        {parsedImportResult.config.removedIndexes.length} removed
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={importSnapshotBeforeApply}
                  onChange={(e) => setImportSnapshotBeforeApply(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                />
                <span>Automatically snapshot current schema state before applying prototype</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-apply-bulk-imported-indices"
                  data-testid="btn-apply-bulk-imported-indices"
                  disabled={!parsedImportResult.isValid || !parsedImportResult.config}
                  onClick={handleApplyImportedIndices}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Apply Index Configuration &amp; Prototype State</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Named Checkpoint / Snapshot State Modal */}
      {showNamedSnapshotModal && (
        <div
          id="modal-snapshot-state"
          data-testid="modal-snapshot-state"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-xs">
                  <History className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Snapshot Schema State
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Create a named checkpoint of the current index configuration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-snapshot-modal"
                data-testid="btn-close-snapshot-modal"
                onClick={() => setShowNamedSnapshotModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNamedSnapshot} className="space-y-4">
              <div>
                <label htmlFor="input-checkpoint-name" className="block text-xs font-bold text-zinc-700 mb-1">
                  Checkpoint Name
                </label>
                <input
                  type="text"
                  id="input-checkpoint-name"
                  data-testid="input-checkpoint-name"
                  autoFocus
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder="e.g. Composite Index Experiment, Post-Optimization State..."
                  className="w-full text-xs px-3 py-2 bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* State Summary to be captured */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs">
                <div className="font-semibold text-zinc-700 text-[11px] uppercase tracking-wider">
                  Configuration Captured in Checkpoint
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Total Active Indexes</span>
                    <strong className="text-indigo-700 font-mono">
                      {tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active && !removedIndexes.includes(i.name)).length, 0)} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Composite Indexes</span>
                    <strong className="text-purple-700 font-mono">
                      {createdCompositeIndexes.length} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Custom &amp; Imported</span>
                    <strong className="text-emerald-700 font-mono">
                      {createdCustomIndexes.length + importedCustomIndices.length} active
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-2xs">
                    <span className="text-zinc-500 block text-[10px]">Pruned Unutilized</span>
                    <strong className="text-rose-700 font-mono">
                      {removedIndexes.length} removed
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNamedSnapshotModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-checkpoint"
                  data-testid="btn-save-checkpoint"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save Checkpoint</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schema Snapshots Manager Modal */}
      {showSnapshotsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Schema Snapshots &amp; Checkpoints Manager
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Switch between saved index configuration checkpoints to compare schema performance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotsModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto text-xs">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    selectedCheckpointId === snap.id
                      ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div>
                    <div className="font-bold text-zinc-900 flex items-center gap-2">
                      <span>{snap.name}</span>
                      {selectedCheckpointId === snap.id && (
                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                          Active Checkpoint
                        </span>
                      )}
                      {snap.isProtected && (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold flex items-center gap-1 border border-amber-300">
                          <Shield className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                          Protected
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Saved at {snap.timestamp} • Active Indexes: {snap.totalIndexesCount ?? snap.customIndexes.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id={`btn-toggle-protect-${snap.id}`}
                      data-testid={`btn-toggle-protect-${snap.id}`}
                      onClick={() => handleToggleProtectSnapshot(snap.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                        snap.isProtected
                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                          : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                      }`}
                      title={snap.isProtected ? 'Protected: Prevents automated overwrite or pruning' : 'Mark as Protected'}
                    >
                      <Shield className={`w-3.5 h-3.5 ${snap.isProtected ? 'text-amber-700 fill-amber-700' : 'text-zinc-400'}`} />
                      <span>{snap.isProtected ? 'Protected' : 'Protect'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(snap)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                        selectedCheckpointId === snap.id
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {selectedCheckpointId === snap.id ? 'Active' : 'Restore State'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Migration SQL Export Panel */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>Simulate Production Migration SQL Diff</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">From Version (Base)</label>
                  <select
                    value={migrationVersion1Id}
                    onChange={(e) => setMigrationVersion1Id(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">To Version (Target)</label>
                  <select
                    value={migrationVersion2Id}
                    onChange={(e) => setMigrationVersion2Id(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                id="btn-export-migration-sql"
                data-testid="btn-export-migration-sql"
                onClick={handleExportMigrationSQL}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Difference as 'Migration SQL' Script</span>
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-open-compare-schema-overlay"
                  data-testid="btn-open-compare-schema-overlay"
                  onClick={() => setShowCompareSchemaOverlay(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open Compare Schema overlay to highlight added, removed, or modified indexes between snapshots"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Compare Schema</span>
                </button>
                <button
                  type="button"
                  id="btn-open-schema-diff-live"
                  data-testid="btn-open-schema-diff-live"
                  onClick={() => setShowSchemaDiffLiveModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Compare current live database index configuration against a saved historical snapshot"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Schema Diff (Live vs Snapshot)</span>
                </button>
                <button
                  type="button"
                  id="btn-open-diff-viewer"
                  data-testid="btn-open-diff-viewer"
                  onClick={() => setShowIndexDiffViewerModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open animated side-by-side Index Property Diff viewer between selected schema versions"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Index Property Diff Viewer</span>
                </button>
                <button
                  type="button"
                  id="btn-open-index-advisor"
                  data-testid="btn-open-index-advisor"
                  onClick={() => setShowIntelligentAdvisorModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                  title="Open Index Advisor to analyze expensive query history and suggest missing B-Tree indexes reducing scan costs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Index Advisor</span>
                </button>
                <button
                  type="button"
                  id="btn-modal-export-schema-state"
                  data-testid="btn-modal-export-schema-state"
                  onClick={handleExportSchemaState}
                  disabled={isExportingState}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Schema State</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotsModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Schema Overlay Modal */}
      {showCompareSchemaOverlay && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Compare Schema Overlay</h3>
                  <p className="text-xs text-zinc-500">
                    Visually highlights added, removed, or modified indexes between two selected snapshots.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareSchemaOverlay(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">Snapshot A (Base)</label>
                <select
                  value={compareSnapshotAId}
                  onChange={(e) => setCompareSnapshotAId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.timestamp})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">Snapshot B (Target)</label>
                <select
                  value={compareSnapshotBId}
                  onChange={(e) => setCompareSnapshotBId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
                >
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.timestamp})</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const snapA = snapshots.find((s) => s.id === compareSnapshotAId) || snapshots[0];
              const snapB = snapshots.find((s) => s.id === compareSnapshotBId) || snapshots[snapshots.length - 1];
              if (!snapA || !snapB) return null;

              const setACustom = new Set(snapA.customIndexes || []);
              const setBCustom = new Set(snapB.customIndexes || []);
              const setAComp = new Set(snapA.createdCompositeIndexes || []);
              const setBComp = new Set(snapB.createdCompositeIndexes || []);

              const added = [...setBCustom].filter((x) => !setACustom.has(x)).concat([...setBComp].filter((x) => !setAComp.has(x)));
              const removed = [...setACustom].filter((x) => !setBCustom.has(x)).concat([...setAComp].filter((x) => !setBComp.has(x)));
              const modified = snapA.flags?.btreeIndexing !== snapB.flags?.btreeIndexing ? ['btreeIndexing optimization flag'] : [];

              return (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-emerald-700">Added Indexes</div>
                      <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">+{added.length}</div>
                    </div>
                    <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-rose-700">Removed Indexes</div>
                      <div className="text-base font-extrabold text-rose-800 font-mono mt-0.5">-{removed.length}</div>
                    </div>
                    <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-amber-700">Modified Deltas</div>
                      <div className="text-base font-extrabold text-amber-800 font-mono mt-0.5">{modified.length}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Visual Web Map Diff Highlights</h4>
                    {added.map((item, idx) => (
                      <div key={`add-${idx}`} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-emerald-950 font-bold">🟢 [Added] idx_{item}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-sans">New B-Tree Leaf Node</span>
                      </div>
                    ))}
                    {removed.map((item, idx) => (
                      <div key={`rem-${idx}`} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-rose-950 font-bold">🔴 [Removed] idx_{item}</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-sans">Pruned / Dropped Index</span>
                      </div>
                    ))}
                    {modified.map((item, idx) => (
                      <div key={`mod-${idx}`} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                        <span className="text-amber-950 font-bold">🟡 [Modified] {item}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">Flag Configuration Delta</span>
                      </div>
                    ))}
                    {added.length === 0 && removed.length === 0 && modified.length === 0 && (
                      <div className="p-6 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                        No structural differences detected between "{snapA.name}" and "{snapB.name}".
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCompareSchemaOverlay(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Preview Banner */}
      {dryRunPreviewList && (
        <div className="mx-6 mt-4 p-4 bg-teal-50 border border-teal-300 rounded-2xl shadow-md text-teal-950 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-600 text-white rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-teal-950">Bulk Optimization Dry Run — Projected Performance Preview</h4>
                <p className="text-xs text-teal-800">
                  Simulated execution plan preview. Schema state was NOT modified.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDryRunPreviewList(null)}
              className="text-teal-700 hover:text-teal-900 p-1 rounded-lg hover:bg-teal-100 cursor-pointer"
              title="Dismiss preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {dryRunPreviewList.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-white rounded-xl border border-teal-200 shadow-2xs flex items-center justify-between font-mono">
                <span className="font-bold text-teal-900">{item.name}</span>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-sans font-semibold">
                  {item.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid or Dependency Chain View */}
      {renderContent()}

      {/* Cluster Analysis Modal */}
      {showClusterAnalysisModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">B-Tree Index Cluster Analysis</h3>
                  <p className="text-xs text-zinc-500">
                    Groups indexes serving overlapping query patterns and recommends optimal multi-column consolidation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Cluster 1 */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>Cluster #1: Customer Lookup &amp; Status Filtering</span>
                    <span className="bg-indigo-200 text-indigo-900 font-mono text-[10px] px-2 py-0.5 rounded font-bold">Overlap: 92%</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    High Consolidation Potential
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900">
                  <strong className="text-indigo-950">Indexes involved:</strong> <code className="font-mono">idx_transactions_email_missing</code>, <code className="font-mono">idx_transactions_email_status</code>
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-[11px] space-y-1">
                  <div className="font-semibold text-zinc-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recommendation: Consolidate into composite <code className="font-mono">idx_transactions_email_status</code></span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">
                    Eliminates redundant single-column lookup overhead, reducing write lock contention by 42% and saving 2.1 MB storage.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {consolidatedIndexes.includes('idx_transactions_email_missing') ? '✓ Consolidated' : 'Status: Overlapping single-column active'}
                  </span>
                  <button
                    type="button"
                    id="btn-consolidate-cluster-1"
                    data-testid="btn-consolidate-cluster-1"
                    onClick={() => handleConsolidateIndex('idx_transactions_email_missing')}
                    disabled={consolidatedIndexes.includes('idx_transactions_email_missing')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-emerald-100 disabled:text-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{consolidatedIndexes.includes('idx_transactions_email_missing') ? '✓ Cluster Consolidated' : 'Consolidate Cluster #1'}</span>
                  </button>
                </div>
              </div>

              {/* Cluster 2 */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>Cluster #2: Range Aggregations &amp; Category Filters</span>
                    <span className="bg-indigo-200 text-indigo-900 font-mono text-[10px] px-2 py-0.5 rounded font-bold">Overlap: 88%</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    High Consolidation Potential
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900">
                  <strong className="text-indigo-950">Indexes involved:</strong> <code className="font-mono">idx_transactions_amount_missing</code>, <code className="font-mono">idx_transactions_category_amount</code>
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-[11px] space-y-1">
                  <div className="font-semibold text-zinc-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recommendation: Consolidate into composite <code className="font-mono">idx_transactions_category_amount</code></span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">
                    Co-locates category buckets with sorted amount b-trees, eliminating secondary sorting passes for top-k queries.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {consolidatedIndexes.includes('idx_transactions_amount_missing') ? '✓ Consolidated' : 'Status: Overlapping single-column active'}
                  </span>
                  <button
                    type="button"
                    id="btn-consolidate-cluster-2"
                    data-testid="btn-consolidate-cluster-2"
                    onClick={() => handleConsolidateIndex('idx_transactions_amount_missing')}
                    disabled={consolidatedIndexes.includes('idx_transactions_amount_missing')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-emerald-100 disabled:text-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{consolidatedIndexes.includes('idx_transactions_amount_missing') ? '✓ Cluster Consolidated' : 'Consolidate Cluster #2'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <button
                type="button"
                id="btn-consolidate-all-clusters"
                data-testid="btn-consolidate-all-clusters"
                onClick={() => {
                  handleConsolidateIndex('idx_transactions_email_missing');
                  handleConsolidateIndex('idx_transactions_amount_missing');
                }}
                disabled={consolidatedIndexes.includes('idx_transactions_email_missing') && consolidatedIndexes.includes('idx_transactions_amount_missing')}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Consolidate All Overlapping Clusters</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Cluster Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Index Cleanup Diagnostic Modal */}
      {showIndexCleanupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Index Cleanup Diagnostic</span>
                    <span className="text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                      Last 100 Queries Analyzed
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Scans query engine execution logs to identify zero-hit indexes and flags them for removal to reclaim disk space.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexCleanupModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isScanningCleanup ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin" />
                  <Trash2 className="w-5 h-5 text-rose-600 absolute inset-0 m-auto" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-zinc-900">Auditing Query Engine Execution Logs...</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Scanning last 100 query executions for B-Tree index hit frequency, scan counts, and disk storage footprint...
                  </p>
                </div>
                <div className="w-48 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-600 h-full w-2/3 animate-pulse rounded-full" />
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Diagnostic Metrics Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Queries Audited</div>
                    <div className="text-base font-extrabold text-zinc-900 font-mono mt-0.5">100 / 100</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Past 24h Window</div>
                  </div>
                  <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-rose-600">Unutilized Indexes</div>
                    <div className="text-base font-extrabold text-rose-700 font-mono mt-0.5">
                      {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} Flagged
                    </div>
                    <div className="text-[10px] text-rose-600 mt-0.5">0 Hits Recorded</div>
                  </div>
                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-700">Disk Space Saved</div>
                    <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                      {((removedIndexes.length > 0 ? (removedIndexes.filter(name => ['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].includes(name)).length * 2.3) : 0)).toFixed(1)} MB
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">Reclaimed Disk</div>
                  </div>
                  <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
                    <div className="text-[10px] uppercase font-bold text-indigo-700">Write Latency</div>
                    <div className="text-base font-extrabold text-indigo-700 font-mono mt-0.5">
                      {removedIndexes.length > 0 ? `-${Math.min(38, removedIndexes.length * 14)}%` : '0%'}
                    </div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">I/O Overhead Cut</div>
                  </div>
                </div>

                {/* Banner / Bulk Action */}
                <div className="p-3.5 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-950">
                        Diagnostic Findings: Unused Indexes Detected
                      </h4>
                      <p className="text-[11px] text-rose-800">
                        {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length > 0
                          ? `Flagged ${['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter(name => !removedIndexes.includes(name)).length} indexes with zero engine hits across the last 100 queries. Removing them will reclaim up to 6.8 MB disk space.`
                          : 'All unutilized indexes have been removed. Disk storage reclaimed and write overhead reduced.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      id="btn-preview-auto-cleanup"
                      data-testid="btn-preview-auto-cleanup"
                      onClick={() => setShowAutoCleanupPreviewModal(true)}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-rose-300 text-rose-800 font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      <span>Preview Auto-Cleanup</span>
                    </button>
                    {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].some(name => !removedIndexes.includes(name)) && (
                      <button
                        type="button"
                        onClick={handleRemoveAllUnutilized}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                      >
                        Remove All Unutilized (Save 6.8 MB)
                      </button>
                    )}
                  </div>
                </div>

                {/* List of unutilized indexes */}
                <div className="space-y-3">
                  {unutilizedDiagnostics.map((diag) => {
                    const isRemoved = removedIndexes.includes(diag.name);
                    return (
                      <div
                        key={diag.name}
                        className={`p-4 rounded-xl border transition-all ${
                          isRemoved
                            ? 'bg-zinc-50 border-zinc-200 opacity-70'
                            : 'bg-white border-rose-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2.5 mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-zinc-900">{diag.name}</span>
                              <span className="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                                {diag.table}.{diag.column}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                0 hits / 100 queries
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              Storage footprint: <strong className="text-zinc-700 font-mono">{diag.size}</strong> • Write I/O penalty: <strong className="text-rose-700">{diag.writeImpact}</strong>
                            </div>
                          </div>
                          <div>
                            {isRemoved ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Removed ({diag.size} freed)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreRemovedIndex(diag.name)}
                                  className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Restore
                                </button>
                              </div>
                            ) : lockedIndexes.includes(diag.name) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-1 rounded flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                                  Locked (Protected)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLockIndex(diag.name)}
                                  className="px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded text-[11px] font-semibold cursor-pointer"
                                  title="Unlock index to allow removal"
                                >
                                  Unlock
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveUnutilizedIndex(diag.name)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove &amp; Free {diag.size}</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          <strong className="text-zinc-800">Diagnostic Reason:</strong> {diag.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={handleRunIndexCleanupScan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Rescan Last 100 Queries</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIndexCleanupModal(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    Close Diagnostic
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workload Analysis & Auto-Optimization Modal */}
      {showWorkloadOptimizationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-xs">
                  <Zap className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Workload Analysis &amp; B-Tree Index Optimization</span>
                    <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Optimal Throughput Active
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Audited 14,200 query execution traces across recent workload history and toggled optimal B-Tree indexes for the most expensive queries.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkloadOptimizationModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Top-Level Impact Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Queries Audited</div>
                  <div className="text-base font-extrabold text-zinc-900 font-mono mt-0.5">14,200 Traces</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Past 24h Workload</div>
                </div>
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Read Throughput</div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">18,600 QPS</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">+15,400% (was 120 QPS)</div>
                </div>
                <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-indigo-700">P99 Read Latency</div>
                  <div className="text-base font-extrabold text-indigo-700 font-mono mt-0.5">1.9 ms</div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">-99.6% (was 482 ms)</div>
                </div>
                <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-purple-700">Optimal B-Trees</div>
                  <div className="text-base font-extrabold text-purple-700 font-mono mt-0.5">4 Toggled ON</div>
                  <div className="text-[10px] text-purple-600 mt-0.5">100% Query Match</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Workload Optimization Active:</strong> All 4 critical bottleneck queries are now routed through dedicated composite and clustered B-Tree indexes. Sequential table scans eliminated.
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded shrink-0">
                  Confidence: 99.8%
                </span>
              </div>

              {/* Expensive Queries Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
                  <span>Top 4 Most Expensive Queries (Audited from Query History)</span>
                  <span className="text-[11px] text-zinc-500 font-normal">Sorted by DB Read CPU Share</span>
                </div>

                {expensiveQueriesWorkload.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-zinc-50/80 hover:bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-bold font-mono">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-zinc-900">{q.name}</span>
                        <span className="text-[10px] font-mono bg-zinc-200 text-zinc-700 px-1.5 py-0.2 rounded font-semibold">
                          {q.frequency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {q.executionShare}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          INDEX TOGGLED ON
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-zinc-900 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      <code>{q.sql}</code>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Before Optimization</div>
                        <div className="text-zinc-700 font-mono font-bold mt-0.5">Latency: <span className="text-rose-600">{q.unindexedLatency}</span></div>
                        <div className="text-[10px] text-zinc-500 font-mono">Throughput: {q.throughputBefore}</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">After Optimal B-Tree</div>
                        <div className="text-zinc-700 font-mono font-bold mt-0.5">Latency: <span className="text-emerald-600">{q.optimizedLatency}</span></div>
                        <div className="text-[10px] text-emerald-700 font-mono font-bold">Throughput: {q.throughputAfter} ({q.speedup})</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-zinc-200">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">Assigned B-Tree Index</div>
                        <div className="text-indigo-900 font-mono font-bold mt-0.5 truncate" title={q.optimalIndexName}>
                          {q.optimalIndexName}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{q.optimalIndexType}</div>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-600">
                      <strong className="text-zinc-800">Optimization Mechanism:</strong> {q.impactExplanation}
                    </p>
                  </div>
                ))}
              </div>

              {/* Dead Index Pruning Notice */}
              <div className="p-3 bg-zinc-100 rounded-xl border border-zinc-200 flex items-center justify-between text-xs text-zinc-700">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>
                    <strong>Buffer Contention Prevention:</strong> Flagged &amp; unlinked unutilized <code className="font-mono bg-zinc-200 px-1 rounded">idx_transactions_date</code> (0 engine hits in last 100 queries) to prevent buffer cache pollution and 14% write latency overhead.
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500 font-bold shrink-0">Pruned</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
              <button
                type="button"
                onClick={handleAutoOptimizeWorkload}
                disabled={isAutoOptimizingWorkload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-600 hover:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAutoOptimizingWorkload ? 'animate-spin' : ''}`} />
                <span>Re-run Workload Analysis</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleRevertAllIndexes();
                    setShowWorkloadOptimizationModal(false);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Revert Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowWorkloadOptimizationModal(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                >
                  Keep Optimal Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cross-Reference Report Modal */}
      {showCrossReferenceReportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col text-zinc-900 relative">
            <div className="p-5 border-b border-zinc-200 bg-teal-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-600 text-white rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Historical Query Cross-Reference Report</h3>
                  <p className="text-xs text-zinc-600">
                    Maps active and custom indexes against 24-hour historical query execution logs to detect 'zombie' indexes with 0 hits and zero performance gain.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCrossReferenceReportModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Analyzed Indexes</span>
                  <div className="text-lg font-extrabold text-zinc-900 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + t.indexes.length, 0)}
                  </div>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">High-Utility Indexes</span>
                  <div className="text-lg font-extrabold text-emerald-800 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + t.indexes.filter((i) => i.active).length, 0)}
                  </div>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Zombie Indexes Detected</span>
                  <div className="text-lg font-extrabold text-rose-800 font-mono mt-0.5">2</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Detected Zombie Indexes (Zero Query Hits &amp; Write Overhead)</h4>
                {[
                  { name: 'idx_legacy_audit_log_backup', table: 'transactions', writes: '14,250 writes/hr', reads: '0 reads', overhead: '18% disk write bloat' },
                  { name: 'idx_temp_staging_token', table: 'customers', writes: '4,100 writes/hr', reads: '0 reads', overhead: '7% write amplification' }
                ].map((zombie, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/80 border border-rose-300 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-rose-950 flex items-center gap-2">
                        <span>🧟 {zombie.name}</span>
                        <span className="text-[10px] font-sans bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-bold">ZOMBIE INDEX</span>
                      </div>
                      <div className="text-[11px] text-rose-800 mt-0.5">
                        Table: <span className="font-mono font-bold">{zombie.table}</span> • {zombie.writes} • <strong className="text-rose-950">{zombie.reads}</strong> • Impact: {zombie.overhead}
                      </div>
                    </div>
                    <button
                      type="button"
                      id={`btn-prune-zombie-${idx}`}
                      data-testid={`btn-prune-zombie-${idx}`}
                      onClick={() => {
                        setImportSuccessNotice(`Successfully pruned zombie index "${zombie.name}". Eliminating ${zombie.overhead} and reclaiming disk storage!`);
                        setTimeout(() => setImportSuccessNotice(null), 5000);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors shrink-0"
                    >
                      Prune Zombie Index
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowCrossReferenceReportModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Auto-Cleanup Modal */}
      {showAutoCleanupPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Preview: Next Maintenance Auto-Cleanup Cycle</h3>
                  <p className="text-xs text-zinc-500">
                    Lists exactly which unused or low-priority indexes are scheduled for pruning in the next automated maintenance window.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoCleanupPreviewModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 font-medium">
                💡 <strong>Dry Run Guarantee:</strong> This is a projected preview list. No schema modifications or index drops will occur until execution is explicitly confirmed.
              </div>

              <div className="space-y-2">
                {unutilizedDiagnostics
                  .filter((diag) => !removedIndexes.includes(diag.name))
                  .map((diag, idx) => (
                    <div key={idx} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-zinc-900 flex items-center gap-2">
                          <span>🗑️ {diag.name}</span>
                          <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                            0 Hits
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Target Entity: <span className="font-mono">{diag.table}</span> • Footprint: <span className="font-mono font-bold text-zinc-700">{diag.size}</span> • Reason: {diag.writeImpact}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        Queued for Pruning
                      </span>
                    </div>
                  ))}
                {unutilizedDiagnostics.filter((diag) => !removedIndexes.includes(diag.name)).length === 0 && (
                  <div className="p-8 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                    No unutilized indexes currently queued for auto-cleanup. Schema is fully optimized!
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">Next Maintenance Run: Tonight at 02:00 UTC</span>
              <button
                type="button"
                onClick={() => setShowAutoCleanupPreviewModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Animated Index Property Diff Viewer Modal */}
      {showIndexDiffViewerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-zinc-900 relative">
            <div className="p-5 border-b border-zinc-200 bg-teal-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-700 text-white rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Side-by-Side Index Property Diff Viewer</h3>
                  <p className="text-xs text-zinc-600">
                    Comparing index property changes (fill-factor, index type, inclusion columns, and tuning flags) between <strong className="font-mono text-indigo-900">{snapshots.find(s => s.id === migrationVersion1Id)?.name || 'Version A'}</strong> and <strong className="font-mono text-indigo-900">{snapshots.find(s => s.id === migrationVersion2Id)?.name || 'Version B'}</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexDiffViewerModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 font-mono">
                  <div className="font-bold text-zinc-700 text-[11px] mb-2 uppercase tracking-wider border-b pb-1">
                    Base Version ({snapshots.find(s => s.id === migrationVersion1Id)?.name || 'v1'})
                  </div>
                  <pre className="text-[11px] text-zinc-700 overflow-x-auto leading-relaxed">
                    {`-- Base Schema Configuration
CREATE INDEX idx_transactions_email ON transactions (email);
-- Properties:
--   fillfactor: 90
--   index_type: BTREE
--   include_cols: none
--   buffering: auto`}
                  </pre>
                </div>

                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-300 font-mono">
                  <div className="font-bold text-emerald-900 text-[11px] mb-2 uppercase tracking-wider border-b border-emerald-200 pb-1">
                    Target Version ({snapshots.find(s => s.id === migrationVersion2Id)?.name || 'v2'})
                  </div>
                  <pre className="text-[11px] text-emerald-950 overflow-x-auto leading-relaxed">
                    {`-- Target Schema Configuration
CREATE INDEX CONCURRENTLY idx_transactions_email ON transactions (email) INCLUDE (status);
-- Properties:
--   fillfactor: 100 (+10% density)
--   index_type: BRIN / BTREE
--   include_cols: (status) [ADDED]
--   buffering: concurrent`}
                  </pre>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Granular Property Diff Breakdown (Hover for Before vs After Parameter Values)</h4>
                {[
                  {
                    prop: 'Fill Factor Density',
                    oldVal: '90 (Default)',
                    newVal: '100 (Dense B-Tree)',
                    status: 'Modified (+10% space saving)',
                    description: 'Determines page packing density. Increasing to 100 eliminates page splits for append-only transaction logs.'
                  },
                  {
                    prop: 'Inclusion Columns',
                    oldVal: 'None',
                    newVal: '(status)',
                    status: 'Added (Covering Index optimization)',
                    description: 'Adds non-key payload attributes to leaf nodes, enabling Index-Only Scans and avoiding heap fetches.'
                  },
                  {
                    prop: 'Build Concurrency',
                    oldVal: 'Standard LOCK',
                    newVal: 'CONCURRENTLY',
                    status: 'Modified (Zero-Downtime)',
                    description: 'Allows concurrent reads and writes during index creation, avoiding exclusive table locks on high-traffic tables.'
                  }
                ].map((diff, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredDiffProp(diff.prop)}
                    onMouseLeave={() => setHoveredDiffProp(null)}
                    className="p-3 bg-white rounded-xl border border-zinc-200 hover:border-teal-400 hover:shadow-sm flex items-center justify-between text-xs relative cursor-pointer group transition-all"
                  >
                    <div className="font-bold text-zinc-900 font-mono w-1/3 flex items-center gap-1.5">
                      <span>🔑 {diff.prop}</span>
                      <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded font-sans group-hover:underline">Hover Details</span>
                    </div>
                    <div className="text-zinc-500 font-mono w-1/3 line-through">{diff.oldVal}</div>
                    <div className="text-emerald-800 font-mono font-bold w-1/3 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center justify-between">
                      <span>➔ {diff.newVal}</span>
                      <span className="text-[10px] text-emerald-700 font-sans">({diff.status})</span>
                    </div>

                    {/* Interactive Tooltip Card on Hover */}
                    {hoveredDiffProp === diff.prop && (
                      <div className="absolute left-0 right-0 -top-28 z-20 bg-zinc-950 text-white p-3 rounded-xl shadow-2xl border border-zinc-700 space-y-1.5 animate-fadeIn pointer-events-none">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 font-bold text-[11px] text-teal-300">
                          <span>🔍 Parameter Comparison: {diff.prop}</span>
                          <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 px-1 rounded">Before vs After</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="p-1.5 bg-rose-950/80 border border-rose-800/60 rounded text-rose-200">
                            <span className="text-[9px] text-rose-400 block uppercase">Base Version (Before):</span>
                            <span>{diff.oldVal}</span>
                          </div>
                          <div className="p-1.5 bg-emerald-950/80 border border-emerald-800/60 rounded text-emerald-200">
                            <span className="text-[9px] text-emerald-400 block uppercase">Target Version (After):</span>
                            <span>{diff.newVal}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-300 italic">
                          {diff.description}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowIndexDiffViewerModal(false)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
              >
                Close Diff Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Lifecycle Log Modal */}
      {showLifecycleLogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col text-zinc-900 relative">
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Optimization Lifecycle Telemetry</h3>
                  <p className="text-[11px] text-zinc-400">
                    Capturing autonomous index creations, deletions, and consolidation merging from Auto-Healing &amp; Consolidation features
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLifecycleLogModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-70px)]">
              <SerializationErrorLogPanel />
            </div>
          </div>
        </div>
      )}

      {/* Floating 'Bulk Actions' Bar */}
      {selectedIndexes.length > 0 && (
        <div
          id="floating-bulk-actions-bar"
          data-testid="floating-bulk-actions-bar"
          role="region"
          aria-label="Bulk Index Actions"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/95 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center justify-between gap-3 sm:gap-6 flex-wrap max-w-[95vw] sm:max-w-4xl backdrop-blur-md transition-all animate-slideUp ring-1 ring-white/10"
        >
          {/* Selected Count & Breakdown Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-indigo-950/90 text-indigo-200 border border-indigo-700/60 px-2.5 py-1 rounded-xl text-xs font-bold shadow-xs">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span id="bulk-selected-count" data-testid="bulk-selected-count" className="font-mono text-white font-extrabold">
                {selectedIndexes.length}
              </span>
              <span>{selectedIndexes.length === 1 ? 'index' : 'indexes'} selected</span>
            </div>

            {/* Quick breakdown metrics */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <span className="bg-amber-950/70 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>{selectedIndexes.filter((name) => lockedIndexes.includes(name)).length} Protected</span>
              </span>
              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Unlock className="w-3 h-3 text-zinc-400" />
                <span>{selectedIndexes.filter((name) => !lockedIndexes.includes(name)).length} Unprotected</span>
              </span>
              {selectedIndexes.filter((name) => reindexedIndexes.includes(name)).length > 0 && (
                <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{selectedIndexes.filter((name) => reindexedIndexes.includes(name)).length} Reindexed</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mass-Toggling 'Protected' Status */}
            <button
              type="button"
              id="btn-bulk-toggle-protected"
              data-testid="btn-bulk-toggle-protected"
              onClick={handleBulkToggleProtected}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs border ${
                selectedIndexes.every((name) => lockedIndexes.includes(name))
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-amber-500/40'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/50'
              }`}
              title="Mass-toggle Protected status for all selected indexes"
            >
              {selectedIndexes.every((name) => lockedIndexes.includes(name)) ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unprotect All ({selectedIndexes.length})</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Protect All ({selectedIndexes.length})</span>
                </>
              )}
            </button>

            {/* Protect / Unprotect Quick Actions */}
            <div className="hidden md:inline-flex items-center rounded-xl bg-zinc-800/80 p-0.5 border border-zinc-700 text-xs">
              <button
                type="button"
                id="btn-bulk-protect-indexes"
                data-testid="btn-bulk-protect-indexes"
                onClick={handleBulkProtect}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-300 hover:text-white hover:bg-zinc-700 cursor-pointer transition-colors"
                title="Mark all selected indexes as Protected (Locked against cleanup)"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Protect</span>
              </button>
              <span className="text-zinc-600">|</span>
              <button
                type="button"
                id="btn-bulk-unprotect-indexes"
                data-testid="btn-bulk-unprotect-indexes"
                onClick={handleBulkUnprotect}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer transition-colors"
                title="Remove protection from all selected indexes"
              >
                <Unlock className="w-3 h-3 text-zinc-400" />
                <span>Unprotect</span>
              </button>
            </div>

            {/* Bulk Re-indexing Operation */}
            <button
              type="button"
              id="btn-bulk-reindex-indexes"
              data-testid="btn-bulk-reindex-indexes"
              onClick={handleBulkReindex}
              disabled={isBulkOperating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer transition-all shadow-md hover:shadow-emerald-900/30 border border-emerald-400/40 disabled:opacity-50"
              title="Mass-reindex all selected indexes using zero-downtime REINDEX CONCURRENTLY"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isBulkOperating ? 'animate-spin' : ''}`} />
              <span>{isBulkOperating ? 'Reindexing...' : 'Bulk REINDEX CONCURRENTLY'}</span>
            </button>

            {/* Select All Visible toggle */}
            <button
              type="button"
              id="btn-bulk-select-all"
              data-testid="btn-bulk-select-all"
              onClick={() => {
                const visibleNames = allRankedSchemaIndexes.map((item) => item.index.name);
                handleSelectAllVisible(visibleNames);
              }}
              className="text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 px-2 py-1 rounded-lg cursor-pointer transition-colors hidden lg:inline-flex items-center gap-1"
              title="Select all visible indexes"
            >
              <span>Select All</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              id="btn-bulk-clear-selection"
              data-testid="btn-bulk-clear-selection"
              onClick={handleClearSelection}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
              title="Clear Selection"
              aria-label="Clear Selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cluster Analysis & Write Re-sequencing Modal */}
      {showClusterAnalysisModal && (
        <div
          id="cluster-analysis-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClusterAnalysisModal(false);
          }}
        >
          <div
            id="cluster-analysis-modal"
            data-testid="cluster-analysis-modal"
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-8 animate-scaleIn"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
                  <Activity className="w-5 h-5 text-amber-100" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Index Cluster &amp; Lock Contention Analysis</h3>
                  <p className="text-xs text-zinc-600">Identifies write-heavy index clusters causing deadlocks and provides deadlock mitigation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 text-xs text-zinc-700">
              {clusterContentionResolved ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-950">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="font-bold text-emerald-900 text-sm">Write Operations Successfully Re-sequenced!</strong>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Lock contention reduced from 38.4% down to <strong className="font-mono">0.0%</strong>. Deadlocks and concurrent write blocking have been fully eliminated across all cluster groups.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 text-amber-950">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 animate-bounce" />
                  <div>
                    <strong className="font-bold text-amber-900 text-sm">High Lock Contention Detected in 2 Write Clusters</strong>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Concurrent write transactions are contending for overlapping index leaf pages on <code className="font-mono font-bold">transactions</code> and <code className="font-mono font-bold">order_items</code>, triggering frequent deadlocks (Avg write queue wait: 310ms).
                    </p>
                  </div>
                </div>
              )}

              {/* Cluster Groups Breakdown */}
              <div className="space-y-3">
                <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">Identified Contention Cluster Groups:</span>
                
                {/* Group 1 */}
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                      <span>Cluster Group A: transactions (B-Tree Leaf Page Contention)</span>
                    </span>
                    <span className="font-mono text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold border border-rose-200">
                      Contention: {clusterContentionResolved ? '0.0%' : '38.4%'}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[11px]">
                    Indexes involved: <code className="font-mono text-indigo-900 font-bold">idx_transactions_status_date</code>, <code className="font-mono text-indigo-900 font-bold">idx_transactions_customer_id</code>
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-200">
                    <span>Deadlock frequency: {clusterContentionResolved ? '0 / hr' : '14.2 / hr'}</span>
                    <span>Write Queue Wait: {clusterContentionResolved ? '1.2ms' : '310ms'}</span>
                  </div>
                </div>

                {/* Group 2 */}
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span>Cluster Group B: order_items (Foreign Key Latch Contention)</span>
                    </span>
                    <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
                      Contention: {clusterContentionResolved ? '0.0%' : '24.1%'}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[11px]">
                    Indexes involved: <code className="font-mono text-indigo-900 font-bold">idx_order_items_order_id</code>
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-200">
                    <span>Deadlock frequency: {clusterContentionResolved ? '0 / hr' : '8.6 / hr'}</span>
                    <span>Write Queue Wait: {clusterContentionResolved ? '0.9ms' : '185ms'}</span>
                  </div>
                </div>
              </div>

              {/* Re-sequence Writes explanation */}
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-indigo-950 text-[11px] leading-relaxed">
                <strong className="font-bold text-indigo-900">How Re-sequence Writes Works:</strong> Re-orders concurrent transaction write batches into deterministic lock acquisition sequences (topological locking order), preventing circular wait conditions and eliminating deadlocks entirely.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowClusterAnalysisModal(false)}
                className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                id="btn-cluster-resequence-writes"
                data-testid="btn-cluster-resequence-writes"
                onClick={handleResequenceWrites}
                disabled={isResequencingWrites || clusterContentionResolved}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm flex items-center gap-2 ${
                  clusterContentionResolved
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white'
                }`}
                title="Re-sequence write operations to establish deterministic lock acquisition order and minimize deadlocks"
              >
                {isResequencingWrites ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Re-sequencing Write Operations...</span>
                  </>
                ) : clusterContentionResolved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Writes Successfully Re-sequenced</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>Re-sequence Writes (Eliminate Deadlocks)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Dashboard Modal */}
      {showConflictDashboardModal && (
        <div
          id="conflict-resolution-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConflictDashboardModal(false);
          }}
        >
          <div
            id="conflict-resolution-modal"
            data-testid="conflict-resolution-modal"
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-8 animate-scaleIn"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <GitMerge className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Conflict Resolution Dashboard</h3>
                  <p className="text-xs text-zinc-600">Resolves redundancy by merging indexes sharing identical column sets or conflicting covering indexes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConflictDashboardModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 text-xs text-zinc-700">
              <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center gap-3 text-indigo-950">
                <Target className="w-6 h-6 text-indigo-600 shrink-0" />
                <div>
                  <strong className="font-bold text-indigo-950 text-sm">Schema Index Redundancy Audit</strong>
                  <p className="text-[11px] text-indigo-900 mt-0.5">
                    Maintaining redundant or overlapping covering indexes degrades write throughput (-15% per duplicate index). Merging conflicting groups consolidates B-Tree leaf pages.
                  </p>
                </div>
              </div>

              {/* Conflict Groups List */}
              <div className="space-y-3.5">
                <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">Identified Conflict Groups:</span>

                {/* Group 1: Overlapping Prefix */}
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${resolvedConflicts['group-1'] ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                      <span>Conflict Group 1: Overlapping Prefix Set (transactions)</span>
                    </span>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold border ${resolvedConflicts['group-1'] ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                      {resolvedConflicts['group-1'] ? '✓ Merged & Resolved' : 'Redundancy Detected'}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[11px]">
                    Indexes involved: <code className="font-mono text-indigo-900 font-bold">idx_transactions_date</code> (created_at) is fully covered by <code className="font-mono text-indigo-900 font-bold">idx_orders_status_cat</code> prefix structure.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-[10px] text-zinc-500 font-mono">Write I/O Savings: +14% throughput</span>
                    <button
                      type="button"
                      id="btn-merge-conflict-group-1"
                      data-testid="btn-merge-conflict-group-1"
                      onClick={() => handleMergeConflictGroup('group-1', ['idx_transactions_date'])}
                      disabled={!!resolvedConflicts['group-1']}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                        resolvedConflicts['group-1']
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>{resolvedConflicts['group-1'] ? 'Merged' : 'Merge into Master Index'}</span>
                    </button>
                  </div>
                </div>

                {/* Group 2: Identical Column Set Duplicate */}
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${resolvedConflicts['group-2'] ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
                      <span>Conflict Group 2: Identical Column Duplicate (order_items)</span>
                    </span>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold border ${resolvedConflicts['group-2'] ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
                      {resolvedConflicts['group-2'] ? '✓ Merged & Resolved' : 'Duplicate Detected'}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[11px]">
                    Indexes involved: <code className="font-mono text-indigo-900 font-bold">idx_line_items_tx_price</code> &amp; duplicate lookup index sharing identical column constraints on <code className="font-mono text-indigo-900">transaction_id</code>.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                    <span className="text-[10px] text-zinc-500 font-mono">Write I/O Savings: +18% throughput</span>
                    <button
                      type="button"
                      id="btn-merge-conflict-group-2"
                      data-testid="btn-merge-conflict-group-2"
                      onClick={() => handleMergeConflictGroup('group-2', ['idx_line_items_tx_price'])}
                      disabled={!!resolvedConflicts['group-2']}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                        resolvedConflicts['group-2']
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>{resolvedConflicts['group-2'] ? 'Merged' : 'Merge &amp; Prune Duplicate'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">
                Resolved: {Object.keys(resolvedConflicts).length} / 2 Conflict Groups
              </span>
              <button
                type="button"
                onClick={() => setShowConflictDashboardModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile Indexes Modal (Constraint Conflict Monitor) */}
      {showReconcileIndexesModal && (
        <div
          id="modal-reconcile-indexes-backdrop"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReconcileIndexesModal(false);
          }}
        >
          <div
            id="modal-reconcile-indexes"
            data-testid="modal-reconcile-indexes"
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-8 animate-scaleIn max-h-[90vh]"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                  <GitMerge className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Reconcile Indexes</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                      Constraint Conflict Monitor
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Resolves overlapping covering indexes that index the same column sets with inverted order.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReconcileIndexesModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs text-zinc-700 overflow-y-auto">
              {/* B-Tree Leftmost Prefix Rule Explainer */}
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>B-Tree Leftmost Prefix &amp; Write Amplification Audit</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Composite indexes rely on the <strong>Leftmost Prefix Rule</strong>: an index on <code className="font-mono bg-white px-1 py-0.5 rounded font-bold">(A, B)</code> can satisfy queries on <code className="font-mono bg-white px-1 py-0.5 rounded">WHERE A = ?</code> and <code className="font-mono bg-white px-1 py-0.5 rounded">WHERE A = ? AND B = ?</code>, but cannot efficiently satisfy <code className="font-mono bg-white px-1 py-0.5 rounded">WHERE B = ?</code>. Maintaining two inverted covering indexes on the same columns <code className="font-mono bg-white px-1 py-0.5 rounded">(A, B)</code> and <code className="font-mono bg-white px-1 py-0.5 rounded">(B, A)</code> creates <strong>duplicate WAL logging, doubles write lock overhead (+22%), and consumes redundant disk space</strong>.
                </p>
              </div>

              {/* Conflict Pairs List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                  <span>Detected Overlapping Covering Index Pairs ({detectedConstraintConflicts.length}):</span>
                  {detectedConstraintConflicts.length === 0 && (
                    <span className="text-emerald-700 font-normal">All conflicts resolved!</span>
                  )}
                </div>

                {detectedConstraintConflicts.length === 0 ? (
                  <div className="p-6 text-center bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h4 className="font-bold text-emerald-950 text-sm">No Active Constraint Conflicts</h4>
                    <p className="text-xs text-emerald-800 max-w-md mx-auto">
                      All active indexes have unique column footprints or aligned prefix hierarchies. No redundant write amplification detected.
                    </p>
                  </div>
                ) : (
                  detectedConstraintConflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-3.5 shadow-2xs"
                    >
                      {/* Table Banner */}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-indigo-600" />
                          <span>Table: <strong className="font-mono text-indigo-900">{conflict.tableName}</strong> ({conflict.entityName})</span>
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          +{conflict.writeAmplificationPercent}% Write Overhead
                        </span>
                      </div>

                      {/* Side-by-Side Comparison */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Index A */}
                        <div className="p-3 bg-white border border-zinc-200 rounded-lg space-y-1.5 shadow-3xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[11px] text-zinc-900 truncate">
                              {conflict.indexA.name}
                            </span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">
                              Primary
                            </span>
                          </div>
                          <div className="text-[11px] font-mono flex items-center gap-1 text-zinc-600">
                            <span>Order:</span>
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-indigo-950 font-bold border border-zinc-200">
                              {conflict.columnOrderA}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Optimal for queries filtering by <strong>{conflict.indexA.columns[0]}</strong> first.
                          </p>
                        </div>

                        {/* Index B */}
                        <div className="p-3 bg-white border border-amber-300 rounded-lg space-y-1.5 shadow-3xs ring-1 ring-amber-300/50">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[11px] text-amber-950 truncate">
                              {conflict.indexB.name}
                            </span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                              Inverted
                            </span>
                          </div>
                          <div className="text-[11px] font-mono flex items-center gap-1 text-zinc-600">
                            <span>Order:</span>
                            <span className="bg-amber-100/70 px-1.5 py-0.5 rounded text-amber-950 font-bold border border-amber-200">
                              {conflict.columnOrderB}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Overlapping duplicate for queries filtering by <strong>{conflict.indexB.columns[0]}</strong> first.
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-600 leading-relaxed">
                        {conflict.reason} Wasted storage: <strong className="font-mono text-zinc-800">{conflict.wastedStorageMb} MB</strong>.
                      </p>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
                        <span className="text-[10px] font-mono text-zinc-500">
                          Recommendation: Keep primary, drop inverted
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvedConstraintConflicts((prev) => ({ ...prev, [conflict.id]: true }));
                              setRemovedIndexes((prev) => Array.from(new Set([...prev, conflict.indexB.name])));
                              setImportSuccessNotice(`✓ Reconciled: Kept '${conflict.indexA.name}' and dropped redundant inverted index '${conflict.indexB.name}'. Reclaimed +${conflict.writeAmplificationPercent}% write throughput.`);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Keep Primary &amp; Drop Inverted</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResolvedConstraintConflicts((prev) => ({ ...prev, [conflict.id]: true }));
                              setImportSuccessNotice(`✓ Marked conflict on '${conflict.tableName}' as reconciled for dual-direction point lookup workload.`);
                            }}
                            className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                          >
                            Mark as Reconciled
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">
                Constraint Conflict Monitor • {detectedConstraintConflicts.length} Active / {Object.keys(resolvedConstraintConflicts).length} Reconciled
              </span>
              <button
                type="button"
                onClick={() => setShowReconcileIndexesModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Close Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What-If Analysis Interactive Modal */}
      {activeWhatIfModalIndex && (
        <div
          id="what-if-analysis-modal"
          data-testid="what-if-analysis-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-200" />
                <span className="font-bold text-sm">What-If Analysis: {activeWhatIfModalIndex.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveWhatIfModalIndex(null)}
                className="text-purple-200 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-600">
                Temporarily modify index columns for <code className="font-mono text-purple-900 font-bold">{activeWhatIfModalIndex.name}</code> on table <code className="font-mono text-zinc-900 font-bold">{activeWhatIfModalIndex.tableName}</code>. This simulates projected latency improvements in the ExplainPlanViewer without altering database schema.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700">Modified Index Columns (Comma-separated)</label>
                <input
                  type="text"
                  id="input-what-if-columns"
                  data-testid="input-what-if-columns"
                  value={whatIfInputText}
                  onChange={(e) => setWhatIfInputText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g. status, created_at, amount"
                />
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs space-y-1">
                <div className="font-bold text-purple-900 flex items-center gap-1">
                  <span>Projected ExplainPlanViewer Latency Impact:</span>
                  <span className="font-mono text-emerald-700 font-extrabold">-42.5ms (Speedup: +85%)</span>
                </div>
                <p className="text-[11px] text-purple-700">
                  Simulated query execution plan shows zero table scans with the proposed column set.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveWhatIfModalIndex(null)}
                className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-semibold cursor-pointer text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-save-what-if-simulation"
                data-testid="btn-save-what-if-simulation"
                onClick={() => {
                  const cols = whatIfInputText.split(',').map((c) => c.trim()).filter(Boolean);
                  if (cols.length > 0) {
                    setWhatIfModifications((prev) => ({
                      ...prev,
                      [activeWhatIfModalIndex.name]: cols
                    }));
                  }
                  setActiveWhatIfModalIndex(null);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Simulation (What-If)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Housekeeper Modal */}
      {showHousekeeperModal && (
        <div
          id="modal-global-housekeeper"
          data-testid="modal-global-housekeeper"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHousekeeperModal(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-8 animate-scaleIn">
            <div className="px-6 py-4 bg-gradient-to-r from-teal-600 via-cyan-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-500/30 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-teal-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Global Housekeeper — Safe Removal Plan</h3>
                  <p className="text-xs text-teal-100">Scheduled {housekeeperFrequency} scan for unprotected low-usage indexes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHousekeeperModal(false)}
                className="text-teal-200 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-zinc-700">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-3 text-teal-950">
                <Target className="w-6 h-6 text-teal-600 shrink-0" />
                <div>
                  <strong className="font-bold text-teal-950 text-sm">Automated Schedule &amp; Pruning Policy</strong>
                  <p className="text-[11px] text-teal-900 mt-0.5">
                    Global Housekeeper runs <span className="font-bold underline">{housekeeperFrequency}</span> to scan all indexes. Any index marked <span className="font-bold">Unprotected</span> (not locked) and <span className="font-bold">Low Usage</span> (health score &lt; 50 or 0 hits) is queued for safe removal to reclaim disk space.
                  </p>
                </div>
              </div>

              {/* Housekeeper Settings Configuration */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <span className="font-bold text-zinc-900 text-xs">Housekeeper Configuration</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Execution Schedule</label>
                    <select
                      value={housekeeperFrequency}
                      onChange={(e) => handleHousekeeperFrequencyChange(e.target.value)}
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 font-medium text-zinc-800"
                    >
                      <option value="daily">Daily Scan</option>
                      <option value="weekly">Weekly Scan (Default)</option>
                      <option value="monthly">Monthly Audit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Housekeeper Automation Status</label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        checked={globalHousekeeperEnabled}
                        onChange={(e) => handleToggleGlobalHousekeeper(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                      />
                      <span className="font-bold text-zinc-800 text-xs">
                        {globalHousekeeperEnabled ? 'Active (Scheduled)' : 'Paused'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scanned Unprotected & Low Usage Indexes Queue */}
              <div className="space-y-2">
                <span className="font-bold text-zinc-900 text-xs">Safe Removal Plan Queue (Unprotected &amp; Low Usage):</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing']
                    .filter((name) => !removedIndexes.includes(name) && !lockedIndexes.includes(name))
                    .map((name) => (
                      <div key={name} className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-zinc-900">{name}</span>
                            <div className="text-[10px] text-rose-700">Unprotected • 0 Hits • Health: 35/100 (Marginal)</div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded border border-rose-300">
                          Reclaim 2.4 MB
                        </span>
                      </div>
                    ))}
                  {['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'].filter((name) => !removedIndexes.includes(name) && !lockedIndexes.includes(name)).length === 0 && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-emerald-800 font-semibold text-xs">
                      ✨ All indexes are currently protected or actively utilized! No safe removal actions needed.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 font-mono">
                Total Reclaimable Space: ~7.2 MB
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHousekeeperModal(false)}
                  className="px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-semibold cursor-pointer text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-execute-housekeeper-removal"
                  data-testid="btn-execute-housekeeper-removal"
                  onClick={() => handleExecuteHousekeeperRemoval(['idx_transactions_date', 'idx_transactions_amount_missing', 'idx_transactions_email_missing'])}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Execute Safe Removal Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIndexes.length > 0 && (
        <div
          id="floating-bulk-actions-bar"
          data-testid="floating-bulk-actions-bar"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-indigo-500/50 flex items-center gap-4 text-xs animate-slideUp font-sans"
        >
          <div className="flex items-center gap-2 font-bold text-indigo-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
            <span>{selectedIndexes.length} Indexes Selected</span>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-700 pl-4">
            <button
              type="button"
              id="btn-bulk-toggle-protected"
              data-testid="btn-bulk-toggle-protected"
              onClick={handleBulkToggleProtected}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              title="Mass-toggle 'Protected' (Lock) status for selected indexes"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Toggle Protected (Lock)</span>
            </button>

            <button
              type="button"
              id="btn-bulk-reindex-selected"
              data-testid="btn-bulk-reindex-selected"
              onClick={handleBulkReindex}
              disabled={isBulkOperating}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              title="Batch-trigger re-indexing operations on selected indexes"
            >
              {isBulkOperating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-indexing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Batch Re-index Selected</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-clear-index-selection"
              data-testid="btn-clear-index-selection"
              onClick={handleClearSelection}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Impact Prediction Analysis Modal */}
      {activeImpactPredictionIndex && (
        <div
          id="impact-prediction-modal"
          data-testid="impact-prediction-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveImpactPredictionIndex(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col my-8 animate-scaleIn">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-purple-700 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Compass className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Impact Prediction &amp; Latency Analysis</h3>
                  <p className="text-[11px] text-indigo-100 font-mono">{activeImpactPredictionIndex.name} ({activeImpactPredictionIndex.tableName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveImpactPredictionIndex(null)}
                className="text-indigo-200 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Projected Performance Gain Summary</span>
                </div>
                <p className="text-xs text-indigo-900">
                  Calculates estimated latency reduction for common queries (Point Lookups, Range Aggregations, and Joins) if index <strong className="font-mono">{activeImpactPredictionIndex.name}</strong> on columns <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded">({activeImpactPredictionIndex.columns.join(', ')})</code> were optimized, rebuilt, or re-indexed.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Estimated Latency Reduction by Query Pattern</h4>
                {[
                  { query: 'SELECT * FROM transactions WHERE customer_email = ? AND status = ?', before: '142.5 ms', after: '4.8 ms', reduction: '-96.6%' },
                  { query: 'SELECT SUM(amount), category FROM transactions GROUP BY category', before: '380.2 ms', after: '18.5 ms', reduction: '-95.1%' },
                  { query: 'SELECT * FROM ' + activeImpactPredictionIndex.tableName + ' ORDER BY created_at DESC LIMIT 50', before: '210.0 ms', after: '9.2 ms', reduction: '-95.6%' },
                  { query: 'SELECT * FROM line_items WHERE transaction_id = ? (JOIN lookup)', before: '95.4 ms', after: '3.1 ms', reduction: '-96.7%' }
                ].map((item, qidx) => (
                  <div key={qidx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                    <div className="font-mono text-xs text-zinc-900 font-semibold truncate" title={item.query}>
                      {qidx + 1}. {item.query}
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Before: <strong className="line-through">{item.before}</strong></span>
                        <span className="text-zinc-400">➔</span>
                        <span className="text-emerald-700 font-bold">After: {item.after}</span>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs border border-emerald-300">
                        {item.reduction}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Throughput Lift</div>
                  <div className="text-lg font-extrabold text-emerald-800 font-mono mt-0.5">+420 TPS</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">Estimated QPS capacity boost</div>
                </div>
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-center">
                  <div className="text-[10px] uppercase font-bold text-teal-700">Scan Efficiency</div>
                  <div className="text-lg font-extrabold text-teal-800 font-mono mt-0.5">99.4%</div>
                  <div className="text-[10px] text-teal-600 mt-0.5">B-Tree index-only scan rate</div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveImpactPredictionIndex(null)}
                className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl text-xs font-semibold cursor-pointer text-zinc-700"
              >
                Close
              </button>
              <button
                type="button"
                id="btn-apply-impact-prediction-rebuild"
                data-testid="btn-apply-impact-prediction-rebuild"
                onClick={() => {
                  handleRebuildIndex(activeImpactPredictionIndex.name);
                  setActiveImpactPredictionIndex(null);
                  setImportSuccessNotice(`✨ [Impact Prediction Applied] Executed REINDEX CONCURRENTLY on "${activeImpactPredictionIndex.name}". Latency reduced by ~95.8% across common queries!`);
                  setTimeout(() => setImportSuccessNotice(null), 5000);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Execute Reindex &amp; Apply Optimization</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Diff (Live vs Snapshot) Modal */}
      {showSchemaDiffLiveModal && (
        <div
          id="schema-diff-live-modal"
          data-testid="schema-diff-live-modal"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSchemaDiffLiveModal(false);
          }}
        >
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 text-zinc-900 relative">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Schema Diff: Live Configuration vs Snapshot</h3>
                  <p className="text-xs text-zinc-500">
                    Compares current live database index configuration against a saved historical snapshot.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaDiffLiveModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-zinc-700">Select Historical Snapshot to Compare Against Live State</label>
              <select
                value={schemaDiffTargetSnapshotId || snapshots[0]?.id || ''}
                onChange={(e) => setSchemaDiffTargetSnapshotId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-300 bg-white text-xs font-mono"
              >
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.timestamp})</option>
                ))}
              </select>
            </div>

            {(() => {
              const targetSnap = snapshots.find((s) => s.id === schemaDiffTargetSnapshotId) || snapshots[0];
              if (!targetSnap) return null;

              const snapshotIndexNames = new Set([
                ...(targetSnap.customIndexes || []),
                ...(targetSnap.createdCompositeIndexes || []),
                'idx_transactions_email',
                'idx_transactions_date',
                'idx_transactions_amount',
                'idx_transactions_category'
              ]);

              const liveIndexes = tables.flatMap((t) => t.indexes.map((i) => i.name));
              const liveIndexSet = new Set(liveIndexes);

              const addedInLive = liveIndexes.filter((name) => !snapshotIndexNames.has(name));
              const removedInLive = [...snapshotIndexNames].filter((name) => !liveIndexSet.has(name) || removedIndexes.includes(name));
              const activeUnchanged = liveIndexes.filter((name) => snapshotIndexNames.has(name) && !removedIndexes.includes(name));

              return (
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-emerald-700">Added in Live</div>
                      <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">+{addedInLive.length}</div>
                    </div>
                    <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-rose-700">Removed / Dropped</div>
                      <div className="text-base font-extrabold text-rose-800 font-mono mt-0.5">-{removedInLive.length}</div>
                    </div>
                    <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
                      <div className="text-[10px] uppercase font-bold text-indigo-700">Unchanged Active</div>
                      <div className="text-base font-extrabold text-indigo-800 font-mono mt-0.5">{activeUnchanged.length}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[11px]">Configuration Deltas (Live vs &quot;{targetSnap.name}&quot;)</h4>
                    {addedInLive.map((name, idx) => (
                      <div key={`live-add-${idx}`} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-emerald-950 font-bold">🟢 [Added in Live] {name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-sans">Created in current session</span>
                      </div>
                    ))}
                    {removedInLive.map((name, idx) => (
                      <div key={`live-rem-${idx}`} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between font-mono">
                        <span className="text-rose-950 font-bold">🔴 [Removed / Pruned] {name}</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-sans">Dropped or pruned from live</span>
                      </div>
                    ))}
                    {addedInLive.length === 0 && removedInLive.length === 0 && (
                      <div className="p-6 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200">
                        Live database index configuration matches snapshot &quot;{targetSnap.name}&quot; precisely!
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSchemaDiffLiveModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Index Recommendation Engine Modal */}
      {showIndexRecommendationEngineModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col text-zinc-900 relative">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-purple-50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-600 text-white rounded-xl shadow-sm">
                  <Sparkles className="w-5 h-5 text-violet-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
                    <span>Index Recommendation Engine</span>
                    <span className="text-[10px] font-mono bg-violet-200 text-violet-900 px-2 py-0.5 rounded-full font-bold">
                      AI Workload Analyzer
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-600">
                    AI analysis of recent query execution plans identifying frequent 'Full Table Scan' scenarios and suggesting missing covering indexes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexRecommendationEngineModal(false)}
                className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 cursor-pointer transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs bg-zinc-50/50">
              <div className="p-3.5 bg-violet-900 text-white rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-violet-300" />
                  <div>
                    <div className="font-bold text-white">Full Table Scan Detection Active</div>
                    <div className="text-[11px] text-violet-200">
                      Scanned {fullTableScanRecommendations.length} high-frequency queries for missing covering index opportunities.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = fullTableScanRecommendations.map(r => r.id);
                    setAppliedEngineIndexIds(allIds);
                    if (!flags.btreeIndexing) onToggleFlag('btreeIndexing');
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-violet-50 text-violet-900 font-bold rounded-lg text-xs shadow-xs cursor-pointer transition-colors"
                >
                  Apply All Recommendations
                </button>
              </div>

              {/* Recommendations List */}
              <div className="space-y-3">
                {fullTableScanRecommendations.map((rec) => {
                  const isApplied = appliedEngineIndexIds.includes(rec.id);
                  return (
                    <div
                      key={rec.id}
                      id={`index-rec-card-${rec.id}`}
                      data-testid={`index-rec-card-${rec.id}`}
                      className={`p-4 rounded-xl border transition-all space-y-3 bg-white ${
                        isApplied ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200 shadow-2xs hover:border-violet-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-extrabold text-zinc-900 flex items-center gap-2 text-sm">
                            <span className={`w-2.5 h-2.5 rounded-full ${isApplied ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                            <span>{rec.name}</span>
                            <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                              Table: {rec.tableName}
                            </span>
                            <span className="text-[10px] font-mono bg-violet-100 text-violet-800 px-2 py-0.5 rounded font-bold border border-violet-200">
                              Speedup: {rec.speedup}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                            {rec.queryScenario}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isApplied ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Applied Successfully</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              id={`btn-apply-rec-${rec.id}`}
                              data-testid={`btn-apply-rec-${rec.id}`}
                              onClick={() => {
                                setAppliedEngineIndexIds(prev => Array.from(new Set([...prev, rec.id])));
                                if (!flags.btreeIndexing) onToggleFlag('btreeIndexing');
                              }}
                              className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Apply Index</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* DDL Statement & Metrics */}
                      <div className="p-3 bg-zinc-950 text-zinc-200 rounded-lg font-mono text-[11px] space-y-1.5 shadow-inner">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
                          <span>Suggested CREATE INDEX Statement:</span>
                          <span className="text-amber-400 font-bold">Cost: {rec.scanCost.toFixed(2)} ➔ {rec.optimizedCost.toFixed(2)}</span>
                        </div>
                        <div className="text-emerald-300 font-bold select-all overflow-x-auto">
                          {rec.createStatement}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                          <span>Workload Frequency: {rec.frequencyPerMin}</span>
                          <span>Scanned Payload: {rec.rowsScanned}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between shrink-0 text-xs">
              <span className="text-zinc-500 font-medium">
                Applied Recommendations: <strong className="text-zinc-800">{appliedEngineIndexIds.length} / {fullTableScanRecommendations.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowIndexRecommendationEngineModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Close Engine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intelligent Indexing Advisor Modal */}
      <IntelligentIndexingAdvisorModal
        isOpen={showIntelligentAdvisorModal}
        onClose={() => setShowIntelligentAdvisorModal(false)}
        onApplyCoveringIndex={handleApplyCoveringPatch}
        onApplyAllPatches={handleApplyAllCoveringPatches}
        patchedIndexIds={patchedCoveringIndexIds}
        flags={flags}
        onToggleFlag={onToggleFlag}
      />
    </div>
  );
};
