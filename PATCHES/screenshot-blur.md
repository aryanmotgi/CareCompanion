# PHI Defense — Mobile (screenshot-blur, jailbreak, screen-recording)

**Branch:** `aryan/dev`  
**HIPAA anchors:** §164.312(a)(1) access control, §164.312(e)(2) encryption in transit, §164.312(c)(1) integrity

Three independent defences are wired in together via `app/_layout.tsx`. All new code lives in `apps/mobile/`.

---

## (a) Blur-on-Background

### Mechanism

`AppState.addEventListener('change', …)` fires whenever the OS moves the app through `active → inactive → background` (and back). When state is `inactive` (mid-transition, app-switcher visible) or `background`, an overlay covers the entire view tree, preventing iOS/Android from capturing a screenshot of PHI content for the app-switcher thumbnail.

### New file — `src/components/PHIPrivacyGuard.tsx`

```tsx
// Renders a full-screen BlurView (iOS) or black View (Android) on top of all
// content whenever AppState is inactive/background OR screen recording is active.
// Integrates both (a) and (c) in a single mount-once component.
```

**Full implementation:** `apps/mobile/src/components/PHIPrivacyGuard.tsx`

Key decisions:
- Uses `expo-blur` (`BlurView`, already a dep) on iOS so the overlay matches the system blurred-app-switcher aesthetic and doesn't flash a hard black.
- Uses a solid black `View` on Android (BlurView requires additional native setup on Android).
- `pointerEvents="none"` on the overlay — during background transitions the OS prevents interaction anyway; during recording the user needs to be able to navigate to stop the capture.
- `bgObscure` and `recObscure` are tracked as separate booleans so clearing one can't accidentally expose PHI while the other reason is still active.

### Integration in `app/_layout.tsx`

```tsx
// Added import:
import { PHIPrivacyGuard } from '../src/components/PHIPrivacyGuard'

// Wrap SafeAreaProvider's children:
<SafeAreaProvider>
  <PHIPrivacyGuard>
    {/* entire app tree */}
  </PHIPrivacyGuard>
</SafeAreaProvider>
```

`PHIPrivacyGuard` sits outside all navigation providers so the overlay fires before any screen re-renders on resume, and covers the `BugReportSheet` and `DisclaimerModal` which are outside the `Stack`.

---

## (b) Jailbreak Detection

### Mechanism

[`jail-monkey`](https://github.com/GantMan/jail-monkey) checks for Cydia, suspicious mount paths, writeable `/private`, `DYLD_INSERT_LIBRARIES`, and several other iOS jailbreak artifacts. On Android it checks for `su` binary, build-tag modifications, and test-keys.

HIPAA requires we warn users when device security posture exposes PHI to increased risk (§164.308(a)(1)). Blocking app use is optional; a modal warning that must be explicitly dismissed satisfies the requirement and avoids locking out caregivers in emergency situations.

### New files

#### `src/hooks/useJailbreakCheck.ts`

```ts
import JailMonkey from 'jail-monkey'

export function useJailbreakCheck(): boolean {
  // Calls JailMonkey.isJailBroken() once on mount.
  // Returns false on simulator or if the native module is unavailable.
}
```

#### `src/components/JailbreakWarning.tsx`

Modal shown when `useJailbreakCheck()` returns `true` and the user hasn't dismissed it this session. Dismissal is in-memory only — the warning re-appears on next cold launch until the device is restored to a non-jailbroken state.

```tsx
<JailbreakWarning
  visible={isJailbroken && !jailbreakDismissed}
  onDismiss={() => setJailbreakDismissed(true)}
/>
```

#### `src/types/jail-monkey.d.ts`

Type shim — `jail-monkey` has no `@types` package.

### `package.json` change

```json
"jail-monkey": "^2.7.0"
```

Run `bun install && expo prebuild --clean` (or `expo run:ios`) after pulling this branch to compile the native module.

### Integration in `app/_layout.tsx`

```tsx
import { JailbreakWarning } from '../src/components/JailbreakWarning'
import { useJailbreakCheck } from '../src/hooks/useJailbreakCheck'

// Inside RootLayout:
const isJailbroken = useJailbreakCheck()
const [jailbreakDismissed, setJailbreakDismissed] = useState(false)

// Inside JSX (inside PHIPrivacyGuard):
<JailbreakWarning
  visible={isJailbroken && !jailbreakDismissed}
  onDismiss={() => setJailbreakDismissed(true)}
/>
```

---

## (c) Screen-Recording Detection (iOS)

### Mechanism

`UIScreen.capturedDidChangeNotification` fires whenever `UIScreen.main.isCaptured` toggles. This covers:
- Screen recording via Control Center
- AirPlay mirroring to a non-trusted display
- ReplayKit broadcast

When `isCaptured == true`, `PHIPrivacyGuard` raises its overlay (same `BlurView` as the background defence).

### New native files

#### `ios/CareCompanion/ScreenCaptureManager.swift`

```swift
@objc(ScreenCaptureManager)
class ScreenCaptureManager: RCTEventEmitter {
  // Registers for UIScreen.capturedDidChangeNotification in startObserving()
  // (called by RCTEventEmitter when JS listener count 0→1) and removes it in
  // stopObserving() (listener count 1→0). Avoids holding the observer when
  // no JS listener is active.
  //
  // Emits: { name: "screenCaptureChanged", body: { isCaptured: Bool } }
  //
  // Also exposes isCaptured() as a Promise for seeding initial state on mount.
}
```

**Full implementation:** `apps/mobile/ios/CareCompanion/ScreenCaptureManager.swift`

#### `ios/CareCompanion/ScreenCaptureManager.m`

Objective-C bridge for the Swift module (required for React Native legacy architecture):

```objc
@interface RCT_EXTERN_MODULE(ScreenCaptureManager, RCTEventEmitter)
RCT_EXTERN_METHOD(isCaptured:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
```

### Xcode project registration

After pulling this branch, open `ios/CareCompanion.xcworkspace` and add both files to the `CareCompanion` target:

1. File → Add Files to "CareCompanion"
2. Select `ScreenCaptureManager.swift` and `ScreenCaptureManager.m`
3. Ensure both are checked under Target Membership → CareCompanion
4. Xcode will offer to create/update the bridging header — accept (the project already has `CareCompanion-Bridging-Header.h` and `noop-file.swift` so Swift compilation is already enabled)

Alternatively, run `expo prebuild --clean` which re-generates the Xcode project from `app.config.js`; in that case the files must be referenced from a custom config plugin or placed in a directory that prebuild includes automatically. For teams using EAS Build, registering a local config plugin is the recommended path.

### JS integration (inside `PHIPrivacyGuard.tsx`)

```tsx
const { ScreenCaptureManager } = NativeModules
const emitter = new NativeEventEmitter(ScreenCaptureManager)

// Seed initial state
ScreenCaptureManager.isCaptured().then((captured) => setRecObscure(captured))

// Live updates
emitter.addListener('screenCaptureChanged', ({ isCaptured }) => setRecObscure(isCaptured))
```

---

## Summary of All Changed Files

| File | Action |
|------|--------|
| `apps/mobile/package.json` | Add `"jail-monkey": "^2.7.0"` |
| `apps/mobile/app/_layout.tsx` | Import + wire PHIPrivacyGuard, JailbreakWarning, useJailbreakCheck |
| `apps/mobile/src/components/PHIPrivacyGuard.tsx` | **New** — blur-on-background + recording overlay |
| `apps/mobile/src/components/JailbreakWarning.tsx` | **New** — HIPAA jailbreak warning modal |
| `apps/mobile/src/hooks/useJailbreakCheck.ts` | **New** — jail-monkey wrapper hook |
| `apps/mobile/src/types/jail-monkey.d.ts` | **New** — TS type shim |
| `apps/mobile/ios/CareCompanion/ScreenCaptureManager.swift` | **New** — iOS native KVO module |
| `apps/mobile/ios/CareCompanion/ScreenCaptureManager.m` | **New** — ObjC bridge |

## Post-merge steps

```bash
# After merging this PR:
cd apps/mobile
bun install                    # install jail-monkey
expo prebuild --clean          # regenerate ios/ for jail-monkey native code
# Open ios/CareCompanion.xcworkspace and add ScreenCaptureManager.{swift,m} to target
# (or author a config plugin — see Xcode project registration above)
```

## Testing checklist

- [ ] Background blur: open app, press Home → app-switcher thumbnail shows blur (not PHI)
- [ ] Foreground restore: tap app from switcher → blur clears, PHI visible
- [ ] Screen recording: start Control Center recording → BlurView appears; stop recording → clears
- [ ] Jailbreak warning: test on a jailbroken device or temporarily return `true` from `useJailbreakCheck`; confirm modal appears and dismisses correctly
- [ ] Clean device: jailbreak warning absent on non-jailbroken device / simulator
- [ ] Android: confirm black overlay appears on background (no BlurView crash)
