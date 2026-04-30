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
    ? 'bg-green-100 text-green-800'
    : score >= 60
    ? 'bg-blue-100 text-blue-800'
    : 'bg-yellow-100 text-yellow-800'
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {/* Header row — always visible */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-sm font-medium text-blue-700 hover:underline text-left line-clamp-2 w-full"
          >
            {props.title}
          </button>
          <p className="text-xs text-gray-500 mt-0.5">
            {props.nctId} · {props.phase ?? 'Phase N/A'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreBadge score={props.matchScore} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {props.stale && (
        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          Last matched{props.updatedAt ? ` ${new Date(props.updatedAt).toLocaleDateString()}` : ''} — click &quot;Find trials now&quot; to refresh
        </p>
      )}

      {/* Summary row — always visible */}
      {props.matchReasons.length > 0 && (
        <ul className="space-y-0.5">
          {props.matchReasons.slice(0, expanded ? undefined : 2).map((r, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-green-500 flex-shrink-0">✓</span>{r}
            </li>
          ))}
          {!expanded && props.matchReasons.length > 2 && (
            <li className="text-xs text-gray-400 pl-4">+{props.matchReasons.length - 2} more — expand to see all</li>
          )}
        </ul>
      )}

      {props.disqualifyingFactors.length > 0 && !expanded && (
        <ul className="space-y-0.5">
          {props.disqualifyingFactors.slice(0, 1).map((f, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-red-400 flex-shrink-0">✗</span>{f}
            </li>
          ))}
        </ul>
      )}

      {nearestSite && !expanded && (
        <p className="text-xs text-gray-500">
          📍 {nearestSite.city}, {nearestSite.state}
          {props.enrollmentStatus === 'RECRUITING' && (
            <span className="ml-2 text-green-600 font-medium">· Currently recruiting</span>
          )}
        </p>
      )}

      {/* Collapsed actions */}
      {!expanded && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            View details &amp; contact →
          </button>
          <button
            onClick={() => props.onShare(props.nctId, props.title, props.trialUrl ?? '')}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Share
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 ml-auto"
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
        <div className="flex gap-2 pt-1 border-t border-gray-100 flex-wrap">
          <button
            onClick={() => props.onShare(props.nctId, props.title, props.trialUrl ?? '')}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Share with oncologist
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
          >
            Dismiss
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Collapse ▲
          </button>
        </div>
      )}
    </div>
  )
}
