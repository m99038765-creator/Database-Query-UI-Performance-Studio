import React, { useState, useMemo } from 'react';
import {
  SerializationLogEntry,
  SerializationLogSeverity,
  SerializationAnomalyType,
  SerializationLogFormat
} from '../types';
import { ExportFormat } from '../utils/csvExporter';
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  TrendingDown,
  Cpu,
  Zap,
  Trash2,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Database,
  X
} from 'lucide-react';

interface SerializationErrorLogPanelProps {
  logs: SerializationLogEntry[];
  onClearLogs: () => void;
  onDismissLog: (id: string) => void;
  onSimulateFault: (mode: 'failure' | 'throughput_anomaly' | 'cpu_spike' | 'latency_anomaly') => void;
  currentFormat: ExportFormat;
  currentRecordCount: number;
}

export const SerializationErrorLogPanel: React.FC<SerializationErrorLogPanelProps> = ({
  logs,
  onClearLogs,
  onDismissLog,
  onSimulateFault,
  currentFormat,
  currentRecordCount
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [severityFilter, setSeverityFilter] = useState<SerializationLogSeverity | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'csv' | 'json' | 'engine'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      const matchesFormat =
        formatFilter === 'all' ||
        (formatFilter === 'engine'
          ? log.format === 'engine' || log.format === 'query'
          : log.format === formatFilter);
      return matchesSeverity && matchesFormat;
    });
  }, [logs, severityFilter, formatFilter]);

  // Aggregate count by severity
  const counts = useMemo(() => {
    const errorCount = logs.filter((l) => l.severity === 'error').length;
    const anomalyCount = logs.filter((l) => l.severity === 'anomaly').length;
    const warningCount = logs.filter((l) => l.severity === 'warning').length;
    const latencyAnomaliesCount = logs.filter(
      (l) => l.type === 'LATENCY_ANOMALY' || l.type === 'LATENCY_SPIKE'
    ).length;
    return {
      total: logs.length,
      errors: errorCount,
      anomalies: anomalyCount,
      warnings: warningCount,
      latencyAnomalies: latencyAnomaliesCount
    };
  }, [logs]);

  const toggleExpandLog = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getSeverityIcon = (log: SerializationLogEntry) => {
    if (log.type === 'LATENCY_ANOMALY' || log.type === 'LATENCY_SPIKE') {
      return <Zap className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    switch (log.severity) {
      case 'error':
        return <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'anomaly':
        return <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />;
    }
  };

  const getSeverityBadgeClass = (severity: SerializationLogSeverity) => {
    switch (severity) {
      case 'error':
        return 'bg-rose-100 text-rose-900 border-rose-200';
      case 'anomaly':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'warning':
        return 'bg-orange-100 text-orange-900 border-orange-200';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  return (
    <div
      id="serialization-error-log-panel"
      className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden transition-all duration-200"
    >
      {/* Panel Header & Toggle Bar */}
      <div className="p-3 sm:px-4 bg-zinc-50/90 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <button
            id="btn-toggle-serialization-log-expand"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
            aria-label={isExpanded ? 'Collapse error log panel' : 'Expand error log panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 text-white shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-zinc-900">
                  Serialization Errors &amp; Latency Anomalies
                </span>
                {counts.errors > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {counts.errors} {counts.errors === 1 ? 'Error' : 'Errors'}
                  </span>
                ) : counts.anomalies > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {counts.anomalies} {counts.anomalies === 1 ? 'Anomaly' : 'Anomalies'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Normal Baselines
                  </span>
                )}
                {counts.latencyAnomalies > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    {counts.latencyAnomalies} Latency Anomaly{counts.latencyAnomalies === 1 ? '' : 'ies'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 hidden sm:block">
                Captures latency anomalies from threshold breaches, serialization exceptions, and throughput degradations
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0 flex-wrap">
          {/* Quick simulation buttons */}
          <div className="relative inline-flex items-center gap-1 flex-wrap">
            <button
              id="btn-simulate-latency-anomaly"
              type="button"
              onClick={() => onSimulateFault('latency_anomaly')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
              title="Simulate a database query latency spike anomaly"
            >
              <Zap className="w-3 h-3 text-indigo-600" />
              <span>Simulate Latency Spike</span>
            </button>
            <button
              id="btn-simulate-throughput-anomaly"
              type="button"
              onClick={() => onSimulateFault('throughput_anomaly')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Simulate a severe throughput degradation anomaly"
            >
              <TrendingDown className="w-3 h-3 text-amber-600" />
              <span>Simulate Anomaly</span>
            </button>
            <button
              id="btn-simulate-serialization-failure"
              type="button"
              onClick={() => onSimulateFault('failure')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
              title="Simulate a fatal serialization stream exception"
            >
              <AlertOctagon className="w-3 h-3 text-rose-600" />
              <span>Simulate Failure</span>
            </button>
          </div>

          {logs.length > 0 && (
            <button
              id="btn-clear-serialization-logs"
              type="button"
              onClick={onClearLogs}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer"
              title="Clear all logged events"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3">
          {/* Filter Bar & Metric Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
            {/* Severity Filter Tabs */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSeverityFilter('all')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  severityFilter === 'all'
                    ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('error')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  severityFilter === 'error'
                    ? 'bg-white text-rose-900 font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-rose-700'
                }`}
              >
                Errors ({counts.errors})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('anomaly')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  severityFilter === 'anomaly'
                    ? 'bg-white text-amber-900 font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-amber-700'
                }`}
              >
                Anomalies ({counts.anomalies})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('warning')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  severityFilter === 'warning'
                    ? 'bg-white text-orange-900 font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-orange-700'
                }`}
              >
                Warnings ({counts.warnings})
              </button>
            </div>

            {/* Format Filter */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-zinc-400 font-medium">Format / Engine:</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100">
                <button
                  type="button"
                  onClick={() => setFormatFilter('all')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    formatFilter === 'all'
                      ? 'bg-white text-zinc-900 font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFormatFilter('csv')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    formatFilter === 'csv'
                      ? 'bg-white text-emerald-800 font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setFormatFilter('json')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    formatFilter === 'json'
                      ? 'bg-white text-amber-800 font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setFormatFilter('engine')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer ${
                    formatFilter === 'engine'
                      ? 'bg-white text-indigo-800 font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Engine
                </button>
              </div>
            </div>
          </div>

          {/* Log Entries Stream List */}
          {filteredLogs.length === 0 ? (
            <div className="py-8 px-4 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-zinc-800">
                {logs.length === 0
                  ? 'No serialization failures or latency anomalies detected'
                  : 'No logs match the current filter criteria'}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                Telemetry is actively monitoring query runtimes, anomaly thresholds, and output serialization streams.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredLogs.map((log) => {
                const isDetailOpen = expandedLogId === log.id;
                const isCsv = log.format === 'csv';
                const isJson = log.format === 'json';
                const isEngine = log.format === 'engine' || log.format === 'query';
                const isLatencyAnomaly =
                  log.type === 'LATENCY_ANOMALY' || log.type === 'LATENCY_SPIKE';

                return (
                  <div
                    key={log.id}
                    id={`serialization-log-entry-${log.id}`}
                    className={`rounded-lg border p-2.5 transition-all ${
                      log.severity === 'error'
                        ? 'bg-rose-50/40 border-rose-200'
                        : isLatencyAnomaly
                        ? 'bg-indigo-50/30 border-indigo-200'
                        : log.severity === 'anomaly'
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-orange-50/30 border-orange-200'
                    }`}
                  >
                    {/* Log Row Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="mt-0.5">{getSeverityIcon(log)}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${getSeverityBadgeClass(
                                log.severity
                              )}`}
                            >
                              {log.severity}
                            </span>

                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                isLatencyAnomaly
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : 'bg-white text-zinc-700 border-zinc-200'
                              }`}
                            >
                              {log.type.replace(/_/g, ' ')}
                            </span>

                            <span
                              className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                                isCsv
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isJson
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {isCsv ? (
                                <FileSpreadsheet className="w-2.5 h-2.5" />
                              ) : isJson ? (
                                <FileCode className="w-2.5 h-2.5" />
                              ) : (
                                <Database className="w-2.5 h-2.5" />
                              )}
                              <span>
                                {isCsv
                                  ? 'CSV (RFC 4180)'
                                  : isJson
                                  ? 'JSON (RFC 8259)'
                                  : 'SQL Engine'}
                              </span>
                            </span>

                            <span className="text-[10px] text-zinc-500 font-mono">
                              {log.recordCount} rows
                            </span>

                            <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                              {log.timeFormatted}
                            </span>
                          </div>

                          {/* Message Body */}
                          <p className="text-xs font-semibold text-zinc-900 mt-1 leading-snug">
                            {log.message}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandLog(log.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                        >
                          {isDetailOpen ? 'Hide Details' : 'Details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissLog(log.id)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                          title="Dismiss log entry"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Detailed Diagnostics Dropdown */}
                    {isDetailOpen && log.details && (
                      <div className="mt-2 pt-2 border-t border-zinc-200/70 text-[11px] space-y-1.5 animate-fade-in bg-white/70 p-2 rounded-md">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
                          {log.details.durationMs !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Latency
                              </span>
                              <span className="font-bold text-zinc-800">
                                {log.details.durationMs.toFixed(1)} ms
                              </span>
                            </div>
                          )}
                          {log.details.baselineDurationMs !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Baseline
                              </span>
                              <span className="font-medium text-zinc-600">
                                {log.details.baselineDurationMs.toFixed(1)} ms
                              </span>
                            </div>
                          )}
                          {log.details.varianceMs !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Variance
                              </span>
                              <span className="font-bold text-rose-600">
                                +{log.details.varianceMs.toFixed(1)} ms
                              </span>
                            </div>
                          )}
                          {log.details.anomalyThresholdMs !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Threshold
                              </span>
                              <span className="font-medium text-zinc-700">
                                +{log.details.anomalyThresholdMs} ms
                              </span>
                            </div>
                          )}
                          {log.details.throughputRowsPerSec !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Throughput
                              </span>
                              <span className="font-bold text-zinc-800">
                                {log.details.throughputRowsPerSec.toLocaleString()} rows/s
                              </span>
                            </div>
                          )}
                          {log.details.cpuUsagePercent !== undefined && (
                            <div className="bg-zinc-50 p-1.5 rounded border border-zinc-200">
                              <span className="text-zinc-400 block text-[9px] uppercase">
                                Host CPU
                              </span>
                              <span className="font-bold text-zinc-800">
                                {log.details.cpuUsagePercent}%
                              </span>
                            </div>
                          )}
                        </div>

                        {log.details.cause && (
                          <div className="text-zinc-700">
                            <span className="font-bold text-zinc-900">Diagnosis: </span>
                            <span>{log.details.cause}</span>
                          </div>
                        )}

                        {log.details.triggerSource && (
                          <div className="text-zinc-500 text-[10px]">
                            <span className="font-medium">Trigger Source: </span>
                            <span>{log.details.triggerSource}</span>
                          </div>
                        )}

                        {log.details.stackTrace && (
                          <div className="mt-1">
                            <div className="text-[10px] font-bold text-rose-800 mb-0.5">
                              Stack Trace:
                            </div>
                            <pre className="p-1.5 bg-zinc-900 text-rose-300 font-mono text-[9px] rounded overflow-x-auto leading-relaxed">
                              {log.details.stackTrace}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Telemetry Status Line */}
          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Telemetry • Real-time Anomaly Thresholds &amp; Serialization Stream Monitor
            </span>
            <span>Target: Table &amp; Performance Trends</span>
          </div>
        </div>
      )}
    </div>
  );
};

