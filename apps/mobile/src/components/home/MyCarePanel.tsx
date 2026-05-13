import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../theme'
import { GlassCard } from '../GlassCard'
import { CheckInModal } from './CheckInModal'

const LAST_CHECKIN_KEY = 'cc-last-checkin-date'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Filter = 'all' | 'medications' | 'appointments' | 'labs' | 'checkins' | 'insights'

export function MyCarePanel() {
  const theme = useTheme()
  const [filter, setFilter] = useState<Filter>('all')
  const [checkInOpen, setCheckInOpen] = useState(false)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'medications', label: 'Medications' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'labs', label: 'Labs' },
    { key: 'checkins', label: 'Check-ins' },
    { key: 'insights', label: 'Insights' },
  ]

  return (
    <View style={{ gap: 16 }}>
      {/* Daily Check-in */}
      <View
        style={{
          borderWidth: 1.5,
          borderColor: 'rgba(99,102,241,0.5)',
          borderRadius: 16,
          padding: 16,
          backgroundColor: 'rgba(99,102,241,0.08)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
            Daily Check-in
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
            How are you feeling today?
          </Text>
        </View>
        <Pressable
          onPress={() => setCheckInOpen(true)}
          style={{
            backgroundColor: theme.accent,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Check in</Text>
        </Pressable>
      </View>

      <CheckInModal
        visible={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSubmit={() => {
          AsyncStorage.setItem(LAST_CHECKIN_KEY, todayKey()).catch(() => {})
          /* TODO: POST to /api/journal or wherever the check-in lands. */
        }}
      />

      {/* What's Next + actions */}
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
          WHAT'S NEXT
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton icon="pulse-outline" label="Trends" />
          <ActionButton icon="share-outline" label="Share" />
          <DemoBadge />
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 12 }}
      >
        {filters.map((f) => {
          const isActive = filter === f.key
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isActive ? 'rgba(99,102,241,0.5)' : theme.border,
                backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <Text
                style={{
                  color: isActive ? '#A78BFA' : theme.textMuted,
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Timeline empty-state — ports the web "Your treatment journey will appear here" placeholder */}
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 12,
          paddingTop: 16,
          paddingBottom: 20,
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <TimelineSkeleton theme={theme} />
        <Text
          style={{
            color: theme.text,
            fontSize: 14,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Your treatment journey will appear here
        </Text>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 12,
            lineHeight: 17,
            textAlign: 'center',
            marginTop: 6,
            paddingHorizontal: 16,
          }}
        >
          As you add medications, appointments, and check-ins, CareCompanion will build your timeline.
        </Text>
        <Pressable
          style={{ alignSelf: 'center', marginTop: 10, paddingVertical: 4 }}
          onPress={() => {
            /* Could route to chat; deferred */
          }}
        >
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
            Start a conversation
          </Text>
        </Pressable>
      </View>

      {/* Care Team summary */}
      <GlassCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(99,102,241,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people-outline" size={18} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              Care Team
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>
              No members yet — invite family or doctors
            </Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
        </View>
      </GlassCard>
    </View>
  )
}

function ActionButton({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
}) {
  const theme = useTheme()
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: 'rgba(255,255,255,0.04)',
      }}
    >
      <Ionicons name={icon} size={14} color={theme.textMuted} />
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  )
}

function DemoBadge() {
  return (
    <View
      style={{
        marginLeft: 'auto',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: 'rgba(167,139,250,0.2)',
        alignSelf: 'center',
      }}
    >
      <Text style={{ color: '#A78BFA', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
        DEMO
      </Text>
    </View>
  )
}

function TimelineSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 14, opacity: 0.35 }}>
          <View style={{ width: 28, alignItems: 'center' }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: 'dashed',
              }}
            />
            {i < 2 && (
              <View
                style={{
                  width: 1,
                  height: 50,
                  marginTop: 4,
                  backgroundColor: theme.border,
                }}
              />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <View
              style={{
                height: 8,
                width: 60,
                backgroundColor: theme.border,
                borderRadius: 4,
                marginBottom: 6,
              }}
            />
            <View
              style={{
                height: 32,
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: 'dashed',
                borderRadius: 8,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  )
}
