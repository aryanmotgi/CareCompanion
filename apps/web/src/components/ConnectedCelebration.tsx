'use client'

import { useEffect, useState } from 'react'

export function ConnectedCelebration({
  yourName,
  theirName,
  onContinue,
}: {
  yourName: string
  theirName: string
  onContinue: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [showCta, setShowCta] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t1 = setTimeout(() => setShowContent(true), 400)
    const t2 = setTimeout(() => setShowCta(true), 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const initials = (name: string) => name.trim().charAt(0).toUpperCase()

  return (
    <div
      className="flex flex-col items-center justify-between min-h-screen px-6 py-12"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 300ms ease' }}
      aria-live="polite"
    >
      <div />

      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-3xl select-none" aria-hidden="true">🎉 ✨ 🎊</div>

        <div
          className="flex items-center gap-4"
          style={{ opacity: showContent ? 1 : 0, transform: showContent ? 'scale(1)' : 'scale(0.85)', transition: 'all 400ms ease' }}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}
            >
              {initials(yourName)}
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>You</span>
          </div>

          <div className="relative w-8 flex items-center justify-center">
            <div className="w-full h-0.5" style={{ background: 'linear-gradient(90deg, #7c3aed, #0ea5e9)' }} />
            <span className="absolute text-sm" aria-hidden="true">💜</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}
            >
              {initials(theirName)}
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{theirName}</span>
          </div>
        </div>

        <div style={{ opacity: showContent ? 1 : 0, transition: 'opacity 200ms ease', transitionDelay: '200ms' }}>
          <h1
            className="text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #c4b5fd, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            You&apos;re connected!
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your care journey starts now.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        style={{
          opacity: showCta ? 1 : 0,
          transition: 'opacity 200ms ease',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          borderRadius: '12px',
          padding: '14px',
          width: '100%',
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
        }}
      >
        Continue to setup →
      </button>
    </div>
  )
}
