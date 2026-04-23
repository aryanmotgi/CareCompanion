import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { RippleButton } from '../src/components/RippleButton'

/* ── simple markdown renderer ─────────────────────────────── */

function MarkdownText({ text, theme }: { text: string; theme: ReturnType<typeof useTheme> }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      elements.push(
        <Text
          key={i}
          style={[
            level === 1 ? md.h1 : level === 2 ? md.h2 : md.h3,
            { color: theme.text },
          ]}
        >
          {renderInline(content, theme)}
        </Text>,
      )
      continue
    }

    // bullet point
    if (line.match(/^\s*[-*]\s+/)) {
      const content = line.replace(/^\s*[-*]\s+/, '')
      elements.push(
        <View key={i} style={md.bulletRow}>
          <Text style={[md.bullet, { color: theme.green }]}>{'\u2022'}</Text>
          <Text style={[md.bulletText, { color: theme.textSub }]}>
            {renderInline(content, theme)}
          </Text>
        </View>,
      )
      continue
    }

    // empty line → spacer
    if (line.trim() === '') {
      elements.push(<View key={i} style={md.spacer} />)
      continue
    }

    // regular paragraph
    elements.push(
      <Text key={i} style={[md.para, { color: theme.textSub }]}>
        {renderInline(line, theme)}
      </Text>,
    )
  }

  return <View>{elements}</View>
}

function renderInline(
  text: string,
  theme: ReturnType<typeof useTheme>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <Text key={match.index} style={{ fontWeight: '700', color: theme.text }}>
        {match[1]}
      </Text>,
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

const md = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  bullet: { fontSize: 16, lineHeight: 22, marginRight: 8 },
  bulletText: { fontSize: 15, lineHeight: 22, flex: 1 },
  para: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  spacer: { height: 8 },
})

/* ── screen ───────────────────────────────────────────────── */

export default function HealthSummaryScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emeraldColors: [string, string] = t.isDark
    ? ['#059669', '#6EE7B7']
    : ['#059669', '#34D399']

  async function generateSummary() {
    setGenerating(true)
    setError(null)
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const baseUrl =
        process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
      const isSecure = baseUrl.startsWith('https://')
      const cookieName = isSecure
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token'

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const res = await fetch(`${baseUrl}/api/health-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${cookieName}=${token}`,
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json()
      setSummary(data.summary)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('This is taking longer than expected. Please try again.')
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to generate summary',
        )
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleShare() {
    if (!summary) return
    await Share.share({ message: summary, title: 'My Health Summary' })
  }

  return (
    <View
      style={[
        s.container,
        { backgroundColor: t.bg, paddingTop: insets.top + 8 },
      ]}
    >
      {/* ── header ── */}
      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={[s.title, { color: t.text }]}>Health Summary</Text>
          <Text style={[s.sub, { color: t.textMuted }]}>
            Generate a comprehensive summary of your health to share with
            doctors
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[s.closeBtn, { backgroundColor: t.bgElevated }]}
          hitSlop={12}
        >
          <Text style={[s.closeX, { color: t.textSub }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── generating state ── */}
        {generating && (
          <GlassCard style={s.stateCard}>
            <View style={s.loadingInner}>
              <ActivityIndicator size="large" color={t.green} />
              <Text style={[s.loadingText, { color: t.textSub }]}>
                Generating your health summary...
              </Text>
              <Text style={[s.loadingHint, { color: t.textMuted }]}>
                This may take 10-30 seconds
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ── error state ── */}
        {!generating && error && (
          <GlassCard style={s.stateCard}>
            <View style={s.errorInner}>
              <Ionicons name="alert-circle" size={40} color={t.rose} />
              <Text style={[s.errorText, { color: t.rose }]}>{error}</Text>
              <RippleButton
                onPress={generateSummary}
                colors={emeraldColors}
                style={{ marginTop: 16 }}
              >
                <Text style={s.btnText}>Try Again</Text>
              </RippleButton>
            </View>
          </GlassCard>
        )}

        {/* ── summary result ── */}
        {!generating && !error && summary && (
          <>
            <GlassCard style={s.summaryCard}>
              <MarkdownText text={summary} theme={t} />
            </GlassCard>

            <View style={[s.shareWrapper, t.shadowGlowEmerald]}>
              <RippleButton
                onPress={handleShare}
                colors={emeraldColors}
                style={{ marginTop: 20 }}
              >
                <Text style={s.btnText}>Share Summary</Text>
              </RippleButton>
            </View>

            <RippleButton
              onPress={generateSummary}
              colors={
                t.isDark
                  ? ['rgba(110,231,183,0.12)', 'rgba(110,231,183,0.06)']
                  : ['rgba(5,150,105,0.08)', 'rgba(5,150,105,0.04)']
              }
              style={{ marginTop: 12 }}
            >
              <Text style={[s.regenerateText, { color: t.green }]}>
                Regenerate
              </Text>
            </RippleButton>
          </>
        )}

        {/* ── empty / initial state ── */}
        {!generating && !error && !summary && (
          <>
            <GlassCard style={s.stateCard}>
              <View style={s.emptyInner}>
                <Text style={[s.emptyIcon, { color: t.green }]}>
                  {'\u2695'}
                </Text>
                <Text style={[s.emptyTitle, { color: t.text }]}>
                  Your Health at a Glance
                </Text>
                <Text style={[s.emptyDesc, { color: t.textSub }]}>
                  Creates a complete summary including medications, lab results,
                  conditions, providers, and recent health trends.
                </Text>
              </View>
            </GlassCard>

            <View style={[t.shadowGlowEmerald]}>
              <RippleButton
                onPress={generateSummary}
                colors={emeraldColors}
                style={{ marginTop: 24 }}
              >
                <Text style={s.btnText}>Generate Summary</Text>
              </RippleButton>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

/* ── styles ───────────────────────────────────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 12,
  },
  headerText: { flex: 1, marginRight: 12 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeX: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 4 },
  stateCard: { marginBottom: 8 },
  summaryCard: { marginBottom: 8 },

  /* loading */
  loadingInner: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  loadingHint: { fontSize: 13, marginTop: 6 },

  /* error */
  errorInner: { alignItems: 'center', paddingVertical: 24 },
  errorEmoji: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FCA5A5',
    marginBottom: 12,
  },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  /* empty */
  emptyInner: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  /* buttons */
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  regenerateText: { fontSize: 15, fontWeight: '600' },

  /* share */
  shareWrapper: {},
})
