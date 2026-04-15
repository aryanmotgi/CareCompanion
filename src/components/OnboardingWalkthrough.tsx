'use client'

import { useState } from 'react'

const slides = [
  {
    color: '#A78BFA',
    svgPath: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
    title: 'Track Your Cancer Care',
    description: 'See chemo schedules, oncology appointments, tumor markers, and medications all in one place. Get alerts when something needs attention.',
  },
  {
    color: '#60A5FA',
    svgPath: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
    title: 'Understand Your Treatment',
    description: 'Chat with CareCompanion to understand lab results, prepare for oncology visits, or ask about treatment side effects.',
  },
  {
    color: '#34D399',
    svgPath: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
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
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 mx-auto" style={{ background: slide.color + '18' }}>
        <svg className="w-10 h-10" fill="none" stroke={slide.color} strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={slide.svgPath} />
        </svg>
      </div>
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
