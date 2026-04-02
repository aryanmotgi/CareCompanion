import { Skeleton } from '../Skeleton'

export function SettingsSkeleton() {
  return (
    <div className="px-5 py-6">
      <Skeleton className="h-7 w-24 mb-6 rounded-lg" />
      {[0, 1, 2, 3].map((section) => (
        <div key={section} className="mb-6">
          <Skeleton className="h-3 w-28 mb-2 rounded-lg" />
          <Skeleton className="h-48 w-full" />
        </div>
      ))}
    </div>
  )
}
