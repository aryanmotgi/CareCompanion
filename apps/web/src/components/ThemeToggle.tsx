'use client'

import { useTheme } from './ThemeProvider'

const options = [
  { value: 'dark' as const, label: 'Dark', icon: '\u{1F319}' },
  { value: 'light' as const, label: 'Light', icon: '\u{2600}\u{FE0F}' },
  { value: 'system' as const, label: 'System', icon: '\u{1F4BB}' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            theme === opt.value
              ? 'bg-[var(--accent)] text-white shadow-lg'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-glass)]'
          }`}
        >
          <span aria-hidden="true">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
