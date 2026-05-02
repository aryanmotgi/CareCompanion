'use client'

import Link from 'next/link'
import { ExpandableCard } from './ExpandableCard'

interface PriorityCardProps {
  variant: 'urgent' | 'upcoming' | 'alert' | 'quick-ask'
  label: string
  title: string
  subtitle: string
  action?: string
  href?: string
  index: number
  expanded?: boolean
  onToggle?: () => void
  expandedContent?: React.ReactNode
  isPriority?: boolean
}

const VARIANT_STYLES = {
  urgent: {
    bg: 'bg-[rgba(239,68,68,0.08)]',
    border: 'border-[rgba(239,68,68,0.2)]',
    dot: 'bg-[#ef4444]',
    label: 'text-[#ef4444]',
    dotPulse: true,
  },
  upcoming: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.06]',
    dot: 'bg-[#818CF8]',
    label: 'text-[#818CF8]',
    dotPulse: false,
  },
  alert: {
    bg: 'bg-[rgba(251,191,36,0.08)]',
    border: 'border-[rgba(251,191,36,0.2)]',
    dot: 'bg-[#fbbf24]',
    label: 'text-[#fbbf24]',
    dotPulse: false,
  },
  'quick-ask': {
    bg: 'bg-white/[0.03]',
    border: 'border-white/[0.08]',
    dot: 'bg-indigo-500',
    label: 'text-indigo-400',
    dotPulse: false,
  },
}

export function PriorityCard({
  variant,
  label,
  title,
  subtitle,
  action,
  href,
  index,
  expanded = false,
  onToggle,
  expandedContent,
  isPriority = false,
}: PriorityCardProps) {
  const s = VARIANT_STYLES[variant]
  const isUrgent = variant === 'urgent'
  const animStyle = {
    animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both${isUrgent ? ', glow-pulse 2s ease-in-out infinite' : ''}`,
    animationDelay: `${index * 60}ms`,
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${s.dot} ${s.dotPulse ? 'animate-dot-pulse' : ''}`} />
        <span className={`text-xs font-semibold ${s.label}`}>{label}</span>
        {isPriority && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/20">
            Priority
          </span>
        )}
      </div>
      <div className="text-[var(--text)] text-sm font-semibold">{title}</div>
      <div className="text-[var(--text-secondary)] text-xs">{subtitle}</div>
    </>
  )

  // Quick-ask cards use Link, not expandable
  if (href && variant === 'quick-ask') {
    return (
      <Link href={href}>
        <div
          className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press shimmer-btn card-hover-glow`}
          style={animStyle}
        >
          {content}
          {action && <div className="text-indigo-400 text-xs font-medium mt-2">{action} →</div>}
        </div>
      </Link>
    )
  }

  // Expandable cards — urgent gets spinning gradient border
  if (expandedContent && onToggle) {
    return (
      <div className={isUrgent ? 'gradient-border-spin' : ''}>
        <ExpandableCard
          expanded={expanded}
          onToggle={onToggle}
          expandedContent={expandedContent}
          className={`${s.bg} animate-press card-hover-glow`}
          style={animStyle}
        >
          {content}
          <div className="flex items-center justify-end mt-2 pt-1 gap-1">
            <span className="text-[10px] text-[var(--text-muted)]">
              {expanded ? 'Less' : 'Action steps'}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </ExpandableCard>
      </div>
    )
  }

  // Fallback: non-expandable card
  return (
    <div className={isUrgent ? 'gradient-border-spin' : ''}>
      <div
        className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press card-hover-glow`}
        style={animStyle}
      >
        {content}
      </div>
    </div>
  )
}
