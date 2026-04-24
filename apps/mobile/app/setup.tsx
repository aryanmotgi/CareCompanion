import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
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

const STEPS: StepConfig[] = [
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
    key: 'medications',
    icon: 'medical-outline',
    emoji: '💉',
    title: 'Any current medications?',
    subtitle: 'We\'ll track doses and remind you',
    type: 'text',
    placeholder: 'e.g. Methotrexate 15mg',
  },
]

export default function SetupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, apiClient, csrfToken, refetch } = useProfile()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [textValue, setTextValue] = useState('')
  const [saving, setSaving] = useState(false)
  const progressWidth = useSharedValue(0)

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1

  useEffect(() => {
    progressWidth.value = withTiming(((currentStep + 1) / STEPS.length) * 100, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    })
  }, [currentStep, progressWidth])

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }))

  const currentValue = step.type === 'chips' ? selectedChip : textValue

  async function handleNext() {
    const val = currentValue?.trim()

    if (val) {
      setSaving(true)
      try {
        if (step.key === 'medications' && profile?.careProfileId) {
          await apiClient.medications.create({
            name: val,
            careProfileId: profile.careProfileId,
          } as any)
        } else if (step.key === 'cancerType' || step.key === 'treatmentPhase') {
          const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
          const token = await require('expo-secure-store').getItemAsync('cc-session-token')
          const isSecure = baseUrl.startsWith('https://')
          const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

          await fetch(`${baseUrl}/api/records/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `${cookieName}=${token}`,
              'x-csrf-token': csrfToken || '',
            },
            body: JSON.stringify({
              [step.key === 'cancerType' ? 'cancer_type' : 'treatment_phase']: val,
            }),
          })
        }
        await refetch()
      } catch (e) {
        console.error('[Setup] Error:', e)
      } finally {
        setSaving(false)
      }
    }

    if (isLastStep) {
      router.back()
    } else {
      setCurrentStep(prev => prev + 1)
      setSelectedChip(null)
      setTextValue('')
    }
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
          <Text style={styles.headerStep}>Step {currentStep + 1} of {STEPS.length}</Text>
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
              <View style={styles.chipGrid}>
                {step.options?.map((option) => {
                  const selected = selectedChip === option
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setSelectedChip(selected ? null : option)}
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
})
