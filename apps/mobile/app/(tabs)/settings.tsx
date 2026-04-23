// apps/mobile/app/(tabs)/settings.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
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
  const stagger = useStaggerEntrance(4)

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
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 70 }]}>
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

        {/* Appearance */}
        <Animated.View style={stagger[2]}>
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

        {/* Sign out */}
        <Animated.View style={stagger[3]}>
          <Pressable onPress={signOut}>
            <GlassCard style={{ ...styles.section, borderColor: 'rgba(252,165,165,0.2)' }}>
              <Text style={[styles.signOut, { color: theme.rose }]}>Sign Out</Text>
            </GlassCard>
          </Pressable>
        </Animated.View>
      </View>
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
})
