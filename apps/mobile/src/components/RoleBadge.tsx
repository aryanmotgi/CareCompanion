/**
 * Small pill badge surfacing the user's role (Patient / Caregiver / Self).
 *
 * Source of truth: AsyncStorage['cc-user-type'] — set by /care-type during
 * onboarding. We read async on mount and re-read when `refreshKey` changes
 * (used by Settings to react to role edits without a remount).
 */
import React, { useEffect, useState } from 'react'
import { Text, StyleSheet, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'

type UserType = 'patient' | 'caregiver' | 'self'

const ROLE_META: Record<UserType, { label: string; color: string; bg: string }> = {
  patient:   { label: 'Patient',   color: '#A78BFA', bg: 'rgba(167,139,250,0.16)' }, // lavender
  caregiver: { label: 'Caregiver', color: '#67E8F9', bg: 'rgba(103,232,249,0.16)' }, // cyan
  self:      { label: 'Self',      color: '#6EE7B7', bg: 'rgba(110,231,183,0.16)' }, // emerald
}

interface Props {
  refreshKey?: number
  style?: object
}

export function RoleBadge({ refreshKey, style }: Props) {
  const [role, setRole] = useState<UserType | null>(null)

  useEffect(() => {
    let cancelled = false
    SecureStore.getItemAsync('cc-user-type')
      .then((v) => {
        if (cancelled) return
        if (v === 'patient' || v === 'caregiver' || v === 'self') setRole(v)
        else setRole(null)
      })
      .catch(() => { if (!cancelled) setRole(null) })
    return () => { cancelled = true }
  }, [refreshKey])

  if (!role) return null
  const meta = ROLE_META[role]
  return (
    <View style={[styles.pill, { backgroundColor: meta.bg, borderColor: meta.color + '55' }, style]}>
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
})
