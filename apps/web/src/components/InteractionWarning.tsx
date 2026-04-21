'use client'

// interaction warning component

interface Interaction {
  drug1: string
  drug2: string
  severity: 'critical' | 'major' | 'moderate' | 'minor'
  description: string
}

interface InteractionWarningProps {
  interactions: Interaction[]
  onDismiss: () => void
  newMedication: string
}

const SEVERITY_STYLES = {
  critical: 'bg-red-500/15 border-red-500/30 text-red-400',
  major: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  moderate: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  minor: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
}

export function InteractionWarning({ interactions, onDismiss, newMedication }: InteractionWarningProps) {
  if (interactions.length === 0) return null

  const hasCritical = interactions.some(i => i.severity === 'critical' || i.severity === 'major')

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${hasCritical ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">{hasCritical ? '\u26A0\uFE0F' : '\uD83D\uDC8A'}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--text)] text-sm">
            {hasCritical ? 'Important Drug Interaction Warning' : 'Potential Interactions Found'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {newMedication} may interact with your current medications
          </p>
        </div>
        <button onClick={onDismiss} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1" aria-label="Dismiss">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="space-y-2">
        {interactions.map((interaction, i) => (
          <div key={i} className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLES[interaction.severity]}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <span>{interaction.severity}</span>
            </div>
            <p className="text-sm text-[var(--text)] mt-1">
              {interaction.drug1} + {interaction.drug2}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {interaction.description}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">
        Always consult your doctor or pharmacist about drug interactions.
      </p>
    </div>
  )
}
