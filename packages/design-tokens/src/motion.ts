// Motion tokens. Mirrors values used in apps/mobile/app/*.tsx Reanimated calls.
// Web consumes these as Framer Motion `transition` configs.

export const easing = {
  appleEase: [0.32, 0.72, 0, 1] as const,        // welcome.tsx:44
  outCubic:  [0.33, 1, 0.68, 1] as const,
  outQuad:   [0.5, 1, 0.89, 1] as const,
  inOutSin:  [0.37, 0, 0.63, 1] as const,
} as const;

export const easingCss = {
  appleEase: 'cubic-bezier(0.32, 0.72, 0, 1)',
  outCubic:  'cubic-bezier(0.33, 1, 0.68, 1)',
  outQuad:   'cubic-bezier(0.5, 1, 0.89, 1)',
  inOutSin:  'cubic-bezier(0.37, 0, 0.63, 1)',
} as const;

export const duration = {
  fast:     0.12,
  base:     0.28,
  medium:   0.42,
  slow:     0.5,
  carousel: 0.7,
  ambient:  1.4,
  orbDrift: 14,
} as const;

export const spring = {
  press:   { stiffness: 220, damping: 14, mass: 1 },
  release: { stiffness: 200, damping: 12, mass: 1 },
  appear:  { stiffness: 110, damping: 11, mass: 1 },
  bouncy:  { stiffness: 130, damping: 14, mass: 1 },
} as const;
