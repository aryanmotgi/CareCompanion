import React, { useState, useEffect } from 'react'
import {
  Alert,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  FadeIn,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProfile } from '../src/context/ProfileContext'
import { fetchHealthKitBaseline } from '../src/services/healthkit'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface StepConfig {
  key: string
  icon: keyof typeof Ionicons.glyphMap
  emoji: string
  title: string
  subtitle: string
  type: 'chips' | 'text'
  options?: string[]
  placeholder?: string
}

// Step 1 is always HealthKit. Manual steps only show if user skips HealthKit.
const HEALTHKIT_STEP: StepConfig = {
  key: 'healthkit',
  icon: 'heart-circle-outline',
  emoji: '🏥',
  title: 'Connect your health records',
  subtitle: 'Automatically import your medications, lab results, conditions, and doctors from Apple Health. One tap, everything synced.',
  type: 'chips',
  options: ['Connect Now', 'Enter Manually'],
}

const MANUAL_STEPS: StepConfig[] = [
  {
    key: 'cancerType',
    icon: 'heart-outline',
    emoji: '🎗',
    title: 'What type of cancer?',
    subtitle: 'This helps us personalize your care experience',
    type: 'chips',
    options: [
      'Breast', 'Lung', 'Colorectal', 'Prostate',
      'Lymphoma', 'Leukemia', 'Melanoma', 'Ovarian',
      'Pancreatic', 'Thyroid', 'Bladder', 'Other',
    ],
  },
  {
    key: 'cancerStage',
    icon: 'layers-outline',
    emoji: '📊',
    title: 'What stage?',
    subtitle: 'Approximate is fine — affects trial eligibility',
    type: 'chips',
    options: ['Stage 0', 'Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Not sure'],
  },
  {
    key: 'treatmentPhase',
    icon: 'pulse-outline',
    emoji: '💊',
    title: 'Where are you in treatment?',
    subtitle: 'We\'ll tailor your timeline to your journey',
    type: 'chips',
    options: [
      'Just diagnosed', 'Starting treatment', 'Active chemo',
      'Active radiation', 'Post-surgery', 'Maintenance',
      'Remission', 'Monitoring', 'Other',
    ],
  },
  {
    key: 'dateOfBirth',
    icon: 'calendar-outline',
    emoji: '🎂',
    title: 'Date of birth',
    subtitle: 'Used for trial age eligibility — never displayed publicly',
    type: 'text',
    placeholder: 'YYYY-MM-DD',
  },
  {
    key: 'sexAtBirth',
    icon: 'person-outline',
    emoji: '⚧',
    title: 'Sex assigned at birth',
    subtitle: 'Many trials and dosing decisions reference this',
    type: 'chips',
    options: ['Female', 'Male', 'Intersex', 'Prefer not to say'],
  },
  {
    key: 'zipCode',
    icon: 'location-outline',
    emoji: '📍',
    title: 'Your postal code',
    subtitle: 'Finds trial sites near you',
    type: 'text',
    placeholder: 'e.g. 10065',
  },
  {
    key: 'diagnosisDate',
    icon: 'calendar-clear-outline',
    emoji: '📅',
    title: 'When were you diagnosed?',
    subtitle: 'Anchors your treatment timeline — approximate is fine',
    type: 'text',
    placeholder: 'YYYY-MM-DD',
  },
  {
    key: 'biomarkers',
    icon: 'flask-outline',
    emoji: '🧬',
    title: 'Biomarkers (if known)',
    subtitle: 'Breast: HER2, ER, PR · Lung: EGFR, ALK, PD-L1 · Colorectal: KRAS, MSI',
    type: 'text',
    placeholder: 'e.g. HER2+, ER+, PR-',
  },
  {
    key: 'ecogStatus',
    icon: 'walk-outline',
    emoji: '🏃',
    title: 'Performance status (ECOG)',
    subtitle: 'Many trials require ≤2',
    type: 'chips',
    options: [
      '0 — Fully active',
      '1 — Restricted strenuous activity',
      '2 — Ambulatory, up >50% of day',
      '3 — Limited self-care, up <50%',
      '4 — Confined to bed',
    ],
  },
  {
    key: 'priorTreatments',
    icon: 'time-outline',
    emoji: '📋',
    title: 'Prior treatments',
    subtitle: 'List previous chemo / radiation / surgery (free-form)',
    type: 'text',
    placeholder: 'e.g. Lumpectomy 2024, Tamoxifen 6 months',
  },
  {
    key: 'medications',
    icon: 'medical-outline',
    emoji: '💉',
    title: 'Any current medications?',
    subtitle: 'We\'ll track doses and remind you',
    type: 'text',
    placeholder: 'e.g. Methotrexate 15mg',
  },
]

// Maps step.key → backend snake_case key for PATCH /api/records/profile.
const PROFILE_PATCH_KEYS: Record<string, string> = {
  cancerType: 'cancer_type',
  cancerStage: 'cancer_stage',
  treatmentPhase: 'treatment_phase',
  dateOfBirth: 'date_of_birth',
  sexAtBirth: 'sex_at_birth',
  zipCode: 'zip_code',
  diagnosisDate: 'diagnosis_date',
  biomarkers: 'biomarkers',
  ecogStatus: 'ecog_status',
  priorTreatments: 'prior_treatments',
}

// Maps step.key → care_profile column name (camelCase) so we can detect
// already-filled fields and skip those steps.
const PROFILE_COLUMN_KEYS: Record<string, string> = {
  cancerType: 'cancerType',
  cancerStage: 'cancerStage',
  treatmentPhase: 'treatmentPhase',
  dateOfBirth: 'dateOfBirth',
  sexAtBirth: 'sexAtBirth',
  zipCode: 'zipCode',
  diagnosisDate: 'diagnosisDate',
  biomarkers: 'biomarkers',
  ecogStatus: 'ecogStatus',
  priorTreatments: 'priorTreatments',
}

// ISO date YYYY-MM-DD validator.
function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

// Convert step value → API payload value. Handles ECOG → integer, sex chip → enum,
// biomarkers free-text → { raw } JSONB.
function valueForApi(stepKey: string, raw: string): unknown {
  if (stepKey === 'ecogStatus') {
    const m = raw.match(/^(\d)/)
    return m ? Number(m[1]) : null
  }
  if (stepKey === 'sexAtBirth') {
    const lower = raw.toLowerCase()
    if (lower.startsWith('fem')) return 'female'
    if (lower.startsWith('male')) return 'male'
    if (lower.startsWith('inter')) return 'intersex'
    return 'prefer_not'
  }
  if (stepKey === 'biomarkers') {
    return { raw }
  }
  return raw
}

function CgChip({
  icon,
  label,
  color,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
  label: string
  color: string
}) {
  return (
    <View style={[styles.cgChip, { borderColor: color + '55', backgroundColor: color + '14' }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.cgChipText, { color }]}>{label}</Text>
    </View>
  )
}

function CgOptionPressable({
  accent,
  icon,
  title,
  sub,
  onPress,
}: {
  accent: string
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap
  title: string
  sub: string
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 220 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }) }}
        onPress={onPress}
        style={[styles.cgOptionCard, { borderColor: accent + '66' }]}
      >
        <LinearGradient
          colors={[accent + '1A', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.cgOptionIcon, { backgroundColor: accent + '22', borderWidth: 1, borderColor: accent + '88' }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cgOptionTitle}>{title}</Text>
          <Text style={styles.cgOptionSub}>{sub}</Text>
        </View>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={14} color={accent} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function SetupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, apiClient, csrfToken, refetch } = useProfile()
  const [setupPhase, setSetupPhase] = useState<'care-group' | 'wizard'>('care-group')
  const [cgStep, setCgStep] = useState<'pick' | 'create' | 'join'>('pick')
  const [cgName, setCgName] = useState('')
  const [cgPassword, setCgPassword] = useState('')
  const [cgLoading, setCgLoading] = useState(false)
  const [cgError, setCgError] = useState('')
  const [mode, setMode] = useState<'healthkit' | 'manual'>('healthkit')
  const [manualStep, setManualStep] = useState(0)
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [textValue, setTextValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showWebNudge, setShowWebNudge] = useState(false)
  const progressWidth = useSharedValue(0)

  // Filter manual steps to skip any field the profile already has a value for.
  // Computed from the initial profile snapshot so the list is stable mid-flow.
  const [initialProfile] = useState(() => profile as unknown as Record<string, unknown> | null)
  const filteredManualSteps = React.useMemo(() => {
    return MANUAL_STEPS.filter((s) => {
      const col = PROFILE_COLUMN_KEYS[s.key]
      if (!col) return true // not a profile field (e.g. 'medications') — always show
      const existing = initialProfile?.[col]
      if (existing === null || existing === undefined || existing === '') return true
      return false
    })
  }, [initialProfile])

  const isHealthKitStep = mode === 'healthkit'
  const STEPS = isHealthKitStep ? [HEALTHKIT_STEP] : filteredManualSteps
  const currentStep = isHealthKitStep ? 0 : manualStep
  const step = STEPS[currentStep] ?? filteredManualSteps[0] ?? HEALTHKIT_STEP
  const totalSteps = isHealthKitStep ? 1 : Math.max(1, filteredManualSteps.length)
  const isLastStep = isHealthKitStep || manualStep >= filteredManualSteps.length - 1

  useEffect(() => {
    progressWidth.value = withTiming(((currentStep + 1) / totalSteps) * 100, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    })
  }, [currentStep, totalSteps, progressWidth])

  // Best-effort HealthKit auto-fill on first entry to the wizard. Pulls DOB +
  // sex at birth from HKCharacteristicType (no clinical-records entitlement
  // needed), patches the profile, and refetches so those steps drop out of
  // filteredManualSteps. Silent: failures just leave the user to type manually.
  const [baselineTried, setBaselineTried] = useState(false)
  useEffect(() => {
    if (baselineTried) return
    if (!csrfToken || !profile) return
    setBaselineTried(true)
    let cancelled = false
    ;(async () => {
      try {
        const baseline = await fetchHealthKitBaseline()
        if (cancelled) return
        const patch: Record<string, unknown> = {}
        const existing = profile as unknown as Record<string, unknown>
        if (baseline.dateOfBirth && !existing.dateOfBirth) {
          patch.date_of_birth = baseline.dateOfBirth
        }
        if (baseline.sexAtBirth && !existing.sexAtBirth) {
          patch.sex_at_birth = baseline.sexAtBirth
        }
        if (Object.keys(patch).length === 0) return
        await apiClient.careProfile.update(patch, csrfToken)
        await refetch()
      } catch {
        // Silent — user falls back to manual entry.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baselineTried, csrfToken, profile, apiClient, refetch])

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }))

  const currentValue = step.type === 'chips'
    ? (selectedChip === 'Other' ? textValue || null : selectedChip)
    : textValue

  async function handleNext() {
    const val = currentValue?.trim()

    // HealthKit step
    if (step.key === 'healthkit') {
      if (val === 'Connect Now') {
        router.push('/health-consent' as any)
        return
      }
      // "Enter Manually" — switch to manual mode
      setMode('manual')
      setSelectedChip(null)
      setTextValue('')
      return
    }

    if (val) {
      // Validate dates inline before saving.
      if ((step.key === 'dateOfBirth' || step.key === 'diagnosisDate') && !isValidISODate(val)) {
        Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 1985-03-12).')
        return
      }
      setSaving(true)
      try {
        if (step.key === 'medications' && profile?.careProfileId) {
          await apiClient.medications.create(
            { name: val, care_profile_id: profile.careProfileId } as any,
            csrfToken || '',
          )
        } else if (PROFILE_PATCH_KEYS[step.key]) {
          // Generic care-profile PATCH for any field listed in PROFILE_PATCH_KEYS.
          await apiClient.careProfile.update(
            { [PROFILE_PATCH_KEYS[step.key]!]: valueForApi(step.key, val) },
            csrfToken || '',
          )
        }
        await refetch()
      } catch (e) {
        console.error('[Setup] Error:', e)
      } finally {
        setSaving(false)
      }
    }

    if (isLastStep) {
      if (profile?.careProfileId) {
        try {
          const token = await SecureStore.getItemAsync('cc-session-token')
          const isSecure = API_BASE.startsWith('https://')
          const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
          await fetch(`${API_BASE}/api/onboarding/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `${cookieName}=${token}`,
              'x-csrf-token': csrfToken || '',
            },
            body: JSON.stringify({ careProfileId: profile.careProfileId }),
          })
          await refetch()
        } catch (e) {
          console.error('[Setup] onboarding/complete failed:', e)
        }
      }
      // One-time web-app nudge after onboarding completion.
      const nudgeShown = await AsyncStorage.getItem('cc-web-nudge-shown')
      if (nudgeShown) {
        router.back()
      } else {
        setShowWebNudge(true)
      }
    } else {
      setManualStep(prev => prev + 1)
      setSelectedChip(null)
      setTextValue('')
    }
  }

  if (showWebNudge) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowOrb1} />
        <View style={styles.glowOrb2} />
        <View style={{ flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.emojiWrap}>
            <Text style={styles.emoji}>✨</Text>
          </Animated.View>
          <Animated.View entering={FadeIn.duration(400).delay(200)}>
            <Text style={styles.title}>You&apos;re all set</Text>
            <Text style={styles.subtitle}>
              Your data is also available at carecompanionai.org — log in from any browser to access your full care dashboard.
            </Text>
          </Animated.View>
        </View>
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={async () => {
              try { await AsyncStorage.setItem('cc-web-nudge-shown', '1') } catch { /* storage unavailable */ }
              router.replace('/(tabs)' as any)
            }}
            style={({ pressed }) => [styles.nextButton, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient
              colors={['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              <Text style={styles.nextText}>Got it</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    )
  }

  if (setupPhase === 'care-group') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowOrb1} />
        <View style={styles.glowOrb2} />

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={async () => { await AsyncStorage.setItem('cc-setup-skipped', '1').catch(() => {}); router.replace('/(tabs)' as any) }} hitSlop={16} style={styles.closeButton}>
            <BlurView intensity={20} tint="dark" style={styles.closeBlur}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </BlurView>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerStep}>Set Up</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.content, { paddingTop: 40 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.cgHeroWrap}>
              <View style={styles.cgAvatarA}>
                <Ionicons name="person" size={22} color="#A78BFA" />
              </View>
              <View style={styles.cgAvatarB}>
                <Ionicons name="person" size={22} color="#67E8F9" />
              </View>
              <View style={styles.cgConnector} />
            </Animated.View>

            <Animated.View entering={FadeIn.duration(400).delay(200)}>
              <Text style={styles.title}>
                {cgStep === 'pick' ? 'Your Care Group' : cgStep === 'create' ? 'Create a Group' : 'Join a Group'}
              </Text>
              <Text style={styles.subtitle}>
                {cgStep === 'pick'
                  ? 'Share health updates and coordinate care with family and caregivers.'
                  : cgStep === 'create'
                  ? 'Choose a name and password to share with your group.'
                  : 'Enter the name and password your group admin shared with you.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(400).delay(300)} style={styles.inputArea}>
              {cgStep === 'pick' ? (
                <View style={{ gap: 12 }}>
                  <CgOptionPressable
                    accent="#A78BFA"
                    icon="add-circle-outline"
                    title="Create a new group"
                    sub="Pick a name and password to share"
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setCgStep('create') }}
                  />
                  <CgOptionPressable
                    accent="#67E8F9"
                    icon="link-outline"
                    title="Join an existing group"
                    sub="Enter the name and password you were given"
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setCgStep('join') }}
                  />

                  {/* What you'll share */}
                  <Animated.View entering={FadeIn.duration(500).delay(500)} style={styles.cgShareBlock}>
                    <Text style={styles.cgShareLabel}>WHAT YOU'LL SHARE</Text>
                    <View style={styles.cgChipsRow}>
                      <CgChip icon="medical-outline" label="Medications" color="#A78BFA" />
                      <CgChip icon="calendar-outline" label="Appointments" color="#67E8F9" />
                      <CgChip icon="pulse-outline" label="Lab results" color="#FCA5A5" />
                      <CgChip icon="chatbubbles-outline" label="Updates" color="#6EE7B7" />
                    </View>
                    <Text style={styles.cgPrivacyNote}>
                      <Ionicons name="lock-closed" size={11} color="rgba(167,139,250,0.7)" />  Encrypted end-to-end. Only members you invite can see your data.
                    </Text>
                  </Animated.View>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Pressable onPress={() => { setCgStep('pick'); setCgError('') }} style={{ marginBottom: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>← Back</Text>
                  </Pressable>
                  <TextInput
                    value={cgName}
                    onChangeText={setCgName}
                    placeholder={cgStep === 'create' ? 'Group name (e.g. The Smith Family)' : 'Care Group name'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.textInput}
                  />
                  <TextInput
                    value={cgPassword}
                    onChangeText={setCgPassword}
                    placeholder="Group password"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry
                    style={styles.textInput}
                  />
                  {!!cgError && (
                    <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{cgError}</Text>
                  )}
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* Bottom actions */}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
            {cgStep === 'pick' ? (
              <Pressable onPress={() => setSetupPhase('wizard')} style={styles.skipLink}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={async () => {
                  if (!cgName.trim() || !cgPassword) { setCgError('Enter a name and password'); return }
                  setCgLoading(true)
                  setCgError('')
                  try {
                    const token = await SecureStore.getItemAsync('cc-session-token')
                    const endpoint = cgStep === 'create' ? '/api/care-group' : '/api/care-group/join'
                    const res = await fetch(`${API_BASE}${endpoint}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ name: cgName.trim(), password: cgPassword }),
                    })
                    const data = await res.json() as { error?: string }
                    if (!res.ok) { setCgError(data.error ?? 'Something went wrong'); return }
                    setSetupPhase('wizard')
                  } catch {
                    setCgError('Could not connect. Check your internet.')
                  } finally {
                    setCgLoading(false)
                  }
                }}
                disabled={cgLoading}
                style={({ pressed }) => [styles.nextButton, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <LinearGradient
                  colors={['#6366F1', '#818CF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.nextGradient, { opacity: cgLoading ? 0.5 : 1 }]}
                >
                  <Text style={styles.nextText}>
                    {cgLoading ? 'Loading...' : cgStep === 'create' ? 'Create Group' : 'Join Group'}
                  </Text>
                  {!cgLoading && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Background */}
      <LinearGradient
        colors={['#05060F', '#0C0E1A', '#12143A', '#0C0E1A']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.closeButton}>
          <BlurView intensity={20} tint="dark" style={styles.closeBlur}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </BlurView>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerStep}>{isHealthKitStep ? 'Get Started' : `Step ${manualStep + 1} of ${MANUAL_STEPS.length}`}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]}>
          <LinearGradient
            colors={['#6366F1', '#A78BFA', '#C4B5FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Large emoji */}
          <Animated.View
            entering={FadeIn.duration(400).delay(100)}
            key={`emoji-${currentStep}`}
            style={styles.emojiWrap}
          >
            <Text style={styles.emoji}>{step.emoji}</Text>
          </Animated.View>

          {/* Title + subtitle */}
          <Animated.View
            entering={FadeIn.duration(400).delay(200)}
            key={`title-${currentStep}`}
          >
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.subtitle}</Text>
          </Animated.View>

          {/* Input area */}
          <Animated.View
            entering={FadeIn.duration(400).delay(300)}
            key={`input-${currentStep}`}
            style={styles.inputArea}
          >
            {step.type === 'chips' ? (
              <View>
                <View style={styles.chipGrid}>
                  {step.options?.map((option) => {
                    const selected = selectedChip === option
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          if (option === 'Other') {
                            setSelectedChip(selected ? null : option)
                          } else {
                            setSelectedChip(selected ? null : option)
                            setTextValue('')
                          }
                        }}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                        ]}
                      >
                        <Text style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}>
                          {option}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                {selectedChip === 'Other' && (
                  <TextInput
                    style={[styles.textInput, { marginTop: 16 }]}
                    placeholder="Type your answer..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={textValue}
                    onChangeText={setTextValue}
                    autoFocus={false}
                    returnKeyType="done"
                  />
                )}
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder={step.placeholder}
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={textValue}
                onChangeText={setTextValue}
                autoFocus={false}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            )}
          </Animated.View>
        </ScrollView>

        {/* Bottom */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleNext}
            disabled={saving}
            style={({ pressed }) => [
              styles.nextButton,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={currentValue ? ['#6366F1', '#818CF8'] : ['rgba(99,102,241,0.3)', 'rgba(129,140,248,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              <Text style={[styles.nextText, !currentValue && { opacity: 0.5 }]}>
                {saving ? 'Saving...' : currentValue ? (isLastStep ? 'Finish' : 'Continue') : 'Skip'}
              </Text>
              {!saving && (
                <Ionicons
                  name={isLastStep ? 'checkmark' : 'arrow-forward'}
                  size={18}
                  color={currentValue ? '#fff' : 'rgba(255,255,255,0.5)'}
                />
              )}
            </LinearGradient>
          </Pressable>

          {currentValue ? (
            <Pressable onPress={() => { setSelectedChip(null); setTextValue('') }} style={styles.skipLink}>
              <Text style={styles.skipText}>Clear selection</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0E1A' },
  glowOrb1: {
    position: 'absolute',
    top: '20%',
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  glowOrb2: {
    position: 'absolute',
    bottom: '30%',
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: { width: 36, height: 36 },
  closeBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { alignItems: 'center' },
  headerStep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  emojiWrap: {
    marginBottom: 24,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 16,
  },
  inputArea: {
    width: '100%',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipSelected: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderColor: '#6366F1',
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#C4B5FD',
    fontWeight: '600',
  },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: '#fff',
    fontSize: 17,
    textAlign: 'center',
  },
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  nextText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  cgOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  cgHeroWrap: {
    alignSelf: 'center',
    width: 110,
    height: 72,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cgAvatarA: {
    position: 'absolute',
    left: 8,
    top: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  cgAvatarB: {
    position: 'absolute',
    right: 8,
    top: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(103,232,249,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#67E8F9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  cgConnector: {
    position: 'absolute',
    top: 35,
    left: 50,
    width: 10,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
  },
  cgShareBlock: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  cgShareLabel: {
    color: 'rgba(167,139,250,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginLeft: 2,
  },
  cgChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  cgChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cgPrivacyNote: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  cgOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cgOptionTitle: {
    color: '#EDE9FE',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  cgOptionSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 16,
  },
})
