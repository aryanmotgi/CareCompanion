'use client'

export function LoginForm({ initialError }: { initialError?: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 space-y-5">
        <form method="GET" action="/api/auth/start">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 transition-all"
          >
            Sign in with CareCompanion
          </button>
        </form>

        {initialError && (
          <p role="alert" className="text-center text-sm text-red-400">{initialError}</p>
        )}

        <p className="text-center text-xs text-[var(--text-muted)]">
          Sign in with email or Google — secured by AWS Cognito.
        </p>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 pt-1">
          {[
            { icon: '🔒', label: 'HIPAA-compliant' },
            { icon: '🚫', label: 'No ads, ever' },
            { icon: '🗑️', label: 'Delete anytime' },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1">
              <span className="text-sm" aria-hidden="true">{badge.icon}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Demo shortcut */}
      <p className="text-center text-xs text-[var(--text-muted)]">
        Just exploring?{' '}
        <a href="/onboarding" className="text-[#A78BFA] hover:text-[#C4B5FD] underline underline-offset-2 transition-colors">
          Try with demo data
        </a>{' '}
        — no account needed.
      </p>
    </div>
  )
}
