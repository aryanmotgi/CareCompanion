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
