import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
  Linking,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  Extrapolate,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useWelcomeContext } from './_layout'

export const WELCOME_SEEN_KEY = 'cc-welcome-seen'
// Persist-only helper; the provider's markSeen handles the synchronous UI state.
export async function markWelcomeSeen() {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1')
}

const { width: SW, height: SH } = Dimensions.get('window')

const SCENE_DURATION = 5200
const CROSSFADE = 700

const APPLE_EASE = Easing.bezier(0.32, 0.72, 0, 1)

// ---------------- Scene definitions ----------------

type SceneId = 'meds' | 'chat' | 'trials' | 'timeline'

type Scene = {
  id: SceneId
  title: string
  subtitle: string
  // gradient color stops (top → bottom)
  grad: [string, string, string]
  // accent for foreground UI
  accent: string
}

const SCENES: Scene[] = [
  {
    id: 'meds',
    title: 'Never miss a dose.',
    subtitle: 'Smart reminders that adapt to your schedule — no more forgotten meds.',
    grad: ['#1A0A2E', '#3B1064', '#1A0A2E'],
    accent: '#C084FC',
  },
  {
    id: 'chat',
    title: 'An AI that knows your case.',
    subtitle: 'Trained on your records. Answers in seconds. No medical jargon.',
    grad: ['#0A0E2E', '#1E1B6B', '#0A0E2E'],
    accent: '#818CF8',
  },
  {
    id: 'trials',
    title: 'Trials, matched for you.',
    subtitle: 'We scan thousands of clinical trials so you don\'t have to.',
    grad: ['#021A1F', '#064E5C', '#021A1F'],
    accent: '#22D3EE',
  },
  {
    id: 'timeline',
    title: 'Every milestone, in one view.',
    subtitle: 'From diagnosis to remission. Your whole journey, finally organized.',
    grad: ['#2A0E0A', '#5C1F0A', '#2A0E0A'],
    accent: '#FB923C',
  },
]

// =================================================================
// BACKGROUND
// =================================================================

// One LinearGradient per scene, crossfaded via opacity.
function BackgroundLayer({ index }: { index: number }) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {SCENES.map((s, i) => (
        <FadeGradient key={s.id} colors={s.grad} active={i === index} />
      ))}
    </View>
  )
}

function FadeGradient({ colors, active }: { colors: [string, string, string]; active: boolean }) {
  const op = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    op.value = withTiming(active ? 1 : 0, { duration: CROSSFADE, easing: APPLE_EASE })
    return () => cancelAnimation(op)
  }, [active])
  const style = useAnimatedStyle(() => ({ opacity: op.value }))
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, style]}>
      <LinearGradient
        colors={colors}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  )
}

// Two drifting blurred orbs that pick up the active scene's accent.
function DriftOrbs({ index }: { index: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true)
    return () => cancelAnimation(t)
  }, [])

  const colorA = useSharedValue(SCENES[0].accent)
  const colorB = useSharedValue(SCENES[1].accent)
  useEffect(() => {
    const next = SCENES[index].accent
    const next2 = SCENES[(index + 1) % SCENES.length].accent
    colorA.value = withTiming(next, { duration: CROSSFADE + 200, easing: APPLE_EASE }) as unknown as string
    colorB.value = withTiming(next2, { duration: CROSSFADE + 200, easing: APPLE_EASE }) as unknown as string
  }, [index])

  const orb1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-SW * 0.2, SW * 0.15]) },
      { translateY: interpolate(t.value, [0, 1], [-SH * 0.05, SH * 0.1]) },
      { scale: interpolate(t.value, [0, 1], [1, 1.15]) },
    ],
    backgroundColor: colorA.value,
  }))
  const orb2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [SW * 0.15, -SW * 0.1]) },
      { translateY: interpolate(t.value, [0, 1], [SH * 0.2, SH * 0.05]) },
      { scale: interpolate(t.value, [0, 1], [1.1, 0.95]) },
    ],
    backgroundColor: colorB.value,
  }))

  return (
    <>
      <Animated.View style={[styles.orb, { top: -SW * 0.3, left: -SW * 0.2 }, orb1]} />
      <Animated.View style={[styles.orb, { top: SH * 0.15, right: -SW * 0.3 }, orb2]} />
    </>
  )
}

function NoiseVeil() {
  // Cheap film-grain — many tiny semi-transparent dots in a fixed pseudo-random pattern.
  // Pure JS; no asset required.
  const dots = useRef<{ x: number; y: number; o: number }[]>(
    Array.from({ length: 90 }).map((_, i) => ({
      x: (i * 137.508) % SW,
      y: (i * 211.07) % SH,
      o: 0.025 + ((i * 7) % 5) * 0.01,
    }))
  ).current
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: 1.5,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: 'white',
            opacity: d.o,
          }}
        />
      ))}
    </View>
  )
}

// =================================================================
// HELPER COMPONENTS
// =================================================================

function CountUp({
  to,
  duration = 1200,
  format = (n: number) => String(n),
  style,
}: {
  to: number
  duration?: number
  format?: (n: number) => string
  style?: any
}) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(to * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <Text style={style}>{format(val)}</Text>
}

// =================================================================
// SCENE 1: MEDICATIONS
// =================================================================

type Med = { name: string; dose: string; time: string; icon: keyof typeof Ionicons.glyphMap; color: string }
const MEDS: Med[] = [
  { name: 'Trastuzumab', dose: '420 mg · IV', time: '9:00 AM',  icon: 'medical',       color: '#C084FC' },
  { name: 'Tamoxifen',   dose: '20 mg · oral', time: '12:00 PM', icon: 'leaf-outline',  color: '#22D3EE' },
  { name: 'Lisinopril',  dose: '10 mg · oral', time: '8:00 AM',  icon: 'water-outline', color: '#F472B6' },
  { name: 'Lorazepam',   dose: '0.5 mg · PRN', time: 'as needed',icon: 'shield-outline',color: '#FB923C' },
]

function ProgressRing({ progress, accent, size = 96, stroke = 8, active }: any) {
  const p = useSharedValue(0)
  useEffect(() => {
    if (active) {
      p.value = 0
      p.value = withDelay(200, withTiming(progress, { duration: 1400, easing: APPLE_EASE }))
    } else {
      cancelAnimation(p); p.value = 0
    }
    return () => cancelAnimation(p)
  }, [active, progress])
  // Approximate arc with a rotating half-circle mask.
  // Visually: a colored arc that "fills" 0 → progress.
  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${interpolate(p.value, [0, 1], [-180, 180])}deg` }],
  }))
  const innerOpacity = useAnimatedStyle(() => ({ opacity: p.value }))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: '#FFFFFF1A',
        }}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderTopColor: accent,
            borderRightColor: accent,
          },
          arcStyle,
        ]}
      />
      <Animated.View style={[{ alignItems: 'center' }, innerOpacity]}>
        <Text style={[styles.ringBig, { color: accent }]}>5</Text>
        <Text style={styles.ringSmall}>of 8 today</Text>
      </Animated.View>
    </View>
  )
}

function MedTile({ index, med, active }: { index: number; med: Med; active: boolean }) {
  const op = useSharedValue(0)
  const ty = useSharedValue(40)
  const rot = useSharedValue(-3 + (index % 2) * 6)
  useEffect(() => {
    if (active) {
      op.value = 0; ty.value = 40; rot.value = -3 + (index % 2) * 6
      const delay = 380 + index * 130
      op.value = withDelay(delay, withTiming(1, { duration: 420, easing: APPLE_EASE }))
      ty.value = withDelay(delay, withSpring(0, { damping: 12, stiffness: 110 }))
      rot.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 120 }))
    } else {
      cancelAnimation(op); cancelAnimation(ty); cancelAnimation(rot)
      op.value = 0
    }
    return () => { cancelAnimation(op); cancelAnimation(ty); cancelAnimation(rot) }
  }, [active, index])
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }, { rotateZ: `${rot.value}deg` }],
  }))
  return (
    <Animated.View style={[styles.medTile, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[styles.medDot, { backgroundColor: med.color }]}>
        <Ionicons name={med.icon} size={14} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.medName} numberOfLines={1}>{med.name}</Text>
        <Text style={styles.medDose} numberOfLines={1}>{med.dose}</Text>
      </View>
      <Text style={styles.medTime}>{med.time}</Text>
    </Animated.View>
  )
}

function MedsScene({ active, accent }: { active: boolean; accent: string }) {
  return (
    <View style={styles.scenePad}>
      <View style={styles.medsHeader}>
        <ProgressRing progress={5 / 8} accent={accent} active={active} />
        <View style={{ marginLeft: 18, flex: 1 }}>
          <Text style={styles.medsHeaderLabel}>TODAY'S DOSES</Text>
          <Text style={styles.medsHeaderTitle}>3 more to go</Text>
          <View style={[styles.medsBadge, { backgroundColor: accent + '22' }]}>
            <Ionicons name="time-outline" size={12} color={accent} />
            <Text style={[styles.medsBadgeText, { color: accent }]}>Next: 12:00 PM</Text>
          </View>
        </View>
      </View>

      <View style={styles.medsList}>
        {MEDS.map((m, i) => <MedTile key={m.name} index={i} med={m} active={active} />)}
      </View>
    </View>
  )
}

// =================================================================
// SCENE 3: CHAT
// =================================================================

function Sparkle({ x, y, delay, accent }: any) {
  const s = useSharedValue(0)
  const op = useSharedValue(0)
  useEffect(() => {
    s.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1.4, { duration: 600 }), withTiming(0, { duration: 600 })), -1, false)
    )
    op.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })), -1, false)
    )
    return () => { cancelAnimation(s); cancelAnimation(op) }
  }, [delay])
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: s.value }],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Ionicons name="sparkles" size={12} color={accent} />
    </Animated.View>
  )
}

function ChatScene({ active, accent }: { active: boolean; accent: string }) {
  const askOp = useSharedValue(0)
  const askY = useSharedValue(20)
  const dotsOp = useSharedValue(0)
  const replyOp = useSharedValue(0)
  const replyY = useSharedValue(16)
  const chip1 = useSharedValue(0)
  const chip2 = useSharedValue(0)

  useEffect(() => {
    if (active) {
      askOp.value = 0; askY.value = 20
      dotsOp.value = 0
      replyOp.value = 0; replyY.value = 16
      chip1.value = 0; chip2.value = 0

      askOp.value = withTiming(1, { duration: 380, easing: APPLE_EASE })
      askY.value = withSpring(0, { damping: 14, stiffness: 130 })

      dotsOp.value = withDelay(700, withTiming(1, { duration: 280 }))
      dotsOp.value = withDelay(2400, withTiming(0, { duration: 200 }))

      replyOp.value = withDelay(2600, withTiming(1, { duration: 420, easing: APPLE_EASE }))
      replyY.value = withDelay(2600, withSpring(0, { damping: 14, stiffness: 130 }))

      chip1.value = withDelay(3500, withTiming(1, { duration: 400 }))
      chip2.value = withDelay(3700, withTiming(1, { duration: 400 }))
    } else {
      [askOp, askY, dotsOp, replyOp, replyY, chip1, chip2].forEach(cancelAnimation)
      askOp.value = 0; replyOp.value = 0; chip1.value = 0; chip2.value = 0
    }
    return () => {
      [askOp, askY, dotsOp, replyOp, replyY, chip1, chip2].forEach(cancelAnimation)
    }
  }, [active])

  const askStyle = useAnimatedStyle(() => ({
    opacity: askOp.value, transform: [{ translateY: askY.value }],
  }))
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dotsOp.value }))
  const replyStyle = useAnimatedStyle(() => ({
    opacity: replyOp.value, transform: [{ translateY: replyY.value }],
  }))
  const chip1Style = useAnimatedStyle(() => ({
    opacity: chip1.value,
    transform: [{ translateY: interpolate(chip1.value, [0, 1], [10, 0]) }],
  }))
  const chip2Style = useAnimatedStyle(() => ({
    opacity: chip2.value,
    transform: [{ translateY: interpolate(chip2.value, [0, 1], [10, 0]) }],
  }))

  return (
    <View style={styles.scenePad}>
      <View style={styles.chatAvatarRow}>
        <View style={[styles.aiAvatar, { backgroundColor: accent + '33', borderColor: accent }]}>
          <Ionicons name="sparkles" size={14} color={accent} />
          <Sparkle x={-6} y={-6} delay={0} accent={accent} />
          <Sparkle x={28} y={-4} delay={600} accent={accent} />
          <Sparkle x={32} y={26} delay={1200} accent={accent} />
        </View>
        <View>
          <Text style={styles.aiName}>CareCompanion AI</Text>
          <View style={styles.dotRow}>
            <View style={[styles.liveDot, { backgroundColor: accent }]} />
            <Text style={styles.aiStatus}>Trained on your care plan</Text>
          </View>
        </View>
      </View>

      <Animated.View style={[styles.bubbleUser, askStyle]}>
        <Text style={styles.bubbleUserText}>
          Will I feel nauseous after my Herceptin infusion?
        </Text>
      </Animated.View>

      <View style={styles.bubbleAiWrap}>
        <Animated.View style={[styles.bubbleAi, { backgroundColor: accent }, replyStyle]}>
          <Text style={styles.bubbleAiText}>
            Nausea is uncommon with Trastuzumab — most patients don't experience it,
            but if you do, anti-nausea meds work well alongside it.
          </Text>
        </Animated.View>
        <Animated.View style={[styles.typingRow, dotsStyle]}>
          <View style={[styles.typingDot, { backgroundColor: 'white' }]} />
          <View style={[styles.typingDot, { backgroundColor: 'white' }]} />
          <View style={[styles.typingDot, { backgroundColor: 'white' }]} />
        </Animated.View>
      </View>

      <View style={styles.chipsRow}>
        <Animated.View style={[styles.chip, chip1Style]}>
          <Text style={styles.chipText}>How long does it take?</Text>
        </Animated.View>
        <Animated.View style={[styles.chip, chip2Style]}>
          <Text style={styles.chipText}>Side effects?</Text>
        </Animated.View>
      </View>
    </View>
  )
}

// =================================================================
// SCENE 4: CLINICAL TRIAL SCANNER  (showpiece)
// =================================================================

function RadarRing({ delay, size, accent, active }: any) {
  const scale = useSharedValue(0.6)
  const op = useSharedValue(0)
  useEffect(() => {
    if (active) {
      scale.value = 0.6; op.value = 0
      scale.value = withDelay(
        delay,
        withRepeat(withTiming(1.6, { duration: 2400, easing: Easing.out(Easing.cubic) }), -1, false)
      )
      op.value = withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(0.7, { duration: 200 }), withTiming(0, { duration: 2200 })),
          -1,
          false
        )
      )
    } else {
      cancelAnimation(scale); cancelAnimation(op)
      op.value = 0
    }
    return () => { cancelAnimation(scale); cancelAnimation(op) }
  }, [active, delay])
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: scale.value }],
  }))
  return (
    <Animated.View
      style={[
        styles.radarRing,
        { width: size, height: size, borderRadius: size / 2, borderColor: accent },
        style,
      ]}
    />
  )
}

function RadarSweep({ accent, active }: any) {
  const r = useSharedValue(0)
  useEffect(() => {
    if (active) {
      r.value = 0
      r.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(r); r.value = 0
    }
    return () => cancelAnimation(r)
  }, [active])
  const style = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${interpolate(r.value, [0, 1], [0, 360])}deg` }],
  }))
  return (
    <Animated.View style={[styles.sweepWrap, style]}>
      <LinearGradient
        colors={[accent + '00', accent + 'AA', accent + 'FF']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.sweepArm}
      />
    </Animated.View>
  )
}

function RadarBlip({ x, y, delay, accent, active }: any) {
  const op = useSharedValue(0)
  const scale = useSharedValue(0.4)
  useEffect(() => {
    if (active) {
      op.value = 0; scale.value = 0.4
      op.value = withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0.4, { duration: 1700 })), -1, true)
      )
      scale.value = withDelay(
        delay,
        withRepeat(withSequence(withSpring(1.2, { damping: 8, stiffness: 200 }), withTiming(1, { duration: 1800 })), -1, true)
      )
    } else {
      cancelAnimation(op); cancelAnimation(scale)
      op.value = 0
    }
    return () => { cancelAnimation(op); cancelAnimation(scale) }
  }, [active, delay])
  const style = useAnimatedStyle(() => ({
    opacity: op.value, transform: [{ scale: scale.value }],
  }))
  return (
    <Animated.View
      style={[styles.blip, { left: x, top: y, backgroundColor: accent, shadowColor: accent }, style]}
    />
  )
}

type Trial = { code: string; phase: string; match: number; tag: string; delay: number }
const TRIALS: Trial[] = [
  { code: 'AURA22 · Osimertinib', phase: 'PHASE III', match: 94, tag: 'Active enrollment', delay: 900 },
  { code: 'ARROW-LUNG',            phase: 'PHASE II',  match: 87, tag: 'FDA fast-track',    delay: 1500 },
  { code: 'ATEZO-Plus',            phase: 'PHASE III', match: 81, tag: 'Open · Boston',     delay: 2100 },
]

function TrialCard({ trial, accent, active }: any) {
  const op = useSharedValue(0)
  const tx = useSharedValue(40)
  useEffect(() => {
    if (active) {
      op.value = 0; tx.value = 40
      op.value = withDelay(trial.delay, withTiming(1, { duration: 440, easing: APPLE_EASE }))
      tx.value = withDelay(trial.delay, withSpring(0, { damping: 14, stiffness: 120 }))
    } else {
      cancelAnimation(op); cancelAnimation(tx)
      op.value = 0
    }
    return () => { cancelAnimation(op); cancelAnimation(tx) }
  }, [active])
  const style = useAnimatedStyle(() => ({
    opacity: op.value, transform: [{ translateX: tx.value }],
  }))
  return (
    <Animated.View style={[styles.trialCard, style]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ flex: 1 }}>
        <Text style={styles.trialCode}>{trial.code}</Text>
        <View style={styles.dotRow}>
          <Text style={[styles.trialPhase, { color: accent }]}>{trial.phase}</Text>
          <Text style={styles.trialTag}>· {trial.tag}</Text>
        </View>
      </View>
      <View style={[styles.matchPill, { borderColor: accent }]}>
        <Text style={[styles.matchNum, { color: accent }]}>{trial.match}</Text>
        <Text style={[styles.matchUnit, { color: accent }]}>% MATCH</Text>
      </View>
    </Animated.View>
  )
}

function TrialsScene({ active, accent }: { active: boolean; accent: string }) {
  const labelOp = useSharedValue(0)
  useEffect(() => {
    if (active) {
      labelOp.value = 0
      labelOp.value = withDelay(2600, withTiming(1, { duration: 600 }))
    } else {
      cancelAnimation(labelOp); labelOp.value = 0
    }
    return () => cancelAnimation(labelOp)
  }, [active])
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOp.value }))
  const scanningStyle = useAnimatedStyle(() => ({ opacity: 1 - labelOp.value }))

  return (
    <View style={styles.scenePad}>
      <View style={styles.radarWrap}>
        {[180, 140, 100, 64].map((sz, i) => (
          <RadarRing key={i} size={sz} delay={i * 280} accent={accent} active={active} />
        ))}
        <View style={[styles.radarRing, { width: 180, height: 180, borderRadius: 90, borderColor: accent + '33' }]} />
        <View style={[styles.radarRing, { width: 130, height: 130, borderRadius: 65, borderColor: accent + '22' }]} />
        <View style={[styles.radarCore, { backgroundColor: accent }]}>
          <Ionicons name="scan-circle" size={18} color="#021A1F" />
        </View>
        <RadarSweep accent={accent} active={active} />
        <RadarBlip x={28}  y={20}  delay={400}  accent={accent} active={active} />
        <RadarBlip x={130} y={42}  delay={900}  accent={accent} active={active} />
        <RadarBlip x={156} y={120} delay={1500} accent={accent} active={active} />
        <View style={styles.scanLabelWrap}>
          <Animated.Text style={[styles.scanLabel, scanningStyle]}>SCANNING …</Animated.Text>
          <Animated.Text style={[styles.scanLabelFound, { color: accent }, labelStyle]}>
            3 MATCHES FOUND
          </Animated.Text>
        </View>
      </View>

      <View style={styles.trialsList}>
        {TRIALS.map((t) => <TrialCard key={t.code} trial={t} accent={accent} active={active} />)}
      </View>
    </View>
  )
}

// =================================================================
// SCENE 5: CARE TIMELINE
// =================================================================

type Event = { label: string; meta: string; icon: keyof typeof Ionicons.glyphMap; state: 'past' | 'now' | 'future' }
const EVENTS: Event[] = [
  { label: 'Diagnosis',          meta: 'Jan 2025', icon: 'document-text-outline', state: 'past' },
  { label: 'Lumpectomy',         meta: 'Mar 2025', icon: 'medkit-outline',       state: 'past' },
  { label: 'Chemo · Cycle 4',    meta: 'Today',    icon: 'pulse',                state: 'now' },
  { label: 'Cycle 5 Infusion',   meta: 'May 24',   icon: 'time-outline',         state: 'future' },
  { label: 'Follow-up Scan',     meta: 'Jul 12',   icon: 'scan-outline',         state: 'future' },
]

function TimelineNode({ index, e, accent, active }: any) {
  const op = useSharedValue(0)
  const tx = useSharedValue(20)
  useEffect(() => {
    if (active) {
      op.value = 0; tx.value = 20
      const delay = 500 + index * 200
      op.value = withDelay(delay, withTiming(1, { duration: 360, easing: APPLE_EASE }))
      tx.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 130 }))
    } else {
      cancelAnimation(op); cancelAnimation(tx)
      op.value = 0
    }
    return () => { cancelAnimation(op); cancelAnimation(tx) }
  }, [active, index])
  const style = useAnimatedStyle(() => ({
    opacity: op.value, transform: [{ translateX: tx.value }],
  }))

  const pulse = useSharedValue(0)
  useEffect(() => {
    if (active && e.state === 'now') {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })),
        -1,
        false
      )
    } else {
      cancelAnimation(pulse); pulse.value = 0
    }
    return () => cancelAnimation(pulse)
  }, [active, e.state])
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.2]) }],
  }))

  const isNow = e.state === 'now'
  const isFuture = e.state === 'future'
  return (
    <Animated.View style={[styles.timelineRow, style]}>
      <View
        style={[
          styles.timelineDot,
          isNow && { backgroundColor: accent, borderColor: accent },
          isFuture && { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: '#FFFFFF55' },
        ]}
      >
        <Ionicons name={e.icon} size={13} color={isFuture ? '#FFFFFF88' : isNow ? '#1A0A0A' : 'white'} />
        {isNow && <Animated.View style={[styles.pulseRing, { borderColor: accent }, pulseStyle]} />}
      </View>
      <View style={styles.timelineCard}>
        <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.timelineLabel, isFuture && { color: '#FFFFFF88' }]}>{e.label}</Text>
          <Text style={styles.timelineMeta}>{e.meta}</Text>
        </View>
        {isNow && (
          <View style={[styles.nowBadge, { backgroundColor: accent }]}>
            <Text style={styles.nowBadgeText}>NOW</Text>
          </View>
        )}
      </View>
    </Animated.View>
  )
}

function TimelineLineFG({ accent, active }: any) {
  const op = useSharedValue(0)
  useEffect(() => {
    op.value = withDelay(active ? 300 : 0, withTiming(active ? 1 : 0, { duration: active ? 700 : 200 }))
    return () => cancelAnimation(op)
  }, [active])
  const style = useAnimatedStyle(() => ({ opacity: op.value }))
  return (
    <Animated.View style={[styles.timelineLineFg, { backgroundColor: accent + '99' }, style]} />
  )
}

function TimelineScene({ active, accent }: { active: boolean; accent: string }) {
  return (
    <View style={styles.scenePad}>
      <View style={styles.timelineWrap}>
        <View style={[styles.timelineLineBase, { backgroundColor: '#FFFFFF1A' }]} />
        <TimelineLineFG accent={accent} active={active} />
        {EVENTS.map((e, i) => (
          <TimelineNode key={e.label} index={i} e={e} accent={accent} active={active} />
        ))}
      </View>
    </View>
  )
}

// =================================================================
// CYCLING TITLE / SUBTITLE
// =================================================================

function CopyBlock({ scene }: { scene: Scene }) {
  return (
    <View style={styles.copyBlock} pointerEvents="none">
      <View style={styles.titleRow}>
        {scene.title.split(' ').map((w, i) => <Word key={scene.id + '-t-' + i} text={w} index={i} sceneId={scene.id} bold />)}
      </View>
      <Text style={styles.subtitle}>{scene.subtitle}</Text>
    </View>
  )
}

function Word({ text, index, sceneId, bold }: { text: string; index: number; sceneId: SceneId; bold?: boolean }) {
  const op = useSharedValue(0)
  const ty = useSharedValue(14)
  useEffect(() => {
    op.value = 0; ty.value = 14
    op.value = withDelay(index * 80, withTiming(1, { duration: 520, easing: APPLE_EASE }))
    ty.value = withDelay(index * 80, withSpring(0, { damping: 16, stiffness: 130 }))
    return () => { cancelAnimation(op); cancelAnimation(ty) }
  }, [sceneId, index])
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }))
  return (
    <Animated.Text style={[bold ? styles.title : styles.subtitle, style, { marginRight: 8 }]}>
      {text}
    </Animated.Text>
  )
}

// =================================================================
// SCENE WRAPPER
// =================================================================

function SceneSlot({
  active,
  topPad,
  children,
}: {
  active: boolean
  topPad: number
  children: React.ReactNode
}) {
  const op = useSharedValue(active ? 1 : 0)
  const sc = useSharedValue(active ? 1 : 0.98)
  useEffect(() => {
    op.value = withTiming(active ? 1 : 0, { duration: CROSSFADE, easing: APPLE_EASE })
    sc.value = withTiming(active ? 1 : 0.98, { duration: CROSSFADE, easing: APPLE_EASE })
    return () => { cancelAnimation(op); cancelAnimation(sc) }
  }, [active])
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: sc.value }],
  }))
  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, style, { justifyContent: 'flex-start', paddingTop: topPad }]}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  )
}

// =================================================================
// SCREEN
// =================================================================

export default function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { markSeen } = useWelcomeContext()
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SCENES.length), SCENE_DURATION)
    return () => clearInterval(id)
  }, [])

  function handleGetStarted() {
    markSeen()
    void markWelcomeSeen()
    router.push('/signup' as any)
  }
  function handleSignIn() {
    markSeen()
    void markWelcomeSeen()
    router.push('/login')
  }

  const current = SCENES[idx]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <BackgroundLayer index={idx} />
      <DriftOrbs index={idx} />
      <NoiseVeil />

      <View style={styles.stage}>
        <SceneSlot active={idx === 0} topPad={insets.top + 48}><MedsScene     active={idx === 0} accent={SCENES[0].accent} /></SceneSlot>
        <SceneSlot active={idx === 1} topPad={insets.top + 48}><ChatScene     active={idx === 1} accent={SCENES[1].accent} /></SceneSlot>
        <SceneSlot active={idx === 2} topPad={insets.top + 48}><TrialsScene   active={idx === 2} accent={SCENES[2].accent} /></SceneSlot>
        <SceneSlot active={idx === 3} topPad={insets.top + 48}><TimelineScene active={idx === 3} accent={SCENES[3].accent} /></SceneSlot>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <CopyBlock scene={current} />

        {/* Trust badges */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="ribbon" size={11} color={current.accent} />
            <Text style={styles.trustText}>Built for cancer care</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed" size={11} color={current.accent} />
            <Text style={styles.trustText}>End-to-end encrypted</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="heart" size={11} color={current.accent} />
            <Text style={styles.trustText}>Free forever</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: current.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.ctaText}>Take control of your care</Text>
            <Ionicons name="arrow-forward" size={18} color="#0A0A0A" style={{ marginLeft: 8 }} />
          </Pressable>
          <Text style={styles.ctaSub}>No card required · 2-minute setup</Text>
          <Pressable onPress={handleSignIn} hitSlop={12} style={styles.signInWrap}>
            <Text style={styles.signIn}>
              Already with us?{' '}
              <Text style={[styles.signInLink, { color: current.accent }]}>Sign in →</Text>
            </Text>
          </Pressable>

          <View style={styles.legalRow}>
            <Pressable onPress={() => Linking.openURL('https://carecompanionai.org/terms')} hitSlop={8}>
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => Linking.openURL('https://carecompanionai.org/privacy')} hitSlop={8}>
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

// =================================================================
// STYLES
// =================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  orb: {
    position: 'absolute',
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
    opacity: 0.22,
  },

  stage: {
    flex: 1,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  scenePad: { flex: 1, gap: 16 },

  // -------- Wellness --------
  ecgCard: {
    overflow: 'hidden',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFFFFF14',
    backgroundColor: '#FFFFFF0A',
  },
  ecgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  ecgLabel: { color: '#FFFFFFAA', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  ecgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 100,
    marginTop: 14,
    marginBottom: 6,
  },
  ecgFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  ecgBig: { fontSize: 44, fontWeight: '800', color: 'white', letterSpacing: -1.5 },
  ecgUnit: { color: '#FFFFFFAA', fontSize: 13, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF14',
    backgroundColor: '#FFFFFF08',
    gap: 6,
  },
  statIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { color: '#FFFFFFAA', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },

  // -------- Meds --------
  medsHeader: { flexDirection: 'row', alignItems: 'center' },
  medsHeaderLabel: { color: '#FFFFFFAA', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  medsHeaderTitle: { color: 'white', fontSize: 22, fontWeight: '700', marginTop: 4 },
  medsBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  medsBadgeText: { fontSize: 11, fontWeight: '600' },
  ringBig: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  ringSmall: { color: '#FFFFFFAA', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },

  medsList: { gap: 8, marginTop: 4 },
  medTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1, borderColor: '#FFFFFF14',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
    gap: 12,
  },
  medDot: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  medName: { color: 'white', fontSize: 14, fontWeight: '600' },
  medDose: { color: '#FFFFFFAA', fontSize: 12, marginTop: 2 },
  medTime: { color: '#FFFFFFCC', fontSize: 12, fontWeight: '600' },

  // -------- Chat --------
  chatAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  aiAvatar: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  aiName: { color: 'white', fontSize: 14, fontWeight: '700' },
  aiStatus: { color: '#FFFFFFAA', fontSize: 11 },

  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18, borderBottomRightRadius: 6,
    backgroundColor: '#FFFFFF12',
    borderWidth: 1, borderColor: '#FFFFFF14',
  },
  bubbleUserText: { color: 'white', fontSize: 14, lineHeight: 20 },

  bubbleAiWrap: { alignSelf: 'flex-start', maxWidth: '90%' },
  bubbleAi: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 18, borderBottomLeftRadius: 6,
  },
  bubbleAiText: { color: 'white', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  typingRow: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', gap: 5,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3 },

  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#FFFFFF26',
    backgroundColor: '#FFFFFF0A',
  },
  chipText: { color: 'white', fontSize: 12, fontWeight: '500' },

  // -------- Trials (radar) --------
  radarWrap: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  radarRing: { position: 'absolute', borderWidth: 1 },
  radarCore: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  sweepWrap: {
    position: 'absolute',
    width: 180,
    height: 180,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sweepArm: {
    width: 90,
    height: 2,
    marginRight: 0,
  },
  blip: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    shadowOpacity: 0.8, shadowRadius: 4,
  },
  scanLabelWrap: {
    position: 'absolute', bottom: 4,
    alignItems: 'center',
  },
  scanLabel: { color: '#FFFFFFAA', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  scanLabelFound: { position: 'absolute', bottom: 0, fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  trialsList: { gap: 8, marginTop: 6, paddingBottom: 16 },
  trialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1, borderColor: '#FFFFFF14',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
    gap: 10,
  },
  trialCode: { color: 'white', fontSize: 13, fontWeight: '600' },
  trialPhase: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  trialTag: { color: '#FFFFFF99', fontSize: 11, marginLeft: 4 },
  matchPill: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    alignItems: 'center',
  },
  matchNum: { fontSize: 14, fontWeight: '800' },
  matchUnit: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginTop: -2 },

  // -------- Timeline --------
  timelineWrap: {
    flex: 1,
    gap: 10,
    position: 'relative',
  },
  timelineLineBase: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 14,
    width: 2,
  },
  timelineLineFg: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 14,
    width: 2,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FFFFFF55',
    backgroundColor: '#FFFFFF18',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#FFFFFF14',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
  },
  timelineLabel: { color: 'white', fontSize: 13, fontWeight: '600' },
  timelineMeta: { color: '#FFFFFFAA', fontSize: 11, marginTop: 2 },
  nowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  nowBadgeText: { color: '#0A0A0A', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // -------- Bottom (copy + actions) --------
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  copyBlock: { minHeight: 90, marginBottom: 18 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: '#FFFFFFB0', fontSize: 14, lineHeight: 20 },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  trustDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: -2,
  },
  actions: { gap: 12 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  signInWrap: { alignItems: 'center', paddingVertical: 6 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  signIn: { color: '#FFFFFFB0', fontSize: 14 },
  signInLink: { fontWeight: '700' },
})
