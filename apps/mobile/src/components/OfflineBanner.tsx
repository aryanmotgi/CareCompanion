import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetworkState } from '../hooks/useNetworkState'

export function OfflineBanner() {
  const isOnline = useNetworkState()
  const insets = useSafeAreaInsets()
  if (isOnline) return null

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Some features are unavailable."
    >
      <Text style={styles.text}>You're offline — some features may not work.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingBottom: 6,
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    ...Platform.select({ ios: { fontFamily: 'System' }, android: {} }),
  },
})
