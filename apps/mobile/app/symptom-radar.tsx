// Reviewed-by-required: Shreyash (apps/mobile ownership)
import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native'
import Animated, {
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { ShimmerSkeleton } from '../src/components/ShimmerSkeleton'
import { ErrorCard } from '../src/components/ErrorCard'
import { AmbientOrbs } from '../src/components/AmbientOrbs'
import { apiClient } from '../src/services/api'
import { useProfile } from '../src/context/ProfileContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type InsightSeverity = 'critical' | 'warning' | 'positive' | 'informational'
type InsightType = 'trend' | 'correlation' | 'anomaly' | 'milestone' | 'caregiver_burnout'
type TimeWindow = 'today' | 'week' | 'month'

interface SymptomInsight {
  id: string
  type: InsightType
  severity: InsightSeverity
  title: string
  body: string
  createdAt: string
  data: {
    checkinCount?: number
    adherenceRate?: number | null
    cycleDay?: number | null
    cycleNumber?: number | null
  } | null
}

interface CheckinPoint {
  date: string
  mood: number
  pain: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  { icon: string; color: string; bg: string; label: string; order: number }
> = {
  critical: { icon: 'warning', color: '#FCA5A5', bg: 'rgba(252,165,165,0.10)', label: 'Critical', order: 0 },
  warning: { icon: 'alert-circle', color: '#FCD34D', bg: 'rgba(252,211,77,0.08)', label: 'Watch', order: 1 },
  positive: { icon: 'checkmark-circle', color: '#6EE7B7', bg: 'rgba(110,231,183,0.08)', label: 'Positive', order: 2 },
  informational: { icon: 'information-circle', color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', label: 'Info', order: 3 },
}

const TYPE_LABEL: Record<InsightType, string> = {
  trend: 'Trend',
  correlation: 'Pattern',
  anomaly: 'Anomaly',
  milestone: 'Milestone',
  caregiver_burnout: 'Caregiver',
}

const WINDOW_MS: Record<TimeWindow, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function filterByWindow(insights: SymptomInsight[], window: TimeWindow): SymptomInsight[] {
  const cutoff = Date.now() - WINDOW_MS[window]
  return insights.filter((i) => new Date(i.createdAt).getTime() >= cutoff)
}

function sortBySeverity(insights: SymptomInsight[]): SymptomInsight[] {
  return [...insights].sort(
    (a, b) =>
      (SEVERITY_CONFIG[a.severity]?.order ?? 3) - (SEVERITY_CONFIG[b.severity]?.order ?? 3),
  )
}

type TrendDir = 'up' | 'down' | 'stable'

function computeTrend(points: CheckinPoint[], field: 'mood' | 'pain'): TrendDir {
  if (points.length < 4) return 'stable'
  const recent = points.slice(-3)
  const prior = points.slice(0, -3)
  const avgRecent = recent.reduce((s, p) => s + p[field], 0) / recent.length
  const avgPrior = prior.reduce((s, p) => s + p[field], 0) / prior.length
  const delta = avgRecent - avgPrior
  if (Math.abs(delta) < 0.4) return 'stable'
  return delta > 0 ? 'up' : 'down'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrendPill({ dir, better }: { dir: TrendDir; better: 'up' | 'down' }) {
  const theme = useTheme()
  const isGood = dir === better
  const isBad = dir !== 'stable' && dir !== better
  const color = isGood ? theme.green : isBad ? theme.rose : theme.textSub
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
  const label = dir === 'stable' ? 'Stable' : dir === 'up' ? 'Rising' : 'Falling'
  return (
    <Text style={{ color, fontSize: 13, fontWeight: '700' }}>
      {arrow} {label}
    </Text>
  )
}

function InsightCard({
  insight,
  index,
  expanded,
  onToggle,
}: {
  insight: SymptomInsight
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const cfg = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.informational

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * 55).springify()}
      style={styles.insightWrap}
    >
      <GlassCard
        onPress={onToggle}
        style={{
          borderWidth: 1,
          borderColor: cfg.color + '44',
          backgroundColor: cfg.bg,
          padding: 0,
        }}
      >
        {/* Header row */}
        <View style={styles.insightHeader}>
          <View style={[styles.insightIconWrap, { backgroundColor: cfg.color + '22' }]}>
            <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
          </View>
          <View style={styles.insightHeaderText}>
            <Text
              style={[styles.insightTitle, { color: theme.text }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {insight.title}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.bgElevated }]}>
                <Text style={[styles.badgeText, { color: theme.textSub }]}>
                  {TYPE_LABEL[insight.type] ?? insight.type}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: cfg.color + '22' }]}>
                <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.textMuted}
          />
        </View>

        {/* Expanded body */}
        {expanded && (
          <View style={styles.insightBody}>
            <View style={[styles.bodyDivider, { backgroundColor: cfg.color + '33' }]} />
            <Text style={[styles.bodyText, { color: theme.textSub }]}>{insight.body}</Text>
            <View style={styles.metaRow}>
              {insight.data?.cycleDay != null && (
                <View style={styles.metaChip}>
                  <Ionicons name="repeat-outline" size={12} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    Cycle {insight.data.cycleNumber ?? '?'} · Day {insight.data.cycleDay}
                  </Text>
                </View>
              )}
              {insight.data?.adherenceRate != null && (
                <View style={styles.metaChip}>
                  <Ionicons name="medical-outline" size={12} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {insight.data.adherenceRate}% adherence
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.insightDate, { color: theme.textMuted }]}>
              {new Date(insight.createdAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SymptomRadarScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile } = useProfile()

  const [window, setWindow] = useState<TimeWindow>('week')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allInsights, setAllInsights] = useState<SymptomInsight[]>([])
  const [checkinPoints, setCheckinPoints] = useState<CheckinPoint[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const res = await apiClient.careHub.get(profile.careProfileId)
      if (res.ok && res.data) {
        setAllInsights(res.data.insights as SymptomInsight[])
        setCheckinPoints(
          [...res.data.recentCheckins]
            .sort(
              (a, b) =>
                new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
            )
            .map((c) => ({ date: c.checkedInAt, mood: c.mood, pain: c.pain })),
        )
      }
    } catch {
      setError('Failed to load symptom insights.')
    } finally {
      setLoading(false)
      setRetrying(false)
      setRefreshing(false)
    }
  }, [profile?.careProfileId])

  useEffect(() => { void load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
  }, [load])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    await load()
  }, [load])

  const visibleInsights = sortBySeverity(filterByWindow(allInsights, window))
  const moodTrend = computeTrend(checkinPoints, 'mood')
  const painTrend = computeTrend(checkinPoints, 'pain')
  const criticalCount = visibleInsights.filter((i) => i.severity === 'critical').length
  const warningCount = visibleInsights.filter((i) => i.severity === 'warning').length

  const hasData = !loading && !error

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={theme.gradientA as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs speedMultiplier={0.2} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="radio-outline" size={18} color={theme.lavender} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: theme.text }]}>Symptom Radar</Text>
            </View>
            <Text style={[styles.headerSub, { color: theme.textMuted }]}>
              AI-analyzed wellness trends
            </Text>
          </View>
          {/* Alert badge — visible when critical/warning insights exist */}
          {hasData && (criticalCount > 0 || warningCount > 0) ? (
            <View
              style={[
                styles.alertBadge,
                {
                  backgroundColor:
                    criticalCount > 0 ? 'rgba(252,165,165,0.2)' : 'rgba(252,211,77,0.15)',
                },
              ]}
            >
              <Text
                style={{
                  color: criticalCount > 0 ? '#FCA5A5' : '#FCD34D',
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {criticalCount > 0 ? `${criticalCount} critical` : `${warningCount} watch`}
              </Text>
            </View>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>

        {/* ── Time window tabs ────────────────────────────────────────────── */}
        <View style={styles.tabs}>
          {(['today', 'week', 'month'] as TimeWindow[]).map((w) => (
            <Pressable
              key={w}
              onPress={() => { setWindow(w); setExpandedId(null) }}
              style={[
                styles.tab,
                w === window
                  ? { backgroundColor: theme.accent }
                  : { backgroundColor: theme.bgElevated },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: w === window }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: w === window ? '#fff' : theme.textSub },
                ]}
              >
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Loading skeletons ───────────────────────────────────────────── */}
        {loading && (
          <View style={{ gap: 12 }}>
            <ShimmerSkeleton height={72} />
            <ShimmerSkeleton height={96} />
            <ShimmerSkeleton height={84} />
          </View>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {!loading && error && (
          <ErrorCard
            title="Couldn't load insights"
            message={error + ' Pull down to retry.'}
            onRetry={handleRetry}
            retrying={retrying}
          />
        )}

        {/* ── No care profile ─────────────────────────────────────────────── */}
        {!loading && !error && !profile?.careProfileId && (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyInner}>
              <Ionicons name="person-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Set up your care profile
              </Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Symptom Radar needs a care profile to generate AI insights. Complete onboarding to get started.
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ── Summary bar ─────────────────────────────────────────────────── */}
        {hasData && profile?.careProfileId && (
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>MOOD</Text>
                {/* Up in mood = better */}
                <TrendPill dir={moodTrend} better="up" />
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>PAIN</Text>
                {/* Down in pain = better */}
                <TrendPill dir={painTrend} better="down" />
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>INSIGHTS</Text>
                <Text style={[styles.summaryCount, { color: theme.text }]}>
                  {visibleInsights.length}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* ── Empty insights state ────────────────────────────────────────── */}
        {hasData && profile?.careProfileId && visibleInsights.length === 0 && (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyInner}>
              <Ionicons name="radio-outline" size={36} color={theme.lavender} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No insights yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {window === 'today'
                  ? 'No AI insights generated today. Insights are generated after your daily check-in.'
                  : `No insights from the past ${window === 'week' ? '7 days' : '30 days'}. Keep checking in daily to build your trend picture.`}
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ── Insight cards ────────────────────────────────────────────────── */}
        {hasData &&
          visibleInsights.map((insight, i) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              index={i}
              expanded={expandedId === insight.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === insight.id ? null : insight.id))
              }
            />
          ))}

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        {hasData && visibleInsights.length > 0 && (
          <View style={styles.footerNote}>
            <Ionicons name="sparkles-outline" size={13} color={theme.textMuted} />
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              AI insights — not medical advice. Always consult your care team.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  summaryCard: { padding: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 4 },
  summaryLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' },
  summaryCount: { fontSize: 22, fontWeight: '700' },

  emptyCard: { padding: 28 },
  emptyInner: { alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },

  insightWrap: { marginBottom: 0 },

  // InsightCard internal styles (inlined on GlassCard via style prop)
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  insightIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightHeaderText: { flex: 1, gap: 6 },
  insightTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },

  insightBody: { paddingHorizontal: 14, paddingBottom: 14 },
  bodyDivider: { height: 1, marginBottom: 10 },
  bodyText: { fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaText: { fontSize: 11, fontWeight: '500' },
  insightDate: { fontSize: 11, marginTop: 8 },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  footerText: { fontSize: 11, textAlign: 'center', flex: 1 },
})
