# HealthKit Backup Exclusion — Apple Guideline 5.1.3

**Audited:** 2026-05-22  
**Scope:** `apps/mobile` — all local storage paths that hold HealthKit-derived data  
**Guideline:** [App Store Review Guideline 5.1.3](https://developer.apple.com/app-store/review/guidelines/#health-records) — HealthKit-derived data stored on-device must not appear in iCloud or iTunes backups (`NSURLIsExcludedFromBackupKey = true`).

---

## Findings

No `FileSystem.documentDirectory`, MMKV, Realm, or expo-sqlite was found. All HealthKit-derived persistence is via `@react-native-async-storage/async-storage` (v1.23.1). On iOS this library writes individual JSON files to:

```
<AppSandbox>/Library/RCTAsyncLocalStorage_V1/
```

`NSLibraryDirectory` is **included in iCloud and iTunes backups by default**. The directory has no `NSURLIsExcludedFromBackupKey` set anywhere in the codebase. `expo-secure-store` (used for session/CSRF/profile) maps to the iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — Keychain items with a `ThisDeviceOnly` accessibility flag are **not** replicated to iCloud backup and require **no change**.

---

## Storage paths table

| Path / Key | Data contained | Currently excluded? | Patch | Risk if shipped as-is |
|---|---|---|---|---|
| `Library/RCTAsyncLocalStorage_V1/cc-healthkit-retry-queue` | `ExtendedHealthKitRecord[]` — full FHIR payloads: medication name/dose/prescriber, lab results with test name/value/units/reference ranges/abnormal flag, vital signs, conditions, procedures, allergies, immunizations | **No** | Exclude parent directory — see Patch A | PHI in clinical records lands in iCloud/iTunes backup. Violates guideline 5.1.3. App Store rejection or removal. Data accessible to anyone with device backup access. |
| `Library/RCTAsyncLocalStorage_V1/cc-dev-meds` | DEV-only: medication records (name, dose, frequency, prescribing doctor) | **No** | Exclude parent directory — see Patch A | Same as above. Dev builds likely run on real devices with real HealthKit data during TestFlight. |
| `Library/RCTAsyncLocalStorage_V1/cc-dev-labs` | DEV-only: lab results with test names, numeric values, reference ranges, `isAbnormal` flag | **No** | Exclude parent directory — see Patch A | Same as above. |
| `Library/RCTAsyncLocalStorage_V1/cc-wellness-retry-queue` | `WellnessSnapshot[]` — steps count, heart rate (bpm), sleep hours | **No** | Exclude parent directory — see Patch A | Wellness vitals are HealthKit samples. Guideline 5.1.3 covers all HealthKit-derived data, not only clinical records. |
| `Library/RCTAsyncLocalStorage_V1/cc-healthkit-last-synced` | Epoch ms of last successful HealthKit clinical sync | **No** | Exclude parent directory — see Patch A | Low direct PHI content, but confirms HealthKit usage and sync cadence. Still covered by 5.1.3. |
| `Library/RCTAsyncLocalStorage_V1/cc-wellness-last-synced` | Epoch ms of last wellness vitals sync | **No** | Exclude parent directory — see Patch A | Same as above. |
| `Library/RCTAsyncLocalStorage_V1/cc-healthkit-connected` | Boolean flag — whether the user has granted HealthKit authorization | **No** | Exclude parent directory — see Patch A | Reveals that HealthKit is connected; low severity but guideline-adjacent. Exclude together with the directory. |
| `Keychain / SecureStore: cc-session-token` | Session JWT | **N/A — not backed up** | None required | No risk — expo-secure-store uses `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`; not in iCloud backup. |
| `Keychain / SecureStore: cc-profile` | User profile JSON (may include care context) | **N/A — not backed up** | None required | Same as above. |
| `Keychain / SecureStore: cc-csrf-token` | CSRF token | **N/A — not backed up** | None required | Same as above. |
| `HKHealthStore` (native — `HealthKitBridge.swift`, `WellnessVitals.swift`) | Clinical records / wellness samples read at query time | **N/A — no local file written** | None required | Native modules read from HKHealthStore and return data to JS. No local file written; nothing to exclude. |

---

## Patch A — Exclude the AsyncStorage directory at launch (AppDelegate.mm)

**File:** `apps/mobile/ios/CareCompanion/AppDelegate.mm`  
**Where:** inside `-application:didFinishLaunchingWithOptions:`, before the `return [super …]` call.

**Why the whole directory:** AsyncStorage v1.23.1 creates one file per key inside `RCTAsyncLocalStorage_V1/`. There is no per-file API exposed to JS. The directory itself must be flagged. All other AsyncStorage keys in this app are UI-state flags (onboarding seen, notification prefs, nudge dismissals) — none require backup, so excluding the whole directory has no meaningful downside.

```objc
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";
  self.initialProps = @{};

  // HealthKit data lives in AsyncStorage (RCTAsyncLocalStorage_V1).
  // NSLibraryDirectory is backed up by default; exclude the directory so
  // HealthKit-derived records never appear in iCloud or iTunes backups.
  // Required by App Store guideline 5.1.3.
  [self excludeAsyncStorageFromBackup];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (void)excludeAsyncStorageFromBackup
{
  NSURL *libURL = [[[NSFileManager defaultManager]
      URLsForDirectory:NSLibraryDirectory
             inDomains:NSUserDomainMask] firstObject];
  if (!libURL) return;

  NSURL *asyncStorageDir = [libURL URLByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"
                                                   isDirectory:YES];

  // Create the directory if it does not yet exist so the resource value
  // is set before the first AsyncStorage write.
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:asyncStorageDir.path]) {
    [fm createDirectoryAtURL:asyncStorageDir
 withIntermediateDirectories:YES
                  attributes:nil
                       error:nil];
  }

  NSError *err = nil;
  BOOL ok = [asyncStorageDir setResourceValue:@YES
                                       forKey:NSURLIsExcludedFromBackupKey
                                        error:&err];
  if (!ok) {
    NSLog(@"[CareCompanion] Failed to set backup exclusion on AsyncStorage dir: %@",
          err.localizedDescription);
  }
}
```

**Notes:**
- `setResourceValue:forKey:NSURLIsExcludedFromBackupKey` persists across reboots — it sets an extended attribute (`com.apple.MobileBackup`) on the directory inode. Calling it on every launch is safe (idempotent) and ensures the flag survives OS upgrades that may recreate the directory.
- The `createDirectoryAtURL` guard handles first-launch ordering where AppDelegate runs before any AsyncStorage write has created the directory.
- Do **not** suppress the `NSLog` line — it is the only non-PHI signal that this protection is active.

---

## Patch B — Move retry queues to Caches (optional, defence-in-depth)

`Library/Caches/` is excluded from iCloud backup by OS policy and can be purged by the OS under storage pressure. Moving the retry queues there adds a second layer: even if the directory exclusion flag is somehow lost, the actual clinical-record payloads live in a non-backup location.

This requires adding `expo-file-system` (`expo install expo-file-system`) and replacing the `AsyncStorage.getItem/setItem` calls in:

- `apps/mobile/src/services/healthkit.ts` — `readQueue()` / `writeQueue()` (lines 98–115)
- `apps/mobile/src/services/wellnessVitals.ts` — equivalent queue read/write

Replace pattern:

```ts
import * as FileSystem from 'expo-file-system'

const QUEUE_DIR = FileSystem.cacheDirectory + 'cc-hk-queues/'

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const path = QUEUE_DIR + 'retry-queue.json'
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists) return []
    const raw = await FileSystem.readAsStringAsync(path)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
  } catch {
    return []
  }
}

async function writeQueue(q: QueueEntry[]): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true })
    await FileSystem.writeAsStringAsync(QUEUE_DIR + 'retry-queue.json', JSON.stringify(q))
  } catch {
    // Storage unavailable — drop silently; next sync re-queues.
  }
}
```

`FileSystem.cacheDirectory` on iOS resolves to `<AppSandbox>/Library/Caches/` which the OS excludes from backup automatically — no `setResourceValue` needed.

**Patch B is optional if Patch A is applied** — include it if you want belt-and-suspenders protection or plan to add file-system-level logging in future.

---

## Verification checklist

After applying Patch A:

- [ ] Build and run on a physical device (simulator does not replicate backup behavior).
- [ ] Trigger a HealthKit sync so at least `cc-healthkit-retry-queue` or `cc-healthkit-last-synced` is written.
- [ ] In a terminal: `idevicebackup2 backup --full /tmp/test-backup` and inspect — the `RCTAsyncLocalStorage_V1` directory should be absent from the backup manifest.
- [ ] Alternatively, verify via `mdls -name com.apple.MobileBackup <path-to-RCTAsyncLocalStorage_V1>` — should return `1`.
- [ ] Run `npm run typecheck && npm run lint && npm run test:run && npm run deadcode` (no TS/lint changes from Patch A — it's Obj-C only).

---

## Out of scope

- **Android:** `AsyncStorage` on Android uses SQLite in the app's internal storage (`/data/data/<package>/databases/`). Android does not back up to iCloud; Google's Auto Backup excludes `databases/` by default since API 23 and this project targets modern Android. Verify `android:allowBackup` in `AndroidManifest.xml` is `false` or `android:fullBackupContent` excludes the database if `allowBackup=true`.
