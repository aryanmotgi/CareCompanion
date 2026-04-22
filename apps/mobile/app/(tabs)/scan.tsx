// apps/mobile/app/(tabs)/scan.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { ParticleBurst } from '../../src/components/ParticleBurst'
import { hapticScanSuccess } from '../../src/utils/haptics'

const { width } = Dimensions.get('window')
const SCAN_SIZE = width - 64

export default function ScanScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const [scanning, setScanning] = useState(false)
  const [burstActive, setBurstActive] = useState(false)

  const laserY = useSharedValue(0)
  const laserOpacity = useSharedValue(0)

  function startScan() {
    setScanning(true)

    if (!reduceMotion) {
      laserOpacity.value = withTiming(1, { duration: 200 })
      laserY.value = 0
      laserY.value = withRepeat(
        withTiming(SCAN_SIZE, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      laserOpacity.value = 1  // Keep laser visible but static
    }

    // Simulate scan completing after 3s
    setTimeout(() => {
      setScanning(false)
      laserOpacity.value = withTiming(0, { duration: reduceMotion ? 0 : 200 })
      hapticScanSuccess()
      setBurstActive(true)
    }, 3000)
  }

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserY.value }],
    opacity: laserOpacity.value,
  }))

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
      <Text style={[styles.title, { color: theme.text }]}>Scan Document</Text>
      <Text style={[styles.sub, { color: theme.textMuted }]}>
        Photograph a prescription, lab report, or insurance card
      </Text>

      {/* Scan viewport */}
      <View style={styles.viewportWrapper}>
        <View
          style={[
            styles.viewport,
            {
              width: SCAN_SIZE,
              height: SCAN_SIZE,
              borderColor: scanning ? theme.accent : theme.border,
              backgroundColor: scanning ? 'rgba(99,102,241,0.05)' : theme.bgElevated,
            },
          ]}
        >
          {/* Corner brackets */}
          {[
            { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
            { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
            { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
            { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
          ].map((s, i) => (
            <View
              key={i}
              style={[styles.bracket, { borderColor: theme.accent, width: 20, height: 20 }, s]}
            />
          ))}

          {/* Laser line */}
          {scanning && (
            <Animated.View style={[styles.laserWrapper, laserStyle]}>
              <LinearGradient
                colors={['transparent', '#6366F1', '#6EE7B7', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.laser}
              />
            </Animated.View>
          )}

          {/* Idle content */}
          {!scanning && (
            <View style={styles.idleContent}>
              <Text style={{ fontSize: 48 }}>📄</Text>
              <Text style={[styles.idleText, { color: theme.textMuted }]}>
                Tap below to start scanning
              </Text>
            </View>
          )}

          {/* Scanning text */}
          {scanning && (
            <View style={styles.scanningLabel}>
              <Text style={[styles.scanningText, { color: theme.accent }]}>Scanning…</Text>
            </View>
          )}

          {/* Particle burst origin */}
          <View style={styles.burstOrigin} pointerEvents="none">
            <ParticleBurst active={burstActive} onComplete={() => setBurstActive(false)} />
          </View>
        </View>
      </View>

      {/* Button */}
      <Pressable onPress={scanning ? undefined : startScan} style={styles.btnWrapper}>
        <LinearGradient
          colors={['#6366F1', '#A78BFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, scanning && { opacity: 0.6 }]}
        >
          <Text style={styles.btnText}>{scanning ? 'Scanning…' : 'Open Camera'}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, alignSelf: 'flex-start' },
  sub: { fontSize: 14, marginBottom: 40, alignSelf: 'flex-start' },
  viewportWrapper: { alignItems: 'center', marginBottom: 40 },
  viewport: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bracket: { position: 'absolute' },
  laserWrapper: { position: 'absolute', left: 0, right: 0 },
  laser: { height: 2, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 6 },
  idleContent: { alignItems: 'center', gap: 12 },
  idleText: { fontSize: 14, textAlign: 'center' },
  scanningLabel: { position: 'absolute', bottom: 16 },
  scanningText: { fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  burstOrigin: { position: 'absolute', alignSelf: 'center' },
  btnWrapper: { width: '100%' },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
