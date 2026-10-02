import { LatencyTrendPoint, OptimizationFlags } from '../types';

export function getInitialTrendHistory(): LatencyTrendPoint[] {
  const now = Date.now();
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const allOn: OptimizationFlags = {
    batchEagerLoading: true,
    btreeIndexing: true,
    queryCaching: true,
    virtualizedDOM: true,
    deferredRendering: true
  };

  const points: LatencyTrendPoint[] = [
    {
      id: 'pt-seed-1',
      timestamp: now - 3600000,
      timeFormatted: formatTime(now - 3600000),
      executionTimeMs: 0.18,
      rowsScanned: 100,
      activeQueriesCount: 1,
      cacheHit: true,
      flags: { ...allOn },
      triggerEvent: 'System Initialized (All Flags Active)',
      simulatedError: null
    },
    {
      id: 'pt-seed-2',
      timestamp: now - 3200000,
      timeFormatted: formatTime(now - 3200000),
      executionTimeMs: 1.48,
      rowsScanned: 2450,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'queryCaching',
      flagToggledState: false,
      deltaMs: 1.30,
      flags: { ...allOn, queryCaching: false },
      triggerEvent: 'Flag queryCaching: OFF (LRU Cache Disabled)',
      simulatedError: null
    },
    {
      id: 'pt-seed-3',
      timestamp: now - 2800000,
      timeFormatted: formatTime(now - 2800000),
      executionTimeMs: 0.16,
      rowsScanned: 100,
      activeQueriesCount: 1,
      cacheHit: true,
      flagToggled: 'queryCaching',
      flagToggledState: true,
      deltaMs: -1.32,
      flags: { ...allOn },
      triggerEvent: 'Flag queryCaching: ON (Cache Restored)',
      simulatedError: null
    },
    {
      id: 'pt-seed-4',
      timestamp: now - 2400000,
      timeFormatted: formatTime(now - 2400000),
      executionTimeMs: 52.40,
      rowsScanned: 50000,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'btreeIndexing',
      flagToggledState: false,
      deltaMs: 52.24,
      flags: { ...allOn, btreeIndexing: false },
      triggerEvent: 'Flag btreeIndexing: OFF (Full Table Scan Regression)',
      simulatedError: null
    },
    {
      id: 'pt-seed-5',
      timestamp: now - 2000000,
      timeFormatted: formatTime(now - 2000000),
      executionTimeMs: 1.25,
      rowsScanned: 2400,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'btreeIndexing',
      flagToggledState: true,
      deltaMs: -51.15,
      flags: { ...allOn },
      triggerEvent: 'Flag btreeIndexing: ON (B-Tree Indexing Restored)',
      simulatedError: null
    },
    {
      id: 'pt-seed-6',
      timestamp: now - 1600000,
      timeFormatted: formatTime(now - 1600000),
      executionTimeMs: 478.60,
      rowsScanned: 50000,
      activeQueriesCount: 101,
      cacheHit: false,
      flagToggled: 'batchEagerLoading',
      flagToggledState: false,
      deltaMs: 477.35,
      flags: { ...allOn, batchEagerLoading: false },
      triggerEvent: 'Flag batchEagerLoading: OFF (Critical N+1 Cascade Regression)',
      simulatedError: 'Database Connection Pool Timeout: max_connections (25) exceeded!'
    },
    {
      id: 'pt-seed-7',
      timestamp: now - 1200000,
      timeFormatted: formatTime(now - 1200000),
      executionTimeMs: 1.35,
      rowsScanned: 2400,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'batchEagerLoading',
      flagToggledState: true,
      deltaMs: -477.25,
      flags: { ...allOn },
      triggerEvent: 'Flag batchEagerLoading: ON (N+1 Query Elimination)',
      simulatedError: null
    },
    {
      id: 'pt-seed-8',
      timestamp: now - 850000,
      timeFormatted: formatTime(now - 850000),
      executionTimeMs: 19.80,
      rowsScanned: 50000,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'virtualizedDOM',
      flagToggledState: false,
      deltaMs: 18.45,
      flags: { ...allOn, virtualizedDOM: false },
      triggerEvent: 'Flag virtualizedDOM: OFF (DOM Node Sprawl Penalty)',
      simulatedError: null
    },
    {
      id: 'pt-seed-9',
      timestamp: now - 600000,
      timeFormatted: formatTime(now - 600000),
      executionTimeMs: 1.18,
      rowsScanned: 100,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'virtualizedDOM',
      flagToggledState: true,
      deltaMs: -18.62,
      flags: { ...allOn },
      triggerEvent: 'Flag virtualizedDOM: ON (DOM Windowing Restored)',
      simulatedError: null
    },
    {
      id: 'pt-seed-10',
      timestamp: now - 400000,
      timeFormatted: formatTime(now - 400000),
      executionTimeMs: 4.10,
      rowsScanned: 2400,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'deferredRendering',
      flagToggledState: false,
      deltaMs: 2.92,
      flags: { ...allOn, deferredRendering: false },
      triggerEvent: 'Flag deferredRendering: OFF (Synchronous Render)',
      simulatedError: null
    },
    {
      id: 'pt-seed-11',
      timestamp: now - 200000,
      timeFormatted: formatTime(now - 200000),
      executionTimeMs: 1.15,
      rowsScanned: 2400,
      activeQueriesCount: 1,
      cacheHit: false,
      flagToggled: 'deferredRendering',
      flagToggledState: true,
      deltaMs: -2.95,
      flags: { ...allOn },
      triggerEvent: 'Flag deferredRendering: ON (Concurrent Render)',
      simulatedError: null
    },
    {
      id: 'pt-seed-12',
      timestamp: now - 30000,
      timeFormatted: formatTime(now - 30000),
      executionTimeMs: 0.15,
      rowsScanned: 100,
      activeQueriesCount: 1,
      cacheHit: true,
      flags: { ...allOn },
      deltaMs: -1.00,
      triggerEvent: 'Production Steady State (Sub-ms Cache Hit)',
      simulatedError: null
    }
  ];

  return points;
}
