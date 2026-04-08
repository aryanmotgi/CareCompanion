# Backend AI Improvements + Frontend Overhaul

**Branch:** `feat/backend-ai-improvements` → `feat/mobile-first-redesign`
**Scope:** AI document extraction API, frontend UX/accessibility/visual overhaul, dev workflow, testing

## Problem Statement

CareCompanion's care management features needed three improvements:
1. **AI Document Extraction** — Users scan medical documents (prescriptions, lab reports, insurance cards) and need structured data extracted via Claude Vision
2. **Frontend UX Gaps** — Missing confirmation dialogs, loading states, error handling, accessibility labels, and visual polish across care management components
3. **Dev Workflow** — No CI pipeline, no pre-commit hooks, no E2E tests, no env validation

## Changes

### 1. AI Document Extraction API (`src/app/api/documents/extract/route.ts`)
- New POST endpoint accepting base64-encoded images
- Claude Vision extracts: medications, lab results, appointments, insurance info, conditions
- Ownership check ensures users can only extract for their own care profiles
- Input size limit (10MB) to prevent abuse
- Structured JSON response with typed extraction results

### 2. Frontend Overhaul (11 components)
- **ConfirmDialog** (new) — Reusable confirmation dialog for destructive actions
- **CareView** — Delete confirmations, loading spinners, form labels, Zod-ready validation, confetti on success
- **DashboardView** — Memoized cards array (useMemo), animated gradient greeting
- **MessageBubble** — Improved markdown (inline code, code blocks, italic), proper spinner
- **MedicationsView** — Confirmation on remove, replaced window.location.reload() with Supabase refetch
- **SettingsPage** — Debounce cleanup, export loading, password validation, aria-labels, keyboard support
- **PriorityCard** — Spinning gradient borders on urgent cards, dot pulse animation
- **AmbientBackground** — 4 floating orbs (was 2), rose + blue additions
- **SkeletonCard** — Bone + pulse combo animation
- **Button** — Ripple effect on click, hover shadows
- **error.tsx** — Fixed light→dark theme mismatch

### 3. Visual Upgrades (globals.css)
- Confetti particle burst animation
- Ripple effect CSS
- Spinning conic-gradient borders
- Animated greeting gradient
- Skeleton bone+pulse animation
- Page blur-in transitions
- Enhanced blob float animations
- All respect prefers-reduced-motion

### 4. Dev Workflow & Testing
- GitHub Actions CI (lint → typecheck → test → build)
- Husky pre-commit hooks with lint-staged
- Playwright E2E tests (auth, navigation, dashboard)
- Environment variable validation (src/lib/env.ts)
- Notification engine tests
- Vitest config updates

### 5. Notification Engine
- Respects user settings toggles (refill_reminders, appointment_reminders, etc.)
- Unit tests for toggle behavior

### 6. Documentation
- Comprehensive README with feature list, architecture, setup guide

## Architecture

```
src/
├── app/
│   ├── api/documents/extract/  ← New AI extraction endpoint
│   ├── (app)/layout.tsx        ← Page blur-in transition wrapper
│   ├── error.tsx               ← Dark theme fix
│   └── globals.css             ← Visual upgrades
├── components/
│   ├── ui/
│   │   ├── ConfirmDialog.tsx   ← New reusable dialog
│   │   ├── Button.tsx          ← Ripple effect
│   │   └── Ripple.tsx          ← Ripple hook (unused currently)
│   ├── Confetti.tsx            ← New particle system
│   ├── CareView.tsx            ← Major refactor
│   ├── DashboardView.tsx       ← Memoization + gradient
│   ├── MedicationsView.tsx     ← Confirm + refetch
│   ├── SettingsPage.tsx        ← A11y + loading states
│   └── ...                     ← Other visual upgrades
├── lib/
│   ├── env.ts                  ← New env validation
│   ├── notifications.ts        ← Settings-aware engine
│   └── supabase/               ← Client updates
└── e2e/                        ← New Playwright tests
```

## Test Plan

- Unit: notification toggle behavior (vitest)
- Unit: document extraction input validation (vitest)
- E2E: auth flow, navigation, dashboard rendering (Playwright)
- CI: lint → typecheck → test → build pipeline
- Manual: visual effects (confetti, ripple, gradient borders, ambient orbs)

## Non-Goals

- React Query integration (deferred)
- Full Zod form validation (forms accept basic input, Zod installed but not wired)
- Walgreens API integration (deferred per project memory)
- Offline support / optimistic updates

<!-- /autoplan restore point: /Users/aryanmotgi/.gstack/projects/aryanmotgi-CareCompanion/feat-backend-ai-improvements-autoplan-restore-20260402-180230.md -->

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Mode: SELECTIVE EXPANSION | P1+P6 | Code is already built; hold scope + cherry-pick high-value fixes | SCOPE EXPANSION (too late for this branch) |
| 2 | CEO | Accept premises 1-4,6-10 | P6 | Reasonable assumptions for MVP stage | N/A |
| 3 | CEO | Flag premise 5 (confetti in health app) | TASTE | Reasonable people disagree on celebration UX in medical context | N/A |
| 4 | CEO | Cherry-pick: ConfirmDialog reuse in SettingsPage | P4 (DRY) | Duplicate dialog code, <15 min fix | Defer |
| 5 | CEO | Cherry-pick: Rate limiting on extraction API | P1 (completeness) | Cost abuse vector on paid Claude API calls | Defer |
| 6 | CEO | Cherry-pick: aria-describedby on ConfirmDialog | P1 (completeness) | One-line a11y fix | Defer |
| 7 | CEO | Defer react-markdown replacement | P3 (pragmatic) | Works for most responses; multi-line code blocks are edge case | Replace now |
| 8 | CEO | Defer notification engine scaling | P3 | Sequential processing is fine at current user count | Fix now |
| 9 | Eng | Flag: test coverage at 2/10 | P1 (completeness) | 22 new codepaths, 20 untested — most critical gap | Ship without tests |
| 10 | Eng | Flag: Spinner SVG duplicated 5x | P4 (DRY) | Extract shared Spinner component | Leave as-is |
| 11 | Eng | Flag: CareView 13 state vars, 398 lines | P5 (explicit) | Could extract hooks but current code is readable | Refactor now |
| 12 | Eng | Flag: debounce-on-unmount bug in SettingsPage | P1 | Cleanup clears pending save instead of flushing | Leave as-is |
| 13 | Eng | Flag: duplicate auto-import risk | P1 | Re-scanning same doc creates duplicate records | Defer |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | /autoplan | Scope & strategy | 1 | COMPLETE | 6.1/10 — rate limiting, partial import failure, focus trap gaps |
| Eng Review | /autoplan | Architecture & tests | 1 | COMPLETE | 6.4/10 — test coverage 2/10, DRY violations, debounce bug |
| Design Review | /autoplan | UI/UX gaps | 0 | SKIPPED | Covered inline by CEO a11y section |
| Codex Review | /codex | Independent 2nd opinion | 0 | UNAVAILABLE | — |

**VERDICT:** REVIEWED — 13 auto-decisions logged. 2 taste decisions for user.
