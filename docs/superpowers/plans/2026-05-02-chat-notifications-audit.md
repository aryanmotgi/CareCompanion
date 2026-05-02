# Chat AI & Notifications Audit — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 11 bugs found in the Chat AI and Notifications flows — two CSRF security holes, four correctness bugs, three reliability bugs, and two code quality issues.

**Architecture:** All fixes are surgical — no new abstractions. CSRF token reading extracted to a shared helper in each component. Soft-delete filters added inline. Rate limiter moved to module scope. Notification concurrency added with Promise.allSettled.

**Tech Stack:** Next.js App Router, Drizzle ORM, Vercel AI SDK, React, TypeScript

---

## Findings

### CRITICAL — Security

| # | File | Issue |
|---|------|-------|
| 1 | `NotificationsView.tsx:60,73` | `dismiss()` and `markAllRead()` POST to `/api/notifications/read` without CSRF token header. Backend calls `validateCsrf()` → returns 403 CSRF error. Both actions silently fail. |
| 2 | `NotificationBell.tsx:88,99` | Same missing CSRF header. Dismiss and mark-all-read both silently fail. |

### HIGH — Correctness

| # | File | Issue |
|---|------|-------|
| 3 | `NotificationsView.tsx:145` | "Ask AI" link uses `"Tell me more about: {n.title}"` prompt. `isAllowedPrompt()` in ChatInterface never matches this pattern → prompt never auto-sends. User lands on chat page with input prefilled but nothing happens. |
| 4 | `NotificationBell.tsx:36-55` | `getChatPrompt()` generates patterns like `"Help me with the medication refill..."` and `"Explain this lab result:..."` — none match `isAllowedPrompt()` allowlist (`"Help me manage my..."`, `"Explain my..."` etc). Same dead-link outcome. |
| 5 | `NotificationsView.tsx:145`, `NotificationBell.tsx:162` | Notification titles (medication names, lab values, appointment info) appear in `?prompt=` URL parameter → exposed in server logs, browser history, referrer headers. PHI leak. |
| 6 | `notifications.ts:84,87` | `medications` and `appointments` queries lack `isNull(deletedAt)` filter. Soft-deleted medications and past appointments generate spurious notifications. |

### MEDIUM — Reliability

| # | File | Issue |
|---|------|-------|
| 7 | `NotificationsView.tsx:71-79` | `markAllRead()` shows success toast before checking `res.ok`. If API fails, state is mutated and toast fires — no rollback, no error message. |
| 8 | `NotificationBell.tsx:85-93` | `dismiss()` has no error handling. On failure, notification disappears from UI but is never marked read. No user feedback. |
| 9 | `notifications.ts:371-376` | `generateNotificationsForAllUsers` processes users in serial `for` loop. At ~500ms/user, times out at 120+ users against Vercel's 60s cron limit. |
| 10 | `orchestrator.ts:54` | `rateLimit()` called inside `orchestrate()` — creates a new in-memory rate limiter instance per request. The 10 req/min cap is never enforced across requests. |

### LOW — Code Quality

| # | File | Issue |
|---|------|-------|
| 11 | `orchestrator.ts:135` | Multi-agent activity logged as a `memories` row (`category: 'other'`, `source: 'conversation'`). This pollutes the patient facts memory store with system telemetry. Memory extraction LLM then "sees" these as facts. |

---

## Task 1: Fix CSRF in NotificationsView

**Files:**
- Modify: `apps/web/src/components/NotificationsView.tsx`

Issues fixed: #1, #7

- [ ] **Step 1: Add CSRF header helper and fix dismiss()**

Replace:
```typescript
const res = await fetch('/api/notifications/read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id }),
})
if (!res.ok) {
  setNotifications(prev)
  showToast('Failed to dismiss notification', 'error')
}
```

With (optimistic rollback + CSRF):
```typescript
const csrfToken = () => document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? ''

const dismiss = async (id: string) => {
  const prev = notifications
  setNotifications((n) => n.filter((x) => x.id !== id))
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    setNotifications(prev)
    showToast('Failed to dismiss notification', 'error')
  }
}
```

- [ ] **Step 2: Fix markAllRead() — add CSRF header + error handling**

Replace:
```typescript
const markAllRead = async () => {
  setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true }),
  })
  showToast('All notifications marked as read', 'success')
}
```

With:
```typescript
const markAllRead = async () => {
  const prev = notifications
  setNotifications((n) => n.map((x) => ({ ...x, isRead: true })))
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({ all: true }),
  })
  if (!res.ok) {
    setNotifications(prev)
    showToast('Failed to mark notifications as read', 'error')
  } else {
    showToast('All notifications marked as read', 'success')
  }
}
```

- [ ] **Step 3: Run lint and typecheck**

```bash
cd apps/web && npm run lint && npm run typecheck
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/NotificationsView.tsx
git commit -m "fix(notifications): add CSRF header and error rollback to dismiss/markAllRead"
```

---

## Task 2: Fix CSRF and error handling in NotificationBell

**Files:**
- Modify: `apps/web/src/components/NotificationBell.tsx`

Issues fixed: #2, #8

- [ ] **Step 1: Add csrfToken helper and fix dismiss()**

Add helper above component (after imports):
```typescript
const csrfToken = () => document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? ''
```

Replace `dismiss`:
```typescript
const dismiss = async (id: string) => {
  const prev = notifications
  const prevCount = count
  setNotifications((n) => n.filter((x) => x.id !== id))
  setCount((c) => Math.max(0, c - 1))
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    setNotifications(prev)
    setCount(prevCount)
  }
}
```

- [ ] **Step 2: Fix markAllRead() — add CSRF + rollback**

Replace:
```typescript
const markAllRead = async () => {
  setNotifications([]);
  setCount(0);
  setOpen(false);
  await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true }),
  });
};
```

With:
```typescript
const markAllRead = async () => {
  const prev = notifications
  const prevCount = count
  setNotifications([])
  setCount(0)
  setOpen(false)
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({ all: true }),
  })
  if (!res.ok) {
    setNotifications(prev)
    setCount(prevCount)
    setOpen(true)
  }
}
```

- [ ] **Step 3: Run lint and typecheck**

```bash
cd apps/web && npm run lint && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/NotificationBell.tsx
git commit -m "fix(notifications): add CSRF header and error rollback to bell dismiss/markAllRead"
```

---

## Task 3: Fix "Ask AI" prompt to auto-send + remove PHI from URL

**Files:**
- Modify: `apps/web/src/components/NotificationsView.tsx`
- Modify: `apps/web/src/components/NotificationBell.tsx`
- Modify: `apps/web/src/components/ChatInterface.tsx`

Issues fixed: #3, #4, #5

**Context:** `isAllowedPrompt()` in ChatInterface is an allowlist for auto-sending URL prompts. Notification components generate prompts that don't match. Two options: (a) put PHI-free generic prompts in the URLs and extend the allowlist, or (b) use type-based prompts without the specific title embedded. We do (b) — type-based prompts, no PHI in URL, extend allowlist to cover them.

- [ ] **Step 1: Create a shared prompt-by-type helper**

In `NotificationsView.tsx`, replace the "Ask AI" link:
```tsx
// Before:
href={`/chat?prompt=${encodeURIComponent(`Tell me more about: ${n.title}`)}`}

// After (type-based, no PHI in URL):
href={`/chat?prompt=${encodeURIComponent(getChatPromptForType(n.type))}`}
```

Add the helper function at the top of the file:
```typescript
function getChatPromptForType(type: string): string {
  switch (type) {
    case 'refill_overdue':
    case 'refill_soon':
      return 'Help me manage my medication refills'
    case 'appointment_prep':
    case 'appointment_today':
      return 'Help me prepare for my upcoming appointment'
    case 'abnormal_lab':
    case 'lab_result':
      return 'Explain my recent lab results'
    case 'prior_auth_expiring':
      return 'Help me understand my prior authorization status'
    case 'claim_denied':
      return 'Help me understand my insurance claim status'
    case 'low_balance':
      return 'Help me manage my FSA or HSA account'
    default:
      return 'Help me understand my care updates'
  }
}
```

- [ ] **Step 2: Fix NotificationBell getChatPrompt() to use allowlist-compatible patterns**

Replace `getChatPrompt()` in `NotificationBell.tsx`:
```typescript
function getChatPrompt(notif: Notification): string {
  switch (notif.type) {
    case 'refill_overdue':
    case 'refill_soon':
      return 'Help me manage my medication refills'
    case 'appointment_prep':
    case 'appointment_today':
      return 'Help me prepare for my upcoming appointment'
    case 'abnormal_lab':
    case 'lab_result':
      return 'Explain my recent lab results'
    case 'prior_auth_expiring':
      return 'Help me understand my prior authorization status'
    case 'claim_denied':
      return 'Help me understand my insurance claim status'
    case 'low_balance':
      return 'Help me manage my FSA or HSA account'
    default:
      return 'Help me understand my care updates'
  }
}
```

- [ ] **Step 3: Extend isAllowedPrompt() allowlist in ChatInterface.tsx**

Add the new prompt patterns:
```typescript
const isAllowedPrompt = (prompt: string) =>
  ALLOWED_PROMPTS.has(prompt) ||
  prompt.startsWith('Help me prepare for my ') ||
  prompt.startsWith('Help me manage my ') ||
  prompt.startsWith('Explain my ') ||
  prompt.startsWith('Help me understand') ||
  prompt.startsWith('I have a scheduling conflict') ||
  prompt.startsWith('Help me find local')
```

The new prompts (`'Help me manage my medication refills'`, `'Help me prepare for my upcoming appointment'`, `'Explain my recent lab results'`, `'Help me understand my prior authorization status'`, etc.) all match the existing `startsWith` patterns — no changes needed.

Verify each new prompt matches:
- `'Help me manage my medication refills'` → `startsWith('Help me manage my ')` ✓
- `'Help me prepare for my upcoming appointment'` → `startsWith('Help me prepare for my ')` ✓
- `'Explain my recent lab results'` → `startsWith('Explain my ')` ✓
- `'Help me understand my prior authorization status'` → `startsWith('Help me understand')` ✓
- `'Help me understand my insurance claim status'` → `startsWith('Help me understand')` ✓
- `'Help me manage my FSA or HSA account'` → `startsWith('Help me manage my ')` ✓
- `'Help me understand my care updates'` → `startsWith('Help me understand')` ✓

No changes to ChatInterface.tsx needed.

- [ ] **Step 4: Run lint and typecheck**

```bash
cd apps/web && npm run lint && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/NotificationsView.tsx apps/web/src/components/NotificationBell.tsx
git commit -m "fix(notifications): use type-based prompts for Ask AI links, remove PHI from URL params"
```

---

## Task 4: Filter soft-deleted medications and appointments in notification generation

**Files:**
- Modify: `apps/web/src/lib/notifications.ts`

Issues fixed: #6

- [ ] **Step 1: Add isNull import and soft-delete filters**

Add `isNull` to the drizzle import (check if already imported):
```typescript
import { eq, and, gte, desc, isNull } from 'drizzle-orm';
```

Fix medications query (line ~84):
```typescript
// Before:
prefs.refill_reminders
  ? db.select().from(medications).where(eq(medications.careProfileId, profile.id))
  : Promise.resolve([]),

// After:
prefs.refill_reminders
  ? db.select().from(medications).where(and(eq(medications.careProfileId, profile.id), isNull(medications.deletedAt)))
  : Promise.resolve([]),
```

Fix appointments query (line ~87):
```typescript
// Before:
prefs.appointment_reminders
  ? db.select().from(appointments).where(eq(appointments.careProfileId, profile.id))
  : Promise.resolve([]),

// After:
prefs.appointment_reminders
  ? db.select().from(appointments).where(and(eq(appointments.careProfileId, profile.id), isNull(appointments.deletedAt)))
  : Promise.resolve([]),
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/notifications.ts
git commit -m "fix(notifications): filter soft-deleted medications and appointments from notification generation"
```

---

## Task 5: Parallelize generateNotificationsForAllUsers

**Files:**
- Modify: `apps/web/src/lib/notifications.ts`

Issues fixed: #9

**Context:** The cron job at `generateNotificationsForAllUsers` runs all users serially. Vercel cron timeout is 60s. At ~500ms/user this fails at 120+ users. Fix: run in parallel batches of 10 using `Promise.allSettled`.

- [ ] **Step 1: Replace serial loop with batched parallel execution**

Replace the function body:
```typescript
export async function generateNotificationsForAllUsers(): Promise<{ total: number; users: number }> {
  const profiles = await db
    .select({ userId: careProfiles.userId })
    .from(careProfiles);

  if (profiles.length === 0) return { total: 0, users: 0 };

  const BATCH_SIZE = 10;
  let total = 0;
  let processed = 0;

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((p) => generateNotificationsForUser(p.userId))
    );
    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled') {
        total += result.value;
      } else {
        console.error('[notifications] user generation failed:', result.reason);
      }
    }
  }

  return { total, users: processed };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/notifications.ts
git commit -m "fix(notifications): parallelize cron notification generation in batches of 10"
```

---

## Task 6: Fix orchestrator rate limiter scope + remove memory pollution

**Files:**
- Modify: `apps/web/src/lib/agents/orchestrator.ts`

Issues fixed: #10, #11

- [ ] **Step 1: Move rateLimit instance to module scope**

The `rateLimit()` call at line 54 creates a new in-memory store per request — the limit is never shared across requests. Move to module scope.

At the top of `orchestrator.ts`, after imports, add:
```typescript
// Module-level rate limiter — shared across all requests in the same process instance
const agentLimiter = rateLimit({ interval: 60000, maxRequests: 10 });
```

Then inside `orchestrate()`, replace lines 53-64:
```typescript
// Before:
const agentRateKey = `agent:${userId}`
const agentLimiter = rateLimit({ interval: 60000, maxRequests: 10 })
const agentRateResult = await agentLimiter.check(agentRateKey)

// After:
const agentRateKey = `agent:${userId}`
const agentRateResult = await agentLimiter.check(agentRateKey)
```

- [ ] **Step 2: Remove memory pollution logging**

Remove the "Log multi-agent activity" block (lines ~131-143):
```typescript
// DELETE this entire block:
if (specialistsUsed.length > 1) {
  try {
    const { db } = await import('@/lib/db');
    const { memories } = await import('@/lib/db/schema');
    await db.insert(memories).values({
      userId,
      category: 'other',
      fact: `Multi-agent query handled by: ${specialistsUsed.map((s) => s.name).join(', ')}. Topic: ${userMessage.slice(0, 100)}`,
      source: 'conversation',
      confidence: 'high',
    });
  } catch { /* non-critical */ }
}
```

- [ ] **Step 3: Run typecheck and tests**

```bash
cd apps/web && npm run typecheck && npm run test:run
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/agents/orchestrator.ts
git commit -m "fix(chat): move orchestrator rate limiter to module scope, remove memory table pollution"
```

---

## Task 7: Update TODO.md with audit findings

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Append audit findings section to TODO.md**

Append a new section documenting all findings and their resolution status from this audit.

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: append Chat AI & Notifications audit findings to TODO.md"
```

---

## Verification

After all tasks:

```bash
cd /Users/aryanmotgi/carecompanion
npm run typecheck
npm run lint
npm run test:run
```

Expected: 0 type errors, 0 lint errors, all tests pass.

Manual verification checklist:
- [ ] Open NotificationsView page → click Dismiss → no console CSRF error, notification disappears
- [ ] Click "Mark all read" → works, rollbacks if network fails
- [ ] Open NotificationBell → dismiss → no console CSRF error
- [ ] Click "Ask AI" on any notification → navigates to /chat → message auto-sends
- [ ] Verify no PHI in browser URL bar after clicking Ask AI
- [ ] Check network tab: POST to /api/notifications/read includes x-csrf-token header
