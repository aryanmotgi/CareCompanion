import { useRef, useCallback } from 'react'
import {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated'
import { Gyroscope } from 'expo-sensors'
import { useFocusEffect } from 'expo-router'

const CLAMP = 15
const MAX_DISPLACEMENT = 20

export function useGyroParallax(multiplier: number) {
  const reduceMotion = useReducedMotion()
  const gyroX = useSharedValue(0)
  const gyroY = useSharedValue(0)
  const tiltRef = useRef({ x: 0, y: 0 })

  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return
      Gyroscope.setUpdateInterval(16)
      const sub = Gyroscope.addListener(({ x, y }) => {
        tiltRef.current.x = tiltRef.current.x * 0.85 + y * 0.15
        tiltRef.current.y = tiltRef.current.y * 0.85 + x * 0.15
        const cx = Math.max(-CLAMP, Math.min(CLAMP, tiltRef.current.x))
        const cy = Math.max(-CLAMP, Math.min(CLAMP, tiltRef.current.y))
        gyroX.value = (cx / CLAMP) * MAX_DISPLACEMENT * multiplier
        gyroY.value = (cy / CLAMP) * MAX_DISPLACEMENT * multiplier
      })
      return () => sub.remove()
    }, [reduceMotion, multiplier, gyroX, gyroY]),
  )

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gyroX.value }, { translateY: gyroY.value }],
  }))

  return { parallaxStyle }
}
