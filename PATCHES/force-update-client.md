# Force-Update & Kill-Switch — Mobile Client Integration

**Owner:** Shreyash (mobile)  
**API owner:** Aryan (web)  
**Status:** Ready to implement — server deployed on `aryan/dev`

---

## Overview

On every cold launch the app fetches `GET /api/version`. The response drives two blocking gates:

| Condition | Screen shown |
|---|---|
| `build < minBuild` (platform-specific) | `UpdateScreen` — app store deep link |
| `killSwitch === true` | `MaintenanceScreen` — reason + ETA copy |

Both screens are **modal-blocking** (no back navigation). Normal launch continues only when both checks pass.

---

## API Contract

```
GET https://carecompanionai.org/api/version
Authorization: (none — public endpoint)
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

### Response shape

```typescript
interface VersionResponse {
  minIosBuild:     number   // minimum iOS CFBundleVersion (integer build number)
  minAndroidBuild: number   // minimum Android versionCode
  latestBuild:     number   // latest available build (for soft-nudge UX, optional)
  killSwitch:      boolean  // true → show MaintenanceScreen regardless of build
  killReason?:     string   // human-readable reason shown on MaintenanceScreen
  message?:        string   // optional informational banner (non-blocking)
}
```

### Example responses

```json
// All clear
{ "minIosBuild": 42, "minAndroidBuild": 42, "latestBuild": 47, "killSwitch": false }

// Force update required
{ "minIosBuild": 50, "minAndroidBuild": 50, "latestBuild": 50, "killSwitch": false }

// Kill switch active
{ "minIosBuild": 1, "minAndroidBuild": 1, "latestBuild": 1, "killSwitch": true,
  "killReason": "Scheduled maintenance — back at 3 PM PT" }
```

---

## Build Number

Use `expo-application` to read the native build number.

```bash
npx expo install expo-application
```

| Platform | Value | Source |
|---|---|---|
| iOS | `CFBundleVersion` (integer string) | `Application.nativeBuildVersion` |
| Android | `versionCode` (integer string) | `Application.nativeBuildVersion` |

> **Do not** use `Application.nativeApplicationVersion` (that is the semver user-visible string, not the build integer).

---

## Implementation

### 1. `hooks/useVersionCheck.ts`

```typescript
import { useEffect, useState } from 'react'
import * as Application from 'expo-application'
import { Platform } from 'react-native'

const VERSION_URL = process.env.EXPO_PUBLIC_API_URL + '/api/version'

interface VersionState {
  loading: boolean
  forceUpdate: boolean
  killSwitch: boolean
  killReason?: string
  message?: string
}

export function useVersionCheck(): VersionState {
  const [state, setState] = useState<VersionState>({
    loading: true,
    forceUpdate: false,
    killSwitch: false,
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(VERSION_URL, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res.ok) {
          // Server error — fail open so a bad deploy can't brick the app
          if (!cancelled) setState({ loading: false, forceUpdate: false, killSwitch: false })
          return
        }
        const data = await res.json()

        const build = parseInt(Application.nativeBuildVersion ?? '0', 10)
        const minBuild = Platform.OS === 'ios' ? data.minIosBuild : data.minAndroidBuild
        const forceUpdate = build < minBuild

        if (!cancelled) {
          setState({
            loading: false,
            forceUpdate,
            killSwitch: data.killSwitch === true,
            killReason: data.killReason,
            message: data.message,
          })
        }
      } catch {
        // Network error — fail open
        if (!cancelled) setState({ loading: false, forceUpdate: false, killSwitch: false })
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  return state
}
```

> **Fail-open policy:** if `/api/version` is unreachable or returns a non-200 the app proceeds normally. We never brick users due to a monitoring endpoint outage.

---

### 2. `screens/UpdateScreen.tsx`

```typescript
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native'

// Replace with real App Store / Play Store IDs before shipping
const IOS_APP_STORE_URL   = 'itms-apps://itunes.apple.com/app/id<YOUR_APP_ID>'
const ANDROID_MARKET_URL  = 'market://details?id=com.carecompanion.app'

export function UpdateScreen() {
  const storeUrl = Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_MARKET_URL

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🔄</Text>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.body}>
          A new version of CareCompanion is available. Please update to continue.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(storeUrl)}
          accessibilityRole="button"
          accessibilityLabel="Open app store to update CareCompanion"
        >
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
```

---

### 3. `screens/MaintenanceScreen.tsx`

```typescript
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native'

interface Props {
  reason?: string
}

export function MaintenanceScreen({ reason }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🛠️</Text>
        <Text style={styles.title}>Down for Maintenance</Text>
        <Text style={styles.body}>
          {reason?.trim() || 'CareCompanion is temporarily unavailable. We\'ll be back shortly.'}
        </Text>
        <Text style={styles.hint}>No action needed — try again in a few minutes.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
})
```

---

### 4. Root layout integration

Wire the hook into your root layout (e.g. `app/_layout.tsx` or `App.tsx`) **before** any navigation renders:

```typescript
import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useVersionCheck } from '@/hooks/useVersionCheck'
import { UpdateScreen } from '@/screens/UpdateScreen'
import { MaintenanceScreen } from '@/screens/MaintenanceScreen'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { loading, forceUpdate, killSwitch, killReason } = useVersionCheck()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Kill-switch takes priority over force-update
  if (killSwitch) return <MaintenanceScreen reason={killReason} />
  if (forceUpdate) return <UpdateScreen />

  return <>{children}</>
}
```

---

## Environment Variable

Add to `apps/mobile/.env` (or `app.config.ts` extra):

```
EXPO_PUBLIC_API_URL=https://carecompanionai.org
```

---

## Ops Playbook

### Trigger a force update

**Fast path (no deploy):** Update the Aurora row:
```sql
UPDATE app_version_config SET value = '50', updated_at = now() WHERE key = 'min_ios_build';
UPDATE app_version_config SET value = '50', updated_at = now() WHERE key = 'min_android_build';
```

**Faster path (env var override — instant, no DB required):**
```
APP_MIN_IOS_BUILD=50
APP_MIN_ANDROID_BUILD=50
```
Set in Vercel dashboard → redeploy (or use preview env override).

### Activate kill switch

**DB:**
```sql
UPDATE app_version_config SET value = 'true',  updated_at = now() WHERE key = 'kill_switch';
UPDATE app_version_config SET value = 'Scheduled maintenance — back at 3 PM PT', updated_at = now() WHERE key = 'kill_reason';
```

**Env override:**
```
APP_KILL_SWITCH=true
APP_KILL_REASON=Scheduled maintenance — back at 3 PM PT
```

### Deactivate kill switch

```sql
UPDATE app_version_config SET value = 'false', updated_at = now() WHERE key = 'kill_switch';
UPDATE app_version_config SET value = '',       updated_at = now() WHERE key = 'kill_reason';
```

---

## Health Check

`GET /api/health` (with `Authorization: Bearer $CRON_SECRET`) will return `schema.app_version_config: { status: "ok" }` once migration 022 has been applied. A `status: "error"` here means the migration is missing — apply it before shipping the gated mobile build.
