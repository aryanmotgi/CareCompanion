import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme'

export interface TimelineItemData {
  id: string
  type: 'medication' | 'appointment' | 'lab' | 'refill'
  title: string
  subtitle: string | null
  timestamp: string
  meta?: Record<string, unknown>
}

interface TimelineCardProps {
  item: TimelineItemData
  onTakeMedication?: (item: TimelineItemData) => void
}

const TYPE_CONFIG = {
  medication: {
    icon: 'medical-outline' as const,
    label: 'MEDICATION',
    getBorderColor: (theme: ReturnType<typeof useTheme>) => theme.accent,
    getBgColor: () => 'rgba(99,102,241,0.08)',
    getDotColor: (theme: ReturnType<typeof useTheme>) => theme.accent,
  },
  appointment: {
    icon: 'calendar-outline' as const,
    label: 'APPOINTMENT',
    getBorderColor: (theme: ReturnType<typeof useTheme>) => theme.green,
    getBgColor: () => 'rgba(110,231,183,0.08)',
    getDotColor: (theme: ReturnType<typeof useTheme>) => theme.green,
  },
  lab: {
    icon: 'flask-outline' as const,
    label: 'LAB RESULT',
    getBorderColor: (theme: ReturnType<typeof useTheme>) => theme.cyan,
    getBgColor: () => 'rgba(103,232,249,0.08)',
    getDotColor: (theme: ReturnType<typeof useTheme>) => theme.cyan,
  },
  refill: {
    icon: 'reload-outline' as const,
    label: 'REFILL NEEDED',
    getBorderColor: (theme: ReturnType<typeof useTheme>) => theme.amber,
    getBgColor: () => 'rgba(252,211,77,0.08)',
    getDotColor: (theme: ReturnType<typeof useTheme>) => theme.amber,
  },
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function isPast(timestamp: string): boolean {
  return new Date(timestamp).getTime() < Date.now()
}

export function TimelineCard({ item, onTakeMedication }: TimelineCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const expandHeight = useSharedValue(0)
  const scale = useSharedValue(1)

  const config = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] ?? {
    icon: 'time-outline' as const,
    label: 'EVENT',
    getBorderColor: (t: ReturnType<typeof useTheme>) => t.accent,
    getBgColor: () => 'rgba(99,102,241,0.08)',
    getDotColor: (t: ReturnType<typeof useTheme>) => t.accent,
  }
  const borderColor = config.getBorderColor(theme)
  const bgColor = config.getBgColor()
  const past = isPast(item.timestamp)

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpanded((prev) => !prev)
    expandHeight.value = withSpring(expanded ? 0 : 1, { damping: 18, stiffness: 180 })
  }

  function handlePressIn() {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 })
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
  }

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const expandStyle = useAnimatedStyle(() => ({
    maxHeight: expandHeight.value * 120,
    opacity: withTiming(expandHeight.value > 0.5 ? 1 : 0, { duration: 200 }),
    marginTop: expandHeight.value * 12,
  }))

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: bgColor,
            borderLeftColor: borderColor,
            borderLeftWidth: 3,
          },
          past && styles.cardPast,
          cardAnimStyle,
        ]}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={[styles.iconBadge, { backgroundColor: `${borderColor}20` }]}>
            <Ionicons name={config.icon} size={16} color={borderColor} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.typeLabel, { color: borderColor }]}>{config.label}</Text>
            <Text
              style={[styles.title, { color: theme.text }, past && styles.titlePast]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textSub }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.timeColumn}>
            <Text style={[styles.time, { color: past ? theme.textMuted : theme.text }]}>
              {formatTime(item.timestamp)}
            </Text>
            {past && (
              <View style={[styles.pastBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={[styles.pastText, { color: theme.textMuted }]}>Past</Text>
              </View>
            )}
          </View>
        </View>

        {/* Expanded content */}
        <Animated.View style={[styles.expandArea, expandStyle]}>
          {item.type === 'medication' && (
            <View style={styles.expandContent}>
              {item.meta?.frequency ? (
                <Text style={[styles.expandDetail, { color: theme.textSub }]}>
                  Frequency: {String(item.meta.frequency)}
                </Text>
              ) : null}
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.accent }]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onTakeMedication?.(item)
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Take</Text>
              </Pressable>
            </View>
          )}

          {item.type === 'appointment' && (
            <View style={styles.expandContent}>
              {item.meta?.location ? (
                <View style={styles.expandRow}>
                  <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.expandDetail, { color: theme.textSub, marginLeft: 4 }]}>
                    {String(item.meta.location)}
                  </Text>
                </View>
              ) : null}
              {item.meta?.specialty ? (
                <View style={styles.expandRow}>
                  <Ionicons name="medkit-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.expandDetail, { color: theme.textSub, marginLeft: 4 }]}>
                    {String(item.meta.specialty)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {item.type === 'lab' && (
            <View style={styles.expandContent}>
              {item.meta?.referenceRange ? (
                <Text style={[styles.expandDetail, { color: theme.textSub }]}>
                  Ref. range: {String(item.meta.referenceRange)}
                </Text>
              ) : null}
              {item.meta?.isAbnormal ? (
                <View style={[styles.abnormalBadge, { backgroundColor: 'rgba(252,165,165,0.15)' }]}>
                  <Text style={[styles.abnormalText, { color: theme.rose }]}>Abnormal</Text>
                </View>
              ) : null}
            </View>
          )}

          {item.type === 'refill' && (
            <View style={styles.expandContent}>
              {item.meta?.pharmacyPhone ? (
                <View style={styles.expandRow}>
                  <Ionicons name="call-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.expandDetail, { color: theme.textSub, marginLeft: 4 }]}>
                    {String(item.meta.pharmacyPhone)}
                  </Text>
                </View>
              ) : null}
              <Pressable style={[styles.actionButton, { backgroundColor: theme.amber }]}>
                <Ionicons name="reload-outline" size={16} color="#000" />
                <Text style={[styles.actionButtonText, { color: '#000' }]}>Request Refill</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  cardPast: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  titlePast: {
    textDecorationLine: 'line-through',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  timeColumn: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
  },
  pastBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pastText: {
    fontSize: 10,
    fontWeight: '600',
  },
  expandArea: {
    overflow: 'hidden',
  },
  expandContent: {
    gap: 8,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandDetail: {
    fontSize: 13,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  abnormalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  abnormalText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
