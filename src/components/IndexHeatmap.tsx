import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Database, Activity, Flame, ShieldAlert, Sparkles, RefreshCw, Trash2, CheckCircle2, TrendingUp, Layers, Info, Filter } from 'lucide-react';

interface IndexHeatmapProps {
  tables: any[];
  onDropIndex?: (indexName: string, tableName: string) => void;
  onRebuildIndex?: (indexName: string) => void;
  onSuccessNotice?: (message: string) => void;
}

export interface IndexBubbleNode {
  indexName: string;
  tableName: string;
  type: string;
  sizeMb: number;
  readCount: number;
  writeCount: number;
  status: 'over_sized_under_utilized' | 'optimal' | 'write_heavy' | 'moderate';
  recommendation: string;
  r?: number;
  x?: number;
  y?: number;
}

export const IndexHeatmap: React.FC<IndexHeatmapProps> = ({
  tables,
  onDropIndex,
  onRebuildIndex,
  onSuccessNotice,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<IndexBubbleNode | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'bloated' | 'optimal' | 'write_heavy'>('all');
  const [hoveredNode, setHoveredNode] = useState<IndexBubbleNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Extract all indexes across tables and synthesize storage & read telemetry
  const allNodes: IndexBubbleNode[] = React.useMemo(() => {
    const list: IndexBubbleNode[] = [];
    tables.forEach((tbl) => {
      tbl.indexes?.forEach((idx: any) => {
        const hash = (idx.name + tbl.name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const sizeMb = +(4.5 + ((hash % 38) * 1.8)).toFixed(1); // 4.5 MB to ~75 MB storage cost
        const readCount = 120 + ((hash * 13) % 9800); // Read frequency
        const writeCount = 50 + ((hash * 5) % 4500);

        let status: 'over_sized_under_utilized' | 'optimal' | 'write_heavy' | 'moderate' = 'moderate';
        let recommendation = 'Standard indexing utility.';

        if (sizeMb > 25 && readCount < 1800) {
          status = 'over_sized_under_utilized';
          recommendation = '⚠️ Bloated & Under-Utilized: High storage footprint (>25MB) with minimal read activity. Recommended for pruning.';
        } else if (readCount > 5500) {
          status = 'optimal';
          recommendation = '✨ Optimal Covering Index: High read frequency and strong access efficiency.';
        } else if (writeCount > readCount * 1.6) {
          status = 'write_heavy';
          recommendation = '⚡ Write-Intensive: Incurs substantial DML write amplification overhead.';
        }

        list.push({
          indexName: idx.name,
          tableName: tbl.name,
          type: idx.type || 'BTREE',
          sizeMb,
          readCount,
          writeCount,
          status,
          recommendation,
        });
      });
    });
    return list;
  }, [tables]);

  const filteredNodes = React.useMemo(() => {
    return allNodes.filter((n) => {
      if (filterMode === 'bloated') return n.status === 'over_sized_under_utilized';
      if (filterMode === 'optimal') return n.status === 'optimal';
      if (filterMode === 'write_heavy') return n.status === 'write_heavy';
      return true;
    });
  }, [allNodes, filterMode]);

  const bloatedCount = allNodes.filter((n) => n.status === 'over_sized_under_utilized').length;
  const optimalCount = allNodes.filter((n) => n.status === 'optimal').length;
  const writeHeavyCount = allNodes.filter((n) => n.status === 'write_heavy').length;
  const totalStorageMb = allNodes.reduce((sum, n) => sum + n.sizeMb, 0).toFixed(1);

  // Render D3 Bubble Chart with smooth transition animations for resizing and rearranging
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const width = 850;
    const height = 480;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Ensure defs exist once
    if (svg.select('defs').empty()) {
      const defs = svg.append('defs');
      const filter = defs.append('filter').attr('id', 'bubble-shadow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
      filter.append('feDropShadow').attr('dx', '0').attr('dy', '3').attr('stdDeviation', '4').attr('flood-opacity', '0.15');
    }

    let g = svg.select<SVGGElement>('g.chart-group');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'chart-group').attr('transform', 'translate(30, 30)');
    }

    const root = d3.hierarchy({ children: filteredNodes } as any)
      .sum((d: any) => Math.max(d.sizeMb, 5))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack()
      .size([width - 60, height - 60])
      .padding(8);

    const packedRoot = pack(root);
    const descendants = packedRoot.descendants().slice(1); // remove root

    const minRead = d3.min(allNodes, (d) => d.readCount) || 100;
    const maxRead = d3.max(allNodes, (d) => d.readCount) || 10000;

    const colorScale = d3.scaleSequential()
      .domain([minRead, maxRead])
      .interpolator(d3.interpolateYlOrRd);

    // Data join with indexName key function for smooth object constancy and transitions
    const nodeGroups = g.selectAll<SVGGElement, any>('.bubble-node')
      .data(descendants, (d: any) => d.data.indexName);

    // EXIT transition: smoothly shrink and fade out removed/filtered-out bubbles
    nodeGroups.exit()
      .transition()
      .duration(500)
      .ease(d3.easeCubicIn)
      .attr('transform', (d: any) => `translate(${width / 2}, ${height / 2})`)
      .style('opacity', 0)
      .remove();

    // ENTER new nodes
    const enterGroup = nodeGroups.enter()
      .append('g')
      .attr('class', 'bubble-node')
      .attr('transform', (d: any) => `translate(${width / 2}, ${height / 2})`)
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .on('click', (event, d: any) => {
        setSelectedBubble(d.data);
      })
      .on('mouseenter', (event, d: any) => {
        setHoveredNode(d.data);
        const [mx, my] = d3.pointer(event, svgRef.current);
        setTooltipPos({ x: mx + 15, y: my - 15 });
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200)
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 3.5)
          .attr('transform', 'scale(1.05)');
      })
      .on('mouseleave', (event, d: any) => {
        setHoveredNode(null);
        setTooltipPos(null);
        d3.select(event.currentTarget).select('circle')
          .transition().duration(200)
          .attr('stroke', (nodeData: any) => nodeData.data.status === 'over_sized_under_utilized' ? '#e11d48' : '#cbd5e1')
          .attr('stroke-width', (nodeData: any) => nodeData.data.status === 'over_sized_under_utilized' ? 2.5 : 1.5)
          .attr('transform', 'scale(1)');
      });

    enterGroup.append('circle')
      .attr('r', 0)
      .attr('fill', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#ffe4e6' : colorScale(d.data.readCount))
      .attr('fill-opacity', (d: any) => d.data.status === 'over_sized_under_utilized' ? 0.95 : 0.88)
      .attr('stroke', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#e11d48' : '#94a3b8')
      .attr('stroke-width', (d: any) => d.data.status === 'over_sized_under_utilized' ? 2.5 : 1.2)
      .attr('filter', 'url(#bubble-shadow)');

    enterGroup.append('text')
      .attr('class', 'bubble-title')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('opacity', 0);

    enterGroup.append('text')
      .attr('class', 'bubble-subtitle')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('opacity', 0);

    // MERGE enter + update: smooth D3 transition for position, radius scaling, and color updates
    const mergedGroups = enterGroup.merge(nodeGroups);

    mergedGroups.transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
      .style('opacity', 1);

    mergedGroups.select('circle')
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#ffe4e6' : colorScale(d.data.readCount))
      .attr('stroke', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#e11d48' : '#94a3b8')
      .attr('stroke-width', (d: any) => d.data.status === 'over_sized_under_utilized' ? 2.5 : 1.2);

    mergedGroups.select('text.bubble-title')
      .text((d: any) => d.r > 22 ? d.data.indexName : '')
      .attr('font-size', (d: any) => Math.min(d.r / 3.2, 11) + 'px')
      .attr('font-weight', '700')
      .attr('fill', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#9f1239' : '#1e293b')
      .transition()
      .duration(750)
      .attr('opacity', (d: any) => d.r > 22 ? 1 : 0);

    mergedGroups.select('text.bubble-subtitle')
      .text((d: any) => d.r > 28 ? `${d.data.sizeMb}MB • ${d.data.readCount.toLocaleString()} reads` : '')
      .attr('font-size', '9px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', (d: any) => d.data.status === 'over_sized_under_utilized' ? '#be123c' : '#475569')
      .transition()
      .duration(750)
      .attr('opacity', (d: any) => d.r > 28 ? 1 : 0);

  }, [filteredNodes, allNodes]);

  return (
    <div className="p-6 space-y-6 bg-white rounded-2xl border border-zinc-200 shadow-xs max-h-[82vh] overflow-y-auto">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              <Flame className="w-5 h-5 animate-pulse text-amber-400" />
            </div>
            <h3 className="text-base font-extrabold tracking-tight">Index Storage Cost vs. Read Activity Heatmap</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
              {allNodes.length} Indexes Analyzed ({totalStorageMb} MB)
            </span>
          </div>
          <p className="text-xs text-indigo-200/90 leading-relaxed max-w-2xl">
            Interactive D3 bubble chart where bubble size represents index storage cost (MB) and color intensity represents query read frequency. Bubbles smoothly resize and rearrange when indexes are pruned or updated.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filterMode === 'all' ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}
          >
            All Indexes ({allNodes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('bloated')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filterMode === 'bloated' ? 'bg-rose-600 text-white border-rose-500 shadow-xs' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}
          >
            Bloated &amp; Under-Utilized ({bloatedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('optimal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filterMode === 'optimal' ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}
          >
            Optimal Covering ({optimalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('write_heavy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filterMode === 'write_heavy' ? 'bg-purple-600 text-white border-purple-500 shadow-xs' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}
          >
            Write-Intensive ({writeHeavyCount})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-rose-50/90 rounded-xl border border-rose-200 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Bloated &amp; Under-Utilized</span>
            </span>
            <span className="text-[10px] text-rose-800 block">Storage &gt;25 MB • Reads &lt;1,800</span>
          </div>
          <span className="font-mono text-xl font-extrabold text-rose-900">{bloatedCount}</span>
        </div>

        <div className="p-4 bg-emerald-50/90 rounded-xl border border-emerald-200 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Optimal Covering Indexes</span>
            </span>
            <span className="text-[10px] text-emerald-800 block">High read frequency • Low waste</span>
          </div>
          <span className="font-mono text-xl font-extrabold text-emerald-900">{optimalCount}</span>
        </div>

        <div className="p-4 bg-purple-50/90 rounded-xl border border-purple-200 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>Write-Intensive Indexes</span>
            </span>
            <span className="text-[10px] text-purple-800 block">High DML update amplification</span>
          </div>
          <span className="font-mono text-xl font-extrabold text-purple-900">{writeHeavyCount}</span>
        </div>
      </div>

      {/* D3 Bubble Chart Container */}
      <div className="relative bg-zinc-950 rounded-2xl p-4 border border-zinc-800 shadow-inner flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-3 left-4 flex items-center gap-2 text-xs font-semibold text-zinc-400">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Bubble size = Storage Cost (MB) • Color Intensity = Read Activity Frequency</span>
        </div>

        <svg ref={svgRef} className="w-full h-auto max-h-[480px] mt-6" />

        {/* Hover Tooltip Box */}
        {hoveredNode && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none p-3 bg-zinc-900/95 text-white rounded-xl border border-zinc-700 shadow-2xl text-xs space-y-1 max-w-xs backdrop-blur-md"
            style={{ left: Math.min(tooltipPos.x, 600), top: Math.max(tooltipPos.y, 10) }}
          >
            <div className="font-bold text-cyan-300 flex items-center justify-between gap-2">
              <span>{hoveredNode.indexName}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {hoveredNode.tableName}
              </span>
            </div>
            <div className="text-[11px] text-zinc-300 grid grid-cols-2 gap-x-3 pt-1 border-t border-zinc-800 font-mono">
              <div>Storage: <span className="text-amber-400 font-bold">{hoveredNode.sizeMb} MB</span></div>
              <div>Reads: <span className="text-emerald-400 font-bold">{hoveredNode.readCount.toLocaleString()}</span></div>
              <div>Writes: <span className="text-purple-400 font-bold">{hoveredNode.writeCount.toLocaleString()}</span></div>
              <div>Type: <span className="text-blue-400 font-bold">{hoveredNode.type}</span></div>
            </div>
            <p className="text-[10px] text-zinc-400 pt-1 leading-relaxed border-t border-zinc-800">
              {hoveredNode.recommendation}
            </p>
          </div>
        )}
      </div>

      {/* Selected Index Inspection & Action Drawer */}
      {selectedBubble && (
        <div className="p-5 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/60 rounded-2xl border border-indigo-200 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-2xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Selected Index Inspection: <span className="font-mono text-indigo-700">{selectedBubble.indexName}</span></h4>
                <span className="text-xs text-zinc-500 font-mono">Table: {selectedBubble.tableName} • Type: {selectedBubble.type}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBubble(null)}
              className="text-xs text-zinc-400 hover:text-zinc-700 font-bold cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-200/50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Storage Footprint</span>
              <p className="text-base font-mono font-extrabold text-zinc-900">{selectedBubble.sizeMb} MB</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Read Frequency</span>
              <p className="text-base font-mono font-extrabold text-emerald-700">{selectedBubble.readCount.toLocaleString()} hits</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Write DML Count</span>
              <p className="text-base font-mono font-extrabold text-purple-700">{selectedBubble.writeCount.toLocaleString()} writes</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Status Assessment</span>
              <p className="text-xs font-bold text-zinc-800 capitalize">{selectedBubble.status.replace(/_/g, ' ')}</p>
            </div>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-indigo-100 text-xs text-zinc-700 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-zinc-900 block mb-0.5">AI Index Advisor Recommendation:</span>
              {selectedBubble.recommendation}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            {onRebuildIndex && (
              <button
                type="button"
                onClick={() => {
                  onRebuildIndex(selectedBubble.indexName);
                  if (onSuccessNotice) onSuccessNotice(`Successfully initiated REINDEX for ${selectedBubble.indexName}`);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rebuild Index (CONCURRENTLY)</span>
              </button>
            )}
            {onDropIndex && selectedBubble.status === 'over_sized_under_utilized' && (
              <button
                type="button"
                onClick={() => {
                  onDropIndex(selectedBubble.indexName, selectedBubble.tableName);
                  if (onSuccessNotice) onSuccessNotice(`Successfully dropped bloated index ${selectedBubble.indexName} (recovered ${selectedBubble.sizeMb} MB)`);
                  setSelectedBubble(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Prune / Drop Index (Recover {selectedBubble.sizeMb} MB)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
