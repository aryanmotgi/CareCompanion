import React from 'react'
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

const ACCENT = '#818CF8'

export default function CareRoleScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#05060F', '#0F1130', '#05060F']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.orb, { top: -100, right: -100, backgroundColor: ACCENT, opacity: 0.18 }]} />
      <View style={[styles.orb, { bottom: -100, left: -100, backgroundColor: '#22D3EE', opacity: 0.1 }]} />

      <Pressable
        onPress={() => router.back()}
        hitSlop={16}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Who are you?</Text>
        <Text style={styles.subtitle}>We'll tailor your experience based on your role.</Text>

        <View style={styles.cards}>
          <RoleCard
            icon="heart-outline"
            title="Patient"
            body="I'm the one receiving care."
            onPress={() => router.push('/signup?type=assisted&role=patient' as any)}
          />
          <RoleCard
            icon="hand-left-outline"
            title="Caregiver"
            body="I'm helping someone with their care."
            onPress={() => router.push('/signup?type=assisted&role=caregiver' as any)}
          />
        </View>
      </View>
    </View>
  )
}

function RoleCard({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[styles.iconWrap, { backgroundColor: ACCENT + '33' }]}>
        <Ionicons name={icon} size={28} color={ACCENT} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  orb: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFFAA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  cards: { gap: 16 },
  card: {
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ACCENT + '55',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  cardBody: { color: '#FFFFFFB0', fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
})
