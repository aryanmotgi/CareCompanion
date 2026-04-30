'use client'
import { useState, useEffect } from 'react'
import { TrialMatchCard } from './TrialMatchCard'
import { CloseMatchCard } from './CloseMatchCard'
import { ZipCodePrompt } from './ZipCodePrompt'
import { ProfileDataPrompt } from './ProfileDataPrompt'

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

type SavedTrial = { nctId: string; interestStatus: string }

type Props = {
  profileId:    string
  hasZip:       boolean
  cancerType?:  string
  cancerStage?: string
  patientAge?:  number
  patientName?: string
}

const SEARCH_PHASES = [
  'Reviewing your medical profile…',
  'Searching clinical trials database…',
  'Analyzing eligibility criteria…',
  'Scoring trial matches…',
  'Almost there…',
]

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function TrialsTab({
  profileId,
  hasZip: initialHasZip,
  cancerType: initialCancerType,
}: Props) {
  const [hasZip, setHasZip]         = useState(initialHasZip)
  const [cancerType, setCancerType] = useState(initialCancerType ?? null)
  const [matched, setMatched]       = useState<TrialMatch[]>([])
  const [close, setClose]           = useState<TrialMatch[]>([])
  const [saved, setSaved]           = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(true)
  const [liveRunning, setLiveRunning] = useState(false)
  const [liveError, setLiveError]     = useState<string | null>(null)
  const [livePhase, setLivePhase]     = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Rotate loading phases
  useEffect(() => {
    if (!liveRunning) { setLivePhase(0); return }
    const id = setInterval(() => setLivePhase(p => Math.min(p + 1, SEARCH_PHASES.length - 1)), 8000)
    return () => clearInterval(id)
  }, [liveRunning])

  // D3 — load cached results instantly on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/trials/matches').then(r => r.json()),
      fetch('/api/trials/saved').then(r => r.json()),
    ])
      .then(([matchData, savedData]) => {
        const m: TrialMatch[] = matchData.matched ?? []
        const c: TrialMatch[] = matchData.close ?? []
        setMatched(m)
        setClose(c)
        // Derive last updated from most recent updatedAt across results
        const allUpdates = [...m, ...c]
          .map(t => t.updatedAt)
          .filter(Boolean) as string[]
        if (allUpdates.length > 0) {
          setLastUpdated(allUpdates.sort().at(-1)!)
        }
        const savedMap: Record<string, string> = {}
        for (const s of (savedData as SavedTrial[])) {
          savedMap[s.nctId] = s.interestStatus
        }
        setSaved(savedMap)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function runLive() {
    setLiveRunning(true)
    setLiveError(null)
    try {
      const res = await fetch('/api/trials/match', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)
      setMatched(data.matched ?? [])
      setClose(data.close ?? [])
      setLastUpdated(data.refreshedAt ?? new Date().toISOString())
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Search failed — try again')
    } finally {
      setLiveRunning(false)
    }
  }

  async function saveTrial(nctId: string) {
    await fetch('/api/trials/save', {
      method: 'POST',
      body: JSON.stringify({ nctId }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
    setSaved(s => ({ ...s, [nctId]: 'interested' }))
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

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Loading trial matches…</div>
  }

  // Full-screen loading overlay during live search
  if (liveRunning) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(135deg, #0a0814 0%, #110d24 100%)' }}>
        <div className="relative flex items-center justify-center mb-10">
          <div className="absolute w-32 h-32 rounded-full opacity-20 animate-ping"
            style={{ background: 'radial-gradient(circle, #7C3AED, transparent)', animationDuration: '2s' }} />
          <div className="absolute w-24 h-24 rounded-full opacity-30 animate-ping"
            style={{ background: 'radial-gradient(circle, #6366F1, transparent)', animationDuration: '2s', animationDelay: '0.4s' }} />
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)', boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 01.45 2.795l-1.2 1.8A2.25 2.25 0 0117.175 21H6.075a2.25 2.25 0 01-1.875-.905l-1.2-1.8A2.25 2.25 0 013 15h16.8z" />
            </svg>
          </div>
        </div>
        <p key={livePhase} className="text-lg font-medium text-white text-center mb-3"
          style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          {SEARCH_PHASES[livePhase]}
        </p>
        <p className="text-sm text-purple-300 text-center">
          Searching thousands of active trials for your exact profile
        </p>
        <div className="flex gap-2 mt-8">
          {SEARCH_PHASES.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-500"
              style={{ background: i <= livePhase ? '#A78BFA' : 'rgba(167,139,250,0.2)' }} />
          ))}
        </div>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  const hasResults = matched.length > 0 || close.length > 0

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6 px-4">

      {/* D2 — profile data prompt: shown when cancer type unknown */}
      {!cancerType && (
        <ProfileDataPrompt
          profileId={profileId}
          onSaved={data => {
            setCancerType(data.cancerType)
            // Auto-trigger search after profile is saved
            void runLive()
          }}
        />
      )}

      {/* Zip code prompt */}
      {!hasZip && cancerType && (
        <ZipCodePrompt profileId={profileId} onSaved={() => setHasZip(true)} />
      )}

      {liveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          Search failed: {liveError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Clinical Trials</h1>
          {/* D3 — last updated timestamp */}
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </div>
        <button
          onClick={runLive}
          disabled={liveRunning || !cancerType}
          title={!cancerType ? 'Add cancer type above to search' : undefined}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {hasResults ? 'Refresh' : 'Find trials now'}
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
              savedStatus={saved[t.nctId] ?? null}
              onSave={saveTrial}
              onDismiss={dismissTrial}
              onShare={shareTrial}
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
              savedStatus={saved[t.nctId] ?? null}
              onSave={saveTrial}
              onDismiss={dismissTrial}
            />
          ))}
        </section>
      )}

      {!hasResults && cancerType && (
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
