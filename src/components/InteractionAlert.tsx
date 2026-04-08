'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface InteractionAlertProps {
  /** Number of medications to decide whether to auto-check */
  medicationCount: number;
}

export function InteractionAlert({ medicationCount }: InteractionAlertProps) {
  const [majorCount, setMajorCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (medicationCount < 2) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/interactions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ check_all: true }),
        });

        if (cancelled) return;

        const json = await res.json();
        if (!res.ok || !json.ok) return;

        const data = json.data as {
          interactions: Array<{ severity: string }>;
          allergy_warnings: unknown[];
        };

        const majors = data.interactions.filter((i) => i.severity === 'major').length;
        const total = data.interactions.length + data.allergy_warnings.length;

        setMajorCount(majors);
        setTotalCount(total);
        setChecked(true);
      } catch {
        // Silently fail — this is a passive alert
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [medicationCount]);

  // Don't render if not checked yet, no issues, or dismissed
  if (!checked || totalCount === 0 || dismissed) return null;

  const isCritical = majorCount > 0;

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        background: isCritical ? 'rgba(239, 68, 68, 0.10)' : 'rgba(234, 179, 8, 0.10)',
        border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isCritical ? 'rgba(239, 68, 68, 0.20)' : 'rgba(234, 179, 8, 0.20)',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isCritical ? '#ef4444' : '#eab308'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: isCritical ? '#ef4444' : '#eab308' }}>
          {majorCount > 0
            ? `${majorCount} major interaction${majorCount !== 1 ? 's' : ''} detected`
            : `${totalCount} interaction${totalCount !== 1 ? 's' : ''} found`}
        </p>
        <p className="text-xs text-[#94a3b8] mt-0.5">
          {isCritical ? 'Review with your care team' : 'Worth reviewing with your pharmacist'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/medications"
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: isCritical ? 'rgba(239, 68, 68, 0.20)' : 'rgba(234, 179, 8, 0.20)',
            color: isCritical ? '#ef4444' : '#eab308',
          }}
        >
          View Details
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-white/[0.06] transition-colors"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
