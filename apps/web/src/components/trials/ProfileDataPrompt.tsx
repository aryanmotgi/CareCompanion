'use client'
import { useState } from 'react'

const CANCER_SUGGESTIONS = [
  'Breast Cancer', 'Lung Cancer', 'Colorectal Cancer', 'Prostate Cancer',
  'Pancreatic Cancer', 'Ovarian Cancer', 'Bladder Cancer', 'Lymphoma',
  'Leukemia', 'Melanoma', 'Kidney Cancer', 'Thyroid Cancer', 'Liver Cancer',
  'Stomach Cancer', 'Cervical Cancer', 'Endometrial Cancer', 'Myeloma',
  'Head and Neck Cancer', 'Esophageal Cancer', 'Brain Cancer',
]

const STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unknown']

type SavedData = { cancerType: string; cancerStage: string; patientAge: number | null }

type Props = {
  profileId: string
  onSaved:   (data: SavedData) => void
}

export function ProfileDataPrompt({ profileId, onSaved }: Props) {
  const [cancerType, setCancerType] = useState('')
  const [cancerStage, setCancerStage] = useState('')
  const [age, setAge]                 = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cancerType.trim()) { setError('Please enter the cancer type'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/care-profiles/${profileId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          cancerType:  cancerType.trim(),
          cancerStage: cancerStage || null,
          patientAge:  age ? parseInt(age) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onSaved({
        cancerType:  cancerType.trim(),
        cancerStage: cancerStage,
        patientAge:  age ? parseInt(age) : null,
      })
    } catch {
      setError('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-blue-900">Tell us about the patient</p>
        <p className="text-xs text-blue-700 mt-0.5">
          We use this to find relevant trials — takes 10 seconds.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          {/* Cancer type with datalist suggestions */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Cancer type</label>
            <input
              list="cancer-suggestions"
              value={cancerType}
              onChange={e => { setCancerType(e.target.value); setError(null) }}
              placeholder="e.g. Breast Cancer, Lung Cancer"
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <datalist id="cancer-suggestions">
              {CANCER_SUGGESTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Stage */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Stage</label>
              <select
                value={cancerStage}
                onChange={e => setCancerStage(e.target.value)}
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select stage</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Age */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Patient age</label>
              <input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 58"
                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !cancerType.trim()}
          className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Find my trials →'}
        </button>
      </form>
    </div>
  )
}
