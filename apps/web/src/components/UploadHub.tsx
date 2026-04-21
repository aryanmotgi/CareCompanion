'use client';

import { useState } from 'react';
import { UploadProgressBar } from './UploadProgressBar';
import { CategoryUploadCard, type UploadCategoryId } from './upload/CategoryUploadCard';

interface UploadHubProps {
  initialCounts: Record<UploadCategoryId, number>;
}

const CATEGORIES: {
  id: UploadCategoryId;
  label: string;
  description: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'medications',
    label: 'Medications',
    description: 'Prescription labels, pharmacy printouts, medication lists',
    accentColor: 'text-[#A78BFA]',
    accentBg: 'bg-violet-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    id: 'conditions',
    label: 'Conditions',
    description: 'Diagnoses, doctor notes, discharge summaries',
    accentColor: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    id: 'allergies',
    label: 'Allergies',
    description: 'Allergy lists, reactions, medication allergies',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  {
    id: 'appointments',
    label: 'Appointments',
    description: 'Referral letters, scheduling confirmations, visit notes',
    accentColor: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    id: 'lab_results',
    label: 'Lab Results',
    description: 'Blood work, pathology, test results printouts',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
      </svg>
    ),
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description: 'Insurance cards, coverage documents, plan details',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    id: 'claims',
    label: 'Claims / EOBs',
    description: 'Explanation of benefits, billing statements',
    accentColor: 'text-orange-400',
    accentBg: 'bg-orange-500/15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
];

const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<UploadCategoryId, string>;

export function UploadHub({ initialCounts }: UploadHubProps) {
  const [completionState, setCompletionState] = useState<Record<UploadCategoryId, boolean>>(
    Object.fromEntries(
      Object.entries(initialCounts).map(([id, count]) => [id, count > 0])
    ) as Record<UploadCategoryId, boolean>
  );

  const handleSaved = (categoryId: UploadCategoryId) => {
    setCompletionState((prev) => ({ ...prev, [categoryId]: true }));
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-sm text-blue-300 leading-relaxed">
          Upload photos or PDFs of your health documents — AI extracts the information for you to review and confirm before saving.
        </p>
      </div>

      {/* Progress */}
      <UploadProgressBar completionState={completionState} labels={LABELS} />

      {/* Category cards */}
      <div className="space-y-4">
        {CATEGORIES.map((cat) => (
          <CategoryUploadCard
            key={cat.id}
            categoryId={cat.id}
            label={cat.label}
            description={cat.description}
            accentColor={cat.accentColor}
            accentBg={cat.accentBg}
            icon={cat.icon}
            existingCount={initialCounts[cat.id]}
            onSaved={handleSaved}
          />
        ))}
      </div>
    </div>
  );
}
