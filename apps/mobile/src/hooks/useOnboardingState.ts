import { useState, useEffect, useCallback } from 'react'
import { useProfile } from '../context/ProfileContext'

interface OnboardingStep {
  key: string
  title: string
  description: string
  icon: string // Ionicons name
  done: boolean
  route: string // Tab or screen to navigate to
}

interface OnboardingState {
  steps: OnboardingStep[]
  completedCount: number
  totalCount: number
  nextStep: OnboardingStep | null
  isComplete: boolean
  loading: boolean
}

/**
 * Computes onboarding progress from existing data.
 * No new tables needed — each step checks for the presence
 * of data the user would have entered during normal usage.
 */
export function useOnboardingState(): OnboardingState {
  const { profile, apiClient, loading: profileLoading } = useProfile()
  const [extraData, setExtraData] = useState<{
    hasMedications: boolean
    hasInsuranceDoc: boolean
    hasCareTeamMember: boolean
    hasMessages: boolean
    hasHealthSummary: boolean
  }>({
    hasMedications: false,
    hasInsuranceDoc: false,
    hasCareTeamMember: false,
    hasMessages: false,
    hasHealthSummary: false,
  })
  const [extraLoading, setExtraLoading] = useState(true)

  const fetchExtraData = useCallback(async () => {
    if (!profile?.careProfileId) {
      setExtraLoading(false)
      return
    }
    try {
      // Fetch data to determine step completion
      const [medsResult] = await Promise.all([
        apiClient.medications.list(profile.careProfileId).catch(() => []),
      ])

      const medsArray = Array.isArray(medsResult) ? medsResult : []

      setExtraData({
        hasMedications: medsArray.length > 0,
        // These are optimistic checks — if we can't verify, assume not done
        hasInsuranceDoc: false,
        hasCareTeamMember: false,
        hasMessages: false,
        hasHealthSummary: false,
      })
    } catch {
      // Fail gracefully — all steps will show as incomplete
    } finally {
      setExtraLoading(false)
    }
  }, [profile?.careProfileId, apiClient])

  useEffect(() => {
    fetchExtraData()
  }, [fetchExtraData])

  const steps: OnboardingStep[] = [
    {
      key: 'medications',
      title: 'Add your first medication',
      description: 'Track your medications and get reminders so you never miss a dose.',
      icon: 'medical-outline',
      done: extraData.hasMedications,
      route: '/(tabs)/care',
    },
    {
      key: 'insurance',
      title: 'Scan your insurance card',
      description: 'Keep your insurance info handy for appointments and claims.',
      icon: 'card-outline',
      done: extraData.hasInsuranceDoc,
      route: '/(tabs)/scan',
    },
    {
      key: 'careteam',
      title: 'Add a care team member',
      description: 'Invite a caregiver, family member, or friend to your care team.',
      icon: 'people-outline',
      done: extraData.hasCareTeamMember,
      route: '/(tabs)/care',
    },
    {
      key: 'cancertype',
      title: 'Set your cancer type',
      description: 'Help your AI companion give more relevant and personalized advice.',
      icon: 'ribbon-outline',
      done: !!profile?.cancerType,
      route: '/(tabs)/settings',
    },
    {
      key: 'treatmentphase',
      title: 'Set your treatment phase',
      description: 'Let us know where you are in your treatment journey.',
      icon: 'pulse-outline',
      done: !!profile?.treatmentPhase,
      route: '/(tabs)/settings',
    },
    {
      key: 'firstchat',
      title: 'Have your first AI conversation',
      description: 'Ask anything about your treatment, side effects, or next steps.',
      icon: 'chatbubble-outline',
      done: extraData.hasMessages,
      route: '/(tabs)/chat',
    },
    {
      key: 'healthsummary',
      title: 'Generate your health summary',
      description: 'Get an AI-powered overview you can share with your care team.',
      icon: 'document-text-outline',
      done: extraData.hasHealthSummary,
      route: '/(tabs)/care',
    },
  ]

  // If the profile is marked onboardingCompleted, treat everything as done
  const forceComplete = profile?.onboardingCompleted === true

  const completedCount = forceComplete ? steps.length : steps.filter((s) => s.done).length
  const totalCount = steps.length
  const nextStep = forceComplete ? null : (steps.find((s) => !s.done) || null)
  const isComplete = forceComplete || completedCount === totalCount

  return {
    steps: forceComplete ? steps.map(s => ({ ...s, done: true })) : steps,
    completedCount,
    totalCount,
    nextStep,
    isComplete,
    loading: profileLoading || extraLoading,
  }
}
