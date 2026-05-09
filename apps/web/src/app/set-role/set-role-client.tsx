'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

type Role = 'caregiver' | 'patient' | 'self'

const roles = [
  {
    value: 'caregiver' as Role,
    emoji: '🫶',
    headline: "I'm caring for someone I love",
    description: 'Get support coordinating care for a family member or friend',
    gradient: 'from-[#6366F1] to-[#A78BFA]',
  },
  {
    value: 'patient' as Role,
    emoji: '🌱',
    headline: "I'm managing my own care",
    description: 'Keep track of your treatment, appointments, and health in one place',
    gradient: 'from-[#14B8A6] to-[#6366F1]',
  },
  {
    value: 'self' as Role,
    emoji: '💛',
    headline: "I'm doing both",
    description: "You're a caregiver and a patient — we'll support both sides of your journey",
    gradient: 'from-[#F59E0B] to-[#EC4899]',
  },
]

export default function SetRolePage() {
  const { update } = useSession()
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!role) { setError('Please select your role to continue'); return }
    setLoading(true)
    try {
      const csrfMatch = document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)
      const csrfToken = csrfMatch ? csrfMatch[2] : ''
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) { setError('Something went wrong. Try again.'); return }
      localStorage.setItem('cc_user_role', role)
      // Refresh JWT so middleware sees the new role before we navigate.
      // Don't gate on the return value — update() can return null on first call
      // even when the cookie was written. Hard navigation with window.location.href
      // guarantees the browser sends the freshly written cookie to the server.
      // Pass role explicitly so the JWT callback applies it immediately without a DB re-read.
      // update() resolves only after the new JWT cookie is written to the browser.
      await update({ role })
      window.location.href = `/onboarding?role=${role}`
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'var(--bg, #0C0E1A)' }}
    >
      <div className="w-full max-w-4xl flex flex-col items-center gap-12">

        {/* Header */}
        <div className="text-center max-w-xl">
          <h1
            className="font-display text-4xl font-bold"
            style={{ color: 'var(--text, #EDE9FE)' }}
          >
            You're in the right place.
          </h1>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: 'var(--text-secondary, #A5B4CF)' }}
          >
            CareCompanion is built for people navigating cancer care. Tell us a little about
            your situation so we can personalize your experience.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {roles.map((r) => {
            const selected = role === r.value
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => { setRole(r.value); setError('') }}
                className="flex flex-col items-center text-center rounded-2xl p-8 transition-all duration-200 gap-5"
                style={{
                  background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                  border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: selected
                    ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 32px rgba(124,58,237,0.2)'
                    : 'none',
                }}
              >
                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${r.gradient} text-3xl`}
                  style={{
                    boxShadow: selected
                      ? '0 4px 16px rgba(99,102,241,0.35)'
                      : '0 2px 10px rgba(0,0,0,0.35)',
                  }}
                  aria-hidden="true"
                >
                  {r.emoji}
                </div>

                {/* Text */}
                <div className="flex flex-col gap-2">
                  <div
                    className="text-base font-semibold leading-snug"
                    style={{ color: selected ? '#EDE9FE' : 'rgba(255,255,255,0.85)' }}
                  >
                    {r.headline}
                  </div>
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: selected ? 'rgba(167,139,250,0.85)' : 'rgba(255,255,255,0.45)' }}
                  >
                    {r.description}
                  </div>
                </div>

                {/* Selection indicator */}
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 mt-auto"
                  style={{
                    borderColor: selected ? '#7c3aed' : 'rgba(255,255,255,0.2)',
                    background: selected ? '#7c3aed' : 'transparent',
                  }}
                >
                  {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA block */}
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {error && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>{error}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !role}
            className="w-full rounded-xl py-4 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: role ? '0 4px 24px rgba(99,102,241,0.4)' : 'none',
            }}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>

          {/* Trust line */}
          <div
            className="flex items-center justify-center gap-2 text-xs"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
              <rect x="1" y="5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Your information is private and secure. We follow HIPAA guidelines and never sell your data.
          </div>
        </div>

      </div>
    </div>
  )
}
