'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

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
          tabIndex={-1}
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

export function LoginForm({ initialError, callbackUrl }: { initialError?: string; callbackUrl?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(undefined)

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: callbackUrl || '/dashboard',
    })

    if (result?.error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    } else {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

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

        <form onSubmit={handleSubmit} className="space-y-4">

          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Sign in
          </p>

          <FloatingInput id="login-email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />

          <PasswordInput id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" required />

          {/* Forgot password link */}
          <div className="text-right">
            <a href="/reset-password" className="text-xs transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }}>
              Forgot password?
            </a>
          </div>

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:ring-offset-2 focus:ring-offset-[#05060F] overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              background: 'linear-gradient(135deg, #6366F1, #A78BFA)',
              color: '#fff',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Create account link */}
          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Don&apos;t have an account?{' '}
            <a href="/signup" className="underline underline-offset-2 transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }}>
              Create one
            </a>
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-xs text-red-400/90">{error}</p>
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
        </form>
      </div>

      {/* Demo link */}
      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)', animation: 'loginFadeUp 0.6s ease 0.25s both' }}>
        Just exploring?{' '}
        <a href="/chat/guest" className="transition-colors hover:text-white/40 underline underline-offset-2" style={{ color: 'rgba(167,139,250,0.5)' }}>
          Try with demo data
        </a>
        {' '}&mdash; no account needed.
      </p>
    </div>
  )
}
