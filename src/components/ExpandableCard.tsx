'use client'

import { useRef, useEffect, useState } from 'react'

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

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight + 8)
    }
  }, [expanded, expandedContent])

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
        ${className}
      `}
      style={{ outline: 'none', boxShadow: 'none', WebkitTapHighlightColor: 'transparent', ...style }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        <span className={`text-lg transition-transform duration-300 ${expanded ? 'rotate-90 text-[#94a3b8]' : 'text-[#64748b]'}`} aria-hidden="true">
          ▸
        </span>
      </div>

      <div
        style={{
          maxHeight: expanded ? `${height}px` : '0px',
          opacity: expanded ? 1 : 0,
          overflow: expanded ? 'visible' : 'hidden',
          transition: 'max-height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
        }}
      >
        <div ref={contentRef}>
          <div
            className="mt-3 pt-3 border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedContent}
          </div>
        </div>
      </div>
    </div>
  )
}
