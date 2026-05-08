# HealthKit Integration — Option A (End-to-End Basics)

**Date:** 2026-05-08  
**Scope:** Get the existing HealthKit architecture working end-to-end on a local build. No new data types, no background delivery, no library swaps.

---

## What Already Exists (Do Not Change)

| File | Purpose |
|------|---------|
| `ios/CareCompanion/HealthKitBridge.swift` | Native module — reads FHIR clinical records (meds, labs, conditions, procedures, allergies, vitals, immunizations) |
| `ios/CareCompanion/HealthKitBridge.m` | ObjC bridge registration for HealthKitBridge |
| `src/services/healthkit.ts` | JS normalisation layer — maps FHIR → typed records, calls `/api/healthkit/sync` |
| `src/services/healthkit-vitals.ts` | JS service — wraps `NativeModules.WellnessVitals`, exports `requestWellnessPermissions` + `fetchWellnessVitals` |
| `src/components/WellnessCard.tsx` | UI — shows steps / heart rate / sleep; renders only when `wellnessAvailable === true` |
| `app/health-consent.tsx` | Consent screen — saves acceptance to SecureStore, navigates to `health-connect` |
| `app/health-connect.tsx` | Tutorial + connect screen — calls `requestHealthKitPermissions()`, routes back on success |
| `app/health-summary.tsx` | Summary screen for synced clinical data |
| `app/(tabs)/index.tsx` | Home screen — calls `requestWellnessPermissions()` on mount, `syncHealthKitData()` after data loads |
| Backend `/api/healthkit/sync` | Accepts `HealthKitRecord[]`, persists to Aurora |

---

## Problem 1 — Duplicate Bridge Files

**Root cause:** During HealthKit development, bridge files were created at two paths:
- `ios/HealthKitBridge.swift` and `ios/HealthKitBridge.m` (root — wrong location, not in Xcode project)
- `ios/CareCompanion/HealthKitBridge.swift` and `ios/CareCompanion/HealthKitBridge.m` (correct — already in pbxproj)

**Fix:** Delete the root-level duplicates. Git-add the `ios/CareCompanion/` copies so they are tracked.

---

## Problem 2 — Missing WellnessVitals Native Module

**Root cause:** `healthkit-vitals.ts` references `NativeModules.WellnessVitals` but no Swift module with that name exists. `Bridge` is always `null` → `requestWellnessPermissions()` returns `false` → `wellnessAvailable` stays `false` → `WellnessCard` never renders.

### WellnessVitals.swift

Location: `ios/CareCompanion/WellnessVitals.swift`

```
@objc(WellnessVitals)
class WellnessVitals: NSObject

Methods:
  requestAuthorization(resolve, reject)
    - Requests read access for: stepCount, heartRate, sleepAnalysis
    - Resolves true/false; rejects only on unexpected error

  fetchDailyVitals(resolve, reject)
    - steps: HKStatisticsQuery cumulative sum, midnight today → now
    - heartRate: HKSampleQuery most recent sample (limit 1, sorted descending)
    - sleepHours: HKSampleQuery sleepAnalysis, 10pm yesterday → 8am today,
                  sum of samples where value != inBed (0) and value != awake (2)
                  (covers legacy `asleep`=1 and iOS 16+ asleepCore=3/Deep=4/REM=5)
    - Resolves { steps: Int, heartRate: Double?, sleepHours: Double? }
    - All three queries run concurrently via DispatchGroup
    - If HealthKit unavailable, resolves { steps: 0, heartRate: null, sleepHours: null }
```

### WellnessVitals.m

Location: `ios/CareCompanion/WellnessVitals.m`

Standard `RCT_EXTERN_MODULE` registration exporting `requestAuthorization` and `fetchDailyVitals`.

### Xcode project

Both files added to `CareCompanion` target in `project.pbxproj` (PBXBuildFile + PBXFileReference + group membership + Sources build phase).

---

## Problem 3 — Flow Verification

The consent → permissions → sync chain is already correctly wired. No code changes needed:

```
setup.tsx
  → router.push('/health-consent')
      → accepts → SecureStore.set(CONSENT_KEY) → router.replace('/health-connect')
          → handleConnect() → requestHealthKitPermissions() → router.back()

home screen mount
  → requestWellnessPermissions() → setWellnessAvailable(granted)
  → syncHealthKitData() (after API data loads)
```

After the WellnessVitals module exists and the app is rebuilt, the first home screen visit triggers the HealthKit permission dialog for steps/HR/sleep. On grant, `WellnessCard` renders real data.

---

## Rebuild Step

```bash
cd apps/mobile && npx expo run:ios
```

No EAS credits used.

---

## Success Criteria

- [ ] No duplicate HealthKitBridge files; `ios/CareCompanion/` copies are git-tracked
- [ ] `WellnessVitals.swift` + `.m` compile without errors
- [ ] `WellnessCard` shows real steps, heart rate, and sleep (not `--`) after permissions granted
- [ ] Clinical records sync: `syncHealthKitData()` posts to backend without error
- [ ] `npx expo run:ios` builds cleanly (no new warnings from HealthKit files)
