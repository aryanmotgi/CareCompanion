import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Dimensions, Pressable, Platform } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  interpolate,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { DeviceMotion } from 'expo-sensors'

const { width: SW, height: SH } = Dimensions.get('window')

// ──────────────────────────────────────────────────────────────
// 1. AURORA BACKGROUND — slow morphing gradient blobs
// ──────────────────────────────────────────────────────────────

export function AuroraBackground() {
  const t1 = useSharedValue(0)
  const t2 = useSharedValue(0)
  const t3 = useSharedValue(0)
  const t4 = useSharedValue(0)
  const hue = useSharedValue(0)

  useEffect(() => {
    t1.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true)
    t2.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.inOut(Easing.sin) }), -1, true)
    t3.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.inOut(Easing.sin) }), -1, true)
    t4.value = withRepeat(withTiming(1, { duration: 36000, easing: Easing.inOut(Easing.sin) }), -1, true)
    hue.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.inOut(Easing.sin) }), -1, true)
    return () => { cancelAnimation(t1); cancelAnimation(t2); cancelAnimation(t3); cancelAnimation(t4); cancelAnimation(hue) }
  }, [t1, t2, t3, t4, hue])

  const blob1 = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(hue.value, [0, 1], ['rgba(99,102,241,0.22)', 'rgba(167,139,250,0.22)']),
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-SW * 0.2, SW * 0.1]) },
      { translateY: interpolate(t1.value, [0, 1], [-SH * 0.1, SH * 0.05]) },
      { scale: interpolate(t1.value, [0, 1], [1, 1.25]) },
    ],
  }))
  const blob2 = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(hue.value, [0, 1], ['rgba(192,132,252,0.15)', 'rgba(103,232,249,0.15)']),
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [SW * 0.15, -SW * 0.15]) },
      { translateY: interpolate(t2.value, [0, 1], [SH * 0.2, SH * 0.05]) },
      { scale: interpolate(t2.value, [0, 1], [1.15, 0.9]) },
    ],
  }))
  const blob3 = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(hue.value, [0, 1], ['rgba(52,211,153,0.10)', 'rgba(167,139,250,0.10)']),
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [-SW * 0.1, SW * 0.25]) },
      { translateY: interpolate(t3.value, [0, 1], [SH * 0.4, SH * 0.15]) },
      { scale: interpolate(t3.value, [0, 1], [0.95, 1.2]) },
    ],
  }))
  const blob4 = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(hue.value, [0, 1], ['rgba(252,165,165,0.10)', 'rgba(99,102,241,0.12)']),
    transform: [
      { translateX: interpolate(t4.value, [0, 1], [SW * 0.05, -SW * 0.2]) },
      { translateY: interpolate(t4.value, [0, 1], [-SH * 0.05, SH * 0.25]) },
      { scale: interpolate(t4.value, [0, 1], [1.1, 0.85]) },
    ],
  }))

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#03040C', '#0A0C20', '#03040C']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[aurStyles.blob, { top: -SW * 0.4, left: -SW * 0.3 }, blob1]} />
      <Animated.View style={[aurStyles.blob, { bottom: -SW * 0.3, right: -SW * 0.4 }, blob2]} />
      <Animated.View style={[aurStyles.blob, { top: SH * 0.3, left: -SW * 0.2 }, blob3]} />
      <Animated.View style={[aurStyles.blob, { top: SH * 0.1, right: -SW * 0.3 }, blob4]} />
    </View>
  )
}

const aurStyles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: SW * 0.45,
  },
})

// ──────────────────────────────────────────────────────────────
// 2. FLOATING MEDICAL GLYPHS — decorative drifting icons
// ──────────────────────────────────────────────────────────────

const GLYPHS: { icon: keyof typeof Ionicons.glyphMap; color: string; x: number; y: number; size: number; delay: number; dur: number }[] = [
  { icon: 'medical-outline', color: 'rgba(167,139,250,0.18)', x: SW * 0.08, y: SH * 0.18, size: 16, delay: 0, dur: 9000 },
  { icon: 'pulse', color: 'rgba(103,232,249,0.18)', x: SW * 0.82, y: SH * 0.22, size: 14, delay: 1200, dur: 12000 },
  { icon: 'heart-outline', color: 'rgba(252,165,165,0.16)', x: SW * 0.85, y: SH * 0.62, size: 18, delay: 2400, dur: 10000 },
  { icon: 'leaf-outline', color: 'rgba(52,211,153,0.18)', x: SW * 0.1, y: SH * 0.7, size: 16, delay: 800, dur: 11000 },
  { icon: 'shield-checkmark-outline', color: 'rgba(167,139,250,0.16)', x: SW * 0.5, y: SH * 0.92, size: 14, delay: 1800, dur: 13000 },
  { icon: 'sparkles', color: 'rgba(192,132,252,0.18)', x: SW * 0.5, y: SH * 0.06, size: 12, delay: 600, dur: 8000 },
]

export function FloatingGlyphs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {GLYPHS.map((g, i) => <Glyph key={i} {...g} />)}
    </View>
  )
}

function Glyph({ icon, color, x, y, size, delay, dur }: typeof GLYPHS[number]) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true))
    return () => cancelAnimation(t)
  }, [t, delay, dur])
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.5, 1], [0.4, 1, 0.4]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-12, 12]) },
      { translateY: interpolate(t.value, [0, 1], [-8, 8]) },
    ],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Ionicons name={icon} size={size} color={color} />
    </Animated.View>
  )
}

// ──────────────────────────────────────────────────────────────
// 3. LOGO BEAM — rotating light ray behind cube
// ──────────────────────────────────────────────────────────────

export function LogoBeam({ size = 64 }: { size?: number }) {
  const rot = useSharedValue(0)
  const breath = useSharedValue(1)
  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    breath.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
    return () => { cancelAnimation(rot); cancelAnimation(breath) }
  }, [rot, breath])

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${interpolate(rot.value, [0, 1], [0, 360])}deg` }],
  }))
  const cubeStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }))

  const beamSize = size * 2.6
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: beamSize,
            height: beamSize,
            alignItems: 'center',
            justifyContent: 'center',
          },
          beamStyle,
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(167,139,250,0.35)', 'transparent', 'rgba(103,232,249,0.25)', 'transparent']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: beamSize, height: 4, borderRadius: 2 }}
        />
      </Animated.View>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 30,
            elevation: 20,
          },
          cubeStyle,
        ]}
      >
        <LinearGradient
          colors={['#6366F1', '#A78BFA']}
          style={{ width: size, height: size, borderRadius: size * 0.28, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              position: 'absolute',
              top: size * 0.1,
              left: size * 0.1,
              width: size * 0.38,
              height: size * 0.38,
              borderRadius: size * 0.12,
              backgroundColor: 'rgba(255,255,255,0.15)',
            }}
          />
          <Text style={{ fontSize: size * 0.45, color: '#fff' }}>♥</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  )
}

// ──────────────────────────────────────────────────────────────
// 4. DEVICE TILT HOOK — gyroscope → x/y offsets
// ──────────────────────────────────────────────────────────────

export function useDeviceTilt() {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)

  useEffect(() => {
    let sub: { remove: () => void } | null = null
    DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok) return
      DeviceMotion.setUpdateInterval(80)
      sub = DeviceMotion.addListener((data) => {
        const rot = data.rotation
        if (!rot) return
        // gamma = left/right tilt, beta = front/back tilt
        const targetX = Math.max(-1, Math.min(1, rot.gamma * 1.5))
        const targetY = Math.max(-1, Math.min(1, rot.beta * 0.7))
        tx.value = withTiming(targetX, { duration: 200 })
        ty.value = withTiming(targetY, { duration: 200 })
      })
    })
    return () => {
      if (sub) sub.remove()
    }
  }, [tx, ty])

  return { tx, ty }
}

// ──────────────────────────────────────────────────────────────
// 5. PASSWORD STRENGTH METER (bar + descriptor + tip)
// ──────────────────────────────────────────────────────────────

export function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; tip: string; color: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent']
  const tips = [
    'Need 8+ characters',
    'Add an uppercase letter',
    'Add a number',
    'Add a symbol for extra strength',
    'Looks great',
  ]
  const colors = ['#FCA5A5', '#FCA5A5', '#FCD34D', '#6EE7B7', '#34D399']
  return { score: s as 0 | 1 | 2 | 3 | 4, label: labels[s], tip: tips[s], color: colors[s] }
}

export function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) return null
  const { score, label, tip, color } = scorePassword(password)
  return (
    <View style={pwStyles.wrap}>
      <View style={pwStyles.row}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[pwStyles.bar, i < score && { backgroundColor: color }]} />
        ))}
      </View>
      <View style={pwStyles.metaRow}>
        <Text style={[pwStyles.label, { color }]}>{label}</Text>
        <Text style={pwStyles.tip}>{tip}</Text>
      </View>
    </View>
  )
}

const pwStyles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 4 },
  row: { flexDirection: 'row', gap: 4, height: 3 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700' },
  tip: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
})

// ──────────────────────────────────────────────────────────────
// 5b. CONFIRM PASSWORD MATCH BAR
// ──────────────────────────────────────────────────────────────

export function ConfirmMatch({ matched }: { matched: boolean }) {
  if (!matched) return null
  return (
    <View style={cmStyles.wrap}>
      <View style={cmStyles.bar} />
      <Text style={cmStyles.label}>Passwords match</Text>
    </View>
  )
}

const cmStyles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 4 },
  bar: { height: 3, borderRadius: 2, backgroundColor: '#34D399' },
  label: { fontSize: 11, fontWeight: '700', color: '#34D399' },
})

// ──────────────────────────────────────────────────────────────
// 6. CAPS LOCK HEURISTIC — naive: prev char vs current
// ──────────────────────────────────────────────────────────────

export function useCapsHint(value: string) {
  const [caps, setCaps] = useState(false)
  const prev = useRef('')
  useEffect(() => {
    if (value.length === 0) { setCaps(false); prev.current = ''; return }
    const added = value.slice(prev.current.length)
    if (added.length === 1 && /[A-Z]/.test(added) && !/[a-z]/.test(value)) setCaps(true)
    else if (/[a-z]/.test(value)) setCaps(false)
    prev.current = value
  }, [value])
  return caps
}

// ──────────────────────────────────────────────────────────────
// 7. SUCCESS OVERLAY — full-screen checkmark sweep
// ──────────────────────────────────────────────────────────────

export function SuccessOverlay({ visible }: { visible: boolean }) {
  const op = useSharedValue(0)
  const scale = useSharedValue(0.6)
  const ring = useSharedValue(0)
  useEffect(() => {
    if (visible) {
      op.value = withTiming(1, { duration: 200 })
      scale.value = withSpring(1, { damping: 12, stiffness: 160 })
      ring.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    } else {
      op.value = withTiming(0, { duration: 200 })
      scale.value = 0.6
      ring.value = 0
    }
  }, [visible, op, scale, ring])
  const overlayStyle = useAnimatedStyle(() => ({ opacity: op.value }))
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.6, 2.2]) }],
  }))

  if (!visible) return null
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, sucStyles.overlay, overlayStyle]}>
      <Animated.View style={[sucStyles.ring, ringStyle]} />
      <Animated.View style={[sucStyles.iconWrap, iconStyle]}>
        <LinearGradient
          colors={['#6EE7B7', '#34D399']}
          style={sucStyles.iconBg}
        >
          <Ionicons name="checkmark" size={42} color="#03261A" />
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}

const sucStyles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,4,12,0.85)',
    zIndex: 100,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#34D399',
  },
  iconWrap: { shadowColor: '#34D399', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 30, elevation: 20 },
  iconBg: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
})

// ──────────────────────────────────────────────────────────────
// 8. FLOATING-LABEL INPUT
// ──────────────────────────────────────────────────────────────

type FloatingInputProps = {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  icon: keyof typeof Ionicons.glyphMap
  secureTextEntry?: boolean
  showSecureToggle?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'words' | 'sentences'
  autoCorrect?: boolean
  autoComplete?: 'name' | 'email' | 'password' | 'new-password' | 'username' | 'off'
  textContentType?: 'name' | 'emailAddress' | 'password' | 'newPassword'
  returnKeyType?: 'next' | 'done'
  onSubmitEditing?: () => void
  onFocus?: () => void
  onBlur?: () => void
  error?: string | null
  valid?: boolean
  inputRef?: React.MutableRefObject<unknown>
  rightSlot?: React.ReactNode
}

import { TextInput } from 'react-native'

export function FloatingInput(props: FloatingInputProps) {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    icon,
    secureTextEntry,
    showSecureToggle,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    autoComplete,
    textContentType,
    returnKeyType,
    onSubmitEditing,
    onFocus,
    onBlur,
    error,
    valid,
    inputRef,
    rightSlot,
  } = props

  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  return (
    <View style={fiStyles.field}>
      <Text style={[fiStyles.label, focused && fiStyles.labelFocused]}>{label.toUpperCase()}</Text>
      <View
        style={[
          fiStyles.wrap,
          focused && fiStyles.wrapFocused,
          !!error && fiStyles.wrapError,
        ]}
      >
        <Ionicons name={icon} size={16} color="rgba(167,139,250,0.7)" style={fiStyles.icon} />
        <View style={fiStyles.inputWrap}>
          {/* Custom bullet overlay: ensures identical dot size/spacing in both password
              fields regardless of iOS focus-state rendering differences. The native
              TextInput remains secureTextEntry=true (clipboard/screenshot protection)
              but its text is transparent; only the cursor shows through on top. */}
          {secureTextEntry && !revealed && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, fiStyles.secureDots]}>
              <Text style={fiStyles.secureText} numberOfLines={1} allowFontScaling={false}>
                {'•'.repeat(value.length)}
              </Text>
            </View>
          )}
          <TextInput
            ref={inputRef as unknown as React.RefObject<TextInput>}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.4)"
            // Always false — iOS native secureTextEntry renders its own bullet
            // dots via an internal system layer that ignores color:'transparent',
            // producing a visible second set of dots beneath our custom overlay.
            // With secureTextEntry=false, regular text IS fully transparent when
            // color:'transparent' is set, so only our overlay bullets show.
            secureTextEntry={false}
            keyboardType={keyboardType}
            // Secure fields need these disabled explicitly since secureTextEntry
            // normally suppresses them automatically on iOS.
            autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
            autoCorrect={secureTextEntry ? false : autoCorrect}
            spellCheck={secureTextEntry ? false : undefined}
            autoComplete={autoComplete}
            textContentType={textContentType}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => { setFocused(true); onFocus?.() }}
            onBlur={() => { setFocused(false); onBlur?.() }}
            style={[fiStyles.input, secureTextEntry && !revealed && fiStyles.inputSecure]}
            cursorColor="rgba(167,139,250,0.7)"
            allowFontScaling={false}
          />
        </View>
        {showSecureToggle && (
          <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={8} style={fiStyles.eye}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
        {rightSlot}
      </View>
      {error && <Text style={fiStyles.error}>{error}</Text>}
    </View>
  )
}

const fiStyles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(167,139,250,0.7)',
    marginLeft: 2,
  },
  labelFocused: {
    color: 'rgba(167,139,250,1)',
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  wrapFocused: {
    borderColor: 'rgba(167,139,250,0.7)',
    backgroundColor: 'rgba(99,102,241,0.08)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  wrapError: {
    borderColor: 'rgba(252,165,165,0.7)',
  },
  icon: { width: 18 },
  inputWrap: { flex: 1 },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#EDE9FE',
  },
  inputSecure: {
    color: 'transparent',
  },
  secureDots: {
    justifyContent: 'center',
  },
  secureText: {
    fontSize: 10,
    letterSpacing: Platform.OS === 'ios' ? 4 : 2,
    color: '#EDE9FE',
    lineHeight: 16,
  },
  eye: { padding: 4 },
  error: {
    color: '#FCA5A5',
    fontSize: 11,
    marginLeft: 4,
    marginTop: 4,
  },
})
