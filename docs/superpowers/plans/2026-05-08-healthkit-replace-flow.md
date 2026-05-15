# HealthKit Replace-or-Merge Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "merge or replace" decision screen between iOS HealthKit grant and the sync call, plus a new atomic `/api/healthkit/replace` backend endpoint that wipes existing medical data and care-profile fields before re-syncing.

**Architecture:** New POST route on the web side runs wipe-in-transaction + best-effort upserts. Mobile gets a new full-screen route at `/health-replace-prompt`, called from `health-connect.tsx::handleConnect` after auth grant when the user already has medical data. The shared `apiClient.healthkit.replace()` is added to `packages/api/src/client.ts`. Care-profile fields are nulled (row preserved for FK chain) and `onboardingCompleted` is reset, which trips the existing post-replace redirect to `/setup`.

**Tech Stack:** Next.js App Router (Aurora/Drizzle), Vitest, Expo Router, React Native, expo-secure-store

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/web/src/app/api/healthkit/replace/route.ts` | POST handler — wipe in transaction + sync upsert loop |
| Create | `apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts` | Vitest suite for the new endpoint |
| Modify | `packages/api/src/client.ts` | Add `apiClient.healthkit.replace(records)` client |
| Modify | `apps/mobile/src/services/healthkit.ts` | Add `replaceHealthKitData()` + `hasExistingMedicalData()` helpers |
| Create | `apps/mobile/app/health-replace-prompt.tsx` | New merge/replace screen |
| Modify | `apps/mobile/app/health-connect.tsx` | Branch to prompt screen after grant when existing data |

---

## Task 1: Backend route — failing tests

**Files:**
- Create: `apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts`

**Context:** Vitest tests come first per TDD. The test file has the same shape as the existing `/api/healthkit/sync/__tests__/route.test.ts` — mocks `@/lib/auth`, `@/lib/db`, `@/lib/audit`. The existing test mocks `db.insert(...).values(...).onConflictDoUpdate(...)`; we additionally mock `db.update(...)`, `db.delete(...)`, and `db.transaction((tx) => fn(tx))`.

- [ ] **Step 1: Create the test file**

```ts
// apps/web/src/app/api/healthkit/replace/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => {
  const txStub = {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
  }
  return {
    db: {
      transaction: vi.fn(async (fn: (tx: typeof txStub) => Promise<void>) => fn(txStub)),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue([]) })),
      })),
      query: { careProfiles: { findFirst: vi.fn() } },
    },
  }
})
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

describe('POST /api/healthkit/replace', () => {
  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no care profile', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce(undefined as never)
    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))
    expect(res.status).toBe(404)
  })

  it('runs wipe in transaction and inserts records, returns counts', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)

    const { POST } = await import('../route')
    const res = await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({
        records: [
          { type: 'medication', healthkitFhirId: 'fhir-m-1', name: 'Aspirin', dose: null, frequency: null, prescribingDoctor: null },
          { type: 'labResult', healthkitFhirId: 'fhir-l-1', testName: 'CBC', value: '5', unit: 'g/dL', referenceRange: null, dateTaken: '2026-05-01' },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(body.synced).toBe(2)
    expect(body.deleted).toEqual({ medications: 0, appointments: 0, labResults: 0 })
  })

  it('logs replace_data audit entry with counts only', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.careProfiles.findFirst).mockResolvedValueOnce({ id: 'profile-1' } as never)
    const { logAudit } = await import('@/lib/audit')

    const { POST } = await import('../route')
    await POST(new Request('http://localhost/api/healthkit/replace', {
      method: 'POST',
      body: JSON.stringify({ records: [] }),
    }))

    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      action: 'replace_data',
      resource_type: 'healthkit',
      details: expect.objectContaining({
        deleted: expect.any(Object),
        synced: expect.any(Object),
        careProfileReset: true,
      }),
    }))
  })
})
```

- [ ] **Step 2: Run the tests to verify all four fail**

```bash
cd apps/web && npx vitest run src/app/api/healthkit/replace/__tests__/route.test.ts
```

Expected: 4 tests FAIL with `Cannot find module '../route'` (route file doesn't exist yet).

---

## Task 2: Backend route — implementation

**Files:**
- Create: `apps/web/src/app/api/healthkit/replace/route.ts`

**Context:** Mirrors the existing `/api/healthkit/sync` route's auth + careProfile lookup + insert loop, but wraps wipe operations in `db.transaction()`. Wipe is atomic; the post-transaction sync loop tolerates per-record errors (matches `/sync` behavior). Care-profile field reset list comes from the spec's careProfile schema audit.

- [ ] **Step 1: Create the route**

```ts
// apps/web/src/app/api/healthkit/replace/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { medications, labResults, appointments, careProfiles } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
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

  // ── Wipe phase: atomic via transaction ─────────────────────────────────────
  const deleted = { medications: 0, appointments: 0, labResults: 0 }
  await db.transaction(async (tx) => {
    await tx
      .update(medications)
      .set({ deletedAt: new Date() })
      .where(and(eq(medications.careProfileId, careProfile.id), isNull(medications.deletedAt)))

    await tx
      .update(appointments)
      .set({ deletedAt: new Date() })
      .where(and(eq(appointments.careProfileId, careProfile.id), isNull(appointments.deletedAt)))

    await tx.delete(labResults).where(eq(labResults.userId, session.user!.id))

    await tx
      .update(careProfiles)
      .set({
        patientName: null,
        patientAge: null,
        relationship: null,
        cancerType: null,
        cancerStage: null,
        treatmentPhase: null,
        conditions: null,
        allergies: null,
        onboardingCompleted: false,
        onboardingPriorities: [],
        emergencyContactName: null,
        emergencyContactPhone: null,
        caregivingExperience: null,
        primaryConcern: null,
        city: null,
        state: null,
        zipCode: null,
        fieldOverrides: null,
      })
      .where(eq(careProfiles.id, careProfile.id))
  })

  // ── Sync phase: best-effort upserts (matches /api/healthkit/sync) ──────────
  let synced = 0
  let errors = 0
  const counts = { medications: 0, labResults: 0, appointments: 0, skipped: 0 }

  for (const record of records) {
    if (!record.healthkitFhirId) { counts.skipped++; continue }

    if (record.type === 'medication') {
      try {
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
      } catch (err) {
        errors++
        console.error('[healthkit/replace] insert failed for medication record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'labResult') {
      try {
        await db.insert(labResults)
          .values({
            userId: session.user.id,
            testName: record.testName,
            value: record.value,
            unit: record.unit,
            referenceRange: record.referenceRange,
            dateTaken: record.dateTaken,
            source: 'HealthKit',
            healthkitFhirId: record.healthkitFhirId,
          })
          .onConflictDoUpdate({
            target: labResults.healthkitFhirId,
            set: { value: record.value, unit: record.unit },
          })
        counts.labResults++
        synced++
      } catch (err) {
        errors++
        console.error('[healthkit/replace] insert failed for labResult record:', err instanceof Error ? err.message : err)
      }
    } else if (record.type === 'appointment') {
      try {
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
      } catch (err) {
        errors++
        console.error('[healthkit/replace] insert failed for appointment record:', err instanceof Error ? err.message : err)
      }
    }
  }

  // HIPAA audit log — counts only, NO PHI
  await logAudit({
    user_id: session.user.id,
    action: 'replace_data',
    resource_type: 'healthkit',
    details: { deleted, synced: counts, careProfileReset: true },
  })

  return NextResponse.json({ deleted, synced, errors })
}
```

- [ ] **Step 2: Run the tests, verify all four pass**

```bash
cd apps/web && npx vitest run src/app/api/healthkit/replace/__tests__/route.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 3: Run typecheck + lint**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/healthkit/replace/
git commit -m "$(cat <<'EOF'
feat(healthkit): add /api/healthkit/replace endpoint

Atomic wipe-then-sync flow: soft-deletes medications/appointments,
hard-deletes lab results, nulls care profile fields, then runs the
existing upsert loop. Returns delete + sync counts. Audit-logged with
counts only (no PHI per CLAUDE.md rule 7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Shared API client — `healthkit.replace`

**Files:**
- Modify: `packages/api/src/client.ts:135-141`

**Context:** The mobile app reaches the web API via the shared `@carecompanion/api` package. We add `replace()` next to `sync()` with the same shape — accepts records, returns `{ synced, errors, deleted }`.

- [ ] **Step 1: Add the replace method**

In `packages/api/src/client.ts`, find:

```ts
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
    },
```

Replace with:

```ts
    healthkit: {
      sync: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/sync', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number }>,
      replace: (records: HealthKitRecord[]) =>
        apiFetch(config, '/api/healthkit/replace', {
          method: 'POST',
          body: JSON.stringify({ records }),
        }) as Promise<{ synced: number; errors: number; deleted: { medications: number; appointments: number; labResults: number } }>,
    },
```

- [ ] **Step 2: Typecheck the package**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck
```

Expected: pass (mobile + web both type-clean against the new method).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/client.ts
git commit -m "$(cat <<'EOF'
feat(api): add healthkit.replace client method

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Mobile services — `replaceHealthKitData` + `hasExistingMedicalData`

**Files:**
- Modify: `apps/mobile/src/services/healthkit.ts`

**Context:** `replaceHealthKitData()` mirrors `syncHealthKitData()`'s normalize-then-POST shape but hits the new `replace` client. `hasExistingMedicalData()` runs three list calls in parallel and returns true if any list is non-empty. Used by `health-connect.tsx` to decide whether to show the prompt.

- [ ] **Step 1: Add the helpers**

In `apps/mobile/src/services/healthkit.ts`, find the closing of `syncHealthKitData()` (the line `return apiClient.healthkit.sync(records)` followed by `}`).

After that closing `}`, add:

```ts
/**
 * Same shape as syncHealthKitData but hits /api/healthkit/replace.
 * Backend wipes existing medical data + nulls care profile fields,
 * then upserts the new HealthKit records in one round-trip.
 */
export async function replaceHealthKitData(): Promise<{
  synced: number
  errors: number
  deleted: { medications: number; appointments: number; labResults: number }
}> {
  if (!Bridge) return { synced: 0, errors: 0, deleted: { medications: 0, appointments: 0, labResults: 0 } }

  let raw: RawClinicalRecord[]
  try {
    raw = await Bridge.fetchClinicalRecords()
  } catch (err) {
    console.warn('[HealthKit] fetchClinicalRecords failed:', err)
    return { synced: 0, errors: 0, deleted: { medications: 0, appointments: 0, labResults: 0 } }
  }

  const records: HealthKitRecord[] = raw.flatMap((r) => {
    const parsed = normalise(r)
    return parsed ? [parsed] : []
  })

  return apiClient.healthkit.replace(records)
}

/**
 * Returns true if the user already has any meds/labs/appts in CC.
 * Used to decide whether to show the merge/replace prompt vs. straight sync.
 * Fails closed (returns false) — never blocks the connect flow on a preflight check.
 */
export async function hasExistingMedicalData(careProfileId: string): Promise<boolean> {
  try {
    const [meds, labs, appts] = await Promise.all([
      apiClient.medications.list(careProfileId).catch(() => [] as unknown[]),
      apiClient.labResults.list(careProfileId).catch(() => ({ labs: [] as unknown[] })),
      apiClient.appointments.list(careProfileId).catch(() => [] as unknown[]),
    ])
    const labArr = Array.isArray(labs) ? labs : (labs as { labs: unknown[] }).labs
    return (meds as unknown[]).length > 0 || labArr.length > 0 || (appts as unknown[]).length > 0
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/services/healthkit.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add replaceHealthKitData + hasExistingMedicalData helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: New screen — `health-replace-prompt.tsx`

**Files:**
- Create: `apps/mobile/app/health-replace-prompt.tsx`

**Context:** Full-screen route shown after iOS HealthKit grant when the user has existing medical data. Two cards: Merge (existing sync path) and Replace All (new path → confirmation alert → `replaceHealthKitData()` → re-onboarding). Uses the same theme + linear-gradient pattern as `settings.tsx` for visual consistency.

- [ ] **Step 1: Create the screen**

```tsx
// apps/mobile/app/health-replace-prompt.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/theme'
import { useProfile } from '../src/context/ProfileContext'
import { syncHealthKitData, replaceHealthKitData } from '../src/services/healthkit'

export default function HealthReplacePromptScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { refetch } = useProfile()
  const [busy, setBusy] = useState<'merge' | 'replace' | null>(null)

  async function onMerge() {
    if (busy) return
    setBusy('merge')
    try {
      await syncHealthKitData()
      router.back()
    } catch {
      Alert.alert('Sync failed', 'Could not import your HealthKit records. You can try again from Settings.')
      setBusy(null)
    }
  }

  function onReplaceTap() {
    if (busy) return
    Alert.alert(
      'Replace all your data?',
      'This deletes all medications, lab results, appointments, and your care profile setup. You\'ll re-do the onboarding flow. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: confirmReplace },
      ],
    )
  }

  async function confirmReplace() {
    setBusy('replace')
    try {
      const result = await replaceHealthKitData()
      await refetch()
      if (result.errors > 0) {
        Alert.alert(
          "Some records didn't sync",
          `Your old data was cleared but ${result.errors} HealthKit record(s) failed to import. You can re-sync from Settings later.`,
          [{ text: 'OK', onPress: () => router.replace('/setup' as any) }],
        )
      } else {
        router.replace('/setup' as any)
      }
    } catch {
      Alert.alert('Replace failed', 'Your data was not changed. Please try again.')
      setBusy(null)
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.gradientAMuted as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
      >
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
          <Ionicons name="checkmark-circle" size={28} color={theme.accent} />
        </View>
        <Text style={[styles.connectedLabel, { color: theme.accent }]}>Connected to Apple Health</Text>
        <Text style={[styles.title, { color: theme.text }]}>How should we merge your data?</Text>

        {/* Merge card */}
        <Pressable
          onPress={onMerge}
          disabled={!!busy}
          style={[styles.card, { borderColor: theme.bgCardBorder, opacity: busy && busy !== 'merge' ? 0.5 : 1 }]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>Add HealthKit data alongside what's already in CareCompanion</Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Existing medications, lab results, and appointments are kept. HealthKit records are added.
            Records you've already synced are deduplicated automatically.
          </Text>
          <View style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text style={styles.ctaText}>{busy === 'merge' ? 'Merging…' : 'Merge'}</Text>
          </View>
        </Pressable>

        {/* Replace card */}
        <Pressable
          onPress={onReplaceTap}
          disabled={!!busy}
          style={[styles.card, { borderColor: 'rgba(244,63,94,0.4)', opacity: busy && busy !== 'replace' ? 0.5 : 1 }]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>Start fresh from HealthKit</Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Your existing medications, lab results, appointments, and care profile (cancer type, treatment phase, etc.)
            are deleted. You'll be asked to set up your care profile again. <Text style={{ fontWeight: '700' }}>This cannot be undone.</Text>
          </Text>
          <View style={[styles.cta, { backgroundColor: theme.rose }]}>
            <Text style={styles.ctaText}>{busy === 'replace' ? 'Replacing…' : 'Replace All'}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  connectedLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24, lineHeight: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  cta: { paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/health-replace-prompt.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add /health-replace-prompt merge-or-replace screen

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire the prompt into `health-connect.tsx`

**Files:**
- Modify: `apps/mobile/app/health-connect.tsx`

**Context:** After `requestHealthKitPermissions()` returns granted, the existing handler runs the success animation + back-nav. New behavior: check `hasExistingMedicalData()` first; if true, route to `/health-replace-prompt` instead. If false, fall through to the existing sync (current onboarding-style first-time flow).

- [ ] **Step 1: Import the helpers**

In `apps/mobile/app/health-connect.tsx`, find:

```ts
import { requestHealthKitPermissions, markHealthKitConnected } from '../src/services/healthkit'
```

Replace with:

```ts
import {
  requestHealthKitPermissions,
  markHealthKitConnected,
  syncHealthKitData,
  hasExistingMedicalData,
} from '../src/services/healthkit'
import { useProfile } from '../src/context/ProfileContext'
```

- [ ] **Step 2: Pull profile out of context**

Find the line that sets up `router` (likely near the top of the component body):

```ts
  const router = useRouter()
```

Add immediately after:

```ts
  const { profile } = useProfile()
```

- [ ] **Step 3: Branch in handleConnect**

Find the existing `handleConnect` block (lines ~261-280):

```ts
  async function handleConnect() {
    setRequesting(true)
    try {
      const granted = await requestHealthKitPermissions()
      if (granted) {
        await markHealthKitConnected()
        setPermissionGranted(true)
        successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
        // Navigate back after success animation
        setTimeout(() => {
          router.back()
        }, 2000)
      } else {
        // Permission denied — still let them go back
        setRequesting(false)
      }
    } catch {
      setRequesting(false)
    }
  }
```

Replace with:

```ts
  async function handleConnect() {
    setRequesting(true)
    try {
      const granted = await requestHealthKitPermissions()
      if (!granted) {
        setRequesting(false)
        return
      }
      await markHealthKitConnected()

      // Decide path: existing data → prompt; first-time → straight sync
      const hasData = profile?.careProfileId
        ? await hasExistingMedicalData(profile.careProfileId)
        : false

      if (hasData) {
        setRequesting(false)
        router.replace('/health-replace-prompt' as any)
        return
      }

      // First-time flow: existing success animation + back-nav, with sync
      syncHealthKitData().catch((err) => console.warn('[HealthKit] first-time sync failed:', err))
      setPermissionGranted(true)
      successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
      setTimeout(() => { router.back() }, 2000)
    } catch {
      setRequesting(false)
    }
  }
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/health-connect.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): branch to /health-replace-prompt when user has existing data

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Smoke test on simulator

**Files:**
- (none — testing only)

**Context:** Verify the three flow paths on the booted iPhone 17 simulator.

- [ ] **Step 1: Rebuild + reinstall**

```bash
xcodebuild \
  -workspace /Users/shreyashsomani/CareCompanion/apps/mobile/ios/CareCompanion.xcworkspace \
  -scheme CareCompanion \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=1FFCE7EF-0029-4C05-90D6-471807C0A89E" \
  -derivedDataPath /Users/shreyashsomani/CareCompanion/apps/mobile/ios/build \
  -quiet build && \
xcrun simctl install 1FFCE7EF-0029-4C05-90D6-471807C0A89E \
  /Users/shreyashsomani/CareCompanion/apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/CareCompanion.app && \
xcrun simctl launch 1FFCE7EF-0029-4C05-90D6-471807C0A89E com.aryanmotgi.carecompanion
```

Expected: app launches without crash.

- [ ] **Step 2: First-time path (no existing data)**

In the simulator, log into a brand new account (or use a seeded test account that has no medications/labs/appointments). Tap **Settings → Connect Health Records → Connect Health**. Grant iOS permission.

Expected: success animation shows, app routes back to Settings. **`/health-replace-prompt` is NOT shown** because there's no existing data.

- [ ] **Step 3: Existing-data merge path**

On an account that already has data (e.g. the demo seed), tap **Settings → Connect Health Records → Connect Health**. Grant iOS permission.

Expected: navigates to `/health-replace-prompt`. Tap **Merge**. Confirm app routes back to Settings without altering your existing records (verify on Care tab).

- [ ] **Step 4: Existing-data replace path**

On the same existing-data account, tap **Settings → Connect Health Records → Connect Health → Replace All → Replace** in the confirmation alert.

Expected: 
- Backend wipes data
- App routes to `/setup` (re-onboarding)
- After completing setup, Care tab shows the (zero in simulator's case) HealthKit records and the previously-existing manual records are gone

- [ ] **Step 5: Health checks before commit-final**

```bash
cd /Users/shreyashsomani/CareCompanion && npm run typecheck && npm run lint && npm run test:run && npm run deadcode
```

Expected: all four pass per CLAUDE.md rule 3.

- [ ] **Step 6: No final commit needed if smoke test passed**

If anything was tweaked during smoke testing (copy fixes, padding, etc.), commit those:

```bash
git add -p
git commit -m "$(cat <<'EOF'
fix(healthkit): post-smoke-test polish

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Success Criteria Checklist

- [ ] `apps/web/src/app/api/healthkit/replace/route.ts` exists, all 4 vitest tests pass
- [ ] `apiClient.healthkit.replace(records)` is callable from mobile, typed correctly
- [ ] `replaceHealthKitData()` and `hasExistingMedicalData()` exported from `healthkit.ts`
- [ ] `/health-replace-prompt` screen renders with two cards + confirmation alert
- [ ] `health-connect.tsx::handleConnect` routes to prompt only when existing data present
- [ ] First-time, merge, and replace paths all verified on simulator
- [ ] `npm run typecheck && npm run lint && npm run test:run && npm run deadcode` all pass
