'use client'

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
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
  onShare:   (nctId: string, title: string, url: string) => void
  onContact: (nctId: string) => void
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
  const nearestSite = props.locations?.[0]

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <a
            href={props.trialUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline line-clamp-2"
          >
            {props.title}
          </a>
          <p className="text-xs text-gray-500 mt-0.5">
            {props.nctId} · {props.phase ?? 'Phase N/A'}
          </p>
        </div>
        <ScoreBadge score={props.matchScore} />
      </div>

      {props.stale && (
        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          Last matched{props.updatedAt ? ` ${new Date(props.updatedAt).toLocaleDateString()}` : ''} — click &quot;Find trials now&quot; to refresh
        </p>
      )}

      {props.matchReasons.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Why you match</p>
          <ul className="space-y-0.5">
            {props.matchReasons.map((r, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-green-500 flex-shrink-0">✓</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.disqualifyingFactors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Potential concerns</p>
          <ul className="space-y-0.5">
            {props.disqualifyingFactors.map((f, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-red-400 flex-shrink-0">✗</span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.uncertainFactors.length > 0 && (
        <div>
          {props.uncertainFactors.map((u, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">{u}</p>
          ))}
        </div>
      )}

      {nearestSite && (
        <p className="text-xs text-gray-500">
          📍 {nearestSite.city}, {nearestSite.state}
          {props.enrollmentStatus === 'RECRUITING' && (
            <span className="ml-2 text-green-600 font-medium">· Currently recruiting</span>
          )}
        </p>
      )}

      <div className="flex gap-2 pt-1 flex-wrap">
        <button
          onClick={() => props.onSave(props.nctId)}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={() => props.onContact(props.nctId)}
          className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
        >
          Contact
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
    </div>
  )
}
