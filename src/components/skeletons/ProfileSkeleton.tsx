import { Skeleton } from '../Skeleton'

export function ProfileSkeleton() {
  return (
    <div className="px-5 py-6">
      <div className="text-center mb-6">
        <Skeleton className="w-16 h-16 rounded-full mx-auto mb-3" />
        <Skeleton className="h-6 w-40 mx-auto mb-1 rounded-lg" />
        <Skeleton className="h-4 w-24 mx-auto rounded-lg" />
      </div>
      <Skeleton className="h-3 w-20 mb-2 rounded-lg" />
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-28 mb-2 rounded-lg" />
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-3 w-20 mb-2 rounded-lg" />
      <Skeleton className="h-32 w-full mb-6" />
    </div>
  )
}
