'use client'

import { useState } from 'react'

const slides = [
  {
    icon: '🎗️',
    title: 'Track Your Cancer Care',
    description: 'See chemo schedules, oncology appointments, tumor markers, and medications all in one place. Get alerts when something needs attention.',
  },
  {
    icon: '🤖',
    title: 'Understand Your Treatment',
    description: 'Chat with CareCompanion to understand lab results, prepare for oncology visits, or ask about treatment side effects.',
  },
  {
    icon: '📸',
    title: 'Organize Medical Records',
    description: 'Scan pathology reports, lab results, imaging reports, and insurance documents. Everything organized automatically.',
  },
]

export function OnboardingWalkthrough({ onComplete }: { onComplete: () => void }) {
  const [current, setCurrent] = useState(0)

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1)
    } else {
      localStorage.setItem('onboarding_seen', 'true')
      onComplete()
    }
  }

  const slide = slides[current]

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center">
      <div className="text-6xl mb-6">{slide.icon}</div>
      <h2 className="text-[#f1f5f9] text-2xl font-bold mb-3">{slide.title}</h2>
      <p className="text-[#94a3b8] text-sm leading-relaxed mb-8 max-w-xs">{slide.description}</p>

      {/* Dots */}
      <div className="flex gap-2 mb-8">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === current ? 'bg-[#22d3ee] w-6' : 'bg-white/[0.2]'
            }`}
          />
        ))}
      </div>

      <button
        onClick={handleNext}
        className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold animate-press"
      >
        {current === slides.length - 1 ? 'Get Started' : 'Next'}
      </button>

      {current < slides.length - 1 && (
        <button
          onClick={() => {
            localStorage.setItem('onboarding_seen', 'true')
            onComplete()
          }}
          className="mt-3 text-[#64748b] text-xs"
        >
          Skip
        </button>
      )}
    </div>
  )
}
