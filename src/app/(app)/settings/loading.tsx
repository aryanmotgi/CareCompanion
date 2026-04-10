import { Skeleton } from '@/components/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="px-5 py-4 space-y-5">
      <Skeleton className="h-7 w-24" />
      {[...Array(4)].map((_, s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-3 w-28 mt-4" />
          <div className="rounded-xl border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-2.5 w-48" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
