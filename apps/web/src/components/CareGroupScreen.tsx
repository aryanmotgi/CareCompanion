'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { QRCodePanel } from './QRCodePanel'
import { ConnectedCelebration } from './ConnectedCelebration'

function getCsrfToken(): string {
  return document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? ''
}

type Step = 'pick' | 'create-form' | 'qr' | 'join-form' | 'connected' | 'qr-timeout'

// Match QR expiry — QRCodePanel counts down 10 min, polling watches the same window.
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 10 * 60 * 1_000  // 10 minutes

export function CareGroupScreen({
  userRole,
  userDisplayName,
  onComplete,
}: {
  userRole: 'caregiver' | 'patient' | 'self'
  userDisplayName: string
  onComplete: (careGroupId?: string) => void
}) {
  const [step, setStep] = useState<Step>('pick')
  const [groupName, setGroupName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [careGroupId, setCareGroupId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [connectedName, setConnectedName] = useState('')
  const pollingRef = useRef<{ interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> } | null>(null)

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current.interval)
        clearTimeout(pollingRef.current.timeout)
      }
    }
  }, [])

  const subheading = useMemo(() => {
    if (step === 'qr-timeout') {
      return "Your care partner hasn't joined yet. No worries — your group is ready when they are."
    }
    return userRole === 'caregiver'
      ? 'Connect with your patient so you can support them and share their health journey.'
      : "Connect with a family member or caregiver so they can be part of your care."
  }, [step, userRole])

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    try {
      const csrfToken = getCsrfToken()
      const res = await fetch('/api/care-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong — please try again.'); return }

      setCareGroupId(data.id)

      // Invite generation is best-effort — the fallback UI handles a missing URL.
      try {
        const inviteRes = await fetch('/api/care-group/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({ careGroupId: data.id }),
        })
        const inviteData = await inviteRes.json()
        if (inviteRes.ok) setInviteUrl(inviteData.url)
      } catch {
        // invite generation failed — fallback UI will offer a retry
      }

      setStep('qr')
      startPolling(data.id)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/care-group/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json() as { id?: string; name?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? "We couldn't find that group. Double-check the name and password with whoever created it.")
        return
      }
      setCareGroupId(data.id ?? null)

      // Try to get the other member's real display name for the celebration screen.
      let displayName = data.name ?? 'Your care partner'
      try {
        const statusRes = await fetch(`/api/care-group/${data.id}/status`)
        const statusData = await statusRes.json() as { joined: boolean; name?: string }
        if (statusData.joined && statusData.name) displayName = statusData.name
      } catch {
        // status fetch failed — fall back to group name
      }

      setConnectedName(displayName)
      setStep('connected')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = useCallback((groupId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current.interval)
      clearTimeout(pollingRef.current.timeout)
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/care-group/${groupId}/status`)
        const data = await res.json()
        if (data.joined) {
          clearInterval(interval)
          if (pollingRef.current) clearTimeout(pollingRef.current.timeout)
          pollingRef.current = null
          setConnectedName(data.name ?? 'Your care partner')
          setStep('connected')
        }
      } catch {
        // ignore transient polling errors — keep trying
      }
    }, POLL_INTERVAL_MS)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      pollingRef.current = null
      setStep('qr-timeout')
    }, POLL_TIMEOUT_MS)
    pollingRef.current = { interval, timeout }
  }, [])

  const handleRegenerateInvite = useCallback(async (): Promise<string> => {
    if (!careGroupId) return ''
    const res = await fetch('/api/care-group/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ careGroupId }),
    })
    const data = await res.json()
    return data.url ?? ''
  }, [careGroupId])

  if (step === 'connected') {
    return (
      <ConnectedCelebration
        yourName={userDisplayName}
        theirName={connectedName}
        onContinue={() => onComplete(careGroupId ?? undefined)}
      />
    )
  }

  const isFormStep = step === 'create-form' || step === 'join-form'
  const passwordValid = password.length >= 4

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">
          {step === 'qr-timeout' ? 'No rush — they can join later' : 'Your Care Group 💜'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{subheading}</p>
      </div>

      {step === 'pick' && (
        <>
          <button
            type="button"
            onClick={() => setStep('create-form')}
            className="rounded-xl p-4 text-left transition-all hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">✨ Create a Care Group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              You&apos;re the first one here. Choose a name and a shared password, then invite your care partner.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStep('join-form')}
            className="rounded-xl p-4 text-left transition-all hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">🔗 Join an existing group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Someone already set one up. Enter the group name and password they shared with you.
            </div>
          </button>
        </>
      )}

      {isFormStep && (
        <>
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="flex items-center gap-1 text-xs mb-1 transition-colors hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/50 rounded"
            style={{ color: 'rgba(255,255,255,0.4)', width: 'fit-content' }}
            aria-label="Go back"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <form
            className="flex flex-col gap-3"
            onSubmit={e => { e.preventDefault(); step === 'create-form' ? handleCreate() : handleJoin() }}
          >
            <div
              className="rounded-xl px-4 pt-5 pb-3 focus-within:ring-1 focus-within:ring-violet-400/40 transition-shadow"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <label htmlFor="care-group-name" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Group name</label>
              <input
                id="care-group-name"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. The Smith Family"
                className="block w-full bg-transparent text-sm focus:outline-none"
                style={{ color: 'rgba(255,255,255,0.9)' }}
                autoComplete="organization"
              />
            </div>
            <div
              className="rounded-xl px-4 pt-5 pb-3 focus-within:ring-1 focus-within:ring-violet-400/40 transition-shadow"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <label htmlFor="care-group-password" className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>
                {step === 'create-form' ? 'Choose a shared password' : 'Group password'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="care-group-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                  autoComplete={step === 'create-form' ? 'new-password' : 'current-password'}
                  aria-describedby={step === 'create-form' ? 'password-hint' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/50 rounded"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
              {step === 'create-form' && (
                <div id="password-hint">
                  {password.length > 0 ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                        style={{ background: passwordValid ? '#34d399' : 'rgba(255,255,255,0.2)' }}
                      />
                      <span
                        className="text-[10px] transition-colors"
                        style={{ color: passwordValid ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.3)' }}
                      >
                        {passwordValid
                          ? 'Good — share this with your care partner'
                          : `${4 - password.length} more ${4 - password.length === 1 ? 'character' : 'characters'} needed`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      At least 4 characters. Share this with your care partner so they can join.
                    </p>
                  )}
                </div>
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
              disabled={loading || !groupName.trim() || !password || (step === 'create-form' && !passwordValid)}
              className="rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span aria-live="polite">{step === 'create-form' ? 'Creating your group…' : 'Joining…'}</span>
                </span>
              ) : (
                step === 'create-form' ? 'Create Group' : 'Join Group'
              )}
            </button>
          </form>
        </>
      )}

      {step === 'qr' && careGroupId && (
        <>
          {inviteUrl ? (
            <QRCodePanel
              careGroupId={careGroupId}
              initialUrl={inviteUrl}
              userRole={userRole}
              onRegenerate={handleRegenerateInvite}
            />
          ) : (
            <div className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Having trouble generating the invite link. Tap below to try again.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const url = await handleRegenerateInvite()
                  if (url) setInviteUrl(url)
                }}
                className="text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/50 rounded"
                style={{ color: 'rgba(167,139,250,0.8)' }}
              >
                Try again
              </button>
            </div>
          )}
          <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#7c3aed' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Waiting for them to join…</p>
          </div>
          <button
            type="button"
            onClick={() => onComplete(careGroupId)}
            className="text-xs text-center mt-2 py-2 px-3 rounded-lg transition-colors hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/40"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Continue without waiting — I&apos;ll invite them later
          </button>
        </>
      )}

      {step === 'qr-timeout' && (
        <>
          <button
            type="button"
            onClick={() => {
              setStep('qr')
              if (careGroupId) startPolling(careGroupId)
            }}
            className="rounded-xl py-3.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            Share a new invite link
          </button>
          <button
            type="button"
            onClick={() => onComplete(careGroupId ?? undefined)}
            className="text-xs text-center py-2 px-3 rounded-lg transition-colors hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/40"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Continue on my own — I&apos;ll invite them from settings later
          </button>
        </>
      )}

      {step === 'pick' && (
        <button
          type="button"
          onClick={() => onComplete()}
          className="text-xs text-center mt-2 py-2 px-3 rounded-lg transition-colors hover:text-white/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/40"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Skip for now — I&apos;ll set this up later
        </button>
      )}
    </div>
  )
}
