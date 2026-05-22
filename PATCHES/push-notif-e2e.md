# Patches: Push Notification E2E Fixes
**Audit date:** 2026-05-22  
**Branch:** aryan/dev

These are the diffs / implementation notes to resolve the findings in `PUSH_NOTIF_E2E_REPORT.md`.
Apply in order; each patch depends on the previous.

---

## Patch 1 — Android Notification Channels (F-04)
**File:** `apps/mobile/src/services/notifications.ts`  
**Severity:** MEDIUM — Android users on API 26+ get no custom channel; urgent alerts look identical to info alerts.

Add a `setupAndroidChannels()` function and call it from the init path in `_layout.tsx`.

```diff
--- a/apps/mobile/src/services/notifications.ts
+++ b/apps/mobile/src/services/notifications.ts
@@ -79,6 +79,47 @@ export const DAILY_CHECKIN_KIND = 'daily-checkin'
+/**
+ * Android 8+ requires notification channels to control sound/importance
+ * per category. Channels are idempotent — safe to call on every launch.
+ * iOS ignores this call entirely.
+ */
+export async function setupAndroidChannels(): Promise<void> {
+  const Notifications = getModule()
+  if (!Notifications?.setNotificationChannelAsync) return
+  try {
+    // Default channel — informational alerts (refill, appointment, check-in)
+    await Notifications.setNotificationChannelAsync('default', {
+      name: 'CareCompanion Alerts',
+      importance: Notifications.AndroidImportance?.HIGH ?? 4,
+      vibrationPattern: [0, 250, 250, 250],
+      lightColor: '#A78BFA',
+      sound: 'default',
+      enableVibrate: true,
+    })
+    // Urgent channel — nadir warnings, abnormal labs (heads-up display)
+    await Notifications.setNotificationChannelAsync('urgent', {
+      name: 'Urgent Health Alerts',
+      importance: Notifications.AndroidImportance?.MAX ?? 5,
+      vibrationPattern: [0, 500, 200, 500],
+      lightColor: '#DC2626',
+      sound: 'default',
+      enableVibrate: true,
+      bypassDnd: true,
+    })
+    // Medication channel — dose reminders
+    await Notifications.setNotificationChannelAsync('medications', {
+      name: 'Medication Reminders',
+      importance: Notifications.AndroidImportance?.HIGH ?? 4,
+      vibrationPattern: [0, 250, 250, 250],
+      lightColor: '#A78BFA',
+      sound: 'default',
+      enableVibrate: true,
+    })
+  } catch {
+    // best-effort
+  }
+}
```

**In `apps/mobile/app/_layout.tsx`**, add to the notification setup `useEffect` (after `registerNotificationCategories`):

```diff
--- a/apps/mobile/app/_layout.tsx
+++ b/apps/mobile/app/_layout.tsx
@@ -19,6 +19,7 @@ import {
   registerNotificationCategories,
   onNotificationResponse,
   scheduleDailyCheckin,
   getLastNotificationResponse,
+  setupAndroidChannels,
   DOSE_REMINDER_KIND,
   APPOINTMENT_REMINDER_KIND,
   DAILY_CHECKIN_KIND,
} from '../src/services/notifications'

@@ -615,6 +615,7 @@ import {
   useEffect(() => {
     void (async () => {
       try {
         await registerNotificationCategories()
+        await setupAndroidChannels()
         await scheduleDailyCheckin()
       } catch {
         // expo-notifications native module unavailable (simulator) — skip silently
       }
     })()
```

**On the server side**, when generating notifications for Android, include the `channelId` in the push data payload so the Expo push service can route to the right channel when Expo push is implemented (F-01 dependency):

```
// Urgent types: cycle_nadir_warning, cycle_nadir_active, abnormal_lab
channelId: 'urgent'

// Medication types: refill_overdue, refill_soon, dose-reminder
channelId: 'medications'

// Default: everything else
channelId: 'default'
```

---

## Patch 2 — Mobile Inbox Type Union (F-05)
**File:** `apps/mobile/app/notifications.tsx`  
**Severity:** MEDIUM — 7 server-generated notification types render with no icon and wrong color.

```diff
--- a/apps/mobile/app/notifications.tsx
+++ b/apps/mobile/app/notifications.tsx
@@ -17,7 +17,15 @@ interface Notification {
   id: string
-  type: 'refill_overdue' | 'appointment_prep' | 'abnormal_lab' | 'claim_denied' | 'prescription_ready'
+  type:
+    | 'refill_overdue'
+    | 'refill_soon'
+    | 'appointment_prep'
+    | 'appointment_today'
+    | 'prior_auth_expiring'
+    | 'abnormal_lab'
+    | 'low_balance'
+    | 'cycle_nadir_warning'
+    | 'cycle_nadir_active'
+    | 'cycle_recovery'
+    | 'cycle_pre_infusion'
   title: string
   message: string
   createdAt: string
-  read: boolean
+  isRead: boolean
}
```

> Note: the DB column is `isRead` (see `schema.ts:356`); the mobile interface used `read`. Fix the field name to match the API response.

```diff
@@ -26,8 +26,14 @@ const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
   refill_overdue: { light: '#DC2626', dark: '#FCA5A5' },
+  refill_soon: { light: '#D97706', dark: '#FCD34D' },
   appointment_prep: { light: '#2563EB', dark: '#93C5FD' },
+  appointment_today: { light: '#2563EB', dark: '#93C5FD' },
+  prior_auth_expiring: { light: '#7C3AED', dark: '#C4B5FD' },
   abnormal_lab: { light: '#D97706', dark: '#FCD34D' },
-  claim_denied: { light: '#DC2626', dark: '#FCA5A5' },
-  prescription_ready: { light: '#059669', dark: '#6EE7B7' },
+  low_balance: { light: '#D97706', dark: '#FCD34D' },
+  cycle_nadir_warning: { light: '#DC2626', dark: '#FCA5A5' },
+  cycle_nadir_active: { light: '#DC2626', dark: '#FCA5A5' },
+  cycle_recovery: { light: '#059669', dark: '#6EE7B7' },
+  cycle_pre_infusion: { light: '#2563EB', dark: '#93C5FD' },
}
```

```diff
@@ -34,8 +34,14 @@ const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
   refill_overdue: 'medical-outline',
+  refill_soon: 'medical-outline',
   appointment_prep: 'calendar-outline',
+  appointment_today: 'calendar-outline',
+  prior_auth_expiring: 'shield-outline',
   abnormal_lab: 'flask-outline',
-  claim_denied: 'document-text-outline',
-  prescription_ready: 'checkmark-circle-outline',
+  low_balance: 'wallet-outline',
+  cycle_nadir_warning: 'warning-outline',
+  cycle_nadir_active: 'pulse-outline',
+  cycle_recovery: 'heart-circle-outline',
+  cycle_pre_infusion: 'fitness-outline',
}
```

---

## Patch 3 — Missing GET /api/notifications (F-03)
**File (new):** `apps/web/src/app/api/notifications/route.ts`  
**Severity:** HIGH — mobile inbox always shows empty state.

```typescript
// apps/web/src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(_req: NextRequest) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user!.id),
        isNull(notifications.deletedAt),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return apiSuccess(rows);
}
```

**Schema field mapping note:** the DB uses `isRead` but check that `apiSuccess` serializes camelCase correctly. If `drizzle-orm` serializes as-is, the mobile app needs `isRead` (already fixed in Patch 2).

---

## Patch 4 — Expo Push Token Registration (F-01, F-02)
**Severity:** CRITICAL — mobile app cannot receive any server-generated remote push notification.

This is the largest gap. Two files need to be created / modified:

### 4a. Mobile — register Expo push token

**File:** `apps/mobile/src/services/notifications.ts` (add after `requestPermissions`)

```diff
+import * as Device from 'expo-device'
+
+/**
+ * Request notification permission, then register an Expo push token with the
+ * backend. Should be called after the user grants permission (e.g. from
+ * notification-settings.tsx or onboarding). Safe to call multiple times — the
+ * backend upserts on token value.
+ *
+ * Returns the token string on success, null if unavailable or denied.
+ */
+export async function registerExpoPushToken(opts: {
+  apiBase: string
+  sessionToken: string
+  csrfToken: string
+}): Promise<string | null> {
+  const Notifications = getModule()
+  if (!Notifications) return null
+  // Physical device required — simulators/emulators cannot receive push.
+  if (!Device.isDevice) return null
+
+  const perm = await requestPermissions()
+  if (perm !== 'granted') return null
+
+  try {
+    // projectId must match the EAS project — pulled from app config at runtime.
+    const tokenData = await (Notifications as any).getExpoPushTokenAsync({
+      projectId: '845c42cd-33e6-42d0-8189-59131144999f',
+    })
+    const token: string = tokenData.data
+    if (!token) return null
+
+    const isSecure = opts.apiBase.startsWith('https://')
+    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
+    const res = await fetch(`${opts.apiBase}/api/push/register-expo-token`, {
+      method: 'POST',
+      headers: {
+        'Content-Type': 'application/json',
+        'Authorization': `Bearer ${opts.sessionToken}`,
+        'Cookie': `${cookieName}=${opts.sessionToken}`,
+        'x-csrf-token': opts.csrfToken,
+      },
+      body: JSON.stringify({ token }),
+    })
+    if (!res.ok) return null
+    return token
+  } catch {
+    return null
+  }
+}
```

**Call site** — `apps/mobile/app/notification-settings.tsx` after permission is granted:

```diff
+import {
+  requestPermissions,
+  registerExpoPushToken,
+  ...
+} from '../src/services/notifications'
+import * as SecureStore from 'expo-secure-store'

 async function handleEnable() {
   const status = await requestPermissions()
   if (status === 'granted') {
+    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
+    const [sessionToken, csrfToken] = await Promise.all([
+      SecureStore.getItemAsync('cc-session-token'),
+      SecureStore.getItemAsync('cc-csrf-token'),
+    ])
+    if (sessionToken && csrfToken) {
+      await registerExpoPushToken({ apiBase, sessionToken, csrfToken }).catch(() => {})
+    }
     await scheduleDailyCheckin()
   }
 }
```

### 4b. Database migration — expo_push_tokens table

**File (new):** `apps/web/src/lib/db/migrations/021_expo_push_tokens.sql`

```sql
CREATE TABLE expo_push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(token)
);

CREATE INDEX idx_expo_push_tokens_user ON expo_push_tokens(user_id);
```

### 4c. Schema update

**File:** `apps/web/src/lib/db/schema.ts` (add after `pushSubscriptions` table)

```typescript
export const expoPushTokens = pgTable('expo_push_tokens', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text().notNull().unique(),
  createdAt: timestamp().defaultNow(),
});
```

### 4d. Backend registration route

**File (new):** `apps/web/src/app/api/push/register-expo-token/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { expoPushTokens } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { token: string };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid request body', 400);
  }

  const { token } = body;
  if (!token || !token.startsWith('ExponentPushToken[')) {
    return apiError('Invalid Expo push token format', 400);
  }

  await db
    .insert(expoPushTokens)
    .values({ userId: user!.id, token })
    .onConflictDoUpdate({
      target: expoPushTokens.token,
      set: { userId: user!.id },
    });

  return apiSuccess({ registered: true });
}
```

### 4e. Server send — add Expo push delivery

**File:** `apps/web/src/lib/push.ts` — add alongside existing `sendPushNotification`:

```typescript
// Expo Push API — delivers to iOS (APNs) and Android (FCM) via Expo's relay.
// Requires EXPO_ACCESS_TOKEN env var (create at expo.dev/accounts/[account]/settings/access-tokens).
export async function sendExpoPushNotification(
  token: string,
  payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string },
): Promise<void> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      channelId: payload.channelId ?? 'default',
      sound: 'default',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Expo push failed ${res.status}: ${text}`);
  }
}
```

**Integration:** In `generateNotificationsForUser` (after creating the DB notification row), also query `expoPushTokens` for the user and call `sendExpoPushNotification` with the redacted payload + `data.kind` set to the notification type for deep-link routing.

---

## Patch 5 — Onboarding Permission Request (F-07)
**Severity:** LOW — users who skip Notification Settings never see the OS permission dialog.

Find the onboarding completion step (owned by Rahil — confirm with him before modifying) and add:

```typescript
// After user completes onboarding and has a care profile set up:
import { requestPermissions, registerExpoPushToken } from '../src/services/notifications'

const permStatus = await requestPermissions()
if (permStatus === 'granted') {
  const [sessionToken, csrfToken] = await Promise.all([
    SecureStore.getItemAsync('cc-session-token'),
    SecureStore.getItemAsync('cc-csrf-token'),
  ])
  if (sessionToken && csrfToken) {
    await registerExpoPushToken({
      apiBase: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
      sessionToken,
      csrfToken,
    }).catch(() => {})
  }
}
```

---

## Rollout Order

1. **Patch 3** (GET /api/notifications) — unblocks mobile inbox today, zero risk  
2. **Patch 2** (mobile type union) — fixes display, zero risk  
3. **Patch 1** (Android channels) — improves UX on Android, zero risk  
4. **Patch 4** (Expo push E2E) — requires DB migration + new env var; test on physical device before production  
5. **Patch 5** (onboarding) — coordinate with Rahil; lowest priority  

## Verification Checklist

- [ ] `GET /api/notifications` returns 200 with array from authenticated mobile client
- [ ] Mobile inbox shows all 11 notification types with correct colors/icons
- [ ] Android: urgent channel fires heads-up display for `cycle_nadir_warning`
- [ ] Physical iOS device: `getExpoPushTokenAsync` returns `ExponentPushToken[...]`
- [ ] Token registered to backend: `SELECT * FROM expo_push_tokens WHERE user_id = ?`
- [ ] `sendExpoPushNotification` delivers to device within 5 s
- [ ] Tap notification → correct screen (foreground)
- [ ] Kill app, tap notification → correct screen (cold-start)
- [ ] HIPAA: push payload contains no medication names, diagnoses, or PII
- [ ] 410 response from Expo push API triggers token cleanup
