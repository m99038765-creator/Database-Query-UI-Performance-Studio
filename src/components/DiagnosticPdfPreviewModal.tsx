import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Download,
  RefreshCw,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  BarChart3,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import {
  PREDEFINED_PDF_TEMPLATES,
  getSavedCustomTemplate,
  matchTemplateId
} from '../utils/pdfReportTemplates';
import {
  generateDiagnosticCorrelationPdf,
  DiagnosticPdfSectionsConfig
} from '../utils/diagnosticCorrelationPdfGenerator';
import { ThresholdViolationRecord } from '../utils/diagnosticCorrelationReportGenerator';
import { LatencyTrendPoint, DatabaseMutationHistoryEntry, OptimizationFlags } from '../types';

interface DiagnosticPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => Promise<void> | void;
  isDownloading: boolean;
  isDownloadSuccess: boolean;
  thresholdViolations: ThresholdViolationRecord[];
  mutationHistory: DatabaseMutationHistoryEntry[];
  trendHistory: LatencyTrendPoint[];
  mutationThreshold: number;
  currentFlags: OptimizationFlags;
  sectionsConfig: DiagnosticPdfSectionsConfig;
  onUpdateSections?: (sections: DiagnosticPdfSectionsConfig) => void;
}

export const DiagnosticPdfPreviewModal: React.FC<DiagnosticPdfPreviewModalProps> = ({
  isOpen,
  onClose,
  onDownload,
  isDownloading,
  isDownloadSuccess,
  thresholdViolations,
  mutationHistory,
  trendHistory,
  mutationThreshold,
  currentFlags,
  sectionsConfig,
  onUpdateSections
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Generate the live PDF blob URL
  const renderLivePdf = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const doc = await generateDiagnosticCorrelationPdf({
        thresholdViolations,
        mutationHistory,
        trendHistory,
        mutationThreshold,
        currentFlags,
        options: {
          sections: sectionsConfig
        }
      });

      const blob = doc.output('blob');

      // Cleanup previous blob URL
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      activeBlobUrlRef.current = url;
      setPdfUrl(url);
      setPageCount(doc.getNumberOfPages());
    } catch (err: any) {
      console.error('Failed to generate live PDF preview:', err);
      setErrorMessage(
        err?.message || 'Failed to render PDF preview. Please check diagnostic telemetry and retry.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Re-render whenever modal is opened or section configurations change
  useEffect(() => {
    if (isOpen) {
      renderLivePdf();
    } else {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setPdfUrl(null);
    }

    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [isOpen, sectionsConfig]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-pdf-preview"
      data-testid="modal-pdf-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pdf-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-5xl h-[92vh] max-h-[920px] bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/90 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="modal-pdf-preview-title" className="font-bold text-sm text-zinc-100 tracking-tight">
                  PDF Report Live Preview
                </h3>
                <span
                  id="badge-pdf-preview-page-count"
                  data-testid="badge-pdf-preview-page-count"
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                >
                  {isLoading ? 'Rendering...' : `${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}`}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Threshold: {mutationThreshold}s
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Interactive preview of executive summary, sparkline trends, and root-cause correlation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh preview button */}
            <button
              id="btn-refresh-pdf-preview"
              data-testid="btn-refresh-pdf-preview"
              type="button"
              aria-label="Refresh Preview"
              onClick={renderLivePdf}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Re-render PDF preview from fresh telemetry data"
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Direct download button from preview */}
            <button
              id="btn-download-pdf-from-preview"
              data-testid="btn-download-pdf-from-preview"
              type="button"
              aria-label="Download PDF Report"
              onClick={onDownload}
              disabled={isDownloading || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Trigger automated browser download of the full PDF document"
            >
              {isDownloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-100">PDF Downloaded!</span>
                </>
              ) : isDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Report</span>
                </>
              )}
            </button>

            {/* Close modal button */}
            <button
              id="btn-close-pdf-preview"
              data-testid="btn-close-pdf-preview"
              type="button"
              aria-label="Close Preview"
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              title="Close Preview Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Section Toggles Ribbon */}
        {onUpdateSections && (() => {
          const savedCustom = getSavedCustomTemplate();
          const matchedTemplateId = matchTemplateId(sectionsConfig, savedCustom);
          return (
            <div className="px-4 py-2 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap text-[10.5px]">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  <span className="font-semibold text-zinc-200">Template:</span>
                  <select
                    id="modal-select-pdf-template"
                    data-testid="modal-select-pdf-template"
                    aria-label="Modal Template Selector"
                    value={matchedTemplateId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'saved-custom') {
                        if (savedCustom) onUpdateSections({ ...savedCustom.sections });
                        return;
                      }
                      const found = PREDEFINED_PDF_TEMPLATES.find((t) => t.id === val);
                      if (found) onUpdateSections({ ...found.sections });
                    }}
                    className="text-[10px] font-medium bg-zinc-900 border border-amber-500/50 hover:border-amber-400 focus:border-amber-400 rounded px-1.5 py-0.5 text-zinc-200 cursor-pointer shadow-xs"
                  >
                    <optgroup label="Predefined Stakeholder Templates">
                      {PREDEFINED_PDF_TEMPLATES.map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name}
                        </option>
                      ))}
                    </optgroup>
                    {savedCustom && (
                      <optgroup label="Saved Presets">
                        <option value="saved-custom">★ {savedCustom.name}</option>
                      </optgroup>
                    )}
                    {matchedTemplateId === 'custom' && (
                      <optgroup label="Custom Configuration">
                        <option value="custom">Custom (Modified)</option>
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="h-3 w-px bg-zinc-700/80 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-zinc-400">
                  <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                  <span className="font-semibold text-zinc-300">Sections:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label
                    htmlFor="modal-toggle-sparklines"
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 cursor-pointer"
                  >
                    <input
                      id="modal-toggle-sparklines"
                      type="checkbox"
                      checked={sectionsConfig.includeSparklines}
                      onChange={(e) =>
                        onUpdateSections({
                          ...sectionsConfig,
                          includeSparklines: e.target.checked
                        })
                      }
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="text-zinc-200">Sparklines</span>
                  </label>

                <label
                  htmlFor="modal-toggle-mutation-history"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 cursor-pointer"
                >
                  <input
                    id="modal-toggle-mutation-history"
                    type="checkbox"
                    checked={sectionsConfig.includeMutationHistory}
                    onChange={(e) =>
                      onUpdateSections({
                        ...sectionsConfig,
                        includeMutationHistory: e.target.checked
                      })
                    }
                    className="accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="text-zinc-200">Tables</span>
                </label>

                <label
                  htmlFor="modal-toggle-recommendations"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 cursor-pointer"
                >
                  <input
                    id="modal-toggle-recommendations"
                    type="checkbox"
                    checked={sectionsConfig.includeRecommendations}
                    onChange={(e) =>
                      onUpdateSections({
                        ...sectionsConfig,
                        includeRecommendations: e.target.checked
                      })
                    }
                    className="accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="text-zinc-200">Action Plan</span>
                </label>

                <label
                  htmlFor="modal-toggle-executive"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 cursor-pointer"
                >
                  <input
                    id="modal-toggle-executive"
                    type="checkbox"
                    checked={sectionsConfig.includeExecutiveSummary}
                    onChange={(e) =>
                      onUpdateSections({
                        ...sectionsConfig,
                        includeExecutiveSummary: e.target.checked
                      })
                    }
                    className="accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="text-zinc-200">Executive</span>
                </label>
              </div>
            </div>

            {/* Page Break Controls in Preview */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-400 font-mono">Force Page Break:</span>
              <label
                htmlFor="modal-break-sparklines"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border cursor-pointer transition-colors ${
                  sectionsConfig.breakBeforeSparklines
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                } ${!sectionsConfig.includeSparklines ? 'opacity-40 pointer-events-none' : ''}`}
                title="Force Trend Sparklines to start on a new page"
              >
                <input
                  id="modal-break-sparklines"
                  type="checkbox"
                  disabled={!sectionsConfig.includeSparklines}
                  checked={Boolean(sectionsConfig.breakBeforeSparklines)}
                  onChange={(e) =>
                    onUpdateSections({
                      ...sectionsConfig,
                      breakBeforeSparklines: e.target.checked
                    })
                  }
                  className="accent-amber-500 rounded cursor-pointer w-2.5 h-2.5"
                />
                <span>Sparklines</span>
              </label>

              <label
                htmlFor="modal-break-tables"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border cursor-pointer transition-colors ${
                  sectionsConfig.breakBeforeMutationHistory
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                } ${!sectionsConfig.includeMutationHistory ? 'opacity-40 pointer-events-none' : ''}`}
                title="Force Detailed Tables to start on a new page"
              >
                <input
                  id="modal-break-tables"
                  type="checkbox"
                  disabled={!sectionsConfig.includeMutationHistory}
                  checked={Boolean(sectionsConfig.breakBeforeMutationHistory)}
                  onChange={(e) =>
                    onUpdateSections({
                      ...sectionsConfig,
                      breakBeforeMutationHistory: e.target.checked
                    })
                  }
                  className="accent-amber-500 rounded cursor-pointer w-2.5 h-2.5"
                />
                <span>Tables</span>
              </label>

              <label
                htmlFor="modal-break-recommendations"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border cursor-pointer transition-colors ${
                  sectionsConfig.breakBeforeRecommendations
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                } ${!sectionsConfig.includeRecommendations ? 'opacity-40 pointer-events-none' : ''}`}
                title="Force Action Plan Recommendations to start on a new page"
              >
                <input
                  id="modal-break-recommendations"
                  type="checkbox"
                  disabled={!sectionsConfig.includeRecommendations}
                  checked={Boolean(sectionsConfig.breakBeforeRecommendations)}
                  onChange={(e) =>
                    onUpdateSections({
                      ...sectionsConfig,
                      breakBeforeRecommendations: e.target.checked
                    })
                  }
                  className="accent-amber-500 rounded cursor-pointer w-2.5 h-2.5"
                />
                <span>Recommendations</span>
              </label>
            </div>
          </div>
        ); })()}

        {/* Modal Main Body (PDF Viewport) */}
        <div className="relative flex-1 w-full bg-zinc-950 p-2 sm:p-3 overflow-hidden flex flex-col items-center justify-center min-h-[360px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center animate-fadeIn">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                <FileText className="w-5 h-5 text-rose-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-100">
                  Rendering Multi-Page Stakeholder PDF...
                </p>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Drawing 2-panel sparklines, computing lock duration correlations, and compiling engineering recommendations.
                </p>
              </div>
              <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 mt-2">
                <div className="h-full bg-linear-to-r from-rose-500 to-amber-400 rounded-full animate-indeterminate" />
              </div>
            </div>
          ) : errorMessage ? (
            <div
              id="alert-pdf-preview-error"
              data-testid="alert-pdf-preview-error"
              role="alert"
              className="flex flex-col items-center justify-center gap-3 p-6 max-w-md text-center bg-rose-950/40 border border-rose-600/70 rounded-xl"
            >
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-rose-200">PDF Preview Generation Failed</p>
                <p className="text-xs text-rose-300/80">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={renderLivePdf}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Preview</span>
              </button>
            </div>
          ) : pdfUrl ? (
            <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-inner flex flex-col">
              <iframe
                id="iframe-pdf-preview"
                data-testid="iframe-pdf-preview"
                src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                title="Diagnostic Correlation Report PDF Preview"
                className="w-full h-full border-0 rounded-xl bg-zinc-900"
              />
            </div>
          ) : (
            <div className="text-center p-8 text-zinc-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm text-zinc-300">No PDF preview available.</p>
              <button
                type="button"
                onClick={renderLivePdf}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-white cursor-pointer"
              >
                Generate Preview Now
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/90 text-[11px] text-zinc-400 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300">
              Live document preview is generated client-side and matches the exported PDF identically.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-modal-footer-close"
              data-testid="btn-modal-footer-close"
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer font-medium"
            >
              Close
            </button>
            <button
              id="btn-modal-footer-download"
              data-testid="btn-modal-footer-download"
              type="button"
              onClick={onDownload}
              disabled={isDownloading || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
