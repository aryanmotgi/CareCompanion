'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export function TrialsDashboardCard() {
  const [matchedCount, setMatchedCount] = useState<number | null>(null)
  const [closeCount, setCloseCount]     = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/trials/matches?limit=100')
      .then(r => r.json())
      .then(data => {
        setMatchedCount((data.matched ?? []).length)
        setCloseCount((data.close ?? []).length)
      })
      .catch(() => {})
  }, [])

  if (matchedCount === null) return null
  if (matchedCount === 0 && closeCount === 0) return null

  const parts = []
  if (matchedCount! > 0) parts.push(`${matchedCount} match${matchedCount !== 1 ? 'es' : ''}`)
  if (closeCount! > 0)   parts.push(`${closeCount} close`)

  return (
    <Link
      href="/trials"
      className="block rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">Clinical Trials</p>
          <p className="text-xs text-blue-700 mt-0.5">{parts.join(' · ')}</p>
        </div>
        <span className="text-blue-600 text-lg">→</span>
      </div>
    </Link>
  )
}
