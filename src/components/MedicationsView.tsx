'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryScanner } from '@/components/CategoryScanner';
import type { Medication } from '@/lib/types';

interface MedicationsViewProps {
  medications: Medication[];
  profileId: string;
}

export function MedicationsView({ medications: initial, profileId }: MedicationsViewProps) {
  const supabase = createClient();
  const [medications, setMedications] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const addMedication = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('medications')
      .insert({
        care_profile_id: profileId,
        name: name.trim(),
        dose: dose || null,
        frequency: frequency || null,
      })
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      setMedications((prev) => [...prev, data]);
      setName('');
      setDose('');
      setFrequency('');
      setShowAdd(false);
    }
  };

  const removeMedication = async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    const { error } = await supabase.from('medications').delete().eq('id', confirmRemove.id);
    if (!error) {
      setMedications((prev) => prev.filter((m) => m.id !== confirmRemove.id));
    }
    setRemoving(false);
    setConfirmRemove(null);
  };

  const handleScanSaved = async () => {
    // Refetch medications instead of reloading the whole page
    const { data } = await supabase
      .from('medications')
      .select('*')
      .eq('care_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (data) setMedications(data);
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
          <Button onClick={() => setShowAdd(!showAdd)} className="!py-2 !px-4 !min-h-0 text-sm">
            + Add
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
          <div className="flex gap-2">
            <Button onClick={addMedication} loading={saving} disabled={!name.trim()}>Save</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      {medications.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-3">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
          </div>
          <p className="text-sm text-[#94a3b8]">No medications yet</p>
          <p className="text-xs text-[#64748b] mt-1">Tap &ldquo;+ Add&rdquo; above or scan a pill bottle to get started</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {medications.map((med) => (
            <div key={med.id} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-white">{med.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                </p>
                {med.refill_date && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Refill: {new Date(med.refill_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
                {med.notes && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 italic">{med.notes}</p>
                )}
              </div>
              <button
                onClick={() => setConfirmRemove({ id: med.id, name: med.name })}
                className="text-sm text-red-400 hover:text-red-300 flex-shrink-0 ml-4 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showScanner && (
        <CategoryScanner
          category="medication"
          onClose={() => setShowScanner(false)}
          onSaved={handleScanSaved}
        />
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove Medication"
        description={`Are you sure you want to remove "${confirmRemove?.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={removing}
        onConfirm={removeMedication}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
