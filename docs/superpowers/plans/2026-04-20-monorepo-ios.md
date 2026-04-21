# CareCompanion Monorepo + iOS App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the CareCompanion Next.js app into a Turborepo monorepo with shared packages, then add an Expo iOS app with HealthKit clinical record sync.

**Architecture:** The existing Next.js app moves to `apps/web/` unchanged. Three shared packages (`@carecompanion/types`, `@carecompanion/api`, `@carecompanion/utils`) are extracted and consumed by both web and a new Expo mobile app in `apps/mobile/`. The mobile app authenticates via NextAuth (Google + email/password) using a one-time code flow and calls the same existing API routes. HealthKit FHIR records are converted client-side and synced to a new `/api/healthkit/sync` endpoint.

**Tech Stack:** Turborepo v2, Bun workspaces, Next.js 14 (web), Expo ~52 + expo-router ~4 (mobile), NextAuth v5, Drizzle ORM + PostgreSQL, @kingstinct/react-native-healthkit, Upstash Redis, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-20-monorepo-ios-design.md`

---

## Actual Schema Reference (read before implementing)

Key facts from `src/lib/db/schema.ts` that differ from what you might expect:

| Table | FK | Date field | Notes |
|---|---|---|---|
| `medications` | `careProfileId` | `refillDate` (text) | Standard |
| `labResults` | `userId` (not careProfileId) | `dateTaken` (date, not timestamp) | Also has `value` not `result` |
| `appointments` | `careProfileId` | `dateTime` (timestamp) not `date` | Field is `purpose` not `notes` |
| `claims` | `userId` | `serviceDate` | Export name is `claims`, not `insuranceClaims` |
| `notifications` | `userId` | — | Has `message` not `body`, `isRead` not `readAt` |

`cognitoSub` is currently `.notNull()` — the migration must explicitly drop this constraint (safe for existing data, not a purely additive migration).

---

## File Map

### Root (new)
- Create: `package.json` — Bun workspace root
- Create: `turbo.json` — Turborepo v2 tasks pipeline
- Create: `tsconfig.base.json` — shared TS base config

### packages/types (new)
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts` — Drizzle `InferSelectModel` re-exports

### packages/utils (new)
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/vitest.config.ts`
- Create: `packages/utils/src/dates.ts`
- Create: `packages/utils/src/fhir.ts`
- Create: `packages/utils/src/validation.ts`
- Create: `packages/utils/src/index.ts`
- Create: `packages/utils/src/__tests__/dates.test.ts`
- Create: `packages/utils/src/__tests__/fhir.test.ts`
- Create: `packages/utils/src/__tests__/validation.test.ts`

### packages/api (new)
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/client.ts`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/__tests__/client.test.ts`

### apps/web (moved from root)
All existing files move here. Only these files are modified after the move:
- Modify: `apps/web/package.json` — rename to `@carecompanion/web`, add workspace deps
- Modify: `apps/web/tsconfig.json` — extend `../../tsconfig.base.json`
- Modify: `apps/web/src/lib/db/schema.ts` — add `passwordHash` to users, make `cognitoSub` nullable, add `healthkitFhirId` to medications/labResults/appointments
- Modify: `apps/web/src/lib/auth.ts` — session normalization, JWT callback stores `dbUserId`, add Credentials provider
- Create: `apps/web/src/app/api/auth/register/route.ts`
- Create: `apps/web/src/app/api/auth/set-password/route.ts`
- Create: `apps/web/src/app/api/auth/mobile-token/route.ts`
- Create: `apps/web/src/app/api/auth/mobile-token/exchange/route.ts`
- Create: `apps/web/src/app/api/healthkit/sync/route.ts`

### apps/mobile (new)
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/app/(tabs)/chat.tsx`
- Create: `apps/mobile/app/(tabs)/care.tsx`
- Create: `apps/mobile/app/(tabs)/scan.tsx`
- Create: `apps/mobile/src/services/auth.ts`
- Create: `apps/mobile/src/services/healthkit.ts`
- Create: `apps/mobile/src/services/api.ts`

---

## Chunk 1: Monorepo Scaffold

### Task 1: Create root monorepo config files

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create root `package.json`**

Include `lint-staged` config here (moved from `apps/web`) and `prepare` script for husky:

```json
{
  "name": "carecompanion-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test:run": "turbo run test:run",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5",
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "next lint --fix --file"
    ]
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

Note: `test:run` does NOT depend on `^build` — packages serve source directly and tests should not trigger a Next.js build:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {},
    "test:run": {}
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json turbo.json tsconfig.base.json
git commit -m "chore: add monorepo root config (Turborepo v2 + Bun workspaces)"
```

---

### Task 2: Move web app to apps/web/

**Files:**
- Create: `apps/web/` (all existing root web files)
- Modify: `apps/web/package.json` — rename, remove husky/lint-staged (now at root)
- Modify: `apps/web/tsconfig.json`

- [ ] **Step 1: Create the apps directory and move all web files**

```bash
mkdir -p apps/web
# Move all web app directories and files
mv src apps/web/
mv public apps/web/
mv drizzle apps/web/
mv scripts apps/web/
mv e2e apps/web/
mv types apps/web/
mv next.config.mjs apps/web/
mv next-env.d.ts apps/web/
mv postcss.config.mjs apps/web/
mv tailwind.config.ts apps/web/
mv drizzle.config.ts apps/web/
mv playwright.config.ts apps/web/
mv vitest.config.ts apps/web/
mv knip.json apps/web/
# Move dotfiles
mv .env.local apps/web/ 2>/dev/null || true
mv .env apps/web/ 2>/dev/null || true
# Move package.json last
mv package.json apps/web/package.json
```

- [ ] **Step 2: Update `apps/web/package.json`**

Change the `name` field and remove `husky` + `lint-staged` (now at root):
```json
{
  "name": "@carecompanion/web",
  ...
  // Remove: "prepare": "husky"
  // Remove: "lint-staged": { ... }
  // Remove: "husky" from devDependencies
  // Remove: "lint-staged" from devDependencies
}
```

Also add workspace dependencies:
```json
"dependencies": {
  "@carecompanion/types": "workspace:*",
  "@carecompanion/api": "workspace:*",
  "@carecompanion/utils": "workspace:*",
  ...existing deps...
}
```

- [ ] **Step 3: Move and reconfigure husky**

```bash
# .husky/ stays at the repo root — husky hooks must be at the git root
# If .husky/ doesn't exist yet, initialize it:
bunx husky init
# The existing pre-commit hook (lint-staged) should remain at root
```

- [ ] **Step 4: Update `apps/web/tsconfig.json` to extend base**

Replace the existing content with one that extends base and adds Next.js overrides:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Verify drizzle.config.ts paths are still correct**

```bash
cat apps/web/drizzle.config.ts
# schema: './src/lib/db/schema.ts' — correct relative to apps/web/
# out: './drizzle' — correct relative to apps/web/
# No changes needed.
```

- [ ] **Step 6: Install from monorepo root**

```bash
bun install
```

Expected: Bun detects workspaces, hoists shared deps. No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/ package.json
git commit -m "chore: move Next.js web app to apps/web/"
```

---

### Task 3: Verify web app works in new location

- [ ] **Step 1: Run the dev server**

```bash
cd apps/web && bun run dev
```

Expected: Next.js starts on http://localhost:3000. No import errors in console.

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: Zero TypeScript errors.

- [ ] **Step 3: Run test suite**

```bash
cd apps/web && bun run test:run
```

Expected: Same pass/fail count as before the move. Zero new failures.

- [ ] **Step 4: Run full monorepo build from root**

```bash
cd /Users/aryanmotgi/carecompanion && bun run build
```

Expected: Turborepo builds `apps/web` successfully.

- [ ] **Step 5: Commit verification**

```bash
git commit --allow-empty -m "chore: verify web app runs correctly in monorepo"
```

---

### Task 4: Update Vercel project root directory

- [ ] **Step 1: Update Vercel dashboard**

In the Vercel dashboard for the `carecompanion` project:
- Settings → General → Root Directory → change to `apps/web`
- Save

- [ ] **Step 2: Trigger preview deployment**

```bash
git push origin main
```

Watch the Vercel build log. Build must succeed with "Root Directory: apps/web" shown.

- [ ] **Step 3: Smoke test the preview URL**

Visit the preview URL and confirm login, chat, and dashboard all function.

---

## Chunk 2: Schema Migration + Shared Packages

**IMPORTANT:** Schema migration (Task 5) must run before creating the types package (Task 6), because the types package imports schema tables that need the new columns to exist.

### Task 5: DB schema migration

**Files:**
- Modify: `apps/web/src/lib/db/schema.ts`
- Run: `bun run db:push` from `apps/web/`

- [ ] **Step 1: Add `passwordHash` to users table and make `cognitoSub` nullable**

In `apps/web/src/lib/db/schema.ts`, update the `users` table:

```ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoSub: text('cognito_sub').unique(), // CHANGED: removed .notNull()
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),       // NEW: for email/password auth
  isDemo: boolean('is_demo').default(false),
  hipaaConsent: boolean('hipaa_consent').default(false),
  hipaaConsentAt: timestamp('hipaa_consent_at', { withTimezone: true }),
  hipaaConsentVersion: text('hipaa_consent_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

**Note:** Removing `.notNull()` from `cognitoSub` is a `DROP NOT NULL` constraint change — not purely additive. It is safe for existing data (no rows are modified) but requires Drizzle to generate an `ALTER TABLE` statement. Existing rows will keep their current `cognito_sub` values unchanged.

- [ ] **Step 2: Add `healthkitFhirId` to medications table**

```ts
export const medications = pgTable('medications', {
  // ...existing columns...
  healthkitFhirId: text('healthkit_fhir_id').unique(), // NEW: stable HealthKit dedup key
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 3: Add `healthkitFhirId` to labResults table**

```ts
export const labResults = pgTable('lab_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  testName: text('test_name').notNull(),
  value: text('value'),
  unit: text('unit'),
  referenceRange: text('reference_range'),
  isAbnormal: boolean('is_abnormal').default(false),
  dateTaken: date('date_taken'),    // existing: "YYYY-MM-DD" date string
  source: text('source'),
  healthkitFhirId: text('healthkit_fhir_id').unique(), // NEW
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 4: Add `healthkitFhirId` to appointments table**

```ts
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  doctorName: text('doctor_name'),
  specialty: text('specialty'),
  dateTime: timestamp('date_time', { withTimezone: true }), // existing: full timestamp
  location: text('location'),
  purpose: text('purpose'),
  healthkitFhirId: text('healthkit_fhir_id').unique(), // NEW
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

- [ ] **Step 5: Push migration**

```bash
cd apps/web && bun run db:push
```

Expected: Drizzle generates and applies:
- `ALTER TABLE users ALTER COLUMN cognito_sub DROP NOT NULL`
- `ALTER TABLE users ADD COLUMN password_hash TEXT`
- `ALTER TABLE medications ADD COLUMN healthkit_fhir_id TEXT UNIQUE`
- `ALTER TABLE lab_results ADD COLUMN healthkit_fhir_id TEXT UNIQUE`
- `ALTER TABLE appointments ADD COLUMN healthkit_fhir_id TEXT UNIQUE`

No data loss. All existing rows unaffected.

- [ ] **Step 6: Verify typecheck still passes**

```bash
cd apps/web && bun run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/db/schema.ts
git commit -m "feat(db): add passwordHash, make cognitoSub nullable, add healthkitFhirId columns"
```

---

### Task 6: Create @carecompanion/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@carecompanion/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "drizzle-orm": "^0.45.2",
    "typescript": "^5"
  }
}
```

Note: `drizzle-orm` is a devDependency here for type inference only — no runtime dep.

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

Use `bundler` resolution consistent with the base — do NOT override to `node`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

Use the actual schema export names (`claims` not `insuranceClaims`):

```ts
// Types are inferred from the Drizzle schema — never hand-written.
// Any schema change automatically propagates to both web and mobile.
// The relative path crosses workspace boundaries intentionally — types is a
// compile-time-only package with no runtime output.
import type { InferSelectModel } from 'drizzle-orm'
import type {
  users,
  careProfiles,
  medications,
  labResults,
  appointments,
  claims,          // NOTE: the table export is 'claims', not 'insuranceClaims'
  notifications,
} from '../../apps/web/src/lib/db/schema'

export type User = InferSelectModel<typeof users>
export type CareProfile = InferSelectModel<typeof careProfiles>
export type Medication = InferSelectModel<typeof medications>
export type LabResult = InferSelectModel<typeof labResults>
export type Appointment = InferSelectModel<typeof appointments>
export type InsuranceClaim = InferSelectModel<typeof claims>
export type Notification = InferSelectModel<typeof notifications>

// Discriminated union for HealthKit sync endpoint.
// Server adds userId/careProfileId from session — converters do NOT set these.
export type HealthKitMedicationRecord = {
  type: 'medication'
  healthkitFhirId: string
  name: string
  dose: string | null
  frequency: string | null
  prescribingDoctor: string | null
}

export type HealthKitLabRecord = {
  type: 'labResult'
  healthkitFhirId: string
  testName: string
  value: string
  unit: string | null
  referenceRange: string | null
  dateTaken: string | null  // "YYYY-MM-DD" format — matches labResults.dateTaken
}

export type HealthKitAppointmentRecord = {
  type: 'appointment'
  healthkitFhirId: string
  doctorName: string
  specialty: string | null
  dateTime: string          // ISO timestamp — matches appointments.dateTime
  location: string | null
}

export type HealthKitRecord =
  | HealthKitMedicationRecord
  | HealthKitLabRecord
  | HealthKitAppointmentRecord
```

- [ ] **Step 4: Verify types resolve**

```bash
cd packages/types && bun run typecheck
```

Expected: No errors. The cross-workspace import resolves because the monorepo root `tsconfig.base.json` includes `"moduleResolution": "bundler"`.

- [ ] **Step 5: Commit**

```bash
git add packages/types/
git commit -m "feat(types): add @carecompanion/types with Drizzle-derived shared types and HealthKitRecord union"
```

---

### Task 7: Create @carecompanion/utils

**Files:**
- Create: `packages/utils/package.json`
- Create: `packages/utils/tsconfig.json`
- Create: `packages/utils/vitest.config.ts`
- Create: `packages/utils/src/dates.ts`
- Create: `packages/utils/src/fhir.ts`
- Create: `packages/utils/src/validation.ts`
- Create: `packages/utils/src/index.ts`
- Test files for each module

- [ ] **Step 1: Create `packages/utils/package.json`**

```json
{
  "name": "@carecompanion/utils",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "date-fns": "^4.1.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@carecompanion/types": "workspace:*",
    "vitest": "^4.1.2",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `packages/utils/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/utils/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node' } })
```

- [ ] **Step 4: Write failing tests for `dates.ts`**

Create `packages/utils/src/__tests__/dates.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRefillCountdown, formatAppointmentDate, daysSince } from '../dates'

// Fix test clock to avoid flakiness near midnight
const FIXED_NOW = new Date('2026-04-20T12:00:00Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_NOW) })
afterEach(() => { vi.useRealTimers() })

describe('formatRefillCountdown', () => {
  it('returns "today" when refill date is today', () => {
    expect(formatRefillCountdown('2026-04-20')).toBe('Refill due today')
  })

  it('returns singular when 1 day away', () => {
    expect(formatRefillCountdown('2026-04-21')).toBe('Refill in 1 day')
  })

  it('returns plural when multiple days away', () => {
    expect(formatRefillCountdown('2026-04-23')).toBe('Refill in 3 days')
  })

  it('returns overdue for past dates', () => {
    expect(formatRefillCountdown('2026-04-18')).toBe('Refill overdue by 2 days')
  })

  it('returns empty string for null', () => {
    expect(formatRefillCountdown(null)).toBe('')
  })
})

describe('daysSince', () => {
  it('returns 0 for today', () => {
    expect(daysSince('2026-04-20T10:00:00Z')).toBe(0)
  })

  it('returns correct count for past dates', () => {
    expect(daysSince('2026-04-18T10:00:00Z')).toBe(2)
  })
})
```

- [ ] **Step 5: Run test — verify it fails**

```bash
cd packages/utils && bun run test:run
```

Expected: FAIL — `../dates` module not found.

- [ ] **Step 6: Implement `packages/utils/src/dates.ts`**

```ts
import { differenceInCalendarDays, parseISO } from 'date-fns'

export function formatRefillCountdown(refillDate: string | null): string {
  if (!refillDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = parseISO(refillDate)
  date.setHours(0, 0, 0, 0)
  const diff = differenceInCalendarDays(date, today)

  if (diff === 0) return 'Refill due today'
  if (diff === 1) return 'Refill in 1 day'
  if (diff > 1) return `Refill in ${diff} days`
  if (diff === -1) return 'Refill overdue by 1 day'
  return `Refill overdue by ${Math.abs(diff)} days`
}

export function formatAppointmentDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function daysSince(isoDate: string): number {
  return differenceInCalendarDays(new Date(), parseISO(isoDate))
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd packages/utils && bun run test:run
```

Expected: PASS — all dates tests green.

- [ ] **Step 8: Write failing tests for `fhir.ts`**

Create `packages/utils/src/__tests__/fhir.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fhirMedicationToMedication, fhirObservationToLabResult, fhirEncounterToAppointment } from '../fhir'

describe('fhirMedicationToMedication', () => {
  it('converts a FHIR MedicationRequest', () => {
    const fhir = {
      id: 'fhir-med-123',
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: { text: 'Methotrexate 2.5mg' },
      dosageInstruction: [{ text: 'Once weekly' }],
      requester: { display: 'Dr. Smith' },
    }
    const result = fhirMedicationToMedication(fhir)
    expect(result.type).toBe('medication')
    expect(result.name).toBe('Methotrexate 2.5mg')
    expect(result.frequency).toBe('Once weekly')
    expect(result.prescribingDoctor).toBe('Dr. Smith')
    expect(result.healthkitFhirId).toBe('fhir-med-123')
    // Server adds careProfileId — converter does NOT
    expect(result).not.toHaveProperty('careProfileId')
  })

  it('handles missing optional fields', () => {
    const fhir = { id: 'fhir-med-456', resourceType: 'MedicationRequest', medicationCodeableConcept: { text: 'Aspirin' } }
    const result = fhirMedicationToMedication(fhir)
    expect(result.name).toBe('Aspirin')
    expect(result.frequency).toBeNull()
    expect(result.prescribingDoctor).toBeNull()
  })
})

describe('fhirObservationToLabResult', () => {
  it('converts a FHIR Observation — output matches labResults schema (userId + dateTaken)', () => {
    const fhir = {
      id: 'fhir-obs-123',
      resourceType: 'Observation',
      code: { text: 'Hemoglobin' },
      valueQuantity: { value: 12.5, unit: 'g/dL' },
      referenceRange: [{ text: '12.0–16.0 g/dL' }],
      effectiveDateTime: '2026-04-01T10:00:00Z',
    }
    const result = fhirObservationToLabResult(fhir)
    expect(result.type).toBe('labResult')
    expect(result.testName).toBe('Hemoglobin')
    expect(result.value).toBe('12.5')
    expect(result.unit).toBe('g/dL')
    expect(result.referenceRange).toBe('12.0–16.0 g/dL')
    expect(result.dateTaken).toBe('2026-04-01') // date-only string, not ISO timestamp
    expect(result.healthkitFhirId).toBe('fhir-obs-123')
    // Server adds userId — converter does NOT
    expect(result).not.toHaveProperty('userId')
  })
})

describe('fhirEncounterToAppointment', () => {
  it('converts a FHIR Encounter — output uses dateTime (timestamp) not date string', () => {
    const fhir = {
      id: 'fhir-enc-123',
      resourceType: 'Encounter',
      participant: [{ individual: { display: 'Dr. Jones' } }],
      period: { start: '2026-05-01T09:00:00Z' },
      location: [{ location: { display: 'Cancer Center' } }],
    }
    const result = fhirEncounterToAppointment(fhir)
    expect(result.type).toBe('appointment')
    expect(result.doctorName).toBe('Dr. Jones')
    expect(result.dateTime).toBe('2026-05-01T09:00:00Z') // full ISO timestamp
    expect(result.location).toBe('Cancer Center')
    expect(result.healthkitFhirId).toBe('fhir-enc-123')
    expect(result).not.toHaveProperty('careProfileId')
  })
})
```

- [ ] **Step 9: Run test — verify it fails**

```bash
cd packages/utils && bun run test:run
```

Expected: FAIL — `../fhir` module not found.

- [ ] **Step 10: Implement `packages/utils/src/fhir.ts`**

Output field names match the actual DB schema columns. Server adds userId/careProfileId.

```ts
import type { HealthKitMedicationRecord, HealthKitLabRecord, HealthKitAppointmentRecord } from '@carecompanion/types'

type FhirResource = Record<string, unknown>

/**
 * Convert FHIR MedicationRequest → HealthKitMedicationRecord.
 * Server will add careProfileId before inserting into medications table.
 */
export function fhirMedicationToMedication(fhir: FhirResource): HealthKitMedicationRecord {
  const med = fhir.medicationCodeableConcept as { text?: string } | undefined
  const dosage = (fhir.dosageInstruction as { text?: string }[] | undefined)?.[0]
  const requester = fhir.requester as { display?: string } | undefined
  return {
    type: 'medication',
    healthkitFhirId: fhir.id as string,
    name: med?.text ?? 'Unknown medication',
    dose: null,
    frequency: dosage?.text ?? null,
    prescribingDoctor: requester?.display ?? null,
  }
}

/**
 * Convert FHIR Observation → HealthKitLabRecord.
 * dateTaken is "YYYY-MM-DD" to match labResults.dateTaken (date column).
 * Server will add userId before inserting into lab_results table.
 */
export function fhirObservationToLabResult(fhir: FhirResource): HealthKitLabRecord {
  const code = fhir.code as { text?: string } | undefined
  const quantity = fhir.valueQuantity as { value?: number; unit?: string } | undefined
  const range = (fhir.referenceRange as { text?: string }[] | undefined)?.[0]
  const effectiveDateTime = fhir.effectiveDateTime as string | undefined
  // Convert ISO timestamp to date-only string "YYYY-MM-DD"
  const dateTaken = effectiveDateTime ? effectiveDateTime.split('T')[0] : null
  return {
    type: 'labResult',
    healthkitFhirId: fhir.id as string,
    testName: code?.text ?? 'Unknown test',
    value: String(quantity?.value ?? ''),
    unit: quantity?.unit ?? null,
    referenceRange: range?.text ?? null,
    dateTaken,
  }
}

/**
 * Convert FHIR Encounter → HealthKitAppointmentRecord.
 * dateTime is a full ISO timestamp to match appointments.dateTime (timestamp column).
 * Server will add careProfileId before inserting into appointments table.
 */
export function fhirEncounterToAppointment(fhir: FhirResource): HealthKitAppointmentRecord {
  const participant = (fhir.participant as { individual?: { display?: string } }[] | undefined)?.[0]
  const period = fhir.period as { start?: string } | undefined
  const location = (fhir.location as { location?: { display?: string } }[] | undefined)?.[0]
  return {
    type: 'appointment',
    healthkitFhirId: fhir.id as string,
    doctorName: participant?.individual?.display ?? 'Unknown provider',
    specialty: null,
    dateTime: period?.start ?? new Date().toISOString(),
    location: location?.location?.display ?? null,
  }
}
```

- [ ] **Step 11: Run tests — verify they pass**

```bash
cd packages/utils && bun run test:run
```

Expected: PASS — all fhir tests green.

- [ ] **Step 12: Write failing tests for `validation.ts`**

Create `packages/utils/src/__tests__/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { medicationSchema, labResultSchema, registerSchema } from '../validation'

describe('medicationSchema', () => {
  it('accepts valid medication', () => {
    expect(medicationSchema.safeParse({ name: 'Aspirin' }).success).toBe(true)
  })
  it('rejects empty name', () => {
    expect(medicationSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('labResultSchema', () => {
  it('accepts valid lab result', () => {
    expect(labResultSchema.safeParse({ testName: 'CBC', value: '12.5', dateTaken: '2026-04-01' }).success).toBe(true)
  })
  it('rejects missing value', () => {
    expect(labResultSchema.safeParse({ testName: 'CBC', dateTaken: '2026-04-01' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('rejects short password', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short', displayName: 'Test' }).success).toBe(false)
  })
  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ email: 'not-email', password: 'validpass', displayName: 'Test' }).success).toBe(false)
  })
  it('accepts valid input', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'validpass', displayName: 'Test' }).success).toBe(true)
  })
})
```

- [ ] **Step 13: Run test — verify it fails**

```bash
cd packages/utils && bun run test:run
```

Expected: FAIL — `../validation` module not found.

- [ ] **Step 14: Implement `packages/utils/src/validation.ts`**

```ts
import { z } from 'zod'

export const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  prescribingDoctor: z.string().optional(),
  refillDate: z.string().optional(),
  notes: z.string().optional(),
  pharmacyPhone: z.string().optional(),
})

export const labResultSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  value: z.string().min(1, 'Value is required'),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  dateTaken: z.string().optional(), // "YYYY-MM-DD"
  notes: z.string().optional(),
})

export const appointmentSchema = z.object({
  doctorName: z.string().min(1, 'Doctor name is required'),
  specialty: z.string().optional(),
  dateTime: z.string().min(1, 'Date is required'), // ISO timestamp
  location: z.string().optional(),
  purpose: z.string().optional(),
})

export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required'),
})

export type MedicationInput = z.infer<typeof medicationSchema>
export type LabResultInput = z.infer<typeof labResultSchema>
export type AppointmentInput = z.infer<typeof appointmentSchema>
export type RegisterInput = z.infer<typeof registerSchema>
```

- [ ] **Step 15: Create barrel `packages/utils/src/index.ts`**

```ts
export * from './dates'
export * from './fhir'
export * from './validation'
```

- [ ] **Step 16: Run all utils tests**

```bash
cd packages/utils && bun run test:run
```

Expected: PASS — all 3 test files green, 0 failures.

- [ ] **Step 17: Commit**

```bash
git add packages/utils/
git commit -m "feat(utils): add @carecompanion/utils — dates, FHIR converters (schema-accurate), Zod validation"
```

---

### Task 8: Create @carecompanion/api

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/client.ts`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/__tests__/client.test.ts`

- [ ] **Step 1: Create `packages/api/package.json`**

```json
{
  "name": "@carecompanion/api",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@carecompanion/types": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^4.1.2",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `packages/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node' } })
```

- [ ] **Step 4: Write failing test for the API client**

Create `packages/api/src/__tests__/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../client'

const BASE_URL = 'https://carecompanion.app'

describe('createApiClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('attaches base URL to requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    const client = createApiClient({ baseUrl: BASE_URL })
    await client.medications.list('profile-1')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/medications?careProfileId=profile-1`,
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('attaches token as cookie when getToken is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    const client = createApiClient({
      baseUrl: BASE_URL,
      getToken: async () => 'test-session-token',
    })
    await client.medications.list('profile-1')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'next-auth.session-token=test-session-token',
        }),
      })
    )
  })

  it('throws on non-2xx responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
    const client = createApiClient({ baseUrl: BASE_URL })
    await expect(client.medications.list('profile-1')).rejects.toThrow('API error 401')
  })
})
```

- [ ] **Step 5: Run test — verify it fails**

```bash
cd packages/api && bun run test:run
```

Expected: FAIL — `../client` module not found.

- [ ] **Step 6: Implement `packages/api/src/client.ts`**

```ts
import type { Medication, LabResult, Appointment, HealthKitRecord } from '@carecompanion/types'

interface ApiClientConfig {
  baseUrl: string
  getToken?: () => Promise<string | null>
}

async function apiFetch(
  config: ApiClientConfig,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (config.getToken) {
    const token = await config.getToken()
    if (token) headers['Cookie'] = `next-auth.session-token=${token}`
  }

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}

export function createApiClient(config: ApiClientConfig) {
  return {
    medications: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/medications?careProfileId=${careProfileId}`, { method: 'GET' }) as Promise<Medication[]>,
      create: (data: Partial<Medication>) =>
        apiFetch(config, '/api/medications', { method: 'POST', body: JSON.stringify(data) }) as Promise<Medication>,
    },
    labResults: {
      list: (userId: string) =>
        apiFetch(config, `/api/lab-results?userId=${userId}`, { method: 'GET' }) as Promise<LabResult[]>,
    },
    appointments: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/appointments?careProfileId=${careProfileId}`, { method: 'GET' }) as Promise<Appointment[]>,
    },
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
    },
    auth: {
      exchangeCode: (code: string) =>
        apiFetch(config, '/api/auth/mobile-token/exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        }) as Promise<{ sessionToken: string }>,
      register: (data: { email: string; password: string; displayName: string }) =>
        apiFetch(config, '/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        }) as Promise<{ id: string }>,
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
```

- [ ] **Step 7: Create `packages/api/src/index.ts`**

```ts
export { createApiClient } from './client'
export type { ApiClient } from './client'
```

- [ ] **Step 8: Run tests — verify they pass**

```bash
cd packages/api && bun run test:run
```

Expected: PASS — all 3 tests green.

- [ ] **Step 9: Commit**

```bash
git add packages/api/
git commit -m "feat(api): add @carecompanion/api fetch client"
```

---

## Chunk 3: Auth Extension + Mobile Token Flow

### Task 9: Session normalization + Credentials provider + registration

**Files:**
- Modify: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/api/auth/register/route.ts`
- Create: `apps/web/src/app/api/auth/set-password/route.ts`

- [ ] **Step 1: Add bcrypt**

```bash
cd apps/web && bun add bcrypt && bun add -D @types/bcrypt
```

- [ ] **Step 2: Update `apps/web/src/lib/auth.ts`**

Replace the `jwt` and `session` callbacks. Store `dbUserId` in the JWT once at sign-in (zero N+1 DB queries on subsequent requests). Add Credentials provider:

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const { handlers, signIn, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        })
        if (!user?.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.displayName ?? user.email }
      },
    }),
  ],
  callbacks: {
    // jwt callback: runs once at sign-in. Stores DB UUID in token so session callback
    // needs zero DB queries on every subsequent request.
    async jwt({ token, account, profile, user }) {
      if (account && (profile || user)) {
        const email = (profile as Record<string, string>)?.email ?? (user?.email ?? '')
        const sub = (profile as Record<string, string>)?.sub ?? (user?.id ?? '')
        token.providerSub = sub
        token.displayName = (profile as Record<string, string>)?.name ?? user?.name ?? email
        token.isDemo = false

        // Look up DB UUID once — stored in signed JWT, not repeated on every request
        const dbUser = await db.query.users.findFirst({ where: eq(users.email, email) })
        token.dbUserId = dbUser?.id ?? null
      }
      return token
    },
    // session callback: reads from JWT only — zero DB queries
    async session({ session, token }) {
      session.user.id = (token.dbUserId ?? token.providerSub) as string
      session.user.displayName = token.displayName as string
      session.user.isDemo = token.isDemo as boolean
      return session
    },
    async signIn({ user, account, profile }) {
      if (!user.email) return true
      // Only run the upsert for Google OAuth — Credentials users already exist
      // by definition (authorize() only returns a user if it found one in the DB).
      // Running the insert for Credentials would set cognitoSub to the DB UUID,
      // which the spec explicitly forbids.
      if (account?.provider !== 'google') return true
      try {
        const p = profile as Record<string, string> | undefined
        const sub = p?.sub
        if (!sub) return true
        await db
          .insert(users)
          .values({
            cognitoSub: sub,
            email: user.email,
            displayName: user.name || user.email || '',
          })
          .onConflictDoNothing()
      } catch { /* user already exists */ }
      return true
    },
  },
})
```

- [ ] **Step 3: Audit API routes that use `session.user.id`**

```bash
grep -r "session\.user\.id" apps/web/src/app/api/ --include="*.ts" -l
```

For each file: verify it queries against `users.id` (UUID PK), not `users.cognitoSub`. Update any that query `cognitoSub` using `session.user.id`.

- [ ] **Step 4: Run existing test suite — verify nothing broke**

```bash
cd apps/web && bun run test:run
```

Expected: All existing tests pass.

- [ ] **Step 5: Write failing test for registration endpoint**

Create `apps/web/src/app/api/auth/register/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: vi.fn() } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'new-uuid' }]) })),
    })),
  },
}))
vi.mock('bcrypt', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed') } }))

describe('POST /api/auth/register', () => {
  it('returns 409 when email already registered', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ id: 'exists' } as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', password: 'password123', displayName: 'Test' }),
    }))
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid input', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-email', password: 'short' }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: Run test — verify it fails**

```bash
cd apps/web && bun run test:run src/app/api/auth/register/__tests__/route.test.ts
```

Expected: FAIL — route not found.

- [ ] **Step 7: Create `apps/web/src/app/api/auth/register/route.ts`**

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { registerSchema } from '@carecompanion/utils'

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, displayName } = parsed.data
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [newUser] = await db
    .insert(users)
    .values({ email, displayName, passwordHash })  // cognitoSub is null for email-only users
    .returning({ id: users.id })

  return NextResponse.json({ id: newUser.id }, { status: 201 })
}
```

- [ ] **Step 8: Run test — verify it passes**

```bash
cd apps/web && bun run test:run src/app/api/auth/register/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 9: Create `apps/web/src/app/api/auth/set-password/route.ts`**

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({ password: z.string().min(8) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 10: Run full test suite**

```bash
cd apps/web && bun run test:run
```

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/app/api/auth/
git commit -m "feat(auth): session normalization to UUID, Credentials provider, registration + set-password endpoints"
```

---

### Task 10: Mobile token endpoints

**Files:**
- Create: `apps/web/src/app/api/auth/mobile-token/route.ts`
- Create: `apps/web/src/app/api/auth/mobile-token/exchange/route.ts`

- [ ] **Step 1: Write failing test for exchange endpoint**

Create `apps/web/src/app/api/auth/mobile-token/exchange/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  }),
}))

describe('POST /api/auth/mobile-token/exchange', () => {
  it('returns 400 for missing code', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/mobile-token/exchange', {
      method: 'POST',
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown or expired code', async () => {
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/auth/mobile-token/exchange', {
      method: 'POST',
      body: JSON.stringify({ code: 'expired-code' }),
    }))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/web && bun run test:run src/app/api/auth/mobile-token/exchange/__tests__/route.test.ts
```

Expected: FAIL — route not found.

- [ ] **Step 3: Create `apps/web/src/app/api/auth/mobile-token/exchange/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { code?: string }
  if (!body.code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  const key = `mobile-auth:${body.code}`
  const sessionToken = await redis.get<string>(key)
  if (!sessionToken) {
    return NextResponse.json({ error: 'Code expired or invalid' }, { status: 404 })
  }

  // Single-use: delete immediately
  await redis.del(key)
  return NextResponse.json({ sessionToken })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/web && bun run test:run src/app/api/auth/mobile-token/exchange/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `apps/web/src/app/api/auth/mobile-token/route.ts`**

This endpoint is called by the mobile app AFTER a successful sign-in. It reads the raw session token from the incoming cookie header (do NOT re-encode — NextAuth v5's `encode` requires a `salt` parameter that must match what NextAuth uses internally, and any mismatch produces an unverifiable JWT). Instead, extract the raw cookie value and store it in Redis directly:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract the raw encrypted session JWT from the cookie header.
  // This is exactly the token NextAuth validates — no re-encoding needed.
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) {
    return NextResponse.json({ error: 'Session cookie not found' }, { status: 400 })
  }

  const code = randomBytes(32).toString('hex')
  // Store code → raw session token for 60 seconds, single-use
  await redis.set(`mobile-auth:${code}`, sessionToken, { ex: 60 })

  return NextResponse.json({ code })
}
```

- [ ] **Step 6: Run full test suite**

```bash
cd apps/web && bun run test:run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/auth/mobile-token/
git commit -m "feat(auth): add mobile token endpoints — one-time code exchange for native session JWT"
```

---

### Task 11: HealthKit sync endpoint

**Files:**
- Create: `apps/web/src/app/api/healthkit/sync/route.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/healthkit/sync/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })),
    })),
    query: { careProfiles: { findFirst: vi.fn() } },
  },
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))  // actual export is logAudit, not logAuditEvent

describe('POST /api/healthkit/sync', () => {
  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/sync', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with synced count', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-uuid', email: 'a@b.com' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-uuid' } as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/sync', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'fhir-1', name: 'Aspirin', dose: null, frequency: null, prescribingDoctor: null },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.synced).toBe(1)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/web && bun run test:run src/app/api/healthkit/sync/__tests__/route.test.ts
```

Expected: FAIL — route not found.

- [ ] **Step 3: Create `apps/web/src/app/api/healthkit/sync/route.ts`**

The server adds userId/careProfileId from session. Field names match the actual schema columns.

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { HealthKitRecord } from '@carecompanion/types'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { records = [] }: { records: HealthKitRecord[] } = await req.json()

  const careProfile = await db.query.careProfiles.findFirst({
    where: eq(careProfiles.userId, session.user.id),
  })
  if (!careProfile) {
    return NextResponse.json({ error: 'No care profile found' }, { status: 404 })
  }

  let synced = 0
  const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0 }

  for (const record of records) {
    // Guard: skip records with no FHIR ID — NULL healthkitFhirId bypasses unique dedup
    // (Postgres treats two NULLs as distinct, so unique index does not prevent duplicates)
    if (!record.healthkitFhirId) { counts.skipped++; continue }

    if (record.type === 'medication') {
      await db.insert(medications)
        .values({
          careProfileId: careProfile.id,
          name: record.name,
          dose: record.dose,
          frequency: record.frequency,
          prescribingDoctor: record.prescribingDoctor,
          healthkitFhirId: record.healthkitFhirId,
        })
        .onConflictDoUpdate({
          target: medications.healthkitFhirId,
          set: { name: record.name, dose: record.dose, frequency: record.frequency },
        })
      counts.medications++
      synced++
    } else if (record.type === 'labResult') {
      await db.insert(labResults)
        .values({
          userId: session.user.id,      // labResults uses userId, not careProfileId
          testName: record.testName,
          value: record.value,
          unit: record.unit,
          referenceRange: record.referenceRange,
          dateTaken: record.dateTaken,  // "YYYY-MM-DD" date string matches date column
          source: 'HealthKit',
          healthkitFhirId: record.healthkitFhirId,
        })
        .onConflictDoUpdate({
          target: labResults.healthkitFhirId,
          set: { value: record.value, unit: record.unit },
        })
      counts.labResults++
      synced++
    } else if (record.type === 'appointment') {
      await db.insert(appointments)
        .values({
          careProfileId: careProfile.id,
          doctorName: record.doctorName,
          specialty: record.specialty,
          dateTime: record.dateTime ? new Date(record.dateTime) : null,
          location: record.location,
          healthkitFhirId: record.healthkitFhirId,
        })
        .onConflictDoUpdate({
          target: appointments.healthkitFhirId,
          set: { dateTime: record.dateTime ? new Date(record.dateTime) : null, location: record.location },
        })
      counts.appointments++
      synced++
    }
  }

  // HIPAA audit log — counts only, NO PHI (no medication names, lab values, etc.)
  // Uses 'sync_data' action (existing valid AuditAction value)
  await logAudit({
    user_id: session.user.id,
    action: 'sync_data',
    resource_type: 'healthkit',
    details: { counts }, // counts only — medications: N, labResults: N, appointments: N
  })

  return NextResponse.json({ synced })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/web && bun run test:run src/app/api/healthkit/sync/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd apps/web && bun run test:run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/healthkit/
git commit -m "feat(api): add /api/healthkit/sync — upserts on healthkit_fhir_id, correct schema fields, HIPAA audit"
```

---

## Chunk 4: iOS App

### Task 12: Scaffold Expo app

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@carecompanion/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "ios": "expo run:ios",
    "ios:device": "expo run:ios --device",
    "prebuild": "expo prebuild --clean",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@carecompanion/api": "workspace:*",
    "@carecompanion/types": "workspace:*",
    "@carecompanion/utils": "workspace:*",
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-dev-client": "~4.0.0",
    "expo-auth-session": "~5.5.0",
    "expo-crypto": "~13.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-web-browser": "~13.0.0",
    "expo-camera": "~15.0.0",
    "@kingstinct/react-native-healthkit": "^10.0.0",
    "react": "18.3.2",
    "react-native": "0.76.5",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.0.0",
    "@react-native-async-storage/async-storage": "1.23.1"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "CareCompanion",
    "slug": "carecompanion",
    "scheme": "carecompanion",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "bundleIdentifier": "com.carecompanion.app",
      "supportsTablet": false,
      "infoPlist": {
        "NSHealthShareUsageDescription": "CareCompanion reads your health records to help manage cancer care — including medications, lab results, and appointments from your care team.",
        "NSHealthUpdateUsageDescription": "CareCompanion saves care data to help you track your treatment progress.",
        "NSCameraUsageDescription": "CareCompanion uses the camera to scan medical documents and prescriptions."
      },
      "entitlements": {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.background-delivery": true,
        "com.apple.developer.healthkit.access": ["health-records"]
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-camera", { "cameraPermission": "CareCompanion uses the camera to scan medical documents." }]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 3: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@carecompanion/types": ["../../packages/types/src/index.ts"],
      "@carecompanion/api": ["../../packages/api/src/index.ts"],
      "@carecompanion/utils": ["../../packages/utils/src/index.ts"]
    }
  }
}
```

- [ ] **Step 4: Create placeholder assets**

```bash
mkdir -p apps/mobile/assets
# Placeholder files — replace with real assets before App Store submission
# 1x1 white PNGs work for local dev
```

- [ ] **Step 5: Install from root**

```bash
bun install
```

Expected: Mobile deps install. No errors.

- [ ] **Step 6: Create mobile services**

Create `apps/mobile/src/services/api.ts`:

```ts
import { createApiClient } from '@carecompanion/api'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

export const apiClient = createApiClient({
  baseUrl: API_BASE,
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})
```

Create `apps/mobile/src/services/auth.ts`:

```ts
import * as WebBrowser from 'expo-web-browser'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from './api'

WebBrowser.maybeCompleteAuthSession()

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

/**
 * Google Sign-In:
 * 1. Opens web sign-in in ASWebAuthenticationSession (App Store safe)
 * 2. User completes Google OAuth on the web server
 * 3. App calls /api/auth/mobile-token to get a one-time code
 * 4. Exchanges code → session JWT → stores in SecureStore
 */
export async function signInWithGoogle(): Promise<void> {
  const result = await WebBrowser.openAuthSessionAsync(
    `${API_BASE}/login`,
    'carecompanion://auth/callback'
  )
  if (result.type !== 'success') throw new Error('Sign-in cancelled')
  await generateAndStoreToken()
}

export async function signInWithCredentials(
  email: string,
  password: string,
  mode: 'signin' | 'register'
): Promise<void> {
  if (mode === 'register') {
    await apiClient.auth.register({ email, password, displayName: email })
  }

  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json() as { csrfToken: string }

  const res = await fetch(`${API_BASE}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, redirect: false, csrfToken }),
    // NOTE: React Native fetch silently ignores `credentials: 'include'`.
    // Cookies are NOT automatically stored. We must manually extract the
    // session cookie from the Set-Cookie response header.
  })
  if (!res.ok) throw new Error('Sign-in failed')

  // Manually extract the session token from the Set-Cookie header
  // (React Native does not implement automatic cookie storage)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const sessionCookieName =
    setCookie.includes('__Secure-next-auth.session-token')
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'
  const match = setCookie.match(new RegExp(`${sessionCookieName}=([^;]+)`))
  const sessionToken = match?.[1]

  if (!sessionToken) throw new Error('No session cookie in sign-in response')

  // Store directly — no need to go through /api/auth/mobile-token for credentials flow
  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

async function generateAndStoreToken(): Promise<void> {
  // Called after Google OAuth — the session exists server-side.
  // We send the session cookie explicitly (extracted from the WebBrowser session
  // is not possible; instead, this is called when the mobile app already has a
  // session cookie from a prior credentials sign-in, or via the generate endpoint).
  // For Google flow: the WebBrowser session set a cookie in Safari's sandbox.
  // We call /api/auth/mobile-token with that cookie via the shared cookie store.
  const genRes = await fetch(`${API_BASE}/api/auth/mobile-token`, {
    method: 'POST',
    // React Native does not send cookies automatically.
    // This step only works reliably for Google OAuth when using a session
    // that was established in the current process (e.g., via credentials).
    // For Google OAuth via WebBrowser, the session cookie is in Safari's
    // isolated sandbox and is inaccessible — this is a known limitation.
    // V1 workaround: prompt user to also complete email/password setup so
    // mobile has a direct credential path. Track as known issue.
  })
  if (!genRes.ok) throw new Error('Failed to generate mobile token')
  const { code } = await genRes.json() as { code: string }

  const { sessionToken } = await apiClient.auth.exchangeCode(code)

  await SecureStore.setItemAsync('cc-session-token', sessionToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync('cc-session-token')
}
```

Create `apps/mobile/src/services/healthkit.ts`:

```ts
import Healthkit, { HKClinicalTypeIdentifier } from '@kingstinct/react-native-healthkit'
import { fhirMedicationToMedication, fhirObservationToLabResult, fhirEncounterToAppointment } from '@carecompanion/utils'
import { apiClient } from './api'
import type { HealthKitRecord } from '@carecompanion/types'

const CLINICAL_TYPES = [
  HKClinicalTypeIdentifier.allergyRecord,
  HKClinicalTypeIdentifier.conditionRecord,
  HKClinicalTypeIdentifier.labResultRecord,
  HKClinicalTypeIdentifier.medicationRecord,
  HKClinicalTypeIdentifier.procedureRecord,
]

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    // `as never` suppresses a v10 type mismatch between HKClinicalTypeIdentifier[]
    // and the second param overload. The runtime behavior is correct — this is a
    // known typing gap in @kingstinct/react-native-healthkit v10 clinical overloads.
    await Healthkit.requestAuthorization([], CLINICAL_TYPES as never)
    return true
  } catch {
    return false
  }
}

/**
 * Sync all available HealthKit clinical records to the backend.
 * Reads medications, lab results, and appointments (encounters).
 * Safe to call on every app open — server upserts on healthkitFhirId, no duplicates.
 */
export async function syncHealthKitData(): Promise<{ synced: number }> {
  const granted = await requestHealthKitPermissions()
  if (!granted) return { synced: 0 }

  const records: HealthKitRecord[] = []

  // Medications — FHIR MedicationRequest
  try {
    const meds = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.medicationRecord, {})
    for (const med of meds) {
      if (med.fhirResource) records.push(fhirMedicationToMedication(med.fhirResource as Record<string, unknown>))
    }
  } catch { /* user may deny this specific type */ }

  // Lab results — FHIR Observation
  try {
    const labs = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.labResultRecord, {})
    for (const lab of labs) {
      if (lab.fhirResource) records.push(fhirObservationToLabResult(lab.fhirResource as Record<string, unknown>))
    }
  } catch { /* user may deny this specific type */ }

  // Appointments — FHIR Encounter (via procedure records which map to encounters)
  // Note: HealthKit does not have a dedicated "appointment" clinical type.
  // Encounters come via conditionRecord or are embedded in procedure data.
  // For v1, we query vitalSignRecord as a proxy and skip non-Encounter resources.
  try {
    const procedures = await Healthkit.queryClinicalSamples(HKClinicalTypeIdentifier.procedureRecord, {})
    for (const proc of procedures) {
      if (proc.fhirResource && (proc.fhirResource as Record<string, unknown>).resourceType === 'Encounter') {
        records.push(fhirEncounterToAppointment(proc.fhirResource as Record<string, unknown>))
      }
    }
  } catch { /* user may deny this specific type */ }

  if (records.length === 0) return { synced: 0 }
  return apiClient.healthkit.sync(records)
}
```

- [ ] **Step 7: Commit services**

```bash
git add apps/mobile/
git commit -m "feat(mobile): scaffold Expo app — package.json, app.json, services (auth, healthkit, api)"
```

---

### Task 13: Create app screens

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/app/(tabs)/chat.tsx`
- Create: `apps/mobile/app/(tabs)/care.tsx`
- Create: `apps/mobile/app/(tabs)/scan.tsx`

- [ ] **Step 1: Create `apps/mobile/app/_layout.tsx`**

```tsx
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const inLogin = segments[0] === 'login'
      if (!token && !inLogin) router.replace('/login')
      else if (token && inLogin) router.replace('/(tabs)')
    }
    check()
  }, [segments])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGate>
  )
}
```

- [ ] **Step 2: Create `apps/mobile/app/login.tsx`**

```tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { signInWithGoogle, signInWithCredentials } from '../src/services/auth'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'register'>('signin')

  async function handleGoogle() {
    setLoading(true)
    try { await signInWithGoogle(); router.replace('/(tabs)') }
    catch (e) { Alert.alert('Error', String(e)) }
    finally { setLoading(false) }
  }

  async function handleCredentials() {
    if (!email || !password) { Alert.alert('Required', 'Enter email and password'); return }
    setLoading(true)
    try { await signInWithCredentials(email, password, mode); router.replace('/(tabs)') }
    catch (e) { Alert.alert('Error', String(e)) }
    finally { setLoading(false) }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>CareCompanion</Text>
      <Text style={s.sub}>Cancer care, simplified</Text>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleCredentials} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(m => m === 'signin' ? 'register' : 'signin')}>
        <Text style={s.link}>{mode === 'signin' ? 'No account? Register' : 'Have account? Sign In'}</Text>
      </TouchableOpacity>
      <Text style={s.or}>or</Text>
      <TouchableOpacity style={[s.btn, s.google]} onPress={handleGoogle} disabled={loading}>
        <Text style={s.btnText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  google: { backgroundColor: '#ea4335' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#2563eb', marginBottom: 16 },
  or: { textAlign: 'center', color: '#999', marginVertical: 8 },
})
```

- [ ] **Step 3: Create `apps/mobile/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="care" options={{ title: 'Care' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
    </Tabs>
  )
}
```

- [ ] **Step 4: Create `apps/mobile/app/(tabs)/index.tsx`**

```tsx
import { useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { syncHealthKitData } from '../../src/services/healthkit'

export default function HomeScreen() {
  useEffect(() => {
    // Sync HealthKit on every app open — server deduplicates via healthkitFhirId
    syncHealthKitData().catch(console.error)
  }, [])

  return (
    <ScrollView style={s.container}>
      <Text style={s.heading}>Welcome back</Text>
      <View style={s.card}><Text style={s.cardTitle}>Upcoming Appointments</Text><Text style={s.placeholder}>Syncing from HealthKit...</Text></View>
      <View style={s.card}><Text style={s.cardTitle}>Medications</Text><Text style={s.placeholder}>Syncing from HealthKit...</Text></View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', marginTop: 48, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  placeholder: { color: '#999', fontSize: 14 },
})
```

- [ ] **Step 5: Create `apps/mobile/app/(tabs)/chat.tsx`**

```tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    const msg: Message = { role: 'user', content: input }
    const next = [...messages, msg]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `next-auth.session-token=${token}` } : {}) },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json() as { content?: string }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? 'Sorry, try again.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList data={messages} keyExtractor={(_, i) => String(i)} contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === 'user' ? s.user : s.ai]}>
            <Text style={item.role === 'user' ? s.userText : s.aiText}>{item.content}</Text>
          </View>
        )} />
      <View style={s.row}>
        <TextInput style={s.input} value={input} onChangeText={setInput} placeholder="Ask about your care..." multiline />
        <TouchableOpacity style={s.send} onPress={send} disabled={loading}><Text style={s.sendText}>Send</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16, paddingBottom: 8 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: '80%' },
  user: { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  ai: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e5e7eb' },
  userText: { color: '#fff', fontSize: 15 },
  aiText: { color: '#1a1a1a', fontSize: 15 },
  row: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, maxHeight: 100 },
  send: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  sendText: { color: '#fff', fontWeight: '600' },
})
```

- [ ] **Step 6: Create `apps/mobile/app/(tabs)/care.tsx` and `scan.tsx`**

Create `apps/mobile/app/(tabs)/care.tsx`:
```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native'
export default function CareScreen() {
  return (
    <ScrollView style={s.container}>
      <Text style={s.heading}>Medications & Labs</Text>
      <View style={s.card}><Text style={s.title}>Medications</Text><Text style={s.sub}>Synced from HealthKit</Text></View>
      <View style={s.card}><Text style={s.title}>Lab Results</Text><Text style={s.sub}>Synced from HealthKit clinical records</Text></View>
    </ScrollView>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  heading: { fontSize: 24, fontWeight: 'bold', marginTop: 48, marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#999', fontSize: 14 },
})
```

Create `apps/mobile/app/(tabs)/scan.tsx`:
```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
export default function ScanScreen() {
  return (
    <View style={s.container}>
      <Text style={s.heading}>Scan Document</Text>
      <Text style={s.sub}>Photograph a prescription, lab report, or insurance card</Text>
      <TouchableOpacity style={s.btn}><Text style={s.btnText}>Open Camera</Text></TouchableOpacity>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 7: Typecheck mobile app**

```bash
cd apps/mobile && bun run typecheck
```

Expected: No errors. (Run `bun run prebuild` first if Expo types aren't generated yet.)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(mobile): add all app screens — home (HealthKit sync on open), chat, care, scan, login"
```

---

### Task 14: expo prebuild + verify

- [ ] **Step 1: Create placeholder assets (required by prebuild)**

`expo prebuild` will fail if `assets/icon.png` and `assets/splash.png` are missing. Create minimal placeholder PNGs:

```bash
cd apps/mobile
# Create a 1x1 white PNG (base64 encoded minimal PNG)
python3 -c "
import base64, pathlib
# Minimal 1x1 white PNG
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==')
pathlib.Path('assets/icon.png').write_bytes(png)
pathlib.Path('assets/splash.png').write_bytes(png)
"
```

- [ ] **Step 2: Initialize EAS project (required on first prebuild)**

`expo prebuild` will prompt interactively for an EAS project ID if none exists. Run this once:

```bash
cd apps/mobile && npx eas init
```

Expected: Creates `eas.json` and links the project to your Expo account. Requires you to be logged in (`npx expo login`).

- [ ] **Step 3: Run expo prebuild**

```bash
cd apps/mobile && npx expo prebuild --clean
```

Expected:
- Creates `apps/mobile/ios/` — Xcode project
- Creates `apps/mobile/android/` — can be ignored for now
- No errors about missing plugins or config

- [ ] **Step 4: Verify Xcode workspace**

```bash
ls apps/mobile/ios/CareCompanion.xcworkspace
```

Expected: Directory exists.

**To open in Xcode:**
```
open apps/mobile/ios/CareCompanion.xcworkspace
```

In Xcode: CareCompanion target → Signing & Capabilities → Team → select your Apple Developer team. Confirm HealthKit capability is listed (added by prebuild from `app.json` entitlements).

- [ ] **Step 5: Add ios/ to git**

```bash
git add apps/mobile/ios/ apps/mobile/android/ apps/mobile/assets/ eas.json
git commit -m "feat(mobile): expo prebuild — generate ios/ Xcode project with HealthKit entitlements"
```

- [ ] **Step 6: Final monorepo typecheck**

```bash
cd /Users/aryanmotgi/carecompanion && bun run typecheck
```

Expected: All packages and apps pass with zero errors.

- [ ] **Step 7: Final test run**

```bash
bun run test:run
```

Expected: All tests in `packages/utils`, `packages/api`, and `apps/web` pass.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: monorepo + iOS app complete — all tests pass, prebuild done"
```

---

## How to Run

### Web app
```bash
# From root
bun run dev
# Or directly
cd apps/web && bun run dev
```

### iOS — Metro bundler
```bash
cd apps/mobile && bun run start
# (alias for: npx expo start --dev-client)
```

### iOS — iPhone Simulator
```bash
cd apps/mobile && npx expo run:ios
```

### iOS — Real iPhone
```bash
cd apps/mobile && npx expo run:ios --device
# Requirements:
# - Apple Developer account
# - iPhone connected via USB and trusted
# - Xcode signed in with your Apple ID (Xcode → Settings → Accounts)
# - HealthKit clinical records require a REAL device — Simulator blocks clinical record access
```

### Xcode (for signing, TestFlight, App Store)
```
open apps/mobile/ios/CareCompanion.xcworkspace
```

---

## Environment Variables

Mobile app — create `apps/mobile/.env.local`:
```
EXPO_PUBLIC_API_BASE_URL=https://carecompanion.app
```

For local development (iOS Simulator talks to your Mac's Next.js dev server):
```
EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_LAN_IP:3000
```

Find your LAN IP with: `ipconfig getifaddr en0`

Do NOT use `localhost` — the Simulator and device cannot reach the Mac's loopback.
