'use client'

type EligibilityGap = {
  gapType:       'measurable' | 'conditional' | 'fixed'
  description:   string
  verifiable:    boolean
  metric?:       string | null
  currentValue?: string | null
  requiredValue?: string | null
  unit?:         string | null
}

type Props = {
  nctId:           string
  title:           string
  trialUrl:        string | null
  eligibilityGaps: EligibilityGap[]
  phase:           string | null
  onSave:    (nctId: string) => void
  onDismiss: (nctId: string) => void
}

const gapLabels: Record<string, string> = {
  measurable:  'Lab value to reach',
  conditional: 'Condition to meet',
  fixed:       'Permanent barrier',
}

function getGapLabel(gap: EligibilityGap): string {
  if (gap.gapType === 'measurable') return 'Lab value to reach'
  if (gap.gapType === 'fixed') return 'Permanent barrier'
  // conditional — try to be more specific based on description
  const desc = gap.description.toLowerCase()
  if (desc.includes('medication') || desc.includes('treatment') || desc.includes('drug') || desc.includes('stop') || desc.includes('prior')) {
    return 'Medication to stop'
  }
  if (desc.includes('complet') || desc.includes('line') || desc.includes('therapy')) {
    return 'Treatment to complete'
  }
  return 'Condition to meet'
}

export function CloseMatchCard(props: Props) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
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
        <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-medium flex-shrink-0">
          Close match
        </span>
      </div>

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

      <div className="flex gap-2">
        <button
          onClick={() => props.onSave(props.nctId)}
          className="text-xs px-3 py-1.5 border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
        >
          Watch this trial
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
