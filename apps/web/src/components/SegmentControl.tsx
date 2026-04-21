'use client'

interface SegmentControlProps {
  segments: string[]
  activeIndex: number
  onChange: (index: number) => void
}

export function SegmentControl({ segments, activeIndex, onChange }: SegmentControlProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide">
      {segments.map((label, i) => (
        <button
          key={label}
          onClick={() => onChange(i)}
          className={`px-4 py-2 text-sm rounded-xl whitespace-nowrap transition-all font-semibold flex-shrink-0 ${
            i === activeIndex
              ? 'bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white shadow-lg shadow-[#6366F1]/20'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.06]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
