import { useEffect } from 'react'

let RNShake: any = null
try {
  RNShake = require('react-native-shake').default
} catch {
  // Native module not available in this build
}

export function useShakeDetector(onShake: () => void) {
  useEffect(() => {
    if (!RNShake) return
    const subscription = RNShake.addListener(() => {
      onShake()
    })
    return () => subscription.remove()
  }, [onShake])
}
