import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../src/theme'
import { useProfile } from '../../src/context/ProfileContext'
import { apiClient } from '../../src/services/api'
import { AuroraBackground } from '../../src/components/auth/AuthAtoms'
import { scanDocument, extractMedicationName, isSupported as scannerSupported } from '../../src/services/scanner'

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'As needed',
  'Weekly',
]

export default function NewMedicationScreen() {
  const theme = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, csrfToken, refetch } = useProfile()

  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('')
  const [prescribingDoctor, setPrescribingDoctor] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  async function handleScan() {
    if (scanning) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setScanning(true)
    try {
      const result = await scanDocument()
      if (!result) {
        Alert.alert(
          'Scanner unavailable',
          'The document scanner needs a native rebuild. Run `npx expo install react-native-document-scanner-plugin expo-image-picker`, then rebuild the app.',
        )
        return
      }
      const parsed = extractMedicationName(result.extractedText)
      if (parsed) {
        setName(parsed.name)
        if (parsed.dose) setDose(parsed.dose)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      } else {
        Alert.alert(
          'Scan captured',
          "Couldn't auto-detect the medication name. Enter it manually below.",
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setScanning(false)
    }
  }

  const canSubmit = name.trim().length > 0 && !submitting

  async function handleSubmit() {
    if (!canSubmit || !csrfToken) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.medications.create(
        {
          name: name.trim(),
          dose: dose.trim() || undefined,
          frequency: frequency.trim() || undefined,
          prescribingDoctor: prescribingDoctor.trim() || undefined,
          notes: notes.trim() || undefined,
          careProfileId: profile?.careProfileId ?? undefined,
        } as any,
        csrfToken,
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      await refetch().catch(() => {})
      router.back()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    } finally {
      setSubmitting(false)
    }
  }

  function confirmCancel() {
    if (!name && !dose && !frequency && !prescribingDoctor && !notes) {
      router.back()
      return
    }
    Alert.alert('Discard medication?', 'You haven\'t saved this yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={confirmCancel} hitSlop={16} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>New medication</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Scan-prescription CTA — uses VisionKit on iOS for multi-page scan
              with auto-edge-detection, then OCRs the first page to pre-fill
              name + dose. */}
          {scannerSupported() ? (
            <Pressable
              onPress={handleScan}
              disabled={scanning}
              style={({ pressed }) => [styles.scanBtn, { opacity: pressed || scanning ? 0.6 : 1 }]}
            >
              {scanning ? (
                <ActivityIndicator color="#A78BFA" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={18} color="#A78BFA" />
                  <Text style={styles.scanBtnText}>Scan prescription label</Text>
                </>
              )}
            </Pressable>
          ) : null}

          <Field label="Medication name" required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Tamoxifen"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="Dose">
            <TextInput
              value={dose}
              onChangeText={setDose}
              placeholder="e.g. 20mg"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              returnKeyType="next"
            />
          </Field>

          <Field label="Frequency">
            <TextInput
              value={frequency}
              onChangeText={setFrequency}
              placeholder="e.g. Once daily, with food"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              returnKeyType="next"
            />
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setFrequency(opt) }}
                  style={[
                    styles.chip,
                    {
                      borderColor: frequency === opt ? theme.accent : theme.border,
                      backgroundColor: frequency === opt ? theme.accent + '22' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: frequency === opt ? theme.accent : theme.textMuted }]}>
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Prescribing doctor">
            <TextInput
              value={prescribingDoctor}
              onChangeText={setPrescribingDoctor}
              placeholder="e.g. Dr. Patel"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else to remember"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, minHeight: 90, textAlignVertical: 'top' },
              ]}
              multiline
            />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              { opacity: pressed || !canSubmit ? 0.6 : 1 },
            ]}
          >
            <LinearGradient
              colors={['#A78BFA', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.ctaText}>Save medication</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.fieldLabel}>
        {label.toUpperCase()}
        {required ? <Text style={{ color: '#F87171' }}> *</Text> : null}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  fieldLabel: {
    color: '#FFFFFF80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  error: { color: '#F87171', fontSize: 13, marginTop: 8, textAlign: 'center' },
  ctaBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'rgba(5,6,15,0.85)',
  },
  cta: {
    overflow: 'hidden',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  scanBtnText: { color: '#A78BFA', fontSize: 14, fontWeight: '700' },
})
