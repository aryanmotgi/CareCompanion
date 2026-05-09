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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-sm font-medium text-[var(--text)] hover:text-[#A78BFA] transition-colors text-left line-clamp-2 w-full"
          >
            {props.title}
          </button>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {props.nctId} · {props.phase ?? 'Phase N/A'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded font-medium">
            Almost there
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-1 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Gap summary — always visible */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">What would need to change</p>
        {props.eligibilityGaps.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic">
            No specific gaps identified — ask your oncologist to review the eligibility criteria.
          </p>
        )}
        {props.eligibilityGaps.map((gap, i) => (
          <div key={i} className="bg-white/[0.03] border border-[var(--border)] rounded-lg p-2.5 space-y-1">
            <span className="text-xs font-medium text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">
              {getGapLabel(gap)}
            </span>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{gap.description}</p>
            {gap.gapType === 'measurable' && gap.metric && (
              <p className="text-xs text-[var(--text-muted)]">
                {gap.currentValue && <span>Current: {gap.currentValue}{gap.unit ? ` ${gap.unit}` : ''} · </span>}
                {gap.requiredValue && <span>Target: {gap.requiredValue}{gap.unit ? ` ${gap.unit}` : ''}</span>}
              </p>
            )}
            {!gap.verifiable && (
              <p className="text-xs text-amber-400/80 italic">
                We can&apos;t verify this automatically — worth asking your care team
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
            className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold transition-colors"
            style={{ background: '#6366F1' }}
          >
            View details →
          </button>
          <button
            onClick={() => props.onDismiss(props.nctId)}
            className="text-xs px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] ml-auto transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expanded detail panel */}
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
          <div className="flex gap-2 pt-1 border-t border-[var(--border)]">
            <button
              onClick={() => props.onDismiss(props.nctId)}
              className="text-xs px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] ml-auto transition-colors"
            >
              Collapse ▲
            </button>
          </div>
        </>
      )}
    </div>
  )
}
