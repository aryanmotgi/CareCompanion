import React, { useState, useRef, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../theme'

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ?? 'https://carecompanionai.org'

interface BugReportSheetProps {
  visible: boolean
  currentScreen?: string
  onClose: () => void
}

export function BugReportSheet({ visible, currentScreen, onClose }: BugReportSheetProps) {
  const theme = useTheme()
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      setDescription('')
      setSubmitted(false)
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, slideAnim])

  function handleClose() {
    setDescription('')
    setSubmitted(false)
    onClose()
  }

  async function handleSubmit() {
    if (!description.trim() || submitting) return
    setSubmitting(true)

    try {
      const token = await SecureStore.getItemAsync('cc-session-token')
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          description,
          pageUrl: `mobile://${currentScreen ?? 'unknown'}`,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
          userAgent: `CareCompanion-Mobile/${Platform.OS}`,
        }),
      })
      setSubmitted(true)
      setTimeout(() => handleClose(), 2000)
    } catch {
      // Best-effort — still show success
      setSubmitted(true)
      setTimeout(() => handleClose(), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.card ?? '#fff', transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />

          {submitted ? (
            <View style={styles.successContainer}>
              <Text style={[styles.successText, { color: '#16a34a' }]}>Bug reported! Thanks.</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Report a Bug</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted ?? '#888' }]}>
                Shake the device or tap here to report issues.
              </Text>

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what went wrong…"
                placeholderTextColor={theme.textMuted ?? '#aaa'}
                multiline
                numberOfLines={4}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border ?? '#e2e8f0',
                    backgroundColor: theme.inputBg ?? '#f8fafc',
                  },
                ]}
                textAlignVertical="top"
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={[styles.cancelBtn, { borderColor: theme.border ?? '#e2e8f0' }]}
                >
                  <Text style={[styles.cancelText, { color: theme.textMuted ?? '#555' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting || !description.trim()}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        submitting || !description.trim() ? '#c4b5fd' : '#7c3aed',
                    },
                  ]}
                >
                  <Text style={styles.submitText}>
                    {submitting ? 'Sending…' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
