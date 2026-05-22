// apps/mobile/src/components/PHIPrivacyGuard.tsx
//
// Wraps the entire app to satisfy two HIPAA PHI-exposure defences:
//   (a) blur-on-background  — opaque overlay whenever AppState is inactive/background
//       (prevents iOS app-switcher screenshots and shoulder surfing)
//   (b) screen-recording shield — same overlay when UIScreen.isCaptured is true (iOS)
//       driven by our native ScreenCaptureManager module via KVO notification
//
// No third-party snapshot library is needed; expo-blur (already in deps) provides
// the BlurView, and RN's AppState handles lifecycle.
import { useEffect, useRef, useState } from 'react'
import {
  AppState,
  type AppStateStatus,
  NativeEventEmitter,
  NativeModules,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'

const { ScreenCaptureManager } = NativeModules

export function PHIPrivacyGuard({ children }: { children: React.ReactNode }) {
  // Two independent reasons to obscure; we track them separately so clearing
  // one doesn't accidentally reveal PHI while the other reason still holds.
  const [bgObscure, setBgObscure] = useState(false)
  const [recObscure, setRecObscure] = useState(false)

  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const isRecordingRef = useRef(false)

  // (a) background / inactive blur
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      appStateRef.current = next
      setBgObscure(next === 'inactive' || next === 'background')
    })
    return () => sub.remove()
  }, [])

  // (b) screen-recording shield — iOS only via native ScreenCaptureManager
  useEffect(() => {
    if (Platform.OS !== 'ios' || !ScreenCaptureManager) return

    // Seed initial state synchronously from the native side on mount.
    ScreenCaptureManager.isCaptured()
      .then((captured: boolean) => {
        isRecordingRef.current = captured
        setRecObscure(captured)
      })
      .catch(() => {})

    const emitter = new NativeEventEmitter(ScreenCaptureManager)
    const sub = emitter.addListener(
      'screenCaptureChanged',
      ({ isCaptured }: { isCaptured: boolean }) => {
        isRecordingRef.current = isCaptured
        setRecObscure(isCaptured)
      },
    )
    return () => sub.remove()
  }, [])

  const shouldObscure = bgObscure || recObscure

  return (
    <>
      {children}
      {shouldObscure && (
        Platform.OS === 'ios' ? (
          <BlurView
            intensity={100}
            tint="dark"
            style={StyleSheet.absoluteFill}
            // pointerEvents none: user can't interact when app is backgrounded anyway;
            // during recording they should still be able to navigate and stop the capture.
            pointerEvents="none"
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, styles.androidOverlay]}
            pointerEvents="none"
          />
        )
      )}
    </>
  )
}

const styles = StyleSheet.create({
  androidOverlay: {
    backgroundColor: '#000',
  },
})
