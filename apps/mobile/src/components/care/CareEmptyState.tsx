// apps/mobile/src/components/care/CareEmptyState.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme'

type Props = {
  iconName: string
  heading: string
  body: string
  patientName?: string | null
  actionLabel?: string
  onAction?: () => void
}

export function CareEmptyState({
  iconName,
  heading,
  body,
  patientName,
  actionLabel,
  onAction,
}: Props) {
  const theme = useTheme()
  const name = patientName ?? 'your loved one'

  const displayHeading = heading.replace('{name}', name)
  const displayBody = body.replace('{name}', name)

  return (
    <View style={styles.root}>
      {/* Icon container — matches web rounded-2xl with accent tint */}
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(99,102,241,0.10)', borderColor: 'rgba(99,102,241,0.20)' }]}>
        <Ionicons name={iconName as any} size={26} color={theme.accent} />
      </View>

      <Text style={[styles.heading, { color: theme.text }]}>{displayHeading}</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{displayBody}</Text>

      {actionLabel && onAction && (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onAction()
          }}
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
