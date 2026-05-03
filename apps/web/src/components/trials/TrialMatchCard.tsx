'use client'
import { useState } from 'react'
import { TrialDetailPanel } from './TrialDetailPanel'

type Props = {
  nctId:                string
  title:                string
  matchScore:           number
  matchReasons:         string[]
  disqualifyingFactors: string[]
  uncertainFactors:     string[]
  phase:                string | null
  enrollmentStatus:     string | null
  locations:            Array<{ city?: string; state?: string; country?: string }> | null
  trialUrl:             string | null
  stale?:               boolean
  updatedAt?:           string | null
  savedStatus:          string | null
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
  onShare:   (nctId: string, title: string, url: string) => void
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'bg-emerald-500/15 text-emerald-400'
    : score >= 60
    ? 'bg-indigo-500/15 text-indigo-300'
    : 'bg-amber-500/15 text-amber-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {score}% match
    </span>
  )
}

export function TrialMatchCard(props: Props) {
  const [expanded, setExpanded] = useState(false)
  const nearestSite = props.locations?.[0]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      {/* Header row — always visible */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-label={`${props.title} — ${expanded ? 'collapse' : 'expand'} trial details`}
            className="text-sm font-semibold text-[var(--text)] hover:text-[#A78BFA] transition-colors text-left line-clamp-2 w-full"
          >
            {props.title}
          </button>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {props.nctId} · {props.phase ?? 'Phase N/A'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreBadge score={props.matchScore} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] p-1.5 transition-colors"
            aria-label={expanded ? 'Collapse trial details' : 'Expand trial details'}
            aria-expanded={expanded}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {props.stale && (
        <p className="text-xs px-2 py-1 rounded"
          style={{ color: 'rgba(251,191,36,0.80)', background: 'rgba(251,191,36,0.10)' }}>
          This match is from{props.updatedAt ? ` ${new Date(props.updatedAt).toLocaleDateString()}` : ' an earlier search'} — tap Refresh to check for updates
        </p>
      )}

      {/* Summary row — always visible */}
      {props.matchReasons.length > 0 && (
        <ul className="space-y-0.5">
          {props.matchReasons.slice(0, expanded ? undefined : 2).map((r, i) => (
            <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
              <span className="text-emerald-400 flex-shrink-0" aria-hidden="true">✓</span>{r}
            </li>
          ))}
          {!expanded && props.matchReasons.length > 2 && (
            <li className="text-xs text-[var(--text-muted)] pl-4">
              +{props.matchReasons.length - 2} more — expand to see all
            </li>
          )}
        </ul>
      )}

      {props.disqualifyingFactors.length > 0 && !expanded && (
        <ul className="space-y-0.5">
          {props.disqualifyingFactors.slice(0, 1).map((f, i) => (
            <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
              <span className="text-red-400 flex-shrink-0" aria-hidden="true">✗</span>{f}
            </li>
          ))}
        </ul>
      )}

      {nearestSite && !expanded && (
        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {[nearestSite.city, nearestSite.state].filter(Boolean).join(', ') || 'Location not listed'}
          {props.enrollmentStatus === 'RECRUITING' && (
            <span className="ml-2 text-emerald-400 font-medium">· Currently recruiting</span>
          )}
        </p>
      )}

      {/* Collapsed actions */}
      {!expanded && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs px-3 py-2 rounded-lg text-white font-semibold transition-colors"
            style={{ background: '#6366F1' }}
          >
            View details &amp; contact →
          </button>
          <button
            onClick={() => props.onShare(props.nctId, props.title, props.trialUrl ?? '')}
            className="text-xs px-3 py-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.04] transition-colors"
          >
            Share
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)] ml-auto transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded detail panel */}
      {expanded && (
        <TrialDetailPanel
          nctId={props.nctId}
          isCloseMatch={false}
          matchReasons={props.matchReasons}
          uncertainFactors={props.uncertainFactors}
          onSave={props.onSave}
          savedStatus={props.savedStatus}
        />
      )}

      {expanded && (
        <div className="flex gap-2 pt-1 border-t border-[var(--border)] flex-wrap">
          <button
            onClick={() => props.onShare(props.nctId, props.title, props.trialUrl ?? '')}
            className="text-xs px-3 py-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.04] transition-colors"
          >
            Share with oncologist
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] ml-auto transition-colors px-2 py-2"
            aria-label="Collapse trial details"
          >
            Collapse ▲
          </button>
        </div>
      )}
    </div>
  )
}
