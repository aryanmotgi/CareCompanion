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
    <div className={`rounded-xl bg-white/[0.02] border border-white/[0.04] ${heights[variant]} p-4 overflow-hidden relative`}>
      <div className="space-y-3">
        <div className="h-2.5 w-20 skeleton-bone" style={{ animationDelay: '0s' }} />
        <div className="h-4 w-48 skeleton-bone" style={{ animationDelay: '0.15s' }} />
        {variant !== 'compact' && (
          <div className="h-2.5 w-32 skeleton-bone" style={{ animationDelay: '0.3s' }} />
        )}
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
