// apps/mobile/app/(tabs)/_layout.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'

const TABS = [
  { name: 'index', label: 'Home', icon: '⌂' },
  { name: 'chat', label: 'Chat', icon: '💬' },
  { name: 'care', label: 'Care', icon: '♥' },
  { name: 'scan', label: 'Scan', icon: '⊞' },
  { name: 'settings', label: 'Settings', icon: '⚙' },
]

function TabIcon({ icon, active }: { icon: string; active: boolean }) {
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
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderRadius: 10,
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      <Text style={[styles.iconText, { color: active ? theme.accent : theme.textMuted }]}>
        {icon}
      </Text>
    </Animated.View>
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
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0]
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
              <TabIcon icon={tab.icon} active={active} />
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

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="care" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="settings" />
    </Tabs>
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
  iconText: { fontSize: 18 },
  label: { fontSize: 10 },
})
