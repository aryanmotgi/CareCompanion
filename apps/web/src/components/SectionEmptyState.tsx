import type { ReactNode } from 'react'

interface SectionEmptyStateProps {
  icon: ReactNode
  heading: string
  body: string
  patientName?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

export function SectionEmptyState({
  icon,
  heading,
  body,
  patientName,
  actionLabel,
  onAction,
  actionHref,
}: SectionEmptyStateProps) {
  // Replace [patient name] in both heading and body if patientName is provided
  const displayHeading = patientName ? heading.replace('[patient name]', patientName) : heading
  const displayBody = patientName ? body.replace('[patient name]', patientName) : body

  // Determine whether to render action as button or link, or not at all
  const shouldRenderAction = actionLabel && (onAction || actionHref)
  const preferLink = actionHref && (onAction || !onAction) // actionHref takes precedence

  const actionClasses = 'inline-block bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold px-6 py-3 rounded-xl'

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6366F1]/20 bg-[#6366F1]/10">
        {icon}
      </div>

      {/* Heading */}
      <h3 className="text-sm font-semibold text-[#f1f5f9]">{displayHeading}</h3>

      {/* Body */}
      <p className="max-w-xs text-xs leading-relaxed text-[#64748b]">{displayBody}</p>

      {/* Action */}
      {shouldRenderAction &&
        (preferLink ? (
          <a href={actionHref} className={actionClasses}>
            {actionLabel}
          </a>
        ) : (
          <button onClick={onAction} className={actionClasses}>
            {actionLabel}
          </button>
        ))}
    </div>
  )
}
