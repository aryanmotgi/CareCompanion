# Mobile Performance Audit — CareCompanion
_Audited: 2026-05-22 · Branch: aryan/dev_

---

## Summary Table

| # | Issue | File:Line | Impact | Patch | Estimated Win |
|---|-------|-----------|--------|-------|---------------|
| 1 | Hermes not explicitly declared; inline-requires disabled | `metro.config.js` + `app.json` | Cold TTI +200–400 ms on low-end Android; JS parse overhead on every launch | Enable `jsEngine: "hermes"` in `app.json` and add `transformer.getTransformOptions` with `inlineRequires: true` in metro.config.js | ~200–400 ms TTI on Android |
| 2 | 5 serial/independent AsyncStorage reads at startup | `app/_layout.tsx:163,221,266,295,337` | Each read is a native async round-trip; they fire in separate `useEffect` calls so they serialize behind React's commit cycle, gating AuthGate from settling | Merge into one `Promise.all([AsyncStorage.multiGet([...]), SecureStore.getItemAsync(...)])` call in a single provider; derive all 5 states from the batch result | ~40–80 ms startup (removes 4 extra native bridge round-trips) |
| 3 | `initSentry()` runs synchronously at module-load time | `app/_layout.tsx:6` | Sentry init hooks into native crash reporter — heavyweight synchronous work on the JS thread before any component mounts, delaying first render | Move to `useEffect(() => { initSentry() }, [])` inside `RootLayout`, or wrap in `InteractionManager.runAfterInteractions` | ~20–60 ms first render |
| 4 | `apiClient` instantiated at module-load in ProfileContext | `src/context/ProfileContext.tsx:24` | `createApiClient` runs synchronously on every import of the module, holding the JS thread during bundle evaluation | Lazy-init inside `ProfileProvider` with `useRef` (`const client = useRef(createApiClient(...))`) | ~5–15 ms bundle eval |
| 5 | `OnboardingGate` re-reads `AsyncStorage` on every segment change | `app/_layout.tsx:497–501` | `useEffect(..., [segments])` fires on every navigation, triggering a native AsyncStorage call and a render cycle on each route change | Read once on mount (`[]` dep array); the value is written through `SETUP_SKIPPED_KEY` and the component already re-renders when `profile` changes | ~10–25 ms per navigation |
| 6 | 4 × `FlatList` — conversation list and message bubbles need FlashList | `app/(tabs)/chat.tsx:746,816,872,922` | `FlatList` does not virtualize off-screen items efficiently; conversation list (line 816) and message bubbles (line 872) can exceed 50 items and have complex item renders | Install `@shopify/flash-list`; replace the two heavy lists (`conversationList` at line 816 and `messageList` at line 872) with `<FlashList estimatedItemSize={72} />`. Leave intro-chips (line 746) and suggestion chips (line 922) as-is (<10 items each) | ~30–60% scroll jank reduction; 50–120 ms faster list render on first open |
| 7 | `expo-image` not installed; `<Image>` in scan.tsx has no disk cache | `app/(tabs)/scan.tsx:159` + `package.json` | React Native's built-in `<Image>` has no disk-cache policy; captured document image re-decodes on every render and evicts from memory cache aggressively | `expo install expo-image`; replace `import { Image } from 'react-native'` with `import { Image } from 'expo-image'`; add `cachePolicy="disk"` prop | Eliminates re-decode flicker on scan review; ~5–10 ms per render |
| 8 | Inline arrow functions in FlatList `renderItem` / event props | `app/(tabs)/chat.tsx:820,821,822,877,899,905` | New function references on every parent render defeat React's bailout for `PureComponent` / `memo`; `ItemSeparatorComponent` creates a new component type each render, causing full remount of all separators | Extract `renderConversationItem`, `renderMessageItem`, `ConversationSeparator` to `useCallback` / stable references outside the render method; memoize `onContentSizeChange` and `onScroll` handlers | Eliminates full separator remount on each message; reduces re-renders in conversation list by ~60% |
| 9 | Inline style object in `AuthGate` loading overlay | `app/_layout.tsx:473–484` | `style={{ position:'absolute', ... }}` creates a new object reference on every render of `AuthGate`, which re-renders frequently (every navigation segment change) | Hoist to `StyleSheet.create` or a module-level constant outside the component | Negligible allocation savings; prevents subtle layout recalculation churn during auth transitions |
| 10 | `@expo/vector-icons` loaded eagerly; entire icon font parsed at startup | `package.json` — consumed in multiple screens | `@expo/vector-icons` bundles all icon families (MaterialIcons, Ionicons, etc.) into the main JS bundle. Each family is ~100–300 KB of glyph data evaluated synchronously | Lazy-import per-screen with `React.lazy` / dynamic `import()` for screens that use icons, or switch to `lucide-react-native` (tree-shakeable, no font file) for new icon usage | ~100–300 ms parse time reduction on cold launch |
| 11 | No RAM bundle / hermes bytecode precompilation declared | `metro.config.js` | Without `"bundleType": "ram"` or Hermes bytecode output, the full JS bundle is parsed on every cold launch rather than lazily per-require | For EAS builds: set `"jsEngine": "hermes"` in `app.json` (see #1); EAS automatically produces `.hbc` bundles. For OTA: add `"updates": { "useClassicUpdates": false }` and ensure `expo-updates` ≥ 0.27 (already satisfied) | Combined with #1: 100–300 ms cold launch on Android |
| 12 | `refreshTokenIfNeeded()` called eagerly on every app mount | `app/_layout.tsx:607–609` | Token refresh fires immediately on cold launch, competing with the AuthGate storage reads and ProfileContext network fetch for the JS thread and network stack | Defer with `setTimeout(() => refreshTokenIfNeeded(), 3000)` or trigger from `AppState` change to active after the first render has settled | ~10–30 ms contention on startup network queue |

---

## Detailed Patches

### 1 — Hermes + Inline Requires

**`app.json`** — inside `"ios"` and `"android"` blocks add:
```json
"jsEngine": "hermes"
```

**`metro.config.js`** — add transformer config:
```js
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};
```

> Note: `inlineRequires` defers module evaluation until first use. Verify no circular-import crashes in `_layout.tsx` after enabling — the `initSentry()` module-level call (issue #3) must be fixed first.

---

### 2 — Batch Startup Storage Reads

Replace the 5 individual providers' `useEffect` storage reads with a single batched read. Create a `BootstrapProvider` that reads all keys in one `Promise.all` and distributes state downward:

```ts
// One native round-trip instead of 5
const [[welcome, records, userType, caregiverJoined], token] = await Promise.all([
  AsyncStorage.multiGet([WELCOME_SEEN_KEY, RECORDS_KEY, USER_TYPE_KEY, CAREGIVER_JOINED_KEY]),
  SecureStore.getItemAsync('cc-session-token'),
])
```

Each existing context still exposes the same `useWelcomeContext`, `useTokenContext`, etc. API — only the read path is batched. Write paths (`markSeen`, `markSignedIn`, etc.) remain individual.

---

### 3 — Defer Sentry Init

**`app/_layout.tsx:6`** — move `initSentry()` off module load:
```ts
// Remove: initSentry()  ← line 6

// Inside RootLayout:
useEffect(() => {
  initSentry()
}, [])
```

---

### 4 — Lazy apiClient in ProfileContext

**`src/context/ProfileContext.tsx:24`**:
```ts
// Remove module-level: const apiClient = createApiClient(...)

// Inside ProfileProvider:
const apiClientRef = useRef<ReturnType<typeof createApiClient> | null>(null)
if (!apiClientRef.current) {
  apiClientRef.current = createApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
    getToken: () => store.getItem('cc-session-token'),
  })
}
const apiClient = apiClientRef.current
```

---

### 5 — Fix OnboardingGate Re-read

**`app/_layout.tsx:497–501`** — change dep array:
```ts
// Before:
}, [segments])

// After:
}, [])   // read once on mount; profile changes already re-trigger the second effect
```

---

### 6 — FlashList Migration (conversation + message lists)

```bash
npx expo install @shopify/flash-list
```

**`app/(tabs)/chat.tsx:816`** — conversation list:
```tsx
import { FlashList } from '@shopify/flash-list'

// Replace <FlatList ... > with:
<FlashList
  data={conversations}
  estimatedItemSize={72}
  renderItem={renderConversationItem}   // extracted useCallback (see #8)
  ItemSeparatorComponent={ConversationSeparator}
  keyExtractor={(item) => item.id}
/>
```

**`app/(tabs)/chat.tsx:872`** — message bubbles:
```tsx
<FlashList
  ref={listRef}
  data={messages}
  estimatedItemSize={80}
  renderItem={renderMessageItem}        // extracted useCallback (see #8)
  keyExtractor={(item) => item.id}
  onContentSizeChange={handleContentSizeChange}
  onScroll={handleScroll}
/>
```

---

### 7 — expo-image in scan.tsx

```bash
npx expo install expo-image
```

**`app/(tabs)/scan.tsx`**:
```tsx
// Before:
import { Image } from 'react-native'
// ...
<Image source={{ uri: capturedImage }} style={styles.capturedImage} />

// After:
import { Image } from 'expo-image'
// ...
<Image source={{ uri: capturedImage }} style={styles.capturedImage} cachePolicy="disk" />
```

---

### 8 — Stable renderItem References

**`app/(tabs)/chat.tsx`** — extract memoized callbacks:
```tsx
const renderConversationItem = useCallback(({ item }: { item: Conversation }) => (
  <ConversationRow
    convo={item}
    onPress={() => openConversation(item.id)}
    onDelete={() => deleteConversation(item.id)}
  />
), [openConversation, deleteConversation])

const ConversationSeparator = useCallback(() => (
  <View style={[styles.separator, { backgroundColor: theme.border }]} />
), [theme.border])

const renderMessageItem = useCallback(({ item }: { item: Message }) => (
  <MessageBubble message={item} onRetry={handleRetry} />
), [handleRetry])

const handleContentSizeChange = useCallback(() => {
  listRef.current?.scrollToEnd({ animated: true })
}, [])

const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
  const distFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
  setShowScrollFab(distFromBottom > 240)
}, [])
```

---

### 9 — Hoist AuthGate Loading Overlay Style

**`app/_layout.tsx`** — add to module level:
```ts
const loadingOverlayBase: ViewStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
}
```

Inside `AuthGate`:
```tsx
<View pointerEvents="auto" style={[loadingOverlayBase, { backgroundColor: theme.bg }]}>
```

---

### 10 — Lazy Vector Icons / Switch to Lucide

For any new icon usage, prefer `lucide-react-native` (tree-shakeable):
```bash
npm install lucide-react-native
```

For existing `@expo/vector-icons` calls in non-startup screens, wrap the import:
```ts
// Instead of top-level import:
const { Ionicons } = await import('@expo/vector-icons')
```
Or use `React.lazy` with a small icon wrapper component per screen.

---

### 11 — EAS / Hermes Bytecode

No code change needed beyond #1. Once `"jsEngine": "hermes"` is set, EAS Build automatically compiles the bundle to Hermes bytecode (`.hbc`) — the JS engine skips parsing on cold launch and executes bytecode directly.

Confirm in EAS build logs: look for `"Bundling with Hermes"` and `.hbc` output.

---

### 12 — Defer Token Refresh

**`app/_layout.tsx:607–609`**:
```ts
// Before:
useEffect(() => {
  void refreshTokenIfNeeded()
}, [])

// After:
useEffect(() => {
  const t = setTimeout(() => refreshTokenIfNeeded(), 2500)
  return () => clearTimeout(t)
}, [])
```

---

## Priority Order

| Priority | Issues | Reason |
|----------|--------|--------|
| P0 (do now) | #1, #3, #11 | Hermes + bytecode is a build-config change with no risk; largest cold-launch win |
| P1 (this sprint) | #2, #5, #6, #8 | Startup serialization + FlashList have largest UX impact for chat-heavy users |
| P2 (next sprint) | #7, #12 | expo-image is an install + swap; deferred refresh is low-risk cleanup |
| P3 (backlog) | #4, #9, #10 | Correctness/minor allocation wins; worth doing but not urgent |

---

## Notes
- All changes in this audit are **Shreyash's domain** (`apps/mobile/`). Patches are documented here per REPO RULES — no source files have been modified.
- FlashList (#6) requires a native rebuild (`expo run:ios`) after `expo install`.
- expo-image (#7) requires a native rebuild as it ships a native module.
- Run `npm run typecheck && npm run lint && npm run test:run && npm run deadcode` before pushing any of these patches.
