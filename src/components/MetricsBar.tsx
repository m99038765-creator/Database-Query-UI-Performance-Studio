import React from 'react';
import { QueryExecutionResult, OptimizationFlags } from '../types';
import { Clock, Database, Layers, Monitor, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

interface MetricsBarProps {
  queryResult: QueryExecutionResult;
  flags: OptimizationFlags;
  currentFps: number;
  renderedDomCount: number;
  totalDatabaseRecords?: number;
  onOpenBulkImport?: () => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  queryResult,
  flags,
  currentFps,
  renderedDomCount,
  totalDatabaseRecords = 50000,
  onOpenBulkImport
}) => {
  const isQueryFast = queryResult.executionTimeMs < 15;
  const isFpsGood = currentFps >= 50;
  const isDomHealthy = renderedDomCount < 100;
  const isPoolHealthy = !queryResult.simulatedError;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Query Execution Latency */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            Query Latency
          </span>
          {queryResult.cacheHit && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
              CACHE HIT
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isQueryFast ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {queryResult.executionTimeMs.toFixed(1)}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">ms</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
          {flags.btreeIndexing ? (
            <span className="text-emerald-700 font-medium">B-Tree Index Active</span>
          ) : (
            <span className="text-rose-600 font-medium">Full Table Scan (Slow)</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isQueryFast ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 2. Rows Scanned */}
      <div
        id="metric-card-rows-scanned"
        className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden transition-all ${
          onOpenBulkImport ? 'cursor-pointer hover:border-blue-300 group' : ''
        }`}
        onClick={onOpenBulkImport}
        title={onOpenBulkImport ? "Click to open Bulk Data Import Simulator" : undefined}
      >
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-600 transition-colors" />
            Rows Scanned
          </span>
          {totalDatabaseRecords > 50000 && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
              +{((totalDatabaseRecords - 50000) / 1000).toFixed(0)}k Ingested
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              queryResult.rowsScanned < 1000 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {queryResult.rowsScanned.toLocaleString()}
          </span>
          <span className="text-xs text-zinc-400">/ {totalDatabaseRecords.toLocaleString()} total</span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
          {queryResult.rowsScanned < 1000 ? (
            <span className="text-emerald-700 font-medium">Exact B-Tree seek</span>
          ) : (
            <span className="text-amber-600 font-medium">Inspected 100% of records</span>
          )}
          {onOpenBulkImport && (
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Ingest &rarr;
            </span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            queryResult.rowsScanned < 1000 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* 3. UI Frame Rate (FPS) */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-zinc-400" />
            UI Frame Rate
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isFpsGood
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800 animate-pulse'
            }`}
          >
            {isFpsGood ? 'SMOOTH' : 'LAGGING'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isFpsGood ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {currentFps}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">FPS</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {flags.virtualizedDOM ? (
            <span className="text-emerald-700 font-medium">Virtual Windowing ON</span>
          ) : (
            <span className="text-rose-600 font-medium">DOM Overload (Stuttering)</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isFpsGood ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 4. Active DOM Nodes in Viewport */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            Active DOM Nodes
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isDomHealthy ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {renderedDomCount.toLocaleString()}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">elements</span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">
          {isDomHealthy ? (
            <span className="text-emerald-700 font-medium">Ultra-low memory footprint</span>
          ) : (
            <span className="text-rose-600 font-medium">Heavy layout recalculations</span>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isDomHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>

      {/* 5. Database Connection Pool Status */}
      <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-zinc-200 p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-zinc-400" />
            DB Connections
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tracking-tight ${
              isPoolHealthy ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {queryResult.activeQueriesCount}
            <span className="text-xs font-normal text-zinc-500 ml-1">
              / 25 pooled
            </span>
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
          {isPoolHealthy ? (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Batched Eager Query</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span className="text-rose-600 font-medium">N+1 Cascade Timeout!</span>
            </>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${
            isPoolHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </div>
    </div>
  );
};
