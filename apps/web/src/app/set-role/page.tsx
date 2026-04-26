'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Role = 'caregiver' | 'patient' | 'self'

const roles = [
  { value: 'caregiver' as Role, label: 'Caregiver', description: 'Supporting someone through cancer treatment' },
  { value: 'patient' as Role, label: 'Patient', description: 'Managing my own cancer journey' },
  { value: 'self' as Role, label: 'Self-care', description: 'Monitoring my own health proactively' },
]

export default function SetRolePage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!role) { setError('Please select your role to continue'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) { setError('Something went wrong. Try again.'); return }
      router.push('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0a0a0f' }}>
      <div className="w-full max-w-md flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>One quick thing</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Who are you using CareCompanion as?
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {roles.map((r) => {
            const selected = role === r.value
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => { setRole(r.value); setError('') }}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
                  border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.12)',
                  boxShadow: selected ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 20px rgba(124,58,237,0.15)' : 'none',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{r.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{r.description}</div>
              </button>
            )
          })}
        </div>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !role}
          className="rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
