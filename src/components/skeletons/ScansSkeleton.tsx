import { Skeleton } from '../Skeleton'

export function ScansSkeleton() {
  return (
    <div className="px-5 py-6">
      <Skeleton className="h-7 w-32 mb-1 rounded-lg" />
      <Skeleton className="h-4 w-56 mb-5 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-3 w-24 mb-3 rounded-lg" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-full mt-6" />
    </div>
  )
}
