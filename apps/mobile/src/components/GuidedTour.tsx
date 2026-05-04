// apps/mobile/src/components/GuidedTour.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../theme'

const TOUR_KEY = 'tour_completed'
const TOOLTIP_WIDTH = 240
// Home=0, Chat=1, Care=2, Trials=3, Community=4
const TAB_COUNT = 5
const TAB_BAR_CONTENT_HEIGHT = 68  // paddingTop(8)+icon(36)+dot(7)+label(13)+paddingBottom(4)

const STEPS = [
  {
    tabIndex: 1,
    label: 'Chat',
    text: "Ask me anything about your loved one's care",
  },
  {
    tabIndex: 2,
    label: 'Care',
    text: 'All medications, appointments and labs live here',
  },
  {
    tabIndex: 3,
    label: 'Trials',
    text: 'Find clinical trials matched to your situation',
  },
]

export function GuidedTour() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = Dimensions.get('window')

  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const prevStep = useRef(0)

  const overlayOpacity = useSharedValue(0)
  const cardOpacity = useSharedValue(0)

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: (1 - cardOpacity.value) * 6 }],
  }))

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then(val => {
      if (!val) {
        setVisible(true)
        // Wait for tab bar to render fully before fading in
        const t = setTimeout(() => {
          overlayOpacity.value = withTiming(1, { duration: 350 })
          cardOpacity.value = withTiming(1, { duration: 350 })
        }, 900)
        return () => clearTimeout(t)
      }
    }).catch(() => { /* ignore */ })
  }, [overlayOpacity, cardOpacity])

  // Fade card back in when step advances
  useEffect(() => {
    if (step !== prevStep.current) {
      prevStep.current = step
      cardOpacity.value = withTiming(1, { duration: 200 })
    }
  }, [step, cardOpacity])

  async function dismiss() {
    overlayOpacity.value = withTiming(0, { duration: 300 })
    cardOpacity.value = withTiming(0, { duration: 300 })
    await AsyncStorage.setItem(TOUR_KEY, 'true')
    setTimeout(() => setVisible(false), 320)
  }

  function advanceStep() {
    setStep(s => s + 1)
  }

  function handleNext() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (step === STEPS.length - 1) {
      void dismiss()
      return
    }
    // Fade out card, set step (useEffect fades it back in)
    cardOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(advanceStep)()
    })
  }

  function handleSkip() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    void dismiss()
  }

  if (!visible) return null

  const current = STEPS[step]!
  const tabWidth = screenWidth / TAB_COUNT
  const tabCenterX = (current.tabIndex + 0.5) * tabWidth

  // Clamp so tooltip stays on screen
  const tooltipLeft = Math.max(
    16,
    Math.min(tabCenterX - TOOLTIP_WIDTH / 2, screenWidth - TOOLTIP_WIDTH - 16),
  )
  // Arrow offset relative to card's left edge, clamped to card bounds
  const arrowLeft = Math.max(10, Math.min(tabCenterX - tooltipLeft - 10, TOOLTIP_WIDTH - 30))
  // Position tooltip above the tab bar
  const tooltipBottom = TAB_BAR_CONTENT_HEIGHT + insets.bottom + 14

  const isLast = step === STEPS.length - 1

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      pointerEvents="box-none"
    >
      {/* Tap anywhere on backdrop to advance */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleNext} />

      {/* Tooltip card */}
      <Animated.View
        style={[
          styles.card,
          {
            bottom: tooltipBottom,
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
            backgroundColor: theme.bgElevated,
            borderColor: theme.border,
          },
          cardStyle,
        ]}
        pointerEvents="box-none"
      >
        {/* Step dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step
                    ? theme.accent
                    : theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                  width: i === step ? 14 : 5,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.stepLabel, { color: theme.accent }]}>{current.label}</Text>
        <Text style={[styles.stepText, { color: theme.text }]}>{current.text}</Text>

        {/* Buttons */}
        <View style={styles.btns} pointerEvents="box-none">
          <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
            <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
          </Pressable>
          <Pressable onPress={handleNext} style={[styles.nextBtn, { backgroundColor: theme.accent }]} hitSlop={8}>
            <Text style={styles.nextText}>{isLast ? 'Done ✓' : 'Next →'}</Text>
          </Pressable>
        </View>

        {/* Arrow pointing down toward the tab */}
        <View
          style={[
            styles.arrow,
            {
              left: arrowLeft,
              borderTopColor: theme.bgElevated,
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 200,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
    alignItems: 'center',
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  skipText: {
    fontSize: 13,
  },
  nextBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Downward-pointing triangle, attached at card bottom
  arrow: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set inline to match card bg
  },
})
