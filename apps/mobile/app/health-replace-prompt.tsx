import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/theme'
import { useProfile } from '../src/context/ProfileContext'
import { syncHealthKitData, replaceHealthKitData } from '../src/services/healthkit'

export default function HealthReplacePromptScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { refetch } = useProfile()
  const [busy, setBusy] = useState<'merge' | 'replace' | null>(null)

  async function onMerge() {
    if (busy) return
    setBusy('merge')
    try {
      await syncHealthKitData()
      router.back()
    } catch {
      Alert.alert('Sync failed', 'Could not import your HealthKit records. You can try again from Settings.')
      setBusy(null)
    }
  }

  function onReplaceTap() {
    if (busy) return
    Alert.alert(
      'Replace all your data?',
      'This deletes all medications, lab results, appointments, and your care profile setup. You\'ll re-do the onboarding flow. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: confirmReplace },
      ],
    )
  }

  async function confirmReplace() {
    setBusy('replace')
    try {
      const result = await replaceHealthKitData()
      await refetch()
      if (result.errors > 0) {
        Alert.alert(
          "Some records didn't sync",
          `Your old data was cleared but ${result.errors} HealthKit record(s) failed to import. You can re-sync from Settings later.`,
          [{ text: 'OK', onPress: () => router.replace('/setup' as any) }],
        )
      } else {
        router.replace('/setup' as any)
      }
    } catch {
      Alert.alert('Replace failed', 'Your data was not changed. Please try again.')
      setBusy(null)
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.gradientAMuted as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}
      >
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
          <Ionicons name="checkmark-circle" size={28} color={theme.accent} />
        </View>
        <Text style={[styles.connectedLabel, { color: theme.accent }]}>Connected to Apple Health</Text>
        <Text style={[styles.title, { color: theme.text }]}>How should we merge your data?</Text>

        {/* Merge card */}
        <Pressable
          onPress={onMerge}
          disabled={!!busy}
          style={[styles.card, { borderColor: theme.bgCardBorder, opacity: busy && busy !== 'merge' ? 0.5 : 1 }]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>Add HealthKit data alongside what's already in CareCompanion</Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Existing medications, lab results, and appointments are kept. HealthKit records are added.
            Records you've already synced are deduplicated automatically.
          </Text>
          <View style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text style={styles.ctaText}>{busy === 'merge' ? 'Merging…' : 'Merge'}</Text>
          </View>
        </Pressable>

        {/* Replace card */}
        <Pressable
          onPress={onReplaceTap}
          disabled={!!busy}
          style={[styles.card, { borderColor: 'rgba(244,63,94,0.4)', opacity: busy && busy !== 'replace' ? 0.5 : 1 }]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>Start fresh from HealthKit</Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Your existing medications, lab results, appointments, and care profile (cancer type, treatment phase, etc.)
            are deleted. You'll be asked to set up your care profile again. <Text style={{ fontWeight: '700' }}>This cannot be undone.</Text>
          </Text>
          <View style={[styles.cta, { backgroundColor: theme.rose }]}>
            <Text style={styles.ctaText}>{busy === 'replace' ? 'Replacing…' : 'Replace All'}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  connectedLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24, lineHeight: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  cta: { paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
