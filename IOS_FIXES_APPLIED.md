# iOS App Store Blocker Fixes Applied

Branch: `aryan/feature/ios-app-store-blockers`  
Date: 2026-05-19

## Fix 1 — NSPrivacyAccessedAPICategoryActiveKeyboards

**File:** `apps/mobile/ios/CareCompanion/PrivacyInfo.xcprivacy`

Added a new entry to the `NSPrivacyAccessedAPITypes` array:

```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryActiveKeyboards</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>54BD.1</string>
    </array>
</dict>
```

**Reason code `54BD.1`:** Third-party keyboard support — the app reads the list of active keyboards solely to support keyboard extensions the user has enabled.

---

## Fix 2 — aps-environment (Push Notifications)

**File:** `apps/mobile/ios/CareCompanion/CareCompanion.entitlements`

Added push notification environment entitlement required for App Store distribution:

```xml
<key>aps-environment</key>
<string>production</string>
```

---

## Fix 3 — com.apple.security.application-groups

**File:** `apps/mobile/ios/CareCompanion/CareCompanion.entitlements`

Added app group entitlement for shared data access (required for LiveActivities and future widget extensions):

```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.carecompanion.shared</string>
</array>
```

**Note:** No existing `group.com.*` references were found in the iOS codebase. The identifier `group.com.carecompanion.shared` was used as the canonical default. If a WidgetExtension or LiveActivity target is added later, it must declare the same group.

---

## Validation

Both files passed `xmllint --noout` well-formedness check. (`plutil` unavailable in this environment — validate on a macOS build machine before final submission.)
