'use client'

import { useState, useEffect, useCallback } from 'react'

interface Conversation {
  id: string
  title: string | null
  lastMessagePreview: string | null
  updatedAt: string | null
  messageCount: number
}

interface ChatHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChatHistoryPanel({ isOpen, onClose }: ChatHistoryPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) throw new Error(`Failed to load history (${res.status})`)
      const json = await res.json()
      // apiSuccess wraps response as { ok: true, data: [...] }
      setConversations(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
      fetchConversations()
    } else {
      setVisible(false)
    }
  }, [isOpen, fetchConversations])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Chat history"
        aria-modal="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: 'linear-gradient(180deg, #13111f 0%, #0f0e1a 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>Chat History</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat history"
            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="hover:bg-white/[0.1] transition-colors"
          >
            <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ borderRadius: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ height: 12, width: '65%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 8 }} />
                  <div style={{ height: 10, width: '45%', borderRadius: 4, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.8)', marginBottom: 12 }}>{error}</p>
              <button
                onClick={fetchConversations}
                style={{ fontSize: 12, color: 'rgba(167,139,250,0.8)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && conversations.length === 0 && (
            <div style={{ padding: '32px 8px', textAlign: 'center' }}>
              <svg width="32" height="32" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 10px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>No past conversations yet</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>Start a new chat and it will appear here</p>
            </div>
          )}

          {!loading && !error && conversations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  style={{
                    borderRadius: 12,
                    padding: '11px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'default',
                  }}
                  className="hover:bg-white/[0.06] hover:border-white/[0.08] transition-colors"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', lineHeight: 1.35, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {convo.title ?? 'Conversation'}
                    </p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: 1 }}>{formatDate(convo.updatedAt)}</span>
                  </div>
                  {convo.lastMessagePreview && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {convo.lastMessagePreview}
                    </p>
                  )}
                  {convo.messageCount > 0 && (
                    <p style={{ fontSize: 10, color: 'rgba(167,139,250,0.4)', marginTop: 5 }}>
                      {convo.messageCount} message{convo.messageCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
