// apps/mobile/src/components/GlassCard.tsx
import React from 'react'
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'

interface GlassCardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityHint?: string
}

export function GlassCard({ children, onPress, style, accessibilityLabel, accessibilityHint }: GlassCardProps) {
  const theme = useTheme()
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function onPressIn() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 })
  }

  function onPressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View
        style={[
          styles.card,
          theme.isDark
            ? { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.32)' }
            : { ...theme.shadowCard, backgroundColor: theme.bgCard },
          animatedStyle,
          style,
        ]}
      >
        {!theme.isDark && (
          <BlurView
            intensity={20}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        )}
        {children}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    padding: 16,
  },
})
