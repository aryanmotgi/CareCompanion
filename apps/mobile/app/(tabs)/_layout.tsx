// apps/mobile/app/(tabs)/_layout.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { useFocusEffect } from 'expo-router'

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useReducedMotion } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../src/theme'
import { NoiseOverlay } from '../../src/components/NoiseOverlay'

const TABS = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'chat', label: 'Chat', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { name: 'care', label: 'Care', icon: 'heart-outline', iconActive: 'heart' },
  { name: 'scan', label: 'Scan', icon: 'scan-outline', iconActive: 'scan' },
]

function TabIcon({ icon, iconActive, active }: { icon: string; iconActive: string; active: boolean }) {
  const scale = useSharedValue(1)
  const ty = useSharedValue(0)
  const theme = useTheme()

  React.useEffect(() => {
    if (active) {
      scale.value = withSpring(1.1, { damping: 10, stiffness: 200 }, () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 })
      })
      ty.value = withSpring(-6, { damping: 10, stiffness: 200 }, () => {
        ty.value = withSpring(0, { damping: 10, stiffness: 200 })
      })
    }
  }, [active, scale, ty])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: ty.value }],
  }))

  return (
    <Animated.View
      style={[
        animStyle,
        styles.iconWrapper,
        active && {
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      <Ionicons name={(active ? iconActive : icon) as any} size={22} color={active ? theme.accent : theme.textMuted} />
    </Animated.View>
  )
}

function GlowDot({ active }: { active: boolean }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(active ? 1 : 0)
  const pulse = useSharedValue(0.4)

  React.useEffect(() => {
    if (active) {
      opacity.value = withSpring(1, { damping: 16, stiffness: 120 })
      if (!reduceMotion) {
        pulse.value = withRepeat(
          withTiming(1, { duration: 2000 }),
          -1,
          true,
        )
      } else {
        pulse.value = 1
      }
    } else {
      opacity.value = withTiming(0, { duration: 150 })
    }
  }, [active, opacity, pulse, reduceMotion])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * (0.4 + pulse.value * 0.6),
  }))

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.accent,
          marginTop: 3,
        },
        dotStyle,
      ]}
    />
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTabBar({ state, navigation }: any) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.tabBarOuter,
        {
          paddingBottom: insets.bottom,
          borderTopColor: theme.border,
        },
      ]}
    >
      <BlurView
        intensity={80}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.isDark ? 'rgba(10,12,26,0.85)' : 'rgba(255,255,255,0.90)' },
        ]}
      />
      <View style={styles.tabBarInner}>
        {state.routes.map((route: { key: string; name: string }, index: number) => {
          const tab = TABS.find((t) => t.name === route.name)
          if (!tab) return null // Skip hidden tabs (like settings)
          const active = state.index === index

          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!active && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
            >
              <TabIcon icon={tab.icon} iconActive={tab.iconActive} active={active} />
              <GlowDot active={active} />
              <Text
                style={[
                  styles.label,
                  {
                    color: active ? theme.accent : theme.textMuted,
                    fontWeight: active ? '700' : '400',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function TabFadeWrapper({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(reduceMotion ? 1 : 0.6)

  useFocusEffect(
    React.useCallback(() => {
      if (reduceMotion) return
      opacity.value = 0.6
      opacity.value = withSpring(1, { damping: 16, stiffness: 120 })
    }, [opacity, reduceMotion]),
  )

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={[{ flex: 1 }, fadeStyle]}>{children}</Animated.View>
}

export default function TabLayout() {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <NoiseOverlay />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, ...(({ contentStyle: { backgroundColor: theme.bg }, sceneContainerStyle: { backgroundColor: theme.bg } }) as any) }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="care" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: { fontSize: 10 },
})
