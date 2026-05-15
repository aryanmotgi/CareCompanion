import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../src/theme'

// Placeholder screen — wires up the entry point from Settings > Scanned Documents.
// The actual list view and per-doc detail screen come in a follow-up round once
// the scan + extract pipeline persists results to the backend.
export default function ScannedDocsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>
          Scanned Documents
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(99,102,241,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 40,
          }}
        >
          <Ionicons name="scan-outline" size={28} color={theme.accent} />
        </View>
        <Text
          style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}
        >
          No scanned documents yet
        </Text>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
          }}
        >
          When you scan a document from the Chat tab, it will appear here. Documents are analyzed by AI and their fields auto-populate your care profile.
        </Text>
      </ScrollView>
    </View>
  )
}
