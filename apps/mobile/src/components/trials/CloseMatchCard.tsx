import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme'
import type { TrialMatch, EligibilityGap } from '@carecompanion/api'

type Props = {
  trial: TrialMatch
  savedStatus: string | null
  onSave: (nctId: string) => void
  onDismiss: (nctId: string) => void
}

function getGapLabel(gap: EligibilityGap): string {
  if (gap.gapType === 'measurable') return 'Lab value to reach'
  if (gap.gapType === 'fixed') return 'Permanent barrier'
  const desc = gap.description.toLowerCase()
  if (desc.includes('medication') || desc.includes('drug') || desc.includes('stop') || desc.includes('prior')) {
    return 'Medication to stop'
  }
  if (desc.includes('complet') || desc.includes('line') || desc.includes('therapy')) {
    return 'Treatment to complete'
  }
  return 'Condition to meet'
}

export function CloseMatchCard({ trial, savedStatus, onSave, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()

  const { nctId, title, phase, trialUrl, eligibilityGaps } = trial
  const gaps = eligibilityGaps ?? []

  function handleExpand() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpanded(e => !e)
  }

  function handleSave() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSave(nctId)
  }

  function handleDismiss() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onDismiss(nctId)
  }

  function handleOpenUrl() {
    const url = trialUrl ?? `https://clinicaltrials.gov/study/${nctId}`
    void Linking.openURL(url)
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
      {/* Header */}
      <Pressable onPress={handleExpand} style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={expanded ? 0 : 2}>
            {title}
          </Text>
          <Text style={[styles.nctId, { color: theme.textMuted }]}>
            {nctId} · {phase ?? 'Phase N/A'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.almostBadge, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
            <Text style={[styles.almostText, { color: theme.violet }]}>Almost there</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textMuted}
            style={{ marginTop: 4 }}
          />
        </View>
      </Pressable>

      {/* Gaps summary — always visible */}
      <View style={styles.gapsBlock}>
        <Text style={[styles.gapsLabel, { color: theme.textSub }]}>What would need to change</Text>
        {gaps.length === 0 ? (
          <Text style={[styles.noGapText, { color: theme.textMuted }]}>
            No specific gaps identified — ask your oncologist to review eligibility.
          </Text>
        ) : (
          <>
            {gaps.slice(0, expanded ? undefined : 2).map((gap, i) => (
              <View key={i} style={[styles.gapCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: theme.border }]}>
                <View style={[styles.gapTypeBadge, { backgroundColor: 'rgba(167,139,250,0.10)' }]}>
                  <Text style={[styles.gapTypeText, { color: theme.violet }]}>{getGapLabel(gap)}</Text>
                </View>
                <Text style={[styles.gapDesc, { color: theme.textSub }]}>{gap.description}</Text>
                {gap.gapType === 'measurable' && gap.metric && (
                  <Text style={[styles.gapMeta, { color: theme.textMuted }]}>
                    {gap.currentValue ? `Current: ${gap.currentValue}${gap.unit ? ` ${gap.unit}` : ''} · ` : ''}
                    {gap.requiredValue ? `Target: ${gap.requiredValue}${gap.unit ? ` ${gap.unit}` : ''}` : ''}
                  </Text>
                )}
                {!gap.verifiable && (
                  <Text style={[styles.gapUnverifiable, { color: 'rgba(252,211,77,0.80)' }]}>
                    Can't verify automatically — worth asking your care team
                  </Text>
                )}
              </View>
            ))}
            {!expanded && gaps.length > 2 && (
              <Text style={[styles.moreText, { color: theme.textMuted }]}>
                +{gaps.length - 2} more barriers
              </Text>
            )}
          </>
        )}
      </View>

      {/* Collapsed actions */}
      {!expanded && (
        <View style={styles.actions}>
          <Pressable onPress={handleExpand} style={[styles.primaryBtn, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryBtnText}>View details →</Text>
          </Pressable>
          <Pressable onPress={handleDismiss} style={styles.ghostBtn}>
            <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Expanded actions */}
      {expanded && (
        <View style={[styles.expandedActions, { borderTopColor: theme.border }]}>
          {savedStatus === 'interested' ? (
            <View style={[styles.iconBtn, { backgroundColor: 'rgba(110,231,183,0.12)' }]}>
              <Ionicons name="eye" size={14} color={theme.green} />
              <Text style={[styles.iconBtnText, { color: theme.green }]}>Watching</Text>
            </View>
          ) : (
            <Pressable onPress={handleSave} style={[styles.iconBtn, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Ionicons name="eye-outline" size={14} color={theme.accent} />
              <Text style={[styles.iconBtnText, { color: theme.accent }]}>Watch</Text>
            </Pressable>
          )}
          <Pressable onPress={handleOpenUrl} style={[styles.outlineBtn, { borderColor: theme.border }]}>
            <Text style={[styles.outlineBtnText, { color: theme.textSub }]}>Open trial →</Text>
          </Pressable>
          <Pressable onPress={handleDismiss} style={styles.ghostBtn}>
            <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Dismiss</Text>
          </Pressable>
          <Pressable onPress={handleExpand} style={{ marginLeft: 'auto' }}>
            <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Collapse ▲</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  nctId: {
    fontSize: 12,
    marginTop: 3,
  },
  almostBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  almostText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gapsBlock: {
    marginTop: 10,
  },
  gapsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  noGapText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  gapCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  gapTypeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 5,
  },
  gapTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gapDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  gapMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  gapUnverifiable: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  moreText: {
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ghostBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  ghostBtnText: {
    fontSize: 12,
  },
  expandedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  iconBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
