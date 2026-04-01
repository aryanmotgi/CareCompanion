'use client'

interface SkeletonCardProps {
  variant?: 'default' | 'wide' | 'compact'
}

export function SkeletonCard({ variant = 'default' }: SkeletonCardProps) {
  const heights = {
    default: 'h-[88px]',
    wide: 'h-[120px]',
    compact: 'h-[64px]',
  }

  return (
    <div className={`rounded-xl bg-[#1e293b] ${heights[variant]} p-4 overflow-hidden relative`}>
      <div className="space-y-3">
        <div className="h-2.5 w-24 rounded-full bg-white/[0.04] animate-shimmer" />
        <div className="h-4 w-48 rounded-full bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.1s' }} />
        <div className="h-2.5 w-32 rounded-full bg-white/[0.04] animate-shimmer" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  )
}

export function SkeletonFeed() {
  return (
    <div className="space-y-3 px-5 py-4">
      <SkeletonCard />
      <SkeletonCard variant="compact" />
      <SkeletonCard />
      <SkeletonCard variant="compact" />
    </div>
  )
}
