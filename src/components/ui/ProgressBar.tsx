'use client';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function ProgressBar({ currentStep, totalSteps, labels }: ProgressBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`text-xs mt-1.5 font-medium ${
                    isCurrent ? 'text-[#A78BFA]' : isCompleted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
              {step < totalSteps && (
                <div
                  className={`flex-1 h-0.5 mx-3 mt-[-20px] ${
                    isCompleted ? 'bg-blue-600' : 'bg-[var(--border)]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
