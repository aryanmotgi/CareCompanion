/**
 * Daily adherence calendar data endpoint.
 * Returns per-day medication status for a given month.
 *
 * Query params:
 *   year  – 4-digit year  (default: current year)
 *   month – 1-12          (default: current month)
 */
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { reminderLogs } from '@/lib/db/schema'
import { and, eq, gte, lte, asc } from 'drizzle-orm'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

export interface CalendarDay {
  date: string // YYYY-MM-DD
  total: number
  taken: number
  missed: number
  snoozed: number
  medications: { name: string; status: 'taken' | 'missed' | 'snoozed' | 'pending' }[]
}

export interface CalendarData {
  year: number
  month: number
  days: CalendarDay[]
  streak: number
}

export async function GET(req: Request) {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    await logAudit({
      user_id: dbUser!.id,
      action: 'view_records',
      resource_type: 'compliance_calendar',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    const url = new URL(req.url)
    const now = new Date()
    const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()))
    const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1))

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const logs = await db
      .select()
      .from(reminderLogs)
      .where(
        and(
          eq(reminderLogs.userId, dbUser!.id),
          gte(reminderLogs.createdAt, startDate),
          lte(reminderLogs.createdAt, endDate),
        )
      )
      .orderBy(asc(reminderLogs.createdAt))

    // Group logs by day
    const dayMap = new Map<string, CalendarDay>()

    for (const log of logs) {
      const dateStr = log.createdAt!.toISOString().split('T')[0]

      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, {
          date: dateStr,
          total: 0,
          taken: 0,
          missed: 0,
          snoozed: 0,
          medications: [],
        })
      }

      const day = dayMap.get(dateStr)!
      day.total++

      switch (log.status) {
        case 'taken':
          day.taken++
          break
        case 'missed':
          day.missed++
          break
        case 'snoozed':
          day.snoozed++
          break
      }

      day.medications.push({
        name: log.medicationName,
        status: log.status as 'taken' | 'missed' | 'snoozed' | 'pending',
      })
    }

    // Calculate streak from today backwards
    let streak = 0
    if (logs.length > 0) {
      const recentLogs = await db
        .select({ createdAt: reminderLogs.createdAt, status: reminderLogs.status })
        .from(reminderLogs)
        .where(
          and(
            eq(reminderLogs.userId, dbUser!.id),
            gte(reminderLogs.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
          )
        )
        .orderBy(asc(reminderLogs.createdAt))

      if (recentLogs.length > 0) {
        const dailyStatus = new Map<string, boolean>()
        for (const log of recentLogs) {
          const day = log.createdAt!.toISOString().split('T')[0]
          if (log.status === 'missed') {
            dailyStatus.set(day, false)
          } else if (!dailyStatus.has(day)) {
            dailyStatus.set(day, true)
          }
        }
        const days = Array.from(dailyStatus.entries()).sort((a, b) => b[0].localeCompare(a[0]))
        for (const [, allTaken] of days) {
          if (allTaken) streak++
          else break
        }
      }
    }

    const result: CalendarData = {
      year,
      month,
      days: Array.from(dayMap.values()),
      streak,
    }

    return apiSuccess(result)
  } catch (error) {
    console.error('[compliance/calendar] Error:', error)
    return ApiErrors.internal()
  }
}
