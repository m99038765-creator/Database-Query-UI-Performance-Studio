import React, { useState, useMemo } from 'react';
import {
  Compass,
  AlertTriangle,
  Zap,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  Trash2,
  Sparkles,
  Info,
  Layers,
  Table,
  RotateCcw,
  X
} from 'lucide-react';

export interface IndexImpactMapItem {
  name: string;
  table: string;
  columns: string[];
  type: string;
  reads: number;
  writes: number;
  ratio: number;
  readPercentage: number;
  writePercentage: number;
  queryCostMs: number;
  impactScore: number;
  healthScore: number;
  isRemoved: boolean;
  isLocked: boolean;
  active: boolean;
  entityBadge?: string;
}

interface IndexImpactMapProps {
  indexes: IndexImpactMapItem[];
  onSelectIndex?: (indexName: string) => void;
  onReindex?: (indexName: string) => void;
  onDropIndex?: (indexName: string) => void;
  onWhatIf?: (indexName: string) => void;
  onClose?: () => void;
}

export type ClusterCategory = 'all' | 'inefficient' | 'bottleneck' | 'optimal' | 'dormant';

export const IndexImpactMap: React.FC<IndexImpactMapProps> = ({
  indexes,
  onSelectIndex,
  onReindex,
  onDropIndex,
  onWhatIf,
  onClose
}) => {
  const [selectedCluster, setSelectedCluster] = useState<ClusterCategory>('all');
  const [isolateInefficient, setIsolateInefficient] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<IndexImpactMapItem | null>(null);
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');

  // Derive unique tables
  const tableNames = useMemo(() => {
    return Array.from(new Set(indexes.map((idx) => idx.table)));
  }, [indexes]);

  // Classify each index into a quadrant cluster
  const classifiedIndexes = useMemo(() => {
    return indexes.map((item) => {
      // Classification logic based on Read% (X-axis) and Query Cost in ms (Y-axis)
      // Read Activity Threshold: 50%
      // Query Cost Threshold: 150ms
      const isHighCost = item.queryCostMs >= 150;
      const isReadDominant = item.readPercentage >= 50;

      let cluster: ClusterCategory = 'optimal';
      let clusterLabel = 'Optimal Efficiency';
      let clusterColor = 'text-emerald-600';
      let clusterBg = 'bg-emerald-500';
      let clusterBorder = 'border-emerald-500';
      let inefficiencyReason = '';

      if (isHighCost && !isReadDominant) {
        cluster = 'inefficient';
        clusterLabel = 'Inefficient (Write-Heavy Penalty)';
        clusterColor = 'text-rose-600';
        clusterBg = 'bg-rose-500';
        clusterBorder = 'border-rose-500';
        inefficiencyReason = 'Severe write amplification with low read query ROI. Imposes continuous maintenance overhead during inserts/updates.';
      } else if (isHighCost && isReadDominant) {
        cluster = 'bottleneck';
        clusterLabel = 'Read Query Bottleneck';
        clusterColor = 'text-amber-600';
        clusterBg = 'bg-amber-500';
        clusterBorder = 'border-amber-500';
        inefficiencyReason = 'High frequency read target experiencing query plan latency spikes. Candidate for composite covering index.';
      } else if (!isHighCost && isReadDominant) {
        cluster = 'optimal';
        clusterLabel = 'Optimal High-ROI';
        clusterColor = 'text-emerald-600';
        clusterBg = 'bg-emerald-500';
        clusterBorder = 'border-emerald-500';
      } else {
        cluster = 'dormant';
        clusterLabel = 'Dormant / Low Activity';
        clusterColor = 'text-slate-600';
        clusterBg = 'bg-slate-400';
        clusterBorder = 'border-slate-400';
        inefficiencyReason = 'Infrequent read activity with low execution overhead.';
      }

      return {
        ...item,
        cluster,
        clusterLabel,
        clusterColor,
        clusterBg,
        clusterBorder,
        inefficiencyReason
      };
    });
  }, [indexes]);

  // Filter based on selected cluster and table
  const displayedItems = useMemo(() => {
    return classifiedIndexes.filter((item) => {
      if (selectedTableFilter !== 'all' && item.table !== selectedTableFilter) {
        return false;
      }
      if (isolateInefficient) {
        return item.cluster === 'inefficient';
      }
      if (selectedCluster === 'all') return true;
      return item.cluster === selectedCluster;
    });
  }, [classifiedIndexes, selectedTableFilter, isolateInefficient, selectedCluster]);

  // Cluster counts
  const clusterCounts = useMemo(() => {
    return {
      all: classifiedIndexes.length,
      inefficient: classifiedIndexes.filter((i) => i.cluster === 'inefficient').length,
      bottleneck: classifiedIndexes.filter((i) => i.cluster === 'bottleneck').length,
      optimal: classifiedIndexes.filter((i) => i.cluster === 'optimal').length,
      dormant: classifiedIndexes.filter((i) => i.cluster === 'dormant').length
    };
  }, [classifiedIndexes]);

  // Total latency impact of inefficient cluster
  const inefficientStats = useMemo(() => {
    const ineff = classifiedIndexes.filter((i) => i.cluster === 'inefficient');
    const totalLatency = ineff.reduce((sum, item) => sum + item.queryCostMs, 0);
    const totalWrites = ineff.reduce((sum, item) => sum + item.writes, 0);
    return {
      count: ineff.length,
      totalLatencyMs: totalLatency,
      totalWrites
    };
  }, [classifiedIndexes]);

  // Coordinate dimensions for SVG
  const width = 860;
  const height = 440;
  const margin = { top: 40, right: 40, bottom: 60, left: 75 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Max query cost scale
  const maxQueryCostMs = 900;

  // Helper coordinate conversions
  const getX = (readPct: number) => {
    return margin.left + (readPct / 100) * plotWidth;
  };

  const getY = (costMs: number) => {
    const clampedCost = Math.min(Math.max(costMs, 0), maxQueryCostMs);
    // Invert Y: higher cost = higher on graph (lower y coordinate)
    return margin.top + (1 - clampedCost / maxQueryCostMs) * plotHeight;
  };

  // Export Coordinate Map Telemetry JSON
  const handleExportMapJson = () => {
    const payload = {
      exportType: 'index_impact_map_telemetry',
      exportedAt: new Date().toISOString(),
      summary: {
        totalIndexesAnalyzed: classifiedIndexes.length,
        inefficientClusterCount: clusterCounts.inefficient,
        bottleneckClusterCount: clusterCounts.bottleneck,
        optimalClusterCount: clusterCounts.optimal,
        dormantClusterCount: clusterCounts.dormant,
        aggregateInefficientCostMs: inefficientStats.totalLatencyMs
      },
      indexes: classifiedIndexes.map((i) => ({
        indexName: i.name,
        table: i.table,
        columns: i.columns,
        coordinates: {
          readPercentage: i.readPercentage,
          writePercentage: i.writePercentage,
          queryCostMs: i.queryCostMs,
          readWriteRatio: i.ratio
        },
        clusterCategory: i.cluster,
        healthScore: i.healthScore,
        impactScore: i.impactScore,
        isRemoved: i.isRemoved,
        isLocked: i.isLocked
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `index-impact-map-telemetry-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="index-impact-map-container"
      data-testid="index-impact-map-container"
      className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-5 font-sans"
    >
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Index Impact Map</span>
                <span className="text-[11px] font-mono text-zinc-500 font-normal">
                  Coordinate Analysis: Read/Write Activity vs. Total Execution Cost
                </span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Correlates operational workload distribution against query scan costs to visually isolate inefficient index clusters.
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar & Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Table Filter Selector */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span>Table:</span>
            <select
              value={selectedTableFilter}
              onChange={(e) => setSelectedTableFilter(e.target.value)}
              className="bg-transparent font-medium text-zinc-900 text-xs focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Tables ({indexes.length})</option>
              {tableNames.map((tbl) => (
                <option key={tbl} value={tbl}>
                  {tbl}
                </option>
              ))}
            </select>
          </div>

          {/* Isolate Inefficient Cluster Button */}
          <button
            type="button"
            id="btn-isolate-inefficient-clusters"
            data-testid="btn-isolate-inefficient-clusters"
            onClick={() => setIsolateInefficient(!isolateInefficient)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 border shadow-2xs ${
              isolateInefficient
                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
            }`}
            title="Focus exclusively on the inefficient index cluster (High Query Cost + High Write Penalty)"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Isolate Inefficient Clusters</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                isolateInefficient ? 'bg-white/20 text-white' : 'bg-rose-200/80 text-rose-900'
              }`}
            >
              {clusterCounts.inefficient}
            </span>
          </button>

          {/* Export JSON Button */}
          <button
            type="button"
            id="btn-export-impact-map-telemetry"
            data-testid="btn-export-impact-map-telemetry"
            onClick={handleExportMapJson}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-zinc-200"
            title="Export coordinate map telemetry and cluster diagnostics as JSON"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export Map JSON</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
              aria-label="Close Impact Map"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cluster Navigation Pills */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200/80">
          <button
            type="button"
            onClick={() => {
              setSelectedCluster('all');
              setIsolateInefficient(false);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedCluster === 'all' && !isolateInefficient
                ? 'bg-white text-zinc-900 shadow-xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All Clusters ({clusterCounts.all})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCluster('inefficient');
              setIsolateInefficient(true);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedCluster === 'inefficient' || isolateInefficient
                ? 'bg-rose-600 text-white shadow-xs font-bold'
                : 'text-rose-700 hover:text-rose-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>Inefficient Clusters ({clusterCounts.inefficient})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCluster('bottleneck');
              setIsolateInefficient(false);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedCluster === 'bottleneck' && !isolateInefficient
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Read Bottlenecks ({clusterCounts.bottleneck})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCluster('optimal');
              setIsolateInefficient(false);
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedCluster === 'optimal' && !isolateInefficient
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-emerald-700 hover:text-emerald-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Optimal Clusters ({clusterCounts.optimal})</span>
          </button>
        </div>

        {/* Inefficient Cluster Warning Callout Banner */}
        {inefficientStats.count > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>{inefficientStats.count} Inefficient Indexes</strong> identified with{' '}
              <strong className="font-mono tabular-nums">{inefficientStats.totalLatencyMs.toFixed(0)}ms</strong> cost
              and high write amplification.
            </span>
          </div>
        )}
      </div>

      {/* Coordinate Grid Canvas */}
      <div className="relative border border-zinc-200 rounded-xl bg-zinc-950 overflow-hidden shadow-inner select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[500px] overflow-visible"
        >
          {/* Quadrant Shading & Cluster Isolation Zones */}
          {/* Top-Left Quadrant: Inefficient Cluster */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth / 2}
            height={plotHeight / 2}
            className={`transition-all duration-300 ${
              isolateInefficient || selectedCluster === 'inefficient'
                ? 'fill-rose-950/40 stroke-rose-500/80 stroke-2'
                : 'fill-rose-950/15 stroke-rose-500/20 stroke-1'
            }`}
            strokeDasharray={isolateInefficient ? 'none' : '4,4'}
          />

          {/* Top-Right Quadrant: Read Query Bottlenecks */}
          <rect
            x={margin.left + plotWidth / 2}
            y={margin.top}
            width={plotWidth / 2}
            height={plotHeight / 2}
            className={`transition-all duration-300 ${
              selectedCluster === 'bottleneck'
                ? 'fill-amber-950/40 stroke-amber-500/80 stroke-2'
                : 'fill-amber-950/10 stroke-amber-500/20 stroke-1'
            }`}
            strokeDasharray="4,4"
          />

          {/* Bottom-Right Quadrant: Optimal Efficiency Cluster */}
          <rect
            x={margin.left + plotWidth / 2}
            y={margin.top + plotHeight / 2}
            width={plotWidth / 2}
            height={plotHeight / 2}
            className={`transition-all duration-300 ${
              selectedCluster === 'optimal'
                ? 'fill-emerald-950/40 stroke-emerald-500/80 stroke-2'
                : 'fill-emerald-950/10 stroke-emerald-500/20 stroke-1'
            }`}
            strokeDasharray="4,4"
          />

          {/* Bottom-Left Quadrant: Dormant / Low Activity */}
          <rect
            x={margin.left}
            y={margin.top + plotHeight / 2}
            width={plotWidth / 2}
            height={plotHeight / 2}
            className="fill-zinc-900/30 stroke-zinc-700/20 stroke-1"
            strokeDasharray="4,4"
          />

          {/* Quadrant Watermark Labels */}
          <text
            x={margin.left + 14}
            y={margin.top + 24}
            className="fill-rose-400 font-mono text-[11px] font-bold uppercase tracking-wider"
          >
            🔴 Inefficient Cluster (High Cost + Write Heavy)
          </text>
          <text
            x={margin.left + plotWidth / 2 + 14}
            y={margin.top + 24}
            className="fill-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider"
          >
            🟠 Read Bottlenecks (High Cost + Read Heavy)
          </text>
          <text
            x={margin.left + plotWidth / 2 + 14}
            y={margin.top + plotHeight - 14}
            className="fill-emerald-400 font-mono text-[11px] font-bold uppercase tracking-wider"
          >
            🟢 Optimal Cluster (Sub-ms Cost + High Reads)
          </text>
          <text
            x={margin.left + 14}
            y={margin.top + plotHeight - 14}
            className="fill-zinc-500 font-mono text-[11px] font-bold uppercase tracking-wider"
          >
            ⚪ Dormant / Low Impact
          </text>

          {/* Coordinate Grid Lines */}
          {/* Horizontal Grid Lines (Query Cost) */}
          {[0, 150, 300, 450, 600, 750, 900].map((costVal) => {
            const yCoord = getY(costVal);
            return (
              <g key={`h-grid-${costVal}`}>
                <line
                  x1={margin.left}
                  y1={yCoord}
                  x2={margin.left + plotWidth}
                  y2={yCoord}
                  className="stroke-zinc-800"
                  strokeWidth={costVal === 150 ? 1.5 : 0.75}
                  strokeDasharray={costVal === 150 ? 'none' : '2,2'}
                />
                <text
                  x={margin.left - 10}
                  y={yCoord + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[10px] tabular-nums"
                >
                  {costVal}ms
                </text>
              </g>
            );
          })}

          {/* Vertical Grid Lines (Read % Activity) */}
          {[0, 25, 50, 75, 100].map((readVal) => {
            const xCoord = getX(readVal);
            return (
              <g key={`v-grid-${readVal}`}>
                <line
                  x1={xCoord}
                  y1={margin.top}
                  x2={xCoord}
                  y2={margin.top + plotHeight}
                  className="stroke-zinc-800"
                  strokeWidth={readVal === 50 ? 1.5 : 0.75}
                  strokeDasharray={readVal === 50 ? 'none' : '2,2'}
                />
                <text
                  x={xCoord}
                  y={margin.top + plotHeight + 18}
                  textAnchor="middle"
                  className="fill-zinc-400 font-mono text-[10px] tabular-nums"
                >
                  {readVal}% Read
                </text>
              </g>
            );
          })}

          {/* Axis Labels */}
          <text
            x={margin.left + plotWidth / 2}
            y={height - 15}
            textAnchor="middle"
            className="fill-zinc-300 text-xs font-semibold"
          >
            ← High Write Overhead (0% R / 100% W) · Index Read Activity Distribution · High Read Acceleration (100% R / 0% W) →
          </text>
          <text
            transform={`rotate(-90) translate(-${margin.top + plotHeight / 2}, 24)`}
            textAnchor="middle"
            className="fill-zinc-300 text-xs font-semibold"
          >
            Total Query Execution Cost (ms latency impact) ↑
          </text>

          {/* Data Points (Index Scatter Nodes) */}
          {classifiedIndexes.map((idxItem) => {
            const cx = getX(idxItem.readPercentage);
            const cy = getY(idxItem.queryCostMs);
            const isHovered = hoveredIndex?.name === idxItem.name;
            const isInefficient = idxItem.cluster === 'inefficient';

            // Opacity when filtering or isolating
            let opacity = 1;
            if (isolateInefficient && !isInefficient) {
              opacity = 0.15;
            } else if (selectedCluster !== 'all' && idxItem.cluster !== selectedCluster) {
              opacity = 0.2;
            } else if (selectedTableFilter !== 'all' && idxItem.table !== selectedTableFilter) {
              opacity = 0.15;
            }

            // Node color & size
            const nodeRadius = isHovered ? 9 : isInefficient ? 7.5 : 6;
            const fillColor =
              idxItem.cluster === 'inefficient'
                ? '#f43f5e'
                : idxItem.cluster === 'bottleneck'
                ? '#f59e0b'
                : idxItem.cluster === 'optimal'
                ? '#10b981'
                : '#94a3b8';

            return (
              <g
                key={`map-node-${idxItem.name}`}
                id={`map-node-${idxItem.name}`}
                data-testid={`map-node-${idxItem.name}`}
                className="cursor-pointer transition-opacity duration-300"
                style={{ opacity }}
                onMouseEnter={() => setHoveredIndex(idxItem)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelectIndex?.(idxItem.name)}
              >
                {/* Pulsing Outer Ring for Inefficient or Hovered Nodes */}
                {(isHovered || (isInefficient && isolateInefficient)) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={nodeRadius + 6}
                    fill="none"
                    stroke={fillColor}
                    strokeWidth={1.5}
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Primary Coordinate Node */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={nodeRadius}
                  fill={fillColor}
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="transition-transform hover:scale-125 shadow-lg"
                />

                {/* Index Name Tag */}
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  className={`font-mono text-[9px] font-bold pointer-events-none transition-all ${
                    isHovered ? 'fill-white text-[11px]' : 'fill-zinc-400'
                  }`}
                >
                  {idxItem.name.replace(/^idx_/, '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip / Inspect Details Overlay */}
        {hoveredIndex && (
          <div
            id="map-node-tooltip"
            data-testid="map-node-tooltip"
            className="absolute top-4 right-4 z-20 w-80 p-4 bg-zinc-900/95 text-white rounded-xl shadow-2xl border border-zinc-700 backdrop-blur-md animate-fadeIn text-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Target Table: <span className="text-zinc-200 font-bold">{hoveredIndex.table}</span>
                </div>
                <h4 className="font-mono text-sm font-bold text-white mt-0.5 break-all">
                  {hoveredIndex.name}
                </h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                  hoveredIndex.cluster === 'inefficient'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : hoveredIndex.cluster === 'bottleneck'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}
              >
                {hoveredIndex.clusterLabel}
              </span>
            </div>

            {/* Coordinate Metrics */}
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2 bg-zinc-800/80 rounded-lg border border-zinc-700/80">
                <div className="text-[9px] text-zinc-400 uppercase">Read/Write Ratio</div>
                <div className="text-sm font-extrabold text-indigo-400 mt-0.5">
                  {hoveredIndex.ratio}x
                </div>
                <div className="text-[9px] text-zinc-500">
                  {hoveredIndex.readPercentage}% R · {hoveredIndex.writePercentage}% W
                </div>
              </div>

              <div className="p-2 bg-zinc-800/80 rounded-lg border border-zinc-700/80">
                <div className="text-[9px] text-zinc-400 uppercase">Query Scan Cost</div>
                <div
                  className={`text-sm font-extrabold mt-0.5 ${
                    hoveredIndex.queryCostMs > 150 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {hoveredIndex.queryCostMs.toFixed(1)}ms
                </div>
                <div className="text-[9px] text-zinc-500">
                  Health: {hoveredIndex.healthScore}/100
                </div>
              </div>
            </div>

            {/* Columns & Cluster Analysis */}
            <div className="text-[11px] text-zinc-300 space-y-1">
              <div>
                <span className="text-zinc-500">Columns:</span>{' '}
                <span className="font-mono text-zinc-200 font-semibold">{hoveredIndex.columns.join(', ')}</span>
              </div>
              {hoveredIndex.inefficiencyReason && (
                <div className="p-2 bg-rose-950/60 border border-rose-800/80 rounded text-rose-200 text-[10px] leading-relaxed">
                  ⚠️ {hoveredIndex.inefficiencyReason}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800">
              {hoveredIndex.cluster === 'inefficient' && onDropIndex && (
                <button
                  type="button"
                  onClick={() => onDropIndex(hoveredIndex.name)}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Drop Inefficient Index</span>
                </button>
              )}
              {onReindex && (
                <button
                  type="button"
                  onClick={() => onReindex(hoveredIndex.name)}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  <span>Rebuild Index</span>
                </button>
              )}
              {onWhatIf && (
                <button
                  type="button"
                  onClick={() => onWhatIf(hoveredIndex.name)}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Test columns in What-If simulator"
                >
                  <Sparkles className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cluster Classification Legend & Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Inefficient Cluster Legend Card */}
        <div
          onClick={() => {
            setSelectedCluster('inefficient');
            setIsolateInefficient(true);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            isolateInefficient || selectedCluster === 'inefficient'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
              : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-rose-900">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>Inefficient Cluster</span>
            </span>
            <span className="font-mono font-extrabold text-rose-700 text-sm">
              {clusterCounts.inefficient}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            High cost with low read ROI. Incurs write penalty during data updates without accelerating query paths.
          </p>
          <div className="mt-2 text-[10px] font-mono text-rose-700 font-semibold">
            Action: Prune or drop index
          </div>
        </div>

        {/* Read Query Bottleneck Legend Card */}
        <div
          onClick={() => {
            setSelectedCluster('bottleneck');
            setIsolateInefficient(false);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCluster === 'bottleneck' && !isolateInefficient
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Read Bottlenecks</span>
            </span>
            <span className="font-mono font-extrabold text-amber-700 text-sm">
              {clusterCounts.bottleneck}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            Frequently read targets with high query plan scan latency. High priority candidates for composite coverage.
          </p>
          <div className="mt-2 text-[10px] font-mono text-amber-700 font-semibold">
            Action: Reindex or create covering patch
          </div>
        </div>

        {/* Optimal Cluster Legend Card */}
        <div
          onClick={() => {
            setSelectedCluster('optimal');
            setIsolateInefficient(false);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCluster === 'optimal' && !isolateInefficient
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
              : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-emerald-900">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Optimal Clusters</span>
            </span>
            <span className="font-mono font-extrabold text-emerald-700 text-sm">
              {clusterCounts.optimal}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            Sub-millisecond query seeks with high read selectivity. Maximizes query throughput with minimal overhead.
          </p>
          <div className="mt-2 text-[10px] font-mono text-emerald-700 font-semibold">
            Status: Fully nominal
          </div>
        </div>

        {/* Dormant / Low Activity Legend Card */}
        <div
          onClick={() => {
            setSelectedCluster('dormant');
            setIsolateInefficient(false);
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            selectedCluster === 'dormant' && !isolateInefficient
              ? 'bg-zinc-200 border-zinc-400 ring-2 ring-zinc-400'
              : 'bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-zinc-700">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Dormant Clusters</span>
            </span>
            <span className="font-mono font-extrabold text-zinc-600 text-sm">
              {clusterCounts.dormant}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            Low operational frequency and negligible latency overhead. Passive indexes with standard health metrics.
          </p>
          <div className="mt-2 text-[10px] font-mono text-zinc-600 font-semibold">
            Status: Monitored
          </div>
        </div>
      </div>
    </div>
  );
};
