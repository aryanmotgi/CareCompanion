'use client'

import { useState, useRef } from 'react'

export function BugReportButton() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleOpen() {
    setOpen(true)
    setSubmitted(false)
    setDescription('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleClose() {
    setOpen(false)
    setDescription('')
    setSubmitted(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || submitting) return

    setSubmitting(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          pageUrl: window.location.href,
          deviceInfo: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      })
      setSubmitted(true)
      setTimeout(() => handleClose(), 2000)
    } catch {
      // Best-effort — still show success to not alarm the user
      setSubmitted(true)
      setTimeout(() => handleClose(), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={handleOpen}
        aria-label="Report a bug"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          zIndex: 9998,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#7c3aed',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#6d28d9')}
        onMouseLeave={e => (e.currentTarget.style.background = '#7c3aed')}
      >
        {/* Bug icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2l1.5 1.5" />
          <path d="M14.5 3.5L16 2" />
          <path d="M9 9H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1" />
          <path d="M15 9h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
          <path d="M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0z" />
          <line x1="12" y1="13" x2="12" y2="17" />
          <line x1="12" y1="9" x2="12" y2="10" />
          <path d="M5 7l2.5 2.5" />
          <path d="M19 7l-2.5 2.5" />
          <path d="M5 19l2.5-2.5" />
          <path d="M19 19l-2.5-2.5" />
        </svg>
      </button>

      {/* Popup form */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 134,
            right: 20,
            zIndex: 9999,
            width: 320,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: 16,
          }}
          role="dialog"
          aria-label="Report a bug"
        >
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#16a34a', fontWeight: 500 }}>
              Bug reported! Thanks.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 14, color: '#111' }}>
                Report a bug
              </div>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what went wrong…"
                rows={4}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 10,
                  color: '#111',
                }}
                required
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: '1px solid #e2e8f0',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#555',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: submitting || !description.trim() ? '#c4b5fd' : '#7c3aed',
                    color: 'white',
                    cursor: submitting || !description.trim() ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}
