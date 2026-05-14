// Generated from /DESIGN.md
// Run `bun run build` in this package to regenerate after DESIGN.md edits.

export const colorsDark = {
  bg: '#0C0E1A',
  bgWarm: '#10112B',
  bgCard: 'rgba(167, 139, 250, 0.04)',
  bgElevated: 'rgba(167, 139, 250, 0.08)',
  bgGlass: 'rgba(139, 92, 246, 0.05)',

  accent: '#6366F1',
  accentLight: 'rgba(99, 102, 241, 0.15)',
  accentGlow: 'rgba(99, 102, 241, 0.25)',
  accentHover: '#818CF8',

  lavender: '#A78BFA',
  lavenderLight: 'rgba(167, 139, 250, 0.15)',
  lavenderGlow: 'rgba(167, 139, 250, 0.2)',

  cyan: '#67E8F9',
  cyanGlow: 'rgba(103, 232, 249, 0.15)',
  violet: '#A78BFA',
  violetGlow: 'rgba(167, 139, 250, 0.2)',
  emerald: '#6EE7B7',
  emeraldGlow: 'rgba(110, 231, 183, 0.15)',
  amber: '#FCD34D',
  rose: '#FCA5A5',

  text: '#EDE9FE',
  textSecondary: '#A5B4CF',
  textMuted: '#5B6785',

  border: 'rgba(167, 139, 250, 0.08)',
  borderHover: 'rgba(167, 139, 250, 0.18)',
  borderGlow: 'rgba(99, 102, 241, 0.3)',
} as const;

export const colorsLight = {
  bg: '#F8F9FC',
  bgWarm: '#FFFFFF',
  bgCard: 'rgba(99, 102, 241, 0.04)',
  bgElevated: 'rgba(99, 102, 241, 0.06)',
  bgGlass: 'rgba(99, 102, 241, 0.03)',

  accent: '#6366F1',
  accentLight: 'rgba(99, 102, 241, 0.1)',
  accentGlow: 'rgba(99, 102, 241, 0.15)',
  accentHover: '#4F46E5',

  lavender: '#7C3AED',
  lavenderLight: 'rgba(124, 58, 237, 0.1)',
  lavenderGlow: 'rgba(124, 58, 237, 0.12)',

  cyan: '#0891B2',
  cyanGlow: 'rgba(8, 145, 178, 0.1)',
  violet: '#7C3AED',
  violetGlow: 'rgba(124, 58, 237, 0.12)',
  emerald: '#059669',
  emeraldGlow: 'rgba(5, 150, 105, 0.1)',
  amber: '#D97706',
  rose: '#E11D48',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  border: 'rgba(99, 102, 241, 0.12)',
  borderHover: 'rgba(99, 102, 241, 0.24)',
  borderGlow: 'rgba(99, 102, 241, 0.3)',
} as const;

export type ColorToken = keyof typeof colorsDark;
