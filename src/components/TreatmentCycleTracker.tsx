'use client';

import { useMemo } from 'react';
import type { Medication } from '@/lib/types';

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

function parseCycleInfo(med: Medication): CycleInfo | null {
  const notes = (med.notes || '').toLowerCase();
  const freq = (med.frequency || '').toLowerCase();

  // Look for cycle patterns like "Cycle 4 of 6" or "cycle 3/6"
  const cycleMatch = notes.match(/cycle\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (!cycleMatch) return null;

  const currentCycle = parseInt(cycleMatch[1]);
  const totalCycles = parseInt(cycleMatch[2]);

  // Determine cycle length from frequency
  let cycleLengthDays = 21; // default 3-week cycles
  if (freq.includes('every 2 weeks') || freq.includes('every 14')) cycleLengthDays = 14;
  if (freq.includes('every 3 weeks') || freq.includes('every 21')) cycleLengthDays = 21;
  if (freq.includes('every 4 weeks') || freq.includes('every 28')) cycleLengthDays = 28;
  if (freq.includes('weekly')) cycleLengthDays = 7;

  // Estimate day in cycle from refill date (next infusion)
  let dayInCycle = 1;
  if (med.refill_date) {
    const nextInfusion = new Date(med.refill_date);
    const now = new Date();
    const daysUntilNext = Math.ceil((nextInfusion.getTime() - now.getTime()) / 86400000);
    dayInCycle = Math.max(1, cycleLengthDays - daysUntilNext);
  }

  // Determine phase
  let phase: CycleInfo['phase'] = 'recovery';
  let phaseLabel = 'Recovery';
  let phaseColor = '#10b981'; // green

  if (dayInCycle <= 2) {
    phase = 'infusion';
    phaseLabel = 'Infusion Days';
    phaseColor = '#6366F1'; // indigo
  } else if (dayInCycle >= 8 && dayInCycle <= 14) {
    phase = 'nadir';
    phaseLabel = 'Nadir Period';
    phaseColor = '#ef4444'; // red
  } else if (dayInCycle >= cycleLengthDays - 3) {
    phase = 'pre-infusion';
    phaseLabel = 'Pre-Infusion';
    phaseColor = '#f59e0b'; // amber
  } else {
    phase = 'recovery';
    phaseLabel = 'Recovery';
    phaseColor = '#10b981';
  }

  // Extract regimen name
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
    nextInfusion: med.refill_date,
  };
}

export function TreatmentCycleTracker({ medications, patientName }: TreatmentCycleTrackerProps) {
  const cycleInfo = useMemo(() => {
    for (const med of medications) {
      const info = parseCycleInfo(med);
      if (info) return info;
    }
    return null;
  }, [medications]);

  if (!cycleInfo) return null;

  const progressPercent = (cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) * 100;
  const overallPercent = ((cycleInfo.currentCycle - 1 + cycleInfo.dayInCycle / cycleInfo.cycleLengthDays) / cycleInfo.totalCycles) * 100;

  const firstName = patientName.split(' ')[0];
  const daysLeft = cycleInfo.cycleLengthDays - cycleInfo.dayInCycle;

  return (
    <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] animate-card-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `${cycleInfo.phaseColor}20` }}>
            🎗️
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Treatment Cycle</h3>
            <p className="text-[10px] text-[var(--text-muted)]">{firstName}&apos;s {cycleInfo.regimen || cycleInfo.drugName}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[var(--text)]">
            Cycle {cycleInfo.currentCycle}<span className="text-[var(--text-muted)] text-sm font-normal">/{cycleInfo.totalCycles}</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">Day {cycleInfo.dayInCycle} of {cycleInfo.cycleLengthDays}</div>
        </div>
      </div>

      {/* Cycle progress bar */}
      <div className="mb-3">
        <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden relative">
          {/* Phase markers */}
          <div className="absolute left-0 h-full rounded-l-full" style={{ width: `${(2 / cycleInfo.cycleLengthDays) * 100}%`, background: '#6366F130' }} />
          <div className="absolute h-full" style={{ left: `${(8 / cycleInfo.cycleLengthDays) * 100}%`, width: `${(6 / cycleInfo.cycleLengthDays) * 100}%`, background: '#ef444420' }} />
          {/* Progress */}
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out relative"
            style={{
              width: `${Math.min(progressPercent, 100)}%`,
              background: `linear-gradient(90deg, #6366F1, ${cycleInfo.phaseColor})`,
            }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-white/20" />
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[var(--text-muted)]">
          <span>Infusion</span>
          <span>Nadir (day 8-14)</span>
          <span>Recovery</span>
        </div>
      </div>

      {/* Current phase badge + info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${cycleInfo.phaseColor}20`, color: cycleInfo.phaseColor }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cycleInfo.phaseColor }} />
            {cycleInfo.phaseLabel}
          </div>
          {cycleInfo.phase === 'nadir' && (
            <span className="text-[10px] text-red-400">Watch for fever &gt; 100.4°F</span>
          )}
        </div>
        {daysLeft > 0 && cycleInfo.nextInfusion && (
          <span className="text-[10px] text-[var(--text-muted)]">
            Next infusion in {daysLeft} day{daysLeft === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Overall progress */}
      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--text-muted)]">Overall treatment progress</span>
          <span className="text-[10px] font-semibold text-[#A78BFA]">{Math.round(overallPercent)}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#A78BFA] transition-all duration-1000"
            style={{ width: `${Math.min(overallPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {Array.from({ length: cycleInfo.totalCycles }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < cycleInfo.currentCycle ? 'bg-[#A78BFA]' : i === cycleInfo.currentCycle - 1 ? 'bg-[#6366F1] animate-pulse' : 'bg-white/[0.1]'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
