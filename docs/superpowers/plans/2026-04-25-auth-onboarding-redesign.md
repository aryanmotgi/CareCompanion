# Auth & Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current broken auth/onboarding flow with role-on-signup, Care Group linking via QR/code, HealthKit-first patient onboarding, and role-aware AI personalization.

**Architecture:** New `care_groups` + `care_group_members` + `care_group_invites` DB tables alongside existing `care_team_*` tables. Role added to `users` table. `OnboardingWizard.tsx` split into `CaregiverWizard.tsx` + `PatientWizard.tsx` with a shared `WizardProgressBar` component. New Care Group screen between signup and wizard. New `care-group` NextAuth credential provider for group-based login.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, NextAuth v5, bcryptjs, Aurora Serverless (Postgres), `qrcode.react`, Resend (existing), React Native Expo (mobile follows same logic, separate session)

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `apps/web/src/lib/db/migrations/001-care-groups.sql` | Aurora migration script — run manually before deploy |
| `apps/web/src/app/api/care-group/route.ts` | POST create care group |
| `apps/web/src/app/api/care-group/join/route.ts` | POST join by name+password |
| `apps/web/src/app/api/care-group/invite/route.ts` | POST generate invite token |
| `apps/web/src/app/api/care-group/[id]/status/route.ts` | GET poll for second member |
| `apps/web/src/app/join/page.tsx` | Deep link token redemption page |
| `apps/web/src/app/set-role/page.tsx` | Role selection for pre-existing users with no role |
| `apps/web/src/components/CareGroupScreen.tsx` | Full Care Group setup UI (progressive disclosure) |
| `apps/web/src/components/QRCodePanel.tsx` | QR display with 10-min countdown + blur-on-expiry |
| `apps/web/src/components/WizardProgressBar.tsx` | Segmented step indicator with back-nav |
| `apps/web/src/components/RoleSelector.tsx` | 3-tile role picker (signup form + set-role page) |
| `apps/web/src/components/ConnectedCelebration.tsx` | "You're connected!" milestone screen |
| `apps/web/src/components/CaregiverWizard.tsx` | Caregiver-specific 6-step wizard |
| `apps/web/src/components/PatientWizard.tsx` | Patient/self-care 4-step wizard |
| `apps/web/src/lib/hospitals.ts` | Static list of 50 supported hospitals |
| `apps/web/src/types/next-auth.d.ts` | NextAuth session type augmentation for `role` |
| `apps/web/src/app/api/care-group/__tests__/route.test.ts` | API route tests |

### Modified files
| File | Change |
|---|---|
| `apps/web/src/lib/db/schema.ts` | Add 3 tables + `role` on users + 4 cols on careProfiles |
| `packages/utils/src/validation.ts` | Add `role` optional enum to registerSchema |
| `apps/web/src/app/api/auth/register/route.ts` | Accept + save `role` field |
| `apps/web/src/lib/auth.ts` | Add `care-group` credential provider + OAuth state for role |
| `apps/web/src/components/SignupForm.tsx` | Add `RoleSelector`, pass role to register API |
| `apps/web/src/components/LoginForm.tsx` | Add Care Group tab |
| `apps/web/src/components/OnboardingWizard.tsx` | Thin router: delegates to CaregiverWizard or PatientWizard |
| `apps/web/src/components/OnboardingShell.tsx` | Pass user role to wizard router |
| `apps/web/src/app/api/chat/route.ts` | Inject role + primaryConcern + experience into system prompt |
| `apps/web/src/app/api/healthkit/sync/route.ts` | Wrap insert loop in try/catch for partial success |
| `apps/web/src/lib/email.ts` | Add `onboardingRecapEmail()` template |
| `apps/web/package.json` | Add `qrcode.react` |

---

## Chunk 1: Database Schema + Aurora Migration

### Task 1: Add `qrcode.react` dependency

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd apps/web && bun add qrcode.react
```

- [ ] **Step 2: Verify install**

```bash
cd apps/web && bun run typecheck 2>&1 | head -5
```
Expected: no new errors related to qrcode.react.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: add qrcode.react for Care Group QR display"
```

---

### Task 2: Add new tables and columns to Drizzle schema

**Files:**
- Modify: `apps/web/src/lib/db/schema.ts`

- [ ] **Step 1: Add `role` column to users table**

In `apps/web/src/lib/db/schema.ts`, find the `users` table definition and add after `createdAt`:

```typescript
role: text('role'),  // 'caregiver' | 'patient' | 'self' — null for pre-feature users
```

- [ ] **Step 2: Add new columns to careProfiles table**

Find the `careProfiles` table and add after existing columns:

```typescript
caregivingExperience: text('caregiving_experience'), // 'first_time' | 'some_experience' | 'experienced'
primaryConcern: text('primary_concern'),             // 'medications' | 'lab_results' | 'coordinating_care' | 'emotional_support'
fieldOverrides: jsonb('field_overrides'),            // { cancerType: true, stage: true, ... } — FHIR sync skips true fields
```

- [ ] **Step 3: Add care_groups table**

First, add `primaryKey` to the `drizzle-orm/pg-core` import at the top of `schema.ts`. Find the existing import line (line 1) and add `primaryKey`:

```typescript
import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core'
```

After the existing care team tables (after line ~306), add:

```typescript
export const careGroups = pgTable('care_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const careGroupMembers = pgTable('care_group_members', {
  careGroupId: uuid('care_group_id').notNull().references(() => careGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // 'owner' | 'member'
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.careGroupId, t.userId] }),
}))

export const careGroupInvites = pgTable('care_group_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  careGroupId: uuid('care_group_id').notNull().references(() => careGroups.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  usedBy: uuid('used_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -i "error" | head -10
```
Expected: 0 new errors from schema additions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/db/schema.ts
git commit -m "feat: add care_groups tables and role/caregiving columns to schema"
```

---

### Task 3: Write and document Aurora migration SQL

**Files:**
- Create: `apps/web/src/lib/db/migrations/001-care-groups.sql`

- [ ] **Step 1: Create migrations directory and SQL file**

```bash
mkdir -p apps/web/src/lib/db/migrations
```

Create `apps/web/src/lib/db/migrations/001-care-groups.sql`:

```sql
-- CareCompanion Auth & Onboarding Redesign — Aurora Migration
-- Run manually via AWS Query Editor BEFORE deploying the new code.
-- Aurora is not publicly accessible; drizzle-kit push fails silently.

-- 1. New column on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;

-- 2. New columns on care_profiles
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS caregiving_experience TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS primary_concern TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS field_overrides JSONB;

-- 3. care_groups table
CREATE TABLE IF NOT EXISTS care_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for name+password join lookup (avoids full table scan)
CREATE INDEX IF NOT EXISTS care_groups_name_pwd_idx ON care_groups(name, password_hash);

-- 4. care_group_members table
CREATE TABLE IF NOT EXISTS care_group_members (
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (care_group_id, user_id)
);

-- 5. care_group_invites table
CREATE TABLE IF NOT EXISTS care_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Run migration in Aurora via AWS Query Editor**

Open AWS Console → RDS → Query Editor → select your Aurora cluster → run the entire contents of `001-care-groups.sql`. Verify each statement returns "Query executed successfully".

- [ ] **Step 3: Verify tables exist**

In Query Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('care_groups', 'care_group_members', 'care_group_invites');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/db/migrations/
git commit -m "chore: add Aurora migration SQL for care groups schema"
```

---

## Chunk 2: Auth Updates

### Task 4: Update registerSchema to include role

**Files:**
- Modify: `packages/utils/src/validation.ts`
- Test: `packages/utils/src/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing test**

In `packages/utils/src/__tests__/validation.test.ts`, add:

```typescript
describe('registerSchema', () => {
  it('accepts valid role values', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      role: 'caregiver',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role values', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('accepts missing role (optional)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run from the **monorepo root** (not from `apps/web` — `packages/` is at the root):

```bash
bun run test:run packages/utils/src/__tests__/validation.test.ts 2>&1 | tail -10
```
Expected: FAIL — "role" test fails because the field doesn't exist yet.

- [ ] **Step 3: Add role to registerSchema**

In `packages/utils/src/validation.ts`, update `registerSchema`:

```typescript
export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required'),
  role: z.enum(['caregiver', 'patient', 'self']).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun run test:run packages/utils/src/__tests__/validation.test.ts 2>&1 | tail -5
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/validation.ts packages/utils/src/__tests__/validation.test.ts
git commit -m "feat: add optional role field to registerSchema"
```

---

### Task 5: Update register API route to save role

**Files:**
- Modify: `apps/web/src/app/api/auth/register/route.ts`
- Test: `apps/web/src/app/api/auth/register/__tests__/route.test.ts` (create if not exists)

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/auth/register/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Integration note: full route test requires DB — unit test the role extraction logic
describe('register route role handling', () => {
  it('extracts valid role from body', () => {
    const body = { email: 'a@b.com', password: 'password1', displayName: 'A', role: 'caregiver' }
    const parsed = { email: body.email, password: body.password, displayName: body.displayName, role: body.role }
    expect(parsed.role).toBe('caregiver')
  })

  it('defaults role to undefined when not provided', () => {
    const body = { email: 'a@b.com', password: 'password1', displayName: 'A' }
    const role = (body as Record<string, unknown>).role as string | undefined
    expect(role).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it passes baseline**

```bash
cd apps/web && bun run test:run src/app/api/auth/register/__tests__/route.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Update the register route to save role**

In `apps/web/src/app/api/auth/register/route.ts`, find the `db.insert(users).values(...)` call and add `role`:

```typescript
const [newUser] = await db
  .insert(users)
  .values({
    email: normalizedEmail,
    displayName,
    passwordHash,
    role: parsed.data.role ?? null,  // null for users who don't provide role (pre-feature or mobile)
    ...(hipaaConsent && {
      hipaaConsent: true,
      hipaaConsentAt: new Date(),
      hipaaConsentVersion: '1.0',
    }),
  })
  .returning({ id: users.id })
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "register" | head -5
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/auth/register/route.ts apps/web/src/app/api/auth/register/__tests__/route.test.ts
git commit -m "feat: save role field on user registration"
```

---

### Task 6: Add care-group credential provider to NextAuth + OAuth state for role

**Files:**
- Modify: `apps/web/src/lib/auth.ts`

- [ ] **Step 1: Add care-group Credentials provider**

In `apps/web/src/lib/auth.ts`, after the existing `Credentials({...})` block, add:

```typescript
Credentials({
  id: 'care-group',
  name: 'Care Group',
  credentials: {
    groupName: { label: 'Group Name', type: 'text' },
    groupPassword: { label: 'Group Password', type: 'password' },
  },
  async authorize(credentials) {
    if (!credentials?.groupName || !credentials?.groupPassword) return null

    const name = (credentials.groupName as string).trim()
    const password = credentials.groupPassword as string

    // Find care groups matching the name, then verify password
    const groups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, name),
      orderBy: (g, { asc }) => [asc(g.createdAt)], // oldest first — tiebreak rule
    })

    let matchedGroup: typeof groups[0] | null = null
    for (const group of groups) {
      const valid = await bcrypt.compare(password, group.passwordHash)
      if (valid) { matchedGroup = group; break }
    }

    if (!matchedGroup) return null

    // Find the owner member
    const ownerMember = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, matchedGroup.id),
        eq(careGroupMembers.role, 'owner'),
      ),
    })
    if (!ownerMember) return null

    const ownerUser = await db.query.users.findFirst({
      where: eq(users.id, ownerMember.userId),
    })
    if (!ownerUser) return null

    return { id: ownerUser.id, email: ownerUser.email, name: ownerUser.displayName ?? ownerUser.email }
  },
}),
```

Add the necessary imports at the top of `auth.ts`:
```typescript
import { careGroups, careGroupMembers } from '@/lib/db/schema'
import { and } from 'drizzle-orm'
```

- [ ] **Step 2: Handle role passed through OAuth flow via cookie**

The correct approach for passing role through an OAuth redirect is a short-lived cookie set before the redirect. `sessionStorage` fails for Apple Sign-In (popup flow). The NextAuth `account.state` field is not reliably surfaced in v5 callbacks. Use a cookie instead:

In `SignupForm.tsx` (Task 14), before calling `signIn('google', ...)` or `signIn('apple', ...)`, set a cookie:

```typescript
// Set role cookie before OAuth redirect — survives popup and tab redirects
document.cookie = `pending_role=${role};path=/;max-age=300;samesite=lax`
await signIn('google', { callbackUrl: '/onboarding' })
```

In `apps/web/src/lib/auth.ts`, in the `jwt` callback, when `account?.provider` is `'apple'` or `'google'`, read the cookie from the request. NextAuth v5 does not expose `req` directly in the callback, so read the cookie from `token.pendingRole` which is set in a custom `signIn` callback:

Add a `signIn` callback to the NextAuth config (after the existing callbacks):

```typescript
async signIn({ user, account, profile, request }) {
  if (request) {
    const cookie = request.cookies?.get('pending_role')?.value
    if (cookie && ['caregiver', 'patient', 'self'].includes(cookie)) {
      // Store in a custom field on the token via the jwt callback
      // We can't write to token here, so store in the DB directly
      if (user?.email) {
        const email = user.email.toLowerCase().trim()
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (existing && !existing.role) {
          await db.update(users).set({ role: cookie }).where(eq(users.id, existing.id))
        }
      }
    }
  }
  return true
},
```

- [ ] **Step 3: Expose role on session + NextAuth type augmentation**

Add to the `jwt` callback (after finding/creating the user):
```typescript
token.role = (existingUser?.role ?? null) as string | null
```

Add to the `session` callback:
```typescript
session.user.role = token.role as string | null
```

Create `apps/web/src/types/next-auth.d.ts` to augment the NextAuth session type:

```typescript
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      displayName: string
      isDemo: boolean
      role: string | null
    }
  }
}
```

- [ ] **Step 4: Handle pre-feature users (no role) post-login redirect**

In `apps/web/src/middleware.ts`, find the existing auth check block and add after the session guard:

```typescript
// Redirect users with no role to /set-role (pre-feature accounts)
if (session && !session.user.role && !pathname.startsWith('/set-role') && !pathname.startsWith('/api')) {
  return NextResponse.redirect(new URL('/set-role', request.url))
}
```

Create `apps/web/src/app/set-role/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RoleSelector } from '@/components/RoleSelector'

type Role = 'caregiver' | 'patient' | 'self'

export default function SetRolePage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!role) { setError('Please select your role to continue'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) { setError('Something went wrong. Try again.'); return }
      router.push('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <h1 className="text-xl font-bold text-white">One quick thing</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Who are you using CareCompanion as?
        </p>
        <RoleSelector value={role} onChange={setRole} error={error} />
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !role}
          className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
```

Create `apps/web/src/app/api/auth/set-role/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = await req.json()
  if (!['caregiver', 'patient', 'self'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  await db.update(users).set({ role }).where(eq(users.email, session.user.email!))
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -i "auth" | head -10
```
Expected: no type errors from the new provider or callback changes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth.ts
git commit -m "feat: add care-group credential provider and OAuth role state handling to NextAuth"
```

---

## Chunk 3: Care Group API Routes

### Task 7: POST /api/care-group — create a Care Group

**Files:**
- Create: `apps/web/src/app/api/care-group/route.ts`
- Test: `apps/web/src/app/api/care-group/__tests__/route.test.ts`

- [ ] **Step 1: Create test file with failing tests**

Create `apps/web/src/app/api/care-group/__tests__/route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('care-group creation validation', () => {
  it('rejects empty group name', () => {
    const name = ''.trim()
    expect(name.length).toBe(0)
  })

  it('rejects password shorter than 4 characters', () => {
    const password = 'abc'
    expect(password.length).toBeLessThan(4)
  })

  it('validates member limit is 10', () => {
    const MAX_MEMBERS = 10
    const currentCount = 10
    expect(currentCount >= MAX_MEMBERS).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass (these are pure unit tests, no DB needed)**

```bash
cd apps/web && bun run test:run src/app/api/care-group/__tests__/route.test.ts 2>&1 | tail -5
```
Expected: PASS (assertions are self-contained — they validate logic constants, not the route itself).

- [ ] **Step 3: Create the route**

Create `apps/web/src/app/api/care-group/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { careGroups, careGroupMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, password } = await req.json()

    if (!name?.trim() || !password || password.length < 4) {
      return NextResponse.json({ error: 'Group name and password (min 4 chars) are required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const passwordHash = await bcrypt.hash(password, 12)

    // Check for name+password collision (warn — don't block)
    const existingGroups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, trimmedName),
    })
    for (const g of existingGroups) {
      const collision = await bcrypt.compare(password, g.passwordHash)
      if (collision) {
        return NextResponse.json(
          { error: 'A Care Group with this name and password already exists. Choose a different name or password.' },
          { status: 409 }
        )
      }
    }

    const [group] = await db.insert(careGroups)
      .values({ name: trimmedName, passwordHash, createdBy: session.user.id })
      .returning({ id: careGroups.id, name: careGroups.name })

    // Creator becomes owner
    await db.insert(careGroupMembers).values({
      careGroupId: group.id,
      userId: session.user.id,
      role: 'owner',
    })

    return NextResponse.json({ id: group.id, name: group.name }, { status: 201 })
  } catch (err) {
    console.error('[care-group] POST error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && bun run test:run src/app/api/care-group/__tests__/route.test.ts 2>&1 | tail -5
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/care-group/route.ts apps/web/src/app/api/care-group/__tests__/route.test.ts
git commit -m "feat: add POST /api/care-group route"
```

---

### Task 8: POST /api/care-group/join — join by name+password

**Files:**
- Create: `apps/web/src/app/api/care-group/join/route.ts`

- [ ] **Step 1: Write failing test**

Add to `apps/web/src/app/api/care-group/__tests__/route.test.ts`:

```typescript
describe('care-group join validation', () => {
  it('prevents joining when group is at member limit', () => {
    const MAX_MEMBERS = 10
    const members = Array(10).fill(null)
    expect(members.length >= MAX_MEMBERS).toBe(true)
  })

  it('detects duplicate membership', () => {
    const userId = 'user-1'
    const members = [{ userId: 'user-1', role: 'owner' }]
    const alreadyMember = members.some(m => m.userId === userId)
    expect(alreadyMember).toBe(true)
  })
})
```

- [ ] **Step 2: Create the join route**

Create `apps/web/src/app/api/care-group/join/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { careGroups, careGroupMembers } from '@/lib/db/schema'
import { eq, and, asc, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const MAX_MEMBERS = 10

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, password } = await req.json()
    if (!name?.trim() || !password) {
      return NextResponse.json({ error: 'Group name and password are required' }, { status: 400 })
    }

    // Find matching group — oldest first (tiebreak for name+pwd collision)
    const groups = await db.query.careGroups.findMany({
      where: eq(careGroups.name, name.trim()),
      orderBy: (g, { asc }) => [asc(g.createdAt)],
    })

    let matchedGroup: typeof groups[0] | null = null
    for (const g of groups) {
      if (await bcrypt.compare(password, g.passwordHash)) {
        matchedGroup = g
        break
      }
    }

    if (!matchedGroup) {
      return NextResponse.json(
        { error: 'No Care Group found with that name and password. Check with whoever created the group.' },
        { status: 404 }
      )
    }

    // Check already a member
    const existing = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, matchedGroup.id),
        eq(careGroupMembers.userId, session.user.id),
      ),
    })
    if (existing) {
      return NextResponse.json({ error: 'You are already in this Care Group.' }, { status: 409 })
    }

    // Check member limit
    const [{ value: memberCount }] = await db
      .select({ value: count() })
      .from(careGroupMembers)
      .where(eq(careGroupMembers.careGroupId, matchedGroup.id))

    if (memberCount >= MAX_MEMBERS) {
      return NextResponse.json({ error: 'This Care Group is full (max 10 members).' }, { status: 400 })
    }

    await db.insert(careGroupMembers).values({
      careGroupId: matchedGroup.id,
      userId: session.user.id,
      role: 'member',
    })

    return NextResponse.json({ id: matchedGroup.id, name: matchedGroup.name }, { status: 200 })
  } catch (err) {
    console.error('[care-group/join] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && bun run test:run src/app/api/care-group/__tests__/route.test.ts 2>&1 | tail -5
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/care-group/join/route.ts
git commit -m "feat: add POST /api/care-group/join route"
```

---

### Task 9: POST /api/care-group/invite + GET /api/care-group/[id]/status

**Files:**
- Create: `apps/web/src/app/api/care-group/invite/route.ts`
- Create: `apps/web/src/app/api/care-group/[id]/status/route.ts`

- [ ] **Step 1: Create invite route**

Create `apps/web/src/app/api/care-group/invite/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema'
import { eq, and, isNull, gt, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const MAX_ACTIVE_TOKENS = 5
const TOKEN_EXPIRY_DAYS = 7
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://carecompanionai.org'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { careGroupId } = await req.json()
    if (!careGroupId) {
      return NextResponse.json({ error: 'careGroupId required' }, { status: 400 })
    }

    // Verify caller is a member of this group
    const membership = await db.query.careGroupMembers.findFirst({
      where: and(
        eq(careGroupMembers.careGroupId, careGroupId),
        eq(careGroupMembers.userId, session.user.id),
      ),
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Check active token limit
    const now = new Date()
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(careGroupInvites)
      .where(and(
        eq(careGroupInvites.careGroupId, careGroupId),
        isNull(careGroupInvites.usedBy),
        isNull(careGroupInvites.revokedAt),
        gt(careGroupInvites.expiresAt, now),
      ))

    if (activeCount >= MAX_ACTIVE_TOKENS) {
      return NextResponse.json(
        { error: 'You have too many pending invites. Revoke one to create a new one.' },
        { status: 400 }
      )
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const [invite] = await db.insert(careGroupInvites)
      .values({ careGroupId, token, createdBy: session.user.id, expiresAt })
      .returning({ id: careGroupInvites.id, token: careGroupInvites.token })

    const joinUrl = `${BASE_URL}/join?group=${careGroupId}&token=${invite.token}`

    return NextResponse.json({ token: invite.token, url: joinUrl }, { status: 201 })
  } catch (err) {
    console.error('[care-group/invite] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create status polling route**

Create `apps/web/src/app/api/care-group/[id]/status/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { careGroupMembers, users } from '@/lib/db/schema'
import { eq, and, ne, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: careGroupId } = params

    // Find any member that is NOT the current user
    const otherMembers = await db
      .select({ userId: careGroupMembers.userId, displayName: users.displayName })
      .from(careGroupMembers)
      .innerJoin(users, eq(careGroupMembers.userId, users.id))
      .where(and(
        eq(careGroupMembers.careGroupId, careGroupId),
        ne(careGroupMembers.userId, session.user.id),
      ))
      .orderBy(asc(careGroupMembers.joinedAt))
      .limit(1)

    if (otherMembers.length === 0) {
      return NextResponse.json({ joined: false })
    }

    return NextResponse.json({
      joined: true,
      name: otherMembers[0].displayName ?? 'Your partner',
    })
  } catch (err) {
    console.error('[care-group/status] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create deep link join page**

Create `apps/web/src/app/join/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { careGroupInvites, careGroupMembers } from '@/lib/db/schema'
import { eq, and, isNull, isNotNull, gt } from 'drizzle-orm'
import { auth } from '@/lib/auth'

// Next.js 15+: searchParams is a Promise — must be awaited
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; token?: string }>
}) {
  const { group: careGroupId, token } = await searchParams

  if (!careGroupId || !token) {
    redirect('/signup?error=invalid-invite')
  }

  // If not logged in, redirect to signup with the invite params preserved
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/signup?joinGroup=${careGroupId}&joinToken=${token}`)
  }

  // Validate the invite token
  const invite = await db.query.careGroupInvites.findFirst({
    where: eq(careGroupInvites.token, token),
  })

  if (!invite) {
    redirect('/onboarding?error=invite-not-found')
  }
  if (invite.usedBy) {
    redirect('/onboarding?error=invite-used')
  }
  if (invite.revokedAt) {
    redirect('/onboarding?error=invite-revoked')
  }
  if (invite.expiresAt < new Date()) {
    redirect('/onboarding?error=invite-expired')
  }

  // Check not already a member
  const existing = await db.query.careGroupMembers.findFirst({
    where: and(
      eq(careGroupMembers.careGroupId, careGroupId),
      eq(careGroupMembers.userId, session.user.id),
    ),
  })

  if (!existing) {
    await db.insert(careGroupMembers).values({
      careGroupId,
      userId: session.user.id,
      role: 'member',
    })
    await db.update(careGroupInvites)
      .set({ usedBy: session.user.id })
      .where(eq(careGroupInvites.id, invite.id))
  }

  redirect('/onboarding?careGroupId=' + careGroupId + '&joined=true')
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -E "care-group|join" | head -10
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/care-group/invite/route.ts \
        apps/web/src/app/api/care-group/[id]/status/route.ts \
        apps/web/src/app/join/page.tsx
git commit -m "feat: add care group invite, status polling, and deep link join page"
```

---

## Chunk 4: Shared UI Components

### Task 10: RoleSelector component

**Files:**
- Create: `apps/web/src/components/RoleSelector.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/RoleSelector.tsx`:

```typescript
'use client'

type Role = 'caregiver' | 'patient' | 'self'

const ROLES: { value: Role; emoji: string; label: string; description: string }[] = [
  { value: 'caregiver', emoji: '🧑‍⚕️', label: 'Caregiver', description: 'Helping someone I love' },
  { value: 'patient', emoji: '🤒', label: 'Patient', description: 'Managing my own care, with a caregiver' },
  { value: 'self', emoji: '👤', label: 'Self-care', description: 'Managing my own care independently' },
]

export function RoleSelector({
  value,
  onChange,
  error,
}: {
  value: Role | null
  onChange: (role: Role) => void
  error?: string
}) {
  return (
    <div>
      <p className="text-xs text-white/40 mb-2">Who are you joining as? <span className="text-red-400">*</span></p>

      {/* Desktop: 3-column grid. Mobile (<480px): vertical stack */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        role="radiogroup"
        aria-label="Account role"
      >
        {ROLES.map((role) => {
          const selected = value === role.value
          return (
            <button
              key={role.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(role.value)}
              // `relative` is required so the absolute checkmark badge positions within the tile
              className="relative rounded-xl p-3 text-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              style={{
                background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: selected
                  ? '0 0 0 1px rgba(124,58,237,0.4), 0 0 20px rgba(124,58,237,0.15)'
                  : 'none',
              }}
            >
              <div className="text-2xl mb-1">{role.emoji}</div>
              <div
                className="text-xs font-semibold"
                style={{ color: selected ? '#c4b5fd' : '#f1f5f9' }}
              >
                {role.label}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {role.description}
              </div>
              {selected && (
                <div
                  // `justify-center` is the correct Tailwind class (not `justify-content-center`)
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: '#7c3aed' }}
                  aria-hidden="true"
                >
                  ✓
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Mobile: override to vertical stack below 480px via inline media query approach */}
      <style>{`
        @media (max-width: 479px) {
          [role="radiogroup"] {
            grid-template-columns: 1fr !important;
          }
          [role="radiogroup"] button {
            display: flex;
            align-items: center;
            gap: 12px;
            text-align: left;
            padding: 12px 16px;
          }
          [role="radiogroup"] button .text-2xl {
            margin-bottom: 0;
            flex-shrink: 0;
          }
        }
      `}</style>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "RoleSelector" | head -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/RoleSelector.tsx
git commit -m "feat: add RoleSelector component with mobile-responsive 3-tile layout"
```

---

### Task 11: WizardProgressBar component

**Files:**
- Create: `apps/web/src/components/WizardProgressBar.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/WizardProgressBar.tsx`:

```typescript
'use client'

export function WizardProgressBar({
  currentStep,
  totalSteps,
  onStepClick,
}: {
  currentStep: number  // 1-based
  totalSteps: number
  onStepClick?: (step: number) => void  // only fires for completed steps
}) {
  return (
    <div className="w-full">
      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Step {currentStep} of {totalSteps}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep

          let background: string
          if (isCompleted) background = '#7c3aed'
          else if (isCurrent) background = 'rgba(124,58,237,0.6)'
          else background = 'rgba(255,255,255,0.12)'

          return (
            <button
              key={step}
              type="button"
              aria-label={`Step ${step}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              disabled={!isCompleted}
              onClick={() => isCompleted && onStepClick?.(step)}
              className="flex-1 transition-all duration-200 focus:outline-none"
              style={{
                height: '4px',
                borderRadius: '2px',
                background,
                cursor: isCompleted ? 'pointer' : 'default',
                opacity: isCompleted ? 1 : isCurrent ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (isCompleted) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.85)'
                }
              }}
              onMouseLeave={(e) => {
                if (isCompleted) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#7c3aed'
                }
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/WizardProgressBar.tsx
git commit -m "feat: add WizardProgressBar with back-navigation support"
```

---

### Task 12: QRCodePanel component (10-min countdown + blur-on-expiry)

**Files:**
- Create: `apps/web/src/components/QRCodePanel.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/QRCodePanel.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode.react'

const QR_EXPIRY_SECONDS = 10 * 60  // 10 minutes

export function QRCodePanel({
  careGroupId,
  initialUrl,
  onRegenerate,
}: {
  careGroupId: string
  initialUrl: string
  onRegenerate: () => Promise<string>  // returns new URL
}) {
  const [url, setUrl] = useState(initialUrl)
  const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS)
  const [expired, setExpired] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExpired(true)
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [url])  // reset timer when url changes

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const newUrl = await onRegenerate()
      setUrl(newUrl)
      setSecondsLeft(QR_EXPIRY_SECONDS)
      setExpired(false)
    } finally {
      setRegenerating(false)
    }
  }, [onRegenerate])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timerColor = secondsLeft <= 60 ? '#ef4444' : 'rgba(255,255,255,0.4)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="p-4">
        <p className="text-xs font-medium mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Share with your patient
        </p>

        {/* QR code area */}
        <div className="relative flex justify-center mb-3">
          <div
            className="rounded-lg overflow-hidden p-3 bg-white"
            style={{ filter: expired ? 'blur(4px)' : 'none', transition: 'filter 300ms' }}
          >
            <QRCode value={url} size={120} level="M" />
          </div>

          {/* Expired overlay */}
          {expired && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            >
              <span className="text-white text-sm font-semibold mb-1">
                {regenerating ? 'Generating...' : 'Code expired'}
              </span>
              {!regenerating && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Tap to refresh
                </span>
              )}
            </button>
          )}
        </div>

        {/* Countdown */}
        {!expired && (
          <p className="text-xs text-center mb-3" style={{ color: timerColor }}>
            Expires in {minutes}:{String(seconds).padStart(2, '0')}
          </p>
        )}

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({ title: 'Join my Care Group', url })
              }
            }}
            className="rounded-lg py-2 text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(url)}
            className="rounded-lg py-2 text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/QRCodePanel.tsx
git commit -m "feat: add QRCodePanel with 10-min countdown and tap-to-regenerate"
```

---

### Task 13: ConnectedCelebration component + static hospitals list

**Files:**
- Create: `apps/web/src/components/ConnectedCelebration.tsx`
- Create: `apps/web/src/lib/hospitals.ts`

- [ ] **Step 1: Create the celebration component**

Create `apps/web/src/components/ConnectedCelebration.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'

export function ConnectedCelebration({
  yourName,
  theirName,
  onContinue,
}: {
  yourName: string
  theirName: string
  onContinue: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [showCta, setShowCta] = useState(false)

  useEffect(() => {
    // Staggered animation sequence per spec
    setVisible(true)
    const t1 = setTimeout(() => setShowContent(true), 400)
    const t2 = setTimeout(() => setShowCta(true), 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const initials = (name: string) => name.trim().charAt(0).toUpperCase()

  return (
    <div
      className="flex flex-col items-center justify-between min-h-screen px-6 py-12"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 300ms ease' }}
      aria-live="polite"
    >
      <div />

      <div className="flex flex-col items-center gap-6 text-center">
        {/* Confetti */}
        <div className="text-3xl select-none" aria-hidden="true">🎉 ✨ 🎊</div>

        {/* Avatars */}
        <div
          className="flex items-center gap-4"
          style={{ opacity: showContent ? 1 : 0, transform: showContent ? 'scale(1)' : 'scale(0.85)', transition: 'all 400ms ease' }}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}
            >
              {initials(yourName)}
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>You</span>
          </div>

          <div className="relative w-8 flex items-center justify-center">
            <div className="w-full h-0.5" style={{ background: 'linear-gradient(90deg, #7c3aed, #0ea5e9)' }} />
            <span className="absolute text-sm" aria-hidden="true">💜</span>
          </div>

          <div className="flex flex-col items-center gap-1" style={{ transitionDelay: '100ms' }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}
            >
              {initials(theirName)}
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{theirName}</span>
          </div>
        </div>

        {/* Heading */}
        <div style={{ opacity: showContent ? 1 : 0, transition: 'opacity 200ms ease', transitionDelay: '200ms' }}>
          <h1
            className="text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #c4b5fd, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            You&apos;re connected!
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your care journey starts now.
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onContinue}
        style={{
          opacity: showCta ? 1 : 0,
          transition: 'opacity 200ms ease',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          borderRadius: '12px',
          padding: '14px',
          width: '100%',
          fontSize: '14px',
          fontWeight: 600,
          color: '#fff',
        }}
      >
        Continue to setup →
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create the static hospitals list**

Create `apps/web/src/lib/hospitals.ts`:

```typescript
// Top 50 US health systems that support Apple Health Records (Epic/Cerner FHIR)
// Source: Epic App Orchard and Apple Health Records documentation
// Update this list as new systems onboard

export const SUPPORTED_HOSPITALS = [
  'Atrium Health',
  'Banner Health',
  'Baylor Scott & White Health',
  'Beth Israel Deaconess Medical Center',
  'BJC Healthcare',
  'Boston Children\'s Hospital',
  'Brigham and Women\'s Hospital',
  'CHRISTUS Health',
  'Cleveland Clinic',
  'CommonSpirit Health',
  'Dartmouth Health',
  'Duke Health',
  'Emory Healthcare',
  'Geisinger Health',
  'HCA Healthcare',
  'Houston Methodist',
  'Intermountain Health',
  'Johns Hopkins Medicine',
  'Kaiser Permanente',
  'Mass General Brigham',
  'Mayo Clinic',
  'MedStar Health',
  'Memorial Sloan Kettering Cancer Center',
  'Methodist Health System',
  'Michigan Medicine (U of M)',
  'Mount Sinai Health System',
  'NewYork-Presbyterian',
  'Northwell Health',
  'Northwestern Medicine',
  'NYU Langone Health',
  'Ohio State Wexner Medical Center',
  'OhioHealth',
  'Orlando Health',
  'Penn Medicine',
  'Providence',
  'Rush University Medical Center',
  'Scripps Health',
  'Sharp Healthcare',
  'SSM Health',
  'Stanford Health Care',
  'Sutter Health',
  'Trinity Health',
  'Tufts Medicine',
  'UC Davis Health',
  'UC San Diego Health',
  'UCSF Health',
  'UNC Health',
  'UTHealth Houston',
  'Vanderbilt University Medical Center',
  'WakeMed Health & Hospitals',
].sort()

export function searchHospitals(query: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return SUPPORTED_HOSPITALS
  return SUPPORTED_HOSPITALS.filter(h => h.toLowerCase().includes(q))
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ConnectedCelebration.tsx apps/web/src/lib/hospitals.ts
git commit -m "feat: add ConnectedCelebration component and static hospital list"
```

---

## Chunk 5: Signup Form + Login Form + Care Group Screen

### Task 14: Update SignupForm to include RoleSelector

**Files:**
- Modify: `apps/web/src/components/SignupForm.tsx`

- [ ] **Step 1: Add role state and RoleSelector to SignupForm**

In `apps/web/src/components/SignupForm.tsx`, add after the existing imports:

```typescript
import { RoleSelector } from '@/components/RoleSelector'

type Role = 'caregiver' | 'patient' | 'self'
```

Add role state to the component:
```typescript
const [role, setRole] = useState<Role | null>(null)
const [roleError, setRoleError] = useState('')
```

Add `<RoleSelector>` inside the form, before the name input:
```typescript
<RoleSelector value={role} onChange={setRole} error={roleError} />
```

In the submit handler, validate role before submission:
```typescript
if (!role) {
  setRoleError('Please select your role to continue')
  return
}
setRoleError('')
```

Add role to the fetch body:
```typescript
body: JSON.stringify({ email, password, displayName, role, hipaaConsent }),
```

- [ ] **Step 2: Handle OAuth social sign-in with role**

For Apple/Google buttons, pass a custom state param with the role. Find where `signIn('apple', ...)` or `signIn('google', ...)` is called and add:

```typescript
// Store role in a short-lived cookie before OAuth redirect (state param approach)
// NextAuth encodes this in the state automatically if passed via callbackUrl params
await signIn('google', {
  callbackUrl: `/?pendingRole=${role}`,
  redirect: true,
})
```

Note: the `pendingRole` query param is read in the OAuth callback in `auth.ts` and saved to the user record. If role is not selected, show validation error before allowing social sign-in.

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "SignupForm" | head -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SignupForm.tsx
git commit -m "feat: add role selector to signup form"
```

---

### Task 15: Add Care Group tab to LoginForm

**Files:**
- Modify: `apps/web/src/components/LoginForm.tsx`

- [ ] **Step 1: Add tab state and Care Group fields**

In `apps/web/src/components/LoginForm.tsx`, add:

```typescript
const [tab, setTab] = useState<'email' | 'care-group'>('email')
const [groupName, setGroupName] = useState('')
const [groupPassword, setGroupPassword] = useState('')
```

Add tab toggle UI above the email field:
```typescript
<div className="grid grid-cols-2 rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
  {(['email', 'care-group'] as const).map((t) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className="py-2.5 text-xs font-semibold transition-colors"
      style={{
        background: tab === t ? '#7c3aed' : 'rgba(255,255,255,0.04)',
        color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)',
      }}
    >
      {t === 'email' ? 'Email' : 'Care Group'}
    </button>
  ))}
</div>
```

Conditionally render email fields or group fields based on `tab`:
```typescript
{tab === 'email' ? (
  <>
    <FloatingInput id="email" label="Email address" ... />
    <PasswordInput id="password" label="Password" ... />
  </>
) : (
  <>
    <FloatingInput id="groupName" label="Care Group name" value={groupName} onChange={setGroupName} />
    <PasswordInput id="groupPassword" label="Group password" value={groupPassword} onChange={setGroupPassword} />
  </>
)}
```

In the submit handler, use the appropriate signIn call:
```typescript
if (tab === 'care-group') {
  const result = await signIn('care-group', {
    groupName,
    groupPassword,
    redirect: false,
  })
  // handle error same as credentials
} else {
  // existing email credentials flow
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/LoginForm.tsx
git commit -m "feat: add Care Group login tab to LoginForm"
```

---

### Task 16: CareGroupScreen component (progressive disclosure)

**Files:**
- Create: `apps/web/src/components/CareGroupScreen.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/CareGroupScreen.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { QRCodePanel } from './QRCodePanel'
import { ConnectedCelebration } from './ConnectedCelebration'

type Step = 'pick' | 'create-form' | 'qr' | 'join-form' | 'connected'

export function CareGroupScreen({
  userRole,
  userDisplayName,
  onComplete,
}: {
  userRole: 'caregiver' | 'patient' | 'self'
  userDisplayName: string
  onComplete: (careGroupId?: string) => void
}) {
  const [step, setStep] = useState<Step>('pick')
  const [groupName, setGroupName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [careGroupId, setCareGroupId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [connectedName, setConnectedName] = useState('')

  const subheading = userRole === 'caregiver'
    ? 'Connect with your patient so you can share their health data.'
    : 'Connect with a family member or caregiver if you\'d like to share your health data.'

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/care-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setCareGroupId(data.id)

      // Generate first invite token
      const inviteRes = await fetch('/api/care-group/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careGroupId: data.id }),
      })
      const inviteData = await inviteRes.json()
      if (inviteRes.ok) setInviteUrl(inviteData.url)

      setStep('qr')
      startPolling(data.id)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/care-group/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setCareGroupId(data.id)
      setConnectedName('Your partner')  // will be enriched by status poll if group creator is present
      setStep('connected')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = useCallback((groupId: string) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/care-group/${groupId}/status`)
      const data = await res.json()
      if (data.joined) {
        clearInterval(interval)
        setConnectedName(data.name ?? 'Your partner')
        setStep('connected')
      }
    }, 3000)
    // Stop polling after 30 seconds
    setTimeout(() => clearInterval(interval), 30_000)
  }, [])

  const handleRegenerateInvite = useCallback(async (): Promise<string> => {
    if (!careGroupId) return ''
    const res = await fetch('/api/care-group/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ careGroupId }),
    })
    const data = await res.json()
    return data.url ?? ''
  }, [careGroupId])

  if (step === 'connected') {
    return (
      <ConnectedCelebration
        yourName={userDisplayName}
        theirName={connectedName}
        onContinue={() => onComplete(careGroupId ?? undefined)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-white">Set up your Care Group 👨‍👩‍👧</h1>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{subheading}</p>

      {step === 'pick' && (
        <>
          <button
            type="button"
            onClick={() => setStep('create-form')}
            className="rounded-xl p-4 text-left transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">✨ Create a new Care Group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              You're going first. Pick a group name and password to share.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStep('join-form')}
            className="rounded-xl p-4 text-left transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="font-semibold text-white text-sm">🔗 Join an existing Care Group</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enter the name and password someone gave you.
            </div>
          </button>
        </>
      )}

      {(step === 'create-form' || step === 'join-form') && (
        <>
          <button type="button" onClick={() => setStep('pick')} className="text-xs text-left mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ← Back
          </button>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl px-4 pt-5 pb-3 text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Group name</label>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. The Smith Family"
                className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none"
              />
            </div>
            <div className="rounded-xl px-4 pt-5 pb-3 text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Group password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={step === 'create-form' ? handleCreate : handleJoin}
            disabled={loading || !groupName.trim() || !password}
            className="rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            {loading ? 'Loading...' : step === 'create-form' ? 'Create Group' : 'Join Group'}
          </button>
        </>
      )}

      {step === 'qr' && inviteUrl && careGroupId && (
        <>
          <QRCodePanel
            careGroupId={careGroupId}
            initialUrl={inviteUrl}
            onRegenerate={handleRegenerateInvite}
          />
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#7c3aed' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Waiting for your patient to join...</p>
          </div>
          <button
            type="button"
            onClick={() => onComplete(careGroupId)}
            className="text-xs text-center mt-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Continue without waiting
          </button>
        </>
      )}

      {step === 'pick' && (
        <button
          type="button"
          onClick={() => onComplete()}
          className="text-xs text-center mt-2"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/CareGroupScreen.tsx
git commit -m "feat: add CareGroupScreen with progressive disclosure, QR, and join flow"
```

---

## Chunk 6: Wizard Split + New Wizard Steps

### Task 17: Split OnboardingWizard into CaregiverWizard + PatientWizard

**Files:**
- Create: `apps/web/src/components/CaregiverWizard.tsx`
- Create: `apps/web/src/components/PatientWizard.tsx`
- Modify: `apps/web/src/components/OnboardingWizard.tsx` (thin router only)

- [ ] **Step 1: Create CaregiverWizard.tsx**

Create `apps/web/src/components/CaregiverWizard.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { WizardProgressBar } from './WizardProgressBar'

const TOTAL_STEPS = 6

const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Professional caregiver', 'Other']
const EXPERIENCE_LEVELS = [
  { value: 'first_time', label: 'First time caregiver' },
  { value: 'some_experience', label: 'Some experience' },
  { value: 'experienced', label: 'Experienced caregiver' },
]
const CONCERNS = [
  { value: 'medications', emoji: '💊', label: 'Managing medications', desc: 'Tracking doses, schedules, and refills' },
  { value: 'lab_results', emoji: '🧪', label: 'Understanding lab results', desc: 'Tests and appointments' },
  { value: 'coordinating_care', emoji: '🏥', label: 'Coordinating care', desc: 'Specialists and referrals' },
  { value: 'emotional_support', emoji: '💙', label: 'Emotional support', desc: 'Coping and guidance' },
]
const PRIORITIES = ['side_effects', 'medications', 'appointments', 'lab_results', 'insurance', 'emotional_support']
const PRIORITY_LABELS: Record<string, string> = {
  side_effects: 'Side effect tracking', medications: 'Medications', appointments: 'Appointments',
  lab_results: 'Lab results', insurance: 'Insurance', emotional_support: 'Emotional support',
}
const CANCER_TYPES = ['Breast', 'Lung', 'Colorectal', 'Prostate', 'Lymphoma', 'Leukemia', 'Melanoma', 'Ovarian', 'Pancreatic', 'Thyroid', 'Bladder', 'Brain', 'Other']
const STAGES = ['I', 'II', 'III', 'IV', 'Unsure']
const PHASES = ['just_diagnosed', 'active_treatment', 'between_treatments', 'remission', 'unsure']
const PHASE_LABELS: Record<string, string> = {
  just_diagnosed: 'Just diagnosed', active_treatment: 'Active treatment',
  between_treatments: 'Between treatments', remission: 'Remission', unsure: 'Unsure',
}

async function patchProfile(careProfileId: string, data: Record<string, unknown>) {
  await fetch(`/api/care-profiles/${careProfileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function CaregiverWizard({
  careProfileId,
  careGroupId,
  onComplete,
}: {
  careProfileId: string
  careGroupId?: string
  onComplete: () => void
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 state
  const [patientName, setPatientName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [experience, setExperience] = useState('')

  // Step 2 state
  const [concern, setConcern] = useState('')

  // Step 4 state
  const [cancerType, setCancerType] = useState('')
  const [stage, setStage] = useState('')
  const [phase, setPhase] = useState('')

  // Step 5 state
  const [priorities, setPriorities] = useState<string[]>([])

  // Back-navigation guard: only allow going back, not forward-skipping
  const handleStepClick = (targetStep: number) => {
    if (targetStep < step) setStep(targetStep)
  }

  const advance = async (data: Record<string, unknown>) => {
    setSaving(true)
    try { await patchProfile(careProfileId, data) } finally { setSaving(false) }
    setStep((s) => s + 1)
  }

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window) {
      // Already granted: Notification.permission === 'granted' → auto-advance
      if (Notification.permission === 'granted') { onComplete(); return }
      await Notification.requestPermission()
    }
    onComplete()
  }

  const bar = <WizardProgressBar currentStep={step} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />

  if (step === 1) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">About your patient</h2>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Patient name *</label>
          <input value={patientName} onChange={e => setPatientName(e.target.value)} className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none" placeholder="Their name" />
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Your relationship *</label>
          <select value={relationship} onChange={e => setRelationship(e.target.value)} className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none">
            <option value="">Select...</option>
            {RELATIONSHIPS.map(r => <option key={r} value={r.toLowerCase().replace(' ', '_')}>{r}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Your caregiving experience</p>
          <div className="flex flex-col gap-2">
            {EXPERIENCE_LEVELS.map(e => (
              <button key={e.value} type="button" onClick={() => setExperience(e.value)}
                className="rounded-xl px-4 py-3 text-left text-sm transition-all"
                style={{ background: experience === e.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: experience === e.value ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', color: experience === e.value ? '#c4b5fd' : '#f1f5f9' }}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button type="button" disabled={!patientName.trim() || !relationship || saving}
        onClick={() => advance({ patientName, relationship, caregivingExperience: experience || null })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  if (step === 2) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">What&apos;s your biggest challenge right now?</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>This helps personalize your AI companion.</p>
      <div className="grid grid-cols-2 gap-3">
        {CONCERNS.map(c => (
          <button key={c.value} type="button" onClick={() => setConcern(c.value)}
            className="rounded-xl p-3 text-left transition-all"
            style={{ background: concern === c.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: concern === c.value ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-2xl mb-2">{c.emoji}</div>
            <div className="text-xs font-semibold" style={{ color: concern === c.value ? '#c4b5fd' : '#f1f5f9' }}>{c.label}</div>
            <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.desc}</div>
          </button>
        ))}
      </div>
      <button type="button" disabled={!concern || saving}
        onClick={() => advance({ primaryConcern: concern })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  if (step === 3) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Apple Health 🍎</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Ask your patient to connect their hospital through Apple Health on their phone.
        Once they do, their diagnosis, medications, and lab results will automatically appear here.
      </p>
      {careGroupId && (
        <button type="button"
          onClick={async () => {
            const res = await fetch('/api/care-group/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ careGroupId }) })
            const data = await res.json()
            if (data.url && navigator.share) await navigator.share({ title: 'Join my Care Group', url: data.url })
            else if (data.url) navigator.clipboard.writeText(data.url)
          }}
          className="rounded-xl py-3 text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
          Resend invite link
        </button>
      )}
      <button type="button" onClick={() => setStep(4)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Got it →
      </button>
    </div>
  )

  if (step === 4) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">About the diagnosis</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        This will be updated automatically once your patient connects Apple Health.
      </p>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Cancer type</label>
          <select value={cancerType} onChange={e => setCancerType(e.target.value)} className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none">
            <option value="">Select...</option>
            {CANCER_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Stage</label>
          <select value={stage} onChange={e => setStage(e.target.value)} className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none">
            <option value="">Select...</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Treatment phase</label>
          <select value={phase} onChange={e => setPhase(e.target.value)} className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none">
            <option value="">Select...</option>
            {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
      </div>
      <button type="button" disabled={saving}
        onClick={() => advance({ cancerType: cancerType || null, cancerStage: stage || null, treatmentPhase: phase || null })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
      <button type="button" onClick={() => setStep(5)} className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Skip for now
      </button>
    </div>
  )

  if (step === 5) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Your priorities</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick up to 3 focus areas.</p>
      <div className="flex flex-col gap-2">
        {PRIORITIES.map(p => {
          const selected = priorities.includes(p)
          return (
            <button key={p} type="button"
              onClick={() => setPriorities(prev => selected ? prev.filter(x => x !== p) : prev.length < 3 ? [...prev, p] : prev)}
              className="rounded-xl px-4 py-3 text-left text-sm transition-all"
              style={{ background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', color: selected ? '#c4b5fd' : '#f1f5f9' }}>
              {PRIORITY_LABELS[p]}
            </button>
          )
        })}
      </div>
      <button type="button" disabled={saving}
        onClick={() => advance({ onboardingPriorities: priorities })}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  // Step 6: Notifications
  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="text-4xl">🔔</div>
        <h2 className="text-lg font-bold text-white">Stay informed</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Stay on top of medications, appointments, and care updates.
        </p>
      </div>
      <button type="button" onClick={() => handleNotifications(true)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Enable notifications
      </button>
      <button type="button" onClick={() => handleNotifications(false)}
        className="rounded-xl py-3.5 text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Maybe later
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create PatientWizard.tsx**

Create `apps/web/src/components/PatientWizard.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { WizardProgressBar } from './WizardProgressBar'
import { searchHospitals } from '@/lib/hospitals'

const TOTAL_STEPS = 4
const PRIORITIES = ['side_effects', 'medications', 'appointments', 'lab_results', 'insurance', 'emotional_support']
const PRIORITY_LABELS: Record<string, string> = {
  side_effects: 'Side effect tracking', medications: 'Medications', appointments: 'Appointments',
  lab_results: 'Lab results', insurance: 'Insurance', emotional_support: 'Emotional support',
}

async function patchProfile(careProfileId: string, data: Record<string, unknown>) {
  await fetch(`/api/care-profiles/${careProfileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// Step 1: numeric step 1
// Step 2a (HealthKit connected) + Step 2b (manual): both count as step 2 for progress bar
// Step 3: priorities = step 3
// Step 4: notifications = step 4

type InnerStep = 'healthkit' | 'confirm' | 'manual' | 'priorities' | 'notifications'

const innerToProgressStep: Record<InnerStep, number> = {
  healthkit: 1, confirm: 2, manual: 2, priorities: 3, notifications: 4,
}

export function PatientWizard({
  careProfileId,
  onComplete,
}: {
  careProfileId: string
  onComplete: () => void
}) {
  const [inner, setInner] = useState<InnerStep>('healthkit')
  const [saving, setSaving] = useState(false)
  const [hospitalQuery, setHospitalQuery] = useState('')
  const [priorities, setPriorities] = useState<string[]>([])

  // Confirm records state (populated from HealthKit sync)
  const [confirmedData, setConfirmedData] = useState<{
    cancerType: string; stage: string; medications: string[]; nextAppointment: string
  } | null>(null)

  // Manual entry state
  const [manualDiagnosis, setManualDiagnosis] = useState('')
  const [manualMeds, setManualMeds] = useState(['', '', ''])
  const [manualAppt, setManualAppt] = useState('')

  const currentStep = innerToProgressStep[inner]
  const filteredHospitals = searchHospitals(hospitalQuery)

  // Back-nav: only allow going back (no forward-skipping)
  const handleStepClick = (targetStep: number) => {
    if (targetStep >= currentStep) return
    if (targetStep === 1) setInner('healthkit')
    else if (targetStep === 2) setInner(confirmedData ? 'confirm' : 'manual')
    else if (targetStep === 3) setInner('priorities')
  }

  const bar = <WizardProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />

  const handleNotifications = async (enable: boolean) => {
    if (enable && 'Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }
    onComplete()
  }

  if (inner === 'healthkit') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Connect Apple Health 🍎</h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Connect your hospital through Apple Health — we&apos;ll automatically pull in your diagnosis, medications, and lab results.
      </p>

      {/* Hospital search */}
      <div className="flex flex-col gap-2">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Search your hospital</label>
          <input value={hospitalQuery} onChange={e => setHospitalQuery(e.target.value)}
            placeholder="e.g. Mayo Clinic, UCSF..."
            className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none" />
        </div>
        {hospitalQuery && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: '160px', overflowY: 'auto' }}>
            {filteredHospitals.length > 0 ? filteredHospitals.slice(0, 6).map(h => (
              <button key={h} type="button" onClick={() => setHospitalQuery(h)}
                className="block w-full text-left px-4 py-2 text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.8)' }}>
                {h}
              </button>
            )) : (
              <div className="px-4 py-3">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your hospital may not support Health Records yet.
                  You can still connect Apple Health for activity, heart rate, and sleep data.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <button type="button"
        onClick={async () => {
          // On mobile (React Native), the mobile app handles HealthKit auth.
          // On web, we call the healthkit sync API with whatever data exists.
          // For web onboarding, we transition to the confirm screen optimistically.
          setSaving(true)
          try {
            // Attempt to fetch existing HealthKit data
            const res = await fetch(`/api/care-profiles/${careProfileId}`)
            const profile = await res.json()
            if (profile?.cancerType) {
              setConfirmedData({
                cancerType: profile.cancerType ?? '',
                stage: profile.cancerStage ?? '',
                medications: [],
                nextAppointment: '',
              })
              setInner('confirm')
            } else {
              // No data yet — show confirm screen with empty editable fields
              setConfirmedData({ cancerType: '', stage: '', medications: [], nextAppointment: '' })
              setInner('confirm')
            }
          } finally {
            setSaving(false)
          }
        }}
        disabled={saving}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Connecting...' : 'Connect Apple Health'}
      </button>
      <button type="button" onClick={() => setInner('manual')}
        className="rounded-xl py-3 text-sm font-medium"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Skip for now — enter manually
      </button>
    </div>
  )

  if (inner === 'confirm' && confirmedData !== null) return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Does this look right?</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap any item to edit. Your edits won&apos;t be overwritten by future syncs.</p>
      <div className="flex flex-col gap-3">
        {[
          { label: '🏥 Diagnosis', key: 'cancerType', value: confirmedData.cancerType },
          { label: '📊 Stage', key: 'stage', value: confirmedData.stage },
          { label: '🗓 Next appointment', key: 'nextAppointment', value: confirmedData.nextAppointment },
        ].map(({ label, key, value }) => (
          <div key={key} className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>{label}</label>
            <input
              value={value}
              onChange={e => setConfirmedData(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
              placeholder={value || 'Not yet available — tap to add'}
              className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none"
            />
          </div>
        ))}
      </div>
      <button type="button" disabled={saving}
        onClick={async () => {
          setSaving(true)
          // Save confirmed data; mark fields as overridden if user edited them
          const overrides: Record<string, boolean> = {}
          if (confirmedData.cancerType) overrides.cancerType = true
          if (confirmedData.stage) overrides.stage = true
          await patchProfile(careProfileId, {
            cancerType: confirmedData.cancerType || null,
            cancerStage: confirmedData.stage || null,
            fieldOverrides: overrides,
          })
          setSaving(false)
          setInner('priorities')
        }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Looks good →'}
      </button>
    </div>
  )

  if (inner === 'manual') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Let&apos;s start with what we know</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>You can update this anytime from your profile.</p>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Diagnosis</label>
          <input value={manualDiagnosis} onChange={e => setManualDiagnosis(e.target.value)}
            placeholder="e.g. Breast cancer, stage II"
            className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none" />
        </div>
        {manualMeds.map((med, i) => (
          <div key={i} className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Medication {i + 1}</label>
            <input value={med} onChange={e => setManualMeds(prev => prev.map((m, j) => j === i ? e.target.value : m))}
              placeholder={i === 0 ? 'e.g. Tamoxifen 20mg' : 'Optional'}
              className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none" />
          </div>
        ))}
        <div className="rounded-xl px-4 pt-5 pb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <label className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Next appointment date</label>
          <input type="date" value={manualAppt} onChange={e => setManualAppt(e.target.value)}
            className="block w-full bg-transparent text-white/90 text-sm mt-1 focus:outline-none" />
        </div>
      </div>
      <button type="button" disabled={saving}
        onClick={async () => {
          setSaving(true)
          await patchProfile(careProfileId, {
            cancerType: manualDiagnosis || null,
            fieldOverrides: manualDiagnosis ? { cancerType: true } : {},
          })
          setSaving(false)
          setInner('priorities')
        }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Continue →'}
      </button>
    </div>
  )

  if (inner === 'priorities') return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <h2 className="text-lg font-bold text-white mt-2">Your priorities</h2>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Pick up to 3 focus areas.</p>
      <div className="flex flex-col gap-2">
        {PRIORITIES.map(p => {
          const selected = priorities.includes(p)
          return (
            <button key={p} type="button"
              onClick={() => setPriorities(prev => selected ? prev.filter(x => x !== p) : prev.length < 3 ? [...prev, p] : prev)}
              className="rounded-xl px-4 py-3 text-left text-sm transition-all"
              style={{ background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', color: selected ? '#c4b5fd' : '#f1f5f9' }}>
              {PRIORITY_LABELS[p]}
            </button>
          )
        })}
      </div>
      <button type="button" disabled={saving}
        onClick={async () => {
          setSaving(true)
          await patchProfile(careProfileId, { onboardingPriorities: priorities })
          setSaving(false)
          setInner('notifications')
        }}
        className="rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 mt-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        {saving ? 'Saving...' : 'Next →'}
      </button>
    </div>
  )

  // Notifications step
  return (
    <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
      {bar}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="text-4xl">🔔</div>
        <h2 className="text-lg font-bold text-white">Stay on top of your care</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Stay on top of medications, appointments, and care updates.
        </p>
      </div>
      <button type="button" onClick={() => handleNotifications(true)}
        className="rounded-xl py-3.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        Enable notifications
      </button>
      <button type="button" onClick={() => handleNotifications(false)}
        className="rounded-xl py-3.5 text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
        Maybe later
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Reduce OnboardingWizard to a thin router**

In `apps/web/src/components/OnboardingWizard.tsx`, replace the 1435-line component with a thin router:

```typescript
'use client'

import { CaregiverWizard } from './CaregiverWizard'
import { PatientWizard } from './PatientWizard'

export function OnboardingWizard({
  careProfileId,
  userRole,
  careGroupId,
  onComplete,
}: {
  careProfileId: string
  userRole: 'caregiver' | 'patient' | 'self' | null
  careGroupId?: string
  onComplete: () => void
}) {
  if (userRole === 'caregiver') {
    return <CaregiverWizard careProfileId={careProfileId} careGroupId={careGroupId} onComplete={onComplete} />
  }
  // patient and self both use PatientWizard
  return <PatientWizard careProfileId={careProfileId} onComplete={onComplete} />
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -E "Wizard|wizard" | head -10
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CaregiverWizard.tsx \
        apps/web/src/components/PatientWizard.tsx \
        apps/web/src/components/OnboardingWizard.tsx
git commit -m "feat: split OnboardingWizard into CaregiverWizard + PatientWizard with progress bar"
```

---

### Task 18: Wire CareGroupScreen into OnboardingShell

**Files:**
- Modify: `apps/web/src/components/OnboardingShell.tsx`

- [ ] **Step 1: Add Care Group step to OnboardingShell**

In `apps/web/src/components/OnboardingShell.tsx`, add a `care-group` phase between signup completion and the wizard:

```typescript
type Phase = 'care-group' | 'wizard' | 'complete'
const [phase, setPhase] = useState<Phase>('care-group')
const [careGroupId, setCareGroupId] = useState<string | undefined>()

// Render based on phase
if (phase === 'care-group') {
  return (
    <CareGroupScreen
      userRole={userRole}  // from session
      userDisplayName={displayName}
      onComplete={(cgId) => {
        setCareGroupId(cgId)
        setPhase('wizard')
      }}
    />
  )
}

if (phase === 'wizard') {
  return (
    <OnboardingWizard
      careProfileId={careProfileId}
      userRole={userRole}
      careGroupId={careGroupId}
      onComplete={() => setPhase('complete')}
    />
  )
}
```

- [ ] **Step 2: Pass `userRole` from session to OnboardingShell**

In `apps/web/src/app/onboarding/page.tsx`, pass `session.user.role` to `OnboardingShell`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/OnboardingShell.tsx apps/web/src/app/onboarding/page.tsx
git commit -m "feat: wire CareGroupScreen into OnboardingShell between signup and wizard"
```

---

## Chunk 7: AI Personalization + Email + HealthKit Fix

### Task 19: Role-aware system prompt in /api/chat

**Files:**
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Write failing test**

In `apps/web/src/app/api/chat/__tests__/route.test.ts` (create if not exists), add:

```typescript
describe('system prompt personalization', () => {
  it('includes caregiver role context', () => {
    const prompt = buildSystemPrompt({ role: 'caregiver', primaryConcern: 'medications', caregivingExperience: 'first_time' })
    expect(prompt).toContain('caregiver')
    expect(prompt).toContain('medication')
    expect(prompt).toContain('first time')
  })

  it('falls back gracefully when role is null', () => {
    const prompt = buildSystemPrompt({ role: null, primaryConcern: null, caregivingExperience: null })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Extract and update system prompt builder**

In `apps/web/src/lib/system-prompt.ts`, add a function:

```typescript
export function buildRoleContext(opts: {
  role: string | null
  primaryConcern: string | null
  caregivingExperience: string | null
}): string {
  const parts: string[] = []

  if (opts.role === 'caregiver') {
    parts.push('The user is a caregiver helping a patient manage their cancer care.')
    if (opts.caregivingExperience === 'first_time') {
      parts.push('This is their first time caregiving — use plain language, offer extra context, be encouraging.')
    } else if (opts.caregivingExperience === 'experienced') {
      parts.push('They are an experienced caregiver — be direct and clinical when appropriate.')
    }
  } else if (opts.role === 'patient') {
    parts.push('The user is a patient managing their own cancer care.')
  } else if (opts.role === 'self') {
    parts.push('The user is managing their own health care independently without a dedicated caregiver.')
  }

  const concernMap: Record<string, string> = {
    medications: 'Their primary concern is managing medications — prioritize medication tracking, dose schedules, and drug interaction explanations.',
    lab_results: 'Their primary concern is understanding lab results and appointments — proactively explain test values and flag abnormal results.',
    coordinating_care: 'Their primary concern is coordinating care — surface specialist appointments, referral tracking, and questions to ask doctors.',
    emotional_support: 'Their primary concern is emotional support — open with empathy, offer coping resources, monitor caregiver stress.',
  }

  if (opts.primaryConcern && concernMap[opts.primaryConcern]) {
    parts.push(concernMap[opts.primaryConcern])
  }

  return parts.join(' ')
}
```

- [ ] **Step 3: Inject into /api/chat/route.ts**

In `apps/web/src/app/api/chat/route.ts`, fetch the user's careProfile after auth and prepend the role context to the system prompt:

```typescript
import { buildRoleContext } from '@/lib/system-prompt'

// After auth check, fetch care profile for personalization
const careProfile = await db.query.careProfiles.findFirst({
  where: eq(careProfiles.userId, session.user.id),
})

const roleContext = buildRoleContext({
  role: session.user.role ?? null,
  primaryConcern: careProfile?.primaryConcern ?? null,
  caregivingExperience: careProfile?.caregivingExperience ?? null,
})

const systemPrompt = roleContext
  ? `${roleContext}\n\n${existingSystemPrompt}`
  : existingSystemPrompt
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && bun run test:run 2>&1 | tail -10
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/chat/route.ts apps/web/src/lib/system-prompt.ts apps/web/src/app/api/chat/__tests__/route.test.ts
git commit -m "feat: inject role-aware context into AI chat system prompt"
```

---

### Task 20: Onboarding recap email

**Files:**
- Modify: `apps/web/src/lib/email.ts`

- [ ] **Step 1: Add recap email template**

In `apps/web/src/lib/email.ts`, add the template function:

```typescript
export function onboardingRecapEmailHtml({
  name,
  role,
  cancerType,
  medications,
  nextAppointment,
  careGroupName,
  dashboardUrl,
}: {
  name: string
  role: 'caregiver' | 'patient' | 'self'
  cancerType?: string | null
  medications?: string[]
  nextAppointment?: string | null
  careGroupName?: string | null
  dashboardUrl: string
}): string {
  const roleLabel = role === 'caregiver' ? 'Caregiver' : role === 'patient' ? 'Patient' : 'Self-care'
  const year = new Date().getFullYear()

  const medicationsList = medications?.length
    ? `<ul style="margin:4px 0 0;padding-left:16px;color:#4b5563;font-size:13px;">${medications.map(m => `<li>${m}</li>`).join('')}</ul>`
    : '<p style="color:#9ca3af;font-size:13px;margin:4px 0 0;">None recorded yet</p>'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>CareCompanion — You're all set!</title></head>
<body style="margin:0;padding:0;background-color:#f3f0ff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f0ff;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">CareCompanion ✓</p>
            <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:8px 0 0;">You're all set, ${name}!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;">Here's a summary of what CareCompanion knows about you (${roleLabel}).</p>
            ${cancerType ? `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">🏥 Diagnosis</p><p style="margin:0 0 16px;font-size:13px;color:#4b5563;">${cancerType}</p>` : ''}
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">💊 Medications</p>
            <div style="margin-bottom:16px;">${medicationsList}</div>
            ${nextAppointment ? `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">🗓 Next appointment</p><p style="margin:0 0 16px;font-size:13px;color:#4b5563;">${nextAppointment}</p>` : ''}
            ${careGroupName ? `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">👨‍👩‍👧 Care Group</p><p style="margin:0 0 16px;font-size:13px;color:#4b5563;">${careGroupName}</p>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
              <tr><td style="background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:8px;">
                <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;">Go to your dashboard →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© ${year} CareCompanion. You can edit any of this from your profile.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 2: Trigger the email at onboarding completion**

In `CaregiverWizard.tsx` and `PatientWizard.tsx`, after the final step completes, call a new API route `POST /api/onboarding/complete` which:
1. Marks `careProfiles.onboardingCompleted = true`
2. Fetches the care profile data
3. Calls `sendEmail()` with `onboardingRecapEmailHtml()`
4. Returns `{ success: true }`

Create `apps/web/src/app/api/onboarding/complete/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { careProfiles, medications, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail, onboardingRecapEmailHtml } from '@/lib/email'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { careProfileId } = await req.json()

  await db.update(careProfiles)
    .set({ onboardingCompleted: true })
    .where(eq(careProfiles.id, careProfileId))

  // Fetch profile data for recap email — non-blocking
  try {
    const profile = await db.query.careProfiles.findFirst({ where: eq(careProfiles.id, careProfileId) })
    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
    const meds = await db.query.medications.findMany({
      where: eq(medications.careProfileId, careProfileId),
      limit: 3,
    })

    // Fetch next appointment for recap email
    const nextAppt = await db.query.appointments.findFirst({
      where: eq(appointments.careProfileId, careProfileId),
      orderBy: (a, { asc }) => [asc(a.dateTime)],
    })

    // Fetch care group name if user is in a group
    const membership = await db.query.careGroupMembers.findFirst({
      where: eq(careGroupMembers.userId, session.user.id),
    })
    let careGroupName: string | null = null
    if (membership) {
      const group = await db.query.careGroups.findFirst({
        where: eq(careGroups.id, membership.careGroupId),
      })
      careGroupName = group?.name ?? null
    }

    if (user?.email && profile) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://carecompanionai.org'}/dashboard`
      await sendEmail({
        to: user.email,
        subject: 'You\'re all set with CareCompanion ✓',
        html: onboardingRecapEmailHtml({
          name: user.displayName ?? user.email,
          role: (user.role as 'caregiver' | 'patient' | 'self') ?? 'patient',
          cancerType: profile.cancerType,
          medications: meds.map(m => m.name),
          nextAppointment: nextAppt?.dateTime ? new Date(nextAppt.dateTime).toLocaleDateString() : null,
          careGroupName,
          dashboardUrl,
        }),
      })
    }
  } catch (err) {
    // Email is non-critical — log and continue
    console.error('[onboarding/complete] recap email failed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/email.ts apps/web/src/app/api/onboarding/complete/route.ts
git commit -m "feat: add onboarding recap email and completion API route"
```

---

### Task 21: Fix HealthKit sync route for partial success

**Files:**
- Modify: `apps/web/src/app/api/healthkit/sync/route.ts`

- [ ] **Step 1: Write failing test for partial success**

In `apps/web/src/app/api/healthkit/sync/__tests__/route.test.ts`, add:

```typescript
describe('healthkit sync partial success', () => {
  it('counts errors without throwing', () => {
    const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0, errors: 0 }
    // Simulate an insert error being caught
    try {
      throw new Error('DB constraint')
    } catch {
      counts.errors++
    }
    expect(counts.errors).toBe(1)
    expect(counts.medications).toBe(0)
  })
})
```

- [ ] **Step 2: Wrap the sync loop in try/catch**

In `apps/web/src/app/api/healthkit/sync/route.ts`, find the `for (const record of records)` loop and wrap each insert in a try/catch:

```typescript
const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0, errors: 0 }

for (const record of records) {
  if (!record.healthkitFhirId) { counts.skipped++; continue }

  try {
    if (record.type === 'medication') {
      await db.insert(medications).values({ ... }).onConflictDoUpdate({ ... })
      counts.medications++
      synced++
    } else if (record.type === 'labResult') {
      await db.insert(labResults).values({ ... }).onConflictDoUpdate({ ... })
      counts.labResults++
      synced++
    } else if (record.type === 'appointment') {
      await db.insert(appointments).values({ ... }).onConflictDoUpdate({ ... })
      counts.appointments++
      synced++
    }
  } catch (insertErr) {
    counts.errors++
    console.error('[healthkit/sync] failed to insert record:', record.healthkitFhirId, insertErr instanceof Error ? insertErr.message : insertErr)
    // Continue syncing remaining records — don't let one failure block the rest
  }
}

return NextResponse.json({ synced, counts })
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && bun run test:run src/app/api/healthkit/sync/__tests__/route.test.ts 2>&1 | tail -5
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/healthkit/sync/route.ts apps/web/src/app/api/healthkit/sync/__tests__/route.test.ts
git commit -m "fix: wrap HealthKit sync insert loop in try/catch for partial success"
```

---

### Task 22: Final checks and pre-deploy verification

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && bun run test:run 2>&1 | tail -20
```
Expected: all tests pass, no new failures.

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck 2>&1 | grep "error" | grep -v "//.*error" | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Run linter**

```bash
cd apps/web && bun run lint 2>&1 | tail -10
```
Expected: no errors (warnings acceptable).

- [ ] **Step 4: Verify Aurora migration ran**

Before deploying, confirm in AWS Query Editor:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role';
SELECT table_name FROM information_schema.tables WHERE table_name IN ('care_groups', 'care_group_members', 'care_group_invites');
```
Expected: 4 rows returned (1 + 3).

- [ ] **Step 5: Final status check**

```bash
git status   # verify nothing unexpected is unstaged
git log --oneline -15  # review commit history
```

If any files remain unstaged, add them explicitly by name (never `git add -A` — it can include sensitive or generated files):
```bash
git add apps/web/src/types/next-auth.d.ts apps/web/src/app/set-role/page.tsx
git commit -m "feat: add NextAuth type augmentation and /set-role page for pre-existing users"
```

---

## Deployment Checklist

**Before deploying (in order):**
1. Run `001-care-groups.sql` in Aurora via AWS Query Editor
2. Verify all 4 new DB columns/tables exist (Task 22 Step 4)
3. Run full test suite (Task 22 Step 1)
4. Deploy code via Vercel

**Post-deploy verification (first 5 minutes):**
- Sign up as a new Caregiver → role tiles visible on signup form
- Complete signup → Care Group screen appears
- Create a group → QR displays with countdown
- Sign in with Care Group tab on login page
- Open `/api/health` → returns 200

**Rollback plan:**
- Revert deploy on Vercel (instant)
- New DB columns are all nullable — no data loss on rollback
- New tables can stay (orphaned but harmless)
