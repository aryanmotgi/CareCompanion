'use client'

import { useState, useEffect } from 'react'

const CONSENT_KEY = 'cc_consented'

export function LoginForm({ initialError }: { initialError?: string }) {
  const [consentChecked, setConsentChecked] = useState(false)
  const [showConsentError, setShowConsentError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Pre-check for returning users who already consented
    if (localStorage.getItem(CONSENT_KEY) === '1') {
      setConsentChecked(true)
    }
    const handlePageShow = () => setLoading(false)
    window.addEventListener('pageshow', handlePageShow as EventListener)
    return () => window.removeEventListener('pageshow', handlePageShow as EventListener)
  }, [])

  function handleGoogleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!consentChecked) {
      e.preventDefault()
      setShowConsentError(true)
      return
    }
    localStorage.setItem(CONSENT_KEY, '1')
    setLoading(true)
  }

  const buttonBase = "w-full relative rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"

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

        <div className="space-y-5">

          {/* Section label */}
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Continue with
          </p>

          {/* Google button */}
          <form method="POST" action="/api/auth/start" onSubmit={handleGoogleSubmit}>
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="consent" value={consentChecked ? 'true' : ''} />
            <button
              type="submit"
              disabled={loading}
              className={`${buttonBase} flex items-center justify-center gap-3`}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </form>

          {/* Consent checkbox — always required */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
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
              <p id="consent-error" role="alert" className="text-xs text-amber-500 pl-7 mt-1.5">
                Please accept the Terms and Privacy Policy to continue.
              </p>
            )}
          </div>

          {initialError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
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
          <div className="flex items-center justify-center gap-5 pt-1">
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
        </div>
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
