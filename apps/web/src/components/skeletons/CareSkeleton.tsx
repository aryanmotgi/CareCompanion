import { Skeleton } from '../Skeleton'

export function CareSkeleton() {
  return (
    <div className="px-4 sm:px-5 py-5 space-y-5">
      {/* TreatmentCycleTracker */}
      <Skeleton className="h-20 w-full rounded-2xl" />

      {/* Segment control */}
      <Skeleton className="h-10 w-full rounded-[10px]" />

      {/* Section label */}
      <Skeleton className="h-3 w-28 rounded-lg" />

      {/* Med/appt cards */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>

      {/* Add button */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* AdherenceCalendar */}
      <Skeleton className="h-40 w-full rounded-2xl" />

      {/* ComplianceReport */}
      <Skeleton className="h-28 w-full rounded-2xl" />

      {/* CaregiverBurnoutCard */}
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
