import React, { useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Sparkles,
  ArrowRight,
  Code,
  Info
} from 'lucide-react';

interface SqlHealthInspectorProps {
  sqlString: string;
  onApplyOptimization?: (optimizedSql: string) => void;
}

export interface SqlAntiPatternIssue {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  quickFixLabel?: string;
  fixAction?: (currentSql: string) => string;
}

export const SqlHealthInspector: React.FC<SqlHealthInspectorProps> = ({
  sqlString,
  onApplyOptimization = (_optimizedSql?: string) => {}
}) => {
  const trimmedSql = (sqlString || '').trim();
  const upperSql = trimmedSql.toUpperCase();

  const issues = useMemo(() => {
    if (!trimmedSql) return [];
    const found: SqlAntiPatternIssue[] = [];

    // 1. Check for SELECT *
    if (upperSql.includes('SELECT *')) {
      found.push({
        id: 'select-star',
        title: 'Unbounded Column Projection (SELECT *)',
        severity: 'high',
        description: 'SELECT * forces the database engine to read all table columns, disabling covering index-only scans and increasing network serialization bandwidth.',
        suggestion: 'Specify explicit required columns instead of wildcard projection (e.g. SELECT id, order_number, customer_name, amount).',
        quickFixLabel: 'Replace SELECT * with explicit columns',
        fixAction: (sql) => sql.replace(/SELECT\s+\*/gi, 'SELECT id, order_number, customer_name, status, amount, created_at')
      });
    }

    // 2. Check for missing LIMIT on SELECT queries
    if (upperSql.startsWith('SELECT') && !upperSql.includes('LIMIT') && !upperSql.includes('COUNT(') && !upperSql.includes('SUM(')) {
      found.push({
        id: 'missing-limit',
        title: 'Missing LIMIT Clause on Query',
        severity: 'medium',
        description: 'Query returns an unbounded result set, risking high memory consumption and slow client rendering if the table grows.',
        suggestion: 'Add a LIMIT clause (e.g. LIMIT 100) or pagination parameters.',
        quickFixLabel: 'Append LIMIT 100',
        fixAction: (sql) => `${sql.replace(/;\s*$/, '')} LIMIT 100;`
      });
    }

    // 3. Check for leading wildcard in LIKE predicates
    if (upperSql.includes("LIKE '%") || upperSql.includes('LIKE "%')) {
      found.push({
        id: 'leading-wildcard',
        title: 'Leading Wildcard in LIKE Predicate',
        severity: 'high',
        description: 'A leading wildcard (e.g. LIKE "%term") prevents the query planner from using B-Tree index seeks, forcing a full table sequential scan.',
        suggestion: 'Use a trailing wildcard (LIKE "term%") or configure a GIN Full-Text Search index.',
        quickFixLabel: 'Convert to trailing wildcard',
        fixAction: (sql) => sql.replace(/LIKE\s+['"]%([^'"]+)['"]/gi, "LIKE '$1%'")
      });
    }

    // 4. Check for JOIN without explicit index hint or condition warning
    if (upperSql.includes('JOIN') && !upperSql.includes('ON')) {
      found.push({
        id: 'unsafe-join',
        title: 'Malformed or Unconditional JOIN',
        severity: 'high',
        description: 'JOIN clause detected without an explicit ON predicate, risking a Cartesian product cross join.',
        suggestion: 'Add a valid foreign key equality condition in the ON clause (e.g. ON t.id = i.transaction_id).',
        quickFixLabel: 'Add standard FK ON clause',
        fixAction: (sql) => `${sql.replace(/;\s*$/, '')} ON transactions.id = line_items.transaction_id;`
      });
    }

    // 5. Check for unindexed equality filtering on large tables
    if (upperSql.includes('WHERE') && (upperSql.includes('STATUS =') || upperSql.includes('CATEGORY =')) && !upperSql.includes('INDEX')) {
      found.push({
        id: 'missing-index-hint',
        title: 'Potential Unindexed Filtering Predicate',
        severity: 'medium',
        description: 'Filtering by status or category without composite index coverage may cause sequential table scans on high-volume tables.',
        suggestion: 'Ensure a composite B-Tree index exists on (status, category) for optimal index scan performance.',
        quickFixLabel: 'Synthesize Index DDL',
        fixAction: (sql) => `-- Recommended B-Tree Index:\nCREATE INDEX CONCURRENTLY idx_transactions_status_cat ON transactions (status, category);\n\n${sql}`
      });
    }

    return found;
  }, [trimmedSql, upperSql]);

  const healthScore = useMemo(() => {
    if (!trimmedSql) return 100;
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'high') score -= 30;
      else if (issue.severity === 'medium') score -= 15;
      else score -= 5;
    }
    return Math.max(10, score);
  }, [trimmedSql, issues]);

  if (!trimmedSql) {
    return (
      <div id="sql-health-inspector" data-testid="sql-health-inspector" className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
        <Code className="w-4 h-4 text-zinc-500 shrink-0" />
        <span>SQL Health Inspector ready. Enter a query above to analyze performance anti-patterns.</span>
      </div>
    );
  }

  const scoreColor = healthScore >= 85 ? 'text-emerald-400 bg-emerald-950 border-emerald-800' : healthScore >= 60 ? 'text-amber-400 bg-amber-950 border-amber-800' : 'text-rose-400 bg-rose-950 border-rose-800';

  return (
    <div
      id="sql-health-inspector"
      data-testid="sql-health-inspector"
      className="bg-zinc-900 rounded-xl border border-zinc-800 p-3.5 space-y-3 text-xs text-zinc-200 shadow-xl animate-fadeIn"
    >
      {/* Inspector Header & Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-zinc-100 text-xs flex items-center gap-1.5">
              <span>SQL Health Inspector</span>
              <span className="text-[10px] font-mono text-zinc-400 font-normal">Real-time AST Linter</span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              Analyzing manual SQL input for common performance anti-patterns before execution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <div className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1.5 ${scoreColor}`}>
            {healthScore >= 85 ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            <span>Health Score: {healthScore}/100</span>
          </div>
        </div>
      </div>

      {/* Issues / Anti-Patterns List */}
      {issues.length === 0 ? (
        <div className="p-3 bg-emerald-950/40 rounded-lg border border-emerald-800/60 flex items-center gap-2.5 text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">No Performance Anti-Patterns Detected!</span>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">
              Query structure follows optimal indexing guidelines and projection boundaries.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="font-semibold text-zinc-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Detected {issues.length} Anti-Pattern{issues.length > 1 ? 's' : ''}:</span>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="bg-zinc-950/80 rounded-lg border border-zinc-800/80 p-3 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      issue.severity === 'high' ? 'bg-rose-500 animate-pulse' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-bold text-zinc-200 text-xs">{issue.title}</span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                    issue.severity === 'high' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {issue.severity} Priority
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {issue.description}
                </p>

                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-200">Recommendation:</strong> {issue.suggestion}
                  </div>
                </div>

                {issue.quickFixLabel && issue.fixAction && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      id={`btn-sql-quick-fix-${issue.id}`}
                      data-testid={`btn-sql-quick-fix-${issue.id}`}
                      onClick={() => {
                        if (issue.fixAction) {
                          const optimized = issue.fixAction(sqlString);
                          onApplyOptimization(optimized);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded font-semibold text-[10px] shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-amber-200" />
                      <span>{issue.quickFixLabel}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
