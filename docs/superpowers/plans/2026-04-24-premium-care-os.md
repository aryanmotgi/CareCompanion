# Premium Care OS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proactive care intelligence, daily wellness check-ins, a family care hub, rich treatment timeline, emotional notifications, and premium micro-interactions to CareCompanion (web + iOS).

**Architecture:** Phased flywheel — check-in generates data, radar detects patterns, care hub displays live, timeline records history, notifications close the loop. Visual overhaul is the foundation applied across all phases. New DB tables (wellness_checkins, symptom_insights, notification_deliveries, care_team_activity_log) extend existing Drizzle schema. One new cron job for radar analysis. SWR polling for care hub.

**Tech Stack:** Next.js 14 (App Router), Drizzle ORM, Aurora Serverless, Vercel AI SDK + Claude Haiku, web-push (VAPID), Recharts, React View Transitions API, Expo/React Native Reanimated, CSS animations + Tailwind

**Spec:** `docs/superpowers/specs/2026-04-24-premium-care-os-design.md`

---

## Phase 1: Database Schema + Migrations

### Task 1: Add wellness_checkins table

**Files:**
- Modify: `apps/web/src/lib/db/schema.ts`

- [ ] **Step 1: Add wellness_checkins table to schema**

Add after existing table definitions in schema.ts:

```typescript
export const wellnessCheckins = pgTable('wellness_checkins', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  reportedByUserId: uuid('reported_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  mood: integer('mood').notNull(), // 1-5
  pain: integer('pain').notNull(), // 0-10
  energy: text('energy').notNull(), // 'low' | 'medium' | 'high'
  sleep: text('sleep').notNull(), // 'bad' | 'ok' | 'good'
  notes: text('notes'),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 2: Add symptom_insights table**

```typescript
export const symptomInsights = pgTable('symptom_insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'trend' | 'correlation' | 'anomaly' | 'milestone'
  severity: text('severity').notNull(), // 'info' | 'watch' | 'alert'
  status: text('status').notNull().default('active'), // 'active' | 'read' | 'dismissed' | 'archived'
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});
```

- [ ] **Step 3: Add notification_deliveries table**

```typescript
export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // 'clinical' | 'emotional' | 'caregiver_awareness' | 'caregiver_selfcare' | 'threshold_alert'
  title: text('title').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 4: Add care_team_activity_log table**

```typescript
export const careTeamActivityLog = pgTable('care_team_activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'logged_meds' | 'completed_checkin' | 'viewed_summary' | 'shared_link' | 'exported_pdf'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 5: Add new columns to existing tables**

```typescript
// Add to careProfiles table definition:
checkinStreak: integer('checkin_streak').notNull().default(0),
lastRadarRunAt: timestamp('last_radar_run_at', { withTimezone: true }),

// Add to careTeamMembers table definition:
gratitudeNudgeCount: integer('gratitude_nudge_count').notNull().default(0),
lastGratitudeNudgeAt: timestamp('last_gratitude_nudge_at', { withTimezone: true }),
```

- [ ] **Step 6: Generate and run migration**

Run: `cd apps/web && npx drizzle-kit generate`
Then: `cd apps/web && npx drizzle-kit push`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/db/schema.ts
git commit -m "feat(db): add wellness_checkins, symptom_insights, notification_deliveries, care_team_activity_log tables"
```

---

## Phase 2: Premium Visual Overhaul

### Task 2: Global CSS animations + signature elements

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add micro-interaction CSS classes**

Add to globals.css:

```css
/* === PREMIUM MICRO-INTERACTIONS === */

/* Button press spring */
.btn-press {
  transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1);
}
.btn-press:active {
  transform: scale(0.97);
}

/* Card stagger entrance */
@keyframes cardFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.card-stagger > * {
  opacity: 0;
  animation: cardFadeUp 0.4s cubic-bezier(0.2, 0, 0, 1) forwards;
}
.card-stagger > *:nth-child(1) { animation-delay: 0.05s; }
.card-stagger > *:nth-child(2) { animation-delay: 0.1s; }
.card-stagger > *:nth-child(3) { animation-delay: 0.15s; }
.card-stagger > *:nth-child(4) { animation-delay: 0.2s; }
.card-stagger > *:nth-child(5) { animation-delay: 0.25s; }
.card-stagger > *:nth-child(6) { animation-delay: 0.3s; }

/* Card hover glow */
.card-hover-glow {
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.3s ease;
}
.card-hover-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.08);
}

/* Signature CareCompanion Glow border */
@keyframes glowShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
.cc-glow {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}
.cc-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(135deg, #6366F1, #A78BFA, #6366F1, #A78BFA);
  background-size: 300% 300%;
  animation: glowShift 6s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* Frosted glass */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Success pulse */
@keyframes successPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.success-pulse {
  animation: successPulse 0.4s cubic-bezier(0.2, 0, 0, 1);
}

/* Animated counter */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Refined shimmer */
@keyframes shimmerSweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.shimmer {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-elevated) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmerSweep 1.5s ease infinite;
}

/* Timeline glow line */
@keyframes lineGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(99, 102, 241, 0.3); }
  50% { box-shadow: 0 0 16px rgba(99, 102, 241, 0.5); }
}
.timeline-line {
  background: linear-gradient(180deg, #6366F1, #A78BFA, #6366F1);
  animation: lineGlow 3s ease infinite;
}

/* You-are-here pulse */
@keyframes herePulse {
  0%, 100% { box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.7); }
}
.here-pulse {
  animation: herePulse 2s ease infinite;
}

/* Orb glow */
.orb-green { box-shadow: 0 0 20px rgba(110, 231, 183, 0.3), 0 0 40px rgba(110, 231, 183, 0.1); }
.orb-amber { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1); }
.orb-red { box-shadow: 0 0 20px rgba(252, 165, 165, 0.3), 0 0 40px rgba(252, 165, 165, 0.1); }
.orb-purple { box-shadow: 0 0 20px rgba(167, 139, 250, 0.3), 0 0 40px rgba(167, 139, 250, 0.1); }
```

- [ ] **Step 2: Add typography refinements**

```css
/* Typography refinements */
h1, h2, h3, .font-display {
  letter-spacing: -0.01em;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(ui): add premium micro-interaction CSS — glow, stagger, shimmer, glass, orbs"
```

### Task 3: Apply stagger animations to Dashboard

**Files:**
- Modify: `apps/web/src/components/DashboardView.tsx`

- [ ] **Step 1: Add `card-stagger` class to the dashboard cards container**

Find the container div that wraps the priority/metric cards and add `className="card-stagger"`.

- [ ] **Step 2: Add `card-hover-glow` class to each card**

Replace existing `card-hover-lift` with `card-hover-glow` on each dashboard card.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/DashboardView.tsx
git commit -m "feat(ui): apply stagger entrance + hover glow to dashboard cards"
```

### Task 4: Upgrade Button component with spring press

**Files:**
- Modify: `apps/web/src/components/ui/Button.tsx`

- [ ] **Step 1: Add `btn-press` class to the Button component**

Add `btn-press` to the className concatenation in the Button component so all buttons get the scale-down spring effect.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx
git commit -m "feat(ui): add spring press animation to all buttons"
```

---

## Phase 3: Daily Wellness Check-in

### Task 5: Check-in API route

**Files:**
- Create: `apps/web/src/app/api/checkins/route.ts`
- Create: `apps/web/src/lib/__tests__/checkins.test.ts`

- [ ] **Step 1: Write test for check-in creation**

```typescript
// apps/web/src/lib/__tests__/checkins.test.ts
import { describe, it, expect } from 'vitest';

describe('checkin validation', () => {
  it('rejects mood outside 1-5 range', () => {
    const result = validateCheckin({ mood: 6, pain: 3, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('rejects pain outside 0-10 range', () => {
    const result = validateCheckin({ mood: 3, pain: 11, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid energy value', () => {
    const result = validateCheckin({ mood: 3, pain: 3, energy: 'super', sleep: 'good' });
    expect(result.success).toBe(false);
  });

  it('accepts valid check-in', () => {
    const result = validateCheckin({ mood: 4, pain: 3, energy: 'medium', sleep: 'good' });
    expect(result.success).toBe(true);
  });

  it('sanitizes notes - strips control characters', () => {
    const result = sanitizeNotes('Hello\x00World\x01Test');
    expect(result).toBe('HelloWorldTest');
  });

  it('sanitizes notes - caps at 500 chars', () => {
    const result = sanitizeNotes('a'.repeat(600));
    expect(result.length).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npm run test:run -- --grep "checkin"`
Expected: FAIL — validateCheckin not defined

- [ ] **Step 3: Create validation + sanitization helpers**

```typescript
// apps/web/src/lib/checkin-validation.ts
import { z } from 'zod';

export const checkinSchema = z.object({
  mood: z.number().int().min(1).max(5),
  pain: z.number().int().min(0).max(10),
  energy: z.enum(['low', 'medium', 'high']),
  sleep: z.enum(['bad', 'ok', 'good']),
  notes: z.string().max(500).optional(),
});

export function validateCheckin(data: unknown) {
  return checkinSchema.safeParse(data);
}

export function sanitizeNotes(notes: string): string {
  // Strip control characters and null bytes
  const cleaned = notes.replace(/[\x00-\x1F\x7F]/g, '').trim();
  // Cap at 500 characters
  return cleaned.slice(0, 500);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npm run test:run -- --grep "checkin"`
Expected: PASS

- [ ] **Step 5: Create the API route**

```typescript
// apps/web/src/app/api/checkins/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wellnessCheckins, careProfiles, careTeamMembers, notificationDeliveries } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/auth';
import { validateCheckin, sanitizeNotes } from '@/lib/checkin-validation';
import { eq, and, sql, gte } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push';
import { pushSubscriptions } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { careProfileId, ...checkinData } = body;

  // Validate
  const validation = validateCheckin(checkinData);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid check-in data', details: validation.error.issues }, { status: 400 });
  }

  // Sanitize notes
  const notes = checkinData.notes ? sanitizeNotes(checkinData.notes) : null;

  // Check for duplicate today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await db.select({ id: wellnessCheckins.id })
    .from(wellnessCheckins)
    .where(and(
      eq(wellnessCheckins.careProfileId, careProfileId),
      gte(wellnessCheckins.checkedInAt, today)
    ))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Already checked in today', checkin: existing[0] }, { status: 409 });
  }

  // Determine if this is a proxy check-in
  const profile = await db.select().from(careProfiles).where(eq(careProfiles.id, careProfileId)).limit(1);
  if (!profile.length) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const isSelf = profile[0].userId === user.id;
  const reportedByUserId = isSelf ? null : user.id;

  // If proxy, verify editor/owner role
  if (!isSelf) {
    const membership = await db.select().from(careTeamMembers)
      .where(and(
        eq(careTeamMembers.userId, user.id),
        eq(careTeamMembers.careProfileId, careProfileId),
      )).limit(1);
    if (!membership.length || membership[0].role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Insert check-in
  const [checkin] = await db.insert(wellnessCheckins).values({
    careProfileId,
    reportedByUserId,
    mood: validation.data.mood,
    pain: validation.data.pain,
    energy: validation.data.energy,
    sleep: validation.data.sleep,
    notes,
  }).returning();

  // Update streak
  // Simple: count consecutive days backward from today
  const streakResult = await db.execute(sql`
    WITH dates AS (
      SELECT DISTINCT date(checked_in_at AT TIME ZONE 'UTC') as d
      FROM wellness_checkins
      WHERE care_profile_id = ${careProfileId}
      ORDER BY d DESC
    ),
    numbered AS (
      SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC) * INTERVAL '1 day') as grp
      FROM dates
    )
    SELECT COUNT(*) as streak
    FROM numbered
    WHERE grp = (SELECT grp FROM numbered LIMIT 1)
  `);
  const streak = Number(streakResult.rows?.[0]?.streak || 1);
  await db.update(careProfiles)
    .set({ checkinStreak: streak })
    .where(eq(careProfiles.id, careProfileId));

  // Log activity
  await db.insert(careTeamActivityLog).values({
    careProfileId,
    userId: user.id,
    action: 'completed_checkin',
    metadata: { mood: validation.data.mood, pain: validation.data.pain },
  });

  // THRESHOLD ALERTS — synchronous, no AI
  await checkThresholdAlerts(checkin, careProfileId, profile[0]);

  return NextResponse.json({ checkin, streak });
}

async function checkThresholdAlerts(
  checkin: typeof wellnessCheckins.$inferSelect,
  careProfileId: string,
  profile: typeof careProfiles.$inferSelect
) {
  const alerts: { title: string; body: string }[] = [];

  if (checkin.pain >= 7) {
    alerts.push({
      title: 'Pain Alert',
      body: `${profile.name || 'Your patient'} reported pain ${checkin.pain}/10 just now.`,
    });
  }

  if (checkin.mood === 1) {
    alerts.push({
      title: 'Mood Alert',
      body: `${profile.name || 'Your patient'} is having a really tough time right now.`,
    });
  }

  if (checkin.energy === 'low' && checkin.pain >= 5) {
    alerts.push({
      title: 'Low Energy + Pain',
      body: `${profile.name || 'Your patient'} is feeling low energy and elevated pain.`,
    });
  }

  if (alerts.length === 0) return;

  // Get all caregivers for this profile
  const caregivers = await db.select({ userId: careTeamMembers.userId })
    .from(careTeamMembers)
    .where(eq(careTeamMembers.careProfileId, careProfileId));

  // Get push subscriptions for all caregivers
  const caregiverIds = caregivers.map(c => c.userId);
  if (caregiverIds.length === 0) return;

  const subs = await db.select().from(pushSubscriptions)
    .where(sql`${pushSubscriptions.userId} = ANY(${caregiverIds})`);

  // Send alerts (threshold alerts bypass daily cap)
  for (const alert of alerts) {
    // Log delivery
    for (const cg of caregivers) {
      await db.insert(notificationDeliveries).values({
        userId: cg.userId,
        careProfileId,
        category: 'threshold_alert',
        title: alert.title,
      }).catch(() => {});
    }

    // Push to all caregiver subscriptions
    for (const sub of subs) {
      sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { title: alert.title, body: alert.body, url: '/care-hub' }
      ).catch(() => {});
    }
  }
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const careProfileId = url.searchParams.get('careProfileId');
  if (!careProfileId) return NextResponse.json({ error: 'careProfileId required' }, { status: 400 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCheckin = await db.select()
    .from(wellnessCheckins)
    .where(and(
      eq(wellnessCheckins.careProfileId, careProfileId),
      gte(wellnessCheckins.checkedInAt, today)
    ))
    .limit(1);

  const streak = await db.select({ checkinStreak: careProfiles.checkinStreak })
    .from(careProfiles)
    .where(eq(careProfiles.id, careProfileId))
    .limit(1);

  return NextResponse.json({
    checkedInToday: todayCheckin.length > 0,
    checkin: todayCheckin[0] || null,
    streak: streak[0]?.checkinStreak || 0,
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/checkin-validation.ts apps/web/src/app/api/checkins/route.ts apps/web/src/lib/__tests__/checkins.test.ts
git commit -m "feat(api): add daily wellness check-in API with validation, threshold alerts, streak tracking"
```

### Task 6: Check-in UI component

**Files:**
- Create: `apps/web/src/components/CheckinModal.tsx`
- Create: `apps/web/src/components/CheckinCard.tsx`

- [ ] **Step 1: Create CheckinModal component**

Build the modal with: mood emoji row (5 options), pain slider (0-10), energy toggle (low/med/high), sleep toggle (bad/ok/good), optional notes field, submit button, mic button placeholder. Use existing design tokens. Apply `cc-glow` class to the modal container. Use `btn-press` on the submit button.

- [ ] **Step 2: Create CheckinCard component**

Dashboard card that shows either "Complete your check-in" CTA or today's summary (mood emoji + pain score). Shows streak count. Collapsible after completion.

- [ ] **Step 3: Add CheckinCard to DashboardView**

Import CheckinCard and render it at the top of the dashboard, before existing priority cards.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/CheckinModal.tsx apps/web/src/components/CheckinCard.tsx apps/web/src/components/DashboardView.tsx
git commit -m "feat(ui): add daily check-in modal + dashboard card with streak display"
```

### Task 7: Morning Summary Card

**Files:**
- Create: `apps/web/src/components/MorningSummaryCard.tsx`
- Modify: `apps/web/src/components/DashboardView.tsx`

- [ ] **Step 1: Create MorningSummaryCard**

Shows: warm greeting (time-based), today's meds count + next due time, upcoming appointment (if any), last night's sleep quality (from check-in). Uses `cc-glow` signature border. Reads data from existing endpoints (no new API).

- [ ] **Step 2: Add to DashboardView above CheckinCard**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MorningSummaryCard.tsx apps/web/src/components/DashboardView.tsx
git commit -m "feat(ui): add morning summary card with signature glow to dashboard"
```

---

## Phase 4: Smart Symptom Radar + Notifications

### Task 8: Radar cron job

**Files:**
- Create: `apps/web/src/app/api/cron/radar/route.ts`
- Modify: `apps/web/vercel.json` (add cron schedule)

- [ ] **Step 1: Create radar cron route**

Follow the pattern from `apps/web/src/app/api/cron/weekly-summary/route.ts`:
- `verifyCronRequest` for auth
- `maxDuration = 300`
- `dynamic = 'force-dynamic'`
- Batch profiles (20 per run), track `lastRadarRunAt`
- For each profile: query last 7 days of check-ins, med adherence, labs
- Build a prompt for Claude Haiku with the data (wrap notes in `<user_checkin_note>` tags)
- Parse AI response into insight objects
- Insert into `symptom_insights` table
- Generate emotional notifications and insert into `notification_deliveries` (respect 3/day cap + quiet hours)
- Send push notifications via `sendPushNotification`
- Per-profile try/catch, collect errors, return summary

- [ ] **Step 2: Add cron schedule to vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/radar", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/radar/route.ts apps/web/vercel.json
git commit -m "feat(api): add symptom radar cron — AI pattern detection + emotional notifications"
```

### Task 9: Quick-share API

**Files:**
- Create: `apps/web/src/app/api/checkins/share/route.ts`

- [ ] **Step 1: Create share endpoint**

POST `/api/checkins/share` — takes `checkinId`, looks up the check-in, finds all care team members for that profile, sends push notification with check-in summary to each. Logs activity in `care_team_activity_log`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/checkins/share/route.ts
git commit -m "feat(api): add quick-share endpoint for check-in notifications to care team"
```

---

## Phase 5: Live Care Hub

### Task 10: Care Hub API

**Files:**
- Create: `apps/web/src/app/api/care-hub/route.ts`

- [ ] **Step 1: Create aggregation endpoint**

GET `/api/care-hub?careProfileId=X` — fetches all 5 data sources in parallel using `Promise.all`:
1. Latest check-in (wellness_checkins, today)
2. Latest insights (symptom_insights, last 5 active)
3. Today's medications (medications table)
4. Care team activity (care_team_activity_log, last 10)
5. Upcoming appointments (next 3)

Uses `.catch(() => [])` on each query for Aurora cold start resilience. Returns aggregated JSON.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/care-hub/route.ts
git commit -m "feat(api): add care hub aggregation endpoint — 5 data sources in parallel"
```

### Task 11: Care Hub page + components

**Files:**
- Create: `apps/web/src/app/(app)/care-hub/page.tsx`
- Create: `apps/web/src/app/(app)/care-hub/loading.tsx`
- Create: `apps/web/src/components/CareHubView.tsx`
- Create: `apps/web/src/components/SymptomRadarCard.tsx`

- [ ] **Step 1: Create SymptomRadarCard component**

Four glowing orbs (pain/energy/mood/adherence) with color-coded status (green/amber/red). Each orb uses `orb-green`/`orb-amber`/`orb-red` CSS classes. Below each orb: 7-day sparkline chart using Recharts `<Sparkline>` or inline SVG. Orb size: 44px on mobile, 56px on desktop.

- [ ] **Step 2: Create CareHubView component**

Full page layout:
- Patient status banner with `cc-glow` border (avatar, name, check-in summary, status badge)
- 2-column grid (`grid-cols-1 md:grid-cols-2`): SymptomRadarCard, Meds Today, AI Insights (full width), Care Team Activity, Upcoming
- Uses SWR with `refreshInterval: 60000` and `revalidateOnFocus: true` for polling
- Profile switcher at top (reuses existing profile switcher)
- Empty state for zero check-ins (welcome card with CTA)
- All cards use `glass` + `card-hover-glow` classes

- [ ] **Step 3: Create page.tsx with Suspense**

```typescript
import { Suspense } from 'react';
import CareHubView from '@/components/CareHubView';
import CareHubLoading from './loading';

export default function CareHubPage() {
  return (
    <Suspense fallback={<CareHubLoading />}>
      <CareHubView />
    </Suspense>
  );
}
```

- [ ] **Step 4: Create loading.tsx skeleton**

Match the Care Hub layout with shimmer placeholders using `shimmer` CSS class.

- [ ] **Step 5: Add Care Hub to navigation**

Modify `apps/web/src/components/BottomTabBar.tsx` — add Care Hub icon/link. Decide which tab to replace or add.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(app)/care-hub/ apps/web/src/components/CareHubView.tsx apps/web/src/components/SymptomRadarCard.tsx apps/web/src/components/BottomTabBar.tsx
git commit -m "feat(ui): add Care Hub page — family command center with radar, meds, insights, activity"
```

---

## Phase 6: AI Health Timeline Upgrade

### Task 12: Timeline API

**Files:**
- Create: `apps/web/src/app/api/timeline/route.ts`

- [ ] **Step 1: Create unified timeline endpoint**

GET `/api/timeline?careProfileId=X&from=DATE&to=DATE` — queries 5 tables in parallel, merges into a unified array of timeline events sorted by date. Each event has: `{ id, type, date, title, subtitle, severity, data }`. Paginated (default 90 days). Uses `Promise.all` with `.catch(() => [])`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/timeline/route.ts
git commit -m "feat(api): add unified timeline endpoint — 5 tables merged + paginated"
```

### Task 13: Timeline page upgrade

**Files:**
- Modify: `apps/web/src/app/(app)/timeline/page.tsx`
- Create: `apps/web/src/components/TreatmentTimeline.tsx`
- Create: `apps/web/src/components/TimelineNode.tsx`

- [ ] **Step 1: Create TimelineNode component**

Renders a single timeline event: colored circle (centered on the line using consistent positioning), date label, title, optional expandable detail card. Circle colors: green (milestone), amber (watch), indigo (neutral), cyan (labs). "You are here" node gets `here-pulse` class. Cards with insights get subtle background tint (NOT colored left-border — per AI slop review).

- [ ] **Step 2: Create TreatmentTimeline component**

Vertical scrollable layout:
- Glowing connection line using `timeline-line` CSS class, `width: 3px`
- Cycle chapter headers ("CYCLE 3 OF 6 — DAYS 1-21")
- Renders TimelineNode for each event
- All circles centered on the line (consistent `left` positioning)
- "Trends" toggle button — overlays sparkline when enabled
- "Share" button — generates shared link using existing SharedLinks
- Stagger entrance on nodes using `card-stagger`
- Empty state for no events

- [ ] **Step 3: Update page.tsx to use new component**

Replace existing timeline content with `<TreatmentTimeline>` wrapped in Suspense.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(app)/timeline/page.tsx apps/web/src/components/TreatmentTimeline.tsx apps/web/src/components/TimelineNode.tsx
git commit -m "feat(ui): upgrade timeline — glowing line, cycle chapters, AI annotations, expandable nodes"
```

---

## Phase 7: Expansion Features

### Task 14: Milestone celebrations

**Files:**
- Create: `apps/web/src/components/MilestoneCelebration.tsx`

- [ ] **Step 1: Create celebration overlay component**

Modal overlay that appears when a milestone is detected:
- Cycle completion: emoji + "Cycle X of Y complete. You're Z% there." + AI insight
- Streak milestones (7, 14, 30 days): streak count + warm message
- Personal bests: what improved + by how much
- "Share with Care Team" button
- Uses `success-pulse` animation on the emoji
- Dismissed on tap outside or "Done" button
- Check-in API response includes `milestone` field when applicable

- [ ] **Step 2: Integrate into CheckinModal — show after successful submission if milestone detected**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MilestoneCelebration.tsx apps/web/src/components/CheckinModal.tsx
git commit -m "feat(ui): add milestone celebration overlays — cycle completion, streaks, personal bests"
```

### Task 15: Doctor-ready PDF export

**Files:**
- Create: `apps/web/src/app/api/export/pdf/route.ts`

- [ ] **Step 1: Install @react-pdf/renderer**

Run: `cd apps/web && bun add @react-pdf/renderer`

- [ ] **Step 2: Create PDF generation endpoint**

GET `/api/export/pdf?careProfileId=X&days=30` — queries last N days of data, generates PDF with patient info header, symptom trend charts (as table/text since react-pdf doesn't do SVG sparklines easily — use bar representations), medication table with adherence %, AI insights section, disclaimer footer. Returns PDF as download (`Content-Disposition: attachment`). `maxDuration = 60`.

- [ ] **Step 3: Add export button to timeline/health-summary page**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/export/pdf/route.ts apps/web/package.json
git commit -m "feat(api): add doctor-ready PDF export — 30-day clinical summary"
```

### Task 16: Voice check-in

**Files:**
- Create: `apps/web/src/components/VoiceCheckin.tsx`

- [ ] **Step 1: Create voice check-in component**

- Mic button triggers Web Speech API (`webkitSpeechRecognition`)
- On transcript: POST to a new `/api/checkins/voice-extract` endpoint
- Endpoint sends transcript to Claude: "Extract mood (1-5), pain (0-10), energy (low/medium/high), sleep (bad/ok/good) from this patient's spoken check-in. Return JSON. If any field cannot be determined, return null for that field."
- If all 4 fields extracted: pre-fill the CheckinModal with values, show confirmation
- If any null: pre-fill what's available, highlight missing fields for manual input
- Transcript is never stored (not in state after extraction completes)

- [ ] **Step 2: Integrate mic button into CheckinModal**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/VoiceCheckin.tsx apps/web/src/app/api/checkins/voice-extract/route.ts apps/web/src/components/CheckinModal.tsx
git commit -m "feat(ui): add voice check-in — speech-to-text + AI extraction with manual fallback"
```

### Task 17: Caregiver gratitude nudge

**Files:**
- Modify: `apps/web/src/app/api/cron/radar/route.ts`

- [ ] **Step 1: Add gratitude check to radar cron**

After processing insights for each profile, check care team members: if any caregiver has been active 30+ consecutive days AND `lastGratitudeNudgeAt` is null or >30 days ago, generate a gratitude nudge notification to the patient. Update `gratitudeNudgeCount` and `lastGratitudeNudgeAt`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/radar/route.ts
git commit -m "feat(api): add caregiver gratitude nudge to radar cron — 30-day activity milestone"
```

---

## Phase 8: Final Integration + Testing

### Task 18: Integration tests

**Files:**
- Create: `apps/web/src/lib/__tests__/care-hub.test.ts`
- Create: `apps/web/src/lib/__tests__/radar.test.ts`

- [ ] **Step 1: Write care hub data aggregation tests**

Test that the care hub endpoint aggregates from all 5 sources correctly, handles empty states, and respects access control.

- [ ] **Step 2: Write radar pattern detection tests**

Test trend detection (pain up 3 days), threshold alerts (pain >= 7), notification cap (3/day), quiet hours, and prompt injection sanitization.

- [ ] **Step 3: Run full test suite**

Run: `cd apps/web && npm run test:run`
Expected: All tests pass

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/__tests__/
git commit -m "test: add integration tests for care hub aggregation + radar pattern detection"
```

### Task 19: Final review + cleanup

- [ ] **Step 1: Run health check**

Run: `npm run typecheck && npm run lint && npm run test:run`

- [ ] **Step 2: Verify all new pages load**

Check: `/care-hub`, `/timeline`, dashboard with morning card + check-in card

- [ ] **Step 3: Final commit**

```bash
git commit -m "chore: Premium Care OS — all phases complete"
```
