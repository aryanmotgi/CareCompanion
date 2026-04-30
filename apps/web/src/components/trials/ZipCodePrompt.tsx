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
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
      <p className="text-sm text-amber-800 font-medium">
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
          className="flex-1 rounded border border-amber-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={saving || zip.length !== 5}
          className="px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
