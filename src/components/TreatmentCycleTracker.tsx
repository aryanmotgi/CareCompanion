'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Medication, SymptomEntry } from '@/lib/types';

interface TreatmentCycleTrackerProps {
  medications: Medication[];
  patientName: string;
}

interface CycleInfo {
  drugName: string;
  regimen: string;
  currentCycle: number;
  totalCycles: number;
  cycleLengthDays: number;
  dayInCycle: number;
  phase: 'infusion' | 'nadir' | 'recovery' | 'pre-infusion';
  phaseLabel: string;
  phaseColor: string;
  nextInfusion: string | null;
}

interface SideEffect {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  cycle: number;
  day: number;
  date: string;
}

const COMMON_SIDE_EFFECTS = [
  'Nausea', 'Fatigue', 'Mouth sores', 'Neuropathy',
  'Hair thinning', 'Appetite loss', 'Joint pain', 'Brain fog',
  'Skin rash', 'Diarrhea', 'Constipation', 'Headache',
];

function parseCycleInfo(med: Medication): CycleInfo | null {
  const notes = (med.notes || '').toLowerCase();
  const freq = (med.frequency || '').toLowerCase();

  const cycleMatch = notes.match(/cycle\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (!cycleMatch) return null;

  const currentCycle = parseInt(cycleMatch[1]);
  const totalCycles = parseInt(cycleMatch[2]);

  let cycleLengthDays = 21;
  if (freq.includes('every 2 weeks') || freq.includes('every 14')) cycleLengthDays = 14;
  if (freq.includes('every 3 weeks') || freq.includes('every 21')) cycleLengthDays = 21;
  if (freq.includes('every 4 weeks') || freq.includes('every 28')) cycleLengthDays = 28;
  if (freq.includes('weekly')) cycleLengthDays = 7;

  let dayInCycle = 1;
  if (med.refillDate) {
    const nextInfusion = new Date(med.refillDate);
    const now = new Date();
    const daysUntilNext = Math.ceil((nextInfusion.getTime() - now.getTime()) / 86400000);
    dayInCycle = Math.max(1, cycleLengthDays - daysUntilNext);
  }

  let phase: CycleInfo['phase'] = 'recovery';
  let phaseLabel = 'Recovery';
  let phaseColor = '#10b981';

  if (dayInCycle <= 2) {
    phase = 'infusion';
    phaseLabel = 'Infusion Days';
    phaseColor = '#6366F1';
  } else if (dayInCycle >= 8 && dayInCycle <= 14) {
    phase = 'nadir';
    phaseLabel = 'Nadir Period';
    phaseColor = '#ef4444';
  } else if (dayInCycle >= cycleLengthDays - 3) {
    phase = 'pre-infusion';
    phaseLabel = 'Pre-Infusion';
    phaseColor = '#f59e0b';
  }

  const regimenMatch = notes.match(/(?:regimen|protocol)[:\s]*([a-z0-9\-+\s]+)/i);
  const regimen = regimenMatch ? regimenMatch[1].trim().toUpperCase() : '';

  return {
    drugName: med.name,
    regimen,
    currentCycle,
    totalCycles,
    cycleLengthDays,
    dayInCycle,
    phase,
    phaseLabel,
    phaseColor,
    nextInfusion: med.refillDate,
  };
}

function PhaseIcon({ phase }: { phase: CycleInfo['phase'] }) {
  switch (phase) {
    case 'infusion':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v6l3 3-3 3v6" /><path d="M8 11h8" />
        </svg>
      );
    case 'nadir':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" />
        </svg>
      );
    case 'recovery':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'pre-infusion':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      );
  }
}

function SeverityDot({ severity }: { severity: SideEffect['severity'] }) {
  const colors = {
    mild: 'bg-emerald-400',
    moderate: 'bg-amber-400',
    severe: 'bg-red-400',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[severity]}`} />;
}

export function TreatmentCycleTracker({ medications, patientName }: TreatmentCycleTrackerProps) {
  const [showSideEffects, setShowSideEffects] = useState(false);
  const [sideEffects, setSideEffects] = useState<SideEffect[]>([]);
  const [addingEffect, setAddingEffect] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<SideEffect['severity']>('mild');
  const [recentSymptoms, setRecentSymptoms] = useState<SymptomEntry[]>([]);

  const cycleInfo = useMemo(() => {
    for (const med of medications) {
      const info = parseCycleInfo(med);
      if (info) return info;
    }
    return null;
  }, [medications]);

  // Fetch recent symptom entries to correlate with cycle
  useEffect(() => {
    if (!cycleInfo) return;
    const fetchSymptoms = async () => {
      try {
        const res = await fetch(`/api/journal?days=${cycleInfo.cycleLengthDays}`);
        if (res.ok) {
          const data = await res.json();
          setRecentSymptoms(data.entries || []);
        }
      } catch {
        // silently fail
      }
    };
    fetchSymptoms();
  }, [cycleInfo]);

  // Load persisted side effects from localStorage
  useEffect(() => {
    if (!cycleInfo) return;
    try {
      const stored = localStorage.getItem('cc-side-effects');
      if (stored) setSideEffects(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, [cycleInfo]);

  const persistEffects = useCallback((effects: SideEffect[]) => {
    setSideEffects(effects);
    try {
      localStorage.setItem('cc-side-effects', JSON.stringify(effects));
    } catch {
      // ignore
    }
  }, []);

  const handleAddSideEffect = useCallback(() => {
    if (!selectedEffect || !cycleInfo) return;
    const newEffect: SideEffect = {
      name: selectedEffect,
      severity: selectedSeverity,
      cycle: cycleInfo.currentCycle,
      day: cycleInfo.dayInCycle,
      date: new Date().toISOString().split('T')[0],
    };
    persistEffects([newEffect, ...sideEffects]);
    setSelectedEffect('');
    setSelectedSeverity('mild');
    setAddingEffect(false);
  }, [selectedEffect, selectedSeverity, cycleInfo, sideEffects, persistEffects]);

  const removeSideEffect = useCallback((index: number) => {
    persistEffects(sideEffects.filter((_, i) => i !== index));
  }, [sideEffects, persistEffects]);

  if (!cycleInfo) return null;

  const progressPercent = (cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) * 100;
  const overallPercent = ((cycleInfo.currentCycle - 1 + cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) / cycleInfo.totalCycles) * 100;

  const firstName = patientName.split(' ')[0];
  const daysLeft = cycleInfo.cycleLengthDays - cycleInfo.dayInCycle;

  // Effects for the current cycle
  const currentCycleEffects = sideEffects.filter(e => e.cycle === cycleInfo.currentCycle);

  // Build phase timeline segments
  const phases = [
    { label: 'Infusion', start: 0, end: 2, color: '#6366F1' },
    { label: 'Early Recovery', start: 3, end: 7, color: '#3b82f6' },
    { label: 'Nadir', start: 8, end: 14, color: '#ef4444' },
    { label: 'Recovery', start: 15, end: cycleInfo.cycleLengthDays, color: '#10b981' },
  ];

  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden animate-card-in">
      {/* Header with gradient accent */}
      <div className="p-3 sm:p-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${cycleInfo.phaseColor}30, ${cycleInfo.phaseColor}10)` }}
            >
              <span className="text-lg" role="img" aria-label="treatment">&#127895;</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f1f5f9]">Treatment Cycle</h3>
              <p className="text-[11px] text-[#94a3b8]">{firstName}&apos;s {cycleInfo.regimen || cycleInfo.drugName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A78BFA] bg-clip-text text-transparent">
              {cycleInfo.currentCycle}<span className="text-sm font-normal text-[#94a3b8]">/{cycleInfo.totalCycles}</span>
            </div>
            <div className="text-[10px] text-[#94a3b8]">Day {cycleInfo.dayInCycle} of {cycleInfo.cycleLengthDays}</div>
          </div>
        </div>

        {/* Cycle visual indicator - dots for each cycle */}
        <div className="flex items-center gap-1.5 mb-4">
          {Array.from({ length: cycleInfo.totalCycles }, (_, i) => {
            const cycleNum = i + 1;
            const isComplete = cycleNum < cycleInfo.currentCycle;
            const isCurrent = cycleNum === cycleInfo.currentCycle;
            const isFuture = cycleNum > cycleInfo.currentCycle;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className={`h-2 w-full rounded-full transition-all duration-500 ${
                    isCurrent ? 'ring-1 ring-[#A78BFA]/40 ring-offset-1 ring-offset-transparent' : ''
                  }`}
                  style={{
                    background: isComplete
                      ? 'linear-gradient(90deg, #6366F1, #A78BFA)'
                      : isCurrent
                        ? `linear-gradient(90deg, #6366F1 ${progressPercent}%, rgba(255,255,255,0.06) ${progressPercent}%)`
                        : 'rgba(255,255,255,0.06)',
                  }}
                />
                <span className={`text-[8px] mt-1 ${isCurrent ? 'text-[#A78BFA] font-semibold' : isFuture ? 'text-[#64748b]' : 'text-[#94a3b8]'}`}>
                  C{cycleNum}
                </span>
              </div>
            );
          })}
        </div>

        {/* Phase timeline */}
        <div className="mb-3">
          <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden flex relative">
            {phases.map((p) => {
              const widthPct = ((p.end - p.start) / cycleInfo.cycleLengthDays) * 100;
              const isActive = cycleInfo.dayInCycle >= p.start && cycleInfo.dayInCycle <= p.end;
              return (
                <div
                  key={p.label}
                  className="h-full relative transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    background: isActive ? `${p.color}40` : `${p.color}15`,
                    borderRight: '1px solid rgba(0,0,0,0.2)',
                  }}
                />
              );
            })}
            {/* Current position marker */}
            <div
              className="absolute top-0 h-full w-0.5 transition-all duration-1000 ease-out"
              style={{
                left: `${Math.min(progressPercent, 99)}%`,
                background: `linear-gradient(180deg, ${cycleInfo.phaseColor}, transparent)`,
              }}
            >
              <div
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 shadow-lg"
                style={{
                  background: cycleInfo.phaseColor,
                  borderColor: '#0f172a',
                  boxShadow: `0 0 8px ${cycleInfo.phaseColor}60`,
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1.5 text-[8px] sm:text-[9px] text-[#64748b]">
            {phases.map((p) => (
              <span
                key={p.label}
                className={`truncate px-0.5 ${
                  cycleInfo.dayInCycle >= p.start && cycleInfo.dayInCycle <= p.end
                    ? 'font-semibold text-[#94a3b8]'
                    : ''
                }`}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Current phase badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{ background: `${cycleInfo.phaseColor}15`, color: cycleInfo.phaseColor }}
            >
              <PhaseIcon phase={cycleInfo.phase} />
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cycleInfo.phaseColor }} />
              {cycleInfo.phaseLabel}
            </div>
            {cycleInfo.phase === 'nadir' && (
              <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                Watch for fever &gt; 100.4F
              </span>
            )}
          </div>
          {daysLeft > 0 && cycleInfo.nextInfusion && (
            <div className="text-right">
              <div className="text-lg font-bold text-[#f1f5f9]">{daysLeft}</div>
              <div className="text-[9px] text-[#94a3b8] -mt-0.5">days to next</div>
            </div>
          )}
        </div>
      </div>

      {/* Side Effects Section */}
      <div className="border-t border-white/[0.06]">
        <button
          onClick={() => setShowSideEffects(!showSideEffects)}
          aria-expanded={showSideEffects}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#A78BFA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12h6" /><path d="M12 9v6" /><circle cx="12" cy="12" r="10" />
            </svg>
            <span className="text-xs font-semibold text-[#f1f5f9]">Side Effects</span>
            {currentCycleEffects.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] font-semibold">
                {currentCycleEffects.length}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-[#64748b] transition-transform duration-200 ${showSideEffects ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showSideEffects && (
          <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Current cycle effects list */}
            {currentCycleEffects.length > 0 ? (
              <div className="space-y-1.5">
                {currentCycleEffects.map((effect, idx) => (
                  <div
                    key={`${effect.name}-${effect.date}-${idx}`}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.03] group"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={effect.severity} />
                      <span className="text-xs text-[#f1f5f9]">{effect.name}</span>
                      <span className="text-[9px] text-[#64748b]">Day {effect.day}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        effect.severity === 'mild' ? 'bg-emerald-400/10 text-emerald-400' :
                        effect.severity === 'moderate' ? 'bg-amber-400/10 text-amber-400' :
                        'bg-red-400/10 text-red-400'
                      }`}>
                        {effect.severity}
                      </span>
                      <button
                        onClick={() => removeSideEffect(sideEffects.indexOf(effect))}
                        aria-label={`Remove ${effect.name}`}
                        className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-red-400 transition-all"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#64748b] text-center py-2">
                No side effects logged this cycle
              </p>
            )}

            {/* Symptom correlation from journal */}
            {recentSymptoms.length > 0 && (
              <div className="rounded-lg bg-white/[0.03] p-2.5">
                <div className="text-[10px] text-[#94a3b8] font-semibold mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                  Journal Symptoms This Cycle
                </div>
                <div className="flex flex-wrap gap-1">
                  {recentSymptoms
                    .flatMap(e => (e.symptoms || []).map(s => ({ symptom: s, pain: e.painLevel })))
                    .reduce<{ symptom: string; count: number; maxPain: number }[]>((acc, { symptom, pain }) => {
                      const existing = acc.find(a => a.symptom === symptom);
                      if (existing) {
                        existing.count++;
                        existing.maxPain = Math.max(existing.maxPain, pain ?? 0);
                      } else {
                        acc.push({ symptom, count: 1, maxPain: pain ?? 0 });
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8)
                    .map(({ symptom, count, maxPain }) => (
                      <span
                        key={symptom}
                        className={`text-[9px] px-2 py-0.5 rounded-full border ${
                          maxPain >= 7
                            ? 'border-red-400/30 bg-red-400/10 text-red-400'
                            : maxPain >= 4
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                              : 'border-white/[0.08] bg-white/[0.04] text-[#94a3b8]'
                        }`}
                      >
                        {symptom} {count > 1 && <span className="opacity-60">x{count}</span>}
                      </span>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Add side effect */}
            {addingEffect ? (
              <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3 space-y-3">
                <div>
                  <label className="text-[10px] text-[#94a3b8] mb-1.5 block font-medium">Side Effect</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SIDE_EFFECTS.map(effect => (
                      <button
                        key={effect}
                        onClick={() => setSelectedEffect(effect)}
                        aria-pressed={selectedEffect === effect}
                        className={`text-[10px] px-2.5 py-1.5 min-h-[36px] rounded-full border transition-all ${
                          selectedEffect === effect
                            ? 'border-[#A78BFA]/50 bg-[#A78BFA]/15 text-[#A78BFA] font-semibold'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#94a3b8] hover:bg-white/[0.06]'
                        }`}
                      >
                        {effect}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#94a3b8] mb-1.5 block font-medium">Severity</label>
                  <div className="flex gap-2">
                    {(['mild', 'moderate', 'severe'] as const).map(sev => (
                      <button
                        key={sev}
                        onClick={() => setSelectedSeverity(sev)}
                        aria-pressed={selectedSeverity === sev}
                        className={`flex-1 text-[10px] py-2 min-h-[44px] rounded-lg border transition-all capitalize font-medium ${
                          selectedSeverity === sev
                            ? sev === 'mild'
                              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-400'
                              : sev === 'moderate'
                                ? 'border-amber-400/50 bg-amber-400/15 text-amber-400'
                                : 'border-red-400/50 bg-red-400/15 text-red-400'
                            : 'border-white/[0.08] bg-white/[0.03] text-[#94a3b8] hover:bg-white/[0.06]'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSideEffect}
                    disabled={!selectedEffect}
                    className="flex-1 py-2 min-h-[44px] rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-[11px] font-semibold disabled:opacity-40 transition-opacity"
                  >
                    Log Side Effect
                  </button>
                  <button
                    onClick={() => { setAddingEffect(false); setSelectedEffect(''); }}
                    className="px-4 py-2 min-h-[44px] rounded-lg bg-white/[0.06] border border-white/[0.08] text-[#94a3b8] text-[11px] font-semibold hover:bg-white/[0.08] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingEffect(true)}
                className="w-full py-2 min-h-[44px] rounded-lg border border-dashed border-white/[0.12] text-[11px] text-[#94a3b8] hover:border-[#A78BFA]/30 hover:text-[#A78BFA] transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                Log a side effect
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overall progress footer */}
      <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-[#94a3b8] font-medium">Overall treatment progress</span>
          <span className="text-[11px] font-bold bg-gradient-to-r from-[#6366F1] to-[#A78BFA] bg-clip-text text-transparent">
            {Math.round(overallPercent)}%
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(overallPercent, 100)}%`,
              background: 'linear-gradient(90deg, #6366F1, #A78BFA)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
