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
    <div ref={containerRef} className="relative flex bg-[#1e293b] rounded-[10px] p-[3px]">
      <div
        className="absolute top-[3px] h-[calc(100%-6px)] rounded-lg bg-[#38bdf8] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />
      {segments.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`relative z-10 flex-1 text-center py-2 px-4 rounded-lg text-[13px] font-semibold transition-colors duration-200 ${
            i === activeIndex ? 'text-[#0f172a]' : 'text-[#64748b]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
