'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface TourStep {
  target: string // data-tour value to spotlight
  title: string  // used internally
  body: string   // shown in card
}

interface GuidedTourProps {
  steps: TourStep[]
  patientName: string
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const CARD_MAX_WIDTH = 280

export default function GuidedTour({ steps, patientName }: GuidedTourProps) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<SpotlightRect>({ top: 0, left: 0, width: 0, height: 0 })
  const [mounted, setMounted] = useState(false)
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const justCompleted = localStorage.getItem('onboarding_just_completed')
    if (!justCompleted) return

    localStorage.removeItem('onboarding_just_completed')

    const alreadyDone = localStorage.getItem('tour_completed')
    if (alreadyDone) return

    // Set immediately so a page refresh never replays
    localStorage.setItem('tour_completed', '1')

    // Lock body scroll
    document.body.style.overflow = 'hidden'
    setActive(true)
    setStepIndex(0)
    setVisible(true)
  }, [mounted])

  // Update spotlight rect whenever the step changes
  useEffect(() => {
    if (!active) return
    const step = steps[stepIndex]
    if (!step) return

    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    } else {
      setRect({ top: 0, left: 0, width: 0, height: 0 })
    }
  }, [active, stepIndex, steps])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
      if (transitionRef.current) clearTimeout(transitionRef.current)
    }
  }, [])

  const close = useCallback(() => {
    clearTimeout(transitionRef.current ?? undefined)
    setVisible(false)
    transitionRef.current = setTimeout(() => {
      setActive(false)
      document.body.style.overflow = ''
    }, 250)
  }, [])

  const handleNext = useCallback(() => {
    const isLast = stepIndex === steps.length - 1
    if (isLast) {
      close()
      return
    }
    // Transition: fade out → advance → fade in
    clearTimeout(transitionRef.current ?? undefined)
    setVisible(false)
    transitionRef.current = setTimeout(() => {
      setStepIndex((i) => i + 1)
      setVisible(true)
    }, 250)
  }, [stepIndex, steps.length, close])

  const handleOverlayClick = useCallback(() => {
    close()
  }, [close])

  // Escape key closes the tour
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active, close])

  if (!mounted || !active) return null

  const step = steps[stepIndex]
  if (!step) return null

  const bodyText = step.body.replace(/\[patient name\]/gi, patientName)
  const isLast = stepIndex === steps.length - 1

  // Card positioning: try below spotlight first, then above
  const spotlightBottom = rect.top + rect.height + PADDING
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const cardEstimatedHeight = 140
  const placeBelow = spotlightBottom + cardEstimatedHeight < viewportHeight
  const cardTop = placeBelow
    ? spotlightBottom + 12
    : rect.top - PADDING - cardEstimatedHeight - 12

  const cardLeft = Math.max(
    16,
    Math.min(
      rect.left + rect.width / 2 - CARD_MAX_WIDTH / 2,
      (typeof window !== 'undefined' ? window.innerWidth : 400) - CARD_MAX_WIDTH - 16
    )
  )

  const spotlightStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
    zIndex: 9998,
    pointerEvents: 'none',
  }

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: cardTop,
    left: cardLeft,
    width: CARD_MAX_WIDTH,
    zIndex: 9999,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    opacity: visible ? 1 : 0,
    transition: 'opacity 250ms ease',
    pointerEvents: 'auto',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9997,
    cursor: 'pointer',
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null
  if (!portalTarget) return null

  return createPortal(
    <>
      {/* Clickable overlay to close */}
      <div
        style={overlayStyle}
        onClick={handleOverlayClick}
        aria-label="Close tour"
        role="button"
        tabIndex={-1}
        data-testid="tour-overlay"
      />

      {/* Spotlight cutout */}
      <div style={spotlightStyle} data-testid="tour-spotlight" />

      {/* Tour card */}
      <div style={cardStyle} role="dialog" aria-modal="true" aria-label={step.title} data-testid="tour-card">
        {/* Progress dots */}
        <div
          style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}
          aria-label={`Step ${stepIndex + 1} of ${steps.length}`}
        >
          {steps.map((step, i) => (
            <div
              key={step.target}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: i === stepIndex ? '#6366f1' : '#e2e8f0',
                transition: 'background-color 250ms ease',
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Body text */}
        <p
          style={{ fontSize: 14, lineHeight: 1.5, color: '#1e293b', margin: '0 0 16px' }}
          data-testid="tour-body"
        >
          {bodyText}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={close}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px 0',
            }}
            data-testid="tour-skip"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            style={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
            data-testid="tour-next"
          >
            {isLast ? 'Done ✓' : 'Got it →'}
          </button>
        </div>
      </div>
    </>,
    portalTarget
  )
}
