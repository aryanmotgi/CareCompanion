import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Share } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring, withRepeat, withTiming } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme'
import { useProfile } from '../context/ProfileContext'
import type { TimelineItemData } from './TimelineCard'

interface TimelineProps {
  onEmpty?: () => void
  onTakeMedication?: (item: TimelineItemData) => void
}

interface RawItem {
  id: string
  type: string
  date?: string
  timestamp?: string
  title: string
  subtitle?: string | null
  severity?: string | null
  isMilestone?: boolean
  data?: Record<string, unknown>
}

const TYPE_CONFIG: Record<string, { color: string; label: string; glow: string }> = {
  medication: { color: '#6366F1', label: 'Medication',    glow: 'rgba(99,102,241,0.4)' },
  appointment:{ color: '#6EE7B7', label: 'Appointment',   glow: 'rgba(110,231,183,0.4)' },
  lab:        { color: '#67E8F9', label: 'Lab Results',   glow: 'rgba(103,232,249,0.4)' },
  refill:     { color: '#FBB724', label: 'Refill',        glow: 'rgba(251,183,36,0.4)' },
  symptom:    { color: '#FBB724', label: 'Symptoms',      glow: 'rgba(251,183,36,0.4)' },
  checkin:    { color: '#818CF8', label: 'Check-in',      glow: 'rgba(129,140,248,0.4)' },
  cycle:      { color: '#A78BFA', label: 'Cycle',         glow: 'rgba(167,139,250,0.5)' },
  insight:    { color: '#10B981', label: 'AI Insight',    glow: 'rgba(16,185,129,0.4)' },
}

function formatDate(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  const tomorrow = new Date(Date.now() + 86400000)
  const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (d.toDateString() === today.toDateString()) return `Today · ${monthDay}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${monthDay}`
  return monthDay
}

function isToday(ts: string) { return new Date(ts).toDateString() === new Date().toDateString() }
function isFuture(ts: string) { return new Date(ts).getTime() > Date.now() + 3600000 }

function getCycleDay(startDate: string, cycleDays: number): string {
  const start = new Date(startDate)
  const today = new Date()
  const day = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
  if (day < 0 || day > cycleDays) return ''
  if (day <= 5) return `Day ${day} — Infusion window`
  if (day <= 10) return `Day ${day} — Nadir window (watch WBC)`
  if (day <= 14) return `Day ${day} — Recovery phase`
  return `Day ${day} — Pre-next-cycle`
}

function formatLabInline(data?: Record<string, unknown>): string | null {
  if (!data) return null
  const v = data.value as string
  const u = data.unit as string
  if (v && u) return `${v} ${u}`
  return null
}

function PulsingDot() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.4, { duration: 1200 }), -1, true)
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [scale, opacity])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  return (
    <Animated.View style={[styles.youAreHerePulse, style]} />
  )
}

function TimelineNode({ item, isLast, index }: { item: RawItem; isLast: boolean; index: number }) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.medication
  const ts = item.timestamp ?? item.date ?? ''
  const today = isToday(ts)
  const future = isFuture(ts)
  const dateLabel = formatDate(ts)
  const labInline = item.type === 'lab' ? formatLabInline(item.data) : null

  const expandAnim = useSharedValue(0)
  useEffect(() => {
    expandAnim.value = withSpring(expanded ? 1 : 0, { damping: 18, stiffness: 180 })
  }, [expanded, expandAnim])
  const expandStyle = useAnimatedStyle(() => ({
    maxHeight: expandAnim.value * 200,
    opacity: expandAnim.value,
    overflow: 'hidden',
  }))

  const isInsight = item.type === 'insight'
  const isSymptom = item.type === 'symptom'

  return (
    <View style={styles.nodeRow}>
      {/* Left: dot + line segment */}
      <View style={styles.nodeLeft}>
        {today ? (
          <View style={styles.youAreHereContainer}>
            <PulsingDot />
            <View style={[styles.youAreHereDot, { borderColor: '#10B981', backgroundColor: '#10B981' }]} />
          </View>
        ) : (
          <View style={[
            styles.dot,
            { backgroundColor: cfg.color },
            item.isMilestone && { width: 14, height: 14, borderRadius: 7 },
            { shadowColor: cfg.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
          ]} />
        )}
        {!isLast && (
          <LinearGradient
            colors={['rgba(99,102,241,0.5)', 'rgba(167,139,250,0.2)']}
            style={styles.lineSegment}
          />
        )}
      </View>

      {/* Right: content */}
      <Pressable
        style={[styles.nodeContent, isLast && { paddingBottom: 8 }]}
        onPress={() => setExpanded(e => !e)}
      >
        {/* Date + type */}
        <View style={styles.metaRow}>
          <Text style={[styles.nodeDate, { color: today ? '#10B981' : future ? theme.textMuted : 'rgba(255,255,255,0.45)' }]}>
            {dateLabel}
          </Text>
          <Text style={[styles.typeChip, { color: cfg.color }]}>
            {cfg.label.toUpperCase()}
          </Text>
        </View>

        {/* Title */}
        <Text style={[
          styles.nodeTitle,
          { color: future ? 'rgba(255,255,255,0.5)' : theme.text },
          today && { color: '#fff', fontWeight: '800' },
          item.isMilestone && { color: '#A78BFA', fontWeight: '800' },
        ]}>
          {item.title}
        </Text>

        {/* TODAY marker */}
        {today && (
          <Text style={styles.youAreHereLabel}>You are here</Text>
        )}

        {/* Lab inline pills */}
        {labInline && (
          <View style={[styles.labPill, { borderColor: 'rgba(103,232,249,0.25)', backgroundColor: 'rgba(103,232,249,0.06)' }]}>
            <Text style={[styles.labPillText, { color: '#67E8F9' }]}>{labInline}</Text>
          </View>
        )}

        {/* Insight / symptom card */}
        {(isInsight || isSymptom) && item.subtitle && (
          <View style={[
            styles.insightCard,
            isInsight && { backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.18)' },
            isSymptom && { backgroundColor: 'rgba(251,183,36,0.06)', borderColor: 'rgba(251,183,36,0.18)' },
          ]}>
            <Text style={[styles.insightText, { color: theme.textSub }]} numberOfLines={expanded ? undefined : 2}>
              {item.subtitle}
            </Text>
          </View>
        )}

        {/* Regular subtitle */}
        {!isInsight && !isSymptom && !labInline && item.subtitle && !today && (
          <Text style={[styles.nodeSubtitle, { color: 'rgba(255,255,255,0.4)' }]} numberOfLines={expanded ? undefined : 1}>
            {item.subtitle}
          </Text>
        )}

        {/* Expand chevron */}
        {(item.data || item.subtitle) && (
          <Text style={[styles.expandHint, { color: 'rgba(255,255,255,0.18)' }]}>
            {expanded ? '↑ less' : '↓ more'}
          </Text>
        )}

        {/* Expanded detail */}
        <Animated.View style={expandStyle}>
          {item.data && (
            <View style={[styles.expandedBox, { borderColor: 'rgba(99,102,241,0.15)', backgroundColor: 'rgba(99,102,241,0.05)' }]}>
              {Object.entries(item.data)
                .filter(([, v]) => v != null && v !== '' && v !== false)
                .slice(0, 5)
                .map(([k, v]) => (
                  <Text key={k} style={[styles.expandedRow, { color: 'rgba(255,255,255,0.45)' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '600' }}>
                      {k.replace(/([A-Z])/g, ' $1').trim()}:{' '}
                    </Text>
                    {String(v)}
                  </Text>
                ))}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  )
}

export function Timeline({ onEmpty }: TimelineProps) {
  const theme = useTheme()
  const { profile, apiClient } = useProfile()
  const [items, setItems] = useState<RawItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleInfo, setCycleInfo] = useState<{
    number: number; total: number; name: string; startDate: string; days: number
  } | null>(null)

  const fetchTimeline = useCallback(async () => {
    if (!profile?.careProfileId) { setLoading(false); return }
    try {
      setLoading(true)
      const response = await apiClient.timeline.list(profile.careProfileId, 90)
      const rawData = (response as any)?.data ?? response ?? []
      const dataArray: RawItem[] = Array.isArray(rawData) ? rawData : []

      const mapped = dataArray.map((item) => ({
        ...item,
        timestamp: item.timestamp ?? item.date ?? new Date().toISOString(),
      }))

      // Extract cycle info
      const cycleItem = mapped.find(i => i.type === 'cycle' && i.data?.isActive)
      if (cycleItem?.data) {
        setCycleInfo({
          number: cycleItem.data.cycleNumber as number ?? 1,
          total: 6,
          name: cycleItem.data.regimenName as string ?? '',
          startDate: cycleItem.timestamp ?? '',
          days: cycleItem.data.cycleLengthDays as number ?? 21,
        })
      }

      // Sort: future first, then past descending
      mapped.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())

      // Insert "today" marker if not already there
      const hasToday = mapped.some(i => isToday(i.timestamp!))
      if (!hasToday) {
        mapped.splice(0, 0, {
          id: 'today-marker',
          type: 'checkin',
          timestamp: new Date().toISOString(),
          title: 'Today',
          subtitle: null,
        })
      }

      if (mapped.length === 0) onEmpty?.()
      setItems(mapped)
    } catch {
      setItems([])
      onEmpty?.()
    } finally {
      setLoading(false)
    }
  }, [profile?.careProfileId, apiClient, onEmpty])

  useEffect(() => { fetchTimeline() }, [fetchTimeline])

  const handleShare = async () => {
    const patientName = profile?.patientName ?? 'Patient'
    const cycleStr = cycleInfo ? `Cycle ${cycleInfo.number} of ${cycleInfo.total}` : ''
    const summary = `${patientName}'s Care Timeline\n${cycleStr}\n\nShared from CareCompanion`
    await Share.share({ message: summary })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366F1" />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading your timeline...</Text>
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗓️</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No events yet</Text>
        <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
          Medications, appointments, and lab results will appear here once added.
        </Text>
      </View>
    )
  }

  const phaseLabel = cycleInfo?.startDate ? getCycleDay(cycleInfo.startDate, cycleInfo.days) : null

  return (
    <View>
      {/* Cycle header */}
      {cycleInfo && (
        <View style={styles.cycleHeader}>
          <Text style={styles.cycleLabel}>
            CYCLE {cycleInfo.number} OF {cycleInfo.total}
            {cycleInfo.name ? ` — ${cycleInfo.name.split('(')[0].trim()}` : ''}
          </Text>
          {phaseLabel ? <Text style={styles.phaseLabel}>{phaseLabel}</Text> : null}
        </View>
      )}

      {/* Timeline */}
      <View style={styles.container}>
        {items.map((item, index) => (
          <TimelineNode key={item.id} item={item} isLast={index === items.length - 1} index={index} />
        ))}
      </View>
    </View>
  )
}

// Share button for the timeline screen header — exported for use in timeline.tsx
export function TimelineShareButton() {
  const { profile } = useProfile()
  const handleShare = async () => {
    await Share.share({ message: `${profile?.patientName ?? 'Patient'}'s Care Timeline — shared from CareCompanion` })
  }
  return (
    <Pressable onPress={handleShare} style={styles.shareBtn}>
      <Text style={styles.shareBtnText}>Share</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { paddingLeft: 4 },

  cycleHeader: { marginBottom: 20, paddingLeft: 4 },
  cycleLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#A78BFA', marginBottom: 2 },
  phaseLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.4 },

  nodeRow: { flexDirection: 'row', minHeight: 56 },
  nodeLeft: { width: 28, alignItems: 'center', paddingTop: 3 },

  dot: { width: 10, height: 10, borderRadius: 5 },

  youAreHereContainer: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  youAreHereDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, position: 'absolute' },
  youAreHerePulse: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.25)',
  },

  lineSegment: { width: 2, flex: 1, minHeight: 16, marginTop: 4, borderRadius: 1 },

  nodeContent: { flex: 1, paddingLeft: 12, paddingBottom: 28, paddingTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  nodeDate: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  typeChip: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },

  nodeTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21, color: '#fff' },
  youAreHereLabel: { fontSize: 12, fontWeight: '700', color: '#10B981', marginTop: 2 },

  labPill: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  labPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  insightCard: { marginTop: 6, borderRadius: 10, padding: 10, borderWidth: 1 },
  insightText: { fontSize: 13, lineHeight: 18 },

  nodeSubtitle: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  expandHint: { fontSize: 10, marginTop: 6 },

  expandedBox: { marginTop: 8, borderRadius: 10, padding: 10, borderWidth: 1 },
  expandedRow: { fontSize: 12, lineHeight: 18 },

  loadingContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  shareBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  shareBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '600' },
})
