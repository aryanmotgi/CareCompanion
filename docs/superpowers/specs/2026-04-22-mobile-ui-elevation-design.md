# Mobile UI Elevation — Web Parity + Native Flourishes

**Date:** 2026-04-22
**Status:** Approved
**Scope:** Visual and interaction upgrades to the React Native mobile app to match the web design language and add mobile-native flourishes

## Context

The CareCompanion web app has a rich design language — glass effects, glow shadows, spectrum accent colors, noise textures, animated gradient borders, entrance animations, ripple buttons, shimmer loading. The mobile app uses some of these (glass cards, gradient backgrounds, gyroscope parallax) but falls short of full parity. This spec brings mobile to full visual parity and adds flourishes only native apps can do.

**Performance strategy:** Max visual fidelity with `useReducedMotion()` from `react-native-reanimated` as automatic fallback. Every effect degrades gracefully — no animation runs when reduce motion is on. Haptics remain (accessibility-friendly). Static visual effects (glows, noise texture) stay. Follow the existing pattern in the codebase: each component calls `useReducedMotion()` and guards its own animations.

## Section 1: Glow & Color System

### Theme Additions (`src/theme.ts`)

Add spectrum colors to both light and dark theme objects:

```
cyan:     dark '#67E8F9' / light '#06B6D4'
violet:   dark '#C4B5FD' / light '#7C3AED'
emerald:  dark '#6EE7B7' / light '#059669'
```

Add glow shadow presets to the Theme interface:

```ts
interface GlowShadow {
  shadowColor: string
  shadowOffset: { width: 0; height: 0 }
  shadowRadius: number
  shadowOpacity: number
  elevation: number
}
```

```
shadowGlowBlue:    { shadowColor: '#6366F1', shadowRadius: 16, shadowOpacity: 0.4, elevation: 8 }
shadowGlowCyan:    { shadowColor: '#67E8F9', shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 }
shadowGlowViolet:  { shadowColor: '#A78BFA', shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 }
shadowGlowEmerald: { shadowColor: '#6EE7B7', shadowRadius: 16, shadowOpacity: 0.3, elevation: 8 }
shadowGlowRose:    { shadowColor: '#FCA5A5', shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 }
```

### Contextual Glow Usage

| Element | Glow Color | Where |
|---------|-----------|-------|
| Lab data values | Cyan | Care screen lab cards |
| "Taken" checkmark | Emerald | Care screen med rows |
| Abnormal lab results | Rose | Care screen lab cards |
| Active tab icon | Indigo (pulsing) | Tab bar |
| AI companion card | Violet | Home screen CTA |
| Chat send button | Violet | Chat screen |
| CTA buttons (Sign In, Open Camera) | Indigo | Login, Scan screens |

### Fallback

Glow shadows are static shadow properties — zero GPU cost. Pulse animations stop on `reduceMotion`. Static glows remain.

## Section 2: Entrance Animations — Every Screen

### New Hook: `useStaggerEntrance(count: number, options?)`

Located at `src/hooks/useStaggerEntrance.ts`.

Returns an array of `count` animated styles (from `useAnimatedStyle`). Each element fades in (opacity 0→1) and slides up (translateY 20→0) with spring physics, staggered by a configurable delay (default 100ms).

Internally calls `useReducedMotion()` — if true, returns styles at final values immediately.

```ts
interface StaggerOptions {
  delay?: number       // ms between each item, default 100
  initialDelay?: number // ms before first item, default 0
  damping?: number     // spring damping, default 14
  stiffness?: number   // spring stiffness, default 150
}

// Returns: AnimatedStyleProp[] of length `count`
function useStaggerEntrance(count: number, options?: StaggerOptions): AnimatedStyleProp[]
```

### Per-Screen Application

| Screen | Elements to stagger |
|--------|-------------------|
| Home | Already has stagger — keep as-is |
| Care | Header, segment control, then each med/lab card |
| Scan | Title, subtitle, viewport, button |
| Settings | Profile card, appearance section, sign-out card |
| Chat | Header fades in, empty state scales in with spring |
| Login/Signup | Already has stagger — keep as-is |

### Tab Transition

Wrap each tab screen content in an `Animated.View` with a fade-in on focus using `useFocusEffect`. When a tab gains focus, opacity springs from 0.6→1.0 over ~200ms. This avoids the complexity of overriding expo-router's internal navigator animation while still eliminating the hard cut.

### Fallback

`reduceMotion` → all styles return `{ opacity: 1, transform: [{ translateY: 0 }] }` immediately. No animation, no delay. Tab focus fade skipped (instant opacity 1).

## Section 3: Press Feedback & Micro-interactions

### New Component: `RippleButton`

Located at `src/components/RippleButton.tsx`.

Replaces bare `Pressable + LinearGradient` for all primary CTA buttons. On press:

1. Expanding circle from touch point coordinates (`nativeEvent.locationX/Y` from `onPressIn`), indigo at 0.3 opacity → transparent, animated with `withTiming` over 400ms
2. Button scale springs to 0.97, returns to 1.0 on release
3. Haptic `ImpactFeedbackStyle.Light`

**Implementation note:** The ripple circle renders inside an `overflow: 'hidden'` inner container. The glow shadow is applied on an outer wrapper `View` (not clipped). This avoids the iOS shadow clipping conflict.

Used on: Sign In, Create Account, Open Camera, Send (chat).

### GlassCard Press Upgrade

GlassCard already animates border color from `theme.bgCardBorder` → `theme.borderHover` on press via `interpolateColor`. **This stays as-is.**

Only addition: haptic `ImpactFeedbackStyle.Soft` on press in `onPressIn`.

### Medication "Take" Enhancement

On take:
- Checkmark: scale 0→1.2→1.0 with overshoot spring (`damping: 8, stiffness: 300`)
- Check circle gets `theme.shadowGlowEmerald` glow shadow
- Row opacity fades to 0.5
- Existing haptic `success` stays

### Tab Bar Glow Dot

Add a 4px diameter circle centered below the icon, above the label. **Replaces** the existing background highlight (`backgroundColor: 'rgba(99,102,241,0.15)'`, `borderRadius: 10`). The bounce animation on the icon stays.

- Color: `theme.accent` (indigo)
- Opacity pulses 0.4→1.0→0.4 with `withRepeat(withTiming(..., { duration: 2000 }))`
- The icon still gets `shadowColor: '#6366F1'` glow (existing), keeping the lit-from-within look

### Chat Send Button

On press: scale spring + violet glow shadow pulse (shadowOpacity 0→0.5→0 over 300ms).

### Fallback

`reduceMotion` → no ripple expand animation (button still scales instantly), no glow pulses (static glow remains), haptics all remain.

## Section 4: Visual Richness

### Noise Texture Overlay

- Bundle a static 64×64 tileable noise PNG as `assets/noise-tile.png`
- New component `src/components/NoiseOverlay.tsx`: renders `Image` with `resizeMode="repeat"`, 0.02 opacity, `StyleSheet.absoluteFill`, `pointerEvents="none"`
- Applied in `app/(tabs)/_layout.tsx` wrapping the tab content — every tab screen gets it
- Layered: background → noise → content

### Animated Gradient Borders

For featured cards (Home: AI companion card, Next Appointment card):

**Technique:** Use `transform: [{ rotate }]` on the outer `LinearGradient` wrapper. The gradient itself is static (`colors: [accent, lavender, cyan, accent]`), and the entire gradient view rotates underneath the inner card. The inner card has `overflow: 'hidden'` and is inset by 1.5px, masking the rotating gradient except at the border edge.

- Shared value: `rotation` 0→360° over 8 seconds via `withRepeat(withTiming(...))`
- The gradient view is oversized (1.5x the card dimensions via `scale` transform) so the border remains visible throughout the rotation
- `useAnimatedStyle` drives `transform: [{ rotate: '${rotation}deg' }]` on the UI thread — no JS bridge overhead

### Gradient Mesh Extension

- Care screen: add `LinearGradient` background using `theme.gradientA` / `theme.gradientB` colors, but with alpha values halved (e.g., `rgba(99,102,241,0.08)` becomes `rgba(99,102,241,0.04)`)
- Settings screen: same halved-alpha gradient mesh
- A new `gradientAMuted` / `gradientBMuted` array is added to the theme for reuse
- Chat and Scan: keep solid `theme.bg`

### Shimmer Loading

- Home screen: show `ShimmerSkeleton` placeholders for medication/appointment cards during initial render (driven by a brief `useState(true)` → `setTimeout(false, 300)` to simulate load)
- Chat: the existing `TypingDots` component gets a shimmer sweep background — a `LinearGradient` behind the dots that translates left→right via `withRepeat(withTiming(..., 1200ms))`, 0.15 opacity

### Fallback

`reduceMotion` → noise texture stays (static image), gradient border rotation stops (static rotated position, border still visible), no shimmer sweep (solid placeholder color), gradient mesh stays (static).

## Section 5: Mobile-Native Flourishes

### Gyroscope Parallax Expansion

**New hook: `useGyroParallax(multiplier: number)`**

Located at `src/hooks/useGyroParallax.ts`. Extracted from Home screen's existing gyroscope logic.

```ts
interface GyroParallaxResult {
  parallaxStyle: AnimatedStyleProp  // { transform: [{ translateX }, { translateY }] }
}

function useGyroParallax(multiplier: number): GyroParallaxResult
```

Internally:
- Calls `useReducedMotion()` — if true, returns static `{ transform: [] }` and never subscribes to Gyroscope
- Uses `useFocusEffect` so the subscription is only active when the screen is focused
- Same CLAMP (15) / MAX_DISPLACEMENT (20) constants as current Home implementation

Apply to:

| Screen | Element | Multiplier |
|--------|---------|-----------|
| Home | Cards (existing, refactor to use hook) | 0.6x |
| Care | Med/lab cards wrapper | 0.3x |
| Scan | Corner brackets | 0.4x |
| Scan | Viewport container | 0.2x |
| Chat | Empty state sparkle | 0.5x |

### Haptic Choreography

Sync haptics to animation milestones:

| Event | Haptic | Timing |
|-------|--------|--------|
| Tab switch | `Impact.Light` | On bounce apex (existing `onPress`, keep) |
| Card entrance stagger | `Impact.Soft` | Via `runOnJS` callback when each card's spring settles (built into `useStaggerEntrance` as optional `onLand` callback) |
| Scan complete | Light → Medium → Success | Three `setTimeout` calls at 0ms, 150ms, 300ms after scan completes |
| Abnormal lab card enters | Double `Notification.Warning` | On card entrance, 100ms apart |

### Gesture-Driven Interactions

**Swipe-to-take medication:**

> **Note:** This is a UX enhancement beyond pure visual polish. It is included here as a stretch goal. Implement after all visual sections (1-4) are complete. If `react-native-gesture-handler` is not available as a direct dependency, add it (`npx expo install react-native-gesture-handler`). If gesture handler integration proves complex, fall back to the existing tap-to-take and skip this item.

- Horizontal `Gesture.Pan()` on med cards
- Swipe right reveals emerald "Take" confirmation zone behind the card
- Release past 40% of card width → commit take with haptic success
- Release before threshold → spring snap-back
- Visual: card `translateX` follows gesture, emerald background visible behind
- Keep existing tap-to-take as primary — swipe is additive, not a replacement

**Pull-to-refresh on Care screen:**

> **Note:** Also a stretch goal. Use React Native's built-in `RefreshControl` prop on ScrollView. Custom indicator: the heart icon from the app logo, scaled by pull distance. No custom gesture handler needed — this uses native `RefreshControl`.

### Spring Physics Tuning

New spring configs applied to **new animations only**. Existing animations keep their current tuned values (e.g., GlassCard press uses `damping: 20, stiffness: 300` — don't change it).

| Context | Damping | Stiffness | Feel | Used by |
|---------|---------|-----------|------|---------|
| Card entrances | 14 | 150 | Bouncy settle | `useStaggerEntrance` default |
| Button press/release | 18 | 200 | Snappy | `RippleButton` |
| Page elements | 16 | 120 | Smooth settle | Tab focus fade, gradient mesh |
| Instant (reduceMotion) | 100 | 500 | No bounce | All hooks when reduceMotion is true |

### Fallback

`reduceMotion` → no gyroscope subscription (`Gyroscope.addListener` skipped entirely), no haptic choreography (keep only explicit user-action haptics like tab press and med take), no swipe gesture (keep tap-to-take), springs become instant (`damping: 100, stiffness: 500`).

## New Files

| File | Purpose |
|------|---------|
| `src/hooks/useStaggerEntrance.ts` | Reusable staggered entrance animation hook |
| `src/hooks/useGyroParallax.ts` | Extracted gyroscope parallax hook |
| `src/components/RippleButton.tsx` | Button with expanding ripple + glow |
| `src/components/NoiseOverlay.tsx` | Tiling noise texture overlay |
| `assets/noise-tile.png` | 64x64 tileable noise texture (static asset) |

## Files Modified

| File | Changes |
|------|---------|
| `src/theme.ts` | Add spectrum colors, glow shadow presets, muted gradient arrays |
| `app/(tabs)/_layout.tsx` | Noise overlay, tab glow dot (replaces bg highlight), tab focus fade |
| `app/(tabs)/index.tsx` | Extract gyro to `useGyroParallax` hook, animated gradient border on AI CTA + appointment card |
| `app/(tabs)/care.tsx` | Entrance stagger, gyro parallax, glow on lab values/checkmarks, swipe-to-take (stretch) |
| `app/(tabs)/scan.tsx` | Entrance stagger, gyro parallax on brackets/viewport |
| `app/(tabs)/settings.tsx` | Entrance stagger, muted gradient mesh background |
| `app/(tabs)/chat.tsx` | Entrance animation, gyro on empty state, shimmer behind typing dots, send button glow |
| `src/components/GlassCard.tsx` | Add haptic on press (border animation already exists) |
| `app/login.tsx` | Replace button with RippleButton |
| `app/signup.tsx` | Replace button with RippleButton |

## Not Changing

- Auth flow, API calls, data layer, navigation structure, HealthKit service
- Existing animation logic that already works (Home card stagger, scan laser, typing dots)
- Existing spring configs on components that already feel good (GlassCard, MessageBubble)
- The Drawer component
