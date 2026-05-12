import React from 'react'
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

const ACCENT = '#818CF8'

export default function CareTypeScreen() {
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
      <View style={[styles.orb, { top: -120, left: -100, backgroundColor: ACCENT, opacity: 0.18 }]} />
      <View style={[styles.orb, { bottom: -80, right: -120, backgroundColor: '#A78BFA', opacity: 0.12 }]} />

      <Pressable
        onPress={() => router.back()}
        hitSlop={16}
        style={[styles.backBtn, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>How would you like to use CareCompanion?</Text>
        <Text style={styles.subtitle}>Pick the option that fits you best — you can change this later.</Text>

        <View style={styles.cards}>
          <OptionCard
            icon="person-outline"
            title="Self Care"
            body="Manage your own care — medications, appointments, AI support."
            onPress={() => router.push('/signup?type=self&role=self' as any)}
            primary
          />
          <OptionCard
            icon="people-outline"
            title="Assisted Care"
            body="Patient and caregiver coordinate together in one shared view."
            onPress={() => router.push('/care-role' as any)}
            primary
          />
          <OptionCard
            icon="log-in-outline"
            title="I already have an account"
            body="Sign in to your existing CareCompanion account."
            onPress={() => router.push('/login')}
          />
        </View>
      </View>
    </View>
  )
}

function OptionCard({
  icon,
  title,
  body,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  onPress: () => void
  primary?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        primary && styles.cardPrimary,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[styles.iconWrap, { backgroundColor: ACCENT + (primary ? '33' : '22') }]}>
        <Ionicons name={icon} size={22} color={ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#FFFFFFAA" />
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
  cards: { gap: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFFFFF14',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
  },
  cardPrimary: {
    borderColor: ACCENT + '55',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#FFFFFFB0', fontSize: 13, lineHeight: 18, marginTop: 4 },
})
