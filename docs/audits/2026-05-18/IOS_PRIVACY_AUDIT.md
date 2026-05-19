# iOS Privacy Manifest & Info.plist Audit

**Date:** 2026-05-19  
**Auditor:** Claude Code (aryan/dev)  
**Files audited:**
- `apps/mobile/ios/CareCompanion/PrivacyInfo.xcprivacy`
- `apps/mobile/ios/CareCompanion/Info.plist`
- `apps/mobile/ios/CareCompanion/CareCompanion.entitlements`
- `apps/mobile/src/**` (cross-reference scan)

---

## Summary

| Area | Status |
|---|---|
| Required Reason APIs (PrivacyInfo.xcprivacy) | ❌ FAIL — 1 missing declaration |
| Usage Descriptions (Info.plist) | ✅ PASS |
| Privacy Nutrition Label (NSPrivacyCollectedDataTypes) | ✅ PASS |
| Entitlements | ❌ FAIL — 2 missing entitlements |
| ITSAppUsesNonExemptEncryption | ✅ PASS |

**Overall: NOT READY for App Store submission.** Three blockers must be resolved before submitting.

---

## Missing Declarations (will reject)

### 1. PrivacyInfo.xcprivacy — NSPrivacyAccessedAPICategoryActiveKeyboards

**Severity:** Rejection  
**Status:** NOT declared

React Native's text input system internally observes `UITextInputCurrentInputModeDidChangeNotification` (the Active Keyboards API) to detect keyboard layout changes. Every RN app that displays a text field — login, chat, search, inline check-in replies — hits this API. Apple's automated manifest scanner catches it; submissions without this declaration are rejected with ITMS-91053 or similar.

**Fix — add to `PrivacyInfo.xcprivacy` inside `NSPrivacyAccessedAPITypes`:**

```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryActiveKeyboards</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>3EC4.1</string>
    </array>
</dict>
```

`3EC4.1` = "Access the active keyboard for the purpose of adjusting user interface layout." This is the correct reason for React Native's internal keyboard-tracking behaviour.

---

### 2. Entitlements — `aps-environment` (Push Notifications)

**Severity:** Push notifications silently broken in production  
**Status:** NOT declared

`notifications.ts` calls `expo-notifications` to request permission, schedule local notifications, and (via `UIBackgroundModes = remote-notification`) handle APNs pushes. App Store builds require the `aps-environment` entitlement to receive a valid APNs device token; without it the token registration call returns an error and the user never receives remote notifications.

**Fix — add to `CareCompanion.entitlements`:**

```xml
<key>aps-environment</key>
<string>production</string>
```

Use `development` only for local Xcode builds; the App Store build must be `production`.

---

### 3. Entitlements — `com.apple.security.application-groups` (Widget + Live Activities)

**Severity:** Emergency Widget and Live Activities non-functional  
**Status:** NOT declared

Two features require App Groups:

- **EmergencyWidget** (`emergencyWidget.ts` line 23): explicitly calls `EmergencyWidgetBridge.updateEmergencyData()` which, per the service's own comment, "Pushes emergency data to the iOS WidgetKit shared UserDefaults." WidgetKit extensions cannot read the main app's `UserDefaults`; they share data via an App Group suite (`UserDefaults(suiteName:)`). Without the entitlement, the widget always shows stale or empty data.
- **Live Activities** (`Info.plist` declares `NSSupportsLiveActivities = true` and `NSSupportsLiveActivitiesFrequentUpdates = true`): ActivityKit uses App Groups to pass state from the app to the Live Activity extension.

**Fix — add to `CareCompanion.entitlements`:**

```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.aryanmotgi.carecompanion</string>
</array>
```

The group identifier must be registered in the Apple Developer portal under Identifiers → App Groups before building. The same string must be used in the Widget and Live Activity extension targets.

---

## Unused Declarations (safe to remove)

### DiskSpace reason E174.1

**File:** `PrivacyInfo.xcprivacy`

The current disk space entry declares two reasons:
- `E174.1` — "Display the amount of available disk space to the user"
- `85F4.1` — "Check if there is sufficient disk space to perform an operation"

No screen in the app surfaces raw disk-space figures to the user. `E174.1` is inaccurate. Having an extra reason does not cause rejection (Apple does not verify declared vs. used reasons), but it inflates the declared surface area unnecessarily. Remove `E174.1`, keep `85F4.1`.

---

## Usage Description Quality

All declared descriptions pass the "would App Review understand this?" bar. Specific notes:

| Key | Verdict | Note |
|---|---|---|
| NSHealthShareUsageDescription | ✅ Good | Names specific data types (DOB, steps, heart rate, sleep) and use case |
| NSHealthClinicalHealthRecordsShareUsageDescription | ✅ Good | Explicitly lists record categories (meds, labs, conditions, procedures, allergies, vitals, immunizations) |
| NSCameraUsageDescription | ✅ Good | States the purpose (scan Rx bottles and documents) and outcome (add to care record) |
| NSPhotoLibraryUsageDescription | ✅ Good | Clear upload purpose |
| NSCalendarsUsageDescription | ✅ Good | Names the category of events being read (medical appointments) |
| NSCalendarsFullAccessUsageDescription | ✅ Good | Matches NSCalendarsUsageDescription in specificity |
| NSMotionUsageDescription | ✅ Good | Explains cosmetic-only use; explicitly states no data is stored or transmitted |

**Correctly omitted** (no code uses these; omitting is correct):
- `NSHealthUpdateUsageDescription` — app reads HealthKit only, never writes back
- `NSMicrophoneUsageDescription` — daily check-in uses inline text reply (keyboard), not voice
- `NSLocationWhenInUseUsageDescription` — calendar events carry a `location` string field, but the app never calls CoreLocation/GPS
- `NSContactsUsageDescription` — no contacts access anywhere in the codebase
- `NSUserTrackingUsageDescription` — `NSPrivacyTracking = false` and no ATT call found

---

## Entitlements Verified

| Entitlement | Status | Source Evidence |
|---|---|---|
| `com.apple.developer.applesignin` | ✅ Declared | `apple-auth.ts` — `expo-apple-authentication` |
| `com.apple.developer.healthkit` | ✅ Declared | `healthkit.ts`, `wellnessVitals.ts` — NativeModules.HealthKitBridge / WellnessVitals |
| `com.apple.developer.healthkit.access = ["health-records"]` | ✅ Declared | `healthkit.ts` — `HKClinicalRecord` queries |
| `aps-environment` | ❌ MISSING | `notifications.ts`, `UIBackgroundModes = remote-notification` |
| `com.apple.security.application-groups` | ❌ MISSING | `emergencyWidget.ts`, `NSSupportsLiveActivities` |

---

## Required Reason APIs — Full Verification

| Category | Declared | Reasons | Assessment |
|---|---|---|---|
| NSPrivacyAccessedAPICategoryFileTimestamp | ✅ | C617.1, 0A2A.1, 3B52.1 | ✅ React Native runtime accesses file timestamps for bundled assets and image cache |
| NSPrivacyAccessedAPICategoryUserDefaults | ✅ | CA92.1 | ✅ AsyncStorage, expo-secure-store, expo-notifications prefs all read the app's own UserDefaults. CA92.1 ("same app that wrote the info") is correct |
| NSPrivacyAccessedAPICategorySystemBootTime | ✅ | 35F9.1 | ✅ React Native's performance / animation timing layer uses `mach_absolute_time` relative to boot. 35F9.1 ("calculate absolute event timestamp") is correct |
| NSPrivacyAccessedAPICategoryDiskSpace | ✅ | E174.1 (remove), 85F4.1 | ✅ 85F4.1 is correct. E174.1 is inaccurate but harmless |
| NSPrivacyAccessedAPICategoryActiveKeyboards | ❌ MISSING | — | ❌ RN text inputs require this |

---

## Privacy Nutrition Label — NSPrivacyCollectedDataTypes

All four declared types are backed by actual data flows:

| Type | Linked | Used For | Source |
|---|---|---|---|
| NSPrivacyCollectedDataTypeHealthAndFitness | ✅ true | Care timeline, caregiver visibility | `healthkit.ts`, `wellnessVitals.ts` |
| NSPrivacyCollectedDataTypeEmailAddress | ✅ true | Account identity | `apple-auth.ts`, `google-auth.ts` |
| NSPrivacyCollectedDataTypeName | ✅ true | Patient profile, Apple Sign-In display name | `apple-auth.ts`, ProfileContext |
| NSPrivacyCollectedDataTypeSensitiveInfo | ✅ true | Diagnoses, medications, lab results (PHI) | `healthkit.ts` FHIR records, profile |

`NSPrivacyTracking = false` is correct; the app performs no cross-app or cross-site tracking.

---

## ITSAppUsesNonExemptEncryption

`ITSAppUsesNonExemptEncryption = false` — **correct.**

The app uses:
- Standard HTTPS/TLS for all API calls (exempt under US EAR 740.17)
- `expo-secure-store` (iOS Keychain — OS-managed, exempt)
- No custom or non-standard cryptographic implementations

No French Regulatory Declaration (ERN) required.

---

## Action Items Before Submission

### Must-fix (blocking)

- [ ] **Add `NSPrivacyAccessedAPICategoryActiveKeyboards` to `PrivacyInfo.xcprivacy`** with reason `3EC4.1`. Without this, Apple's automated scan will reject the binary.

- [ ] **Add `aps-environment = production` to `CareCompanion.entitlements`** and register the Push Notifications capability in the Apple Developer portal for the app's Bundle ID. Without this, APNs device tokens will be invalid in production and all remote notifications will silently fail.

- [ ] **Add `com.apple.security.application-groups` to `CareCompanion.entitlements`** with the group ID `group.com.aryanmotgi.carecompanion` (or equivalent). Register the App Group in the Apple Developer portal. Apply the same group ID in the Emergency Widget extension and Live Activity extension targets. Without this, the widget shows no data and Live Activities cannot receive state updates.

### Recommended (non-blocking)

- [ ] Remove `E174.1` from `NSPrivacyAccessedAPICategoryDiskSpace` reasons in `PrivacyInfo.xcprivacy` — the app does not display disk space to users. Keeping it is harmless but inaccurate.

- [ ] Consider adding `NSPrivacyCollectedDataTypePurposeAnalytics` as a secondary purpose to `NSPrivacyCollectedDataTypeHealthAndFitness` if Sentry (`sentry.ts`) ever receives health-correlated events. Currently Sentry appears to receive only error events, so `AppFunctionality` alone is correct.

- [ ] Verify that the Emergency Widget native extension (`EmergencyWidgetBridge`) target has `com.apple.security.application-groups` in its own entitlements file with the same group identifier. Both sides of the App Group must declare it.
