'use client'

import { useEffect, useState, useMemo } from 'react'

const CONFETTI_COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#60a5fa', '#38bdf8', '#34d399', '#fbbf24', '#f472b6']

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
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    setVisible(true)
    const t1 = setTimeout(() => {
      setShowContent(true)
      setTimeout(() => setShowConfetti(true), 100)
    }, 400)
    const t2 = setTimeout(() => setShowCta(true), 900)
    const t3 = setTimeout(() => setShowConfetti(false), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const particles = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * 2 * Math.PI
      const dist = 90 + (i * 41) % 110
      const dx = Math.cos(angle) * dist * (0.8 + (i * 0.031) % 0.4)
      const dy = Math.sin(angle) * dist * (0.8 + (i * 0.019) % 0.4) - 30
      return {
        id: i,
        dx: `${dx.toFixed(1)}px`,
        dy: `${dy.toFixed(1)}px`,
        r: `${(i * 73) % 720}deg`,
        delay: `${(i * 43) % 500}ms`,
        color: CONFETTI_COLORS[(i * 3) % CONFETTI_COLORS.length],
        size: 4 + (i * 7) % 8,
        borderRadius: i % 3 === 0 ? '2px' : '50%',
      }
    }), [])

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
          className="relative flex items-center gap-4"
          style={{ opacity: showContent ? 1 : 0, transform: showContent ? 'scale(1)' : 'scale(0.85)', transition: 'all 400ms ease' }}
        >
          {/* Confetti burst from the connection point */}
          {showConfetti && (
            <>
              <style>{`
                @keyframes cc-burst {
                  0%   { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
                  70%  { opacity: 0.9; }
                  100% { transform: translate(var(--cc-dx),var(--cc-dy)) scale(0.15) rotate(var(--cc-r)); opacity: 0; }
                }
              `}</style>
              <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
                style={{ overflow: 'visible' }}
                aria-hidden="true"
              >
                {particles.map(p => (
                  <div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      borderRadius: p.borderRadius,
                      background: p.color,
                      '--cc-dx': p.dx,
                      '--cc-dy': p.dy,
                      '--cc-r': p.r,
                      animation: `cc-burst 1.4s ease-out ${p.delay} forwards`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            </>
          )}

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
            You&apos;re not doing this alone anymore.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
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
        Let&apos;s get started →
      </button>
    </div>
  )
}
