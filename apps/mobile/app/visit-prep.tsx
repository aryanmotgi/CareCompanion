// apps/mobile/app/visit-prep.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { ShimmerSkeleton } from '../src/components/ShimmerSkeleton'
import { AmbientOrbs } from '../src/components/AmbientOrbs'
import { useProfile } from '../src/context/ProfileContext'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

interface Appointment {
  id: string
  doctorName: string | null
  specialty: string | null
  dateTime: string | null
  location: string | null
  purpose: string | null
}

interface PrepEntry {
  content: string | null
  loading: boolean
  error: string | null
}

function formatDateTime(dt: string | null): string {
  if (!dt) return 'No date set'
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function daysUntil(dt: string | null): { label: string; urgency: 'today' | 'soon' | 'future' } | null {
  if (!dt) return null
  const diff = Math.ceil((new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return null
  if (diff === 0) return { label: 'Today', urgency: 'today' }
  if (diff === 1) return { label: 'Tomorrow', urgency: 'soon' }
  if (diff <= 7) return { label: `In ${diff} days`, urgency: 'soon' }
  return { label: `In ${diff} days`, urgency: 'future' }
}

function SkeletonBlock() {
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {[1, 0.85, 0.65, 0.9, 0.7].map((w, i) => (
        <ShimmerSkeleton key={i} width={`${Math.round(w * 100)}%`} height={12} />
      ))}
    </View>
  )
}

function MarkdownView({ content, textColor, mutedColor }: { content: string; textColor: string; mutedColor: string }) {
  const lines = content.split('\n')

  return (
    <View style={{ gap: 2 }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <Text key={i} style={[styles.mdH1, { color: textColor, marginTop: i === 0 ? 0 : 12 }]}>
              {line.replace(/^# /, '')}
            </Text>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={i} style={[styles.mdH2, { color: textColor, marginTop: i === 0 ? 0 : 10 }]}>
              {line.replace(/^## /, '')}
            </Text>
          )
        }
        if (line.startsWith('### ')) {
          return (
            <Text key={i} style={[styles.mdH3, { color: textColor, marginTop: 8 }]}>
              {line.replace(/^### /, '')}
            </Text>
          )
        }
        if (line.match(/^- \[ \]/) || line.match(/^- \[x\]/i)) {
          const checked = line.match(/^- \[x\]/i)
          const text = line.replace(/^- \[[x ]\] /i, '')
          return (
            <View key={i} style={styles.checkRow}>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={16}
                color={checked ? '#6366F1' : mutedColor}
              />
              <Text style={[styles.mdBullet, { color: mutedColor, flex: 1 }]}>{text}</Text>
            </View>
          )
        }
        if (line.match(/^[-*] /)) {
          const text = line.replace(/^[-*] /, '').replace(/\*\*(.*?)\*\*/g, '$1')
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.mdDot, { color: mutedColor }]}>•</Text>
              <Text style={[styles.mdBullet, { color: mutedColor, flex: 1 }]}>{text}</Text>
            </View>
          )
        }
        if (line.includes('|') && !line.match(/^[-|: ]+$/)) {
          const cells = line.split('|').filter(Boolean).map(c => c.trim())
          return (
            <View key={i} style={styles.tableRow}>
              {cells.map((cell, j) => (
                <Text
                  key={j}
                  style={[
                    styles.tableCell,
                    { color: j === 0 ? textColor : mutedColor, fontWeight: j === 0 ? '600' : '400' },
                  ]}
                  numberOfLines={2}
                >
                  {cell}
                </Text>
              ))}
            </View>
          )
        }
        if (line.match(/^[-|: ]+$/) || !line.trim()) return <View key={i} style={{ height: 4 }} />

        const text = line.replace(/\*\*(.*?)\*\*/g, '$1')
        return (
          <Text key={i} style={[styles.mdPara, { color: mutedColor }]}>
            {text}
          </Text>
        )
      })}
    </View>
  )
}

function AppointmentCard({
  appt,
  entry,
  isExpanded,
  onGenerate,
  onToggle,
  onShare,
}: {
  appt: Appointment
  entry: PrepEntry
  isExpanded: boolean
  onGenerate: () => void
  onToggle: () => void
  onShare: () => void
}) {
  const theme = useTheme()
  const badge = daysUntil(appt.dateTime)
  const hasPrep = !!entry.content

  const badgeBg =
    badge?.urgency === 'today'
      ? 'rgba(239,68,68,0.15)'
      : badge?.urgency === 'soon'
        ? 'rgba(245,158,11,0.15)'
        : 'rgba(255,255,255,0.06)'
  const badgeColor =
    badge?.urgency === 'today'
      ? '#F87171'
      : badge?.urgency === 'soon'
        ? '#FBBF24'
        : theme.textMuted

  return (
    <GlassCard style={styles.apptCard}>
      {/* Appointment header */}
      <View style={styles.apptHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.doctorName, { color: theme.text }]} numberOfLines={1}>
              {appt.doctorName || 'Appointment'}
            </Text>
            {appt.specialty ? (
              <View style={styles.specialtyBadge}>
                <Text style={styles.specialtyText}>{appt.specialty}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {formatDateTime(appt.dateTime)}
            </Text>
          </View>
          {appt.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                {appt.location}
              </Text>
            </View>
          ) : null}
          {appt.purpose ? (
            <Text style={[styles.purpose, { color: theme.textMuted }]} numberOfLines={2}>
              {appt.purpose}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badge.label}</Text>
          </View>
        ) : null}
      </View>

      {/* Error */}
      {entry.error ? (
        <View style={[styles.errorBox, { borderColor: 'rgba(239,68,68,0.3)' }]}>
          <Text style={styles.errorText}>{entry.error}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {!hasPrep ? (
          <Pressable
            style={[styles.btnPrimary, entry.loading && styles.btnDisabled]}
            onPress={onGenerate}
            disabled={entry.loading}
          >
            {entry.loading ? (
              <View style={styles.btnContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.btnPrimaryText}>Generating…</Text>
              </View>
            ) : (
              <Text style={styles.btnPrimaryText}>Generate Prep Sheet</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.btnRow}>
            <Pressable style={[styles.btnPrimary, { flex: 1 }]} onPress={onToggle}>
              <Text style={styles.btnPrimaryText}>{isExpanded ? 'Hide Sheet' : 'View Sheet'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, entry.loading && styles.btnDisabled]}
              onPress={onGenerate}
              disabled={entry.loading}
            >
              {entry.loading ? (
                <ActivityIndicator size="small" color="#A78BFA" />
              ) : (
                <Ionicons name="refresh-outline" size={18} color="#A78BFA" />
              )}
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={onShare}>
              <Ionicons name="share-outline" size={18} color="#A78BFA" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Loading skeleton */}
      {entry.loading && !hasPrep ? <SkeletonBlock /> : null}

      {/* Expanded prep sheet */}
      {isExpanded && entry.content ? (
        <View style={[styles.prepSheet, { borderTopColor: theme.border }]}>
          <MarkdownView
            content={entry.content}
            textColor={theme.text}
            mutedColor={theme.textMuted}
          />
        </View>
      ) : null}
    </GlassCard>
  )
}

export default function VisitPrepScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, apiClient } = useProfile()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [prepState, setPrepState] = useState<Record<string, PrepEntry>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    apiClient.appointments
      .list(profile.careProfileId)
      .then((raw: unknown) => {
        const all: Appointment[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])
        const now = Date.now()
        const thirtyDays = now + 30 * 24 * 60 * 60 * 1000
        const upcoming = all.filter((a) => {
          if (!a.dateTime) return false
          const t = new Date(a.dateTime).getTime()
          return t >= now && t <= thirtyDays
        })
        setAppointments(upcoming)
        const initial: Record<string, PrepEntry> = {}
        for (const a of upcoming) initial[a.id] = { content: null, loading: false, error: null }
        setPrepState(initial)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile?.careProfileId, apiClient])

  const generatePrep = useCallback(async (apptId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setPrepState((prev) => ({
      ...prev,
      [apptId]: { ...prev[apptId], loading: true, error: null },
    }))
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(`${API_BASE}/api/visit-prep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appointment_id: apptId }),
      })
      if (!res.ok) throw new Error('Failed to generate prep sheet')
      const data = await res.json()
      if (data.success && data.prep_sheet) {
        setPrepState((prev) => ({
          ...prev,
          [apptId]: { content: data.prep_sheet, loading: false, error: null },
        }))
        setExpandedId(apptId)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        throw new Error(data.error || 'Failed to generate prep sheet')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setPrepState((prev) => ({
        ...prev,
        [apptId]: { ...prev[apptId], loading: false, error: msg },
      }))
    }
  }, [])

  const handleShare = useCallback(async (appt: Appointment, content: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await Share.share({
      title: `Visit Prep — ${appt.doctorName || 'Appointment'}`,
      message: content,
    })
  }, [])

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={theme.gradientA as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AmbientOrbs speedMultiplier={0.2} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Visit Prep</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Prepare for upcoming appointments
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            {[0, 1].map((i) => (
              <ShimmerSkeleton key={i} height={130} />
            ))}
          </View>
        ) : appointments.length === 0 ? (
          <GlassCard>
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={44} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No upcoming appointments</Text>
              <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                Appointments in the next 30 days will appear here for prep
              </Text>
            </View>
          </GlassCard>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={[styles.countLabel, { color: theme.textMuted }]}>
              {appointments.length} upcoming appointment{appointments.length !== 1 ? 's' : ''} · next 30 days
            </Text>
            {appointments.map((appt) => {
              const entry = prepState[appt.id] ?? { content: null, loading: false, error: null }
              return (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  entry={entry}
                  isExpanded={expandedId === appt.id}
                  onGenerate={() => generatePrep(appt.id)}
                  onToggle={() => setExpandedId((prev) => (prev === appt.id ? null : appt.id))}
                  onShare={() => handleShare(appt, entry.content!)}
                />
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 12, marginTop: 2, padding: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },
  countLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  apptCard: { marginBottom: 0 },
  apptHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  doctorName: { fontSize: 15, fontWeight: '600' },
  specialtyBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  specialtyText: { fontSize: 10, fontWeight: '600', color: '#A78BFA', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12 },
  purpose: { fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
  },
  errorText: { fontSize: 12, color: '#F87171' },
  actions: { marginTop: 14 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnSecondary: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prepSheet: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyBody: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  // Markdown styles
  mdH1: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  mdH2: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  mdH3: { fontSize: 13, fontWeight: '600', marginBottom: 1 },
  mdPara: { fontSize: 12, lineHeight: 18 },
  mdBullet: { fontSize: 12, lineHeight: 18 },
  mdDot: { fontSize: 12, marginRight: 6, marginTop: 1 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, marginVertical: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginVertical: 1 },
  tableRow: { flexDirection: 'row', gap: 8, paddingVertical: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tableCell: { fontSize: 11, flex: 1 },
})
