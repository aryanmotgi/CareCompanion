import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

interface SearchResult {
  id: string
  type: 'medication' | 'appointment' | 'lab' | 'document' | 'journal'
  title: string
  subtitle?: string
}

interface SearchResponse {
  results: SearchResult[]
}

const SECTION_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  medication: { label: 'Medications', icon: 'medkit-outline' },
  appointment: { label: 'Appointments', icon: 'calendar-outline' },
  lab: { label: 'Lab Results', icon: 'flask-outline' },
  document: { label: 'Documents', icon: 'document-text-outline' },
  journal: { label: 'Journal', icon: 'book-outline' },
}

export default function SearchScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inputRef = useRef<TextInput>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  function handleQueryChange(text: string) {
    setQuery(text)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(text), 300)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      setSearched(false)
      return
    }

    let cancelled = false

    async function fetchResults() {
      setLoading(true)
      try {
        const token = await SecureStore.getItemAsync('cc-session-token')
        const isSecure = API_BASE.startsWith('https://')
        const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
        const res = await fetch(
          `${API_BASE}/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                  Cookie: `${cookieName}=${token}`,
                }
              : {},
          },
        )
        if (!res.ok) {
          // endpoint doesn't exist yet — gracefully handle
          if (!cancelled) {
            setResults([])
            setSearched(true)
          }
          return
        }
        const data: SearchResponse = await res.json()
        if (!cancelled) {
          setResults(data.results ?? [])
          setSearched(true)
        }
      } catch {
        if (!cancelled) {
          setResults([])
          setSearched(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchResults()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, item) => {
    const key = item.type ?? 'document'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const sectionOrder = ['medication', 'appointment', 'lab', 'document', 'journal']

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      {/* Search header */}
      <View style={styles.headerRow}>
        <View style={[styles.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.bgCardBorder }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text }]}
            placeholder="Search..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { handleQueryChange(''); inputRef.current?.focus() }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: theme.accent }]}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* Empty state — no query */}
        {!loading && !searched && query.length < 2 && (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={theme.textMuted} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Search medications, appointments, labs, and more
            </Text>
          </View>
        )}

        {/* Empty state — no results */}
        {!loading && searched && results.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={theme.textMuted} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No results for &apos;{debouncedQuery}&apos;
            </Text>
          </View>
        )}

        {/* Results grouped by type */}
        {!loading &&
          sectionOrder.map((type) => {
            const items = grouped[type]
            if (!items || items.length === 0) return null
            const config = SECTION_CONFIG[type] ?? { label: type, icon: 'ellipse-outline' as const }
            return (
              <View key={type} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={config.icon} size={16} color={theme.accent} />
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                    {config.label.toUpperCase()}
                  </Text>
                </View>
                {items.map((item) => (
                  <GlassCard key={item.id} style={styles.resultCard}>
                    <Text style={[styles.resultTitle, { color: theme.text }]}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={[styles.resultSubtitle, { color: theme.textMuted }]}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </GlassCard>
                ))}
              </View>
            )
          })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 42,
  },
  inputIcon: { marginRight: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  cancelBtn: { paddingVertical: 6 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: 12, opacity: 0.5 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: '600' },
  resultCard: { marginBottom: 8 },
  resultTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  resultSubtitle: { fontSize: 13 },
})
