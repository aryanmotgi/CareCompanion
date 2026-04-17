'use client';

import { useState, useEffect } from 'react';
import type { BurnoutAssessment } from '@/lib/caregiver-burnout';

const RISK_CONFIG = {
  low: { label: 'Low Risk', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
  moderate: { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'bg-amber-500' },
  high: { label: 'High Risk', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', bar: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', bar: 'bg-red-500' },
};

const CATEGORY_ICONS: Record<string, string> = {
  sleep: '😴',
  mood: '🌧',
  energy: '⚡',
  pain: '💫',
  overload: '📅',
  isolation: '🔇',
};

export function CaregiverBurnoutCard() {
  const [assessment, setAssessment] = useState<BurnoutAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/caregiver/burnout')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setAssessment(json.data);
        else setError('Could not load assessment');
      })
      .catch(() => setError('Could not load assessment'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 animate-pulse space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-40 rounded bg-white/[0.06]" />
        </div>
        <div className="h-2 w-full rounded bg-white/[0.04]" />
        <div className="h-2 w-3/4 rounded bg-white/[0.04]" />
      </div>
    );
  }

  if (error || !assessment) return null;

  const cfg = RISK_CONFIG[assessment.risk_level];
  const scorePercent = Math.min(100, assessment.score);
  const hasSignals = assessment.signals.length > 0;
  const lastChecked = new Date(assessment.last_assessed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className={`rounded-2xl border ${cfg.border} bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden`}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
              <svg className={`w-5 h-5 ${cfg.color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Caregiver Wellness</p>
              <p className="text-xs text-[var(--text-muted)]">How are YOU doing? Checked {lastChecked}</p>
            </div>
          </div>
          <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--text-muted)]">Burnout Score</span>
            <span className={`text-xs font-bold ${cfg.color}`}>{scorePercent}/100</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full ${cfg.bar} transition-all duration-700`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* No signals — good state */}
      {!hasSignals && (
        <div className="px-5 pb-5">
          <p className="text-sm text-[var(--text-secondary)]">
            You&apos;re doing well. Keep checking in daily so we can catch early warning signs.
          </p>
        </div>
      )}

      {/* Has signals */}
      {hasSignals && (
        <div className="border-t border-white/[0.06]">
          {/* Top recommendation(s) */}
          <div className="px-5 py-4 space-y-2">
            {assessment.recommendations.slice(0, expanded ? undefined : 2).map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <p className="text-sm text-[var(--text-secondary)]">{rec}</p>
              </div>
            ))}
          </div>

          {/* Signals detail (expandable) */}
          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Signals Detected</p>
              {assessment.signals.map((sig, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base leading-none flex-shrink-0">{CATEGORY_ICONS[sig.category] || '⚠️'}</span>
                  <p className="text-sm text-[var(--text-secondary)]">{sig.signal}</p>
                </div>
              ))}
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-3 border-t border-white/[0.06] text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center justify-center gap-1"
          >
            {expanded ? 'Show less' : `See ${assessment.signals.length} signal${assessment.signals.length !== 1 ? 's' : ''} detected`}
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
