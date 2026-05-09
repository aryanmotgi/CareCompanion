'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ToastProvider';
import type { MedicationReminder, Medication } from '@/lib/types';

interface ReminderManagerProps {
  reminders: MedicationReminder[];
  medications: Medication[];
}

const ALL_DAYS = [
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Tu' },
  { key: 'wed', label: 'We' },
  { key: 'thu', label: 'Th' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'Su' },
];

export function ReminderManager({ reminders: initial, medications }: ReminderManagerProps) {
  const { showToast } = useToast();
  const [reminders, setReminders] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [selectedMedId, setSelectedMedId] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

  const selectedMed = medications.find((m) => m.id === selectedMedId);

  const resetForm = useCallback(() => {
    setSelectedMedId('');
    setTimes(['08:00']);
    setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  const startEdit = useCallback((r: MedicationReminder) => {
    setSelectedMedId(r.medicationId);
    setTimes(r.reminderTimes.length > 0 ? r.reminderTimes : ['08:00']);
    setSelectedDays(r.daysOfWeek.length > 0 ? r.daysOfWeek : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setEditingId(r.id);
    setShowForm(true);
  }, []);

  const toggleDay = useCallback((day: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev; // must have at least one day
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  }, []);

  const addTimeSlot = useCallback(() => {
    setTimes((prev) => [...prev, '12:00']);
  }, []);

  const removeTimeSlot = useCallback((index: number) => {
    setTimes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateTime = useCallback((index: number, value: string) => {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }, []);

  const saveReminder = async () => {
    if (!selectedMedId) return;
    const med = medications.find((m) => m.id === selectedMedId);
    if (!med) return;

    setSaving(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { reminder_id: editingId } : {}),
          medicationId: med.id,
          medicationName: med.name,
          dose: med.dose,
          reminderTimes: times,
          daysOfWeek: selectedDays,
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      // Refresh the list
      const listRes = await fetch('/api/reminders');
      if (listRes.ok) {
        const data = await listRes.json();
        setReminders(data.reminders || []);
      }
      showMessage(editingId ? 'Reminder updated!' : 'Reminder created!');
      showToast('Reminder saved', 'success');
      resetForm();
    } catch {
      showMessage('Failed to save reminder');
      showToast('Failed to save reminder', 'error');
    }
    setSaving(false);
  };

  const toggleActive = async (reminder: MedicationReminder) => {
    const newActive = !reminder.isActive;
    setTogglingId(reminder.id);
    // Optimistic update
    setReminders((prev) =>
      prev.map((r) =>
        r.id === reminder.id ? { ...r, isActive: newActive } : r
      )
    );
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_id: reminder.id,
          medicationId: reminder.medicationId,
          medicationName: reminder.medicationName,
          dose: reminder.dose,
          reminderTimes: reminder.reminderTimes,
          daysOfWeek: reminder.daysOfWeek,
          isActive: newActive,
        }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      showToast('Reminder toggled', 'success');
    } catch {
      // Revert on failure
      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, isActive: !newActive } : r
        )
      );
      showMessage('Failed to update reminder');
      showToast('Failed to toggle reminder', 'error');
    }
    setTogglingId(null);
  };

  const deleteReminder = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/reminders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setReminders((prev) => prev.filter((r) => r.id !== id));
      showMessage('Reminder removed');
      showToast('Reminder deleted', 'success');
    } catch {
      showMessage('Failed to remove reminder');
      showToast('Failed to delete reminder', 'error');
    }
    setDeletingId(null);
  };

  const formatTimeDisplay = (time: string) => {
    try {
      const [h, m] = time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
    } catch {
      return time;
    }
  };

  // Medications that don't have a reminder yet
  const availableMeds = medications.filter(
    (m) => editingId || !reminders.some((r) => r.medicationId === m.id)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M5 3L2 6" />
            <path d="M22 6l-3-3" />
          </svg>
          <h2 className="text-base font-semibold text-[var(--text)]">Medication Reminders</h2>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="text-xs font-medium bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white px-3.5 py-2 rounded-xl hover:opacity-90 transition-opacity min-h-[36px]"
          >
            + Add Reminder
          </button>
        )}
      </div>

      {/* Success message */}
      {message && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400 transition-all duration-300">
          {message}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 space-y-5">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {editingId ? 'Edit Reminder' : 'New Reminder'}
          </h3>

          {/* Medication selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Medication <span className="text-red-400 ml-0.5">*</span>
            </label>
            {availableMeds.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] opacity-60">
                All medications already have reminders set
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableMeds.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => setSelectedMedId(med.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedMedId === med.id
                        ? 'bg-[#6366F1] text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-white/[0.04] border border-white/[0.08] text-[var(--text)] hover:bg-white/[0.08]'
                    }`}
                  >
                    {med.name}
                    {med.dose && (
                      <span className={`ml-1.5 text-xs ${selectedMedId === med.id ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                        {med.dose}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time picker */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Reminder Times
            </label>
            <div className="space-y-2">
              {times.map((time, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[var(--text)] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 transition-colors [color-scheme:dark]"
                  />
                  {times.length > 1 && (
                    <button
                      onClick={() => removeTimeSlot(idx)}
                      className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center shrink-0"
                      aria-label="Remove time"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTimeSlot}
                className="text-xs text-[#A78BFA] hover:text-[#6366F1] font-medium transition-colors py-1"
              >
                + Add another time
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Days
            </label>
            <div className="flex gap-1.5">
              {ALL_DAYS.map((day) => (
                <button
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                    selectedDays.includes(day.key)
                      ? 'bg-[#6366F1] text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-white/[0.04] border border-white/[0.08] text-[var(--text-muted)] hover:bg-white/[0.08]'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])}
                className="text-[10px] text-[var(--text-muted)] hover:text-[#A78BFA] transition-colors uppercase tracking-wider"
              >
                Every day
              </button>
              <button
                onClick={() => setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                className="text-[10px] text-[var(--text-muted)] hover:text-[#A78BFA] transition-colors uppercase tracking-wider"
              >
                Weekdays
              </button>
            </div>
          </div>

          {/* Summary */}
          {selectedMed && (
            <div className="rounded-xl bg-[#6366F1]/[0.08] border border-[#6366F1]/20 p-3">
              <p className="text-xs text-[#A78BFA]">
                Remind for <span className="font-semibold text-[var(--text)]">{selectedMed.name}</span>
                {selectedMed.dose && <span className="text-[var(--text-muted)]"> ({selectedMed.dose})</span>}
                {' '}at{' '}
                <span className="font-semibold text-[var(--text)]">
                  {times.map(formatTimeDisplay).join(', ')}
                </span>
                {' '}on{' '}
                <span className="font-semibold text-[var(--text)]">
                  {selectedDays.length === 7
                    ? 'every day'
                    : selectedDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                </span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={resetForm}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.08] text-[var(--text-muted)] hover:bg-white/[0.08] transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <Button
              onClick={saveReminder}
              disabled={!selectedMedId || times.length === 0}
              loading={saving}
              className="flex-1 bg-gradient-to-r from-[#6366F1] to-[#A78BFA]"
            >
              {editingId ? 'Update' : 'Save Reminder'}
            </Button>
          </div>
        </div>
      )}

      {/* Existing reminders list */}
      {reminders.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2" />
              <path d="M5 3L2 6" />
              <path d="M22 6l-3-3" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-muted)]">No reminders set</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">
            Add a reminder to stay on top of your medications
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 transition-all duration-200 hover:bg-white/[0.03]"
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(r)}
                  disabled={togglingId === r.id}
                  className="mt-0.5 shrink-0"
                  aria-label={r.isActive ? 'Disable reminder' : 'Enable reminder'}
                >
                  <div
                    className={`w-10 h-[22px] rounded-full transition-colors duration-200 relative ${
                      r.isActive ? 'bg-[#6366F1]' : 'bg-white/[0.12]'
                    }`}
                  >
                    <div
                      className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        r.isActive ? 'translate-x-[22px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </div>
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${r.isActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                    {r.medicationName}
                    {r.dose && (
                      <span className="text-[var(--text-muted)] font-normal ml-1.5 text-xs">
                        {r.dose}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {r.reminderTimes.map(formatTimeDisplay).join(', ')}
                    </div>
                    <div className="flex gap-0.5">
                      {ALL_DAYS.map((day) => (
                        <span
                          key={day.key}
                          className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center ${
                            r.daysOfWeek.includes(day.key)
                              ? 'bg-[#6366F1]/20 text-[#A78BFA]'
                              : 'bg-white/[0.04] text-[var(--text-muted)] opacity-40'
                          }`}
                        >
                          {day.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(r)}
                    className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    aria-label="Edit reminder"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    disabled={deletingId === r.id}
                    className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label="Delete reminder"
                  >
                    {deletingId === r.id ? (
                      <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
