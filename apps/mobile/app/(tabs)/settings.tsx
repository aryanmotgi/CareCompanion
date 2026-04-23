// apps/mobile/app/(tabs)/settings.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert, Switch, Linking, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useTheme, useThemeOverride, setThemeOverride, ThemeOverride } from '../../src/theme'
import { GlassCard } from '../../src/components/GlassCard'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { TabFadeWrapper } from './_layout'

export default function SettingsScreen() {
  const theme = useTheme()
  const activeTheme = useThemeOverride()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const stagger = useStaggerEntrance(8)

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    medications: true,
    refillReminders: true,
    doseReminders: true,
    interactionAlerts: true,
    appointments: true,
    twentyFourHour: true,
  })

  function toggleNotif(key: string) {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function changeTheme(value: ThemeOverride) {
    void setThemeOverride(value)
  }

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('cc-session-token')
          router.replace('/login')
        },
      },
    ])
  }

  return (
    <TabFadeWrapper>
      <ScrollView style={[styles.root, { paddingTop: insets.top + 16 }]} contentContainerStyle={{ paddingBottom: insets.bottom + 70 }}>
        <LinearGradient
          colors={theme.gradientAMuted as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={stagger[0]}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </Animated.View>

        {/* Profile card */}
        <Animated.View style={stagger[1]}>
          <GlassCard style={styles.section}>
            <View style={styles.profileRow}>
              <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.name, { color: theme.text }]}>Aryan</Text>
                <Text style={[styles.role, { color: theme.textMuted }]}>Patient</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Edit Profile & Preferences */}
        <Animated.View style={stagger[2]}>
          <Pressable onPress={() => Linking.openURL('https://carecompanionai.org/onboarding')}>
            <GlassCard style={styles.section}>
              <View style={styles.editProfileRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editProfileLabel, { color: theme.text }]}>Edit Profile & Preferences</Text>
                  <Text style={[styles.editProfileSub, { color: theme.textMuted }]}>Update cancer type, treatment phase, and priorities</Text>
                </View>
                <Text style={[styles.chevron, { color: theme.textMuted }]}>{'>'}</Text>
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>

        {/* Appearance */}
        <Animated.View style={stagger[3]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
          <GlassCard style={styles.section}>
            <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
              {(['light', 'dark', 'system'] as ThemeOverride[]).map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.segBtn,
                    activeTheme === t && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                  ]}
                  onPress={() => changeTheme(t)}
                >
                  <Text style={[styles.segLabel, { color: activeTheme === t ? theme.accentHover : theme.textMuted }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Notifications */}
        <Animated.View style={stagger[4]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTIFICATIONS</Text>

          {/* Medications group */}
          <Text style={[styles.subHeader, { color: theme.textMuted }]}>Medications</Text>
          <GlassCard style={styles.section}>
            {([
              { key: 'medications', label: 'Medications', description: 'Medication reminders and alerts' },
              { key: 'refillReminders', label: 'Refill Reminders', description: 'Alert when medications are running low' },
              { key: 'doseReminders', label: 'Dose Reminders', description: 'Scheduled medication dose alerts' },
              { key: 'interactionAlerts', label: 'Interaction Alerts', description: 'Warnings about drug interactions' },
            ] as const).map((item, i, arr) => (
              <View key={item.key} style={[styles.toggleRow, i < arr.length - 1 && styles.toggleRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.toggleDesc, { color: theme.textMuted }]}>{item.description}</Text>
                </View>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={() => toggleNotif(item.key)}
                  trackColor={{ false: 'rgba(120,120,128,0.16)', true: 'rgba(99,102,241,0.4)' }}
                  thumbColor={notifPrefs[item.key] ? '#6366F1' : '#f4f3f4'}
                />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        <Animated.View style={stagger[5]}>
          {/* Appointments group */}
          <Text style={[styles.subHeader, { color: theme.textMuted }]}>Appointments</Text>
          <GlassCard style={styles.section}>
            {([
              { key: 'appointments', label: 'Appointments', description: 'Appointment reminders' },
              { key: 'twentyFourHour', label: '24-Hour Reminder', description: 'Reminder 24 hours before appointments' },
            ] as const).map((item, i, arr) => (
              <View key={item.key} style={[styles.toggleRow, i < arr.length - 1 && styles.toggleRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.toggleDesc, { color: theme.textMuted }]}>{item.description}</Text>
                </View>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={() => toggleNotif(item.key)}
                  trackColor={{ false: 'rgba(120,120,128,0.16)', true: 'rgba(99,102,241,0.4)' }}
                  thumbColor={notifPrefs[item.key] ? '#6366F1' : '#f4f3f4'}
                />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* Test Tools (staging only) */}
        {process.env.EXPO_PUBLIC_TEST_MODE === 'true' && (
          <Animated.View style={stagger[6]}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>TEST TOOLS</Text>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Reset Test Data',
                  'This will restore your account to the initial seed state. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        const token = await SecureStore.getItemAsync('cc-session-token')
                        if (!token) return
                        try {
                          const res = await fetch(
                            `${process.env.EXPO_PUBLIC_API_URL ?? 'https://carecompanionai.org'}/api/test/reset`,
                            {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            }
                          )
                          if (!res.ok) throw new Error('Reset failed')
                          Alert.alert('Done', 'Test data has been reset.')
                          router.replace('/(tabs)')
                        } catch {
                          Alert.alert('Error', 'Failed to reset test data. Please try again.')
                        }
                      },
                    },
                  ]
                )
              }}
            >
              <GlassCard style={{ ...styles.section, borderColor: 'rgba(251,191,36,0.3)' }}>
                <Text style={[styles.signOut, { color: '#f59e0b' }]}>Reset Test Data</Text>
              </GlassCard>
            </Pressable>
          </Animated.View>
        )}

        {/* Sign out */}
        <Animated.View style={stagger[7]}>
          <Pressable onPress={signOut}>
            <GlassCard style={{ ...styles.section, borderColor: 'rgba(252,165,165,0.2)' }}>
              <Text style={[styles.signOut, { color: theme.rose }]}>Sign Out</Text>
            </GlassCard>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700' },
  role: { fontSize: 13, marginTop: 2 },
  segmentRow: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
  signOut: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  editProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editProfileLabel: { fontSize: 15, fontWeight: '600' },
  editProfileSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 18, fontWeight: '600' },
  subHeader: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  toggleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
})
