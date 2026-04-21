// apps/mobile/src/components/Drawer.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75

interface DrawerProps {
  visible: boolean
  onClose: () => void
  userName: string
  userRole?: string
}

export function Drawer({ visible, onClose, userName, userRole = 'Patient' }: DrawerProps) {
  const theme = useTheme()
  const router = useRouter()
  const translateX = useSharedValue(-DRAWER_WIDTH)
  const backdropOpacity = useSharedValue(0)

  React.useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 160 })
      backdropOpacity.value = withTiming(1, { duration: 250 })
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 220 })
      backdropOpacity.value = withTiming(0, { duration: 220 })
    }
  }, [visible, translateX, backdropOpacity])

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  function navigate(path: string) {
    onClose()
    setTimeout(() => router.push(path as Parameters<typeof router.push>[0]), 250)
  }

  async function signOut() {
    onClose()
    await SecureStore.deleteItemAsync('cc-session-token')
    setTimeout(() => router.replace('/login'), 250)
  }

  if (!visible && backdropOpacity.value === 0) return null

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
            backgroundColor: theme.isDark ? '#13111F' : '#FFFFFF',
            borderRightColor: theme.isDark
              ? 'rgba(167,139,250,0.15)'
              : 'rgba(99,102,241,0.15)',
          },
          drawerStyle,
        ]}
      >
        <View style={[styles.userSection, { borderBottomColor: theme.border }]}>
          <LinearGradient colors={['#6366F1', '#A78BFA']} style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
            <Text style={[styles.userRole, { color: theme.textMuted }]}>{userRole}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.item, { backgroundColor: 'rgba(252,165,165,0.1)' }]}
          onPress={() => navigate('/emergency')}
        >
          <Text style={styles.itemIcon}>🚨</Text>
          <Text style={[styles.itemLabel, { color: theme.rose }]}>Emergency Card</Text>
        </Pressable>

        <Pressable
          style={[styles.item, { backgroundColor: 'rgba(129,140,248,0.08)' }]}
          onPress={() => navigate('/health-summary')}
        >
          <Text style={styles.itemIcon}>📋</Text>
          <Text style={[styles.itemLabel, { color: theme.accentHover }]}>Health Summary</Text>
        </Pressable>

        <Pressable
          style={[styles.item, { backgroundColor: 'rgba(52,211,153,0.08)' }]}
          onPress={() => navigate('/insurance')}
        >
          <Text style={styles.itemIcon}>💳</Text>
          <Text style={[styles.itemLabel, { color: '#34D399' }]}>Insurance & Claims</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable style={styles.item} onPress={() => void signOut()}>
          <Text style={styles.itemIcon}>🚪</Text>
          <Text style={[styles.itemLabel, { color: theme.textMuted }]}>Sign Out</Text>
        </Pressable>
      </Animated.View>
    </View>
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
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '600' },
  userRole: { fontSize: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  itemIcon: { fontSize: 16 },
  itemLabel: { fontSize: 14, fontWeight: '600' },
})
