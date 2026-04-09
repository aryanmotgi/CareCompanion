import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionStatus } from '@/components/ConnectionStatus'

describe('ConnectionStatus', () => {
  it('renders source name correctly (1uphealth -> "1upHealth")', () => {
    render(<ConnectionStatus source="1uphealth" />)
    expect(screen.getByText('1upHealth Connected')).toBeInTheDocument()
  })

  it('passes through other source names as-is', () => {
    render(<ConnectionStatus source="epic" />)
    expect(screen.getByText('epic Connected')).toBeInTheDocument()
  })

  it('shows last synced time when provided', () => {
    render(<ConnectionStatus source="1uphealth" lastSynced="2026-04-08T14:30:00Z" />)
    expect(screen.getByText(/Last synced/)).toBeInTheDocument()
  })

  it('handles null lastSynced gracefully', () => {
    render(<ConnectionStatus source="1uphealth" lastSynced={null} />)
    expect(screen.getByText('1upHealth Connected')).toBeInTheDocument()
    expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument()
  })

  it('handles undefined lastSynced gracefully', () => {
    render(<ConnectionStatus source="1uphealth" />)
    expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument()
  })
})
