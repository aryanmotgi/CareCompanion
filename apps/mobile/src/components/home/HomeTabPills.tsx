import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '../../theme'

export type HomeTab = 'today' | 'myCare'

interface Props {
  active: HomeTab
  onChange: (t: HomeTab) => void
  todayCount?: number
}

export function HomeTabPills({ active, onChange, todayCount }: Props) {
  const theme = useTheme()

  const tabs: { key: HomeTab; label: string; count?: number }[] = [
    { key: 'today', label: 'Today', count: todayCount },
    { key: 'myCare', label: 'My Care' },
  ]

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 999,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: isActive ? theme.accent : 'transparent',
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t.label}
          >
            <Text
              style={{
                color: isActive ? '#fff' : theme.textMuted,
                fontSize: 13,
                fontWeight: isActive ? '700' : '500',
              }}
            >
              {t.label}
            </Text>
            {t.count !== undefined && t.count > 0 && (
              <View
                style={{
                  backgroundColor: isActive ? 'rgba(0,0,0,0.25)' : '#EF4444',
                  borderRadius: 999,
                  minWidth: 18,
                  paddingHorizontal: 5,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                  {t.count}
                </Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
