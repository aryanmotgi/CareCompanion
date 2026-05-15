import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[s.closeBtn, { top: insets.top + 16 }]}
      >
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
      </Pressable>

      {/* Centered content */}
      <View style={s.center}>
        <View style={s.iconRing}>
          <LinearGradient
            colors={['rgba(99,102,241,0.2)', 'rgba(167,139,250,0.08)']}
            style={s.iconBg}
          >
            <Ionicons name="shield-checkmark-outline" size={36} color="#A78BFA" />
          </LinearGradient>
        </View>

        <Text style={s.heading}>Coming Soon</Text>
        <Text style={s.sub}>Insurance & Claims tracking{'\n'}is on its way.</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0C0E1A',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  iconRing: {
    marginBottom: 8,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  heading: {
    color: '#EDE9FE',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
})
