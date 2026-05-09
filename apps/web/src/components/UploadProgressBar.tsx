'use client';

import type { UploadCategoryId } from './upload/CategoryUploadCard';

interface UploadProgressBarProps {
  completionState: Record<UploadCategoryId, boolean>;
  labels: Record<UploadCategoryId, string>;
}

export function UploadProgressBar({ completionState, labels }: UploadProgressBarProps) {
  const total = Object.keys(completionState).length;
  const filled = Object.values(completionState).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {filled === total ? 'All categories added' : `${filled} of ${total} categories added`}
        </p>
        {filled === total && (
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Complete
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {(Object.keys(completionState) as UploadCategoryId[]).map((id) => (
          <div
            key={id}
            title={labels[id]}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              completionState[id]
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500'
                : 'bg-[var(--border)]'
            }`}
          />
        ))}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(completionState) as UploadCategoryId[]).map((id) => (
          <span
            key={id}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              completionState[id]
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
            }`}
          >
            {labels[id]}
          </span>
        ))}
      </div>
    </div>
  );
}
