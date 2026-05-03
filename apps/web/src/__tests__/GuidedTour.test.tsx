import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

// Mock createPortal to render inline for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom')
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  }
})

import GuidedTour, { type TourStep } from '@/components/GuidedTour'

const DEFAULT_STEPS: TourStep[] = [
  { target: 'tab-chat', title: 'Chat Tab', body: 'Talk to your AI assistant here.' },
  { target: 'tab-care', title: 'Care Tab', body: 'Manage care for [patient name] here.' },
  { target: 'emergency-card', title: 'Emergency', body: 'Emergency info for [patient name].' },
]

// In-memory localStorage mock that works regardless of jsdom flags
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: false })

function setup(lsOverrides: Record<string, string> = {}) {
  localStorageMock.clear()
  for (const [k, v] of Object.entries(lsOverrides)) {
    localStorageMock.setItem(k, v)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorageMock.clear()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.style.overflow = ''
})

describe('GuidedTour', () => {
  it('returns null when onboarding_just_completed is absent', () => {
    setup()
    const { container } = render(
      <GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when tour_completed is already set (even if onboarding_just_completed is present)', () => {
    setup({ onboarding_just_completed: '1', tour_completed: '1' })
    const { container } = render(
      <GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('sets tour_completed on mount when tour will show', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)
    expect(localStorage.getItem('tour_completed')).toBe('1')
  })

  it('removes onboarding_just_completed on mount', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)
    expect(localStorage.getItem('onboarding_just_completed')).toBeNull()
  })

  it('shows the first step body text when triggered', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)
    expect(screen.getByTestId('tour-body').textContent).toBe(
      'Talk to your AI assistant here.'
    )
  })

  it('replaces [patient name] with patientName prop', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Bob" />)

    // Advance to step 2 (has [patient name])
    fireEvent.click(screen.getByTestId('tour-next'))
    act(() => vi.advanceTimersByTime(250))

    expect(screen.getByTestId('tour-body').textContent).toBe(
      'Manage care for Bob here.'
    )
    expect(screen.getByTestId('tour-body').textContent).not.toContain('[patient name]')
  })

  it('advances step on "Got it →" click', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)

    // Should start on step 1 text
    expect(screen.getByTestId('tour-body').textContent).toBe(
      'Talk to your AI assistant here.'
    )

    // Click next
    fireEvent.click(screen.getByTestId('tour-next'))
    act(() => vi.advanceTimersByTime(250))

    // Should now show step 2 text
    expect(screen.getByTestId('tour-body').textContent).toBe(
      'Manage care for Alice here.'
    )
  })

  it('closes on "Skip" click', () => {
    setup({ onboarding_just_completed: '1' })
    const { container } = render(
      <GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />
    )

    // Tour is visible
    expect(screen.getByTestId('tour-card')).toBeDefined()

    // Click Skip
    fireEvent.click(screen.getByTestId('tour-skip'))
    act(() => vi.advanceTimersByTime(250))

    // Tour should be gone
    expect(container.firstChild).toBeNull()
  })

  it('closes on overlay click', () => {
    setup({ onboarding_just_completed: '1' })
    const { container } = render(
      <GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />
    )

    fireEvent.click(screen.getByTestId('tour-overlay'))
    act(() => vi.advanceTimersByTime(250))

    expect(container.firstChild).toBeNull()
  })

  it('shows "Done ✓" on the last step', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)

    // Advance through all steps
    fireEvent.click(screen.getByTestId('tour-next'))
    act(() => vi.advanceTimersByTime(250))
    fireEvent.click(screen.getByTestId('tour-next'))
    act(() => vi.advanceTimersByTime(250))

    expect(screen.getByTestId('tour-next').textContent).toBe('Done ✓')
  })

  it('locks body scroll while tour is active and restores on close', () => {
    setup({ onboarding_just_completed: '1' })
    render(<GuidedTour steps={DEFAULT_STEPS} patientName="Alice" />)

    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByTestId('tour-skip'))
    act(() => vi.advanceTimersByTime(250))

    expect(document.body.style.overflow).toBe('')
  })
})
