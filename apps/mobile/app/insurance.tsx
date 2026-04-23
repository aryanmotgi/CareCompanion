import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'
import { useProfile } from '../src/context/ProfileContext'

// ── Types ────────────────────────────────────────────────────────────────────

type ClaimStatus = 'paid' | 'pending' | 'denied' | 'in_review'
type FilterTab = 'all' | 'pending' | 'paid' | 'denied' | 'in_review'

interface Claim {
  id: string
  providerName: string
  serviceDate: string
  billedAmount: number
  paidAmount: number
  status: ClaimStatus
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; bgOpacity: string }> = {
  paid: { label: 'Approved', color: '#10b981', bgOpacity: 'rgba(16,185,129,0.12)' },
  pending: { label: 'Pending', color: '#eab308', bgOpacity: 'rgba(234,179,8,0.12)' },
  denied: { label: 'Denied', color: '#ef4444', bgOpacity: 'rgba(239,68,68,0.12)' },
  in_review: { label: 'In Review', color: '#6366F1', bgOpacity: 'rgba(99,102,241,0.12)' },
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'in_review', label: 'In Review' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InsuranceScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile } = useProfile()

  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Claims would come from an API — start with empty state since mobile
  // doesn't have claims endpoint wired yet.
  const claims: Claim[] = []

  // ── Computed stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalClaims = claims.length
    const approvedAmount = claims
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + (c.paidAmount ?? 0), 0)
    const pendingCount = claims.filter((c) => c.status === 'pending').length
    const deniedCount = claims.filter((c) => c.status === 'denied').length
    return { totalClaims, approvedAmount, pendingCount, deniedCount }
  }, [claims])

  // ── Filtered claims ──────────────────────────────────────────────────────

  const filteredClaims = useMemo(() => {
    if (activeTab === 'all') return claims
    return claims.filter((c) => c.status === activeTab)
  }, [claims, activeTab])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: t.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: t.text }]}>Insurance & Claims</Text>
          <Text style={[s.subtitle, { color: t.textMuted }]}>
            Your coverage and active claims
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[s.closeBtn, { backgroundColor: t.bgElevated }]}
        >
          <Text style={[s.closeBtnText, { color: t.textSub }]}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats cards — 2x2 grid */}
        <View style={s.statsGrid}>
          <GlassCard style={s.statCard}>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Total Claims</Text>
            <Text style={[s.statValue, { color: t.text }]}>{stats.totalClaims}</Text>
          </GlassCard>

          <GlassCard style={s.statCard}>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Approved</Text>
            <Text style={[s.statValue, { color: t.green }]}>
              {formatCurrency(stats.approvedAmount)}
            </Text>
          </GlassCard>

          <GlassCard style={s.statCard}>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Pending</Text>
            <Text style={[s.statValue, { color: t.amber }]}>{stats.pendingCount}</Text>
          </GlassCard>

          <GlassCard style={s.statCard}>
            <Text style={[s.statLabel, { color: t.textMuted }]}>Denied</Text>
            <Text style={[s.statValue, { color: t.rose }]}>{stats.deniedCount}</Text>
          </GlassCard>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={s.filterScroll}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  s.filterPill,
                  {
                    backgroundColor: isActive ? t.cyan : t.bgElevated,
                    borderColor: isActive ? t.cyan : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterText,
                    {
                      color: isActive
                        ? t.isDark
                          ? '#0C0E1A'
                          : '#FFFFFF'
                        : t.textSub,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Claims list */}
        {filteredClaims.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={[s.emptyIcon, { backgroundColor: t.bgElevated }]}>
              <Text style={{ fontSize: 24 }}>📋</Text>
            </View>
            <Text style={[s.emptyTitle, { color: t.textSub }]}>
              {activeTab === 'all'
                ? 'No claims found'
                : `No ${FILTER_TABS.find((f) => f.key === activeTab)?.label.toLowerCase()} claims`}
            </Text>
            <Text style={[s.emptyDesc, { color: t.textMuted }]}>
              {activeTab === 'all'
                ? 'Claims from your insurance will appear here once synced.'
                : `No ${FILTER_TABS.find((f) => f.key === activeTab)?.label.toLowerCase()} claims right now.`}
            </Text>
          </View>
        ) : (
          <View style={s.claimsList}>
            {filteredClaims.map((claim) => {
              const status = STATUS_CONFIG[claim.status]
              return (
                <GlassCard key={claim.id} style={s.claimCard}>
                  <View style={s.claimRow}>
                    {/* Status dot */}
                    <View style={[s.statusDot, { backgroundColor: status.color }]} />

                    <View style={s.claimContent}>
                      <View style={s.claimTopRow}>
                        <Text
                          style={[s.claimProvider, { color: t.text }]}
                          numberOfLines={1}
                        >
                          {claim.providerName || 'Unknown Provider'}
                        </Text>
                        <View
                          style={[
                            s.statusBadge,
                            { backgroundColor: status.bgOpacity },
                          ]}
                        >
                          <Text style={[s.statusBadgeText, { color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                      </View>

                      <View style={s.claimMeta}>
                        <Text style={[s.claimDate, { color: t.textMuted }]}>
                          {formatDate(claim.serviceDate)}
                        </Text>
                        <Text style={[s.claimSep, { color: t.border }]}>|</Text>
                        <Text style={[s.claimAmount, { color: t.text }]}>
                          {formatCurrency(claim.billedAmount)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              )
            })}
          </View>
        )}

        {/* Add Insurance CTA */}
        <Pressable
          onPress={() => {
            router.push({
              pathname: '/(tabs)',
              params: {
                prompt: 'Add my insurance — provider name, member ID, and group number',
              },
            })
          }}
          style={({ pressed }) => [
            s.ctaBtn,
            {
              backgroundColor: t.cyan,
              opacity: pressed ? 0.85 : 1,
              ...t.shadowGlowCyan,
            },
          ]}
        >
          <Text
            style={[
              s.ctaText,
              { color: t.isDark ? '#0C0E1A' : '#FFFFFF' },
            ]}
          >
            + Add Insurance Plan
          </Text>
        </Pressable>

        {/* Bottom spacing */}
        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%' as unknown as number,
    flexGrow: 1,
    padding: 14,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  // Filters
  filterScroll: {
    marginBottom: 20,
    marginHorizontal: -24,
  },
  filterRow: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },

  // Claims
  claimsList: {
    gap: 12,
  },
  claimCard: {
    padding: 14,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  claimContent: {
    flex: 1,
  },
  claimTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  claimProvider: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  claimMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  claimDate: {
    fontSize: 12,
  },
  claimSep: {
    fontSize: 12,
  },
  claimAmount: {
    fontSize: 12,
    fontWeight: '600',
  },

  // CTA
  ctaBtn: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
