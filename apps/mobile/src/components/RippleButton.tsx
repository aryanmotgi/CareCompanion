import React, { useState } from 'react'
import { Pressable, View, StyleSheet, GestureResponderEvent, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'

interface RippleButtonProps {
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  colors?: [string, string, ...string[]]
  style?: ViewStyle
}

export function RippleButton({ children, onPress, disabled, colors, style }: RippleButtonProps) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const rippleScale = useSharedValue(0)
  const rippleOpacity = useSharedValue(0)
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 })
  const gradientColors = colors ?? (['#6366F1', '#A78BFA'] as [string, string])

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }))

  function handlePressIn(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent
    setRipplePos({ x: locationX, y: locationY })
    scale.value = withSpring(0.97, { damping: 18, stiffness: 200 })
    if (!reduceMotion) {
      rippleScale.value = 0
      rippleOpacity.value = 0.3
      rippleScale.value = withTiming(4, { duration: 400 })
      rippleOpacity.value = withTiming(0, { duration: 400 })
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 18, stiffness: 200 })
  }

  return (
    <View style={[theme.shadowGlowBlue, style]}>
      <Animated.View style={scaleStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
        >
          <View style={styles.clipContainer}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradient, disabled && styles.disabled]}
            >
              {children}
            </LinearGradient>
            <Animated.View
              style={[
                styles.ripple,
                { left: ripplePos.x - 25, top: ripplePos.y - 25 },
                rippleStyle,
              ]}
              pointerEvents="none"
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  clipContainer: { borderRadius: 14, overflow: 'hidden' },
  gradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  ripple: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
})
