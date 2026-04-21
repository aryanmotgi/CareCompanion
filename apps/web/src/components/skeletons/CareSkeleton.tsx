import { Skeleton } from '../Skeleton'

export function CareSkeleton() {
  return (
    <div className="px-5 py-6">
      <Skeleton className="h-10 w-full mb-5 rounded-[10px]" />
      <Skeleton className="h-3 w-28 mb-2 rounded-lg" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-full mt-5" />
    </div>
  )
}
