import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'
import type { OnboardingState, OnboardingStep } from '../hooks/useOnboardingState'

interface OnboardingJourneyProps {
  onboarding: OnboardingState
}

function ConfettiPiece({ index, color }: { index: number; color: string }) {
  const reduceMotion = useReducedMotion()
  const translateY = useSharedValue(0)
  const translateX = useSharedValue(0)
  const rotate = useSharedValue(0)
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    const xOffset = (Math.random() - 0.5) * 200
    const delay = index * 40

    translateY.value = withDelay(
      delay,
      withTiming(-300 + Math.random() * -100, { duration: 1200 }),
    )
    translateX.value = withDelay(
      delay,
      withTiming(xOffset, { duration: 1200 }),
    )
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 800 }), 2, false),
    )
    opacity.value = withDelay(
      delay + 800,
      withTiming(0, { duration: 400 }),
    )
  }, [index, translateY, translateX, rotate, opacity, reduceMotion])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: color,
          bottom: 0,
          left: '50%',
        },
        style,
      ]}
    />
  )
}

function CelebrationView() {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(0)

  const confettiColors = [
    theme.accent,
    theme.green,
    theme.cyan,
    theme.amber,
    theme.lavender,
    theme.rose,
  ]

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1
      return
    }
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 180 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    )
  }, [scale, reduceMotion])

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={styles.celebrationContainer}>
      {/* Confetti particles */}
      <View style={styles.confettiArea}>
        {Array.from({ length: 20 }).map((_, i) => (
          <ConfettiPiece
            key={i}
            index={i}
            color={confettiColors[i % confettiColors.length]}
          />
        ))}
      </View>

      <Animated.View style={[styles.celebrationContent, celebrationStyle]}>
        <View style={[styles.celebrationIcon, { backgroundColor: 'rgba(110,231,183,0.15)' }]}>
          <Ionicons name="checkmark-circle" size={48} color={theme.green} />
        </View>
        <Text style={[styles.celebrationTitle, { color: theme.text }]}>
          You're all set!
        </Text>
        <Text style={[styles.celebrationSubtitle, { color: theme.textSub }]}>
          Your care timeline is now personalized and ready. We're here to support you every step of the way.
        </Text>
      </Animated.View>
    </View>
  )
}

function StepCard({
  step,
  index,
  isNext,
}: {
  step: OnboardingStep
  index: number
  isNext: boolean
}) {
  const theme = useTheme()
  const router = useRouter()
  const scale = useSharedValue(1)

  // Stagger entrance
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(20)

  useEffect(() => {
    opacity.value = withDelay(index * 80, withSpring(1))
    translateY.value = withDelay(index * 80, withSpring(0))
  }, [index, opacity, translateY])

  const enterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePressIn() {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 })
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
  }

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push(step.route as any)
  }

  return (
    <Animated.View style={enterStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={step.done}
      >
        <Animated.View
          style={[
            styles.stepCard,
            {
              backgroundColor: step.done
                ? 'rgba(110,231,183,0.06)'
                : isNext
                  ? 'rgba(99,102,241,0.08)'
                  : 'rgba(255,255,255,0.03)',
              borderColor: step.done
                ? 'rgba(110,231,183,0.2)'
                : isNext
                  ? 'rgba(99,102,241,0.2)'
                  : 'rgba(255,255,255,0.06)',
            },
            pressStyle,
          ]}
        >
          {/* Step icon */}
          <View
            style={[
              styles.stepIcon,
              {
                backgroundColor: step.done
                  ? 'rgba(110,231,183,0.15)'
                  : isNext
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(255,255,255,0.06)',
              },
            ]}
          >
            {step.done ? (
              <Ionicons name="checkmark" size={20} color={theme.green} />
            ) : (
              <Ionicons
                name={step.icon as any}
                size={20}
                color={isNext ? theme.accent : theme.textMuted}
              />
            )}
          </View>

          {/* Step content */}
          <View style={styles.stepContent}>
            <Text
              style={[
                styles.stepTitle,
                {
                  color: step.done ? theme.green : theme.text,
                  textDecorationLine: step.done ? 'line-through' : 'none',
                },
              ]}
            >
              {step.title}
            </Text>
            {!step.done && (
              <Text style={[styles.stepDescription, { color: theme.textSub }]}>
                {step.description}
              </Text>
            )}
          </View>

          {/* Action indicator */}
          {!step.done && (
            <View style={styles.stepAction}>
              {isNext ? (
                <View style={[styles.startButton, { backgroundColor: theme.accent }]}>
                  <Text style={styles.startButtonText}>Start</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

export function OnboardingJourney({ onboarding }: OnboardingJourneyProps) {
  const theme = useTheme()
  const { steps, completedCount, totalCount, isComplete } = onboarding
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (isComplete) {
      // Short delay before celebration
      const timer = setTimeout(() => setShowCelebration(true), 300)
      return () => clearTimeout(timer)
    }
  }, [isComplete])

  if (showCelebration) {
    return <CelebrationView />
  }

  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <View style={styles.container}>
      {/* Welcome header */}
      <View style={styles.welcomeSection}>
        <View style={[styles.welcomeIcon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
          <Ionicons name="rocket-outline" size={28} color={theme.accent} />
        </View>
        <Text style={[styles.welcomeTitle, { color: theme.text }]}>
          Let's get you set up
        </Text>
        <Text style={[styles.welcomeSubtitle, { color: theme.textSub }]}>
          Complete these steps to personalize your CareCompanion experience.
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
            PROGRESS
          </Text>
          <Text style={[styles.progressCount, { color: theme.accent }]}>
            {completedCount} of {totalCount}
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: theme.accent,
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Step list */}
      <View style={styles.stepList}>
        {steps.map((step, index) => (
          <StepCard
            key={step.key}
            step={step}
            index={index}
            isNext={!step.done && steps.findIndex((s) => !s.done) === index}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  progressCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepList: {
    gap: 8,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
    marginRight: 8,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  stepAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  confettiArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  celebrationContent: {
    alignItems: 'center',
    gap: 12,
  },
  celebrationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  celebrationSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
