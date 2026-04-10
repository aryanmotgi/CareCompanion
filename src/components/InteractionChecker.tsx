'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Medication } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

interface Interaction {
  drug_a: string;
  drug_b: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
}

interface AllergyWarning {
  medication: string;
  allergy: string;
  risk: string;
}

interface InteractionResult {
  interactions: Interaction[];
  allergy_warnings: AllergyWarning[];
  summary: string;
  safe_to_combine: boolean;
}

interface InteractionCheckerProps {
  medications: Medication[];
}

const SEVERITY_CONFIG = {
  major: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.25)',
    label: 'Major',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  moderate: {
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.25)',
    label: 'Moderate',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  minor: {
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.25)',
    label: 'Minor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
} as const;

export function InteractionChecker({ medications }: InteractionCheckerProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InteractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoChecked, setHasAutoChecked] = useState(false);

  const checkInteractions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/interactions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_all: true }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to check interactions');
      }

      setResult(json.data);
      showToast('Interactions checked', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      showToast('Failed to check interactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Auto-check on mount if there are 2+ medications
  useEffect(() => {
    if (medications.length >= 2 && !hasAutoChecked) {
      setHasAutoChecked(true);
      setIsOpen(true);
      checkInteractions();
    }
  }, [medications.length, hasAutoChecked, checkInteractions]);

  const majorCount = result?.interactions.filter((i) => i.severity === 'major').length ?? 0;
  const moderateCount = result?.interactions.filter((i) => i.severity === 'moderate').length ?? 0;
  const minorCount = result?.interactions.filter((i) => i.severity === 'minor').length ?? 0;
  const allergyCount = result?.allergy_warnings.length ?? 0;
  const totalIssues = (result?.interactions.length ?? 0) + allergyCount;

  // Collapsed card / trigger button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          if (!result && !loading) {
            checkInteractions();
          }
        }}
        className="w-full rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 text-left transition-all hover:border-white/[0.14] hover:from-white/[0.06] min-h-[44px]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20 flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#f1f5f9]">Check Interactions</p>
              <p className="text-xs text-[#94a3b8]">
                {medications.length < 2
                  ? 'Add 2+ medications to check'
                  : `Scan ${medications.length} medications for interactions`}
              </p>
            </div>
          </div>
          {result && totalIssues > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: majorCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: majorCount > 0 ? '#ef4444' : '#eab308',
              }}
            >
              {totalIssues} found
            </span>
          )}
          {result && totalIssues === 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
              All clear
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#A78BFA]/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1f5f9]">Interaction Checker</p>
            <p className="text-xs text-[#94a3b8]">{medications.length} medication{medications.length !== 1 ? 's' : ''} analyzed</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close interaction checker"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white/[0.06] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="relative mb-4">
            <svg className="animate-spin h-8 w-8 text-[#6366F1]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm text-[#f1f5f9] font-medium" role="status">Checking interactions...</p>
          <p className="text-xs text-[#64748b] mt-1">Analyzing {medications.length} medications</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-400">Failed to check interactions</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={checkInteractions}
              className="mt-3 w-full rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="p-4 space-y-3">
          {/* Summary bar */}
          {result.interactions.length === 0 && allergyCount === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="text-sm font-medium text-emerald-400">No interactions found</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Your medications look safe together</p>
              </div>
            </div>
          ) : (
            <>
              {/* Severity counts */}
              <div className="flex gap-2 flex-wrap">
                {majorCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: SEVERITY_CONFIG.major.bg, color: SEVERITY_CONFIG.major.color, border: `1px solid ${SEVERITY_CONFIG.major.border}` }}
                  >
                    {SEVERITY_CONFIG.major.icon}
                    {majorCount} Major
                  </span>
                )}
                {moderateCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: SEVERITY_CONFIG.moderate.bg, color: SEVERITY_CONFIG.moderate.color, border: `1px solid ${SEVERITY_CONFIG.moderate.border}` }}
                  >
                    {SEVERITY_CONFIG.moderate.icon}
                    {moderateCount} Moderate
                  </span>
                )}
                {minorCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: SEVERITY_CONFIG.minor.bg, color: SEVERITY_CONFIG.minor.color, border: `1px solid ${SEVERITY_CONFIG.minor.border}` }}
                  >
                    {SEVERITY_CONFIG.minor.icon}
                    {minorCount} Minor
                  </span>
                )}
                {allergyCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-orange-500/12 text-orange-400 border border-orange-500/25">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {allergyCount} Allergy
                  </span>
                )}
              </div>

              {/* Summary text */}
              {result.summary && (
                <p className="text-xs text-[#94a3b8] leading-relaxed">{result.summary}</p>
              )}

              {/* Interaction cards */}
              <div className="space-y-2">
                {result.interactions.map((interaction, idx) => {
                  const config = SEVERITY_CONFIG[interaction.severity];
                  return (
                    <div
                      key={`interaction-${idx}`}
                      className="rounded-xl p-3"
                      style={{ background: config.bg, border: `1px solid ${config.border}` }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {config.icon}
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#f1f5f9] mb-1">
                        {interaction.drug_a} + {interaction.drug_b}
                      </p>
                      <p className="text-xs text-[#94a3b8] leading-relaxed mb-2">
                        {interaction.description}
                      </p>
                      <div className="flex items-start gap-1.5 rounded-lg bg-black/20 p-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <p className="text-xs text-[#94a3b8] leading-relaxed">{interaction.recommendation}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Allergy warning cards */}
                {result.allergy_warnings.map((warning, idx) => (
                  <div
                    key={`allergy-${idx}`}
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.25)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                        Allergy Warning
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#f1f5f9] mb-1">
                      {warning.medication} may conflict with {warning.allergy} allergy
                    </p>
                    <p className="text-xs text-[#94a3b8] leading-relaxed">{warning.risk}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-[#64748b] leading-relaxed pt-1">
            For informational awareness only. Confirm with your doctor or pharmacist before making any medication decisions.
          </p>

          {/* Re-check button */}
          <button
            type="button"
            onClick={checkInteractions}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 min-h-[44px] text-xs font-medium text-[#94a3b8] hover:bg-white/[0.08] transition-colors"
          >
            Re-check interactions
          </button>
        </div>
      )}
    </div>
  );
}
