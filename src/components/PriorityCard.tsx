'use client'

import Link from 'next/link'

type CardVariant = 'urgent' | 'upcoming' | 'alert' | 'quick-ask'

interface PriorityCardProps {
  variant: CardVariant
  title: string
  subtitle?: string
  action?: string
  href?: string
  index?: number
}

const VARIANT_STYLES: Record<CardVariant, { bg: string; border: string; dotColor: string; labelColor: string; label: string }> = {
  urgent: {
    bg: 'bg-gradient-to-br from-red-500/[0.12] to-red-500/[0.04]',
    border: 'border-red-500/20',
    dotColor: 'bg-[#ef4444]',
    labelColor: 'text-[#fca5a5]',
    label: 'NEEDS ATTENTION',
  },
  upcoming: {
    bg: 'bg-[#1e293b]',
    border: 'border-white/[0.06]',
    dotColor: 'bg-[#38bdf8]',
    labelColor: 'text-[#38bdf8]',
    label: 'UPCOMING',
  },
  alert: {
    bg: 'bg-[#1e293b]',
    border: 'border-white/[0.06]',
    dotColor: 'bg-[#f59e0b]',
    labelColor: 'text-[#fbbf24]',
    label: 'ALERT',
  },
  'quick-ask': {
    bg: 'bg-gradient-to-br from-indigo-500/[0.1] to-cyan-400/[0.06]',
    border: 'border-indigo-500/20',
    dotColor: 'bg-[#818cf8]',
    labelColor: 'text-[#a5b4fc]',
    label: 'QUICK ASK',
  },
}

export function PriorityCard({ variant, title, subtitle, action, href, index = 0 }: PriorityCardProps) {
  const s = VARIANT_STYLES[variant]
  const isUrgent = variant === 'urgent'

  const card = (
    <div
      className={`${s.bg} border ${s.border} rounded-xl p-3.5 gradient-border-card card-hover-lift animate-press`}
      style={{ animation: `card-stagger-in 0.4s cubic-bezier(0.4,0,0.2,1) ${index * 100}ms both${isUrgent ? ', glow-pulse 2s ease-in-out infinite' : ''}` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
        <span className={`${s.labelColor} text-[10px] font-semibold tracking-wider`}>{s.label}</span>
      </div>
      <div className="text-[#f1f5f9] text-[13px] font-semibold">{title}</div>
      {subtitle && <div className="text-[#94a3b8] text-[11px] mt-0.5">{subtitle}</div>}
      {action && <div className="text-[#94a3b8] text-[11px] mt-1">{action} →</div>}
    </div>
  )

  if (href) return <Link href={href} className="block mb-2.5">{card}</Link>
  return <div className="mb-2.5">{card}</div>
}
