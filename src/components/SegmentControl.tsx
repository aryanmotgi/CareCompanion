'use client'

interface SegmentControlProps {
  segments: string[]
  activeIndex: number
  onChange: (index: number) => void
}

export function SegmentControl({ segments, activeIndex, onChange }: SegmentControlProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {segments.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition-colors font-medium flex-shrink-0 ${
            i === activeIndex
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)] bg-white/[0.04] border border-white/[0.08]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
