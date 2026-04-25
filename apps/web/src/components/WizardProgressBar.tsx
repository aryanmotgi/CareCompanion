'use client'

export function WizardProgressBar({
  currentStep,
  totalSteps,
  onStepClick,
}: {
  currentStep: number  // 1-based
  totalSteps: number
  onStepClick?: (step: number) => void  // only fires for completed steps
}) {
  return (
    <div className="w-full">
      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Step {currentStep} of {totalSteps}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep

          let background: string
          if (isCompleted) background = '#7c3aed'
          else if (isCurrent) background = 'rgba(124,58,237,0.6)'
          else background = 'rgba(255,255,255,0.12)'

          return (
            <button
              key={step}
              type="button"
              aria-label={`Step ${step}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              disabled={!isCompleted}
              onClick={() => isCompleted && onStepClick?.(step)}
              className="flex-1 transition-all duration-200 focus:outline-none"
              style={{
                height: '4px',
                borderRadius: '2px',
                background,
                cursor: isCompleted ? 'pointer' : 'default',
                opacity: isCompleted ? 1 : isCurrent ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (isCompleted) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.85)'
                }
              }}
              onMouseLeave={(e) => {
                if (isCompleted) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#7c3aed'
                }
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
