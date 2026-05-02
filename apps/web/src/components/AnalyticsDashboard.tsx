'use client';

import type { LabResult, Medication, Claim, SymptomEntry, ReminderLog } from '@/lib/types';
import { Skeleton } from '@/components/Skeleton';

interface AnalyticsDashboardProps {
  patientName: string;
  labResults: LabResult[];
  symptoms: SymptomEntry[];
  reminderLogs: ReminderLog[];
  medications: Medication[];
  claims: Claim[];
  loading?: boolean;
}

const MOOD_VALUES: Record<string, number> = { terrible: 1, bad: 2, okay: 3, good: 4, great: 5 };
const MOOD_COLORS: Record<string, string> = { terrible: '#ef4444', bad: '#f97316', okay: '#eab308', good: '#22c55e', great: '#10b981' };

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function AnalyticsDashboard({ patientName, labResults, symptoms, reminderLogs, medications, claims, loading }: AnalyticsDashboardProps) {
  // ---- Medication Adherence ----
  const totalReminders = reminderLogs.length;
  const takenCount = reminderLogs.filter((l) => l.status === 'taken').length;
  const missedCount = reminderLogs.filter((l) => l.status === 'missed').length;
  const adherenceRate = totalReminders > 0 ? Math.round((takenCount / totalReminders) * 100) : null;

  // ---- Symptom Trends ----
  const recentSymptoms = symptoms.slice(-14);
  const avgPain = recentSymptoms.filter((s) => s.painLevel !== null).length > 0
    ? (recentSymptoms.reduce((sum, s) => sum + (s.painLevel || 0), 0) / recentSymptoms.filter((s) => s.painLevel !== null).length).toFixed(1)
    : null;
  const avgSleep = recentSymptoms.filter((s) => s.sleepHours !== null).length > 0
    ? (recentSymptoms.reduce((sum, s) => sum + parseFloat(s.sleepHours || '0'), 0) / recentSymptoms.filter((s) => s.sleepHours !== null).length).toFixed(1)
    : null;

  // Most common symptoms
  const symptomCounts = new Map<string, number>();
  for (const entry of recentSymptoms) {
    for (const s of entry.symptoms || []) {
      symptomCounts.set(s, (symptomCounts.get(s) || 0) + 1);
    }
  }
  const topSymptoms = Array.from(symptomCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---- Lab Trends ----
  // Group labs by test name
  const labGroups = new Map<string, LabResult[]>();
  for (const lab of labResults) {
    const existing = labGroups.get(lab.testName) || [];
    existing.push(lab);
    labGroups.set(lab.testName, existing);
  }
  const labTrends = Array.from(labGroups.entries())
    .filter(([, results]) => results.length >= 2)
    .slice(0, 6);

  // ---- Spending ----
  const totalBilled = claims.reduce((sum, c) => sum + parseFloat(c.billedAmount || '0'), 0);
  const totalPaid = claims.reduce((sum, c) => sum + parseFloat(c.paidAmount || '0'), 0);
  const totalOOP = claims.reduce((sum, c) => sum + parseFloat(c.patientResponsibility || '0'), 0);
  const deniedCount = claims.filter((c) => c.status === 'denied').length;

  if (loading) {
    return (
      <div className="px-5 py-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-white mb-1">Health Analytics</h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">{patientName}&apos;s trends and insights</p>
        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
        {/* Skeleton chart blocks */}
        <Skeleton className="h-[160px] mb-4" />
        <Skeleton className="h-[120px] mb-4" />
        <Skeleton className="h-[100px] mb-4" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Health Analytics</h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">{patientName}&apos;s trends and insights</p>

      {/* Summary row — inline stats, no hero grid */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5 text-xs text-[var(--text-secondary)]">
        <span><span className="font-semibold text-[var(--text)]">{medications.length}</span> medications</span>
        {labResults.filter((l) => l.isAbnormal).length > 0 && (
          <span><span className="font-semibold text-amber-400">{labResults.filter((l) => l.isAbnormal).length}</span> abnormal labs</span>
        )}
        {adherenceRate !== null && (
          <span>Adherence: <span className={`font-semibold ${adherenceRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{adherenceRate}%</span></span>
        )}
      </div>

      {/* Medication Adherence */}
      {totalReminders > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Medication Adherence (30 days)</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <MiniBar value={takenCount} max={totalReminders} color="#10b981" />
            </div>
            <span className="text-sm text-emerald-400 font-mono">{takenCount}/{totalReminders}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-emerald-400">Taken: {takenCount}</span>
            <span className="text-red-400">Missed: {missedCount}</span>
            <span className="text-[var(--text-muted)]">Snoozed: {reminderLogs.filter((l) => l.status === 'snoozed').length}</span>
          </div>
        </div>
      )}

      {/* Symptom Trends */}
      {recentSymptoms.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Symptom Trends (14 days)</h3>

          {/* Mood sparkline */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">Mood</span>
              {avgPain && <span className="text-xs text-[var(--text-muted)]">Avg pain: {avgPain}/10</span>}
            </div>
            <div className="flex items-end gap-1 h-8">
              {recentSymptoms.map((s, i) => {
                const val = s.mood ? MOOD_VALUES[s.mood] : 0;
                if (!val) return <div key={i} className="flex-1 bg-white/[0.03] rounded-sm" />;
                return (
                  <div key={i} className="flex-1 rounded-sm transition-all" style={{
                    height: `${(val / 5) * 100}%`,
                    backgroundColor: s.mood ? MOOD_COLORS[s.mood] : '#333',
                  }} title={`${s.date}: ${s.mood}`} />
                );
              })}
            </div>
          </div>

          {/* Sleep */}
          {avgSleep && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-secondary)]">Sleep</span>
                <span className="text-xs text-[var(--text-muted)]">Avg: {avgSleep}h</span>
              </div>
              <div className="flex items-end gap-1 h-6">
                {recentSymptoms.map((s, i) => {
                  const hours = parseFloat(s.sleepHours || '0');
                  return (
                    <div key={i} className="flex-1 rounded-sm bg-indigo-500/60 transition-all"
                      style={{ height: `${Math.min((hours / 10) * 100, 100)}%` }}
                      title={`${s.date}: ${hours}h`} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Top symptoms */}
          {topSymptoms.length > 0 && (
            <div>
              <span className="text-xs text-[var(--text-secondary)]">Most reported</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {topSymptoms.map(([symptom, count]) => (
                  <span key={symptom} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-secondary)]">
                    {symptom} ({count}x)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lab Trends */}
      {labTrends.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Lab Trends</h3>
          <div className="space-y-3">
            {labTrends.map(([testName, results]) => {
              const latest = results[results.length - 1];
              const previous = results[results.length - 2];
              const latestVal = parseFloat(latest.value || '0');
              const prevVal = parseFloat(previous.value || '0');
              const change = latestVal - prevVal;

              return (
                <div key={testName} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{testName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{results.length} results</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono ${latest.isAbnormal ? 'text-amber-400' : 'text-white'}`}>
                      {latest.value} {latest.unit || ''}
                    </p>
                    {!isNaN(change) && change !== 0 && (() => {
                      const rising = change > 0
                      // directionIsGood: true = rising is good (e.g. hemoglobin), false = rising is bad (e.g. PSA), null = unknown
                      const dir = latest.directionIsGood
                      const isGood = dir === null ? null : (dir ? rising : !rising)
                      const color = isGood === null ? 'text-[var(--text-muted)]' : isGood ? 'text-emerald-400' : 'text-amber-400'
                      return (
                        <p className={`text-xs ${color}`}>
                          {rising ? '↑' : '↓'} {Math.abs(change).toFixed(1)} {latest.unit || ''}
                        </p>
                      )
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spending */}
      {claims.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Medical Spending</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-lg font-bold text-white">${totalBilled.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] uppercase">Total Billed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">${totalPaid.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] uppercase">Insurance Paid</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400">${totalOOP.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] uppercase">Your Cost</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{deniedCount}</p>
              <p className="text-xs text-[var(--text-muted)] uppercase">Denied Claims</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state for new users */}
      {recentSymptoms.length === 0 && labTrends.length === 0 && totalReminders === 0 && claims.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">No analytics yet</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
            Your analytics will populate after your first week of tracking. Start logging symptoms, labs, and medications to see trends here.
          </p>
        </div>
      )}
    </div>
  );
}
