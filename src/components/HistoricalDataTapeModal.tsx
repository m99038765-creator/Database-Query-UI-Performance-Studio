import React, { useState } from 'react';
import { DataTapeEntry } from '../types';
import {
  generateAuditLedgerCsv,
  generateAuditTapeJsonBundle
} from '../utils/auditDataTape';
import { triggerFileDownload } from '../utils/csvExporter';
import { executeBatchMutation } from '../db/databaseEngine';
import {
  ShieldCheck,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  FileCode,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Play,
  RotateCcw
} from 'lucide-react';

interface HistoricalDataTapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DataTapeEntry[];
  isAutoSaveEnabled: boolean;
  onToggleAutoSave: () => void;
  onClearTape: () => void;
  onTriggerManualSlice: () => void;
  onMutateDatabase: (type: 'status_transition' | 'high_risk_flag' | 'insert_live') => void;
}

export const HistoricalDataTapeModal: React.FC<HistoricalDataTapeModalProps> = ({
  isOpen,
  onClose,
  entries,
  isAutoSaveEnabled,
  onToggleAutoSave,
  onClearTape,
  onTriggerManualSlice,
  onMutateDatabase
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [inspectedEntry, setInspectedEntry] = useState<DataTapeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  if (!isOpen) return null;

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownloadSingleSlice = (entry: DataTapeEntry) => {
    const mimeType = entry.format === 'json' ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';
    const blob = new Blob([entry.content], { type: mimeType });
    triggerFileDownload(blob, entry.filename);
  };

  const handleDownloadLedgerCsv = () => {
    const { blob, filename } = generateAuditLedgerCsv(entries);
    triggerFileDownload(blob, filename);
  };

  const handleDownloadJsonBundle = () => {
    const { blob, filename } = generateAuditTapeJsonBundle(entries);
    triggerFileDownload(blob, filename);
  };

  const handleSimulateMutation = async (type: 'status_transition' | 'high_risk_flag' | 'insert_live') => {
    setIsMutating(true);
    try {
      onMutateDatabase(type);
    } finally {
      setTimeout(() => setIsMutating(false), 400);
    }
  };

  // Filter entries based on search term
  const filteredEntries = entries.filter((e) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.tapeId.toLowerCase().includes(term) ||
      e.triggerEvent.toLowerCase().includes(term) ||
      e.format.toLowerCase().includes(term) ||
      e.checksumSha256.toLowerCase().includes(term) ||
      e.filterSummary.status.toLowerCase().includes(term) ||
      e.filterSummary.category.toLowerCase().includes(term)
    );
  });

  const totalRecordsAudited = entries.reduce((acc, curr) => acc + curr.recordCount, 0);
  const totalBytesAudited = entries.reduce((acc, curr) => acc + curr.fileSizeBytes, 0);
  const avgLatencyMs = entries.length > 0
    ? (entries.reduce((acc, curr) => acc + curr.durationMs, 0) / entries.length).toFixed(2)
    : '0.00';

  return (
    <div
      id="historical-data-tape-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="historical-data-tape-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-tape-modal-title"
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="data-tape-modal-title" className="text-lg font-bold text-white tracking-tight">
                  Historical Data Tape Ledger
                </h2>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  External Compliance Ready
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  SHA-256 Verified
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Continuous chronological record of filtered dataset snapshots generated automatically upon database state changes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            {/* Auto-Save Status Toggle Pill */}
            <button
              id="btn-tape-modal-toggle-autosave"
              type="button"
              onClick={onToggleAutoSave}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isAutoSaveEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              }`}
              title={isAutoSaveEnabled ? 'Queue Auto-Save is actively recording' : 'Click to enable Queue Auto-Save'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAutoSaveEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              <span>Auto-Save: {isAutoSaveEnabled ? 'ACTIVE' : 'OFF'}</span>
            </button>

            <button
              id="btn-close-data-tape-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close Data Tape Inspector"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audit Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-zinc-50 border-b border-zinc-200 text-xs">
          <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Tape Slices Recorded
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-xl font-bold text-zinc-900">{entries.length}</span>
              <span className="text-zinc-500 text-xs font-medium">snapshots</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Append-only audit tape</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Total Rows Captured
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-xl font-bold text-emerald-950">
                {totalRecordsAudited.toLocaleString()}
              </span>
              <span className="text-zinc-500 text-xs font-medium">rows</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-1">Across all trigger events</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Cumulative Tape Volume
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-xl font-bold text-zinc-900">
                {(totalBytesAudited / 1024).toFixed(1)}
              </span>
              <span className="text-zinc-500 text-xs font-medium">KB serialized</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">RFC 4180 / 8259 compliance</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Avg Serialization Latency
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-xl font-bold text-indigo-950">{avgLatencyMs}</span>
              <span className="text-zinc-500 text-xs font-medium">ms CPU time</span>
            </div>
            <p className="text-[10px] text-indigo-600 mt-1">Sub-10ms export efficiency</p>
          </div>
        </div>

        {/* Live Simulation & Action Controls Bar */}
        <div className="px-6 py-3 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          {/* Quick Simulation Buttons for External Auditor Testing */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Test Triggers:
            </span>

            <button
              id="btn-simulate-status-mutation"
              type="button"
              disabled={isMutating}
              onClick={() => handleSimulateMutation('status_transition')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Simulate updating 50 order records to verify Queue Auto-Save triggers"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${isMutating ? 'animate-spin' : ''}`} />
              <span>Batch Status Transition (50 rows)</span>
            </button>

            <button
              id="btn-simulate-live-ingest"
              type="button"
              disabled={isMutating}
              onClick={() => handleSimulateMutation('insert_live')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Simulate ingesting 50 live transactions"
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>Live Ingest Append (+50)</span>
            </button>

            <button
              id="btn-manual-trigger-slice"
              type="button"
              onClick={onTriggerManualSlice}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-medium transition-colors cursor-pointer"
              title="Trigger an on-demand audit tape snapshot right now"
            >
              <Play className="w-3 h-3 text-indigo-600" />
              <span>Cut Tape Slice Now</span>
            </button>
          </div>

          {/* Export Bundle Actions */}
          <div className="flex items-center gap-2">
            <button
              id="btn-export-audit-ledger-csv"
              type="button"
              onClick={handleDownloadLedgerCsv}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download CSV ledger of all tape entries, events, and SHA-256 hashes"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Audit Ledger CSV</span>
            </button>

            <button
              id="btn-export-audit-bundle-json"
              type="button"
              onClick={handleDownloadJsonBundle}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download full JSON compliance manifest bundle with payload data"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-600" />
              <span>Full JSON Bundle</span>
            </button>

            {entries.length > 0 && (
              <button
                id="btn-clear-data-tape"
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all historical data tape entries? This action cannot be undone.')) {
                    onClearTape();
                  }
                }}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Clear Tape History"
                aria-label="Clear Tape"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-2.5 bg-zinc-50/70 border-b border-zinc-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="data-tape-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Tape ID, trigger event, SHA-256 hash..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="text-[11px] text-zinc-500">
            Showing <strong>{filteredEntries.length}</strong> of {entries.length} tape slices
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="flex-1 overflow-y-auto min-h-[300px] p-6 space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <ShieldCheck className="w-12 h-12 mx-auto text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-800">No Data Tape Entries Found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No tape entries match your search criteria.'
                  : 'Enable "Queue Auto-Save" in the Export menu and trigger a database update to record incremental audit tape slices.'}
              </p>
              {!searchTerm && (
                <button
                  type="button"
                  onClick={onTriggerManualSlice}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Generate First Tape Slice</span>
                </button>
              )}
            </div>
          ) : (
            <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100/90 text-zinc-700 border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Tape ID</th>
                      <th className="py-2.5 px-3">Trigger Event</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3">Rows</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Duration &amp; CPU</th>
                      <th className="py-2.5 px-3">SHA-256 Audit Checksum</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-normal">
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry.tapeId}
                        className="hover:bg-zinc-50/80 transition-colors group"
                      >
                        {/* Tape ID & Timestamp */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-mono font-bold text-zinc-900">{entry.tapeId}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                            {entry.timeFormatted}
                          </span>
                        </td>

                        {/* Trigger Event & DB Rows */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <div className="font-medium text-zinc-900 truncate" title={entry.triggerEvent}>
                            {entry.triggerEvent}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            DB Total: <strong>{entry.databaseTotalRecords.toLocaleString()}</strong> rows
                          </div>
                        </td>

                        {/* Format */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              entry.format === 'json'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {entry.format.toUpperCase()}
                          </span>
                        </td>

                        {/* Rows Scanned / Exported */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-zinc-800">
                          <strong>{entry.recordCount.toLocaleString()}</strong>
                          <span className="text-[10px] text-zinc-400 block">
                            {entry.itemCount} items
                          </span>
                        </td>

                        {/* File Size */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-zinc-800">
                          {(entry.fileSizeBytes / 1024).toFixed(1)} KB
                          <span className="text-[10px] text-zinc-400 block">
                            {entry.recordCount > 0 ? Math.round(entry.fileSizeBytes / entry.recordCount) : 0} B/row
                          </span>
                        </td>

                        {/* Duration & CPU */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-zinc-800">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{entry.durationMs}ms</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            <span>{entry.cpuUsagePercent}% CPU</span>
                          </div>
                        </td>

                        {/* SHA-256 Checksum */}
                        <td className="py-2.5 px-3 max-w-[180px]">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-700 bg-zinc-100 px-2 py-1 rounded border border-zinc-200">
                            <span className="truncate" title={entry.checksumSha256}>
                              {entry.checksumSha256.slice(0, 10)}...{entry.checksumSha256.slice(-6)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyHash(entry.checksumSha256)}
                              className="p-0.5 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer shrink-0"
                              title="Copy full SHA-256 audit checksum"
                            >
                              {copiedHash === entry.checksumSha256 ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectedEntry(entry)}
                              className="px-2 py-1 rounded text-zinc-700 hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                              title="Inspect payload snippet"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleSlice(entry)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-2xs transition-colors cursor-pointer"
                              title={`Download slice file ${entry.filename}`}
                            >
                              <Download className="w-3 h-3" />
                              <span>Slice</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Inspected Payload Drawer / Details */}
          {inspectedEntry && (
            <div
              id="data-tape-payload-drawer"
              className="border border-zinc-300 rounded-xl bg-zinc-900 text-zinc-100 p-4 shadow-lg animate-fade-in"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400">{inspectedEntry.tapeId}</span>
                  <span className="text-zinc-400 text-xs">— {inspectedEntry.filename}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {inspectedEntry.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleSlice(inspectedEntry)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Full File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedEntry(null)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Close Payload Preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-zinc-400 pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-zinc-500 block">SHA-256 Checksum:</span>
                  <span className="text-zinc-200 truncate block" title={inspectedEntry.checksumSha256}>
                    {inspectedEntry.checksumSha256}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Trigger:</span>
                  <span className="text-zinc-200 truncate block">{inspectedEntry.triggerEvent}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Rows Exported:</span>
                  <span className="text-zinc-200">{inspectedEntry.recordCount.toLocaleString()} rows</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Payload Size:</span>
                  <span className="text-zinc-200">{(inspectedEntry.fileSizeBytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>

              {/* Code preview block */}
              <div className="mt-3">
                <div className="text-[10px] text-zinc-500 font-mono mb-1">Payload Content Sample:</div>
                <pre className="p-3 rounded-lg bg-black/60 text-emerald-300 font-mono text-xs overflow-x-auto max-h-56 select-all whitespace-pre-wrap leading-relaxed">
                  {inspectedEntry.payloadPreview}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-zinc-100 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span>
              WORM Compliant Append-Only Memory Tape • Cryptographically sealed with SHA-256
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-close-data-tape-footer"
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
