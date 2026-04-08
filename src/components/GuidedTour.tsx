'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface TourStep {
  target: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'dashboard-cards',
    title: 'Your Action Items',
    description:
      'This is your personalized dashboard. Urgent refills, upcoming appointments, and abnormal labs appear here as priority cards.',
    position: 'bottom',
  },
  {
    target: 'quick-ask',
    title: 'Ask Your AI Companion',
    description:
      'Tap any prompt or type your own question. CareCompanion understands your cancer journey and gives personalized guidance.',
    position: 'top',
  },
  {
    target: 'tab-care',
    title: 'Medications & Appointments',
    description:
      'The Care tab tracks your medications, refill dates, and upcoming appointments all in one place.',
    position: 'top',
  },
  {
    target: 'tab-scan',
    title: 'Scan Documents',
    description:
      'Snap a photo of lab reports, prescriptions, or insurance paperwork. Our AI extracts the key details automatically.',
    position: 'top',
  },
  {
    target: 'tab-nav',
    title: 'Navigate Anywhere',
    description:
      'Use the bottom tabs to jump between Home, Chat, Care, and Scan. You\'re all set — welcome aboard!',
    position: 'top',
  },
]

export function GuidedTour() {
  const [active, setActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})
  const [arrowDirection, setArrowDirection] = useState<'up' | 'down'>('down')
  const [transitioning, setTransitioning] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check if tour should show
  useEffect(() => {
    if (typeof window === 'undefined') return
    const justCompleted = localStorage.getItem('onboarding_just_completed')
    const tourDone = localStorage.getItem('guided_tour_completed')
    if (justCompleted && !tourDone) {
      // Small delay so dashboard elements render first
      const timer = setTimeout(() => setActive(true), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // Position the spotlight and tooltip for the current step
  const positionStep = useCallback(() => {
    if (!active) return
    const step = TOUR_STEPS[currentStep]
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) return

    const rect = el.getBoundingClientRect()
    const padding = 8
    const paddedRect = new DOMRect(
      rect.left - padding,
      rect.top - padding,
      rect.width + padding * 2,
      rect.height + padding * 2
    )
    setSpotlightRect(paddedRect)

    // Calculate tooltip position after a frame so tooltipRef has dimensions
    requestAnimationFrame(() => {
      const tooltipEl = tooltipRef.current
      const tooltipHeight = tooltipEl?.offsetHeight ?? 180
      const tooltipWidth = Math.min(320, window.innerWidth - 32)
      const viewportH = window.innerHeight
      const viewportW = window.innerWidth

      let top: number
      let left: number
      let direction: 'up' | 'down'

      if (step.position === 'bottom' || (step.position === 'top' && paddedRect.top < tooltipHeight + 20)) {
        // Place tooltip below the element
        top = paddedRect.bottom + 16
        direction = 'up'
        // If it would overflow bottom, place above instead
        if (top + tooltipHeight > viewportH - 20) {
          top = paddedRect.top - tooltipHeight - 16
          direction = 'down'
        }
      } else {
        // Place tooltip above the element
        top = paddedRect.top - tooltipHeight - 16
        direction = 'down'
        if (top < 20) {
          top = paddedRect.bottom + 16
          direction = 'up'
        }
      }

      // Center horizontally on the target
      left = paddedRect.left + paddedRect.width / 2 - tooltipWidth / 2
      // Clamp to viewport
      left = Math.max(16, Math.min(left, viewportW - tooltipWidth - 16))

      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
      })

      // Position arrow
      const arrowLeft = Math.max(
        24,
        Math.min(
          paddedRect.left + paddedRect.width / 2 - left - 8,
          tooltipWidth - 24
        )
      )
      setArrowStyle({ left: `${arrowLeft}px` })
      setArrowDirection(direction)
    })
  }, [active, currentStep])

  useEffect(() => {
    positionStep()
    window.addEventListener('resize', positionStep)
    window.addEventListener('scroll', positionStep, true)
    return () => {
      window.removeEventListener('resize', positionStep)
      window.removeEventListener('scroll', positionStep, true)
    }
  }, [positionStep])

  const completeTour = useCallback(() => {
    setActive(false)
    localStorage.setItem('guided_tour_completed', 'true')
    localStorage.removeItem('onboarding_just_completed')
  }, [])

  const goNext = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      completeTour()
      return
    }
    setTransitioning(true)
    setTimeout(() => {
      setCurrentStep((s) => s + 1)
      setTransitioning(false)
    }, 200)
  }, [currentStep, completeTour])

  if (!active || !spotlightRect) return null

  const step = TOUR_STEPS[currentStep]
  const isLast = currentStep === TOUR_STEPS.length - 1

  return (
    <div className="guided-tour-overlay" aria-live="polite" role="dialog" aria-label="Guided tour">
      {/* Semi-transparent overlay with spotlight cutout via CSS mask */}
      <div
        className="guided-tour-mask"
        onClick={completeTour}
        style={{
          maskImage: `radial-gradient(ellipse at ${spotlightRect.left + spotlightRect.width / 2}px ${spotlightRect.top + spotlightRect.height / 2}px, transparent ${Math.max(spotlightRect.width, spotlightRect.height) * 0.55}px, black ${Math.max(spotlightRect.width, spotlightRect.height) * 0.55 + 2}px)`,
          WebkitMaskImage: `radial-gradient(ellipse at ${spotlightRect.left + spotlightRect.width / 2}px ${spotlightRect.top + spotlightRect.height / 2}px, transparent ${Math.max(spotlightRect.width, spotlightRect.height) * 0.55}px, black ${Math.max(spotlightRect.width, spotlightRect.height) * 0.55 + 2}px)`,
        }}
      />

      {/* Spotlight ring glow */}
      <div
        className="guided-tour-spotlight"
        style={{
          top: `${spotlightRect.top}px`,
          left: `${spotlightRect.left}px`,
          width: `${spotlightRect.width}px`,
          height: `${spotlightRect.height}px`,
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`guided-tour-tooltip ${transitioning ? 'guided-tour-tooltip-exit' : 'guided-tour-tooltip-enter'}`}
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div
          className={`guided-tour-arrow ${arrowDirection === 'up' ? 'guided-tour-arrow-up' : 'guided-tour-arrow-down'}`}
          style={arrowStyle}
        />

        {/* Step counter */}
        <div className="guided-tour-counter">
          {currentStep + 1} / {TOUR_STEPS.length}
        </div>

        <h3 className="guided-tour-title">{step.title}</h3>
        <p className="guided-tour-desc">{step.description}</p>

        <div className="guided-tour-actions">
          <button
            onClick={completeTour}
            className="guided-tour-skip"
            type="button"
          >
            Skip tour
          </button>
          <button
            onClick={goNext}
            className="guided-tour-next"
            type="button"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="guided-tour-dots">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`guided-tour-dot ${i === currentStep ? 'guided-tour-dot-active' : ''} ${i < currentStep ? 'guided-tour-dot-done' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
