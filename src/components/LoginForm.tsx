'use client'

import { useState } from 'react'
import Link from 'next/link'

export function LoginForm({ initialError, mode }: { initialError?: string; mode?: string }) {
  const [consentChecked, setConsentChecked] = useState(false)
  const [showConsentError, setShowConsentError] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!consentChecked) {
      e.preventDefault()
      setShowConsentError(true)
      return
    }
    setLoading(true)
    // Form POSTs and redirects to Cognito — loading state persists until navigation (intentional)
  }

  const isSignIn = mode === 'signin'

  return (
    <div className="space-y-4" style={{ animation: 'loginFadeUp 0.6s ease 0.15s both' }}>

      {/* Glass card */}
      <div className="relative rounded-2xl p-6 overflow-hidden" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>

        {/* Inner top glow line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)' }} />

        {isSignIn && (
          <p className="text-center text-xs text-white/30 mb-5 uppercase tracking-widest">Welcome back</p>
        )}

        <form method="POST" action="/api/auth/start" onSubmit={handleSubmit} className="space-y-5">

          {/* Hidden consent field — server validates this before initiating OAuth */}
          <input type="hidden" name="consent" value={consentChecked ? 'true' : ''} />

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => {
                  setConsentChecked(e.target.checked)
                  if (e.target.checked) setShowConsentError(false)
                }}
                className="sr-only"
                aria-describedby="consent-error"
              />
              <div className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200" style={{
                background: consentChecked ? 'linear-gradient(135deg, #6366F1, #A78BFA)' : 'rgba(255,255,255,0.05)',
                border: consentChecked ? 'none' : '1px solid rgba(255,255,255,0.15)',
                boxShadow: consentChecked ? '0 0 10px rgba(99,102,241,0.5)' : 'none',
              }}>
                {consentChecked && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              I agree to the{' '}
              <a href="/terms" className="underline underline-offset-2 transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }} target="_blank" rel="noopener noreferrer">Terms</a>
              {' '}and{' '}
              <a href="/privacy" className="underline underline-offset-2 transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              , and I understand CareCompanion will access and process my health information to provide the service.
            </span>
          </label>

          {showConsentError && (
            <p id="consent-error" role="alert" className="text-xs text-red-400/80 pl-7 -mt-2">
              Please agree to continue.
            </p>
          )}

          {/* CTA button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] focus:outline-none overflow-hidden group disabled:opacity-80 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              boxShadow: '0 0 20px rgba(99,102,241,0.35), 0 4px 16px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 30px rgba(99,102,241,0.55), 0 4px 20px rgba(0,0,0,0.3)' }}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.35), 0 4px 16px rgba(0,0,0,0.3)')}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              )}
              {loading
                ? (isSignIn ? 'Signing in...' : 'Creating account...')
                : (isSignIn ? 'Sign In' : 'Get Started Free')}
            </span>
          </button>
        </form>

        {initialError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-xs text-red-400/90">{initialError}</p>
              <p className="text-[10px] text-red-400/50 mt-1">
                Having trouble?{' '}
                <a href="mailto:support@carecompanionai.org" className="underline">Contact support</a>
              </p>
            </div>
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-4 flex items-center justify-center gap-5">
          {[
            {
              icon: (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              ),
              label: 'HIPAA-compliant',
            },
            {
              icon: (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ),
              label: 'No ads, ever',
            },
            {
              icon: (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ),
              label: 'Your data, always',
            },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {badge.icon}
              <span className="text-[10px]">{badge.label}</span>
            </div>
          ))}
        </div>

        {/* Mode toggle */}
        <p className="mt-4 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {isSignIn ? (
            <>
              New to CareCompanion?{' '}
              <Link href="/login" className="underline underline-offset-2 transition-colors hover:text-white/50" style={{ color: 'rgba(167,139,250,0.6)' }}>
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login?mode=signin" className="underline underline-offset-2 transition-colors hover:text-white/50" style={{ color: 'rgba(167,139,250,0.6)' }}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Demo link */}
      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)', animation: 'loginFadeUp 0.6s ease 0.25s both' }}>
        Just exploring?{' '}
        <a href="/chat/guest" className="transition-colors hover:text-white/40 underline underline-offset-2" style={{ color: 'rgba(167,139,250,0.5)' }}>
          Try with demo data
        </a>
        {' '}— no account needed.
      </p>
    </div>
  )
}
