import React from 'react'
import { View, Text, StyleSheet, SafeAreaView } from 'react-native'

interface Props {
  reason?: string
}

export function MaintenanceScreen({ reason }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🛠️</Text>
        <Text style={styles.title}>Down for Maintenance</Text>
        <Text style={styles.body}>
          {reason?.trim() || 'CareCompanion is temporarily unavailable. We\'ll be back shortly.'}
        </Text>
        <Text style={styles.hint}>No action needed — try again in a few minutes.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  hint: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
})
