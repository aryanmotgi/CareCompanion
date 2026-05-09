'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface ExpandableCardProps {
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  expandedContent: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ExpandableCard({
  expanded,
  onToggle,
  children,
  expandedContent,
  className = '',
  style,
}: ExpandableCardProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  const recalcHeight = useCallback(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [])

  // Recalculate on expand/content change
  useEffect(() => {
    if (expanded) {
      // Small delay to let children render
      requestAnimationFrame(recalcHeight)
    }
  }, [expanded, expandedContent, recalcHeight])

  // Watch for internal content changes (tab switches, async content)
  useEffect(() => {
    if (!expanded || !contentRef.current) return
    const ro = new ResizeObserver(recalcHeight)
    ro.observe(contentRef.current)
    const mo = new MutationObserver(() => requestAnimationFrame(recalcHeight))
    mo.observe(contentRef.current, { childList: true, subtree: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [expanded, recalcHeight])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={`
        bg-white/[0.04] rounded-xl p-4 cursor-pointer
        border border-white/[0.06]
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0E1A]
        ${className}
      `}
      style={{ WebkitTapHighlightColor: 'transparent', ...style }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        <svg
          className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${expanded ? 'rotate-180 text-[#A78BFA]' : 'text-[var(--text-muted)]'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      <div
        style={{
          maxHeight: expanded ? `${height + 32}px` : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}
      >
        <div ref={contentRef}>
          <div
            className="mt-3 pt-3 border-t border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedContent}
          </div>
        </div>
      </div>
    </div>
  )
}
