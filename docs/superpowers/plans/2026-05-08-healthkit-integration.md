# HealthKit Integration (Option A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get HealthKit working end-to-end — clean up duplicate bridge files, build the missing WellnessVitals native module, and verify WellnessCard shows real steps/heart rate/sleep data.

**Architecture:** Two native Swift modules already in the Xcode project (`HealthKitBridge` for clinical FHIR records, `WellnessVitals` to be created for daily metrics). Each has a paired `.m` ObjC registration file. JS services wrap them via `NativeModules`. No new JS files needed — the service layer and UI already exist.

**Tech Stack:** Swift 5, HealthKit framework, React Native ObjC bridge (`RCT_EXTERN_MODULE`), Expo SDK 52

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| git add | `apps/mobile/ios/HealthKitBridge.m` | ObjC bridge for clinical records — untracked, needed by Xcode |
| delete | `apps/mobile/ios/CareCompanion/HealthKitBridge.swift` | Duplicate not in Xcode project |
| delete | `apps/mobile/ios/CareCompanion/HealthKitBridge.m` | Duplicate not in Xcode project |
| create | `apps/mobile/ios/WellnessVitals.swift` | Native module: steps, heart rate, sleep queries |
| create | `apps/mobile/ios/WellnessVitals.m` | ObjC bridge registration for WellnessVitals |
| modify | `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj` | Register WellnessVitals in Xcode build |

---

## Task 1: Fix duplicate HealthKitBridge files

**Files:**
- git add: `apps/mobile/ios/HealthKitBridge.m`
- delete: `apps/mobile/ios/CareCompanion/HealthKitBridge.swift`
- delete: `apps/mobile/ios/CareCompanion/HealthKitBridge.m`

**Context:** The Xcode project (`project.pbxproj`) references `HealthKitBridge.m` and `HealthKitBridge.swift` at the project root (`ios/`). The `ios/CareCompanion/` copies are strays not referenced by Xcode and will cause confusion.

- [ ] **Step 1: Verify which files are in the Xcode project**

```bash
grep "HealthKitBridge" apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj | grep -v Pods
```

Expected output includes `path = HealthKitBridge.m` and `path = HealthKitBridge.swift` (no `CareCompanion/` prefix) — confirming root-level files are the ones registered.

- [ ] **Step 2: Delete the duplicate CareCompanion/ copies**

```bash
rm apps/mobile/ios/CareCompanion/HealthKitBridge.swift
rm apps/mobile/ios/CareCompanion/HealthKitBridge.m
```

- [ ] **Step 3: Stage the root-level .m file (the .swift was already committed)**

```bash
git add apps/mobile/ios/HealthKitBridge.m
git status apps/mobile/ios/
```

Expected: `HealthKitBridge.m` shows as new file, no `CareCompanion/HealthKitBridge*` files.

- [ ] **Step 4: Commit**

The `CareCompanion/` files were untracked so deleting them needs no `git rm`. Just commit the newly staged `.m`:

```bash
git commit -m "$(cat <<'EOF'
chore(healthkit): remove duplicate bridge files, track root-level HealthKitBridge.m

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create WellnessVitals.swift

**Files:**
- Create: `apps/mobile/ios/WellnessVitals.swift`

**Context:** `src/services/healthkit-vitals.ts` expects `NativeModules.WellnessVitals` with two methods: `requestAuthorization()` → `Promise<boolean>` and `fetchDailyVitals()` → `Promise<{ steps: number, heartRate: number | null, sleepHours: number | null }>`. The module name must be exactly `WellnessVitals` (matched by `@objc(WellnessVitals)`).

- [ ] **Step 1: Create the file**

Create `apps/mobile/ios/WellnessVitals.swift` with this exact content:

```swift
import Foundation
import HealthKit

@objc(WellnessVitals)
class WellnessVitals: NSObject {

  private let store = HKHealthStore()

  // MARK: - Authorization

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(false)
      return
    }
    var readTypes = Set<HKObjectType>()
    if let t = HKObjectType.quantityType(forIdentifier: .stepCount)   { readTypes.insert(t) }
    if let t = HKObjectType.quantityType(forIdentifier: .heartRate)   { readTypes.insert(t) }
    if let t = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { readTypes.insert(t) }

    store.requestAuthorization(toShare: [], read: readTypes) { success, error in
      if let error = error {
        reject("WELLNESS_AUTH_ERROR", error.localizedDescription, error)
      } else {
        resolve(success)
      }
    }
  }

  // MARK: - Fetch

  @objc func fetchDailyVitals(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else {
      resolve(["steps": 0, "heartRate": NSNull(), "sleepHours": NSNull()])
      return
    }

    let group    = DispatchGroup()
    let calendar = Calendar.current
    let now      = Date()
    var steps      = 0
    var heartRate: Double? = nil
    var sleepHours: Double? = nil

    // ── Steps: cumulative sum midnight today → now ──────────────────────────
    group.enter()
    if let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
      let start     = calendar.startOfDay(for: now)
      let predicate = HKQuery.predicateForSamples(withStart: start, end: now,
                                                  options: .strictStartDate)
      let query = HKStatisticsQuery(quantityType: stepType,
                                    quantitySamplePredicate: predicate,
                                    options: .cumulativeSum) { _, result, _ in
        defer { group.leave() }
        if let sum = result?.sumQuantity() {
          steps = Int(sum.doubleValue(for: .count()))
        }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Heart rate: most recent sample ──────────────────────────────────────
    group.enter()
    if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) {
      let sort  = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
      let query = HKSampleQuery(sampleType: hrType, predicate: nil, limit: 1,
                                sortDescriptors: [sort]) { _, samples, _ in
        defer { group.leave() }
        if let sample = samples?.first as? HKQuantitySample {
          heartRate = sample.quantity.doubleValue(for: HKUnit(from: "count/min"))
        }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Sleep: 10 pm yesterday → 8 am today ────────────────────────────────
    group.enter()
    if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      var endComps        = calendar.dateComponents([.year, .month, .day], from: now)
      endComps.hour       = 8; endComps.minute = 0; endComps.second = 0
      let sleepEnd        = calendar.date(from: endComps) ?? now
      let yesterday       = calendar.date(byAdding: .day, value: -1, to: now)!
      var startComps      = calendar.dateComponents([.year, .month, .day], from: yesterday)
      startComps.hour     = 22; startComps.minute = 0; startComps.second = 0
      let sleepStart      = calendar.date(from: startComps) ?? sleepEnd.addingTimeInterval(-10 * 3600)

      let predicate = HKQuery.predicateForSamples(withStart: sleepStart, end: sleepEnd,
                                                  options: .strictStartDate)
      let query = HKSampleQuery(sampleType: sleepType, predicate: predicate,
                                limit: HKObjectQueryNoLimit,
                                sortDescriptors: nil) { _, samples, _ in
        defer { group.leave() }
        guard let samples = samples as? [HKCategorySample] else { return }
        // Exclude inBed (0) and, on iOS 16+, awake (2). Count all actual sleep stages.
        let total = samples.filter { sample in
          let v = sample.value
          if #available(iOS 16.0, *) {
            return v != HKCategoryValueSleepAnalysis.inBed.rawValue &&
                   v != HKCategoryValueSleepAnalysis.awake.rawValue
          }
          return v != HKCategoryValueSleepAnalysis.inBed.rawValue
        }.reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
        if total > 0 { sleepHours = total / 3600.0 }
      }
      store.execute(query)
    } else { group.leave() }

    // ── Resolve when all three queries finish ───────────────────────────────
    group.notify(queue: .main) {
      var result: [String: Any] = ["steps": steps]
      result["heartRate"]  = heartRate  != nil ? heartRate!  as Any : NSNull()
      result["sleepHours"] = sleepHours != nil ? sleepHours! as Any : NSNull()
      resolve(result)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la apps/mobile/ios/WellnessVitals.swift
```

Expected: file present, non-zero size.

---

## Task 3: Create WellnessVitals.m

**Files:**
- Create: `apps/mobile/ios/WellnessVitals.m`

**Context:** React Native requires an Objective-C `.m` file to register any Swift class as a native module. The method signatures here must exactly match the `@objc func` signatures in `WellnessVitals.swift`.

- [ ] **Step 1: Create the file**

Create `apps/mobile/ios/WellnessVitals.m` with this exact content:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WellnessVitals, NSObject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchDailyVitals:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la apps/mobile/ios/WellnessVitals.m
```

---

## Task 4: Register WellnessVitals in the Xcode project

**Files:**
- Modify: `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj`

**Context:** Xcode won't compile `WellnessVitals.swift` or `.m` unless they appear in four sections of `project.pbxproj`: `PBXFileReference`, `PBXBuildFile`, `PBXGroup` (root group), and `PBXSourcesBuildPhase`. We add them using the same UUID prefix pattern as the existing HealthKitBridge entries (`AA6390__2FADA91A00DF53CC`).

New UUIDs assigned:
- `AA63906F2FADA91A00DF53CC` — WellnessVitals.m (FileReference)
- `AA6390702FADA91A00DF53CC` — WellnessVitals.swift (FileReference)
- `AA6390712FADA91A00DF53CC` — WellnessVitals.m in Sources (BuildFile)
- `AA6390722FADA91A00DF53CC` — WellnessVitals.swift in Sources (BuildFile)

- [ ] **Step 1: Add PBXBuildFile entries**

In `project.pbxproj`, find the line:
```
		AA63906E2FADA91A00DF53CC /* HealthKitBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA63906C2FADA91A00DF53CC /* HealthKitBridge.swift */; };
```

Insert immediately after it:
```
		AA6390712FADA91A00DF53CC /* WellnessVitals.m in Sources */ = {isa = PBXBuildFile; fileRef = AA63906F2FADA91A00DF53CC /* WellnessVitals.m */; };
		AA6390722FADA91A00DF53CC /* WellnessVitals.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA6390702FADA91A00DF53CC /* WellnessVitals.swift */; };
```

- [ ] **Step 2: Add PBXFileReference entries**

In `project.pbxproj`, find the line:
```
		AA63906C2FADA91A00DF53CC /* HealthKitBridge.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HealthKitBridge.swift; sourceTree = "<group>"; };
```

Insert immediately after it:
```
		AA63906F2FADA91A00DF53CC /* WellnessVitals.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = WellnessVitals.m; sourceTree = "<group>"; };
		AA6390702FADA91A00DF53CC /* WellnessVitals.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WellnessVitals.swift; sourceTree = "<group>"; };
```

- [ ] **Step 3: Add to root PBXGroup**

In `project.pbxproj`, find the lines:
```
			AA63906B2FADA91A00DF53CC /* HealthKitBridge.m */,
			AA63906C2FADA91A00DF53CC /* HealthKitBridge.swift */,
```

Insert immediately after them:
```
			AA63906F2FADA91A00DF53CC /* WellnessVitals.m */,
			AA6390702FADA91A00DF53CC /* WellnessVitals.swift */,
```

- [ ] **Step 4: Add to PBXSourcesBuildPhase**

In `project.pbxproj`, find the lines:
```
				AA63906D2FADA91A00DF53CC /* HealthKitBridge.m in Sources */,
				AA63906E2FADA91A00DF53CC /* HealthKitBridge.swift in Sources */,
```

Insert immediately after them:
```
				AA6390712FADA91A00DF53CC /* WellnessVitals.m in Sources */,
				AA6390722FADA91A00DF53CC /* WellnessVitals.swift in Sources */,
```

- [ ] **Step 5: Verify all four sections were updated**

```bash
grep "WellnessVitals" apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj
```

Expected output: 8 lines (2 BuildFile, 2 FileReference, 2 in Group, 2 in Sources).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ios/WellnessVitals.swift \
        apps/mobile/ios/WellnessVitals.m \
        apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj
git commit -m "$(cat <<'EOF'
feat(healthkit): add WellnessVitals native module (steps, heart rate, sleep)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rebuild and verify

**Context:** Native module changes require a full Xcode rebuild — Metro hot reload is not enough. After rebuilding, the home screen should request HealthKit permission for steps/heart rate/sleep on first load and render the WellnessCard with real values.

- [ ] **Step 1: Build and run on simulator**

```bash
cd apps/mobile && npx expo run:ios
```

Expected: Build succeeds with no errors about WellnessVitals or HealthKitBridge. Simulator opens with the app.

- [ ] **Step 2: Grant HealthKit permissions**

On first home screen load, iOS shows a HealthKit permission sheet asking for steps, heart rate, and sleep access. Tap **Allow All** (or allow individually).

- [ ] **Step 3: Verify WellnessCard shows real data**

The WellnessCard on the home screen should show numeric values (not `--`) for Steps, Heart Rate, and Sleep. Steps will show 0 on a simulator (no motion data) — that is expected. On a physical device all three will populate.

- [ ] **Step 4: Verify clinical records sync (no crash)**

Navigate to **Settings → Connect Health Records** (or trigger via setup flow). The app should call `requestHealthKitPermissions()` and `syncHealthKitData()` without error. Check the Xcode console — no `[HealthKit]` error lines.

- [ ] **Step 5: Commit if any minor fixes were needed during testing**

```bash
git add -p
git commit -m "$(cat <<'EOF'
fix(healthkit): post-build corrections from integration test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Success Criteria Checklist

- [ ] No duplicate HealthKitBridge files — only `ios/HealthKitBridge.swift` and `ios/HealthKitBridge.m` exist (no `ios/CareCompanion/HealthKitBridge*`)
- [ ] `grep WellnessVitals apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj` returns 8 lines
- [ ] `npx expo run:ios` builds cleanly
- [ ] WellnessCard renders (not hidden) after permissions granted
- [ ] No `[HealthKit]` or `[WellnessVitals]` errors in Xcode console
