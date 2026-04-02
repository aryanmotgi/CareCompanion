'use client';

import { useState } from 'react';
import { CategoryScanner, type ScanCategory } from '@/components/CategoryScanner';

const SCAN_CATEGORIES: Array<{
  id: ScanCategory;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  accentBg: string;
  borderColor: string;
}> = [
  {
    id: 'medication',
    title: 'Medication',
    description: 'Pill bottles, prescription labels, pharmacy printouts',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    borderColor: 'hover:border-blue-500/40',
  },
  {
    id: 'lab_report',
    title: 'Lab Report',
    description: 'Blood work, test results, pathology reports',
    icon: 'M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    borderColor: 'hover:border-emerald-500/40',
  },
  {
    id: 'insurance',
    title: 'Insurance Card',
    description: 'Insurance cards, coverage documents',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    borderColor: 'hover:border-violet-500/40',
  },
  {
    id: 'eob',
    title: 'EOB / Bill',
    description: 'Explanation of benefits, billing statements',
    icon: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    borderColor: 'hover:border-amber-500/40',
  },
  {
    id: 'doctor_note',
    title: 'Doctor Note',
    description: 'Visit summaries, referrals, discharge papers',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    accentColor: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    borderColor: 'hover:border-rose-500/40',
  },
];

export function ScanCenter() {
  const [activeCategory, setActiveCategory] = useState<ScanCategory | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-white">Scan Documents</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Choose a document type to scan. Our AI will extract and save the information automatically.
        </p>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCAN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] ${cat.borderColor} p-5 text-left transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 group`}
          >
            <div className={`w-12 h-12 rounded-xl ${cat.accentBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <svg className={`w-6 h-6 ${cat.accentColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
              </svg>
            </div>
            <h3 className="font-display font-semibold text-white mb-1">{cat.title}</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{cat.description}</p>
          </button>
        ))}
      </div>

      {/* Tips section */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6">
        <h3 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
          Tips for best results
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            Use good lighting — avoid shadows and glare
          </li>
          <li className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            Place documents flat on a contrasting surface
          </li>
          <li className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            Make sure all text is in focus and readable
          </li>
          <li className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            Capture the entire document — don&apos;t crop important parts
          </li>
        </ul>
      </div>

      {/* Scanner modal */}
      {activeCategory && (
        <CategoryScanner
          category={activeCategory}
          onClose={() => setActiveCategory(null)}
          onSaved={() => setActiveCategory(null)}
        />
      )}
    </div>
  );
}
