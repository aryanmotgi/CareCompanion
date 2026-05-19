# A11Y P1 Fixes Applied

**Date:** 2026-05-19  
**Branch:** `aryan/feature/a11y-p1-fixes`  
**Source audit:** `A11Y_AUDIT.md` (2026-05-18)

---

## Fix 1 — CheckinModal: Fieldset/Legend Refactor (WCAG 1.3.1 Critical)

**File:** `apps/web/src/components/CheckinModal.tsx`

### Mood group
| | Detail |
|---|---|
| **Before** | `<div><label>Mood</label><div><button onClick…>` — `<label>` not associated with buttons; buttons had no `type` or selection state |
| **After** | `<fieldset><legend>Mood</legend><div><button type="button" aria-pressed={mood === value} aria-label="Mood: N">` |

### Energy group
| | Detail |
|---|---|
| **Before** | `<div><label>Energy</label><div><button onClick…>` |
| **After** | `<fieldset><legend>Energy</legend><div><button type="button" aria-pressed={energy === opt} aria-label="Energy: opt">` |

### Sleep group
| | Detail |
|---|---|
| **Before** | `<div><label>Sleep</label><div><button onClick…>` |
| **After** | `<fieldset><legend>Sleep</legend><div><button type="button" aria-pressed={sleep === opt} aria-label="Sleep quality: opt">` |

---

## Fix 2 — MilestoneCelebration: Dialog Role + Focus Trap (WCAG 2.1.2 Critical)

**File:** `apps/web/src/components/MilestoneCelebration.tsx`

| | Detail |
|---|---|
| **Before** | Modal `<div>` had no `role`, no `aria-modal`, no focus management; Tab could escape to content behind modal |
| **After** | Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="milestone-title"`, `tabIndex={-1}` to modal container; added `id="milestone-title"` to `<h3>`; added focus trap via `useRef`/`useEffect` (moves focus to first focusable on open, restores to opener on close, cycles Tab/Shift+Tab within modal); added Escape key handler to close |

---

## Fix 3 — Remaining P-items from Audit (non-community, concrete suggestions)

### P2 — SymptomJournal: Label/input association (WCAG 1.3.1 Critical)

**File:** `apps/web/src/components/SymptomJournal.tsx`

| Field | Before | After |
|---|---|---|
| Pain Level | `<label>` no `htmlFor`; `<input type="range">` no `id` | `<label htmlFor="sj-pain">` + `<input id="sj-pain">` |
| Nausea Level | same gap | `<label htmlFor="sj-nausea">` + `<input id="sj-nausea">` |
| Fatigue Level | same gap | `<label htmlFor="sj-fatigue">` + `<input id="sj-fatigue">` |

### P8 — SymptomJournal: Toggle buttons type + aria-pressed (WCAG 4.1.2 Major)

**File:** `apps/web/src/components/SymptomJournal.tsx`

| Group | Before | After |
|---|---|---|
| Mood buttons | `<button onClick>` — no `type`, no pressed state | `<button type="button" aria-pressed={mood === key}>` |
| Sleep Quality buttons | `<button onClick>` — no `type`, no pressed state | `<button type="button" aria-pressed={sleepQuality === key}>` |
| Symptom toggle buttons | `<button onClick>` — no `type`, no pressed state | `<button type="button" aria-pressed={symptoms.includes(s)}>` |

### P4 — CareView: External protocol links (WCAG 2.4.6 Major)

**File:** `apps/web/src/components/CareView.tsx`

| Link | Before | After |
|---|---|---|
| `tel:${med.pharmacyPhone}` | No context label for screen readers | `aria-label="Call pharmacy at {phone}"` |
| `tel:${doctorPhone}` | No context label | `aria-label="Call doctor's office at {phone}"` |
| `maps.google.com/?q=…` | No destination/new-context hint | `aria-label="Get directions to {location} (opens in Maps)"` |

### P5 — TrialDetailPanel: Contact links (WCAG 2.4.6 Major)

**File:** `apps/web/src/components/trials/TrialDetailPanel.tsx`

| Link | Before | After |
|---|---|---|
| `mailto:${contact.email}` | Reads raw email address only | `aria-label="Email {email}"` |
| `tel:${contact.phone}` | Reads raw phone number only | `aria-label="Call {phone}"` |

### P9 — AdherenceCalendar: Popup dialog completeness (WCAG 4.1.3 Minor)

**File:** `apps/web/src/components/AdherenceCalendar.tsx`

| | Before | After |
|---|---|---|
| Dialog element | `role="dialog"` + `aria-label` only | Added `aria-describedby="cal-popup-content"` |
| Content div | No `id` | Added `id="cal-popup-content"` |

### P10 — ChatInterface: Streaming aria-live (WCAG 4.1.3 Minor)

**File:** `apps/web/src/components/ChatInterface.tsx`

| | Before | After |
|---|---|---|
| Message log | `role="log"` with `aria-live="polite"` — every streamed token announced | Changed log to `aria-live="off"`; added separate `<div class="sr-only" aria-live="polite" aria-atomic="true">` that announces only when streaming completes |

---

## Skipped

- **P6 (Community pages):** `app/(app)/community/` — Rahil's ownership area, excluded per task scope.

---

## Health check results

| Check | Result |
|---|---|
| `next lint` | ✅ No warnings or errors |
| `vitest run` | ✅ 756 passed, 1 skipped |
