import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfoTooltip } from '@/components/InfoTooltip'

describe('InfoTooltip', () => {
  beforeEach(() => {
    // Ensure DOM is clean
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a button with aria-label "Info"', () => {
    render(<InfoTooltip content="Test content" />)

    const button = screen.getByRole('button', { name: 'Info' })
    expect(button).toBeDefined()
    expect(button.textContent).toBe('?')
  })

  it('popover is NOT shown initially', () => {
    render(<InfoTooltip content="Test content" />)

    expect(screen.queryByText('Test content')).toBeNull()
  })

  it('click shows popover with content text', async () => {
    render(<InfoTooltip content="Test content" />)

    const button = screen.getByRole('button', { name: 'Info' })
    fireEvent.click(button)

    expect(screen.getByText('Test content')).toBeDefined()
  })

  it('click again hides popover', async () => {
    render(<InfoTooltip content="Test content" />)

    const button = screen.getByRole('button', { name: 'Info' })

    // Open
    fireEvent.click(button)
    expect(screen.getByText('Test content')).toBeDefined()

    // Close
    fireEvent.click(button)
    expect(screen.queryByText('Test content')).toBeNull()
  })

  it('content with [patient name] is replaced when patientName prop provided', async () => {
    render(<InfoTooltip content="Update [patient name]'s profile" patientName="Sarah" />)

    const button = screen.getByRole('button', { name: 'Info' })
    fireEvent.click(button)

    expect(screen.getByText("Update Sarah's profile")).toBeDefined()
    expect(screen.queryByText("Update [patient name]'s profile")).toBeNull()
  })

  it('click outside (mousedown on document) closes popover', async () => {
    render(<InfoTooltip content="Test content" />)

    const button = screen.getByRole('button', { name: 'Info' })

    // Open
    fireEvent.click(button)
    expect(screen.getByText('Test content')).toBeDefined()

    // Click outside (on document body)
    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('Test content')).toBeNull()
  })
})
