'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckinModal } from './CheckinModal'

interface CheckinData {
  id: string
  mood: number
  pain: number
  energy: string
  sleep: string
  notes?: string | null
  checkedInAt: string
}

interface CheckinCardProps {
  careProfileId: string
}

const MOOD_EMOJI: Record<number, string> = {
  1: '\u{1F62B}',
  2: '\u{1F615}',
  3: '\u{1F610}',
  4: '\u{1F60A}',
  5: '\u{1F604}',
}

export function CheckinCard({ careProfileId }: CheckinCardProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [checkin, setCheckin] = useState<CheckinData | null>(null)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkins?careProfileId=${encodeURIComponent(careProfileId)}`)
      if (!res.ok) return
      const data = await res.json()
      setCheckin(data.data?.checkin ?? null)
      setStreak(data.data?.streak ?? 0)
    } catch {
      // Silently fail — card just shows check-in prompt
    } finally {
      setLoading(false)
    }
  }, [careProfileId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  function handleComplete(newCheckin: CheckinData | null, newStreak: number) {
    if (newCheckin) setCheckin(newCheckin)
    setStreak(newStreak)
    setModalOpen(false)
    fetchStatus()
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4 mb-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3.5 w-28 bg-white/[0.06] rounded-md" />
            <div className="h-3 w-40 bg-white/[0.04] rounded-md" />
          </div>
          <div className="h-8 w-20 bg-white/[0.06] rounded-xl" />
        </div>
      </div>
    )
  }

  // Already checked in today
  if (checkin) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--text)]">
            <span>Today: {MOOD_EMOJI[checkin.mood] ?? ''}</span>
            <span className="text-[var(--text-muted)]">Pain {checkin.pain}/10</span>
            <span className="text-[var(--text-muted)]">&middot;</span>
            <span className="text-[var(--text-muted)] capitalize">Energy {checkin.energy}</span>
          </div>
          {streak > 1 && (
            <span className="text-xs text-amber-400 font-medium">
              🔥 {streak}-day streak
            </span>
          )}
        </div>
      </div>
    )
  }

  // Not checked in yet
  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-light)] p-4 mb-4 hover:bg-[var(--accent-glow)] transition-colors card-hover-glow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Daily Check-in</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">How are you feeling today?</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#818CF8] text-white text-xs font-semibold btn-press">
            Check in
          </span>
        </div>
      </button>

      <CheckinModal
        careProfileId={careProfileId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onComplete={handleComplete}
      />
    </>
  )
}
