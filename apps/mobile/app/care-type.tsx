import React from 'react'
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useUserTypeContext } from './_layout'

const ACCENT = '#818CF8'

export default function CareTypeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { setUserType } = useUserTypeContext()

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

      <View style={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Who are you?</Text>
        <Text style={styles.subtitle}>
          CareCompanion adapts to your role — patients manage their care, caregivers help someone else.
        </Text>

        <View style={styles.cards}>
          <OptionCard
            icon="person-outline"
            title="I'm a patient"
            body="Manage your medications, appointments, and care team — with help from an AI companion that knows your case."
            onPress={() => {
              setUserType('patient')
              router.replace('/onboarding-records' as any)
            }}
          />
          <OptionCard
            icon="people-outline"
            title="I'm a caregiver"
            body="Join a patient's care circle to keep up with their medications, appointments, and how they're doing."
            onPress={() => {
              setUserType('caregiver')
              router.replace('/care-group-join' as any)
            }}
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
  orb: { position: 'absolute', width: 360, height: 360, borderRadius: 180 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginBottom: 10 },
  subtitle: { color: '#FFFFFFAA', fontSize: 15, lineHeight: 22, marginBottom: 32 },
  cards: { gap: 14, marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ACCENT + '55',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF06',
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#FFFFFFB0', fontSize: 13, lineHeight: 18, marginTop: 4 },
})
