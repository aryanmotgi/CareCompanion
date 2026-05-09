'use client'
import { useState, useEffect, useId } from 'react'
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
  profileId:   string
  hasZip:      boolean
  cancerType?: string
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

function TrialsSkeleton() {
  return (
    <div className="space-y-4 py-6 px-4 max-w-2xl mx-auto animate-pulse" aria-label="Loading trial matches" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-32 rounded-lg bg-white/[0.08]" />
          <div className="h-3 w-24 rounded bg-white/[0.05]" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-white/[0.08]" />
      </div>
      <div className="space-y-3">
        <div className="h-3.5 w-28 rounded bg-white/[0.06]" />
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
            <div className="flex justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-3/4 rounded bg-white/[0.08]" />
                <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
              </div>
              <div className="h-5 w-16 rounded bg-white/[0.08]" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-full rounded bg-white/[0.05]" />
              <div className="h-3 w-5/6 rounded bg-white/[0.05]" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-28 rounded-lg bg-white/[0.08]" />
              <div className="h-7 w-16 rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
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

  const resultsRegionId = useId()

  // Rotate loading phases
  useEffect(() => {
    if (!liveRunning) { setLivePhase(0); return }
    const id = setInterval(() => setLivePhase(p => Math.min(p + 1, SEARCH_PHASES.length - 1)), 8000)
    return () => clearInterval(id)
  }, [liveRunning])

  // Load cached results on mount
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    Promise.allSettled([
      fetch('/api/trials/matches', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/trials/saved', { signal: controller.signal }).then(r => r.json()),
    ])
      .then(([matchResult, savedResult]) => {
        if (matchResult.status === 'fulfilled') {
          const matchData = matchResult.value
          const m: TrialMatch[] = matchData.matched ?? []
          const c: TrialMatch[] = matchData.close ?? []
          setMatched(m)
          setClose(c)
          const allUpdates = [...m, ...c]
            .map(t => t.updatedAt)
            .filter(Boolean) as string[]
          if (allUpdates.length > 0) {
            setLastUpdated(allUpdates.sort().at(-1)!)
          }
        } else {
          setLoadError(true)
        }
        if (savedResult.status === 'fulfilled') {
          const savedMap: Record<string, string> = {}
          for (const s of (savedResult.value as SavedTrial[])) {
            savedMap[s.nctId] = s.interestStatus
          }
          setSaved(savedMap)
        }
      })
      .finally(() => { clearTimeout(timeout); setLoading(false) })
    return () => { clearTimeout(timeout); controller.abort() }
  }, [])

  function getCsrf(): string {
    return document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? ''
  }

  async function runLive() {
    if (liveRunning) return
    setLiveRunning(true)
    setLiveError(null)
    try {
      const res = await fetch('/api/trials/match', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrf() },
      })
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
    setSaved(s => ({ ...s, [nctId]: 'interested' }))
    const res = await fetch('/api/trials/save', {
      method: 'POST',
      body: JSON.stringify({ nctId }),
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
    }).catch(() => null)
    if (!res?.ok) {
      setSaved(s => {
        const next = { ...s }
        delete next[nctId]
        return next
      })
    }
  }

  async function dismissTrial(nctId: string) {
    const dismissedMatched = matched.filter(t => t.nctId === nctId)
    const dismissedClose   = close.filter(t => t.nctId === nctId)
    setMatched(m => m.filter(t => t.nctId !== nctId))
    setClose(c => c.filter(t => t.nctId !== nctId))
    const res = await fetch(`/api/trials/saved/${nctId}`, {
      method: 'PATCH',
      body: JSON.stringify({ interestStatus: 'dismissed' }),
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
    }).catch(() => null)
    if (!res?.ok) {
      if (dismissedMatched.length > 0) setMatched(m => [...m, ...dismissedMatched])
      if (dismissedClose.length > 0)   setClose(c => [...c, ...dismissedClose])
    }
  }

  function shareTrial(nctId: string, title: string, url: string) {
    const trialLink = url || `https://clinicaltrials.gov/study/${nctId}`
    const body = encodeURIComponent(`I found this trial, can we discuss? ${trialLink}`)
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${body}`)
  }

  if (loading) return <TrialsSkeleton />

  if (loadError) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center px-4" role="alert">
        <p className="text-sm text-[var(--text-secondary)]">
          We couldn&apos;t load your trial matches. Check your connection and try again.
        </p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); window.location.reload() }}
          className="text-xs px-4 py-2 rounded-xl text-white font-semibold"
          style={{ background: '#6366F1' }}
        >
          Try again
        </button>
      </div>
    )
  }

  // Full-screen loading overlay during live search
  if (liveRunning) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: '#0C0E1A' }}
        role="status"
        aria-label={SEARCH_PHASES[livePhase]}
      >
        <div className="relative flex items-center justify-center mb-10">
          <div className="absolute w-32 h-32 rounded-full opacity-20 animate-ping"
            style={{ background: 'radial-gradient(circle, #7C3AED, transparent)', animationDuration: '2s' }} />
          <div className="absolute w-24 h-24 rounded-full opacity-30 animate-ping"
            style={{ background: 'radial-gradient(circle, #6366F1, transparent)', animationDuration: '2s', animationDelay: '0.4s' }} />
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6366F1)', boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
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
        <div className="flex gap-2 mt-8" aria-hidden="true">
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
    <main className="space-y-6 max-w-2xl mx-auto py-6 px-4">

      {/* Profile data prompt: shown when cancer type unknown */}
      {!cancerType && (
        <ProfileDataPrompt
          profileId={profileId}
          onSaved={data => {
            setCancerType(data.cancerType)
            void runLive()
          }}
        />
      )}

      {/* Zip code prompt */}
      {!hasZip && cancerType && (
        <ZipCodePrompt profileId={profileId} onSaved={() => setHasZip(true)} />
      )}

      {liveError && (
        <div
          className="rounded-lg px-4 py-2 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          role="alert"
        >
          Search failed: {liveError}. Please try again.
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
          title={!cancerType ? 'Add your diagnosis above to search' : undefined}
          className="text-sm px-4 py-2 text-white font-semibold rounded-xl disabled:opacity-40 transition-opacity"
          style={{ background: '#6366F1' }}
        >
          {hasResults ? 'Refresh' : 'Find trials now'}
        </button>
      </div>

      {/* Results region — announced to screen readers when updated */}
      <div
        id={resultsRegionId}
        aria-live="polite"
        aria-label="Trial matches"
      >
        {matched.length > 0 && (
          <section className="space-y-3" aria-label="Matched trials">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white/90">
                Matched Trials
              </h2>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium"
                aria-label={`${matched.length} matched trials`}
              >
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
          <section className="space-y-3 mt-6" aria-label="Trials you are close to qualifying for">
            <div>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wide">
                Almost There — Trials Worth Watching
              </h2>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                You don&apos;t qualify right now, but these trials are close. We&apos;re watching them for you.
              </p>
            </div>
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
                <p className="text-sm text-white/60">We didn&apos;t find a match right now — but trials open every week.</p>
                <p className="text-xs text-white/30">
                  We&apos;ll notify you when something new fits your profile. You can also try updating your diagnosis details above, or ask your oncologist if there&apos;s a specific trial to look into.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-white/60">We haven&apos;t run a search yet.</p>
                <p className="text-xs text-white/30">
                  Click &quot;Find trials now&quot; and we&apos;ll scan thousands of active trials for your profile.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
