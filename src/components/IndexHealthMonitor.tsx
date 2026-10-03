import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, RefreshCw, AlertTriangle, Zap, CheckCircle2, Flame, TrendingDown, Layers, Database, Sparkles, Sliders, ArrowUpRight, BarChart2 } from 'lucide-react';

interface IndexHealthMonitorProps {
  tables: any[];
  onRebuildIndex?: (indexName: string) => void;
  onDropIndex?: (indexName: string, tableName: string) => void;
  onSuccessNotice?: (message: string) => void;
}

export interface HealthMonitorItem {
  indexName: string;
  tableName: string;
  type: string;
  healthScore: number;
  readCount: number;
  writeCount: number;
  writeAmplificationRatio: number; // writes vs reads multiplier
  bloatMb: number;
  scanEfficiency: number; // percentage
  status: 'optimal' | 'underperforming' | 'write_amplified' | 'critical';
  recommendation: string;
}

export const IndexHealthMonitor: React.FC<IndexHealthMonitorProps> = ({
  tables,
  onRebuildIndex,
  onDropIndex,
  onSuccessNotice
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<string>(new Date().toLocaleTimeString());
  const [autoSimulationActive, setAutoSimulationActive] = useState<boolean>(true);
  const [scanCycleCount, setScanCycleCount] = useState<number>(14);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'underperforming' | 'write_amplified' | 'critical'>('all');
  const [optimizingIndexName, setOptimizingIndexName] = useState<string | null>(null);

  // Generate simulated health metrics across tables
  const monitoredIndexes: HealthMonitorItem[] = [];

  tables.forEach((tbl) => {
    tbl.indexes?.forEach((idx: any, idxIdx: number) => {
      const hash = (idx.name + tbl.name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const readCount = 1200 + (hash % 8500);
      const writeCount = 450 + ((hash * 3) % 4000);
      const writeAmplificationRatio = +(writeCount / Math.max(1, readCount)).toFixed(2);
      const bloatMb = +(6.5 + ((hash % 19) * 1.8)).toFixed(1);
      const scanEfficiency = 40 + (hash % 58); // percentage

      let healthScore = Math.round((scanEfficiency * 0.6) + (Math.max(0, 100 - writeAmplificationRatio * 30) * 0.4));
      if (idx.active === false) healthScore = 20;

      let status: 'optimal' | 'underperforming' | 'write_amplified' | 'critical' = 'optimal';
      let recommendation = 'Index operating within optimal efficiency thresholds.';

      if (healthScore < 50 || idx.active === false) {
        status = 'critical';
        recommendation = 'Critical degradation or inactive status. Immediate rebuild or removal required to prevent full table scan fallbacks.';
      } else if (writeAmplificationRatio > 1.8) {
        status = 'write_amplified';
        recommendation = 'Excessive write amplification detected. Frequent DML operations are updating index pages without sufficient read utility; consider pruning or dropping.';
      } else if (scanEfficiency < 65 || healthScore < 75) {
        status = 'underperforming';
        recommendation = 'Sub-optimal scan efficiency and fragmentation. Trigger VACUUM/REINDEX to reclaim bloat and improve B-Tree depth.';
      }

      monitoredIndexes.push({
        indexName: idx.name,
        tableName: tbl.name,
        type: idx.type,
        healthScore,
        readCount,
        writeCount,
        writeAmplificationRatio,
        bloatMb,
        scanEfficiency,
        status,
        recommendation
      });
    });
  });

  // Periodic simulation heartbeat
  useEffect(() => {
    if (!autoSimulationActive) return;
    const interval = setInterval(() => {
      setScanCycleCount(prev => prev + 1);
      setLastScanTimestamp(new Date().toLocaleTimeString());
    }, 6000);
    return () => clearInterval(interval);
  }, [autoSimulationActive]);

  const handleRunManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanCycleCount(prev => prev + 1);
      setLastScanTimestamp(new Date().toLocaleTimeString());
      if (onSuccessNotice) {
        onSuccessNotice(`🔍 [Index Health Monitor] Lightweight simulation completed. Scanned ${monitoredIndexes.length} indexes. Updated write amplification and bloat metrics.`);
      }
    }, 800);
  };

  const filteredIndexes = monitoredIndexes.filter(item => {
    if (filterSeverity === 'all') return true;
    return item.status === filterSeverity;
  });

  const criticalCount = monitoredIndexes.filter(i => i.status === 'critical').length;
  const writeAmplifiedCount = monitoredIndexes.filter(i => i.status === 'write_amplified').length;
  const underperformingCount = monitoredIndexes.filter(i => i.status === 'underperforming').length;
  const optimalCount = monitoredIndexes.filter(i => i.status === 'optimal').length;

  const avgHealth = Math.round(monitoredIndexes.reduce((acc, i) => acc + i.healthScore, 0) / Math.max(1, monitoredIndexes.length));

  return (
    <div className="p-6 space-y-6 bg-white rounded-2xl border border-zinc-200 shadow-xs max-h-[78vh] overflow-y-auto">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-indigo-950 via-purple-950 to-indigo-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="text-base font-extrabold tracking-tight">Index Health Monitor &amp; Write Amplification Tracker</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live Simulation Active
            </span>
          </div>
          <p className="text-xs text-indigo-200 leading-relaxed max-w-2xl">
            Continuously runs lightweight background telemetry simulations across all table B-Tree and hash indexes. Automatically flags underperforming indexes, fragmented bloat, and excessive write amplification penalties.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setAutoSimulationActive(!autoSimulationActive)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs ${
              autoSimulationActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
            title="Toggle periodic lightweight background health simulation"
          >
            <Activity className={`w-3.5 h-3.5 ${autoSimulationActive ? 'animate-pulse text-emerald-200' : ''}`} />
            <span>{autoSimulationActive ? 'Live Simulator: ON' : 'Live Simulator: OFF'}</span>
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={handleRunManualScan}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
            title="Run immediate health simulation scan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Run Health Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Overall Health Score</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-mono font-extrabold ${avgHealth >= 80 ? 'text-emerald-700' : avgHealth >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
              {avgHealth} / 100
            </span>
            <span className="text-[10px] font-bold text-zinc-500 uppercase">{avgHealth >= 80 ? 'Grade A' : avgHealth >= 60 ? 'Grade B' : 'Grade C'}</span>
          </div>
          <span className="text-[10px] text-zinc-400 block">Cycle #{scanCycleCount} • Last: {lastScanTimestamp}</span>
        </div>

        <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Optimal Indexes</span>
          </span>
          <span className="text-xl font-mono font-extrabold text-emerald-900">{optimalCount}</span>
          <span className="text-[10px] text-emerald-700 block">Zero amplification &gt; 90% efficiency</span>
        </div>

        <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1">
          <span className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
            <span>Underperforming</span>
          </span>
          <span className="text-xl font-mono font-extrabold text-amber-950">{underperformingCount}</span>
          <span className="text-[10px] text-amber-800 block">Scan efficiency &lt; 65%</span>
        </div>

        <div className="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 space-y-1">
          <span className="text-[11px] font-semibold text-purple-950 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-purple-600" />
            <span>Write Amplified</span>
          </span>
          <span className="text-xl font-mono font-extrabold text-purple-950">{writeAmplifiedCount}</span>
          <span className="text-[10px] text-purple-800 block">High write-to-read ratio (&gt;1.8x)</span>
        </div>

        <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-rose-900 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Critical / Inactive</span>
          </span>
          <span className="text-xl font-mono font-extrabold text-rose-950">{criticalCount}</span>
          <span className="text-[10px] text-rose-800 block">Requires rebuild or prune</span>
        </div>
      </div>

      {/* Filter and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
          <span className="text-zinc-500 mr-1">Filter Status:</span>
          {(['all', 'underperforming', 'write_amplified', 'critical'] as const).map(sev => (
            <button
              key={sev}
              type="button"
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer capitalize ${
                filterSeverity === sev
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
              }`}
            >
              {sev.replace('_', ' ')} ({sev === 'all' ? monitoredIndexes.length : monitoredIndexes.filter(i => i.status === sev).length})
            </button>
          ))}
        </div>
      </div>

      {/* Monitored Indexes List */}
      <div className="space-y-3">
        {filteredIndexes.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 text-xs">
            No indexes match the selected filter criteria.
          </div>
        ) : (
          filteredIndexes.map((item) => {
            const isOptimizing = optimizingIndexName === item.indexName;
            return (
              <div
                key={`${item.tableName}-${item.indexName}`}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  item.status === 'critical'
                    ? 'bg-rose-50/50 border-rose-300'
                    : item.status === 'write_amplified'
                    ? 'bg-purple-50/50 border-purple-200'
                    : item.status === 'underperforming'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white border-zinc-200 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${
                      item.status === 'critical' ? 'bg-rose-600 animate-pulse' :
                      item.status === 'write_amplified' ? 'bg-purple-600' :
                      item.status === 'underperforming' ? 'bg-amber-500' : 'bg-emerald-600'
                    }`} />
                    <span className="font-mono font-bold text-xs text-zinc-900">{item.indexName}</span>
                    <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                      Table: {item.tableName} • Type: {item.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      item.status === 'critical' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                      item.status === 'write_amplified' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                      item.status === 'underperforming' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                      'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                      item.healthScore >= 80 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                      item.healthScore >= 60 ? 'bg-amber-100 text-amber-900 border-amber-300' :
                      'bg-rose-100 text-rose-900 border-rose-300'
                    }`}>
                      Health: {item.healthScore}/100
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-white rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 block font-sans">Read Activity</span>
                    <span className="font-bold text-emerald-700">{item.readCount.toLocaleString()} reads</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 block font-sans">Write Activity</span>
                    <span className="font-bold text-rose-700">{item.writeCount.toLocaleString()} writes</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 block font-sans">Write Amplification</span>
                    <span className={`font-bold ${item.writeAmplificationRatio > 1.8 ? 'text-purple-700' : 'text-zinc-800'}`}>
                      {item.writeAmplificationRatio}x ratio
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 block font-sans">Index Bloat &amp; Scan Efficiency</span>
                    <span className="font-bold text-indigo-700">{item.bloatMb} MB • {item.scanEfficiency}% eff</span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-xs text-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><strong>Recommendation:</strong> {item.recommendation}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isOptimizing}
                      onClick={() => {
                        setOptimizingIndexName(item.indexName);
                        setTimeout(() => {
                          setOptimizingIndexName(null);
                          if (onRebuildIndex) onRebuildIndex(item.indexName);
                          if (onSuccessNotice) {
                            onSuccessNotice(`⚡ [Index Rebuilt] Successfully reindexed and defragmented "${item.indexName}". Bloat reclaimed and health restored to 100/100.`);
                          }
                        }, 700);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                    >
                      {isOptimizing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span>{isOptimizing ? 'Rebuilding...' : 'Rebuild / Reindex'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onDropIndex) onDropIndex(item.indexName, item.tableName);
                        if (onSuccessNotice) {
                          onSuccessNotice(`🗑️ [Index Pruned] Removed write-amplified index "${item.indexName}" from table "${item.tableName}". Eliminating background write penalty.`);
                        }
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold rounded text-[10px] shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>Drop / Prune</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
