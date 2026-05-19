# Accessibility Audit — CareCompanion Web

**Date:** 2026-05-18  
**Scope:** `apps/web/src/components/` + `apps/web/src/app/`  
**Method:** Static source-code analysis (no live site)  
**Auditor:** Automated + manual review

---

## Summary

| Metric | Count |
|--------|-------|
| TSX/JSX files scanned | 155 |
| Total issues found | 22 |
| Critical (breaks screen-reader access) | 8 |
| Major (degraded keyboard/AT experience) | 9 |
| Minor (best-practice gaps) | 5 |
| Auto-fixed | 12 |
| Needs manual review | 10 |

**Overall posture:** The codebase has strong a11y foundations — 107 `aria-label` uses, 11 `aria-live` regions, 54 `role` attributes, and good keyboard support patterns. The violations are concentrated in form inputs and modal overlays.

---

## Auto-Fixed

All fixes were surgical additions of `aria-label`, `type="button"`, or `aria-hidden="true"` — no logic changes.

| File | Line | Before | After |
|------|------|--------|-------|
| `components/SymptomJournal.tsx` | 214 | `<input type="range" …>` (no label) | `aria-label="Pain Level, 0 to 10"` added |
| `components/SymptomJournal.tsx` | 229 | `<input type="range" …>` (no label) | `aria-label="Nausea Level, 0 to 10"` added |
| `components/SymptomJournal.tsx` | 244 | `<input type="range" …>` (no label) | `aria-label="Fatigue Level, 0 to 10"` added |
| `components/SymptomJournal.tsx` | 281 | `<input type="number" …>` (no label) | `aria-label="Hours Slept"` added |
| `components/SymptomJournal.tsx` | 349 | `<input type="text" …>` (no label) | `aria-label="Search journal entries"` added |
| `components/SymptomJournal.tsx` | 357 | `<input type="date" …>` (no label) | `aria-label="Filter from date"` added |
| `components/SymptomJournal.tsx` | 364 | `<input type="date" …>` (no label) | `aria-label="Filter to date"` added |
| `components/CheckinModal.tsx` | 176 | `<input type="range" …>` (no label) | `aria-label="Pain level, 0 to 10"` added |
| `components/NotificationBell.tsx` | 147 | `<button onClick={markAllRead}>` (no type) | `type="button"` added |
| `components/NotificationBell.tsx` | 186 | `<button onClick={() => dismiss(…)}>` (no type) | `type="button"` added |
| `components/MilestoneCelebration.tsx` | 50 | `<div … onClick={onClose}>` (no aria-hidden) | `aria-hidden="true"` added |
| `components/BottomTabBar.tsx` | 170 | Icon wrapper `<div>` without `aria-hidden` | `aria-hidden="true"` added (text label present) |
| `components/BottomSheet.tsx` | 35 | Backdrop `<div … onClick={onClose}>` (no aria-hidden) | `aria-hidden="true"` added |
| `components/DocumentOrganizer.tsx` | 231 | `<input type="text" …>` (no label) | `aria-label="Search documents"` added |
| `components/DocumentOrganizer.tsx` | 297 | Sort menu backdrop `<div … onClick>` (no aria-hidden) | `aria-hidden="true"` added |
| `components/DocumentOrganizer.tsx` | 368 | Recategorize menu backdrop `<div … onClick>` (no aria-hidden) | `aria-hidden="true"` added |
| `components/GlobalSearch.tsx` | 211 | `<input type="text" …>` (no label) | `aria-label="Search health data"` added |

---

## Needs Review

These cases require developer judgment before fixing — context may make them acceptable or the fix requires deeper refactoring.

### MAJOR

**1. `components/CheckinModal.tsx` lines 148, 197, 219 — Visual label headings not programmatically associated**
- `<label>` elements for Mood, Energy, and Sleep sections have no `htmlFor` and don't wrap the controls
- Screen readers will not associate the section heading with the buttons
- **Suggestion:** Wrap each section in `<fieldset>` + `<legend>` (replaces the `<label>`) or use `role="group"` with `aria-labelledby` on an `id`'d heading

```tsx
// Before
<label className="…">Mood</label>
<div className="flex gap-2 justify-between">
  {MOOD_EMOJIS.map(…)}
</div>

// Suggested
<fieldset className="mb-5">
  <legend className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
    Mood
  </legend>
  <div className="flex gap-2 justify-between">
    {MOOD_EMOJIS.map(({ value, emoji }) => (
      <button key={value} onClick={() => setMood(value)} aria-pressed={mood === value}>
        {emoji}
      </button>
    ))}
  </div>
</fieldset>
```

**2. `components/SymptomJournal.tsx` lines 211, 226, 241, 256, 270, 292 — Visual labels not programmatically associated**
- Same issue as CheckinModal: `<label>` elements for Pain, Nausea, Fatigue, Mood, Sleep, Energy have no `htmlFor`
- The range inputs now have `aria-label` (auto-fixed), but the `<label>` + `<input>` pairing is still broken for screen readers announcing "you are inside a labeled group"
- **Suggestion:** Add `id` to each range input and matching `htmlFor` to each label, OR convert to `fieldset`/`legend` for radio/button groups

**3. `components/VisitPrepView.tsx` and `components/VisitPrepSheet.tsx` — Checkboxes lack `id` for explicit association**
- Checkboxes use the implicit label wrapping pattern (`<label><input/><span/></label>`)
- This is valid HTML and most screen readers support it, but explicit `htmlFor`+`id` is more robust
- **Suggestion:** Add `id={`checkbox-${i}`}` to inputs and `htmlFor={`checkbox-${i}`}` to labels when `key` is available

**4. `components/CareView.tsx` lines 192, 253, 258 — External links missing `rel="noopener"` or target context**
- `tel:` and `maps.google.com` links open a new context without announcing it to screen readers
- **Suggestion:** Add `aria-label` with destination hint, e.g., `aria-label="Call pharmacy (opens phone dialer)"` or `aria-label="Get directions (opens in Maps)"`

**5. `app/(app)/community/[id]/page.tsx` and `app/(app)/community/page.tsx` — Unreviewed button types**
- These files contain `<form>` + `<button>` combos not reviewed (Rahil ownership area)
- **Action:** Rahil to audit these pages for missing `type="button"` on non-submit buttons

### MINOR

**6. `app/not-found.tsx` line 7 — Potential low-contrast text**
- `text-slate-300` used on a presumably dark background — this is likely fine in dark mode but should be verified with a contrast checker
- If background is `#0a0814`, `slate-300` (#CBD5E1) gives ~9:1 contrast — acceptable
- **Flag:** Confirm background color in context; not a required fix

**7. `components/TrialDetailPanel.tsx` lines 85, 90 — Email/phone links show raw data**
- `<a href="mailto:…">` and `<a href="tel:…">` render the raw address/number as link text
- This is adequate for sighted users but a screen reader will read out the raw email/phone
- **Suggestion:** Wrap in a visually-hidden span with a friendly label, or add `aria-label`

**8. `components/MilestoneCelebration.tsx` — Modal missing `aria-modal` and focus trap**
- Modal opens over content but lacks `role="dialog"`, `aria-modal="true"`, and focus trap
- Keyboard users can Tab behind the modal
- **Suggestion:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="milestone-title"
  className="relative w-full max-w-sm …"
>
  <h3 id="milestone-title" …>{milestone.title}</h3>
```

**9. `components/AdherenceCalendar.tsx` line 88 — Popup dialog missing `aria-describedby`**
- `role="dialog"` popup has `aria-label` but no `aria-describedby` for the content
- Minor improvement for screen readers
- **Suggestion:** Add `id` to the content div and `aria-describedby` to the dialog

**10. `components/TimelineNode.tsx` line 178 — `<div onClick>` with stopPropagation only**
- Inner div at line 178 stops propagation but has no ARIA role for its interactive children
- Investigate whether this div itself is interactive or just a container

---

## Top 10 Priority Manual Fixes (with code suggestions)

### P1 — CheckinModal: Mood/Energy/Sleep button groups (WCAG 1.3.1 — Critical)
**File:** `components/CheckinModal.tsx`  
Replace `<label>` headings with `<fieldset>/<legend>` and add `aria-pressed` to mood/energy/sleep buttons so screen readers announce selection state.

```tsx
// For mood section (pattern applies to energy and sleep too):
<fieldset className="mb-5">
  <legend className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
    Mood
  </legend>
  <div className="flex gap-2 justify-between">
    {MOOD_EMOJIS.map(({ value, emoji }) => (
      <button
        key={value}
        type="button"
        onClick={() => setMood(value)}
        aria-pressed={mood === value}
        aria-label={`Mood: ${value}`}
        className={…}
      >
        {emoji}
      </button>
    ))}
  </div>
</fieldset>
```

### P2 — SymptomJournal: Label/input association (WCAG 1.3.1 — Critical)
**File:** `components/SymptomJournal.tsx`  
Add `id` to range inputs and `htmlFor` to their labels:

```tsx
// Pain level section
<label htmlFor="sj-pain" className="…">Pain Level</label>
<input
  id="sj-pain"
  type="range" min="0" max="10" value={painLevel}
  aria-label="Pain Level, 0 to 10"  {/* already fixed, keep as fallback */}
  …
/>
// Repeat for nausea (sj-nausea), fatigue (sj-fatigue)
```

### P3 — MilestoneCelebration: Add dialog role + focus trap (WCAG 2.1.2 — Critical)
**File:** `components/MilestoneCelebration.tsx`  
Wrap modal content in `role="dialog"` with focus management:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="milestone-title"
  className="relative w-full max-w-sm rounded-2xl …"
>
  <h3 id="milestone-title" className="text-lg font-bold …">{milestone.title}</h3>
  …
</div>
```

### P4 — CareView: Annotate external protocol links (WCAG 2.4.6 — Major)
**File:** `components/CareView.tsx` lines 192, 253, 258  

```tsx
<a
  href={`tel:${med.pharmacyPhone}`}
  aria-label={`Call pharmacy at ${med.pharmacyPhone}`}
  className="…"
>
  Call Pharmacy
</a>

<a
  href={`https://maps.google.com/?q=…`}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={`Get directions to ${appt.location} (opens in Maps)`}
  className="…"
>
  Directions
</a>
```

### P5 — TrialDetailPanel: Accessible contact links (WCAG 2.4.6 — Major)
**File:** `components/trials/TrialDetailPanel.tsx` lines 85, 90  

```tsx
<a href={`mailto:${contact.email}`} aria-label={`Email ${contact.email}`} …>
  {contact.email}
</a>
<a href={`tel:${contact.phone}`} aria-label={`Call ${contact.phone}`} …>
  {contact.phone}
</a>
```

### P6 — Community pages: Button type audit (WCAG 4.1.1 — Major)
**File:** `app/(app)/community/[id]/page.tsx`, `app/(app)/community/page.tsx`  
These pages (Rahil ownership) contain forms with buttons. All `<button>` elements inside `<form>` that are not submit buttons must have `type="button"`. Do a targeted audit:

```bash
grep -n "<button" apps/web/src/app/\(app\)/community/ --include="*.tsx" -r | grep -v "type="
```

### P7 — CheckinModal: Missing `type="button"` on mood/energy/sleep buttons (WCAG 4.1.1 — Major)
**File:** `components/CheckinModal.tsx` lines 153, 202, 273  
The mood, energy, and sleep option buttons inside the modal form have no `type` attribute. If this modal is ever inside a `<form>`, they will submit it unintentionally:

```tsx
<button type="button" key={value} onClick={() => setMood(value)} …>
```

### P8 — SymptomJournal mood/sleep/symptom buttons missing type + aria-pressed (WCAG 4.1.2 — Major)
**File:** `components/SymptomJournal.tsx` lines 259, 273, 319  
Toggle buttons for mood, sleep quality, and symptoms lack `type="button"` and `aria-pressed`:

```tsx
<button
  key={key}
  type="button"
  onClick={() => setMood(key)}
  aria-pressed={mood === key}
  title={key}
>
  {label}
</button>
```

### P9 — AdherenceCalendar: Popup dialog completeness (WCAG 4.1.3 — Minor)
**File:** `components/AdherenceCalendar.tsx` line 88  
The popup dialog has `role="dialog"` and `aria-label` but lacks `aria-describedby` for the content area. Add an `id` to the content div and reference it:

```tsx
<div role="dialog" aria-label={`Details for ${formatted}`} aria-describedby="cal-popup-content">
  <div id="cal-popup-content">
    {/* popup content */}
  </div>
```

### P10 — Global: `aria-live` for streaming chat (already present — verify behavior)
**File:** `components/ChatInterface.tsx` line 265  
`role="log"` with `aria-live="polite"` is already implemented. However, AT (assistive technology) may announce every streamed token individually.  
**Suggestion:** Consider `aria-live="off"` on the message container and `aria-live="polite"` on a separate status region that announces when streaming completes:

```tsx
{/* Streaming status for AT — only announces completion */}
<div className="sr-only" aria-live="polite" aria-atomic="true">
  {isStreaming ? '' : lastMessageId ? 'Response received' : ''}
</div>
```

---

## Positive Patterns (Preserve These)

- **AppShell.tsx** — Skip-to-content link correctly implemented with `sr-only focus:not-sr-only`
- **NotificationBell.tsx** — Bell button uses `aria-expanded`, `aria-haspopup="dialog"`, and dynamic `aria-label` with unread count
- **ChatInterface.tsx** — Chat log uses `role="log"` with `aria-live="polite"`; error region uses `role="alert"` with `aria-live="assertive"`
- **DocumentOrganizer.tsx** — Filter tabs use `role="tablist"` + `aria-label`; view toggle buttons have `aria-label`
- **LoginForm.tsx / SignupForm.tsx / ResetConfirmForm.tsx** — Password toggle buttons consistently use `aria-label` + `type="button"`
- **BottomTabBar.tsx** — Nav landmark with `aria-label`; links use `aria-current="page"` for active state
- **Toast.tsx** — Uses `role="alert"` with `aria-live="polite"` ✓
- **CareGroupScreen.tsx** — Dynamic status uses `role="status"` + `aria-live="polite"` ✓
- **AdherenceCalendar.tsx** — Backdrop overlay correctly uses `aria-hidden="true"` ✓
