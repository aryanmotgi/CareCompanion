import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SectionEmptyState } from '@/components/SectionEmptyState'

const mockIcon = <div data-testid="mock-icon">Icon</div>

describe('SectionEmptyState', () => {
  it('renders heading and body text', () => {
    render(<SectionEmptyState icon={mockIcon} heading="Test Heading" body="Test Body" />)

    expect(screen.getByText('Test Heading')).toBeDefined()
    expect(screen.getByText('Test Body')).toBeDefined()
  })

  it('replaces [patient name] in body with patientName prop', () => {
    render(
      <SectionEmptyState
        icon={mockIcon}
        heading="Test Heading"
        body="No data for [patient name] yet"
        patientName="John"
      />
    )

    expect(screen.getByText('No data for John yet')).toBeDefined()
  })

  it('replaces [patient name] in heading with patientName prop', () => {
    render(
      <SectionEmptyState
        icon={mockIcon}
        heading="[patient name]'s Health"
        body="Test Body"
        patientName="Sarah"
      />
    )

    expect(screen.getByText("Sarah's Health")).toBeDefined()
  })

  it('renders action button when onAction provided', async () => {
    const handleAction = vi.fn()
    render(
      <SectionEmptyState
        icon={mockIcon}
        heading="Test Heading"
        body="Test Body"
        actionLabel="Click Me"
        onAction={handleAction}
      />
    )

    const button = screen.getByRole('button', { name: 'Click Me' })
    expect(button).toBeDefined()

    await userEvent.click(button)
    expect(handleAction).toHaveBeenCalledOnce()
  })

  it('does NOT render action when neither onAction nor actionHref provided', () => {
    render(
      <SectionEmptyState icon={mockIcon} heading="Test Heading" body="Test Body" actionLabel="Click Me" />
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders <a> link when actionHref provided (not a button)', () => {
    render(
      <SectionEmptyState
        icon={mockIcon}
        heading="Test Heading"
        body="Test Body"
        actionLabel="Go to Link"
        actionHref="/test-path"
      />
    )

    const link = screen.getByRole('link', { name: 'Go to Link' })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/test-path')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
