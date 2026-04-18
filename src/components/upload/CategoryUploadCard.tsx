'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { EditableItem, CATEGORY_FIELDS } from './EditableFieldList';
import { ManualEntryForm } from './ManualEntryForms';
import { useToast } from '@/components/ToastProvider';

export type UploadCategoryId =
  | 'medications'
  | 'conditions'
  | 'allergies'
  | 'appointments'
  | 'lab_results'
  | 'insurance'
  | 'claims';

type CardState = 'idle' | 'scanning' | 'reviewing' | 'editing' | 'saving' | 'done';

interface CategoryUploadCardProps {
  categoryId: UploadCategoryId;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  existingCount: number;
  onSaved: (categoryId: UploadCategoryId) => void;
}

// Convert raw ScanResult fields into an array of editable items for a given category
function extractItems(categoryId: UploadCategoryId, scanResult: Record<string, unknown>): Record<string, string>[] {
  if (categoryId === 'medications') {
    const meds = (scanResult.medications as Record<string, unknown>[] | undefined) ?? [];
    return meds.map((m) => ({
      name: String(m.name ?? ''),
      dose: String(m.dose ?? ''),
      frequency: String(m.frequency ?? ''),
      prescribing_doctor: String(m.prescribing_doctor ?? ''),
      refill_date: String(m.refill_date ?? ''),
    }));
  }
  if (categoryId === 'conditions') {
    const conds = (scanResult.conditions as string[] | undefined) ?? [];
    return conds.map((c) => ({ name: c }));
  }
  if (categoryId === 'allergies') {
    const allergies = (scanResult.allergies as Record<string, unknown>[] | undefined) ?? [];
    return allergies.map((a) => ({
      name: String(a.name ?? ''),
      reaction: String(a.reaction ?? ''),
    }));
  }
  if (categoryId === 'appointments') {
    const appts = (scanResult.appointments as Record<string, unknown>[] | undefined) ?? [];
    return appts.map((a) => ({
      doctor_name: String(a.doctor_name ?? ''),
      date_time: String(a.date_time ?? ''),
      purpose: String(a.purpose ?? ''),
      location: String(a.location ?? ''),
    }));
  }
  if (categoryId === 'lab_results') {
    const labs = (scanResult.lab_results as Record<string, unknown>[] | undefined) ?? [];
    return labs.map((l) => ({
      test_name: String(l.test_name ?? ''),
      value: String(l.value ?? ''),
      unit: String(l.unit ?? ''),
      reference_range: String(l.reference_range ?? ''),
      date_taken: String(l.date_taken ?? (scanResult.date_taken ?? '')),
    }));
  }
  if (categoryId === 'insurance') {
    const ins = (scanResult.insurance as Record<string, unknown> | undefined);
    if (!ins) return [];
    return [{
      provider: String(ins.provider ?? ''),
      member_id: String(ins.member_id ?? ''),
      group_number: String(ins.group_number ?? ''),
      plan_type: String(ins.plan_type ?? ''),
      deductible_limit: '',
      oop_limit: '',
    }];
  }
  if (categoryId === 'claims') {
    const claims = (scanResult.claims as Record<string, unknown>[] | undefined) ?? [];
    return claims.map((c) => ({
      provider_name: String(c.provider_name ?? ''),
      service_date: String(c.service_date ?? ''),
      billed_amount: String(c.billed_amount ?? ''),
      paid_amount: String(c.paid_amount ?? ''),
      patient_responsibility: String(c.patient_responsibility ?? ''),
      status: String(c.status ?? ''),
    }));
  }
  return [];
}

// Build POST body from editable items for a given category
function buildSaveBody(categoryId: UploadCategoryId, items: Record<string, string>[]) {
  if (categoryId === 'medications') {
    return { medications: items.filter((m) => m.name?.trim()) };
  }
  if (categoryId === 'conditions') {
    return { conditions: items.map((c) => c.name).filter(Boolean) };
  }
  if (categoryId === 'allergies') {
    return { allergies: items.filter((a) => a.name?.trim()).map((a) => ({ name: a.name, reaction: a.reaction || undefined })) };
  }
  if (categoryId === 'appointments') {
    return { appointments: items.filter((a) => a.doctor_name || a.purpose) };
  }
  if (categoryId === 'lab_results') {
    return {
      lab_results: items.filter((l) => l.test_name?.trim()).map((l) => ({
        ...l,
        is_abnormal: false,
      })),
    };
  }
  if (categoryId === 'insurance') {
    const i = items[0] ?? {};
    return {
      provider: i.provider || 'Unknown',
      member_id: i.member_id || undefined,
      group_number: i.group_number || undefined,
      plan_type: i.plan_type || undefined,
      deductible_limit: i.deductible_limit ? Number(i.deductible_limit) : undefined,
      oop_limit: i.oop_limit ? Number(i.oop_limit) : undefined,
    };
  }
  if (categoryId === 'claims') {
    return {
      claims: items.filter((c) => c.provider_name || c.service_date).map((c) => ({
        ...c,
        billed_amount: c.billed_amount ? Number(c.billed_amount) : undefined,
        paid_amount: c.paid_amount ? Number(c.paid_amount) : undefined,
        patient_responsibility: c.patient_responsibility ? Number(c.patient_responsibility) : undefined,
      })),
    };
  }
  return {};
}

function getSaveEndpoint(categoryId: UploadCategoryId): string {
  if (categoryId === 'allergies') return '/api/upload/allergies';
  if (categoryId === 'insurance') return '/api/upload/insurance';
  return '/api/save-scan-results';
}

function emptyItem(categoryId: UploadCategoryId): Record<string, string> {
  const fields = CATEGORY_FIELDS[categoryId] ?? [];
  return Object.fromEntries(fields.map((f) => [f.key, '']));
}

export function CategoryUploadCard({
  categoryId,
  label,
  description,
  icon,
  accentColor,
  accentBg,
  existingCount,
  onSaved,
}: CategoryUploadCardProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<CardState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, string>[]>([]);
  const [_editing, setEditing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isComplete = existingCount > 0 || state === 'done';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setScanError(null);
    setEditing(false);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setState('scanning');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', categoryId);

    try {
      const res = await fetch('/api/scan-document', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('scan failed');
      const data = await res.json();
      const extracted = extractItems(categoryId, data);
      setItems(extracted.length > 0 ? extracted : [emptyItem(categoryId)]);
      setState('reviewing');
    } catch {
      setScanError('Could not read the document. Check the image quality or enter info manually.');
      setState('idle');
      setPreview(null);
    }
  };

  const handleItemChange = (index: number, key: string, value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setState('saving');
    const body = buildSaveBody(categoryId, items);
    try {
      const res = await fetch(getSaveEndpoint(categoryId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      setState('done');
      onSaved(categoryId);
      showToast(`${label} saved`, 'success');
    } catch {
      showToast('Failed to save. Please try again.', 'error');
      setState('reviewing');
    }
  };

  const handleReset = () => {
    setState('idle');
    setPreview(null);
    setItems([]);
    setEditing(false);
    setScanError(null);
    setShowManual(false);
  };

  return (
    <div className={`glass-card rounded-2xl p-5 transition-all ${isComplete ? 'border-emerald-500/30' : 'border-[var(--border)]'}`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center flex-shrink-0`}>
          <span className={accentColor}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-white text-sm">{label}</h3>
            {isComplete && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Added
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
        {isComplete && state !== 'reviewing' && state !== 'editing' && (
          <button
            onClick={handleReset}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {/* Idle state: upload zone */}
      {(state === 'idle' || state === 'done') && !showManual && (
        <div className="space-y-3">
          {/* Only show upload button if not done, or if done show add more option */}
          {state !== 'done' && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-[var(--text-muted)]/20 rounded-xl p-6 text-center hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group"
            >
              <svg className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 group-hover:text-[var(--text-secondary)] transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Upload photo or PDF</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">AI will extract the information</p>
            </button>
          )}

          {scanError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-400">{scanError}</p>
            </div>
          )}

          <button
            onClick={() => { setShowManual(true); setItems([emptyItem(categoryId)]); }}
            className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1"
          >
            {state === 'done' ? '+ Add more manually' : 'Enter manually instead'}
          </button>
        </div>
      )}

      {/* Scanning state */}
      {state === 'scanning' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-elevated)]">
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Reading your document...</p>
            <p className="text-xs text-[var(--text-muted)]">AI is extracting information</p>
          </div>
        </div>
      )}

      {/* Review / Edit state */}
      {(state === 'reviewing' || state === 'saving') && (
        <div className="space-y-4">
          {/* Image preview thumbnail */}
          {preview && (
            <div className="flex items-center gap-3 p-3 bg-[var(--bg-elevated)] rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Uploaded document" className="w-12 h-12 object-cover rounded-lg border border-[var(--border)]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Document uploaded</p>
                <p className="text-xs text-[var(--text-muted)]">Review the extracted information below</p>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-2">
              No data could be extracted. Try a clearer image or enter manually.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <EditableItem
                  key={i}
                  categoryId={categoryId}
                  item={item}
                  index={i}
                  onChange={handleItemChange}
                  onRemove={handleRemoveItem}
                  showRemove={items.length > 1}
                />
              ))}
            </div>
          )}

          {/* Add another item */}
          {categoryId !== 'insurance' && (
            <button
              onClick={() => setItems((prev) => [...prev, emptyItem(categoryId)])}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1 flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add another {label.toLowerCase().replace(/s$/, '')}
            </button>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              loading={state === 'saving'}
              className="flex-1"
              disabled={items.length === 0}
            >
              Confirm & Save
            </Button>
            <Button variant="secondary" onClick={handleReset} className="!px-4">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Manual entry */}
      {showManual && (
        <ManualEntryForm
          categoryId={categoryId}
          items={items}
          onItemChange={handleItemChange}
          onAddItem={() => setItems((prev) => [...prev, emptyItem(categoryId)])}
          onRemoveItem={handleRemoveItem}
          onSave={handleSave}
          onCancel={() => { setShowManual(false); setItems([]); }}
          saving={state === 'saving'}
          categoryLabel={label}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
