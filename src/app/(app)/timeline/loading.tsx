import { Skeleton } from '@/components/Skeleton'

export default function TimelineLoading() {
  return (
    <div className="px-5 py-4 space-y-5">
      <Skeleton className="h-7 w-40" />
      <div className="relative pl-8 space-y-6">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-white/[0.06]" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-8 top-1">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <div className="p-4 rounded-xl border border-white/[0.04] space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
