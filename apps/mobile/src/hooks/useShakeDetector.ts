import { useEffect } from 'react'
import RNShake from 'react-native-shake'

export function useShakeDetector(onShake: () => void) {
  useEffect(() => {
    const subscription = RNShake.addListener(() => {
      onShake()
    })
    return () => subscription.remove()
  }, [onShake])
}
