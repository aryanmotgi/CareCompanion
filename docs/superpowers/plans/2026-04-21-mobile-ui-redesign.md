# CareCompanion Mobile — UI Redesign + 7 Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all five mobile screens with the dark indigo/glass aesthetic and implement 7 motion enhancements: gyroscope parallax, rich haptics, particle burst, animated gradient mesh, GlassCard press depth, breathing status dots, and animated number counters.

**Architecture:** `src/theme.ts` is the single design-token source of truth consumed by every screen via `useTheme()`. Reanimated 3 drives all animations on the UI thread; gradient color arrays and BlurView intensity are JS-state driven (via `runOnJS`). New shared components (GlassCard, ShimmerSkeleton, AmbientOrbs, ParticleBurst, AnimatedCounter) are composed into full screen rewrites.

**Tech Stack:** React Native 0.76.5 · Expo SDK 52 · expo-router 4 · react-native-reanimated 3 · expo-haptics · expo-blur · expo-linear-gradient · expo-sensors

**Spec:** `docs/superpowers/specs/2026-04-21-mobile-ui-redesign.md`

---

## Chunk 1: Foundation — Packages, Theme, Haptics

### Task 1: Install packages and configure Reanimated

**Files:**
- Modify: `apps/mobile/package.json` (via expo install)
- Create: `apps/mobile/babel.config.js`

- [ ] **Step 1: Install Expo-managed packages**

```bash
cd apps/mobile
npx expo install react-native-reanimated expo-haptics expo-blur expo-linear-gradient expo-sensors
```

Expected: All five packages added to `package.json` with SDK-52-compatible versions. No peer-dependency warnings.

- [ ] **Step 2: Create `apps/mobile/babel.config.js`**

Check whether the file already exists: `ls apps/mobile/babel.config.js`. If it does, add `'react-native-reanimated/plugin'` as the **last** entry in the `plugins` array. If it does not exist, create it:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // must be last
  }
}
```

- [ ] **Step 3: Rebuild native iOS app**

```bash
cd apps/mobile
npx expo run:ios
```

Expected: app launches in Simulator. Metro console shows `Reanimated 3 configured correctly.` — if you see `Reanimated was not configured` it means the babel plugin is missing or misplaced.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/babel.config.js
git commit -m "feat(mobile): install reanimated, haptics, blur, linear-gradient, sensors"
```

---

### Task 2: Create theme.ts

**Files:**
- Create: `apps/mobile/src/theme.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/theme.ts
import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const THEME_KEY = 'cc_theme_override'
export type ThemeOverride = 'dark' | 'light' | 'system'

const dark = {
  bg: '#0C0E1A',
  bgWarm: '#10122B',
  bgCard: 'rgba(167,139,250,0.06)',
  bgCardBorder: 'rgba(167,139,250,0.12)',
  bgElevated: 'rgba(167,139,250,0.10)',
  accent: '#6366F1',
  accentHover: '#818CF8',
  lavender: '#A78BFA',
  text: '#EDE9FE',
  textSub: '#A5B4CF',
  textMuted: 'rgba(255,255,255,0.35)',
  green: '#6EE7B7',
  amber: '#FCD34D',
  rose: '#FCA5A5',
  border: 'rgba(167,139,250,0.08)',
  borderHover: 'rgba(167,139,250,0.18)',
  isDark: true as const,
  shadowCard: {
    shadowColor: '#0F0A28',
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  // gradient mesh palettes for Home screen
  gradientA: ['#0C0E1A', '#10122B', 'rgba(99,102,241,0.08)', '#0C0E1A'] as string[],
  gradientB: ['#10122B', '#0C0E1A', 'rgba(167,139,250,0.12)', '#10122B'] as string[],
}

const light = {
  bg: '#FAFAFA',
  bgWarm: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardBorder: 'rgba(99,102,241,0.12)',
  bgElevated: 'rgba(99,102,241,0.04)',
  accent: '#6366F1',
  accentHover: '#4F46E5',
  lavender: '#7C3AED',
  text: '#1E1B4B',
  textSub: '#475569',
  textMuted: '#94A3B8',
  green: '#059669',
  amber: '#D97706',
  rose: '#DC2626',
  border: 'rgba(99,102,241,0.10)',
  borderHover: 'rgba(99,102,241,0.20)',
  isDark: false as const,
  shadowCard: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 } as const,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  gradientA: ['#FAFAFA', '#F5F3FF', 'rgba(99,102,241,0.04)', '#FAFAFA'] as string[],
  gradientB: ['#F5F3FF', '#FAFAFA', 'rgba(99,102,241,0.07)', '#F5F3FF'] as string[],
}

export const shared = {
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 24,
} as const

export type Theme = typeof dark

export function useTheme(): Theme {
  const systemScheme = useColorScheme()
  const [override, setOverride] = useState<ThemeOverride>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark' || val === 'light' || val === 'system') setOverride(val)
    })
  }, [])

  const isDark =
    override === 'system' ? systemScheme === 'dark' : override === 'dark'
  return isDark ? dark : light
}

export async function setThemeOverride(value: ThemeOverride): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, value)
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/theme.ts
git commit -m "feat(mobile): add theme.ts with dark/light palettes and useTheme()"
```

---

### Task 3: Create haptics.ts

**Files:**
- Create: `apps/mobile/src/utils/haptics.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/mobile/src/utils/haptics.ts
import * as Haptics from 'expo-haptics'

/** Double-tap feel: medium then light 80ms later */
export function hapticMedTaken(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80)
}

/** Warning pulse for abnormal lab values */
export function hapticAbnormalLab(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}

/** Soft tap when AI message arrives */
export function hapticAIMessage(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

/** Success burst when scan completes */
export function hapticScanSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/utils/haptics.ts
git commit -m "feat(mobile): add haptics utility with 4 named patterns"
```

---

## Chunk 2: Reusable Components

### Task 4: Create GlassCard.tsx (press-depth effect)

**Files:**
- Create: `apps/mobile/src/components/GlassCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/GlassCard.tsx
import React, { useState } from 'react'
import { Pressable, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { useTheme } from '../theme'

interface GlassCardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
}

export function GlassCard({ children, onPress, style }: GlassCardProps) {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const pressed = useSharedValue(0)
  const [blurIntensity, setBlurIntensity] = useState(20)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(
      pressed.value,
      [0, 1],
      [theme.bgCardBorder, theme.borderHover],
    ),
  }))

  function onPressIn() {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 })
    pressed.value = withSpring(1, { damping: 20, stiffness: 300 })
    setBlurIntensity(30)
  }

  function onPressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
    pressed.value = withSpring(0, { damping: 15, stiffness: 200 })
    setBlurIntensity(20)
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          styles.card,
          theme.shadowCard,
          { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder },
          animatedStyle,
          style,
        ]}
      >
        <BlurView
          intensity={blurIntensity}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
})
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/GlassCard.tsx
git commit -m "feat(mobile): add GlassCard with press-depth scale + blur toggle"
```

---

### Task 5: Create ShimmerSkeleton.tsx

**Files:**
- Create: `apps/mobile/src/components/ShimmerSkeleton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/ShimmerSkeleton.tsx
import React, { useEffect } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme'

interface ShimmerSkeletonProps {
  width?: number | string
  height?: number
  style?: ViewStyle
}

export function ShimmerSkeleton({ width = '100%', height = 20, style }: ShimmerSkeletonProps) {
  const theme = useTheme()
  const shimmer = useSharedValue(-1)

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
  }, [shimmer])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * (typeof width === 'number' ? width : 300) }],
  }))

  return (
    <View
      style={[
        styles.container,
        {
          width: width as number,
          height,
          backgroundColor: theme.bgElevated,
          borderRadius: 8,
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            theme.isDark ? 'rgba(167,139,250,0.15)' : 'rgba(99,102,241,0.1)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/components/ShimmerSkeleton.tsx
git commit -m "feat(mobile): add ShimmerSkeleton loading placeholder"
```

---

### Task 6: Create AnimatedCounter.tsx (ReText pattern)

**Files:**
- Create: `apps/mobile/src/components/AnimatedCounter.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/AnimatedCounter.tsx
import React, { useEffect } from 'react'
import { TextInput, StyleSheet, TextStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated'

// The "ReText" pattern: TextInput has a natively-animatable `text` prop.
// Plain Text does not. Using editable={false} hides the cursor/keyboard.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

interface AnimatedCounterProps {
  value: number
  style?: TextStyle
  prefix?: string
  suffix?: string
}

export function AnimatedCounter({ value, style, prefix = '', suffix = '' }: AnimatedCounterProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = 0
    progress.value = withSequence(
      withTiming(value + 1, { duration: 800, easing: Easing.out(Easing.cubic) }),
      withSpring(value, { damping: 6, stiffness: 300 }),
    )
  }, [value, progress])

  const animatedProps = useAnimatedProps(() => ({
    text: `${prefix}${Math.round(Math.max(0, progress.value))}${suffix}`,
  }))

  return (
    <AnimatedTextInput
      editable={false}
      // @ts-expect-error — text is a Reanimated-only animated prop for TextInput
      animatedProps={animatedProps}
      style={[styles.input, style]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/components/AnimatedCounter.tsx
git commit -m "feat(mobile): add AnimatedCounter using ReText pattern (TextInput + animatedProps)"
```

---

### Task 7: Create ParticleBurst.tsx

**Files:**
- Create: `apps/mobile/src/components/ParticleBurst.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/ParticleBurst.tsx
import React, { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  makeMutable,
} from 'react-native-reanimated'

const PARTICLE_COUNT = 24

// Pre-compute random angles and speeds once (not inside render)
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, () => ({
  angle: Math.random() * 2 * Math.PI,
  speed: 80 + Math.random() * 120,
}))

interface ParticleBurstProps {
  active: boolean
  onComplete: () => void
}

export function ParticleBurst({ active, onComplete }: ParticleBurstProps) {
  // Use makeMutable (not useSharedValue) so we can safely initialize inside useRef.
  // makeMutable is the non-hook primitive that useSharedValue wraps — calling it
  // inside useRef's initializer is valid because useRef runs once and is not a hook call.
  const txValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))
  const tyValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))
  const opacityValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))

  useEffect(() => {
    if (!active) {
      // Reset all particles
      txValues.current.forEach((v) => (v.value = 0))
      tyValues.current.forEach((v) => (v.value = 0))
      opacityValues.current.forEach((v) => (v.value = 0))
      return
    }

    const cfg = { duration: 600, easing: Easing.out(Easing.quad) }

    PARTICLES.forEach(({ angle, speed }, i) => {
      txValues.current[i].value = 0
      tyValues.current[i].value = 0
      opacityValues.current[i].value = 1

      txValues.current[i].value = withTiming(Math.cos(angle) * speed, cfg)
      tyValues.current[i].value = withTiming(Math.sin(angle) * speed, cfg)

      // Last particle triggers onComplete
      if (i === PARTICLE_COUNT - 1) {
        opacityValues.current[i].value = withTiming(0, cfg, () => runOnJS(onComplete)())
      } else {
        opacityValues.current[i].value = withTiming(0, cfg)
      }
    })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  return (
    <>
      {PARTICLES.map((_, i) => (
        <ParticleView
          key={i}
          tx={txValues.current[i]}
          ty={tyValues.current[i]}
          opacity={opacityValues.current[i]}
        />
      ))}
    </>
  )
}

function ParticleView({
  tx,
  ty,
  opacity,
}: {
  tx: Animated.SharedValue<number>
  ty: Animated.SharedValue<number>
  opacity: Animated.SharedValue<number>
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }))

  return <Animated.View style={[styles.particle, style]} />
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
    // center on parent — caller should position this component at the burst origin
    alignSelf: 'center',
  },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/components/ParticleBurst.tsx
git commit -m "feat(mobile): add ParticleBurst (24 particles, 600ms, pre-allocated shared values)"
```

---

### Task 8: Create AmbientOrbs.tsx (gyroscope-driven parallax)

**Files:**
- Create: `apps/mobile/src/components/AmbientOrbs.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/AmbientOrbs.tsx
import React, { useEffect, useRef } from 'react'
import { StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated'
import { Gyroscope } from 'expo-sensors'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

const { width, height } = Dimensions.get('window')
const MAX_OFFSET = 20

interface AmbientOrbsProps {
  /** 0.3 for background, 0.6 for cards */
  speedMultiplier?: number
}

export function AmbientOrbs({ speedMultiplier = 0.3 }: AmbientOrbsProps) {
  const reduceMotion = useReducedMotion()

  const gyroX = useSharedValue(0)
  const gyroY = useSharedValue(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  // Slow ambient float (independent of gyro)
  const floatX1 = useSharedValue(0)
  const floatY1 = useSharedValue(0)
  const floatX2 = useSharedValue(0)
  const floatY2 = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    floatX1.value = withRepeat(
      withSequence(withTiming(30, { duration: 12000 }), withTiming(-20, { duration: 12000 })),
      -1,
      true,
    )
    floatY1.value = withRepeat(
      withSequence(withTiming(-20, { duration: 14000 }), withTiming(25, { duration: 14000 })),
      -1,
      true,
    )
    floatX2.value = withRepeat(
      withSequence(withTiming(-25, { duration: 18000 }), withTiming(20, { duration: 18000 })),
      -1,
      true,
    )
    floatY2.value = withRepeat(
      withSequence(withTiming(20, { duration: 16000 }), withTiming(-30, { duration: 16000 })),
      -1,
      true,
    )
  }, [reduceMotion, floatX1, floatY1, floatX2, floatY2])

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return
      Gyroscope.setUpdateInterval(16)
      const sub = Gyroscope.addListener(({ x, y }) => {
        // Low-pass filter: smooth out jitter
        tiltRef.current.x = tiltRef.current.x * 0.85 + y * 0.15
        tiltRef.current.y = tiltRef.current.y * 0.85 + x * 0.15
        // Clamp to ±15
        const cx = Math.max(-15, Math.min(15, tiltRef.current.x))
        const cy = Math.max(-15, Math.min(15, tiltRef.current.y))
        gyroX.value = cx * speedMultiplier * MAX_OFFSET
        gyroY.value = cy * speedMultiplier * MAX_OFFSET
      })
      return () => sub.remove()
    }, [reduceMotion, speedMultiplier, gyroX, gyroY]),
  )

  const orb1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: floatX1.value + gyroX.value },
      { translateY: floatY1.value + gyroY.value },
    ],
  }))
  const orb2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: floatX2.value + gyroX.value },
      { translateY: floatY2.value + gyroY.value },
    ],
  }))

  if (reduceMotion) return null

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            width: width * 0.8,
            height: width * 0.8,
            top: -width * 0.2,
            left: -width * 0.2,
            backgroundColor: 'rgba(99,102,241,0.12)',
          },
          orb1Style,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            width: width * 0.7,
            height: width * 0.7,
            bottom: height * 0.1,
            right: -width * 0.2,
            backgroundColor: 'rgba(167,139,250,0.08)',
          },
          orb2Style,
        ]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/components/AmbientOrbs.tsx
git commit -m "feat(mobile): add AmbientOrbs with gyroscope parallax + ambient float"
```

---

## Chunk 3: Navigation

### Task 9: Rewrite tab bar `_layout.tsx`

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

The existing file uses default Expo tab bar. Replace entirely with a custom `tabBar` component that uses BlurView and animated tab icons.

- [ ] **Step 1: Write the new layout**

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { LinearGradient } from 'expo-linear-gradient'

const TABS = [
  { name: 'index', label: 'Home', icon: '⌂' },
  { name: 'chat', label: 'Chat', icon: '💬' },
  { name: 'care', label: 'Care', icon: '♥' },
  { name: 'scan', label: 'Scan', icon: '⊞' },
  { name: 'settings', label: 'Settings', icon: '⚙' },
]

function TabIcon({ icon, active }: { icon: string; active: boolean }) {
  const scale = useSharedValue(1)
  const ty = useSharedValue(0)
  const theme = useTheme()

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: ty.value }],
  }))

  // Trigger bounce when becoming active
  React.useEffect(() => {
    if (active) {
      ty.value = withSpring(0, { damping: 10, stiffness: 200 }, () => {
        ty.value = 0
      })
      ty.value = -6
      scale.value = withSpring(1, { damping: 10, stiffness: 200 })
      scale.value = 1.1
    }
  }, [active, scale, ty])

  return (
    <Animated.View
      style={[
        animStyle,
        styles.iconWrapper,
        active && {
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderRadius: 10,
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      <Text style={[styles.iconText, { color: active ? theme.accent : theme.textMuted }]}>
        {icon}
      </Text>
    </Animated.View>
  )
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.tabBarOuter,
        {
          paddingBottom: insets.bottom,
          borderTopColor: theme.border,
        },
      ]}
    >
      <BlurView
        intensity={80}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.isDark ? 'rgba(10,12,26,0.85)' : 'rgba(255,255,255,0.90)' },
        ]}
      />
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0]
          const active = state.index === index

          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!active && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
            >
              <TabIcon icon={tab.icon} active={active} />
              <Text
                style={[
                  styles.label,
                  { color: active ? theme.accent : theme.textMuted, fontWeight: active ? '700' : '400' },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export default function TabLayout() {
  return (
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
  )
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconText: {
    fontSize: 18,
  },
  label: {
    fontSize: 10,
  },
})
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Run app and verify**

```bash
npx expo run:ios
```

Expected: 5 tabs visible (Home, Chat, Care, Scan, Settings). Tapping a tab triggers haptic + bounce animation. Tab bar has frosted glass appearance.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/'(tabs)'/_layout.tsx
git commit -m "feat(mobile): rewrite tab bar with BlurView, bounce animation, haptics"
```

---

### Task 10: Create Drawer.tsx

**Files:**
- Create: `apps/mobile/src/components/Drawer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/Drawer.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme'
import * as SecureStore from 'expo-secure-store'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75

interface DrawerProps {
  visible: boolean
  onClose: () => void
  userName: string
  userRole?: string
}

export function Drawer({ visible, onClose, userName, userRole = 'Patient' }: DrawerProps) {
  const theme = useTheme()
  const router = useRouter()
  const translateX = useSharedValue(-DRAWER_WIDTH)
  const backdropOpacity = useSharedValue(0)

  React.useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 160 })
      backdropOpacity.value = withTiming(1, { duration: 250 })
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 220 })
      backdropOpacity.value = withTiming(0, { duration: 220 })
    }
  }, [visible, translateX, backdropOpacity])

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  function navigate(path: string) {
    onClose()
    setTimeout(() => router.push(path as any), 250)
  }

  async function signOut() {
    onClose()
    await SecureStore.deleteItemAsync('cc-session-token')
    setTimeout(() => router.replace('/login'), 250)
  }

  if (!visible && backdropOpacity.value === 0) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            backgroundColor: theme.isDark ? '#13111F' : '#FFFFFF',
            borderRightColor: theme.isDark ? 'rgba(167,139,250,0.15)' : 'rgba(99,102,241,0.15)',
          },
          drawerStyle,
        ]}
      >
        {/* User section */}
        <View style={[styles.userSection, { borderBottomColor: theme.border }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
            <Text style={[styles.userRole, { color: theme.textMuted }]}>{userRole}</Text>
          </View>
        </View>

        {/* Nav items */}
        <Pressable style={[styles.item, { backgroundColor: 'rgba(252,165,165,0.1)' }]}
          onPress={() => navigate('/emergency')}>
          <Text style={styles.itemIcon}>🚨</Text>
          <Text style={[styles.itemLabel, { color: theme.rose }]}>Emergency Card</Text>
        </Pressable>

        <Pressable style={[styles.item, { backgroundColor: 'rgba(129,140,248,0.08)' }]}
          onPress={() => navigate('/health-summary')}>
          <Text style={styles.itemIcon}>📋</Text>
          <Text style={[styles.itemLabel, { color: theme.accentHover }]}>Health Summary</Text>
        </Pressable>

        <Pressable style={[styles.item, { backgroundColor: 'rgba(52,211,153,0.08)' }]}
          onPress={() => navigate('/insurance')}>
          <Text style={styles.itemIcon}>💳</Text>
          <Text style={[styles.itemLabel, { color: '#34D399' }]}>Insurance & Claims</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable style={styles.item} onPress={signOut}>
          <Text style={styles.itemIcon}>🚪</Text>
          <Text style={[styles.itemLabel, { color: theme.textMuted }]}>Sign Out</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '600' },
  userRole: { fontSize: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  itemIcon: { fontSize: 16 },
  itemLabel: { fontSize: 14, fontWeight: '600' },
})
```

- [ ] **Step 2: Create the three drawer route screens**

Create `apps/mobile/app/emergency.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../src/theme'
export default function EmergencyScreen() {
  const t = useTheme()
  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>Emergency Card</Text>
      <Text style={[s.sub, { color: t.textMuted }]}>Your emergency contacts and current medications</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15 },
})
```

Create `apps/mobile/app/health-summary.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../src/theme'
export default function HealthSummaryScreen() {
  const t = useTheme()
  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>Health Summary</Text>
      <Text style={[s.sub, { color: t.textMuted }]}>Your complete health overview</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15 },
})
```

Create `apps/mobile/app/insurance.tsx`:
```tsx
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../src/theme'
export default function InsuranceScreen() {
  const t = useTheme()
  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <Text style={[s.title, { color: t.text }]}>Insurance & Claims</Text>
      <Text style={[s.sub, { color: t.textMuted }]}>Your coverage and active claims</Text>
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15 },
})
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/src/components/Drawer.tsx \
        apps/mobile/app/emergency.tsx \
        apps/mobile/app/health-summary.tsx \
        apps/mobile/app/insurance.tsx
git commit -m "feat(mobile): add Drawer with slide animation + emergency/health/insurance screens"
```

---

### Task 11: Update root `_layout.tsx`

Add `useFonts`/status bar setup and wrap in SafeAreaProvider. Keep existing auth gate logic.

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Update the file**

```tsx
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from '../src/theme'

// Must be at component level to handle deep-link after OAuth redirect
WebBrowser.maybeCompleteAuthSession()

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const inLogin = segments[0] === 'login'
      if (!token && !inLogin) router.replace('/login')
      else if (token && inLogin) router.replace('/(tabs)')
    }
    check()
  }, [segments, router])

  return <>{children}</>
}

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemedStatusBar />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </SafeAreaProvider>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add SafeAreaProvider + themed StatusBar to root layout"
```

---

## Chunk 4: Screen Rewrites

### Task 12: Rewrite Home screen — gradient mesh + gyro parallax + animated counters

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Write the new Home screen**

```tsx
// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { AmbientOrbs } from '../../src/components/AmbientOrbs'
import { AnimatedCounter } from '../../src/components/AnimatedCounter'
import { Drawer } from '../../src/components/Drawer'
import { syncHealthKitData } from '../../src/services/healthkit'
import { Gyroscope } from 'expo-sensors'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

const { width } = Dimensions.get('window')

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Mock data — replace with real API calls
  const medCount = 3
  const medTaken = 1

  // Gradient mesh
  const [gradientColors, setGradientColors] = useState<string[]>(theme.gradientA)
  const gradientProgress = useSharedValue(0)

  useEffect(() => {
    gradientProgress.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sine) }),
      -1,
      true,
    )
  }, [gradientProgress])

  useAnimatedReaction(
    () => gradientProgress.value,
    (p) => {
      const c0 = interpolateColor(p, [0, 1], [theme.gradientA[0], theme.gradientB[0]])
      const c1 = interpolateColor(p, [0, 1], [theme.gradientA[1], theme.gradientB[1]])
      const c2 = interpolateColor(p, [0, 1], [theme.gradientA[2], theme.gradientB[2]])
      const c3 = interpolateColor(p, [0, 1], [theme.gradientA[3], theme.gradientB[3]])
      runOnJS(setGradientColors)([c0, c1, c2, c3])
    },
  )

  // Gyroscope for card layer (0.6x)
  const cardGyroX = useSharedValue(0)
  const cardGyroY = useSharedValue(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  useFocusEffect(
    useCallback(() => {
      Gyroscope.setUpdateInterval(16)
      const sub = Gyroscope.addListener(({ x, y }) => {
        tiltRef.current.x = tiltRef.current.x * 0.85 + y * 0.15
        tiltRef.current.y = tiltRef.current.y * 0.85 + x * 0.15
        const cx = Math.max(-15, Math.min(15, tiltRef.current.x))
        const cy = Math.max(-15, Math.min(15, tiltRef.current.y))
        cardGyroX.value = cx * 0.6 * 20
        cardGyroY.value = cy * 0.6 * 20
      })
      return () => sub.remove()
    }, [cardGyroX, cardGyroY]),
  )

  const cardParallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardGyroX.value }, { translateY: cardGyroY.value }],
  }))

  // Card stagger entrance
  const card1Opacity = useSharedValue(0)
  const card1Y = useSharedValue(24)
  const card2Opacity = useSharedValue(0)
  const card2Y = useSharedValue(24)
  const card3Opacity = useSharedValue(0)
  const card3Y = useSharedValue(24)

  useEffect(() => {
    card1Opacity.value = withDelay(100, withSpring(1))
    card1Y.value = withDelay(100, withSpring(0))
    card2Opacity.value = withDelay(250, withSpring(1))
    card2Y.value = withDelay(250, withSpring(0))
    card3Opacity.value = withDelay(400, withSpring(1))
    card3Y.value = withDelay(400, withSpring(0))
  }, [card1Opacity, card1Y, card2Opacity, card2Y, card3Opacity, card3Y])

  const card1Style = useAnimatedStyle(() => ({ opacity: card1Opacity.value, transform: [{ translateY: card1Y.value }] }))
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Opacity.value, transform: [{ translateY: card2Y.value }] }))
  const card3Style = useAnimatedStyle(() => ({ opacity: card3Opacity.value, transform: [{ translateY: card3Y.value }] }))

  useEffect(() => {
    syncHealthKitData().catch(console.error)
  }, [])

  return (
    <View style={styles.root}>
      {/* Animated gradient mesh background */}
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Background orbs at 0.3x parallax */}
      <AmbientOrbs speedMultiplier={0.3} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textMuted }]}>
              {getGreeting().toUpperCase()}
            </Text>
            <Text style={[styles.name, { color: theme.text }]}>Aryan</Text>
          </View>
          <Pressable onPress={() => setDrawerOpen(true)} style={styles.avatarBtn}>
            <LinearGradient
              colors={['#6366F1', '#A78BFA']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>A</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Cards — 0.6x parallax layer */}
        <Animated.View style={cardParallaxStyle}>
          {/* Medications card */}
          <Animated.View style={card1Style}>
            <GlassCard style={{ marginBottom: 12 }}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: theme.textMuted }]}>TODAY'S MEDICATIONS</Text>
                <View style={[styles.badge, { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
                  <AnimatedCounter
                    value={medCount - medTaken}
                    style={[styles.badgeText, { color: theme.accent }]}
                    suffix=" left"
                  />
                </View>
              </View>
              <View style={styles.medRow}>
                <View style={[styles.dot, { backgroundColor: theme.green }]} />
                <Text style={[styles.medName, { color: theme.text }]}>Tamoxifen 20mg</Text>
                <Text style={[styles.medTime, { color: theme.textMuted }]}>8:00 AM ✓</Text>
              </View>
              <View style={styles.medRow}>
                <View style={[styles.dot, { backgroundColor: theme.amber }]} />
                <Text style={[styles.medName, { color: theme.text }]}>Ondansetron 4mg</Text>
                <Text style={[styles.medTime, { color: theme.textMuted }]}>2:00 PM</Text>
              </View>
              <View style={styles.medRow}>
                <View style={[styles.dot, { backgroundColor: theme.amber }]} />
                <Text style={[styles.medName, { color: theme.text }]}>Dexamethasone 4mg</Text>
                <Text style={[styles.medTime, { color: theme.textMuted }]}>8:00 PM</Text>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Appointment card */}
          <Animated.View style={card2Style}>
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={[styles.cardLabel, { color: theme.textMuted }]}>NEXT APPOINTMENT</Text>
              <Text style={[styles.apptName, { color: theme.text }]}>Oncology Follow-up</Text>
              <Text style={[styles.apptDoctor, { color: theme.textSub }]}>Dr. Sarah Chen</Text>
              <Text style={[styles.apptTime, { color: theme.lavender }]}>Monday · 10:00 AM</Text>
              <Text style={[styles.apptLocation, { color: theme.textMuted }]}>UCSF Medical Center · Room 4B</Text>
            </GlassCard>
          </Animated.View>

          {/* AI CTA card */}
          <Animated.View style={card3Style}>
            <GlassCard onPress={() => router.push('/(tabs)/chat')}>
              <View style={styles.ctaRow}>
                <Text style={{ fontSize: 24 }}>✨</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.ctaTitle, { color: theme.text }]}>Ask your AI companion</Text>
                  <Text style={[styles.ctaSub, { color: theme.textMuted }]}>
                    Side effects, dosing questions, what to expect…
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <Drawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName="Aryan"
        userRole="Patient"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  avatarBtn: {},
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  medName: { flex: 1, fontSize: 14, fontWeight: '600' },
  medTime: { fontSize: 12 },
  apptName: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  apptDoctor: { fontSize: 14, marginBottom: 4 },
  apptTime: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  apptLocation: { fontSize: 12 },
  ctaRow: { flexDirection: 'row', alignItems: 'center' },
  ctaTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  ctaSub: { fontSize: 13, lineHeight: 18 },
})
```

- [ ] **Step 2: Typecheck + run**

```bash
cd apps/mobile && npx tsc --noEmit
npx expo run:ios
```

Expected: Home screen shows animated gradient background, orbs floating, cards stagger in on load, counter animates from 0→2, gyroscope tilt moves cards slightly.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/'(tabs)'/index.tsx
git commit -m "feat(mobile): rewrite Home with gradient mesh, gyro parallax, animated counters"
```

---

### Task 13: Rewrite Chat screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/chat.tsx`

- [ ] **Step 1: Write the new screen**

```tsx
// apps/mobile/app/(tabs)/chat.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as SecureStore from 'expo-secure-store'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { hapticAIMessage } from '../../src/utils/haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanion.app'

type Message = { id: string; role: 'user' | 'assistant'; content: string }

function MessageBubble({ message }: { message: Message }) {
  const theme = useTheme()
  const scale = useSharedValue(0.7)
  const ty = useSharedValue(8)
  const opacity = useSharedValue(0)
  const isUser = message.role === 'user'

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 })
    ty.value = withSpring(0, { damping: 12, stiffness: 180 })
    opacity.value = withSpring(1, { damping: 12, stiffness: 180 })
  }, [scale, ty, opacity])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }))

  if (isUser) {
    return (
      <Animated.View style={[styles.bubbleRow, styles.userRow, style]}>
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Text style={styles.userText}>{message.content}</Text>
        </LinearGradient>
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.bubbleRow, style]}>
      <View
        style={[
          styles.bubble,
          styles.aiBubble,
          {
            backgroundColor: theme.bgCard,
            borderColor: theme.bgCardBorder,
          },
        ]}
      >
        <Text style={[styles.aiText, { color: theme.text }]}>{message.content}</Text>
      </View>
    </Animated.View>
  )
}

function TypingDots() {
  const theme = useTheme()
  const dots = [useSharedValue(0.3), useSharedValue(0.3), useSharedValue(0.3)]

  useEffect(() => {
    dots.forEach((dot, i) => {
      const delay = i * 200
      setTimeout(() => {
        dot.value = withSpring(1, { damping: 8, stiffness: 200 })
        setTimeout(() => { dot.value = withSpring(0.3, { damping: 8, stiffness: 200 }) }, 400)
      }, delay)
    })
    const interval = setInterval(() => {
      dots.forEach((dot, i) => {
        const delay = i * 200
        setTimeout(() => {
          dot.value = withSpring(1, { damping: 8, stiffness: 200 })
          setTimeout(() => { dot.value = withSpring(0.3, { damping: 8, stiffness: 200 }) }, 400)
        }, delay)
      })
    }, 1200)
    return () => clearInterval(interval)
  }, [dots])

  return (
    <View style={[styles.bubbleRow, styles.typingRow]}>
      <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder, flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 12 }]}>
        {dots.map((dot, i) => {
          const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }))
          return (
            <Animated.View
              key={i}
              style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.lavender }, dotStyle]}
            />
          )
        })}
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<FlatList>(null)

  async function send() {
    if (!input.trim() || loading) return
    const msg: Message = { id: Date.now().toString(), role: 'user', content: input }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Cookie: `next-auth.session-token=${token}` } : {}),
        },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      })
      const data = await res.json() as { content?: string }
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content ?? 'Sorry, try again.',
      }
      setMessages((prev) => [...prev, reply])
      hapticAIMessage()
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
        <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>AI Companion</Text>
        <Text style={[styles.headerSub, { color: theme.textMuted }]}>Always here for you</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListFooterComponent={loading ? <TypingDots /> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input */}
      <View
        style={[
          styles.inputBar,
          {
            paddingBottom: insets.bottom + 8,
            borderTopColor: theme.border,
            backgroundColor: theme.isDark ? 'rgba(12,14,26,0.95)' : 'rgba(255,255,255,0.95)',
          },
        ]}
      >
        <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bgCard,
              borderColor: theme.bgCardBorder,
              color: theme.text,
            },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your care..."
          placeholderTextColor={theme.textMuted}
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Pressable onPress={send} disabled={loading}>
          <LinearGradient
            colors={['#6366F1', '#A78BFA']}
            style={styles.sendBtn}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, overflow: 'hidden' },
  headerTitle: { fontSize: 20, fontWeight: '700', zIndex: 1 },
  headerSub: { fontSize: 13, zIndex: 1 },
  list: { padding: 16, gap: 8 },
  bubbleRow: { maxWidth: '80%' },
  userRow: { alignSelf: 'flex-end' },
  typingRow: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 12, padding: 12 },
  userBubble: {
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 2,
  },
  aiBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomRightRadius: 12, borderBottomLeftRadius: 2,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  aiText: { fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/'(tabs)'/chat.tsx
git commit -m "feat(mobile): rewrite Chat with spring message animations + AI haptic"
```

---

### Task 14: Rewrite Care screen — breathing dots + haptics + check-off

**Files:**
- Modify: `apps/mobile/app/(tabs)/care.tsx`

- [ ] **Step 1: Write the new screen**

```tsx
// apps/mobile/app/(tabs)/care.tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { hapticMedTaken, hapticAbnormalLab } from '../../src/utils/haptics'
import { useState } from 'react'

type MedStatus = 'taken' | 'upcoming' | 'overdue'

interface Med {
  id: string
  name: string
  dose: string
  time: string
  status: MedStatus
}

interface Lab {
  id: string
  name: string
  value: string
  range: string
  date: string
  status: 'normal' | 'borderline' | 'abnormal'
}

const MEDS: Med[] = [
  { id: '1', name: 'Tamoxifen', dose: '20mg', time: '8:00 AM', status: 'taken' },
  { id: '2', name: 'Ondansetron', dose: '4mg', time: '2:00 PM', status: 'upcoming' },
  { id: '3', name: 'Dexamethasone', dose: '4mg', time: '8:00 PM', status: 'upcoming' },
]

const LABS: Lab[] = [
  { id: '1', name: 'WBC', value: '3.2', range: '4.0–11.0', date: 'Apr 18', status: 'abnormal' },
  { id: '2', name: 'Hemoglobin', value: '11.4', range: '12.0–16.0', date: 'Apr 18', status: 'borderline' },
  { id: '3', name: 'Platelets', value: '220', range: '150–400', date: 'Apr 18', status: 'normal' },
]

function BreathingDot({ status }: { status: MedStatus }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  const config: Record<MedStatus, { maxScale: number; period: number; color: string }> = {
    taken: { maxScale: 1.2, period: 3000, color: theme.green },
    upcoming: { maxScale: 1.3, period: 1500, color: theme.amber },
    overdue: { maxScale: 1.4, period: 800, color: theme.rose },
  }
  const { maxScale, period, color } = config[status]

  useEffect(() => {
    if (reduceMotion) return
    scale.value = withRepeat(
      withSequence(
        withTiming(maxScale, { duration: period / 2, easing: Easing.inOut(Easing.sine) }),
        withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sine) }),
      ),
      -1,
      false,
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period / 2 }),
        withTiming(0.6, { duration: period / 2 }),
      ),
      -1,
      false,
    )
  }, [reduceMotion, scale, opacity, maxScale, period])

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, dotStyle]} />
  )
}

function MedRow({ med, onTake }: { med: Med; onTake: (id: string) => void }) {
  const theme = useTheme()
  const taken = med.status === 'taken'
  const rowOpacity = useSharedValue(taken ? 0.5 : 1)
  const checkScale = useSharedValue(taken ? 1 : 0)

  const rowStyle = useAnimatedStyle(() => ({ opacity: rowOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }))

  function handleTake() {
    hapticMedTaken()
    rowOpacity.value = withTiming(0.5, { duration: 300 })
    checkScale.value = withSpring(1, { damping: 8, stiffness: 300 })
    onTake(med.id)
  }

  return (
    <Animated.View style={rowStyle}>
      <GlassCard style={styles.medCard}>
        <View style={styles.medRow}>
          <BreathingDot status={med.status} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.medName, { color: theme.text, textDecorationLine: taken ? 'line-through' : 'none' }]}>
              {med.name} {med.dose}
            </Text>
            <Text style={[styles.medTime, { color: theme.textMuted }]}>{med.time}</Text>
          </View>
          <Pressable onPress={taken ? undefined : handleTake} style={styles.checkBtn}>
            <Animated.View
              style={[
                styles.checkInner,
                { borderColor: taken ? theme.accent : theme.border },
                taken && { backgroundColor: theme.accent },
                checkStyle,
              ]}
            >
              {taken && <Text style={styles.checkMark}>✓</Text>}
            </Animated.View>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  )
}

function LabRow({ lab }: { lab: Lab }) {
  const theme = useTheme()
  const abnormalFired = useRef(false)
  const valueColor = lab.status === 'normal' ? theme.green : lab.status === 'borderline' ? theme.amber : theme.rose

  useEffect(() => {
    if (lab.status === 'abnormal' && !abnormalFired.current) {
      abnormalFired.current = true
      hapticAbnormalLab()
    }
  }, [lab.status])

  return (
    <GlassCard style={styles.labCard}>
      <View style={styles.labRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.labName, { color: theme.text }]}>{lab.name}</Text>
          <Text style={[styles.labRange, { color: theme.textMuted }]}>Ref: {lab.range}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.labValue, { color: valueColor }]}>{lab.value}</Text>
          <Text style={[styles.labDate, { color: theme.textMuted }]}>{lab.date}</Text>
        </View>
      </View>
    </GlassCard>
  )
}

export default function CareScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'meds' | 'labs'>('meds')
  const [meds, setMeds] = useState(MEDS)

  function takeMed(id: string) {
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, status: 'taken' } : m))
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Care</Text>

        {/* Segment control */}
        <View style={[styles.segment, { backgroundColor: theme.bgElevated }]}>
          {(['meds', 'labs'] as const).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.segBtn,
                tab === t && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
              ]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.segLabel, { color: tab === t ? theme.accentHover : theme.textMuted }]}>
                {t === 'meds' ? 'Medications' : 'Labs'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 120 }]}>
        {tab === 'meds'
          ? meds.map((m) => <MedRow key={m.id} med={m} onTake={takeMed} />)
          : LABS.map((l) => <LabRow key={l.id} lab={l} />)}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  medCard: { marginBottom: 0 },
  medRow: { flexDirection: 'row', alignItems: 'center' },
  medName: { fontSize: 15, fontWeight: '600' },
  medTime: { fontSize: 12, marginTop: 2 },
  checkBtn: { padding: 4 },
  checkInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  labCard: { marginBottom: 0 },
  labRow: { flexDirection: 'row', alignItems: 'center' },
  labName: { fontSize: 15, fontWeight: '600' },
  labRange: { fontSize: 12, marginTop: 2 },
  labValue: { fontSize: 18, fontWeight: '700' },
  labDate: { fontSize: 11, marginTop: 2 },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/'(tabs)'/care.tsx
git commit -m "feat(mobile): rewrite Care with breathing dots, check-off animation, haptics"
```

---

### Task 15: Rewrite Scan screen — laser HUD + particle burst + haptics

**Files:**
- Modify: `apps/mobile/app/(tabs)/scan.tsx`

- [ ] **Step 1: Write the new screen**

```tsx
// apps/mobile/app/(tabs)/scan.tsx
import React, { useState, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions, Alert } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { ParticleBurst } from '../../src/components/ParticleBurst'
import { hapticScanSuccess } from '../../src/utils/haptics'

const { width } = Dimensions.get('window')
const SCAN_SIZE = width - 64

export default function ScanScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [scanning, setScanning] = useState(false)
  const [burstActive, setBurstActive] = useState(false)

  const laserY = useSharedValue(0)
  const laserOpacity = useSharedValue(0)

  function startScan() {
    setScanning(true)
    laserOpacity.value = withTiming(1, { duration: 200 })
    laserY.value = 0
    laserY.value = withRepeat(
      withTiming(SCAN_SIZE, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )

    // Simulate scan completing after 3s
    setTimeout(() => {
      setScanning(false)
      laserOpacity.value = withTiming(0, { duration: 200 })
      hapticScanSuccess()
      setBurstActive(true)
    }, 3000)
  }

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
    opacity: laserOpacity.value,
  }))

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: theme.text }]}>Scan Document</Text>
      <Text style={[styles.sub, { color: theme.textMuted }]}>
        Photograph a prescription, lab report, or insurance card
      </Text>

      {/* Scan viewport */}
      <View style={styles.viewportWrapper}>
        <View
          style={[
            styles.viewport,
            {
              width: SCAN_SIZE,
              height: SCAN_SIZE,
              borderColor: scanning ? theme.accent : theme.border,
              backgroundColor: scanning ? 'rgba(99,102,241,0.05)' : theme.bgElevated,
            },
          ]}
        >
          {/* Corner brackets */}
          {[
            { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
            { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
            { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
            { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
          ].map((s, i) => (
            <View
              key={i}
              style={[styles.bracket, { borderColor: theme.accent, width: 20, height: 20 }, s]}
            />
          ))}

          {/* Laser line */}
          {scanning && (
            <Animated.View style={[styles.laserWrapper, laserStyle]}>
              <LinearGradient
                colors={['transparent', '#6366F1', '#6EE7B7', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.laser}
              />
            </Animated.View>
          )}

          {/* Idle content */}
          {!scanning && (
            <View style={styles.idleContent}>
              <Text style={{ fontSize: 48 }}>📄</Text>
              <Text style={[styles.idleText, { color: theme.textMuted }]}>
                Tap below to start scanning
              </Text>
            </View>
          )}

          {/* Scanning text */}
          {scanning && (
            <View style={styles.scanningLabel}>
              <Text style={[styles.scanningText, { color: theme.accent }]}>Scanning…</Text>
            </View>
          )}

          {/* Particle burst origin */}
          <View style={styles.burstOrigin} pointerEvents="none">
            <ParticleBurst active={burstActive} onComplete={() => setBurstActive(false)} />
          </View>
        </View>
      </View>

      {/* Button */}
      <Pressable onPress={scanning ? undefined : startScan} style={styles.btnWrapper}>
        <LinearGradient
          colors={['#6366F1', '#A78BFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, scanning && { opacity: 0.6 }]}
        >
          <Text style={styles.btnText}>{scanning ? 'Scanning…' : 'Open Camera'}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, alignSelf: 'flex-start' },
  sub: { fontSize: 14, marginBottom: 40, alignSelf: 'flex-start' },
  viewportWrapper: { alignItems: 'center', marginBottom: 40 },
  viewport: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bracket: { position: 'absolute' },
  laserWrapper: { position: 'absolute', left: 0, right: 0 },
  laser: { height: 2, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 6 },
  idleContent: { alignItems: 'center', gap: 12 },
  idleText: { fontSize: 14, textAlign: 'center' },
  scanningLabel: { position: 'absolute', bottom: 16 },
  scanningText: { fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  burstOrigin: { position: 'absolute', alignSelf: 'center' },
  btnWrapper: { width: '100%' },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/'(tabs)'/scan.tsx
git commit -m "feat(mobile): rewrite Scan with laser HUD, particle burst, scan haptic"
```

---

### Task 16: Create Settings screen

**Files:**
- Create: `apps/mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// apps/mobile/app/(tabs)/settings.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useTheme, setThemeOverride, ThemeOverride, THEME_KEY } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'

export default function SettingsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [activeTheme, setActiveTheme] = useState<ThemeOverride>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light' || v === 'system') setActiveTheme(v)
    })
  }, [])

  async function changeTheme(value: ThemeOverride) {
    setActiveTheme(value)
    await setThemeOverride(value)
  }

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('cc-session-token')
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {/* Profile card */}
      <GlassCard style={styles.section}>
        <View style={styles.profileRow}>
          <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.name, { color: theme.text }]}>Aryan</Text>
            <Text style={[styles.role, { color: theme.textMuted }]}>Patient</Text>
          </View>
        </View>
      </GlassCard>

      {/* Appearance */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
      <GlassCard style={styles.section}>
        <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
          {(['light', 'dark', 'system'] as ThemeOverride[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.segBtn,
                activeTheme === t && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
              ]}
              onPress={() => changeTheme(t)}
            >
              <Text style={[styles.segLabel, { color: activeTheme === t ? theme.accentHover : theme.textMuted }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {/* Sign out */}
      <Pressable onPress={signOut}>
        <GlassCard style={[styles.section, { borderColor: 'rgba(252,165,165,0.2)' }]}>
          <Text style={[styles.signOut, { color: theme.rose }]}>Sign Out</Text>
        </GlassCard>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700' },
  role: { fontSize: 13, marginTop: 2 },
  segmentRow: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  signOut: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/'(tabs)'/settings.tsx
git commit -m "feat(mobile): add Settings screen with theme toggle and sign out"
```

---

### Task 17: Rewrite Login screen

**Files:**
- Modify: `apps/mobile/app/login.tsx`

- [ ] **Step 1: Write the new login screen**

The existing login.tsx content is unknown (not shown in exploration). Write it from scratch:

```tsx
// apps/mobile/app/login.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { signInWithGoogle } from '../src/services/auth'

const { width } = Dimensions.get('window')

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Stagger entrance animations
  const logoOpacity = useSharedValue(0)
  const logoY = useSharedValue(20)
  const cardOpacity = useSharedValue(0)
  const cardY = useSharedValue(20)

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    logoY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    cardOpacity.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }))
    cardY.value = withDelay(150, withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }))
  }, [logoOpacity, logoY, cardOpacity, cardY])

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ translateY: logoY.value }] }))
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value, transform: [{ translateY: cardY.value }] }))

  async function handleGoogle() {
    try {
      setLoading(true)
      await signInWithGoogle()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      if (msg !== 'Sign-in cancelled') Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#05060F']}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={[styles.orb, { top: -100, left: -80, backgroundColor: 'rgba(99,102,241,0.12)', width: 300, height: 300 }]} />
      <View style={[styles.orb, { bottom: 0, right: -80, backgroundColor: 'rgba(167,139,250,0.08)', width: 280, height: 280 }]} />

      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={[styles.logoSection, logoStyle]}>
          <LinearGradient
            colors={['#6366F1', '#A78BFA']}
            style={styles.logoCube}
          >
            <View style={styles.logoHighlight} />
            <Text style={styles.logoHeart}>♥</Text>
          </LinearGradient>
          <Text style={styles.appName}>CareCompanion</Text>
          <Text style={styles.tagline}>AI Cancer Care</Text>
        </Animated.View>

        {/* Glass card */}
        <Animated.View style={[styles.card, cardStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          {/* Top glow line */}
          <LinearGradient
            colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.glowLine}
          />

          <Text style={styles.continueWith}>CONTINUE WITH</Text>

          <Pressable
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  orb: { position: 'absolute', borderRadius: 9999 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  logoSection: { alignItems: 'center', gap: 12 },
  logoCube: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logoHighlight: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoHeart: { fontSize: 28, color: '#fff' },
  appName: { fontSize: 30, fontWeight: '700', color: '#EDE9FE' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 24,
    gap: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 12,
  },
  glowLine: { height: 1, marginHorizontal: -24, marginTop: -24, marginBottom: 8 },
  continueWith: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#EDE9FE' },
})
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/login.tsx
git commit -m "feat(mobile): rewrite Login with dark glass design + fade-up entrance"
```

---

### Task 18: Final — typecheck, run, smoke test all screens

- [ ] **Step 1: Full typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 2: Run app**

```bash
npx expo run:ios
```

- [ ] **Step 3: Smoke test checklist**

Walk through each screen and verify:

| Screen | Check |
|--------|-------|
| Login | Fade-up entrance ✓, Google button visible ✓ |
| Home | Gradient background shifts slowly ✓, orbs float ✓, cards stagger in ✓, counter animates 0→N ✓, tilt phone → cards shift ✓ |
| Chat | Send a message → spring pop ✓, soft haptic on AI reply ✓, typing dots pulse ✓ |
| Care | Dots breathe at different speeds ✓, tap checkbox → double haptic + fade ✓, abnormal lab → warning haptic ✓ |
| Scan | Tap Open Camera → laser sweeps ✓, after 3s → particles burst ✓ + success haptic ✓ |
| Settings | Theme toggle → system responds (restart app to fully verify) ✓, Sign Out → confirm alert ✓ |
| Tab bar | Tap tab → bounce + haptic ✓, BlurView background ✓ |
| Drawer | Tap avatar → drawer slides in ✓, tap backdrop → slides out ✓ |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete UI redesign + 7 motion enhancements

- Dark indigo/glass theme with system dark/light mode
- Gyroscope parallax (orbs 0.3x, cards 0.6x)
- Rich haptics (med taken, abnormal lab, AI message, scan success)
- Particle burst on scan success (24 particles, 600ms)
- Animated gradient mesh on Home (20s withRepeat + runOnJS)
- GlassCard press depth (spring scale + JS blur toggle)
- Breathing status dots in Care (green/amber/rose, 3s/1.5s/0.8s)
- Animated number counter with bounce (ReText pattern)"
```
