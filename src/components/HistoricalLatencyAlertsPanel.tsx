import React, { useState } from 'react';
import { ShieldAlert, Clock, Database, Search, Filter, AlertTriangle, Download, CheckCircle, ArrowUpDown } from 'lucide-react';
import { QueryExecutionResult } from '../types';

export interface LatencyAlertLogEntry {
  id: string;
  timestamp: string;
  queryContext: string;
  latencyMs: number;
  rowsScanned: number;
  severity: 'warning' | 'critical';
  optimizerState: string;
}

interface HistoricalLatencyAlertsPanelProps {
  alerts?: LatencyAlertLogEntry[];
  onClearAlerts?: () => void;
}

const DEFAULT_MOCK_ALERTS: LatencyAlertLogEntry[] = [
  {
    id: 'alt-1',
    timestamp: '2026-09-27 21:14:02',
    queryContext: 'SELECT * FROM transactions WHERE category = "Enterprise License" [N+1 Cascade]',
    latencyMs: 198.4,
    rowsScanned: 50000,
    severity: 'critical',
    optimizerState: 'Unoptimized (N+1 Active)'
  },
  {
    id: 'alt-2',
    timestamp: '2026-09-27 21:08:45',
    queryContext: 'SELECT * FROM transactions WHERE status = "failed" [Full Table Scan]',
    latencyMs: 165.2,
    rowsScanned: 48200,
    severity: 'critical',
    optimizerState: 'No B-Tree Index'
  },
  {
    id: 'alt-3',
    timestamp: '2026-09-27 20:55:12',
    queryContext: 'SELECT * FROM transactions WHERE amount > 5000 [Bulk Join Scan]',
    latencyMs: 124.7,
    rowsScanned: 15400,
    severity: 'warning',
    optimizerState: 'Unoptimized'
  },
  {
    id: 'alt-4',
    timestamp: '2026-09-27 20:41:30',
    queryContext: 'SELECT * FROM transactions WHERE customer LIKE "%Global%" [Unindexed Scan]',
    latencyMs: 182.1,
    rowsScanned: 50000,
    severity: 'critical',
    optimizerState: 'Unoptimized (N+1 Active)'
  },
  {
    id: 'alt-5',
    timestamp: '2026-09-27 20:22.08',
    queryContext: 'SELECT * FROM transactions WHERE status = "flagged" [Scan Without Cache]',
    latencyMs: 115.3,
    rowsScanned: 8900,
    severity: 'warning',
    optimizerState: 'Cache Miss'
  }
];

export const HistoricalLatencyAlertsPanel: React.FC<HistoricalLatencyAlertsPanelProps> = ({
  alerts = DEFAULT_MOCK_ALERTS,
  onClearAlerts
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'warning' | 'critical'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const filteredAlerts = alerts
    .filter((alt) => {
      if (severityFilter !== 'all' && alt.severity !== severityFilter) return false;
      if (searchTerm && !alt.queryContext.toLowerCase().includes(searchTerm.toLowerCase()) && !alt.timestamp.includes(searchTerm)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.latencyMs - a.latencyMs;
      }
      return a.latencyMs - b.latencyMs;
    });

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Query Context', 'Latency (ms)', 'Rows Scanned', 'Severity', 'Optimizer State'];
    const rows = filteredAlerts.map((a) => [a.id, a.timestamp, `"${a.queryContext}"`, a.latencyMs, a.rowsScanned, a.severity, `"${a.optimizerState}"`]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historical_latency_alerts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-4 border-b border-zinc-200 bg-gradient-to-r from-rose-50/80 via-white to-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Historical Latency Alerts Log</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                {alerts.length} Violations
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              Audit trail of threshold breaches, query execution contexts, and peak latency durations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Export alerts log as CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>
          {onClearAlerts && (
            <button
              type="button"
              onClick={onClearAlerts}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-3 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search query context or timestamp..."
            className="w-full pl-8 pr-3 py-1 bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical (&gt;150ms)</option>
              <option value="warning">Warning (100-150ms)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-medium">Sort Latency:</span>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-zinc-300 rounded-md text-zinc-700 hover:bg-zinc-50 cursor-pointer font-medium"
            >
              <ArrowUpDown className="w-3 h-3 text-zinc-500" />
              <span>{sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100/70 text-zinc-600 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-200">
              <th className="py-2.5 px-4 font-semibold">Severity / ID</th>
              <th className="py-2.5 px-4 font-semibold">Timestamp</th>
              <th className="py-2.5 px-4 font-semibold">Query Execution Context</th>
              <th className="py-2.5 px-4 font-semibold text-right">Latency Duration</th>
              <th className="py-2.5 px-4 font-semibold text-right">Rows Scanned</th>
              <th className="py-2.5 px-4 font-semibold">Optimizer State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 font-mono text-zinc-700">
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400 font-sans">
                  No historical latency alerts match the selected filters.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alt) => {
                const isCritical = alt.severity === 'critical' || alt.latencyMs > 150;
                return (
                  <tr key={alt.id} className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-3 px-4 font-medium">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCritical
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        <AlertTriangle className={`w-3 h-3 ${isCritical ? 'text-rose-600' : 'text-amber-600'}`} />
                        <span>{alt.severity.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-[11px] whitespace-nowrap">
                      {alt.timestamp}
                    </td>
                    <td className="py-3 px-4 font-sans text-zinc-900 font-medium max-w-md truncate" title={alt.queryContext}>
                      {alt.queryContext}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      <span className={`px-2 py-0.5 rounded ${isCritical ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}`}>
                        {alt.latencyMs.toFixed(1)} ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-600">
                      {alt.rowsScanned.toLocaleString()} rows
                    </td>
                    <td className="py-3 px-4 text-zinc-600 text-[11px]">
                      {alt.optimizerState}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500 font-sans">
        <span>Showing {filteredAlerts.length} of {alerts.length} historical threshold violations</span>
        <span className="flex items-center gap-1 text-emerald-700 font-medium">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Automated Alerting Engine Active</span>
        </span>
      </div>
    </div>
  );
};
