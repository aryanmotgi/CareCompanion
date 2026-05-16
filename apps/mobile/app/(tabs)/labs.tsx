// apps/mobile/app/(tabs)/labs.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEV_STORE_LABS_KEY } from '../../src/services/healthkit'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { TabFadeWrapper } from './_layout'

const NEW_LABS_KEY = 'cc-new-labs-count'
const TAB_BAR_HEIGHT = 60

type Lab = {
  id: string
  testName: string
  value: string | null
  unit: string | null
  referenceRange: string | null
  isAbnormal?: boolean | null
  directionIsGood?: boolean | null
  dateTaken: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LabsScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, apiClient } = useProfile()

  const [labs, setLabs] = useState<Lab[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLabs = useCallback(async () => {
    if (!profile?.careProfileId) {
      if (__DEV__) {
        const raw = await AsyncStorage.getItem(DEV_STORE_LABS_KEY).catch(() => null)
        const arr: any[] = raw ? JSON.parse(raw) : []
        const normalised: Lab[] = arr.map((l) => ({
          id: l.id,
          testName: l.testName ?? 'Unknown',
          value: l.value ?? null,
          unit: l.unit ?? null,
          referenceRange: l.referenceRange ?? null,
          isAbnormal: l.isAbnormal ?? false,
          directionIsGood: l.directionIsGood ?? null,
          dateTaken: l.dateTaken ?? null,
        }))
        normalised.sort((a, b) => {
          const ta = a.dateTaken ? new Date(a.dateTaken).getTime() : 0
          const tb = b.dateTaken ? new Date(b.dateTaken).getTime() : 0
          return tb - ta
        })
        setLabs(normalised)
      }
      setLoading(false)
      return
    }
    setError(null)
    try {
      const raw = await apiClient.labResults.list(profile.careProfileId)
      const arr = Array.isArray(raw) ? raw : ((raw as any)?.labs ?? (raw as any)?.data ?? [])
      const normalised: Lab[] = arr.map((l: any) => ({
        id: l.id,
        testName: l.testName ?? l.test_name ?? 'Unknown',
        value: l.value ?? null,
        unit: l.unit ?? null,
        referenceRange: l.referenceRange ?? l.reference_range ?? null,
        isAbnormal: l.isAbnormal ?? l.is_abnormal ?? false,
        directionIsGood: l.directionIsGood ?? l.direction_is_good ?? null,
        dateTaken: l.dateTaken ?? l.date_taken ?? null,
      }))
      normalised.sort((a, b) => {
        const ta = a.dateTaken ? new Date(a.dateTaken).getTime() : 0
        const tb = b.dateTaken ? new Date(b.dateTaken).getTime() : 0
        return tb - ta
      })
      setLabs(normalised)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load labs.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile?.careProfileId, apiClient])

  useEffect(() => {
    setLoading(true)
    loadLabs()
  }, [loadLabs])

  // Reload labs on focus so data refreshes after HealthKit connect or any
  // background sync, including when the tab was already mounted.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.removeItem(NEW_LABS_KEY).catch(() => {})
      loadLabs()
    }, [loadLabs]),
  )

  const abnormal = labs.filter((l) => l.isAbnormal)
  const normal = labs.filter((l) => !l.isAbnormal)

  return (
    <TabFadeWrapper>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>Labs</Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
            {labs.length} result{labs.length === 1 ? '' : 's'} on file
            {abnormal.length > 0 ? ` · ${abnormal.length} flagged abnormal` : ''}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 32,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadLabs() }}
              tintColor={theme.accent}
            />
          }
        >
          {loading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : error ? (
            <View style={{ paddingTop: 32, alignItems: 'center', gap: 10 }}>
              <Ionicons name="cloud-offline-outline" size={32} color={theme.rose} />
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                Couldn't load labs
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
                {error}
              </Text>
              <Pressable
                onPress={loadLabs}
                style={{ backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
              </Pressable>
            </View>
          ) : labs.length === 0 ? (
            <View
              style={{
                padding: 24,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: 'rgba(255,255,255,0.03)',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Ionicons name="pulse" size={28} color={theme.accent} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                No lab results yet
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                Connect Apple Health to pull labs from your provider.
              </Text>
              <Pressable
                onPress={() => router.push('/health-connect' as any)}
                style={{ backgroundColor: theme.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Connect Apple Health</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/chat',
                    params: { prefill: 'Help me understand what lab tests to ask my oncologist for.' },
                  } as any)
                }
              >
                <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '600' }}>
                  Ask AI what to track →
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {abnormal.length > 0 && (
                <Section title={`FLAGGED ABNORMAL (${abnormal.length})`} theme={theme}>
                  {abnormal.map((l) => (
                    <LabRow
                      key={l.id}
                      lab={l}
                      theme={theme}
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/chat',
                          params: { prefill: `Explain my recent ${l.testName} result of ${l.value ?? ''}${l.unit ? ' ' + l.unit : ''} in plain language.` },
                        } as any)
                      }
                    />
                  ))}
                </Section>
              )}
              {normal.length > 0 && (
                <Section title={`ALL RESULTS (${normal.length})`} theme={theme}>
                  {normal.map((l) => (
                    <LabRow key={l.id} lab={l} theme={theme} />
                  ))}
                </Section>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </TabFadeWrapper>
  )
}

function Section({
  title,
  children,
  theme,
}: {
  title: string
  children: React.ReactNode
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <View>
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 0.8,
          fontWeight: '700',
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  )
}

function LabRow({
  lab,
  theme,
  onPress,
}: {
  lab: Lab
  theme: ReturnType<typeof useTheme>
  onPress?: () => void
}) {
  const abnormal = !!lab.isAbnormal
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: abnormal ? 'rgba(244,114,114,0.4)' : theme.border,
        backgroundColor: abnormal ? 'rgba(244,114,114,0.08)' : 'rgba(255,255,255,0.03)',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {lab.testName}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
          {fmtDate(lab.dateTaken)}
          {lab.referenceRange ? ` · normal ${lab.referenceRange}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            color: abnormal ? theme.rose : theme.text,
            fontSize: 16,
            fontWeight: '800',
          }}
        >
          {lab.value ?? '—'}
          {lab.unit ? <Text style={{ fontSize: 10, fontWeight: '500', color: theme.textMuted }}> {lab.unit}</Text> : null}
        </Text>
        {abnormal && (
          <Text style={{ color: theme.rose, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 }}>
            ABNORMAL
          </Text>
        )}
      </View>
      {onPress && <Ionicons name="sparkles-outline" size={14} color={theme.accent} />}
    </Pressable>
  )
}
