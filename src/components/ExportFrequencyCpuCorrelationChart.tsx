import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { DataTapeEntry, ExportCpuCorrelationPoint } from '../types';
import { ExportHistoryPoint } from '../utils/csvExporter';
import {
  build60MinuteExportCpuTelemetry,
  CorrelationAnalysisResult
} from '../utils/exportCpuTelemetry';
import {
  Activity,
  Cpu,
  TrendingUp,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ExportFrequencyCpuCorrelationChartProps {
  dataTapeEntries?: DataTapeEntry[];
  exportHistory?: ExportHistoryPoint[];
  onTriggerAuditBurst?: () => void;
}

export const ExportFrequencyCpuCorrelationChart: React.FC<
  ExportFrequencyCpuCorrelationChartProps
> = ({ dataTapeEntries = [], exportHistory = [], onTriggerAuditBurst }) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'scatter'>('timeline');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [simulatedBursts, setSimulatedBursts] = useState<
    { timestamp: number; count: number; cpu: number }[]
  >([]);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: ExportCpuCorrelationPoint;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(750);

  // Resize observer to ensure responsive canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute 60-minute telemetry analysis
  const telemetry: CorrelationAnalysisResult = useMemo(() => {
    return build60MinuteExportCpuTelemetry(
      dataTapeEntries,
      exportHistory,
      intervalMinutes,
      simulatedBursts
    );
  }, [dataTapeEntries, exportHistory, intervalMinutes, simulatedBursts]);

  const handleSimulateBurst = () => {
    const now = Date.now();
    // Inject a high-frequency burst in the most recent bucket
    setSimulatedBursts((prev) => [
      ...prev,
      {
        timestamp: now - 60000,
        count: 6,
        cpu: 24.5
      }
    ]);
    if (onTriggerAuditBurst) {
      onTriggerAuditBurst();
    }
  };

  const handleResetSimulation = () => {
    setSimulatedBursts([]);
  };

  // D3 Chart Render
  useEffect(() => {
    if (!svgRef.current || telemetry.points.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerWidth;
    const height = 320;
    const margin = { top: 25, right: 65, bottom: 45, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Define gradients and defs
    const defs = svg.append('defs');

    // CPU Area Gradient
    const cpuGradient = defs
      .append('linearGradient')
      .attr('id', 'cpu-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    cpuGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.35);

    cpuGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.02);

    // Export Frequency Bar Gradient
    const barGradient = defs
      .append('linearGradient')
      .attr('id', 'freq-bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    barGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.85);

    barGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#059669')
      .attr('stop-opacity', 0.45);

    // High frequency highlight bar gradient
    const highFreqGradient = defs
      .append('linearGradient')
      .attr('id', 'high-freq-bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    highFreqGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.85);

    highFreqGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#e11d48')
      .attr('stop-opacity', 0.5);

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ==========================================
    // MODE 1: DUAL-AXIS 60-MINUTE TIMELINE VIEW
    // ==========================================
    if (viewMode === 'timeline') {
      // Scales
      const xScale = d3
        .scaleBand()
        .domain(telemetry.points.map((_, i) => i.toString()))
        .range([0, innerWidth])
        .padding(0.28);

      const maxFrequency = Math.max(
        4.0,
        d3.max(telemetry.points, (p) => p.exportFrequencyOpsPerMin) || 4.0
      );
      const yLeftScale = d3
        .scaleLinear()
        .domain([0, maxFrequency * 1.15])
        .nice()
        .range([innerHeight, 0]);

      const yRightScale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([innerHeight, 0]);

      // Subtle horizontal gridlines for CPU %
      const grid = g
        .append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisRight(yRightScale)
            .tickValues([25, 50, 75])
            .tickSize(innerWidth)
            .tickFormat(() => '')
        );

      grid.select('.domain').remove();
      grid
        .selectAll('line')
        .attr('stroke', '#e4e4e7')
        .attr('stroke-dasharray', '3,3');

      // 50% CPU Contention Threshold Warning Line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yRightScale(50))
        .attr('y2', yRightScale(50))
        .attr('stroke', '#fda4af')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3');

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', yRightScale(50) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#e11d48')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .text('50% CPU Contention Threshold');

      // Bars: Export Frequency
      g.selectAll('.freq-bar')
        .data(telemetry.points)
        .enter()
        .append('rect')
        .attr('class', 'freq-bar')
        .attr('x', (_, i) => xScale(i.toString()) || 0)
        .attr('y', (d) => yLeftScale(d.exportFrequencyOpsPerMin))
        .attr('width', xScale.bandwidth())
        .attr('height', (d) => innerHeight - yLeftScale(d.exportFrequencyOpsPerMin))
        .attr('rx', 3)
        .attr('fill', (d) =>
          d.isHighFrequency ? 'url(#high-freq-bar-gradient)' : 'url(#freq-bar-gradient)'
        )
        .attr('stroke', (d) => (d.isHighFrequency ? '#e11d48' : '#059669'))
        .attr('stroke-width', 0.75)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredPoint({
            point: d,
            x: rect.left + rect.width / 2,
            y: rect.top
          });
        })
        .on('mouseleave', () => setHoveredPoint(null));

      // Area generator for Average System CPU Load
      const cpuAreaGenerator = d3
        .area<ExportCpuCorrelationPoint>()
        .x((_, i) => (xScale(i.toString()) || 0) + xScale.bandwidth() / 2)
        .y0(innerHeight)
        .y1((d) => yRightScale(d.avgCpuLoadPercent))
        .curve(d3.curveMonotoneX);

      // Line generator for Average System CPU Load
      const cpuLineGenerator = d3
        .line<ExportCpuCorrelationPoint>()
        .x((_, i) => (xScale(i.toString()) || 0) + xScale.bandwidth() / 2)
        .y((d) => yRightScale(d.avgCpuLoadPercent))
        .curve(d3.curveMonotoneX);

      // Render CPU Load Area
      g.append('path')
        .datum(telemetry.points)
        .attr('fill', 'url(#cpu-area-gradient)')
        .attr('d', cpuAreaGenerator);

      // Render CPU Load Line
      g.append('path')
        .datum(telemetry.points)
        .attr('fill', 'none')
        .attr('stroke', '#d97706')
        .attr('stroke-width', 2.5)
        .attr('d', cpuLineGenerator);

      // Render CPU Load circular nodes
      g.selectAll('.cpu-node')
        .data(telemetry.points)
        .enter()
        .append('circle')
        .attr('class', 'cpu-node')
        .attr('cx', (_, i) => (xScale(i.toString()) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yRightScale(d.avgCpuLoadPercent))
        .attr('r', 4.5)
        .attr('fill', (d) => (d.avgCpuLoadPercent > 50 ? '#ef4444' : '#f59e0b'))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredPoint({
            point: d,
            x: rect.left + rect.width / 2,
            y: rect.top
          });
        })
        .on('mouseleave', () => setHoveredPoint(null));

      // X-Axis
      const xAxis = d3
        .axisBottom(xScale)
        .tickFormat((idxStr) => {
          const idx = parseInt(idxStr, 10);
          const pt = telemetry.points[idx];
          if (!pt) return '';
          if (idx === 0) return '60m ago';
          if (idx === Math.floor(telemetry.points.length / 2)) return '30m ago';
          if (idx === telemetry.points.length - 1) return 'Now';
          return pt.timeFormatted;
        });

      const xAxisGroup = g
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

      xAxisGroup.select('.domain').attr('stroke', '#d4d4d8');
      xAxisGroup
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#71717a');

      // Left Y-Axis: Export Frequency (ops/min)
      const yLeftAxis = d3.axisLeft(yLeftScale).ticks(5).tickFormat((d) => `${d} op/m`);
      const yLeftGroup = g.append('g').call(yLeftAxis);
      yLeftGroup.select('.domain').attr('stroke', '#10b981');
      yLeftGroup
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#047857')
        .attr('font-weight', '600');

      // Left Y-Axis Label
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 14)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#047857')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text('Audit Export Frequency (ops / min)');

      // Right Y-Axis: Avg System CPU Load (%)
      const yRightAxis = d3
        .axisRight(yRightScale)
        .ticks(5)
        .tickFormat((d) => `${d}%`);
      const yRightGroup = g
        .append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(yRightAxis);

      yRightGroup.select('.domain').attr('stroke', '#f59e0b');
      yRightGroup
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#b45309')
        .attr('font-weight', '600');

      // Right Y-Axis Label
      g.append('text')
        .attr('transform', 'rotate(90)')
        .attr('y', -innerWidth - margin.right + 16)
        .attr('x', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#b45309')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text('Avg System CPU Load (%)');
    }

    // ==========================================
    // MODE 2: DIRECT SCATTER CORRELATION VIEW
    // ==========================================
    if (viewMode === 'scatter') {
      const maxFreq = Math.max(
        4.0,
        d3.max(telemetry.points, (p) => p.exportFrequencyOpsPerMin) || 4.0
      );
      const xScale = d3
        .scaleLinear()
        .domain([0, maxFreq * 1.15])
        .nice()
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([innerHeight, 0]);

      // Gridlines
      const gridX = g
        .append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisBottom(xScale)
            .ticks(5)
            .tickSize(innerHeight)
            .tickFormat(() => '')
        );
      gridX.select('.domain').remove();
      gridX.selectAll('line').attr('stroke', '#f4f4f5');

      const gridY = g
        .append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => '')
        );
      gridY.select('.domain').remove();
      gridY.selectAll('line').attr('stroke', '#f4f4f5');

      // Linear Regression Trendline (y = mx + b)
      const x1 = 0;
      const y1Val = telemetry.intercept;
      const x2 = maxFreq * 1.1;
      const y2Val = telemetry.slope * x2 + telemetry.intercept;

      g.append('line')
        .attr('x1', xScale(x1))
        .attr('y1', yScale(Math.max(0, y1Val)))
        .attr('x2', xScale(x2))
        .attr('y2', yScale(Math.min(100, y2Val)))
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,4');

      // Trendline Label
      g.append('text')
        .attr('x', xScale(x2) - 10)
        .attr('y', yScale(Math.min(95, y2Val)) - 8)
        .attr('text-anchor', 'end')
        .attr('fill', '#1d4ed8')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text(`Regression: CPU = ${telemetry.slope}x + ${telemetry.intercept}% (R² = ${telemetry.rSquared})`);

      // Scatter Points
      g.selectAll('.scatter-point')
        .data(telemetry.points)
        .enter()
        .append('circle')
        .attr('class', 'scatter-point')
        .attr('cx', (d) => xScale(d.exportFrequencyOpsPerMin))
        .attr('cy', (d) => yScale(d.avgCpuLoadPercent))
        .attr('r', (d) => (d.isHighFrequency ? 6.5 : 5))
        .attr('fill', (d) =>
          d.avgCpuLoadPercent > 50
            ? '#ef4444'
            : d.avgCpuLoadPercent > 25
            ? '#f59e0b'
            : '#10b981'
        )
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoveredPoint({
            point: d,
            x: rect.left + rect.width / 2,
            y: rect.top
          });
        })
        .on('mouseleave', () => setHoveredPoint(null));

      // X Axis
      const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${d} ops/m`);
      const xAxisGroup = g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis);
      xAxisGroup.select('.domain').attr('stroke', '#d4d4d8');
      xAxisGroup.selectAll('text').attr('font-size', '10px').attr('fill', '#52525b');

      // X Axis Title
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 35)
        .attr('text-anchor', 'middle')
        .attr('fill', '#3f3f46')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text('Export Frequency (ops / min)');

      // Y Axis
      const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}%`);
      const yAxisGroup = g.append('g').call(yAxis);
      yAxisGroup.select('.domain').attr('stroke', '#d4d4d8');
      yAxisGroup.selectAll('text').attr('font-size', '10px').attr('fill', '#52525b');

      // Y Axis Title
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#3f3f46')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text('Average System CPU Load (%)');
    }
  }, [telemetry, viewMode, containerWidth]);

  return (
    <div
      id="export-frequency-cpu-correlation-card"
      className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs space-y-4 animate-fade-in"
    >
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                  Audit Export Frequency vs. System CPU Responsiveness (Last 60 Minutes)
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    telemetry.pearsonR > 0.7
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : telemetry.pearsonR > 0.4
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  r = {telemetry.pearsonR > 0 ? `+${telemetry.pearsonR}` : telemetry.pearsonR}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Evaluates whether high-frequency audit snapshots and serialization create main-thread contention or latency drag.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Resolution toggle */}
          <div className="inline-flex p-0.5 bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setIntervalMinutes(5)}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                intervalMinutes === 5
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              5m Buckets
            </button>
            <button
              type="button"
              onClick={() => setIntervalMinutes(2)}
              className={`px-2 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                intervalMinutes === 2
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              2m Buckets
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-0.5 bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                viewMode === 'timeline'
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dual-Axis Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('scatter')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                viewMode === 'scatter'
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Correlation Scatter (r)</span>
            </button>
          </div>

          {/* Simulate Burst Button */}
          <button
            id="btn-simulate-audit-burst"
            type="button"
            onClick={handleSimulateBurst}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Inject a simulated rapid audit burst to test CPU elasticity"
          >
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Simulate Burst (+6 ops)</span>
          </button>

          {simulatedBursts.length > 0 && (
            <button
              type="button"
              onClick={handleResetSimulation}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors cursor-pointer"
              title="Reset simulated bursts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Metric 1: Correlation Coefficient */}
        <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2.5">
          <div className="text-[10px] uppercase font-bold text-zinc-400">
            Pearson Correlation (r)
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-base font-bold text-zinc-900">
              {telemetry.pearsonR > 0 ? `+${telemetry.pearsonR}` : telemetry.pearsonR}
            </span>
            <span className="text-[10px] font-medium text-zinc-500">
              (R² = {telemetry.rSquared})
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {telemetry.pearsonR > 0.7
              ? 'Strong coupling between exports & CPU'
              : telemetry.pearsonR > 0.4
              ? 'Moderate CPU responsiveness link'
              : 'Negligible CPU contention link'}
          </p>
        </div>

        {/* Metric 2: Peak Export Cadence */}
        <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2.5">
          <div className="text-[10px] uppercase font-bold text-zinc-400">
            Peak Audit Frequency
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-base font-bold text-emerald-700">
              {telemetry.peakExportFrequency}
            </span>
            <span className="text-[11px] font-medium text-emerald-800">ops / min</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {telemetry.totalExportsIn60m} total operations in 60m
          </p>
        </div>

        {/* Metric 3: Peak Observed CPU Load */}
        <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2.5">
          <div className="text-[10px] uppercase font-bold text-zinc-400">
            Peak System CPU Load
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`font-mono text-base font-bold ${
                telemetry.peakCpuLoad > 60
                  ? 'text-rose-600'
                  : telemetry.peakCpuLoad > 35
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}
            >
              {telemetry.peakCpuLoad}%
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              (avg: {telemetry.averageCpuLoad}%)
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Baseline idle CPU: {telemetry.baselineCpuLoad}%
          </p>
        </div>

        {/* Metric 4: Serialization Overhead Delta */}
        <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-2.5">
          <div className="text-[10px] uppercase font-bold text-zinc-400">
            Audit CPU Overhead Delta
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-base font-bold text-indigo-700">
              +{telemetry.cpuOverheadDelta}%
            </span>
            <span className="text-[10px] font-medium text-indigo-900">above idle</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Remaining headroom: {(100 - telemetry.peakCpuLoad).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Main D3 Chart Canvas */}
      <div ref={containerRef} className="relative w-full min-h-[320px]">
        <svg ref={svgRef} className="w-full h-full overflow-visible" />

        {/* Interactive Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="fixed z-50 pointer-events-none bg-zinc-900 text-white rounded-lg p-3 shadow-2xl border border-zinc-700 text-xs max-w-xs transition-all duration-75"
            style={{
              left: Math.min(hoveredPoint.x + 15, window.innerWidth - 280),
              top: Math.max(20, hoveredPoint.y - 120)
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5 mb-1.5">
              <span className="font-bold text-zinc-200">
                Window: {hoveredPoint.point.timeFormatted} ({hoveredPoint.point.minutesAgo}m ago)
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  hoveredPoint.point.responsivenessImpact === 'elevated'
                    ? 'bg-rose-900/80 text-rose-300'
                    : hoveredPoint.point.responsivenessImpact === 'moderate'
                    ? 'bg-amber-900/80 text-amber-300'
                    : 'bg-emerald-900/80 text-emerald-300'
                }`}
              >
                {hoveredPoint.point.responsivenessImpact.toUpperCase()} IMPACT
              </span>
            </div>

            <div className="space-y-1.5 my-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Export Frequency:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {hoveredPoint.point.exportFrequencyOpsPerMin} ops/min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Exports in Window:</span>
                <span className="font-mono text-zinc-200">
                  {hoveredPoint.point.exportCount} ops ({hoveredPoint.point.csvExportCount} CSV, {hoveredPoint.point.jsonExportCount} JSON)
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-1">
                <span className="text-zinc-400">Avg System CPU Load:</span>
                <span
                  className={`font-mono font-bold ${
                    hoveredPoint.point.avgCpuLoadPercent > 50
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {hoveredPoint.point.avgCpuLoadPercent}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Peak Burst CPU:</span>
                <span className="font-mono">{hoveredPoint.point.peakCpuPercent}%</span>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-1 mt-1.5 text-[10px] text-zinc-400 flex items-center justify-between">
              <span>Throughput: ~{(hoveredPoint.point.totalBytes / 1024).toFixed(0)} KB serialized</span>
              <span>Baseline: {hoveredPoint.point.baselineCpuPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Responsiveness Impact Verdict & Architectural Guidance */}
      <div
        className={`rounded-xl p-3.5 border flex items-start gap-3 text-xs ${
          telemetry.verdict.status === 'contention'
            ? 'bg-rose-50/70 border-rose-200 text-rose-950'
            : telemetry.verdict.status === 'moderate'
            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {telemetry.verdict.status === 'contention' ? (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          ) : telemetry.verdict.status === 'moderate' ? (
            <Info className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{telemetry.verdict.title}</span>
            <span className="font-mono text-[10px] text-zinc-500">
              (Slope: +{telemetry.slope}% CPU per 1 op/min increase)
            </span>
          </div>
          <p className="text-zinc-700 leading-relaxed">
            {telemetry.verdict.description}
          </p>
          <div className="pt-1 text-[11px] text-zinc-600 flex items-center gap-1.5 font-medium">
            <span className="font-bold text-zinc-800">Architectural Recommendation:</span>
            <span>{telemetry.verdict.recommendation}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
