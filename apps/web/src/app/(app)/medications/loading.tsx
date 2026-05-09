import { Skeleton } from '@/components/Skeleton'

export default function MedicationsLoading() {
  return (
    <div className="px-5 py-4 space-y-5">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-14 rounded-xl" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.04]">
            <div className="h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
