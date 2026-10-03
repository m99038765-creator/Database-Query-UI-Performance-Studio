import React, { useEffect, useState } from 'react';
import { Keyboard, X, Zap, Database, Cpu, Layers, Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Play, HelpCircle } from 'lucide-react';
import { OptimizationFlags } from '../types';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flags: OptimizationFlags;
  onToggleFlag: (flag: keyof OptimizationFlags) => void;
  onToggleAll: (enable: boolean) => void;
  onOpenBenchmark?: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  flags,
  onToggleFlag,
  onToggleAll,
  onOpenBenchmark,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'database' | 'ui' | 'system'>('all');
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('⌘');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        parts.push(e.key.toUpperCase());
      }
      if (parts.length > 0) {
        setLastKeyPressed(parts.join(' + '));
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutsList = [
    {
      category: 'database' as const,
      categoryLabel: 'Database & Engine',
      keys: [`${modKey}+I`],
      action: 'Toggle B-Tree Indexing',
      description: 'Switches between B-Tree index range lookups (0.15ms) and unindexed 50k-row sequential table scans (49ms+).',
      flagKey: 'btreeIndexing' as keyof OptimizationFlags,
      status: flags.btreeIndexing,
      icon: Database,
      impact: '320x Latency Reduction'
    },
    {
      category: 'database' as const,
      categoryLabel: 'Database & Engine',
      keys: [`${modKey}+C`, 'Alt+C'],
      action: 'Toggle LRU Query Caching',
      description: 'Activates in-memory LRU cache with deterministic CRC32 hash indexing for instant sub-millisecond query hits.',
      flagKey: 'queryCaching' as keyof OptimizationFlags,
      status: flags.queryCaching,
      icon: Zap,
      impact: 'Sub-ms Instant Response'
    },
    {
      category: 'database' as const,
      categoryLabel: 'Database & Engine',
      keys: [`${modKey}+B`],
      action: 'Toggle Batch Eager Loading',
      description: 'Eliminates N+1 relational query cascades and connection pool timeouts by eager-loading line items in a single batch query.',
      flagKey: 'batchEagerLoading' as keyof OptimizationFlags,
      status: flags.batchEagerLoading,
      icon: Layers,
      impact: 'Prevents Pool Exhaustion'
    },
    {
      category: 'ui' as const,
      categoryLabel: 'UI & Rendering',
      keys: [`${modKey}+V`],
      action: 'Toggle DOM Virtualization',
      description: 'Enables virtual windowing, limiting rendered DOM nodes to 15-20 visible rows instead of heavy 50,000 table elements.',
      flagKey: 'virtualizedDOM' as keyof OptimizationFlags,
      status: flags.virtualizedDOM,
      icon: Cpu,
      impact: 'Maintains 60 FPS Scrolling'
    },
    {
      category: 'ui' as const,
      categoryLabel: 'UI & Rendering',
      keys: [`${modKey}+D`],
      action: 'Toggle Deferred Rendering',
      description: 'Uses React concurrent transitions to prevent input lockup during heavy filtering and state recalculation.',
      flagKey: 'deferredRendering' as keyof OptimizationFlags,
      status: flags.deferredRendering,
      icon: Sparkles,
      impact: 'Non-Blocking Input State'
    },
    {
      category: 'system' as const,
      categoryLabel: 'Global Operations',
      keys: [`${modKey}+Shift+O`],
      action: 'Toggle All Optimizations',
      description: 'Instantly enables all performance flags (Fix All) or disables all to simulate critical production bottlenecks.',
      isToggleAll: true,
      status: Object.values(flags).every(Boolean),
      icon: RefreshCw,
      impact: 'Global State Flip'
    },
    {
      category: 'system' as const,
      categoryLabel: 'Global Operations',
      keys: [`${modKey}+Shift+B`],
      action: 'Run Benchmark Simulation',
      description: 'Executes rapid 10-query stress benchmark measuring average latency, p95/p99 variance, and memory overhead.',
      isBenchmark: true,
      icon: Play,
      impact: 'Performance Audit'
    },
    {
      category: 'system' as const,
      categoryLabel: 'Global Operations',
      keys: [`${modKey}+Shift+F`],
      action: 'Fix All (Ctrl+Shift+F)',
      description: 'Automatically applies all missing indexes and optimization flags suggested by the current state of the ExplainPlanViewer.',
      isToggleAll: true,
      status: Object.values(flags).every(Boolean),
      icon: Sparkles,
      impact: 'Instant Auto-Fix'
    },
    {
      category: 'system' as const,
      categoryLabel: 'Global Operations',
      keys: ['?', 'Shift+/'],
      action: 'Toggle Shortcuts Cheat Sheet',
      description: 'Opens or closes this interactive keyboard shortcut guide and quick-action launcher.',
      icon: HelpCircle,
      impact: 'Quick Reference'
    }
  ];

  const filteredShortcuts = activeTab === 'all'
    ? shortcutsList
    : shortcutsList.filter((s) => s.category === activeTab);

  const allOptimized = Object.values(flags).every(Boolean);

  return (
    <div
      id="modal-keyboard-shortcuts-cheatsheet"
      data-testid="modal-keyboard-shortcuts-cheatsheet"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Keyboard Shortcuts Cheat Sheet
                </h3>
                <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  Global Hotkeys Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Press key combinations anywhere in the app to toggle database optimizations and simulate bottlenecks.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-shortcuts-modal"
            data-testid="btn-close-shortcuts-modal"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close cheat sheet (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Quick Status Bar */}
        <div className="px-5 py-2.5 bg-zinc-950 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({shortcutsList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Database Engine
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ui')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'ui'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              UI &amp; DOM
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              System Actions
            </button>
          </div>

          {lastKeyPressed && (
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
              <span>Last Key:</span>
              <kbd className="bg-zinc-800 text-amber-300 border border-zinc-700 px-2 py-0.5 rounded font-bold shadow-2xs">
                {lastKeyPressed}
              </kbd>
            </div>
          )}
        </div>

        {/* Shortcuts List Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-2.5">
          {filteredShortcuts.map((item, idx) => {
            const Icon = item.icon;
            const hasStatus = typeof item.status === 'boolean';
            const isActive = item.status;

            return (
              <div
                key={idx}
                className="p-3.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-zinc-600 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : hasStatus
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-zinc-100">{item.action}</span>
                      {hasStatus && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-rose-950 text-rose-300 border border-rose-700'
                        }`}>
                          {isActive ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      )}
                      <span className="font-mono text-[10px] bg-zinc-900 text-zinc-400 px-1.5 py-0.2 rounded border border-zinc-700">
                        {item.impact}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Hotkey Badge & Interactive Trigger Button */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="font-mono text-xs font-bold bg-zinc-950 text-amber-300 border border-zinc-700 px-2 py-1 rounded-md shadow-inner tracking-wide"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>

                  {item.flagKey && (
                    <button
                      type="button"
                      id={`btn-shortcut-toggle-${item.flagKey}`}
                      data-testid={`btn-shortcut-toggle-${item.flagKey}`}
                      onClick={() => onToggleFlag(item.flagKey!)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
                        isActive
                          ? 'bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 border-rose-700/60'
                          : 'bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border-emerald-700/60'
                      }`}
                      title={`Simulate shortcut execution for ${item.action}`}
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}

                  {item.isToggleAll && (
                    <button
                      type="button"
                      id="btn-shortcut-toggle-all"
                      data-testid="btn-shortcut-toggle-all"
                      onClick={() => onToggleAll(!allOptimized)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-colors cursor-pointer shadow-xs"
                      title="Toggle all optimization flags"
                    >
                      {allOptimized ? 'Simulate All' : 'Fix All'}
                    </button>
                  )}

                  {item.isBenchmark && (
                    <button
                      type="button"
                      id="btn-shortcut-benchmark"
                      data-testid="btn-shortcut-benchmark"
                      onClick={() => {
                        onClose();
                        onOpenBenchmark?.();
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-xs"
                      title="Open and run benchmark simulation"
                    >
                      Launch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-zinc-400 flex items-center gap-2">
            <span className="font-semibold text-zinc-300">💡 Power Tip:</span>
            <span>Hotkeys work globally across all studio views without focusing controls.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Done (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
