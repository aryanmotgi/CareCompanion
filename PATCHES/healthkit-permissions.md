# HealthKit Permissions Audit — CareCompanion iOS

**Date:** 2026-05-22  
**Auditor:** Aryan (aryan/dev)  
**Scope:** `apps/mobile/ios/`, `apps/mobile/src/services/`, `apps/mobile/app/`  
**Owner of patched files:** Shreyash (mobile) — apply via PR with Aryan as reviewer

---

## 1. Permission Matrix

| Data Type | Info.plist key present | String specific? | Entitlement | `requestAuthorization` called | Background delivery |
|-----------|----------------------|-----------------|-------------|-------------------------------|---------------------|
| Clinical records (7 types: meds, labs, conditions, procedures, allergies, vitals, immunizations) | ✅ `NSHealthClinicalHealthRecordsShareUsageDescription` | ✅ lists cancer/treatment context | ✅ `com.apple.developer.healthkit.access = ["health-records"]` | ✅ `health-connect.tsx:459` → `requestHealthKitPermissions()` | ❌ disabled (correct — no `HKObserverQuery`) |
| Date of birth + sex at birth | ✅ `NSHealthShareUsageDescription` | ✅ "personalize lab reference ranges" | n/a (characteristics don't need separate entitlement) | ✅ `setup.tsx:361` → `fetchHealthKitBaseline()` → `requestBaselineAuthorization()` | n/a |
| Steps, heart rate, sleep (wellness vitals) | ✅ `NSHealthShareUsageDescription` | ✅ "caregivers can see how you are doing" | n/a (quantity/category types don't need special entitlement) | ❌ **NEVER CALLED** — `WellnessVitals.requestAuthorization` exists but has no TypeScript caller | ❌ disabled (correct) |
| Write access (any type) | ❌ no `NSHealthUpdateUsageDescription` | n/a | n/a | n/a — `toShare: []` everywhere | n/a |
| Background delivery | n/a | n/a | ❌ `com.apple.developer.healthkit.background-delivery` absent | n/a | ❌ correct — `HKObserverQuery` is not used anywhere |

---

## 2. Checklist Results

### ✅ 2.1 Info.plist usage strings are specific

**File:** `apps/mobile/ios/CareCompanion/Info.plist:68-69`

```
NSHealthShareUsageDescription:
  "CareCompanion reads your Apple Health data to support your cancer care:
   date of birth and sex at birth (to personalize lab reference ranges),
   and — when you opt in — daily steps, heart rate, and sleep so caregivers
   can see how you are doing."

NSHealthClinicalHealthRecordsShareUsageDescription:
  "CareCompanion reads clinical records from your care team — medications,
   lab results, conditions, procedures, allergies, vital signs, and
   immunizations — so it can help you understand and manage your cancer
   treatment in one place."
```

Both strings mention cancer/treatment context. **No generic placeholder strings.**  
`NSHealthUpdateUsageDescription` is **absent** — correct since `toShare: []` in every `requestAuthorization` call.

---

### ✅ 2.2 Permission priming screen exists BEFORE OS prompt

**Two-stage flow:**

1. **`apps/mobile/app/health-consent.tsx`** — custom HIPAA consent screen shown before any native dialog:
   - "What we read" / "What we do" / "What we don't do" sections
   - Explicit checkbox requiring user agreement (line 227-238)
   - Consent timestamp stored in SecureStore (line 99)

2. **`apps/mobile/app/health-connect.tsx`** — 6-step interactive tutorial (lines 61-92) shows exactly which iOS dialogs the user will see, with phone mockups, before `requestHealthKitPermissions()` is awaited at line 459.

Priming is present and thorough for clinical records and characteristics. **See Issue #1 — priming for wellness vitals (steps/HR/sleep) is described but never triggered.**

---

### ✅ 2.3 Graceful degradation on denial

Swift layer returns safe empty values rather than throwing:

| Function | Denial response | File |
|----------|----------------|------|
| `HealthKitBridge.getBaselineCharacteristics` | `{ dateOfBirth: null, sexAtBirth: null }` | `HealthKitBridge.swift:51` |
| `HealthKitBridge.fetchClinicalRecords` | `[]` | `HealthKitBridge.swift:100` |
| `WellnessVitals.fetchDailyVitals` | `{ steps: 0, heartRate: null, sleepHours: null }` | `WellnessVitals.swift:41-43` |

TypeScript layer wraps every bridge call in try/catch with null/empty fallbacks:
- `fetchHealthKitBaseline()` → returns `{ dateOfBirth: null, sexAtBirth: null }` on any error (`healthkit.ts:204-217`)
- `requestHealthKitPermissions()` → returns `false` on any error (`healthkit.ts:385-393`)
- `syncHealthKitData()` → enqueues retry on 5xx, emits user-actionable error on 401/403, drops silently on 400 (`healthkit.ts:483-496`)
- `readWellnessToday()` → returns `null` on any error (`wellnessVitals.ts:169-176`)

No white screens or crashes observed in the denial path. `syncWellness()` correctly short-circuits at line 195-197 when all vitals are zero/null.

---

### ✅ 2.4 Read-only scopes — minimal

All three `requestAuthorization` calls pass `toShare: []`:

- `HealthKitBridge.swift:37` — baseline characteristics
- `HealthKitBridge.swift:87` — clinical records
- `WellnessVitals.swift:22` — wellness vitals (see Issue #1: this call is never reached from JS)

No write scopes requested anywhere. Minimal read scope confirmed for the types that ARE authorized.

---

### ✅ 2.5 Background delivery entitlement only if HKObserverQuery used

`HKObserverQuery` does **not** appear anywhere in the codebase. Background sync is handled by `expo-background-fetch` + `expo-task-manager` at a 6-hour minimum interval (`wellnessVitals.ts:301-305`), which does not require the HealthKit background-delivery entitlement.

Entitlements file (`CareCompanion.entitlements`) correctly has:
- `com.apple.developer.healthkit = true`
- `com.apple.developer.healthkit.access = ["health-records"]`
- `com.apple.developer.healthkit.background-delivery` — **absent** ✅

---

## 3. Issues Found

### 🔴 Issue #1 — `WellnessVitals.requestAuthorization` never called from TypeScript (MEDIUM-HIGH)

**Impact:** Steps, heart rate, and sleep data are silently unauthorized. `fetchDailyVitals` returns `{ steps: 0, heartRate: null, sleepHours: null }` always. `syncWellness()` short-circuits at line 195-197 with `'no-data'`. Wellness vitals feature is effectively dead. The NSHealthShareUsageDescription promises "daily steps, heart rate, and sleep" but the permission is never actually requested.

**Root cause:** `Bridge.requestAuthorization()` is exposed in `NativeWellnessVitals` interface (`wellnessVitals.ts:161`) but has no TypeScript caller. The `health-connect.tsx` connect flow only calls `requestHealthKitPermissions()` (clinical records + characteristics), never wellness auth.

**Files to change:** `apps/mobile/src/services/wellnessVitals.ts`, `apps/mobile/app/health-connect.tsx`

---

### 🟡 Issue #2 — Hard timeout forces "success" state regardless of authorization (LOW in prod, MEDIUM in dev)

**Impact:** `health-connect.tsx:436-448` — a 6-second `setTimeout` calls `setPermissionGranted(true)` and navigates to `/(tabs)` if the native bridge hangs. In production this is safe because the inner 4-second timeout on `requestHealthKitPermissions()` exits the handler first (lines 463-466). In dev/simulator, both timeouts can race, and the 6s path can force the "connected" success overlay even when the OS dialog is still showing or the user denied.

**File to change:** `apps/mobile/app/health-connect.tsx`

---

### 🟡 Issue #3 — Sleep query completion handler discards error parameter (LOW)

**Impact:** `WellnessVitals.swift:99` — the `HKSampleQuery` completion closure uses `{ _, samples, _ in`, silently discarding any `Error` object. Silent failures won't appear in logs.

**File to change:** `apps/mobile/ios/WellnessVitals.swift`

---

## 4. Diff Patches

> **Ownership note:** All three patched files are in `apps/mobile/` — Shreyash's domain. Apply these patches, open a PR, and request Aryan as reviewer.

---

### Patch A — Add `requestWellnessPermissions` export and wire it into the connect flow

#### `apps/mobile/src/services/wellnessVitals.ts`

Add after line 177 (after `readWellnessToday`):

```diff
+/**
+ * Request HealthKit authorization for wellness types (steps, heart rate,
+ * sleep). Must be called before fetchDailyVitals will return real data.
+ * Apple does not expose denial status for quantity types, so any non-throw
+ * is treated as "user went through the dialog".
+ */
+export async function requestWellnessPermissions(): Promise<boolean> {
+  if (!Bridge) return false
+  try {
+    return await Bridge.requestAuthorization()
+  } catch {
+    return false
+  }
+}
```

#### `apps/mobile/app/health-connect.tsx`

In the import block at the top of the file, add `requestWellnessPermissions` to the wellnessVitals import:

```diff
-import { ... } from '../src/services/healthkit'
+import { ... } from '../src/services/healthkit'
+import { requestWellnessPermissions } from '../src/services/wellnessVitals'
```

Then in `handleConnect()`, after the `requestHealthKitPermissions` try/catch block (after line 468), add a parallel wellness auth call:

```diff
     try {
       await withTimeout(requestHealthKitPermissions(), 4000, 'requestAuthorization')
     } catch (err) {
       console.warn('[HealthKit] permission request timed out / failed:', err)
       if (!__DEV__) {
         clearTimeout(hardTimeout)
         setRequesting(false)
         return
       }
     }
+
+    // Request wellness vitals auth (steps, HR, sleep) — separate from clinical
+    // records. Non-throwing, safe to fire-and-forget if it times out.
+    try {
+      await withTimeout(requestWellnessPermissions(), 4000, 'requestWellnessAuthorization')
+    } catch (err) {
+      console.warn('[HealthKit] wellness permission timed out / failed:', err)
+    }

     await markHealthKitConnected()
```

---

### Patch B — Reduce hard-timeout blast radius in `health-connect.tsx`

The 6-second hard timeout at line 436 should navigate only after clearing the "connecting" UI state, and add a console.error so simulator issues are clearly flagged:

```diff
-    const hardTimeout = setTimeout(() => {
-      console.warn('[HealthKit] connect hard-timeout — forcing success')
-      setPermissionGranted(true)
-      successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
-      setTimeout(() => {
-        if (isReconnect) {
-          router.back()
-        } else {
-          markOnboarded()
-          router.replace('/(tabs)')
-        }
-      }, 2000)
-    }, 6000)
+    // Safety net: if the bridge hangs entirely (stale native build, simulator
+    // crash) still let the user proceed. Only fires if the inner 4s timeout
+    // path fails to exit first (dev/simulator only in practice).
+    const hardTimeout = setTimeout(() => {
+      console.error(
+        '[HealthKit] connect hard-timeout fired — bridge did not resolve or ' +
+        'reject within 6s. Forcing success state. Auth state unknown.',
+      )
+      setRequesting(false)
+      setPermissionGranted(true)
+      successScale.value = withSpring(1, { damping: 10, stiffness: 150 })
+      setTimeout(() => {
+        if (isReconnect) {
+          router.back()
+        } else {
+          markOnboarded()
+          router.replace('/(tabs)')
+        }
+      }, 2000)
+    }, 10000)   // 10s — well beyond the 4s inner timeout in prod
```

---

### Patch C — Log sleep query errors in `WellnessVitals.swift`

**File:** `apps/mobile/ios/WellnessVitals.swift`, around line 97-100

```diff
-      let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
-                                limit: HKObjectQueryNoLimit,
-                                sortDescriptors: nil) { _, samples, _ in
-        defer { group.leave() }
-        guard let samples = samples as? [HKCategorySample] else { return }
+      let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
+                                limit: HKObjectQueryNoLimit,
+                                sortDescriptors: nil) { _, samples, error in
+        defer { group.leave() }
+        if let error = error {
+          NSLog("[WellnessVitals] sleep query error: %@", error.localizedDescription)
+          return
+        }
+        guard let samples = samples as? [HKCategorySample] else { return }
```

---

## 5. No-action items (confirmed correct)

| Item | Why it's fine |
|------|--------------|
| `NSHealthUpdateUsageDescription` absent | `toShare: []` in all three auth calls — app never writes to HealthKit |
| `com.apple.developer.healthkit.background-delivery` absent | `HKObserverQuery` not used; background sync via `expo-background-fetch` which doesn't need this entitlement |
| `requestHealthKitPermissions()` returns `true` on non-throw | Intentional per Apple's clinical-records privacy model — authorization status is always `.notDetermined` when queried, so tracking the "user went through the flow" flag is the correct pattern |
| Retry queue (5 attempts, exponential backoff) | Correct; `enqueueRetry` drops after 5 attempts (`healthkit.ts:117-133`) |
| `HKHealthStore.isHealthDataAvailable()` guards | Present in every Swift entry point before any HK call |
