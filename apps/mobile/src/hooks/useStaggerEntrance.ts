import { useEffect } from 'react'
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  useReducedMotion,
} from 'react-native-reanimated'

interface StaggerOptions {
  delay?: number
  initialDelay?: number
  damping?: number
  stiffness?: number
}

const MAX_ITEMS = 8

export function useStaggerEntrance(count: number, options?: StaggerOptions) {
  const reduceMotion = useReducedMotion()
  const { delay = 100, initialDelay = 0, damping = 14, stiffness = 150 } = options ?? {}

  const o0 = useSharedValue(reduceMotion ? 1 : 0)
  const o1 = useSharedValue(reduceMotion ? 1 : 0)
  const o2 = useSharedValue(reduceMotion ? 1 : 0)
  const o3 = useSharedValue(reduceMotion ? 1 : 0)
  const o4 = useSharedValue(reduceMotion ? 1 : 0)
  const o5 = useSharedValue(reduceMotion ? 1 : 0)
  const o6 = useSharedValue(reduceMotion ? 1 : 0)
  const o7 = useSharedValue(reduceMotion ? 1 : 0)
  const t0 = useSharedValue(reduceMotion ? 0 : 20)
  const t1 = useSharedValue(reduceMotion ? 0 : 20)
  const t2 = useSharedValue(reduceMotion ? 0 : 20)
  const t3 = useSharedValue(reduceMotion ? 0 : 20)
  const t4 = useSharedValue(reduceMotion ? 0 : 20)
  const t5 = useSharedValue(reduceMotion ? 0 : 20)
  const t6 = useSharedValue(reduceMotion ? 0 : 20)
  const t7 = useSharedValue(reduceMotion ? 0 : 20)

  const opacities = [o0, o1, o2, o3, o4, o5, o6, o7]
  const translateYs = [t0, t1, t2, t3, t4, t5, t6, t7]

  useEffect(() => {
    if (reduceMotion) return
    for (let i = 0; i < Math.min(count, MAX_ITEMS); i++) {
      const d = initialDelay + i * delay
      opacities[i].value = withDelay(d, withSpring(1, { damping, stiffness }))
      translateYs[i].value = withDelay(d, withSpring(0, { damping, stiffness }))
    }
  }, [])

  const s0 = useAnimatedStyle(() => ({ opacity: o0.value, transform: [{ translateY: t0.value }] }))
  const s1 = useAnimatedStyle(() => ({ opacity: o1.value, transform: [{ translateY: t1.value }] }))
  const s2 = useAnimatedStyle(() => ({ opacity: o2.value, transform: [{ translateY: t2.value }] }))
  const s3 = useAnimatedStyle(() => ({ opacity: o3.value, transform: [{ translateY: t3.value }] }))
  const s4 = useAnimatedStyle(() => ({ opacity: o4.value, transform: [{ translateY: t4.value }] }))
  const s5 = useAnimatedStyle(() => ({ opacity: o5.value, transform: [{ translateY: t5.value }] }))
  const s6 = useAnimatedStyle(() => ({ opacity: o6.value, transform: [{ translateY: t6.value }] }))
  const s7 = useAnimatedStyle(() => ({ opacity: o7.value, transform: [{ translateY: t7.value }] }))

  return [s0, s1, s2, s3, s4, s5, s6, s7].slice(0, count)
}
