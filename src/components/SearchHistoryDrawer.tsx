import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  RotateCcw,
  Search,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';

export interface SearchHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  searchHistory: string[];
  currentSearch: string;
  onSelectQuery: (query: string) => void;
  onRemoveQuery: (query: string) => void;
  onClearHistory: () => void;
  onSaveCurrentQuery?: (query: string) => void;
}

export const SearchHistoryDrawer: React.FC<SearchHistoryDrawerProps> = ({
  isOpen,
  onClose,
  searchHistory,
  currentSearch,
  onSelectQuery,
  onRemoveQuery,
  onClearHistory,
  onSaveCurrentQuery
}) => {
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);
  const [reRunToast, setReRunToast] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleReRun = (query: string) => {
    onSelectQuery(query);
    setReRunToast(query);
    setTimeout(() => {
      setReRunToast(null);
    }, 2000);
  };

  if (!isOpen) return null;

  const trimmedCurrent = currentSearch.trim();
  const isCurrentInHistory = searchHistory.some(
    (item) => item.toLowerCase() === trimmedCurrent.toLowerCase()
  );

  return (
    <div
      id="search-history-drawer-backdrop"
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Search History Drawer"
    >
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          id="search-history-drawer-panel"
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-250 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">Search History</h3>
                  <span
                    id="search-history-count-badge"
                    className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full"
                  >
                    {searchHistory.length} / 10
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Recent unique queries • 1-click re-run
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-close-search-history-drawer"
                data-testid="btn-close-search-history-drawer"
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
                title="Close drawer (Esc)"
                aria-label="Close search history drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Notification Toast when query is re-run */}
          {reRunToast && (
            <div
              id="re-run-search-toast"
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Re-running search: &quot;{reRunToast}&quot;</span>
              </div>
              <span className="text-[10px] bg-emerald-700/80 px-1.5 py-0.5 rounded text-emerald-100">
                Applied
              </span>
            </div>
          )}

          {/* Current Query Action Banner (if active search exists) */}
          {trimmedCurrent && (
            <div className="px-5 py-2.5 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-zinc-600">Active filter:</span>
                <span className="font-mono font-semibold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 truncate">
                  &quot;{trimmedCurrent}&quot;
                </span>
              </div>
              {!isCurrentInHistory && onSaveCurrentQuery && (
                <button
                  type="button"
                  id="btn-save-current-search-to-history"
                  onClick={() => onSaveCurrentQuery(trimmedCurrent)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded transition-colors shrink-0 cursor-pointer"
                  title="Save current search to history"
                >
                  <Plus className="w-3 h-3" />
                  <span>Save</span>
                </button>
              )}
            </div>
          )}

          {/* Toolbar / Action Bar */}
          <div className="px-5 py-2 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500 bg-white">
            <span className="font-medium">
              {searchHistory.length === 0
                ? 'No saved queries'
                : `Last ${searchHistory.length} unique ${searchHistory.length === 1 ? 'query' : 'queries'}`}
            </span>
            {searchHistory.length > 0 && (
              <button
                type="button"
                id="btn-clear-all-search-history"
                data-testid="btn-clear-all-search-history"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline cursor-pointer"
                title="Clear all saved search history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Drawer Body: History Query Items */}
          <div
            id="search-history-drawer-list"
            className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-transparent"
          >
            {searchHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-800 mb-1">No search history yet</h4>
                <p className="text-xs text-zinc-500 max-w-xs mb-4">
                  Searches you execute in the search box are automatically recorded here (up to 10 unique queries).
                </p>
                <div className="w-full text-left bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Try these example searches:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Enterprise License', 'ORD-9824', 'completed', 'acme.com', 'Database Cluster'].map(
                      (sample) => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => handleReRun(sample)}
                          className="text-xs font-mono bg-white hover:bg-emerald-50 border border-zinc-300 hover:border-emerald-300 text-zinc-700 hover:text-emerald-700 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          {sample}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              searchHistory.map((query, index) => {
                const isActive = query.toLowerCase() === trimmedCurrent.toLowerCase();
                return (
                  <div
                    key={`${query}-${index}`}
                    id={`search-history-item-${index}`}
                    data-testid={`search-history-item-${index}`}
                    onClick={() => handleReRun(query)}
                    className={`group relative p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400/40 shadow-2xs'
                        : 'bg-white hover:bg-zinc-50/90 border-zinc-200 hover:border-zinc-300 shadow-2xs'
                    }`}
                    title={`Click to re-run "${query}"`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Rank Index Badge */}
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${
                          index === 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}
                      >
                        #{index + 1}
                      </span>

                      {/* Query Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors truncate">
                            {query}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded-full border border-emerald-200 shrink-0">
                              Latest
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] bg-emerald-600 text-white font-semibold px-1.5 py-0.2 rounded-full shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span>Single-click to re-run</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Re-run button */}
                      <button
                        type="button"
                        id={`btn-rerun-search-${index}`}
                        data-testid={`btn-rerun-search-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReRun(query);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                        title={`Re-run search query "${query}"`}
                      >
                        <RotateCcw className="w-3 h-3 text-emerald-600" />
                        <span>Re-run</span>
                      </button>

                      {/* Delete individual query */}
                      <button
                        type="button"
                        id={`btn-delete-search-history-${index}`}
                        data-testid={`btn-delete-search-history-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveQuery(query);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        title={`Remove "${query}" from search history`}
                        aria-label={`Remove "${query}" from search history`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50/80 text-xs text-zinc-500 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-zinc-600">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Auto-persists last 10 unique searches</span>
              </span>
              <span className="font-mono text-zinc-400 text-[10px]">ESC to close</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Queries are recorded automatically when searching. Re-running any query promotes it to the top of the history stack.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
