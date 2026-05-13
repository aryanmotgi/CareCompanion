// apps/mobile/app/(tabs)/settings.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert, Linking, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { useTheme, useThemeOverride, setThemeOverride, ThemeOverride } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { signOut as authSignOut } from '../../src/services/auth'
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
  const { profile } = useProfile()

  function changeTheme(value: ThemeOverride) {
    void setThemeOverride(value)
  }

  async function signOut() {
    Alert.alert('Sign out?', "You'll need to log in again to access your care data.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await authSignOut().catch(() => {})
          router.replace('/welcome' as any)
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
              await authSignOut().catch(() => {})
              router.replace('/welcome' as any)
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
      <View style={styles.root}>
        <LinearGradient
          colors={theme.gradientAMuted as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 140 }}
        >
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

        {/* Care Group */}
        <Animated.View style={stagger[2]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>CARE GROUP</Text>
          <View style={styles.section}>
            <Pressable
              style={[styles.saveRoleBtn, { backgroundColor: theme.accent }]}
              onPress={() => router.push('/edit-care-group' as any)}
            >
              <Text style={styles.saveRoleBtnText}>Edit Care Group</Text>
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

        {/* Connect Health Records */}
        <Animated.View style={stagger[3]}>
          <Pressable onPress={() => router.push('/health-connect' as any)}>
            <View style={styles.section}>
              <View style={styles.editProfileRow}>
                <Ionicons name="medkit-outline" size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.editProfileLabel, { color: theme.text }]}>Connect Health Records</Text>
                  <Text style={[styles.editProfileSub, { color: theme.textMuted }]}>Sync medications, labs, and conditions from Apple Health</Text>
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
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => router.push('/notification-settings' as any)}>
              <Ionicons name="notifications-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Notifications</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Documents */}
        <Animated.View style={stagger[5]}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DOCUMENTS</Text>
          <View style={styles.section}>
            <Pressable style={styles.linkRow} onPress={() => router.push('/scanned-docs' as any)}>
              <Ionicons name="scan-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.linkLabel, { color: theme.text }]}>Scanned Documents</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
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

        {/* App version — non-interactive footer */}
        <Text style={[styles.versionFooter, { color: theme.textMuted }]} accessible={false}>
          Version {APP_VERSION} ({BUILD_NUMBER})
        </Text>
        </ScrollView>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
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
  versionFooter: { fontSize: 12, textAlign: 'center', opacity: 0.5, marginTop: 16, marginBottom: 8 },
  editProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editProfileLabel: { fontSize: 15, fontWeight: '600' },
  editProfileSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 18, fontWeight: '600' },
  toggleRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
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
