'use client'

import { useState } from 'react'

function FloatingInput({
  id, label, type = 'text', value, onChange, autoComplete, required,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; required?: boolean;
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl pt-5 pb-2 px-4 text-sm text-white/90 placeholder:text-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-all peer"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
        placeholder={label}
        aria-label={label}
      />
      <label
        htmlFor={id}
        className="absolute left-4 transition-all duration-200 pointer-events-none"
        style={{
          top: active ? '6px' : '14px',
          fontSize: active ? '10px' : '14px',
          color: active ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.3)',
          fontWeight: active ? 500 : 400,
        }}
      >
        {label}
      </label>
    </div>
  )
}

export function ResetRequestForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(undefined)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="relative rounded-2xl p-6 overflow-hidden text-center" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}>
        <svg className="w-10 h-10 mx-auto mb-3 text-green-400/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <p className="text-sm text-white/70 mb-4">If an account exists with that email, we&apos;ve sent a reset link. Check your inbox.</p>
        <a href="/login" className="text-xs underline underline-offset-2 transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }}>
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4" style={{ animation: 'loginFadeUp 0.6s ease 0.15s both' }}>
      <div className="relative rounded-2xl p-6 overflow-hidden" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)' }} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <FloatingInput id="reset-email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />

          <button
            type="submit"
            disabled={loading}
            className="w-full relative rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:ring-offset-2 focus:ring-offset-[#05060F] overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)', color: '#fff' }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <a href="/login" className="underline underline-offset-2 transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }}>
              Back to sign in
            </a>
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-xs text-red-400/90">{error}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
