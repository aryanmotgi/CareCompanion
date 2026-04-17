'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConsentPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [showError, setShowError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    if (!checked) {
      setShowError(true)
      return
    }

    setLoading(true)
    try {
      // Part 5 analytics: track structural event only — no health data fields
      try {
        const { track } = await import('@vercel/analytics')
        track('consent_accepted')
      } catch {}

      const res = await fetch('/api/consent/accept', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to record consent')

      router.replace('/dashboard')
    } catch (e) {
      console.error('[consent] accept failed:', e)
      setLoading(false)
    }
  }

  function handleDecline() {
    import('@vercel/analytics').then(({ track }) => track('consent_declined')).catch(() => {})
    router.replace('/login')
  }

  // Track consent_shown on mount
  useEffect(() => {
    import('@vercel/analytics').then(({ track }) => track('consent_shown')).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 bg-[#080A14]">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] shadow-lg shadow-[#6366F1]/20 mb-5">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Health Data Authorization</h1>
          <p className="text-sm text-[var(--text-muted)]">Please review and accept before continuing</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-5">
          {/* What we access */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">What CareCompanion accesses and why</h2>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              To provide personalized cancer care support, CareCompanion requests access to the following health information from your connected health systems and insurance providers:
            </p>
            <ul className="space-y-2">
              {[
                { icon: '💊', label: 'Medications', desc: 'To track your treatment regimen and flag interactions' },
                { icon: '🔬', label: 'Lab results', desc: 'To monitor key values like CBC, tumor markers, and metabolic panels' },
                { icon: '📅', label: 'Appointments', desc: 'To help you prepare and follow up on care visits' },
                { icon: '🏥', label: 'Conditions & diagnoses', desc: 'To provide context-aware guidance for your specific situation' },
                { icon: '📋', label: 'Insurance claims & EOBs', desc: 'To help you understand coverage and out-of-pocket costs' },
              ].map(({ icon, label, desc }) => (
                <li key={label} className="flex items-start gap-3">
                  <span className="text-base mt-0.5" aria-hidden="true">{icon}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-white">{label}</span> — {desc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Data handling */}
          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <p>Your data is encrypted in transit and at rest. It is never sold, shared with advertisers, or used to train AI models without your explicit permission.</p>
            <p>
              You can disconnect health data sources or delete your account at any time from{' '}
              <span className="text-[var(--text-secondary)]">Settings</span>.
            </p>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Checkbox */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  setChecked(e.target.checked)
                  if (e.target.checked) setShowError(false)
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] bg-[var(--bg-card)] accent-[#6366F1] cursor-pointer"
                aria-describedby="consent-page-error"
              />
              <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                I agree to the{' '}
                <a href="/terms" className="text-[#A78BFA] hover:text-[#C4B5FD] underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-[#A78BFA] hover:text-[#C4B5FD] underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                , and I understand that CareCompanion will access and process my health information including medications, lab results, appointments, and insurance records to provide the service.
              </span>
            </label>
            {showError && (
              <p id="consent-page-error" role="alert" className="text-xs text-red-400 pl-7">
                You must agree to the Terms of Service and Privacy Policy to continue.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] py-3.5 px-6 text-base text-white font-semibold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#A78BFA]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Accept and Continue'
              )}
            </button>
            <button
              onClick={handleDecline}
              disabled={loading}
              className="w-full py-2.5 px-6 text-sm text-[var(--text-muted)] hover:text-white transition-colors disabled:opacity-50"
            >
              Decline — sign out
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          Questions?{' '}
          <a href="mailto:support@carecompanionai.org" className="text-[#A78BFA] hover:text-[#C4B5FD] underline underline-offset-2 transition-colors">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
