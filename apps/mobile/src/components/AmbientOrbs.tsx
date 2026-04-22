// apps/mobile/src/components/AmbientOrbs.tsx
import React, { useEffect, useRef, useCallback } from 'react'
import { StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated'
import { Gyroscope } from 'expo-sensors'
import { useFocusEffect } from 'expo-router'

const { width, height } = Dimensions.get('window')
const CLAMP = 15
const MAX_DISPLACEMENT = 20

interface AmbientOrbsProps {
  speedMultiplier?: number
}

export function AmbientOrbs({ speedMultiplier = 0.3 }: AmbientOrbsProps) {
  const reduceMotion = useReducedMotion()

  const gyroX = useSharedValue(0)
  const gyroY = useSharedValue(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  const floatX1 = useSharedValue(0)
  const floatY1 = useSharedValue(0)
  const floatX2 = useSharedValue(0)
  const floatY2 = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    floatX1.value = withRepeat(
      withSequence(withTiming(30, { duration: 12000 }), withTiming(-20, { duration: 12000 })),
      -1,
      true,
    )
    floatY1.value = withRepeat(
      withSequence(withTiming(-20, { duration: 14000 }), withTiming(25, { duration: 14000 })),
      -1,
      true,
    )
    floatX2.value = withRepeat(
      withSequence(withTiming(-25, { duration: 18000 }), withTiming(20, { duration: 18000 })),
      -1,
      true,
    )
    floatY2.value = withRepeat(
      withSequence(withTiming(20, { duration: 16000 }), withTiming(-30, { duration: 16000 })),
      -1,
      true,
    )
  }, [reduceMotion, floatX1, floatY1, floatX2, floatY2])

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return
      Gyroscope.setUpdateInterval(16)
      const sub = Gyroscope.addListener(({ x, y }) => {
        tiltRef.current.x = tiltRef.current.x * 0.85 + y * 0.15
        tiltRef.current.y = tiltRef.current.y * 0.85 + x * 0.15
        const cx = Math.max(-15, Math.min(15, tiltRef.current.x))
        const cy = Math.max(-15, Math.min(15, tiltRef.current.y))
        gyroX.value = (cx / CLAMP) * MAX_DISPLACEMENT * speedMultiplier
        gyroY.value = (cy / CLAMP) * MAX_DISPLACEMENT * speedMultiplier
      })
      return () => sub.remove()
    }, [reduceMotion, speedMultiplier, gyroX, gyroY]),
  )

  const orb1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: floatX1.value + gyroX.value },
      { translateY: floatY1.value + gyroY.value },
    ],
  }))
  const orb2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: floatX2.value + gyroX.value },
      { translateY: floatY2.value + gyroY.value },
    ],
  }))

  if (reduceMotion) return null

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            width: width * 0.8,
            height: width * 0.8,
            top: -width * 0.2,
            left: -width * 0.2,
            backgroundColor: 'rgba(99,102,241,0.12)',
          },
          orb1Style,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          {
            width: width * 0.7,
            height: width * 0.7,
            bottom: height * 0.1,
            right: -width * 0.2,
            backgroundColor: 'rgba(167,139,250,0.08)',
          },
          orb2Style,
        ]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
})
