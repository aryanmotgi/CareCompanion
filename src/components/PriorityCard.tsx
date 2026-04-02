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
}

const VARIANT_STYLES = {
  urgent: {
    bg: 'bg-[rgba(239,68,68,0.08)]',
    border: 'border-[rgba(239,68,68,0.2)]',
    dot: 'bg-[#ef4444]',
    label: 'text-[#ef4444]',
  },
  upcoming: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.06]',
    dot: 'bg-[#22d3ee]',
    label: 'text-[#22d3ee]',
  },
  alert: {
    bg: 'bg-[rgba(251,191,36,0.08)]',
    border: 'border-[rgba(251,191,36,0.2)]',
    dot: 'bg-[#fbbf24]',
    label: 'text-[#fbbf24]',
  },
  'quick-ask': {
    bg: 'bg-gradient-to-br from-indigo-500/10 to-cyan-400/10',
    border: 'border-indigo-500/20',
    dot: 'bg-indigo-500',
    label: 'text-indigo-400',
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
}: PriorityCardProps) {
  const s = VARIANT_STYLES[variant]
  const animStyle = {
    animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) both${variant === 'urgent' ? ', glow-pulse 2s ease-in-out infinite' : ''}`,
    animationDelay: `${index * 60}ms`,
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className={`text-xs font-semibold ${s.label}`}>{label}</span>
      </div>
      <div className="text-[#f1f5f9] text-sm font-semibold">{title}</div>
      <div className="text-[#94a3b8] text-xs">{subtitle}</div>
    </>
  )

  // Quick-ask cards use Link, not expandable
  if (href && variant === 'quick-ask') {
    return (
      <Link href={href}>
        <div
          className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press`}
          style={animStyle}
        >
          {content}
          {action && <div className="text-indigo-400 text-xs font-medium mt-2">{action} →</div>}
        </div>
      </Link>
    )
  }

  // Expandable cards
  if (expandedContent && onToggle) {
    return (
      <ExpandableCard
        expanded={expanded}
        onToggle={onToggle}
        expandedContent={expandedContent}
        className={`${s.bg} ${expanded ? '' : `border-${s.border.replace('border-', '')}`} animate-press`}
        style={animStyle}
      >
        {content}
      </ExpandableCard>
    )
  }

  // Fallback: non-expandable card
  return (
    <div
      className={`${s.bg} border ${s.border} rounded-xl p-4 animate-press`}
      style={animStyle}
    >
      {content}
    </div>
  )
}
