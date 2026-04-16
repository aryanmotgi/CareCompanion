'use client'

import { cognitoSignIn } from '@/lib/actions'

export function LoginForm() {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 space-y-5">
      <form action={cognitoSignIn}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 transition-all"
        >
          Sign in with CareCompanion
        </button>
      </form>
      <p className="text-center text-xs text-[var(--text-muted)]">
        You&apos;ll be redirected to sign in securely.
      </p>
    </div>
  )
}
