'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Preview = { title: string; score?: number; reason?: string; gap?: string } | null

export function TrialsDashboardCard() {
  const [matchedCount, setMatchedCount] = useState<number | null>(null)
  const [closeCount, setCloseCount]     = useState<number | null>(null)
  const [topMatch, setTopMatch]         = useState<Preview>(null)
  const [topClose, setTopClose]         = useState<Preview>(null)

  useEffect(() => {
    fetch('/api/trials/matches?limit=100')
      .then(r => r.json())
      .then(data => {
        const matched = data.matched ?? []
        const close   = data.close ?? []
        setMatchedCount(matched.length)
        setCloseCount(close.length)
        if (matched.length > 0) {
          const m = matched[0]
          setTopMatch({
            title:  m.title ?? '',
            score:  m.matchScore,
            reason: m.matchReasons?.[0] ?? undefined,
          })
        }
        if (close.length > 0) {
          const c = close[0]
          setTopClose({
            title: c.title ?? '',
            gap:   c.eligibilityGaps?.[0]?.description ?? undefined,
          })
        }
      })
      .catch(() => {})
  }, [])

  if (matchedCount === null) return null
  if (matchedCount === 0 && closeCount === 0) return null

  const parts: string[] = []
  if (matchedCount! > 0) parts.push(`${matchedCount} match${matchedCount !== 1 ? 'es' : ''}`)
  if (closeCount! > 0)   parts.push(`${closeCount} close`)

  return (
    <Link
      href="/trials"
      className="block rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors space-y-2"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">Clinical Trials</p>
          <p className="text-xs text-blue-700 mt-0.5">{parts.join(' · ')}</p>
        </div>
        <span className="text-blue-600 text-lg">→</span>
      </div>
      {topMatch && (
        <div className="border-t border-blue-200 pt-2 space-y-0.5">
          <p className="text-xs text-blue-800 font-medium line-clamp-1">{topMatch.title}</p>
          {topMatch.score !== undefined && (
            <p className="text-xs text-blue-600">{topMatch.score}% match{topMatch.reason ? ` · ${topMatch.reason}` : ''}</p>
          )}
        </div>
      )}
      {topClose && !topMatch && (
        <div className="border-t border-blue-200 pt-2 space-y-0.5">
          <p className="text-xs text-blue-800 font-medium line-clamp-1">{topClose.title}</p>
          {topClose.gap && <p className="text-xs text-purple-600 line-clamp-1">{topClose.gap}</p>}
        </div>
      )}
    </Link>
  )
}
