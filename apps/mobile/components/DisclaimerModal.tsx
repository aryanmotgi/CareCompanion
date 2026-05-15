import React, { useEffect, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DISCLAIMER_SEEN_KEY = 'cc-disclaimer-seen'

export function DisclaimerModal() {
  const [state, setState] = useState<'loading' | 'visible' | 'dismissed'>(
    Platform.OS === 'web' ? 'dismissed' : 'loading',
  )

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    AsyncStorage.getItem(DISCLAIMER_SEEN_KEY)
      .then((v) => {
        if (cancelled) return
        setState(v === '1' ? 'dismissed' : 'visible')
      })
      .catch(() => {
        if (!cancelled) setState('visible')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onAccept() {
    setState('dismissed')
    try {
      await AsyncStorage.setItem(DISCLAIMER_SEEN_KEY, '1')
    } catch {
      // Persistence failure — modal will re-appear on next launch. Fail open.
    }
  }

  if (state !== 'visible') return null

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        // Hardware back on Android is intentionally a no-op until acknowledged.
      }}
    >
      <View style={styles.backdrop}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.title}>Before you continue</Text>
            <Text style={styles.body}>
              CareCompanion helps you organize cancer care information from
              your providers and Apple Health. It is{' '}
              <Text style={styles.bodyEmphasis}>
                not a medical device, diagnostic tool, or substitute for
                professional medical advice
              </Text>
              .
            </Text>
            <Text style={styles.body}>
              Always discuss medications, symptoms, lab results, and treatment
              decisions with your oncology care team. In an emergency, call
              911 or go to the nearest emergency room.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="I understand"
              onPress={onAccept}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>I understand</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,10,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,22,38,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
  },
  cardInner: {
    padding: 24,
    gap: 16,
  },
  title: {
    color: '#F5F5F7',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    color: 'rgba(229,229,235,0.85)',
    fontSize: 15,
    lineHeight: 22,
  },
  bodyEmphasis: {
    color: '#F5F5F7',
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#A78BFA',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#0C0E1A',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
