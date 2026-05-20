import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface Props {
  step: number
  total: number
  /** Optional override; defaults to "Step X of Y". */
  label?: string
}

/**
 * Compact onboarding progress indicator. Renders a "Step X of Y" pill above
 * a thin segmented bar — one segment per total step, filled up to `step`.
 * Designed for dark gradient backgrounds used across the onboarding lanes.
 *
 * Position with `style` from the caller — most onboarding screens place it
 * just under the safe-area top inset and above the screen title.
 */
export function OnboardingStepIndicator({ step, total, label }: Props) {
  const clamped = Math.max(1, Math.min(step, total))
  const segments = Array.from({ length: total }, (_, i) => i + 1)
  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Step ${clamped} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: clamped }}
    >
      <Text style={styles.label}>{label ?? `Step ${clamped} of ${total}`}</Text>
      <View style={styles.bar}>
        {segments.map((n) => (
          <View
            key={n}
            style={[styles.segment, n <= clamped ? styles.segmentFilled : styles.segmentEmpty]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bar: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    maxWidth: 240,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentFilled: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  segmentEmpty: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
})
