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
    │   ├── GlassCard.tsx       NEW — reusable glass/elevated card
    │   ├── ShimmerSkeleton.tsx NEW — loading placeholder
    │   └── AmbientOrbs.tsx     NEW — floating background orbs
    └── services/
        ├── auth.ts             UPDATE — dismissAuthSession fix
        └── api.ts              (unchanged)
```

---

## Dependencies Required

All already available in Expo SDK 52:
- `react-native-reanimated` — all animations
- `expo-haptics` — haptic feedback on tab press + button press
- `expo-blur` — glassmorphism `<BlurView>` on tab bar and login card
- `expo-linear-gradient` — gradients throughout
- `@react-native-async-storage/async-storage` — theme override persistence
- `expo-secure-store` — session token (existing)

No new native packages needed.
