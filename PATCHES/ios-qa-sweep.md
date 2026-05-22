# iOS QA Sweep — Patches for P0 / P1 Bugs

> **Owner rule:** `apps/mobile/*` is owned by Shreyash. These are read-only
> patch suggestions — DO NOT apply them directly. Review with Shreyash before
> merging. Each patch is a minimal, standalone unified diff.

---

## PATCH 1 — P0 · Wrong SecureStore token key in treatment-cycle.tsx

**File:** `apps/mobile/app/treatment-cycle.tsx`  
**Bug:** Line 83 reads `'authToken'` from SecureStore. The app stores all
session tokens under `'cc-session-token'` (see `src/services/auth.ts:33`,
`src/services/api.ts:9`, `src/services/wellnessVitals.ts:106`). Token is
always `null`, causing every medication fetch to send no `Authorization`
header → 401 → "Could not load treatment data" every time.

```diff
--- a/apps/mobile/app/treatment-cycle.tsx
+++ b/apps/mobile/app/treatment-cycle.tsx
@@ -80,7 +80,7 @@
   useEffect(() => {
     async function fetchMeds() {
       try {
-        const token = await SecureStore.getItemAsync('authToken')
+        const token = await SecureStore.getItemAsync('cc-session-token')
         const res = await fetch(`${API_BASE}/api/medications`, {
           headers: token ? { Authorization: `Bearer ${token}` } : {},
         })
```

---

## PATCH 2 — P0 · Notifications screen silent error (no setError on non-OK response)

**File:** `apps/mobile/app/notifications.tsx`  
**Bug:** When `res.ok` is false the function sets `setLoading(false)` and
returns without calling `setError(true)`. User sees a blank screen with no
error message and no retry affordance.

```diff
--- a/apps/mobile/app/notifications.tsx
+++ b/apps/mobile/app/notifications.tsx
@@ -78,7 +78,8 @@
         if (!res.ok) {
+          setError(true)
           setLoading(false)
           return
         }
```

---

## PATCH 3 — P1 · Treatment cycle phase labels are inverted

**File:** `apps/mobile/app/treatment-cycle.tsx`  
**Bug:** `parseCycleInfo` marks days 4–16 (the active side-effects window
after infusion) as **"recovery"** and days 17–21 (the rebound/pre-next-cycle
window) as **"rest"**. The labels and their display colors are swapped.

Correct oncology convention for a 21-day cycle:
- Days 1–3: `infusion`
- Days 4–16: `rest` (worst side-effects; patient at home resting)
- Days 17–21: `recovery` (patient rebounds; physically improving before next cycle)

```diff
--- a/apps/mobile/app/treatment-cycle.tsx
+++ b/apps/mobile/app/treatment-cycle.tsx
@@ -62,5 +62,5 @@
   let phase: CycleInfo['phase'] = 'rest'
   if (dayInCycle <= 3) phase = 'infusion'
-  else if (dayInCycle <= cycleLengthDays - 5) phase = 'recovery'
+  else if (dayInCycle > cycleLengthDays - 5) phase = 'recovery'
```

---

## PATCH 4 — P1 · Emergency screen: unhandled promise on "Call 911" Alert button

**File:** `apps/mobile/app/emergency.tsx`  
**Bug:** `Linking.openURL('tel:911')` inside the Alert `onPress` callback is
not awaited and not caught. On iOS Simulator and any device where telephony is
unavailable the promise rejects silently with no user feedback.

```diff
--- a/apps/mobile/app/emergency.tsx
+++ b/apps/mobile/app/emergency.tsx
@@ -103,7 +103,10 @@
         {
           text: 'Call',
           style: 'destructive',
-          onPress: () => Linking.openURL('tel:911'),
+          onPress: () =>
+            Linking.openURL('tel:911').catch(() =>
+              Alert.alert('Unable to place call', 'Please dial 911 manually.'),
+            ),
         },
```

---

## PATCH 5 — P1 · Emergency screen: unhandled promise on "Call 988" button

**File:** `apps/mobile/app/emergency.tsx`  
**Bug:** `handleCall988` calls `Linking.openURL('tel:988')` without catching
the promise rejection. Same failure mode as #4 above.

```diff
--- a/apps/mobile/app/emergency.tsx
+++ b/apps/mobile/app/emergency.tsx
@@ -113,4 +113,6 @@
   function handleCall988() {
-    Linking.openURL('tel:988')
+    Linking.openURL('tel:988').catch(() =>
+      Alert.alert('Unable to place call', 'Please dial 988 manually.'),
+    )
   }
```

---

## PATCH 6 — P1 · Emergency screen: emergency contact phone not sanitized before dialing

**File:** `apps/mobile/app/emergency.tsx`  
**Bug:** `emergencyContactPhone` from profile is passed raw into `tel:` URI.
Phone numbers stored as `(555) 123-4567` or `555-123-4567` fail on some iOS
versions. The `tel:` scheme only accepts digit strings reliably.

```diff
--- a/apps/mobile/app/emergency.tsx
+++ b/apps/mobile/app/emergency.tsx
@@ -268,5 +268,8 @@
                   {emergencyContactPhone && (
                     <Pressable
-                      onPress={() => Linking.openURL(`tel:${emergencyContactPhone}`)}
+                      onPress={() => {
+                        const digits = emergencyContactPhone.replace(/\D/g, '')
+                        Linking.openURL(`tel:${digits}`).catch(() => Alert.alert('Unable to place call'))
+                      }}
```

---

## PATCH 7 — P1 · health-connect: remove production console.log with PHI (calendar sync result)

**File:** `apps/mobile/app/health-connect.tsx`  
**Bug:** `console.log('[Calendar] sync result:', result)` ships in production
builds. The `result` object from `syncMedicalCalendarEvents` contains matched
calendar event titles (appointment names, doctor names, locations) — PHI.

```diff
--- a/apps/mobile/app/health-connect.tsx
+++ b/apps/mobile/app/health-connect.tsx
@@ -499,8 +499,7 @@
   async function syncCalendar() {
     try {
       const granted = await requestCalendarPermissions()
       if (!granted) return
       const { csrfToken } = await apiClient.csrfToken()
-      const result = await syncMedicalCalendarEvents(csrfToken)
-      console.log('[Calendar] sync result:', result)
+      await syncMedicalCalendarEvents(csrfToken)
     } catch (err) {
       console.warn('[Calendar] sync failed:', err)
     }
```

---

## PATCH 8 — P1 · setup.tsx: remove PHI-leaking console.error (profile patch error)

**File:** `apps/mobile/app/setup.tsx`  
**Bug:** `console.error('[Setup] Error:', e)` at line 441. The `e` argument
may include the profile patch payload (cancer type, medication name, date of
birth) as the serialised error message body. Visible in Sentry and device logs.

```diff
--- a/apps/mobile/app/setup.tsx
+++ b/apps/mobile/app/setup.tsx
@@ -439,3 +439,3 @@
       } catch (e) {
-        console.error('[Setup] Error:', e)
+        console.error('[Setup] patch error')
       } finally {
```

---

## PATCH 9 — P1 · (tabs)/index.tsx: remove PHI-leaking console.error (healthkit sync error)

**File:** `apps/mobile/app/(tabs)/index.tsx`  
**Bug:** `console.error(err)` at line 387 on the home screen HealthKit sync
failure path. The raw `err` object can include API response bodies containing
auth tokens or care-profile data.

```diff
--- a/apps/mobile/app/(tabs)/index.tsx
+++ b/apps/mobile/app/(tabs)/index.tsx
@@ -385,3 +385,3 @@
       } catch (err) {
-        console.error(err)
+        console.error('[Home] healthkit sync failed')
         return
       }
```

---

## PATCH 10 — P1 · health-connect: hard-timeout forces "Connected" even when HealthKit denied

**File:** `apps/mobile/app/health-connect.tsx`  
**Bug:** The hard-timeout handler at line 437 fires after 10 s and transitions
the screen to "Connected" state unconditionally, even when the user explicitly
denied HealthKit permissions. Removes the `console.warn` (production log leak)
and gates force-success on the permission result.

```diff
--- a/apps/mobile/app/health-connect.tsx
+++ b/apps/mobile/app/health-connect.tsx
@@ -430,10 +430,12 @@
     const hardTimeout = setTimeout(() => {
-      console.warn('[HealthKit] connect hard-timeout — forcing success')
-      clearTimeout(hardTimeout)
-      forceSuccess()
+      // Only force-success when we genuinely don't know the outcome (no explicit deny).
+      // If permResult is available and granted===false, respect the user's decision.
+      if (permResult?.granted !== false) {
+        forceSuccess()
+      }
     }, 10_000)
```

> **Note:** `permResult` must be available in the closure at this point; verify
> the variable name matches the actual local variable in the surrounding `try`
> block before applying.

---

## PATCH 11 — P1 · setup.tsx: remove PHI-leaking console.error (onboarding complete error)

**File:** `apps/mobile/app/setup.tsx`  
**Bug:** `console.error('[Setup] onboarding/complete failed:', e)` at line 474
can log the full API error response body, which may contain profile data.

```diff
--- a/apps/mobile/app/setup.tsx
+++ b/apps/mobile/app/setup.tsx
@@ -472,3 +472,3 @@
         } catch (e) {
-          console.error('[Setup] onboarding/complete failed:', e)
+          console.error('[Setup] onboarding/complete failed')
         }
```

---

## P2 Reference Patches (representative samples)

### key={i} → stable keys (applies to 10+ locations)

The pattern below applies to every `.map((item, i) => <View key={i}>` in the
codebase. Replace `i` with a stable, unique identifier. A few representative
examples:

```diff
// apps/mobile/app/caregiver-burnout.tsx:136
- {assessment.factors.map((factor, i) => (
-   <View key={i} style={styles.bulletRow}>
+ {assessment.factors.map((factor) => (
+   <View key={factor} style={styles.bulletRow}>

// apps/mobile/app/(tabs)/chat.tsx:263
- {dots.map((dot, i) => <AnimatedDot key={i} value={dot} color={theme.lavender} />)}
+ {dots.map((dot, i) => <AnimatedDot key={`dot-${i}`} value={dot} color={theme.lavender} />)}

// apps/mobile/app/(tabs)/chat.tsx:185
- <View key={i} style={{ flexDirection: 'row', ... }}>
+ <View key={conv.id} style={{ flexDirection: 'row', ... }}>
```

### Notification-settings Switch desync fix

```diff
// apps/mobile/app/notification-settings.tsx
- onValueChange={async (v) => {
-   if (v) await handleEnablePush()
-   else await handleDisablePush()
- }}
+ onValueChange={(v) => {
+   if (v) void handleEnablePush()
+   else void handleDisablePush()
+ }}
+ // In handleEnablePush: reset switch to false if permission is denied
```

### share-invite.tsx — catch requestPermissions rejection

```diff
// apps/mobile/app/share-invite.tsx
- const result = await requestPermissions()
+ const result = await requestPermissions().catch(() => 'unavailable' as const)
```

### login.tsx — disable social buttons while in-flight

```diff
// apps/mobile/app/login.tsx (Apple Sign In Pressable)
- <Pressable onPress={handleApple} ...>
+ <Pressable onPress={handleApple} disabled={!!socialLoading} ...>
```
