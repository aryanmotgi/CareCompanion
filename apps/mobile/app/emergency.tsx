import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { createApiClient } from '@carecompanion/api'
import { useProfile } from '../src/context/ProfileContext'
import { GlassCard } from '../src/components/GlassCard'
import { useTheme } from '../src/theme'
import type { Medication } from '@carecompanion/types'

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://carecompanionai.org',
  getToken: () => SecureStore.getItemAsync('cc-session-token'),
})

export default function EmergencyScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()

  const [medications, setMedications] = useState<Medication[]>([])
  const [medsLoading, setMedsLoading] = useState(true)
  const [medsError, setMedsError] = useState(false)

  useEffect(() => {
    if (!profile?.careProfileId) {
      setMedsLoading(false)
      return
    }
    apiClient.medications
      .list(profile.careProfileId)
      .then(setMedications)
      .catch(() => { setMedsError(true) })
      .finally(() => setMedsLoading(false))
  }, [profile?.careProfileId])

  const patientName = profile?.patientName || profile?.displayName || 'Unknown'
  const allergies = profile?.allergies || null
  const conditions = profile?.conditions || null
  const emergencyContactName = profile?.emergencyContactName || null
  const emergencyContactPhone = profile?.emergencyContactPhone || null

  const isEmpty = !allergies && medications.length === 0 && !emergencyContactName

  // Build plain-text for sharing
  function buildPlainText(): string {
    const lines = [
      `EMERGENCY INFORMATION - ${patientName}`,
      '',
      `ALLERGIES: ${allergies || 'NKDA (No Known Drug Allergies)'}`,
      `CONDITIONS: ${conditions || 'None listed'}`,
      '',
      'CURRENT MEDICATIONS:',
      ...(medications.length > 0
        ? medications.map((m) => `  - ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
        : ['  None listed']),
      '',
    ]
    if (emergencyContactName) {
      lines.push(`EMERGENCY CONTACT: ${emergencyContactName}${emergencyContactPhone ? ` ${emergencyContactPhone}` : ''}`)
    }
    return lines.join('\n')
  }

  async function handleShare() {
    try {
      await Share.share({
        title: `Emergency Info - ${patientName}`,
        message: buildPlainText(),
      })
    } catch {
      // user cancelled
    }
  }

  function handleCall911() {
    Alert.alert(
      'Call 911?',
      'Are you sure you want to call emergency services?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:911'),
        },
      ],
    )
  }

  function handleCall988() {
    Linking.openURL('tel:988')
  }

  const isLoading = profileLoading || medsLoading

  // Colors
  const redBg = t.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.08)'
  const redBorder = t.isDark ? 'rgba(239,68,68,0.25)' : 'rgba(220,38,38,0.2)'
  const sectionBorder = t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const amberBg = t.isDark ? 'rgba(251,191,36,0.1)' : 'rgba(217,119,6,0.08)'
  const amberBorder = t.isDark ? 'rgba(251,191,36,0.2)' : 'rgba(217,119,6,0.15)'

  return (
    <View
      style={[s.container, { backgroundColor: t.bg, paddingTop: insets.top }]}
      accessibilityRole="summary"
      accessibilityLabel="Emergency medical information card"
    >
      {/* Header bar */}
      <View style={s.header}>
        <Text
          style={[s.headerTitle, { color: t.text }]}
          accessibilityRole="header"
        >
          Emergency Card
        </Text>
        <View style={s.headerActions}>
          <Pressable
            onPress={handleShare}
            style={[s.headerBtn, { backgroundColor: t.bgElevated }]}
            accessibilityLabel="Share emergency information"
            accessibilityRole="button"
          >
            <Text style={{ color: t.textSub, fontSize: 16 }}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={[s.closeBtn, { backgroundColor: t.bgElevated }]}
            accessibilityLabel="Close emergency card"
            accessibilityRole="button"
          >
            <Text style={{ color: t.textSub, fontSize: 18, fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={t.rose} />
          <Text style={[s.loadingText, { color: t.textMuted }]}>
            Loading emergency info...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Emergency Info Card */}
          <GlassCard
            style={{
              padding: 0,
              borderColor: redBorder,
              borderWidth: 2,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* Red header bar */}
            <View
              style={[s.emergencyHeader, { backgroundColor: t.isDark ? '#DC2626' : '#DC2626' }]}
              accessibilityLabel="Emergency information header"
            >
              <Text style={s.emergencyIcon}>⚠️</Text>
              <View>
                <Text style={s.emergencyTitle}>EMERGENCY INFO</Text>
                <Text style={s.emergencySubtitle}>Medical Information Card</Text>
              </View>
            </View>

            {/* Patient name */}
            <View
              style={[s.section, { borderBottomColor: sectionBorder }]}
              accessibilityLabel={`Patient name: ${patientName}`}
            >
              <Text style={[s.patientName, { color: t.text }]}>{patientName}</Text>
            </View>

            {/* Allergies - highlighted */}
            <View
              style={[s.section, { backgroundColor: redBg, borderBottomColor: sectionBorder }]}
              accessibilityLabel={`Allergies: ${allergies || 'No known drug allergies'}`}
            >
              <Text style={[s.sectionLabel, { color: t.rose }]}>ALLERGIES</Text>
              <Text style={[s.sectionValue, { color: t.text, fontWeight: '600' }]}>
                {allergies || 'NKDA (No Known Drug Allergies)'}
              </Text>
            </View>

            {/* Conditions */}
            <View
              style={[s.section, { borderBottomColor: sectionBorder }]}
              accessibilityLabel={`Conditions: ${conditions || 'None listed'}`}
            >
              <Text style={[s.sectionLabel, { color: t.textMuted }]}>CONDITIONS</Text>
              <Text style={[s.sectionValue, { color: t.text }]}>
                {conditions || 'None listed'}
              </Text>
            </View>

            {/* Current Medications */}
            <View
              style={[s.section, { borderBottomColor: sectionBorder }]}
              accessibilityLabel={`Current medications: ${medications.length > 0 ? medications.map((m) => m.name).join(', ') : 'None listed'}`}
            >
              <Text style={[s.sectionLabel, { color: t.textMuted }]}>CURRENT MEDICATIONS</Text>
              {medsError ? (
                <Text style={[s.sectionValue, { color: t.rose }]}>Could not load medications</Text>
              ) : medications.length === 0 ? (
                <Text style={[s.sectionValue, { color: t.textSub }]}>None listed</Text>
              ) : (
                medications.map((med) => (
                  <View key={med.id} style={s.medRow}>
                    <Text style={[s.medName, { color: t.text }]}>{med.name}</Text>
                    {(med.dose || med.frequency) && (
                      <Text style={[s.medDetail, { color: t.textSub }]}>
                        {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Emergency Contact */}
            <View
              style={[s.section, { borderBottomWidth: 0 }]}
              accessibilityLabel={
                emergencyContactName
                  ? `Emergency contact: ${emergencyContactName}${emergencyContactPhone ? `, phone: ${emergencyContactPhone}` : ''}`
                  : 'Emergency contact: Not set'
              }
            >
              <Text style={[s.sectionLabel, { color: t.textMuted }]}>EMERGENCY CONTACT</Text>
              {emergencyContactName ? (
                <View style={s.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sectionValue, { color: t.text }]}>{emergencyContactName}</Text>
                    {emergencyContactPhone && (
                      <Text style={[s.contactPhone, { color: t.textSub }]}>{emergencyContactPhone}</Text>
                    )}
                  </View>
                  {emergencyContactPhone && (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${emergencyContactPhone}`)}
                      style={[s.callContactBtn, { backgroundColor: t.isDark ? 'rgba(110,231,183,0.15)' : 'rgba(5,150,105,0.1)' }]}
                      accessibilityLabel={`Call emergency contact ${emergencyContactName}`}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: t.green, fontSize: 13, fontWeight: '600' }}>Call</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={[s.sectionValue, { color: t.amber }]}>Not set</Text>
              )}
            </View>
          </GlassCard>

          {/* Action buttons */}
          <View style={s.actionRow}>
            <Pressable
              onPress={handleCall911}
              style={[s.call911Btn, t.shadowGlowRose]}
              accessibilityLabel="Call 911 emergency services"
              accessibilityRole="button"
              accessibilityHint="Double tap to call 911. A confirmation dialog will appear first."
            >
              <Text style={s.call911Text}>Call 911</Text>
            </Pressable>

            <Pressable
              onPress={handleCall988}
              style={[s.call988Btn, { backgroundColor: t.bgElevated, borderColor: sectionBorder }]}
              accessibilityLabel="Call 988 suicide and crisis lifeline"
              accessibilityRole="button"
            >
              <Text style={[s.call988Text, { color: t.text }]}>988 Crisis Line</Text>
            </Pressable>
          </View>

          {/* Empty state guidance */}
          {isEmpty && (
            <View
              style={[s.emptyState, { backgroundColor: amberBg, borderColor: amberBorder }]}
              accessibilityLabel="Your emergency card is incomplete. Set up your profile to help first responders."
            >
              <Text style={[s.emptyTitle, { color: t.text }]}>Set up your emergency card</Text>
              <Text style={[s.emptyDesc, { color: t.textSub }]}>
                Add your emergency contact, medications, and allergies so first responders can help you quickly.
              </Text>
            </View>
          )}

          {/* Tip */}
          <Text
            style={[s.tip, { color: t.textMuted }]}
            accessibilityLabel="Tip: Show this screen to a paramedic, ER nurse, or first responder in an emergency."
          >
            Show this to a paramedic, ER nurse, or first responder in an emergency.
          </Text>
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  emergencyIcon: {
    fontSize: 22,
  },
  emergencyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emergencySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 15,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '700',
  },
  medRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6,
  },
  medName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  medDetail: {
    fontSize: 12,
    marginLeft: 8,
    flexShrink: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  callContactBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  call911Btn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  call911Text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  call988Btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  call988Text: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tip: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
})
