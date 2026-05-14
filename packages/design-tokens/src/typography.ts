// Generated from /DESIGN.md
export const fontFamily = {
  display: 'Figtree, system-ui, sans-serif',
  body:    'Noto Sans, system-ui, sans-serif',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamily.display,
    fontSize:   'clamp(1.5rem, 4vw, 2rem)',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  headline: {
    fontFamily: fontFamily.display,
    fontSize:   '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize:   '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize:   '0.875rem',
    fontWeight: 400,
    lineHeight: 1.6,
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize:   '0.75rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
  },
} as const;

export type TypographyScale = keyof typeof typography;
