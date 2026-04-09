import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataConsentModal } from '@/components/DataConsentModal'

describe('DataConsentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConsent: vi.fn(),
  }

  it('renders when isOpen=true', () => {
    render(<DataConsentModal {...defaultProps} />)
    expect(screen.getByText('Health Data Access')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', () => {
    render(<DataConsentModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Health Data Access')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<DataConsentModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onConsent when "I Agree" button is clicked', () => {
    const onConsent = vi.fn()
    render(<DataConsentModal {...defaultProps} onConsent={onConsent} />)
    // The button text includes an mdash, use a regex
    const agreeBtn = screen.getByRole('button', { name: /I Agree/i })
    fireEvent.click(agreeBtn)
    expect(onConsent).toHaveBeenCalledOnce()
  })

  it('shows all 8 data types', () => {
    render(<DataConsentModal {...defaultProps} />)
    const dataTypes = ['Medications', 'Lab results', 'Conditions', 'Allergies', 'Appointments', 'Doctors', 'Claims', 'Insurance']
    for (const dt of dataTypes) {
      expect(screen.getByText(dt)).toBeInTheDocument()
    }
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<DataConsentModal {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
