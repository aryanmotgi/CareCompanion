# Frontend Expansion & Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 21 items from CEO, Eng, and Design reviews: 8 scope expansions, 7 critical fixes, 6 design improvements.

**Architecture:** Builds on existing frontend polish. Adds test infrastructure (Vitest + RTL), toast notification system, skeleton loading states, and new features (adherence tracking, lab trends, health score, onboarding).

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Supabase, Vitest, React Testing Library

**Conventions:**
- Named exports: `export function Foo` (NOT `export default` for components)
- Supabase browser: `import { createClient } from '@/lib/supabase/client'`
- Supabase server: `import { createClient } from '@/lib/supabase/server'`
- FK: `care_profile_id` (NOT `profile_id`)
- Gradient (`from-indigo-500 to-cyan-400`) reserved for PRIMARY CTAs only
- Secondary actions: `bg-white/[0.06] border border-white/[0.1]` (glass-card style)

---

## Chunk 1: Infrastructure (Tests, Toast, Skeletons, Error Boundary)

### Task 1: Set up Vitest + React Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (add devDeps + test script)
- Modify: `tsconfig.json` (add vitest types)

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

- [ ] **Step 2: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Create test setup**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add test script to package.json**

Add to scripts: `"test": "vitest", "test:run": "vitest run"`

- [ ] **Step 5: Verify with a smoke test**

Create `src/lib/__tests__/lab-parsing.test.ts` with one basic test to verify setup works.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json package-lock.json tsconfig.json src/lib/__tests__/
git commit -m "feat: set up Vitest + React Testing Library test infrastructure"
```

---

### Task 2: Toast notification system

**Files:**
- Create: `src/components/Toast.tsx`
- Create: `src/components/ToastProvider.tsx`
- Modify: `src/app/(app)/layout.tsx` (wrap with ToastProvider)

- [ ] **Step 1: Create Toast component and context**

`Toast.tsx`: Single toast component. Bottom-center, slides up with fade-in. Auto-dismiss after 3s. Colors: green (#10b981) success, red (#ef4444) error, cyan (#22d3ee) info. Max 1 toast at a time.

`ToastProvider.tsx`: React context providing `showToast(message, type)` function. Manages toast queue. Wraps children.

- [ ] **Step 2: Add ToastProvider to app layout**

In `src/app/(app)/layout.tsx`, wrap children with `<ToastProvider>`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx src/components/ToastProvider.tsx src/app/(app)/layout.tsx
git commit -m "feat: toast notification system — bottom-center, auto-dismiss, success/error/info"
```

---

### Task 3: Skeleton loading components

**Files:**
- Create: `src/components/Skeleton.tsx`
- Create: `src/components/skeletons/DashboardSkeleton.tsx`
- Create: `src/components/skeletons/CareSkeleton.tsx`
- Create: `src/components/skeletons/ProfileSkeleton.tsx`
- Create: `src/components/skeletons/ScansSkeleton.tsx`
- Create: `src/components/skeletons/SettingsSkeleton.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx` (add Suspense)
- Modify: `src/app/(app)/care/page.tsx` (add Suspense)
- Modify: `src/app/(app)/profile/page.tsx` (add Suspense)
- Modify: `src/app/(app)/scans/page.tsx` (add Suspense)
- Modify: `src/app/(app)/settings/page.tsx` (add Suspense)

- [ ] **Step 1: Create base Skeleton component**

Shimmer animation: left-to-right at 1.5s. `bg-white/[0.04]` base with `bg-white/[0.08]` shimmer highlight. Accepts className for sizing.

- [ ] **Step 2: Create page-specific skeletons**

Each skeleton matches its page layout (card shapes, grid layouts, section groups).

- [ ] **Step 3: Wrap server pages with Suspense boundaries**

Each `page.tsx` wraps its async content with `<Suspense fallback={<PageSkeleton />}>`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Skeleton.tsx src/components/skeletons/ src/app/(app)/
git commit -m "feat: skeleton loading states for all pages with shimmer animation"
```

---

### Task 4: Error boundary + error states

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/ErrorState.tsx`

- [ ] **Step 1: Create React ErrorBoundary**

Class component that catches render errors. Shows `ErrorState` with "Something went wrong" message and "Try Again" button.

- [ ] **Step 2: Create ErrorState component**

Centered layout: red-tinted glass card, error icon (exclamation in circle), message text, "Try Again" button calling `router.refresh()`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/ErrorState.tsx
git commit -m "feat: React ErrorBoundary and ErrorState component for graceful error handling"
```

---

## Chunk 2: Critical Fixes

### Task 5: Mutation error handling with toast

**Files:**
- Modify: `src/components/CareView.tsx`
- Modify: `src/components/SettingsPage.tsx`

- [ ] **Step 1: Update CareView mutations**

Wrap all Supabase mutations (handleAddMed, handleDeleteMed, handleAddAppt, handleDeleteAppt) in try/catch. On error: rollback optimistic state, show error toast. On success: show success toast.

- [ ] **Step 2: Update SettingsPage mutations**

Wrap toggleSetting, handleChangePassword, handleExport, handleDeleteAccount in try/catch with toast feedback. Add success feedback for password change ("Password updated").

- [ ] **Step 3: Add settings toggle debounce (500ms)**

Use a simple timeout-based debounce on toggleSetting to batch rapid toggles.

- [ ] **Step 4: Commit**

```bash
git add src/components/CareView.tsx src/components/SettingsPage.tsx
git commit -m "fix: add error handling with toast notifications for all mutations"
```

---

### Task 6: Delete account re-authentication

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/app/api/delete-account/route.ts`

- [ ] **Step 1: Add password re-entry to delete flow**

In SettingsPage, the delete confirmation dialog gets a password input field. Password is sent in the POST body.

- [ ] **Step 2: Update delete-account route**

Before deleting, verify password via `supabase.auth.signInWithPassword({ email, password })`. If fails, return 401. Add rate limiting (max 5 attempts per hour using a simple in-memory counter).

- [ ] **Step 3: Add audit logging**

Create `audit_logs` table migration. Log every export, delete, and password change with timestamp, user_id, action, and IP.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPage.tsx src/app/api/delete-account/route.ts supabase/migrations/
git commit -m "fix: require re-authentication for account deletion, add audit logging"
```

---

### Task 7: Chat prompt allowlist + error logging

**Files:**
- Modify: `src/components/ChatInterface.tsx`
- Modify: `src/app/api/export-data/route.ts`
- Modify: `src/app/api/delete-account/route.ts`

- [ ] **Step 1: Add prompt allowlist to ChatInterface**

Define allowed prompts as a Set. Only auto-send URL prompt if it matches allowlist. Otherwise ignore the parameter.

- [ ] **Step 2: Add try/catch with console.error to API routes**

Wrap export-data and delete-account handlers in try/catch. Log errors with context (user_id, action, error message).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatInterface.tsx src/app/api/
git commit -m "fix: chat prompt allowlist, error logging in API routes"
```

---

## Chunk 3: Design Improvements

### Task 8: Gradient hierarchy + responsive breakpoints

**Files:**
- Modify: `src/components/CareView.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/ProfileDashboard.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Reduce gradient usage**

Change secondary buttons from gradient to glass-card style across all components. Keep gradient only on primary CTAs.

- [ ] **Step 2: Add responsive container**

Add `max-w-lg mx-auto` wrapper to all page content areas. On `md:` breakpoint, Care cards and Scan categories use 2-column grid.

- [ ] **Step 3: Fix tag border-radius**

Condition tags and allergy tags: change from `rounded-lg` (8px) per spec.

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/app/globals.css
git commit -m "feat: gradient hierarchy, responsive breakpoints, tag radius fix"
```

---

### Task 9: Accessibility pass

**Files:**
- Modify: `src/components/ExpandableCard.tsx`
- Modify: `src/components/ProfileDashboard.tsx`
- Modify: `src/components/CareView.tsx`
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/DashboardView.tsx`

- [ ] **Step 1: Add ARIA labels to icon-only buttons**

Phone call buttons: `aria-label="Call {name}"`. Directions buttons: `aria-label="Get directions to {location}"`. Expand/collapse: `aria-expanded={expanded}`.

- [ ] **Step 2: Keyboard navigation for expandable cards**

Add `role="button"`, `tabIndex={0}`, `onKeyDown` handler (Enter/Space to toggle). Focus management: expanded card's first interactive element gets focus.

- [ ] **Step 3: Modal focus trap**

Delete confirmation dialog: trap focus within dialog, return focus to trigger on close. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.

- [ ] **Step 4: Screen reader announcements**

Toggle switches: `role="switch"`, `aria-checked={enabled}`. Toast notifications: `role="alert"`, `aria-live="polite"`.

- [ ] **Step 5: Touch targets**

Ensure all interactive elements have minimum 44px touch target (add padding if needed).

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: accessibility pass — ARIA labels, keyboard nav, focus management, touch targets"
```

---

## Chunk 4: Feature Expansions

### Task 10: Medication adherence tracking

**Files:**
- Create: `supabase/migrations/20260401_medication_logs.sql`
- Create: `src/components/AdherenceStreak.tsx`
- Modify: `src/components/CareView.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create medication_logs table**

```sql
CREATE TABLE medication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own logs" ON medication_logs FOR ALL USING (
  medication_id IN (
    SELECT m.id FROM medications m
    JOIN care_profiles cp ON m.care_profile_id = cp.id
    WHERE cp.user_id = auth.uid()
  )
);
```

- [ ] **Step 2: Create AdherenceStreak component**

7 dots in a row. Green for days with a log entry, gray for missed. Shows "X day streak" text below.

- [ ] **Step 3: Add "Mark as Taken" button to medication cards**

In CareView expanded medication card, add button that inserts into medication_logs.

- [ ] **Step 4: Show streak on Dashboard greeting**

If adherence data exists, dashboard greeting shows "You've taken all meds X days in a row!"

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ src/components/ src/lib/types.ts
git commit -m "feat: medication adherence tracking — Mark as Taken + 7-day streak"
```

---

### Task 11: Lab trend sparklines

**Files:**
- Create: `src/components/Sparkline.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/ProfileDashboard.tsx`

- [ ] **Step 1: Create Sparkline SVG component**

Pure SVG path rendering. Props: `values: number[]`, `width`, `height`, `color`. Draws a polyline connecting points. No external chart library.

- [ ] **Step 2: Add sparklines to expanded lab cards on Dashboard**

When expanding an abnormal lab card, show sparkline of all historical values for that test_name.

- [ ] **Step 3: Add sparklines to Profile vitals**

Below each vital number, show a mini sparkline of historical values.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sparkline.tsx src/components/DashboardView.tsx src/components/ProfileDashboard.tsx
git commit -m "feat: lab trend sparkline charts in dashboard and profile"
```

---

### Task 12: Appointment countdown + calendar

**Files:**
- Create: `src/lib/calendar.ts`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/CareView.tsx`

- [ ] **Step 1: Create .ics file generator**

`generateICS(title, start, end, location, description)` returns an ICS string. Trigger download via blob URL.

- [ ] **Step 2: Add countdown to appointment cards**

Replace "Tomorrow at 11:00 AM" with "in 1 day, 5 hours" live countdown using `useEffect` with 1-minute interval.

- [ ] **Step 3: Add "Add to Calendar" button**

In expanded appointment cards, add button that downloads .ics file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendar.ts src/components/DashboardView.tsx src/components/CareView.tsx
git commit -m "feat: appointment countdown timer + Add to Calendar .ics download"
```

---

### Task 13: Onboarding walkthrough

**Files:**
- Create: `src/components/OnboardingWalkthrough.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create OnboardingWalkthrough component**

3 swipeable cards (touch gesture + dot indicators):
1. "Track Your Health" — Dashboard priority cards illustration
2. "AI-Powered Insights" — Chat with AI about your health
3. "Scan & Organize" — Document scanning hub

"Get Started" CTA on last card. Stores `onboarding_seen` in localStorage.

- [ ] **Step 2: Show on Dashboard for new users**

If no care profile AND !localStorage.onboarding_seen, show walkthrough instead of dashboard.

- [ ] **Step 3: Commit**

```bash
git add src/components/OnboardingWalkthrough.tsx src/app/(app)/dashboard/page.tsx
git commit -m "feat: onboarding walkthrough — 3-card swipeable intro for new users"
```

---

### Task 14: Health score + haptic feedback + pull-to-refresh

**Files:**
- Create: `src/lib/health-score.ts`
- Create: `src/hooks/useHaptic.ts`
- Create: `src/hooks/usePullToRefresh.ts`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/CareView.tsx`
- Modify: `src/components/ProfileDashboard.tsx`

- [ ] **Step 1: Create health score calculator**

`calculateHealthScore(medications, labResults, appointments, adherenceLogs)` returns 0-100. Factors: % labs in normal range (40%), medication adherence rate (30%), upcoming appointments attended (20%), conditions managed (10%).

- [ ] **Step 2: Show health score on Dashboard**

Circular progress ring with score number in center. Below greeting, above priority cards.

- [ ] **Step 3: Create useHaptic hook**

`useHaptic()` returns `{ tap, success, error }` functions using Web Vibration API. No-op on unsupported browsers.

- [ ] **Step 4: Add haptic feedback to interactive elements**

Expandable cards, toggle switches, form submissions, delete actions.

- [ ] **Step 5: Create usePullToRefresh hook**

Touch gesture detection. On pull-down > 80px threshold, call `router.refresh()`. Shows pull indicator.

- [ ] **Step 6: Add pull-to-refresh to Dashboard, Care, Profile, Scans**

- [ ] **Step 7: Commit**

```bash
git add src/lib/health-score.ts src/hooks/ src/components/
git commit -m "feat: health score, haptic feedback, pull-to-refresh"
```

---

## Chunk 5: Full Test Suite

### Task 15: Unit tests — parseLabValue + health score + calendar

**Files:**
- Create: `src/lib/__tests__/lab-parsing.test.ts`
- Create: `src/lib/__tests__/health-score.test.ts`
- Create: `src/lib/__tests__/calendar.test.ts`

- [ ] **Step 1: Write parseLabValue tests (9 cases)**

null input, BP format, simple numeric, non-numeric, `< 100` range, `< 120/80` BP range, `60-100` range, no reference range, progress cap at 150.

- [ ] **Step 2: Write health score tests**

Zero data → 0, perfect data → 100, partial adherence, abnormal labs, mixed scenarios.

- [ ] **Step 3: Write calendar .ics tests**

Valid event generation, special characters in title, timezone handling.

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/
git commit -m "test: unit tests for lab parsing, health score, and calendar utilities"
```

---

### Task 16: Component tests — ExpandableCard, MessageBubble, Toast

**Files:**
- Create: `src/components/__tests__/ExpandableCard.test.tsx`
- Create: `src/components/__tests__/MessageBubble.test.tsx`
- Create: `src/components/__tests__/Toast.test.tsx`

- [ ] **Step 1: ExpandableCard tests**

Renders collapsed, renders expanded, toggles on click, stopPropagation on expanded content, cyan border when expanded.

- [ ] **Step 2: MessageBubble tests**

User bubble gradient, AI bubble with avatar, markdown rendering (bold, italic, headers, lists), empty content.

- [ ] **Step 3: Toast tests**

Shows message, auto-dismisses, correct color per type, replaces previous toast.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/
git commit -m "test: component tests for ExpandableCard, MessageBubble, Toast"
```

---

### Task 17: API route tests + remaining component tests

**Files:**
- Create: `src/app/api/__tests__/export-data.test.ts`
- Create: `src/app/api/__tests__/delete-account.test.ts`
- Create: `src/components/__tests__/DashboardView.test.tsx`
- Create: `src/components/__tests__/ProfileDashboard.test.tsx`
- Create: `src/components/__tests__/SettingsPage.test.tsx`
- Create: `src/components/__tests__/ScanCenter.test.tsx`

- [ ] **Step 1: Export data API test**

Mock Supabase. Test: unauthenticated → 401, no profile → null profile, successful export returns all tables.

- [ ] **Step 2: Delete account API test**

Mock Supabase + admin client. Test: unauthenticated → 401, wrong password → 401, successful cascade delete.

- [ ] **Step 3: DashboardView tests**

Renders priority cards sorted by priority, empty state renders, accordion behavior (one at a time), quick-ask prompts render.

- [ ] **Step 4: ProfileDashboard tests**

Initials generation, conditions parsing, vitals with no data shows "—", emergency contact hidden when null.

- [ ] **Step 5: SettingsPage tests**

Toggle flips state, password validation (< 6 chars), delete confirmation dialog renders.

- [ ] **Step 6: ScanCenter tests**

Category count, filter toggle, empty category state.

- [ ] **Step 7: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/__tests__/ src/components/__tests__/
git commit -m "test: API route tests and remaining component tests — full coverage"
```

---

### Task 18: Code cleanup

**Files:**
- Modify: `src/components/DashboardView.tsx` (remove dead `notifications` prop)
- Modify: `src/components/ProfileDashboard.tsx` (extract PhoneIcon)
- Modify: `src/app/(app)/profile/page.tsx` (add .limit(50) to lab query)

- [ ] **Step 1: Remove dead notifications prop from DashboardView**
- [ ] **Step 2: Extract PhoneIcon shared component**
- [ ] **Step 3: Add .limit(50) to profile lab results query**
- [ ] **Step 4: Run build + tests**
- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/
git commit -m "chore: remove dead props, extract PhoneIcon, limit lab query"
```
