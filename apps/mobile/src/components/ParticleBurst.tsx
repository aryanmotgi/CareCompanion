// apps/mobile/src/components/ParticleBurst.tsx
import React, { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  makeMutable,
} from 'react-native-reanimated'

const PARTICLE_COUNT = 24

// Pre-compute random angles and speeds once (not inside render)
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, () => ({
  angle: Math.random() * 2 * Math.PI,
  speed: 80 + Math.random() * 120,
}))

interface ParticleBurstProps {
  active: boolean
  onComplete: () => void
}

export function ParticleBurst({ active, onComplete }: ParticleBurstProps) {
  // Use makeMutable (not useSharedValue) so we can safely initialize inside useRef.
  // makeMutable is the non-hook primitive that useSharedValue wraps — calling it
  // inside useRef's initializer is valid because useRef runs once and is not a hook call.
  const txValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))
  const tyValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))
  const opacityValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => makeMutable(0)))

  useEffect(() => {
    if (!active) {
      // Reset all particles
      txValues.current.forEach((v) => (v.value = 0))
      tyValues.current.forEach((v) => (v.value = 0))
      opacityValues.current.forEach((v) => (v.value = 0))
      return
    }

    const cfg = { duration: 600, easing: Easing.out(Easing.quad) }

    PARTICLES.forEach(({ angle, speed }, i) => {
      txValues.current[i].value = 0
      tyValues.current[i].value = 0
      opacityValues.current[i].value = 1

      txValues.current[i].value = withTiming(Math.cos(angle) * speed, cfg)
      tyValues.current[i].value = withTiming(Math.sin(angle) * speed, cfg)

      // Last particle triggers onComplete
      if (i === PARTICLE_COUNT - 1) {
        opacityValues.current[i].value = withTiming(0, cfg, () => runOnJS(onComplete)())
      } else {
        opacityValues.current[i].value = withTiming(0, cfg)
      }
    })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  return (
    <>
      {PARTICLES.map((_, i) => (
        <ParticleView
          key={i}
          tx={txValues.current[i]}
          ty={tyValues.current[i]}
          opacity={opacityValues.current[i]}
        />
      ))}
    </>
  )
}

function ParticleView({
  tx,
  ty,
  opacity,
}: {
  tx: ReturnType<typeof makeMutable<number>>
  ty: ReturnType<typeof makeMutable<number>>
  opacity: ReturnType<typeof makeMutable<number>>
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }))

  return <Animated.View style={[styles.particle, style]} />
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
    alignSelf: 'center',
  },
})
