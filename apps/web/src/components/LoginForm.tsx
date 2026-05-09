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

export function LoginForm({ initialError, callbackUrl }: { initialError?: string; callbackUrl?: string }) {
  const [tab, setTab] = useState<'email' | 'care-group'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupPassword, setGroupPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  const safeCallback = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') && !callbackUrl.startsWith('/\\') ? callbackUrl : '/dashboard'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)

    if (tab === 'care-group') {
      const result = await signIn('care-group', {
        groupName,
        groupPassword,
        redirect: false,
      })
      if (result?.error) {
        setError("We couldn't find that Care Group — double-check the name and password.")
        setLoading(false)
        return
      }
      window.location.href = '/dashboard'
      return
    }

    if (!email.trim() || !password) {
      setLoading(false)
      return
    }

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    if (result?.error) {
      setError("That doesn't look right — please check your email and password.")
      setLoading(false)
    } else if (result?.ok) {
      window.location.href = safeCallback
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
            Sign in to your account
          </p>

          {/* Tab toggle */}
          <div className="grid grid-cols-2 rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['email', 'care-group'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="py-2.5 text-xs font-semibold transition-colors"
                style={{
                  background: tab === t ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {t === 'email' ? 'Email' : 'Care Group'}
              </button>
            ))}
          </div>

          {tab === 'email' && (
            <>
              {/* Social sign-in buttons */}
              <button
                type="button"
                onClick={() => signIn('apple', { callbackUrl: safeCallback || '/dashboard' })}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] hover:opacity-90"
                style={{ background: '#FFFFFF', color: '#000000' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </button>

              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: safeCallback || '/dashboard' })}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] hover:opacity-90"
                style={{ background: '#FFFFFF', color: '#1F1F1F' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <FloatingInput id="login-email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />

              <PasswordInput id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" required />

              {/* Forgot password link */}
              <div className="text-right">
                <a href="/reset-password" className="text-xs transition-colors hover:text-white/60" style={{ color: 'rgba(167,139,250,0.7)' }}>
                  Forgot password?
                </a>
              </div>
            </>
          )}

          {tab === 'care-group' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Group name</label>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="e.g. The Smith Family"
                  className="block w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                  autoComplete="organization"
                />
              </div>
              <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Group password</label>
                <input
                  type="password"
                  value={groupPassword}
                  onChange={e => setGroupPassword(e.target.value)}
                  className="block w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
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
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Signing in…
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
