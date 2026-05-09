# Mobile Full Parity — Phase 0: Visual Fixes + Broken Functionality

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 most visible mobile app issues — gradient bleed, ugly tab icons, card borders, broken chat, fake camera — so the app feels real instead of a broken demo.

**Architecture:** All changes are in `apps/mobile/`. Chat fix requires adding a `chat.send()` method to `packages/api/src/client.ts` and a `GET /api/csrf-token` endpoint on the web side. No database changes.

**Tech Stack:** React Native, Expo Router, Reanimated, @expo/vector-icons (Ionicons), expo-image-picker, packages/api client

**CEO Plan:** `~/.gstack/projects/aryanmotgi-CareCompanion/ceo-plans/2026-04-23-mobile-full-parity.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `apps/mobile/src/theme.ts` | Fix gradient stops, lower card border opacity |
| Modify | `apps/mobile/app/(tabs)/_layout.tsx` | Replace emoji icons with Ionicons |
| Modify | `apps/mobile/app/(tabs)/chat.tsx` | Remove direct fetch, use API client |
| Modify | `apps/mobile/app/(tabs)/scan.tsx` | Replace fake animation with expo-image-picker |
| Modify | `packages/api/src/client.ts` | Add `me()`, `csrfToken()`, `chat.send()` methods |
| Create | `apps/web/src/app/api/csrf-token/route.ts` | GET endpoint returning CSRF token |
| Create | `apps/web/src/app/api/me/route.ts` | GET endpoint returning user profile |
| Create | `apps/web/src/app/api/records/labs/route.ts` | GET endpoint returning lab results by careProfileId |

---

## Chunk 1: Visual Fixes (Tasks 1-3)

### Task 1: Fix dark background gradient bleed

**Files:**
- Modify: `apps/mobile/src/theme.ts:87-88` (dark gradientA/B) and `:96-97` (dark muted)

The dark gradients have `rgba(99,102,241,0.08)` and `rgba(167,139,250,0.12)` stops that create a purple wash. Replace with solid dark colors.

- [ ] **Step 1: Fix dark gradientA and gradientB**

In `apps/mobile/src/theme.ts`, replace the gradient definitions:

```typescript
// Line 87-88: Replace purple-tinted stops with solid dark
gradientA: ['#0C0E1A', '#0E1025', '#0E1025', '#0C0E1A'],
gradientB: ['#0E1025', '#0C0E1A', '#0C0E1A', '#0E1025'],
```

- [ ] **Step 2: Fix dark muted gradients**

```typescript
// Line 96-97: Same fix for muted variants
gradientAMuted: ['#0C0E1A', '#0E1025', '#0E1025', '#0C0E1A'],
gradientBMuted: ['#0E1025', '#0C0E1A', '#0C0E1A', '#0E1025'],
```

- [ ] **Step 3: Verify on simulator**

Run: `cd apps/mobile && npx expo start --ios`
Expected: Home and Settings screens have solid dark backgrounds, no white/purple wash at bottom.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/theme.ts
git commit -m "fix(mobile): remove gradient bleed from dark theme backgrounds"
```

---

### Task 2: Replace emoji tab icons with Ionicons

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx:1-2` (imports), `:21-27` (TABS array), `:29-68` (TabIcon component), `:242` (iconText style)

- [ ] **Step 1: Add Ionicons import**

At top of `apps/mobile/app/(tabs)/_layout.tsx`, add:

```typescript
import { Ionicons } from '@expo/vector-icons'
```

- [ ] **Step 2: Update TABS array with icon names**

Replace the TABS array (lines 21-27):

```typescript
const TABS = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'chat', label: 'Chat', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'care', label: 'Care', icon: 'heart-outline', iconActive: 'heart' },
  { name: 'scan', label: 'Scan', icon: 'scan-outline', iconActive: 'scan' },
  { name: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
]
```

- [ ] **Step 3: Update TabIcon component to render Ionicons**

Update the TabIcon function signature and replace the `<Text>` (lines 29, 63-65) with:

```typescript
function TabIcon({ icon, iconActive, active }: { icon: string; iconActive: string; active: boolean }) {
  // ... keep existing animation code ...
  return (
    <Animated.View style={[animStyle, styles.iconWrapper, active && { /* keep existing glow shadow */ }]}>
      <Ionicons
        name={(active ? iconActive : icon) as any}
        size={22}
        color={active ? theme.accent : theme.textMuted}
      />
    </Animated.View>
  )
}
```

Update the render call at line 160 to pass both icon props:

```typescript
<TabIcon icon={tab.icon} iconActive={tab.iconActive} active={active} />
```

- [ ] **Step 4: Remove old iconText style**

Delete line 242: `iconText: { fontSize: 18 },` — no longer needed.

- [ ] **Step 5: Verify on simulator**

Expected: Tab bar shows native iOS-style icons. Home = house, Chat = speech bubble, Care = heart, Scan = viewfinder, Settings = gear. Active icons are filled, inactive are outlined.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx
git commit -m "fix(mobile): replace emoji tab icons with Ionicons"
```

---

### Task 3: Reduce card border prominence

**Files:**
- Modify: `apps/mobile/src/theme.ts:66` (dark bgCardBorder), `:78` (dark borderHover), `:104` (light bgCardBorder), `:116` (light borderHover)

- [ ] **Step 1: Lower dark theme border opacity**

```typescript
// Line 66: 0.12 -> 0.06
bgCardBorder: 'rgba(167,139,250,0.06)',
// Line 78: 0.18 -> 0.10
borderHover: 'rgba(167,139,250,0.10)',
```

- [ ] **Step 2: Lower light theme border opacity**

```typescript
// Line 104: 0.12 -> 0.06
bgCardBorder: 'rgba(99,102,241,0.06)',
// Line 116: 0.20 -> 0.12
borderHover: 'rgba(99,102,241,0.12)',
```

- [ ] **Step 3: Verify on simulator**

Expected: GlassCards on all screens have subtle, barely-visible borders. Press interaction still shows a slight border increase.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/theme.ts
git commit -m "fix(mobile): reduce card border opacity for subtler glass effect"
```

---

## Chunk 2: Fix Chat API (Task 4) — 3 Stacked Bugs

### Task 4a: Add GET /api/csrf-token endpoint

**Files:**
- Create: `apps/web/src/app/api/csrf-token/route.ts`

The CSRF system works by matching a cookie value against a header value. Mobile needs an endpoint to get the token.

- [ ] **Step 1: Create the endpoint**

Create `apps/web/src/app/api/csrf-token/route.ts`:

```typescript
import { ensureCsrfToken } from '@/lib/csrf'
import { NextResponse } from 'next/server'

export async function GET() {
  const token = await ensureCsrfToken()
  return NextResponse.json({ csrfToken: token })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/csrf-token/route.ts
git commit -m "feat(api): add GET /api/csrf-token endpoint for mobile CSRF"
```

---

### Task 4b: Add GET /api/me endpoint

**Files:**
- Create: `apps/web/src/app/api/me/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `apps/web/src/app/api/me/route.ts`:

```typescript
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { careProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  // Look up care profile
  const [profile] = await db.select().from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1)

  return NextResponse.json({
    userId: dbUser!.id,
    email: dbUser!.email,
    displayName: dbUser!.displayName ?? dbUser!.email?.split('@')[0] ?? '',
    careProfileId: profile?.id ?? null,
    patientName: profile?.patientName ?? null,
    emergencyContactName: profile?.emergencyContactName ?? null,
    emergencyContactPhone: profile?.emergencyContactPhone ?? null,
    cancerType: profile?.cancerType ?? null,
    cancerStage: profile?.cancerStage ?? null,
    treatmentPhase: profile?.treatmentPhase ?? null,
    allergies: profile?.allergies ?? null,
    conditions: profile?.conditions ?? null,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/me/route.ts
git commit -m "feat(api): add GET /api/me endpoint for mobile profile context"
```

---

### Task 4b2: Add GET /api/records/labs endpoint

**Files:**
- Create: `apps/web/src/app/api/records/labs/route.ts`

This route does not exist yet. The client needs it for the Care tab labs view.

- [ ] **Step 1: Create the endpoint**

Create `apps/web/src/app/api/records/labs/route.ts`:

```typescript
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { labResults, careProfiles } from '@/lib/db/schema'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const cpId = req.nextUrl.searchParams.get('care_profile_id')
  if (!cpId) return NextResponse.json({ error: 'care_profile_id required' }, { status: 400 })

  // Verify ownership
  const [profile] = await db.select().from(careProfiles)
    .where(and(eq(careProfiles.id, cpId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1)
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const labs = await db.select().from(labResults)
    .where(and(eq(labResults.careProfileId, cpId), isNull(labResults.deletedAt)))
    .orderBy(desc(labResults.dateTaken))
    .limit(50)

  return NextResponse.json({ labs })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/records/labs/route.ts
git commit -m "feat(api): add GET /api/records/labs endpoint for mobile care tab"
```

---

### Task 4c: Add chat.send() and me() to API client

**Files:**
- Modify: `packages/api/src/client.ts`

- [ ] **Step 1: Add me(), csrfToken(), and chat methods**

Insert between line 66 (closing `auth` brace) and line 67 (closing return brace) in `packages/api/src/client.ts`, inside the returned object:

```typescript
    me: () =>
      apiFetch(config, '/api/me', { method: 'GET' }) as Promise<{
        userId: string
        email: string
        displayName: string
        careProfileId: string | null
        patientName: string | null
        emergencyContactName: string | null
        emergencyContactPhone: string | null
        cancerType: string | null
        cancerStage: string | null
        treatmentPhase: string | null
        allergies: string | null
        conditions: string | null
      }>,
    csrfToken: () =>
      apiFetch(config, '/api/csrf-token', { method: 'GET' }) as Promise<{ csrfToken: string }>,
    chat: {
      send: async (
        messages: Array<{ role: 'user' | 'assistant'; content: string }>,
        csrfToken: string,
      ) => {
        // Convert flat messages to AI SDK UIMessage format with .parts
        const uiMessages = messages.map((m, i) => ({
          id: String(i),
          role: m.role,
          parts: [{ type: 'text' as const, text: m.content }],
          createdAt: new Date(),
        }))

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        }

        if (config.getToken) {
          const token = await config.getToken()
          if (token) {
            const isSecure = config.baseUrl.startsWith('https://')
            const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
            headers['Cookie'] = `${cookieName}=${token}; cc-csrf-token=${csrfToken}`
          }
        }

        const res = await fetch(`${config.baseUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: uiMessages }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error ${res.status}: ${await res.text()}`)
        }

        // The chat route returns a streaming response. Read the full stream.
        const text = await res.text()
        // Parse the AI SDK stream format — extract text content
        const lines = text.split('\n').filter(Boolean)
        let content = ''
        for (const line of lines) {
          // AI SDK stream format: data lines with JSON payloads
          if (line.startsWith('0:')) {
            // Text delta format: 0:"text content"
            try {
              content += JSON.parse(line.slice(2))
            } catch {
              // skip non-JSON lines
            }
          }
        }
        return { content: content || null }
      },
    },
```

- [ ] **Step 2: Fix existing API paths (medications, labs, appointments)**

Replace the wrong paths (lines 39-51):

```typescript
    medications: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/medications?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<Medication[]>,
      create: (data: Partial<Medication>) =>
        apiFetch(config, '/api/records/medications', { method: 'POST', body: JSON.stringify(data) }) as Promise<Medication>,
    },
    labResults: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/labs?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<LabResult[]>,
    },
    appointments: {
      list: (careProfileId: string) =>
        apiFetch(config, `/api/records/appointments?care_profile_id=${careProfileId}`, { method: 'GET' }) as Promise<Appointment[]>,
    },
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/client.ts
git commit -m "feat(api-client): add me(), csrfToken(), chat.send() + fix API paths"
```

---

### Task 4d: Rewrite chat.tsx to use API client

**Files:**
- Modify: `apps/mobile/app/(tabs)/chat.tsx`

- [ ] **Step 1: Replace the send() function**

Remove the direct `fetch` call (lines 193-232) and replace with:

```typescript
import { createApiClient } from '@carecompanion/api'

// At module level (replace line 30):
const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})

// Replace the send() function:
async function send() {
  if (!input.trim() || loading) return
  const msg: Message = { id: Date.now().toString(), role: 'user', content: input }
  const next = [...messages, msg]
  setMessages(next)
  setInput('')
  setLoading(true)

  try {
    // Fetch CSRF token if we don't have one
    if (!csrfTokenRef.current) {
      const { csrfToken } = await apiClient.csrfToken()
      csrfTokenRef.current = csrfToken
    }

    const result = await apiClient.chat.send(
      next.map(({ role, content }) => ({ role, content })),
      csrfTokenRef.current,
    )
    const reply: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: result.content ?? 'Sorry, try again.',
    }
    setMessages((prev) => [...prev, reply])
    hapticAIMessage()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    // If CSRF failed, clear token so next send re-fetches
    csrfTokenRef.current = null
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' },
    ])
  } finally {
    setLoading(false)
  }
}
```

Add `csrfTokenRef` to the component:

```typescript
const csrfTokenRef = useRef<string | null>(null)
```

- [ ] **Step 2: Remove old API_BASE and direct fetch imports**

Remove line 30 (`const API_BASE = ...`) and the unused `fetch` — it's now handled by the API client.

- [ ] **Step 3: Also fix the default URL**

Ensure `EXPO_PUBLIC_API_BASE_URL` defaults to `https://carecompanionai.org`, not `https://carecompanion.app`.

- [ ] **Step 4: Verify chat works**

Run the app, send "Hi" in chat.
Expected: Receive a real AI response instead of "Sorry, try again."

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/chat.tsx
git commit -m "fix(mobile): route chat through API client — fixes cookie, CSRF, message format"
```

---

## Chunk 3: Fix Scan Camera (Task 5)

### Task 5: Replace fake scan animation with expo-image-picker

**Files:**
- Modify: `apps/mobile/app/(tabs)/scan.tsx`

Using `expo-image-picker` instead of `expo-camera` because it's simpler (no permission UI to build), already bundled with Expo, and lets users pick from camera OR photo library.

- [ ] **Step 1: Install expo-image-picker if not present**

```bash
cd apps/mobile && npx expo install expo-image-picker
```

- [ ] **Step 2: Replace the startScan function**

Replace the `startScan()` function (lines 43-64) with:

```typescript
import * as ImagePicker from 'expo-image-picker'

async function startScan() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert(
      'Camera Access Needed',
      'CareCompanion needs camera access to scan documents. You can enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    )
    return
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
  })

  if (!result.canceled && result.assets[0]) {
    // Store captured image URI — upload pipeline built in Phase 2
    setCapturedImage(result.assets[0].uri)
    hapticScanComplete()
    setBurstActive(true)
  }
}
```

Add state and update imports. Replace the existing react-native import (line 3) with:

```typescript
import { View, Text, StyleSheet, Dimensions, Image, Alert, Linking } from 'react-native'
```

Add at top of component:

```typescript
const [capturedImage, setCapturedImage] = useState<string | null>(null)
```

- [ ] **Step 3: Update the UI to show captured image**

After the scan viewport, add a preview if an image was captured:

```typescript
{capturedImage && (
  <GlassCard style={{ marginTop: 16, padding: 12 }}>
    <Image source={{ uri: capturedImage }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
    <Text style={{ color: theme.textSub, textAlign: 'center', marginTop: 8 }}>
      Document captured. Upload coming soon.
    </Text>
  </GlassCard>
)}
```

Add `Image` to the react-native imports.

- [ ] **Step 4: Remove laser animation code**

Remove the `laserY`, `laserOpacity` shared values and the `laserStyle` animated style (lines 36-69). Remove the laser `<Animated.View>` from the JSX. Keep the viewport container for visual consistency but remove the scanning animation.

- [ ] **Step 5: Verify on simulator/device**

Tap "Open Camera" — should launch the device camera (or prompt for permission). Take a photo — should show preview in a GlassCard.

Note: Camera doesn't work on iOS Simulator. Test on a real device or use the photo library fallback.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(tabs)/scan.tsx apps/mobile/package.json
git commit -m "fix(mobile): replace fake scan animation with real camera via expo-image-picker"
```

---

## Phase 0 Complete Checklist

After all 5 tasks:
- [ ] Dark backgrounds are solid dark (no white/purple bleed)
- [ ] Tab bar shows native Ionicons (not emoji)
- [ ] Card borders are subtle (0.06 opacity)
- [ ] Chat sends messages and receives AI responses
- [ ] Scan opens the real device camera
- [ ] All changes committed

**Next:** Phase 1 (Wire Real Data) — separate plan document. Requires the `/api/me` and `/api/csrf-token` endpoints from this phase to be deployed to production first.
