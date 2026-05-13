import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme'
import { GlassCard } from './GlassCard'
import { ShimmerSkeleton } from './ShimmerSkeleton'
import { isHealthKitConnected, syncHealthKitData } from '../services/healthkit'

type Med = {
  id: string
  name: string
  dose?: string | null
  frequency?: string | null
}

interface Props {
  meds: Med[] | null // null = loading
  onSynced?: () => void
}

export function TodaysMedicationsCard({ meds, onSynced }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const [hkConnected, setHkConnected] = useState<boolean | null>(null)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [autoSyncTried, setAutoSyncTried] = useState(false)

  useEffect(() => {
    let cancelled = false
    isHealthKitConnected()
      .then((c) => { if (!cancelled) setHkConnected(c) })
      .catch(() => { if (!cancelled) setHkConnected(false) })
    return () => { cancelled = true }
  }, [])

  // Auto-fetch from HealthKit on first load when meds list comes back empty.
  useEffect(() => {
    if (autoSyncTried) return
    if (meds === null) return
    if (meds.length > 0) return
    if (hkConnected !== true) return
    setAutoSyncTried(true)
    setAutoSyncing(true)
    syncHealthKitData()
      .then((res) => {
        if (res.synced > 0) onSynced?.()
      })
      .catch(() => {/* swallow */})
      .finally(() => setAutoSyncing(false))
  }, [meds, hkConnected, autoSyncTried, onSynced])

  if (meds === null || autoSyncing) {
    return (
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={{ padding: 16 }}>
          {autoSyncing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <ActivityIndicator color={theme.accent} />
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                Pulling medications from Apple Health…
              </Text>
            </View>
          ) : (
            <>
              <ShimmerSkeleton width="60%" height={12} style={{ marginBottom: 12 }} />
              <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
              <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
              <ShimmerSkeleton width="80%" height={16} />
            </>
          )}
        </View>
      </GlassCard>
    )
  }

  // Empty state with smart CTA — pulls from Apple Health if connected, else
  // opens the AI chat with a medication-relevant prefilled prompt.
  if (meds.length === 0) {
    const canPullFromHK = hkConnected === true
    return (
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={{ padding: 16 }}>
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '600',
              marginBottom: 10,
            }}
          >
            TODAY'S MEDICATIONS
          </Text>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
            No medications on file yet.
          </Text>
          {canPullFromHK ? (
            <Pressable
              onPress={() => {
                setAutoSyncing(true)
                syncHealthKitData()
                  .then((res) => { if (res.synced > 0) onSynced?.() })
                  .catch(() => {})
                  .finally(() => setAutoSyncing(false))
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: 'rgba(99,102,241,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.4)',
                opacity: pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Pull medications from Apple Health"
            >
              <Ionicons name="medical-outline" size={18} color={theme.accent} />
              <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>
                Pull from Apple Health
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/chat',
                  params: { prefill: 'Help me set up my medication list — what should I track for someone on cancer treatment?' },
                } as any)
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: 'rgba(167,139,250,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.4)',
                opacity: pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Ask AI about medications"
            >
              <Ionicons name="sparkles-outline" size={18} color="#A78BFA" />
              <Text style={{ color: '#A78BFA', fontSize: 14, fontWeight: '700' }}>
                Ask AI to help set this up
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/medications/new' as any)}
            hitSlop={8}
            style={{ marginTop: 10, alignSelf: 'center' }}
          >
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>
              Or add manually
            </Text>
          </Pressable>
        </View>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      style={{ marginBottom: 12 }}
      onPress={() => router.push('/(tabs)/care' as any)}
    >
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            TODAY'S MEDICATIONS
          </Text>
          {meds.length > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: 'rgba(99,102,241,0.2)',
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                {meds.length} {meds.length === 1 ? 'med' : 'meds'}
              </Text>
            </View>
          )}
        </View>

        {meds.map((med) => (
          <View
            key={med.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.amber,
              }}
            />
            <Text
              style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {med.name}
              {med.dose ? ` · ${med.dose}` : ''}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
              {med.frequency || ''}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  )
}
