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
