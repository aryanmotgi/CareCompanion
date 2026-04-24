import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProfile } from '../src/context/ProfileContext'
import { useOnboardingState } from '../src/hooks/useOnboardingState'

const STEPS = [
  {
    key: 'medications',
    icon: 'medical-outline' as const,
    title: 'Add a medication',
    description: 'What medications are you currently taking?',
    placeholder: 'e.g. Methotrexate 15mg, daily',
    field: 'medication',
  },
  {
    key: 'cancerType',
    icon: 'body-outline' as const,
    title: 'Set your cancer type',
    description: 'This helps your AI companion give more relevant advice.',
    placeholder: 'e.g. Breast cancer, Lung cancer, Lymphoma',
    field: 'cancerType',
  },
  {
    key: 'treatmentPhase',
    icon: 'pulse-outline' as const,
    title: 'Set your treatment phase',
    description: 'Where are you in your treatment journey?',
    placeholder: 'e.g. Active chemo, Post-surgery, Remission',
    field: 'treatmentPhase',
  },
]

export default function SetupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, apiClient, csrfToken, refetch } = useProfile()
  const onboarding = useOnboardingState()
  const [currentStep, setCurrentStep] = useState(0)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const progress = (currentStep + 1) / STEPS.length

  async function handleNext() {
    if (!value.trim()) {
      // Skip this step
      if (isLastStep) {
        router.back()
      } else {
        setCurrentStep(prev => prev + 1)
        setValue('')
      }
      return
    }

    setSaving(true)
    try {
      if (step.key === 'medications' && profile?.careProfileId) {
        // Add medication via API
        await apiClient.medications.create({
          name: value.trim(),
          careProfileId: profile.careProfileId,
        } as any)
      } else if (step.key === 'cancerType' || step.key === 'treatmentPhase') {
        // Update profile
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
            [step.key === 'cancerType' ? 'cancer_type' : 'treatment_phase']: value.trim(),
          }),
        })
      }

      await refetch()
    } catch (e) {
      console.error('[Setup] Error saving:', e)
    } finally {
      setSaving(false)
    }

    if (isLastStep) {
      router.back()
    } else {
      setCurrentStep(prev => prev + 1)
      setValue('')
    }
  }

  function handleSkip() {
    if (isLastStep) {
      router.back()
    } else {
      setCurrentStep(prev => prev + 1)
      setValue('')
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0C0E1A', '#10122B', '#0C0E1A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.headerTitle}>Setup</Text>
        <Text style={styles.headerStep}>{currentStep + 1}/{STEPS.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step icon */}
          <View style={styles.iconCircle}>
            <Ionicons name={step.icon} size={32} color="#6366F1" />
          </View>

          {/* Step content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Input */}
          <TextInput
            style={styles.input}
            placeholder={step.placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={value}
            onChangeText={setValue}
            autoFocus
            returnKeyType={isLastStep ? 'done' : 'next'}
            onSubmitEditing={handleNext}
          />
        </ScrollView>

        {/* Bottom actions */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={styles.nextButton}
            onPress={handleNext}
            disabled={saving}
          >
            <LinearGradient
              colors={['#6366F1', '#A78BFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              <Text style={styles.nextText}>
                {saving ? 'Saving...' : isLastStep ? 'Done' : 'Next'}
              </Text>
              {!saving && (
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0E1A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerStep: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  nextButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
})
