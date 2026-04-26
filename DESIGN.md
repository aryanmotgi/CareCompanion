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

## Component: Wizard Progress Bar

Used in `CaregiverWizard` and `PatientWizard`.

```
Step 3 of 6                          ← text-secondary, left-aligned
[████████████████░░░░░░░░░░░░░░░░]   ← segmented bar
 ↑ completed: accent (#7c3aed)
               ↑ current: accent at 60% opacity
                          ↑ upcoming: surface-border rgba(255,255,255,0.12)
```

- Bar height: `4px`
- Segment gap: `gap-1` (4px)
- Segment border-radius: `2px`
- Completed segment fill animation: `200ms ease`, left-to-right
- Completed segments: `cursor: pointer`, lighten 10% on hover
- Future segments: non-interactive

## Component: QR Countdown

Used on Care Group screen after group creation.

- Timer format: `M:SS` (e.g. `9:42`)
- Timer color: `text-secondary` → transitions to `#ef4444` (red) in the last 60 seconds
- On expiry: QR image blurs (`filter: blur(4px)`), overlay shows "Code expired — tap to refresh"
- Overlay background: `rgba(0,0,0,0.6)`, tap target covers entire QR panel
- Regeneration: instant (no loading state — optimistic UI, generate new token in background)

## Patterns to Avoid

- Purple/violet gradient backgrounds (reserved for buttons only)
- Icon-in-colored-circle decoration
- Centered-everything layouts
- Cards with colored left borders
- `system-ui` or `-apple-system` as display font (use Inter explicitly)
- Placeholder-only labels (floating labels required)
