// Named glow shadows. Use as box-shadow values directly.

export const glow = {
  blue:    '0 0 40px rgba(99, 102, 241, 0.40)',
  cyan:    '0 0 40px rgba(103, 232, 249, 0.35)',
  violet:  '0 0 40px rgba(167, 139, 250, 0.35)',
  emerald: '0 0 40px rgba(110, 231, 183, 0.30)',
  rose:    '0 0 40px rgba(252, 165, 165, 0.35)',
  amber:   '0 0 40px rgba(252, 211, 77, 0.30)',
} as const;

export const glowSoft = {
  blue:    '0 0 24px rgba(99, 102, 241, 0.20)',
  cyan:    '0 0 24px rgba(103, 232, 249, 0.18)',
  violet:  '0 0 24px rgba(167, 139, 250, 0.18)',
  emerald: '0 0 24px rgba(110, 231, 183, 0.15)',
  rose:    '0 0 24px rgba(252, 165, 165, 0.18)',
} as const;

export const glowPress = {
  blue: '0 0 56px rgba(99, 102, 241, 0.55)',
} as const;

export type GlowColor = keyof typeof glow;
