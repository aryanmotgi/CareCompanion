// apps/mobile/src/components/ShimmerSkeleton.tsx
import React, { useEffect } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme'

interface ShimmerSkeletonProps {
  width?: number | string
  height?: number
  style?: ViewStyle
}

export function ShimmerSkeleton({ width = '100%', height = 20, style }: ShimmerSkeletonProps) {
  const theme = useTheme()
  const shimmer = useSharedValue(-1)

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
  }, [shimmer])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * (typeof width === 'number' ? width : 300) }],
  }))

  return (
    <View
      style={[
        styles.container,
        {
          width: width as number,
          height,
          backgroundColor: theme.bgElevated,
          borderRadius: 8,
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            theme.isDark ? 'rgba(167,139,250,0.15)' : 'rgba(99,102,241,0.1)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
})
