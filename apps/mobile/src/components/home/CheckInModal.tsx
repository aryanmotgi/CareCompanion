import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme'
import { useProfile } from '../../context/ProfileContext'

interface Props {
  visible: boolean
  onClose: () => void
  onSubmit?: (payload: CheckInPayload) => void
}

export type CheckInPayload = {
  mood: number // 0..4 (0 = worst)
  pain: number // 0..10
  energy: 'low' | 'med' | 'high' | null
  sleep: 'bad' | 'ok' | 'good' | null
  notes: string
}

const MOOD_EMOJI = ['😢', '😐', '🙂', '😊', '😄']
const PAIN_MAX = 10

function parseEnergy(v: string | null | undefined): CheckInPayload['energy'] {
  if (!v) return null
  const s = v.toLowerCase()
  if (s.startsWith('low')) return 'low'
  if (s.startsWith('high')) return 'high'
  if (s.startsWith('med') || s.startsWith('mid')) return 'med'
  return null
}

function parseSleep(v: string | null | undefined): CheckInPayload['sleep'] {
  if (!v) return null
  const s = v.toLowerCase()
  if (s.startsWith('bad') || s.startsWith('poor')) return 'bad'
  if (s.startsWith('good') || s.startsWith('great')) return 'good'
  if (s.startsWith('ok') || s.startsWith('okay') || s.startsWith('fair')) return 'ok'
  return null
}

function parseMood(v: string | null | undefined): number {
  if (!v) return 2
  const n = Number(v)
  if (Number.isFinite(n) && n >= 0 && n <= 4) return Math.round(n)
  const s = v.toLowerCase()
  if (s.includes('great') || s.includes('happy')) return 4
  if (s.includes('good')) return 3
  if (s.includes('ok') || s.includes('fine')) return 2
  if (s.includes('low') || s.includes('down')) return 1
  if (s.includes('bad') || s.includes('sad')) return 0
  return 2
}

export function CheckInModal({ visible, onClose, onSubmit }: Props) {
  const theme = useTheme()
  const { apiClient } = useProfile()
  const [mood, setMood] = useState<number>(2)
  const [pain, setPain] = useState<number>(0)
  const [energy, setEnergy] = useState<CheckInPayload['energy']>(null)
  const [sleep, setSleep] = useState<CheckInPayload['sleep']>(null)
  const [notes, setNotes] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    apiClient.journal
      .list(7)
      .then((res) => {
        if (cancelled) return
        const entries = res?.data?.entries ?? []
        const last = entries[0]
        if (!last) return
        setMood(parseMood(last.mood))
        setPain(typeof last.painLevel === 'number' ? last.painLevel : 0)
        setEnergy(parseEnergy(last.energy))
        setSleep(parseSleep(last.sleepHours))
        setNotes('')
        setPrefilled(true)
      })
      .catch(() => {/* no prior entry — leave defaults */})
    return () => { cancelled = true }
  }, [visible, apiClient])

  function handleSubmit() {
    onSubmit?.({ mood, pain, energy, sleep, notes })
    // Reset to defaults for the next check-in.
    setMood(2)
    setPain(0)
    setEnergy(null)
    setSleep(null)
    setNotes('')
    setPrefilled(false)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ borderRadius: 20, overflow: 'hidden' }}
        >
          <View
            style={{
              backgroundColor: '#0C0E1A',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>
                  How are you feeling?
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
                  {prefilled
                    ? 'Pre-filled from your last check-in · only change what\'s different'
                    : 'Quick daily check-in · under 60 seconds'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 12, gap: 16 }}
            >
              <Section label="MOOD">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {MOOD_EMOJI.map((emo, idx) => {
                    const isActive = mood === idx
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setMood(idx)}
                        hitSlop={6}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                          borderWidth: isActive ? 1 : 0,
                          borderColor: 'rgba(99,102,241,0.5)',
                          transform: [{ scale: isActive ? 1.05 : 1 }],
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>{emo}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </Section>

              <Section label="PAIN LEVEL">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', width: 36 }}>
                    {pain}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <PainBar value={pain} onChange={setPain} />
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginTop: 6,
                      }}
                    >
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>None</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>Severe</Text>
                    </View>
                  </View>
                </View>
              </Section>

              <Section label="ENERGY">
                <SegmentedRow
                  options={[
                    { key: 'low', label: 'Low' },
                    { key: 'med', label: 'Med' },
                    { key: 'high', label: 'High' },
                  ]}
                  selected={energy}
                  onChange={(v) => setEnergy(v as CheckInPayload['energy'])}
                />
              </Section>

              <Section label="SLEEP">
                <SegmentedRow
                  options={[
                    { key: 'bad', label: 'Bad' },
                    { key: 'ok', label: 'OK' },
                    { key: 'good', label: 'Good' },
                  ]}
                  selected={sleep}
                  onChange={(v) => setSleep(v as CheckInPayload['sleep'])}
                />
              </Section>

              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything else? (optional)"
                placeholderTextColor={theme.textMuted}
                multiline
                style={{
                  color: theme.text,
                  fontSize: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  minHeight: 60,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={handleSubmit}
                  style={{
                    flex: 1,
                    backgroundColor: theme.accent,
                    borderRadius: 12,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    /* Voice entry — placeholder; wire to actual recording later. */
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel="Voice input"
                >
                  <Ionicons name="mic-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View>
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontWeight: '600',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

function SegmentedRow<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { key: T; label: string }[]
  selected: T | null
  onChange: (v: T) => void
}) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o) => {
        const isActive = selected === o.key
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
              backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
            }}
          >
            <Text
              style={{
                color: isActive ? '#A78BFA' : theme.text,
                fontSize: 14,
                fontWeight: isActive ? '700' : '500',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function PainBar({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useTheme()
  const [barWidth, setBarWidth] = useState(0)
  const frac = value / PAIN_MAX

  function setFromX(x: number) {
    if (barWidth <= 0) return
    const f = Math.max(0, Math.min(1, x / barWidth))
    onChange(Math.round(f * PAIN_MAX))
  }

  return (
    <Pressable
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      onPressIn={(e) => setFromX(e.nativeEvent.locationX)}
      style={{ height: 28, justifyContent: 'center' }}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: PAIN_MAX, now: value }}
    >
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.08)',
          overflow: 'visible',
        }}
      >
        <View
          style={{
            width: `${frac * 100}%`,
            height: 5,
            borderRadius: 3,
            backgroundColor: theme.accent,
          }}
        />
        {barWidth > 0 && (
          <View
            style={{
              position: 'absolute',
              left: frac * barWidth - 9,
              top: -7,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#fff',
              ...StyleSheet.flatten({
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }),
            }}
          />
        )}
      </View>
    </Pressable>
  )
}
