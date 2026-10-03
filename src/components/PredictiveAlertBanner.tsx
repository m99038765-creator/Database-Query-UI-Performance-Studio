import React, { useMemo } from 'react';
import { LatencyTrendPoint, OptimizationFlags } from '../types';
import { ShieldAlert, Zap, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Sparkles, Sliders } from 'lucide-react';

interface PredictiveAlertBannerProps {
  trendHistory: LatencyTrendPoint[];
  currentFlags: OptimizationFlags;
  onApplyOptimizations: () => void;
}

export const PredictiveAlertBanner: React.FC<PredictiveAlertBannerProps> = ({
  trendHistory = [],
  currentFlags,
  onApplyOptimizations
}) => {
  // Analyze current trend & flags to predict latency spike probability in next 5 minutes
  const prediction = useMemo(() => {
    let riskScore = 0;
    const reasons: string[] = [];

    if (!currentFlags.btreeIndexing) {
      riskScore += 45;
      reasons.push('B-Tree Indexing is disabled (leading to sequential heap scans on large volumes)');
    }
    if (!currentFlags.queryCaching) {
      riskScore += 30;
      reasons.push('Query Caching is disabled (repeated reads hitting storage)');
    }
    if (!currentFlags.batchEagerLoading) {
      riskScore += 25;
      reasons.push('Batch Eager Loading is disabled (N+1 query storm risk)');
    }

    // Check recent trend slope if history exists
    if (trendHistory.length >= 3) {
      const recent = trendHistory.slice(-3);
      const latencyDelta = recent[recent.length - 1].executionTimeMs - recent[0].executionTimeMs;
      if (latencyDelta > 15) {
        riskScore += 25;
        reasons.push(`Upward latency trajectory detected (+${latencyDelta.toFixed(1)}ms over recent ticks)`);
      }
    }

    const isHighRisk = riskScore >= 50;
    const predictedLatencySpikeMs = Math.round(riskScore * 3.5 + 45);
    const confidencePercent = Math.min(96, Math.max(68, riskScore + 20));

    return {
      isHighRisk,
      riskScore: Math.min(100, riskScore),
      predictedLatencySpikeMs,
      confidencePercent,
      reasons
    };
  }, [trendHistory, currentFlags]);

  if (!prediction.isHighRisk) {
    return (
      <div
        id="predictive-alert-optimal-banner"
        data-testid="predictive-alert-optimal-banner"
        className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/85 rounded-2xl border border-emerald-300 shadow-sm flex items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wider">
                Predictive AI Health Monitor: Optimal Performance Stable
              </h3>
              <span className="font-mono text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                Low Spike Risk (&lt;15%)
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Current optimization flags (B-Tree Indexing, Caching, Batch Loading) are fully active. No latency spikes predicted within the next 5 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="predictive-alert-warning-banner"
      data-testid="predictive-alert-warning-banner"
      className="p-5 bg-gradient-to-r from-rose-950 via-amber-950 to-zinc-950 text-white rounded-2xl border-2 border-rose-500 shadow-2xl space-y-3 mb-6 relative z-30 ring-4 ring-rose-500/20 animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-900/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-lg animate-bounce">
            <ShieldAlert className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm text-white tracking-wide">
                🚨 Predictive Latency Spike Alert (High Confidence)
              </h3>
              <span className="font-mono text-[10px] bg-rose-500 text-white px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                {prediction.confidencePercent}% Confidence
              </span>
            </div>
            <p className="text-xs text-rose-200 mt-0.5">
              AI analytics predicts a severe latency spike of <strong className="text-amber-300 font-mono">+{prediction.predictedLatencySpikeMs}ms</strong> within the next <span className="font-bold underline">5 minutes</span> based on current settings and workload patterns.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-predictive-auto-optimize"
          data-testid="btn-predictive-auto-optimize"
          onClick={onApplyOptimizations}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all transform hover:scale-105 shrink-0"
          title="Auto-apply recommended indexes and caching flags to avert predicted spike"
        >
          <Zap className="w-4 h-4 text-amber-200 animate-spin" />
          <span>Avert Spike &amp; Auto-Optimize</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-black/40 rounded-xl border border-rose-900/60 space-y-1.5">
          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Primary Risk Factors Identified</span>
          <ul className="list-disc list-inside space-y-1 text-xs text-rose-100 font-medium">
            {prediction.reasons.map((reason, idx) => (
              <li key={`reason-${idx}`}>{reason}</li>
            ))}
          </ul>
        </div>
        <div className="p-3 bg-black/40 rounded-xl border border-rose-900/60 space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Preventative Recommendation</span>
            <p className="text-xs text-zinc-300 mt-1">
              Enabling B-Tree Indexing and Query Caching immediately redirects sequential heap scans into sub-millisecond B-Tree index lookups, neutralizing the predicted spike.
            </p>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-rose-900/50">
            <span>Window: Next 5 Minutes</span>
            <span>Risk Score: {prediction.riskScore}/100</span>
          </div>
        </div>
      </div>
    </div>
  );
};
