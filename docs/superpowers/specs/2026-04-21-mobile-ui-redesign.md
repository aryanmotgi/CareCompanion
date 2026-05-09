# CareCompanion iOS App — UI Redesign Spec

## Goal

Redesign the mobile app to match the web app's dark indigo/glass aesthetic, feel like a native iPhone app, support dark + light mode automatically, and include futuristic motion throughout.

---

## Theme System

### `apps/mobile/src/theme.ts`

Single source of truth. All screens import from here. `useTheme()` hook returns the correct palette based on `useColorScheme()` + user override stored in AsyncStorage.

**Dark palette** (default when system is dark or user pins dark):
```
bg:           #0C0E1A
bgWarm:       #10122B
bgCard:       rgba(167,139,250, 0.06)
bgCardBorder: rgba(167,139,250, 0.12)
bgElevated:   rgba(167,139,250, 0.10)
accent:       #6366F1
accentHover:  #818CF8
lavender:     #A78BFA
text:         #EDE9FE
textSub:      #A5B4CF
textMuted:    rgba(255,255,255, 0.35)
green:        #6EE7B7
amber:        #FCD34D
rose:         #FCA5A5
border:       rgba(167,139,250, 0.08)
borderHover:  rgba(167,139,250, 0.18)
```

**Light palette** (system light or user pins light):
```
bg:           #FAFAFA
bgWarm:       #FFFFFF
bgCard:       #FFFFFF
bgCardBorder: rgba(99,102,241, 0.12)
bgElevated:   rgba(99,102,241, 0.04)
accent:       #6366F1
accentHover:  #4F46E5
lavender:     #7C3AED
text:         #1E1B4B
textSub:      #475569
textMuted:    #94A3B8
green:        #059669
amber:        #D97706
rose:         #DC2626
border:       rgba(99,102,241, 0.10)
borderHover:  rgba(99,102,241, 0.20)
```

**Shared tokens:**
```
radiusSm:     10
radiusMd:     14
radiusLg:     20
radiusXl:     24
tabActive:    gradient #A78BFA → #6366F1
shadowCard (dark):  shadowColor: #0F0A28, shadowOffset: {width:0, height:4},
                    shadowOpacity: 0.5, shadowRadius: 24, elevation: 8
shadowCard (light): shadowColor: #6366F1, shadowOffset: {width:0, height:2},
                    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3
```

### `useTheme()` hook

- Reads `useColorScheme()` for system preference
- Reads AsyncStorage key `cc_theme_override` (`'dark' | 'light' | 'system'`)
- Returns the correct palette + `isDark` boolean
- Re-renders when system preference changes

---

## Splash Screen

**File:** `app/splash.tsx` (shown before the auth gate checks SecureStore)

**Sequence (~2.2s total):**
1. Black screen → indigo glow orb fades in at center (300ms)
2. Logo cube materialises: scales from 0.3 → 1.05 → 1.0 with spring physics (400ms)
3. Orbiting ring appears, begins rotating (continuous)
4. Two expanding pulse rings emit from the logo, fade out at radius 80px (staggered, looping)
5. "CareCompanion" text fades + slides up (200ms, delay 600ms)
6. Tagline "AI Cancer Care" fades in (150ms, delay 900ms)
7. Entire screen fades out (300ms, delay 1800ms) → login or tabs

**Implementation:** All via `react-native-reanimated` + `expo-linear-gradient`. No native modules required.

**Logo cube:**
- 72×72px, `borderRadius: 20`, gradient `#6366F1 → #A78BFA`
- Inset highlight: `position:'absolute', top:6, left:6, width:24, height:24, borderRadius:8, backgroundColor:'rgba(255,255,255,0.15)'`
- Heart icon (SVG, 32px, white)
- Continuous slow-rotation illusion: animate `rotateZ` 0° → 360° over 8s loop combined with a subtle `scale` 1.0 → 1.03 → 1.0 pulse to suggest 3D depth. For a true perspective `rotateY`, wrap in a transform array `[{ perspective: 600 }, { rotateY: '360deg' }]` via Reanimated.
- Glow: `shadowColor: '#6366F1', shadowOffset: {width:0, height:0}, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20`

---

## Navigation

### Bottom Tab Bar — `app/(tabs)/_layout.tsx`

5 tabs in order: **Home · Chat · Care · Scan · Settings**

**Active state:**
- Icon fills with gradient `#A78BFA → #6366F1`
- Label same gradient, bold
- Background pill: `rgba(99,102,241, 0.15)`, `borderRadius: 10`
- On tap: spring bounce (translateY -6 → +1 → 0, scale 1 → 1.1 → 1.0) + `Haptics.impactAsync(LIGHT)`
- Glow: `shadowColor: '#6366F1', shadowOffset: {width:0, height:0}, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8`

**Inactive state:** stroke-only icon, `textMuted` colour

**Tab bar container — implemented as a custom `tabBar` prop component:**

The tab bar is a fully custom component passed to `<Tabs tabBar={...}>`. It uses `expo-blur`'s `<BlurView>` to achieve the frosted glass effect.

- Dark: `<BlurView intensity={80} tint="dark">` with a `rgba(10,12,26,0.85)` tint overlay, top border `rgba(167,139,250,0.08)`
- Light: `<BlurView intensity={80} tint="light">` with a `rgba(255,255,255,0.90)` tint overlay, top border `rgba(99,102,241,0.10)`

**Screen transition:** Implement via the custom tab bar component's `onPress` handler — when switching tabs, animate the outgoing screen's opacity from 1→0 and scale from 1→0.96, then animate the incoming screen from opacity 0→1 and scale 0.96→1.0 using `withTiming({ duration: 280, easing: Easing.inOut(Easing.ease) })`. This is achieved by wrapping each tab screen content in a `Reanimated.View` and tracking the active tab in shared state.

### Slide-out Drawer — `src/components/Drawer.tsx`

Triggered by tapping the avatar in the Home header. Slides in from the **left** (following iOS convention; left-to-right swipe gesture also opens it). Width: 75% of screen width.

**Animation:** `translateX` from `-screenWidth * 0.75` → `0` using `withSpring({ damping: 18, stiffness: 160 })` on open, and `withTiming(- screenWidth * 0.75, { duration: 220 })` on close. A semi-transparent backdrop (`rgba(0,0,0,0.5)`) fades in behind the drawer using `withTiming({ duration: 250 })`.

**Contents:**
- User avatar + name + role (Patient / Caregiver)
- Divider
- 🚨 Emergency Card → navigates to `app/emergency.tsx` (red `#FCA5A5` tint)
- 📋 Health Summary → navigates to `app/health-summary.tsx` (indigo `#818CF8` tint)
- 💳 Insurance & Claims → navigates to `app/insurance.tsx` (teal `#34D399` tint)
- Divider
- Sign Out (rose, bottom)

**Background:**
- Dark: solid `#13111F` with a subtle vertical gradient overlay to `#0F0E1A`, right border `rgba(167,139,250,0.15)`
- Light: solid `#FFFFFF` with a subtle vertical gradient overlay to `#F5F3FF`, right border `rgba(99,102,241,0.15)`

---

## Screens

### Login — `app/login.tsx`

**Background:** `#05060F` with 3 absolutely-positioned radial glow orbs (indigo top-left, lavender bottom-right, large indigo center ellipse at 6% opacity). Dot grid overlay at 35% opacity.

**Layout:** Centered column, `justifyContent: 'center'`, `paddingHorizontal: 24`

**Logo section:**
- 64×64 container, `borderRadius: 18`, gradient `#6366F1 → #A78BFA`
- Shadow: `shadowColor: '#6366F1', shadowOffset: {width:0, height:0}, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20`
- Heart SVG icon (white, 32px)
- "CareCompanion" h1: 30px, bold, `#EDE9FE`
- Tagline: 14px, `rgba(255,255,255,0.4)`

**Glass card:**
- `backgroundColor: 'rgba(255,255,255,0.03)'`
- `borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'`
- Blur effect: wrap content in `<BlurView intensity={20} tint="dark">` from `expo-blur`
- Shadow: `shadowColor: '#6366F1', shadowOffset: {width:0, height:20}, shadowOpacity: 0.4, shadowRadius: 60, elevation: 12`
- Top glow line: 1px height View with a `<LinearGradient>` `colors={['transparent', 'rgba(99,102,241,0.6)', 'transparent']}` horizontal

**Inside the card:**
- "CONTINUE WITH" label: 10px uppercase, `rgba(255,255,255,0.25)`, tracking wide
- Google button: `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.12)` border, Google SVG logo + "Continue with Google"
- Consent checkbox: custom styled, indigo gradient when checked, spring pop animation on check
- Error state: red tinted card with alert icon

**Animations:** Entire card `fadeInUp` 0.6s on mount via Reanimated `withTiming`. Staggered delays: logo 0ms, card 150ms, demo link 250ms.

### Home — `app/(tabs)/index.tsx`

**Header:**
- "Good morning / afternoon / evening" (dynamic) — `textMuted`, 11px uppercase tracking
- User's first name — `text`, 22px bold
- Avatar circle (top-right): gradient initials, taps to open drawer

**Cards (stagger entrance, 150ms apart):**
1. **Today's Medications card** — lists today's meds with colour-coded dots (green = taken, amber = upcoming, rose = overdue). Count badge top-right.
2. **Next Appointment card** — appointment name, doctor, date/time in lavender, location in muted.
3. **AI Companion CTA** — gradient border card, sparkle icon, "Ask your AI companion", subtitle "Side effects, dosing questions…". Taps to Chat tab.

**Background:** 2 slow-floating ambient glow orbs (Reanimated, 12–18s loop, `rgba(99,102,241,0.12)` and `rgba(167,139,250,0.08)`).

**Loading state:** Shimmer skeletons in card shapes (lavender shimmer sweep, 1.5s loop).

### Chat — `app/(tabs)/chat.tsx`

**Header:** "AI Companion" title + "Always here for you" subtitle

**Messages:** `FlatList`, inverted
- AI bubble: `bgCard` background, `bgCardBorder` border, rounded with `borderTopLeftRadius:12, borderTopRightRadius:12, borderBottomRightRadius:12, borderBottomLeftRadius:2`, `text` colour
- User bubble: `<LinearGradient colors={['#6366F1','#818CF8']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}>`, white text, rounded with `borderTopLeftRadius:12, borderTopRightRadius:12, borderBottomLeftRadius:12, borderBottomRightRadius:2`
- New message entrance: spring scale from `0.7 → 1.04 → 1.0`, `translateY: 8 → 0`, `withSpring({ damping:12, stiffness:180 })`

**Typing indicator:** 3 lavender dots pulsing with staggered opacity (waiting for AI response)

**Input bar:**
- `bgCard` background, `bgCardBorder` border, `borderRadius: 12`
- Send button: gradient circle, scales to 0.9 on press + glow burst
- `KeyboardAvoidingView` with `behavior: 'padding'` on iOS

### Care — `app/(tabs)/care.tsx`

**Segment control:** "Meds" / "Labs" — `bgElevated` track, active segment `rgba(99,102,241,0.2)` bg + `accentHover` text

**Medications list:**
- Each row: `bgCard` + `bgCardBorder`, `borderRadius: radiusMd`
- Left dot: green (taken), amber (upcoming), rose (overdue)
- Med name + dose: `text`, bold
- Time + status: `textMuted`
- Tap to mark taken: checkbox spring pop → row fades to 50% opacity + strikethrough

**Labs list:**
- Each row: similar card, shows lab name, value, reference range, date
- Value colour: green (normal), amber (borderline), rose (out of range)

**Loading:** shimmer skeletons

### Scan — `app/(tabs)/scan.tsx`

**Idle state:** Dashed border drop zone (indigo dashes), document icon, subtitle text, gradient "Open Camera" button

**Active camera state:**
- Full-screen camera preview
- HUD overlay: corner brackets (indigo, 20px arms), laser line sweeping top→bottom (indigo→emerald gradient, 2px, glow shadow via `shadowColor:'#6366F1', shadowRadius:6`, 1.8s loop)
- "Scanning…" text with animated dots

**Button:** `<LinearGradient colors={['#6366F1','#A78BFA']}>`, shadow glow on press

### Settings — `app/(tabs)/settings.tsx`

**Profile row:** Avatar + name + role, `bgCard` card style

**Appearance section:**
- 3-segment toggle: Light / Dark / System
- Active segment: `rgba(99,102,241,0.2)` + gradient text
- Saves to AsyncStorage `cc_theme_override`

**Sign Out:** Rose-tinted card row, confirms via `Alert`

---

## Enhancements

### 1 — Gyroscope Parallax — `app/(tabs)/index.tsx` + `src/components/AmbientOrbs.tsx`

**Trigger:** Device tilt detected via `expo-sensors` `Gyroscope`.

**Behaviour:** As the user tilts the phone, three depth layers respond at different speeds, creating a parallax illusion:

| Layer | Elements | Speed multiplier |
|-------|----------|-----------------|
| Background | Ambient glow orbs | 0.3× |
| Mid | Cards (Medications, Appointment, CTA) | 0.6× |
| Foreground | Text content inside cards | 1× (stationary — anchored to card) |

**Implementation:**
- Subscribe to `Gyroscope.addListener({ x, y, z })` on screen focus; unsubscribe on blur. Set `Gyroscope.setUpdateInterval(16)` (≈60fps).
- Accumulate tilt using a low-pass filter: `tiltX = tiltX * 0.85 + event.y * 0.15`, `tiltY = tiltY * 0.85 + event.x * 0.15`. This smooths jitter.
- Clamp accumulated tilt to ±15 (degrees equivalent).
- Drive two Reanimated shared values: `gyroX` and `gyroY` (updated via `runOnJS` from the sensor callback, or directly as they're JS-thread values).
- Apply to layers via `useAnimatedStyle`:
  - Orbs: `translateX: gyroX * 0.3 * maxOffset, translateY: gyroY * 0.3 * maxOffset` where `maxOffset = 20`
  - Cards: `translateX: gyroX * 0.6 * maxOffset, translateY: gyroY * 0.6 * maxOffset`
- Card translations are applied to the card wrapper `Reanimated.View`, not the inner content, so text stays crisp.
- On screen unmount, call `subscription.remove()`.

**Accessibility:** Respect `useReducedMotion()` from Reanimated — if true, skip gyroscope subscription and keep everything stationary.

---

### 2 — Rich Haptic Patterns — `src/utils/haptics.ts`

Create a dedicated `haptics.ts` utility (not inline in components) that exports named functions:

```ts
// Medication marked as taken — double tap feel
export async function hapticMedTaken() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80)
}

// Abnormal lab value detected
export async function hapticAbnormalLab() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
}

// New AI message arrives in chat
export function hapticAIMessage() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

// Document scan completed successfully
export async function hapticScanSuccess() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}
```

**Usage sites:**
- `care.tsx` — call `hapticMedTaken()` when user checks off a medication
- `care.tsx` — call `hapticAbnormalLab()` when rendering a lab row with out-of-range value, on first render only (use a ref to track)
- `chat.tsx` — call `hapticAIMessage()` when a new AI message is appended to the list
- `scan.tsx` — call `hapticScanSuccess()` on successful scan, immediately before triggering particle burst

---

### 3 — Particle Burst on Scan Success — `app/(tabs)/scan.tsx`

**Trigger:** Successful document scan (API returns success response).

**Sequence:**
1. `hapticScanSuccess()` fires.
2. 24 particles emit simultaneously from the center of the scan viewport.
3. Each particle travels outward along a random direction with a random speed.
4. All particles fade from `rgba(99,102,241,1)` to `rgba(99,102,241,0)` over 600ms.
5. Particles are removed from the tree after animation completes.

**Implementation:**
- Maintain a `useRef<boolean>` `burstActive` flag.
- On success, set `burstActive = true` which renders 24 `Reanimated.View` elements absolutely positioned at the scan center.
- Each particle: 6×6px circle, `borderRadius: 3`, `backgroundColor: '#6366F1'`.
- For each particle `i`, compute random `angle = Math.random() * 2 * Math.PI` and `speed = 80 + Math.random() * 120` (pixels).
- Drive `translateX`, `translateY`, and `opacity` with three shared values per particle, all started via `withTiming({ duration: 600, easing: Easing.out(Easing.quad) })`.
- At animation end, call `runOnJS(setBurstActive)(false)` to unmount particles.
- Do not use a loop with `withDelay` — start all 24 simultaneously for a true burst feel.

---

### 4 — Animated Gradient Mesh — `app/(tabs)/index.tsx`

**Purpose:** Replace the static `backgroundColor` on the Home screen with a living gradient that breathes over 20 seconds.

**Implementation:**
- Drive a single shared value `progress` from 0→1 using `withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sine) }), -1, true)` (reverse: true for smooth oscillation).
- The `colors` prop of `LinearGradient` is a JS array and cannot be driven via Reanimated's UI-thread `useAnimatedProps`. Instead, use `useAnimatedReaction` to observe `progress` and call `runOnJS(setColors)(interpolated)` whenever the value crosses a threshold — or more simply, update colors with `runOnJS` on each `progress` tick. At a 20-second period the JS re-render cost is negligible.

  ```ts
  const [gradientColors, setGradientColors] = useState(paletteA)

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      const c0 = interpolateColor(p, [0, 1], ['#0C0E1A', '#10122B'])
      const c1 = interpolateColor(p, [0, 1], ['#10122B', '#0C0E1A'])
      const c2 = interpolateColor(p, [0, 1], ['rgba(99,102,241,0.08)', 'rgba(167,139,250,0.12)'])
      const c3 = interpolateColor(p, [0, 1], ['#0C0E1A', '#10122B'])
      runOnJS(setGradientColors)([c0, c1, c2, c3])
    }
  )
  ```
- Render `<LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>`.
- In light mode, oscillate between `['#FAFAFA', '#F5F3FF', 'rgba(99,102,241,0.04)', '#FAFAFA']` and `['#F5F3FF', '#FAFAFA', 'rgba(99,102,241,0.07)', '#F5F3FF']` using the same pattern.

---

### 5 — Press-and-Hold Depth Effect — `src/components/GlassCard.tsx`

**Trigger:** `onPressIn` / `onPressOut` on the card's `Pressable` wrapper.

**Press-in state:**
- Scale: `withSpring(0.97, { damping: 20, stiffness: 300 })`
- Blur intensity: `expo-blur`'s `intensity` prop is not natively animatable via Reanimated's UI thread. Implement as a JS-thread state toggle: on `onPressIn` call `setBlurIntensity(30)`, on `onPressOut` call `setBlurIntensity(20)`. The step change is acceptable for a press effect; the scale spring provides the perceptible smoothness.
- Border: `interpolateColor(pressed, [0, 1], [theme.bgCardBorder, theme.borderHover])` via `useAnimatedStyle` on the border View — this works because the border View is a plain `Reanimated.View`, not a native prop of BlurView.

**Press-out state:**
- Scale: `withSpring(1.0, { damping: 15, stiffness: 200 })`
- Blur intensity: `setBlurIntensity(20)` (JS state)
- Border: returns to `theme.bgCardBorder`

**Props added to `GlassCard`:**
```ts
interface GlassCardProps {
  onPress?: () => void
  // existing children, style, etc.
}
```
The depth effect is always present; `onPress` is passed through to the underlying `Pressable`.

---

### 6 — Breathing Pulse on Status Dots — `app/(tabs)/care.tsx`

Each medication status dot (the coloured circle on the left of a row) is wrapped in a `Reanimated.View` with a continuously looping scale + opacity animation. The animation speed communicates urgency.

| Status | Colour | Scale range | Opacity range | Period |
|--------|--------|-------------|---------------|--------|
| Taken  | Green  | 1.0 → 1.2 → 1.0 | 0.6 → 1.0 → 0.6 | 3 000ms |
| Upcoming | Amber | 1.0 → 1.3 → 1.0 | 0.6 → 1.0 → 0.6 | 1 500ms |
| Overdue | Rose | 1.0 → 1.4 → 1.0 | 0.6 → 1.0 → 0.6 | 800ms |

**Implementation per dot:**
```ts
const scale = useSharedValue(1)
const opacity = useSharedValue(0.6)

useEffect(() => {
  scale.value = withRepeat(
    withSequence(
      withTiming(maxScale, { duration: period / 2, easing: Easing.inOut(Easing.sine) }),
      withTiming(1.0,      { duration: period / 2, easing: Easing.inOut(Easing.sine) })
    ), -1, false
  )
  opacity.value = withRepeat(
    withSequence(
      withTiming(1.0, { duration: period / 2 }),
      withTiming(0.6, { duration: period / 2 })
    ), -1, false
  )
}, [])
```

**Accessibility:** If `useReducedMotion()` is true, skip the pulse — dots render as static circles.

---

### 7 — Animated Number Counter — `app/(tabs)/index.tsx`

All numeric stat displays on the Home screen (e.g. medication count badge, appointment countdown) animate from 0 to their final value on mount.

**Implementation:**
- Use a `useSharedValue(0)` driven by `withTiming(finalValue, { duration: 800, easing: Easing.out(Easing.cubic) })`.
- Display using the **ReText pattern**: `Animated.createAnimatedComponent(TextInput)` with `editable={false}` and `pointerEvents="none"`. React Native's `Text` component has no `text` prop — `TextInput` does, and Reanimated v3 has special handling for it:

  ```ts
  const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(val.value)),
  }))

  <AnimatedTextInput
    editable={false}
    animatedProps={animatedProps}
    style={styles.counter}
  />
  ```

- **Bounce on completion:** Chain `withSequence(withTiming(finalValue + 1, { duration: 800, easing: Easing.out(Easing.cubic) }), withSpring(finalValue, { damping: 6, stiffness: 300 }))` so the number briefly overshoots by 1 then springs back.
- The counter restarts if `finalValue` changes (e.g., after data refresh) — reset shared value to 0 in a `useEffect` dep on `finalValue`.

---

## Motion System Summary

| Effect | Trigger | Implementation |
|--------|---------|----------------|
| Ambient orbs | Always on (background) | Reanimated `withRepeat` + `withSequence`, `translateX/Y` |
| Card stagger | Screen mount | Reanimated `withDelay` + `withSpring`, `translateY + opacity` |
| Tab bounce + glow | Tab press | `withSpring({ damping:10, stiffness:200 })` + `Haptics.impactAsync` |
| Screen crossfade | Tab change | Custom tab bar component: `withTiming(280ms, easeInOut)` on opacity + scale |
| Shimmer skeleton | Data loading | Reanimated `withRepeat(withTiming)` + `LinearGradient` |
| Chat spring pop | New message | `withSpring({ damping:12, stiffness:180 })` on scale + translateY |
| Button glow + press | Press in/out | `withSpring` scale 0.96 + `withTiming` opacity on glow overlay |
| Med check-off | Row tap | `withSpring` on checkmark scale + `withTiming` on row opacity |
| Scan laser | Camera active | `withRepeat(withTiming(1800ms))` on `translateY` |
| Splash sequence | App launch | Chained `withTiming` + `withSpring` with delays |
| Gyroscope parallax | Device tilt | `expo-sensors` Gyroscope → shared values → `translateX/Y` at 0.3×/0.6× |
| Gradient mesh | Always on (Home bg) | `withRepeat(withTiming(20s))` progress → `useAnimatedReaction` + `runOnJS(setColors)` |
| GlassCard press depth | Press in/out | `withSpring` scale 0.97 + JS-state `setBlurIntensity` toggle + `interpolateColor` border |
| Dot breathing pulse | Always on (Care screen) | `withRepeat(withSequence(...))` scale + opacity per status |
| Particle burst | Scan success | 24 Reanimated Views, `withTiming(600ms)` on translateX/Y + opacity |
| Number counter | Screen mount / data load | `withTiming(800ms, easeOut)` + `withSpring` bounce on final value |
| Haptic: med taken | Checkbox tap | `ImpactFeedbackStyle.Medium` then `Light` after 80ms |
| Haptic: abnormal lab | Lab row render | `NotificationFeedbackType.Warning` |
| Haptic: AI message | Message received | `ImpactFeedbackStyle.Light` |
| Haptic: scan success | Scan complete | `NotificationFeedbackType.Success` |

---

## File Structure

```
apps/mobile/
├── app/
│   ├── splash.tsx              NEW — animated splash screen
│   ├── login.tsx               REWRITE — dark glass design
│   ├── emergency.tsx           NEW — emergency card screen (from drawer)
│   ├── health-summary.tsx      NEW — health summary screen (from drawer)
│   ├── insurance.tsx           NEW — insurance & claims screen (from drawer)
│   ├── _layout.tsx             UPDATE — add splash gate, drawer provider
│   └── (tabs)/
│       ├── _layout.tsx         REWRITE — new tab bar with animations
│       ├── index.tsx           REWRITE — home dashboard
│       ├── chat.tsx            REWRITE — spring messages
│       ├── care.tsx            REWRITE — meds/labs with check-off
│       ├── scan.tsx            REWRITE — laser HUD
│       └── settings.tsx        NEW — profile + theme toggle
└── src/
    ├── theme.ts                NEW — design tokens + useTheme()
    ├── components/
    │   ├── Drawer.tsx          NEW — slide-out drawer
    │   ├── GlassCard.tsx       NEW — reusable glass/elevated card (press depth effect)
    │   ├── ShimmerSkeleton.tsx NEW — loading placeholder
    │   ├── AmbientOrbs.tsx     NEW — floating background orbs (gyro-driven)
    │   ├── ParticleBurst.tsx   NEW — 24-particle burst on scan success
    │   └── AnimatedCounter.tsx NEW — 0→N number counter with bounce
    ├── utils/
    │   └── haptics.ts          NEW — named haptic pattern functions
    └── services/
        ├── auth.ts             UPDATE — dismissAuthSession fix
        └── api.ts              (unchanged)
```

---

## Dependencies Required

All already available in Expo SDK 52:
- `react-native-reanimated` — all animations
- `expo-haptics` — haptic feedback on tab press, button press, and rich patterns
- `expo-blur` — glassmorphism `<BlurView>` on tab bar, login card, and GlassCard press depth
- `expo-linear-gradient` — gradients throughout + animated gradient mesh
- `expo-sensors` — `Gyroscope` for parallax depth effect on Home screen
- `@react-native-async-storage/async-storage` — theme override persistence
- `expo-secure-store` — session token (existing)

No new native packages needed.
