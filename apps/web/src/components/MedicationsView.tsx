'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryScanner } from '@/components/CategoryScanner';
import { InteractionWarning } from '@/components/InteractionWarning';
import { SectionEmptyState } from '@/components/SectionEmptyState';
import type { Medication } from '@/lib/types';

interface MedicationsViewProps {
  medications: Medication[];
  profileId: string;
  patientName?: string;
}

export function MedicationsView({ medications: initial, profileId, patientName = 'your loved one' }: MedicationsViewProps) {
  const [medications, setMedications] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [refillError, setRefillError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState<{ interactions: { drug1: string; drug2: string; severity: 'critical' | 'major' | 'moderate' | 'minor'; description: string }[]; medName: string } | null>(null);
  const [editingRefill, setEditingRefill] = useState<string | null>(null); // medication id
  const [refillDate, setRefillDate] = useState('');
  const [savingRefillId, setSavingRefillId] = useState<string | null>(null);

  const addMedication = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch('/api/records/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          care_profile_id: profileId,
          name: name.trim(),
          dose: dose || null,
          frequency: frequency || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setMedications((prev) => [...prev, json.data]);
        setName('');
        setDose('');
        setFrequency('');
        setShowAdd(false);

        // Automatically check for drug interactions with existing medications
        try {
          const checkRes = await fetch('/api/interactions/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ medication: json.data.name }),
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.data?.interactions?.length > 0) {
              setInteractionWarning({ interactions: checkData.data.interactions, medName: json.data.name });
            }
          }
        } catch {
          // Interaction check is non-blocking; silently ignore failures
        }
      } else {
        setAddError(json.error || 'Failed to add medication. Please try again.');
      }
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeMedication = async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch('/api/records/medications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmRemove.id }),
      });
      if (res.ok) {
        setMedications((prev) => prev.filter((m) => m.id !== confirmRemove.id));
        setConfirmRemove(null);
      } else {
        const json = await res.json().catch(() => ({}));
        setRemoveError(json.error || 'Failed to remove. Please try again.');
      }
    } catch {
      setRemoveError('Network error. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const updateRefillDate = async (id: string, date: string) => {
    setSavingRefillId(id);
    setRefillError(null);
    try {
      const res = await fetch('/api/records/medications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, refill_date: date || null }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setMedications((prev) => prev.map((m) => m.id === id ? { ...m, refillDate: json.data.refillDate } : m));
        setEditingRefill(null);
        setRefillDate('');
      } else {
        setRefillError(json.error || 'Failed to save refill date. Please try again.');
      }
    } catch {
      setRefillError('Network error. Please try again.');
    } finally {
      setSavingRefillId(null);
    }
  };

  const markRefilled = async (id: string) => {
    // Set refill date 30 days from today
    const next = new Date();
    next.setDate(next.getDate() + 30);
    const dateStr = next.toISOString().slice(0, 10);
    await updateRefillDate(id, dateStr);
  };

  const handleScanSaved = async () => {
    // Refetch medications instead of reloading the whole page
    const res = await fetch(`/api/records/medications?care_profile_id=${profileId}`);
    const json = await res.json();
    if (res.ok && json.data) setMedications(json.data);
    setShowScanner(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Medications</h2>
          <p className="text-sm text-[var(--text-secondary)]">{medications.length} medication{medications.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => setShowScanner(true)} className="!py-2 !px-4 !min-h-0 text-sm">
            Scan Medication
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)} className="!py-2.5 !px-5 !min-h-0 text-sm !bg-gradient-to-r !from-[#6366F1] !to-[#A78BFA] !shadow-lg !shadow-[#6366F1]/25">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Medication
            </span>
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 space-y-3">
          <FormField label="Medication name" value={name} onChange={setName} placeholder="e.g., Metformin" required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dose" value={dose} onChange={setDose} placeholder="e.g., 500mg" />
            <FormField label="Frequency" value={frequency} onChange={setFrequency} placeholder="e.g., Twice daily" />
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <Button onClick={addMedication} loading={saving} disabled={!name.trim()}>Save</Button>
            <Button variant="secondary" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Interaction warning */}
      {interactionWarning && (
        <InteractionWarning
          interactions={interactionWarning.interactions}
          newMedication={interactionWarning.medName}
          onDismiss={() => setInteractionWarning(null)}
        />
      )}

      {/* List */}
      {medications.length === 0 ? (
        <div>
          <SectionEmptyState
            patientName={patientName}
            icon={
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
              </svg>
            }
            heading="Track [patient name]'s medications"
            body="Add them here or just tell me in Chat — I'll add them automatically."
            actionLabel="Add Medication"
            onAction={() => setShowAdd(true)}
          />
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {medications.map((med) => {
            const refillDaysLeft = med.refillDate
              ? Math.ceil((new Date(med.refillDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const refillUrgent = refillDaysLeft !== null && refillDaysLeft <= 7;
            const refillOverdue = refillDaysLeft !== null && refillDaysLeft < 0;
            const isEditingThisRefill = editingRefill === med.id;

            return (
              <div key={med.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{med.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                    </p>
                    {med.refillDate && !isEditingThisRefill && (
                      <p className={`text-xs mt-0.5 ${refillOverdue ? 'text-red-400' : refillUrgent ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                        {refillOverdue
                          ? `Refill overdue by ${Math.abs(refillDaysLeft!)} day${Math.abs(refillDaysLeft!) !== 1 ? 's' : ''}`
                          : refillDaysLeft === 0
                            ? 'Refill due today'
                            : `Refill in ${refillDaysLeft} day${refillDaysLeft !== 1 ? 's' : ''} · ${new Date(med.refillDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        }
                      </p>
                    )}
                    {med.notes && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 italic">{med.notes}</p>
                    )}

                    {/* Refill date editor */}
                    {isEditingThisRefill && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={refillDate}
                            onChange={(e) => setRefillDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="text-xs bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-[var(--text)] outline-none focus:border-[#6366F1]/50"
                          />
                          <button
                            onClick={() => updateRefillDate(med.id, refillDate)}
                            disabled={savingRefillId === med.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[#6366F1]/20 text-[#A78BFA] hover:bg-[#6366F1]/30 transition-colors disabled:opacity-50"
                          >
                            {savingRefillId === med.id ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingRefill(null); setRefillDate(''); setRefillError(null); }}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        {refillError && <p className="text-xs text-red-400">{refillError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Mark as refilled */}
                    {(refillUrgent || refillOverdue) && !isEditingThisRefill && (
                      <button
                        onClick={() => markRefilled(med.id)}
                        disabled={savingRefillId === med.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                      >
                        Refilled
                      </button>
                    )}
                    {/* Set/edit refill date */}
                    {!isEditingThisRefill && (
                      <button
                        onClick={() => {
                          setEditingRefill(med.id);
                          setRefillDate(med.refillDate ? med.refillDate.slice(0, 10) : '');
                        }}
                        className="text-xs px-2 py-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.06] transition-colors"
                        title={med.refillDate ? 'Edit refill date' : 'Set refill date'}
                      >
                        {med.refillDate ? '✎' : '+ Refill'}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmRemove({ id: med.id, name: med.name })}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showScanner && (
        <CategoryScanner
          category="medication"
          onClose={() => setShowScanner(false)}
          onSaved={handleScanSaved}
        />
      )}

      {removeError && (
        <p className="text-xs text-red-400 text-center">{removeError}</p>
      )}
      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove Medication"
        description={`Are you sure you want to remove "${confirmRemove?.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={removing}
        onConfirm={removeMedication}
        onCancel={() => { setConfirmRemove(null); setRemoveError(null); }}
      />
    </div>
  );
}
