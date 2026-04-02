'use client'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl p-8 max-w-sm w-full">
        <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="text-[#f1f5f9] text-base font-semibold mb-1">{message}</div>
        <div className="text-[#64748b] text-sm mb-4">
          Please try again. If the problem persists, contact support.
        </div>
        <button
          onClick={handleRetry}
          className="w-full py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[#e2e8f0] text-sm font-semibold hover:bg-white/[0.08] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
