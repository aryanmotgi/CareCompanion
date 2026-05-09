// apps/mobile/app/(tabs)/trials.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Share,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { ShimmerSkeleton } from '../../src/components/ShimmerSkeleton'
import { TrialMatchCard } from '../../src/components/trials/TrialMatchCard'
import { CloseMatchCard } from '../../src/components/trials/CloseMatchCard'
import { TabFadeWrapper } from './_layout'
import type { TrialMatch } from '@carecompanion/api'

const SEARCH_PHASES = [
  'Reviewing your medical profile…',
  'Searching clinical trials database…',
  'Analyzing eligibility criteria…',
  'Scoring trial matches…',
  'Almost there…',
]

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function TrialsSkeleton() {
  return (
    <View>
      {[0, 1].map(i => (
        <View key={i} style={{ marginBottom: 10 }}>
          <ShimmerSkeleton height={130} />
        </View>
      ))}
    </View>
  )
}

function LiveSearchOverlay({ phase }: { phase: number }) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()

  const outerScale = useSharedValue(1)
  const outerOpacity = useSharedValue(0.2)
  const midScale = useSharedValue(1)
  const midOpacity = useSharedValue(0.3)

  useEffect(() => {
    if (reduceMotion) return
    outerScale.value = withRepeat(
      withTiming(1.7, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    )
    outerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 0 }),
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    )
    midScale.value = withRepeat(
      withTiming(1.45, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    )
    midOpacity.value = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 0 }),
        withTiming(0, { duration: 2200, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [reduceMotion, outerScale, outerOpacity, midScale, midOpacity])

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }))

  const midStyle = useAnimatedStyle(() => ({
    transform: [{ scale: midScale.value }],
    opacity: midOpacity.value,
  }))

  return (
    <View style={[StyleSheet.absoluteFill, overlayStyles.overlay, { backgroundColor: theme.bg }]}>
      <View style={overlayStyles.pulseContainer}>
        <Animated.View style={[overlayStyles.pulseOuter, { backgroundColor: 'rgba(124,58,237,0.25)' }, outerStyle]} />
        <Animated.View style={[overlayStyles.pulseMid, { backgroundColor: 'rgba(99,102,241,0.30)' }, midStyle]} />
        <View style={[overlayStyles.pulseCore, { backgroundColor: '#7C3AED' }]}>
          <Ionicons name="flask" size={28} color="#fff" />
        </View>
      </View>

      <Text style={[overlayStyles.phaseText, { color: theme.text }]}>
        {SEARCH_PHASES[phase]}
      </Text>
      <Text style={overlayStyles.phaseSub}>
        Searching thousands of active trials for your profile
      </Text>

      <View style={overlayStyles.dotsRow}>
        {SEARCH_PHASES.map((_, i) => (
          <View
            key={i}
            style={[
              overlayStyles.dot,
              { backgroundColor: i <= phase ? '#A78BFA' : 'rgba(167,139,250,0.2)' },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

export default function TrialsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, apiClient, refetch } = useProfile()

  const [matched, setMatched] = useState<TrialMatch[]>([])
  const [close, setClose] = useState<TrialMatch[]>([])
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [liveRunning, setLiveRunning] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [livePhase, setLivePhase] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Cancer type onboarding prompt
  const [cancerTypeInput, setCancerTypeInput] = useState('')
  const [submittingCancerType, setSubmittingCancerType] = useState(false)

  // Rotate loading phases
  useEffect(() => {
    if (!liveRunning) { setLivePhase(0); return }
    const id = setInterval(() => setLivePhase(p => Math.min(p + 1, SEARCH_PHASES.length - 1)), 8000)
    return () => clearInterval(id)
  }, [liveRunning])

  // Load cached results on mount
  useEffect(() => {
    Promise.allSettled([
      apiClient.trials.getMatches(),
      apiClient.trials.getSaved(),
    ]).then(([matchResult, savedResult]) => {
      if (matchResult.status === 'fulfilled') {
        const data = matchResult.value
        const m = data.matched ?? []
        const c = data.close ?? []
        setMatched(m)
        setClose(c)
        const allUpdates = [...m, ...c]
          .map(t => t.updatedAt)
          .filter((v): v is string => Boolean(v))
        if (allUpdates.length > 0) {
          setLastUpdated(allUpdates.sort().at(-1)!)
        }
      } else {
        setLoadError(true)
      }
      if (savedResult.status === 'fulfilled') {
        const savedMap: Record<string, string> = {}
        for (const s of savedResult.value) {
          savedMap[s.nctId] = s.interestStatus
        }
        setSaved(savedMap)
      }
    }).finally(() => setLoading(false))
  }, [apiClient])

  async function runLive() {
    if (liveRunning || !csrfToken) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLiveRunning(true)
    setLiveError(null)
    try {
      const data = await apiClient.trials.runMatch(csrfToken)
      setMatched(data.matched ?? [])
      setClose(data.close ?? [])
      setLastUpdated(data.refreshedAt ?? new Date().toISOString())
      setHasSearched(true)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Search failed — try again')
      setHasSearched(true)
    } finally {
      setLiveRunning(false)
    }
  }

  async function saveCancerType() {
    if (!cancerTypeInput.trim() || !csrfToken) return
    setSubmittingCancerType(true)
    try {
      await apiClient.updateMe({ cancerType: cancerTypeInput.trim() }, csrfToken)
      await refetch()
    } catch {
      // Silent fail — user sees the input still populated
    } finally {
      setSubmittingCancerType(false)
    }
  }

  function saveTrial(nctId: string) {
    setSaved(s => ({ ...s, [nctId]: 'interested' }))
    if (!csrfToken) return
    apiClient.trials.saveTrial(nctId, csrfToken).catch(() => {
      setSaved(s => {
        const next = { ...s }
        delete next[nctId]
        return next
      })
    })
  }

  function dismissTrial(nctId: string) {
    const wasMatched = matched.filter(t => t.nctId === nctId)
    const wasClose = close.filter(t => t.nctId === nctId)
    setMatched(m => m.filter(t => t.nctId !== nctId))
    setClose(c => c.filter(t => t.nctId !== nctId))
    if (!csrfToken) return
    apiClient.trials.updateSaved(nctId, 'dismissed', csrfToken).catch(() => {
      if (wasMatched.length > 0) setMatched(m => [...m, ...wasMatched])
      if (wasClose.length > 0) setClose(c => [...c, ...wasClose])
    })
  }

  function shareTrial(nctId: string, title: string, url: string) {
    const trialLink = url || `https://clinicaltrials.gov/study/${nctId}`
    void Share.share({
      title,
      message: `I found this clinical trial, can we discuss?\n${trialLink}`,
    })
  }

  const hasResults = matched.length > 0 || close.length > 0
  const cancerType = profile?.cancerType ?? null

  return (
    <TabFadeWrapper>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Clinical Trials</Text>
              {lastUpdated ? (
                <Text style={[styles.headerSub, { color: theme.textMuted }]}>
                  Updated {formatRelativeTime(lastUpdated)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => void runLive()}
              disabled={liveRunning || !cancerType}
              style={[
                styles.refreshBtn,
                { backgroundColor: theme.accent },
                (liveRunning || !cancerType) && styles.btnDisabled,
              ]}
            >
              <Text style={styles.refreshBtnText}>
                {hasResults ? 'Refresh' : 'Find trials'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Cancer type prompt */}
          {!cancerType && (
            <View style={[styles.promptCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Text style={[styles.promptTitle, { color: theme.text }]}>Add your diagnosis</Text>
              <Text style={[styles.promptSub, { color: theme.textMuted }]}>
                We need your cancer type to find matching clinical trials.
              </Text>
              <TextInput
                value={cancerTypeInput}
                onChangeText={setCancerTypeInput}
                placeholder="e.g. Breast cancer, Stage III"
                placeholderTextColor={theme.textMuted}
                style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bgElevated }]}
                returnKeyType="done"
                onSubmitEditing={() => void saveCancerType()}
                autoCapitalize="words"
              />
              <Pressable
                onPress={() => void saveCancerType()}
                disabled={submittingCancerType || !cancerTypeInput.trim()}
                style={[
                  styles.promptBtn,
                  { backgroundColor: theme.accent },
                  (submittingCancerType || !cancerTypeInput.trim()) && styles.btnDisabled,
                ]}
              >
                <Text style={styles.promptBtnText}>
                  {submittingCancerType ? 'Saving…' : 'Save & search'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Error banner from live search */}
          {liveError ? (
            <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Text style={[styles.errorText, { color: '#F87171' }]}>
                Search failed: {liveError}
              </Text>
            </View>
          ) : null}

          {/* Load error */}
          {loadError && !loading ? (
            <View style={[styles.promptCard, { backgroundColor: theme.bgCard, borderColor: theme.border, alignItems: 'center' }]}>
              <Ionicons name="alert-circle-outline" size={36} color={theme.rose} style={{ marginBottom: 10 }} />
              <Text style={[styles.promptTitle, { color: theme.text }]}>Couldn't load matches</Text>
              <Text style={[styles.promptSub, { color: theme.textMuted, textAlign: 'center' }]}>
                Check your connection and try again.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <TrialsSkeleton />
          ) : (
            <>
              {/* Matched trials */}
              {matched.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Matched Trials</Text>
                    <View style={[styles.countBadge, { backgroundColor: 'rgba(167,139,250,0.20)' }]}>
                      <Text style={[styles.countText, { color: theme.violet }]}>{matched.length}</Text>
                    </View>
                  </View>
                  {matched.map(t => (
                    <TrialMatchCard
                      key={t.nctId}
                      trial={t}
                      savedStatus={saved[t.nctId] ?? null}
                      onSave={saveTrial}
                      onDismiss={dismissTrial}
                      onShare={shareTrial}
                    />
                  ))}
                </View>
              )}

              {/* Close / "almost there" trials */}
              {close.length > 0 && (
                <View style={[styles.section, matched.length > 0 ? { marginTop: 8 } : null]}>
                  <View style={styles.closeHeader}>
                    <Text style={[styles.closeTitle, { color: theme.textMuted }]}>
                      ALMOST THERE — WORTH WATCHING
                    </Text>
                    <Text style={[styles.closeSub, { color: theme.textMuted }]}>
                      You don't qualify right now, but these are close. We're watching them for you.
                    </Text>
                  </View>
                  {close.map(t => (
                    <CloseMatchCard
                      key={t.nctId}
                      trial={t}
                      savedStatus={saved[t.nctId] ?? null}
                      onSave={saveTrial}
                      onDismiss={dismissTrial}
                    />
                  ))}
                </View>
              )}

              {/* Empty state */}
              {!hasResults && cancerType && !loadError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🔬</Text>
                  {hasSearched ? (
                    <>
                      <Text style={[styles.emptyTitle, { color: theme.textSub }]}>
                        No matches right now
                      </Text>
                      <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                        Trials open every week. We'll notify you when something fits your profile. Try updating your diagnosis details or ask your oncologist about specific trials.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.emptyTitle, { color: theme.textSub }]}>
                        Ready to search
                      </Text>
                      <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                        Tap "Find trials" and we'll scan thousands of active trials for your exact profile.
                      </Text>
                    </>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Live search overlay — rendered last so it sits on top */}
        {liveRunning && <LiveSearchOverlay phase={livePhase} />}
      </View>
    </TabFadeWrapper>
  )
}

const overlayStyles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 128,
    height: 128,
    marginBottom: 32,
  },
  pulseOuter: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  pulseMid: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  pulseCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 32,
  },
  phaseSub: {
    fontSize: 13,
    color: '#A78BFA',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 4,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  promptCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  promptBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  promptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
  },
  section: {
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeHeader: {
    marginBottom: 10,
  },
  closeTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeSub: {
    fontSize: 11,
    marginTop: 3,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
})
