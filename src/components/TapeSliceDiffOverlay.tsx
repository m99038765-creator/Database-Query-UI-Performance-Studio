import React, { useState, useMemo } from 'react';
import { DataTapeEntry } from '../types';
import { triggerFileDownload } from '../utils/csvExporter';
import {
  GitCompare,
  ArrowLeftRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  Clock,
  Cpu,
  Database,
  Layers,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles
} from 'lucide-react';

interface TapeSliceDiffOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DataTapeEntry[];
  initialSliceAId?: string | null;
  initialSliceBId?: string | null;
  onTriggerNewSlice?: () => void;
}

export const TapeSliceDiffOverlay: React.FC<TapeSliceDiffOverlayProps> = ({
  isOpen,
  onClose,
  entries,
  initialSliceAId,
  initialSliceBId,
  onTriggerNewSlice
}) => {
  // Determine default selections:
  // If provided, use them; otherwise use the last two entries (Slice A: older, Slice B: newer)
  const defaultA = useMemo(() => {
    if (initialSliceAId && entries.some((e) => e.tapeId === initialSliceAId)) {
      return initialSliceAId;
    }
    if (entries.length >= 2) {
      return entries[entries.length - 2].tapeId;
    }
    return entries[0]?.tapeId || '';
  }, [entries, initialSliceAId]);

  const defaultB = useMemo(() => {
    if (initialSliceBId && entries.some((e) => e.tapeId === initialSliceBId)) {
      return initialSliceBId;
    }
    if (entries.length >= 2) {
      return entries[entries.length - 1].tapeId;
    }
    return entries[entries.length - 1]?.tapeId || '';
  }, [entries, initialSliceBId]);

  const [sliceAId, setSliceAId] = useState<string>(defaultA);
  const [sliceBId, setSliceBId] = useState<string>(defaultB);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metadata' | 'counts' | 'checksum' | 'payload'>('overview');

  // Keep state synced if initial selection changes when reopening
  React.useEffect(() => {
    if (initialSliceAId && entries.some((e) => e.tapeId === initialSliceAId)) {
      setSliceAId(initialSliceAId);
    } else if (entries.length >= 2 && !sliceAId) {
      setSliceAId(entries[entries.length - 2].tapeId);
    }
  }, [initialSliceAId, entries]);

  React.useEffect(() => {
    if (initialSliceBId && entries.some((e) => e.tapeId === initialSliceBId)) {
      setSliceBId(initialSliceBId);
    } else if (entries.length >= 1 && !sliceBId) {
      setSliceBId(entries[entries.length - 1].tapeId);
    }
  }, [initialSliceBId, entries]);

  if (!isOpen) return null;

  const sliceA = entries.find((e) => e.tapeId === sliceAId) || entries[0];
  const sliceB = entries.find((e) => e.tapeId === sliceBId) || entries[Math.min(1, entries.length - 1)];

  const handleSwap = () => {
    const temp = sliceAId;
    setSliceAId(sliceBId);
    setSliceBId(temp);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownload = (entry?: DataTapeEntry) => {
    if (!entry) return;
    const mimeType = entry.format === 'json' ? 'application/json;charset=utf-8;' : 'text/csv;charset=utf-8;';
    const blob = new Blob([entry.content], { type: mimeType });
    triggerFileDownload(blob, entry.filename);
  };

  // Delta calculations
  const rowDelta = sliceA && sliceB ? sliceB.recordCount - sliceA.recordCount : 0;
  const rowDeltaPct = sliceA && sliceA.recordCount > 0
    ? ((rowDelta / sliceA.recordCount) * 100).toFixed(1)
    : '0.0';

  const dbTotalDelta = sliceA && sliceB ? sliceB.databaseTotalRecords - sliceA.databaseTotalRecords : 0;
  const sizeDeltaBytes = sliceA && sliceB ? sliceB.fileSizeBytes - sliceA.fileSizeBytes : 0;
  const sizeDeltaPct = sliceA && sliceA.fileSizeBytes > 0
    ? ((sizeDeltaBytes / sliceA.fileSizeBytes) * 100).toFixed(1)
    : '0.0';

  const durationDeltaMs = sliceA && sliceB ? sliceB.durationMs - sliceA.durationMs : 0;
  const timeDeltaSeconds = sliceA && sliceB ? Math.round((sliceB.timestamp - sliceA.timestamp) / 1000) : 0;
  const isChecksumMatch = sliceA && sliceB && sliceA.checksumSha256 === sliceB.checksumSha256;
  const isFormatMatch = sliceA && sliceB && sliceA.format === sliceB.format;

  return (
    <div
      id="tape-slice-diff-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-overlay-title"
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Overlay Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="diff-overlay-title" className="text-lg font-bold text-white tracking-tight">
                  Historical Tape Slice Comparison &amp; Diff
                </h2>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  Side-by-Side Audit
                </span>
                {isChecksumMatch ? (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Identical Checksums
                  </span>
                ) : (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    State Divergence Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Detailed cryptographic diff of metadata properties, record volume, serialization performance, and SHA-256 state signatures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              id="btn-diff-swap-slices"
              type="button"
              onClick={handleSwap}
              disabled={entries.length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Swap Baseline (A) and Target (B)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
              <span>Swap A / B</span>
            </button>

            <button
              id="btn-close-tape-diff-overlay"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close Comparison Overlay"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Insufficient Entries Fallback */}
        {entries.length < 2 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">At Least Two Tape Slices Required</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              To perform a side-by-side comparative diff of metadata, record counts, and checksums, you must have recorded at least 2 tape slices in the audit ledger.
            </p>
            {onTriggerNewSlice && (
              <button
                type="button"
                onClick={() => {
                  onTriggerNewSlice();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer mt-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Cut New Tape Slice Now</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Slice Selectors Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-zinc-50 border-b border-zinc-200">
              {/* Slice A Selection Card */}
              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs font-mono">
                      A
                    </span>
                    <span className="text-xs font-bold text-zinc-800">
                      Baseline Slice (Reference)
                    </span>
                  </div>
                  {sliceA && (
                    <button
                      type="button"
                      onClick={() => handleDownload(sliceA)}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 cursor-pointer"
                      title="Download Slice A"
                    >
                      <Download className="w-3 h-3" />
                      <span>{sliceA.filename}</span>
                    </button>
                  )}
                </div>

                <select
                  id="select-tape-slice-a"
                  value={sliceAId}
                  onChange={(e) => setSliceAId(e.target.value)}
                  className="w-full text-xs font-mono bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {entries.map((entry) => (
                    <option key={`a-${entry.tapeId}`} value={entry.tapeId}>
                      [{entry.tapeId}] {entry.timeFormatted} • {entry.recordCount} rows • {entry.format.toUpperCase()} ({entry.triggerEvent})
                    </option>
                  ))}
                </select>
              </div>

              {/* Slice B Selection Card */}
              <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs font-mono">
                      B
                    </span>
                    <span className="text-xs font-bold text-zinc-800">
                      Comparison Slice (Target)
                    </span>
                  </div>
                  {sliceB && (
                    <button
                      type="button"
                      onClick={() => handleDownload(sliceB)}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-900 font-medium px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 cursor-pointer"
                      title="Download Slice B"
                    >
                      <Download className="w-3 h-3" />
                      <span>{sliceB.filename}</span>
                    </button>
                  )}
                </div>

                <select
                  id="select-tape-slice-b"
                  value={sliceBId}
                  onChange={(e) => setSliceBId(e.target.value)}
                  className="w-full text-xs font-mono bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {entries.map((entry) => (
                    <option key={`b-${entry.tapeId}`} value={entry.tapeId}>
                      [{entry.tapeId}] {entry.timeFormatted} • {entry.recordCount} rows • {entry.format.toUpperCase()} ({entry.triggerEvent})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Delta Scorecard Highlights Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-6 py-3 bg-zinc-100/70 border-b border-zinc-200 text-xs">
              {/* Record Count Delta */}
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Row Count Delta (B - A)
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {rowDelta > 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : rowDelta < 0 ? (
                    <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <span
                    className={`font-mono text-base font-bold ${
                      rowDelta > 0
                        ? 'text-emerald-700'
                        : rowDelta < 0
                        ? 'text-rose-700'
                        : 'text-zinc-700'
                    }`}
                  >
                    {rowDelta > 0 ? `+${rowDelta.toLocaleString()}` : rowDelta.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({rowDelta >= 0 ? `+${rowDeltaPct}%` : `${rowDeltaPct}%`})
                  </span>
                </div>
              </div>

              {/* DB Total Delta */}
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  DB Total Records Delta
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-mono text-base font-bold text-zinc-900">
                    {dbTotalDelta > 0 ? `+${dbTotalDelta.toLocaleString()}` : dbTotalDelta.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">rows</span>
                </div>
              </div>

              {/* Payload Size Delta */}
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Serialized Size Delta
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`font-mono text-base font-bold ${
                      sizeDeltaBytes > 0
                        ? 'text-amber-700'
                        : sizeDeltaBytes < 0
                        ? 'text-blue-700'
                        : 'text-zinc-700'
                    }`}
                  >
                    {sizeDeltaBytes > 0
                      ? `+${(sizeDeltaBytes / 1024).toFixed(1)} KB`
                      : `${(sizeDeltaBytes / 1024).toFixed(1)} KB`}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({sizeDeltaBytes >= 0 ? `+${sizeDeltaPct}%` : `${sizeDeltaPct}%`})
                  </span>
                </div>
              </div>

              {/* Checksum Equality Status */}
              <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  SHA-256 Checksum Diff
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {isChecksumMatch ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-700 text-xs">Identical Payload</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-indigo-700 text-xs">Mutated Signature</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 py-2 bg-white border-b border-zinc-200 flex items-center justify-between gap-2 overflow-x-auto">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  All Metrics Diff
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('metadata')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'metadata'
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Metadata &amp; Triggers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('counts')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'counts'
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Record Counts &amp; Volume
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('checksum')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'checksum'
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Checksum Verification
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payload')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    activeTab === 'payload'
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Payload Previews
                </button>
              </div>

              {timeDeltaSeconds !== 0 && (
                <div className="text-[11px] text-zinc-500 font-mono hidden sm:flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    Elapsed Time: <strong>{Math.abs(timeDeltaSeconds)}s</strong> ({timeDeltaSeconds > 0 ? 'B is newer' : 'A is newer'})
                  </span>
                </div>
              )}
            </div>

            {/* Main Diff Content Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {sliceA && sliceB && (
                <>
                  {/* Side-by-Side Comparison Table */}
                  <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-100/90 text-zinc-700 border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-4 w-1/3">Property / Dimension</th>
                          <th className="py-2.5 px-4 w-1/3 bg-blue-50/40 border-l border-zinc-200 text-blue-900">
                            Slice A: {sliceA.tapeId}
                          </th>
                          <th className="py-2.5 px-4 w-1/3 bg-indigo-50/40 border-l border-zinc-200 text-indigo-900">
                            Slice B: {sliceB.tapeId} (Diff Delta)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 font-normal">
                        {/* Section: Checksum & Cryptographic Identity */}
                        {(activeTab === 'overview' || activeTab === 'checksum') && (
                          <>
                            <tr className="bg-zinc-50/60 font-semibold text-[11px] text-zinc-500 uppercase tracking-wider">
                              <td colSpan={3} className="py-1.5 px-4">
                                Cryptographic Audit &amp; Integrity
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                SHA-256 Digest
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-[11px] text-zinc-700">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate max-w-[200px]" title={sliceA.checksumSha256}>
                                    {sliceA.checksumSha256}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyHash(sliceA.checksumSha256)}
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
                                    title="Copy SHA-256 checksum A"
                                  >
                                    {copiedHash === sliceA.checksumSha256 ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-[11px] text-zinc-700">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`truncate max-w-[200px] ${
                                      isChecksumMatch ? 'text-emerald-700 font-medium' : 'text-indigo-700 font-medium'
                                    }`}
                                    title={sliceB.checksumSha256}
                                  >
                                    {sliceB.checksumSha256}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyHash(sliceB.checksumSha256)}
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
                                    title="Copy SHA-256 checksum B"
                                  >
                                    {copiedHash === sliceB.checksumSha256 ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Cryptographic Match Status
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                <span className="font-mono text-[10px] text-zinc-500">Baseline Hash</span>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                {isChecksumMatch ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Match: Identical Bitstream
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                    Distinct: Mutation Authenticated
                                  </span>
                                )}
                              </td>
                            </tr>
                          </>
                        )}

                        {/* Section: Record Counts & Volume */}
                        {(activeTab === 'overview' || activeTab === 'counts') && (
                          <>
                            <tr className="bg-zinc-50/60 font-semibold text-[11px] text-zinc-500 uppercase tracking-wider">
                              <td colSpan={3} className="py-1.5 px-4">
                                Record Counts &amp; Export Volume
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Exported Rows (Dataset Slice)
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono font-bold text-zinc-800">
                                {sliceA.recordCount.toLocaleString()} rows
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono">
                                <div className="flex items-center gap-2">
                                  <strong className="text-zinc-900">
                                    {sliceB.recordCount.toLocaleString()} rows
                                  </strong>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      rowDelta > 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : rowDelta < 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-zinc-100 text-zinc-600'
                                    }`}
                                  >
                                    {rowDelta > 0 ? `+${rowDelta}` : rowDelta} ({rowDelta >= 0 ? `+${rowDeltaPct}%` : `${rowDeltaPct}%`})
                                  </span>
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Database Total Records at Snapshot
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceA.databaseTotalRecords.toLocaleString()} rows in DB
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                <div className="flex items-center gap-2">
                                  <span>{sliceB.databaseTotalRecords.toLocaleString()} rows in DB</span>
                                  {dbTotalDelta !== 0 && (
                                    <span className="text-[10px] font-semibold text-indigo-700">
                                      ({dbTotalDelta > 0 ? `+${dbTotalDelta}` : dbTotalDelta})
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Child Line Items Serialized
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceA.itemCount.toLocaleString()} items
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                <div className="flex items-center gap-2">
                                  <span>{sliceB.itemCount.toLocaleString()} items</span>
                                  {sliceB.itemCount - sliceA.itemCount !== 0 && (
                                    <span className="text-[10px] font-semibold text-zinc-600">
                                      ({sliceB.itemCount - sliceA.itemCount > 0 ? `+${sliceB.itemCount - sliceA.itemCount}` : sliceB.itemCount - sliceA.itemCount})
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Payload Byte Volume
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {(sliceA.fileSizeBytes / 1024).toFixed(1)} KB ({sliceA.fileSizeBytes.toLocaleString()} B)
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                <div className="flex items-center gap-2">
                                  <span>{(sliceB.fileSizeBytes / 1024).toFixed(1)} KB</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      sizeDeltaBytes > 0
                                        ? 'bg-amber-100 text-amber-800'
                                        : sizeDeltaBytes < 0
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-zinc-100 text-zinc-600'
                                    }`}
                                  >
                                    {sizeDeltaBytes > 0 ? `+${(sizeDeltaBytes / 1024).toFixed(1)} KB` : `${(sizeDeltaBytes / 1024).toFixed(1)} KB`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Byte Density per Row
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceA.recordCount > 0 ? Math.round(sliceA.fileSizeBytes / sliceA.recordCount) : 0} bytes/row
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceB.recordCount > 0 ? Math.round(sliceB.fileSizeBytes / sliceB.recordCount) : 0} bytes/row
                              </td>
                            </tr>
                          </>
                        )}

                        {/* Section: Metadata & Execution Environment */}
                        {(activeTab === 'overview' || activeTab === 'metadata') && (
                          <>
                            <tr className="bg-zinc-50/60 font-semibold text-[11px] text-zinc-500 uppercase tracking-wider">
                              <td colSpan={3} className="py-1.5 px-4">
                                Metadata &amp; Trigger Context
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Trigger Event
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                <span className="font-semibold text-zinc-900">{sliceA.triggerEvent}</span>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-zinc-900">{sliceB.triggerEvent}</span>
                                  {sliceA.triggerEvent !== sliceB.triggerEvent && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                                      Changed
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Serialization Format
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                    sliceA.format === 'json'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}
                                >
                                  {sliceA.format === 'json' ? <FileCode className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                                  {sliceA.format.toUpperCase()} ({sliceA.format === 'json' ? 'RFC 8259' : 'RFC 4180'})
                                </span>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                    sliceB.format === 'json'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}
                                >
                                  {sliceB.format === 'json' ? <FileCode className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                                  {sliceB.format.toUpperCase()} ({sliceB.format === 'json' ? 'RFC 8259' : 'RFC 4180'})
                                </span>
                                {!isFormatMatch && (
                                  <span className="ml-2 text-[10px] font-bold text-amber-700">
                                    (Format Disparity)
                                  </span>
                                )}
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Timestamp &amp; Sequence
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-[11px] text-zinc-700">
                                <div>Seq #{sliceA.sequenceNumber}</div>
                                <div className="text-zinc-500 text-[10px] mt-0.5">{sliceA.isoTimestamp}</div>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-[11px] text-zinc-700">
                                <div>Seq #{sliceB.sequenceNumber}</div>
                                <div className="text-zinc-500 text-[10px] mt-0.5">{sliceB.isoTimestamp}</div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Active Filter Criteria
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 text-[11px] text-zinc-600">
                                <div>Status: <strong>{sliceA.filterSummary.status}</strong></div>
                                <div>Category: <strong>{sliceA.filterSummary.category}</strong></div>
                                {sliceA.filterSummary.search && <div>Search: "{sliceA.filterSummary.search}"</div>}
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 text-[11px] text-zinc-600">
                                <div>Status: <strong>{sliceB.filterSummary.status}</strong></div>
                                <div>Category: <strong>{sliceB.filterSummary.category}</strong></div>
                                {sliceB.filterSummary.search && <div>Search: "{sliceB.filterSummary.search}"</div>}
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Serialization Latency &amp; CPU
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                <div>{sliceA.durationMs} ms CPU duration</div>
                                <div className="text-[10px] text-zinc-500">{sliceA.cpuUsagePercent}% host CPU</div>
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                <div className="flex items-center gap-1.5">
                                  <span>{sliceB.durationMs} ms</span>
                                  {durationDeltaMs !== 0 && (
                                    <span className="text-[10px] text-zinc-500">
                                      ({durationDeltaMs > 0 ? `+${durationDeltaMs}ms` : `${durationDeltaMs}ms`})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500">{sliceB.cpuUsagePercent}% host CPU</div>
                              </td>
                            </tr>
                            <tr className="hover:bg-zinc-50/60">
                              <td className="py-2.5 px-4 font-medium text-zinc-800">
                                Serializer Throughput
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceA.throughputRowsPerSec.toLocaleString()} rows/sec
                              </td>
                              <td className="py-2.5 px-4 border-l border-zinc-200 font-mono text-zinc-700">
                                {sliceB.throughputRowsPerSec.toLocaleString()} rows/sec
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section: Side-by-side Payload Preview Diff */}
                  {(activeTab === 'overview' || activeTab === 'payload') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          Payload Stream Previews (Side-by-Side Snippets)
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Comparing raw stream tokens
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Slice A Payload Box */}
                        <div className="border border-zinc-300 rounded-xl bg-zinc-900 text-zinc-100 p-3 shadow-sm">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <span className="font-mono font-bold text-blue-300">Slice A: {sliceA.tapeId}</span>
                              <span className="text-zinc-500">({sliceA.format.toUpperCase()})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownload(sliceA)}
                              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Download Full Slice A"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <pre className="mt-2 p-2 rounded bg-black/70 text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-56 select-all whitespace-pre-wrap leading-relaxed">
                            {sliceA.payloadPreview}
                          </pre>
                        </div>

                        {/* Slice B Payload Box */}
                        <div className="border border-zinc-300 rounded-xl bg-zinc-900 text-zinc-100 p-3 shadow-sm">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-400" />
                              <span className="font-mono font-bold text-indigo-300">Slice B: {sliceB.tapeId}</span>
                              <span className="text-zinc-500">({sliceB.format.toUpperCase()})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownload(sliceB)}
                              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Download Full Slice B"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <pre className="mt-2 p-2 rounded bg-black/70 text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-56 select-all whitespace-pre-wrap leading-relaxed">
                            {sliceB.payloadPreview}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Overlay Footer */}
            <div className="px-6 py-3.5 bg-zinc-100 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                <span>
                  Cryptographic verification engine • Comparing {sliceA?.tapeId} vs {sliceB?.tapeId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-close-tape-diff-footer"
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Close Diff
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
