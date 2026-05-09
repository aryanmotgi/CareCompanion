import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { useTheme } from '../src/theme'
import { GlassCard } from '../src/components/GlassCard'

interface Notification {
  id: string
  type: 'refill_overdue' | 'appointment_prep' | 'abnormal_lab' | 'claim_denied' | 'prescription_ready'
  title: string
  message: string
  createdAt: string
  read: boolean
}

const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  refill_overdue: { light: '#DC2626', dark: '#FCA5A5' },
  appointment_prep: { light: '#2563EB', dark: '#93C5FD' },
  abnormal_lab: { light: '#D97706', dark: '#FCD34D' },
  claim_denied: { light: '#DC2626', dark: '#FCA5A5' },
  prescription_ready: { light: '#059669', dark: '#6EE7B7' },
}

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  refill_overdue: 'medical-outline',
  appointment_prep: 'calendar-outline',
  abnormal_lab: 'flask-outline',
  claim_denied: 'document-text-outline',
  prescription_ready: 'checkmark-circle-outline',
}

function timeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateString).toLocaleDateString()
}

export default function NotificationsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function fetchNotifications() {
      try {
        const token = await SecureStore.getItemAsync('cc-session-token')
        if (!token) {
          setLoading(false)
          return
        }
        const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org'
        const isSecure = baseUrl.startsWith('https://')
        const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'
        const res = await fetch(`${baseUrl}/api/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: `${cookieName}=${token}`,
          },
        })
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : data.notifications || [])
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  function dismissNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  function getTypeColor(type: string): string {
    const colors = TYPE_COLORS[type]
    if (!colors) return theme.accent
    return theme.isDark ? colors.dark : colors.light
  }

  function getTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
    return TYPE_ICONS[type] || 'notifications-outline'
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={theme.rose} />
          <Text style={[styles.emptyTitle, { color: theme.text, marginTop: 16 }]}>
            Could not load notifications
          </Text>
          <Pressable
            onPress={() => {
              setError(false)
              setLoading(true)
              fetchNotifications()
            }}
            style={{
              marginTop: 16,
              backgroundColor: theme.accent,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
            <Ionicons name="checkmark-circle" size={48} color={theme.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>
            You have no new notifications right now.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((notification) => (
            <GlassCard key={notification.id} style={styles.notifCard}>
              <View style={styles.notifRow}>
                {/* Type indicator dot */}
                <View
                  style={[
                    styles.typeDot,
                    { backgroundColor: getTypeColor(notification.type) },
                  ]}
                />
                {/* Icon */}
                <Ionicons
                  name={getTypeIcon(notification.type)}
                  size={20}
                  color={getTypeColor(notification.type)}
                  style={styles.notifIcon}
                />
                {/* Content */}
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, { color: theme.text }]}>
                    {notification.title}
                  </Text>
                  <Text style={[styles.notifMessage, { color: theme.textSub }]}>
                    {notification.message}
                  </Text>
                  <Text style={[styles.notifTime, { color: theme.textMuted }]}>
                    {timeAgo(notification.createdAt)}
                  </Text>
                </View>
                {/* Dismiss */}
                <Pressable
                  onPress={() => dismissNotification(notification.id)}
                  hitSlop={12}
                  style={styles.dismissButton}
                >
                  <Ionicons name="close" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  notifCard: {
    marginBottom: 10,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 8,
  },
  notifIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
})
