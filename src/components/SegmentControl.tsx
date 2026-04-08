'use client'

import { useRef, useState, useEffect } from 'react'

interface SegmentControlProps {
  segments: string[]
  activeIndex: number
  onChange: (index: number) => void
}

export function SegmentControl({ segments, activeIndex, onChange }: SegmentControlProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const buttons = containerRef.current.querySelectorAll('button')
    const active = buttons[activeIndex]
    if (active) {
      setPillStyle({
        left: active.offsetLeft,
        width: active.offsetWidth,
      })
    }
  }, [activeIndex])

  return (
    <div ref={containerRef} className="relative flex bg-[var(--bg-warm)] rounded-[14px] p-[3px] border border-[var(--border)]">
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-[11px] bg-gradient-to-r from-[#6366F1] to-[#A78BFA] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />
      {segments.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`relative z-10 flex-1 text-center py-2 px-4 rounded-[11px] text-[13px] font-semibold transition-colors duration-200 ${
            i === activeIndex ? 'text-white' : 'text-[var(--text-muted)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
