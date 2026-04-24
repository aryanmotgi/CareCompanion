'use client'

import { useState } from 'react'

export interface Milestone {
  type: 'cycle' | 'streak' | 'personal_best'
  title: string
  message: string
  detail?: string
}

interface MilestoneCelebrationProps {
  milestone: Milestone | null
  onClose: () => void
}

const EMOJI_MAP: Record<Milestone['type'], string> = {
  cycle: '\u{1F389}',
  streak: '\u{1F525}',
  personal_best: '\u2B50',
}

export function MilestoneCelebration({ milestone, onClose }: MilestoneCelebrationProps) {
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)

  if (!milestone) return null

  const emoji = EMOJI_MAP[milestone.type]

  async function handleShare() {
    setSharing(true)
    try {
      await fetch('/api/checkins/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone }),
      })
      setShared(true)
    } catch {
      // Silently fail — not critical
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-warm)] p-6 shadow-[var(--shadow-md)] text-center">
        {/* Emoji */}
        <div className="success-pulse text-5xl mb-4">{emoji}</div>

        {/* Title */}
        <h3 className="text-lg font-bold text-[var(--text)] mb-2">{milestone.title}</h3>

        {/* Message */}
        <p className="text-sm text-[var(--text-secondary)] mb-4">{milestone.message}</p>

        {/* Optional detail card */}
        {milestone.detail && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-5">
            <p className="text-sm text-emerald-300">{milestone.detail}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleShare}
            disabled={sharing || shared}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#818CF8] text-white text-sm font-semibold btn-press disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {shared ? 'Shared!' : sharing ? 'Sharing...' : 'Share with Care Team'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-white/[0.04] text-[var(--text)] text-sm font-medium hover:bg-white/[0.08] transition-colors btn-press"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
