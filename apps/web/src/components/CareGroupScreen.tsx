'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { QRCodePanel } from './QRCodePanel'
import { ConnectedCelebration } from './ConnectedCelebration'

type Step = 'pick' | 'create-form' | 'qr' | 'join-form' | 'connected'

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

  const subheading = userRole === 'caregiver'
    ? 'Connect with your patient so you can share their health data.'
    : "Connect with a family member or caregiver if you'd like to share your health data."

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/care-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setCareGroupId(data.id)

      const inviteRes = await fetch('/api/care-group/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careGroupId: data.id }),
      })
      const inviteData = await inviteRes.json()
      if (inviteRes.ok) setInviteUrl(inviteData.url)

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setCareGroupId(data.id)
      setConnectedName('Your partner')
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
          setConnectedName(data.name ?? 'Your partner')
          setStep('connected')
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      pollingRef.current = null
    }, 30_000)
    pollingRef.current = { interval, timeout }
  }, [])

  const handleRegenerateInvite = useCallback(async (): Promise<string> => {
    if (!careGroupId) return ''
    const res = await fetch('/api/care-group/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-white">Set up your Care Group 👨‍👩‍👧</h1>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{subheading}</p>

      {step === 'pick' && (
        <>
          <button
            type="button"
            onClick={() => setStep('create-form')}
            className="rounded-xl p-4 text-left transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">✨ Create a new Care Group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              You&apos;re going first. Pick a group name and password to share.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStep('join-form')}
            className="rounded-xl p-4 text-left transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">🔗 Join an existing Care Group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enter the name and password someone gave you.
            </div>
          </button>
        </>
      )}

      {(step === 'create-form' || step === 'join-form') && (
        <>
          <button type="button" onClick={() => setStep('pick')} className="text-xs text-left mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ← Back
          </button>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Group name</label>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. The Smith Family"
                className="block w-full bg-transparent text-sm focus:outline-none"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              />
            </div>
            <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <label className="text-[10px] font-medium block mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>Group password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full bg-transparent text-sm focus:outline-none"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              />
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
          <button
            type="button"
            onClick={step === 'create-form' ? handleCreate : handleJoin}
            disabled={loading || !groupName.trim() || !password}
            className="rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            {loading ? 'Loading...' : step === 'create-form' ? 'Create Group' : 'Join Group'}
          </button>
        </>
      )}

      {step === 'qr' && inviteUrl && careGroupId && (
        <>
          <QRCodePanel
            careGroupId={careGroupId}
            initialUrl={inviteUrl}
            onRegenerate={handleRegenerateInvite}
          />
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#7c3aed' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Waiting for your patient to join...</p>
          </div>
          <button
            type="button"
            onClick={() => onComplete(careGroupId)}
            className="text-xs text-center mt-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Continue without waiting
          </button>
        </>
      )}

      {step === 'pick' && (
        <button
          type="button"
          onClick={() => onComplete()}
          className="text-xs text-center mt-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
