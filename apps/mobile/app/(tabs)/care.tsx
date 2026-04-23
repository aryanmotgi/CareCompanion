// apps/mobile/app/(tabs)/care.tsx
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
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
import { hapticMedTaken, hapticAbnormalLabEntrance } from '../../src/utils/haptics'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { TabFadeWrapper } from './_layout'

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
        withTiming(maxScale, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
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
                taken && { backgroundColor: theme.accent, ...theme.shadowGlowEmerald },
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

  const glowStyle = lab.status === 'abnormal' ? theme.shadowGlowRose
    : lab.status === 'normal' ? theme.shadowGlowCyan
    : undefined

  useEffect(() => {
    if (lab.status === 'abnormal' && !abnormalFired.current) {
      abnormalFired.current = true
      hapticAbnormalLabEntrance()
    }
  }, [lab.status])

  return (
    <GlassCard style={styles.labCard}>
      <View style={styles.labRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.labName, { color: theme.text }]}>{lab.name}</Text>
          <Text style={[styles.labRange, { color: theme.textMuted }]}>Ref: {lab.range}</Text>
        </View>
        <View style={[{ alignItems: 'flex-end' }, glowStyle]}>
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

  const stagger = useStaggerEntrance(3)
  const { parallaxStyle } = useGyroParallax(0.3)

  function takeMed(id: string) {
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, status: 'taken' as MedStatus } : m))
  }

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Animated.View style={stagger[0]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Care</Text>
          </Animated.View>

          {/* Segment control */}
          <Animated.View style={stagger[1]}>
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
          </Animated.View>
        </View>

        <Animated.View style={[stagger[2], { flex: 1 }]}>
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 120 }]}>
            <Animated.View style={parallaxStyle}>
              {tab === 'meds'
                ? meds.map((m) => <MedRow key={m.id} med={m} onTake={takeMed} />)
                : LABS.map((l) => <LabRow key={l.id} lab={l} />)}
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  medCard: { marginBottom: 10 },
  medRow: { flexDirection: 'row', alignItems: 'center' },
  medName: { fontSize: 15, fontWeight: '600' },
  medTime: { fontSize: 13, marginTop: 2 },
  checkBtn: { padding: 4 },
  checkInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  labCard: { marginBottom: 10 },
  labRow: { flexDirection: 'row', alignItems: 'center' },
  labName: { fontSize: 15, fontWeight: '600' },
  labRange: { fontSize: 12, marginTop: 2 },
  labValue: { fontSize: 18, fontWeight: '700' },
  labDate: { fontSize: 12, marginTop: 2 },
})
