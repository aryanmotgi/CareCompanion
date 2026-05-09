import { Skeleton } from '@/components/Skeleton'

export default function CareHubLoading() {
  return (
    <div className="px-4 sm:px-5 py-5 sm:py-6">
      {/* Status banner skeleton */}
      <div className="rounded-2xl bg-white/[0.04] p-4 mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1.5 rounded-lg" />
            <Skeleton className="h-3 w-48 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Symptom Radar skeleton */}
        <div className="rounded-xl bg-white/[0.04] p-4">
          <Skeleton className="h-3 w-24 mb-3 rounded-lg" />
          <div className="flex justify-between mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="w-11 h-11 rounded-full" />
                <Skeleton className="h-2 w-8 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
          </div>
        </div>

        {/* Meds skeleton */}
        <div className="rounded-xl bg-white/[0.04] p-4">
          <Skeleton className="h-3 w-24 mb-3 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {/* AI Insights skeleton (full width) */}
        <div className="rounded-xl bg-white/[0.04] p-4 md:col-span-2">
          <Skeleton className="h-3 w-20 mb-3 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>

        {/* Activity skeleton */}
        <div className="rounded-xl bg-white/[0.04] p-4">
          <Skeleton className="h-3 w-28 mb-3 rounded-lg" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-full mb-1 rounded" />
                  <Skeleton className="h-2 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming skeleton */}
        <div className="rounded-xl bg-white/[0.04] p-4">
          <Skeleton className="h-3 w-20 mb-3 rounded-lg" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-10 h-12 rounded flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-full mb-1 rounded" />
                  <Skeleton className="h-2 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
