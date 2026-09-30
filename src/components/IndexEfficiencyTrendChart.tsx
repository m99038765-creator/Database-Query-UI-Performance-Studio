import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Sparkles,
  BarChart2,
  ArrowRight,
  CheckCircle2,
  Info,
  Layers,
  RotateCcw,
  Sliders,
  ChevronDown,
  Database,
  Target
} from 'lucide-react';

export interface EfficiencyTrendPoint {
  id: string;
  timeLabel: string;
  hourOffset: number;
  timestamp: number;
  usageFrequencyPerHour: number; // e.g., 420 to 11500
  latencyBeforeMs: number;       // e.g., 395 to 512
  latencyAfterMs: number;        // e.g., 142 down to 1.4
  latencyReductionPercent: number; // (before - after) / before * 100
  latencySavedMs: number;        // before - after
  speedupMultiplier: number;     // before / after
  bufferPoolHitRate: number;     // % in buffer cache
  writeMaintenanceCostMs: number; // wal write cost
}

export interface IndexEfficiencyProfile {
  id: string;
  name: string;
  targetTable: string;
  type: string;
  isApplied: boolean;
  baseLatencyMs: number;
  optimizedLatencyMs: number;
  correlationCoeff: number;
  keyQuery: string;
  description: string;
  trend24h: EfficiencyTrendPoint[];
  trend7d: EfficiencyTrendPoint[];
  trend30d: EfficiencyTrendPoint[];
}

export const DEFAULT_INDEX_PROFILES: Record<string, IndexEfficiencyProfile> = {
  idx_transactions_email_status: {
    id: 'idx_transactions_email_status',
    name: 'idx_transactions_email_status',
    targetTable: 'transactions',
    type: 'Composite B-Tree',
    isApplied: true,
    baseLatencyMs: 395.0,
    optimizedLatencyMs: 1.6,
    correlationCoeff: 0.96,
    keyQuery: 'SELECT * FROM transactions WHERE customer_email = $1 AND status = $2',
    description: 'Covers high-frequency email lookups filtered by status. Higher query volume yields deeper buffer pool caching and amortized latency reductions.',
    trend24h: [
      { id: 'p0', timeLabel: '24h ago', hourOffset: 24, timestamp: Date.now() - 86400000, usageFrequencyPerHour: 540, latencyBeforeMs: 388.0, latencyAfterMs: 138.0, latencyReductionPercent: 64.4, latencySavedMs: 250.0, speedupMultiplier: 2.8, bufferPoolHitRate: 62.0, writeMaintenanceCostMs: 0.8 },
      { id: 'p1', timeLabel: '18h ago', hourOffset: 18, timestamp: Date.now() - 64800000, usageFrequencyPerHour: 1120, latencyBeforeMs: 402.0, latencyAfterMs: 82.0, latencyReductionPercent: 79.6, latencySavedMs: 320.0, speedupMultiplier: 4.9, bufferPoolHitRate: 74.5, writeMaintenanceCostMs: 0.9 },
      { id: 'p2', timeLabel: '12h ago', hourOffset: 12, timestamp: Date.now() - 43200000, usageFrequencyPerHour: 2850, latencyBeforeMs: 418.0, latencyAfterMs: 28.5, latencyReductionPercent: 93.2, latencySavedMs: 389.5, speedupMultiplier: 14.7, bufferPoolHitRate: 88.0, writeMaintenanceCostMs: 1.1 },
      { id: 'p3', timeLabel: '8h ago', hourOffset: 8, timestamp: Date.now() - 28800000, usageFrequencyPerHour: 4900, latencyBeforeMs: 435.0, latencyAfterMs: 11.2, latencyReductionPercent: 97.4, latencySavedMs: 423.8, speedupMultiplier: 38.8, bufferPoolHitRate: 94.2, writeMaintenanceCostMs: 1.2 },
      { id: 'p4', timeLabel: '4h ago', hourOffset: 4, timestamp: Date.now() - 14400000, usageFrequencyPerHour: 7450, latencyBeforeMs: 462.0, latencyAfterMs: 3.4, latencyReductionPercent: 99.3, latencySavedMs: 458.6, speedupMultiplier: 135.9, bufferPoolHitRate: 97.8, writeMaintenanceCostMs: 1.4 },
      { id: 'p5', timeLabel: '1h ago', hourOffset: 1, timestamp: Date.now() - 3600000, usageFrequencyPerHour: 9800, latencyBeforeMs: 489.0, latencyAfterMs: 1.9, latencyReductionPercent: 99.6, latencySavedMs: 487.1, speedupMultiplier: 257.4, bufferPoolHitRate: 99.1, writeMaintenanceCostMs: 1.5 },
      { id: 'p6', timeLabel: 'Current', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 12400, latencyBeforeMs: 518.0, latencyAfterMs: 1.5, latencyReductionPercent: 99.7, latencySavedMs: 516.5, speedupMultiplier: 345.3, bufferPoolHitRate: 99.6, writeMaintenanceCostMs: 1.6 }
    ],
    trend7d: [
      { id: 'd0', timeLabel: 'Day 1', hourOffset: 168, timestamp: Date.now() - 604800000, usageFrequencyPerHour: 850, latencyBeforeMs: 380.0, latencyAfterMs: 120.0, latencyReductionPercent: 68.4, latencySavedMs: 260.0, speedupMultiplier: 3.2, bufferPoolHitRate: 66.0, writeMaintenanceCostMs: 0.9 },
      { id: 'd1', timeLabel: 'Day 2', hourOffset: 144, timestamp: Date.now() - 518400000, usageFrequencyPerHour: 1800, latencyBeforeMs: 395.0, latencyAfterMs: 65.0, latencyReductionPercent: 83.5, latencySavedMs: 330.0, speedupMultiplier: 6.1, bufferPoolHitRate: 78.0, writeMaintenanceCostMs: 1.0 },
      { id: 'd2', timeLabel: 'Day 3', hourOffset: 120, timestamp: Date.now() - 432000000, usageFrequencyPerHour: 3400, latencyBeforeMs: 410.0, latencyAfterMs: 24.0, latencyReductionPercent: 94.1, latencySavedMs: 386.0, speedupMultiplier: 17.1, bufferPoolHitRate: 89.0, writeMaintenanceCostMs: 1.1 },
      { id: 'd3', timeLabel: 'Day 4', hourOffset: 96, timestamp: Date.now() - 345600000, usageFrequencyPerHour: 5200, latencyBeforeMs: 425.0, latencyAfterMs: 9.5, latencyReductionPercent: 97.8, latencySavedMs: 415.5, speedupMultiplier: 44.7, bufferPoolHitRate: 95.0, writeMaintenanceCostMs: 1.3 },
      { id: 'd4', timeLabel: 'Day 5', hourOffset: 72, timestamp: Date.now() - 259200000, usageFrequencyPerHour: 7100, latencyBeforeMs: 450.0, latencyAfterMs: 3.8, latencyReductionPercent: 99.2, latencySavedMs: 446.2, speedupMultiplier: 118.4, bufferPoolHitRate: 98.0, writeMaintenanceCostMs: 1.4 },
      { id: 'd5', timeLabel: 'Day 6', hourOffset: 48, timestamp: Date.now() - 172800000, usageFrequencyPerHour: 9500, latencyBeforeMs: 480.0, latencyAfterMs: 2.1, latencyReductionPercent: 99.6, latencySavedMs: 477.9, speedupMultiplier: 228.6, bufferPoolHitRate: 99.2, writeMaintenanceCostMs: 1.5 },
      { id: 'd6', timeLabel: 'Today', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 12400, latencyBeforeMs: 518.0, latencyAfterMs: 1.5, latencyReductionPercent: 99.7, latencySavedMs: 516.5, speedupMultiplier: 345.3, bufferPoolHitRate: 99.6, writeMaintenanceCostMs: 1.6 }
    ],
    trend30d: [
      { id: 'm0', timeLabel: 'Wk 1', hourOffset: 720, timestamp: Date.now() - 2592000000, usageFrequencyPerHour: 1200, latencyBeforeMs: 375.0, latencyAfterMs: 88.0, latencyReductionPercent: 76.5, latencySavedMs: 287.0, speedupMultiplier: 4.3, bufferPoolHitRate: 72.0, writeMaintenanceCostMs: 0.9 },
      { id: 'm1', timeLabel: 'Wk 2', hourOffset: 504, timestamp: Date.now() - 1814400000, usageFrequencyPerHour: 3600, latencyBeforeMs: 405.0, latencyAfterMs: 21.0, latencyReductionPercent: 94.8, latencySavedMs: 384.0, speedupMultiplier: 19.3, bufferPoolHitRate: 90.0, writeMaintenanceCostMs: 1.2 },
      { id: 'm2', timeLabel: 'Wk 3', hourOffset: 288, timestamp: Date.now() - 1036800000, usageFrequencyPerHour: 7800, latencyBeforeMs: 440.0, latencyAfterMs: 4.2, latencyReductionPercent: 99.0, latencySavedMs: 435.8, speedupMultiplier: 104.8, bufferPoolHitRate: 97.5, writeMaintenanceCostMs: 1.4 },
      { id: 'm3', timeLabel: 'Wk 4', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 12400, latencyBeforeMs: 518.0, latencyAfterMs: 1.5, latencyReductionPercent: 99.7, latencySavedMs: 516.5, speedupMultiplier: 345.3, bufferPoolHitRate: 99.6, writeMaintenanceCostMs: 1.6 }
    ]
  },
  idx_transactions_category_amount: {
    id: 'idx_transactions_category_amount',
    name: 'idx_transactions_category_amount',
    targetTable: 'transactions',
    type: 'Composite B-Tree',
    isApplied: true,
    baseLatencyMs: 480.0,
    optimizedLatencyMs: 2.1,
    correlationCoeff: 0.94,
    keyQuery: 'SELECT category, SUM(amount) FROM transactions GROUP BY category ORDER BY amount DESC',
    description: 'Avoids costly external sort passes on disk. Efficiency scales with grouped query concurrency as B-Tree leaf pages remain pin-locked in shared buffers.',
    trend24h: [
      { id: 'p0', timeLabel: '24h ago', hourOffset: 24, timestamp: Date.now() - 86400000, usageFrequencyPerHour: 410, latencyBeforeMs: 460.0, latencyAfterMs: 185.0, latencyReductionPercent: 59.8, latencySavedMs: 275.0, speedupMultiplier: 2.5, bufferPoolHitRate: 58.0, writeMaintenanceCostMs: 1.1 },
      { id: 'p1', timeLabel: '18h ago', hourOffset: 18, timestamp: Date.now() - 64800000, usageFrequencyPerHour: 950, latencyBeforeMs: 472.0, latencyAfterMs: 98.0, latencyReductionPercent: 79.2, latencySavedMs: 374.0, speedupMultiplier: 4.8, bufferPoolHitRate: 72.0, writeMaintenanceCostMs: 1.2 },
      { id: 'p2', timeLabel: '12h ago', hourOffset: 12, timestamp: Date.now() - 43200000, usageFrequencyPerHour: 2200, latencyBeforeMs: 490.0, latencyAfterMs: 36.0, latencyReductionPercent: 92.7, latencySavedMs: 454.0, speedupMultiplier: 13.6, bufferPoolHitRate: 85.0, writeMaintenanceCostMs: 1.3 },
      { id: 'p3', timeLabel: '8h ago', hourOffset: 8, timestamp: Date.now() - 28800000, usageFrequencyPerHour: 4300, latencyBeforeMs: 510.0, latencyAfterMs: 14.5, latencyReductionPercent: 97.2, latencySavedMs: 495.5, speedupMultiplier: 35.2, bufferPoolHitRate: 92.0, writeMaintenanceCostMs: 1.4 },
      { id: 'p4', timeLabel: '4h ago', hourOffset: 4, timestamp: Date.now() - 14400000, usageFrequencyPerHour: 6200, latencyBeforeMs: 535.0, latencyAfterMs: 5.2, latencyReductionPercent: 99.0, latencySavedMs: 529.8, speedupMultiplier: 102.9, bufferPoolHitRate: 96.5, writeMaintenanceCostMs: 1.6 },
      { id: 'p5', timeLabel: '1h ago', hourOffset: 1, timestamp: Date.now() - 3600000, usageFrequencyPerHour: 8100, latencyBeforeMs: 560.0, latencyAfterMs: 2.8, latencyReductionPercent: 99.5, latencySavedMs: 557.2, speedupMultiplier: 200.0, bufferPoolHitRate: 98.4, writeMaintenanceCostMs: 1.7 },
      { id: 'p6', timeLabel: 'Current', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 9850, latencyBeforeMs: 585.0, latencyAfterMs: 2.1, latencyReductionPercent: 99.6, latencySavedMs: 582.9, speedupMultiplier: 278.6, bufferPoolHitRate: 99.2, writeMaintenanceCostMs: 1.8 }
    ],
    trend7d: [
      { id: 'd0', timeLabel: 'Day 1', hourOffset: 168, timestamp: Date.now() - 604800000, usageFrequencyPerHour: 650, latencyBeforeMs: 440.0, latencyAfterMs: 160.0, latencyReductionPercent: 63.6, latencySavedMs: 280.0, speedupMultiplier: 2.8, bufferPoolHitRate: 60.0, writeMaintenanceCostMs: 1.1 },
      { id: 'd1', timeLabel: 'Day 2', hourOffset: 144, timestamp: Date.now() - 518400000, usageFrequencyPerHour: 1500, latencyBeforeMs: 460.0, latencyAfterMs: 78.0, latencyReductionPercent: 83.0, latencySavedMs: 382.0, speedupMultiplier: 5.9, bufferPoolHitRate: 75.0, writeMaintenanceCostMs: 1.2 },
      { id: 'd2', timeLabel: 'Day 3', hourOffset: 120, timestamp: Date.now() - 432000000, usageFrequencyPerHour: 2800, latencyBeforeMs: 480.0, latencyAfterMs: 31.0, latencyReductionPercent: 93.5, latencySavedMs: 449.0, speedupMultiplier: 15.5, bufferPoolHitRate: 86.0, writeMaintenanceCostMs: 1.3 },
      { id: 'd3', timeLabel: 'Day 4', hourOffset: 96, timestamp: Date.now() - 345600000, usageFrequencyPerHour: 4500, latencyBeforeMs: 505.0, latencyAfterMs: 12.0, latencyReductionPercent: 97.6, latencySavedMs: 493.0, speedupMultiplier: 42.1, bufferPoolHitRate: 93.0, writeMaintenanceCostMs: 1.5 },
      { id: 'd4', timeLabel: 'Day 5', hourOffset: 72, timestamp: Date.now() - 259200000, usageFrequencyPerHour: 6400, latencyBeforeMs: 530.0, latencyAfterMs: 4.8, latencyReductionPercent: 99.1, latencySavedMs: 525.2, speedupMultiplier: 110.4, bufferPoolHitRate: 97.0, writeMaintenanceCostMs: 1.6 },
      { id: 'd5', timeLabel: 'Day 6', hourOffset: 48, timestamp: Date.now() - 172800000, usageFrequencyPerHour: 8200, latencyBeforeMs: 560.0, latencyAfterMs: 2.6, latencyReductionPercent: 99.5, latencySavedMs: 557.4, speedupMultiplier: 215.4, bufferPoolHitRate: 98.8, writeMaintenanceCostMs: 1.7 },
      { id: 'd6', timeLabel: 'Today', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 9850, latencyBeforeMs: 585.0, latencyAfterMs: 2.1, latencyReductionPercent: 99.6, latencySavedMs: 582.9, speedupMultiplier: 278.6, bufferPoolHitRate: 99.2, writeMaintenanceCostMs: 1.8 }
    ],
    trend30d: [
      { id: 'm0', timeLabel: 'Wk 1', hourOffset: 720, timestamp: Date.now() - 2592000000, usageFrequencyPerHour: 900, latencyBeforeMs: 430.0, latencyAfterMs: 110.0, latencyReductionPercent: 74.4, latencySavedMs: 320.0, speedupMultiplier: 3.9, bufferPoolHitRate: 68.0, writeMaintenanceCostMs: 1.1 },
      { id: 'm1', timeLabel: 'Wk 2', hourOffset: 504, timestamp: Date.now() - 1814400000, usageFrequencyPerHour: 2900, latencyBeforeMs: 470.0, latencyAfterMs: 28.0, latencyReductionPercent: 94.0, latencySavedMs: 442.0, speedupMultiplier: 16.8, bufferPoolHitRate: 88.0, writeMaintenanceCostMs: 1.3 },
      { id: 'm2', timeLabel: 'Wk 3', hourOffset: 288, timestamp: Date.now() - 1036800000, usageFrequencyPerHour: 6500, latencyBeforeMs: 520.0, latencyAfterMs: 5.1, latencyReductionPercent: 99.0, latencySavedMs: 514.9, speedupMultiplier: 102.0, bufferPoolHitRate: 96.0, writeMaintenanceCostMs: 1.6 },
      { id: 'm3', timeLabel: 'Wk 4', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 9850, latencyBeforeMs: 585.0, latencyAfterMs: 2.1, latencyReductionPercent: 99.6, latencySavedMs: 582.9, speedupMultiplier: 278.6, bufferPoolHitRate: 99.2, writeMaintenanceCostMs: 1.8 }
    ]
  },
  idx_line_items_tx: {
    id: 'idx_line_items_tx',
    name: 'idx_line_items_tx',
    targetTable: 'line_items',
    type: 'Relational Foreign Key',
    isApplied: true,
    baseLatencyMs: 840.0,
    optimizedLatencyMs: 3.2,
    correlationCoeff: 0.98,
    keyQuery: 'SELECT * FROM transactions t JOIN line_items li ON t.id = li.transaction_id',
    description: 'Converts sequential nested loop join scans into indexed hash joins. Performance gains multiply quadratically as relational parent-child joins scale.',
    trend24h: [
      { id: 'p0', timeLabel: '24h ago', hourOffset: 24, timestamp: Date.now() - 86400000, usageFrequencyPerHour: 320, latencyBeforeMs: 810.0, latencyAfterMs: 280.0, latencyReductionPercent: 65.4, latencySavedMs: 530.0, speedupMultiplier: 2.9, bufferPoolHitRate: 52.0, writeMaintenanceCostMs: 0.7 },
      { id: 'p1', timeLabel: '18h ago', hourOffset: 18, timestamp: Date.now() - 64800000, usageFrequencyPerHour: 880, latencyBeforeMs: 830.0, latencyAfterMs: 140.0, latencyReductionPercent: 83.1, latencySavedMs: 690.0, speedupMultiplier: 5.9, bufferPoolHitRate: 68.0, writeMaintenanceCostMs: 0.8 },
      { id: 'p2', timeLabel: '12h ago', hourOffset: 12, timestamp: Date.now() - 43200000, usageFrequencyPerHour: 2100, latencyBeforeMs: 860.0, latencyAfterMs: 48.0, latencyReductionPercent: 94.4, latencySavedMs: 812.0, speedupMultiplier: 17.9, bufferPoolHitRate: 83.0, writeMaintenanceCostMs: 0.9 },
      { id: 'p3', timeLabel: '8h ago', hourOffset: 8, timestamp: Date.now() - 28800000, usageFrequencyPerHour: 4200, latencyBeforeMs: 890.0, latencyAfterMs: 18.5, latencyReductionPercent: 97.9, latencySavedMs: 871.5, speedupMultiplier: 48.1, bufferPoolHitRate: 91.0, writeMaintenanceCostMs: 1.0 },
      { id: 'p4', timeLabel: '4h ago', hourOffset: 4, timestamp: Date.now() - 14400000, usageFrequencyPerHour: 6800, latencyBeforeMs: 920.0, latencyAfterMs: 6.8, latencyReductionPercent: 99.3, latencySavedMs: 913.2, speedupMultiplier: 135.3, bufferPoolHitRate: 96.0, writeMaintenanceCostMs: 1.1 },
      { id: 'p5', timeLabel: '1h ago', hourOffset: 1, timestamp: Date.now() - 3600000, usageFrequencyPerHour: 8900, latencyBeforeMs: 955.0, latencyAfterMs: 3.9, latencyReductionPercent: 99.6, latencySavedMs: 951.1, speedupMultiplier: 244.9, bufferPoolHitRate: 98.2, writeMaintenanceCostMs: 1.2 },
      { id: 'p6', timeLabel: 'Current', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 11200, latencyBeforeMs: 980.0, latencyAfterMs: 3.2, latencyReductionPercent: 99.7, latencySavedMs: 976.8, speedupMultiplier: 306.3, bufferPoolHitRate: 99.5, writeMaintenanceCostMs: 1.3 }
    ],
    trend7d: [
      { id: 'd0', timeLabel: 'Day 1', hourOffset: 168, timestamp: Date.now() - 604800000, usageFrequencyPerHour: 550, latencyBeforeMs: 790.0, latencyAfterMs: 250.0, latencyReductionPercent: 68.4, latencySavedMs: 540.0, speedupMultiplier: 3.2, bufferPoolHitRate: 55.0, writeMaintenanceCostMs: 0.7 },
      { id: 'd1', timeLabel: 'Day 2', hourOffset: 144, timestamp: Date.now() - 518400000, usageFrequencyPerHour: 1400, latencyBeforeMs: 820.0, latencyAfterMs: 110.0, latencyReductionPercent: 86.6, latencySavedMs: 710.0, speedupMultiplier: 7.5, bufferPoolHitRate: 72.0, writeMaintenanceCostMs: 0.8 },
      { id: 'd2', timeLabel: 'Day 3', hourOffset: 120, timestamp: Date.now() - 432000000, usageFrequencyPerHour: 2600, latencyBeforeMs: 850.0, latencyAfterMs: 42.0, latencyReductionPercent: 95.1, latencySavedMs: 808.0, speedupMultiplier: 20.2, bufferPoolHitRate: 85.0, writeMaintenanceCostMs: 0.9 },
      { id: 'd3', timeLabel: 'Day 4', hourOffset: 96, timestamp: Date.now() - 345600000, usageFrequencyPerHour: 4600, latencyBeforeMs: 880.0, latencyAfterMs: 15.0, latencyReductionPercent: 98.3, latencySavedMs: 865.0, speedupMultiplier: 58.7, bufferPoolHitRate: 92.0, writeMaintenanceCostMs: 1.0 },
      { id: 'd4', timeLabel: 'Day 5', hourOffset: 72, timestamp: Date.now() - 259200000, usageFrequencyPerHour: 6900, latencyBeforeMs: 915.0, latencyAfterMs: 5.8, latencyReductionPercent: 99.4, latencySavedMs: 909.2, speedupMultiplier: 157.8, bufferPoolHitRate: 96.5, writeMaintenanceCostMs: 1.1 },
      { id: 'd5', timeLabel: 'Day 6', hourOffset: 48, timestamp: Date.now() - 172800000, usageFrequencyPerHour: 9100, latencyBeforeMs: 950.0, latencyAfterMs: 3.6, latencyReductionPercent: 99.6, latencySavedMs: 946.4, speedupMultiplier: 263.9, bufferPoolHitRate: 98.7, writeMaintenanceCostMs: 1.2 },
      { id: 'd6', timeLabel: 'Today', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 11200, latencyBeforeMs: 980.0, latencyAfterMs: 3.2, latencyReductionPercent: 99.7, latencySavedMs: 976.8, speedupMultiplier: 306.3, bufferPoolHitRate: 99.5, writeMaintenanceCostMs: 1.3 }
    ],
    trend30d: [
      { id: 'm0', timeLabel: 'Wk 1', hourOffset: 720, timestamp: Date.now() - 2592000000, usageFrequencyPerHour: 800, latencyBeforeMs: 770.0, latencyAfterMs: 160.0, latencyReductionPercent: 79.2, latencySavedMs: 610.0, speedupMultiplier: 4.8, bufferPoolHitRate: 64.0, writeMaintenanceCostMs: 0.7 },
      { id: 'm1', timeLabel: 'Wk 2', hourOffset: 504, timestamp: Date.now() - 1814400000, usageFrequencyPerHour: 2700, latencyBeforeMs: 840.0, latencyAfterMs: 38.0, latencyReductionPercent: 95.5, latencySavedMs: 802.0, speedupMultiplier: 22.1, bufferPoolHitRate: 86.0, writeMaintenanceCostMs: 0.9 },
      { id: 'm2', timeLabel: 'Wk 3', hourOffset: 288, timestamp: Date.now() - 1036800000, usageFrequencyPerHour: 6800, latencyBeforeMs: 910.0, latencyAfterMs: 6.2, latencyReductionPercent: 99.3, latencySavedMs: 903.8, speedupMultiplier: 146.8, bufferPoolHitRate: 96.0, writeMaintenanceCostMs: 1.1 },
      { id: 'm3', timeLabel: 'Wk 4', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 11200, latencyBeforeMs: 980.0, latencyAfterMs: 3.2, latencyReductionPercent: 99.7, latencySavedMs: 976.8, speedupMultiplier: 306.3, bufferPoolHitRate: 99.5, writeMaintenanceCostMs: 1.3 }
    ]
  },
  idx_orders_status_cat: {
    id: 'idx_orders_status_cat',
    name: 'idx_orders_status_cat',
    targetTable: 'transactions',
    type: 'Composite B-Tree',
    isApplied: true,
    baseLatencyMs: 310.0,
    optimizedLatencyMs: 1.4,
    correlationCoeff: 0.95,
    keyQuery: 'SELECT * FROM transactions WHERE status = $1 AND category = $2',
    description: 'Consolidated multi-column index replacing duplicate single-column indexes, reducing index seek hops and WAL write amplification.',
    trend24h: [
      { id: 'p0', timeLabel: '24h ago', hourOffset: 24, timestamp: Date.now() - 86400000, usageFrequencyPerHour: 480, latencyBeforeMs: 290.0, latencyAfterMs: 95.0, latencyReductionPercent: 67.2, latencySavedMs: 195.0, speedupMultiplier: 3.1, bufferPoolHitRate: 64.0, writeMaintenanceCostMs: 0.7 },
      { id: 'p1', timeLabel: '18h ago', hourOffset: 18, timestamp: Date.now() - 64800000, usageFrequencyPerHour: 1200, latencyBeforeMs: 305.0, latencyAfterMs: 54.0, latencyReductionPercent: 82.3, latencySavedMs: 251.0, speedupMultiplier: 5.6, bufferPoolHitRate: 77.0, writeMaintenanceCostMs: 0.8 },
      { id: 'p2', timeLabel: '12h ago', hourOffset: 12, timestamp: Date.now() - 43200000, usageFrequencyPerHour: 2900, latencyBeforeMs: 320.0, latencyAfterMs: 19.5, latencyReductionPercent: 93.9, latencySavedMs: 300.5, speedupMultiplier: 16.4, bufferPoolHitRate: 89.0, writeMaintenanceCostMs: 0.9 },
      { id: 'p3', timeLabel: '8h ago', hourOffset: 8, timestamp: Date.now() - 28800000, usageFrequencyPerHour: 5100, latencyBeforeMs: 335.0, latencyAfterMs: 8.2, latencyReductionPercent: 97.6, latencySavedMs: 326.8, speedupMultiplier: 40.9, bufferPoolHitRate: 95.0, writeMaintenanceCostMs: 1.0 },
      { id: 'p4', timeLabel: '4h ago', hourOffset: 4, timestamp: Date.now() - 14400000, usageFrequencyPerHour: 7800, latencyBeforeMs: 350.0, latencyAfterMs: 2.9, latencyReductionPercent: 99.2, latencySavedMs: 347.1, speedupMultiplier: 120.7, bufferPoolHitRate: 98.1, writeMaintenanceCostMs: 1.1 },
      { id: 'p5', timeLabel: '1h ago', hourOffset: 1, timestamp: Date.now() - 3600000, usageFrequencyPerHour: 10400, latencyBeforeMs: 370.0, latencyAfterMs: 1.7, latencyReductionPercent: 99.5, latencySavedMs: 368.3, speedupMultiplier: 217.6, bufferPoolHitRate: 99.2, writeMaintenanceCostMs: 1.2 },
      { id: 'p6', timeLabel: 'Current', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 13100, latencyBeforeMs: 390.0, latencyAfterMs: 1.4, latencyReductionPercent: 99.6, latencySavedMs: 388.6, speedupMultiplier: 278.6, bufferPoolHitRate: 99.7, writeMaintenanceCostMs: 1.3 }
    ],
    trend7d: [
      { id: 'd0', timeLabel: 'Day 1', hourOffset: 168, timestamp: Date.now() - 604800000, usageFrequencyPerHour: 780, latencyBeforeMs: 285.0, latencyAfterMs: 82.0, latencyReductionPercent: 71.2, latencySavedMs: 203.0, speedupMultiplier: 3.5, bufferPoolHitRate: 68.0, writeMaintenanceCostMs: 0.7 },
      { id: 'd1', timeLabel: 'Day 2', hourOffset: 144, timestamp: Date.now() - 518400000, usageFrequencyPerHour: 1900, latencyBeforeMs: 300.0, latencyAfterMs: 44.0, latencyReductionPercent: 85.3, latencySavedMs: 256.0, speedupMultiplier: 6.8, bufferPoolHitRate: 80.0, writeMaintenanceCostMs: 0.8 },
      { id: 'd2', timeLabel: 'Day 3', hourOffset: 120, timestamp: Date.now() - 432000000, usageFrequencyPerHour: 3600, latencyBeforeMs: 318.0, latencyAfterMs: 16.5, latencyReductionPercent: 94.8, latencySavedMs: 301.5, speedupMultiplier: 19.3, bufferPoolHitRate: 90.0, writeMaintenanceCostMs: 0.9 },
      { id: 'd3', timeLabel: 'Day 4', hourOffset: 96, timestamp: Date.now() - 345600000, usageFrequencyPerHour: 5500, latencyBeforeMs: 330.0, latencyAfterMs: 7.2, latencyReductionPercent: 97.8, latencySavedMs: 322.8, speedupMultiplier: 45.8, bufferPoolHitRate: 95.5, writeMaintenanceCostMs: 1.0 },
      { id: 'd4', timeLabel: 'Day 5', hourOffset: 72, timestamp: Date.now() - 259200000, usageFrequencyPerHour: 7900, latencyBeforeMs: 345.0, latencyAfterMs: 2.8, latencyReductionPercent: 99.2, latencySavedMs: 342.2, speedupMultiplier: 123.2, bufferPoolHitRate: 98.2, writeMaintenanceCostMs: 1.1 },
      { id: 'd5', timeLabel: 'Day 6', hourOffset: 48, timestamp: Date.now() - 172800000, usageFrequencyPerHour: 10600, latencyBeforeMs: 368.0, latencyAfterMs: 1.6, latencyReductionPercent: 99.6, latencySavedMs: 366.4, speedupMultiplier: 230.0, bufferPoolHitRate: 99.3, writeMaintenanceCostMs: 1.2 },
      { id: 'd6', timeLabel: 'Today', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 13100, latencyBeforeMs: 390.0, latencyAfterMs: 1.4, latencyReductionPercent: 99.6, latencySavedMs: 388.6, speedupMultiplier: 278.6, bufferPoolHitRate: 99.7, writeMaintenanceCostMs: 1.3 }
    ],
    trend30d: [
      { id: 'm0', timeLabel: 'Wk 1', hourOffset: 720, timestamp: Date.now() - 2592000000, usageFrequencyPerHour: 1100, latencyBeforeMs: 280.0, latencyAfterMs: 65.0, latencyReductionPercent: 76.8, latencySavedMs: 215.0, speedupMultiplier: 4.3, bufferPoolHitRate: 74.0, writeMaintenanceCostMs: 0.7 },
      { id: 'm1', timeLabel: 'Wk 2', hourOffset: 504, timestamp: Date.now() - 1814400000, usageFrequencyPerHour: 3400, latencyBeforeMs: 310.0, latencyAfterMs: 17.0, latencyReductionPercent: 94.5, latencySavedMs: 293.0, speedupMultiplier: 18.2, bufferPoolHitRate: 89.0, writeMaintenanceCostMs: 0.9 },
      { id: 'm2', timeLabel: 'Wk 3', hourOffset: 288, timestamp: Date.now() - 1036800000, usageFrequencyPerHour: 8100, latencyBeforeMs: 350.0, latencyAfterMs: 2.7, latencyReductionPercent: 99.2, latencySavedMs: 347.3, speedupMultiplier: 129.6, bufferPoolHitRate: 98.0, writeMaintenanceCostMs: 1.1 },
      { id: 'm3', timeLabel: 'Wk 4', hourOffset: 0, timestamp: Date.now(), usageFrequencyPerHour: 13100, latencyBeforeMs: 390.0, latencyAfterMs: 1.4, latencyReductionPercent: 99.6, latencySavedMs: 388.6, speedupMultiplier: 278.6, bufferPoolHitRate: 99.7, writeMaintenanceCostMs: 1.3 }
    ]
  }
};

export interface IndexEfficiencyTrendChartProps {
  selectedIndexId?: string;
  onSelectIndexId?: (id: string) => void;
  compact?: boolean;
}

export const IndexEfficiencyTrendChart: React.FC<IndexEfficiencyTrendChartProps> = ({
  selectedIndexId = 'idx_transactions_email_status',
  onSelectIndexId,
  compact = false
}) => {
  const [activeProfileId, setActiveProfileId] = useState<string>(
    DEFAULT_INDEX_PROFILES[selectedIndexId] ? selectedIndexId : 'idx_transactions_email_status'
  );
  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const [viewMode, setViewMode] = useState<'dual_axis' | 'scatter'>('dual_axis');
  const [simulatedSpikeActive, setSimulatedSpikeActive] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<EfficiencyTrendPoint | null>(null);

  // Sync activeProfileId when prop changes
  useEffect(() => {
    if (selectedIndexId && DEFAULT_INDEX_PROFILES[selectedIndexId]) {
      setActiveProfileId(selectedIndexId);
    }
  }, [selectedIndexId]);

  const activeProfile = useMemo(() => {
    return DEFAULT_INDEX_PROFILES[activeProfileId] || DEFAULT_INDEX_PROFILES.idx_transactions_email_status;
  }, [activeProfileId]);

  // Points based on timeWindow
  const rawPoints = useMemo(() => {
    switch (timeWindow) {
      case '7d':
        return activeProfile.trend7d;
      case '30d':
        return activeProfile.trend30d;
      default:
        return activeProfile.trend24h;
    }
  }, [activeProfile, timeWindow]);

  // Inject spike if simulatedSpikeActive
  const points = useMemo(() => {
    if (!simulatedSpikeActive) return rawPoints;
    return rawPoints.map((pt, idx) => {
      if (idx >= rawPoints.length - 2) {
        const boostedFreq = Math.round(pt.usageFrequencyPerHour * 1.55);
        const boostedLatencyReduction = Math.min(99.9, +(pt.latencyReductionPercent + 0.3).toFixed(1));
        const boostedSpeedup = Math.round(pt.speedupMultiplier * 1.6);
        return {
          ...pt,
          usageFrequencyPerHour: boostedFreq,
          latencyReductionPercent: boostedLatencyReduction,
          latencyAfterMs: Math.max(0.8, +(pt.latencyAfterMs * 0.7).toFixed(1)),
          speedupMultiplier: boostedSpeedup,
          bufferPoolHitRate: 99.9
        };
      }
      return pt;
    });
  }, [rawPoints, simulatedSpikeActive]);

  // Calculations for chart axes and metrics
  const maxFrequency = useMemo(() => {
    return Math.max(...points.map((p) => p.usageFrequencyPerHour), 1000);
  }, [points]);

  const maxLatencyReduction = 100;
  const minLatencyReduction = useMemo(() => {
    return Math.max(40, Math.floor(Math.min(...points.map((p) => p.latencyReductionPercent)) / 10) * 10);
  }, [points]);

  // Cumulative execution time saved in window (hours)
  const cumulativeTimeSavedHours = useMemo(() => {
    const totalMs = points.reduce((acc, pt) => acc + pt.usageFrequencyPerHour * pt.latencySavedMs, 0);
    return (totalMs / (1000 * 3600)).toFixed(1);
  }, [points]);

  const peakPoint = useMemo(() => {
    return points.reduce((max, p) => (p.speedupMultiplier > max.speedupMultiplier ? p : max), points[0]);
  }, [points]);

  const handleSelectProfile = (id: string) => {
    setActiveProfileId(id);
    if (onSelectIndexId) {
      onSelectIndexId(id);
    }
  };

  // Dimensions for SVG rendering
  const svgWidth = 420;
  const svgHeight = 180;
  const padding = { top: 20, right: 35, bottom: 28, left: 42 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Coordinate scales
  const getX = (index: number) => {
    if (points.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (points.length - 1)) * innerWidth;
  };

  const getYFreq = (val: number) => {
    return padding.top + innerHeight - (val / (maxFrequency * 1.15)) * innerHeight;
  };

  const getYReduction = (val: number) => {
    const range = maxLatencyReduction - minLatencyReduction;
    const clamped = Math.max(minLatencyReduction, Math.min(maxLatencyReduction, val));
    return padding.top + innerHeight - ((clamped - minLatencyReduction) / range) * innerHeight;
  };

  // SVG Path Generators
  const freqAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    let path = `M ${getX(0)} ${padding.top + innerHeight}`;
    points.forEach((pt, i) => {
      path += ` L ${getX(i)} ${getYFreq(pt.usageFrequencyPerHour)}`;
    });
    path += ` L ${getX(points.length - 1)} ${padding.top + innerHeight} Z`;
    return path;
  }, [points, maxFrequency]);

  const freqLinePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYFreq(pt.usageFrequencyPerHour)}`)
      .join(' ');
  }, [points, maxFrequency]);

  const reductionLinePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYReduction(pt.latencyReductionPercent)}`)
      .join(' ');
  }, [points, minLatencyReduction]);

  return (
    <div
      id="index-efficiency-trend-chart"
      data-testid="index-efficiency-trend-chart"
      className="p-3.5 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 rounded-xl border border-indigo-200/90 shadow-2xs space-y-3 transition-all"
    >
      {/* Header with Title & Live Synergy Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-indigo-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-lg shadow-2xs">
            <TrendingUp className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold text-zinc-900 tracking-tight">
                Efficiency Trend
              </h4>
              <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                r = +{activeProfile.correlationCoeff} Synergy
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
              Correlates index usage frequency against query execution latency reduction over time.
            </p>
          </div>
        </div>

        {/* Time Window Switcher */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100/90 border border-zinc-200 text-[10px] shrink-0 font-mono">
          <button
            type="button"
            onClick={() => setTimeWindow('24h')}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
              timeWindow === '24h'
                ? 'bg-white text-indigo-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            24H
          </button>
          <button
            type="button"
            onClick={() => setTimeWindow('7d')}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
              timeWindow === '7d'
                ? 'bg-white text-indigo-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            7D
          </button>
          <button
            type="button"
            onClick={() => setTimeWindow('30d')}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-all ${
              timeWindow === '30d'
                ? 'bg-white text-indigo-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            30D
          </button>
        </div>
      </div>

      {/* Index Selector Pills Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
        <span className="text-zinc-400 font-medium shrink-0 flex items-center gap-1">
          <Target className="w-3 h-3 text-indigo-500" />
          <span>Index:</span>
        </span>
        {Object.values(DEFAULT_INDEX_PROFILES).map((prof) => {
          const isAct = prof.id === activeProfileId;
          return (
            <button
              key={prof.id}
              type="button"
              id={`btn-trend-select-${prof.id}`}
              data-testid={`btn-trend-select-${prof.id}`}
              onClick={() => handleSelectProfile(prof.id)}
              className={`px-2 py-0.5 rounded-md font-mono whitespace-nowrap transition-all cursor-pointer border ${
                isAct
                  ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-2xs'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-indigo-50/50'
              }`}
            >
              {prof.name.replace('idx_', '').replace('transactions_', '')}
            </button>
          );
        })}
      </div>

      {/* Primary KPI Correlation Strip */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="p-1.5 bg-white/90 rounded-lg border border-indigo-100 shadow-2xs">
          <div className="text-[9px] uppercase tracking-wider font-bold text-indigo-900 flex items-center justify-center gap-0.5">
            <Activity className="w-2.5 h-2.5 text-indigo-600" />
            <span>Usage Frequency</span>
          </div>
          <div className="font-mono font-extrabold text-xs text-indigo-950 mt-0.5">
            {peakPoint.usageFrequencyPerHour.toLocaleString()}/hr
          </div>
          <div className="text-[9px] text-zinc-400 font-mono">Peak Invocations</div>
        </div>

        <div className="p-1.5 bg-white/90 rounded-lg border border-emerald-100 shadow-2xs">
          <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-900 flex items-center justify-center gap-0.5">
            <Zap className="w-2.5 h-2.5 text-emerald-600" />
            <span>Latency Cut</span>
          </div>
          <div className="font-mono font-extrabold text-xs text-emerald-700 mt-0.5">
            -{peakPoint.latencyReductionPercent.toFixed(1)}%
          </div>
          <div className="text-[9px] text-zinc-400 font-mono">
            {activeProfile.baseLatencyMs}ms → {activeProfile.optimizedLatencyMs}ms
          </div>
        </div>

        <div className="p-1.5 bg-white/90 rounded-lg border border-purple-100 shadow-2xs">
          <div className="text-[9px] uppercase tracking-wider font-bold text-purple-900 flex items-center justify-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-purple-600" />
            <span>Compute Saved</span>
          </div>
          <div className="font-mono font-extrabold text-xs text-purple-800 mt-0.5">
            {cumulativeTimeSavedHours}h CPU
          </div>
          <div className="text-[9px] text-zinc-400 font-mono">
            {peakPoint.speedupMultiplier}x Speedup
          </div>
        </div>
      </div>

      {/* Interactive Dual-Axis Chart Canvas */}
      <div className="relative bg-white rounded-xl border border-zinc-200/90 p-2 shadow-inner overflow-hidden">
        {/* Chart Legend */}
        <div className="flex items-center justify-between text-[9px] font-mono px-1 pb-1 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-indigo-800 font-semibold">
              <span className="w-2 h-2 rounded-xs bg-indigo-500/80 inline-block" />
              <span>Usage Frequency (queries/hr)</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="w-2 h-0.5 bg-emerald-600 inline-block" />
              <span>Latency Reduction (%)</span>
            </span>
          </div>
          <span className="text-zinc-400 hidden sm:inline">Hover points for telemetry</span>
        </div>

        {/* SVG Viewport */}
        <div className="relative w-full aspect-[420/180]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full select-none"
            aria-label="Index Efficiency Trend Chart"
          >
            <defs>
              <linearGradient id="freqAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="90%" stopColor="#6366f1" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="latencyLineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#059669" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * innerHeight;
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerWidth}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Left Y-Axis Labels (Frequency) */}
            <text x={padding.left - 4} y={padding.top + 6} textAnchor="end" className="text-[8px] fill-indigo-600 font-mono font-bold">
              {(maxFrequency / 1000).toFixed(1)}k
            </text>
            <text x={padding.left - 4} y={padding.top + innerHeight / 2 + 3} textAnchor="end" className="text-[8px] fill-indigo-400 font-mono">
              {(maxFrequency / 2000).toFixed(1)}k
            </text>
            <text x={padding.left - 4} y={padding.top + innerHeight} textAnchor="end" className="text-[8px] fill-zinc-400 font-mono">
              0
            </text>

            {/* Right Y-Axis Labels (Latency Reduction %) */}
            <text x={padding.left + innerWidth + 4} y={padding.top + 6} textAnchor="start" className="text-[8px] fill-emerald-600 font-mono font-bold">
              100%
            </text>
            <text x={padding.left + innerWidth + 4} y={padding.top + innerHeight / 2 + 3} textAnchor="start" className="text-[8px] fill-emerald-500 font-mono">
              {((maxLatencyReduction + minLatencyReduction) / 2).toFixed(0)}%
            </text>
            <text x={padding.left + innerWidth + 4} y={padding.top + innerHeight} textAnchor="start" className="text-[8px] fill-zinc-400 font-mono">
              {minLatencyReduction}%
            </text>

            {/* 1. Usage Frequency Area Fill & Curve */}
            <path d={freqAreaPath} fill="url(#freqAreaGradient)" />
            <path
              d={freqLinePath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 2. Latency Reduction Line */}
            <path
              d={reductionLinePath}
              fill="none"
              stroke="url(#latencyLineGradient)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glowFilter)"
            />

            {/* Interactive Data Points */}
            {points.map((pt, i) => {
              const cx = getX(i);
              const cyFreq = getYFreq(pt.usageFrequencyPerHour);
              const cyRed = getYReduction(pt.latencyReductionPercent);
              const isHovered = hoveredPoint?.id === pt.id;

              return (
                <g key={pt.id} className="cursor-pointer">
                  {/* Frequency Marker */}
                  <circle
                    cx={cx}
                    cy={cyFreq}
                    r={isHovered ? 4.5 : 2.5}
                    fill="#4338ca"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="transition-all"
                  />

                  {/* Latency Reduction Marker */}
                  <circle
                    cx={cx}
                    cy={cyRed}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    className="transition-all"
                  />

                  {/* Vertical Hover Guide */}
                  {isHovered && (
                    <line
                      x1={cx}
                      y1={padding.top}
                      x2={cx}
                      y2={padding.top + innerHeight}
                      stroke="#818cf8"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                  )}

                  {/* Transparent hover capture rect */}
                  <rect
                    x={cx - innerWidth / (points.length * 2)}
                    y={padding.top}
                    width={innerWidth / points.length}
                    height={innerHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* X-Axis Time Labels */}
                  <text
                    x={cx}
                    y={padding.top + innerHeight + 14}
                    textAnchor="middle"
                    className={`text-[8px] font-mono select-none ${
                      isHovered ? 'fill-indigo-900 font-bold' : 'fill-zinc-400'
                    }`}
                  >
                    {pt.timeLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Point Floating Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-7 left-12 right-12 z-20 bg-zinc-950/95 text-white p-2.5 rounded-lg shadow-xl border border-zinc-700 text-[10px] space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
              <span className="font-bold text-amber-300 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{hoveredPoint.timeLabel} Snapshot</span>
              </span>
              <span className="text-zinc-400 font-mono text-[9px]">
                Buffer Pool: <strong className="text-emerald-400">{hoveredPoint.bufferPoolHitRate}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>
                <span className="text-zinc-400 block text-[9px]">Usage Frequency:</span>
                <span className="font-bold text-indigo-300">
                  {hoveredPoint.usageFrequencyPerHour.toLocaleString()} queries/hr
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px]">Latency Reduction:</span>
                <span className="font-bold text-emerald-400">
                  -{hoveredPoint.latencyReductionPercent.toFixed(1)}% ({hoveredPoint.speedupMultiplier}x faster)
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px]">Raw Query Latency:</span>
                <span className="text-zinc-300 line-through mr-1">{hoveredPoint.latencyBeforeMs}ms</span>
                <span className="font-bold text-emerald-300">➔ {hoveredPoint.latencyAfterMs}ms</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[9px]">Wall-Clock Time Saved:</span>
                <span className="font-bold text-purple-300">
                  +{hoveredPoint.latencySavedMs.toFixed(1)} ms / query
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Correlation Insight & Action Controls */}
      <div className="p-2 bg-indigo-50/60 rounded-lg border border-indigo-100 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 text-zinc-700">
          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            <strong>Positive Synergy:</strong> 10x query frequency growth reduces latency by an additional <strong>+35.3%</strong> via hot page buffering.
          </span>
        </div>

        <button
          type="button"
          id="btn-simulate-traffic-spike"
          data-testid="btn-simulate-traffic-spike"
          onClick={() => setSimulatedSpikeActive(!simulatedSpikeActive)}
          className={`px-2 py-1 rounded font-semibold text-[10px] whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 border shrink-0 ${
            simulatedSpikeActive
              ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
              : 'bg-white hover:bg-zinc-100 text-purple-900 border-purple-200'
          }`}
          title="Simulate high-frequency query burst to observe peak efficiency gain"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>{simulatedSpikeActive ? 'Traffic Burst Active' : 'Simulate Spike'}</span>
        </button>
      </div>
    </div>
  );
};
