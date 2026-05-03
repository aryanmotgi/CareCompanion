'use client'

type Role = 'caregiver' | 'patient' | 'self'

const ROLES: { value: Role; emoji: string; label: string; description: string }[] = [
  { value: 'caregiver', emoji: '🧑‍⚕️', label: 'Caregiver', description: 'Caring for someone I love' },
  { value: 'patient', emoji: '💙', label: 'Patient', description: 'Getting support from a loved one' },
  { value: 'self', emoji: '🌟', label: 'Self-care', description: 'Managing my care on my own' },
]

export function RoleSelector({
  value,
  onChange,
  error,
}: {
  value: Role | null
  onChange: (role: Role) => void
  error?: string
}) {
  return (
    <div>
      <p className="text-xs text-white/40 mb-2">Who are you joining as? <span className="text-red-400">*</span></p>

      <div
        className="grid grid-cols-1 xs:grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Account role"
      >
        {ROLES.map((role) => {
          const selected = value === role.value
          return (
            <button
              key={role.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(role.value)}
              className="relative rounded-xl p-3 xs:text-center flex xs:block items-center gap-3 xs:gap-0 text-left xs:text-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              style={{
                background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: selected
                  ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 20px rgba(124,58,237,0.15)'
                  : 'none',
              }}
            >
              <div className="text-2xl xs:mb-1 flex-shrink-0">{role.emoji}</div>
              <div className="flex-1 xs:flex-none">
                <div
                  className="text-xs font-semibold"
                  style={{ color: selected ? '#c4b5fd' : '#f1f5f9' }}
                >
                  {role.label}
                </div>
                <div className="text-[9px] xs:mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {role.description}
                </div>
              </div>
              {selected && (
                <div
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: '#7c3aed' }}
                  aria-hidden="true"
                >
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
