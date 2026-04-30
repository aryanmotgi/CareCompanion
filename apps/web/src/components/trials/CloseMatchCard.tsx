'use client'
import { useState } from 'react'
import { TrialDetailPanel } from './TrialDetailPanel'

type EligibilityGap = {
  gapType:        'measurable' | 'conditional' | 'fixed'
  description:    string
  verifiable:     boolean
  metric?:        string | null
  currentValue?:  string | null
  requiredValue?: string | null
  unit?:          string | null
}

type Props = {
  nctId:           string
  title:           string
  trialUrl:        string | null
  eligibilityGaps: EligibilityGap[]
  phase:           string | null
  savedStatus:     string | null
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
}

function getGapLabel(gap: EligibilityGap): string {
  if (gap.gapType === 'measurable') return 'Lab value to reach'
  if (gap.gapType === 'fixed') return 'Permanent barrier'
  const desc = gap.description.toLowerCase()
  if (desc.includes('medication') || desc.includes('drug') || desc.includes('stop') || desc.includes('prior')) {
    return 'Medication to stop'
  }
  if (desc.includes('complet') || desc.includes('line') || desc.includes('therapy')) {
    return 'Treatment to complete'
  }
  return 'Condition to meet'
}

export function CloseMatchCard(props: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
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
          <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-medium">
            Close match
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Gap summary — always visible */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">What&apos;s blocking eligibility</p>
        {props.eligibilityGaps.map((gap, i) => (
          <div key={i} className="bg-white border border-purple-100 rounded p-2.5 space-y-1">
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
              {getGapLabel(gap)}
            </span>
            <p className="text-xs text-gray-700 mt-1">{gap.description}</p>
            {!gap.verifiable && (
              <p className="text-xs text-amber-600 italic">
                We can&apos;t verify this automatically — ask your care team
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Collapsed actions */}
      {!expanded && (
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs px-3 py-1.5 border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
          >
            View details &amp; contact →
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 ml-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded detail panel — isCloseMatch=true changes email framing */}
      {expanded && (
        <>
          <TrialDetailPanel
            nctId={props.nctId}
            isCloseMatch={true}
            matchReasons={[]}
            uncertainFactors={[]}
            onSave={props.onSave}
            savedStatus={props.savedStatus}
          />
          <div className="flex gap-2 pt-1 border-t border-purple-100">
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
        </>
      )}
    </div>
  )
}
