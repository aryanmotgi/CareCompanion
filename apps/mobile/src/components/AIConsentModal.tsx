import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'

const CONSENT_KEY = 'cc-ai-consent-accepted'

export async function hasAcceptedAIConsent(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(CONSENT_KEY)
    return v === '1'
  } catch {
    return false
  }
}

interface Props {
  visible: boolean
  onAccept: () => void
  onDecline: () => void
}

export function AIConsentModal({ visible, onAccept, onDecline }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDecline}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.emoji}>🤖</Text>
          <Text style={styles.title}>Before you chat with our AI</Text>

          <View style={styles.section}>
            <Text style={styles.heading}>What this is</Text>
            <Text style={styles.body}>
              CareCompanion's chat is powered by <Text style={styles.bold}>Anthropic's Claude</Text>,
              a large language model. Anthropic processes your messages to generate responses.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>What this is not</Text>
            <Text style={styles.body}>
              The AI is <Text style={styles.bold}>not a doctor, nurse, or licensed medical
              professional</Text>. It cannot diagnose conditions, prescribe medication, or replace
              advice from your care team.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>In an emergency</Text>
            <Text style={styles.body}>
              If you are experiencing a medical emergency, call <Text style={styles.bold}>911</Text>{' '}
              or go to your nearest emergency room. Do not rely on the AI for urgent symptoms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>How we protect you</Text>
            <Text style={styles.body}>
              Conversations are encrypted in transit and stored under our HIPAA-aligned controls.
              We never sell your data. You can delete any conversation from the chat history at
              any time.
            </Text>
          </View>

          <Text style={styles.fineprint}>
            By tapping "I understand and agree," you confirm you have read the above and consent
            to AI-assisted chat powered by Anthropic.
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onDecline}
            style={styles.declineBtn}
            accessibilityRole="button"
            accessibilityLabel="Decline AI chat"
          >
            <Text style={styles.declineText}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            style={styles.acceptBtn}
            accessibilityRole="button"
            accessibilityLabel="Accept AI chat consent and continue"
          >
            <Text style={styles.acceptText}>I understand and agree</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

export async function markAIConsentAccepted(): Promise<void> {
  await SecureStore.setItemAsync(CONSENT_KEY, '1', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => {})
}

/**
 * Hook that wires the consent modal into a screen. Returns:
 *   - shouldGate: while we're still checking SecureStore, render nothing.
 *   - modal: the JSX to mount.
 *   - accepted: true once the user has tapped accept (current or prior session).
 */
export function useAIConsentGate(onAccepted?: () => void) {
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    hasAcceptedAIConsent().then((ok) => {
      if (cancelled) return
      setAccepted(ok)
      if (!ok) setVisible(true)
    })
    return () => { cancelled = true }
  }, [])

  const accept = async () => {
    await markAIConsentAccepted()
    setAccepted(true)
    setVisible(false)
    onAccepted?.()
  }

  return { accepted, visible, accept, setVisible }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
  heading: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  body: { fontSize: 15, color: '#374151', lineHeight: 22 },
  bold: { fontWeight: '700', color: '#111827' },
  fineprint: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  declineText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  acceptBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  acceptText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
})
