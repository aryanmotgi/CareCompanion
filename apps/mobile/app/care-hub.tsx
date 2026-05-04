// apps/mobile/app/care-hub.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { ShimmerSkeleton } from '../src/components/ShimmerSkeleton'
import { AmbientOrbs } from '../src/components/AmbientOrbs'
import { useProfile } from '../src/context/ProfileContext'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'

const ENERGY_MAP: Record<string, number> = { low: 1, med: 2, medium: 2, high: 3 }
function energyToNum(e: string): number {
  return ENERGY_MAP[e?.toLowerCase()] ?? 2
}

const ACTION_LABELS: Record<string, string> = {
  logged_meds: 'Logged medications',
  completed_checkin: 'Completed a check-in',
  viewed_summary: 'Viewed health summary',
  shared_link: 'Shared a health link',
  exported_pdf: 'Exported a PDF',
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

interface Checkin {
  mood: number
  pain: number
  energy: string
  checkedInAt: string
}

interface TodayCheckin extends Checkin {
  sleep: string
  notes: string | null
}

interface Insight {
  id: string
  type: string
  severity: string
  title: string
  body: string
  createdAt: string
}

interface Medication {
  id: string
  name: string
  dose: string | null
  frequency: string | null
}

interface Activity {
  id: string
  userId: string
  action: string
  metadata: unknown
  createdAt: string
  userName: string | null
}

interface UpcomingAppt {
  id: string
  doctorName: string | null
  specialty: string | null
  dateTime: string | null
  location: string | null
  purpose: string | null
}

interface CareHubData {
  profile: {
    id: string
    patientName: string | null
    cancerType: string | null
    treatmentPhase: string | null
    checkinStreak: number
  } | null
  todayCheckin: TodayCheckin | null
  recentCheckins: Checkin[]
  insights: Insight[]
  medications: Medication[]
  activity: Activity[]
  upcoming: UpcomingAppt[]
}

function getStatusBadge(checkin: TodayCheckin | null): {
  label: string
  bg: string
  color: string
} {
  if (!checkin) return { label: 'No Check-in', bg: 'rgba(255,255,255,0.06)', color: '#94a3b8' }
  const { pain, mood } = checkin
  if (pain >= 7 || mood <= 1)
    return { label: 'Needs Attention', bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }
  if (pain >= 4 || mood <= 2)
    return { label: 'Watch', bg: 'rgba(245,158,11,0.15)', color: '#FBBF24' }
  return { label: 'All Clear', bg: 'rgba(16,185,129,0.15)', color: '#6EE7B7' }
}

function getOrbColor(
  metric: 'pain' | 'energy' | 'mood',
  value: number,
): { fill: string; border: string } {
  let level: 'good' | 'warn' | 'bad'
  if (metric === 'pain') level = value <= 3 ? 'good' : value <= 6 ? 'warn' : 'bad'
  else if (metric === 'energy') level = value >= 3 ? 'good' : value >= 2 ? 'warn' : 'bad'
  else level = value >= 4 ? 'good' : value >= 3 ? 'warn' : 'bad'
  if (level === 'good') return { fill: '#6EE7B7', border: 'rgba(110,231,183,0.4)' }
  if (level === 'warn') return { fill: '#FBBF24', border: 'rgba(251,191,36,0.4)' }
  return { fill: '#FCA5A5', border: 'rgba(252,165,165,0.4)' }
}

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const BAR_W = 4
  const BAR_GAP = 2
  const MAX_H = 20
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: MAX_H, gap: BAR_GAP }}>
      {data.slice(-10).map((v, i) => (
        <View
          key={i}
          style={{
            width: BAR_W,
            height: Math.max(2, (v / max) * MAX_H),
            borderRadius: 2,
            backgroundColor: color,
            opacity: 0.7 + 0.3 * (i / (data.length - 1)),
          }}
        />
      ))}
    </View>
  )
}

function SymptomRadarCard({
  recentCheckins,
}: {
  recentCheckins: Checkin[]
}) {
  const theme = useTheme()
  const sorted = [...recentCheckins].sort(
    (a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime(),
  )
  const last = sorted[sorted.length - 1]
  const latestPain = last?.pain ?? 0
  const latestEnergy = last ? energyToNum(last.energy) : 2
  const latestMood = last?.mood ?? 3

  const orbs = [
    {
      label: 'Pain',
      metric: 'pain' as const,
      value: latestPain,
      display: `${latestPain}/10`,
      data: sorted.map((c) => c.pain),
    },
    {
      label: 'Energy',
      metric: 'energy' as const,
      value: latestEnergy,
      display: latestEnergy === 3 ? 'High' : latestEnergy === 2 ? 'Med' : 'Low',
      data: sorted.map((c) => energyToNum(c.energy)),
    },
    {
      label: 'Mood',
      metric: 'mood' as const,
      value: latestMood,
      display: `${latestMood}/5`,
      data: sorted.map((c) => c.mood),
    },
  ]

  return (
    <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(139,92,246,0.18)', borderWidth: 1 }]}>
      <Text style={[styles.cardLabel, { color: theme.textMuted }]}>SYMPTOM RADAR</Text>

      {sorted.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No check-in data yet</Text>
      ) : (
        <>
          <View style={styles.orbsRow}>
            {orbs.map((orb) => {
              const c = getOrbColor(orb.metric, orb.value)
              return (
                <View key={orb.label} style={styles.orbContainer}>
                  <View
                    style={[
                      styles.orb,
                      {
                        backgroundColor: `${c.fill}20`,
                        borderColor: c.border,
                        borderWidth: 1.5,
                        shadowColor: c.fill,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 6,
                      },
                    ]}
                  >
                    <Text style={styles.orbValue}>{orb.display}</Text>
                  </View>
                  <Text style={[styles.orbLabel, { color: theme.textMuted }]}>{orb.label}</Text>
                </View>
              )
            })}
          </View>

          <View style={{ gap: 6, marginTop: 8 }}>
            {orbs.map((orb) =>
              orb.data.length >= 2 ? (
                <View key={orb.label} style={styles.sparkRow}>
                  <Text style={[styles.sparkLabel, { color: theme.textMuted }]}>{orb.label}</Text>
                  <MiniBarChart data={orb.data} color={getOrbColor(orb.metric, orb.value).fill} />
                </View>
              ) : null,
            )}
          </View>
        </>
      )}
    </View>
  )
}

function SectionCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(139,92,246,0.18)', borderWidth: 1 }]}>
      <Text style={[styles.cardLabel, { color: theme.textMuted }]}>{label}</Text>
      {children}
    </View>
  )
}

function SkeletonScreen() {
  return (
    <View style={{ gap: 12 }}>
      <ShimmerSkeleton height={80} />
      {[0, 1, 2, 3].map((i) => (
        <ShimmerSkeleton key={i} height={110} />
      ))}
    </View>
  )
}

export default function CareHubScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile } = useProfile()

  const [data, setData] = useState<CareHubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      const res = await fetch(
        `${API_BASE}/api/care-hub?careProfileId=${encodeURIComponent(profile.careProfileId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('Failed to load Care Hub')
      const json = await res.json()
      if (json.ok) {
        setData(json.data)
        setError(null)
      } else {
        setError(json.error || 'Unknown error')
      }
    } catch {
      setError('Failed to load Care Hub data')
    } finally {
      setLoading(false)
    }
  }, [profile?.careProfileId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const patientName = profile?.patientName ?? 'Patient'
  const initials = (patientName[0] ?? 'P').toUpperCase()

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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Care Hub</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            Live health overview
          </Text>
        </View>
        <Pressable onPress={() => { setLoading(true); fetchData() }} hitSlop={8}>
          <Ionicons name="refresh-outline" size={20} color={theme.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <SkeletonScreen />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{error}</Text>
            <Pressable onPress={() => { setLoading(true); fetchData() }} style={styles.retryBtn}>
              <Text style={{ color: theme.accent, fontSize: 13 }}>Retry</Text>
            </Pressable>
          </View>
        ) : !data ? null : (
          <View style={{ gap: 10 }}>
            {/* Patient status banner */}
            {(() => {
              const status = getStatusBadge(data.todayCheckin)
              return (
                <View style={[styles.statusBanner, { backgroundColor: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.2)', borderWidth: 1 }]}>
                  <LinearGradient
                    colors={['#6366F1', '#A78BFA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>{initials}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.patientName, { color: theme.text }]} numberOfLines={1}>
                      {patientName}
                    </Text>
                    {data.todayCheckin ? (
                      <Text style={[styles.checkinMeta, { color: theme.textMuted }]}>
                        Mood {data.todayCheckin.mood}/5 · Pain {data.todayCheckin.pain}/10 · Energy {data.todayCheckin.energy}
                      </Text>
                    ) : (
                      <Text style={[styles.checkinMeta, { color: theme.textMuted }]}>No check-in today</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              )
            })()}

            {/* Symptom Radar */}
            <SymptomRadarCard recentCheckins={data.recentCheckins} />

            {/* Medications */}
            <SectionCard label="MEDICATIONS">
              {data.medications.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No medications tracked</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {data.medications.map((med) => (
                    <View key={med.id} style={styles.medRow}>
                      <View style={styles.medCheck}>
                        <Ionicons name="checkmark" size={12} color="#6EE7B7" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.medName, { color: theme.text }]} numberOfLines={1}>
                          {med.name}
                        </Text>
                        <Text style={[styles.medMeta, { color: theme.textMuted }]}>
                          {[med.dose, med.frequency].filter(Boolean).join(' · ') || 'No details'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* AI Insights */}
            <SectionCard label="AI INSIGHTS">
              {data.insights.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No active insights right now</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.insights.map((insight) => {
                    const dotColor =
                      insight.severity === 'alert'
                        ? '#F87171'
                        : insight.severity === 'watch'
                          ? '#FBBF24'
                          : '#6EE7B7'
                    const tintBg =
                      insight.severity === 'alert'
                        ? 'rgba(239,68,68,0.06)'
                        : insight.severity === 'watch'
                          ? 'rgba(245,158,11,0.06)'
                          : 'rgba(16,185,129,0.06)'
                    return (
                      <View key={insight.id} style={[styles.insightRow, { backgroundColor: tintBg }]}>
                        <View style={[styles.insightDot, { backgroundColor: dotColor }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.insightTitle, { color: theme.text }]}>
                            {insight.title}
                          </Text>
                          <Text style={[styles.insightBody, { color: theme.textMuted }]} numberOfLines={3}>
                            {insight.body}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </SectionCard>

            {/* Care Team Activity */}
            <SectionCard label="CARE TEAM ACTIVITY">
              {data.activity.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No recent activity</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {data.activity.map((item) => (
                    <View key={item.id} style={styles.activityRow}>
                      <View style={styles.activityAvatar}>
                        <Text style={styles.activityAvatarText}>
                          {(item.userName || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.activityName, { color: theme.text }]} numberOfLines={2}>
                          <Text style={{ fontWeight: '600' }}>{item.userName || 'Team member'}</Text>
                          {' '}
                          <Text style={{ color: theme.textMuted }}>
                            {ACTION_LABELS[item.action] || item.action}
                          </Text>
                        </Text>
                        <Text style={[styles.activityTime, { color: theme.textMuted }]}>
                          {item.createdAt ? relativeTime(item.createdAt) : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* Upcoming Appointments */}
            <SectionCard label="UPCOMING">
              {data.upcoming.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No upcoming appointments</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {data.upcoming.map((appt) => {
                    const d = appt.dateTime ? new Date(appt.dateTime) : null
                    return (
                      <View key={appt.id} style={styles.apptRow}>
                        {d ? (
                          <View style={styles.dateBlock}>
                            <Text style={[styles.dateMonth, { color: theme.textMuted }]}>
                              {d.toLocaleDateString(undefined, { month: 'short' })}
                            </Text>
                            <Text style={[styles.dateDay, { color: theme.text }]}>
                              {d.getDate()}
                            </Text>
                          </View>
                        ) : null}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.apptDoctor, { color: theme.text }]} numberOfLines={1}>
                            {appt.doctorName || 'Appointment'}
                          </Text>
                          <Text style={[styles.apptMeta, { color: theme.textMuted }]} numberOfLines={1}>
                            {[
                              appt.specialty,
                              d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null,
                              appt.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          {appt.purpose ? (
                            <Text style={[styles.apptPurpose, { color: theme.textMuted }]} numberOfLines={1}>
                              {appt.purpose}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </SectionCard>
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
  content: { padding: 16 },
  errorContainer: { alignItems: 'center', paddingVertical: 32 },
  retryBtn: { marginTop: 8 },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  patientName: { fontSize: 15, fontWeight: '700' },
  checkinMeta: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // Cards
  card: { borderRadius: 14, padding: 14 },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyText: { fontSize: 12 },

  // Radar orbs
  orbsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  orbContainer: { alignItems: 'center', gap: 6 },
  orb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbValue: { color: '#fff', fontSize: 11, fontWeight: '700' },
  orbLabel: { fontSize: 10 },

  // Sparklines
  sparkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sparkLabel: { fontSize: 10, width: 50 },

  // Medications
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  medCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(110,231,183,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  medName: { fontSize: 13, fontWeight: '500' },
  medMeta: { fontSize: 10, marginTop: 1 },

  // Insights
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 10 },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  insightTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  insightBody: { fontSize: 11, lineHeight: 16 },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  activityAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityAvatarText: { fontSize: 10, fontWeight: '700', color: '#A78BFA' },
  activityName: { fontSize: 12 },
  activityTime: { fontSize: 10, marginTop: 2 },

  // Upcoming
  apptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dateBlock: { width: 36, alignItems: 'center', flexShrink: 0 },
  dateMonth: { fontSize: 10, textTransform: 'uppercase' },
  dateDay: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  apptDoctor: { fontSize: 13, fontWeight: '600' },
  apptMeta: { fontSize: 10, marginTop: 1 },
  apptPurpose: { fontSize: 10, marginTop: 1 },
})
