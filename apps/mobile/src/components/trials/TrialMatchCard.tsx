import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Linking, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme'
import type { TrialMatch } from '@carecompanion/api'

type Props = {
  trial: TrialMatch
  savedStatus: string | null
  onSave: (nctId: string) => void
  onDismiss: (nctId: string) => void
  onShare: (nctId: string, title: string, url: string) => void
}

export function TrialMatchCard({ trial, savedStatus, onSave, onDismiss, onShare }: Props) {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()

  const {
    nctId, title, matchScore, matchReasons, disqualifyingFactors,
    uncertainFactors, phase, enrollmentStatus, locations, trialUrl, stale, updatedAt,
  } = trial

  const nearestSite = locations?.[0]

  const scoreColor = matchScore >= 80 ? theme.green : matchScore >= 60 ? theme.accent : theme.amber
  const scoreBg = matchScore >= 80
    ? 'rgba(110,231,183,0.12)'
    : matchScore >= 60
    ? 'rgba(99,102,241,0.12)'
    : 'rgba(252,211,77,0.12)'

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

  function handleShare() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onShare(nctId, title, trialUrl ?? '')
  }

  function handleOpenUrl() {
    const url = trialUrl ?? `https://clinicaltrials.gov/study/${nctId}`
    void Linking.openURL(url)
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
      {/* Header — tap to expand */}
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
          <View style={[styles.scoreBadge, { backgroundColor: scoreBg }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>{matchScore}% match</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textMuted}
            style={{ marginTop: 4 }}
          />
        </View>
      </Pressable>

      {/* Stale warning */}
      {stale && (
        <View style={[styles.staleRow, { backgroundColor: 'rgba(251,191,36,0.10)' }]}>
          <Text style={[styles.staleText, { color: 'rgba(251,191,36,0.80)' }]}>
            From{updatedAt ? ` ${new Date(updatedAt).toLocaleDateString()}` : ' earlier'} — tap Refresh
          </Text>
        </View>
      )}

      {/* Match reasons */}
      {matchReasons.length > 0 && (
        <View style={styles.reasonsBlock}>
          {matchReasons.slice(0, expanded ? undefined : 2).map((r, i) => (
            <View key={i} style={styles.reasonRow}>
              <Text style={[styles.reasonIcon, { color: theme.green }]}>✓</Text>
              <Text style={[styles.reasonText, { color: theme.textSub }]}>{r}</Text>
            </View>
          ))}
          {!expanded && matchReasons.length > 2 && (
            <Text style={[styles.moreText, { color: theme.textMuted }]}>
              +{matchReasons.length - 2} more
            </Text>
          )}
        </View>
      )}

      {/* Disqualifying factor (collapsed, 1 max) */}
      {!expanded && disqualifyingFactors.length > 0 && (
        <View style={styles.reasonRow}>
          <Text style={[styles.reasonIcon, { color: theme.rose }]}>✗</Text>
          <Text style={[styles.reasonText, { color: theme.textSub }]}>{disqualifyingFactors[0]}</Text>
        </View>
      )}

      {/* Location (collapsed) */}
      {nearestSite && !expanded && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={11} color={theme.textMuted} />
          <Text style={[styles.locationText, { color: theme.textMuted }]}>
            {[nearestSite.city, nearestSite.state].filter(Boolean).join(', ') || 'Location not listed'}
            {enrollmentStatus === 'RECRUITING' && (
              <Text style={{ color: theme.green }}> · Recruiting</Text>
            )}
          </Text>
        </View>
      )}

      {/* Collapsed actions */}
      {!expanded && (
        <View style={styles.actions}>
          <Pressable onPress={handleExpand} style={[styles.primaryBtn, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryBtnText}>View details →</Text>
          </Pressable>
          <Pressable onPress={handleShare} style={[styles.outlineBtn, { borderColor: theme.border }]}>
            <Text style={[styles.outlineBtnText, { color: theme.textSub }]}>Share</Text>
          </Pressable>
          <Pressable onPress={handleDismiss} style={styles.ghostBtn}>
            <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: theme.border }]}>
          {/* All reasons */}
          {matchReasons.length > 0 && (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: theme.textMuted }]}>WHY YOU QUALIFY</Text>
              {matchReasons.map((r, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Text style={[styles.reasonIcon, { color: theme.green }]}>✓</Text>
                  <Text style={[styles.reasonText, { color: theme.textSub }]}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Concerns */}
          {disqualifyingFactors.length > 0 && (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: theme.textMuted }]}>CONCERNS</Text>
              {disqualifyingFactors.map((f, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Text style={[styles.reasonIcon, { color: theme.rose }]}>✗</Text>
                  <Text style={[styles.reasonText, { color: theme.textSub }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Uncertain */}
          {uncertainFactors.length > 0 && (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: theme.textMuted }]}>TO VERIFY</Text>
              {uncertainFactors.map((f, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Text style={[styles.reasonIcon, { color: theme.amber }]}>?</Text>
                  <Text style={[styles.reasonText, { color: theme.textSub }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Location */}
          {nearestSite && (
            <View style={[styles.locationRow, { marginTop: 2 }]}>
              <Ionicons name="location-outline" size={11} color={theme.textMuted} />
              <Text style={[styles.locationText, { color: theme.textMuted }]}>
                {[nearestSite.city, nearestSite.state].filter(Boolean).join(', ') || 'Location not listed'}
                {enrollmentStatus === 'RECRUITING' && ' · Currently recruiting'}
              </Text>
            </View>
          )}

          {/* Save + Open */}
          <View style={[styles.expandedActions, { borderTopColor: theme.border }]}>
            {savedStatus === 'interested' ? (
              <View style={[styles.iconBtn, { backgroundColor: 'rgba(110,231,183,0.12)' }]}>
                <Ionicons name="bookmark" size={14} color={theme.green} />
                <Text style={[styles.iconBtnText, { color: theme.green }]}>Saved</Text>
              </View>
            ) : (
              <Pressable onPress={handleSave} style={[styles.iconBtn, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                <Ionicons name="bookmark-outline" size={14} color={theme.accent} />
                <Text style={[styles.iconBtnText, { color: theme.accent }]}>Save</Text>
              </Pressable>
            )}
            <Pressable onPress={handleOpenUrl} style={[styles.outlineBtn, { borderColor: theme.border }]}>
              <Text style={[styles.outlineBtnText, { color: theme.textSub }]}>Open trial →</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={handleShare} style={[styles.outlineBtn, { borderColor: theme.border }]}>
              <Text style={[styles.outlineBtnText, { color: theme.textSub }]}>Share with oncologist</Text>
            </Pressable>
            <Pressable onPress={handleDismiss} style={styles.ghostBtn}>
              <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Dismiss</Text>
            </Pressable>
            <Pressable onPress={handleExpand} style={{ marginLeft: 'auto' }}>
              <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>Collapse ▲</Text>
            </Pressable>
          </View>
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
  scoreBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staleRow: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  staleText: {
    fontSize: 11,
  },
  reasonsBlock: {
    marginTop: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reasonIcon: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
    marginTop: 1,
    width: 12,
    textAlign: 'center',
  },
  reasonText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  moreText: {
    fontSize: 11,
    marginLeft: 18,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontSize: 11,
    marginLeft: 4,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  expandSection: {
    marginBottom: 12,
  },
  expandLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  expandedActions: {
    flexDirection: 'row',
    gap: 8,
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
