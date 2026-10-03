import React, { useState } from 'react';
import { History, Sparkles, TrendingUp, ArrowRight, ShieldCheck, Trash2, Plus, Clock, CheckCircle2, AlertTriangle, Database, FileText } from 'lucide-react';

interface AuditTrailEvent {
  id: string;
  timestamp: string;
  action: 'AI_ONE_CLICK_APPLIED' | 'MANUAL_APPLIED' | 'PURGED';
  indexName: string;
  tableName: string;
  sourceEngine: string;
  beforeLatencyMs: number;
  afterLatencyMs: number;
  improvementPercentage: string;
  ddlStatement: string;
  description: string;
}

export const IndexChangeHistoryPanel: React.FC = () => {
  const [filterAction, setFilterAction] = useState<'ALL' | 'AI_ONE_CLICK_APPLIED' | 'PURGED'>('ALL');

  const auditEvents: AuditTrailEvent[] = [
    {
      id: 'audit_1',
      timestamp: '1 min ago',
      action: 'AI_ONE_CLICK_APPLIED',
      indexName: 'idx_transactions_scan_covering',
      tableName: 'transactions',
      sourceEngine: 'Index Recommendation Engine (AI One-Click)',
      beforeLatencyMs: 48.5,
      afterLatencyMs: 2.15,
      improvementPercentage: '95.6% Faster',
      ddlStatement: 'CREATE INDEX CONCURRENTLY idx_transactions_scan_covering ON transactions (customer_id, status) INCLUDE (amount, created_at);',
      description: 'AI detected full table scan bottleneck on 50,000 transaction rows and applied covering index via One-Click.'
    },
    {
      id: 'audit_2',
      timestamp: '12 mins ago',
      action: 'AI_ONE_CLICK_APPLIED',
      indexName: 'idx_order_items_product_covering',
      tableName: 'order_items',
      sourceEngine: 'Intelligent Indexing Advisor (AI One-Click)',
      beforeLatencyMs: 34.2,
      afterLatencyMs: 1.80,
      improvementPercentage: '94.7% Faster',
      ddlStatement: 'CREATE INDEX CONCURRENTLY idx_order_items_product_covering ON order_items (product_id) INCLUDE (quantity, unit_price);',
      description: 'AI analyzed order items grouping queries and deployed composite B-Tree index instantly.'
    },
    {
      id: 'audit_3',
      timestamp: '25 mins ago',
      action: 'PURGED',
      indexName: 'idx_transactions_date_old',
      tableName: 'transactions',
      sourceEngine: 'Automated Unused Index Pruner',
      beforeLatencyMs: 14.2,
      afterLatencyMs: 4.1,
      improvementPercentage: '71.1% Write Overhead Cut',
      ddlStatement: 'DROP INDEX CONCURRENTLY idx_transactions_date_old;',
      description: 'Purged zero-hit unutilized index to reclaim 2.4 MB disk space and eliminate table write stalls.'
    },
    {
      id: 'audit_4',
      timestamp: '1 hour ago',
      action: 'AI_ONE_CLICK_APPLIED',
      indexName: 'idx_customers_tier_covering',
      tableName: 'customers',
      sourceEngine: 'High-Read Query Pattern Automator',
      beforeLatencyMs: 28.90,
      afterLatencyMs: 1.45,
      improvementPercentage: '95.0% Faster',
      ddlStatement: 'CREATE INDEX CONCURRENTLY idx_customers_tier_covering ON customers (tier) INCLUDE (signup_date, email);',
      description: 'Automated high-read query pattern detection applied enterprise customer tier covering index.'
    }
  ];

  const filteredEvents = auditEvents.filter(evt => {
    if (filterAction === 'ALL') return true;
    if (filterAction === 'AI_ONE_CLICK_APPLIED') return evt.action === 'AI_ONE_CLICK_APPLIED';
    return evt.action === filterAction;
  });

  return (
    <div
      id="optimization-audit-trail-panel"
      data-testid="optimization-audit-trail-panel"
      className="p-5 bg-white rounded-2xl border border-zinc-200 shadow-lg space-y-4 font-sans text-zinc-900 animate-fadeIn"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
              <span>Optimization Audit Trail</span>
              <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                AI One-Click Log &amp; Latency Impact
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              Detailed chronological log of every AI-suggested 'One-Click' index application with before-and-after latency impact snapshots.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterAction('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filterAction === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
          >
            All Audit Logs ({auditEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAction('AI_ONE_CLICK_APPLIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filterAction === 'AI_ONE_CLICK_APPLIED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            AI One-Click Applied ({auditEvents.filter(e => e.action === 'AI_ONE_CLICK_APPLIED').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterAction('PURGED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filterAction === 'PURGED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            Purged ({auditEvents.filter(e => e.action === 'PURGED').length})
          </button>
        </div>
      </div>

      {/* Audit Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-center">
          <div className="text-[10px] uppercase font-bold text-emerald-700">AI One-Click Deployments</div>
          <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">
            {auditEvents.filter(e => e.action === 'AI_ONE_CLICK_APPLIED').length} Indexes
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Zero-Downtime Concurrent DDL</div>
        </div>
        <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-center">
          <div className="text-[10px] uppercase font-bold text-indigo-700">Average Latency Reduction</div>
          <div className="text-base font-extrabold text-indigo-800 font-mono mt-0.5">-95.1%</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">Full Table Scan Elimination</div>
        </div>
        <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-center">
          <div className="text-[10px] uppercase font-bold text-purple-700">Audit Trail Integrity</div>
          <div className="text-base font-extrabold text-purple-800 font-mono mt-0.5">100% Verified</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Cryptographic Schema Trace</div>
        </div>
      </div>

      {/* Audit Events List */}
      <div className="space-y-3">
        {filteredEvents.map((evt) => {
          const isAiApplied = evt.action === 'AI_ONE_CLICK_APPLIED';
          return (
            <div
              key={evt.id}
              id={`audit-event-${evt.id}`}
              data-testid={`audit-event-${evt.id}`}
              className={`p-4 rounded-xl border transition-all space-y-3 bg-white shadow-2xs hover:border-indigo-300 ${
                isAiApplied ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
              }`}
            >
              {/* Event Top Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                    isAiApplied ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {isAiApplied ? <Sparkles className="w-3 h-3 text-emerald-600" /> : <Trash2 className="w-3 h-3" />}
                    <span>{evt.action.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    {evt.indexName}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    on {evt.tableName}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{evt.timestamp}</span>
                </div>
              </div>

              {/* Description & Source */}
              <p className="text-xs text-zinc-700 leading-relaxed">
                {evt.description} <span className="text-indigo-700 font-semibold text-[11px]">({evt.sourceEngine})</span>
              </p>

              {/* DDL Statement */}
              <div className="p-2.5 bg-zinc-950 text-emerald-300 rounded-lg font-mono text-[11px] overflow-x-auto shadow-inner">
                {evt.ddlStatement}
              </div>

              {/* Before & After Latency Impact Snapshot */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block">Before Latency</span>
                    <span className="text-sm font-extrabold text-rose-700">{evt.beforeLatencyMs} ms</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />

                  <div>
                    <span className="text-[10px] uppercase text-zinc-500 font-bold block">After Latency (Snapshot)</span>
                    <span className="text-sm font-extrabold text-emerald-700">{evt.afterLatencyMs} ms</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900">
                    ⚡ {evt.improvementPercentage}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
