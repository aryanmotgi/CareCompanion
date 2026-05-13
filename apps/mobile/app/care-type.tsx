import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, StatusBar, Dimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useUserTypeContext } from './_layout'

const { width: SW, height: SH } = Dimensions.get('window')

type CardSpec = {
  id: 'patient' | 'caregiver' | 'self'
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  accent: string
  route: '/onboarding-records' | '/care-group-join'
}

const CARDS: CardSpec[] = [
  {
    id: 'patient',
    icon: 'person-outline',
    title: "I'm a patient",
    body: 'Manage your medications, appointments, and care team — with help from an AI companion that knows your case.',
    accent: '#818CF8',
    route: '/onboarding-records',
  },
  {
    id: 'caregiver',
    icon: 'people-outline',
    title: "I'm a caregiver",
    body: "Join a patient's care circle to keep up with their medications, appointments, and how they're doing.",
    accent: '#C084FC',
    route: '/care-group-join',
  },
  {
    id: 'self',
    icon: 'heart-circle-outline',
    title: "I'm tracking my own care",
    body: 'Preventive monitoring, survivorship, or general wellness — sync your health data and let AI surface what matters.',
    accent: '#34D399',
    route: '/onboarding-records',
  },
]

export default function CareTypeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { setUserType, reset } = useUserTypeContext()

  const orb1 = useSharedValue(0)
  const orb2 = useSharedValue(0)
  const titleOpacity = useSharedValue(0)
  const titleY = useSharedValue(20)
  const cardStagger = useSharedValue(0)

  useEffect(() => {
    orb1.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true)
    orb2.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.inOut(Easing.sin) }), -1, true)
    titleOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    titleY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    cardStagger.value = withDelay(250, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }))
    return () => {
      cancelAnimation(orb1)
      cancelAnimation(orb2)
      cancelAnimation(titleOpacity)
      cancelAnimation(titleY)
      cancelAnimation(cardStagger)
    }
  }, [orb1, orb2, titleOpacity, titleY, cardStagger])

  const orb1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(orb1.value, [0, 1], [-40, 40]) },
      { translateY: interpolate(orb1.value, [0, 1], [-20, 20]) },
      { scale: interpolate(orb1.value, [0, 1], [1, 1.18]) },
    ],
  }))
  const orb2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(orb2.value, [0, 1], [30, -50]) },
      { translateY: interpolate(orb2.value, [0, 1], [10, -30]) },
      { scale: interpolate(orb2.value, [0, 1], [1.1, 0.92]) },
    ],
  }))
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }))

  function handlePick(card: CardSpec) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setUserType(card.id)
    router.push(card.route as any)
  }

  function handleBack() {
    Haptics.selectionAsync().catch(() => {})
    reset()
    if (router.canGoBack()) router.back()
    else router.replace('/signup')
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#05060F', '#0F1130', '#05060F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.orb, { top: -120, left: -100, backgroundColor: '#818CF8', opacity: 0.18 }, orb1Style]} />
      <Animated.View style={[styles.orb, { bottom: -80, right: -120, backgroundColor: '#C084FC', opacity: 0.12 }, orb2Style]} />
      <NoiseVeil />

      <Pressable
        onPress={handleBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back to sign up"
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <Ionicons name="chevron-back" size={20} color="white" />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>Who are you?</Text>
          <Text style={styles.subtitle}>
            CareCompanion adapts to your role — pick the lane that fits how you'll use it.
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          {CARDS.map((c, i) => (
            <OptionCard
              key={c.id}
              spec={c}
              index={i}
              stagger={cardStagger}
              onPress={() => handlePick(c)}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

function OptionCard({
  spec,
  index,
  stagger,
  onPress,
}: {
  spec: CardSpec
  index: number
  stagger: Animated.SharedValue<number>
  onPress: () => void
}) {
  const press = useSharedValue(1)
  const iconPulse = useSharedValue(0)

  useEffect(() => {
    iconPulse.value = withDelay(
      300 + index * 250,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    )
    return () => cancelAnimation(iconPulse)
  }, [index, iconPulse])

  const containerStyle = useAnimatedStyle(() => {
    const start = index * 0.2
    const end = start + 0.5
    const t = Math.max(0, Math.min(1, (stagger.value - start) / (end - start)))
    return {
      opacity: t,
      transform: [
        { translateY: interpolate(t, [0, 1], [24, 0]) },
        { scale: press.value },
      ],
    }
  })
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconPulse.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(iconPulse.value, [0, 1], [1, 1.6]) }],
  }))

  return (
    <Animated.View style={containerStyle}>
      <Pressable
        onPressIn={() => {
          press.value = withSpring(0.97, { damping: 14, stiffness: 220 })
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 12, stiffness: 200 })
        }}
        onPress={onPress}
        style={[styles.card, { borderColor: spec.accent + '55' }]}
      >
        <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={[spec.accent + '14', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.iconCol}>
          <Animated.View
            style={[
              styles.iconRing,
              { borderColor: spec.accent },
              ringStyle,
            ]}
          />
          <View style={[styles.iconWrap, { backgroundColor: spec.accent + '33', borderColor: spec.accent + '88' }]}>
            <Ionicons name={spec.icon} size={22} color={spec.accent} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{spec.title}</Text>
          <Text style={styles.cardBody}>{spec.body}</Text>
        </View>
        <View style={[styles.chevronWrap, { backgroundColor: spec.accent + '22' }]}>
          <Ionicons name="chevron-forward" size={16} color={spec.accent} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

function NoiseVeil() {
  const dots = useRef<{ x: number; y: number; o: number }[]>(
    Array.from({ length: 60 }).map((_, i) => ({
      x: (i * 137.508) % SW,
      y: (i * 211.07) % SH,
      o: 0.02 + ((i * 7) % 5) * 0.008,
    })),
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  orb: { position: 'absolute', width: 360, height: 360, borderRadius: 180 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginBottom: 10 },
  subtitle: { color: '#FFFFFFAA', fontSize: 15, lineHeight: 22, marginBottom: 28 },
  cards: { gap: 14, marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
  },
  iconCol: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#FFFFFFB0', fontSize: 13, lineHeight: 18, marginTop: 4 },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF12',
    borderWidth: 1,
    borderColor: '#FFFFFF22',
    zIndex: 10,
  },
  backLabel: { color: 'white', fontSize: 14, fontWeight: '600' },
})
