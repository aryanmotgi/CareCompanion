'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
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

  const removeMedication = async (id: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (!error) {
      setMedications((prev) => prev.filter((m) => m.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Medications</h2>
          <p className="text-sm text-[var(--text-secondary)]">{medications.length} medication{medications.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-2">
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
            <Button onClick={addMedication} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      {medications.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] px-5 py-12 text-center">
          <svg className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
          </svg>
          <p className="text-sm text-[var(--text-secondary)] mb-1">No medications yet</p>
          <p className="text-xs text-[var(--text-muted)]">Add one manually or scan a pill bottle</p>
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
                onClick={() => removeMedication(med.id)}
                className="text-sm text-red-400 hover:text-red-400 flex-shrink-0 ml-4"
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
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
