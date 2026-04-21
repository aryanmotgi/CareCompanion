'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SymptomEntry } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

const DRAFT_KEY = 'journal-draft';

interface JournalDraft {
  painLevel: number;
  nauseaLevel: number;
  fatigueLevel: number;
  mood: string;
  sleepQuality: string;
  sleepHours: string;
  appetite: string;
  energy: string;
  symptoms: string[];
  notes: string;
}

interface SymptomJournalProps {
  patientName: string;
  initialEntries: SymptomEntry[];
}

const MOOD_LABELS: Record<string, string> = { great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', terrible: 'Terrible' };
const MOOD_COLORS: Record<string, string> = { great: '#34D399', good: '#60A5FA', okay: '#FCD34D', bad: '#FB923C', terrible: '#F87171' };
const SLEEP_LABELS: Record<string, string> = { great: 'Great', good: 'Good', fair: 'Fair', poor: 'Poor', terrible: 'Bad' };
const ENERGY_LABELS: Record<string, string> = { high: 'High', normal: 'Normal', low: 'Low', very_low: 'Very Low' };

const COMMON_SYMPTOMS = ['Nausea', 'Vomiting', 'Fatigue', 'Mouth sores', 'Neuropathy', 'Chemo brain', 'Hair loss', 'Loss of appetite', 'Constipation', 'Diarrhea', 'Bone pain', 'Skin changes', 'Hand-foot syndrome', 'Shortness of breath', 'Anxiety', 'Fever/chills'];

export function SymptomJournal({ patientName, initialEntries }: SymptomJournalProps) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find((e) => e.date === today);

  // Form state — restore draft from localStorage on mount
  const [painLevel, setPainLevel] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.painLevel ?? 0; } catch { /* no draft */ }
    }
    return todayEntry?.painLevel ?? 0;
  });
  const [nauseaLevel, setNauseaLevel] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.nauseaLevel ?? 0; } catch { /* no draft */ }
    }
    return 0;
  });
  const [fatigueLevel, setFatigueLevel] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.fatigueLevel ?? 0; } catch { /* no draft */ }
    }
    return 0;
  });
  const [mood, setMood] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.mood ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.mood || '';
  });
  const [sleepQuality, setSleepQuality] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.sleepQuality ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.sleepQuality || '';
  });
  const [sleepHours, setSleepHours] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.sleepHours ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.sleepHours?.toString() || '';
  });
  const [appetite, setAppetite] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.appetite ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.appetite || '';
  });
  const [energy, setEnergy] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.energy ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.energy || '';
  });
  const [symptoms, setSymptoms] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.symptoms ?? []; } catch { /* no draft */ }
    }
    return todayEntry?.symptoms || [];
  });
  const [notes, setNotes] = useState(() => {
    if (typeof window !== 'undefined') {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return d.notes ?? ''; } catch { /* no draft */ }
    }
    return todayEntry?.notes || '';
  });

  // Auto-open form if draft exists
  const [draftRestored] = useState(() => {
    if (typeof window !== 'undefined') {
      try { JSON.parse(localStorage.getItem(DRAFT_KEY) || ''); return true; } catch { return false; }
    }
    return false;
  });

  useEffect(() => {
    if (draftRestored && !showForm) {
      setShowForm(true);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft to localStorage on every form field change
  const saveDraft = useCallback(() => {
    const draft: JournalDraft = { painLevel, nauseaLevel, fatigueLevel, mood, sleepQuality, sleepHours, appetite, energy, symptoms, notes };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full */ }
  }, [painLevel, nauseaLevel, fatigueLevel, mood, sleepQuality, sleepHours, appetite, energy, symptoms, notes]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  async function saveEntry() {
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (painLevel > 0) body.painLevel = painLevel;
    if (mood) body.mood = mood;
    if (sleepQuality) body.sleepQuality = sleepQuality;
    if (sleepHours) body.sleepHours = parseFloat(sleepHours);
    if (appetite) body.appetite = appetite;
    if (energy) body.energy = energy;
    if (symptoms.length) body.symptoms = symptoms;
    // Include nausea and fatigue in notes until DB schema is updated
    const extraNotes = [];
    if (nauseaLevel > 0) extraNotes.push(`Nausea: ${nauseaLevel}/10`);
    if (fatigueLevel > 0) extraNotes.push(`Fatigue: ${fatigueLevel}/10`);
    const fullNotes = [...extraNotes, notes.trim()].filter(Boolean).join(' | ');
    if (fullNotes) body.notes = fullNotes;

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save entry');
      const data = await res.json();
      // Update local entries
      setEntries((prev) => {
        const without = prev.filter((e) => e.date !== today);
        return [data.entry, ...without];
      });
      clearDraft();
      setMessage('Saved!');
      setShowForm(false);
      setTimeout(() => setMessage(null), 2000);
      showToast('Entry saved', 'success');
    } catch {
      showToast('Failed to save entry', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Treatment Journal</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-xs font-semibold"
        >
          {showForm ? 'Cancel' : todayEntry ? 'Update Today' : 'Log Today'}
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-5">Track {patientName}&apos;s treatment side effects and daily wellness.</p>

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

          {/* Nausea level */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Nausea Level</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--text-muted)] w-6">0</span>
              <input
                type="range" min="0" max="10" value={nauseaLevel}
                onChange={(e) => setNauseaLevel(parseInt(e.target.value))}
                className="flex-1 accent-purple-500"
              />
              <span className="text-xs text-[var(--text-muted)] w-6">10</span>
              <span className={`text-sm font-bold ml-2 ${nauseaLevel <= 3 ? 'text-emerald-400' : nauseaLevel <= 6 ? 'text-amber-400' : 'text-red-400'}`}>{nauseaLevel}</span>
            </div>
          </div>

          {/* Fatigue level */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Fatigue Level</label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--text-muted)] w-6">0</span>
              <input
                type="range" min="0" max="10" value={fatigueLevel}
                onChange={(e) => setFatigueLevel(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-xs text-[var(--text-muted)] w-6">10</span>
              <span className={`text-sm font-bold ml-2 ${fatigueLevel <= 3 ? 'text-emerald-400' : fatigueLevel <= 6 ? 'text-amber-400' : 'text-red-400'}`}>{fatigueLevel}</span>
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Mood</label>
            <div className="flex gap-2 mt-2">
              {Object.entries(MOOD_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => setMood(key)}
                  className={`flex-1 py-2 rounded-lg text-center text-xs font-medium transition-colors ${mood === key ? 'border' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-muted)]'}`}
                  style={mood === key ? { background: MOOD_COLORS[key] + '20', borderColor: MOOD_COLORS[key] + '60', color: MOOD_COLORS[key] } : {}}
                  title={key}>{label}</button>
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sleep Quality</label>
              <div className="flex gap-1 mt-2">
                {Object.entries(SLEEP_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setSleepQuality(key)}
                    className={`flex-1 py-1.5 rounded text-center text-xs transition-colors ${sleepQuality === key ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-muted)]'}`}
                    title={key}>{label}</button>
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
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Treatment Side Effects</label>
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
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Side Effects & Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g., numbness in fingers, metallic taste, couldn't keep food down..."
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recent Entries</h3>
        </div>

        {/* Search and date filters */}
        <div className="space-y-2 mb-4">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search symptoms, notes..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 px-3 text-white text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-600"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 px-2 text-white text-xs focus:outline-none focus:border-blue-600"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 px-2 text-white text-xs focus:outline-none focus:border-blue-600"
              placeholder="To"
            />
            {(searchFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearchFilter(''); setDateFrom(''); setDateTo(''); }}
                className="px-2 py-1.5 rounded-lg bg-white/[0.06] text-[var(--text-muted)] text-xs hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterSeverity(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterSeverity === null ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-secondary)]'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterSeverity(7)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterSeverity === 7 ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-secondary)]'}`}
          >
            High pain (7+)
          </button>
          <button
            onClick={() => setFilterSeverity(4)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterSeverity === 4 ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-white/[0.04] border border-white/[0.06] text-[var(--text-secondary)]'}`}
          >
            Moderate (4+)
          </button>
        </div>
        {entries.filter((e) => {
          if (filterSeverity !== null && (e.painLevel ?? 0) < filterSeverity) return false;
          if (searchFilter) {
            const q = searchFilter.toLowerCase();
            const matchSymptoms = e.symptoms?.some((s) => s.toLowerCase().includes(q));
            const matchNotes = e.notes?.toLowerCase().includes(q);
            if (!matchSymptoms && !matchNotes) return false;
          }
          if (dateFrom && e.date < dateFrom) return false;
          if (dateTo && e.date > dateTo) return false;
          return true;
        }).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-muted)] text-sm">{entries.length === 0 ? 'No entries yet. Start tracking today!' : 'No entries match this filter.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.filter((e) => {
              if (filterSeverity !== null && (e.painLevel ?? 0) < filterSeverity) return false;
              if (searchFilter) {
                const q = searchFilter.toLowerCase();
                const matchSymptoms = e.symptoms?.some((s) => s.toLowerCase().includes(q));
                const matchNotes = e.notes?.toLowerCase().includes(q);
                if (!matchSymptoms && !matchNotes) return false;
              }
              if (dateFrom && e.date < dateFrom) return false;
              if (dateTo && e.date > dateTo) return false;
              return true;
            }).map((entry) => (
              <div key={entry.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.mood && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: (MOOD_COLORS[entry.mood] || '#A78BFA') + '20', color: MOOD_COLORS[entry.mood] || '#A78BFA' }} title={`Mood: ${entry.mood}`}>{MOOD_LABELS[entry.mood] || entry.mood}</span>}
                    {entry.painLevel !== null && entry.painLevel > 0 && (
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${entry.painLevel <= 3 ? 'bg-emerald-500/20 text-emerald-400' : entry.painLevel <= 6 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {entry.painLevel}/10
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.sleepQuality && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[var(--text-secondary)]">Sleep: {entry.sleepQuality}</span>}
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
