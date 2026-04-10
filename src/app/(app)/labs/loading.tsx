import { Skeleton } from '@/components/Skeleton'

export default function LabsLoading() {
  return (
    <div className="px-5 py-4 space-y-5">
      <Skeleton className="h-7 w-32" />
      {/* Chart area */}
      <Skeleton className="h-44 rounded-xl" />
      {/* Lab result cards */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04]">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
