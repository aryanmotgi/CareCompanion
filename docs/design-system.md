# CareCompanion Design System

> Last updated: 2026-04-20  
> Covers: color tokens, typography, backgrounds, spacing, cards, emojis, animations

---

## 1. Design Language

CareCompanion uses a **dark-first, warm-purple** palette. The mood is calm and clinical — not sterile. Key characteristics:

- Deep indigo/navy backgrounds (not pure black)
- Soft lavender + indigo accents (trust + compassion)
- Gentle ambient glow effects, never harsh
- Rounded corners everywhere — nothing hard-edged
- Emojis as lightweight icons in action lists and insight bullets (not for decoration)

Both dark and light modes are fully supported via CSS variables. Always use the CSS variable tokens — never hardcode hex values in components.

---

## 2. Color Tokens

All tokens are defined in `src/app/globals.css` as CSS custom properties. Always reference via `var(--token-name)` or the Tailwind `[var(--...)]` escape.

### Backgrounds

| Token | Dark value | Light value | Use |
|---|---|---|---|
| `--bg` | `#0C0E1A` | `#F8F9FC` | Page background |
| `--bg-warm` | `#10122B` | `#FFFFFF` | Elevated sections, sidebars |
| `--bg-card` | `rgba(167,139,250,0.04)` | `rgba(99,102,241,0.04)` | Card/panel fills |
| `--bg-elevated` | `rgba(167,139,250,0.08)` | `rgba(99,102,241,0.06)` | Hover states, active items |
| `--bg-glass` | `rgba(139,92,246,0.05)` | `rgba(99,102,241,0.03)` | Frosted/glass overlays |

### Accents

| Token | Value | Use |
|---|---|---|
| `--accent` | `#6366F1` (indigo) | Primary buttons, links, focus rings |
| `--accent-hover` | `#818CF8` | Button hover |
| `--accent-light` | 15% indigo | Chip backgrounds, badge fills |
| `--accent-glow` | 25% indigo | Box shadows on focus/active |
| `--lavender` | `#A78BFA` | Secondary accent, section headers, icons |
| `--lavender-light` | 15% lavender | Muted chip fills |
| `--cyan` | `#67E8F9` | Lab results, data values |
| `--emerald` | `#6EE7B7` | Success states, "on track" indicators |
| `--amber` | `#FCD34D` | Warnings, upcoming deadlines |
| `--rose` | `#FCA5A5` | Errors, overdue, critical alerts |

### Text

| Token | Use |
|---|---|
| `--text` | Primary body text (`#EDE9FE` dark / `#1E1B4B` light) |
| `--text-secondary` | Supporting text, labels |
| `--text-muted` | Placeholder, captions, timestamps |

Never use raw `text-white` for body copy — use `text-[var(--text)]`. `text-white` is acceptable only for display headings (`h1`) on dark backgrounds.

### Borders

| Token | Use |
|---|---|
| `--border` | Default card/divider borders (very subtle, ~8% opacity) |
| `--border-hover` | Interactive element hover (18% opacity) |
| `--border-glow` | Focus ring, selected state |

---

## 3. Typography

### Fonts

| Family | Tailwind class | Use |
|---|---|---|
| Figtree | `font-display` | Page titles, card headings, logo |
| Source Sans | `font-sans` | Body text, labels, paragraphs |

Both are loaded via `next/font` and referenced through CSS variables `--font-figtree` and `--font-source-sans`.

### Type Scale (standard uses)

| Element | Classes |
|---|---|
| Page title (h1) | `font-display text-2xl font-bold text-white` |
| Page subtitle | `text-sm text-[var(--text-muted)]` |
| Section heading (h2) | `font-display text-lg font-semibold text-[var(--text)]` |
| Card title | `font-display text-base font-semibold text-[var(--text)]` |
| Body / labels | `text-sm text-[var(--text-secondary)]` |
| Captions / timestamps | `text-xs text-[var(--text-muted)]` |
| Data value (prominent) | `font-display text-2xl font-bold text-[var(--cyan)]` |

---

## 4. Page Layout

### Standard page shell

```tsx
<div className="min-h-screen bg-[var(--bg)] pb-24">
  <div className="max-w-2xl mx-auto px-4 pt-8 pb-6">
    {/* Page header */}
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold text-white mb-1">
        Page Title
      </h1>
      <p className="text-sm text-[var(--text-muted)]">
        Supporting description.
      </p>
    </div>
    {/* Content */}
  </div>
</div>
```

- `pb-24` — always; bottom tab bar overlaps content
- `max-w-2xl` — standard content width
- `px-4 pt-8` — standard horizontal + top padding

For pages rendered inside the app shell (bottom nav layout), the ambient background orbs are added by `<AmbientBackground />` which is included in the app shell — do not re-add it per page.

### Page grid texture

For pages that want the subtle grid overlay:

```tsx
<div className="min-h-screen bg-[var(--bg)] page-grid pb-24">
```

`page-grid` adds a very faint crosshatch (2.5% opacity lines, 72px grid). Use it on landing/marketing-style pages. App interior pages generally omit it.

---

## 5. Cards & Panels

### Base card

```tsx
<div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4">
```

### Hover card (interactive)

```tsx
<div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4
                card-hover-lift hover:border-[var(--border-hover)]">
```

`card-hover-lift` (defined in `globals.css`) translates the card up 2px and deepens the shadow on hover.

### Elevated / glass card

```tsx
<div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-xl)] p-5">
```

### Radius reference

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 10px | Chips, badges, small pills |
| `--radius-md` | 14px | Input fields, small cards |
| `--radius-lg` | 20px | Standard cards, panels |
| `--radius-xl` | 24px | Modal sheets, large feature cards |

---

## 6. Shadows & Glows

| Token | Use |
|---|---|
| `--shadow-sm` | Default card drop shadow |
| `--shadow-md` | Modals, bottom sheets, popovers |
| `--shadow-glow` | Indigo glow on featured/active cards |
| `--shadow-glow-cyan` | Glow on data/lab cards |
| `--shadow-glow-violet` | Glow on secondary accent cards |

```tsx
// Example: active card with glow
style={{ boxShadow: 'var(--shadow-glow)' }}
```

---

## 7. Ambient Background

`<AmbientBackground />` renders four blurred, slow-animated radial gradient orbs fixed to the viewport:

- Indigo orb — top right (trust, primary)
- Lavender orb — bottom left (compassion, secondary)
- Soft blue orb — center
- Faint violet orb — bottom right

It is `pointer-events-none`, `z-0`, and `aria-hidden`. The app shell includes it globally; do not add it to individual pages or components.

---

## 8. Emojis

**Never use emojis.** CareCompanion is a medical-grade care coordination tool. Emojis undermine the professional, clinical tone the product requires.

- Do not add emoji to any UI text, action lists, insight bullets, labels, or headings
- Do not use emoji in internal agent/specialist context strings (LLM prompts, synthesized context)
- For visual cues in list items, use a small SVG icon or a `w-1 h-1 rounded-full bg-[#A78BFA]` bullet dot instead

```tsx
// Correct — lavender bullet dot
<div className="flex items-start gap-2.5">
  <div className="w-1 h-1 rounded-full bg-[#A78BFA] mt-1.5 flex-shrink-0" />
  <span className="text-xs text-[var(--text-secondary)] leading-relaxed">{step.text}</span>
</div>
```

For section or category icons (e.g., medications, labs), use inline SVG paths — see `src/app/shared/[token]/page.tsx` for examples of `MedIcon`, `LabIcon`, etc.

---

## 9. Animations

All keyframes and utility classes are defined in `globals.css` — do not add one-off `@keyframes` in component files.

| Class | Effect | Use |
|---|---|---|
| `animate-card-in` | Fade + slide up (0.4s) | Card enter, list stagger |
| `animate-page-in` | Page fade-in | Route transitions |
| `card-hover-lift` | Translate up 2px on hover | Interactive cards |
| `animate-glow-pulse` | Red glow pulse | Critical alert badges |
| `animate-blob-1/2/3/4` | Slow ambient blob movement | `AmbientBackground` only |
| `animate-shake` | Horizontal shake | Disabled state feedback |

---

## 10. Bottom Tab Bar Clearance

The bottom tab bar is approximately 80–88px tall. Every page must have `pb-24` (96px) on the outermost container to prevent content from being clipped behind the nav. Loading skeletons must also respect this.

---

## 11. Light Mode

All CSS variable tokens automatically switch when `[data-theme="light"]` is set on the root. Rules:

- Never use `dark:` Tailwind variants — the theme system uses `[data-theme]`, not `prefers-color-scheme` or the Tailwind `dark` class
- Test new components in both modes
- WCAG AA contrast required: `--text-secondary` on dark backgrounds is `#94a3b8`, not the lighter `#64748b`

---

## 12. Adding New UI Sections

Checklist for a new page or major component:

- [ ] Page shell uses `min-h-screen bg-[var(--bg)] pb-24`
- [ ] Title: `font-display text-2xl font-bold text-white`
- [ ] Subtitle: `text-sm text-[var(--text-muted)]`
- [ ] All colors use `var(--token)` — no raw hex
- [ ] Cards use `--bg-card` + `--border` + `--radius-lg`
- [ ] New animation added to `globals.css`, not inline
- [ ] Emoji usage follows the semantic map above
- [ ] Light mode tested
- [ ] No additional `<AmbientBackground />` added (it's global)
