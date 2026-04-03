'use client';

import { useState } from 'react';
import type { SymptomEntry } from '@/lib/types';

interface SymptomJournalProps {
  patientName: string;
  initialEntries: SymptomEntry[];
}

const MOOD_EMOJIS: Record<string, string> = { great: '😄', good: '🙂', okay: '😐', bad: '😞', terrible: '😢' };
const SLEEP_EMOJIS: Record<string, string> = { great: '😴', good: '🛏️', fair: '😑', poor: '😫', terrible: '🥱' };
const ENERGY_LABELS: Record<string, string> = { high: '⚡ High', normal: '✅ Normal', low: '🔋 Low', very_low: '🪫 Very Low' };

const COMMON_SYMPTOMS = ['Headache', 'Nausea', 'Dizziness', 'Fatigue', 'Joint pain', 'Shortness of breath', 'Cough', 'Chest pain', 'Back pain', 'Anxiety', 'Constipation', 'Swelling'];

export function SymptomJournal({ patientName, initialEntries }: SymptomJournalProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find((e) => e.date === today);

  // Form state
  const [painLevel, setPainLevel] = useState(todayEntry?.pain_level ?? 0);
  const [mood, setMood] = useState(todayEntry?.mood || '');
  const [sleepQuality, setSleepQuality] = useState(todayEntry?.sleep_quality || '');
  const [sleepHours, setSleepHours] = useState(todayEntry?.sleep_hours?.toString() || '');
  const [appetite, setAppetite] = useState(todayEntry?.appetite || '');
  const [energy, setEnergy] = useState(todayEntry?.energy || '');
  const [symptoms, setSymptoms] = useState<string[]>(todayEntry?.symptoms || []);
  const [notes, setNotes] = useState(todayEntry?.notes || '');

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  async function saveEntry() {
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (painLevel > 0) body.pain_level = painLevel;
    if (mood) body.mood = mood;
    if (sleepQuality) body.sleep_quality = sleepQuality;
    if (sleepHours) body.sleep_hours = parseFloat(sleepHours);
    if (appetite) body.appetite = appetite;
    if (energy) body.energy = energy;
    if (symptoms.length) body.symptoms = symptoms;
    if (notes.trim()) body.notes = notes.trim();

    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      // Update local entries
      setEntries((prev) => {
        const without = prev.filter((e) => e.date !== today);
        return [data.entry, ...without];
      });
      setMessage('Saved!');
      setShowForm(false);
      setTimeout(() => setMessage(null), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Symptom Journal</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold"
        >
          {showForm ? 'Cancel' : todayEntry ? 'Update Today' : 'Log Today'}
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-5">Track {patientName}&apos;s daily symptoms and wellness.</p>

      {message && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
          {message}
        </div>
      )}

      {/* Today's check-in form */}
      {showForm && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 mb-6 space-y-5 animate-card-in">
          {/* Pain level */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Pain Level</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--text-muted)] w-6">0</span>
              <input
                type="range" min="0" max="10" value={painLevel}
                onChange={(e) => setPainLevel(parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-[var(--text-muted)] w-6">10</span>
              <span className={`text-sm font-bold ml-2 ${painLevel <= 3 ? 'text-emerald-400' : painLevel <= 6 ? 'text-amber-400' : 'text-red-400'}`}>{painLevel}</span>
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Mood</label>
            <div className="flex gap-2 mt-2">
              {Object.entries(MOOD_EMOJIS).map(([key, emoji]) => (
                <button key={key} onClick={() => setMood(key)}
                  className={`flex-1 py-2 rounded-lg text-center text-lg transition-colors ${mood === key ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-white/[0.04] border border-white/[0.06]'}`}
                  title={key}>{emoji}</button>
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sleep Quality</label>
              <div className="flex gap-1 mt-2">
                {Object.entries(SLEEP_EMOJIS).map(([key, emoji]) => (
                  <button key={key} onClick={() => setSleepQuality(key)}
                    className={`flex-1 py-1.5 rounded text-center text-sm transition-colors ${sleepQuality === key ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-white/[0.04] border border-white/[0.06]'}`}
                    title={key}>{emoji}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hours Slept</label>
              <input type="number" step="0.5" min="0" max="24" value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="7.5"
                className="w-full mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 px-3 text-white text-sm focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Energy & Appetite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Energy</label>
              <select value={energy} onChange={(e) => setEnergy(e.target.value)}
                className="w-full mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 px-3 text-white text-sm focus:outline-none focus:border-blue-600">
                <option value="">Select...</option>
                {Object.entries(ENERGY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Appetite</label>
              <select value={appetite} onChange={(e) => setAppetite(e.target.value)}
                className="w-full mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 px-3 text-white text-sm focus:outline-none focus:border-blue-600">
                <option value="">Select...</option>
                <option value="normal">Normal</option>
                <option value="increased">Increased</option>
                <option value="decreased">Decreased</option>
                <option value="none">No appetite</option>
              </select>
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Symptoms</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COMMON_SYMPTOMS.map((s) => (
                <button key={s} onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${symptoms.includes(s) ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-secondary)]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything else to note..."
              className="w-full mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 px-3 text-white text-sm focus:outline-none focus:border-blue-600 resize-none" />
          </div>

          <button onClick={saveEntry} disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white font-semibold disabled:opacity-50 transition-opacity">
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Entries</h3>
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-muted)] text-sm">No entries yet. Start tracking today!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.mood && <span title={`Mood: ${entry.mood}`}>{MOOD_EMOJIS[entry.mood]}</span>}
                    {entry.pain_level !== null && entry.pain_level > 0 && (
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${entry.pain_level <= 3 ? 'bg-emerald-500/20 text-emerald-400' : entry.pain_level <= 6 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {entry.pain_level}/10
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.sleep_quality && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[var(--text-secondary)]">Sleep: {entry.sleep_quality}</span>}
                  {entry.energy && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[var(--text-secondary)]">Energy: {entry.energy}</span>}
                  {entry.symptoms?.map((s) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{s}</span>
                  ))}
                </div>
                {entry.notes && <p className="text-xs text-[var(--text-muted)] mt-2">{entry.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
