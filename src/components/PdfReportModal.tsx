import React, { useState } from 'react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';
import { generatePerformancePdfReport } from '../utils/pdfReportGenerator';
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  X,
  Sliders,
  Columns,
  Sparkles,
  Info,
  Clock,
  Check,
  Calendar,
  User,
  Building
} from 'lucide-react';

interface PdfReportModalProps {
  trendHistory: LatencyTrendPoint[];
  currentFlags: OptimizationFlags;
  indexA: number;
  indexB: number;
  svgElement?: SVGSVGElement | null;
  onClose: () => void;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  trendHistory,
  currentFlags,
  indexA: initialIndexA,
  indexB: initialIndexB,
  svgElement,
  onClose
}) => {
  const [reportTitle, setReportTitle] = useState('Database Performance Benchmark & Optimization Report');
  const [organization, setOrganization] = useState('Database Infrastructure & Performance Engineering');
  const [author, setAuthor] = useState('Staff Database Engineer');
  const [notes, setNotes] = useState(
    'Comprehensive benchmark evaluation of 50,000 synthetic transaction records. Results demonstrate effective resolution of N+1 query loops and full sequential table scans.'
  );

  const [selectedA, setSelectedA] = useState<number>(initialIndexA);
  const [selectedB, setSelectedB] = useState<number>(initialIndexB);
  const [includeChart, setIncludeChart] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleGenerate = async (action: 'download' | 'preview') => {
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      const doc = await generatePerformancePdfReport({
        trendHistory,
        currentFlags,
        indexA: selectedA,
        indexB: selectedB,
        svgElement: includeChart ? svgElement : null,
        options: {
          title: reportTitle,
          organization,
          author,
          notes
        }
      });

      if (action === 'download') {
        const cleanTimestamp = new Date().toISOString().slice(0, 10);
        doc.save(`database-performance-report-${cleanTimestamp}.pdf`);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      } else {
        const blobUrl = doc.output('bloburl');
        setPreviewUrl(blobUrl.toString());
        window.open(blobUrl.toString(), '_blank');
      }
    } catch (error) {
      console.error('Failed to generate PDF report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const pointA = trendHistory[selectedA] || trendHistory[0];
  const pointB = trendHistory[selectedB] || trendHistory[trendHistory.length - 1];
  const deltaMs = pointB && pointA ? pointB.executionTimeMs - pointA.executionTimeMs : 0;
  const deltaPercent = pointA && pointA.executionTimeMs > 0 ? ((deltaMs / pointA.executionTimeMs) * 100).toFixed(1) : '0';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="pdf-report-generator-modal"
        className="bg-white rounded-2xl shadow-2xl border border-zinc-300 w-full max-w-3xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Generate Benchmark PDF Documentation</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/30 text-blue-300 border border-blue-400/30 font-semibold">
                  A4 Publication-Grade
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Export an executive and engineering report containing historical latency trends, snapshot comparisons, and optimization matrices.
              </p>
            </div>
          </div>

          <button
            id="btn-close-pdf-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Configuration Options */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Success Banner */}
          {downloadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">
                PDF benchmark report successfully generated and downloaded to your device.
              </span>
            </div>
          )}

          {/* Section 1: Document Metadata */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Document Properties &amp; Header
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block text-zinc-700 font-medium mb-1">Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Report Title"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-zinc-400" />
                  Organization / Team
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Team Name"
                />
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  Author / Engineer
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Author"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-zinc-700 font-medium mb-1">Executive Summary / Engineer Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Optional notes or engineering observations..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Comparison Snapshots Selection */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                Featured Snapshot Comparison Section
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">
                {trendHistory.length} total snapshots available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] inline-flex items-center justify-center font-mono">A</span>
                    Baseline Snapshot (Unoptimized)
                  </span>
                  <span className="font-mono text-[11px] text-amber-700 font-bold">
                    {pointA?.executionTimeMs.toFixed(1)} ms
                  </span>
                </div>
                <select
                  value={selectedA}
                  onChange={(e) => setSelectedA(Number(e.target.value))}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2 py-1.5 text-xs text-zinc-800"
                >
                  {trendHistory.map((pt, idx) => (
                    <option key={pt.id} value={idx}>
                      #{idx + 1}: {pt.triggerEvent} ({pt.executionTimeMs.toFixed(1)}ms)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] inline-flex items-center justify-center font-mono">B</span>
                    Comparison Target Snapshot (Optimized)
                  </span>
                  <span className="font-mono text-[11px] text-emerald-700 font-bold">
                    {pointB?.executionTimeMs.toFixed(1)} ms
                  </span>
                </div>
                <select
                  value={selectedB}
                  onChange={(e) => setSelectedB(Number(e.target.value))}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded px-2 py-1.5 text-xs text-zinc-800"
                >
                  {trendHistory.map((pt, idx) => (
                    <option key={pt.id} value={idx}>
                      #{idx + 1}: {pt.triggerEvent} ({pt.executionTimeMs.toFixed(1)}ms)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Calculated Comparison Metric Badge */}
            <div className="p-2.5 rounded-lg bg-white border border-zinc-200 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Calculated Latency Difference in PDF:</span>
              <span className={`font-mono font-bold ${deltaMs < 0 ? 'text-emerald-600' : deltaMs > 0 ? 'text-rose-600' : 'text-zinc-700'}`}>
                {deltaMs < 0 ? `-${Math.abs(deltaMs).toFixed(1)} ms (${Math.abs(Number(deltaPercent))}%) FASTER` : deltaMs > 0 ? `+${deltaMs.toFixed(1)} ms SLOWER` : '0.0 ms Parity'}
              </span>
            </div>
          </div>

          {/* Section 3: Inclusion Toggles */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-700" />
              Document Sections Included
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeChart}
                  onChange={(e) => setIncludeChart(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-zinc-800">D3 Time-Series Chart</div>
                  <div className="text-[11px] text-zinc-500">Embed visual latency curve graphic</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-zinc-800">Complete Event History Table</div>
                  <div className="text-[11px] text-zinc-500">All recorded latency and query logs</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-zinc-800">Flag Discrepancy Matrix</div>
                  <div className="text-[11px] text-zinc-500">5-flag architectural breakdown</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-zinc-800">Engineering Recommendations</div>
                  <div className="text-[11px] text-zinc-500">Root-cause and indexing best practices</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>Formatted in standard multi-page A4 PDF format</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-preview-pdf-report"
              type="button"
              onClick={() => handleGenerate('preview')}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold border border-zinc-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600" />
              <span>Preview in Tab</span>
            </button>

            <button
              id="btn-download-pdf-report"
              type="button"
              onClick={() => handleGenerate('download')}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
