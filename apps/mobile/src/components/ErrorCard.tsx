import React from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'

interface ErrorCardProps {
  title?: string
  message?: string
  onRetry?: () => void | Promise<void>
  retrying?: boolean
  variant?: 'inline' | 'fullCard'
}

export function ErrorCard({
  title = "Couldn't load this",
  message = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  variant = 'fullCard',
}: ErrorCardProps) {
  const theme = useTheme()

  const handleRetry = async () => {
    if (retrying || !onRetry) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    await onRetry()
  }

  return (
    <View
      style={{
        padding: variant === 'inline' ? 12 : 18,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.25)',
        backgroundColor: 'rgba(248,113,113,0.08)',
        flexDirection: variant === 'inline' ? 'row' : 'column',
        alignItems: variant === 'inline' ? 'center' : 'flex-start',
        gap: variant === 'inline' ? 10 : 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={variant === 'inline' ? 18 : 22} color="#F87171" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: variant === 'inline' ? 13 : 15, fontWeight: '700' }}>
          {title}
        </Text>
        {message ? (
          <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            {message}
          </Text>
        ) : null}
      </View>
      {onRetry ? (
        <Pressable
          onPress={handleRetry}
          disabled={retrying}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: 'rgba(248,113,113,0.15)',
            opacity: pressed || retrying ? 0.6 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: variant === 'inline' ? 0 : 8,
            alignSelf: variant === 'inline' ? 'auto' : 'flex-start',
          })}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#F87171" />
          ) : (
            <Ionicons name="refresh" size={14} color="#F87171" />
          )}
          <Text style={{ color: '#F87171', fontSize: 13, fontWeight: '700' }}>
            {retrying ? 'Retrying…' : 'Retry'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

interface OfflineBannerProps {
  visible: boolean
  onDismiss?: () => void
}

export function OfflineBanner({ visible, onDismiss }: OfflineBannerProps) {
  if (!visible) return null
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: 'rgba(248,113,113,0.95)',
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="white" />
      <Text style={{ color: 'white', fontSize: 13, fontWeight: '700', flex: 1 }}>
        You're offline — showing last saved data
      </Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={16} color="white" />
        </Pressable>
      ) : null}
    </View>
  )
}
