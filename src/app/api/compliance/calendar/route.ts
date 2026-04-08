/**
 * Daily adherence calendar data endpoint.
 * Returns per-day medication status for a given month.
 *
 * Query params:
 *   year  – 4-digit year  (default: current year)
 *   month – 1-12          (default: current month)
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const url = new URL(req.url)
    const now = new Date()
    const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()))
    const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1))

    // Build date range for the requested month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59) // last day of month

    const admin = createAdminClient()

    const { data: logs } = await admin.from('reminder_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    // Group logs by day
    const dayMap = new Map<string, CalendarDay>()

    for (const log of (logs || [])) {
      const dateStr = log.created_at.split('T')[0]

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
        name: log.medication_name,
        status: log.status,
      })
    }

    // Calculate streak from today backwards (across all logs, not just this month)
    let streak = 0
    if (logs && logs.length > 0) {
      // Fetch recent logs for streak calculation
      const { data: recentLogs } = await admin.from('reminder_logs')
        .select('created_at, status')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      if (recentLogs && recentLogs.length > 0) {
        const dailyStatus = new Map<string, boolean>()
        for (const log of recentLogs) {
          const day = log.created_at.split('T')[0]
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
