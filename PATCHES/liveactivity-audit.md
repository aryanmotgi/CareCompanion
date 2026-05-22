# LiveActivity Audit — CareCompanion iOS
**Date:** 2026-05-22  
**Auditor:** Claude Code (aryan/dev)  
**Scope:** `apps/mobile/ios/LiveActivity/` + surrounding Xcode project config  
**Branch:** aryan/dev

---

## TL;DR

The LiveActivity Xcode target was scaffolded but **never populated with Swift source files**. All 9 Swift files, the extension `Info.plist`, `Assets.xcassets`, and `LiveActivity.entitlements` are referenced in `project.pbxproj` but do not exist on disk. The JS service layer (`live-activity.ts`) was deleted in commit `7ef096ce`. The project **will not compile** in its current state. Additionally the main app's `Info.plist` declares `NSSupportsLiveActivities = true` against a deployment target of iOS 15.1 — below the ActivityKit floor of iOS 16.1.

---

## Audit Table

| # | Check | File(s) | Status | Severity | Fix Patch |
|---|-------|---------|--------|----------|-----------|
| a1 | `NSSupportsLiveActivities = YES` in main app Info.plist | `apps/mobile/ios/CareCompanion/Info.plist:76` | ✅ Present (`true`) | — | No action needed |
| a2 | `NSSupportsLiveActivitiesFrequentUpdates` set appropriately | `apps/mobile/ios/CareCompanion/Info.plist:78` | ⚠️ Present but `false` | Medium | If push-based frequent updates are required, set to `true`. Otherwise acceptable to leave `false` for local-update-only activities |
| a3 | Main app deployment target ≥ iOS 16.1 (ActivityKit minimum) | `project.pbxproj:532,562` (`IPHONEOS_DEPLOYMENT_TARGET = 15.1`) | ❌ Main target targets 15.1; ActivityKit requires 16.1+ | High | Either bump `IPHONEOS_DEPLOYMENT_TARGET` to `16.1` in the CareCompanion target build configs, **or** wrap all `ActivityKit` call sites with `if #available(iOS 16.1, *) {}` guards. Extension itself correctly targets 16.2. |
| b1 | `aps-environment` entitlement present for push (required for ActivityKit push updates) | `apps/mobile/ios/CareCompanion/CareCompanion.entitlements:15` | ✅ `production` set | — | No action needed |
| b2 | `com.apple.security.application-groups` for host↔extension shared data | `apps/mobile/ios/CareCompanion/CareCompanion.entitlements:17` | ✅ `group.com.carecompanion.shared` present | — | Extension entitlements file must mirror this same group once created (see b3) |
| b3 | LiveActivity extension entitlements file exists on disk | `apps/mobile/ios/LiveActivity/LiveActivity.entitlements` (referenced at `project.pbxproj:75, 706, 730`) | ❌ **File missing — does not exist on disk** | Critical | Create `apps/mobile/ios/LiveActivity/LiveActivity.entitlements` with `aps-environment = production` and the same `com.apple.security.application-groups` value. See patch below. |
| b4 | `com.apple.developer.usernotifications.communication` entitlement | Not present anywhere | ℹ️ N/A for LiveActivities | — | This entitlement is for CallKit-style communication notifications, **not** required for ActivityKit. Omit. |
| c1 | `ActivityAttributes` struct defined | Would be in `LiveActivityWidget.swift` or `LiveActivityWidgetBundle.swift` | ❌ **All 9 Swift source files missing from disk** | Critical | Implement `ActivityAttributes` conformance in `LiveActivityWidget.swift`. Struct must define `ContentState` for dynamic island updates and static attributes for the activity. See scaffold below. |
| c2 | `ActivityAttributes.ContentState` matches push payload shape | Would be in `LiveActivityWidget.swift` | ❌ **Not implemented** | Critical | The push payload `content-state` dictionary must exactly match the `ContentState` Codable struct field names and types. Define struct first, then align APNs payload. |
| d1 | LiveActivity target defined in `project.pbxproj` | `project.pbxproj:264–280` (target `6BF762471CF14B4F800DA1C0`) | ✅ Target exists, `productType = app-extension`, `APPLICATION_EXTENSION_API_ONLY = YES` | — | Target structure is correct |
| d2 | Main app embeds the extension (`Embed Foundation Extensions` build phase) | `project.pbxproj:49–59` | ✅ `LiveActivity.appex` in Embed Foundation Extensions phase | — | No action needed |
| d3 | Main app has `PBXTargetDependency` on extension | `project.pbxproj:510–514` | ✅ Dependency wired | — | No action needed |
| d4 | `GENERATE_INFOPLIST_FILE = YES` conflicts with explicit `INFOPLIST_FILE` path | `project.pbxproj:708,709,732,733` | ⚠️ Both `GENERATE_INFOPLIST_FILE = YES` and `INFOPLIST_FILE = LiveActivity/Info.plist` set simultaneously | Medium | Remove `GENERATE_INFOPLIST_FILE` from the LiveActivity target's Debug and Release build configs, since an explicit `INFOPLIST_FILE` path is set. Or create the file at the explicit path (which must also happen for missing-file fix). |
| d5 | Extension source files exist on disk | `apps/mobile/ios/LiveActivity/*.swift` (9 files referenced in pbxproj) | ❌ **All 9 Swift files absent — build will fail with "No such file or directory"** | Critical | Create all missing source files. Minimum viable set: `LiveActivityWidget.swift`, `LiveActivityWidgetBundle.swift`, `LiveActivityView.swift`. Helper files (`Color+hex.swift`, `Date+toTimerInterval.swift`, `Image+dynamic.swift`, `View+applyIfPresent.swift`, `View+applyWidgetURL.swift`, `ViewHelpers.swift`) can be stubs. |
| e1 | `Activity.request()` call site (start activity) | AppDelegate / RN native module | ❌ **No call site exists anywhere in the project** | Critical | Add a React Native native module (Swift + Obj-C bridge) that exposes `startLiveActivity(payload:)` calling `Activity<CareActivityAttributes>.request(...)`. Alternatively expose via Expo module. |
| e2 | `Activity.update()` call site | AppDelegate / native module | ❌ **Not implemented** | Critical | Add `updateLiveActivity(activityId:payload:)` using `await activity.update(...)` or push updates via APNs |
| e3 | `Activity.end()` call site | AppDelegate / native module | ❌ **Not implemented** | Critical | Add `endLiveActivity(activityId:dismissalPolicy:)` calling `await activity.end(...)` with appropriate `ActivityUIDismissalPolicy` |
| e4 | Active activity store / handle management | Native module or UserDefaults via app group | ❌ **Not implemented** | High | Store `activity.id` in `UserDefaults(suiteName: "group.com.carecompanion.shared")` so updates/ends can target the correct handle after app restarts |
| f1 | Dynamic Island `.compactLeading` view | `LiveActivityView.swift` | ❌ **File missing** | Critical | Implement `widgetURL`-wrapped `compactLeading` view in `DynamicIsland` builder (e.g. medication icon or treatment step indicator) |
| f2 | Dynamic Island `.compactTrailing` view | `LiveActivityView.swift` | ❌ **File missing** | Critical | Implement compact trailing (e.g. countdown timer or vital value) |
| f3 | Dynamic Island `.minimal` view | `LiveActivityView.swift` | ❌ **File missing** | Critical | Implement minimal view (single icon + value for stacked island) |
| f4 | Dynamic Island `.expanded` view | `LiveActivityView.swift` | ❌ **File missing** | Critical | Implement expanded view with leading/trailing/center/bottom regions |
| f5 | Lock Screen / Banner view | `LiveActivityWidget.swift` body | ❌ **File missing** | Critical | Implement `body` property returning the lock-screen presentation |
| g1 | Push-to-start token registration (`Activity.pushToStartToken`) | AppDelegate.mm | ❌ **Not implemented** | Medium (if remote start intended) | If remote LiveActivity start is required: call `Activity.authorizationInfo.pushToStartTokenUpdates` in an async task on app launch; forward token to server. Requires iOS 17.2+. Given `NSSupportsLiveActivitiesFrequentUpdates = false`, remote start may not be the current intent — confirm with Shreyash. |
| g2 | Push update token registration (`activity.pushTokenUpdates`) | Native lifecycle module | ❌ **Not implemented** | Medium (if remote updates intended) | After `Activity.request`, iterate `activity.pushTokenUpdates` async stream to get and forward the per-activity push token to backend |
| g3 | APNs `apns-push-type: liveactivity` payload format | Backend / push service | ℹ️ Not auditable from client code alone | Low | Ensure backend sends `apns-push-type: liveactivity`, `apns-topic: com.aryanmotgi.carecompanion.push-type.liveactivity`, and `content-state` matching `ContentState` Codable shape |

---

## Missing Files Summary

All paths below are referenced in `project.pbxproj` and must be created before the project will compile:

| File | Path | Minimum Content |
|------|------|-----------------|
| `LiveActivityWidget.swift` | `apps/mobile/ios/LiveActivity/LiveActivityWidget.swift` | `ActivityAttributes` struct + `Widget` conformance |
| `LiveActivityWidgetBundle.swift` | `apps/mobile/ios/LiveActivity/LiveActivityWidgetBundle.swift` | `@main WidgetBundle` |
| `LiveActivityView.swift` | `apps/mobile/ios/LiveActivity/LiveActivityView.swift` | `DynamicIsland` + lock screen body |
| `Color+hex.swift` | `apps/mobile/ios/LiveActivity/Color+hex.swift` | `Color(hex:)` extension |
| `Date+toTimerInterval.swift` | `apps/mobile/ios/LiveActivity/Date+toTimerInterval.swift` | `Date → ClosedRange<Date>` helper |
| `Image+dynamic.swift` | `apps/mobile/ios/LiveActivity/Image+dynamic.swift` | Dynamic image helper |
| `View+applyIfPresent.swift` | `apps/mobile/ios/LiveActivity/View+applyIfPresent.swift` | Conditional modifier |
| `View+applyWidgetURL.swift` | `apps/mobile/ios/LiveActivity/View+applyWidgetURL.swift` | `widgetURL` conditional wrapper |
| `ViewHelpers.swift` | `apps/mobile/ios/LiveActivity/ViewHelpers.swift` | Shared layout helpers |
| `Info.plist` | `apps/mobile/ios/LiveActivity/Info.plist` | Standard extension plist |
| `Assets.xcassets` | `apps/mobile/ios/LiveActivity/Assets.xcassets` | Empty asset catalog |
| `LiveActivity.entitlements` | `apps/mobile/ios/LiveActivity/LiveActivity.entitlements` | aps-environment + app group |

---

## Fix Patches

### Patch B3 — Create `LiveActivity.entitlements`

```xml
<!-- apps/mobile/ios/LiveActivity/LiveActivity.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.carecompanion.shared</string>
    </array>
</dict>
</plist>
```

### Patch C1 — Minimum viable `ActivityAttributes` scaffold

```swift
// apps/mobile/ios/LiveActivity/LiveActivityWidget.swift
import ActivityKit
import WidgetKit
import SwiftUI

struct CareActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic island state — update these fields to match APNs payload
        var stepLabel: String      // e.g. "Chemo Day 3"
        var progressPercent: Int   // 0–100
        var nextEventTime: Date?
    }
    // Static attributes set at Activity.request time
    var patientName: String
    var treatmentPlan: String
}

struct CareActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CareActivityAttributes.self) { context in
            // Lock screen / banner presentation
            CareActivityLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.stepLabel).font(.caption2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.progressPercent)%").font(.caption2)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let t = context.state.nextEventTime {
                        Text(t, style: .timer).font(.caption)
                    }
                }
            } compactLeading: {
                Image(systemName: "cross.case.fill").foregroundColor(.green)
            } compactTrailing: {
                Text("\(context.state.progressPercent)%").font(.caption2)
            } minimal: {
                Image(systemName: "cross.case.fill")
            }
        }
    }
}

private struct CareActivityLockScreenView: View {
    let context: ActivityViewContext<CareActivityAttributes>
    var body: some View {
        HStack {
            Image(systemName: "cross.case.fill").foregroundColor(.green)
            VStack(alignment: .leading) {
                Text(context.attributes.treatmentPlan).font(.headline)
                Text(context.state.stepLabel).font(.subheadline)
            }
            Spacer()
            if let t = context.state.nextEventTime {
                Text(t, style: .timer)
            }
        }
        .padding()
    }
}
```

### Patch D4 — Remove conflicting `GENERATE_INFOPLIST_FILE`

In `apps/mobile/ios/CareCompanion.xcodeproj/project.pbxproj`, remove `GENERATE_INFOPLIST_FILE = YES;` from both the Debug (`C8D60E0C04FD4D35B64A2255`) and Release (`EBD6F864A3BA4141BD35E28D`) build configurations of the LiveActivity target, since `INFOPLIST_FILE = LiveActivity/Info.plist` is already set explicitly.

### Patch A3 — Deployment target guard (if main app stays at iOS 15.1)

In any native module calling `ActivityKit`:

```swift
if #available(iOS 16.1, *) {
    let activity = try Activity<CareActivityAttributes>.request(
        attributes: attrs,
        contentState: state
    )
}
```

---

## Priority Order

1. **Blocker (build fails):** Create all 12 missing files (patches D5, B3, C1) — without these, no one can build the app at all.
2. **Critical (feature broken):** Implement lifecycle native module (patches E1–E4) — no way to start/stop activities from JS.
3. **Critical (feature broken):** Implement all 4 Dynamic Island view contexts (patches F1–F5).
4. **High (runtime crash risk):** Add `#available(iOS 16.1, *)` guards throughout (patch A3).
5. **Medium:** Set `NSSupportsLiveActivitiesFrequentUpdates = true` if push-based updates are planned (patch A2).
6. **Medium:** Remove `GENERATE_INFOPLIST_FILE` conflict (patch D4).
7. **Low:** Push-to-start token registration (patch G1–G3) — only needed for remote-start use case.

---

## Ownership Note

`apps/mobile/` is **Shreyash's** domain per team rules. This audit is written as a patch document; do not merge LiveActivity Swift files without Shreyash's sign-off. The `project.pbxproj` structural changes (entitlements path, deployment target, GENERATE_INFOPLIST_FILE) should be coordinated between Aryan (infra owner) and Shreyash (mobile owner).
