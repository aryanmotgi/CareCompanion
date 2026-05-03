import { Skeleton } from '../Skeleton'

export function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      {/* Morning summary card */}
      <Skeleton className="h-14 w-full mb-4 rounded-xl" />
      {/* Greeting */}
      <Skeleton className="h-3 w-24 mb-2 rounded" />
      {/* Action count heading */}
      <Skeleton className="h-7 w-52 mb-4 rounded-lg" />
      {/* Cancer type badge */}
      <div className="flex gap-2 mb-5">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      {/* Priority cards */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>
      {/* Quick-ask chips */}
      <div className="flex gap-2 mt-6 flex-wrap">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      {/* Care Timeline shortcut */}
      <Skeleton className="h-16 w-full mt-4 rounded-2xl" />
      {/* Check-in card */}
      <Skeleton className="h-16 w-full mt-4 rounded-2xl" />
    </div>
  )
}
