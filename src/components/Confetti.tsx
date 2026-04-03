'use client'

import { useEffect, useState, useCallback } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  angle: number
  velocity: number
  spin: number
  size: number
  shape: 'circle' | 'rect' | 'star'
}

const COLORS = ['#22d3ee', '#a78bfa', '#3b82f6', '#34d399', '#fbbf24', '#fb7185', '#818cf8']

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 50,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: (Math.random() * 360) * (Math.PI / 180),
    velocity: 3 + Math.random() * 5,
    spin: (Math.random() - 0.5) * 720,
    size: 4 + Math.random() * 6,
    shape: (['circle', 'rect', 'star'] as const)[Math.floor(Math.random() * 3)],
  }))
}

export function Confetti({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([])

  const handleComplete = useCallback(() => {
    onComplete?.()
  }, [onComplete])

  useEffect(() => {
    if (!active) return
    setParticles(createParticles(40))
    const timer = setTimeout(() => {
      setParticles([])
      handleComplete()
    }, 1200)
    return () => clearTimeout(timer)
  }, [active, handleComplete])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'star' ? '2px' : '1px',
            '--confetti-tx': `${Math.cos(p.angle) * p.velocity * 60}px`,
            '--confetti-ty': `${Math.sin(p.angle) * p.velocity * 40 - 120}px`,
            '--confetti-spin': `${p.spin}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
