import { Skeleton } from '../Skeleton'

export function DashboardSkeleton() {
  return (
    <div className="px-5 py-6">
      <Skeleton className="h-4 w-32 mb-2 rounded-lg" />
      <Skeleton className="h-7 w-64 mb-5 rounded-lg" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
