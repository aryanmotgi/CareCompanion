import React from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions, Alert, ScrollView, Platform, Linking } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme'
import { useProfile } from '../context/ProfileContext'
import { signOut as authSignOut } from '../services/auth'
import {
  useTokenContext,
  useWelcomeContext,
  useRecordsContext,
  useUserTypeContext,
  useCaregiverJoinedContext,
} from '../../app/_layout'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340)

interface DrawerProps {
  visible: boolean
  onClose: () => void
  userName: string
  userRole?: string
}

const ROLE_LABEL: Record<string, string> = {
  patient: 'Patient',
  caregiver: 'Caregiver',
  self: 'Self-care',
}

export function Drawer({ visible, onClose, userName, userRole }: DrawerProps) {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, clear: clearProfile } = useProfile()
  const { markSignedOut } = useTokenContext()
  const { reset: resetWelcome } = useWelcomeContext()
  const { reset: resetRecords } = useRecordsContext()
  const { reset: resetUserType } = useUserTypeContext()
  const { reset: resetCaregiverJoined } = useCaregiverJoinedContext()
  const translateX = useSharedValue(-DRAWER_WIDTH)
  const backdropOpacity = useSharedValue(0)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])
  const [signingOut, setSigningOut] = React.useState(false)

  React.useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 170 })
      backdropOpacity.value = withTiming(1, { duration: 250 })
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 220 })
      backdropOpacity.value = withTiming(0, { duration: 220 })
    }
  }, [visible, translateX, backdropOpacity])

  React.useEffect(() => {
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  function navigate(path: string) {
    Haptics.selectionAsync().catch(() => {})
    onClose()
    timers.current.push(setTimeout(() => router.push(path as Parameters<typeof router.push>[0]), 250))
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      "You'll need to log in again to access your care data.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void doSignOut(),
        },
      ],
    )
  }

  async function doSignOut() {
    if (signingOut) return
    setSigningOut(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
    try {
      await authSignOut()
    } catch {
      // ignore — local cleanup happens regardless
    }
    markSignedOut()
    clearProfile()
    resetWelcome()
    resetRecords()
    resetUserType()
    resetCaregiverJoined()
    onClose()
    timers.current.push(setTimeout(() => router.replace('/welcome' as any), 220))
  }

  if (!visible && backdropOpacity.value === 0) return null

  const role = (userRole ?? profile?.role ?? 'patient').toLowerCase()
  const roleLabel = ROLE_LABEL[role] ?? 'Member'
  const email = profile?.email ?? ''
  const initial = userName.charAt(0).toUpperCase() || 'U'
  const version = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 16,
            // Tab bar ~68pt sits above drawer in (tabs) tree — extra padding so
            // sign-out + version footer aren't hidden behind it.
            paddingBottom: insets.bottom + 100,
            backgroundColor: theme.isDark ? '#0E0F1E' : '#FFFFFF',
            borderRightColor: theme.isDark
              ? 'rgba(167,139,250,0.18)'
              : 'rgba(99,102,241,0.15)',
          },
          drawerStyle,
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* Header card */}
          <View style={[styles.userCard, { borderColor: theme.border }]}>
            <LinearGradient
              colors={['#A78BFA', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {userName || 'Member'}
              </Text>
              {email ? (
                <Text style={[styles.userEmail, { color: theme.textMuted }]} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
              <View style={[styles.roleBadge, { backgroundColor: theme.accent + '22' }]}>
                <Text style={[styles.roleBadgeText, { color: theme.accent }]}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          {/* Quick actions */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>QUICK ACTIONS</Text>

          <DrawerItem
            icon="alert-circle"
            iconColor={theme.rose}
            iconBg="rgba(252,165,165,0.12)"
            label="Emergency Card"
            onPress={() => navigate('/emergency')}
            theme={theme}
          />
          <DrawerItem
            icon="document-text-outline"
            iconColor={theme.accentHover}
            iconBg="rgba(129,140,248,0.12)"
            label="Health Summary"
            onPress={() => navigate('/health-summary')}
            theme={theme}
          />
          <DrawerItem
            icon="card-outline"
            iconColor={theme.green}
            iconBg="rgba(52,211,153,0.12)"
            label="Insurance & Claims"
            onPress={() => navigate('/insurance')}
            theme={theme}
          />

          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 18 }]}>ACCOUNT</Text>

          <DrawerItem
            icon="people-outline"
            iconColor={theme.lavender}
            iconBg="rgba(167,139,250,0.12)"
            label="Care Group"
            onPress={() => navigate('/care-group-settings')}
            theme={theme}
          />
          <DrawerItem
            icon="settings-outline"
            iconColor={theme.accent}
            iconBg="rgba(99,102,241,0.12)"
            label="Settings"
            onPress={() => navigate('/(tabs)/settings')}
            theme={theme}
          />
          <DrawerItem
            icon="help-circle-outline"
            iconColor={theme.cyan}
            iconBg="rgba(103,232,249,0.12)"
            label="Help & Feedback"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onClose()
              const url =
                'mailto:carecompanioninc@gmail.com?subject=CareCompanion%20Help%20%26%20Feedback'
              timers.current.push(
                setTimeout(() => {
                  Linking.openURL(url).catch(() => {
                    Alert.alert(
                      'Email unavailable',
                      'Please email carecompanioninc@gmail.com for help and feedback.',
                    )
                  })
                }, 250),
              )
            }}
            theme={theme}
          />

          <View style={{ flex: 1 }} />

          {/* Sign out */}
          <Pressable
            onPress={confirmSignOut}
            disabled={signingOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              {
                borderColor: 'rgba(248,113,113,0.3)',
                backgroundColor: 'rgba(248,113,113,0.08)',
                opacity: pressed || signingOut ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color="#F87171" />
            <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>

          <Text style={[styles.version, { color: theme.textMuted }]}>
            CareCompanion v{version}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function DrawerItem({
  icon,
  iconColor,
  iconBg,
  label,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  iconBg: string
  label: string
  onPress: () => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.itemLabel, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    paddingHorizontal: 14,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(167,139,250,0.06)',
    marginBottom: 16,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userEmail: { fontSize: 12, marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  itemIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600' },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  signOutText: { color: '#F87171', fontSize: 14, fontWeight: '700' },
  version: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
})
