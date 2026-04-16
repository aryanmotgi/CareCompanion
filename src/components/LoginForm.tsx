'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export function LoginForm({ initialError }: { initialError?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError ?? '')

  async function handleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signIn('cognito', { callbackUrl: '/dashboard' })
    } catch {
      setLoading(false)
      setError('Connection error. Please try again.')
    }
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-8 space-y-5">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Connecting...
          </>
        ) : (
          'Sign in with CareCompanion'
        )}
      </button>
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
      <p className="text-center text-xs text-[var(--text-muted)]">
        You&apos;ll be redirected to sign in securely.
      </p>
    </div>
  )
}
