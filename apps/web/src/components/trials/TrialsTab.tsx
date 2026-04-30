'use client'
import { useState, useEffect } from 'react'
import { TrialMatchCard } from './TrialMatchCard'
import { CloseMatchCard } from './CloseMatchCard'
import { ZipCodePrompt } from './ZipCodePrompt'

type EligibilityGap = {
  gapType: 'measurable' | 'conditional' | 'fixed'
  description: string
  verifiable: boolean
  metric?: string | null
  currentValue?: string | null
  requiredValue?: string | null
  unit?: string | null
}

type TrialMatch = {
  nctId: string
  title: string
  matchScore: number
  matchCategory: string
  matchReasons: string[]
  disqualifyingFactors: string[]
  uncertainFactors: string[]
  eligibilityGaps: EligibilityGap[] | null
  phase: string | null
  enrollmentStatus: string | null
  locations: Array<{ city?: string; state?: string; country?: string }> | null
  trialUrl: string | null
  stale: boolean
  updatedAt?: string | null
}

export function TrialsTab({ hasZip }: { hasZip: boolean }) {
  const [matched, setMatched]         = useState<TrialMatch[]>([])
  const [close, setClose]             = useState<TrialMatch[]>([])
  const [loading, setLoading]         = useState(true)
  const [liveRunning, setLiveRunning] = useState(false)

  useEffect(() => {
    fetch('/api/trials/matches')
      .then(r => r.json())
      .then(data => {
        setMatched(data.matched ?? [])
        setClose(data.close ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function runLive() {
    setLiveRunning(true)
    try {
      const data = await fetch('/api/trials/match', { method: 'POST' }).then(r => r.json())
      setMatched(data.matched ?? [])
      setClose(data.close ?? [])
    } catch { /* ignore */ }
    setLiveRunning(false)
  }

  async function saveTrial(nctId: string) {
    await fetch('/api/trials/save', {
      method: 'POST',
      body: JSON.stringify({ nctId }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
  }

  async function dismissTrial(nctId: string) {
    await fetch(`/api/trials/saved/${nctId}`, {
      method: 'PATCH',
      body: JSON.stringify({ interestStatus: 'dismissed' }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
    setMatched(m => m.filter(t => t.nctId !== nctId))
    setClose(c => c.filter(t => t.nctId !== nctId))
  }

  function shareTrial(nctId: string, title: string, url: string) {
    const body = encodeURIComponent(`I found this trial, can we discuss? ${url}`)
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${body}`)
  }

  async function contactTrial(nctId: string) {
    const detail = await fetch(`/api/trials/${nctId}`).then(r => r.json()).catch(() => null)
    const loc = detail?.locations?.[0]
    const contact = loc?.contacts?.[0]
    if (contact?.email) window.open(`mailto:${contact.email}`)
    else if (contact?.phone) window.open(`tel:${contact.phone}`)
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Loading trial matches…</div>
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6 px-4">
      {!hasZip && <ZipCodePrompt />}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Clinical Trials</h1>
        <button
          onClick={runLive}
          disabled={liveRunning}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {liveRunning ? 'Searching…' : 'Find trials now'}
        </button>
      </div>

      {matched.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Matched Trials
          </h2>
          {matched.map(t => (
            <TrialMatchCard
              key={t.nctId}
              nctId={t.nctId}
              title={t.title}
              matchScore={t.matchScore}
              matchReasons={t.matchReasons}
              disqualifyingFactors={t.disqualifyingFactors}
              uncertainFactors={t.uncertainFactors}
              phase={t.phase}
              enrollmentStatus={t.enrollmentStatus}
              locations={t.locations}
              trialUrl={t.trialUrl}
              stale={t.stale}
              updatedAt={t.updatedAt}
              onSave={saveTrial}
              onDismiss={dismissTrial}
              onShare={shareTrial}
              onContact={contactTrial}
            />
          ))}
        </section>
      )}

      {close.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Trials You&apos;re Close To
          </h2>
          <p className="text-xs text-gray-500">
            These trials have specific gaps — we&apos;ll notify you if you become eligible.
          </p>
          {close.map(t => (
            <CloseMatchCard
              key={t.nctId}
              nctId={t.nctId}
              title={t.title}
              trialUrl={t.trialUrl}
              eligibilityGaps={t.eligibilityGaps ?? []}
              phase={t.phase}
              onSave={saveTrial}
              onDismiss={dismissTrial}
            />
          ))}
        </section>
      )}

      {matched.length === 0 && close.length === 0 && (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm text-gray-500">No trial matches found yet.</p>
          <p className="text-xs text-gray-400">
            Click &quot;Find trials now&quot; to search, or check back after your next appointment.
          </p>
        </div>
      )}
    </div>
  )
}
