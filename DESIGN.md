# CareCompanion Design System

Extracted from existing production components (LoginForm.tsx, SignupForm.tsx, OnboardingWizard.tsx).

## Classification

**APP UI** — dark, dense, healthcare management. Not a marketing page. No hero sections, full-bleed images, or promotional copy.

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| Surface | `rgba(255,255,255,0.06)` | Card/input backgrounds |
| Surface border | `rgba(255,255,255,0.12)` | Card/input borders |
| Surface hover | `rgba(255,255,255,0.09)` | Hover state for cards |
| Accent | `#7c3aed` (violet-700) | Primary actions, selected states |
| Accent glow | `rgba(124,58,237,0.15)` | Selected card background tint |
| Accent label | `rgba(167,139,250,0.8)` (violet-400) | Active floating labels |
| Text primary | `rgba(255,255,255,0.90)` | Main content |
| Text secondary | `rgba(255,255,255,0.40)` | Placeholder, hints |
| Text muted | `rgba(255,255,255,0.25)` | De-emphasized |
| Background | `#0a0a0f` (approximate) | Page background |
| Gradient primary | `linear-gradient(135deg, #7c3aed, #4f46e5)` | CTA buttons |

## Typography

- **Body / inputs:** `text-sm` (14px), `-apple-system` / `Inter` fallback
- **Headings:** `font-bold`, white/90
- **Active labels:** 10px, violet-400, `font-weight: 500`
- **Placeholder labels:** 14px, white/30

## Spacing & Shape

- **Border radius:** `rounded-xl` (12px) for inputs/cards, `rounded-2xl` (16px) for modals
- **Input padding:** `pt-5 pb-2 px-4` (floating label space at top)
- **Card gap:** `gap-3` or `gap-4`
- **Focus ring:** `ring-2 ring-indigo-500/60`

## Interaction Patterns

**Floating label inputs:** Label sits inside the input field, moves to small text at top-left on focus/fill. See `FloatingInput` in `LoginForm.tsx`.

**Selected card state:**
```
border: 2px solid #7c3aed
background: rgba(124,58,237,0.15)
box-shadow: 0 0 0 1px rgba(124,58,237,0.4), 0 0 20px rgba(124,58,237,0.15)
```

**Primary button:**
```
background: linear-gradient(135deg, #7c3aed, #4f46e5)
border-radius: 12px
padding: 14px
font-weight: 600
```

**Disabled button:** `opacity: 0.4`, `cursor: not-allowed`

## Patterns to Avoid

- Purple/violet gradient backgrounds (reserved for buttons only)
- Icon-in-colored-circle decoration
- Centered-everything layouts
- Cards with colored left borders
- `system-ui` or `-apple-system` as display font (use Inter explicitly)
- Placeholder-only labels (floating labels required)
