export function SettingsRow({
  label,
  description,
  right,
  onClick,
  danger,
  indent,
}: {
  label: string
  description?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={`px-4 py-3.5 flex items-center justify-between ${indent ? 'pl-8' : ''} ${onClick ? 'cursor-pointer active:bg-white/[0.02]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="flex-1 mr-3">
        <div className={`text-sm ${danger ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}`}>{label}</div>
        {description && <div className="text-[11px] text-[#64748b] mt-0.5">{description}</div>}
      </div>
      {right || (onClick && !indent && <span className="text-[#64748b] text-base" aria-hidden="true">›</span>)}
    </div>
  )
}
