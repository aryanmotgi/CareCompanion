'use client'
import { useState } from 'react'

type Props = {
  profileId: string
  onSaved: (zip: string) => void
}

export function ZipCodePrompt({ profileId, onSaved }: Props) {
  const [zip, setZip]       = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = zip.trim()
    if (!/^\d{5}$/.test(clean)) { setError('Enter a valid 5-digit zip code'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/care-profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: clean }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onSaved(clean)
    } catch {
      setError('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border px-4 py-3 space-y-2"
      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
      <p className="text-sm font-medium text-white/90">
        Add your zip code to find trials near you
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={zip}
          onChange={e => { setZip(e.target.value.replace(/\D/g, '')); setError(null) }}
          placeholder="e.g. 90210"
          className="flex-1 rounded-lg px-3 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.90)' }}
        />
        <button
          type="submit"
          disabled={saving || zip.length !== 5}
          className="px-4 py-1.5 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
