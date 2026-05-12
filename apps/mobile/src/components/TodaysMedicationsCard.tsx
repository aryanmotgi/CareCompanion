import React from 'react'
import { View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '../theme'
import { GlassCard } from './GlassCard'
import { ShimmerSkeleton } from './ShimmerSkeleton'

type Med = {
  id: string
  name: string
  dose?: string | null
  frequency?: string | null
}

interface Props {
  meds: Med[] | null // null = loading
}

export function TodaysMedicationsCard({ meds }: Props) {
  const theme = useTheme()
  const router = useRouter()

  if (meds === null) {
    return (
      <GlassCard style={{ marginBottom: 12 }}>
        <View style={{ padding: 16 }}>
          <ShimmerSkeleton width="60%" height={12} style={{ marginBottom: 12 }} />
          <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
          <ShimmerSkeleton width="100%" height={16} style={{ marginBottom: 8 }} />
          <ShimmerSkeleton width="80%" height={16} />
        </View>
      </GlassCard>
    )
  }

  return (
    <GlassCard style={{ marginBottom: 12 }} onPress={() => router.push('/(tabs)/care')}>
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            TODAY'S MEDICATIONS
          </Text>
          {meds.length > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: 'rgba(99,102,241,0.2)',
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                {meds.length} {meds.length === 1 ? 'med' : 'meds'}
              </Text>
            </View>
          )}
        </View>

        {meds.length === 0 ? (
          <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 19 }}>
            No medications yet — tap to add.
          </Text>
        ) : (
          meds.map((med) => (
            <View
              key={med.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.amber,
                }}
              />
              <Text
                style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {med.name}
                {med.dose ? ` · ${med.dose}` : ''}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
                {med.frequency || ''}
              </Text>
            </View>
          ))
        )}
      </View>
    </GlassCard>
  )
}
