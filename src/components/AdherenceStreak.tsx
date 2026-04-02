'use client'

interface AdherenceStreakProps {
  /** Array of ISO date strings when medication was taken in the last 7 days */
  takenDates: string[]
}

export function AdherenceStreak({ takenDates }: AdherenceStreakProps) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d
  })

  const takenSet = new Set(
    takenDates.map((d) => new Date(d).toISOString().slice(0, 10))
  )

  // Count consecutive days from today backwards
  let streak = 0
  for (let i = 6; i >= 0; i--) {
    const dateStr = days[i].toISOString().slice(0, 10)
    if (takenSet.has(dateStr)) {
      streak++
    } else {
      break
    }
  }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div>
      <div className="flex gap-1.5 justify-center">
        {days.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10)
          const taken = takenSet.has(dateStr)
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-5 h-5 rounded-full ${
                  taken ? 'bg-[#10b981]' : 'bg-white/[0.08]'
                }`}
              />
              <span className="text-[9px] text-[#64748b]">
                {dayLabels[day.getDay()]}
              </span>
            </div>
          )
        })}
      </div>
      {streak > 0 && (
        <div className="text-center text-[10px] text-[#10b981] mt-1">
          {streak} day streak
        </div>
      )}
    </div>
  )
}
