# Mobile Offline & Error State Audit

**Audited:** 2026-05-22  
**Branch:** aryan/dev  
**Auditor:** automated — all `apps/mobile/src` screens + hooks  
**Screens audited:** 22  

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Present and correct |
| ⚠️ | Partial / inconsistent |
| ❌ | Missing entirely |

**Columns:**
- **loading** — skeleton (not just spinner) while data fetches
- **error** — user-visible error message + retry CTA
- **offline** — `NetInfo`/`useNetInfo` detection with offline banner/fallback
- **empty** — empty state distinct from loading state
- **stale-cache** — cached data shown when offline; "last updated" indicator

---

## Audit Table

| screen | hook / fetch pattern | loading | error | offline | empty | missing patches |
|--------|----------------------|---------|-------|---------|-------|-----------------|
| `app/(tabs)/index.tsx` (Home/Dashboard) | Raw `fetch()` inside `useEffect`; `Promise.all` for meds, appointments, health summary | ✅ `ShimmerSkeleton` + `dataLoading` flag | ❌ `.catch(() => {})` on lines 150, 201–202, 382, 405 — silent failures | ❌ No `NetInfo`; no offline banner | ✅ "Nothing scheduled" for empty appointments | Add error toast on fetch failure; replace `.catch(() => {})` with structured error handler; add `NetInfo` listener |
| `app/(tabs)/care.tsx` (Medications) | Raw `fetch()` for med list + mutation; `ActivityIndicator` during submit | ⚠️ `ActivityIndicator` only (breathing dots) — no skeleton | ❌ Errors `console.log`-only; zero user-facing error UI | ❌ No `NetInfo` | ✅ Empty med list handled | Upgrade to loading skeleton; add error banner with retry; gate mutations behind connectivity check |
| `app/(tabs)/chat.tsx` (AI Chat) | Custom `useChatStream` / raw fetch; message list | ✅ `MessagesSkeleton` + `ConversationListSkeleton` | ✅ `message.isError` renders error bubble; tap-to-retry via `onRetry` prop (lines 133–148) | ❌ No `NetInfo`; send still enabled offline | ✅ Intro/suggestions screen when no history | Add `NetInfo` guard before sending; disable input + show "You're offline" when disconnected |
| `app/(tabs)/community.tsx` (Community Posts) | Raw `fetch()` inside `fetchPosts()`; manual pagination | ✅ `PostSkeleton` component (lines 69–77) | ✅ `setError()` → "Failed to load posts" message (lines 120, 131) | ❌ No `NetInfo`; error message doesn't distinguish network vs server | ✅ Empty-posts state handled | Detect `NetInfo` to show "You're offline — showing cached posts" vs generic error |
| `app/(tabs)/trials.tsx` (Clinical Trials) | Raw `fetch()` in `handleSearch`; background location fetch | ✅ `TrialsSkeleton` + `LiveSearchOverlay` multi-phase (lines 53–143) | ⚠️ `ErrorCard` imported (line 30) but not rendered on all failure paths | ❌ No `NetInfo` | ✅ "No matches found" empty state | Ensure `ErrorCard` renders on every catch branch; add offline detection to skip fetch and show cached last results |
| `app/(tabs)/labs.tsx` (Lab Results) | Raw `fetch()` via `useFocusEffect`; `try/catch` with `setError` | ✅ `ActivityIndicator` during load (reasonable for detail view) | ✅ `setError()` captured; error text shown (lines 94–112) | ❌ No `NetInfo`; no stale cache | ✅ "0 results on file" empty message | Upgrade spinner to skeleton; add `NetInfo`; cache last-fetched labs in `AsyncStorage` for offline view |
| `app/(tabs)/settings.tsx` (Settings) | Reads from `ProfileContext` / `SecureStore`; no network call on mount | ✅ N/A — data from local context | ✅ N/A — no async operations | ✅ N/A — fully local | ✅ N/A | No patches required |
| `app/(tabs)/scan.tsx` (Document Scanner) | `expo-camera` + raw `fetch()` to upload scanned doc | ⚠️ `ActivityIndicator` during upload only | ❌ No error UI for failed upload; silently resets camera | ❌ No `NetInfo`; upload fails silently offline | ✅ N/A (camera view) | Add upload error banner with retry; gate upload behind connectivity check |
| `app/appointments.tsx` (Appointments List) | Raw `fetch()` + `useFocusEffect`; `Promise.all` for upcoming + past | ✅ `ShimmerSkeleton` for appointment cards (lines 739–744) | ⚠️ `Alert.alert()` on some paths (lines 238, 280, 310) — not all error branches covered | ❌ No `NetInfo` | ✅ "No upcoming appointments" / "No past appointments" (lines 370–393) | Standardise error UI (replace Alert with inline error banner + retry); add `NetInfo` |
| `app/appointments/new.tsx` (New Appointment) | Raw `fetch()` POST on form submit | ⚠️ `ActivityIndicator` during submit | ⚠️ `Alert.alert()` on API error — no inline error messaging | ❌ No `NetInfo` | ✅ N/A (form) | Add inline form-level error message; queue submission for retry when offline |
| `app/visit-prep.tsx` (Visit Prep / AI Summary) | Raw `fetch()` per appointment entry; streamed response | ✅ `SkeletonBlock` shimmer (lines 62–70) | ✅ `entry.error` state renders error text (lines 229–231) | ❌ No `NetInfo`; streaming fails silently offline | ✅ N/A (AI generates content) | Add `NetInfo` guard before starting stream; show "Offline — cannot generate prep" message |
| `app/emergency.tsx` (Emergency Card) | Raw `fetch()` for medication list on mount | ⚠️ `ActivityIndicator` during load (line 163) | ❌ `.catch(() => {})` — silent failure (line 49); no fallback UI | ❌ No `NetInfo` | ✅ "Set up your emergency card" empty state (lines 308–315) | Critical: cache emergency card data in `AsyncStorage`; show cached card offline; surface fetch errors to user |
| `app/health-records.tsx` (Medical Records) | Raw `fetch()` via FHIR client; `useEffect` on mount | ⚠️ `ActivityIndicator` spinner (line 90) | ⚠️ Error text shown (lines 94–98) but no retry CTA | ❌ No `NetInfo` | ✅ "No conditions / allergies / procedures" per section | Upgrade to skeleton; add Retry button on error; cache FHIR records for offline access |
| `app/health-summary.tsx` (Health Summary) | Raw `fetch()` for AI-generated summary | ⚠️ `ActivityIndicator` + some skeleton (line 211) | ❌ No `try/catch` visible; no error UI observed | ❌ No `NetInfo` | ✅ "No data" fallback (lines 272–283) | Add `try/catch`; show error message + retry; cache last summary for offline |
| `app/journal.tsx` (Wellness Journal) | Raw `fetch()` for journal entries + POST on save | ⚠️ `ActivityIndicator` only | ❌ No observable error UI for fetch or save failures | ❌ No `NetInfo` | ✅ Empty entry list handled | Add error state for load/save failures; queue offline entries in `AsyncStorage` for sync later |
| `app/search.tsx` (Global Search) | Raw `fetch()` debounced on query change | ⚠️ `ActivityIndicator` while searching (line 176) | ✅ `searchError` states detected and messaged (lines 55, 193–200) | ❌ No `NetInfo` | ✅ "Search medications / appointments …" prompts (lines 181–188) | Add offline detection — show "Search unavailable offline" vs API error |
| `app/notifications.tsx` (Notification Center) | Raw `fetch()` on mount; refetch on focus | ⚠️ `ActivityIndicator` (line 123) | ✅ Full error UI + Retry button (lines 125–147): "Could not load" + `fetchNotifications()` re-call | ❌ No `NetInfo` | ✅ Empty notifications handled | Upgrade spinner to skeleton; add `NetInfo` to distinguish offline vs server error |
| `app/community/[id].tsx` (Community Post Detail) | Raw `fetch()` for post + comments on mount | ✅ `DetailSkeleton` + `ShimmerSkeleton` (lines 57–62) | ❌ No visible error handling or error UI | ❌ No `NetInfo` | ✅ N/A (detail view) | Add `try/catch`; render error message with Back/Retry CTA |
| `app/care-group-settings.tsx` (Care Group Settings) | Raw `fetch()` for group data; mutations on save | ⚠️ `ActivityIndicator` only | ❌ No error UI for failed load or save | ❌ No `NetInfo` | ✅ N/A (settings form) | Add inline error for fetch/save failures; gate mutations behind connectivity |
| `app/health-connect.tsx` (Apple Health Tutorial) | Static tutorial screen; no network calls | ✅ N/A | ✅ N/A | ✅ N/A | ✅ N/A | No patches required |
| `app/setup.tsx` (Onboarding Wizard) | Raw `fetch()` + `SecureStore` writes per step | ⚠️ Per-step `ActivityIndicator` | ⚠️ `Alert.alert()` on some step errors | ❌ No `NetInfo` | ✅ N/A (wizard) | Standardise to inline error messages; prevent progression to next step when offline |
| `app/share-invite.tsx` (Share / Invite) | Raw `fetch()` POST to generate invite link | ⚠️ `ActivityIndicator` during generation | ❌ No error UI; silent failure | ❌ No `NetInfo` | ✅ N/A (action screen) | Add error banner; disable share button offline |

---

## Summary Scorecard

| check | screens passing | screens failing | grade |
|-------|----------------|-----------------|-------|
| Loading skeleton (not just spinner) | 10 / 22 | 12 | **C** |
| Error UI + retry CTA | 5 / 22 | 17 | **D+** |
| Offline detection (`NetInfo`) | 0 / 22 | 22 | **F** |
| Empty state distinct from loading | 19 / 22 | 3 | **A** |
| Stale cache / offline fallback | 0 / 22 | 22 | **F** |

---

## Top Priority Patches

### P0 — Offline Detection (blocks all offline UX)

No screen imports `@react-native-community/netinfo`. Need a single shared hook:

```ts
// src/hooks/useNetworkState.ts (create)
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    return NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });
  }, []);
  return isOnline;
}
```

Wire into a global `<OfflineBanner />` in `app/_layout.tsx`.

---

### P0 — Emergency Card Offline Cache (patient safety)

`app/emergency.tsx` silently fails to load medications. Emergency card MUST be cached:

```ts
// On successful load, persist to AsyncStorage
await AsyncStorage.setItem('emergency_card_cache', JSON.stringify(data));

// On mount failure, read cache and show with "Last updated: X" indicator
```

---

### P1 — Replace `.catch(() => {})` (silent errors)

Files with swallowed errors (≥40 instances across codebase):
- `app/(tabs)/index.tsx` — lines 150, 201, 382, 405
- `app/emergency.tsx` — line 49
- `app/scan.tsx` — upload handler
- `app/share-invite.tsx` — generate link handler

Replace pattern:
```ts
// Before
.catch(() => {})

// After
.catch(err => {
  console.error('[screen] fetch failed:', err?.message);
  setError('Something went wrong. Pull down to retry.');
})
```

---

### P1 — Standardise Skeleton Loading

12 screens still use `ActivityIndicator` for full-screen data loads. Upgrade to `ShimmerSkeleton` (already in codebase) for:
- `labs.tsx`, `notifications.tsx`, `search.tsx`, `health-records.tsx`, `journal.tsx`, `care.tsx`, `scan.tsx`, `appointments/new.tsx`, `setup.tsx`, `health-summary.tsx`, `care-group-settings.tsx`, `share-invite.tsx`

---

### P2 — Add Retry CTA to Error States

17 screens missing retry button. Pattern (from `notifications.tsx` — gold standard):

```tsx
{error && (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>{error}</Text>
    <Pressable onPress={fetchData} style={styles.retryButton}>
      <Text style={styles.retryText}>Retry</Text>
    </Pressable>
  </View>
)}
```

---

### P2 — Offline-First Cache for Critical Data

Install `@tanstack/react-query` + `@tanstack/query-async-storage-persister` or manually cache with `AsyncStorage`:

Priority order:
1. Emergency card medications (P0)
2. Medication list (`care.tsx`)
3. Upcoming appointments (`appointments.tsx`)
4. Lab results (`labs.tsx`)
5. Health records (`health-records.tsx`)

---

## Dependencies Needed

| package | reason | priority |
|---------|---------|----------|
| `@react-native-community/netinfo` | offline detection | P0 |
| `@tanstack/react-query` | structured loading/error/cache | P1 |
| `@tanstack/query-async-storage-persister` | offline persistence | P2 |

---

## Files Requiring No Changes

| screen | reason |
|--------|--------|
| `app/(tabs)/settings.tsx` | local data only, no network calls |
| `app/health-connect.tsx` | static tutorial, no network calls |
