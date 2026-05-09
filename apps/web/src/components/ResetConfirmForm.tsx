'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

function FloatingInput({
  id, label, type = 'text', value, onChange, autoComplete, required, minLength,
  rightElement,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; required?: boolean;
  minLength?: number; rightElement?: React.ReactNode;
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
        minLength={minLength}
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
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  )
}

function PasswordInput({
  id, label, value, onChange, autoComplete, required, minLength,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; required?: boolean; minLength?: number;
}) {
  const [show, setShow] = useState(false)
  return (
    <FloatingInput
      id={id}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      minLength={minLength}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-white/30 hover:text-white/60 transition-colors p-1"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      }
    />
  )
}

export function ResetConfirmForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Reset failed. The link may have expired.')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="relative rounded-2xl p-6 overflow-hidden text-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          animation: 'loginFadeUp 0.4s ease both',
        }}
      >
        <svg className="w-10 h-10 mx-auto mb-3 text-green-400/80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-white/80 mb-1">You&apos;re all set!</p>
        <p className="text-xs text-white/50 mb-4">Your password has been updated. Sign in to continue where you left off.</p>
        <a href="/login" className="inline-block rounded-xl py-2.5 px-6 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/70" style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)' }}>
          Sign in
        </a>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="relative rounded-2xl p-6 overflow-hidden text-center" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}>
        <p className="text-sm text-red-400/80 mb-4">Invalid or missing reset token.</p>
        <a href="/reset-password" className="text-xs underline underline-offset-2" style={{ color: 'rgba(167,139,250,0.7)' }}>
          Request a new reset link
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
          <PasswordInput id="reset-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={8} />

          <div>
            <PasswordInput id="reset-confirm" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />
            {mismatch && (
              <p className="text-[10px] mt-1 px-1" style={{ color: 'rgba(239,68,68,0.7)' }}>
                Passwords do not match
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-xs text-red-400/90">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:ring-offset-2 focus:ring-offset-[#05060F] overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ background: 'linear-gradient(135deg, #6366F1, #A78BFA)', color: '#fff' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Resetting…
              </span>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
