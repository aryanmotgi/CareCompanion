// apps/mobile/app/(tabs)/scan.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  Alert,
  Linking,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import Animated from 'react-native-reanimated'
// Lazy import — expo-image-picker requires a native build with the module included.
// Importing at the top level crashes if the native module isn't in the current dev build.
let ImagePicker: typeof import('expo-image-picker') | null = null
try {
  ImagePicker = require('expo-image-picker')
} catch {
  // Native module not available in this build
}
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../src/theme'
import { ParticleBurst } from '../../src/components/ParticleBurst'
import { useStaggerEntrance } from '../../src/hooks/useStaggerEntrance'
import { TabFadeWrapper } from './_layout'
import { hapticScanComplete } from '../../src/utils/haptics'
import { LinearGradient } from 'expo-linear-gradient'

const CATEGORIES = ['All', 'Medical', 'Insurance', 'Lab Reports', 'Rx', 'Other'] as const

export default function ScanScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [burstActive, setBurstActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const stagger = useStaggerEntrance(5)

  async function startScan() {
    if (!ImagePicker) {
      Alert.alert('Camera Not Available', 'A new app build is required to enable camera scanning. Please rebuild with EAS.')
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Needed',
        'CareCompanion needs camera access to scan documents. You can enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    })

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri)
      hapticScanComplete()
      setBurstActive(true)
    }
  }

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <Animated.View style={stagger[0]}>
          <Text style={[styles.title, { color: theme.text }]}>Scan</Text>
        </Animated.View>
        <Animated.View style={stagger[1]}>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Organize and manage your medical documents
          </Text>
        </Animated.View>

        {/* Search bar */}
        <Animated.View style={[styles.searchWrapper, stagger[2]]}>
          <View style={[styles.searchBar, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search documents..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>

        {/* Category filter pills */}
        <Animated.View style={stagger[3]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsScroll}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    styles.pill,
                    isActive
                      ? { backgroundColor: theme.accent }
                      : { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: isActive ? '#fff' : theme.textMuted },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </Animated.View>

        {/* Document list area */}
        <Animated.View style={[styles.listArea, stagger[4]]}>
          {/* Captured image preview card */}
          {capturedImage && (
            <View style={[styles.capturedCard, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
              <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
              <Text style={[styles.capturedLabel, { color: theme.textMuted }]}>
                Document captured
              </Text>
              {/* Particle burst origin */}
              <View style={styles.burstOrigin} pointerEvents="none">
                <ParticleBurst active={burstActive} onComplete={() => setBurstActive(false)} />
              </View>
            </View>
          )}

          {/* Empty state */}
          {!capturedImage && (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No documents yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Scan your first document using the{' '}
                <Ionicons name="camera" size={14} color={theme.accent} /> button below
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Floating camera FAB */}
        <TouchableOpacity
          onPress={startScan}
          activeOpacity={0.85}
          style={styles.fabTouchable}
        >
          <LinearGradient
            colors={['#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Ionicons name="camera" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TabFadeWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 20 },

  // Search
  searchWrapper: { marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  // Pills
  pillsScroll: { marginBottom: 24 },
  pillsContainer: { gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillText: { fontSize: 13, fontWeight: '600' },

  // List area
  listArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Captured image card
  capturedCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  capturedImage: { width: '100%', height: 200 },
  capturedLabel: { textAlign: 'center', paddingVertical: 10, fontSize: 13 },
  burstOrigin: { position: 'absolute', alignSelf: 'center', top: 100 },

  // Empty state
  emptyState: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // FAB
  fabTouchable: {
    position: 'absolute',
    bottom: 100,
    right: 24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
})
