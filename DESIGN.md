---
name: CareCompanion AI
description: AI-powered health coordinator for caregivers and patients navigating complex medical situations
colors:
  midnight-base: "#0C0E1A"
  deep-cosmos: "#10112B"
  trust-indigo: "#6366F1"
  trust-indigo-hover: "#818CF8"
  calm-lavender: "#A78BFA"
  vital-cyan: "#67E8F9"
  clear-signal: "#6EE7B7"
  caution-amber: "#FCD34D"
  alert-rose: "#FCA5A5"
  text-primary: "#EDE9FE"
  text-secondary: "#A5B4CF"
  text-muted: "#5B6785"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "24px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page: "16px"
  bottom-clearance: "96px"
components:
  button-primary:
    backgroundColor: "#6366F1"
    textColor: "#EDE9FE"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "#818CF8"
    textColor: "#EDE9FE"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#A78BFA"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card-base:
    backgroundColor: "#0E1020"
    textColor: "#EDE9FE"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-elevated:
    backgroundColor: "#121428"
    textColor: "#EDE9FE"
    rounded: "{rounded.xl}"
    padding: "20px"
  input-base:
    backgroundColor: "#181826"
    textColor: "#EDE9FE"
    rounded: "{rounded.md}"
    padding: "20px 16px 8px 16px"
---

# Design System: CareCompanion AI

## 1. Overview

**Creative North Star: "The Clear Horizon"**

CareCompanion exists for people navigating one of the hardest experiences life can produce: serious illness, their own or a loved one's. The design system's job is to deliver clarity under pressure. Not the false calm of a spa app, not the clinical density of a hospital portal. The Clear Horizon means: when you open CareCompanion, the fog lifts. You can see what matters, what needs to happen next, and that you are capable of handling it.

The visual language is dark, settled, and precise. Deep indigo surfaces absorb visual noise. Lavender accents surface information without demanding attention. Glass layers create depth without heaviness. The ambient orb system provides atmosphere — the quiet hum of a system that is always working, always watching, always ready — without adding a single click of cognitive load. Motion is ambient at the system level and surgical at the component level: the background breathes slowly; interactive elements respond immediately.

This product is not a consumer wellness app, not an enterprise dashboard, and not a clinical EHR. It occupies a deliberate middle space: the organized intelligence of Linear, the human warmth of Calm, the flexible structure of Notion, filtered through the specific emotional demands of healthcare caregiving. The result is a system that feels capable and compassionate in equal measure — quietly powerful at rest, immediately responsive on interaction.

**Key Characteristics:**
- Dark-first, settled palette built from deep indigo — warmth through tinting, never coldness
- Tonal and glass layering for depth — no Material-style shadow stacks
- Indigo and lavender as primary dual-accent: trust and compassion in tandem
- Full semantic color vocabulary for health data (cyan for labs, emerald for success, rose for alerts)
- Figtree display + Noto Sans body — personality paired with precision
- Floating label inputs as the only permitted input pattern
- Ambient orbs at the system level; precise, short transitions at the component level

## 2. Colors: The Midnight Observatory Palette

A palette built from the color of the sky just after full dark — deep indigo ground, lavender and violet accents that feel personal rather than corporate, cool teal reserved for clinical data, warm emerald for safety signals. Colors are functional before they are decorative.

### Primary
- **Trust Indigo** (`#6366F1`): The primary action color. Buttons, active states, focus rings, selected navigation items. Signals confidence and forward motion. Never used decoratively.
- **Trust Indigo Hover** (`#818CF8`): Lightened hover state — clear interactive feedback without a jarring contrast shift. Transition 200ms ease-out.

### Secondary
- **Calm Lavender** (`#A78BFA`): Section headers, secondary labels, active floating input labels, the ambient orb system. Carries the emotional warmth of the palette — softer than indigo, more personal. Where indigo says "act here," lavender says "you're in the right place."

### Tertiary
- **Vital Cyan** (`#67E8F9`): Exclusively for lab results and clinical data values. Its cool, precise quality is intentional — cyan reads as objective measurement, not opinion. If a number on screen needs to feel like a reading rather than a recommendation, it uses Vital Cyan.

### Neutral
- **Midnight Base** (`#0C0E1A`): Page background. Tinted dark — just enough indigo to feel warm, never cold like pure black.
- **Deep Cosmos** (`#10112B`): Elevated sections and the warm background layer. Cards, sidebars, and surfaces one level above the base sit here.
- **Text Primary** (`#EDE9FE`): Main content. Warm white with a violet tint — never pure white, which would feel clinical.
- **Text Secondary** (`#A5B4CF`): Labels, supporting text, field metadata. Neutral and legible against dark surfaces.
- **Text Muted** (`#5B6785`): Captions, timestamps, de-emphasized content. Never used for anything the user needs to act on.

### Status Colors
- **Clear Signal** (`#6EE7B7`): Success states, "on track" indicators, adherence confirmation. Soft emerald — reassuring without being congratulatory in a context where illness is real.
- **Caution Amber** (`#FCD34D`): Upcoming tasks, mild alerts, "due soon" states. Warm and attention-drawing without alarm.
- **Alert Rose** (`#FCA5A5`): Errors, critical health alerts, missed medications. Warm red — serious without being aggressive.

### Named Rules
**The Semantic Lock Rule.** Vital Cyan is for clinical data only. Clear Signal is for success states only. Alert Rose is for genuine alerts only. Status colors are never used decoratively. A user who learns to read color signals in this system must never be deceived by a decorative application of the same hue.

**The Indigo Restraint Rule.** Trust Indigo appears on interactive elements: buttons, links, focus states, selected items. It does not appear as a background fill, gradient overlay, or decorative surface tint. Its scarcity is the point. When the user sees indigo, something is actionable.

## 3. Typography

**Display Font:** Figtree (with `system-ui, sans-serif` fallback)
**Body Font:** Noto Sans (with `system-ui, sans-serif` fallback)

**Character:** Figtree's rounded geometry reads warm and approachable — it carries the personality of the product in headings without sacrificing clarity. Noto Sans is the workhorse: neutral, universally legible, and calm under dense information load. The pairing feels human at a glance, precise on second read. Both are loaded via `next/font` — they are load-bearing, not decorative.

### Hierarchy
- **Display** (Figtree, 700, `clamp(1.5rem, 4vw, 2rem)`, line-height 1.2, tracking -0.01em): Page titles and primary screen headings. One per screen, maximum. Critical health data values also use this scale, colored with the appropriate semantic token.
- **Headline** (Figtree, 600, 1.125rem / 18px, line-height 1.4): Section headings, feature card titles. The primary hierarchy marker within a screen.
- **Title** (Figtree, 600, 1rem / 16px, line-height 1.5): Card titles, list item headers, navigation labels. The most frequently appearing heading scale.
- **Body** (Noto Sans, 400, 0.875rem / 14px, line-height 1.6): All body copy, descriptions, chat messages. Max line length 65ch on wider breakpoints.
- **Label** (Noto Sans, 500, 0.75rem / 12px, letter-spacing 0.01em, line-height 1.4): Metadata, timestamps, field labels, badge text. Never used for prose.

### Named Rules
**The Figtree Boundary Rule.** Figtree handles personality; Noto Sans handles information. Figtree is not used for body copy, form field text, or data table values. The register separation is intentional: warmth in headings, precision in content.

**The Data Size Rule.** Prominent health data values — medication dosages, lab numbers, appointment times — are set at Display scale in Figtree, colored with the appropriate semantic token. A number a caregiver needs to read in a hurry must be impossible to miss.

## 4. Elevation

CareCompanion uses tonal and glass layering for depth — not box-shadow elevation hierarchies. Surfaces stack through transparency: Midnight Base is the ground; cards sit above it via `rgba(167,139,250,0.04–0.08)`; modals and elevated panels use the Deep Cosmos background. The ambient orb system at `z-0` provides atmospheric depth beneath all surfaces.

Shadows exist only as ambient glow effects on featured or active elements — colored glows in indigo, lavender, or cyan that signal state, not stacking position.

### Shadow Vocabulary
- **Glow — Indigo** (`0 0 0 1px rgba(99,102,241,0.3), 0 0 20px rgba(99,102,241,0.15)`): Active states, selected cards, primary focus treatment.
- **Glow — Lavender** (`0 0 0 1px rgba(167,139,250,0.25), 0 0 20px rgba(167,139,250,0.1)`): Featured cards, ambient highlights.
- **Glow — Cyan** (`0 0 0 1px rgba(103,232,249,0.2), 0 0 16px rgba(103,232,249,0.1)`): Lab result panels when highlighted.
- **Hover Lift** (`translateY(-2px)` + `--shadow-md`): Interactive card hover state. Transform only — shadow color does not change on hover.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Glow shadows appear only in response to state: active card, selected navigation, featured panel. A card that is not being interacted with has no shadow. The interface is quiet when nothing needs attention.

**The No Decorative Shadow Rule.** Box shadows that exist purely for visual hierarchy (the Material Design elevation stack) are absent from this system. A shadow in CareCompanion communicates state, not position. If a surface needs to feel elevated at rest, use a higher-opacity background tint, not a shadow.

## 5. Components

### Buttons
Quietly powerful. Substantial weight, confident fill, no decorative elements. The button earns attention through placement and label, not through elaborate visual treatment.

- **Shape:** Gently rounded (14px — `--radius-md`). Substantial, not pill-shaped.
- **Primary:** Trust Indigo background (`#6366F1`), Text Primary color (`#EDE9FE`), 14px top/bottom padding. Transitions to `#818CF8` on hover in 200ms ease-out. Scales to 0.97 on active (`.btn-press` class). Full-width on mobile, auto-width on desktop.
- **Focus:** `ring-2 ring-indigo-500/60` — visible, unobtrusive.
- **Disabled:** `opacity: 0.4`, `cursor: not-allowed`. No color change — opacity reduction preserves visual hierarchy while communicating unavailability.
- **Ghost:** Transparent background, `--calm-lavender` text, same radius and padding. No border at rest; `rgba(167,139,250,0.3)` border on hover.

### Cards / Containers
Cards are information trays, not decorative surfaces. They hold content; they do not compete with it.

- **Corner Style:** 20px radius (`--radius-lg`) for standard cards; 24px (`--radius-xl`) for modals and large feature panels.
- **Background:** `rgba(167,139,250,0.04)` at rest; `rgba(167,139,250,0.08)` on hover or elevated state.
- **Shadow Strategy:** None at rest. Indigo glow on active or selected. `translateY(-2px)` hover lift on interactive cards (`.card-hover-lift` utility class).
- **Border:** `rgba(167,139,250,0.12)` 1px at rest. Never colored differently at rest.
- **Internal Padding:** 16px standard; 20px for feature panels.

### Inputs / Fields
Floating label is the only permitted input pattern. Placeholder-only labels are prohibited.

- **Style:** `rgba(255,255,255,0.06)` background, `rgba(255,255,255,0.12)` 1px border, 14px radius (`--radius-md`). Padding `pt-5 pb-2 px-4` to accommodate the floating label above input text.
- **Floating Label:** 14px, `--text-muted` at rest; animates to 10px, `--calm-lavender` on focus or fill. Transition: 150ms ease-out on font-size and color.
- **Focus:** Border shifts to `rgba(99,102,241,0.6)`; `ring-2 ring-indigo-500/60` visible focus ring.
- **Error:** Rose-tinted border (`rgba(252,165,165,0.6)`); error message below in `--alert-rose`, 12px Noto Sans.
- **Disabled:** `opacity: 0.4`.

### Navigation (Bottom Tab Bar)
Mobile-first. Fixed bottom with 96px clearance required on all page containers.

- **Background:** Glass surface with `backdrop-blur`. Subtle top border `rgba(167,139,250,0.15)`.
- **Default state:** Icon + label at `--text-muted`.
- **Active state:** Icon + label shift to `--trust-indigo`; `.animate-tab-glow` (lavender pulse, 2s cycle) on the active indicator.
- **Tap feedback:** `.animate-tab-bounce` — 0.4s, exponential ease-out. No bounce, no elastic.

### Signature Component: Ambient Background
Fixed, full-screen, `z-0`, pointer-events-none. Four radial gradient orbs on 40–55s animation cycles with staggered start offsets. Colors: indigo top-right, lavender bottom-left, blue center, violet bottom-right. Opacity 0.5, blur 80px.

Rendered once in the app shell only. Never imported inside a page or feature component.

### Signature Component: Wizard Progress Bar
Used in onboarding flows for caregivers and patients.

- Segmented bar, 4px height, 2px radius per segment, `gap-1` between segments
- Completed segments: Trust Indigo (`#6366F1`); current: Trust Indigo at 60% opacity; upcoming: `rgba(255,255,255,0.12)`
- Completed segment fill animation: 200ms ease, left-to-right
- Completed segments: `cursor: pointer`, lighten 10% on hover. Future segments: non-interactive.
- Step label above bar: `text-secondary`, left-aligned.

## 6. Do's and Don'ts

### Do:
- **Do** use CSS custom properties (`--bg`, `--text`, `--accent`, `--border`) for all color values. Never hardcode hex in component code.
- **Do** pair every color-coded status signal with an icon or text label. Color blindness must not impede health information.
- **Do** apply `pb-24` (96px) to every app page container for bottom tab bar clearance.
- **Do** use floating labels on all form inputs. The label must be visible before focus, during focus, and after fill.
- **Do** wrap all keyframe animations in `@media (prefers-reduced-motion: no-preference)`. Entrance and ambient animations freeze gracefully when reduced motion is enabled.
- **Do** use Figtree for headings, Noto Sans for body text and data values.
- **Do** set medication names, dosages, and critical health values at 16px minimum in Figtree with the appropriate semantic color.
- **Do** test every new component in both dark and light mode via `[data-theme="light"]` — no Tailwind `dark:` variants.
- **Do** keep `<AmbientBackground />` in the app shell only. Never import it inside a page or feature component.
- **Do** add new `@keyframes` to `globals.css`, not inside component files.

### Don't:
- **Don't** design like Epic or MyChart. Sterile hospital EHR density — cold tables, no warmth, designed for billing — is the exact opposite of this system's intent.
- **Don't** reach for generic SaaS dashboard patterns. No hero metrics, no blue gradient analytics templates, no stat blocks designed to impress rather than inform.
- **Don't** gamify. No streaks, no score badges, no "Great job!" copy. The users of this app are dealing with serious illness. Motivational UI is tone-deaf in this context.
- **Don't** use neon colors or aggressive glow effects. Alert Rose and Vital Cyan have specific semantic roles — they are not available for decoration.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards, alerts, or list items. Use background tints, leading icons, or full borders instead.
- **Don't** apply gradient text (`background-clip: text` with a gradient background). Use a single solid semantic color.
- **Don't** use glassmorphism decoratively. Glass surfaces are used for elevated surfaces that need to float above the page — not as a default style applied to every container.
- **Don't** use purple or violet gradient backgrounds. Gradient fills belong exclusively to primary buttons.
- **Don't** use icon-in-colored-circle decoration. It reads as a fitness app or consumer wellness tool — wrong register.
- **Don't** nest cards. A card inside a card is always wrong. Restructure with list rows, dividers, or transparent inner sections.
- **Don't** center-align prose or list content. Centered text appears only in modal headers and empty states.
- **Don't** use `system-ui` or `-apple-system` as the display font. Figtree must load via `next/font` — it is load-bearing.
