'use client';

import type { LabResult, Medication, Claim, SymptomEntry, ReminderLog } from '@/lib/types';

interface AnalyticsDashboardProps {
  patientName: string;
  labResults: LabResult[];
  symptoms: SymptomEntry[];
  reminderLogs: ReminderLog[];
  medications: Medication[];
  claims: Claim[];
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

export function AnalyticsDashboard({ patientName, labResults, symptoms, reminderLogs, medications, claims }: AnalyticsDashboardProps) {
  // ---- Medication Adherence ----
  const totalReminders = reminderLogs.length;
  const takenCount = reminderLogs.filter((l) => l.status === 'taken').length;
  const missedCount = reminderLogs.filter((l) => l.status === 'missed').length;
  const adherenceRate = totalReminders > 0 ? Math.round((takenCount / totalReminders) * 100) : null;

  // ---- Symptom Trends ----
  const recentSymptoms = symptoms.slice(-14);
  const avgPain = recentSymptoms.filter((s) => s.pain_level !== null).length > 0
    ? (recentSymptoms.reduce((sum, s) => sum + (s.pain_level || 0), 0) / recentSymptoms.filter((s) => s.pain_level !== null).length).toFixed(1)
    : null;
  const avgSleep = recentSymptoms.filter((s) => s.sleep_hours !== null).length > 0
    ? (recentSymptoms.reduce((sum, s) => sum + (s.sleep_hours || 0), 0) / recentSymptoms.filter((s) => s.sleep_hours !== null).length).toFixed(1)
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
    const existing = labGroups.get(lab.test_name) || [];
    existing.push(lab);
    labGroups.set(lab.test_name, existing);
  }
  const labTrends = Array.from(labGroups.entries())
    .filter(([, results]) => results.length >= 2)
    .slice(0, 6);

  // ---- Spending ----
  const totalBilled = claims.reduce((sum, c) => sum + (c.billed_amount || 0), 0);
  const totalPaid = claims.reduce((sum, c) => sum + (c.paid_amount || 0), 0);
  const totalOOP = claims.reduce((sum, c) => sum + (c.patient_responsibility || 0), 0);
  const deniedCount = claims.filter((c) => c.status === 'denied').length;

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-1">Health Analytics</h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">{patientName}&apos;s trends and insights</p>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{medications.length}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Medications</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{labResults.filter((l) => l.is_abnormal).length}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Abnormal Labs</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${adherenceRate !== null && adherenceRate >= 80 ? 'text-emerald-400' : adherenceRate !== null ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            {adherenceRate !== null ? `${adherenceRate}%` : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Med Adherence</p>
        </div>
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
                  const hours = s.sleep_hours || 0;
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
                  <span key={symptom} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
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
              const changeStr = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);

              return (
                <div key={testName} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{testName}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{results.length} results</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono ${latest.is_abnormal ? 'text-amber-400' : 'text-white'}`}>
                      {latest.value} {latest.unit || ''}
                    </p>
                    {!isNaN(change) && change !== 0 && (
                      <p className={`text-[10px] ${change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {changeStr} {latest.unit || ''}
                      </p>
                    )}
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
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Total Billed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">${totalPaid.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Insurance Paid</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400">${totalOOP.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Your Cost</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{deniedCount}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Denied Claims</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentSymptoms.length === 0 && labTrends.length === 0 && totalReminders === 0 && claims.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)] text-sm">Start logging symptoms, labs, and medications to see trends here.</p>
        </div>
      )}
    </div>
  );
}
