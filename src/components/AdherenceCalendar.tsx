'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from './Skeleton'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MedStatus {
  name: string
  status: 'taken' | 'missed' | 'snoozed' | 'pending'
}

interface CalendarDay {
  date: string
  total: number
  taken: number
  missed: number
  snoozed: number
  medications: MedStatus[]
}

interface CalendarData {
  year: number
  month: number
  days: CalendarDay[]
  streak: number
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLORS: Record<string, string> = {
  taken: '#10b981',
  missed: '#ef4444',
  snoozed: '#eab308',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Color a day cell based on adherence */
function dayCellColor(day: CalendarDay | undefined): string {
  if (!day || day.total === 0) return 'bg-white/[0.06]'
  if (day.missed === 0) return 'bg-[#10b981]'
  if (day.taken === 0 && day.snoozed === 0) return 'bg-[#ef4444]'
  return 'bg-[#eab308]'
}

/** Opacity for cells — brighter for today's month, dimmer for padding days */
function dayCellOpacity(day: CalendarDay | undefined, isCurrentMonth: boolean): string {
  if (!isCurrentMonth) return 'opacity-20'
  if (!day || day.total === 0) return 'opacity-100'
  return 'opacity-100'
}

/* ------------------------------------------------------------------ */
/*  Day detail popover                                                 */
/* ------------------------------------------------------------------ */

function DayDetail({
  day,
  dateStr,
  onClose,
}: {
  day: CalendarDay | undefined
  dateStr: string
  onClose: () => void
}) {
  const date = new Date(dateStr + 'T12:00:00')
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-48 sm:w-56 rounded-xl bg-[#1e293b] border border-white/[0.12] shadow-xl shadow-black/40 p-3" role="dialog" aria-label={`Details for ${formatted}`}>
      {/* Close on outside tap */}
      <div className="fixed inset-0 z-[-1]" onClick={onClose} aria-hidden="true" />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#f1f5f9]">{formatted}</span>
        <button
          onClick={onClose}
          className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!day || day.total === 0 ? (
        <p className="text-[11px] text-[#94a3b8]">No medication data for this day.</p>
      ) : (
        <div className="space-y-1.5">
          {day.medications.map((med, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[med.status] || '#64748b' }}
              />
              <span className="text-[11px] text-[#f1f5f9] truncate flex-1">{med.name}</span>
              <span className="text-[10px] text-[#94a3b8] capitalize">{med.status}</span>
            </div>
          ))}
          <div className="pt-1.5 mt-1.5 border-t border-white/[0.08] flex gap-3 text-[10px] text-[#94a3b8]">
            <span>{day.taken} taken</span>
            {day.snoozed > 0 && <span>{day.snoozed} snoozed</span>}
            {day.missed > 0 && <span>{day.missed} missed</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function CalendarSkeleton() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdherenceCalendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1) // 1-based
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    setLoading(true)
    setError(null)
    setSelectedDate(null)

    try {
      const res = await fetch(`/api/compliance/calendar?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('Failed to load calendar data')
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalendar(viewYear, viewMonth)
  }, [viewYear, viewMonth, fetchCalendar])

  // Build a lookup of day data by date string
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    if (data) {
      for (const day of data.days) {
        map.set(day.date, day)
      }
    }
    return map
  }, [data])

  // Build calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1)
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    const startDow = firstDay.getDay() // 0=Sun

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = []

    // Padding days from previous month
    const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = viewMonth - 1 === 0 ? 12 : viewMonth - 1
      const y = viewMonth - 1 === 0 ? viewYear - 1 : viewYear
      cells.push({
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: true,
      })
    }

    // Padding days from next month
    const remaining = 7 - (cells.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = viewMonth + 1 > 12 ? 1 : viewMonth + 1
        const y = viewMonth + 1 > 12 ? viewYear + 1 : viewYear
        cells.push({
          dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          dayNum: d,
          isCurrentMonth: false,
        })
      }
    }

    return cells
  }, [viewYear, viewMonth])

  // Navigation
  function goPrev() {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goNext() {
    // Don't navigate past current month
    const now = new Date()
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1) return
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  /* ---- Loading ---- */
  if (loading && !data) return <CalendarSkeleton />

  /* ---- Error ---- */
  if (error) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 text-center">
        <p className="text-sm text-[#ef4444] mb-2">{error}</p>
        <button
          onClick={() => fetchCalendar(viewYear, viewMonth)}
          className="text-sm font-semibold text-[#6366F1] hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-4 sm:p-5">
      {/* Header: month nav + streak */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-[#94a3b8] hover:text-[#f1f5f9] min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Previous month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-[#f1f5f9] min-w-[130px] text-center">
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </h3>
          <button
            onClick={goNext}
            disabled={isCurrentMonth}
            className={`p-2 sm:p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isCurrentMonth
                ? 'text-white/[0.15] cursor-not-allowed'
                : 'hover:bg-white/[0.06] text-[#94a3b8] hover:text-[#f1f5f9]'
            }`}
            aria-label="Next month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Streak badge */}
        {data && data.streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 px-3 py-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <span className="text-xs font-bold text-[#10b981] tabular-nums">{data.streak}</span>
            <span className="text-[10px] text-[#10b981]/70">day streak</span>
          </div>
        )}
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-medium text-[#94a3b8] uppercase tracking-wider py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((cell) => {
          const dayData = dayMap.get(cell.dateStr)
          const isToday = cell.dateStr === todayStr
          const isSelected = selectedDate === cell.dateStr

          return (
            <div key={cell.dateStr} className="relative">
              <button
                onClick={() => {
                  if (!cell.isCurrentMonth) return
                  setSelectedDate(isSelected ? null : cell.dateStr)
                }}
                className={`
                  relative w-full aspect-square rounded-lg text-[11px] font-medium
                  flex items-center justify-center transition-all duration-150
                  ${cell.isCurrentMonth ? 'cursor-pointer' : 'cursor-default'}
                  ${dayCellOpacity(dayData, cell.isCurrentMonth)}
                  ${cell.isCurrentMonth && dayData && dayData.total > 0
                    ? dayCellColor(dayData)
                    : 'bg-white/[0.06]'
                  }
                  ${isToday ? 'ring-2 ring-[#6366F1] ring-offset-1 ring-offset-[#0f172a]' : ''}
                  ${isSelected ? 'ring-2 ring-white/40' : ''}
                  ${cell.isCurrentMonth
                    ? 'text-[#f1f5f9] hover:brightness-110'
                    : 'text-white/[0.15]'
                  }
                `}
                aria-label={`${cell.dateStr}${dayData ? `, ${dayData.taken} taken, ${dayData.missed} missed` : ''}`}
              >
                {cell.dayNum}
              </button>

              {/* Day detail popover */}
              {isSelected && cell.isCurrentMonth && (
                <DayDetail
                  day={dayData}
                  dateStr={cell.dateStr}
                  onClose={() => setSelectedDate(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 pt-3 border-t border-white/[0.06] flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-[#94a3b8]">
          <span className="inline-block w-3 h-3 rounded bg-[#10b981] flex-shrink-0" />
          All taken
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#94a3b8]">
          <span className="inline-block w-3 h-3 rounded bg-[#eab308] flex-shrink-0" />
          Some missed
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#94a3b8]">
          <span className="inline-block w-3 h-3 rounded bg-[#ef4444] flex-shrink-0" />
          All missed
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#94a3b8]">
          <span className="inline-block w-3 h-3 rounded bg-white/[0.06] flex-shrink-0" />
          No data
        </span>
      </div>
    </div>
  )
}
