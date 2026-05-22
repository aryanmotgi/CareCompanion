# Push Notification End-to-End Audit
**Date:** 2026-05-22  
**Branch:** aryan/dev  
**Scope:** EAS config → mobile setup → token registration → server send path → deep link routing

---

## 1. EAS Config — APNs Credentials

**Files audited:**
- `eas.json` (repo root, web build)
- `apps/mobile/eas.json` (mobile build, EAS CLI ≥ 12.0.0)

**Finding:** No APNs key path or p8/cert embedded in either file. This is **correct**: Expo EAS manages iOS push credentials out-of-band through the EAS credential store tied to project ID `845c42cd-33e6-42d0-8189-59131144999f`. The Apple App Store Connect app ID is `6766130404`.

**Risk: NONE for current builds.** However:
- APNs key (p8) expires never; APNs cert (p12) expires annually.
- Expo EAS does not auto-rotate — if the team switches from p8 to cert-based, a manual re-upload via `eas credentials` is required.
- There is **no `remote-notification` background mode documented in `eas.json`** (it lives in `app.json` `ios.infoPlist.UIBackgroundModes`). That is the correct location; eas.json does not need it.

**Action items:**
- [ ] Confirm EAS credential store has a valid APNs **key** (p8), not cert, for production/testflight profiles.
- [ ] Document renewal schedule in team runbook.

---

## 2. Mobile — expo-notifications Setup

**Files audited:**
- `apps/mobile/app.json`
- `apps/mobile/src/services/notifications.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/notification-settings.tsx`

### 2a. Plugin and Background Mode

`app.json` correctly declares:
```json
"plugins": [
  ["expo-notifications", { "icon": "./assets/icon.png", "color": "#A78BFA" }]
],
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["fetch", "remote-notification"]
  }
}
```
`remote-notification` background mode is present. iOS will wake the app for background push delivery.

### 2b. Permission Request

`apps/mobile/src/services/notifications.ts:249-272` — `requestPermissions()`:
- Checks existing permission first (no redundant prompt).
- Requests `allowAlert`, `allowBadge`, `allowSound`, `allowCriticalAlerts` (iOS).
- `allowCriticalAlerts` gated behind `options?.critical` flag — requires Apple entitlement. The flag is harmless without it.

**Gap:** `requestPermissions()` is called from `notification-settings.tsx` and indirectly via `scheduleDailyCheckin()`, but there is **no permission request in the onboarding flow**. Users who skip Notification Settings will never be prompted. Best practice is to request permission at a contextually relevant moment during onboarding.

### 2c. Android Notification Channel

**MISSING.** `setNotificationChannelAsync` is typed in `NotificationsModule` (line 64) but **never called** anywhere in the codebase. On Android 8+ (API 26+), notifications without an explicit channel fall into the app's default channel with default importance (IMPORTANCE_DEFAULT). This means:
- No custom sound
- No custom vibration pattern
- No "Critical" or heads-up display for urgent alerts (nadir warnings, abnormal labs)

**Fix required** — see PATCHES.

### 2d. getExpoPushTokenAsync — CRITICAL GAP

`getExpoPushTokenAsync` is **never called anywhere in the mobile app**. There is no Expo push token registration flow. This means:

- The mobile app **cannot receive remote push notifications** sent by the backend.
- The `apps/web/src/lib/push.ts` server uses **Web Push (VAPID)** via the `web-push` npm package — this targets web browsers via the Push API, **not** the Expo push delivery network (FCM/APNs).
- The `pushSubscriptions` table stores Web Push endpoints (browser service workers), not Expo push tokens.

**Architecture mismatch:** the server generates notifications and sends them to `pushSubscriptions` (Web Push / VAPID). The mobile app has no subscription of any kind registered with the server. **No backend-generated alert (refill, appointment, lab, nadir warning) ever reaches the mobile app as a remote notification.**

The only notifications the mobile app currently delivers are **locally scheduled** ones:
- Daily 8 PM check-in (`scheduleDailyCheckin`)

**Fix required** — two options:
1. **Expo Push (recommended):** Add `getExpoPushTokenAsync` to the mobile app, register the token with the backend, and use `expo-server-sdk` (or direct Expo Push API) on the server to deliver remote push.
2. **Self-managed APNs/FCM:** Register device tokens directly and send via APNs HTTP/2 or FCM v1. Higher ops burden.

See PATCHES for Option 1 scaffolding.

---

## 3. Token Registration — Backend Route

**Files audited:**
- `apps/web/src/app/api/push/subscribe/route.ts`

### Web Push (VAPID) Route

`POST /api/push/subscribe` and `DELETE /api/push/subscribe` exist and are correctly guarded with CSRF + auth.

```
POST body:  { endpoint, p256dh, auth }   ← Web Push subscription object
DELETE body: { endpoint }
```

**Gap: No Expo push token registration route.** There is no `POST /api/push/register` (or similar) that accepts `{ expoToken }` from the mobile app. Until this exists, the backend cannot send FCM/APNs push to mobile devices.

### Missing GET /api/notifications — HIGH

`apps/mobile/app/notifications.tsx:74` calls:
```
GET /api/notifications
Authorization: Bearer <session-token>
Cookie: <authjs session cookie>
```

The expected shape is `Array<Notification>` or `{ notifications: Array<Notification> }`.

**No route handler exists.** The `apps/web/src/app/api/notifications/` directory contains:
- `[id]/route.ts` — single notification fetch
- `preferences/route.ts` — preferences
- `read/route.ts` — mark as read
- `generate/route.ts` — cron

There is **no root `route.ts`** for listing. The mobile inbox screen fails silently (returns `notifications.length === 0`, shows "All caught up!" empty state instead of actual notifications).

**Fix required** — see PATCHES.

---

## 4. Server Send Path

**Files audited:**
- `apps/web/src/lib/push.ts`
- `apps/web/src/lib/notifications.ts`
- `apps/web/src/app/api/notifications/generate/route.ts`
- `apps/web/src/app/api/cron/nadir-summary/route.ts`
- `apps/web/src/app/api/cron/weekly-summary/route.ts`
- `apps/web/src/app/api/cron/nadir-alert/route.ts`
- `apps/web/src/app/api/checkins/route.ts`
- `apps/web/src/app/api/checkins/share/route.ts`

### Web Push Stack (VAPID)

`apps/web/src/lib/push.ts` — uses `web-push` v3.6.7:
```ts
webpush.setVapidDetails(
  'mailto:support@carecompanionai.org',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);
await webpush.sendNotification(
  { endpoint, keys: { p256dh, auth } },
  JSON.stringify(payload),
);
```

VAPID setup is correct. `VAPID_PRIVATE_KEY` is server-only (never `NEXT_PUBLIC_`). Stale subscriptions returning HTTP 410 are cleaned up in `generateNotificationsForUser` (lines ~370-390 of `notifications.ts`).

### Notification Generation Engine

`apps/web/src/lib/notifications.ts` (450 lines):

| Feature | Status |
|---|---|
| Quiet hours enforcement | ✅ Correct (timezone-aware) |
| User pref gating | ✅ Correct (defaults to true) |
| Deduplication (24h window) | ✅ Correct |
| PHI redaction in push payloads | ✅ Correct (HIPAA-compliant) |
| 410 Gone cleanup | ✅ Correct |
| Batch processing (cursor pagination) | ✅ Correct (PAGE_SIZE=100, BATCH_SIZE=10) |
| Cron schedule | ✅ `GET /api/notifications/generate` at 9 AM UTC |

**No expo-server-sdk usage.** Confirmed: the server has no Expo push capability. Remote push to mobile is structurally absent.

### PHI Redaction Audit

Push payloads are correctly sanitized. Example (from `getRedactedPushPayload`):

| DB title (PHI) | Push body (safe) |
|---|---|
| "Lisinopril refill is overdue" | "You have a refill reminder." |
| "Appointment at UCSF Oncology tomorrow" | "You have an appointment reminder." |
| "WBC 1.2 — abnormal (ref: 4.5-11.0)" | "You have a new health update." |
| "Cycle day 8 — nadir fever warning" | "You have a care reminder." |

Push title is always `"CareCompanion"` — no app name + condition leak.

---

## 5. Deep Link Handling

**Files audited:**
- `apps/mobile/app/_layout.tsx` (lines 553-675)
- `apps/mobile/src/services/notifications.ts` (lines 221-231)

### Foreground Tap Routing

`onNotificationResponse()` listener registered on app mount. Routes via `routeForKind(data)`:

| `data.kind` | Target route |
|---|---|
| `dose-reminder` | `/(tabs)/care` |
| `appointment-reminder` | `/appointments` |
| `daily-checkin` | `/(tabs)` |
| `refill_overdue`, `refill_soon`, `low_balance`, `cycle_pre_infusion` | `/(tabs)/care` |
| `appointment_prep`, `appointment_today` | `/appointments` |
| `abnormal_lab` | `/(tabs)/labs` |
| `prior_auth_expiring` | `/insurance` |
| `cycle_nadir_warning`, `cycle_nadir_active`, `cycle_recovery` | `/(tabs)` |
| *(unknown)* | `/notifications` |

All backend notification types in `notifications.ts` map to a route. Coverage is **complete** for current types.

### Cold-Start Handling

`getLastNotificationResponseAsync()` called once on mount (line 656). The response is recovered and routed via `routeForKind` if the action is a body tap or `RESCHEDULE`. Background-only actions (`TAKEN`, `SNOOZE`, `SKIP`, `CONFIRM`, `CHECKIN_*`) are explicitly skipped — correct, they don't require navigation.

**Cold-start works correctly** for body taps. The action listener uses `expo-notifications` internal state persistence across app restarts.

### Inline-Reply Cold-Start Gap (LOW)

If the user responds to a `CHECKIN_*` action and the app is **killed**, `postCheckinFromNotification` never fires (the action is skipped in cold-start recovery at line 662-671). The check-in data is lost silently. This is noted as a known limitation in the code comment ("best-effort").

### Linking.openURL Not Used for Deep Links

The app does **not** use `Linking.openURL` for notification tap routing — it uses `router.push()` directly inside Expo Router context. This is the correct approach. `Linking.openURL` would be needed only for cross-app deep links (e.g., opening a URL from outside the app).

---

## 6. Template / Notification Type Coverage

All server-generated notification types (`notifications.ts`) align with mobile routing (`routeForKind`) and mobile inbox display types. However:

**Mobile inbox type whitelist** (`notifications.tsx:18-24`):
```ts
type: 'refill_overdue' | 'appointment_prep' | 'abnormal_lab' | 'claim_denied' | 'prescription_ready'
```

**Server-generated types** (`notifications.ts`):
- `refill_overdue` ✅
- `refill_soon` ❌ not in mobile type union (renders with fallback accent color, no icon)
- `appointment_prep` ✅
- `appointment_today` ❌ not in mobile type union
- `prior_auth_expiring` ❌ not in mobile type union
- `abnormal_lab` ✅
- `low_balance` ❌ not in mobile type union
- `cycle_nadir_warning` ❌ not in mobile type union
- `cycle_nadir_active` ❌ not in mobile type union
- `cycle_recovery` ❌ not in mobile type union
- `cycle_pre_infusion` ❌ not in mobile type union
- `claim_denied` ✅ (in mobile but not server-generated — dead code)
- `prescription_ready` ✅ (in mobile but not server-generated — dead code)

**Fix required** — see PATCHES.

---

## Summary Table

| # | Finding | Severity | File(s) | Status |
|---|---|---|---|---|
| F-01 | No `getExpoPushTokenAsync` — mobile cannot receive remote push | CRITICAL | `apps/mobile/src/services/notifications.ts` | ❌ Open |
| F-02 | No Expo push token registration route on backend | CRITICAL | `apps/web/src/app/api/push/` | ❌ Open |
| F-03 | Missing `GET /api/notifications` — mobile inbox broken | HIGH | `apps/web/src/app/api/notifications/` | ❌ Open |
| F-04 | Android notification channels never configured | MEDIUM | `apps/mobile/src/services/notifications.ts` | ❌ Open |
| F-05 | Mobile inbox type union missing 7 server-generated types | MEDIUM | `apps/mobile/app/notifications.tsx` | ❌ Open |
| F-06 | No web Service Worker / push subscription UI | MEDIUM | `apps/web/` | ❌ Open (web scope) |
| F-07 | No permission request in onboarding flow | LOW | `apps/mobile/app/` onboarding | ❌ Open |
| F-08 | CHECKIN inline-reply data lost on cold-start | LOW | `apps/mobile/app/_layout.tsx:662` | Accepted (best-effort) |
| F-09 | APNs credentials not in eas.json | N/A | `apps/mobile/eas.json` | ✅ Correct (EAS cloud) |
| F-10 | HIPAA push payload redaction | N/A | `apps/web/src/lib/notifications.ts` | ✅ Correct |
| F-11 | Cold-start body-tap routing | N/A | `apps/mobile/app/_layout.tsx:656` | ✅ Correct |
| F-12 | 410 Gone subscription cleanup | N/A | `apps/web/src/lib/notifications.ts` | ✅ Correct |

---

## Environment Variables Required

| Variable | Location | Required For |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web `.env` | Web Push (browser-side subscription) |
| `VAPID_PRIVATE_KEY` | Web `.env` (server-only) | Web Push sending |
| `EXPO_PUBLIC_API_BASE_URL` | `apps/mobile/eas.json` env per profile | All API calls from mobile |

**Missing (needed once F-01/F-02 are fixed):**
| Variable | Location | Required For |
|---|---|---|
| `EXPO_ACCESS_TOKEN` | Web `.env` (server-only) | Expo Push API authentication |

---

## Patches

Mobile-specific patches (F-01, F-04, F-05, partial F-03 fetch fix) are documented in `PATCHES/push-notif-e2e.md`.

Server patches (F-02, F-03) are in the same patch file under the "Server" section.
