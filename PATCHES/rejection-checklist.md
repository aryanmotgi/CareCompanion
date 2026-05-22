# App Store Hard-Rejection Checklist
_Audited 2026-05-22 against aryan/dev. Fix patches applied inline._

---

## Blocker Matrix

| # | Guideline | Check | Status | Severity | Patch |
|---|-----------|-------|--------|----------|-------|
| B1 | 5.1.1(v) | Account deletion reachable ≤ 3 taps | **FIXED** | P0 | `settings.tsx` endpoint path corrected |
| B2 | 5.1.1(v) | Delete cascades to all auth identities | **PASS** | — | Aurora FK cascade covers `user_identities`; Cognito no longer active |
| B3 | Privacy Manifest | `NSPrivacyCollectedDataTypes` populated | **FIXED** | P0 | Added 8 data-type entries to `PrivacyInfo.xcprivacy` |
| B4 | 4.8 | Sign in with Apple present alongside Google | **PASS** | — | `expo-apple-authentication` integrated in `login.tsx` |
| B5 | Export Compliance | `ITSAppUsesNonExemptEncryption = false` | **PASS** | — | Already set in `Info.plist` |
| B6 | Privacy Manifest | Required API reasons declared | **PASS** | — | All 4 reasons present |
| B7 | ATT / 14.5 | `NSUserTrackingUsageDescription` | **N/A** | Low | PostHog/Sentry use install-UUID, not IDFA; `NSPrivacyTracking=false` |
| B8 | Rating | 17+ age rating for medical/treatment content | **ACTION** | P0 | Set in App Store Connect — cannot patch from code |

---

## Finding Detail

### B1 — Account Deletion Endpoint Mismatch (FIXED)

**Root cause:** Mobile called `DELETE /api/auth/delete-account` (path intercepted by NextAuth catch-all, guaranteed 404). Web had `POST /api/delete-account` at a different path with CSRF guard mobile cannot satisfy.

**Tap count from home screen:** Home → Settings tab (1) → Delete Account button (2) → Confirm alert (3). Satisfies ≤ 3-tap rule.

**Patch applied:**

`apps/mobile/app/(tabs)/settings.tsx` line 313:
```diff
- const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
+ const res = await fetch(`${baseUrl}/api/account/delete`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
```

`apps/web/src/app/api/account/delete/route.ts` — new file:
- `DELETE` handler with Bearer-token auth (no CSRF — stateless mobile call)
- Rate-limited (5 req / 60 s per IP)
- Audit-logs before delete
- `db.delete(users).where(eq(users.id, user.id))` — Aurora FK cascades to all 29 child tables

**Cognito:** Codebase no longer integrates Cognito (legacy `cognito_sub` column name only; auth migrated to NextAuth + Aurora `user_identities`). `user_identities` is ON DELETE CASCADE — all social providers (Apple, Google, Credentials) purged automatically. No dangling Cognito identity to clean up.

---

### B2 — Sign in with Apple (Guideline 4.8) — PASS

App offers Google (social) on iOS → SIWA is mandatory.

Evidence:
- `apps/mobile/src/services/apple-auth.ts` — full implementation using `expo-apple-authentication`
- `apps/mobile/app/login.tsx` lines 119-135 — `handleAppleSignIn()` wired up
- Button rendered behind `appleAvailable` (`isAvailableAsync()`); with `platform :ios, '15.1'` this is always `true` on device — no production risk
- Server endpoint: `POST /api/auth/social` with `provider: 'apple'`

No action needed.

---

### B3 — PrivacyInfo.xcprivacy `NSPrivacyCollectedDataTypes` (FIXED)

**Root cause:** File existed and API-reason entries were correct, but `NSPrivacyCollectedDataTypes` was an empty `<array/>`. Apple's automated review flags any app that accesses HealthKit, camera, or photo library without declaring corresponding data types. Rejection string: _"Your app's privacy manifest does not describe the data types your app or third-party SDKs collect."_

**Patch applied** to `apps/mobile/ios/CareCompanion/PrivacyInfo.xcprivacy`:

| Data Type | Linked | Tracking | Purpose |
|-----------|--------|----------|---------|
| `NSPrivacyCollectedDataTypeEmailAddress` | true | false | AppFunctionality |
| `NSPrivacyCollectedDataTypeName` | true | false | AppFunctionality |
| `NSPrivacyCollectedDataTypeHealthAndFitness` | true | false | AppFunctionality |
| `NSPrivacyCollectedDataTypeSensitiveInfo` | true | false | AppFunctionality |
| `NSPrivacyCollectedDataTypePhotosAndVideos` | true | false | AppFunctionality |
| `NSPrivacyCollectedDataTypeDeviceID` | false | false | Analytics |
| `NSPrivacyCollectedDataTypeCrashData` | false | false | Analytics |
| `NSPrivacyCollectedDataTypePerformanceData` | false | false | Analytics |

`NSPrivacyTracking = false` confirmed (PostHog/Sentry use install-UUID, not IDFA).  
`NSPrivacyTrackingDomains` added as empty array (explicit declaration, no domains).

**Note on SensitiveInfo:** App stores cancer diagnosis, medications, lab results, and clinical HealthKit records — all qualify as sensitive health information under Apple's taxonomy.

---

### B4 — API Reason Codes — PASS

All four required reasons already declared:

| Category | Reason | Status |
|----------|--------|---------|
| `NSPrivacyAccessedAPICategoryUserDefaults` | CA92.1 | ✓ |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | C617.1 | ✓ |
| `NSPrivacyAccessedAPICategorySystemBootTime` | 35F9.1 | ✓ |
| `NSPrivacyAccessedAPICategoryDiskSpace` | E174.1 | ✓ |

---

### B5 — Export Compliance — PASS

`ITSAppUsesNonExemptEncryption = false` present in `apps/mobile/ios/CareCompanion/Info.plist`.  
App uses standard HTTPS (TLS) only — no custom crypto, no non-exempt encryption.

---

### B6 — ATT / `NSUserTrackingUsageDescription` — Not Required

Analytics SDKs present: Sentry `^6.3.0`, PostHog `^3.3.3`.

- **Sentry** — crash/performance only; no advertising identifier; does not require ATT
- **PostHog** — uses a randomly-generated install UUID stored in `AsyncStorage`; default configuration does NOT request IDFA; does not require ATT

`NSPrivacyTracking` is declared `false` in the privacy manifest, which is consistent.

**If PostHog feature flags or session-replay are enabled with IDFA capture in the future**, add to `Info.plist`:
```xml
<key>NSUserTrackingUsageDescription</key>
<string>CareCompanion uses anonymous analytics to improve app performance and features. No personal health data is shared with third-party advertising networks.</string>
```

---

### B7 — Age Rating 17+ (ACTION REQUIRED — App Store Connect)

App content: cancer treatment management, medications, lab results, clinical records, symptom tracking. This squarely falls under Apple's **Medical/Treatment Information** content descriptor.

**Required action (cannot be done from code):**
1. Open App Store Connect → your app → App Information → Age Rating
2. Set **Medical/Treatment Information** to **Frequent/Intense**
3. This produces a **17+** rating — required to avoid rejection under content rating rules

Failure to set this allows Apple reviewers to force-assign the rating and flag the submission as miscategorized.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/account/delete/route.ts` | **NEW** — `DELETE` handler for mobile account deletion |
| `apps/mobile/app/(tabs)/settings.tsx` | Fixed endpoint path: `/api/auth/delete-account` → `/api/account/delete` |
| `apps/mobile/ios/CareCompanion/PrivacyInfo.xcprivacy` | Added 8 `NSPrivacyCollectedDataTypes` entries + explicit `NSPrivacyTrackingDomains` |
| `PATCHES/rejection-checklist.md` | This file |
