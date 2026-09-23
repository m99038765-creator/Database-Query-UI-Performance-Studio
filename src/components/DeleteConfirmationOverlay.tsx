import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, Trash2, Database, HardDrive, Package, X, Layers, AlertCircle } from 'lucide-react';
import { TransactionRecord } from '../types';

export interface DeleteConfirmationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedRecords: TransactionRecord[];
  totalDatabaseRecords: number;
}

export const DeleteConfirmationOverlay: React.FC<DeleteConfirmationOverlayProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedRecords,
  totalDatabaseRecords
}) => {
  // Platform check for shortcut labels
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || navigator.platform);

  // Handle Escape key to dismiss, and Ctrl+Backspace / Enter to confirm
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      if ((isModifier && e.key === 'Backspace') || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isOpen, onClose, onConfirm]);

  // Compute detailed system impact metrics
  const impactStats = useMemo(() => {
    const count = selectedRecords.length;
    let totalItems = 0;
    let totalAmount = 0;

    for (const r of selectedRecords) {
      totalItems += r.items && r.items.length > 0 ? r.items.length : (r.itemCount || 1);
      totalAmount += r.amount || 0;
    }

    // Average serialized record + B-Tree index node footprint: ~512 bytes per record
    const estimatedBytes = count * 512;
    const bytesFormatted =
      estimatedBytes >= 1024 * 1024
        ? `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(estimatedBytes / 1024).toFixed(1)} KB`;

    const remainingRecords = Math.max(0, totalDatabaseRecords - count);

    return {
      count,
      totalItems,
      totalAmount,
      bytesFormatted,
      remainingRecords
    };
  }, [selectedRecords, totalDatabaseRecords]);

  if (!isOpen || selectedRecords.length === 0) {
    return null;
  }

  return (
    <div
      id="delete-confirmation-overlay"
      data-testid="delete-confirmation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirmation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        id="delete-confirmation-modal"
        data-testid="delete-confirmation-modal"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-rose-50/90 border-b border-rose-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                id="delete-confirmation-title"
                className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2"
              >
                <span>Are you sure?</span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-800 border border-rose-300/80">
                  Irreversible
                </span>
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                Confirm batch deletion of marked transaction records
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-delete-confirmation"
            data-testid="btn-close-delete-confirmation"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-rose-100/60 transition-colors cursor-pointer"
            title="Cancel and close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs text-zinc-700">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              You are about to permanently remove{' '}
              <span className="text-rose-600 font-bold font-mono">
                {impactStats.count.toLocaleString()}
              </span>{' '}
              record{impactStats.count === 1 ? '' : 's'} from the active database.
            </p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              These records will be purged from primary table storage, secondary B-Tree indexes, and fast lookup caches.
            </p>
          </div>

          {/* Sample Order IDs preview */}
          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-600 mb-1.5 flex items-center justify-between">
              <span>Selected Records to Remove:</span>
              <span className="font-mono text-zinc-500">
                {impactStats.count} total
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedRecords.slice(0, 6).map((r) => (
                <span
                  key={r.id}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 shadow-2xs"
                >
                  {r.orderNumber}
                </span>
              ))}
              {selectedRecords.length > 6 && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-200 text-zinc-600 font-medium">
                  +{selectedRecords.length - 6} more
                </span>
              )}
            </div>
          </div>

          {/* Total System Impact Breakdown */}
          <div className="p-3.5 bg-zinc-900 text-zinc-200 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-rose-400" />
                Total System Impact
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                Indexed Storage Audit
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Impact Metric 1: Records removed from indexed storage */}
              <div className="space-y-0.5">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-rose-400" />
                  <span>Indexed Storage</span>
                </div>
                <div
                  id="impact-records-removed"
                  data-testid="impact-records-removed"
                  className="font-bold text-rose-300 font-mono text-xs"
                >
                  -{impactStats.count.toLocaleString()} records removed
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {totalDatabaseRecords.toLocaleString()} → {impactStats.remainingRecords.toLocaleString()} total
                </div>
              </div>

              {/* Impact Metric 2: Estimated memory footprint freed */}
              <div className="space-y-0.5">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>Memory Reclaimed</span>
                </div>
                <div
                  id="impact-memory-reclaimed"
                  data-testid="impact-memory-reclaimed"
                  className="font-bold text-emerald-400 font-mono text-xs"
                >
                  ~{impactStats.bytesFormatted} freed
                </div>
                <div className="text-[10px] text-zinc-500">
                  Compacted leaf pages &amp; cache
                </div>
              </div>

              {/* Impact Metric 3: Associated Line Items */}
              <div className="space-y-0.5">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Package className="w-3 h-3 text-amber-400" />
                  <span>Relational Line Items</span>
                </div>
                <div
                  id="impact-items-unlinked"
                  data-testid="impact-items-unlinked"
                  className="font-bold text-zinc-200 font-mono text-xs"
                >
                  {impactStats.totalItems.toLocaleString()} SKUs unlinked
                </div>
                <div className="text-[10px] text-zinc-500">
                  Purged from DB_ITEMS_MAP
                </div>
              </div>

              {/* Impact Metric 4: Transaction Value Purged */}
              <div className="space-y-0.5">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>Transaction Value</span>
                </div>
                <div
                  id="impact-volume-purged"
                  data-testid="impact-volume-purged"
                  className="font-bold text-zinc-200 font-mono text-xs"
                >
                  ${impactStats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-zinc-500">
                  Purged from ledger volume
                </div>
              </div>
            </div>
          </div>

          {/* Irreversible notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              <strong>Data Safety Note:</strong> Once confirmed, secondary B-Tree indices will re-synchronize immediately. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-3">
          <button
            type="button"
            id="btn-cancel-batch-delete"
            data-testid="btn-cancel-batch-delete"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-medium text-xs transition-colors cursor-pointer"
            title="Cancel deletion (Esc)"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-batch-delete"
            data-testid="btn-confirm-batch-delete"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer focus:ring-2 focus:ring-rose-500/40"
            title={`Confirm batch deletion (${isMac ? '⌘Backspace' : 'Ctrl+Backspace'} or Enter)`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              Yes, Delete {impactStats.count.toLocaleString()} Record{impactStats.count === 1 ? '' : 's'}
            </span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-700 text-rose-100 border border-rose-400/50 shadow-2xs font-semibold ml-1">
              {isMac ? '⌘⌫' : 'Ctrl+⌫'}
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
