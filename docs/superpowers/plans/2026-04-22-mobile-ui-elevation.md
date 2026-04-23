# Mobile UI Elevation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the React Native mobile app to full visual parity with the web design language and add mobile-native flourishes (gyroscope parallax, haptic choreography, gesture interactions).

**Architecture:** Bottom-up — build foundation (theme, hooks, components) first, then integrate into screens. Each task is independently committable and the app remains functional after every commit.

**Tech Stack:** React Native 0.76, Expo 52, react-native-reanimated 3.16, expo-linear-gradient, expo-haptics, expo-sensors

**Spec:** `docs/superpowers/specs/2026-04-22-mobile-ui-elevation-design.md`

---

## Chunk 1: Foundation — Theme, Hooks, Components

### Task 1: Theme — Spectrum Colors, Glow Shadows, Muted Gradients

**Files:**
- Modify: `apps/mobile/src/theme.ts`

- [ ] **Step 1: Add spectrum colors and glow shadow type to Theme interface**

In `src/theme.ts`, add to the `Theme` interface after the existing `gradientB` field:

```ts
// Spectrum accent colors (matching web design tokens)
cyan: string
violet: string
// emerald already exists as 'green' — add alias
// Glow shadow presets
shadowGlowBlue: GlowShadow
shadowGlowCyan: GlowShadow
shadowGlowViolet: GlowShadow
shadowGlowEmerald: GlowShadow
shadowGlowRose: GlowShadow
// Muted gradient mesh (half-alpha for secondary screens)
gradientAMuted: string[]
gradientBMuted: string[]
```

Add the `GlowShadow` type above the `Theme` interface:

```ts
export interface GlowShadow {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowRadius: number
  shadowOpacity: number
  elevation: number
}
```

- [ ] **Step 2: Add values to dark theme object**

Add to the `dark` const:

```ts
cyan: '#67E8F9',
violet: '#C4B5FD',
shadowGlowBlue: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.4, elevation: 8 },
shadowGlowCyan: { shadowColor: '#67E8F9', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 },
shadowGlowViolet: { shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 },
shadowGlowEmerald: { shadowColor: '#6EE7B7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.3, elevation: 8 },
shadowGlowRose: { shadowColor: '#FCA5A5', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.35, elevation: 8 },
gradientAMuted: ['#0C0E1A', '#10122B', 'rgba(99,102,241,0.04)', '#0C0E1A'],
gradientBMuted: ['#10122B', '#0C0E1A', 'rgba(167,139,250,0.06)', '#10122B'],
```

- [ ] **Step 3: Add values to light theme object**

Add to the `light` const:

```ts
cyan: '#06B6D4',
violet: '#7C3AED',
shadowGlowBlue: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.25, elevation: 6 },
shadowGlowCyan: { shadowColor: '#06B6D4', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.2, elevation: 6 },
shadowGlowViolet: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.2, elevation: 6 },
shadowGlowEmerald: { shadowColor: '#059669', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.2, elevation: 6 },
shadowGlowRose: { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.2, elevation: 6 },
gradientAMuted: ['#FAFAFA', '#F5F3FF', 'rgba(99,102,241,0.02)', '#FAFAFA'],
gradientBMuted: ['#F5F3FF', '#FAFAFA', 'rgba(99,102,241,0.035)', '#F5F3FF'],
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/theme.ts
git commit -m "feat(mobile): add spectrum colors, glow shadows, muted gradients to theme"
```

---

### Task 2: useStaggerEntrance Hook

**Files:**
- Create: `apps/mobile/src/hooks/useStaggerEntrance.ts`

- [ ] **Step 1: Create hooks directory and write the hook**

Uses a single shared value array (not individual hooks in loops) to avoid React hooks rules violations. `count` must remain constant across renders.

```ts
// apps/mobile/src/hooks/useStaggerEntrance.ts
import { useEffect, useMemo } from 'react'
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  useReducedMotion,
} from 'react-native-reanimated'
import type { ViewStyle } from 'react-native'
import type Animated from 'react-native-reanimated'

interface StaggerOptions {
  delay?: number
  initialDelay?: number
  damping?: number
  stiffness?: number
}

/**
 * Returns a function that creates an animated style for the item at the given index.
 * Call `style(index)` in each component that needs a staggered entrance.
 *
 * `count` MUST be constant — changing it between renders will break.
 */
export function useStaggerEntrance(
  count: number,
  options?: StaggerOptions,
): { style: (index: number) => Animated.AnimateStyle<ViewStyle> } {
  const reduceMotion = useReducedMotion()
  const {
    delay = 100,
    initialDelay = 0,
    damping = 14,
    stiffness = 150,
  } = options ?? {}

  // Single shared value per dimension — stores all items as a flat concept
  // Each item's progress goes from 0 to 1
  const progress = useSharedValue<number[]>(
    Array.from({ length: count }, () => (reduceMotion ? 1 : 0)),
  )

  useEffect(() => {
    if (reduceMotion) return
    const next = [...progress.value]
    for (let i = 0; i < count; i++) {
      const d = initialDelay + i * delay
      setTimeout(() => {
        next[i] = 1
        progress.value = [...next]
      }, d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useMemo(
    () => (index: number) => ({
      opacity: reduceMotion ? 1 : (progress.value[index] ?? 1),
      transform: [{ translateY: reduceMotion ? 0 : ((1 - (progress.value[index] ?? 1)) * 20) }],
    }),
    [reduceMotion, progress],
  )

  return { style }
}
```

**Usage pattern (since we can't call useAnimatedStyle in a loop):**

Each screen wraps staggered elements in `Animated.View` and applies the style inline. The stagger drives opacity and translateY via the progress array. Because reanimated shared value changes trigger re-renders of `Animated.View`, the stagger animates correctly.

**Alternative simpler approach:** If the above shared-value-array pattern proves unreliable with reanimated, fall back to individual `useSharedValue` calls with a fixed max count (e.g., 8) and only use the first `count` of them. This is hooks-rules-safe because the call count is constant.
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useStaggerEntrance.ts
git commit -m "feat(mobile): add useStaggerEntrance animation hook"
```

---

### Task 3: useGyroParallax Hook

**Files:**
- Create: `apps/mobile/src/hooks/useGyroParallax.ts`

- [ ] **Step 1: Write the hook (extracted from Home screen)**

```ts
// apps/mobile/src/hooks/useGyroParallax.ts
import { useRef, useCallback } from 'react'
import {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated'
import { Gyroscope } from 'expo-sensors'
import { useFocusEffect } from 'expo-router'
import type { ViewStyle } from 'react-native'
import type Animated from 'react-native-reanimated'

const CLAMP = 15
const MAX_DISPLACEMENT = 20

export function useGyroParallax(
  multiplier: number,
): { parallaxStyle: Animated.AnimateStyle<ViewStyle> } {
  const reduceMotion = useReducedMotion()
  const gyroX = useSharedValue(0)
  const gyroY = useSharedValue(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return
      Gyroscope.setUpdateInterval(16)
      const sub = Gyroscope.addListener(({ x, y }) => {
        tiltRef.current.x = tiltRef.current.x * 0.85 + y * 0.15
        tiltRef.current.y = tiltRef.current.y * 0.85 + x * 0.15
        const cx = Math.max(-CLAMP, Math.min(CLAMP, tiltRef.current.x))
        const cy = Math.max(-CLAMP, Math.min(CLAMP, tiltRef.current.y))
        gyroX.value = (cx / CLAMP) * MAX_DISPLACEMENT * multiplier
        gyroY.value = (cy / CLAMP) * MAX_DISPLACEMENT * multiplier
      })
      return () => sub.remove()
    }, [reduceMotion, multiplier, gyroX, gyroY]),
  )

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gyroX.value }, { translateY: gyroY.value }],
  }))

  return { parallaxStyle }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useGyroParallax.ts
git commit -m "feat(mobile): add useGyroParallax hook extracted from Home screen"
```

---

### Task 4: NoiseOverlay Component

**Files:**
- Create: `apps/mobile/src/components/NoiseOverlay.tsx`
- Create: `apps/mobile/assets/noise-tile.png` (generate programmatically)

- [ ] **Step 1: Generate the noise tile PNG**

Run this Node script to create a 64x64 noise PNG:

```bash
cd apps/mobile && node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');
const c = createCanvas(64, 64);
const ctx = c.getContext('2d');
const img = ctx.createImageData(64, 64);
for (let i = 0; i < img.data.length; i += 4) {
  const v = Math.random() * 255;
  img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
}
ctx.putImageData(img, 0, 0);
fs.writeFileSync('assets/noise-tile.png', c.toBuffer('image/png'));
console.log('Created noise-tile.png');
"
```

If `canvas` is not available, manually create a 64x64 grayscale noise PNG using any tool and place it at `apps/mobile/assets/noise-tile.png`. Alternatively, use a base64-encoded inline source (see step 2 fallback).

- [ ] **Step 2: Write the NoiseOverlay component**

```tsx
// apps/mobile/src/components/NoiseOverlay.tsx
import React from 'react'
import { Image, StyleSheet } from 'react-native'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const noiseTile = require('../../assets/noise-tile.png')

export function NoiseOverlay() {
  return (
    <Image
      source={noiseTile}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFill, styles.noise]}
      pointerEvents="none"
    />
  )
}

const styles = StyleSheet.create({
  noise: { opacity: 0.02 },
})
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/NoiseOverlay.tsx apps/mobile/assets/noise-tile.png
git commit -m "feat(mobile): add NoiseOverlay component with tileable noise texture"
```

---

### Task 5: RippleButton Component

**Files:**
- Create: `apps/mobile/src/components/RippleButton.tsx`

- [ ] **Step 1: Write the RippleButton component**

```tsx
// apps/mobile/src/components/RippleButton.tsx
import React, { useState } from 'react'
import { Pressable, View, StyleSheet, GestureResponderEvent, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'

interface RippleButtonProps {
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  colors?: [string, string, ...string[]]
  style?: ViewStyle
}

export function RippleButton({ children, onPress, disabled, colors, style }: RippleButtonProps) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const rippleScale = useSharedValue(0)
  const rippleOpacity = useSharedValue(0)
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 })
  const gradientColors = colors ?? ['#6366F1', '#A78BFA'] as [string, string]

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }))

  function handlePressIn(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent
    setRipplePos({ x: locationX, y: locationY })
    scale.value = withSpring(0.97, { damping: 18, stiffness: 200 })
    if (!reduceMotion) {
      rippleScale.value = 0
      rippleOpacity.value = 0.3
      rippleScale.value = withTiming(4, { duration: 400 })
      rippleOpacity.value = withTiming(0, { duration: 400 })
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 18, stiffness: 200 })
  }

  return (
    <View style={[theme.shadowGlowBlue, style]}>
      <Animated.View style={scaleStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
        >
          <View style={styles.clipContainer}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradient, disabled && styles.disabled]}
            >
              {children}
            </LinearGradient>
            <Animated.View
              style={[
                styles.ripple,
                { left: ripplePos.x - 25, top: ripplePos.y - 25 },
                rippleStyle,
              ]}
              pointerEvents="none"
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  clipContainer: { borderRadius: 14, overflow: 'hidden' },
  gradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  ripple: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/RippleButton.tsx
git commit -m "feat(mobile): add RippleButton component with expanding ripple and glow"
```

---

### Task 6: GlassCard — Add Haptic on Press

**Files:**
- Modify: `apps/mobile/src/components/GlassCard.tsx`

- [ ] **Step 1: Add haptic import and call in onPressIn**

Add import at top of file:

```ts
import * as Haptics from 'expo-haptics'
```

In the `onPressIn` function (currently at line 34), add as the first line:

```ts
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/GlassCard.tsx
git commit -m "feat(mobile): add haptic feedback to GlassCard press"
```

---

## Chunk 2: Tab Bar & Layout Upgrades

### Task 7: Tab Bar — Glow Dot + Noise Overlay + Focus Fade

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports:

```ts
import { useReducedMotion } from 'react-native-reanimated'
import { NoiseOverlay } from '../../src/components/NoiseOverlay'
```

- [ ] **Step 2: Replace active tab background highlight with glow dot**

In the `TabIcon` component, replace the active styling block (lines 49-57):

```ts
active && {
  backgroundColor: 'rgba(99,102,241,0.15)',
  borderRadius: 10,
  shadowColor: '#6366F1',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 12,
  elevation: 8,
},
```

With just the glow shadow (remove the background, keep shadow):

```ts
active && {
  shadowColor: '#6366F1',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 12,
  elevation: 8,
},
```

Then add a `GlowDot` component below `TabIcon`:

```tsx
function GlowDot({ active }: { active: boolean }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(active ? 1 : 0)
  const pulse = useSharedValue(0.4)

  React.useEffect(() => {
    if (active) {
      opacity.value = withSpring(1, { damping: 16, stiffness: 120 })
      if (!reduceMotion) {
        pulse.value = withRepeat(
          withTiming(1, { duration: 2000 }),
          -1,
          true,
        )
      } else {
        pulse.value = 1
      }
    } else {
      opacity.value = withTiming(0, { duration: 150 })
    }
  }, [active, opacity, pulse, reduceMotion])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (0.4 + pulse.value * 0.6),
  }))

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.accent,
          marginTop: 3,
        },
        dotStyle,
      ]}
    />
  )
}
```

Add the required imports for `withRepeat` and `withTiming` to the existing reanimated import (they may already be there — add only what's missing).

- [ ] **Step 3: Render GlowDot in tab item**

In `CustomTabBar`, between `<TabIcon>` and the `<Text>` label (around line 114-125), add:

```tsx
<GlowDot active={active} />
```

And remove the existing `marginBottom: 2` from `iconWrapper` styles since the dot now provides spacing.

- [ ] **Step 4: Add NoiseOverlay to tab layout**

In the `TabLayout` component, wrap the `<Tabs>` in a `<View style={{ flex: 1 }}>` and add `<NoiseOverlay />` as a sibling:

```tsx
export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NoiseOverlay />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="care" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  )
}
```

- [ ] **Step 5: Add tab focus fade**

Create a wrapper component used in each tab screen to fade in on focus:

```tsx
// Add to _layout.tsx, exported for use by screens
export function TabFadeWrapper({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(reduceMotion ? 1 : 0.6)

  useFocusEffect(
    React.useCallback(() => {
      if (reduceMotion) return
      opacity.value = 0.6
      opacity.value = withSpring(1, { damping: 16, stiffness: 120 })
    }, [opacity, reduceMotion]),
  )

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={[{ flex: 1 }, fadeStyle]}>{children}</Animated.View>
}
```

Add `useFocusEffect` import from `expo-router`.

Then in each subsequent screen task (Tasks 8-12), wrap the screen's root content in `<TabFadeWrapper>`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): add tab glow dot, noise overlay, focus fade to tab layout"
```

---

## Chunk 3: Screen Upgrades — Home, Care, Scan

### Task 8: Home Screen — Extract Gyro Hook + Animated Gradient Border

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Replace inline gyroscope code with useGyroParallax hook**

Remove the imports `Gyroscope` from `expo-sensors` and `useCallback` from React.

Remove `useFocusEffect` import if no longer needed after this change.

Remove: the `cardGyroX`, `cardGyroY`, `tiltRef`, `useFocusEffect` gyroscope block (lines ~86-104), and `cardParallaxStyle` (lines ~106-108).

Replace with:

```ts
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
```

And in the component:

```ts
const { parallaxStyle: cardParallaxStyle } = useGyroParallax(0.6)
```

Also remove the now-unused `CLAMP` and `MAX_DISPLACEMENT` constants.

- [ ] **Step 2: Add animated gradient border component for featured cards**

Add a new component above `HomeScreen`:

```tsx
function AnimatedBorderCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: ViewStyle
}) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [rotation, reduceMotion])

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 1.5 }],
  }))

  return (
    <View style={[styles.borderCardOuter, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.borderCardGradientWrap, rotateStyle]}>
        <LinearGradient
          colors={[theme.accent, theme.lavender, theme.cyan ?? '#67E8F9', theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={[styles.borderCardInner, { backgroundColor: theme.isDark ? '#0C0E1A' : '#FAFAFA' }]}>
        <GlassCard style={{ marginBottom: 0 }}>{children}</GlassCard>
      </View>
    </View>
  )
}
```

Add styles:

```ts
borderCardOuter: { borderRadius: 15, overflow: 'hidden', marginBottom: 12 },
borderCardGradientWrap: { alignItems: 'center', justifyContent: 'center' },
borderCardInner: { margin: 1.5, borderRadius: 14, overflow: 'hidden' },
```

- [ ] **Step 3: Wrap the appointment card and AI CTA card with AnimatedBorderCard**

Replace the appointment card's `<GlassCard style={styles.card}>` with `<AnimatedBorderCard>` (and remove the `style={styles.card}` since the outer now handles margin).

Replace the AI CTA card's `<GlassCard onPress={...}>` with `<AnimatedBorderCard>` wrapping a `<Pressable>`.

- [ ] **Step 4: Add violet glow to AI CTA card**

Add `theme.shadowGlowViolet` to the AI CTA card's outer container style.

- [ ] **Step 5: Add shimmer loading placeholders**

Add `ShimmerSkeleton` import:

```ts
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
```

Add loading state:

```ts
const [loaded, setLoaded] = useState(false)

useEffect(() => {
  const t = setTimeout(() => setLoaded(true), 300)
  return () => clearTimeout(t)
}, [])
```

Before the medication card, render shimmer when `!loaded`:

```tsx
{!loaded ? (
  <Animated.View style={card1Style}>
    <GlassCard style={styles.card}>
      <ShimmerSkeleton width="60%" height={12} style={{ marginBottom: 12 }} />
      <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
      <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
      <ShimmerSkeleton width="80%" height={16} />
    </GlassCard>
  </Animated.View>
) : (
  // existing medication card
)}
```

Apply the same pattern for the appointment card with `card2Style`.

- [ ] **Step 6: Wrap in TabFadeWrapper**

Import `TabFadeWrapper` from the layout and wrap the screen's root `<View>`:

```tsx
import { TabFadeWrapper } from './_layout'
// In render:
<TabFadeWrapper>
  <View style={styles.root}>
    {/* ...existing content */}
  </View>
</TabFadeWrapper>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat(mobile): home — gyro hook, animated borders, glow, shimmer loading"
```

---

### Task 9: Care Screen — Stagger, Gyro, Glows, Enhanced Take

**Files:**
- Modify: `apps/mobile/app/(tabs)/care.tsx`

- [ ] **Step 1: Add imports**

```ts
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
```

- [ ] **Step 2: Add stagger entrance to CareScreen**

In `CareScreen`, add:

```ts
const stagger = useStaggerEntrance(3) // header, segment, card list
```

Wrap the header `<Text>` in `<Animated.View style={stagger[0]}>`, the segment control in `<Animated.View style={stagger[1]}>`, and the `<ScrollView>` in `<Animated.View style={[stagger[2], { flex: 1 }]}>`.

- [ ] **Step 3: Add gyroscope parallax to card list**

In `CareScreen`:

```ts
const { parallaxStyle } = useGyroParallax(0.3)
```

Wrap the ScrollView's content (the map of cards) in `<Animated.View style={parallaxStyle}>`.

- [ ] **Step 4: Add cyan glow to lab value text**

In `LabRow`, wrap the lab value `<Text>` in a `<View>` with `theme.shadowGlowCyan` when status is normal, `theme.shadowGlowRose` when abnormal, and no glow when borderline:

```ts
const glowStyle = lab.status === 'abnormal' ? theme.shadowGlowRose
  : lab.status === 'normal' ? theme.shadowGlowCyan
  : undefined
```

Apply `glowStyle` to the value text's parent `<View>`.

- [ ] **Step 5: Add emerald glow to taken checkmark**

In `MedRow`, when `taken` is true, add `theme.shadowGlowEmerald` to the `checkInner` view style.

- [ ] **Step 6: Enhance take animation**

In `MedRow`'s `handleTake`, change the checkmark scale animation to overshoot:

```ts
checkScale.value = withSpring(1, { damping: 8, stiffness: 300 })
```

(This is already `damping: 8, stiffness: 300` — verify and keep.)

- [ ] **Step 7: Wrap in TabFadeWrapper**

Import `TabFadeWrapper` from the layout and wrap the screen root.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/(tabs)/care.tsx
git commit -m "feat(mobile): care — stagger entrance, gyro parallax, contextual glows"
```

---

### Task 10: Scan Screen — Stagger, Gyro, Haptic Choreography

**Files:**
- Modify: `apps/mobile/app/(tabs)/scan.tsx`

- [ ] **Step 1: Add imports**

```ts
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
```

- [ ] **Step 2: Add stagger entrance**

In `ScanScreen`:

```ts
const stagger = useStaggerEntrance(4) // title, subtitle, viewport, button
```

Wrap the title in `<Animated.View style={stagger[0]}>`, subtitle in `<Animated.View style={stagger[1]}>`, viewport wrapper in `<Animated.View style={stagger[2]}>`, button wrapper in `<Animated.View style={stagger[3]}>`.

- [ ] **Step 3: Add gyroscope parallax**

```ts
const { parallaxStyle: bracketParallax } = useGyroParallax(0.4)
const { parallaxStyle: viewportParallax } = useGyroParallax(0.2)
```

Apply `bracketParallax` to each corner bracket `<View>`, and `viewportParallax` to the viewport container.

- [ ] **Step 4: Replace Open Camera button with RippleButton**

Add import:

```ts
import { RippleButton } from '../../src/components/RippleButton'
```

Replace the `<Pressable onPress={scanning ? undefined : startScan}>` + `<LinearGradient>` block with:

```tsx
<RippleButton
  onPress={scanning ? undefined : startScan}
  disabled={scanning}
  style={styles.btnWrapper}
>
  <Text style={styles.btnText}>{scanning ? 'Scanning...' : 'Open Camera'}</Text>
</RippleButton>
```

Remove the now-unused `btn` style (gradient padding/alignment is handled by RippleButton).

- [ ] **Step 5: Upgrade scan-complete haptic choreography**

In `startScan`, replace the single `hapticScanSuccess()` call with escalating haptics:

```ts
// In the setTimeout callback where scanning completes:
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150)
setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300)
```

Add `import * as Haptics from 'expo-haptics'` and remove the `hapticScanSuccess` import.

- [ ] **Step 6: Wrap in TabFadeWrapper**

Import `TabFadeWrapper` from the layout and wrap the screen root.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/(tabs)/scan.tsx
git commit -m "feat(mobile): scan — stagger, gyro, RippleButton, haptic choreography"
```

---

## Chunk 4: Screen Upgrades — Settings, Chat, Auth

### Task 11: Settings Screen — Stagger + Gradient Mesh

**Files:**
- Modify: `apps/mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Add imports**

```ts
import Animated from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
```

Note: `LinearGradient` is already imported. Only add if missing.

- [ ] **Step 2: Add stagger entrance**

In `SettingsScreen`:

```ts
const stagger = useStaggerEntrance(4) // title, profile, appearance, signout
```

Wrap the title `<Text>` in `<Animated.View style={stagger[0]}>`, profile card section in `<Animated.View style={stagger[1]}>`, appearance section (label + card) in `<Animated.View style={stagger[2]}>`, and sign-out card in `<Animated.View style={stagger[3]}>`.

- [ ] **Step 3: Add muted gradient mesh background**

Replace the outer `<View>` with a wrapping structure:

```tsx
<View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 70 }]}>
  <LinearGradient
    colors={theme.gradientAMuted as [string, string, ...string[]]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={StyleSheet.absoluteFill}
  />
  {/* ...existing content */}
</View>
```

Remove `backgroundColor: theme.bg` from the inline style since the gradient replaces it.

- [ ] **Step 4: Wrap in TabFadeWrapper**

Import `TabFadeWrapper` from the layout and wrap the screen root.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(tabs)/settings.tsx
git commit -m "feat(mobile): settings — stagger entrance, muted gradient mesh"
```

---

### Task 12: Chat Screen — Entrance, Gyro, Shimmer, Send Glow

**Files:**
- Modify: `apps/mobile/app/(tabs)/chat.tsx`

- [ ] **Step 1: Add imports**

```ts
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { useReducedMotion } from 'react-native-reanimated'
import { TabFadeWrapper } from './_layout'
```

Add `withRepeat`, `withTiming`, `Easing` to the existing reanimated import if not already present.

- [ ] **Step 1b: Add entrance animation to header and empty state**

In `ChatScreen`, add entrance animation for the header:

```ts
const headerOpacity = useSharedValue(reduceMotion ? 1 : 0)
const headerY = useSharedValue(reduceMotion ? 0 : 12)

useEffect(() => {
  if (reduceMotion) return
  headerOpacity.value = withSpring(1, { damping: 16, stiffness: 120 })
  headerY.value = withSpring(0, { damping: 16, stiffness: 120 })
}, [headerOpacity, headerY, reduceMotion])

const headerAnim = useAnimatedStyle(() => ({
  opacity: headerOpacity.value,
  transform: [{ translateY: headerY.value }],
}))
```

Add `const reduceMotion = useReducedMotion()` in `ChatScreen`.

Wrap the header `<View>` in `<Animated.View style={headerAnim}>`.

For the empty state, add a scale-in spring: wrap the `EmptyState` component's content in an `Animated.View` with `scale: 0.9 → 1.0` spring on mount.

Wrap the entire screen in `<TabFadeWrapper>`.

- [ ] **Step 2: Add gyro parallax to empty state**

In `ChatScreen`:

```ts
const { parallaxStyle: emptyParallax } = useGyroParallax(0.5)
```

In the `EmptyState` component, wrap the sparkle icon `<Text>` in `<Animated.View style={emptyParallax}>`. Since `emptyParallax` comes from the parent, pass it as a prop:

```tsx
function EmptyState({ color, mutedColor, parallaxStyle }: { color: string; mutedColor: string; parallaxStyle?: ViewStyle }) {
```

And in the render:

```tsx
<ListEmptyComponent={!loading ? <EmptyState color={theme.text} mutedColor={theme.textMuted} parallaxStyle={emptyParallax} /> : null}
```

- [ ] **Step 3: Add shimmer behind typing dots**

In the `TypingDots` component, add a shimmer sweep `LinearGradient` behind the dots:

```tsx
const shimmerX = useSharedValue(-1)

useEffect(() => {
  if (!reduceMotion) {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false,
    )
  }
}, [shimmerX, reduceMotion])

const shimmerStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: shimmerX.value * 60 }],
  opacity: 0.15,
}))
```

Add `const reduceMotion = useReducedMotion()` inside `TypingDots` (it already imports `useReducedMotion` indirectly — add the call).

Render the shimmer inside the bubble `<View>` as a background layer:

```tsx
<Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]} pointerEvents="none">
  <LinearGradient
    colors={['transparent', theme.lavender, 'transparent']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={StyleSheet.absoluteFill}
  />
</Animated.View>
```

- [ ] **Step 4: Add violet glow to send button**

Wrap the send button `<Pressable>` in a `<View style={theme.shadowGlowViolet}>`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(tabs)/chat.tsx
git commit -m "feat(mobile): chat — gyro parallax, shimmer typing dots, send button glow"
```

---

### Task 13: Login + Signup — RippleButton Integration

**Files:**
- Modify: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/signup.tsx`

- [ ] **Step 1: Update login.tsx**

Add import:

```ts
import { RippleButton } from '../src/components/RippleButton'
```

Replace the sign-in `<Pressable>` + `<LinearGradient>` block (lines ~115-130) with:

```tsx
<RippleButton
  onPress={handleSignIn}
  disabled={loading}
  style={loading ? { opacity: 0.6 } : undefined}
>
  <Text style={styles.signInText}>
    {loading ? 'Signing in...' : 'Sign In'}
  </Text>
</RippleButton>
```

Remove the now-unused `signInBtn` and `signInGradient` styles.

- [ ] **Step 2: Update signup.tsx**

Add import:

```ts
import { RippleButton } from '../src/components/RippleButton'
```

Replace the sign-up `<Pressable>` + `<LinearGradient>` block (lines ~185-200) with:

```tsx
<RippleButton
  onPress={handleSignup}
  disabled={loading}
  style={loading ? { opacity: 0.6 } : undefined}
>
  <Text style={styles.signInText}>
    {loading ? 'Creating account...' : 'Create Account'}
  </Text>
</RippleButton>
```

Remove the now-unused `signInBtn` and `signInGradient` styles.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/login.tsx apps/mobile/app/signup.tsx
git commit -m "feat(mobile): replace auth buttons with RippleButton"
```

---

## Chunk 5: Haptic Choreography + Stretch Goals

### Task 14: Haptic Choreography — Remaining Items

**Files:**
- Modify: `apps/mobile/src/utils/haptics.ts`
- Modify: `apps/mobile/app/(tabs)/care.tsx`

- [ ] **Step 1: Add haptic functions for choreography**

Add to `src/utils/haptics.ts`:

```ts
/** Escalating scan complete: light → medium → success */
export function hapticScanComplete(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150)
  setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300)
}

/** Double warning pulse for abnormal lab values on entrance */
export function hapticAbnormalLabEntrance(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 100)
}

/** Soft landing for card entrance */
export function hapticCardLand(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
}
```

- [ ] **Step 2: Use hapticAbnormalLabEntrance in Care screen LabRow**

In `care.tsx` `LabRow`, replace the existing `hapticAbnormalLab()` call with `hapticAbnormalLabEntrance()` and update the import.

- [ ] **Step 3: Update scan.tsx to use hapticScanComplete**

In `scan.tsx`, replace the inline haptic choreography (from Task 10 step 4) with:

```ts
import { hapticScanComplete } from '../../src/utils/haptics'
```

And call `hapticScanComplete()` instead of the three inline calls.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/haptics.ts apps/mobile/app/(tabs)/care.tsx apps/mobile/app/(tabs)/scan.tsx
git commit -m "feat(mobile): centralize haptic choreography patterns"
```

---

### Task 15 (Stretch): Swipe-to-Take Medication

**Files:**
- Modify: `apps/mobile/app/(tabs)/care.tsx`

> **Gate:** Only proceed if all previous tasks are complete and working. If `react-native-gesture-handler` is not a direct dependency, run `npx expo install react-native-gesture-handler` first.

- [ ] **Step 1: Install gesture handler if needed**

Run: `npx expo install react-native-gesture-handler`

- [ ] **Step 2: Add swipe-to-take to MedRow**

Wrap each `MedRow` card in a `GestureDetector` with a horizontal `Gesture.Pan()`:

- Card `translateX` follows the gesture
- Behind the card, render an emerald "Take" zone with a checkmark
- On release past 40% threshold, call `onTake`
- On release before threshold, spring back to 0
- Keep the existing tap-to-take button as fallback

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/care.tsx
git commit -m "feat(mobile): add swipe-to-take gesture on medication cards"
```

---

### Task 16 (Stretch): Pull-to-Refresh on Care Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/care.tsx`

- [ ] **Step 1: Add RefreshControl to ScrollView**

```tsx
import { RefreshControl } from 'react-native'
```

Add state:

```ts
const [refreshing, setRefreshing] = useState(false)

function onRefresh() {
  setRefreshing(true)
  // Reset meds to original data (simulate refresh)
  setTimeout(() => {
    setMeds(MEDS)
    setRefreshing(false)
  }, 1000)
}
```

Add to `<ScrollView>`:

```tsx
refreshControl={
  <RefreshControl
    refreshing={refreshing}
    onRefresh={onRefresh}
    tintColor={theme.accent}
  />
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --project apps/mobile/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(tabs)/care.tsx
git commit -m "feat(mobile): add pull-to-refresh on care screen"
```

---

## Final Verification

- [ ] **Run full typecheck:** `npx tsc --noEmit --project apps/mobile/tsconfig.json`
- [ ] **Run lint:** `cd apps/mobile && npx expo lint` (if configured)
- [ ] **Build check:** `npx expo export --platform ios` (dry run)
- [ ] **Manual test on device/simulator:** verify all screens, animations, haptics, theme switching
