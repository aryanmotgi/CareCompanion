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
      setHeight(contentRef.current.scrollHeight)
    }
  }, [expanded, expandedContent])

  return (
    <div
      onClick={onToggle}
      className={`
        bg-white/[0.04] border rounded-xl p-4 cursor-pointer
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${expanded ? 'border-[rgba(34,211,238,0.2)]' : 'border-white/[0.06]'}
        ${className}
      `}
      style={style}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        <span className={`text-lg transition-transform duration-300 ${expanded ? 'rotate-90 text-[#22d3ee]' : 'text-[#64748b]'}`}>
          ▸
        </span>
      </div>

      <div
        style={{
          maxHeight: expanded ? `${height}px` : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
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
