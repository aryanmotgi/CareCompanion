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
  const [loadError, setLoadError]   = useState(false)
  const [liveRunning, setLiveRunning] = useState(false)
  const [liveError, setLiveError]     = useState<string | null>(null)
  const [livePhase, setLivePhase]     = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Rotate loading phases
  useEffect(() => {
    if (!liveRunning) { setLivePhase(0); return }
    const id = setInterval(() => setLivePhase(p => Math.min(p + 1, SEARCH_PHASES.length - 1)), 8000)
    return () => clearInterval(id)
  }, [liveRunning])

  // D3 — load cached results instantly on mount
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    Promise.all([
      fetch('/api/trials/matches', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/trials/saved', { signal: controller.signal }).then(r => r.json()),
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
      .catch(() => { setLoadError(true) })
      .finally(() => { clearTimeout(timeout); setLoading(false) })
    return () => { clearTimeout(timeout); controller.abort() }
  }, [])

  async function runLive() {
    if (liveRunning) return
    setLiveRunning(true)
    setLiveError(null)
    try {
      const res = await fetch('/api/trials/match', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)
      setMatched(data.matched ?? [])
      setClose(data.close ?? [])
      setLastUpdated(data.refreshedAt ?? new Date().toISOString())
      setHasSearched(true)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Search failed — try again')
      setHasSearched(true)
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
    const prevMatched = matched
    const prevClose = close
    setMatched(m => m.filter(t => t.nctId !== nctId))
    setClose(c => c.filter(t => t.nctId !== nctId))
    const res = await fetch(`/api/trials/saved/${nctId}`, {
      method: 'PATCH',
      body: JSON.stringify({ interestStatus: 'dismissed' }),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null)
    if (!res?.ok) {
      setMatched(prevMatched)
      setClose(prevClose)
    }
  }

  function shareTrial(nctId: string, title: string, url: string) {
    const body = encodeURIComponent(`I found this trial, can we discuss? ${url}`)
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${body}`)
  }

  if (loading) {
    return <div className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>Loading trial matches…</div>
  }

  if (loadError) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
        <p className="text-sm text-red-400">Could not load trial matches. Check your connection and try again.</p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); window.location.reload() }}
          className="text-xs px-4 py-2 rounded-xl text-white font-semibold"
          style={{ background: '#6366F1' }}
        >
          Retry
        </button>
      </div>
    )
  }

  // Full-screen loading overlay during live search
  if (liveRunning) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: '#0C0E1A' }}>
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
        <div className="rounded-lg px-4 py-2 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          Search failed: {liveError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white/90">Clinical Trials</h1>
          {lastUpdated && (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Updated {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </div>
        <button
          onClick={runLive}
          disabled={liveRunning || !cancerType}
          title={!cancerType ? 'Add cancer type above to search' : undefined}
          className="text-sm px-4 py-2 text-white font-semibold rounded-xl disabled:opacity-40"
          style={{ background: '#6366F1' }}
        >
          {hasResults ? 'Refresh' : 'Find trials now'}
        </button>
      </div>

      {matched.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white/90">
              Matched Trials
            </h2>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
              {matched.length}
            </span>
          </div>
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
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">
            Trials You&apos;re Close To
          </h2>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
          {hasSearched ? (
            <>
              <p className="text-sm text-white/60">No matching trials found for this profile.</p>
              <p className="text-xs text-white/30">
                Try updating the cancer type or stage above, or check back as new trials open.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60">No trial matches found yet.</p>
              <p className="text-xs text-white/30">
                Click &quot;Find trials now&quot; to search, or check back after your next appointment.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
