import { differenceInCalendarDays, parseISO } from 'date-fns'

export function formatRefillCountdown(refillDate: string | null): string {
  if (!refillDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = parseISO(refillDate)
  date.setHours(0, 0, 0, 0)
  const diff = differenceInCalendarDays(date, today)

  if (diff === 0) return 'Refill due today'
  if (diff === 1) return 'Refill in 1 day'
  if (diff > 1) return `Refill in ${diff} days`
  if (diff === -1) return 'Refill overdue by 1 day'
  return `Refill overdue by ${Math.abs(diff)} days`
}

export function formatAppointmentDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function daysSince(isoDate: string): number {
  return differenceInCalendarDays(new Date(), parseISO(isoDate))
}
