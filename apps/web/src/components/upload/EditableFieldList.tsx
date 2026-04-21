'use client';

import { FormField } from '@/components/ui/FormField';

// Field definition for each category
interface FieldDef {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
}

export const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  medications: [
    { key: 'name', label: 'Medication Name', placeholder: 'e.g. Metformin 500mg' },
    { key: 'dose', label: 'Dose', placeholder: 'e.g. 500mg' },
    { key: 'frequency', label: 'Frequency', placeholder: 'e.g. Twice daily' },
    { key: 'prescribing_doctor', label: 'Prescribing Doctor', placeholder: 'e.g. Dr. Smith' },
    { key: 'refill_date', label: 'Refill Date', type: 'date', placeholder: '' },
  ],
  conditions: [
    { key: 'name', label: 'Condition / Diagnosis', placeholder: 'e.g. Type 2 Diabetes' },
  ],
  allergies: [
    { key: 'name', label: 'Allergen', placeholder: 'e.g. Penicillin' },
    { key: 'reaction', label: 'Reaction / Severity', placeholder: 'e.g. Rash, anaphylaxis' },
  ],
  appointments: [
    { key: 'doctor_name', label: 'Doctor / Provider', placeholder: 'e.g. Dr. Jones' },
    { key: 'date_time', label: 'Date & Time', placeholder: 'e.g. May 20, 2026 2:00 PM' },
    { key: 'purpose', label: 'Purpose', placeholder: 'e.g. Follow-up oncology' },
    { key: 'location', label: 'Location', placeholder: 'e.g. UCSF Cancer Center' },
  ],
  lab_results: [
    { key: 'test_name', label: 'Test Name', placeholder: 'e.g. CBC, HbA1c' },
    { key: 'value', label: 'Value', placeholder: 'e.g. 6.2' },
    { key: 'unit', label: 'Unit', placeholder: 'e.g. %' },
    { key: 'reference_range', label: 'Reference Range', placeholder: 'e.g. 4.0–5.6%' },
    { key: 'date_taken', label: 'Date Taken', type: 'date', placeholder: '' },
  ],
  insurance: [
    { key: 'provider', label: 'Insurance Provider', placeholder: 'e.g. Aetna' },
    { key: 'member_id', label: 'Member ID', placeholder: 'e.g. W123456789' },
    { key: 'group_number', label: 'Group Number', placeholder: 'e.g. 12345' },
    { key: 'plan_type', label: 'Plan Type', placeholder: 'e.g. PPO, HMO' },
    { key: 'deductible_limit', label: 'Annual Deductible ($)', type: 'number', placeholder: 'e.g. 1500' },
    { key: 'oop_limit', label: 'Out-of-Pocket Max ($)', type: 'number', placeholder: 'e.g. 6000' },
  ],
  claims: [
    { key: 'provider_name', label: 'Provider', placeholder: 'e.g. UCSF Medical Center' },
    { key: 'service_date', label: 'Service Date', type: 'date', placeholder: '' },
    { key: 'billed_amount', label: 'Billed Amount ($)', type: 'number', placeholder: 'e.g. 350' },
    { key: 'paid_amount', label: 'Amount Paid ($)', type: 'number', placeholder: 'e.g. 280' },
    { key: 'patient_responsibility', label: 'Your Responsibility ($)', type: 'number', placeholder: 'e.g. 70' },
    { key: 'status', label: 'Status', placeholder: 'e.g. paid, pending, denied' },
  ],
};

interface EditableItemProps {
  categoryId: string;
  item: Record<string, string>;
  index: number;
  onChange: (index: number, key: string, value: string) => void;
  onRemove?: (index: number) => void;
  showRemove?: boolean;
}

export function EditableItem({ categoryId, item, index, onChange, onRemove, showRemove }: EditableItemProps) {
  const fields = CATEGORY_FIELDS[categoryId] ?? [];

  return (
    <div className="p-4 bg-[var(--bg-elevated)] rounded-2xl space-y-3 relative">
      {showRemove && onRemove && (
        <button
          onClick={() => onRemove(index)}
          className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          aria-label="Remove item"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="grid grid-cols-1 gap-3">
        {fields.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            type={field.type ?? 'text'}
            value={item[field.key] ?? ''}
            onChange={(val) => onChange(index, field.key, val)}
            placeholder={field.placeholder}
          />
        ))}
      </div>
    </div>
  );
}
