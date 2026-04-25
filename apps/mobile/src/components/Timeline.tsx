import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { useTheme } from '../theme'
import { useProfile } from '../context/ProfileContext'
import { TimelineCard, type TimelineItemData } from './TimelineCard'

interface TimelineProps {
  onEmpty?: () => void
  onTakeMedication?: (item: TimelineItemData) => void
}

interface DayGroup {
  label: string
  items: TimelineItemData[]
}

function getDayLabel(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()

  const todayStr = now.toDateString()
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toDateString()

  if (date.toDateString() === todayStr) return 'TODAY'
  if (date.toDateString() === tomorrowStr) return 'TOMORROW'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).toUpperCase()
}

function groupByDay(items: TimelineItemData[]): DayGroup[] {
  const groups: Map<string, TimelineItemData[]> = new Map()

  for (const item of items) {
    const label = getDayLabel(item.timestamp)
    const existing = groups.get(label)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(label, [item])
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

function isNowItem(item: TimelineItemData): boolean {
  const itemTime = new Date(item.timestamp).getTime()
  const now = Date.now()
  // Within 30 minutes of now counts as "now"
  return Math.abs(itemTime - now) < 30 * 60 * 1000
}

function StaggeredItem({
  children,
  index,
}: {
  children: React.ReactNode
  index: number
}) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(16)

  useEffect(() => {
    opacity.value = withDelay(index * 60, withSpring(1))
    translateY.value = withDelay(index * 60, withSpring(0))
  }, [index, opacity, translateY])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return <Animated.View style={animStyle}>{children}</Animated.View>
}

export function Timeline({ onEmpty, onTakeMedication }: TimelineProps) {
  const theme = useTheme()
  const { profile, apiClient } = useProfile()
  const [items, setItems] = useState<TimelineItemData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTimeline = useCallback(async () => {
    if (!profile?.careProfileId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const response = await apiClient.timeline.list(profile.careProfileId, 7)
      // The API wraps data in { ok: true, data: [...] }
      const timelineData = (response as any)?.data ?? response ?? []
      const dataArray = Array.isArray(timelineData) ? timelineData : []
      setItems(dataArray)
      if (dataArray.length === 0) {
        onEmpty?.()
      }
    } catch {
      // API may not be deployed — fail gracefully
      setItems([])
      onEmpty?.()
    } finally {
      setLoading(false)
    }
  }, [profile?.careProfileId, apiClient, onEmpty])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Loading your care timeline...
        </Text>
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗓️</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No events yet</Text>
        <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
          Your medications, appointments, and milestones will appear here once you add them.
        </Text>
      </View>
    )
  }

  const dayGroups = groupByDay(items)
  let globalIndex = 0

  return (
    <View style={styles.container}>
      {/* Timeline left border line */}
      <View style={[styles.timelineLine, { backgroundColor: 'rgba(99,102,241,0.3)' }]} />

      {dayGroups.map((group) => (
        <View key={group.label} style={styles.dayGroup}>
          {/* Day label */}
          <View style={styles.dayLabelRow}>
            <View
              style={[
                styles.dayDot,
                {
                  backgroundColor:
                    group.label === 'TODAY' ? theme.accent : 'rgba(99,102,241,0.4)',
                },
              ]}
            />
            <Text
              style={[
                styles.dayLabel,
                {
                  color: group.label === 'TODAY' ? theme.accent : theme.textMuted,
                },
              ]}
            >
              {group.label}
            </Text>
          </View>

          {/* Items */}
          <View style={styles.itemsContainer}>
            {group.items.map((item) => {
              const idx = globalIndex++
              const nowItem = isNowItem(item)
              return (
                <StaggeredItem key={item.id} index={idx}>
                  <View style={styles.itemRow}>
                    {/* Timeline dot */}
                    <View
                      style={[
                        styles.itemDot,
                        {
                          backgroundColor: nowItem
                            ? theme.accent
                            : 'rgba(99,102,241,0.25)',
                          borderColor: nowItem ? theme.accent : 'transparent',
                          borderWidth: nowItem ? 2 : 0,
                        },
                        nowItem && {
                          shadowColor: theme.accent,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.6,
                          shadowRadius: 6,
                          elevation: 4,
                        },
                      ]}
                    />
                    <View style={styles.cardWrapper}>
                      <TimelineCard
                        item={item}
                        onTakeMedication={onTakeMedication}
                      />
                    </View>
                  </View>
                </StaggeredItem>
              )
            })}
          </View>
        </View>
      ))}

      {/* AI insight card at the bottom */}
      <View style={styles.insightContainer}>
        <View style={[styles.insightCard, { backgroundColor: 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.insightRow}>
            <View style={[styles.insightIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Text style={styles.insightEmoji}>{'✨'}</Text>
            </View>
            <View style={styles.insightText}>
              <Text style={[styles.insightTitle, { color: theme.text }]}>
                AI Insight
              </Text>
              <Text style={[styles.insightBody, { color: theme.textSub }]}>
                {getContextualTip(items)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

function getContextualTip(items: TimelineItemData[]): string {
  const medCount = items.filter((i) => i.type === 'medication').length
  const apptCount = items.filter((i) => i.type === 'appointment').length
  const refillCount = items.filter((i) => i.type === 'refill').length

  if (refillCount > 0) {
    return 'You have medications due for refill soon. Consider calling your pharmacy today to avoid gaps in your treatment.'
  }
  if (apptCount > 0 && medCount > 0) {
    return `You have ${medCount} medication${medCount !== 1 ? 's' : ''} and ${apptCount} appointment${apptCount !== 1 ? 's' : ''} coming up. Stay on track — consistency makes a difference.`
  }
  if (medCount > 0) {
    return 'Staying consistent with your medication schedule helps maximize treatment effectiveness. You are doing great.'
  }
  if (apptCount > 0) {
    return 'Prepare any questions you have for your upcoming appointment. Writing them down helps you remember in the moment.'
  }
  return 'Your care timeline is looking clear. Take this time to rest and focus on recovery.'
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 12,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  dayGroup: {
    marginBottom: 16,
  },
  dayLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 0,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    // Align with the timeline line: line is at left: 19, centered on a 2px line
    // so dot center should be at 20px. Dot is 10px wide, so left edge at 15px
    // But with paddingLeft 12 on container, we want it at position ~8 from content start
    marginLeft: -4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  itemsContainer: {
    paddingLeft: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 18,
    marginRight: 8,
    marginLeft: -12,
  },
  cardWrapper: {
    flex: 1,
  },
  insightContainer: {
    paddingLeft: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  insightCard: {
    borderRadius: 12,
    padding: 14,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  insightEmoji: {
    fontSize: 16,
  },
  insightText: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  insightBody: {
    fontSize: 13,
    lineHeight: 18,
  },
})
