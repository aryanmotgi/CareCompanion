'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  type: 'medication' | 'appointment' | 'lab' | 'document' | 'journal'
  id: string
  title: string
  subtitle: string
  href: string
}

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  medication: '\ud83d\udc8a',
  appointment: '\ud83d\udcc5',
  lab: '\ud83d\udd2c',
  document: '\ud83d\udcc4',
  journal: '\ud83d\udcd3',
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  medication: 'Medications',
  appointment: 'Appointments',
  lab: 'Lab Results',
  document: 'Documents',
  journal: 'Journal',
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const openSearch = useCallback(() => {
    setOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(-1)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          closeSearch()
        } else {
          openSearch()
        }
      }
      if (e.key === 'Escape' && open) {
        closeSearch()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, openSearch, closeSearch])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function handleResultClick(result: SearchResult) {
    closeSearch()
    router.push(result.href)
  }

  function handleKeyNav(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault()
      handleResultClick(results[activeIndex])
    }
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  // Flat index mapping for keyboard navigation
  let flatIndex = -1

  return (
    <>
      {/* Search trigger button */}
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search (Cmd+K)"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* Search modal */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
          role="dialog"
          aria-modal="true"
          aria-label="Search health data"
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={closeSearch}
          />

          {/* Modal content */}
          <div
            style={{
              position: 'relative',
              maxWidth: 560,
              margin: '80px auto 0',
              padding: '0 16px',
            }}
          >
            <div
              style={{
                background: 'var(--bg-card, #1e1e2e)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
              }}
            >
              {/* Input area */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActiveIndex(-1) }}
                  onKeyDown={handleKeyNav}
                  placeholder="Search medications, appointments, labs, documents..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: 15,
                  }}
                />
                <kbd
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.06)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                  }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results area */}
              <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
                {/* Loading skeleton */}
                {loading && (
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!loading && query.length >= 2 && results.length === 0 && (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                )}

                {/* Default state */}
                {!loading && query.length < 2 && (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    Search medications, appointments, labs, documents...
                  </div>
                )}

                {/* Grouped results */}
                {!loading && Object.entries(grouped).map(([type, items]) => (
                  <div key={type}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        padding: '8px 16px 4px',
                      }}
                    >
                      {TYPE_LABELS[type as SearchResult['type']] || type}
                    </div>
                    {items.map(result => {
                      flatIndex++
                      const idx = flatIndex
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          onClick={() => handleResultClick(result)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            padding: '10px 16px',
                            background: idx === activeIndex ? 'rgba(255,255,255,0.06)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            {TYPE_ICONS[result.type]}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {result.title}
                            </div>
                            {result.subtitle && (
                              <div style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Footer */}
              {results.length > 0 && !loading && (
                <div
                  style={{
                    borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                  <span>
                    <kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>&uarr;</kbd>
                    {' '}
                    <kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>&darr;</kbd>
                    {' '}to navigate
                    {' \u00b7 '}
                    <kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>&crarr;</kbd>
                    {' '}to select
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pulse animation for skeleton */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
