'use client'

type Role = 'caregiver' | 'patient' | 'self'

const ROLES: { value: Role; emoji: string; label: string; description: string }[] = [
  { value: 'caregiver', emoji: '🧑‍⚕️', label: 'Caregiver', description: 'Helping someone I love' },
  { value: 'patient', emoji: '🤒', label: 'Patient', description: 'Managing my own care, with a caregiver' },
  { value: 'self', emoji: '👤', label: 'Self-care', description: 'Managing my own care independently' },
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

      {/* Desktop: 3-column grid. Mobile (<480px): vertical stack */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
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
              className="relative rounded-xl p-3 text-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              style={{
                background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: selected
                  ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 20px rgba(124,58,237,0.15)'
                  : 'none',
              }}
            >
              <div className="text-2xl mb-1">{role.emoji}</div>
              <div
                className="text-xs font-semibold"
                style={{ color: selected ? '#c4b5fd' : '#f1f5f9' }}
              >
                {role.label}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {role.description}
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

      <style>{`
        @media (max-width: 479px) {
          [role="radiogroup"] {
            grid-template-columns: 1fr !important;
          }
          [role="radiogroup"] button {
            display: flex;
            align-items: center;
            gap: 12px;
            text-align: left;
            padding: 12px 16px;
          }
          [role="radiogroup"] button .text-2xl {
            margin-bottom: 0;
            flex-shrink: 0;
          }
        }
      `}</style>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
