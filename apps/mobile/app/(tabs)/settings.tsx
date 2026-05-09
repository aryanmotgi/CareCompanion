// apps/mobile/app/(tabs)/settings.tsx
import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Switch, Linking, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { useTheme, useThemeOverride, setThemeOverride, ThemeOverride } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { GlassCard } from '../../src/components/GlassCard'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { TabFadeWrapper } from './_layout'

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? '1'

export default function SettingsScreen() {
  const theme = useTheme()
  const activeTheme = useThemeOverride()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const stagger = useStaggerEntrance(12)
  const { profile, apiClient, csrfToken, refetch } = useProfile()

  const [selectedRole, setSelectedRole] = useState<'patient' | 'caregiver'>(
    (profile?.role as 'patient' | 'caregiver') || 'patient'
  )
  const [caregiverName, setCaregiverName] = useState(profile?.caregiverForName || '')
  const [roleSaving, setRoleSaving] = useState(false)

  // Sync local state when profile loads/changes
  React.useEffect(() => {
    if (profile) {
      setSelectedRole((profile.role as 'patient' | 'caregiver') || 'patient')
      setCaregiverName(profile.caregiverForName || '')
    }
  }, [profile?.role, profile?.caregiverForName])

  async function saveRole() {
    if (selectedRole === 'caregiver' && !caregiverName.trim()) {
      Alert.alert('Name Required', 'Please enter the name of the person you are caring for.')
      return
    }
    setRoleSaving(true)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      if (!token) return
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
      const isSecure = baseUrl.startsWith('https://')
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
      const res = await fetch(`${baseUrl}/api/records/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${cookieName}=${token}; cc-csrf-token=${csrfToken}`,
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify({
          role: selectedRole,
          caregiver_for_name: selectedRole === 'caregiver' ? caregiverName.trim() : null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      await refetch()
      Alert.alert('Saved', 'Your role has been updated.')
    } catch {
      Alert.alert('Error', 'Failed to save role. Please try again.')
    } finally {
      setRoleSaving(false)
    }
  }

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
          await SecureStore.deleteItemAsync('cc-profile')
          await SecureStore.deleteItemAsync('cc-csrf-token')
          router.replace('/login')
        },
      },
    ])
  }

  function deleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('cc-session-token')
              if (!token) return
              const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
              const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!res.ok) throw new Error('Delete failed')
              await SecureStore.deleteItemAsync('cc-session-token')
              await SecureStore.deleteItemAsync('cc-profile')
              router.replace('/login')
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again or contact support.')
            }
          },
        },
      ],
    )
  }

  return (
    <TabFadeWrapper>
      <ScrollView style={[styles.root, { paddingTop: insets.top + 16 }]} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}>
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
          <View style={styles.section}>
            <View style={styles.profileRow}>
              <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
                <Text style={styles.avatarText}>{(profile?.displayName || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.name, { color: theme.text }]}>{profile?.displayName || profile?.patientName || 'User'}</Text>
                <Text style={[styles.role, { color: theme.textMuted }]}>
                  {profile?.role === 'caregiver'
                    ? `Caregiver${profile?.caregiverForName ? ` for ${profile.caregiverForName}` : ''}`
                    : 'Patient'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Role */}
        <Animated.View style={stagger[2]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ROLE</Text>
          <View style={styles.section}>
            <View style={[styles.segmentRow, { backgroundColor: theme.bgElevated }]}>
              <Pressable
                style={[
                  styles.segBtn,
                  selectedRole === 'patient' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                ]}
                onPress={() => setSelectedRole('patient')}
              >
                <Text style={[styles.segLabel, { color: selectedRole === 'patient' ? theme.accentHover : theme.textMuted }]}>
                  I am the patient
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segBtn,
                  selectedRole === 'caregiver' && { backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 8 },
                ]}
                onPress={() => setSelectedRole('caregiver')}
              >
                <Text style={[styles.segLabel, { color: selectedRole === 'caregiver' ? theme.accentHover : theme.textMuted }]}>
                  I am a caregiver
                </Text>
              </Pressable>
            </View>
            {selectedRole === 'caregiver' && (
              <TextInput
                style={[
                  styles.caregiverInput,
                  {
                    backgroundColor: theme.bgCard,
                    borderColor: theme.bgCardBorder,
                    color: theme.text,
                  },
                ]}
                value={caregiverName}
                onChangeText={setCaregiverName}
                placeholder="Who are you caring for? (e.g. Mom, Dad, Sarah)"
                placeholderTextColor={theme.textMuted}
              />
            )}
            <Pressable
              style={[styles.saveRoleBtn, { backgroundColor: theme.accent, opacity: roleSaving ? 0.6 : 1 }]}
              onPress={saveRole}
              disabled={roleSaving}
            >
              <Text style={styles.saveRoleBtnText}>{roleSaving ? 'Saving...' : 'Save Role'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Edit Profile & Preferences */}
        <Animated.View style={stagger[3]}>
          <Pressable onPress={() => Linking.openURL('https://carecompanionai.org/onboarding')}>
            <View style={styles.section}>
              <View style={styles.editProfileRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editProfileLabel, { color: theme.text }]}>Edit Profile & Preferences</Text>
                  <Text style={[styles.editProfileSub, { color: theme.textMuted }]}>Update cancer type, treatment phase, and priorities</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Appearance */}
        <Animated.View style={stagger[4]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
          <View style={styles.section}>
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
          </View>
        </Animated.View>

        {/* Notifications */}
        <Animated.View style={stagger[5]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTIFICATIONS</Text>

          {/* Medications group */}
          <Text style={[styles.subHeader, { color: theme.textMuted }]}>Medication Alerts</Text>
          <View style={styles.section}>
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
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#818CF8' }}
                  thumbColor="#fff"
                  ios_backgroundColor="rgba(255,255,255,0.1)"
                />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={stagger[6]}>
          {/* Appointments group */}
          <Text style={[styles.subHeader, { color: theme.textMuted }]}>Appointments</Text>
          <View style={styles.section}>
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
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#818CF8' }}
                  thumbColor="#fff"
                  ios_backgroundColor="rgba(255,255,255,0.1)"
                />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* About */}
        <Animated.View style={stagger[7]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ABOUT</Text>
          <View style={styles.section}>
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, { color: theme.text }]}>App Version</Text>
              <Text style={[styles.aboutValue, { color: theme.textMuted }]}>{APP_VERSION} ({BUILD_NUMBER})</Text>
            </View>
          </View>
        </Animated.View>

        {/* Legal & Support */}
        <Animated.View style={stagger[8]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>LEGAL & SUPPORT</Text>
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://carecompanionai.org/privacy')}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
            <View style={styles.toggleRowBorder} />
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://carecompanionai.org/terms')}>
              <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
            <View style={styles.toggleRowBorder} />
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL('mailto:support@carecompanionai.org')}>
              <Ionicons name="help-circle-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Delete Account */}
        <Animated.View style={stagger[9]}>
          <Pressable onPress={deleteAccount}>
            <View style={styles.section}>
              <View style={styles.linkRow}>
                <Ionicons name="trash-outline" size={18} color={theme.rose} />
                <Text style={[styles.linkLabel, { color: theme.rose }]}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.rose} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Test Tools (staging only) */}
        {process.env.EXPO_PUBLIC_TEST_MODE === 'true' && (
          <Animated.View style={stagger[10]}>
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
              <View style={styles.section}>
                <Text style={[styles.signOut, { color: '#f59e0b' }]}>Reset Test Data</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Sign out */}
        <Animated.View style={stagger[11]}>
          <Pressable onPress={signOut}>
            <View style={styles.section}>
              <Text style={[styles.signOut, { color: theme.rose }]}>Sign Out</Text>
            </View>
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 12 },
  toggleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  aboutLabel: { fontSize: 14, fontWeight: '600' },
  aboutValue: { fontSize: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  caregiverInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginTop: 12,
  },
  saveRoleBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveRoleBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
