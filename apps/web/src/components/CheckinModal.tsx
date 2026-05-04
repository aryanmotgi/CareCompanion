'use client'

import { useState } from 'react'
import { MilestoneCelebration, type Milestone } from './MilestoneCelebration'
import { VoiceCheckin } from './VoiceCheckin'

interface CheckinModalProps {
  careProfileId: string
  isOpen: boolean
  onClose: () => void
  onComplete: (checkin: { id: string; mood: number; pain: number; energy: string; sleep: string; notes?: string | null; checkedInAt: string } | null, streak: number) => void
}

const MOOD_EMOJIS = [
  { value: 1, emoji: '\u{1F62B}' },
  { value: 2, emoji: '\u{1F615}' },
  { value: 3, emoji: '\u{1F610}' },
  { value: 4, emoji: '\u{1F60A}' },
  { value: 5, emoji: '\u{1F604}' },
]

const ENERGY_OPTIONS = ['low', 'medium', 'high'] as const
const SLEEP_OPTIONS = ['bad', 'ok', 'good'] as const

export function CheckinModal({ careProfileId, isOpen, onClose, onComplete }: CheckinModalProps) {
  const [mood, setMood] = useState<number | null>(null)
  const [pain, setPain] = useState(0)
  const [energy, setEnergy] = useState<string | null>(null)
  const [sleep, setSleep] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [voiceHighlight, setVoiceHighlight] = useState<Record<string, boolean>>({})

  if (!isOpen) return null

  const canSubmit = mood !== null && energy !== null && sleep !== null && !isSubmitting

  async function handleSubmit() {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careProfileId, mood, pain, energy, sleep, notes: notes || undefined }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setError('Already checked in today')
        setIsSubmitting(false)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setIsSubmitting(false)
        return
      }

      // Check if response includes a milestone
      if (data.data?.milestone) {
        setMilestone(data.data.milestone)
        setIsSubmitting(false)
        return
      }

      onComplete(data.data?.checkin, data.data?.streak ?? 0)
    } catch {
      setError('Network error. Please try again.')
      setIsSubmitting(false)
    }
  }

  function handleVoiceExtracted(fields: {
    mood: number | null
    pain: number | null
    energy: string | null
    sleep: string | null
  }) {
    const highlights: Record<string, boolean> = {}
    if (fields.mood !== null) {
      setMood(fields.mood)
    } else {
      highlights.mood = true
    }
    if (fields.pain !== null) {
      setPain(fields.pain)
    } else {
      highlights.pain = true
    }
    if (fields.energy !== null) {
      setEnergy(fields.energy)
    } else {
      highlights.energy = true
    }
    if (fields.sleep !== null) {
      setSleep(fields.sleep)
    } else {
      highlights.sleep = true
    }
    setVoiceHighlight(highlights)
  }

  function handleMilestoneClose() {
    const currentMilestone = milestone
    setMilestone(null)
    // After closing milestone, complete the check-in flow
    if (currentMilestone) {
      onComplete(null, 0)
    }
  }

  // Show milestone celebration overlay instead of the check-in form
  if (milestone) {
    return <MilestoneCelebration milestone={milestone} onClose={handleMilestoneClose} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-warm)] p-5 shadow-[var(--shadow-md)] overflow-y-auto max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/[0.1] transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h3 className="text-lg font-bold text-[var(--text)] mb-0.5">How are you feeling?</h3>
        <p className="text-xs text-[var(--text-muted)] mb-5">Quick daily check-in &middot; under 60 seconds</p>

        {/* Mood */}
        <div className={`mb-5 ${voiceHighlight.mood ? 'rounded-xl ring-2 ring-amber-400/50 p-2 -m-2' : ''}`}>
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
            Mood {voiceHighlight.mood && <span className="text-amber-400 normal-case">(needs input)</span>}
          </label>
          <div className="flex gap-2 justify-between">
            {MOOD_EMOJIS.map(({ value, emoji }) => (
              <button
                key={value}
                onClick={() => setMood(value)}
                className={`w-12 h-12 rounded-xl text-xl flex items-center justify-center transition-all btn-press ${
                  mood === value
                    ? 'border-2 border-white bg-[#6c63ff]/40 scale-110 shadow-[0_0_0_3px_rgba(108,99,255,0.35)]'
                    : 'border border-[var(--border)] bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Pain slider */}
        <div className={`mb-5 ${voiceHighlight.pain ? 'rounded-xl ring-2 ring-amber-400/50 p-2 -m-2' : ''}`}>
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
            Pain level {voiceHighlight.pain && <span className="text-amber-400 normal-case">(needs input)</span>}
          </label>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-[var(--text)] tabular-nums w-10 text-center">{pain}</span>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={10}
                value={pain}
                onChange={(e) => setPain(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer checkin-pain-slider"
                style={{
                  background: `linear-gradient(to right, #22c55e ${(pain / 10) * 100}%, #64748b33 ${(pain / 10) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>None</span>
                <span>Severe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Energy */}
        <div className={`mb-5 ${voiceHighlight.energy ? 'rounded-xl ring-2 ring-amber-400/50 p-2 -m-2' : ''}`}>
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
            Energy {voiceHighlight.energy && <span className="text-amber-400 normal-case">(needs input)</span>}
          </label>
          <div className="flex gap-2">
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setEnergy(opt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all btn-press ${
                  energy === opt
                    ? 'border-2 border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text)]'
                    : 'border border-[var(--border)] bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.08]'
                }`}
              >
                {opt === 'medium' ? 'Med' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div className={`mb-5 ${voiceHighlight.sleep ? 'rounded-xl ring-2 ring-amber-400/50 p-2 -m-2' : ''}`}>
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
            Sleep {voiceHighlight.sleep && <span className="text-amber-400 normal-case">(needs input)</span>}
          </label>
          <div className="flex gap-2">
            {SLEEP_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSleep(opt)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all btn-press ${
                  sleep === opt
                    ? 'border-2 border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text)]'
                    : 'border border-[var(--border)] bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.08]'
                }`}
              >
                {opt === 'ok' ? 'OK' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Anything else? (optional)"
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] bg-white/[0.04] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#818CF8] text-white text-sm font-semibold btn-press disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {isSubmitting ? 'Saving...' : 'Done \u2713'}
          </button>
          <VoiceCheckin
            onExtracted={handleVoiceExtracted}
            onError={(msg) => setError(msg)}
          />
        </div>
      </div>
    </div>
  )
}
