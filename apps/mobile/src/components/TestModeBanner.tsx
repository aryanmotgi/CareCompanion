import { useEffect, useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated'

const isTestMode = process.env.EXPO_PUBLIC_TEST_MODE === 'true'

export function TestModeBanner() {
  const [mounted, setMounted] = useState(true)
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (!isTestMode) return
    opacity.value = withDelay(3000, withTiming(0, { duration: 1000 }, () => {
      runOnJS(setMounted)(false)
    }))
  }, [opacity])

  if (!isTestMode || !mounted) return null

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.text}>Staging Mode</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  text: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
})
