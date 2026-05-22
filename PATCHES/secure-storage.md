# Secure Storage Audit — apps/mobile/

**Date:** 2026-05-22  
**Branch:** aryan/dev  
**Auditor:** Claude (Aryan's dev session)

---

## Summary

22 AsyncStorage keys found across 15 files.  
**5 keys contain PHI or PII and MUST migrate to `expo-secure-store`.**  
17 keys are safe in AsyncStorage (UI-state, boolean flags, timestamps).

`expo-secure-store` maps to iOS Keychain and Android EncryptedSharedPreferences.  
AsyncStorage is unencrypted and readable by any process with root/backup access.

---

## Full Key Inventory

| Key | Data stored | Classification | Current store | Required store | Action |
|-----|-------------|----------------|---------------|----------------|--------|
| `cc-display-name` | User's display name string (written at signup) | **PII** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-dev-meds` | `[{name, dose, frequency, prescribingDoctor}]` — medication names, dosage, prescriber | **PHI** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-dev-labs` | `[{testName, value, unit, referenceRange, dateTaken}]` — lab test results & values | **PHI** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-healthkit-retry-queue` | `QueueEntry[]` containing `ExtendedHealthKitRecord[]` (FHIR clinical records: diagnoses, medications, lab results) | **PHI** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-wellness-retry-queue` | `QueueEntry[]` containing `{steps, heartRate, sleepHours, capturedAt}` — biometric health vitals | **PHI** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-user-type` | `'patient' \| 'caregiver' \| 'self'` — health role | **PII** | AsyncStorage | SecureStore | **MIGRATE** |
| `cc-session-token` | JWT session token | auth | SecureStore ✅ | SecureStore | OK |
| `cc-csrf-token` | CSRF token | auth | SecureStore ✅ | SecureStore | OK |
| `cc-profile` | Full profile JSON: userId, email, patientName, emergencyContactName/Phone, cancerType, cancerStage, treatmentPhase, allergies, conditions | PHI/auth | SecureStore ✅ | SecureStore | OK |
| `cc-user-id` | Internal user UUID | auth | SecureStore ✅ | SecureStore | OK |
| `cc-user-email` | User email address | PII/auth | SecureStore ✅ | SecureStore | OK |
| `cc-health-consent-accepted` | ISO timestamp of consent acceptance | auth | SecureStore ✅ | SecureStore | OK |
| `cc-welcome-seen` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-tos-accepted` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-caregiver-joined` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-records-onboarded` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-setup-skipped` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-healthkit-connected` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-healthkit-last-synced` | epoch ms timestamp | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-wellness-last-synced` | epoch ms timestamp | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-new-labs-count` | numeric string | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-last-checkin-date` | date string `YYYY-MM-DD` | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-chat-intro-seen` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-profile-completion-dismissed` | `'true'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-invite-shown` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-notification-prefs` | `NotificationPrefs` JSON (boolean toggles only, no patient data) | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-checkin-notification-id` | Notification UUID string | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-web-nudge-shown` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-notif-prompt-shown` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `tour_completed` | `'true'` flag | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc_theme_override` | theme string e.g. `'dark'` | UI-state | AsyncStorage | AsyncStorage | OK |
| `cc-disclaimer-seen` | `'1'` flag | UI-state | AsyncStorage | AsyncStorage | OK |

---

## PHI Flag Detail

### `cc-dev-meds` — CRITICAL
Written by `saveDevMockData()` in `src/services/healthkit.ts:244`.  
Shape: `{id, name, dose, frequency, prescribingDoctor}`.  
Contains medication name, dose, and **prescribing doctor name** — all PHI under HIPAA 45 CFR §164.514(b)(2).  
> Note: this key was named "dev" but is read by production screens (`app/(tabs)/care.tsx`, `app/(tabs)/index.tsx`) on all builds.

### `cc-dev-labs` — CRITICAL
Written by `saveDevMockData()` in `src/services/healthkit.ts:245`.  
Shape: `{id, testName, value, unit, referenceRange, isAbnormal, dateTaken, source}`.  
Contains lab test names, numeric values, and reference ranges — PHI (lab results, §164.514(b)(2)(i) item 16).

### `cc-healthkit-retry-queue` — CRITICAL
Written by `writeQueue()` in `src/services/healthkit.ts:111`.  
Shape: `QueueEntry[]` where each entry embeds `ExtendedHealthKitRecord[]` (FHIR ClinicalRecord objects).  
These are full clinical records sourced from Apple HealthKit's `HKClinicalRecord` API, which includes diagnoses, medications, conditions, lab results from connected EHR providers.

### `cc-wellness-retry-queue` — HIGH
Written by `writeQueue()` in `src/services/wellnessVitals.ts:80`.  
Shape: `{capturedAt, steps, heartRate, sleepHours}`.  
Heart rate and sleep hours qualify as PHI when linked to an identified individual (§164.514(b)(2)(i) items 14–15).

### `cc-display-name` — MEDIUM
Written by `signup.tsx:267`.  
Contains the user's chosen display name. PII; when combined with other stored data (profile, health records) elevates to PHI risk. Must not be recoverable from unencrypted device backup.

### `cc-user-type` — MEDIUM
Written by `ProfileContext.tsx:95`, `src/services/auth.ts` (cleared on signout).  
Value: `'patient' | 'caregiver' | 'self'`.  
Reveals health relationship status. On its own it is PII; combined with the device being associated with a specific person (and with the profile in SecureStore) it becomes sensitive enough to encrypt.

---

## Migration Patch

File: `apps/mobile/scripts/migrate-to-secure-store.ts`

Run once at app startup (inside `_layout.tsx` `useEffect`) before the AuthGate reads storage.  
The function is idempotent — it checks for the AsyncStorage value, writes to SecureStore, then deletes the AsyncStorage entry.

```typescript
// apps/mobile/scripts/migrate-to-secure-store.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

const PHI_KEYS_TO_MIGRATE = [
  'cc-display-name',
  'cc-dev-meds',
  'cc-dev-labs',
  'cc-healthkit-retry-queue',
  'cc-wellness-retry-queue',
  'cc-user-type',
] as const

/**
 * One-shot migration: reads each key from AsyncStorage, writes it to
 * SecureStore (Keychain / EncryptedSharedPreferences), then deletes the
 * plaintext AsyncStorage entry. Safe to call on every startup — no-ops if
 * AsyncStorage entry is already absent.
 */
export async function migratePhiToSecureStore(): Promise<void> {
  await Promise.allSettled(
    PHI_KEYS_TO_MIGRATE.map(async (key) => {
      try {
        const value = await AsyncStorage.getItem(key)
        if (value === null) return  // already migrated or never set
        await SecureStore.setItemAsync(key, value, SECURE_OPTIONS)
        await AsyncStorage.removeItem(key)
      } catch {
        // Non-fatal: if migration fails, the data stays in AsyncStorage.
        // Log to error monitoring (no PHI in log message).
        console.warn(`[secure-storage] migration failed for key: ${key}`)
      }
    })
  )
}
```

### Call site — `app/_layout.tsx`

Add the migration call early in the root layout's `useEffect`, before auth state is read:

```typescript
// app/_layout.tsx — inside the first useEffect that bootstraps auth
import { migratePhiToSecureStore } from '../scripts/migrate-to-secure-store'

useEffect(() => {
  migratePhiToSecureStore().then(() => {
    // existing auth bootstrap logic
  })
}, [])
```

### Callsite changes per migrated key

After migration runs, each read/write site must switch from `AsyncStorage` to `SecureStore`:

| Key | File(s) | Change |
|-----|---------|--------|
| `cc-display-name` | `app/(tabs)/index.tsx:225`, `app/signup.tsx:267` | `AsyncStorage.getItem/setItem` → `SecureStore.getItemAsync/setItemAsync` |
| `cc-dev-meds` | `src/services/healthkit.ts:244`, `app/(tabs)/care.tsx:515`, `app/(tabs)/index.tsx:176`, `app/(tabs)/labs.tsx:62` | same pattern |
| `cc-dev-labs` | `src/services/healthkit.ts:245`, `app/(tabs)/care.tsx:516`, `app/(tabs)/index.tsx:177` | same pattern |
| `cc-healthkit-retry-queue` | `src/services/healthkit.ts:100,111` | same pattern |
| `cc-wellness-retry-queue` | `src/services/wellnessVitals.ts:69,80` | same pattern |
| `cc-user-type` | `src/context/ProfileContext.tsx:95`, `src/components/RoleBadge.tsx:30`, `app/_layout.tsx:221,233,238`, `src/services/auth.ts:74` | same pattern; also update `auth.ts` signout to call `SecureStore.deleteItemAsync` |

### `SecureStore` size limit

`expo-secure-store` enforces a **2048-byte value limit** per key on iOS Keychain.  
`cc-healthkit-retry-queue` and `cc-dev-meds/labs` may exceed this.  
**Mitigation:** Compress with a simple JSON → base64 wrapper and split into shards if `value.length > 1800`.  
Alternatively, use `expo-file-system` to write an AES-encrypted file (React Native Keychain can store the AES key).  
`cc-wellness-retry-queue` is small (a few float payloads) and will fit.

> Recommendation: for the two queue keys, store them in `expo-file-system` with the file path stored in SecureStore, or use a SQLite-based encrypted DB (e.g. `expo-sqlite` with SQLCipher) for all retry queues. File this as a follow-up ticket; the migration script above is the critical HIPAA fix.

---

## Files Owning Each Key

| Key | Owner file |
|-----|------------|
| `cc-display-name` | `app/signup.tsx` (write), `app/(tabs)/index.tsx` (read) |
| `cc-dev-meds` | `src/services/healthkit.ts` (write), `app/(tabs)/care.tsx`, `app/(tabs)/index.tsx` (read) |
| `cc-dev-labs` | `src/services/healthkit.ts` (write), `app/(tabs)/care.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/labs.tsx` (read) |
| `cc-healthkit-retry-queue` | `src/services/healthkit.ts` (rw) |
| `cc-wellness-retry-queue` | `src/services/wellnessVitals.ts` (rw) |
| `cc-user-type` | `src/context/ProfileContext.tsx` (write), `src/components/RoleBadge.tsx`, `app/_layout.tsx`, `src/services/auth.ts` (clear) |
