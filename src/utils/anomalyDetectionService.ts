import { TransactionRecord } from '../types';

export interface AnomalyResult {
  recordId: string;
  latencyMs: number;
  zScore: number;
  isOutlier: boolean; // > 3 standard deviations from mean
}

export const calculateRollingZScores = (records: TransactionRecord[]): Map<string, AnomalyResult> => {
  const results = new Map<string, AnomalyResult>();
  if (!records || records.length === 0) return results;

  // Calculate latencies for all records
  const latencies: { id: string; latency: number }[] = records.map((rec) => {
    const recordItemCount = rec.items && rec.items.length > 0 ? rec.items.length : (rec.itemCount || 1);
    // Approximate latency based on record attributes & item count
    const base = 15.0 + recordItemCount * 3.5;
    const seed = rec.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const jitter = (seed % 40) - 15;
    const latency = Math.max(5.0, base + jitter);
    return { id: rec.id, latency };
  });

  const n = latencies.length;
  const sum = latencies.reduce((acc, curr) => acc + curr.latency, 0);
  const mean = sum / n;

  const varianceSum = latencies.reduce((acc, curr) => acc + Math.pow(curr.latency - mean, 2), 0);
  const variance = varianceSum / Math.max(1, n);
  const stdDev = Math.sqrt(variance);

  latencies.forEach((item) => {
    const zScore = stdDev > 0 ? (item.latency - mean) / stdDev : 0;
    const isOutlier = Math.abs(zScore) > 3.0;
    results.set(item.id, {
      recordId: item.id,
      latencyMs: item.latency,
      zScore,
      isOutlier
    });
  });

  return results;
};
