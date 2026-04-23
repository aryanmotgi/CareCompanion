// apps/mobile/app/(tabs)/scan.tsx
import React, { useState } from 'react'
import { View, Text, Image, Alert, Linking, StyleSheet, Dimensions } from 'react-native'
import Animated from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { ParticleBurst } from '../../src/components/ParticleBurst'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { useGyroParallax } from '../../src/hooks/useGyroParallax'
import { RippleButton } from '../../src/components/RippleButton'
import { TabFadeWrapper } from './_layout'
import { hapticScanComplete } from '../../src/utils/haptics'

const { width } = Dimensions.get('window')
const SCAN_SIZE = width - 64

export default function ScanScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [burstActive, setBurstActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const stagger = useStaggerEntrance(4)
  const { parallaxStyle: viewportParallax } = useGyroParallax(0.2)

  async function startScan() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Needed',
        'CareCompanion needs camera access to scan documents. You can enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    })

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri)
      hapticScanComplete()
      setBurstActive(true)
    }
  }

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
        <Animated.View style={stagger[0]}>
          <Text style={[styles.title, { color: theme.text }]}>Scan Document</Text>
        </Animated.View>
        <Animated.View style={stagger[1]}>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Photograph a prescription, lab report, or insurance card
          </Text>
        </Animated.View>

        {/* Scan viewport */}
        <Animated.View style={[styles.viewportWrapper, stagger[2]]}>
          <View
            style={[
              styles.viewport,
              {
                width: SCAN_SIZE,
                height: SCAN_SIZE,
                borderColor: theme.border,
                backgroundColor: theme.bgElevated,
              },
            ]}
          >
            <Animated.View style={viewportParallax}>
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

              {/* Idle content */}
              <View style={styles.idleContent}>
                <Text style={{ fontSize: 48 }}>📄</Text>
                <Text style={[styles.idleText, { color: theme.textMuted }]}>
                  Tap below to start scanning
                </Text>
              </View>

              {/* Particle burst origin */}
              <View style={styles.burstOrigin} pointerEvents="none">
                <ParticleBurst active={burstActive} onComplete={() => setBurstActive(false)} />
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        {capturedImage && (
          <View style={{ marginTop: 16, marginHorizontal: 32, borderRadius: 12, overflow: 'hidden' }}>
            <Image source={{ uri: capturedImage }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
            <Text style={{ color: theme.textSub, textAlign: 'center', marginTop: 8, fontSize: 13 }}>
              Document captured
            </Text>
          </View>
        )}

        {/* Button */}
        <Animated.View style={[styles.btnWrapper, stagger[3]]}>
          <RippleButton onPress={startScan}>
            <Text style={styles.btnText}>Open Camera</Text>
          </RippleButton>
        </Animated.View>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingBottom: 100 },
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
  idleContent: { alignItems: 'center', gap: 12 },
  idleText: { fontSize: 14, textAlign: 'center' },
  burstOrigin: { position: 'absolute', alignSelf: 'center' },
  btnWrapper: { width: '100%' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
