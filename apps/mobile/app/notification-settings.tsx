// apps/mobile/app/notification-settings.tsx
//
// Dedicated screen for notification preferences (medication alerts +
// appointment reminders). Reached via the "Notifications" row in Settings.
// Note: distinct from /notifications (which is the in-app notification inbox).

import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/theme'

const MEDICATION_ITEMS = [
  { key: 'medications', label: 'Medications', description: 'Medication reminders and alerts' },
  { key: 'refillReminders', label: 'Refill Reminders', description: 'Alert when medications are running low' },
  { key: 'doseReminders', label: 'Dose Reminders', description: 'Scheduled medication dose alerts' },
  { key: 'interactionAlerts', label: 'Interaction Alerts', description: 'Warnings about drug interactions' },
] as const

const APPOINTMENT_ITEMS = [
  { key: 'appointments', label: 'Appointments', description: 'Appointment reminders' },
  { key: 'twentyFourHour', label: '24-Hour Reminder', description: 'Reminder 24 hours before appointments' },
] as const

export default function NotificationSettingsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    medications: true,
    refillReminders: true,
    doseReminders: true,
    interactionAlerts: true,
    appointments: true,
    twentyFourHour: true,
  })

  function toggle(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.bgElevated }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.textMuted }]}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Choose which alerts CareCompanion sends you. You can change these at any time.
        </Text>

        {/* Medication Alerts */}
        <Text style={[styles.subHeader, { color: theme.textMuted }]}>Medication Alerts</Text>
        <View style={styles.section}>
          {MEDICATION_ITEMS.map((item, i, arr) => (
            <View key={item.key} style={[styles.toggleRow, i < arr.length - 1 && styles.toggleRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.toggleDesc, { color: theme.textMuted }]}>{item.description}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#818CF8' }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(255,255,255,0.1)"
              />
            </View>
          ))}
        </View>

        {/* Appointments */}
        <Text style={[styles.subHeader, { color: theme.textMuted, marginTop: 18 }]}>Appointments</Text>
        <View style={styles.section}>
          {APPOINTMENT_ITEMS.map((item, i, arr) => (
            <View key={item.key} style={[styles.toggleRow, i < arr.length - 1 && styles.toggleRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.toggleDesc, { color: theme.textMuted }]}>{item.description}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#818CF8' }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(255,255,255,0.1)"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8, lineHeight: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  subHeader: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  section: { marginBottom: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 12 },
  toggleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
})
